import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Business } from "@/models/Business";
import { CreditTransaction } from "@/models/CreditTransaction";
import { Sale } from "@/models/Sale";

/**
 * Public Customer Credit & Loyalty Statement API
 * Allows credit customers to view their Naya Potha ledger and loyalty points securely
 * using their personal portal token without needing SaaS credentials.
 */
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

      // Find customer by their unique portal token
      const customer = await Customer.findOne({ portalToken: token }).lean();

      if (!customer) {
        return NextResponse.json(
          {
            success: false,
            error: "Customer statement not found. The link may have expired or is invalid.",
          },
          { status: 404 }
        );
      }

      // Fetch business profile & bank account details for settlement
      const business = await Business.findById(customer.businessId)
        .select(
          "name businessType phone email address logo currency bankDetails receiptSettings taxSettings"
        )
        .lean();

      // Fetch credit transactions (Naya Potha ledger entries)
      const creditTransactions = await CreditTransaction.find({
        customerId: customer._id,
      })
        .sort({ createdAt: -1 })
        .limit(60)
        .lean();

      // Fetch recent customer sales / invoices
      const recentSales = await Sale.find({
        customerId: customer._id,
      })
        .sort({ createdAt: -1 })
        .limit(25)
        .select(
          "_id invoiceNumber netTotal paymentMethod paymentStatus dueDate createdAt items"
        )
        .lean();

      // Calculate credit telemetry
      const creditLimit = customer.creditLimit || 0;
      const currentBalance = customer.currentBalance || 0;
      const availableCredit = Math.max(0, creditLimit - currentBalance);
      let accountStatus: "CLEAR" | "ACTIVE" | "OVER_LIMIT" = "ACTIVE";
      if (currentBalance <= 0) {
        accountStatus = "CLEAR";
      } else if (currentBalance > creditLimit && creditLimit > 0) {
        accountStatus = "OVER_LIMIT";
      }

      // Sanitize customer data for public statement
      const statement = {
        customer: {
          name: customer.name,
          phone: customer.phone,
          customerType: customer.customerType || "RETAIL",
          companyName: customer.companyName,
          creditAllowed: customer.creditAllowed,
          creditLimit,
          currentBalance,
          availableCredit,
          referralCode: customer.referralCode || "REF-VIP001",
          referralCount: customer.referralCount || 0,
          referralPointsEarned: customer.referralPointsEarned || 0,
          vipCardIssuedAt: customer.vipCardIssuedAt,
          totalSpent: customer.totalSpent || 0,
          loyalty: {
            points: customer.loyaltyPoints || 0,
            tier: customer.loyaltyTier || "REGULAR",
            lifetimeEarned: customer.lifetimePointsEarned || 0,
            monetaryEquivalent: customer.loyaltyPoints || 0, // 1 point = Rs. 1.00
            referralCode: customer.referralCode || "REF-VIP001",
            referralCount: customer.referralCount || 0,
            referralPointsEarned: customer.referralPointsEarned || 0,
          },
          lastVisit: customer.lastVisit,
        },
        transactions: creditTransactions.map((tx: any) => ({
          _id: tx._id,
          transactionNumber: tx.transactionNumber,
          type: tx.type, // CREDIT_SALE, PAYMENT, ADJUSTMENT
          amount: tx.amount,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          invoiceNumber: tx.invoiceNumber,
          paymentMethod: tx.paymentMethod,
          paymentReference: tx.paymentReference,
          notes: tx.notes,
          performedBy: tx.performedBy || "Store Cashier",
          createdAt: tx.createdAt,
        })),
        recentInvoices: recentSales.map((sale: any) => ({
          _id: sale._id,
          invoiceNumber: sale.invoiceNumber,
          netTotal: sale.netTotal,
          paymentMethod: sale.paymentMethod,
          paymentStatus: sale.paymentStatus || "PAID",
          dueDate: sale.dueDate,
          createdAt: sale.createdAt,
          itemCount: sale.items?.length || 0,
        })),
        business: business || {
          name: "Sri Lanka POS Store",
          currency: "LKR",
        },
      };

      return NextResponse.json({ success: true, statement });
    }

    // Demo Mode Fallback for local testing or preview
    const now = new Date();
    return NextResponse.json({
      success: true,
      statement: {
        customer: {
          name: "Sunil Perera",
          phone: "0771234567",
          customerType: "RETAIL",
          creditAllowed: true,
          creditLimit: 50000,
          currentBalance: 14250,
          availableCredit: 35750,
          accountStatus: "ACTIVE",
          referralCode: "REF-SUNIL7",
          referralCount: 9,
          referralPointsEarned: 900,
          totalSpent: 92450,
          loyalty: {
            points: 480,
            tier: "GOLD",
            lifetimeEarned: 1250,
            monetaryEquivalent: 480,
            referralCode: "REF-SUNIL7",
            referralCount: 9,
            referralPointsEarned: 900,
          },
          lastVisit: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        },
        transactions: [
          {
            _id: "demo_tx_1",
            transactionNumber: "CR-PAY-2026-0012",
            type: "PAYMENT",
            amount: 5000,
            balanceBefore: 19250,
            balanceAfter: 14250,
            paymentMethod: "CASH",
            paymentReference: "REC-8891",
            notes: "Partial debt settlement via cash",
            performedBy: "Nimal (Cashier)",
            createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            _id: "demo_tx_2",
            transactionNumber: "CR-TXN-2026-0045",
            type: "CREDIT_SALE",
            amount: 8750,
            balanceBefore: 10500,
            balanceAfter: 19250,
            invoiceNumber: "INV-2026-0104",
            notes: "Monthly provisions purchase",
            performedBy: "Kasun (Manager)",
            createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            _id: "demo_tx_3",
            transactionNumber: "CR-PAY-2026-0008",
            type: "PAYMENT",
            amount: 10000,
            balanceBefore: 20500,
            balanceAfter: 10500,
            paymentMethod: "BANK_TRANSFER",
            paymentReference: "BOC-TXN-90214",
            notes: "Direct bank transfer to BOC Account",
            performedBy: "Admin",
            createdAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            _id: "demo_tx_4",
            transactionNumber: "CR-TXN-2026-0021",
            type: "CREDIT_SALE",
            amount: 20500,
            balanceBefore: 0,
            balanceAfter: 20500,
            invoiceNumber: "INV-2026-0082",
            notes: "Agricultural fertilizer and seed stock",
            performedBy: "Kasun (Manager)",
            createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        recentInvoices: [
          {
            _id: "demo_inv_1",
            invoiceNumber: "INV-2026-0104",
            netTotal: 8750,
            paymentMethod: "CREDIT",
            paymentStatus: "UNPAID",
            dueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            itemCount: 4,
          },
          {
            _id: "demo_inv_2",
            invoiceNumber: "INV-2026-0082",
            netTotal: 20500,
            paymentMethod: "CREDIT",
            paymentStatus: "PARTIAL",
            dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            itemCount: 8,
          },
        ],
        business: {
          name: "Kandy Super Grocers",
          phone: "0771234567",
          email: "support@kandygrocers.lk",
          address: "No. 45, Peradeniya Road, Kandy",
          currency: "LKR",
          bankDetails: {
            bankName: "Bank of Ceylon (BOC)",
            branchName: "Kandy City Branch",
            accountNumber: "8472910472",
            accountName: "Kandy Super Grocers (Pvt) Ltd",
          },
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load customer statement";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
