import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { requireSuperAdmin } from "@/lib/tenant";
import { updateSubscriptionSchema } from "@/lib/validations/admin";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    await requireSuperAdmin();
    const { id } = params;
    const body = await req.json();

    const parsed = updateSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { status, plan, expiryDate, isActive } = parsed.data;

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const business = await Business.findById(id);
      if (!business) {
        return NextResponse.json(
          { success: false, error: "Client business not found." },
          { status: 404 }
        );
      }

      if (!business.subscription) {
        business.subscription = {
          plan: "TRIAL",
          status: "TRIAL",
          startDate: new Date(),
          expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          maxProducts: 500,
          maxUsers: 5,
        };
      }

      if (status) business.subscription.status = status;
      if (plan) {
        business.subscription.plan = plan;
        if (plan === "BASIC") {
          business.subscription.maxProducts = 1000;
          business.subscription.maxUsers = 5;
        } else if (plan === "PROFESSIONAL") {
          business.subscription.maxProducts = 5000;
          business.subscription.maxUsers = 15;
        } else if (plan === "ENTERPRISE") {
          business.subscription.maxProducts = 25000;
          business.subscription.maxUsers = 50;
        }
      }
      if (expiryDate) {
        business.subscription.expiryDate = new Date(expiryDate);
      }
      if (typeof isActive === "boolean") {
        business.isActive = isActive;
      }

      // If status is SUSPENDED, also reflect on isActive flag
      if (status === "SUSPENDED") {
        business.isActive = false;
      } else if (status === "ACTIVE") {
        business.isActive = true;
      }

      await business.save();

      return NextResponse.json({
        success: true,
        message: `Subscription for "${business.name}" updated successfully.`,
        business,
      });
    }

    // Demo Mode mock response
    return NextResponse.json({
      success: true,
      message: "Subscription updated successfully (Demo Mode).",
      updated: {
        id,
        status,
        plan,
        expiryDate,
        isActive,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update business subscription";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
