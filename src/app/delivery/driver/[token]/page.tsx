"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Bike,
  Car,
  Truck,
  MapPin,
  Phone,
  MessageSquare,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Clock,
  Camera,
  PenTool,
  RotateCcw,
  Wallet,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";

interface DriverStop {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  stopSequence: number;
  isCod: boolean;
  codAmount: number;
  status: "PENDING" | "DELIVERED" | "FAILED";
  deliveredAt?: string;
  collectedCod?: number;
  changeGiven?: number;
  failureReason?: string;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

interface ActiveTrip {
  _id: string;
  tripNumber: string;
  status: "DRAFT" | "DISPATCHED" | "COMPLETED" | "CANCELLED";
  totalStops: number;
  completedStops: number;
  failedStops: number;
  totalCodExpected: number;
  totalCodCollected: number;
  dispatchedAt?: string;
  stops: DriverStop[];
}

interface DriverProfile {
  _id: string;
  name: string;
  phone: string;
  vehicleType: "BIKE" | "THREE_WHEELER" | "CAR" | "VAN";
  vehicleNumber: string;
  totalDeliveriesCompleted: number;
  totalCodCollected: number;
}

interface BusinessInfo {
  name: string;
  phone: string;
  address: string;
}

export default function DriverMobilePortalPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active Pod Modal State
  const [activePodStop, setActivePodStop] = useState<DriverStop | null>(null);
  const [podReceivedBy, setPodReceivedBy] = useState("Customer Directly");
  const [podNotes, setPodNotes] = useState("");
  const [podPhotoUrl, setPodPhotoUrl] = useState<string | null>(null);
  const [podCashGiven, setPodCashGiven] = useState("");
  const [submittingPod, setSubmittingPod] = useState(false);

  // Failure Modal State
  const [activeFailStop, setActiveFailStop] = useState<DriverStop | null>(null);
  const [failReason, setFailReason] = useState("CUSTOMER_UNREACHABLE");
  const [failNotes, setFailNotes] = useState("");
  const [submittingFail, setSubmittingFail] = useState(false);

  // Canvas Ref for Signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Cash Denominations Tally Modal / Drawer
  const [showCashBag, setShowCashBag] = useState(false);
  const [denominations, setDenominations] = useState({
    5000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
  });

  const loadActiveTrip = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch(`/api/public/driver/active-trip?token=${token}`);
      const data = await res.json();
      if (data.success) {
        setDriver(data.driver);
        setBusiness(data.business);
        setTrip(data.trip);
      } else {
        setErrorMessage(data.error || "Failed to load active driver trip.");
      }
    } catch {
      setErrorMessage("Network error connecting to store server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveTrip();
  }, [token]);

  // Signature Canvas Helpers
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPodPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openPodModal = (stop: DriverStop) => {
    setActivePodStop(stop);
    setPodReceivedBy(stop.customerName || "Customer Directly");
    setPodNotes("");
    setPodPhotoUrl(null);
    setPodCashGiven(stop.isCod ? stop.codAmount.toString() : "0");
    setHasSignature(false);
    // Delay canvas reset until DOM mounted
    setTimeout(() => {
      clearSignature();
    }, 100);
  };

  const submitPod = async () => {
    if (!activePodStop || !trip) return;

    let signatureUrl = undefined;
    if (canvasRef.current && hasSignature) {
      signatureUrl = canvasRef.current.toDataURL("image/png");
    }

    const cashGivenNum = parseFloat(podCashGiven) || 0;
    const codAmount = activePodStop.isCod ? activePodStop.codAmount : 0;
    const changeGiven = activePodStop.isCod ? Math.max(0, cashGivenNum - codAmount) : 0;

    try {
      setSubmittingPod(true);
      const res = await fetch("/api/public/driver/order-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "CONFIRM_DELIVERY",
          tripId: trip._id,
          orderId: activePodStop.orderId,
          signatureUrl,
          photoUrl: podPhotoUrl || undefined,
          receivedBy: podReceivedBy.trim(),
          notes: podNotes.trim() || undefined,
          collectedCod: codAmount,
          changeGiven,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: `Order #${activePodStop.orderNumber} marked as delivered!`,
        });
        setActivePodStop(null);
        loadActiveTrip();
      } else {
        alert(data.error || "Failed to confirm delivery.");
      }
    } catch {
      alert("Network error confirming delivery.");
    } finally {
      setSubmittingPod(false);
    }
  };

  const submitFailure = async () => {
    if (!activeFailStop || !trip) return;

    try {
      setSubmittingFail(true);
      const res = await fetch("/api/public/driver/order-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "FAIL_DELIVERY",
          tripId: trip._id,
          orderId: activeFailStop.orderId,
          failureReason: failReason,
          notes: failNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: `Order #${activeFailStop.orderNumber} marked as delivery failed.`,
        });
        setActiveFailStop(null);
        loadActiveTrip();
      } else {
        alert(data.error || "Failed to report delivery failure.");
      }
    } catch {
      alert("Network error reporting delivery failure.");
    } finally {
      setSubmittingFail(false);
    }
  };

  // Compute Cash Bag Denominations Sum
  const calculatedDenominationsTotal =
    denominations[5000] * 5000 +
    denominations[1000] * 1000 +
    denominations[500] * 500 +
    denominations[100] * 100 +
    denominations[50] * 50 +
    denominations[20] * 20;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold">Connecting to Express Fleet Dispatch...</h2>
        <p className="text-xs text-slate-400 mt-1">Fetching your live runsheet</p>
      </div>
    );
  }

  if (errorMessage || !driver) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold">Driver Access Restricted</h2>
        <p className="text-xs text-slate-400 max-w-xs mt-2">{errorMessage || "Invalid or inactive driver token."}</p>
        <button
          onClick={loadActiveTrip}
          className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg"
        >
          Try Reconnecting
        </button>
      </div>
    );
  }

  const completedCount = trip?.stops?.filter((s) => s.status === "DELIVERED").length || 0;
  const totalCount = trip?.stops?.length || 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col max-w-md mx-auto shadow-2xl relative font-sans">
      {/* ================= DRIVER HEADER ================= */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              {driver.vehicleType === "BIKE" ? (
                <Bike className="w-5 h-5" />
              ) : driver.vehicleType === "VAN" ? (
                <Truck className="w-5 h-5" />
              ) : (
                <Car className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm text-white tracking-tight">{driver.name}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                <span>{driver.vehicleNumber}</span>
                <span>•</span>
                <span className="text-blue-400">{driver.vehicleType.replace("_", " ")}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCashBag(true)}
              className="px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span className="font-mono">Rs. {trip?.totalCodCollected?.toLocaleString() || 0}</span>
            </button>
            <button
              onClick={loadActiveTrip}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 active:rotate-180 transition duration-300"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Feedback Banner */}
      {statusMessage && (
        <div
          className={`px-4 py-2 text-xs font-medium flex items-center justify-between ${
            statusMessage.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= ACTIVE TRIP BANNER ================= */}
      {trip ? (
        <div className="p-4 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Trip</span>
              <div className="font-mono font-black text-white text-base">{trip.tripNumber}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Progress</span>
              <div className="font-mono font-black text-emerald-400 text-base">
                {completedCount} / {totalCount} <span className="text-xs text-slate-400">({progressPercent}%)</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">COD Expected</span>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {formatCurrency(trip.totalCodExpected)}
              </span>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">COD In Pocket</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {formatCurrency(trip.totalCodCollected)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center space-y-3 bg-slate-900/50 my-auto">
          <div className="w-16 h-16 rounded-3xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-white">No Active Runsheet Dispatched</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            You are on standby. When store dispatch assigns parcels to your vehicle, your stop sequence will appear here automatically.
          </p>
          <button
            onClick={loadActiveTrip}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md"
          >
            Refresh Queue
          </button>
        </div>
      )}

      {/* ================= STOPS SEQUENCE LIST ================= */}
      {trip && (
        <main className="p-4 space-y-4 flex-1 pb-24">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Assigned Stops ({trip.stops.length})
            </h3>
            <span className="text-[10px] text-slate-500">Optimized Sequence</span>
          </div>

          <div className="space-y-3.5">
            {trip.stops.map((stop) => {
              const isDelivered = stop.status === "DELIVERED";
              const isFailed = stop.status === "FAILED";
              const isPending = stop.status === "PENDING";

              const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                stop.deliveryAddress
              )}`;
              const waText = encodeURIComponent(
                `Hello ${stop.customerName}, this is your delivery rider ${driver.name} from ${
                  business?.name || "the store"
                }. I am arriving with your order #${stop.orderNumber}. Please be ready!`
              );
              const waUrl = `https://wa.me/${stop.customerPhone.replace(/[^0-9]/g, "")}?text=${waText}`;

              return (
                <div
                  key={stop.stopSequence}
                  className={`rounded-2xl border p-4 transition-all ${
                    isDelivered
                      ? "bg-emerald-950/20 border-emerald-800/40 opacity-80"
                      : isFailed
                      ? "bg-rose-950/20 border-rose-800/40 opacity-80"
                      : "bg-slate-900 border-slate-800 shadow-md"
                  }`}
                >
                  {/* Top stop sequence & Status */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 rounded-xl font-bold font-mono text-xs flex items-center justify-center shadow-sm ${
                          isDelivered
                            ? "bg-emerald-500 text-white"
                            : isFailed
                            ? "bg-rose-500 text-white"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        {isDelivered ? <Check className="w-4 h-4" /> : stop.stopSequence}
                      </span>
                      <div>
                        <div className="font-bold text-white text-sm">Order #{stop.orderNumber}</div>
                        <div className="text-[11px] text-slate-400 font-medium">{stop.customerName}</div>
                      </div>
                    </div>

                    <div>
                      {isDelivered ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          DELIVERED
                        </span>
                      ) : isFailed ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          FAILED
                        </span>
                      ) : stop.isCod ? (
                        <span className="px-2.5 py-1 rounded text-xs font-mono font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          COD {formatCurrency(stop.codAmount)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          PAID
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Address & Landmark */}
                  <div className="py-3 space-y-1.5 text-xs">
                    <div className="flex items-start gap-2 text-slate-300">
                      <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span className="font-medium leading-relaxed">{stop.deliveryAddress}</span>
                    </div>
                    {stop.deliveryNotes && (
                      <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-[11px] italic">
                        Note: {stop.deliveryNotes}
                      </div>
                    )}
                    {isFailed && stop.failureReason && (
                      <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-[11px]">
                        Failure Reason: {stop.failureReason.replace("_", " ")}
                      </div>
                    )}
                  </div>

                  {/* Action Bar */}
                  {isPending && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      {/* Contact & Navigation Buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        <a
                          href={`tel:${stop.customerPhone}`}
                          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Call</span>
                        </a>

                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                          <span>WhatsApp</span>
                        </a>

                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
                        >
                          <Navigation className="w-3.5 h-3.5 text-blue-400" />
                          <span>Maps</span>
                        </a>
                      </div>

                      {/* Complete Delivery Action */}
                      <div className="grid grid-cols-4 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFailStop(stop);
                            setFailReason("CUSTOMER_UNREACHABLE");
                            setFailNotes("");
                          }}
                          className="col-span-1 py-3 bg-slate-800 hover:bg-rose-900/30 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-bold transition flex items-center justify-center"
                        >
                          Failed
                        </button>

                        <button
                          type="button"
                          onClick={() => openPodModal(stop)}
                          className="col-span-3 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 active:scale-95 transition"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Complete & Doorstep POD</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {isDelivered && (
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Delivered at {formatSLDateTime(stop.deliveredAt || "").split(",")[1]}</span>
                      </span>
                      {stop.isCod && (
                        <span className="font-mono font-bold text-amber-400">
                          Collected: {formatCurrency(stop.collectedCod || stop.codAmount)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* ================= MODAL: DOORSTEP PROOF OF DELIVERY (POD) ================= */}
      {activePodStop && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Proof of Delivery (POD)</h3>
                  <p className="text-xs text-slate-400">Order #{activePodStop.orderNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePodStop(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* COD Cash Change Calculator */}
            {activePodStop.isCod && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-300 font-bold uppercase tracking-wider text-[10px]">
                    Cash to Collect (COD)
                  </span>
                  <span className="font-mono font-black text-amber-400 text-base">
                    {formatCurrency(activePodStop.codAmount)}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Customer Cash Handed (Rs.):
                  </label>
                  <input
                    type="number"
                    value={podCashGiven}
                    onChange={(e) => setPodCashGiven(e.target.value)}
                    placeholder={activePodStop.codAmount.toString()}
                    className="w-full px-3 py-2 text-sm font-mono font-black bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[activePodStop.codAmount, 1000, 2000, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPodCashGiven(preset.toString())}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono font-bold text-slate-300 rounded-lg"
                    >
                      Rs. {preset.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Change Due Highlight */}
                {parseFloat(podCashGiven) > activePodStop.codAmount && (
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-emerald-300 font-medium">Return Change:</span>
                    <span className="font-mono font-black text-emerald-400 text-sm">
                      {formatCurrency(parseFloat(podCashGiven) - activePodStop.codAmount)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Recipient Details */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                Received By (Customer / Guardian Name):
              </label>
              <input
                type="text"
                value={podReceivedBy}
                onChange={(e) => setPodReceivedBy(e.target.value)}
                placeholder="e.g. Sunil Perera (Self)"
                className="w-full px-3.5 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Touch Signature Pad */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300 flex items-center gap-1">
                  <PenTool className="w-3.5 h-3.5 text-blue-400" />
                  <span>Customer Signature on Screen:</span>
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>

              <div className="border border-slate-700 rounded-xl overflow-hidden bg-white touch-none">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={130}
                  className="w-full h-32 block cursor-crosshair"
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                />
              </div>
              <p className="text-[10px] text-slate-500 text-center">Sign with finger or stylus</p>
            </div>

            {/* Doorstep Photo Capture */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-blue-400" />
                <span>Parcel Photo on Doorstep (Optional):</span>
              </label>

              {podPhotoUrl ? (
                <div className="relative border border-slate-700 rounded-xl overflow-hidden bg-black max-h-36 flex items-center justify-center">
                  <img src={podPhotoUrl} alt="Doorstep POD" className="max-h-36 object-contain" />
                  <button
                    type="button"
                    onClick={() => setPodPhotoUrl(null)}
                    className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-700 hover:border-slate-500 rounded-xl bg-slate-800/40 cursor-pointer">
                  <Camera className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-[11px] text-slate-300 font-medium">Take Doorstep Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <input
                type="text"
                value={podNotes}
                onChange={(e) => setPodNotes(e.target.value)}
                placeholder="Special delivery notes (e.g. Left with security guard)"
                className="w-full px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActivePodStop(null)}
                className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingPod}
                onClick={submitPod}
                className="flex-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950 flex items-center justify-center gap-2"
              >
                {submittingPod ? (
                  <span>Saving POD...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Doorstep Delivery</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELIVERY FAILED ================= */}
      {activeFailStop && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Report Delivery Failure</h3>
                  <p className="text-xs text-slate-400">Order #{activeFailStop.orderNumber}</p>
                </div>
              </div>
              <button onClick={() => setActiveFailStop(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Failure Reason:</label>
              {[
                { id: "CUSTOMER_UNREACHABLE", label: "Customer Unreachable (No answer)" },
                { id: "INCORRECT_ADDRESS", label: "Incorrect / Incomplete Address" },
                { id: "CUSTOMER_REFUSED_COD", label: "Customer Refused to Pay COD" },
                { id: "CUSTOMER_RESCHEDULED", label: "Customer Requested Reschedule" },
                { id: "OTHER", label: "Other / Bad Weather Delay" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setFailReason(r.id)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-medium border transition ${
                    failReason === r.id
                      ? "bg-rose-500/20 border-rose-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">Additional Details:</label>
              <textarea
                rows={2}
                value={failNotes}
                onChange={(e) => setFailNotes(e.target.value)}
                placeholder="e.g. Called 3 times, gate was locked."
                className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveFailStop(null)}
                className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingFail}
                onClick={submitFailure}
                className="flex-2 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-950"
              >
                {submittingFail ? "Submitting..." : "Submit Failure Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DRIVER CASH BAG & DENOMINATION TALLY ================= */}
      {showCashBag && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Cash Collection Bag (COD)</h3>
                  <p className="text-xs text-slate-400">Cash in pocket to return to cashier</p>
                </div>
              </div>
              <button onClick={() => setShowCashBag(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-amber-300 uppercase font-bold tracking-wider block">
                  Trip Collected COD
                </span>
                <span className="text-2xl font-black font-mono text-amber-400">
                  {formatCurrency(trip?.totalCodCollected || 0)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Completed
                </span>
                <span className="font-mono font-bold text-white text-sm">
                  {completedCount} orders
                </span>
              </div>
            </div>

            {/* Note counting tool */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 block">
                Sri Lankan Rupee Note Counter:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {([5000, 1000, 500, 100, 50, 20] as const).map((note) => (
                  <div key={note} className="flex items-center justify-between bg-slate-800 p-2 rounded-xl border border-slate-700">
                    <span className="font-mono font-bold text-slate-300">Rs. {note}:</span>
                    <input
                      type="number"
                      min="0"
                      value={denominations[note] || ""}
                      onChange={(e) =>
                        setDenominations({
                          ...denominations,
                          [note]: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      placeholder="0"
                      className="w-14 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-right font-mono text-white text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-800 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-300">Notes Counted Total:</span>
              <span className="font-mono font-black text-emerald-400 text-sm">
                {formatCurrency(calculatedDenominationsTotal)}
              </span>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowCashBag(false)}
                className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
