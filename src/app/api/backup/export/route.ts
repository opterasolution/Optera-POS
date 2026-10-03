import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import Business from "@/models/Business";

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// GET /api/backup/export?type=PRODUCTS|SALES|CUSTOMERS|EXPENSES
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = session.user as any;
    let businessId = user.businessId;

    if (!businessId) {
      const defaultBiz = await Business.findOne().lean();
      businessId = defaultBiz?._id;
    }

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") || "PRODUCTS").toUpperCase();
    const today = new Date().toISOString().slice(0, 10);

    let csvContent = "";
    let filename = "";

    if (type === "PRODUCTS") {
      const { Product } = await import("@/models/Product");
      const products = await Product.find({ businessId })
        .populate("categoryId", "name")
        .sort({ name: 1 })
        .lean();

      filename = `products_export_${today}.csv`;
      const headers = [
        "Barcode",
        "SKU",
        "Name",
        "Name_Sinhala",
        "Name_Tamil",
        "Category",
        "Cost_Price_LKR",
        "Selling_Price_LKR",
        "Stock_Quantity",
        "Unit",
        "Is_Weighable",
      ];
      const rows = products.map((p: any) => [
        escapeCsv(p.barcode || ""),
        escapeCsv(p.sku || ""),
        escapeCsv(p.name || ""),
        escapeCsv(p.nameSinhala || ""),
        escapeCsv(p.nameTamil || ""),
        escapeCsv(p.categoryId?.name || "Uncategorized"),
        escapeCsv(p.costPrice || 0),
        escapeCsv(p.sellingPrice || 0),
        escapeCsv(p.stockQuantity || 0),
        escapeCsv(p.unit || "pcs"),
        escapeCsv(p.isWeighable ? "YES" : "NO"),
      ]);

      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    } else if (type === "SALES") {
      const { Sale } = await import("@/models/Sale");
      const sales = await Sale.find({ businessId })
        .sort({ createdAt: -1 })
        .limit(2000)
        .lean();

      filename = `sales_ledger_${today}.csv`;
      const headers = [
        "Invoice_Number",
        "Date_Time",
        "Customer_Name",
        "Cashier_Name",
        "Payment_Method",
        "Subtotal_LKR",
        "Discount_LKR",
        "Tax_LKR",
        "Net_Total_LKR",
      ];
      const rows = sales.map((s: any) => [
        escapeCsv(s.invoiceNumber || ""),
        escapeCsv(new Date(s.createdAt).toLocaleString()),
        escapeCsv(s.customerName || "Walk-in"),
        escapeCsv(s.cashierName || "Staff"),
        escapeCsv(s.paymentMethod || "CASH"),
        escapeCsv(s.subtotal || 0),
        escapeCsv(s.discountTotal || 0),
        escapeCsv(s.taxTotal || 0),
        escapeCsv(s.netTotal || 0),
      ]);

      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    } else if (type === "CUSTOMERS") {
      const { Customer } = await import("@/models/Customer");
      const customers = await Customer.find({ businessId })
        .sort({ name: 1 })
        .lean();

      filename = `customers_debt_ledger_${today}.csv`;
      const headers = [
        "Name",
        "Phone",
        "Credit_Limit_LKR",
        "Current_Debt_Balance_LKR",
        "Loyalty_Points",
        "Customer_Type",
      ];
      const rows = customers.map((c: any) => [
        escapeCsv(c.name || ""),
        escapeCsv(c.phone || ""),
        escapeCsv(c.creditLimit || 0),
        escapeCsv(c.creditBalance || 0),
        escapeCsv(c.loyaltyPoints || 0),
        escapeCsv(c.type || "REGULAR"),
      ]);

      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    } else if (type === "EXPENSES") {
      const { Expense } = await import("@/models/Expense");
      const expenses = await Expense.find({ businessId })
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean();

      filename = `expenses_vouchers_${today}.csv`;
      const headers = [
        "Voucher_Number",
        "Date_Time",
        "Category",
        "Description",
        "Amount_LKR",
        "Payment_Method",
        "Created_By",
      ];
      const rows = expenses.map((e: any) => [
        escapeCsv(e.voucherNumber || ""),
        escapeCsv(new Date(e.createdAt).toLocaleString()),
        escapeCsv(e.category || "GENERAL"),
        escapeCsv(e.description || ""),
        escapeCsv(e.amount || 0),
        escapeCsv(e.paymentMethod || "CASH"),
        escapeCsv(e.createdByName || "Staff"),
      ]);

      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    } else {
      return NextResponse.json({ error: `Unsupported export type: ${type}` }, { status: 400 });
    }

    return new NextResponse("\uFEFF" + csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/backup/export error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export data" },
      { status: 500 }
    );
  }
}
