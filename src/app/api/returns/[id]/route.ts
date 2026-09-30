import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { SaleReturn } from "@/models/SaleReturn";
import { requireAuth, verifyActiveSubscription } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireAuth();
    await verifyActiveSubscription(context.businessId);

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Return ID required" }, { status: 400 });
    }

    await connectToDatabase();
    const saleReturn = await SaleReturn.findOne({
      _id: id,
      businessId: context.businessId,
    })
      .populate("originalSaleId")
      .populate("customerId")
      .populate("creditNoteId")
      .lean();

    if (!saleReturn) {
      return NextResponse.json({ success: false, error: "Return record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, return: saleReturn });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch return details" },
      { status: error.status || 500 }
    );
  }
}
