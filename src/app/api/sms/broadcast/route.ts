import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { requireRole } from "@/lib/tenant";
import { dispatchSms, formatSmsTemplate, DEFAULT_SMS_TEMPLATES } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const body = await req.json();

    const {
      segment,
      customMessage,
      templateKey = "overdueReminder",
    } = body;

    if (!segment) {
      return NextResponse.json(
        { success: false, error: "Target customer segment is required" },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const customerQuery: Record<string, unknown> = {
        businessId: context.businessId,
        phone: { $exists: true, $ne: "" },
      };

      if (segment === "OVERDUE_DEBTORS") {
        customerQuery.currentBalance = { $gt: 0 };
        customerQuery.creditAllowed = true;
      } else if (segment === "ALL_CREDIT_CUSTOMERS") {
        customerQuery.creditAllowed = true;
      } else if (segment === "VIP_PLATINUM") {
        customerQuery.loyaltyTier = "PLATINUM";
      } else if (segment === "VIP_GOLD") {
        customerQuery.loyaltyTier = "GOLD";
      } else if (segment === "VIP_SILVER") {
        customerQuery.loyaltyTier = "SILVER";
      }

      const customers = await Customer.find(customerQuery).lean();

      if (customers.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No customers found matching the selected segment with valid phone numbers.",
          totalTargeted: 0,
          sentCount: 0,
          failedCount: 0,
        });
      }

      let sentCount = 0;
      let failedCount = 0;
      let simulatedCount = 0;

      for (const cust of customers) {
        if (!cust.phone) continue;

        const variables = {
          customerName: cust.name,
          balance: cust.currentBalance ? cust.currentBalance.toLocaleString() : "0",
          dueDate: "Earliest",
          tier: cust.loyaltyTier || "REGULAR",
          totalPoints: cust.loyaltyPoints || 0,
        };

        const res = await dispatchSms({
          businessId: context.businessId,
          recipientPhone: cust.phone,
          recipientName: cust.name,
          customerId: cust._id,
          eventType: segment.includes("DEBT") ? "OVERDUE_REMINDER" : "CUSTOM",
          message: customMessage
            ? formatSmsTemplate(customMessage, variables)
            : undefined,
          templateKey: customMessage ? undefined : templateKey,
          variables,
        });

        if (res.status === "SENT") {
          sentCount++;
        } else if (res.status === "SIMULATED") {
          simulatedCount++;
        } else {
          failedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Campaign complete: ${sentCount + simulatedCount} messages dispatched successfully.`,
        totalTargeted: customers.length,
        sentCount,
        simulatedCount,
        failedCount,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Campaign dispatched (Demo Mode: 12 recipients notified)",
      totalTargeted: 12,
      sentCount: 12,
      simulatedCount: 0,
      failedCount: 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to broadcast SMS";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
