import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { User, UserRole } from "@/models/User";
import { Business } from "@/models/Business";
import { loginSchema } from "@/lib/validations/auth";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days session
  },
  providers: [
    CredentialsProvider({
      name: "Sri Lanka POS Credentials",
      credentials: {
        username: { label: "Username / Phone", type: "text" },
        password: { label: "Password / PIN", type: "password" },
      },
      async authorize(credentials) {
        // Validate input schema with Zod
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new Error("Invalid username or password format");
        }

        const { username, password } = parsed.data;
        const normalizedUsername = username.toLowerCase().trim();

        // Check if MongoDB is configured
        const hasDb = Boolean(process.env.MONGODB_URI);

        if (hasDb) {
          await connectToDatabase();

          // If no Super Admin exists, auto-initialize the Platform Super Admin account!
          const superAdminCount = await User.countDocuments({ role: "SUPER_ADMIN" });
          if (superAdminCount === 0) {
            const hashedSuperPass = await bcrypt.hash("superadmin123", 10);
            await User.create({
              name: "Platform Master Admin",
              username: "superadmin",
              password: hashedSuperPass,
              role: "SUPER_ADMIN",
              isActive: true,
            });
          }

          // If no client business exists yet, create initial demo business
          const businessCount = await Business.countDocuments();
          if (businessCount === 0) {
            const initialBiz = await Business.create({
              name: "Kandy Super Grocers",
              businessType: "Grocery & Retail",
              ownerName: "Sunil Perera",
              phone: "0771234567",
              currency: "LKR",
              subscription: {
                plan: "TRIAL",
                status: "ACTIVE",
                startDate: new Date(),
                expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              },
            });

            const hashedAdminPass = await bcrypt.hash("admin123", 10);
            await User.create({
              businessId: initialBiz._id,
              name: "Store Administrator",
              username: "admin",
              password: hashedAdminPass,
              role: "OWNER",
              phone: "0771234567",
              isActive: true,
            });
          }

          // Find user by username
          const user = await User.findOne({
            username: normalizedUsername,
            isActive: true,
          });

          if (!user) {
            throw new Error("Invalid username or password");
          }

          // Compare password hash
          const isPasswordValid = await bcrypt.compare(password, user.password);
          if (!isPasswordValid) {
            throw new Error("Invalid username or password");
          }

          // If Super Admin, return platform context
          if (user.role === "SUPER_ADMIN") {
            return {
              id: user._id.toString(),
              name: user.name,
              username: user.username,
              role: "SUPER_ADMIN" as UserRole,
            };
          }

          // For client store users, fetch store name
          const business = user.businessId ? await Business.findById(user.businessId).select("name") : null;

          return {
            id: user._id.toString(),
            name: user.name,
            username: user.username,
            businessId: user.businessId?.toString(),
            businessName: business ? business.name : "Sri Lanka POS",
            role: user.role as UserRole,
          };
        }

        // ================= DEMO / DEVELOPMENT FALLBACK (NO DB) =================
        // 1. Platform Super Admin (Commercial SaaS Owner)
        if (normalizedUsername === "superadmin" && password === "superadmin123") {
          return {
            id: "demo_superadmin_1",
            name: "Platform Master Admin",
            username: "superadmin",
            role: "SUPER_ADMIN" as UserRole,
          };
        }

        // 2. Client Store Owner
        if (normalizedUsername === "admin" && password === "admin123") {
          return {
            id: "demo_owner_1",
            name: "Demo Store Owner",
            username: "admin",
            businessId: "demo_biz_001",
            businessName: "Lanka Super Mart (Client Shop)",
            role: "OWNER" as UserRole,
          };
        }

        // 3. Client Store Cashier
        if (normalizedUsername === "cashier" && password === "cashier123") {
          return {
            id: "demo_cashier_1",
            name: "Nimal Perera (Cashier)",
            username: "cashier",
            businessId: "demo_biz_001",
            businessName: "Lanka Super Mart (Client Shop)",
            role: "CASHIER" as UserRole,
          };
        }

        throw new Error("Invalid credentials. Use superadmin, admin, or cashier.");
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.businessId = user.businessId;
        token.businessName = user.businessName;
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.businessId = token.businessId;
        session.user.businessName = token.businessName;
        session.user.role = token.role;
        session.user.username = token.username;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "sri-lanka-pos-secret-development-key-32chars",
};

export default authOptions;
