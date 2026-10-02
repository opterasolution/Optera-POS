import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Customer, generatePortalToken } from "@/models/Customer";
import { CreditTransaction } from "@/models/CreditTransaction";
import { Shift } from "@/models/Shift";
import { Register } from "@/models/Register";
import { AuditLog } from "@/models/AuditLog";
import { Business } from "@/models/Business";
import { requireAuth } from "@/lib/tenant";
import { dispatchSms } from "@/lib/sms";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const customer = await Customer.findOne({
        _id: new Types.ObjectId(params.id),
        businessId: context.businessId,
      }).lean();

      if (!customer) {
        return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
      }

      const transactions = await CreditTransaction.find({
        businessId: context.businessId,
        customerId: customer._id,
      })
        .sort({ createdAt: -1 })
        .lean();

      const totalPurchases = transactions
        .filter((t) => t.type === "CREDIT_SALE")
        .reduce((sum, t) => sum + t.amount, 0);

      const totalSettlements = transactions
        .filter((t) => t.type === "PAYMENT")
        .reduce((sum, t) => sum + t.amount, 0);

      const creditLimit = customer.creditLimit || 0;
      const currentBalance = customer.currentBalance || 0;
      const availableCredit = Math.max(0, creditLimit - currentBalance);

      return NextResponse.json({
        success: true,
        customer,
        transactions,
        summary: {
          creditLimit,
          currentBalance,
          availableCredit,
          totalPurchases,
          totalSettlements,
          transactionCount: transactions.length,
        },
      });
    }

    // Demo Data Fallback
    return NextResponse.json({
      success: true,
      customer: {
        _id: params.id,
        name: "Sunil Perera",
        phone: "0771234567",
        creditAllowed: true,
        creditLimit: 20000,
        currentBalance: 4500,
      },
      transactions: [
        {
          _id: "demo_ctx_1",
          transactionNumber: "CR-TXN-20260930-0001",
          type: "CREDIT_SALE",
          amount: 4500,
          balanceBefore: 0,
          balanceAfter: 4500,
          invoiceNumber: "INV-20260930-0012",
          notes: "Credit Grocery purchase",
          performedBy: "Cashier 01",
          createdAt: new Date().toISOString(),
        },
      ],
      summary: {
        creditLimit: 20000,
        currentBalance: 4500,
        availableCredit: 15500,
        totalPurchases: 4500,
        totalSettlements: 0,
        transactionCount: 1,
      },
    });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch credit transactions" },
      { status }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const body = await req.json();

    const {
      amount,
      paymentMethod = "CASH",
      paymentReference,
      registerId,
      notes,
      type = "PAYMENT",
    } = body;

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Payment amount must be greater than zero." },
        { status: 400 }
      );
    }

    if (!["PAYMENT", "ADJUSTMENT"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Invalid transaction type. Must be PAYMENT or ADJUSTMENT." },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const customer = await Customer.findOne({
        _id: new Types.ObjectId(params.id),
        businessId: context.businessId,
      });

      if (!customer) {
        return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
      }

      const balanceBefore = customer.currentBalance || 0;
      if (balanceBefore <= 0 && type === "PAYMENT") {
        return NextResponse.json(
          {
            success: false,
            error: `${customer.name} has no outstanding credit balance (Balance: Rs. 0.00).`,
          },
          { status: 400 }
        );
      }

      const balanceAfter = Math.max(0, balanceBefore - payAmount);

      // Generate sequential transaction number
      const count = await CreditTransaction.countDocuments({ businessId: context.businessId });
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const prefix = type === "PAYMENT" ? "CR-PAY" : "CR-ADJ";
      const transactionNumber = `${prefix}-${todayStr}-${String(count + 1).padStart(4, "0")}`;

      // Check register and active shift if registerId provided or store default
      let shiftId: Types.ObjectId | undefined;
      let regObjId: Types.ObjectId | undefined;
      let regName: string | undefined;

      if (registerId && registerId.trim()) {
        try {
          regObjId = new Types.ObjectId(registerId);
          const regDoc = await Register.findById(regObjId).lean();
          if (regDoc) regName = `${regDoc.registerNumber} - ${regDoc.name}`;
        } catch {}
      }

      // If paid in cash, synchronize with active drawer shift
      if (paymentMethod === "CASH") {
        const shiftQuery: Record<string, unknown> = {
          businessId: context.businessId,
          status: "OPEN",
        };
        if (regObjId) shiftQuery.registerId = regObjId;

        let activeShift = await Shift.findOne(shiftQuery).sort({ openedAt: -1 });
        if (!activeShift && !regObjId) {
          activeShift = await Shift.findOne({ businessId: context.businessId, status: "OPEN" }).sort({ openedAt: -1 });
        }

        if (activeShift) {
          shiftId = activeShift._id;
          activeShift.cashMovements.push({
            type: "PAY_IN",
            amount: payAmount,
            reason: `Customer Credit Settlement: ${customer.name} (${transactionNumber})`,
            performedBy: context.username || "Cashier",
            createdAt: new Date(),
          });
          await activeShift.save();
        }
      }

      // Create credit transaction record
      const creditTxn = await CreditTransaction.create({
        businessId: context.businessId,
        customerId: customer._id,
        transactionNumber,
        type,
        amount: payAmount,
        balanceBefore,
        balanceAfter,
        paymentMethod: type === "PAYMENT" ? paymentMethod : undefined,
        paymentReference: paymentReference?.trim() || undefined,
        shiftId,
        registerId: regObjId,
        registerName: regName,
        notes: notes?.trim() || (type === "PAYMENT" ? "Customer debt repayment" : "Credit balance adjustment"),
        performedBy: context.username || "Manager",
      });

      // Ensure customer has portalToken for live statement access
      if (!customer.portalToken) {
        customer.portalToken = generatePortalToken();
      }

      // Update customer balance
      customer.currentBalance = balanceAfter;
      await customer.save();

      const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://pos.srilanka.lk"}/portal/statement/${customer.portalToken}`;

      // Audit log
      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: type === "PAYMENT" ? "CUSTOMER_PAYMENT_RECEIVED" : "CUSTOMER_CREDIT_ADJUSTED",
        entityType: "CreditTransaction",
        entityId: creditTxn._id.toString(),
        details: {
          customerId: customer._id.toString(),
          customerName: customer.name,
          transactionNumber,
          amount: payAmount,
          balanceBefore,
          balanceAfter,
          paymentMethod,
        },
      });

      // Trigger SMS notification for credit debt settlement
      if (type === "PAYMENT" && customer.phone) {
        try {
          const businessDoc = await Business.findById(context.businessId).lean();
          await dispatchSms({
            businessId: context.businessId,
            recipientPhone: customer.phone,
            recipientName: customer.name,
            customerId: customer._id,
            eventType: "CREDIT_SETTLEMENT",
            templateKey: "creditSettlement",
            variables: {
              customerName: customer.name,
              amount: payAmount.toLocaleString(),
              balance: balanceAfter.toLocaleString(),
              storeName: (businessDoc as any)?.name || "Our Store",
              ref: transactionNumber,
              portalUrl,
            },
            metadata: { transactionNumber, creditTransactionId: creditTxn._id.toString() },
          });
        } catch (smsErr) {
          console.error("Credit settlement SMS trigger failed:", smsErr);
        }
      }

      return NextResponse.json({
        success: true,
        transaction: creditTxn,
        customer: {
          _id: customer._id,
          name: customer.name,
          phone: customer.phone,
          portalToken: customer.portalToken,
          portalUrl,
          creditLimit: customer.creditLimit,
          previousBalance: balanceBefore,
          remainingBalance: balanceAfter,
          currentBalance: balanceAfter,
        },
      });
    }

    // Demo Mode fallback
    const balanceBefore = 4500;
    const balanceAfter = Math.max(0, balanceBefore - payAmount);
    return NextResponse.json({
      success: true,
      transaction: {
        _id: `ctx_${Date.now()}`,
        transactionNumber: `CR-PAY-DEMO-${Date.now().toString().slice(-4)}`,
        type,
        amount: payAmount,
        balanceBefore,
        balanceAfter,
        paymentMethod,
        performedBy: context.username || "Cashier",
        createdAt: new Date().toISOString(),
      },
      customer: {
        _id: params.id,
        name: "Sunil Perera",
        previousBalance: balanceBefore,
        currentBalance: balanceAfter,
      },
    });
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record credit payment" },
      { status }
    );
  }
}
