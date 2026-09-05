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

        // Check if MongoDB is configured
        const hasDb = Boolean(process.env.MONGODB_URI);

        if (hasDb) {
          await connectToDatabase();

          // Find user by username
          let user = await User.findOne({
            username: username.toLowerCase(),
            isActive: true,
          });

          // If no users exist in database yet, automatically initialize the first default Owner account!
          const userCount = await User.countDocuments();
          if (userCount === 0) {
            let defaultBusiness = await Business.findOne();
            if (!defaultBusiness) {
              defaultBusiness = await Business.create({
                name: "Kandy Super Grocers",
                businessType: "Grocery & Retail",
                ownerName: "Shop Owner",
                phone: "0771234567",
                currency: "LKR",
                taxSettings: {
                  enabled: false,
                  name: "VAT",
                  rate: 0,
                  type: "INCLUSIVE",
                },
              });
            }

            const hashedPassword = await bcrypt.hash("admin123", 10);
            user = await User.create({
              businessId: defaultBusiness._id,
              name: "Store Administrator",
              username: "admin",
              password: hashedPassword,
              role: "OWNER",
              phone: "0771234567",
              isActive: true,
            });
          }

          if (!user) {
            throw new Error("Invalid username or password");
          }

          // Compare password hash
          const isPasswordValid = await bcrypt.compare(password, user.password);
          if (!isPasswordValid) {
            throw new Error("Invalid username or password");
          }

          // Get business name for session
          const business = await Business.findById(user.businessId).select("name");

          return {
            id: user._id.toString(),
            name: user.name,
            username: user.username,
            businessId: user.businessId.toString(),
            businessName: business ? business.name : "Sri Lanka POS",
            role: user.role as UserRole,
          };
        }

        // Demo / Development fallback when MONGODB_URI is not yet configured in .env.local
        if (username === "admin" && password === "admin123") {
          return {
            id: "demo_owner_1",
            name: "Demo Store Owner",
            username: "admin",
            businessId: "demo_biz_001",
            businessName: "Lanka Super Mart (Demo)",
            role: "OWNER" as UserRole,
          };
        }

        if (username === "cashier" && password === "cashier123") {
          return {
            id: "demo_cashier_1",
            name: "Nimal Perera (Cashier)",
            username: "cashier",
            businessId: "demo_biz_001",
            businessName: "Lanka Super Mart (Demo)",
            role: "CASHIER" as UserRole,
          };
        }

        throw new Error("Invalid credentials. Try admin / admin123 or cashier / cashier123");
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
