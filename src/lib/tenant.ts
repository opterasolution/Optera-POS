import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@/models/User";
import { Business } from "@/models/Business";
import { connectToDatabase } from "@/lib/db";

export interface TenantContext {
  userId: string;
  businessId: string;
  businessName?: string;
  role: UserRole;
  username: string;
}

export interface SuperAdminContext {
  userId: string;
  role: "SUPER_ADMIN";
  username: string;
}

/**
 * Ensures the request has a valid, active session.
 * For store staff (OWNER, MANAGER, CASHIER), businessId is strictly required.
 */
export async function requireAuth(): Promise<TenantContext> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    throw new Error("Unauthorized: Active login session required.");
  }

  // If a Super Admin calls an endpoint that requires a store context,
  // we require a businessId (or provide a safe platform fallback).
  if (session.user.role === "SUPER_ADMIN") {
    return {
      userId: session.user.id,
      businessId: session.user.businessId || "platform_admin",
      businessName: "Platform Administration",
      role: "SUPER_ADMIN",
      username: session.user.username,
    };
  }

  if (!session.user.businessId) {
    throw new Error("Unauthorized: User does not belong to an active business.");
  }

  return {
    userId: session.user.id,
    businessId: session.user.businessId,
    businessName: session.user.businessName,
    role: session.user.role as UserRole,
    username: session.user.username,
  };
}

/**
 * Enforces role-based permissions (e.g. ['OWNER'], or ['OWNER', 'MANAGER']).
 * SUPER_ADMIN is automatically granted bypass rights for administration.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<TenantContext> {
  const context = await requireAuth();

  if (context.role === "SUPER_ADMIN") {
    return context;
  }

  if (!allowedRoles.includes(context.role)) {
    throw new Error(
      `Forbidden: Your role (${context.role}) does not have permission to perform this action.`
    );
  }

  return context;
}

/**
 * Strictly verifies that the authenticated user is the Platform Super Admin.
 */
export async function requireSuperAdmin(): Promise<SuperAdminContext> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden: Only the Platform Super Admin can access this resource.");
  }

  return {
    userId: session.user.id,
    role: "SUPER_ADMIN",
    username: session.user.username,
  };
}

/**
 * Verifies that the client store's subscription license is active (TRIAL or ACTIVE).
 * Throws an error if EXPIRED or SUSPENDED.
 */
export async function verifyActiveSubscription(businessId: string): Promise<boolean> {
  if (!businessId || businessId === "platform_admin" || businessId === "demo_biz_001") {
    return true;
  }

  if (Boolean(process.env.MONGODB_URI)) {
    await connectToDatabase();
    const business = await Business.findById(businessId).select("subscription isActive");

    if (!business || !business.isActive) {
      throw new Error("Store Account Suspended: Please contact platform support.");
    }

    const sub = business.subscription;
    if (sub) {
      if (sub.status === "SUSPENDED") {
        throw new Error("Store License Suspended: Please contact platform billing support.");
      }
      if (sub.status === "EXPIRED" || (sub.expiryDate && new Date(sub.expiryDate) < new Date())) {
        throw new Error("Store Subscription Expired: Please renew your license to continue billing.");
      }
    }
  }

  return true;
}
