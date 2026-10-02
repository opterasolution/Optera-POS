"use client";

import React, { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Bike,
  Clock,
  CheckCircle2,
  AlertCircle,
  Printer,
  Search,
  Plus,
  Volume2,
  VolumeX,
  Sparkles,
  MapPin,
  Phone,
  ShieldCheck,
  RefreshCw,
  X,
  ChevronRight,
  Filter,
  DollarSign,
  Layers,
  UtensilsCrossed,
  Truck,
  Car,
  Check,
  Calendar,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import DeliveryDispatchSlip, { DeliveryDispatchSlipData } from "@/components/receipts/DeliveryDispatchSlip";
import { playDeliveryOrderChime, startRepeatingDeliveryAlert, stopRepeatingDeliveryAlert } from "@/lib/delivery/sound-alert";

interface DeliveryOrder {
  _id: string;
  platform: "PICKME_FOOD" | "PICKME_FLASH" | "UBER_EATS" | "DIRECT_STORE";
  externalOrderId: string;
  status:
    | "PENDING_ACCEPT"
    | "ACCEPTED"
    | "PREPARING"
    | "READY_FOR_PICKUP"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED"
    | "REJECTED";
  customer: {
    name: string;
    phone: string;
    deliveryAddress: string;
    deliveryNotes?: string;
  };
  items: Array<{
    name: string;
    nameSinhala?: string;
    nameTamil?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    unit?: string;
    specialInstructions?: string;
  }>;
  financials: {
    subtotal: number;
    platformDiscount?: number;
    merchantDiscount?: number;
    platformCommissionPercent: number;
    platformCommissionAmount: number;
    estimatedNetPayout: number;
    deliveryFee?: number;
    totalBill: number;
    payoutStatus: string;
  };
  rider: {
    name?: string;
    phone?: string;
    vehicleNumber?: string;
    vehicleType?: "BIKE" | "THREE_WHEELER" | "CAR" | "VAN";
    pickupPin: string;
    arrivalEtaMinutes?: number;
    arrivedAtStore?: boolean;
    handoverConfirmedAt?: string;
  };
  prepTimeMinutes: number;
  scheduledPrepEnd?: string;
  acceptedAt?: string;
  readyAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  cancelReason?: string;
  createdAt: string;
}

export default function DeliveryHubPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "PENDING_ACCEPT" | "PREPARING" | "READY_FOR_PICKUP" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RECONCILIATION"
  >("PENDING_ACCEPT");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [businessName, setBusinessName] = useState("Corner Store POS");

  // Modals state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [pinModalOrder, setPinModalOrder] = useState<DeliveryOrder | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [slipModalOrder, setSlipModalOrder] = useState<DeliveryOrder | null>(null);
  const [reconciliationData, setReconciliationData] = useState<any | null>(null);

  // New Phone Order Form state
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [newCustNotes, setNewCustNotes] = useState("");
  const [newOrderItems, setNewOrderItems] = useState([
    { name: "Egg Kottu", quantity: 1, unitPrice: 850, specialInstructions: "" },
  ]);
  const [newPrepTime, setNewPrepTime] = useState(15);
  const [newDeliveryFee, setNewDeliveryFee] = useState(200);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Fetch orders
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/delivery/orders?status=ALL");
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);

        // Sound Alert for pending orders
        const hasPending = data.orders.some((o: DeliveryOrder) => o.status === "PENDING_ACCEPT");
        if (hasPending && soundEnabled) {
          startRepeatingDeliveryAlert(5000);
        } else {
          stopRepeatingDeliveryAlert();
        }
      }
    } catch (err) {
      console.error("Failed to load delivery orders:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch reconciliation
  const fetchReconciliation = async () => {
    try {
      const res = await fetch("/api/delivery/reconciliation");
      const data = await res.json();
      if (data.success) {
        setReconciliationData(data);
      }
    } catch (err) {
      console.error("Failed to load reconciliation:", err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchReconciliation();

    // Fetch store name
    fetch("/api/business")
      .then((r) => r.json())
      .then((d) => {
        if (d?.business?.name) setBusinessName(d.business.name);
      })
      .catch(() => {});

    // Polling every 12 seconds for incoming orders
    const timer = setInterval(() => {
      fetchOrders();
    }, 12000);

    return () => {
      clearInterval(timer);
      stopRepeatingDeliveryAlert();
    };
  }, [soundEnabled]);

  // Handle Order Status Update (Accept, Prep, Ready, Handover)
  const handleUpdateOrderStatus = async (
    orderId: string,
    action: string,
    prepTimeMinutes?: number,
    pin?: string
  ) => {
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          prepTimeMinutes,
          enteredPin: pin,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPinError(null);
        setPinModalOrder(null);
        setEnteredPin("");
        fetchOrders();
        fetchReconciliation();
      } else {
        if (action === "HANDOVER") {
          setPinError(data.error || "Invalid PIN. Handover denied.");
        } else {
          alert(data.error || "Action failed.");
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Simulate Incoming PickMe or Uber Eats Order
  const handleSimulateIncomingOrder = async (platform: "PICKME_FOOD" | "UBER_EATS" | "PICKME_FLASH") => {
    try {
      const mockId =
        platform === "PICKME_FOOD"
          ? `PM-${Math.floor(10000 + Math.random() * 90000)}`
          : platform === "PICKME_FLASH"
          ? `PMF-${Math.floor(1000 + Math.random() * 9000)}`
          : `UE-${Math.floor(10000 + Math.random() * 90000)}`;

      const endpoint = platform === "UBER_EATS" ? "/api/delivery/webhooks/uber-eats" : "/api/delivery/webhooks/pickme";

      const payload =
        platform === "UBER_EATS"
          ? {
              event_type: "orders.notification",
              order: {
                id: mockId,
                display_id: mockId,
                eater: { first_name: "Sandun", last_name: "Bandara", phone: "077 445 1199" },
                delivery_address: { formatted_address: "No. 18, Ward Place, Colombo 07", notes: "Call upon arrival" },
                cart: {
                  items: [
                    { title: "Nasi Goreng Special with Fried Egg", quantity: 1, price: { amount: 1650 } },
                    { title: "Lime Juice (Fresh Mint)", quantity: 2, price: { amount: 350 } },
                  ],
                },
                payment: { total: { amount: 2550 }, delivery_fee: { amount: 200 } },
                courier: { name: "Rushan Silva", phone: "071 992 0011", vehicle_number: "WP BHF-3312", pin: "5512" },
                prep_time_minutes: 15,
              },
            }
          : {
              event: "order.created",
              order: {
                order_id: mockId,
                type: platform === "PICKME_FLASH" ? "FLASH" : "FOOD",
                customer: {
                  name: "Tharindu Perera",
                  phone: "070 334 8811",
                  address: "No. 88, Kandy Road, Kiribathgoda",
                  notes: "Handle carefully. Ring gate bell.",
                },
                items: [
                  { name: "Crispy Chicken Submarine (Large)", quantity: 2, price: 1200 },
                  { name: "French Fries (Large Seasoned)", quantity: 1, price: 650 },
                ],
                total: 3300,
                delivery_fee: 250,
                rider: { name: "Chamara Dias", phone: "078 882 1100", vehicle: "WP QF-9912", pin: "8823" },
                prep_time: 15,
              },
            };

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      playDeliveryOrderChime();
      fetchOrders();
      fetchReconciliation();
      setActiveTab("PENDING_ACCEPT");
    } catch (err) {
      console.error("Simulation failed:", err);
    }
  };

  // Submit Direct Phone Order
  const handleCreateDirectOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone || !newCustAddress) {
      alert("Please fill in customer details.");
      return;
    }

    setSubmittingOrder(true);
    try {
      const res = await fetch("/api/delivery/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "DIRECT_STORE",
          customer: {
            name: newCustName,
            phone: newCustPhone,
            deliveryAddress: newCustAddress,
            deliveryNotes: newCustNotes,
          },
          items: newOrderItems,
          prepTimeMinutes: newPrepTime,
          deliveryFee: newDeliveryFee,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsNewOrderModalOpen(false);
        setNewCustName("");
        setNewCustPhone("");
        setNewCustAddress("");
        setNewCustNotes("");
        setNewOrderItems([{ name: "", quantity: 1, unitPrice: 0, specialInstructions: "" }]);
        fetchOrders();
        fetchReconciliation();
      } else {
        alert(data.error || "Failed to create direct order.");
      }
    } catch (err) {
      console.error("Failed to create order:", err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Counts by tab
  const pendingCount = orders.filter((o) => o.status === "PENDING_ACCEPT").length;
  const preparingCount = orders.filter((o) => o.status === "ACCEPTED" || o.status === "PREPARING").length;
  const readyCount = orders.filter((o) => o.status === "READY_FOR_PICKUP").length;
  const outCount = orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length;
  const deliveredCount = orders.filter((o) => o.status === "DELIVERED").length;

  // Filtered orders for active tab
  const tabFilteredOrders = orders.filter((o) => {
    let matchTab = false;
    if (activeTab === "PENDING_ACCEPT") matchTab = o.status === "PENDING_ACCEPT";
    else if (activeTab === "PREPARING") matchTab = o.status === "ACCEPTED" || o.status === "PREPARING";
    else if (activeTab === "READY_FOR_PICKUP") matchTab = o.status === "READY_FOR_PICKUP";
    else if (activeTab === "OUT_FOR_DELIVERY") matchTab = o.status === "OUT_FOR_DELIVERY";
    else if (activeTab === "DELIVERED") matchTab = o.status === "DELIVERED" || o.status === "CANCELLED" || o.status === "REJECTED";

    const matchPlatform = platformFilter === "ALL" || o.platform === platformFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      o.externalOrderId.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.includes(q) ||
      o.rider.vehicleNumber?.toLowerCase().includes(q);

    return matchTab && matchPlatform && matchSearch;
  });

  // Gross Totals
  const todayRevenue = orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED")
    .reduce((s, o) => s + o.financials.subtotal, 0);

  const todayCommissions = orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED")
    .reduce((s, o) => s + o.financials.platformCommissionAmount, 0);

  const todayNetPayout = orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "REJECTED")
    .reduce((s, o) => s + o.financials.estimatedNetPayout, 0);

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-emerald-900/20">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Delivery Dispatcher Hub</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  PickMe & Uber Eats Aggregator
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Unified live dispatch queue, KDS prep times, rider pickup PIN verification & commission tracking
              </p>
            </div>
          </div>

          {/* Quick Actions & Controls */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Audio Alert Toggle */}
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (!next) stopRepeatingDeliveryAlert();
              }}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                soundEnabled
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
              }`}
              title={soundEnabled ? "Delivery Sound Alerts Active" : "Sound Alerts Muted"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <span className="hidden sm:inline">{soundEnabled ? "Chime On" : "Muted"}</span>
            </button>

            {/* Test Simulation Button */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => handleSimulateIncomingOrder("PICKME_FOOD")}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-800 hover:bg-white hover:shadow-2xs transition"
                title="Simulate incoming PickMe Food order"
              >
                + PickMe
              </button>
              <button
                onClick={() => handleSimulateIncomingOrder("UBER_EATS")}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-900 hover:bg-white hover:shadow-2xs transition"
                title="Simulate incoming Uber Eats order"
              >
                + Uber Eats
              </button>
            </div>

            {/* Direct Delivery Phone Order */}
            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Direct Phone Order</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => {
                fetchOrders();
                fetchReconciliation();
              }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        {/* Financial KPI Summary Cards */}
        <div className="p-4 sm:p-6 pb-2 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Active Orders
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <span>{pendingCount + preparingCount + readyCount + outCount}</span>
              {pendingCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 animate-pulse">
                  {pendingCount} Needs Action
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">{deliveredCount} delivered today</span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Gross Delivery Sales
            </span>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">
              {formatCurrency(todayRevenue)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Total order value</span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">
              Platform Commissions
            </span>
            <div className="text-2xl font-black font-mono text-amber-600 mt-1">
              -{formatCurrency(todayCommissions)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">PickMe 22% / Uber Eats 25%</span>
          </div>

          <div className="bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-2xl shadow-2xs">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
              Est. Store Net Payout
            </span>
            <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
              {formatCurrency(todayNetPayout)}
            </div>
            <span className="text-[11px] text-emerald-600 mt-0.5 block">Net receivables due to merchant</span>
          </div>
        </div>

        {/* Filter & Dispatcher Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 bg-white sticky top-[73px] z-10">
          {/* Tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            <button
              onClick={() => setActiveTab("PENDING_ACCEPT")}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shrink-0 ${
                activeTab === "PENDING_ACCEPT"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>🚨 New Orders</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white text-rose-700">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("PREPARING")}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shrink-0 ${
                activeTab === "PREPARING"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>👨‍🍳 In Prep / Kitchen</span>
              {preparingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white text-amber-800">
                  {preparingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("READY_FOR_PICKUP")}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shrink-0 ${
                activeTab === "READY_FOR_PICKUP"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>📦 Ready for Pickup</span>
              {readyCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white text-teal-800">
                  {readyCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("OUT_FOR_DELIVERY")}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shrink-0 ${
                activeTab === "OUT_FOR_DELIVERY"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>🛵 Out for Delivery</span>
              {outCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white text-blue-800">
                  {outCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("DELIVERED")}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shrink-0 ${
                activeTab === "DELIVERED"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>✅ Delivered</span>
              <span className="text-[10px] opacity-80">{deliveredCount}</span>
            </button>

            <button
              onClick={() => setActiveTab("RECONCILIATION")}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shrink-0 ${
                activeTab === "RECONCILIATION"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>📊 Payout & Reconciliation</span>
            </button>
          </div>

          {/* Search & Platform Filter */}
          <div className="flex items-center gap-2 pb-2 md:pb-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search order ID, rider, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 w-44 sm:w-56"
              />
            </div>

            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Platforms</option>
              <option value="PICKME_FOOD">PickMe Food</option>
              <option value="PICKME_FLASH">PickMe Flash</option>
              <option value="UBER_EATS">Uber Eats</option>
              <option value="DIRECT_STORE">Direct Store</option>
            </select>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="p-4 sm:p-6 flex-1">
          {/* TAB 1 TO 5: ORDER CARDS BOARD */}
          {activeTab !== "RECONCILIATION" && (
            <div>
              {tabFilteredOrders.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <Bike className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-semibold text-sm text-slate-700">No orders in this stage</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Incoming orders from PickMe Food, PickMe Flash, Uber Eats, and direct orders will appear here
                    automatically.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleSimulateIncomingOrder("PICKME_FOOD")}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition"
                    >
                      Simulate PickMe Order
                    </button>
                    <button
                      onClick={() => handleSimulateIncomingOrder("UBER_EATS")}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                    >
                      Simulate Uber Eats Order
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {tabFilteredOrders.map((order) => {
                    const isPickMe = order.platform.startsWith("PICKME");
                    const isUber = order.platform === "UBER_EATS";
                    const isDirect = order.platform === "DIRECT_STORE";

                    return (
                      <div
                        key={order._id}
                        className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col justify-between transition hover:shadow-md ${
                          order.status === "PENDING_ACCEPT"
                            ? "border-rose-400 ring-2 ring-rose-200/50"
                            : order.status === "READY_FOR_PICKUP"
                            ? "border-teal-300 bg-teal-50/20"
                            : "border-slate-200"
                        }`}
                      >
                        {/* Top: Platform & Order ID */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                isPickMe
                                  ? "bg-emerald-600 text-white"
                                  : isUber
                                  ? "bg-black text-white"
                                  : "bg-blue-600 text-white"
                              }`}
                            >
                              {order.platform.replace("_", " ")}
                            </span>

                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{new Date(order.createdAt).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <h3 className="font-black text-lg text-slate-900 tracking-tight">
                              {order.externalOrderId}
                            </h3>
                            <span className="font-mono font-bold text-sm text-slate-800">
                              {formatCurrency(order.financials.subtotal)}
                            </span>
                          </div>

                          {/* Customer & Address */}
                          <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">{order.customer.name}</span>
                              <span className="text-[11px] text-slate-500 font-mono">{order.customer.phone}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                              {order.customer.deliveryAddress}
                            </p>
                            {order.customer.deliveryNotes && (
                              <p className="text-[10px] font-medium text-amber-800 bg-amber-50 p-1 rounded mt-1 border border-amber-200/60">
                                💬 {order.customer.deliveryNotes}
                              </p>
                            )}
                          </div>

                          {/* Rider Info & PIN Box */}
                          <div className="mt-2.5 flex items-center justify-between p-2 rounded-xl bg-slate-100/70 border border-slate-200 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-700 shadow-2xs">
                                {order.rider.vehicleType === "THREE_WHEELER" ? (
                                  <Car className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <Bike className="w-4 h-4 text-emerald-600" />
                                )}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-800 block text-[11px]">
                                  {order.rider.name || "Assigned Rider"}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {order.rider.vehicleNumber || "Partner en route"}
                                </span>
                              </div>
                            </div>

                            {/* Prominent Pickup PIN */}
                            <div className="text-right">
                              <span className="text-[9px] uppercase font-bold text-slate-500 block">Pickup PIN</span>
                              <span className="text-sm font-black font-mono tracking-widest text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                                {order.rider.pickupPin}
                              </span>
                            </div>
                          </div>

                          {/* Items List */}
                          <div className="mt-3 divide-y divide-slate-100 text-xs">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="py-1.5 flex items-start justify-between">
                                <div className="pr-2">
                                  <span className="font-semibold text-slate-800">
                                    {item.quantity}x {item.name}
                                  </span>
                                  {item.specialInstructions && (
                                    <div className="text-[10px] text-rose-600 font-medium">
                                      ⚠️ {item.specialInstructions}
                                    </div>
                                  )}
                                </div>
                                <span className="font-mono text-slate-600 shrink-0">
                                  {formatCurrency(item.lineTotal)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Bottom Actions based on status */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                          {/* If PENDING_ACCEPT */}
                          {order.status === "PENDING_ACCEPT" && (
                            <div>
                              <span className="text-[11px] font-bold text-rose-600 block mb-1.5 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> New Order Waiting for Kitchen Acceptance
                              </span>
                              <div className="grid grid-cols-3 gap-1.5">
                                <button
                                  onClick={() => handleUpdateOrderStatus(order._id, "ACCEPT", 15)}
                                  className="py-2 px-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                                >
                                  Accept (15m)
                                </button>
                                <button
                                  onClick={() => handleUpdateOrderStatus(order._id, "ACCEPT", 25)}
                                  className="py-2 px-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                                >
                                  Accept (25m)
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm("Reject this order?")) {
                                      handleUpdateOrderStatus(order._id, "REJECT");
                                    }
                                  }}
                                  className="py-2 px-1 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-xs transition border border-slate-200"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          )}

                          {/* If ACCEPTED */}
                          {order.status === "ACCEPTED" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateOrderStatus(order._id, "START_PREP")}
                                className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition flex items-center justify-center gap-1"
                              >
                                <UtensilsCrossed className="w-3.5 h-3.5" /> Start Preparation
                              </button>
                              <button
                                onClick={() => handleUpdateOrderStatus(order._id, "MARK_READY")}
                                className="py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition"
                              >
                                Ready
                              </button>
                            </div>
                          )}

                          {/* If PREPARING */}
                          {order.status === "PREPARING" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order._id, "MARK_READY")}
                              className="w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Order Packed & Ready for Pickup
                            </button>
                          )}

                          {/* If READY_FOR_PICKUP */}
                          {order.status === "READY_FOR_PICKUP" && (
                            <button
                              onClick={() => {
                                setPinModalOrder(order);
                                setEnteredPin("");
                                setPinError(null);
                              }}
                              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <ShieldCheck className="w-4 h-4" /> Verify Rider PIN & Handover
                            </button>
                          )}

                          {/* If OUT_FOR_DELIVERY */}
                          {order.status === "OUT_FOR_DELIVERY" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order._id, "MARK_DELIVERED")}
                              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" /> Mark Order Delivered
                            </button>
                          )}

                          {/* Print Slip Button */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-slate-400">
                              Commission: {order.financials.platformCommissionPercent}% (-{formatCurrency(order.financials.platformCommissionAmount)})
                            </span>
                            <button
                              onClick={() => setSlipModalOrder(order)}
                              className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 p-1 rounded hover:bg-slate-100"
                            >
                              <Printer className="w-3.5 h-3.5" /> Print Ticket
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: COMMISSION RECONCILIATION */}
          {activeTab === "RECONCILIATION" && reconciliationData && (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Delivery Sales</span>
                  <div className="text-3xl font-black font-mono text-slate-900 mt-1">
                    {formatCurrency(reconciliationData.totals.grossVolume)}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    Across {reconciliationData.totals.totalOrders} total completed deliveries
                  </span>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Total Commissions Deducted</span>
                  <div className="text-3xl font-black font-mono text-amber-600 mt-1">
                    -{formatCurrency(reconciliationData.totals.platformCommissionTotal)}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    Third-party platform fees retained by PickMe & Uber
                  </span>
                </div>

                <div className="bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-300 p-5 rounded-2xl shadow-2xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Net Merchant Payout</span>
                  <div className="text-3xl font-black font-mono text-emerald-700 mt-1">
                    {formatCurrency(reconciliationData.totals.estimatedNetPayoutTotal)}
                  </div>
                  <span className="text-xs text-emerald-600 mt-1 block">
                    Funds deposited into store bank account
                  </span>
                </div>
              </div>

              {/* Platform Comparison Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" /> Platform-by-Platform Financial Breakdown
                  </h3>
                  <span className="text-xs text-slate-400">Sri Lanka Standard Delivery Agreements</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/60 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <tr>
                        <th className="py-3 px-6">Platform</th>
                        <th className="py-3 px-6">Avg Commission</th>
                        <th className="py-3 px-6 text-center">Orders</th>
                        <th className="py-3 px-6 text-right">Gross Sales</th>
                        <th className="py-3 px-6 text-right">Commissions</th>
                        <th className="py-3 px-6 text-right font-black">Net Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr className="hover:bg-slate-50/60">
                        <td className="py-3 px-6 font-bold flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          PickMe Food
                        </td>
                        <td className="py-3 px-6 font-mono text-slate-500">22.0%</td>
                        <td className="py-3 px-6 text-center font-bold">
                          {reconciliationData.platformBreakdown.PICKME_FOOD.count}
                        </td>
                        <td className="py-3 px-6 text-right font-mono font-medium">
                          {formatCurrency(reconciliationData.platformBreakdown.PICKME_FOOD.gross)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono text-amber-600">
                          -{formatCurrency(reconciliationData.platformBreakdown.PICKME_FOOD.commission)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(reconciliationData.platformBreakdown.PICKME_FOOD.netPayout)}
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50/60">
                        <td className="py-3 px-6 font-bold flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-black" />
                          Uber Eats Sri Lanka
                        </td>
                        <td className="py-3 px-6 font-mono text-slate-500">25.0%</td>
                        <td className="py-3 px-6 text-center font-bold">
                          {reconciliationData.platformBreakdown.UBER_EATS.count}
                        </td>
                        <td className="py-3 px-6 text-right font-mono font-medium">
                          {formatCurrency(reconciliationData.platformBreakdown.UBER_EATS.gross)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono text-amber-600">
                          -{formatCurrency(reconciliationData.platformBreakdown.UBER_EATS.commission)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(reconciliationData.platformBreakdown.UBER_EATS.netPayout)}
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50/60">
                        <td className="py-3 px-6 font-bold flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          PickMe Flash (On-Demand Goods)
                        </td>
                        <td className="py-3 px-6 font-mono text-slate-500">18.0%</td>
                        <td className="py-3 px-6 text-center font-bold">
                          {reconciliationData.platformBreakdown.PICKME_FLASH.count}
                        </td>
                        <td className="py-3 px-6 text-right font-mono font-medium">
                          {formatCurrency(reconciliationData.platformBreakdown.PICKME_FLASH.gross)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono text-amber-600">
                          -{formatCurrency(reconciliationData.platformBreakdown.PICKME_FLASH.commission)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(reconciliationData.platformBreakdown.PICKME_FLASH.netPayout)}
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50/60">
                        <td className="py-3 px-6 font-bold flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          Direct Store Deliveries
                        </td>
                        <td className="py-3 px-6 font-mono text-emerald-600 font-bold">0.0% (Zero)</td>
                        <td className="py-3 px-6 text-center font-bold">
                          {reconciliationData.platformBreakdown.DIRECT_STORE.count}
                        </td>
                        <td className="py-3 px-6 text-right font-mono font-medium">
                          {formatCurrency(reconciliationData.platformBreakdown.DIRECT_STORE.gross)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono text-slate-400">Rs. 0.00</td>
                        <td className="py-3 px-6 text-right font-mono font-bold text-emerald-700">
                          {formatCurrency(reconciliationData.platformBreakdown.DIRECT_STORE.netPayout)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* MODAL 1: RIDER PICKUP PIN VERIFICATION MODAL */}
        {pinModalOrder && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Rider Handover Verification</h3>
                    <span className="text-xs text-slate-500 font-mono">{pinModalOrder.externalOrderId}</span>
                  </div>
                </div>
                <button
                  onClick={() => setPinModalOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-4 text-center">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-left">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>Driver: {pinModalOrder.rider.name || "Delivery Partner"}</span>
                    <span>{pinModalOrder.rider.vehicleNumber}</span>
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    Customer: {pinModalOrder.customer.name} ({pinModalOrder.items.length} items)
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">
                    Enter the 4-digit PIN shown on the Driver's Smartphone App:
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 4821"
                    autoFocus
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value)}
                    className="w-48 text-center py-2.5 text-3xl font-black font-mono tracking-widest bg-slate-50 border-2 border-emerald-500 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-200"
                  />
                  <div className="text-[11px] text-slate-400 mt-2">
                    (Correct order PIN: <strong className="font-mono text-slate-700">{pinModalOrder.rider.pickupPin}</strong>)
                  </div>
                </div>

                {pinError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => setPinModalOrder(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateOrderStatus(pinModalOrder._id, "HANDOVER", undefined, enteredPin)}
                  disabled={enteredPin.length < 4}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 transition shadow-sm"
                >
                  Confirm Handover
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: PRINT DISPATCH SLIP MODAL */}
        {slipModalOrder && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-4 shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-emerald-600" />
                  <span>Thermal Dispatch Slip</span>
                </div>
                <button
                  onClick={() => setSlipModalOrder(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                <DeliveryDispatchSlip
                  data={{
                    orderId: slipModalOrder._id,
                    externalOrderId: slipModalOrder.externalOrderId,
                    platform: slipModalOrder.platform,
                    storeName: businessName,
                    createdAt: slipModalOrder.createdAt,
                    prepTimeMinutes: slipModalOrder.prepTimeMinutes,
                    scheduledPrepEnd: slipModalOrder.scheduledPrepEnd,
                    customer: slipModalOrder.customer,
                    items: slipModalOrder.items,
                    financials: slipModalOrder.financials,
                    rider: slipModalOrder.rider,
                  }}
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => setSlipModalOrder(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: DIRECT PHONE DELIVERY ENTRY MODAL */}
        {isNewOrderModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl flex flex-col max-h-[92vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">New Direct Phone Delivery Order</h3>
                    <p className="text-xs text-slate-500">In-house counter delivery dispatch</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateDirectOrder} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
                {/* Customer Details */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Customer & Destination
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Customer Name *"
                      required
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Customer Phone (07XXXXXXXX) *"
                      required
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Delivery Address (Street, Building, Landmark) *"
                    required
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Special instructions or gate notes (Optional)"
                    value={newCustNotes}
                    onChange={(e) => setNewCustNotes(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-[11px]"
                  />
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Ordered Items
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setNewOrderItems([
                          ...newOrderItems,
                          { name: "", quantity: 1, unitPrice: 0, specialInstructions: "" },
                        ])
                      }
                      className="text-blue-600 font-bold hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>

                  <div className="space-y-2">
                    {newOrderItems.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Item name (e.g. Seafood Fried Rice)"
                            required
                            value={item.name}
                            onChange={(e) => {
                              const updated = [...newOrderItems];
                              updated[idx].name = e.target.value;
                              setNewOrderItems(updated);
                            }}
                            className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...newOrderItems];
                              updated[idx].quantity = Number(e.target.value) || 1;
                              setNewOrderItems(updated);
                            }}
                            className="w-16 p-2 bg-white border border-slate-200 rounded-lg font-mono text-center text-xs"
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="Price"
                            value={item.unitPrice || ""}
                            onChange={(e) => {
                              const updated = [...newOrderItems];
                              updated[idx].unitPrice = Number(e.target.value) || 0;
                              setNewOrderItems(updated);
                            }}
                            className="w-24 p-2 bg-white border border-slate-200 rounded-lg font-mono text-right text-xs"
                          />
                          {newOrderItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewOrderItems(newOrderItems.filter((_, i) => i !== idx));
                              }}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Special cooking / packing note (Optional)"
                          value={item.specialInstructions}
                          onChange={(e) => {
                            const updated = [...newOrderItems];
                            updated[idx].specialInstructions = e.target.value;
                            setNewOrderItems(updated);
                          }}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-[10px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logistics */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Target Prep Time (Minutes)</label>
                    <select
                      value={newPrepTime}
                      onChange={(e) => setNewPrepTime(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value={10}>10 Minutes (Quick Snack)</option>
                      <option value={15}>15 Minutes (Standard Meal)</option>
                      <option value={25}>25 Minutes (Hot Kitchen)</option>
                      <option value={35}>35 Minutes (Large Order)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Delivery Charge (LKR)</label>
                    <input
                      type="number"
                      min="0"
                      value={newDeliveryFee}
                      onChange={(e) => setNewDeliveryFee(Number(e.target.value) || 0)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewOrderModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold disabled:opacity-50 transition shadow-sm"
                  >
                    {submittingOrder ? "Submitting..." : "Dispatch Direct Order"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
