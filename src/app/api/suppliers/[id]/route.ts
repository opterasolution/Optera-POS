import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Supplier } from "@/models/Supplier";
import { PurchaseOrder } from "@/models/PurchaseOrder";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth, requireRole } from "@/lib/tenant";

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

      const supplier = await Supplier.findOne({ _id: id, businessId }).lean();
      if (!supplier) {
        return NextResponse.json({ success: false, error: "Supplier not found" }, { status: 404 });
      }

      const [totalPOs, totalSpentResult] = await Promise.all([
        PurchaseOrder.countDocuments({ businessId, supplierId: id }),
        PurchaseOrder.aggregate([
          { $match: { businessId, supplierId: supplier._id, status: { $ne: "CANCELLED" } } },
          { $group: { _id: null, total: { $sum: "$netTotal" } } },
        ]),
      ]);

      return NextResponse.json({
        success: true,
        supplier: {
          ...supplier,
          totalPurchaseOrders: totalPOs,
          totalPurchasedValue: totalSpentResult[0]?.total || 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      supplier: {
        _id: id,
        name: "Demo Supplier",
        phone: "0112000000",
        currentBalance: 0,
        paymentTermsDays: 30,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch supplier" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(
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

      const supplier = await Supplier.findOne({ _id: id, businessId });
      if (!supplier) {
        return NextResponse.json({ success: false, error: "Supplier not found" }, { status: 404 });
      }

      if (body.name !== undefined) supplier.name = body.name.trim();
      if (body.code !== undefined) supplier.code = body.code?.trim()?.toUpperCase() || undefined;
      if (body.contactPerson !== undefined) supplier.contactPerson = body.contactPerson?.trim() || undefined;
      if (body.phone !== undefined) supplier.phone = body.phone.trim();
      if (body.email !== undefined) supplier.email = body.email?.trim()?.toLowerCase() || undefined;
      if (body.address !== undefined) supplier.address = body.address?.trim() || undefined;
      if (body.taxNumber !== undefined) supplier.taxNumber = body.taxNumber?.trim() || undefined;
      if (body.paymentTermsDays !== undefined) supplier.paymentTermsDays = Number(body.paymentTermsDays) || 0;
      if (body.creditLimit !== undefined) supplier.creditLimit = Number(body.creditLimit) || 0;
      if (body.notes !== undefined) supplier.notes = body.notes?.trim() || undefined;
      if (body.isActive !== undefined) supplier.isActive = Boolean(body.isActive);

      await supplier.save();

      await AuditLog.create({
        businessId,
        action: "SUPPLIER_UPDATED",
        entity: "SUPPLIER",
        entityId: supplier._id.toString(),
        userId: context.userId,
        details: { name: supplier.name, updates: body },
      });

      return NextResponse.json({
        success: true,
        supplier,
        message: `Supplier "${supplier.name}" updated successfully.`,
      });
    }

    return NextResponse.json({
      success: true,
      supplier: { _id: id, ...body },
      message: "Demo: Supplier updated.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update supplier" },
      { status: error.status || 500 }
    );
  }
}
