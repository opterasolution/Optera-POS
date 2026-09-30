import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Business } from "@/models/Business";

/**
 * Public Receipt Lookup API Route
 * Allows unauthenticated customer access to digital receipts via QR / WhatsApp link.
 * Returns only sanitized customer-facing bill and store letterhead data.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const saleId = params.id;
    if (!saleId) {
      return NextResponse.json({ success: false, error: "Missing receipt ID" }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Look up sale by ID or by invoiceNumber
      let sale = await Sale.findById(saleId).lean();
      if (!sale) {
        sale = await Sale.findOne({ invoiceNumber: saleId }).lean();
      }

      if (!sale) {
        return NextResponse.json(
          { success: false, error: "Receipt not found. It may have expired or was removed." },
          { status: 404 }
        );
      }

      // Fetch store branding details
      const business = await Business.findById(sale.businessId)
        .select("name businessType phone email address logo currency taxSettings receiptSettings bankDetails")
        .lean();

      // Sanitize sale object for customer viewing (hide internal tenant keys & costs)
      const customerReceipt = {
        _id: sale._id,
        invoiceNumber: sale.invoiceNumber,
        cashierName: sale.cashierName || "Counter Staff",
        customerName: sale.customerName || "Customer",
        customerPhone: sale.customerPhone,
        registerName: sale.registerName,
        registerNumber: sale.registerNumber,
        items: (sale.items || []).map((it: any) => ({
          productId: it.productId,
          name: it.name,
          sku: it.sku,
          unit: it.unit || "unit",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
        })),
        subtotal: sale.subtotal,
        discountTotal: sale.discountTotal || 0,
        taxTotal: sale.taxTotal || 0,
        netTotal: sale.netTotal,
        paymentMethod: sale.paymentMethod,
        cashReceived: sale.cashReceived,
        changeGiven: sale.changeGiven,
        createdAt: sale.createdAt,
      };

      return NextResponse.json({
        success: true,
        sale: customerReceipt,
        business: business || {
          name: "Sri Lanka POS Store",
          currency: "LKR",
          receiptSettings: {
            headerMessage: "Thank you for shopping with us!",
            footerMessage: "Please come again!",
            defaultWidth: "58mm",
          },
        },
      });
    }

    // Demo store fallback
    return NextResponse.json({
      success: true,
      sale: {
        _id: saleId,
        invoiceNumber: saleId.startsWith("INV-") ? saleId : "INV-2026-0034",
        cashierName: "Store Cashier",
        customerName: "Valued Customer",
        paymentMethod: "CASH",
        items: [
          { name: "Keeri Samba Rice 5kg", quantity: 1, unitPrice: 1450, total: 1450 },
          { name: "Sunlight Soap 110g", quantity: 2, unitPrice: 120, total: 240 },
        ],
        subtotal: 1690,
        discountTotal: 0,
        taxTotal: 0,
        netTotal: 1690,
        cashReceived: 2000,
        changeGiven: 310,
        createdAt: new Date().toISOString(),
      },
      business: {
        name: "Kandy Super Grocers",
        phone: "0771234567",
        address: "No. 45, Peradeniya Road, Kandy",
        currency: "LKR",
        receiptSettings: {
          headerMessage: "Thank you for shopping at Kandy Super Grocers!",
          footerMessage: "Goods returnable within 3 days with receipt. Please come again!",
          defaultWidth: "58mm",
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load receipt";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
