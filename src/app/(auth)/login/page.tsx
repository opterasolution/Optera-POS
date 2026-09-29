"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Store, Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Crown, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const result = await signIn("credentials", {
        redirect: false,
        username: username.trim(),
        password,
      });

      if (result?.error) {
        setErrorMessage("Incorrect username or password. Please try again.");
        setLoading(false);
        return;
      }

      // Check user role via me endpoint
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();

      if (meData?.user?.role === "SUPER_ADMIN") {
        router.push("/admin");
      } else {
        router.push("/pos");
      }
      router.refresh();
    } catch {
      setErrorMessage("Unable to connect to the login service. Please check your network.");
      setLoading(false);
    }
  };

  const fillQuickCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage("");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))]">
      <div className="max-w-md w-full">
        {/* Brand Card Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 mb-3">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sri Lanka POS SaaS</h1>
          <p className="text-slate-400 text-xs mt-1">
            Commercial Multi-Tenant Retail Platform • Colombo (Asia/Colombo)
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">Sign In</h2>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure Session
            </span>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username or Login ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. superadmin, admin, or cashier"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password or Cashier PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Create New Store Action */}
          <div className="mt-4 pt-4 border-t border-slate-700/60 text-center">
            <span className="text-xs text-slate-400">Need a POS for your shop? </span>
            <Link
              href="/register"
              className="text-xs font-bold text-blue-400 hover:text-blue-300 transition inline-flex items-center gap-1"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Quick Demo Credentials Assistant */}
          <div className="mt-4 pt-4 border-t border-slate-700/60">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-2 text-center">
              Quick Test Accounts (Click to Auto-Fill)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillQuickCredentials("superadmin", "superadmin123")}
                className="p-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-left transition-colors"
              >
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
                  <Crown className="w-3 h-3" /> Super Admin
                </span>
                <span className="block text-[9px] text-amber-400/80 font-mono mt-0.5">superadmin</span>
              </button>

              <button
                type="button"
                onClick={() => fillQuickCredentials("admin", "admin123")}
                className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700 text-left transition-colors"
              >
                <span className="block text-[11px] font-semibold text-white">Client Owner</span>
                <span className="block text-[9px] text-slate-400 font-mono mt-0.5">admin</span>
              </button>

              <button
                type="button"
                onClick={() => fillQuickCredentials("cashier", "cashier123")}
                className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700 text-left transition-colors"
              >
                <span className="block text-[11px] font-semibold text-white">Cashier</span>
                <span className="block text-[9px] text-slate-400 font-mono mt-0.5">cashier</span>
              </button>
            </div>
          </div>
        </div>

        {/* Start Trial Banner */}
        <div className="mt-4 text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 text-xs font-bold transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Register New Store (14-Day Free Trial)</span>
          </Link>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Commercial Multi-Tenant SaaS Platform • LKR Currency
        </p>
      </div>
    </main>
  );
}
