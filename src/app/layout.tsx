import type { Metadata } from "next";
import AuthProvider from "@/components/providers/AuthProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sri Lanka POS — Smart Retail Point of Sale",
  description: "Fast, simple, reliable Point of Sale system for Sri Lankan small businesses.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <AuthProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
