"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function GrnScanDirectPoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/grn/scan?poId=${encodeURIComponent(id)}`);
    } else {
      router.replace("/grn/scan");
    }
  }, [id, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-400">
          Loading Purchase Order barcode checklist...
        </p>
      </div>
    </div>
  );
}
