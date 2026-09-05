import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@/models/User";

export interface TenantContext {
  userId: string;
  businessId: string;
  businessName?: string;
  role: UserRole;
  username: string;
}

/**
 * Ensures the request has a valid, active session.
 * Throws an error if unauthenticated.
 */
export async function requireAuth(): Promise<TenantContext> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.businessId) {
    throw new Error("Unauthorized: Active login session required.");
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
 * Throws 403 Forbidden if user role is insufficient.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<TenantContext> {
  const context = await requireAuth();

  if (!allowedRoles.includes(context.role)) {
    throw new Error(
      `Forbidden: Your role (${context.role}) does not have permission to perform this action.`
    );
  }

  return context;
}
