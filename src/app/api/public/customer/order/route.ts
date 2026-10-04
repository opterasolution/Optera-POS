import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Product } from "@/models/Product";
import { CustomerOrder } from "@/models/CustomerOrder";

/**
 * Public Customer Order API
 * Allows B2B customers to place purchase orders and track them via their portal token.
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing customer portal token" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { items, customerPoNumber, requestedDeliveryDate, deliveryAddress, notes } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please add at least one line item to your order." },
        { status: 400 }
      );
    }

    if (!deliveryAddress?.trim()) {
      return NextResponse.json(
        { success: false, error: "Delivery address is required for B2B dispatch." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const customer = await Customer.findOne({ portalToken: token });
      if (!customer) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired portal token" },
          { status: 404 }
        );
      }

      // Check credit hold status
      if (customer.creditStatus === "SUSPENDED" || customer.creditStatus === "ON_HOLD") {
        return NextResponse.json(
          {
            success: false,
            error: `Your credit account is currently marked as ${customer.creditStatus}. Please settle outstanding invoices before placing new orders.`,
          },
          { status: 403 }
        );
      }

      // Validate products and compute lines
      const validatedItems = [];
      let subtotal = 0;

      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product || !product.isActive) {
          return NextResponse.json(
            { success: false, error: `Product "${item.name || "Unknown"}" is currently unavailable.` },
            { status: 400 }
          );
        }

        const qty = parseFloat(item.quantity) || 1;
        const minQty = product.wholesaleMinQty || 1;
        if (qty < minQty) {
          return NextResponse.json(
            {
              success: false,
              error: `Minimum order quantity for "${product.name}" is ${minQty} ${product.unit}.`,
            },
            { status: 400 }
          );
        }

        const price = product.wholesalePrice || product.sellingPrice;
        const lineTotal = price * qty;
        subtotal += lineTotal;

        validatedItems.push({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          unit: product.unit || "pcs",
          unitPrice: price,
          quantity: qty,
          subtotal: lineTotal,
        });
      }

      // Generate order number: B2B-YYYYMMDD-XXXX
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const count = await CustomerOrder.countDocuments({
        businessId: customer.businessId,
        orderNumber: new RegExp(`^B2B-${todayStr}`),
      });
      const orderNumber = `B2B-${todayStr}-${String(count + 1).padStart(4, "0")}`;

      const netTotal = subtotal; // Can add SSCL / VAT if taxSettings enabled

      const newOrder = await CustomerOrder.create({
        businessId: customer.businessId,
        orderNumber,
        customerId: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        companyName: customer.companyName,
        customerPoNumber: customerPoNumber?.trim() || "",
        items: validatedItems,
        subtotal,
        taxTotal: 0,
        netTotal,
        status: "PENDING",
        requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate) : undefined,
        deliveryAddress: deliveryAddress.trim(),
        notes: notes?.trim() || "",
      });

      return NextResponse.json({
        success: true,
        message: `B2B Order ${orderNumber} submitted successfully! Our dispatch team will process it shortly.`,
        order: newOrder,
      });
    }

    // Demo Mode Fallback Response
    const demoOrderNumber = `B2B-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-0042`;
    const computedSubtotal = items.reduce(
      (sum: number, it: any) => sum + (parseFloat(it.unitPrice) || 0) * (parseFloat(it.quantity) || 1),
      0
    );

    return NextResponse.json({
      success: true,
      message: `Demo B2B Order ${demoOrderNumber} submitted successfully!`,
      order: {
        _id: "demo_order_created",
        orderNumber: demoOrderNumber,
        customerPoNumber: customerPoNumber || "PO-DEMO-01",
        items,
        subtotal: computedSubtotal,
        netTotal: computedSubtotal,
        status: "PENDING",
        deliveryAddress,
        notes,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing customer portal token" },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const customer = await Customer.findOne({ portalToken: token });
      if (!customer) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired portal token" },
          { status: 404 }
        );
      }

      const orders = await CustomerOrder.find({
        customerId: customer._id,
      })
        .sort({ createdAt: -1 })
        .lean();

      return NextResponse.json({ success: true, orders });
    }

    return NextResponse.json({
      success: true,
      orders: [],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
