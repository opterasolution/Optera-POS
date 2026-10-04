import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { CustomerOrder } from "@/models/CustomerOrder";
import { Product } from "@/models/Product";
import { Customer } from "@/models/Customer";
import { Sale } from "@/models/Sale";
import { CreditTransaction } from "@/models/CreditTransaction";
import { requireAuth, requireRole } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const context = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim();
    const customerId = searchParams.get("customerId")?.trim();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const query: any = { businessId: context.businessId };
      if (status && status !== "ALL") {
        query.status = status;
      }
      if (customerId) {
        query.customerId = customerId;
      }

      const orders = await CustomerOrder.find(query)
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      return NextResponse.json({ success: true, orders });
    }

    // Demo Mode Fallback
    return NextResponse.json({
      success: true,
      orders: [
        {
          _id: "demo_ord_1",
          orderNumber: "B2B-20261002-0014",
          customerId: "demo_cust_sunil",
          customerName: "Sunil Perera",
          companyName: "Perera Caterers & Restaurant Group",
          customerPhone: "0771234567",
          customerPoNumber: "PO-HILTON-2026-44",
          items: [
            { name: "Samba Rice (50kg Bag)", quantity: 2, unitPrice: 11500, subtotal: 23000 },
            { name: "White Sugar (25kg Bag)", quantity: 1, unitPrice: 7200, subtotal: 7200 },
          ],
          subtotal: 30200,
          netTotal: 30200,
          status: "PENDING",
          requestedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          deliveryAddress: "No. 88, Lake Round Road, Kandy",
          notes: "Please deliver before 10 AM before banquet setup.",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPERVISOR", "INVENTORY_CLERK"]);
    const body = await req.json();
    const { orderId, action, status, rejectionReason } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const order = await CustomerOrder.findOne({
        _id: orderId,
        businessId: context.businessId,
      });

      if (!order) {
        return NextResponse.json(
          { success: false, error: "B2B order not found" },
          { status: 404 }
        );
      }

      if (action === "CONVERT_TO_SALE") {
        // Generate new Sale invoice
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const saleCount = await Sale.countDocuments({
          businessId: context.businessId,
          invoiceNumber: new RegExp(`^INV-${todayStr}`),
        });
        const invoiceNumber = `INV-${todayStr}-${String(saleCount + 1).padStart(4, "0")}`;

        const saleItems = order.items.map((it) => ({
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.subtotal,
          costPrice: 0,
        }));

        const newSale = await Sale.create({
          businessId: context.businessId,
          invoiceNumber,
          customerId: order.customerId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          items: saleItems,
          subtotal: order.subtotal,
          discount: 0,
          netTotal: order.netTotal,
          paymentMethod: "CREDIT",
          paymentStatus: "UNPAID",
          cashierName: context.username || "Merchant",
          cashierId: context.userId,
        });

        // Deduct product inventory
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stockQuantity: -item.quantity },
          });
        }

        // Record Credit Transaction if purchased on credit
        const customer = await Customer.findById(order.customerId);
        if (customer) {
          const balanceBefore = customer.currentBalance || 0;
          const balanceAfter = balanceBefore + order.netTotal;
          customer.currentBalance = balanceAfter;
          customer.totalSpent = (customer.totalSpent || 0) + order.netTotal;
          await customer.save();

          const count = await CreditTransaction.countDocuments({ businessId: context.businessId });
          const txNumber = `CR-TXN-${todayStr}-${String(count + 1).padStart(4, "0")}`;

          await CreditTransaction.create({
            businessId: context.businessId,
            customerId: customer._id,
            transactionNumber: txNumber,
            type: "CREDIT_SALE",
            amount: order.netTotal,
            balanceBefore,
            balanceAfter,
            saleId: newSale._id,
            invoiceNumber,
            notes: `Converted from online B2B Order ${order.orderNumber}`,
            performedBy: context.username || "Merchant",
          });
        }

        order.status = "DELIVERED";
        order.convertedSaleId = newSale._id;
        order.convertedInvoiceNumber = invoiceNumber;
        order.convertedAt = new Date();
        await order.save();

        return NextResponse.json({
          success: true,
          message: `Order ${order.orderNumber} successfully converted to Invoice ${invoiceNumber}! Stock deducted and customer credit ledger updated.`,
          order,
          invoiceNumber,
        });
      }

      // Simple status update (e.g. APPROVED, PROCESSING, DISPATCHED, CANCELLED)
      if (status) {
        order.status = status;
        if (rejectionReason) order.rejectionReason = rejectionReason;
        await order.save();
      }

      return NextResponse.json({
        success: true,
        message: `Order ${order.orderNumber} status updated to ${order.status}`,
        order,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Demo order updated successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
