import { DefaultSession, DefaultUser } from "next-auth";
import { UserRole } from "@/models/User";

declare module "next-auth" {
  interface User extends DefaultUser {
    id: string;
    businessId?: string;
    businessName?: string;
    role: UserRole;
    username: string;
  }

  interface Session {
    user: {
      id: string;
      businessId?: string;
      businessName?: string;
      role: UserRole;
      username: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    businessId?: string;
    businessName?: string;
    role: UserRole;
    username: string;
  }
}
