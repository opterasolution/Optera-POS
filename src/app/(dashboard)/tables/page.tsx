"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import {
  UtensilsCrossed,
  Users,
  Clock,
  Plus,
  RefreshCw,
  ArrowLeft,
  X,
  CreditCard,
  Banknote,
  Printer,
  ChevronRight,
  MoveRight,
  Sparkles,
  Calendar,
  Layers,
  ChefHat,
  Share2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Percent,
} from "lucide-react";
import RestaurantDiningBill from "@/components/receipts/RestaurantDiningBill";
import { formatCurrency } from "@/lib/formatters";

interface TableItem {
  _id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  course: "STARTER" | "MAIN" | "DESSERT" | "BEVERAGE";
  seatNumber: number;
  notes?: string;
  station?: string;
  sentToKds?: boolean;
}

interface TableOrder {
  orderNumber: string;
  customerCount: number;
  customerName?: string;
  serverName: string;
  openedAt: string;
  items: TableItem[];
  subtotal: number;
  serviceChargeRate: number;
  serviceChargeAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
}

interface TableData {
  _id: string;
  tableNumber: string;
  tableName?: string;
  section: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "BILL_REQUESTED" | "CLEANING" | "RESERVED";
  shape: "ROUND" | "SQUARE" | "RECTANGLE";
  position: { x: number; y: number };
  currentOrder?: TableOrder;
  reservation?: {
    customerName: string;
    phone: string;
    reservedTime: string;
    guestCount: number;
    notes?: string;
  };
}

const SECTIONS = [
  "ALL",
  "Main Dining Hall",
  "Outdoor Patio",
  "VIP Lounge",
];

export default function RestaurantTablesPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Selected Table Modals
  const [activeTable, setActiveTable] = useState<TableData | null>(null);
  const [isSeatModalOpen, setIsSeatModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isPrintBillOpen, setIsPrintBillOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);

  // Seating State
  const [coversCount, setCoversCount] = useState<number>(2);
  const [guestName, setGuestName] = useState<string>("");
  const [serverInput, setServerInput] = useState<string>("Staff");

  // New Item Adding State
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCourse, setNewItemCourse] = useState<"STARTER" | "MAIN" | "DESSERT" | "BEVERAGE">("MAIN");
  const [newItemSeat, setNewItemSeat] = useState<number>(1);
  const [newItemNotes, setNewItemNotes] = useState("");
  const [sendToKdsCheck, setSendToKdsCheck] = useState(true);

  // Split Bill State
  const [splitMode, setSplitMode] = useState<"EQUAL" | "BY_SEAT">("EQUAL");
  const [splitWays, setSplitWays] = useState<number>(2);
  const [splitData, setSplitData] = useState<any | null>(null);

  // Settlement State
  const [settleMethod, setSettleMethod] = useState<"CASH" | "CARD" | "QR">("CASH");
  const [settleCashGiven, setSettleCashGiven] = useState("");
  const [settling, setSettling] = useState(false);

  // Transfer Table State
  const [targetTableId, setTargetTableId] = useState("");

  // Load Tables
  const fetchTables = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const url = `/api/tables?section=${selectedSection}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
        // update activeTable if open
        if (activeTable) {
          const fresh = (data.tables || []).find((t: TableData) => t._id === activeTable._id);
          if (fresh) setActiveTable(fresh);
        }
      }
    } catch (err) {
      console.error("Failed to load tables:", err);
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, [selectedSection, activeTable]);

  useEffect(() => {
    fetchTables(false);
    const interval = setInterval(() => fetchTables(true), 10000);
    return () => clearInterval(interval);
  }, [selectedSection]);

  // Show status banner
  const notify = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Seat Guests Action
  const handleSeatGuests = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTable) return;
    try {
      const res = await fetch(`/api/tables/${activeTable._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "OCCUPY",
          customerCount: coversCount,
          customerName: guestName,
          serverName: serverInput,
        }),
      });
      if (res.ok) {
        notify("success", `Guests seated at ${activeTable.tableNumber}`);
        setIsSeatModalOpen(false);
        fetchTables(true);
      }
    } catch {
      notify("error", "Failed to seat guests");
    }
  };

  // Add Item to Table
  const handleAddItemToTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTable || !newItemName.trim() || !newItemPrice) return;
    try {
      const res = await fetch(`/api/tables/${activeTable._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_ITEMS",
          sendToKds: sendToKdsCheck,
          items: [
            {
              name: newItemName.trim(),
              quantity: Number(newItemQty) || 1,
              unitPrice: Number(newItemPrice) || 0,
              course: newItemCourse,
              seatNumber: Number(newItemSeat) || 1,
              notes: newItemNotes.trim() || undefined,
            },
          ],
        }),
      });
      if (res.ok) {
        notify("success", `Added ${newItemName} to ${activeTable.tableNumber}`);
        setNewItemName("");
        setNewItemPrice("");
        setNewItemNotes("");
        setNewItemQty(1);
        fetchTables(true);
      }
    } catch {
      notify("error", "Failed to add item to table");
    }
  };

  // Request Bill Action
  const handleRequestBill = async (tableId: string) => {
    try {
      const res = await fetch(`/api/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REQUEST_BILL" }),
      });
      if (res.ok) {
        notify("success", "Bill requested for table");
        fetchTables(true);
      }
    } catch {
      notify("error", "Failed to request bill");
    }
  };

  // Clean Table Action
  const handleCleanTable = async (tableId: string) => {
    try {
      const res = await fetch(`/api/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLEAN_TABLE" }),
      });
      if (res.ok) {
        notify("success", "Table reset to Available");
        if (activeTable?._id === tableId) setActiveTable(null);
        fetchTables(true);
      }
    } catch {
      notify("error", "Failed to clean table");
    }
  };

  // Calculate Split Bill
  const handleCalculateSplit = async (mode: "EQUAL" | "BY_SEAT", waysNum = 2) => {
    if (!activeTable) return;
    try {
      const res = await fetch(`/api/tables/${activeTable._id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ways: waysNum }),
      });
      if (res.ok) {
        const data = await res.json();
        setSplitData(data);
      }
    } catch {
      notify("error", "Failed to calculate split bill");
    }
  };

  // Settle Table Bill
  const handleSettleTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTable) return;
    setSettling(true);
    try {
      const res = await fetch(`/api/tables/${activeTable._id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: settleMethod,
          cashReceived: settleCashGiven ? Number(settleCashGiven) : undefined,
          resetToStatus: "CLEANING",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        notify("success", `Table ${activeTable.tableNumber} settled (${data.invoiceNumber})`);
        setIsSettleModalOpen(false);
        setActiveTable(null);
        fetchTables(true);
      } else {
        const err = await res.json();
        notify("error", err.error || "Failed to settle bill");
      }
    } catch {
      notify("error", "Network error during settlement");
    } finally {
      setSettling(false);
    }
  };

  // Transfer Table
  const handleTransferTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTable || !targetTableId) return;
    try {
      const res = await fetch(`/api/tables/${activeTable._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MOVE_TABLE",
          targetTableId,
        }),
      });
      if (res.ok) {
        notify("success", `Table moved successfully!`);
        setIsTransferModalOpen(false);
        setActiveTable(null);
        fetchTables(true);
      } else {
        const err = await res.json();
        notify("error", err.error || "Failed to transfer table");
      }
    } catch {
      notify("error", "Error moving table");
    }
  };

  // Occupancy metrics
  const availableCount = tables.filter((t) => t.status === "AVAILABLE").length;
  const occupiedCount = tables.filter((t) => t.status === "OCCUPIED").length;
  const billCount = tables.filter((t) => t.status === "BILL_REQUESTED").length;
  const cleaningCount = tables.filter((t) => t.status === "CLEANING").length;
  const reservedCount = tables.filter((t) => t.status === "RESERVED").length;
  const totalCovers = tables.reduce(
    (sum, t) => sum + (t.currentOrder?.customerCount || 0),
    0
  );

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 shadow-2xs"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Dining Room & Table Manager
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Restaurant POS
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Live floor plan, seat-by-seat split billing & 10% service charge engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Links */}
            <Link
              href="/kds"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 shadow-2xs"
            >
              <ChefHat className="w-4 h-4 text-amber-600" />
              <span>Kitchen Display (KDS)</span>
            </Link>

            <button
              type="button"
              onClick={() => fetchTables(false)}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs"
              title="Refresh Floor Plan"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-black">
              {availableCount}
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Vacant</div>
              <div className="text-sm font-bold text-slate-800">Available</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-black">
              {occupiedCount}
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Dining</div>
              <div className="text-sm font-bold text-slate-800">Occupied</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-black">
              {billCount}
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Bill Req.</div>
              <div className="text-sm font-bold text-slate-800">Waiting Pay</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-black">
              {cleaningCount}
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Bussing</div>
              <div className="text-sm font-bold text-slate-800">Cleaning</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center font-black">
              {reservedCount}
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Booked</div>
              <div className="text-sm font-bold text-slate-800">Reserved</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-black">
              {totalCovers}
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Guests</div>
              <div className="text-sm font-bold text-slate-800">Total Covers</div>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
          {SECTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setSelectedSection(sec)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
                selectedSection === sec
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {sec === "ALL" ? "All Dining Areas" : sec}
            </button>
          ))}
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 animate-bounce ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tables Floor Plan Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map((tbl) => {
            const isAvail = tbl.status === "AVAILABLE";
            const isOcc = tbl.status === "OCCUPIED";
            const isBill = tbl.status === "BILL_REQUESTED";
            const isClean = tbl.status === "CLEANING";
            const isRes = tbl.status === "RESERVED";

            let cardBorder = "border-emerald-300 bg-white hover:border-emerald-400";
            let statusPill = "bg-emerald-50 text-emerald-700 border-emerald-200";

            if (isOcc) {
              cardBorder = "border-rose-400 bg-rose-50/20 hover:border-rose-500 shadow-rose-500/5 ring-1 ring-rose-200";
              statusPill = "bg-rose-100 text-rose-800 border-rose-300";
            } else if (isBill) {
              cardBorder = "border-amber-400 bg-amber-50/30 hover:border-amber-500 ring-2 ring-amber-300 animate-pulse";
              statusPill = "bg-amber-100 text-amber-900 border-amber-300";
            } else if (isClean) {
              cardBorder = "border-indigo-300 bg-indigo-50/20 hover:border-indigo-400";
              statusPill = "bg-indigo-50 text-indigo-700 border-indigo-200";
            } else if (isRes) {
              cardBorder = "border-purple-300 bg-purple-50/20 hover:border-purple-400";
              statusPill = "bg-purple-100 text-purple-800 border-purple-200";
            }

            return (
              <div
                key={tbl._id}
                onClick={() => {
                  setActiveTable(tbl);
                  if (isAvail) setIsSeatModalOpen(true);
                  else if (isOcc || isBill) setIsOrderModalOpen(true);
                }}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between select-none ${cardBorder}`}
              >
                <div>
                  {/* Top Bar: Table Number, Shape & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-slate-900 font-mono">
                        {tbl.tableNumber}
                      </span>
                      {tbl.tableName && (
                        <span className="text-xs text-slate-500 truncate max-w-[120px]">
                          ({tbl.tableName})
                        </span>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase border ${statusPill}`}>
                      {tbl.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Section & Capacity */}
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{tbl.section}</span>
                    <span className="flex items-center gap-1 font-semibold text-slate-600">
                      <Users className="w-3.5 h-3.5" />
                      {tbl.capacity} Seats
                    </span>
                  </div>

                  {/* Middle Content Depending on State */}
                  {isOcc || isBill ? (
                    <div className="mt-3 p-2.5 rounded-xl bg-white border border-slate-200 space-y-1 text-xs">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{tbl.currentOrder?.customerCount || 1} Guests • {tbl.currentOrder?.serverName}</span>
                        <span>{tbl.currentOrder?.items?.length || 0} items</span>
                      </div>

                      <div className="flex justify-between items-baseline pt-1 border-t border-slate-100 font-mono">
                        <span className="text-slate-500 text-[11px]">Total (incl. 10% svc):</span>
                        <span className="font-black text-sm text-slate-900">
                          {formatCurrency(tbl.currentOrder?.grandTotal || 0)}
                        </span>
                      </div>
                    </div>
                  ) : isRes ? (
                    <div className="mt-3 p-2.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs text-purple-900 space-y-0.5">
                      <div className="font-bold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-purple-700" />
                        <span>Reserved for {tbl.reservation?.customerName}</span>
                      </div>
                      <div className="text-[11px] text-purple-700">
                        {new Date(tbl.reservation?.reservedTime || Date.now()).toLocaleTimeString()} • {tbl.reservation?.guestCount} guests
                      </div>
                    </div>
                  ) : isClean ? (
                    <div className="mt-4 text-center py-2 text-xs font-bold text-indigo-700 bg-indigo-50 rounded-xl">
                      Waiting to be cleaned & sanitised
                    </div>
                  ) : (
                    <div className="mt-4 text-center py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-xl">
                      Vacant • Ready to seat guests
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  {isAvail && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTable(tbl);
                        setIsSeatModalOpen(true);
                      }}
                      className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-center transition"
                    >
                      Seat Guests
                    </button>
                  )}

                  {(isOcc || isBill) && (
                    <div className="w-full flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTable(tbl);
                          setIsOrderModalOpen(true);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold transition text-center"
                      >
                        Manage Bill
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestBill(tbl._id);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold transition"
                        title="Request & Print Bill"
                      >
                        Bill
                      </button>
                    </div>
                  )}

                  {isClean && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCleanTable(tbl._id);
                      }}
                      className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition text-center"
                    >
                      Mark Clean & Ready
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ================= MODAL: SEAT GUESTS ================= */}
        {isSeatModalOpen && activeTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-black text-slate-900 text-base">
                    Seat Guests: {activeTable.tableNumber}
                  </h3>
                </div>
                <button onClick={() => setIsSeatModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSeatGuests} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Number of Guests / Covers (Max: {activeTable.capacity})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={coversCount}
                    onChange={(e) => setCoversCount(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-base text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Customer / Party Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Perera Family / Walk-in"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Assigned Server / Attendant
                  </label>
                  <input
                    type="text"
                    value={serverInput}
                    onChange={(e) => setServerInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                    required
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSeatModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
                  >
                    Seat & Open Table
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: TABLE ORDER & DINE-IN BILL TERMINAL ================= */}
        {isOrderModalOpen && activeTable && activeTable.currentOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-black">
                    {activeTable.tableNumber}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {activeTable.tableName || `Table ${activeTable.tableNumber}`} • {activeTable.section}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Covers: {activeTable.currentOrder.customerCount} • Server: {activeTable.currentOrder.serverName} • Order: {activeTable.currentOrder.orderNumber}
                    </p>
                  </div>
                </div>

                <button onClick={() => setIsOrderModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-2">
                {activeTable.currentOrder.items.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No food or beverage items added to this table yet. Use the form below to add items.
                  </p>
                ) : (
                  activeTable.currentOrder.items.map((it, idx) => (
                    <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900">
                          {it.quantity}x {it.name}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 font-semibold uppercase">
                            {it.course}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold">
                            Seat {it.seatNumber}
                          </span>
                          {it.sentToKds && (
                            <span className="text-emerald-700 font-bold inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> In Kitchen
                            </span>
                          )}
                        </div>
                        {it.notes && (
                          <div className="text-[10px] text-amber-700 italic mt-0.5">
                            Note: {it.notes}
                          </div>
                        )}
                      </div>

                      <div className="font-bold font-mono text-slate-900">
                        {formatCurrency(it.lineTotal)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Financial Summary */}
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 space-y-1 text-xs shrink-0">
                <div className="flex justify-between text-slate-600">
                  <span>Food & Beverage Subtotal:</span>
                  <span className="font-mono">{formatCurrency(activeTable.currentOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-900">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3 text-amber-600" />
                    Sri Lanka Hospitality Service Charge ({activeTable.currentOrder.serviceChargeRate}%):
                  </span>
                  <span className="font-mono">{formatCurrency(activeTable.currentOrder.serviceChargeAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Payable:</span>
                  <span className="font-mono text-blue-700">
                    {formatCurrency(activeTable.currentOrder.grandTotal)}
                  </span>
                </div>
              </div>

              {/* Add New Item Form */}
              <form onSubmit={handleAddItemToTable} className="border border-slate-200 rounded-xl p-3 bg-white space-y-2 shrink-0 text-xs">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Add Dish / Drink to Table:</span>
                  <label className="flex items-center gap-1.5 font-semibold text-emerald-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendToKdsCheck}
                      onChange={(e) => setSendToKdsCheck(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Send KOT to Kitchen (KDS)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Dish / Drink Name"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Price (Rs.)"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(Number(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <select
                      value={newItemCourse}
                      onChange={(e) => setNewItemCourse(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="STARTER">Starter / App</option>
                      <option value="MAIN">Main Course</option>
                      <option value="DESSERT">Dessert</option>
                      <option value="BEVERAGE">Beverage / Bar</option>
                    </select>
                  </div>
                  <div>
                    <select
                      value={newItemSeat}
                      onChange={(e) => setNewItemSeat(Number(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                    >
                      {Array.from({ length: activeTable.capacity || 4 }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          Seat {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Prep notes (e.g. less spicy)"
                      value={newItemNotes}
                      onChange={(e) => setNewItemNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition"
                >
                  + Add Item to Order
                </button>
              </form>

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSplitModalOpen(true);
                      handleCalculateSplit(splitMode, splitWays);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition"
                  >
                    <Share2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>Split Bill</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition"
                  >
                    <MoveRight className="w-3.5 h-3.5 text-slate-600" />
                    <span>Move Table</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPrintBillOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-600" />
                    <span>Print Bill</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition"
                >
                  <Banknote className="w-4 h-4" />
                  <span>Settle & Pay ({formatCurrency(activeTable.currentOrder.grandTotal)})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: SPLIT BILL ================= */}
        {isSplitModalOpen && activeTable && activeTable.currentOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-purple-600" />
                  <h3 className="font-black text-slate-900 text-base">
                    Split Bill: Table {activeTable.tableNumber}
                  </h3>
                </div>
                <button onClick={() => setIsSplitModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Selector */}
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setSplitMode("EQUAL");
                    handleCalculateSplit("EQUAL", splitWays);
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    splitMode === "EQUAL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Split Equally (N-ways)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSplitMode("BY_SEAT");
                    handleCalculateSplit("BY_SEAT");
                  }}
                  className={`flex-1 py-1.5 rounded-lg transition ${
                    splitMode === "BY_SEAT" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Split by Seat Number
                </button>
              </div>

              {/* Equal split controls */}
              {splitMode === "EQUAL" && (
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold">
                  <span>Number of Guests:</span>
                  <div className="flex items-center gap-2">
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setSplitWays(num);
                          handleCalculateSplit("EQUAL", num);
                        }}
                        className={`w-8 h-8 rounded-lg font-mono font-bold transition ${
                          splitWays === num
                            ? "bg-purple-600 text-white shadow-sm"
                            : "bg-white text-slate-700 border border-slate-200"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Split Breakdown Result */}
              {splitData && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {splitData.splits?.map((s: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-extrabold text-slate-900">{s.title}</div>
                        {s.items && (
                          <div className="text-[10px] text-slate-500">
                            {s.items.map((it: any) => `${it.quantity}x ${it.name}`).join(", ")}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 font-mono">
                          Food: {formatCurrency(s.subtotal)} + 10% Svc: {formatCurrency(s.serviceCharge)}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-sm text-purple-700 font-mono block">
                          {formatCurrency(s.grandTotal)}
                        </span>
                        <span className="text-[10px] text-slate-400">Share Due</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsSplitModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: MOVE / TRANSFER TABLE ================= */}
        {isTransferModalOpen && activeTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <MoveRight className="w-5 h-5 text-slate-700" />
                  <h3 className="font-black text-slate-900 text-base">
                    Transfer: Table {activeTable.tableNumber}
                  </h3>
                </div>
                <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTransferTable} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Select Target Vacant Table:
                  </label>
                  <select
                    value={targetTableId}
                    onChange={(e) => setTargetTableId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    required
                  >
                    <option value="">-- Choose Vacant Table --</option>
                    {tables
                      .filter((t) => t._id !== activeTable._id && t.status === "AVAILABLE")
                      .map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.tableNumber} ({t.section} • {t.capacity} seats)
                        </option>
                      ))}
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold"
                  >
                    Confirm Move
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: SETTLE BILL ================= */}
        {isSettleModalOpen && activeTable && activeTable.currentOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-black text-slate-900 text-base">
                    Settle Table {activeTable.tableNumber}
                  </h3>
                </div>
                <button onClick={() => setIsSettleModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-center">
                <div className="text-xs text-blue-700 font-bold">Total Amount Due (incl. 10% Svc)</div>
                <div className="text-2xl font-black text-blue-950 font-mono mt-0.5">
                  {formatCurrency(activeTable.currentOrder.grandTotal)}
                </div>
              </div>

              <form onSubmit={handleSettleTable} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["CASH", "CARD", "QR"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSettleMethod(m)}
                        className={`py-2 rounded-xl font-bold border transition ${
                          settleMethod === m
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {settleMethod === "CASH" && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Cash Tendered (Rs.)</label>
                    <input
                      type="number"
                      placeholder={activeTable.currentOrder.grandTotal.toString()}
                      value={settleCashGiven}
                      onChange={(e) => setSettleCashGiven(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-base"
                    />
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSettleModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={settling}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition disabled:opacity-50"
                  >
                    {settling ? "Settling..." : "Complete Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= PRINT DINING BILL MODAL ================= */}
        {isPrintBillOpen && activeTable && activeTable.currentOrder && (
          <RestaurantDiningBill
            tableNumber={activeTable.tableNumber}
            tableName={activeTable.tableName}
            section={activeTable.section}
            serverName={activeTable.currentOrder.serverName}
            customerCount={activeTable.currentOrder.customerCount}
            orderNumber={activeTable.currentOrder.orderNumber}
            openedAt={activeTable.currentOrder.openedAt}
            items={activeTable.currentOrder.items}
            subtotal={activeTable.currentOrder.subtotal}
            serviceChargeRate={activeTable.currentOrder.serviceChargeRate}
            serviceChargeAmount={activeTable.currentOrder.serviceChargeAmount}
            taxRate={activeTable.currentOrder.taxRate}
            taxAmount={activeTable.currentOrder.taxAmount}
            grandTotal={activeTable.currentOrder.grandTotal}
            splits={splitData?.splits}
            onClose={() => setIsPrintBillOpen(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}
