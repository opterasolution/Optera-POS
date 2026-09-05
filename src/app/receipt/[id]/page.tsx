"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import ThermalReceipt from "@/components/receipts/ThermalReceipt";
import { Printer, ArrowLeft, RotateCw } from "lucide-react";

export default function ReceiptPrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const saleId = params?.id as string;
  const autoPrint = searchParams.get("autoprint") === "true";

  const [sale, setSale] = useState<any | null>(null);
  const [business, setBusiness] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [customWidth, setCustomWidth] = useState<"58mm" | "80mm">("58mm");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [saleRes, bizRes] = await Promise.all([
          fetch(`/api/sales/${saleId}`),
          fetch("/api/business"),
        ]);
        const saleJson = await saleRes.json();
        const bizJson = await bizRes.json();

        if (saleJson.success && saleJson.sale) {
          setSale(saleJson.sale);
        }
        if (bizJson.success && bizJson.business) {
          setBusiness(bizJson.business);
          if (bizJson.business.receiptSettings?.defaultWidth) {
            setCustomWidth(bizJson.business.receiptSettings.defaultWidth);
          }
        }
      } catch (err) {
        console.error("Failed to load receipt:", err);
      } finally {
        setLoading(false);
      }
    }

    if (saleId) {
      loadData();
    }
  }, [saleId]);

  // Handle auto-print after data load
  useEffect(() => {
    if (!loading && sale && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, sale, autoPrint]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-500 font-mono text-xs">
        Preparing thermal receipt...
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center space-y-4">
        <p className="text-sm font-semibold text-slate-700">Receipt could not be found.</p>
        <button
          onClick={() => router.push("/pos")}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold"
        >
          Return to POS
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 py-6 sm:py-10 print:bg-white print:py-0">
      {/* On-Screen Action Bar (Hidden during printing via .no-print) */}
      <div className="no-print max-w-sm mx-auto mb-6 px-4 flex items-center justify-between gap-3">
        <button
          onClick={() => router.push("/pos")}
          className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to POS</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Roll width toggle */}
          <button
            onClick={() => setCustomWidth(customWidth === "58mm" ? "80mm" : "58mm")}
            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-mono font-semibold shadow-sm transition-colors"
          >
            {customWidth}
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>

      {/* Printable Thermal Receipt Card */}
      <div className="bg-white rounded-2xl shadow-xl max-w-fit mx-auto border border-slate-300 print:border-none print:shadow-none print:rounded-none">
        <ThermalReceipt
          business={business || { name: "Sri Lanka POS" }}
          sale={sale}
          width={customWidth}
        />
      </div>
    </div>
  );
}
