"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import {
  ChefHat,
  Clock,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Printer,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RefreshCw,
  Plus,
  ArrowLeft,
  X,
  Utensils,
  Coffee,
  Flame as GrillIcon,
  Package,
  Layers,
  Sparkles,
} from "lucide-react";
import KitchenOrderTicket from "@/components/receipts/KitchenOrderTicket";
import {
  playNewOrderBell,
  playOverdueAlertSound,
  playTicketBumpSound,
} from "@/lib/kds/sound-bell";

interface KitchenItem {
  _id?: string;
  itemId?: string;
  name: string;
  nameSi?: string;
  nameTa?: string;
  quantity: number;
  unit?: string;
  notes?: string;
  station: string;
  status: "PENDING" | "PREPARING" | "COMPLETED" | "VOIDED";
}

interface KitchenTicketData {
  _id: string;
  ticketNumber: string;
  orderNumber: string;
  source: "POS_COUNTER" | "PICKME" | "UBER_EATS" | "DIRECT_DELIVERY" | "DINE_IN";
  tableOrCustomer: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  serverName?: string;
  station: string;
  priority: "NORMAL" | "RUSH" | "VIP";
  items: KitchenItem[];
  status: "NEW" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
  targetPrepMinutes: number;
  notes?: string;
  startedAt?: string;
  readyAt?: string;
  servedAt?: string;
  createdAt: string;
}

const STATIONS = [
  { id: "ALL", label: "All Stations", labelSi: "සියලු අංශ", icon: Layers },
  { id: "HOT_KITCHEN", label: "Hot Kitchen", labelSi: "උණුසුම් කුස්සිය", icon: Utensils },
  { id: "BAKERY_SHORT_EATS", label: "Bakery / Short Eats", labelSi: "කෙටි කෑම", icon: ChefHat },
  { id: "BEVERAGE_BAR", label: "Tea & Beverage Bar", labelSi: "බීම කවුන්ටරය", icon: Coffee },
  { id: "GRILL_HOPPERS", label: "Grill & Hoppers", labelSi: "ආප්ප / රොටී", icon: GrillIcon },
  { id: "PACKING", label: "Packing & Dispatch", labelSi: "ඇසුරුම්", icon: Package },
];

export default function KitchenDisplayPage() {
  const [tickets, setTickets] = useState<KitchenTicketData[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Ticket Preview & Recall State
  const [activePrintTicket, setActivePrintTicket] = useState<KitchenTicketData | null>(null);
  const [isRecallOpen, setIsRecallOpen] = useState(false);
  const [recallTickets, setRecallTickets] = useState<KitchenTicketData[]>([]);
  const [loadingRecall, setLoadingRecall] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Track known tickets to chime on new orders
  const knownTicketIdsRef = useRef<Set<string>>(new Set());
  const overdueChimedRef = useRef<Set<string>>(new Set());

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Tickets
  const fetchTickets = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const url = `/api/kds/tickets?station=${selectedStation}&status=ACTIVE`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const incoming: KitchenTicketData[] = data.tickets || [];

          // Detect new ticket arrivals for acoustic bell
          if (soundEnabled && knownTicketIdsRef.current.size > 0) {
            const hasNew = incoming.some(
              (t) => !knownTicketIdsRef.current.has(t._id) && t.status === "NEW"
            );
            if (hasNew) {
              playNewOrderBell();
            }
          }

          // Update tracked IDs
          const nextSet = new Set<string>();
          incoming.forEach((t) => nextSet.add(t._id));
          knownTicketIdsRef.current = nextSet;

          setTickets(incoming);
        }
      } catch (err) {
        console.error("Error loading KDS tickets:", err);
      } finally {
        setLoading(false);
        if (!silent) setRefreshing(false);
      }
    },
    [selectedStation, soundEnabled]
  );

  // Initial and Periodic Polling (every 6 seconds)
  useEffect(() => {
    fetchTickets(false);
    const interval = setInterval(() => fetchTickets(true), 6000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  // Check Overdue Tickets for acoustic warning
  useEffect(() => {
    if (!soundEnabled) return;
    const now = Date.now();
    tickets.forEach((t) => {
      const created = new Date(t.createdAt).getTime();
      const elapsedMins = (now - created) / 60000;
      const target = t.targetPrepMinutes || 15;
      if (elapsedMins > target && !overdueChimedRef.current.has(t._id)) {
        overdueChimedRef.current.add(t._id);
        playOverdueAlertSound();
      }
    });
  }, [tickets, soundEnabled]);

  // Load Recall History
  const loadRecallHistory = async () => {
    setLoadingRecall(true);
    setIsRecallOpen(true);
    try {
      const res = await fetch("/api/kds/tickets/history?limit=15");
      if (res.ok) {
        const data = await res.json();
        setRecallTickets(data.history || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRecall(false);
    }
  };

  // Bump Ticket (NEW -> PREPARING -> READY -> SERVED)
  const handleBumpTicket = async (ticketId: string) => {
    try {
      if (soundEnabled) playTicketBumpSound();
      const res = await fetch(`/api/kds/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "BUMP" }),
      });
      if (res.ok) {
        fetchTickets(true);
      }
    } catch (err) {
      console.error("Failed to bump ticket:", err);
    }
  };

  // Toggle Item Complete
  const handleToggleItem = async (ticketId: string, itemId?: string, itemIndex?: number) => {
    try {
      if (soundEnabled) playTicketBumpSound();
      const res = await fetch(`/api/kds/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TOGGLE_ITEM", itemId, itemIndex }),
      });
      if (res.ok) {
        fetchTickets(true);
      }
    } catch (err) {
      console.error("Failed to toggle item:", err);
    }
  };

  // Toggle Rush Priority
  const handleToggleRush = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/kds/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TOGGLE_RUSH" }),
      });
      if (res.ok) {
        fetchTickets(true);
      }
    } catch (err) {
      console.error("Failed to toggle rush:", err);
    }
  };

  // Recall / Un-bump Ticket
  const handleRecallTicket = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/kds/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RECALL" }),
      });
      if (res.ok) {
        setIsRecallOpen(false);
        setStatusMessage({ type: "success", text: "Ticket recalled back to active screen." });
        setTimeout(() => setStatusMessage(null), 3000);
        fetchTickets(true);
      }
    } catch (err) {
      console.error("Failed to recall ticket:", err);
    }
  };

  // Simulate Demo Kitchen Ticket
  const handleSimulateTicket = async () => {
    try {
      const randomDishes = [
        {
          name: "Egg Roti & Pol Sambol",
          nameSi: "බිත්තර රොටී සහ පොල් සම්බෝල",
          quantity: 2,
          unit: "pcs",
          notes: "Extra spicy katta sambol on side",
          station: "GRILL_HOPPERS",
        },
        {
          name: "Mutton Kothu Roti (Special)",
          nameSi: "එළු මස් කොත්තු",
          quantity: 1,
          unit: "portions",
          notes: "Spicy gravy separate packet",
          station: "GRILL_HOPPERS",
        },
        {
          name: "Iced Milo Dinosaur",
          nameSi: "අයිස් මයිලෝ ඩයිනෝසෝර්",
          quantity: 1,
          unit: "glasses",
          notes: "Heaped milo powder topping",
          station: "BEVERAGE_BAR",
        },
      ];

      const res = await fetch("/api/kds/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          source: "POS_COUNTER",
          tableOrCustomer: `Table ${Math.floor(1 + Math.random() * 8)}`,
          orderType: "DINE_IN",
          priority: Math.random() > 0.5 ? "RUSH" : "NORMAL",
          targetPrepMinutes: 15,
          notes: "Kitchen demo order",
          items: randomDishes,
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: "success", text: "New kitchen order ticket simulated!" });
        setTimeout(() => setStatusMessage(null), 3000);
        fetchTickets(true);
      }
    } catch (err) {
      console.error("Simulation error:", err);
    }
  };

  // Keyboard Bump-Bar Shortcuts: 1-9 to bump tickets, Space for oldest, R for recall
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      const key = e.key;

      if (key >= "1" && key <= "9") {
        const idx = parseInt(key, 10) - 1;
        if (tickets[idx]) {
          e.preventDefault();
          handleBumpTicket(tickets[idx]._id);
        }
      } else if (key === " " || key === "Enter") {
        // Bump oldest ticket
        if (tickets.length > 0) {
          e.preventDefault();
          handleBumpTicket(tickets[0]._id);
        }
      } else if (key === "r" || key === "R") {
        e.preventDefault();
        loadRecallHistory();
      } else if (key === "f" || key === "F") {
        toggleFullscreen();
      } else if (key === "Escape") {
        setIsRecallOpen(false);
        setActivePrintTicket(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tickets]);

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Compute elapsed time and status styling
  const getElapsedInfo = (createdAt: string, targetMinutes: number = 15) => {
    const elapsedMs = currentTime.getTime() - new Date(createdAt).getTime();
    const elapsedMins = Math.floor(elapsedMs / 60000);
    const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);

    const isUrgent = elapsedMins >= targetMinutes;
    const isWarning = elapsedMins >= Math.floor(targetMinutes * 0.65) && !isUrgent;

    let badgeClass = "bg-emerald-950/80 text-emerald-300 border-emerald-700/60";
    if (isUrgent) {
      badgeClass = "bg-red-950/90 text-red-300 border-red-500 animate-pulse";
    } else if (isWarning) {
      badgeClass = "bg-amber-950/80 text-amber-300 border-amber-600/70";
    }

    const formattedTime = `${elapsedMins.toString().padStart(2, "0")}:${elapsedSecs
      .toString()
      .padStart(2, "0")}`;

    return { elapsedMins, formattedTime, isUrgent, isWarning, badgeClass };
  };

  const overdueCount = tickets.filter((t) => {
    const elapsedMs = currentTime.getTime() - new Date(t.createdAt).getTime();
    return Math.floor(elapsedMs / 60000) >= (t.targetPrepMinutes || 15);
  }).length;

  return (
    <AppLayout>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
        {/* Top KDS Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Return to POS Counter"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Kitchen Display System
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-widest hidden sm:inline">
                    KDS Live
                  </span>
                </h1>
                <p className="text-xs text-zinc-400">
                  Touchscreen bump bar & multi-station order routing
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Hardware Bar */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Live Clock */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-sm font-bold text-amber-400 shadow-2xs">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>{currentTime.toLocaleTimeString()}</span>
            </div>

            {/* Active Tickets Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{tickets.length} Active</span>
            </div>

            {/* Overdue Alert Badge */}
            {overdueCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-600 text-red-300 text-xs font-black animate-pulse">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>{overdueCount} Delayed</span>
              </div>
            )}

            {/* Audio Bell Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition ${
                soundEnabled
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                  : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"
              }`}
              title={soundEnabled ? "Audio Bell Active (Click to Mute)" : "Muted (Click to Enable Bell)"}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            {/* Recall Drawer Button */}
            <button
              type="button"
              onClick={loadRecallHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition"
              title="Recall recently completed tickets (Press R)"
            >
              <RotateCcw className="w-4 h-4 text-zinc-400" />
              <span className="hidden md:inline">Recall</span>
              <kbd className="hidden lg:inline text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">R</kbd>
            </button>

            {/* Simulate Ticket */}
            <button
              type="button"
              onClick={handleSimulateTicket}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700 text-xs font-bold text-emerald-300 transition shadow-2xs"
              title="Simulate kitchen ticket for training"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Simulate Order</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition"
              title="Toggle Fullscreen (F11 or F)"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => fetchTickets(false)}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
            </button>
          </div>
        </header>

        {/* Station Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto py-3 border-b border-zinc-800/80 no-scrollbar">
          {STATIONS.map((st) => {
            const Icon = st.icon;
            const isSelected = selectedStation === st.id;
            const stationCount =
              st.id === "ALL"
                ? tickets.length
                : tickets.filter((t) => t.station === st.id || t.items.some((it) => it.station === st.id)).length;

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStation(st.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                  isSelected
                    ? "bg-amber-500 text-zinc-950 border-amber-400 shadow-lg shadow-amber-500/10 font-extrabold"
                    : "bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700"
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? "text-zinc-950" : "text-amber-400"}`} />
                <span>{st.label}</span>
                <span className="text-[10px] opacity-75 hidden xl:inline">({st.labelSi})</span>
                {stationCount > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isSelected
                        ? "bg-zinc-950 text-amber-400"
                        : "bg-zinc-800 text-zinc-200 border border-zinc-700"
                    }`}
                  >
                    {stationCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Status Notification Toast */}
        {statusMessage && (
          <div className="fixed top-6 right-6 z-50 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-zinc-950 shadow-2xl flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Main Kitchen Orders Grid */}
        <main className="flex-1 py-4 overflow-y-auto">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-500 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm font-semibold">Connecting to kitchen order queue...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
              <div className="w-16 h-16 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500 mb-4">
                <ChefHat className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">All Clear! No Active Kitchen Orders</h3>
              <p className="text-sm text-zinc-400 max-w-md mt-1 mb-5">
                New orders placed at the POS counter or through PickMe & Uber Eats Sri Lanka will
                instantly appear here with acoustic chime alerts.
              </p>
              <button
                type="button"
                onClick={handleSimulateTicket}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                <span>Simulate Demo Ticket</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {tickets.map((ticket, index) => {
                const { formattedTime, isUrgent, badgeClass } = getElapsedInfo(
                  ticket.createdAt,
                  ticket.targetPrepMinutes
                );

                const isPreparing = ticket.status === "PREPARING";
                const isReady = ticket.status === "READY";
                const isNew = ticket.status === "NEW";

                // Source badge color
                let sourceBadge = "bg-zinc-800 text-zinc-300 border-zinc-700";
                if (ticket.source === "DINE_IN") sourceBadge = "bg-indigo-950/80 text-indigo-300 border-indigo-700";
                if (ticket.source === "PICKME") sourceBadge = "bg-amber-950/80 text-amber-300 border-amber-600";
                if (ticket.source === "UBER_EATS") sourceBadge = "bg-emerald-950/80 text-emerald-300 border-emerald-600";
                if (ticket.source === "DIRECT_DELIVERY") sourceBadge = "bg-sky-950/80 text-sky-300 border-sky-700";

                return (
                  <div
                    key={ticket._id}
                    className={`relative rounded-2xl border flex flex-col justify-between overflow-hidden shadow-xl transition-all duration-200 ${
                      ticket.priority === "RUSH"
                        ? "border-red-500 bg-zinc-900 shadow-red-500/10 ring-2 ring-red-500/30"
                        : isUrgent
                        ? "border-red-500/80 bg-zinc-900"
                        : isReady
                        ? "border-emerald-500/80 bg-zinc-900/90 shadow-emerald-500/10"
                        : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-700"
                    }`}
                  >
                    {/* Card Top Banner: Bump Index, Ticket #, Source & Timer */}
                    <div className="p-3.5 border-b border-zinc-800 bg-zinc-850/60">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {/* Keyboard Bump Number Tag */}
                          <span
                            className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 text-amber-400 font-mono font-black text-xs flex items-center justify-center shadow-xs"
                            title={`Press key '${index + 1}' on keyboard to bump`}
                          >
                            {index + 1}
                          </span>

                          <span className="font-mono font-black text-base text-white tracking-wide">
                            {ticket.ticketNumber}
                          </span>

                          {/* Rush Flame Badge */}
                          <button
                            type="button"
                            onClick={() => handleToggleRush(ticket._id)}
                            className={`p-1 rounded-lg border transition ${
                              ticket.priority === "RUSH"
                                ? "bg-red-500 text-white border-red-400 animate-pulse"
                                : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-amber-400"
                            }`}
                            title="Toggle Rush Order Priority"
                          >
                            <Flame className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Live Stopwatch Timer */}
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-xs font-bold ${badgeClass}`}
                          title={`Target prep: ${ticket.targetPrepMinutes || 15} mins`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formattedTime}</span>
                        </div>
                      </div>

                      {/* Second Row: Table/Customer, Order Ref, Type */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="font-extrabold text-white truncate max-w-[170px]" title={ticket.tableOrCustomer}>
                          {ticket.tableOrCustomer}
                        </div>

                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${sourceBadge}`}>
                          {ticket.source.replace("_", " ")}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
                        <span className="font-mono">{ticket.orderNumber}</span>
                        <span>{ticket.serverName || "Staff"}</span>
                      </div>
                    </div>

                    {/* Middle: Interactive Food Items Checklist */}
                    <div className="p-3.5 flex-1 space-y-2.5 overflow-y-auto max-h-[320px]">
                      {ticket.items.map((item, itIdx) => {
                        const isItemDone = item.status === "COMPLETED";

                        return (
                          <div
                            key={itIdx}
                            onClick={() => handleToggleItem(ticket._id, item._id, itIdx)}
                            className={`p-2.5 rounded-xl border cursor-pointer select-none transition ${
                              isItemDone
                                ? "bg-zinc-950/60 border-zinc-800/80 text-zinc-500 line-through opacity-60"
                                : "bg-zinc-800/60 border-zinc-700/60 text-white hover:bg-zinc-800 hover:border-amber-500/50"
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Quantity Tag */}
                              <span
                                className={`min-w-[28px] text-center px-1.5 py-0.5 rounded-md font-mono font-black text-xs ${
                                  isItemDone
                                    ? "bg-zinc-800 text-zinc-500"
                                    : "bg-amber-500 text-zinc-950"
                                }`}
                              >
                                {item.quantity}x
                              </span>

                              <div className="flex-1">
                                <div className="font-extrabold text-xs leading-tight">
                                  {item.name}
                                </div>
                                {item.nameSi && (
                                  <div className="text-[11px] text-zinc-400 font-medium mt-0.5">
                                    {item.nameSi}
                                  </div>
                                )}

                                {/* Special Prep Notes */}
                                {item.notes && (
                                  <div className="mt-1.5 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-600/70">
                                    Note: {item.notes}
                                  </div>
                                )}
                              </div>

                              {/* Done Checkmark */}
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                                  isItemDone
                                    ? "bg-emerald-600 border-emerald-500 text-white"
                                    : "border-zinc-600 text-transparent hover:border-amber-400"
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* General Ticket Note */}
                      {ticket.notes && (
                        <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-zinc-300">
                          <span className="text-amber-400 font-bold">Ticket Note:</span> {ticket.notes}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="p-3 border-t border-zinc-800 bg-zinc-850/80 flex items-center gap-2">
                      {/* Print KOT */}
                      <button
                        type="button"
                        onClick={() => setActivePrintTicket(ticket)}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition"
                        title="Print Kitchen Order Ticket (KOT)"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {/* Stage Action Bump Button */}
                      {isNew && (
                        <button
                          type="button"
                          onClick={() => handleBumpTicket(ticket._id)}
                          className="flex-1 py-2.5 px-3 rounded-xl font-black text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md transition flex items-center justify-center gap-1.5"
                        >
                          <Utensils className="w-4 h-4" />
                          <span>Start Cooking</span>
                        </button>
                      )}

                      {isPreparing && (
                        <button
                          type="button"
                          onClick={() => handleBumpTicket(ticket._id)}
                          className="flex-1 py-2.5 px-3 rounded-xl font-black text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-md transition flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Mark Ready</span>
                        </button>
                      )}

                      {isReady && (
                        <button
                          type="button"
                          onClick={() => handleBumpTicket(ticket._id)}
                          className="flex-1 py-2.5 px-3 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition flex items-center justify-center gap-1.5 animate-pulse"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Serve & Clear</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Recall Drawer Modal */}
        {isRecallOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
            <div className="w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full flex flex-col p-5 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-400" />
                  <h3 className="font-black text-lg text-white">Recall Completed Tickets</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecallOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {loadingRecall ? (
                  <div className="h-40 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                  </div>
                ) : recallTickets.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-10">
                    No recently cleared tickets in this session.
                  </p>
                ) : (
                  recallTickets.map((t) => (
                    <div
                      key={t._id}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-white">
                            {t.ticketNumber}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 uppercase font-bold">
                            {t.status}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-300 font-semibold mt-0.5">
                          {t.tableOrCustomer} • {t.items?.length || 0} items
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          Cleared: {new Date(t.servedAt || t.createdAt).toLocaleTimeString()}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRecallTicket(t._id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition"
                      >
                        Un-Bump
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Thermal KOT Slip Modal */}
        {activePrintTicket && (
          <KitchenOrderTicket
            ticket={activePrintTicket}
            businessName="Corner Store & Restaurant"
            stationName={selectedStation}
            onClose={() => setActivePrintTicket(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
