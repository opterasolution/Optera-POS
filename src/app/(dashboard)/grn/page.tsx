"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GrnRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/purchases?tab=GRN");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">
          Loading Goods Received Notes (GRN) & Dock Inspection...
        </p>
      </div>
    </div>
  );
}
