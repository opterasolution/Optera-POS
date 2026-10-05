import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { SupplierDebitNote } from "@/models/SupplierDebitNote";
import { Supplier } from "@/models/Supplier";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const { id } = params;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const debitNote = await SupplierDebitNote.findOne({ _id: id, businessId }).lean();
      if (!debitNote) {
        return NextResponse.json(
          { success: false, error: "Supplier Debit Note not found." },
          { status: 404 }
        );
      }

      const supplier = await Supplier.findOne({ _id: debitNote.supplierId, businessId })
        .select("name phone email currentBalance taxNumber paymentTermsDays")
        .lean();

      return NextResponse.json({
        success: true,
        debitNote: {
          ...debitNote,
          supplierDetails: supplier || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      debitNote: null,
    });
  } catch (error: any) {
    console.error("GET /api/purchases/debit-notes/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch debit note" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPER_ADMIN"]);
    const { id } = params;
    const body = await req.json();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      const debitNote = await SupplierDebitNote.findOne({ _id: id, businessId });
      if (!debitNote) {
        return NextResponse.json(
          { success: false, error: "Debit Note not found." },
          { status: 404 }
        );
      }

      if (debitNote.status !== "DRAFT") {
        return NextResponse.json(
          { success: false, error: "Only DRAFT debit notes can be modified directly." },
          { status: 400 }
        );
      }

      const allowedFields = [
        "distributorRepName",
        "distributorVehicleNumber",
        "distributorCreditNoteNumber",
        "notes",
        "taxRate",
      ];

      allowedFields.forEach((field) => {
        if (body[field] !== undefined) {
          (debitNote as any)[field] = body[field];
        }
      });

      if (body.items && Array.isArray(body.items)) {
        const processedItems = body.items.map((it: any) => {
          const qty = Math.max(0.001, Number(it.quantity) || 1);
          const cost = Math.max(0, Number(it.unitCost) || 0);
          return {
            productId: it.productId,
            name: it.name,
            sku: it.sku,
            unit: it.unit || "pcs",
            quantity: qty,
            unitCost: cost,
            totalCost: Number((qty * cost).toFixed(2)),
            reason: it.reason || "DAMAGED_IN_TRANSIT",
            batchNumber: it.batchNumber,
            expiryDate: it.expiryDate ? new Date(it.expiryDate) : undefined,
            deductInventory: it.deductInventory !== false,
            inventoryDeducted: false,
            notes: it.notes,
          };
        });

        debitNote.items = processedItems as any;
        debitNote.subtotal = processedItems.reduce((acc: number, it: any) => acc + it.totalCost, 0);
        const taxRate = Math.max(0, Number(debitNote.taxRate) || 0);
        debitNote.taxAmount = Number(((debitNote.subtotal * taxRate) / 100).toFixed(2));
        debitNote.netTotal = Number((debitNote.subtotal + debitNote.taxAmount).toFixed(2));
      }

      await debitNote.save();

      return NextResponse.json({
        success: true,
        debitNote,
        message: "Debit note updated successfully.",
      });
    }

    return NextResponse.json({ success: true, message: "Debit note updated." });
  } catch (error: any) {
    console.error("PUT /api/purchases/debit-notes/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update debit note" },
      { status: 500 }
    );
  }
}
