import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Business } from "@/models/Business";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth } from "@/lib/tenant";
import { formatWhatsAppDebtReminder, buildWhatsAppUrl, toWhatsAppPhone } from "@/lib/notifications";

/**
 * Customer Credit Debt ("Naya Potha") Reminder API
 * Generates formatted polite WhatsApp reminder text and URL,
 * updates customer reminder metadata, and writes to audit logs.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const customerId = params.id;

    if (!customerId) {
      return NextResponse.json({ success: false, error: "Missing customer ID" }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const [customer, business] = await Promise.all([
        Customer.findOne({ _id: customerId, businessId: context.businessId }),
        Business.findById(context.businessId).lean(),
      ]);

      if (!customer) {
        return NextResponse.json({ success: false, error: "Customer profile not found." }, { status: 404 });
      }

      if ((customer.currentBalance || 0) <= 0) {
        return NextResponse.json(
          { success: false, error: "This customer has zero outstanding balance (no debt to settle)." },
          { status: 400 }
        );
      }

      // Generate polite Sri Lankan debt reminder message
      const messageText = formatWhatsAppDebtReminder({
        customer: {
          _id: customer._id.toString(),
          name: customer.name,
          phone: customer.phone,
          currentBalance: customer.currentBalance,
          creditLimit: customer.creditLimit,
          lastReminderSentAt: customer.lastReminderSentAt,
        },
        business: business || { name: "Our Store", phone: "" },
      });

      const whatsappUrl = buildWhatsAppUrl(customer.phone, messageText);

      // Update customer reminder telemetry
      customer.lastReminderSentAt = new Date();
      customer.reminderCount = (customer.reminderCount || 0) + 1;
      await customer.save();

      // Write Audit Log
      await AuditLog.create({
        businessId: context.businessId,
        action: "DEBT_REMINDER_SENT",
        entity: "CUSTOMER",
        entityId: customer._id.toString(),
        userId: context.userId,
        username: context.username || "Staff",
        details: {
          customerName: customer.name,
          phone: customer.phone,
          currentBalance: customer.currentBalance,
          reminderCount: customer.reminderCount,
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        messageText,
        whatsappUrl,
        customer: {
          _id: customer._id,
          name: customer.name,
          phone: customer.phone,
          currentBalance: customer.currentBalance,
          creditLimit: customer.creditLimit,
          lastReminderSentAt: customer.lastReminderSentAt,
          reminderCount: customer.reminderCount,
        },
      });
    }

    // Mock response when DB is in memory / demo mode
    const mockMessage = `Dear Customer,\n\nFriendly reminder regarding your store credit balance: Rs. 5,000.00.\nThank you!`;
    return NextResponse.json({
      success: true,
      messageText: mockMessage,
      whatsappUrl: `https://wa.me/?text=${encodeURIComponent(mockMessage)}`,
      customer: {
        _id: customerId,
        name: "Demo Customer",
        phone: "0771234567",
        currentBalance: 5000,
        creditLimit: 10000,
        lastReminderSentAt: new Date().toISOString(),
        reminderCount: 1,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate reminder";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
