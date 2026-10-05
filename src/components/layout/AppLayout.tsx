"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  Boxes,
  Receipt,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Store,
  Shield,
  Menu,
  X,
  AlertTriangle,
  Clock,
  Truck,
  FileText,
  Tag,
  RotateCcw,
  Barcode,
  Wallet,
  FileSpreadsheet,
  Award,
  MessageSquare,
  Calendar,
  Bike,
  ChefHat,
  UtensilsCrossed,
  Database,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [subscription, setSubscription] = React.useState<{
    plan: string;
    status: string;
    expiryDate?: string;
  } | null>(null);

  const role = session?.user?.role || "CASHIER";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isOwner = role === "OWNER" || isSuperAdmin;
  const isManager = role === "MANAGER" || isOwner;
  const isSupervisor = role === "SUPERVISOR" || isManager;
  const isInventoryClerk = role === "INVENTORY_CLERK" || isManager;
  const isAccountant = role === "ACCOUNTANT" || isManager;

  React.useEffect(() => {
    if (role !== "SUPER_ADMIN") {
      fetch("/api/business")
        .then((res) => res.json())
        .then((data) => {
          if (data?.business?.subscription) {
            setSubscription(data.business.subscription);
          }
        })
        .catch(() => {});
    }
  }, [role]);

  const navItems = [
    ...(isSuperAdmin
      ? [{ label: t("nav.admin", "Super Admin Portal"), href: "/admin", icon: Shield, highlight: true }]
      : []),
    { label: t("nav.posCounter", "POS Counter"), href: "/pos", icon: ShoppingCart, highlight: true },
    { label: t("nav.delivery", "Delivery Hub"), href: "/delivery", icon: Bike },
    { label: t("nav.kds", "Kitchen Display (KDS)"), href: "/kds", icon: ChefHat },
    { label: t("nav.tables", "Dining Tables"), href: "/tables", icon: UtensilsCrossed },
    { label: t("nav.dashboard", "Dashboard"), href: "/dashboard", icon: LayoutDashboard, allowed: isManager || isSupervisor },
    { label: t("nav.products", "Products"), href: "/products", icon: Package, allowed: isManager || isInventoryClerk },
    { label: t("nav.inventory", "Inventory"), href: "/inventory", icon: Boxes, allowed: isManager || isInventoryClerk },
    { label: t("nav.batches", "Batches & Expiry"), href: "/batches", icon: Calendar, allowed: isManager || isInventoryClerk },
    { label: t("nav.labels", "Barcode & Labels"), href: "/labels", icon: Barcode, allowed: isManager || isInventoryClerk },
    { label: t("nav.purchases", "Purchases & Vendors"), href: "/purchases", icon: FileText, allowed: isManager || isInventoryClerk },
    { label: t("nav.grn", "Goods Receiving (GRN)"), href: "/grn", icon: ClipboardCheck, allowed: isManager || isInventoryClerk },
    { label: t("nav.transfers", "Transfers & Branches"), href: "/transfers", icon: Truck, allowed: isManager || isInventoryClerk },
    { label: t("nav.salesHistory", "Sales History"), href: "/sales", icon: Receipt },
    { label: t("nav.invoices", "Invoices & B2B"), href: "/invoices", icon: FileSpreadsheet, allowed: isManager || isSupervisor || isAccountant },
    { label: t("nav.quotations", "Quotations & Estimates"), href: "/quotations", icon: FileText, allowed: isManager || isSupervisor || isAccountant },
    { label: t("nav.returns", "Returns & Credit Notes"), href: "/returns", icon: RotateCcw },
    { label: t("nav.shifts", "Shifts & Drawers"), href: "/shifts", icon: Clock },
    { label: t("nav.expenses", "Expenses & Petty Cash"), href: "/expenses", icon: Wallet, allowed: isManager || isSupervisor || isAccountant },
    { label: t("nav.customers", "Customers"), href: "/customers", icon: Users },
    { label: t("nav.promotions", "Promotions & Loyalty"), href: "/promotions", icon: Tag, allowed: isManager || isSupervisor },
    { label: t("nav.sms", "SMS & Notifications"), href: "/sms", icon: MessageSquare, allowed: isOwner || isManager || isSupervisor },
    { label: t("nav.staff", "Staff & Commissions"), href: "/staff", icon: Award, allowed: isOwner || isManager || isSupervisor },
    { label: t("nav.reports", "Reports & P&L"), href: "/reports", icon: BarChart3, allowed: isOwner || isManager || isAccountant },
    { label: t("nav.backups", "Cloud Backups"), href: "/backups", icon: Database, allowed: isOwner },
    { label: t("nav.settings", "Store Settings"), href: "/settings", icon: Settings, allowed: isOwner },
  ];

  const visibleNav = navItems.filter((item) => {
    if (item.allowed !== undefined) return item.allowed;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100">
      {/* Mobile Topbar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 text-white sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-sm tracking-tight truncate max-w-[140px]">
            {session?.user?.businessName || "Sri Lanka POS"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher showIcon={false} />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white truncate leading-tight">
              {session?.user?.businessName || "Sri Lanka POS"}
            </h1>
            <p className="text-[11px] text-slate-400">Retail & Inventory</p>
          </div>
        </div>

        {/* User Card */}
        <div className="px-5 py-3.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {session?.user?.name || session?.user?.username || "Cashier"}
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full mt-0.5",
                role === "SUPER_ADMIN"
                  ? "bg-rose-950 text-rose-300 border border-rose-800/60 font-bold tracking-wide"
                  : role === "OWNER"
                  ? "bg-purple-950 text-purple-300 border border-purple-800/60"
                  : role === "MANAGER"
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                  : "bg-amber-950 text-amber-300 border border-amber-800/60"
              )}
            >
              <Shield className="w-2.5 h-2.5" />
              {role === "SUPER_ADMIN" ? "SUPER ADMIN" : role}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all",
                  active
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                    : item.highlight
                    ? "bg-slate-800/80 text-blue-300 hover:bg-slate-800 hover:text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-slate-400")} />
                <span>{item.label}</span>
                {item.highlight && !active && (
                  <span className="ml-auto text-[9px] uppercase font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                    Fast
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>🇱🇰 LKR Default</span>
          <span>Asia/Colombo</span>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {/* In-Store Subscription Notification Banner */}
        {subscription && (subscription.status === "SUSPENDED" || subscription.status === "EXPIRED") && (
          <div className="bg-rose-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
              <span>
                Store License {subscription.status}: POS billing is temporarily locked. All store products, inventory, and sales reports are safely preserved.
              </span>
            </div>
            <Link
              href="/settings"
              className="ml-4 px-2.5 py-1 bg-white text-rose-700 rounded-lg text-[11px] font-bold hover:bg-rose-50 transition shrink-0"
            >
              Subscription Details &rarr;
            </Link>
          </div>
        )}

        {subscription && subscription.status === "TRIAL" && (
          <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-medium flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                14-Day Free Evaluation Mode
              </span>
            </div>
            <Link
              href="/settings"
              className="text-[11px] underline font-bold hover:text-slate-900"
            >
              Manage License &rarr;
            </Link>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
