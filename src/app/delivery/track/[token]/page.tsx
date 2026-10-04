"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Bike,
  Truck,
  Car,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Navigation,
  UtensilsCrossed,
  PackageCheck,
  ChevronDown,
  ChevronUp,
  Receipt,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";

interface TrackOrderData {
  _id: string;
  trackingToken: string;
  externalOrderId: string;
  platform: string;
  status:
    | "PENDING_ACCEPT"
    | "ACCEPTED"
    | "PREPARING"
    | "READY_FOR_PICKUP"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED"
    | "REJECTED";
  createdAt: string;
  acceptedAt?: string;
  readyAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  etaMinutes: number;
  customer: {
    name: string;
    phone: string;
    deliveryAddress: string;
    deliveryNotes?: string;
    deliveryCoordinates?: {
      lat: number;
      lng: number;
    };
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
    deliveryFee: number;
    merchantDiscount: number;
    totalBill: number;
    payoutStatus: string;
  };
  cashOnDelivery?: {
    isCod: boolean;
    expectedAmount: number;
    collectedAmount?: number;
    changeGiven?: number;
    paymentMethod: string;
  } | null;
  rider: {
    name?: string;
    phone?: string;
    vehicleType: "BIKE" | "THREE_WHEELER" | "CAR" | "VAN";
    vehicleNumber?: string;
    arrivedAtStore?: boolean;
  };
  trip?: {
    tripNumber: string;
    totalStops: number;
    completedStops: number;
    stopSequence: number;
    precedingPendingStops: number;
  } | null;
  proofOfDelivery?: {
    signatureUrl?: string;
    photoUrl?: string;
    receivedBy?: string;
    notes?: string;
    deliveredAt?: string;
  } | null;
  deliveryFailure?: {
    reason: string;
    notes?: string;
    failedAt?: string;
  } | null;
}

interface StoreBusinessData {
  name: string;
  phone: string;
  address?: string;
  logoUrl?: string;
}

export default function CustomerDeliveryTrackingPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackOrderData | null>(null);
  const [business, setBusiness] = useState<StoreBusinessData | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isItemsExpanded, setIsItemsExpanded] = useState(true);

  const fetchTracking = async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`/api/public/delivery/track/${token}`);
      const data = await res.json();
      if (data.success && data.order) {
        setOrder(data.order);
        setBusiness(data.business);
        setLastRefreshed(new Date());
        setError(null);
      } else {
        setError(data.error || "Order tracking details not found.");
      }
    } catch {
      setError("Unable to connect to live tracking. Please retry.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();

    // Poll every 12 seconds for real-time status updates
    const interval = setInterval(() => {
      fetchTracking(true);
    }, 12000);

    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-3xl bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30 animate-bounce mb-4">
          <Bike className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Connecting to Live Tracker...</h2>
        <p className="text-xs text-slate-500 mt-1">Retrieving order and delivery fleet status</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Order Tracking Unavailable</h2>
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-6">
          {error || "The tracking link may have expired or is invalid. Please check your SMS or contact the store."}
        </p>
        <button
          onClick={() => fetchTracking()}
          className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md"
        >
          Try Again
        </button>
      </div>
    );
  }

  const isDelivered = order.status === "DELIVERED";
  const isOut = order.status === "OUT_FOR_DELIVERY";
  const isReady = order.status === "READY_FOR_PICKUP";
  const isPreparing = order.status === "PREPARING";
  const isAccepted = order.status === "ACCEPTED" || order.status === "PENDING_ACCEPT";
  const isCancelled = order.status === "CANCELLED" || order.status === "REJECTED";

  // Step indices: 1 = Confirmed, 2 = Preparing, 3 = Packed, 4 = Out with Driver, 5 = Delivered
  let activeStep = 1;
  if (isPreparing) activeStep = 2;
  else if (isReady) activeStep = 3;
  else if (isOut) activeStep = 4;
  else if (isDelivered) activeStep = 5;

  const isCod = Boolean(order.cashOnDelivery?.isCod);
  const codAmount = order.cashOnDelivery?.expectedAmount || order.financials.totalBill;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-12">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Live Delivery Tracker
              </span>
            </div>
            <h1 className="font-bold text-sm text-slate-900">{business?.name || "Corner Store"}</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchTracking(false)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              title="Refresh tracking status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {business?.phone && (
              <a
                href={`tel:${business.phone}`}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Store</span>
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Main Status Hero Card */}
        <div
          className={`p-6 rounded-3xl text-white shadow-xl transition-all relative overflow-hidden ${
            isDelivered
              ? "bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-900/20"
              : isOut
              ? "bg-gradient-to-br from-emerald-600 via-teal-600 to-slate-900 shadow-teal-900/25"
              : isCancelled
              ? "bg-gradient-to-br from-rose-600 to-red-800 shadow-rose-900/20"
              : "bg-gradient-to-br from-slate-900 to-slate-800 shadow-slate-900/20"
          }`}
        >
          {/* Subtle background glow */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between text-xs text-white/80 pb-3 border-b border-white/10">
            <span className="font-mono font-bold tracking-wider">ORDER #{order.externalOrderId}</span>
            <span className="text-[11px] font-medium">
              {order.createdAt ? formatSLDateTime(order.createdAt) : "Today"}
            </span>
          </div>

          <div className="py-4 text-center">
            {isDelivered ? (
              <div className="space-y-1">
                <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center mx-auto mb-2 backdrop-blur-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-200" />
                </div>
                <h2 className="text-2xl font-black text-white">Delivered Successfully!</h2>
                <p className="text-xs text-emerald-100">
                  Received by {order.proofOfDelivery?.receivedBy || order.customer.name}
                </p>
              </div>
            ) : isOut ? (
              <div className="space-y-1">
                <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center mx-auto mb-2 backdrop-blur-xs">
                  <Bike className="w-8 h-8 text-white animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-white">Out for Delivery</h2>
                <p className="text-xs text-white/90">
                  {order.trip?.precedingPendingStops === 0
                    ? "🚀 Next Stop is Yours! The rider is arriving shortly."
                    : order.trip
                    ? `Rider is completing ${order.trip.precedingPendingStops} stop(s) before your location.`
                    : "Your delivery driver is en route with your items."}
                </p>
                <div className="inline-block mt-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold text-white font-mono">
                  ETA: ~{order.etaMinutes} mins
                </div>
              </div>
            ) : isReady ? (
              <div className="space-y-1">
                <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center mx-auto mb-2 backdrop-blur-xs">
                  <PackageCheck className="w-8 h-8 text-teal-200" />
                </div>
                <h2 className="text-2xl font-black text-white">Packed & Ready</h2>
                <p className="text-xs text-white/80">Order is packed and awaiting rider dispatch handover</p>
              </div>
            ) : isPreparing ? (
              <div className="space-y-1">
                <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center mx-auto mb-2 backdrop-blur-xs">
                  <UtensilsCrossed className="w-8 h-8 text-amber-200" />
                </div>
                <h2 className="text-2xl font-black text-white">Kitchen Preparing</h2>
                <p className="text-xs text-white/80">Store team is currently preparing and packing your order</p>
              </div>
            ) : isCancelled ? (
              <div className="space-y-1">
                <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center mx-auto mb-2">
                  <AlertCircle className="w-8 h-8 text-rose-200" />
                </div>
                <h2 className="text-2xl font-black text-white">Order Cancelled</h2>
                <p className="text-xs text-rose-100">Contact the store for more information.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center mx-auto mb-2">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-black text-white">Order Confirmed</h2>
                <p className="text-xs text-white/80">Store has received your order and queued it for preparation</p>
              </div>
            )}
          </div>

          {/* Stepper Dots & Line */}
          {!isCancelled && (
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-[10px] text-white/70 font-semibold mb-2">
                <span className={activeStep >= 1 ? "text-white font-bold" : ""}>Confirmed</span>
                <span className={activeStep >= 2 ? "text-white font-bold" : ""}>Preparing</span>
                <span className={activeStep >= 3 ? "text-white font-bold" : ""}>Packed</span>
                <span className={activeStep >= 4 ? "text-white font-bold" : ""}>On the Way</span>
                <span className={activeStep >= 5 ? "text-white font-bold" : ""}>Delivered</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`h-1.5 rounded-full transition-all ${
                      step <= activeStep ? "bg-white" : "bg-white/25"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cash-on-Delivery (COD) Banner */}
        {isCod && !isDelivered && (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 shadow-sm flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 block">
                Cash on Delivery Reminder
              </span>
              <div className="text-lg font-black font-mono text-amber-900 mt-0.5">
                {formatCurrency(codAmount)}
              </div>
              <p className="text-[11px] text-amber-800">Please keep exact physical cash ready for the driver.</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center font-bold shrink-0">
              Rs.
            </div>
          </div>
        )}

        {/* Assigned Driver & Vehicle Card (Visible when Out for Delivery or Ready) */}
        {(isOut || isDelivered || order.rider?.name) && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Assigned Delivery Driver
              </span>
              {order.trip && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  Stop {order.trip.stopSequence} of {order.trip.totalStops}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                  {order.rider.vehicleType === "BIKE" ? (
                    <Bike className="w-6 h-6" />
                  ) : order.rider.vehicleType === "VAN" ? (
                    <Truck className="w-6 h-6" />
                  ) : (
                    <Car className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {order.rider.name || "In-House Fleet Driver"}
                  </h3>
                  <div className="text-xs font-mono font-semibold text-slate-500">
                    {order.rider.vehicleNumber || "Verified Store Courier"}
                  </div>
                </div>
              </div>

              {order.rider.phone && (
                <a
                  href={`tel:${order.rider.phone}`}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Rider</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Proof of Delivery (POD) Section if Delivered */}
        {isDelivered && order.proofOfDelivery && (
          <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Doorstep Proof of Delivery (POD)</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Received By</span>
                <span className="font-bold text-slate-800">
                  {order.proofOfDelivery.receivedBy || order.customer.name}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Delivered At</span>
                <span className="font-mono text-slate-800">
                  {order.proofOfDelivery.deliveredAt
                    ? formatSLDateTime(order.proofOfDelivery.deliveredAt)
                    : "Delivered"}
                </span>
              </div>
            </div>

            {/* Signature or Photo Preview */}
            <div className="grid grid-cols-2 gap-2">
              {order.proofOfDelivery.signatureUrl && (
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">Customer Signature</span>
                  <div className="p-1 bg-white border border-slate-200 rounded-xl h-24 flex items-center justify-center">
                    <img
                      src={order.proofOfDelivery.signatureUrl}
                      alt="Customer Signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
              )}

              {order.proofOfDelivery.photoUrl && (
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">Doorstep Photo</span>
                  <div className="bg-slate-100 border border-slate-200 rounded-xl h-24 overflow-hidden flex items-center justify-center">
                    <img
                      src={order.proofOfDelivery.photoUrl}
                      alt="Doorstep Photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Destination & Customer Details */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Delivery Destination
          </span>

          <div className="space-y-1.5 text-xs">
            <div className="font-bold text-slate-900">{order.customer.name}</div>
            <div className="text-slate-600 flex items-start gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>{order.customer.deliveryAddress}</span>
            </div>
            {order.customer.deliveryNotes && (
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
                Gate / Landmark note: {order.customer.deliveryNotes}
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Ordered Items Invoice Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setIsItemsExpanded(!isItemsExpanded)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/50 transition"
          >
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-xs text-slate-900">
                Order Summary ({order.items.length} items)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-slate-900">
                {formatCurrency(order.financials.totalBill)}
              </span>
              {isItemsExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

          {isItemsExpanded && (
            <div className="px-4 pb-4 border-t border-slate-100 divide-y divide-slate-100 text-xs">
              <div className="py-2 space-y-2">
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <span className="font-medium text-slate-800">
                        {it.quantity}x {it.name}
                      </span>
                      {it.specialInstructions && (
                        <p className="text-[10px] text-slate-400">{it.specialInstructions}</p>
                      )}
                    </div>
                    <span className="font-mono font-bold text-slate-700">
                      {formatCurrency(it.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Subtotal, delivery fee, total */}
              <div className="pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatCurrency(order.financials.subtotal)}</span>
                </div>
                {order.financials.deliveryFee > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Delivery Fee</span>
                    <span className="font-mono">{formatCurrency(order.financials.deliveryFee)}</span>
                  </div>
                )}
                {order.financials.merchantDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="font-mono">-{formatCurrency(order.financials.merchantDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Amount</span>
                  <span className="font-mono text-emerald-700">{formatCurrency(order.financials.totalBill)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Tracking Poller Notice */}
        <div className="text-center text-[10px] text-slate-400 pt-2 space-y-0.5">
          <p>Live status updates every 12 seconds automatically.</p>
          <p>Last checked: {lastRefreshed.toLocaleTimeString("en-LK")}</p>
        </div>
      </main>
    </div>
  );
}
