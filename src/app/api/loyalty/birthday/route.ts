import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Business } from "@/models/Business";
import { AuditLog } from "@/models/AuditLog";
import { requireAuth } from "@/lib/tenant";
import { dispatchSms } from "@/lib/sms";

export async function GET() {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const customers = await Customer.find({
        businessId: context.businessId,
        dateOfBirth: { $exists: true, $ne: null },
      })
        .select("name phone dateOfBirth loyaltyTier loyaltyPoints portalToken totalSpent")
        .lean();

      const now = new Date();
      const currentMonth = now.getUTCMonth();
      const currentDay = now.getUTCDate();

      const birthdaysToday: any[] = [];
      const birthdaysUpcoming: any[] = [];
      const birthdaysMonth: any[] = [];

      for (const c of customers) {
        if (!c.dateOfBirth) continue;
        const dob = new Date(c.dateOfBirth);
        const dobMonth = dob.getUTCMonth();
        const dobDay = dob.getUTCDate();

        // Calculate age
        const age = now.getUTCFullYear() - dob.getUTCFullYear();

        const customerInfo = {
          _id: c._id,
          name: c.name,
          phone: c.phone,
          dateOfBirth: c.dateOfBirth,
          day: dobDay,
          month: dobMonth,
          age: age > 0 && age < 120 ? age : undefined,
          loyaltyTier: c.loyaltyTier || "REGULAR",
          loyaltyPoints: c.loyaltyPoints || 0,
          totalSpent: c.totalSpent || 0,
          portalToken: c.portalToken,
        };

        if (dobMonth === currentMonth) {
          birthdaysMonth.push(customerInfo);

          if (dobDay === currentDay) {
            birthdaysToday.push(customerInfo);
          } else if (dobDay > currentDay && dobDay <= currentDay + 7) {
            birthdaysUpcoming.push(customerInfo);
          }
        }
      }

      // Sort upcoming by earliest day
      birthdaysUpcoming.sort((a, b) => a.day - b.day);
      birthdaysMonth.sort((a, b) => a.day - b.day);

      return NextResponse.json({
        success: true,
        stats: {
          todayCount: birthdaysToday.length,
          upcomingWeekCount: birthdaysUpcoming.length,
          monthCount: birthdaysMonth.length,
        },
        birthdaysToday,
        birthdaysUpcoming,
        birthdaysMonth,
      });
    }

    // Demo Mode Fallback
    const demoDate = new Date();
    return NextResponse.json({
      success: true,
      stats: {
        todayCount: 1,
        upcomingWeekCount: 2,
        monthCount: 5,
      },
      birthdaysToday: [
        {
          _id: "demo_bday_1",
          name: "Sunil Perera",
          phone: "0771234567",
          dateOfBirth: new Date(1985, demoDate.getMonth(), demoDate.getDate()).toISOString(),
          day: demoDate.getDate(),
          month: demoDate.getMonth(),
          age: 41,
          loyaltyTier: "GOLD",
          loyaltyPoints: 1240,
          totalSpent: 85000,
        },
      ],
      birthdaysUpcoming: [
        {
          _id: "demo_bday_2",
          name: "Anoma Silva",
          phone: "0719876543",
          dateOfBirth: new Date(1992, demoDate.getMonth(), demoDate.getDate() + 3).toISOString(),
          day: demoDate.getDate() + 3,
          month: demoDate.getMonth(),
          age: 34,
          loyaltyTier: "SILVER",
          loyaltyPoints: 580,
          totalSpent: 32000,
        },
      ],
      birthdaysMonth: [
        {
          _id: "demo_bday_3",
          name: "Kamal Gunaratne",
          phone: "0765551234",
          dateOfBirth: new Date(1978, demoDate.getMonth(), demoDate.getDate() + 12).toISOString(),
          day: demoDate.getDate() + 12,
          month: demoDate.getMonth(),
          age: 48,
          loyaltyTier: "REGULAR",
          loyaltyPoints: 210,
          totalSpent: 14000,
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load birthday records";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAuth();
    const body = await req.json();
    const { customerId, customMessage } = body;

    if (!customerId) {
      return NextResponse.json({ success: false, error: "Customer ID is required." }, { status: 400 });
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const customer = await Customer.findOne({
        _id: customerId,
        businessId: context.businessId,
      });

      if (!customer) {
        return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
      }

      if (!customer.phone) {
        return NextResponse.json(
          { success: false, error: "Customer does not have a registered mobile number." },
          { status: 400 }
        );
      }

      const business = await Business.findById(context.businessId).lean();
      const storeName = business?.name || "Our Store";
      const portalUrl = customer.portalToken
        ? `${process.env.NEXT_PUBLIC_APP_URL || "https://pos.srilanka.lk"}/portal/statement/${customer.portalToken}`
        : `${process.env.NEXT_PUBLIC_APP_URL || "https://pos.srilanka.lk"}/portal`;

      // Dispatch Birthday SMS Greeting
      await dispatchSms({
        businessId: context.businessId,
        recipientPhone: customer.phone,
        recipientName: customer.name,
        customerId: customer._id,
        eventType: "CUSTOM",
        message:
          customMessage ||
          `🎂 Happy Birthday ${customer.name}! Warm wishes from all of us at ${storeName}. Enjoy 2.0x Double Loyalty Points on all your purchases this month! View your VIP rewards: ${portalUrl}`,
        metadata: { birthdayGreeting: true },
      });

      await AuditLog.create({
        businessId: context.businessId,
        userId: context.userId,
        userName: context.username,
        action: "CUSTOMER_UPDATED",
        entityType: "Customer",
        entityId: customer._id.toString(),
        details: { action: "BIRTHDAY_GREETING_SMS_SENT", phone: customer.phone },
      });

      return NextResponse.json({
        success: true,
        message: `Birthday SMS greeting successfully sent to ${customer.name} (${customer.phone})`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Demo Mode: Birthday SMS greeting triggered successfully",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to dispatch birthday greeting";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
