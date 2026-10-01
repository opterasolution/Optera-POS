import { NextResponse } from "next/server";
import { requireRole } from "@/lib/tenant";
import { dispatchSms, isValidSriLankanPhone } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER", "SUPERVISOR"]);
    const body = await req.json();

    const {
      phone,
      message,
      recipientName,
      eventType = "TEST",
    } = body;

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { success: false, error: "Recipient mobile phone number is required" },
        { status: 400 }
      );
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "SMS message content cannot be empty" },
        { status: 400 }
      );
    }

    const result = await dispatchSms({
      businessId: context.businessId,
      recipientPhone: phone.trim(),
      recipientName: recipientName?.trim(),
      eventType,
      message: message.trim(),
    });

    return NextResponse.json({
      success: result.success,
      status: result.status,
      message: result.message,
      normalizedPhone: result.normalizedPhone,
      logId: result.logId,
      error: result.error,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send SMS";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
