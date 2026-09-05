"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Receipt,
  Search,
  Calendar,
  CreditCard,
  Printer,
  X,
  Clock,
  User,
  ArrowRight,
  TrendingUp,
  FileText,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";

interface SaleRecord {
  _id: string;
  invoiceNumber: string;
  cashierName: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    unitPrice: number;
    quantity: number;
    total: number;
  }>;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  netTotal: number;
  paymentMethod: string;
  cashReceived?: number;
  changeGiven?: number;
  paymentReference?: string;
  createdAt: string;
}

export default function SalesPage() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalBills: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  // Receipt Modal State
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);

  const loadSales = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/sales?q=${encodeURIComponent(searchQuery)}&paymentMethod=${paymentMethod}&dateRange=${dateRange}`
      );
      const data = await res.json();
      if (data.success) {
        setSales(data.sales || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch {
      console.error("Failed to load sales.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [searchQuery, paymentMethod, dateRange]);

  const triggerPrint = () => {
    window.print();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-6 h-6 text-blue-600" /> Sales & Invoices
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Search past customer bills, reprint thermal receipts, and inspect transaction details in LKR.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-right">
              <span className="text-[10px] text-blue-600 font-semibold block">Filtered Revenue</span>
              <span className="text-lg font-black text-blue-950 font-mono">
                {formatCurrency(summary.totalRevenue)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-right">
              <span className="text-[10px] text-slate-500 font-semibold block">Total Bills</span>
              <span className="text-lg font-black text-slate-900 font-mono">
                {summary.totalBills}
              </span>
            </div>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, customer or phone..."
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto text-xs">
            {/* Date Filter Dropdown */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
            >
              <option value="all">All Dates</option>
              <option value="today">Today (Colombo Time)</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Past 7 Days</option>
              <option value="month">This Month</option>
            </select>

            {/* Payment Method Filter */}
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
            >
              <option value="all">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="QR">LankaQR</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Cashier</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Items</th>
                  <th className="py-3 px-4 text-right">Grand Total (Rs.)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Loading sales invoices...
                    </td>
                  </tr>
                ) : sales.length > 0 ? (
                  sales.map((sale) => (
                    <tr key={sale._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {sale.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {formatSLDateTime(sale.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{sale.cashierName}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{sale.customerName}</div>
                        {sale.customerPhone && (
                          <div className="text-[10px] font-mono text-slate-400">
                            {sale.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            sale.paymentMethod === "CASH"
                              ? "bg-emerald-100 text-emerald-800"
                              : sale.paymentMethod === "CARD"
                              ? "bg-blue-100 text-blue-800"
                              : sale.paymentMethod === "QR"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {sale.items?.length || 1}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                        {formatCurrency(sale.netTotal)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-semibold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No sales records match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: View & Reprint Thermal Receipt */}
        {selectedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" /> Invoice #{selectedSale.invoiceNumber}
                </h3>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Thermal Receipt Preview Area */}
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl font-mono text-[11px] text-slate-800 space-y-2 shadow-inner">
                <div className="text-center font-bold text-xs uppercase">REPRINT RECEIPT</div>
                <div className="text-center text-[10px] text-slate-500">
                  {formatSLDateTime(selectedSale.createdAt)}
                </div>

                <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>Invoice: {selectedSale.invoiceNumber}</span>
                    <span>Method: {selectedSale.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier: {selectedSale.cashierName}</span>
                    <span>Customer: {selectedSale.customerName}</span>
                  </div>
                </div>

                <div className="border-t border-slate-300 pt-1.5 space-y-1">
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between font-semibold">
                        <span className="truncate pr-2">{item.name}</span>
                        <span>{formatCurrency(item.total)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pl-2">
                        <span>
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-right font-medium">
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedSale.subtotal)}</span>
                  </div>
                  {selectedSale.discountTotal > 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>Discount:</span>
                      <span>-{formatCurrency(selectedSale.discountTotal)}</span>
                    </div>
                  )}
                  {selectedSale.taxTotal > 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>Tax:</span>
                      <span>+{formatCurrency(selectedSale.taxTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(selectedSale.netTotal)}</span>
                  </div>
                  {selectedSale.paymentMethod === "CASH" && (
                    <>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>Cash Tendered:</span>
                        <span>{formatCurrency(selectedSale.cashReceived)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-emerald-700">
                        <span>Change Returned:</span>
                        <span>{formatCurrency(selectedSale.changeGiven)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={triggerPrint}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Thermal Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
