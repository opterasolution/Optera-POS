import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Business } from "@/models/Business";
import { CreditTransaction } from "@/models/CreditTransaction";
import { Sale } from "@/models/Sale";
import { CreditNote } from "@/models/CreditNote";
import { CustomerOrder } from "@/models/CustomerOrder";
import { CustomerPaymentSlip } from "@/models/CustomerPaymentSlip";

/**
 * Public Customer Credit & B2B Wholesale Portal Statement API
 * Allows corporate & wholesale customers to view their Naya Potha ledger,
 * aging analysis, past orders, credit notes, and payment slip submissions.
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
        .limit(100)
        .lean();

      // Fetch recent customer sales / invoices
      const recentSales = await Sale.find({
        customerId: customer._id,
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .select(
          "_id invoiceNumber netTotal paidAmount paymentMethod paymentStatus dueDate createdAt items"
        )
        .lean();

      // Fetch active Credit Notes
      const creditNotes = await CreditNote.find({
        customerId: customer._id,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      // Fetch B2B wholesale orders
      const b2bOrders = await CustomerOrder.find({
        customerId: customer._id,
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

      // Fetch submitted payment slips
      const paymentSlips = await CustomerPaymentSlip.find({
        customerId: customer._id,
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

      // Calculate credit telemetry & aging buckets
      const creditLimit = customer.creditLimit || 0;
      const currentBalance = customer.currentBalance || 0;
      const availableCredit = Math.max(0, creditLimit - currentBalance);
      const paymentTermsDays = customer.paymentTermsDays || 30;

      let accountStatus: "CLEAR" | "ACTIVE" | "OVER_LIMIT" = "ACTIVE";
      if (currentBalance <= 0) {
        accountStatus = "CLEAR";
      } else if (currentBalance > creditLimit && creditLimit > 0) {
        accountStatus = "OVER_LIMIT";
      }

      // Aging calculation
      const now = new Date();
      const aging = {
        current: 0,
        days30: 0,
        days60: 0,
        days90Plus: 0,
        totalOverdue: 0,
      };

      // Calculate aging across unpaid / partial credit invoices
      const unpaidCreditSales = recentSales.filter(
        (s: any) =>
          s.paymentMethod === "CREDIT" &&
          (s.paymentStatus === "UNPAID" || s.paymentStatus === "PARTIAL")
      );

      let allocatedBalance = 0;
      unpaidCreditSales.forEach((sale: any) => {
        const remainingDue = Math.max(0, (sale.netTotal || 0) - (sale.paidAmount || 0));
        const saleDate = new Date(sale.createdAt);
        const diffDays = Math.floor(
          (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        allocatedBalance += remainingDue;

        if (diffDays <= paymentTermsDays) {
          aging.current += remainingDue;
        } else if (diffDays <= paymentTermsDays + 30) {
          aging.days30 += remainingDue;
          aging.totalOverdue += remainingDue;
        } else if (diffDays <= paymentTermsDays + 60) {
          aging.days60 += remainingDue;
          aging.totalOverdue += remainingDue;
        } else {
          aging.days90Plus += remainingDue;
          aging.totalOverdue += remainingDue;
        }
      });

      // If ledger balance exists but individual unpaid invoices were not flagged or differ
      if (currentBalance > allocatedBalance && currentBalance > 0) {
        const unallocated = currentBalance - allocatedBalance;
        aging.current += unallocated;
      }

      const statement = {
        customer: {
          _id: customer._id,
          name: customer.name,
          phone: customer.phone,
          customerType: customer.customerType || "RETAIL",
          companyName: customer.companyName || "",
          tin: customer.tin || "",
          vatNumber: customer.vatNumber || "",
          creditAllowed: customer.creditAllowed,
          creditLimit,
          currentBalance,
          availableCredit,
          accountStatus,
          paymentTermsDays,
          creditStatus: customer.creditStatus || "ACTIVE",
          wholesaleTier: customer.wholesaleTier || "TIER_1",
          contactPerson: customer.contactPerson || "",
          deliveryAddress: customer.deliveryAddress || customer.address || "",
          referralCode: customer.referralCode || "REF-VIP001",
          referralCount: customer.referralCount || 0,
          referralPointsEarned: customer.referralPointsEarned || 0,
          vipCardIssuedAt: customer.vipCardIssuedAt,
          totalSpent: customer.totalSpent || 0,
          aging,
          loyalty: {
            points: customer.loyaltyPoints || 0,
            tier: customer.loyaltyTier || "REGULAR",
            lifetimeEarned: customer.lifetimePointsEarned || 0,
            monetaryEquivalent: customer.loyaltyPoints || 0,
            referralCode: customer.referralCode || "REF-VIP001",
            referralCount: customer.referralCount || 0,
            referralPointsEarned: customer.referralPointsEarned || 0,
          },
          lastVisit: customer.lastVisit,
        },
        aging,
        transactions: creditTransactions.map((tx: any) => ({
          _id: tx._id,
          transactionNumber: tx.transactionNumber,
          type: tx.type,
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
          paidAmount: sale.paidAmount || (sale.paymentStatus === "PAID" ? sale.netTotal : 0),
          paymentMethod: sale.paymentMethod,
          paymentStatus: sale.paymentStatus || "PAID",
          dueDate: sale.dueDate,
          createdAt: sale.createdAt,
          itemCount: sale.items?.length || 0,
        })),
        creditNotes: creditNotes.map((cn: any) => ({
          _id: cn._id,
          creditNoteNumber: cn.creditNoteNumber,
          initialAmount: cn.initialAmount,
          remainingBalance: cn.remainingBalance,
          status: cn.status,
          expiryDate: cn.expiryDate,
          createdAt: cn.createdAt,
        })),
        b2bOrders: b2bOrders.map((ord: any) => ({
          _id: ord._id,
          orderNumber: ord.orderNumber,
          customerPoNumber: ord.customerPoNumber,
          items: ord.items,
          subtotal: ord.subtotal,
          taxTotal: ord.taxTotal,
          netTotal: ord.netTotal,
          status: ord.status,
          requestedDeliveryDate: ord.requestedDeliveryDate,
          deliveryAddress: ord.deliveryAddress,
          notes: ord.notes,
          convertedInvoiceNumber: ord.convertedInvoiceNumber,
          createdAt: ord.createdAt,
        })),
        paymentSlips: paymentSlips.map((slip: any) => ({
          _id: slip._id,
          slipNumber: slip.slipNumber,
          amount: slip.amount,
          depositBank: slip.depositBank,
          transactionReference: slip.transactionReference,
          paymentDate: slip.paymentDate,
          slipImageUrl: slip.slipImageUrl,
          status: slip.status,
          verifiedAt: slip.verifiedAt,
          rejectionReason: slip.rejectionReason,
          createdAt: slip.createdAt,
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
          _id: "demo_cust_sunil",
          name: "Sunil Perera",
          phone: "0771234567",
          customerType: "CORPORATE",
          companyName: "Perera Caterers & Restaurant Group",
          tin: "102938475-7000",
          vatNumber: "VAT-928174-88",
          creditAllowed: true,
          creditLimit: 100000,
          currentBalance: 24750,
          availableCredit: 75250,
          accountStatus: "ACTIVE",
          paymentTermsDays: 30,
          creditStatus: "ACTIVE",
          wholesaleTier: "TIER_1",
          contactPerson: "Mr. Sunil Perera (Managing Director)",
          deliveryAddress: "No. 88, Lake Round Road, Kandy",
          referralCode: "REF-SUNIL7",
          referralCount: 9,
          referralPointsEarned: 900,
          totalSpent: 342450,
          loyalty: {
            points: 1480,
            tier: "PLATINUM",
            lifetimeEarned: 4250,
            monetaryEquivalent: 1480,
            referralCode: "REF-SUNIL7",
            referralCount: 9,
            referralPointsEarned: 900,
          },
          lastVisit: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        },
        aging: {
          current: 12500, // 0 - 30 days
          days30: 8250,   // 31 - 60 days
          days60: 4000,   // 61 - 90 days
          days90Plus: 0,  // 90+ days
          totalOverdue: 12250,
        },
        transactions: [
          {
            _id: "demo_tx_1",
            transactionNumber: "CR-PAY-2026-0012",
            type: "PAYMENT",
            amount: 15000,
            balanceBefore: 39750,
            balanceAfter: 24750,
            paymentMethod: "BANK_TRANSFER",
            paymentReference: "BOC-TXN-90214",
            notes: "Direct bank transfer to BOC Account",
            performedBy: "Nimal (Accountant)",
            createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            _id: "demo_tx_2",
            transactionNumber: "CR-TXN-2026-0045",
            type: "CREDIT_SALE",
            amount: 12500,
            balanceBefore: 27250,
            balanceAfter: 39750,
            invoiceNumber: "INV-2026-0104",
            notes: "Weekly wholesale produce & dry rations",
            performedBy: "Kasun (Wholesale Manager)",
            createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            _id: "demo_tx_3",
            transactionNumber: "CR-TXN-2026-0038",
            type: "CREDIT_SALE",
            amount: 8250,
            balanceBefore: 19000,
            balanceAfter: 27250,
            invoiceNumber: "INV-2026-0091",
            notes: "Institutional catering provisions",
            performedBy: "Kasun (Wholesale Manager)",
            createdAt: new Date(now.getTime() - 38 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            _id: "demo_tx_4",
            transactionNumber: "CR-TXN-2026-0021",
            type: "CREDIT_SALE",
            amount: 4000,
            balanceBefore: 15000,
            balanceAfter: 19000,
            invoiceNumber: "INV-2026-0075",
            notes: "Dairy and bakery bulk replenishment",
            performedBy: "Kasun (Wholesale Manager)",
            createdAt: new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        recentInvoices: [
          {
            _id: "demo_inv_1",
            invoiceNumber: "INV-2026-0104",
            netTotal: 12500,
            paidAmount: 0,
            paymentMethod: "CREDIT",
            paymentStatus: "UNPAID",
            dueDate: new Date(now.getTime() + 22 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            itemCount: 6,
          },
          {
            _id: "demo_inv_2",
            invoiceNumber: "INV-2026-0091",
            netTotal: 8250,
            paidAmount: 0,
            paymentMethod: "CREDIT",
            paymentStatus: "UNPAID",
            dueDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(now.getTime() - 38 * 24 * 60 * 60 * 1000).toISOString(),
            itemCount: 4,
          },
          {
            _id: "demo_inv_3",
            invoiceNumber: "INV-2026-0075",
            netTotal: 4000,
            paidAmount: 0,
            paymentMethod: "CREDIT",
            paymentStatus: "UNPAID",
            dueDate: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000).toISOString(),
            itemCount: 2,
          },
        ],
        creditNotes: [
          {
            _id: "demo_cn_1",
            creditNoteNumber: "CN-20261001-0004",
            initialAmount: 1800,
            remainingBalance: 1800,
            status: "ACTIVE",
            expiryDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        b2bOrders: [
          {
            _id: "demo_ord_1",
            orderNumber: "B2B-20261002-0014",
            customerPoNumber: "PO-HILTON-2026-44",
            items: [
              { name: "Samba Rice (50kg Bag)", quantity: 2, unitPrice: 11500, subtotal: 23000 },
              { name: "White Sugar (25kg Bag)", quantity: 1, unitPrice: 7200, subtotal: 7200 },
            ],
            subtotal: 30200,
            taxTotal: 0,
            netTotal: 30200,
            status: "PROCESSING",
            requestedDeliveryDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            deliveryAddress: "No. 88, Lake Round Road, Kandy",
            notes: "Please deliver before 10 AM before banquet setup.",
            createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        paymentSlips: [
          {
            _id: "demo_slip_1",
            slipNumber: "SLIP-20261002-0003",
            amount: 15000,
            depositBank: "Bank of Ceylon (BOC)",
            transactionReference: "BOC-TXN-90214",
            paymentDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            status: "APPROVED",
            verifiedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        business: {
          name: "Kandy Super Grocers & Distributors",
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
