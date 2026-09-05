import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { requireAuth } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const sale = await Sale.findOne({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!sale) {
        return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
      }

      return NextResponse.json({ success: true, sale });
    }

    return NextResponse.json({
      success: true,
      sale: {
        _id: params.id,
        invoiceNumber: "INV-2026-0034",
        cashierName: "Admin",
        customerName: "Kamal Gunaratne",
        paymentMethod: "CASH",
        items: [{ name: "Keeri Samba Rice 5kg", quantity: 1, total: 1450, unitPrice: 1450 }],
        subtotal: 1450,
        netTotal: 1450,
        cashReceived: 2000,
        changeGiven: 550,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load sale details";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
