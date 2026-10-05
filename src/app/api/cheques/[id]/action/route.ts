import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { BankCheque } from "@/models/BankCheque";
import { BankAccount } from "@/models/BankAccount";
import { Customer } from "@/models/Customer";
import { CreditTransaction } from "@/models/CreditTransaction";
import { Business } from "@/models/Business";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth } from "@/lib/tenant";
import { dispatchSms } from "@/lib/sms";
import { CHEQUE_DISHONOR_REASONS } from "@/lib/sri-lanka-banks";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const body = await req.json();
    const { action } = body; // "DEPOSIT" | "REALIZE" | "RETURN" | "CANCEL"

    if (!["DEPOSIT", "REALIZE", "RETURN", "CANCEL"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be DEPOSIT, REALIZE, RETURN, or CANCEL." },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const businessId = new Types.ObjectId(context.businessId);

    const cheque = await BankCheque.findOne({
      _id: new Types.ObjectId(params.id),
      businessId,
    });

    if (!cheque) {
      return NextResponse.json({ success: false, error: "Cheque not found." }, { status: 404 });
    }

    const userName = context.username || "Accountant";

    // ================= ACTION: DEPOSIT =================
    if (action === "DEPOSIT") {
      if (cheque.status !== "RECEIVED") {
        return NextResponse.json(
          { success: false, error: `Only cheques in RECEIVED status can be deposited (current: ${cheque.status}).` },
          { status: 400 }
        );
      }

      const {
        bankAccountId,
        merchantBankName,
        merchantAccountNumber,
        merchantAccountBranch,
        depositSlipNumber,
        depositDate = new Date(),
        notes,
      } = body;

      cheque.status = "DEPOSITED";
      cheque.depositDetails = {
        bankAccountId: bankAccountId ? new Types.ObjectId(bankAccountId) : undefined,
        depositSlipNumber: depositSlipNumber || `DS-MANUAL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
        depositedAt: new Date(depositDate),
        depositedBy: userName,
        bankName: merchantBankName || "Commercial Bank of Ceylon",
        accountNumber: merchantAccountNumber || "",
        branchName: merchantAccountBranch || "Main Branch",
        notes,
      };

      await cheque.save();

      // If bankAccountId provided, update ledger balance
      if (bankAccountId) {
        await BankAccount.findByIdAndUpdate(bankAccountId, {
          $inc: { ledgerBalance: cheque.amount },
        });
      }

      await AuditLog.create({
        businessId,
        action: "CHEQUE_DEPOSITED",
        performedBy: userName,
        details: `Cheque #${cheque.chequeNumber} (LKR ${cheque.amount.toLocaleString()}) marked as deposited into ${cheque.depositDetails.bankName}`,
      });

      return NextResponse.json({
        success: true,
        cheque,
        message: `Cheque #${cheque.chequeNumber} marked as deposited successfully.`,
      });
    }

    // ================= ACTION: REALIZE =================
    if (action === "REALIZE") {
      if (cheque.status === "REALIZED") {
        return NextResponse.json({ success: false, error: "Cheque is already realized." }, { status: 400 });
      }

      const {
        bankStatementRef,
        realizedAt = new Date(),
        clearedAmount = cheque.amount,
        notes,
      } = body;

      const previousStatus = cheque.status;
      cheque.status = "REALIZED";
      cheque.realizationDetails = {
        realizedAt: new Date(realizedAt),
        realizedBy: userName,
        bankStatementRef: bankStatementRef || `CLEAR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
        clearedAmount: Number(clearedAmount) || cheque.amount,
        notes,
      };

      await cheque.save();

      // Update merchant bank account balance
      if (cheque.depositDetails?.bankAccountId) {
        const delta = cheque.direction === "INWARD" ? cheque.amount : -cheque.amount;
        const incFields: any = { clearedBalance: delta };
        // If not previously deposited through system, also increase ledger balance
        if (previousStatus === "RECEIVED") {
          incFields.ledgerBalance = delta;
        }
        await BankAccount.findByIdAndUpdate(cheque.depositDetails.bankAccountId, {
          $inc: incFields,
        });
      }

      await AuditLog.create({
        businessId,
        action: "CHEQUE_REALIZED",
        performedBy: userName,
        details: `Cheque #${cheque.chequeNumber} (LKR ${cheque.amount.toLocaleString()}) realized/cleared. Ref: ${cheque.realizationDetails.bankStatementRef}`,
      });

      return NextResponse.json({
        success: true,
        cheque,
        message: `Cheque #${cheque.chequeNumber} marked as realized/cleared.`,
      });
    }

    // ================= ACTION: RETURN (BOUNCE / DISHONOR) =================
    if (action === "RETURN") {
      if (cheque.status === "RETURNED") {
        return NextResponse.json({ success: false, error: "Cheque is already recorded as returned." }, { status: 400 });
      }

      const {
        reasonCode = "01",
        reasonText,
        returnPenaltyFee = 0,
        reDebitCustomer = true,
        sendSms = false,
        notes,
      } = body;

      const foundReason = CHEQUE_DISHONOR_REASONS.find((r) => r.code === reasonCode);
      const resolvedReason = reasonText || foundReason?.description || "Cheque Dishonored / Returned by Bank";
      const penaltyAmount = Number(returnPenaltyFee) || (foundReason?.defaultPenalty ?? 0);

      cheque.status = "RETURNED";
      cheque.returnDetails = {
        returnedAt: new Date(),
        returnedBy: userName,
        reasonCode,
        reasonText: resolvedReason,
        returnPenaltyFee: penaltyAmount,
        customerReDebited: false,
        smsAlertSent: false,
        notes,
      };

      let updatedBalance: number | undefined;

      // Reverse ledger balance in bank account if it was deposited
      if (cheque.depositDetails?.bankAccountId) {
        await BankAccount.findByIdAndUpdate(cheque.depositDetails.bankAccountId, {
          $inc: { ledgerBalance: -cheque.amount },
        });
      }

      // Re-debit customer credit ledger
      if (cheque.direction === "INWARD" && cheque.partyId && reDebitCustomer) {
        const customer = await Customer.findOne({ _id: cheque.partyId, businessId });
        if (customer) {
          const balanceBefore = customer.currentBalance || 0;
          const reDebitTotal = cheque.amount + penaltyAmount;
          const balanceAfter = balanceBefore + reDebitTotal;

          customer.currentBalance = balanceAfter;
          await customer.save();
          cheque.returnDetails.customerReDebited = true;
          updatedBalance = balanceAfter;

          const count = await CreditTransaction.countDocuments({ businessId });
          const txnNumber = `CR-RET-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(count + 1).padStart(4, "0")}`;

          await CreditTransaction.create({
            businessId,
            customerId: customer._id,
            transactionNumber: txnNumber,
            type: "CHEQUE_RETURN",
            amount: reDebitTotal,
            balanceBefore,
            balanceAfter,
            paymentMethod: "CHEQUE",
            paymentReference: `Dishonored Cheque #${cheque.chequeNumber}`,
            chequeId: cheque._id,
            chequeNumber: cheque.chequeNumber,
            notes: `Returned: ${resolvedReason}. Cheque Amount: LKR ${cheque.amount.toLocaleString()}${penaltyAmount > 0 ? ` + Penalty Fee: LKR ${penaltyAmount.toLocaleString()}` : ""}`,
            performedBy: userName,
          });

          // Optional SMS alert dispatch
          if (sendSms && customer.phone) {
            const business = await Business.findById(businessId).lean();
            const storeName = business?.name || "Our Store";

            const smsMessage = `Dear ${customer.name}, Cheque #${cheque.chequeNumber} for Rs. ${cheque.amount.toLocaleString()} was returned by bank (${resolvedReason}). Re-debited: Rs. ${reDebitTotal.toLocaleString()} (incl. Rs. ${penaltyAmount} penalty). Outstanding balance: Rs. ${balanceAfter.toLocaleString()}. Please contact ${storeName} to arrange immediate settlement.`;

            try {
              const smsResult = await dispatchSms({
                businessId,
                recipientPhone: customer.phone,
                recipientName: customer.name,
                customerId: customer._id,
                eventType: "CHEQUE_RETURN",
                message: smsMessage,
              });

              if (smsResult.success) {
                cheque.returnDetails.smsAlertSent = true;
              }
            } catch (err) {
              console.error("Failed to dispatch cheque bounce SMS:", err);
            }
          }
        }
      }

      await cheque.save();

      await AuditLog.create({
        businessId,
        action: "CHEQUE_RETURNED",
        performedBy: userName,
        details: `Cheque #${cheque.chequeNumber} (LKR ${cheque.amount.toLocaleString()}) marked as returned. Reason: ${resolvedReason}. Penalty: LKR ${penaltyAmount}`,
      });

      return NextResponse.json({
        success: true,
        cheque,
        message: `Cheque #${cheque.chequeNumber} marked as RETURNED. Customer re-debited: LKR ${(cheque.amount + penaltyAmount).toLocaleString()}`,
        updatedCustomerBalance: updatedBalance,
      });
    }

    // ================= ACTION: CANCEL =================
    if (action === "CANCEL") {
      cheque.status = "CANCELLED";
      if (body.notes) {
        cheque.notes = (cheque.notes ? cheque.notes + " | " : "") + body.notes;
      }
      await cheque.save();

      await AuditLog.create({
        businessId,
        action: "CHEQUE_CANCELLED",
        performedBy: userName,
        details: `Cheque #${cheque.chequeNumber} marked as CANCELLED.`,
      });

      return NextResponse.json({
        success: true,
        cheque,
        message: `Cheque #${cheque.chequeNumber} marked as cancelled.`,
      });
    }

    return NextResponse.json({ success: false, error: "Unhandled action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process cheque action." },
      { status: 500 }
    );
  }
}
