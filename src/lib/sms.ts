import { Types } from "mongoose";
import { Business } from "@/models/Business";
import { SmsLog, SmsEventType, SmsDeliveryStatus } from "@/models/SmsLog";

export const DEFAULT_SMS_TEMPLATES = {
  creditSale:
    "Dear {customerName}, purchase of Rs. {amount} added to your credit at {storeName}. Outstanding balance: Rs. {balance}. Due: {dueDate}. View receipt: {receiptUrl} | Statement: {portalUrl}. Thank you!",
  creditSettlement:
    "Dear {customerName}, payment of Rs. {amount} received at {storeName}. Remaining balance: Rs. {balance}. Ref: {ref}. View statement: {portalUrl}. Thank you!",
  overdueReminder:
    "Dear {customerName}, reminder from {storeName}: your credit balance of Rs. {balance} is overdue. Please settle soon. View statement: {portalUrl}. Tel: {phone}",
  loyaltyAccrual:
    "Congratulations {customerName}! You earned {points} pts at {storeName}. Total: {totalPoints} pts ({tier} VIP). View balance: {portalUrl}. Thank you!",
  giftVoucher:
    "Dear {recipientName}, you received a gift voucher worth Rs. {amount} from {storeName}! Code: {code}. Check balance: {voucherUrl}. Valid until {expiryDate}.",
  quotation:
    "Dear {customerName}, quotation {quoteNumber} for Rs. {amount} is ready at {storeName}. Valid until {validUntil}. View details: {receiptUrl}. Thank you!",
  quotationAlert:
    "Dear {customerName}, quotation {ref} for Rs. {amount} is ready at {storeName}. Valid until {dueDate}. View details: {receiptUrl}. Thank you!",
};

/**
 * Normalizes Sri Lankan phone numbers to international standard 947XXXXXXXX
 * Examples:
 * 0771234567 -> 94771234567
 * +94771234567 -> 94771234567
 * 771234567 -> 94771234567
 */
export function normalizeSriLankanPhone(phone: string): string {
  if (!phone) return "";
  let clean = phone.replace(/[\s\-\(\)\+]/g, "").trim();

  // If starts with 0 (e.g. 0771234567), replace leading 0 with 94
  if (clean.startsWith("0") && clean.length === 10) {
    clean = "94" + clean.slice(1);
  }

  // If 9 digits (e.g. 771234567), prefix with 94
  if (clean.length === 9 && (clean.startsWith("7") || clean.startsWith("1"))) {
    clean = "94" + clean;
  }

  return clean;
}

/**
 * Validates whether a phone number matches Sri Lankan mobile number format
 */
export function isValidSriLankanPhone(phone: string): boolean {
  const normalized = normalizeSriLankanPhone(phone);
  // Sri Lankan mobile: 947 followed by 8 digits (total 11 digits: 947XXXXXXXX)
  return /^947[0-9]{8}$/.test(normalized);
}

/**
 * Injects transaction variables into SMS template placeholders
 */
export function formatSmsTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = template;
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, "gi");
    result = result.replace(regex, String(val ?? ""));
  }
  return result;
}

export interface SendSmsParams {
  businessId: Types.ObjectId | string;
  recipientPhone: string;
  recipientName?: string;
  customerId?: Types.ObjectId | string;
  eventType: SmsEventType;
  message?: string;
  templateKey?: keyof typeof DEFAULT_SMS_TEMPLATES | string;
  variables?: Record<string, string | number>;
  metadata?: Record<string, any>;
}

export interface SendSmsResponse {
  success: boolean;
  status: SmsDeliveryStatus;
  message: string;
  normalizedPhone: string;
  logId?: string;
  error?: string;
}

/**
 * Dispatches an SMS via configured Sri Lankan gateway (Notify.lk, Dialog, Mobitel, or Simulated Sandbox)
 */
export async function dispatchSms({
  businessId,
  recipientPhone,
  recipientName,
  customerId,
  eventType,
  message,
  templateKey,
  variables = {},
  metadata,
}: SendSmsParams): Promise<SendSmsResponse> {
  const normalizedPhone = normalizeSriLankanPhone(recipientPhone);

  if (!normalizedPhone) {
    return {
      success: false,
      status: "FAILED",
      message: "Recipient phone number is missing.",
      normalizedPhone: "",
      error: "Phone number missing",
    };
  }

  try {
    // 1. Fetch store business & SMS configuration
    const business = await Business.findById(businessId).lean();
    const storeName = business?.name || "Sri Lanka Store";
    const storePhone = business?.phone || "";

    const smsSettings = business?.smsSettings;
    const isEnabled = smsSettings?.enabled || false;
    const provider = smsSettings?.provider || "SIMULATED";
    const senderId = smsSettings?.senderId || "NOTIFYDEMO";

    // 2. Resolve final message body
    let finalMessage = message?.trim();
    if (!finalMessage && templateKey) {
      const customTpl = (smsSettings?.templates as any)?.[templateKey];
      const baseTemplate = customTpl || (DEFAULT_SMS_TEMPLATES as any)[templateKey] || "";
      const allVars = {
        storeName,
        phone: storePhone,
        customerName: recipientName || "Valued Customer",
        recipientName: recipientName || "Valued Customer",
        ...variables,
      };
      finalMessage = formatSmsTemplate(baseTemplate, allVars);
    }

    if (!finalMessage) {
      finalMessage = `Notification from ${storeName}`;
    }

    // Cost estimate (standard rate: Rs. 0.40 per SMS part in Sri Lanka)
    const smsParts = Math.ceil(finalMessage.length / 160) || 1;
    const cost = Math.round(smsParts * 0.4 * 100) / 100;

    // 3. If SMS is disabled or in SIMULATED mode, log and succeed without HTTP
    if (!isEnabled || provider === "SIMULATED" || !smsSettings?.apiKey) {
      const log = await SmsLog.create({
        businessId,
        recipientPhone: normalizedPhone,
        recipientName,
        customerId: customerId && Types.ObjectId.isValid(customerId) ? customerId : undefined,
        eventType,
        message: finalMessage,
        provider: "SIMULATED",
        senderId,
        status: "SIMULATED",
        gatewayResponse: "Delivered via Local Sandbox Simulator (No live gateway credits billed)",
        cost,
      });

      return {
        success: true,
        status: "SIMULATED",
        message: "SMS simulated successfully.",
        normalizedPhone,
        logId: log._id.toString(),
      };
    }

    // 4. Live Gateway Dispatch
    let gatewaySuccess = false;
    let gatewayResponseText = "";
    let errorDetails = "";

    if (provider === "NOTIFY_LK") {
      // Notify.lk official API: https://app.notify.lk/api/v1/send
      try {
        const formData = new URLSearchParams();
        formData.append("user_id", smsSettings.userId || "");
        formData.append("api_key", smsSettings.apiKey || "");
        formData.append("sender_id", senderId);
        formData.append("to", normalizedPhone);
        formData.append("message", finalMessage);

        const response = await fetch("https://app.notify.lk/api/v1/send", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });

        const resData = await response.json();
        gatewayResponseText = JSON.stringify(resData);
        gatewaySuccess = resData.status === "success" || response.ok;
        if (!gatewaySuccess) {
          errorDetails = resData.message || "Notify.lk returned error status";
        }
      } catch (httpErr: any) {
        gatewaySuccess = false;
        errorDetails = httpErr?.message || "Failed to connect to Notify.lk";
      }
    } else if (provider === "DIALOG") {
      // Dialog Enterprise eSMS REST API
      try {
        const response = await fetch("https://esms.dialog.lk/api/v1/sms/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${smsSettings.apiKey}`,
          },
          body: JSON.stringify({
            sourceAddress: senderId,
            destinationAddresses: [normalizedPhone],
            message: finalMessage,
          }),
        });

        const resData = await response.json();
        gatewayResponseText = JSON.stringify(resData);
        gatewaySuccess = response.ok;
        if (!gatewaySuccess) {
          errorDetails = resData.message || "Dialog eSMS returned error";
        }
      } catch (httpErr: any) {
        gatewaySuccess = false;
        errorDetails = httpErr?.message || "Failed to connect to Dialog eSMS";
      }
    } else if (provider === "MOBITEL") {
      // Mobitel m-Spaces API
      try {
        const response = await fetch("https://api.mobitel.lk/mspaces/v1/sms/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${smsSettings.apiKey}`,
          },
          body: JSON.stringify({
            sender: senderId,
            recipient: normalizedPhone,
            message: finalMessage,
          }),
        });

        const resData = await response.json();
        gatewayResponseText = JSON.stringify(resData);
        gatewaySuccess = response.ok;
      } catch (httpErr: any) {
        gatewaySuccess = false;
        errorDetails = httpErr?.message || "Failed to connect to Mobitel m-Spaces";
      }
    }

    // 5. Record in SmsLog
    const logStatus: SmsDeliveryStatus = gatewaySuccess ? "SENT" : "FAILED";
    const log = await SmsLog.create({
      businessId,
      recipientPhone: normalizedPhone,
      recipientName,
      customerId: customerId && Types.ObjectId.isValid(customerId) ? customerId : undefined,
      eventType,
      message: finalMessage,
      provider,
      senderId,
      status: logStatus,
      gatewayResponse: gatewayResponseText,
      cost: gatewaySuccess ? cost : 0,
      errorDetails: errorDetails || undefined,
      metadata,
    });

    return {
      success: gatewaySuccess,
      status: logStatus,
      message: gatewaySuccess ? "SMS dispatched successfully." : `Failed: ${errorDetails}`,
      normalizedPhone,
      logId: log._id.toString(),
      error: errorDetails || undefined,
    };
  } catch (err: any) {
    console.error("SMS dispatch exception:", err);
    return {
      success: false,
      status: "FAILED",
      message: "Internal error during SMS delivery.",
      normalizedPhone,
      error: err?.message,
    };
  }
}
