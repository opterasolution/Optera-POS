import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/tenant";
import { connectToDatabase } from "@/lib/db";
import { VanSaleSession } from "@/models/VanSaleSession";
import { DeliveryDriver } from "@/models/DeliveryDriver";
import { Product } from "@/models/Product";
import { InventoryMovement } from "@/models/InventoryMovement";

export async function GET(req: NextRequest) {
  try {
    const context = await requireAuth();
    await connectToDatabase();

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const driverId = url.searchParams.get("driverId");

    const query: any = { businessId: context.businessId };
    if (status && status !== "ALL") {
      query.status = status;
    }
    if (driverId) {
      query.driverId = driverId;
    }

    const sessions = await VanSaleSession.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error: any) {
    console.error("GET /api/van-sales/sessions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load van sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireAuth();
    await connectToDatabase();

    const body = await req.json();
    const { driverId, vehicleNumber, vehicleType, routeZone, items, notes, startImmediately } = body;

    if (!driverId) {
      return NextResponse.json(
        { success: false, error: "Please select a driver for this van sales session." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one product must be loaded into the van." },
        { status: 400 }
      );
    }

    const driver = await DeliveryDriver.findOne({ _id: driverId, businessId: context.businessId });
    if (!driver) {
      return NextResponse.json(
        { success: false, error: "Selected driver does not exist." },
        { status: 404 }
      );
    }

    if (driver.activeVanSessionId) {
      return NextResponse.json(
        {
          success: false,
          error: `Driver ${driver.name} is already assigned to an active van session. Please reconcile or complete the existing session first.`,
        },
        { status: 400 }
      );
    }

    // Generate Session Number: VAN-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const countToday = await VanSaleSession.countDocuments({
      businessId: context.businessId,
      createdAt: {
        $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      },
    });
    const sessionNumber = `VAN-${dateStr}-${String(countToday + 1).padStart(4, "0")}`;

    const loadedStockItems = [];

    // Verify stock availability and deduct from store inventory
    for (const it of items) {
      const qty = parseFloat(it.loadedQty);
      if (isNaN(qty) || qty <= 0) continue;

      const product = await Product.findOne({
        _id: it.productId,
        businessId: context.businessId,
      });

      if (!product) {
        return NextResponse.json(
          { success: false, error: `Product ID ${it.productId} not found.` },
          { status: 400 }
        );
      }

      if (product.stockQuantity < qty) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient store inventory for "${product.name}". Available: ${product.stockQuantity}, requested to load: ${qty}.`,
          },
          { status: 400 }
        );
      }

      const prevStock = product.stockQuantity;
      const newStock = product.stockQuantity - qty;
      product.stockQuantity = newStock;
      await product.save();

      // Record inventory movement
      await InventoryMovement.create({
        businessId: context.businessId,
        productId: product._id,
        type: "VAN_LOAD",
        quantityChange: -qty,
        previousStock: prevStock,
        newStock: newStock,
        reason: `Loaded into Van Sales Session ${sessionNumber} (${driver.name})`,
        referenceId: sessionNumber,
      });

      loadedStockItems.push({
        productId: product._id,
        productName: product.name,
        nameSinhala: product.nameSinhala,
        nameTamil: product.nameTamil,
        barcode: product.barcode,
        unit: product.unit || "unit",
        costPrice: product.costPrice || 0,
        unitPrice: it.unitPrice || product.sellingPrice,
        wholesalePrice: it.wholesalePrice || product.wholesalePrice || product.sellingPrice,
        loadedQty: qty,
        soldQty: 0,
        returnedQty: 0,
        damagedQty: 0,
        remainingQty: qty,
      });
    }

    if (loadedStockItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid items to load." },
        { status: 400 }
      );
    }

    const isStarting = Boolean(startImmediately);

    const session = await VanSaleSession.create({
      businessId: context.businessId,
      sessionNumber,
      driverId: driver._id,
      driverName: driver.name,
      driverPhone: driver.phone,
      vehicleType: vehicleType || driver.vehicleType || "VAN",
      vehicleNumber: (vehicleNumber || driver.vehicleNumber || "").trim().toUpperCase(),
      routeZone: routeZone?.trim() || undefined,
      notes: notes?.trim() || undefined,
      status: isStarting ? "ON_ROUTE" : "LOADED",
      loadedAt: new Date(),
      startedAt: isStarting ? new Date() : undefined,
      items: loadedStockItems,
      salesSummary: {
        totalSalesCount: 0,
        grossSalesTotal: 0,
        discountsTotal: 0,
        netSalesTotal: 0,
        cashCollected: 0,
        lankaQrCollected: 0,
        creditCollected: 0,
        otherCollected: 0,
      },
      transactions: [],
      cashierReconciliation: {
        status: "PENDING",
        physicalCashSubmitted: 0,
        cashShortageOrOverage: 0,
      },
    });

    driver.activeVanSessionId = session._id;
    await driver.save();

    return NextResponse.json({
      success: true,
      message: `Van Sales Session ${session.sessionNumber} created. ${loadedStockItems.length} products loaded into van.`,
      session,
    });
  } catch (error: any) {
    console.error("POST /api/van-sales/sessions error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create van sales session" },
      { status: 500 }
    );
  }
}
