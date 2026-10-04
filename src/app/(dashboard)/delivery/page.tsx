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
  FileText,
  Wallet,
  Copy,
  ExternalLink,
  Share2,
  Camera,
  Navigation,
  UserCheck,
  Users,
  CheckCheck,
  ClipboardList,
  Radio,
  Send,
  Route,
  MessageSquare,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import DeliveryDispatchSlip, { DeliveryDispatchSlipData } from "@/components/receipts/DeliveryDispatchSlip";
import DeliveryRunsheetSlip, { DeliveryRunsheetSlipData } from "@/components/receipts/DeliveryRunsheetSlip";
import VanLoadingSheetSlip, { VanLoadingSheetSlipData } from "@/components/receipts/VanLoadingSheetSlip";
import { playDeliveryOrderChime, startRepeatingDeliveryAlert, stopRepeatingDeliveryAlert } from "@/lib/delivery/sound-alert";
import { buildWhatsAppUrl } from "@/lib/notifications";

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
  tripId?: string;
  stopSequence?: number;
  proofOfDelivery?: {
    signatureUrl?: string;
    photoUrl?: string;
    receivedBy?: string;
    notes?: string;
    deliveredAt?: string;
  };
  cashOnDelivery?: {
    isCod: boolean;
    expectedAmount: number;
    collectedAmount?: number;
    changeGiven?: number;
  };
  deliveryFailure?: {
    reason: string;
    notes?: string;
    failedAt?: string;
  };
  prepTimeMinutes: number;
  scheduledPrepEnd?: string;
  acceptedAt?: string;
  readyAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  cancelReason?: string;
  trackingToken?: string;
  trackingSmsStatus?: "NOT_SENT" | "SENT" | "FAILED";
  trackingSmsSentAt?: string;
  createdAt: string;
}

interface DriverItem {
  _id: string;
  name: string;
  phone: string;
  vehicleType: "BIKE" | "THREE_WHEELER" | "CAR" | "VAN";
  vehicleNumber: string;
  nicNumber?: string;
  active: boolean;
  driverToken: string;
  totalDeliveriesCompleted: number;
  totalCodCollected: number;
  activeTrip?: any;
  notes?: string;
}

interface TripItem {
  _id: string;
  tripNumber: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicleType: string;
  vehicleNumber: string;
  status: "DRAFT" | "DISPATCHED" | "COMPLETED" | "CANCELLED";
  totalStops: number;
  completedStops: number;
  failedStops: number;
  totalCodExpected: number;
  totalCodCollected: number;
  cashierReconciliation?: {
    status: "PENDING" | "RECONCILED" | "DISCREPANCY";
    reconciledAt?: string;
    reconciledBy?: string;
    cashDrawerAmountSubmitted?: number;
    shortageOrOverage?: number;
    cashierNotes?: string;
  };
  dispatchedAt?: string;
  completedAt?: string;
  stops: Array<{
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    deliveryNotes?: string;
    stopSequence: number;
    isCod: boolean;
    codAmount: number;
    status: string;
    deliveredAt?: string;
    collectedCod?: number;
    failureReason?: string;
    signatureUrl?: string;
    photoUrl?: string;
    receivedBy?: string;
  }>;
  notes?: string;
}

export default function DeliveryHubPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    | "PENDING_ACCEPT"
    | "PREPARING"
    | "READY_FOR_PICKUP"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "FLEET_DRIVERS"
    | "TRIP_RUNSHEETS"
    | "COD_RECONCILIATION"
    | "RECONCILIATION"
    | "VAN_SALES"
  >("PENDING_ACCEPT");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [businessName, setBusinessName] = useState("Corner Store POS");

  // Van Sales Sessions State
  const [vanSessions, setVanSessions] = useState<any[]>([]);
  const [loadingVanSessions, setLoadingVanSessions] = useState(false);
  const [isLoadVanModalOpen, setIsLoadVanModalOpen] = useState(false);
  const [newVanDriverId, setNewVanDriverId] = useState("");
  const [newVanRouteZone, setNewVanRouteZone] = useState("");
  const [newVanNotes, setNewVanNotes] = useState("");
  const [newVanItems, setNewVanItems] = useState<
    Array<{
      productId: string;
      productName: string;
      unit: string;
      costPrice: number;
      unitPrice: number;
      wholesalePrice?: number;
      loadedQty: number;
      maxStock: number;
    }>
  >([]);
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [loadingStoreProducts, setLoadingStoreProducts] = useState(false);
  const [storeProductSearch, setStoreProductSearch] = useState("");
  const [submittingVanLoad, setSubmittingVanLoad] = useState(false);

  // Van Stock & Cash Reconciliation Modal State
  const [reconcilingVanSession, setReconcilingVanSession] = useState<any | null>(null);
  const [vanPhysicalCashSubmitted, setVanPhysicalCashSubmitted] = useState("");
  const [vanReturnItemsState, setVanReturnItemsState] = useState<{
    [productId: string]: { returnedQty: number; damagedQty: number };
  }>({});
  const [vanReconciliationNotes, setVanReconciliationNotes] = useState("");
  const [submittingVanReconciliation, setSubmittingVanReconciliation] = useState(false);

  // Van Loading Slip Modal State
  const [selectedVanSlipSession, setSelectedVanSlipSession] = useState<any | null>(null);

  // Modals state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [pinModalOrder, setPinModalOrder] = useState<DeliveryOrder | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [slipModalOrder, setSlipModalOrder] = useState<DeliveryOrder | null>(null);
  const [reconciliationData, setReconciliationData] = useState<any | null>(null);

  // Fleet & Drivers State
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [isNewDriverModalOpen, setIsNewDriverModalOpen] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverVehicleType, setNewDriverVehicleType] = useState<"BIKE" | "THREE_WHEELER" | "CAR" | "VAN">("THREE_WHEELER");
  const [newDriverVehicleNumber, setNewDriverVehicleNumber] = useState("");
  const [newDriverNic, setNewDriverNic] = useState("");
  const [newDriverNotes, setNewDriverNotes] = useState("");
  const [submittingDriver, setSubmittingDriver] = useState(false);
  const [copiedDriverToken, setCopiedDriverToken] = useState<string | null>(null);

  // Trip Runsheets State
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [tripDriverId, setTripDriverId] = useState("");
  const [tripOrderIds, setTripOrderIds] = useState<string[]>([]);
  const [tripNotes, setTripNotes] = useState("");
  const [tripDispatchImmediately, setTripDispatchImmediately] = useState(true);
  const [submittingTrip, setSubmittingTrip] = useState(false);
  const [selectedRunsheetTrip, setSelectedRunsheetTrip] = useState<TripItem | null>(null);

  // Cash Reconciliation Modal State
  const [reconcilingTrip, setReconcilingTrip] = useState<TripItem | null>(null);
  const [cashDrawerAmountSubmitted, setCashDrawerAmountSubmitted] = useState("");
  const [cashierReconciliationNotes, setCashierReconciliationNotes] = useState("");
  const [submittingReconciliation, setSubmittingReconciliation] = useState(false);

  // Proof of Delivery Viewer Modal State
  const [viewingPodOrder, setViewingPodOrder] = useState<DeliveryOrder | null>(null);

  // Route Map & Customer Tracking State
  const [viewingRouteTrip, setViewingRouteTrip] = useState<TripItem | null>(null);
  const [sendingSmsOrderId, setSendingSmsOrderId] = useState<string | null>(null);
  const [sendingSmsTripId, setSendingSmsTripId] = useState<string | null>(null);
  const [copiedTrackingOrderId, setCopiedTrackingOrderId] = useState<string | null>(null);

  // Feedback message
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const fetchDrivers = async () => {
    try {
      setLoadingDrivers(true);
      const res = await fetch("/api/delivery/drivers");
      const data = await res.json();
      if (data.success && Array.isArray(data.drivers)) {
        setDrivers(data.drivers);
      }
    } catch (err) {
      console.error("Failed to load drivers:", err);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const fetchTrips = async () => {
    try {
      setLoadingTrips(true);
      const res = await fetch("/api/delivery/trips");
      const data = await res.json();
      if (data.success && Array.isArray(data.trips)) {
        setTrips(data.trips);
      }
    } catch (err) {
      console.error("Failed to load trips:", err);
    } finally {
      setLoadingTrips(false);
    }
  };

  const fetchVanSessions = async () => {
    try {
      setLoadingVanSessions(true);
      const res = await fetch("/api/van-sales/sessions");
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        setVanSessions(data.sessions);
      }
    } catch (err) {
      console.error("Failed to load van sessions:", err);
    } finally {
      setLoadingVanSessions(false);
    }
  };

  const fetchStoreProducts = async () => {
    try {
      setLoadingStoreProducts(true);
      const res = await fetch("/api/products");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setStoreProducts(data.data);
      }
    } catch (err) {
      console.error("Failed to load store products:", err);
    } finally {
      setLoadingStoreProducts(false);
    }
  };

  useEffect(() => {
    if (activeTab === "FLEET_DRIVERS") {
      fetchDrivers();
    } else if (activeTab === "TRIP_RUNSHEETS" || activeTab === "COD_RECONCILIATION") {
      fetchTrips();
      fetchDrivers();
    } else if (activeTab === "VAN_SALES") {
      fetchVanSessions();
      fetchDrivers();
    }
  }, [activeTab]);

  const handleOpenLoadVanModal = () => {
    setIsLoadVanModalOpen(true);
    fetchDrivers();
    fetchStoreProducts();
    setNewVanDriverId("");
    setNewVanRouteZone("");
    setNewVanNotes("");
    setNewVanItems([]);
    setStoreProductSearch("");
  };

  const handleAddProductToVan = (prod: any) => {
    setNewVanItems((prev) => {
      const existing = prev.find((i) => i.productId === prod._id);
      if (existing) {
        if (existing.loadedQty >= prod.stockQuantity) return prev;
        return prev.map((i) =>
          i.productId === prod._id ? { ...i, loadedQty: i.loadedQty + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: prod._id,
          productName: prod.name,
          unit: prod.unit || "unit",
          costPrice: prod.costPrice || 0,
          unitPrice: prod.sellingPrice || 0,
          wholesalePrice: prod.wholesalePrice || (prod.sellingPrice * 0.9),
          loadedQty: 1,
          maxStock: prod.stockQuantity || 0,
        },
      ];
    });
  };

  const handleUpdateVanItemQty = (productId: string, qty: number) => {
    setNewVanItems((prev) =>
      prev.map((i) => {
        if (i.productId === productId) {
          const clamped = Math.max(0.1, Math.min(qty, i.maxStock));
          return { ...i, loadedQty: clamped };
        }
        return i;
      })
    );
  };

  const handleRemoveVanItem = (productId: string) => {
    setNewVanItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleCreateVanSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVanDriverId) {
      alert("Please select a driver for this van loading.");
      return;
    }
    if (newVanItems.length === 0) {
      alert("Please select at least one product to load into the van.");
      return;
    }
    for (const item of newVanItems) {
      if (item.loadedQty > item.maxStock) {
        alert(`Cannot load ${item.loadedQty} of ${item.productName}. Store stock is only ${item.maxStock}.`);
        return;
      }
    }
    try {
      setSubmittingVanLoad(true);
      const res = await fetch("/api/van-sales/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: newVanDriverId,
          routeZone: newVanRouteZone.trim() || undefined,
          notes: newVanNotes.trim() || undefined,
          items: newVanItems.map((i) => ({
            productId: i.productId,
            loadedQty: i.loadedQty,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMessage({
          type: "success",
          text: `Van Loading Sheet #${data.session?.sessionNumber} generated! Store stock decremented.`,
        });
        setIsLoadVanModalOpen(false);
        fetchVanSessions();
      } else {
        alert(data.error || "Failed to create van session.");
      }
    } catch {
      alert("Network error loading van.");
    } finally {
      setSubmittingVanLoad(false);
    }
  };

  const handleUpdateVanSessionStatus = async (sessionId: string, action: "START_ROUTE" | "COMPLETE_ROUTE") => {
    try {
      const res = await fetch(`/api/van-sales/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMessage({
          type: "success",
          text: `Van session status updated to ${data.session?.status}.`,
        });
        fetchVanSessions();
      } else {
        alert(data.error || "Failed to update van status.");
      }
    } catch {
      alert("Network error updating van status.");
    }
  };

  const handleOpenVanReconcileModal = (session: any) => {
    setReconcilingVanSession(session);
    setVanPhysicalCashSubmitted((session.salesSummary?.cashCollected || 0).toString());
    const initialReturns: { [productId: string]: { returnedQty: number; damagedQty: number } } = {};
    for (const item of session.items || []) {
      initialReturns[item.productId.toString()] = {
        returnedQty: item.remainingQty || 0,
        damagedQty: 0,
      };
    }
    setVanReturnItemsState(initialReturns);
    setVanReconciliationNotes("");
  };

  const handleSubmitVanReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcilingVanSession) return;
    try {
      setSubmittingVanReconciliation(true);
      const returnedItemsPayload = Object.entries(vanReturnItemsState).map(([productId, val]) => ({
        productId,
        returnedQty: Number(val.returnedQty) || 0,
        damagedQty: Number(val.damagedQty) || 0,
      }));

      const res = await fetch(`/api/van-sales/sessions/${reconcilingVanSession._id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          physicalCashSubmitted: parseFloat(vanPhysicalCashSubmitted) || 0,
          returnedItems: returnedItemsPayload,
          notes: vanReconciliationNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedbackMessage({
          type: "success",
          text: `Van Session #${reconcilingVanSession.sessionNumber} reconciled! Returned stock restored to store.`,
        });
        setReconcilingVanSession(null);
        fetchVanSessions();
      } else {
        alert(data.error || "Failed to reconcile van session.");
      }
    } catch {
      alert("Network error reconciling van session.");
    } finally {
      setSubmittingVanReconciliation(false);
    }
  };

  const handleSendTrackingSms = async (orderId?: string, tripId?: string) => {
    try {
      if (orderId) setSendingSmsOrderId(orderId);
      if (tripId) setSendingSmsTripId(tripId);

      const res = await fetch("/api/delivery/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, tripId }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMessage({
          type: "success",
          text: data.message || "Customer delivery tracking alerts dispatched via SMS successfully!",
        });
        fetchOrders();
        if (tripId) fetchTrips();
      } else {
        setFeedbackMessage({
          type: "error",
          text: data.error || "Failed to send tracking SMS alert.",
        });
      }
    } catch {
      setFeedbackMessage({
        type: "error",
        text: "Network error sending delivery tracking alerts.",
      });
    } finally {
      setSendingSmsOrderId(null);
      setSendingSmsTripId(null);
    }
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim() || !newDriverPhone.trim() || !newDriverVehicleNumber.trim()) {
      alert("Driver name, phone, and vehicle registration number are required.");
      return;
    }
    try {
      setSubmittingDriver(true);
      const res = await fetch("/api/delivery/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDriverName.trim(),
          phone: newDriverPhone.trim(),
          vehicleType: newDriverVehicleType,
          vehicleNumber: newDriverVehicleNumber.trim().toUpperCase(),
          nicNumber: newDriverNic.trim() || undefined,
          notes: newDriverNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMessage({ type: "success", text: `Driver ${newDriverName} registered successfully!` });
        setIsNewDriverModalOpen(false);
        setNewDriverName("");
        setNewDriverPhone("");
        setNewDriverVehicleNumber("");
        setNewDriverNic("");
        setNewDriverNotes("");
        fetchDrivers();
      } else {
        alert(data.error || "Failed to create driver.");
      }
    } catch {
      alert("Network error creating driver.");
    } finally {
      setSubmittingDriver(false);
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripDriverId) {
      alert("Please select a driver for this trip.");
      return;
    }
    if (tripOrderIds.length === 0) {
      alert("Please select at least one delivery order.");
      return;
    }
    try {
      setSubmittingTrip(true);
      const res = await fetch("/api/delivery/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: tripDriverId,
          orderIds: tripOrderIds,
          notes: tripNotes.trim() || undefined,
          dispatchImmediately: tripDispatchImmediately,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMessage({ type: "success", text: `Trip ${data.trip?.tripNumber} created successfully!` });
        setIsNewTripModalOpen(false);
        setTripOrderIds([]);
        setTripNotes("");
        fetchTrips();
        fetchOrders();
      } else {
        alert(data.error || "Failed to create trip.");
      }
    } catch {
      alert("Network error creating trip.");
    } finally {
      setSubmittingTrip(false);
    }
  };

  const handleDispatchTrip = async (tripId: string) => {
    try {
      const res = await fetch("/api/delivery/trips", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, action: "DISPATCH" }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMessage({ type: "success", text: data.message || "Trip dispatched successfully!" });
        fetchTrips();
        fetchOrders();
      } else {
        alert(data.error || "Failed to dispatch trip.");
      }
    } catch {
      alert("Network error dispatching trip.");
    }
  };

  const handleReconcileTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcilingTrip) return;
    try {
      setSubmittingReconciliation(true);
      const res = await fetch("/api/delivery/trips", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: reconcilingTrip._id,
          action: "RECONCILE",
          cashDrawerAmountSubmitted: parseFloat(cashDrawerAmountSubmitted) || 0,
          cashierNotes: cashierReconciliationNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMessage({ type: "success", text: data.message || "Trip cash reconciled successfully!" });
        setReconcilingTrip(null);
        setCashDrawerAmountSubmitted("");
        setCashierReconciliationNotes("");
        fetchTrips();
        fetchOrders();
      } else {
        alert(data.error || "Failed to reconcile trip.");
      }
    } catch {
      alert("Network error reconciling trip.");
    } finally {
      setSubmittingReconciliation(false);
    }
  };

  const handleCancelTrip = async (tripId: string) => {
    if (!confirm("Are you sure you want to cancel this trip? Orders will be returned to Ready for Pickup queue.")) return;
    try {
      const res = await fetch("/api/delivery/trips", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, action: "CANCEL" }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMessage({ type: "success", text: data.message || "Trip cancelled." });
        fetchTrips();
        fetchOrders();
      } else {
        alert(data.error || "Failed to cancel trip.");
      }
    } catch {
      alert("Network error cancelling trip.");
    }
  };

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

        {feedbackMessage && (
          <div
            className={`mx-4 sm:mx-6 mt-4 p-3 rounded-2xl flex items-center justify-between border shadow-2xs animate-in fade-in transition ${
              feedbackMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="p-1 hover:opacity-70 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
              onClick={() => setActiveTab("FLEET_DRIVERS")}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shrink-0 ${
                activeTab === "FLEET_DRIVERS"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Fleet & Drivers ({drivers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("TRIP_RUNSHEETS")}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shrink-0 ${
                activeTab === "TRIP_RUNSHEETS"
                  ? "bg-blue-700 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Dispatch Runsheets ({trips.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("COD_RECONCILIATION")}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shrink-0 ${
                activeTab === "COD_RECONCILIATION"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Driver COD Cash</span>
              {trips.filter((t) => t.status === "DISPATCHED" || t.cashierReconciliation?.status === "PENDING").length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                  {trips.filter((t) => t.status === "DISPATCHED" || t.cashierReconciliation?.status === "PENDING").length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("RECONCILIATION")}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shrink-0 ${
                activeTab === "RECONCILIATION"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>📊 Aggregator Payout</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("VAN_SALES");
                fetchVanSessions();
              }}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shrink-0 ${
                activeTab === "VAN_SALES"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>🚐 Van Sales & In-Transit ({vanSessions.length})</span>
              {vanSessions.filter((s) => s.status === "LOADED" || s.status === "ON_ROUTE").length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-400 text-slate-900">
                  {vanSessions.filter((s) => s.status === "LOADED" || s.status === "ON_ROUTE").length} Active
                </span>
              )}
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
          {["PENDING_ACCEPT", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"].includes(activeTab) && (
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

                          {/* Doorstep Proof of Delivery Button if present */}
                          {order.proofOfDelivery && (
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => setViewingPodOrder(order)}
                                className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-2xs"
                              >
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>View Doorstep POD ({order.proofOfDelivery.receivedBy || "Signed"})</span>
                              </button>
                            </div>
                          )}

                          {/* Live Customer Tracking & Dispatch Alerts */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                            <a
                              href={`/delivery/track/${order.trackingToken || order._id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center gap-1.5 transition text-[11px]"
                              title="Open Customer Live Tracking Page"
                            >
                              <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                              <span>Live Tracker</span>
                            </a>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const link = `${window.location.origin}/delivery/track/${order.trackingToken || order._id}`;
                                  navigator.clipboard.writeText(link);
                                  setCopiedTrackingOrderId(order._id);
                                  setTimeout(() => setCopiedTrackingOrderId(null), 3000);
                                }}
                                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
                                title="Copy Customer Tracking Link"
                              >
                                {copiedTrackingOrderId === order._id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <a
                                href={buildWhatsAppUrl(
                                  order.customer.phone,
                                  `Dear ${order.customer.name}, your order ${order.externalOrderId} from ${businessName} is being tracked live! View rider location & arrival ETA: ${
                                    typeof window !== "undefined" ? window.location.origin : ""
                                  }/delivery/track/${order.trackingToken || order._id}`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 transition"
                                title="Share Tracking Link via WhatsApp"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </a>

                              <button
                                type="button"
                                onClick={() => handleSendTrackingSms(order._id)}
                                disabled={sendingSmsOrderId === order._id}
                                className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 text-[10px] transition ${
                                  order.trackingSmsStatus === "SENT"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                                }`}
                                title="Dispatch SMS tracking alert to customer"
                              >
                                <Send className="w-3 h-3" />
                                <span>
                                  {sendingSmsOrderId === order._id
                                    ? "Sending..."
                                    : order.trackingSmsStatus === "SENT"
                                    ? "SMS Sent"
                                    : "Send SMS"}
                                </span>
                              </button>
                            </div>
                          </div>

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

          {/* ================= TAB 7: FLEET & DRIVERS ================= */}
          {activeTab === "FLEET_DRIVERS" && (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
              {/* Fleet Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Drivers</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{drivers.length}</div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">Registered fleet drivers</span>
                </div>
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">Active On-Duty</span>
                  <div className="text-2xl font-black text-emerald-600 mt-1">
                    {drivers.filter((d) => d.active).length}
                  </div>
                  <span className="text-[11px] text-emerald-600/80 mt-0.5 block">Available for trip dispatch</span>
                </div>
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block">Deliveries Completed</span>
                  <div className="text-2xl font-black text-blue-900 mt-1">
                    {drivers.reduce((sum, d) => sum + (d.totalDeliveriesCompleted || 0), 0)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">Lifetime doorstep handovers</span>
                </div>
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">Total COD Handed Over</span>
                  <div className="text-2xl font-black font-mono text-amber-700 mt-1">
                    {formatCurrency(drivers.reduce((sum, d) => sum + (d.totalCodCollected || 0), 0))}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">Reconciled driver cash drops</span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Express Fleet Drivers</h3>
                  <p className="text-xs text-slate-500">
                    Each driver has a secure, passwordless mobile runsheet URL for GPS navigation, phone calls, and doorstep touch signature POD.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewDriverModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register New Driver</span>
                </button>
              </div>

              {/* Drivers Grid */}
              {loadingDrivers ? (
                <div className="py-16 text-center text-slate-400 text-xs">Loading fleet drivers...</div>
              ) : drivers.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                    <Users className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">No Fleet Drivers Registered</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Register your in-house tuk-tuk, bike, or van drivers to assign trips, track parcel handovers, and collect doorstep POD signatures.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsNewDriverModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    + Register Driver
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {drivers.map((drv) => {
                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                    const driverAppUrl = `${origin}/delivery/driver/${drv.driverToken}`;
                    const waShareUrl = buildWhatsAppUrl(
                      drv.phone,
                      `Hello ${drv.name}, here is your personal Express Delivery mobile dispatch link: ${driverAppUrl}`
                    );

                    return (
                      <div
                        key={drv._id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 hover:shadow-sm transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center">
                              {drv.vehicleType === "BIKE" ? (
                                <Bike className="w-5 h-5" />
                              ) : drv.vehicleType === "VAN" ? (
                                <Truck className="w-5 h-5" />
                              ) : (
                                <Car className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm">{drv.name}</div>
                              <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <a href={`tel:${drv.phone}`} className="hover:underline">
                                  {drv.phone}
                                </a>
                              </div>
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              drv.active
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {drv.active ? "Active" : "Inactive"}
                          </span>
                        </div>

                        {/* Vehicle & Trip Info */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Vehicle:</span>
                            <span className="font-bold text-slate-800">
                              {drv.vehicleType.replace("_", " ")} ({drv.vehicleNumber})
                            </span>
                          </div>
                          {drv.nicNumber && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">NIC:</span>
                              <span className="font-mono text-slate-700">{drv.nicNumber}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-1 border-t border-slate-200/60">
                            <span className="text-slate-500">Current Trip:</span>
                            {drv.activeTrip ? (
                              <span className="font-mono font-bold text-blue-700">
                                {drv.activeTrip.tripNumber} ({drv.activeTrip.completedStops}/{drv.activeTrip.totalStops})
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium">Standby / Available</span>
                            )}
                          </div>
                        </div>

                        {/* Lifetime Stats */}
                        <div className="grid grid-cols-2 gap-2 text-center text-xs">
                          <div className="p-2 bg-slate-50 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Deliveries</span>
                            <span className="font-black text-slate-900 font-mono text-sm">
                              {drv.totalDeliveriesCompleted || 0}
                            </span>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">COD Collected</span>
                            <span className="font-black text-amber-700 font-mono text-sm">
                              {formatCurrency(drv.totalCodCollected || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Driver Mobile Portal Link */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                            <span>Driver Mobile Dispatch Link:</span>
                            <a
                              href={driverAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-0.5 text-[10px]"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(driverAppUrl);
                                setCopiedDriverToken(drv._id);
                                setTimeout(() => setCopiedDriverToken(null), 3000);
                              }}
                              className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5"
                            >
                              {copiedDriverToken === drv._id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>

                            <a
                              href={waShareUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5"
                            >
                              <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 8: TRIP RUNSHEETS & DISPATCH ================= */}
          {activeTab === "TRIP_RUNSHEETS" && (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Delivery Runsheets & Trip Manifests</h3>
                  <p className="text-xs text-slate-500">
                    Group ready orders into a single driver trip, print route manifests, and track live stop completion.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const readyOrders = orders.filter((o) => o.status === "READY_FOR_PICKUP" || o.status === "ACCEPTED");
                    setTripOrderIds(readyOrders.map((o) => o._id));
                    setIsNewTripModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Delivery Trip</span>
                </button>
              </div>

              {loadingTrips ? (
                <div className="py-16 text-center text-slate-400 text-xs">Loading delivery trips...</div>
              ) : trips.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <ClipboardList className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">No Delivery Trips Created Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Batch orders currently in "Ready for Pickup" into a trip manifest assigned to a driver for delivery.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsNewTripModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    + Create Trip
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {trips.map((tr) => {
                    const isDispatched = tr.status === "DISPATCHED";
                    const isCompleted = tr.status === "COMPLETED";
                    const isDraft = tr.status === "DRAFT";
                    const progress = tr.totalStops > 0 ? Math.round((tr.completedStops / tr.totalStops) * 100) : 0;

                    return (
                      <div
                        key={tr._id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
                              {tr.vehicleType === "BIKE" ? (
                                <Bike className="w-5 h-5" />
                              ) : tr.vehicleType === "VAN" ? (
                                <Truck className="w-5 h-5" />
                              ) : (
                                <Car className="w-5 h-5" />
                              )}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 text-base font-mono">{tr.tripNumber}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isCompleted
                                      ? "bg-slate-100 text-slate-700"
                                      : isDispatched
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {tr.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">
                                Driver: <strong className="text-slate-800">{tr.driverName}</strong> ({tr.driverPhone}) • {tr.vehicleNumber}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setViewingRouteTrip(tr)}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                              title="Inspect sequential stops and open Google Maps route"
                            >
                              <Route className="w-3.5 h-3.5" />
                              <span>Route Map ({tr.stops.length})</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSendTrackingSms(undefined, tr._id)}
                              disabled={sendingSmsTripId === tr._id}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                              title="Send live tracking SMS to all customers on this trip"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{sendingSmsTripId === tr._id ? "Sending SMS..." : "SMS All"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedRunsheetTrip(tr)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print Manifest</span>
                            </button>

                            {isDraft && (
                              <button
                                type="button"
                                onClick={() => handleDispatchTrip(tr._id)}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                              >
                                Dispatch Trip
                              </button>
                            )}

                            {isDispatched && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReconcilingTrip(tr);
                                  setCashDrawerAmountSubmitted(tr.totalCodCollected.toString());
                                }}
                                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                <span>Reconcile Cash</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar & Financials */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Delivery Progress</span>
                            <div className="font-bold text-slate-900 mt-0.5">
                              {tr.completedStops} / {tr.totalStops} Stops Completed ({progress}%)
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Expected COD</span>
                            <div className="font-mono font-bold text-slate-900 mt-0.5">
                              {formatCurrency(tr.totalCodExpected)}
                            </div>
                            <span className="text-[10px] text-slate-400">Total billable on delivery</span>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Collected COD</span>
                            <div className="font-mono font-black text-amber-700 mt-0.5">
                              {formatCurrency(tr.totalCodCollected)}
                            </div>
                            <span className="text-[10px] text-slate-400">Cash in driver's pocket</span>
                          </div>
                        </div>

                        {/* Stops sequence overview */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Route Stops ({tr.stops.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {tr.stops.map((st) => (
                              <div
                                key={st.stopSequence}
                                className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                                  st.status === "DELIVERED"
                                    ? "bg-emerald-50/60 border-emerald-200"
                                    : st.status === "FAILED"
                                    ? "bg-rose-50/60 border-rose-200"
                                    : "bg-slate-50 border-slate-200"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                                    {st.stopSequence}
                                  </span>
                                  <div>
                                    <div className="font-bold text-slate-900 leading-tight">{st.orderNumber}</div>
                                    <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                                      {st.customerName}
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  {st.isCod ? (
                                    <span className="font-mono text-[10px] font-bold text-amber-800">
                                      {formatCurrency(st.codAmount)}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-emerald-700">PAID</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 9: DRIVER COD RECONCILIATION ================= */}
          {activeTab === "COD_RECONCILIATION" && (
            <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Total Driver COD Handed Over
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
                    {formatCurrency(
                      trips
                        .filter((t) => t.cashierReconciliation?.status === "RECONCILED")
                        .reduce((sum, t) => sum + (t.cashierReconciliation?.cashDrawerAmountSubmitted || t.totalCodCollected), 0)
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">Reconciled and banked in POS drawer</span>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">
                    Pending Driver Cash in Bag
                  </span>
                  <div className="text-2xl font-black font-mono text-amber-700 mt-1">
                    {formatCurrency(
                      trips
                        .filter((t) => t.status === "DISPATCHED" || t.cashierReconciliation?.status === "PENDING")
                        .reduce((sum, t) => sum + (t.totalCodCollected || 0), 0)
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">Awaiting cashier return verification</span>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs">
                  <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider block">
                    Cash Discrepancies
                  </span>
                  <div className="text-2xl font-black font-mono text-rose-700 mt-1">
                    {trips.filter((t) => t.cashierReconciliation?.status === "DISCREPANCY").length} Trips
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">Shortage or overage noted</span>
                </div>
              </div>

              {/* Trips Awaiting Reconciliation Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">Driver Cash Handover Register</h3>
                  <span className="text-xs text-slate-400">Match driver collection against trip manifest</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-4">Trip #</th>
                        <th className="py-3 px-4">Driver & Vehicle</th>
                        <th className="py-3 px-4 text-center">Stops</th>
                        <th className="py-3 px-4 text-right">Expected COD</th>
                        <th className="py-3 px-4 text-right">Driver Collected</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trips.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            No trips found. Create and dispatch a delivery trip to record driver COD.
                          </td>
                        </tr>
                      ) : (
                        trips.map((tr) => (
                          <tr key={tr._id} className="hover:bg-slate-50/60">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {tr.tripNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800">{tr.driverName}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {tr.vehicleNumber} ({tr.vehicleType})
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-bold">
                              {tr.completedStops} / {tr.totalStops}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">
                              {formatCurrency(tr.totalCodExpected)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-amber-700 text-sm">
                              {formatCurrency(tr.totalCodCollected)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  tr.cashierReconciliation?.status === "RECONCILED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : tr.cashierReconciliation?.status === "DISCREPANCY"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {tr.cashierReconciliation?.status || "PENDING"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {tr.cashierReconciliation?.status === "RECONCILED" ? (
                                <span className="text-[11px] text-slate-400">
                                  Settled by {tr.cashierReconciliation.reconciledBy}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReconcilingTrip(tr);
                                    setCashDrawerAmountSubmitted(tr.totalCodCollected.toString());
                                  }}
                                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-2xs"
                                >
                                  Reconcile Cash
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
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

          {/* ================= TAB 10: VAN SALES & IN-TRANSIT FLEET ================= */}
          {activeTab === "VAN_SALES" && (
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Header with KPI cards */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    <span>Van Spot Sales & In-Transit Fleet Logistics</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Allocate store stock to delivery vehicles, record spot sales on route, and reconcile end-of-shift returns & cash
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenLoadVanModal}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Load New Van (Stock Allocation)</span>
                  </button>
                  <button
                    type="button"
                    onClick={fetchVanSessions}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
                    title="Refresh Van Sessions"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingVanSessions ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Active Vans On Route
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
                    <span>
                      {vanSessions.filter((s) => s.status === "LOADED" || s.status === "ON_ROUTE").length}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Fleet Active
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {vanSessions.filter((s) => s.status === "RECONCILED").length} settled shifts
                  </span>
                </div>

                <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Total Van Spot Sales
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-1">
                    {formatCurrency(
                      vanSessions.reduce((acc, s) => acc + (s.salesSummary?.netSalesTotal || 0), 0)
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {vanSessions.reduce((acc, s) => acc + (s.salesSummary?.totalSalesCount || 0), 0)} spot transactions
                  </span>
                </div>

                <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
                    Physical Cash Collected
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-600 mt-1">
                    {formatCurrency(
                      vanSessions.reduce((acc, s) => acc + (s.salesSummary?.cashCollected || 0), 0)
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">To be settled at cash counter</span>
                </div>

                <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider block">
                    In-Transit Inventory
                  </span>
                  <div className="text-2xl font-black font-mono text-indigo-600 mt-1">
                    {vanSessions
                      .filter((s) => s.status === "LOADED" || s.status === "ON_ROUTE")
                      .reduce(
                        (acc, s) =>
                          acc + (s.items?.reduce((ia: number, i: any) => ia + (i.remainingQty || 0), 0) || 0),
                        0
                      )
                      .toFixed(0)}{" "}
                    <span className="text-xs font-bold text-slate-500 font-sans">units</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">Currently inside vehicles</span>
                </div>
              </div>

              {/* Sessions List */}
              {loadingVanSessions ? (
                <div className="py-16 text-center text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
                  <p className="text-sm font-semibold">Loading van sessions...</p>
                </div>
              ) : vanSessions.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center max-w-lg mx-auto">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Truck className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">No Van Sales Sessions Yet</h3>
                  <p className="text-xs text-slate-500 mb-6">
                    Start by loading a delivery van with store products. Drivers can sell items directly off the vehicle, print thermal receipts, accept LankaQR, and return unsold stock at the end of the shift.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenLoadVanModal}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 mx-auto shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Load First Van</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {vanSessions.map((session) => {
                    const sessionDriver = drivers.find(
                      (d) =>
                        d._id === session.driverId?.toString() ||
                        d._id === (session.driverId?._id || session.driverId)?.toString()
                    );
                    const driverToken = sessionDriver?.driverToken;

                    const totalLoaded = session.items?.reduce((a: number, i: any) => a + (i.loadedQty || 0), 0) || 0;
                    const totalSold = session.items?.reduce((a: number, i: any) => a + (i.soldQty || 0), 0) || 0;
                    const totalRemaining = session.items?.reduce((a: number, i: any) => a + (i.remainingQty || 0), 0) || 0;

                    return (
                      <div
                        key={session._id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition space-y-4"
                      >
                        {/* Top row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                              <Truck className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 text-sm">{session.sessionNumber}</h3>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    session.status === "RECONCILED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : session.status === "ON_ROUTE"
                                      ? "bg-blue-100 text-blue-800 animate-pulse"
                                      : session.status === "COMPLETED"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {session.status}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                Loaded {new Date(session.loadedAt).toLocaleString("en-LK")}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Manifest Slip print button */}
                            <button
                              type="button"
                              onClick={() => setSelectedVanSlipSession(session)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Loading Sheet & Manifest</span>
                            </button>

                            {/* Driver mobile link */}
                            {driverToken && (
                              <a
                                href={`/delivery/driver/${driverToken}/van-pos`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1.5"
                                title="Open Driver Mobile Van POS"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Driver POS</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Driver & Route Info */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl text-xs">
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Driver</span>
                            <span className="font-bold text-slate-900">{session.driverName}</span>
                            <span className="text-slate-500 text-[11px] block">{session.driverPhone}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Vehicle</span>
                            <span className="font-bold text-slate-900">{session.vehicleNumber}</span>
                            <span className="text-slate-500 text-[11px] block">{session.vehicleType}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Route Zone</span>
                            <span className="font-bold text-slate-900">{session.routeZone || "General Route"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase font-bold block">In-Transit Units</span>
                            <span className="font-bold text-indigo-700">
                              {totalRemaining.toFixed(0)} / {totalLoaded.toFixed(0)} units
                            </span>
                            <span className="text-[10px] text-emerald-600 block">{totalSold.toFixed(0)} units sold</span>
                          </div>
                        </div>

                        {/* Financial Snapshot */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                            <span className="text-emerald-700 text-[10px] font-bold uppercase block">Net Spot Sales</span>
                            <span className="font-mono font-bold text-emerald-900 text-sm">
                              {formatCurrency(session.salesSummary?.netSalesTotal || 0)}
                            </span>
                            <span className="text-[10px] text-emerald-700 block">
                              {session.salesSummary?.totalSalesCount || 0} invoices
                            </span>
                          </div>
                          <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
                            <span className="text-blue-700 text-[10px] font-bold uppercase block">Cash Collected</span>
                            <span className="font-mono font-bold text-blue-900 text-sm">
                              {formatCurrency(session.salesSummary?.cashCollected || 0)}
                            </span>
                          </div>
                          <div className="bg-teal-50/60 p-2.5 rounded-xl border border-teal-100">
                            <span className="text-teal-700 text-[10px] font-bold uppercase block">LankaQR</span>
                            <span className="font-mono font-bold text-teal-900 text-sm">
                              {formatCurrency(session.salesSummary?.lankaQrCollected || 0)}
                            </span>
                          </div>
                          <div className="bg-purple-50/60 p-2.5 rounded-xl border border-purple-100">
                            <span className="text-purple-700 text-[10px] font-bold uppercase block">Credit Book</span>
                            <span className="font-mono font-bold text-purple-900 text-sm">
                              {formatCurrency(session.salesSummary?.creditCollected || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Reconciliation Alert Banner if already reconciled */}
                        {session.status === "RECONCILED" && session.cashierReconciliation && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <div>
                                <span className="font-bold text-emerald-900">
                                  Shift Audited by {session.cashierReconciliation.reconciledBy || "Cashier"}
                                </span>
                                <span className="text-emerald-700 text-[11px] block">
                                  Physical cash submitted: {formatCurrency(session.cashierReconciliation.physicalCashSubmitted || 0)} &bull;{" "}
                                  Variance: {formatCurrency(session.cashierReconciliation.cashShortageOrOverage || 0)}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded">
                              RECONCILED
                            </span>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          {session.status === "LOADED" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateVanSessionStatus(session._id, "START_ROUTE")}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>Dispatch & Start Route</span>
                            </button>
                          )}

                          {session.status === "ON_ROUTE" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateVanSessionStatus(session._id, "COMPLETE_ROUTE")}
                              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>End Route / Return to Store</span>
                            </button>
                          )}

                          {(session.status === "ON_ROUTE" || session.status === "COMPLETED") && (
                            <button
                              type="button"
                              onClick={() => handleOpenVanReconcileModal(session)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              <span>Reconcile Stock Returns & Cash</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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

        {/* MODAL 4: REGISTER NEW DELIVERY DRIVER */}
        {isNewDriverModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Register Fleet Driver</h3>
                    <p className="text-xs text-slate-500">In-house dispatch & COD collection rider</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewDriverModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateDriver} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Driver Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kasun Chamara Perera"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 font-medium text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mobile Phone Number (07XXXXXXXX) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0771234567"
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-slate-900 text-xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Used to send WhatsApp runsheet dispatch links and SMS notifications.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Vehicle Type *</label>
                    <select
                      value={newDriverVehicleType}
                      onChange={(e) => setNewDriverVehicleType(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="THREE_WHEELER">Three-Wheeler (Tuk-Tuk)</option>
                      <option value="BIKE">Motorcycle / Scooter</option>
                      <option value="CAR">Car</option>
                      <option value="VAN">Delivery Van / Truck</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Vehicle Reg Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. WP BDF-4592"
                      value={newDriverVehicleNumber}
                      onChange={(e) => setNewDriverVehicleNumber(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:outline-none focus:border-slate-900 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">National Identity Card (NIC) (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 199412304581 or 941234567V"
                    value={newDriverNic}
                    onChange={(e) => setNewDriverNic(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:outline-none focus:border-slate-900 text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Notes & Availability (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Available 11am-8pm, Colombo South deliveries only"
                    value={newDriverNotes}
                    onChange={(e) => setNewDriverNotes(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-xs"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewDriverModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDriver}
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs disabled:opacity-50 transition shadow-sm"
                  >
                    {submittingDriver ? "Registering..." : "Register Driver"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 5: CREATE TRIP RUNSHEET */}
        {isNewTripModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Create Delivery Runsheet</h3>
                    <p className="text-xs text-slate-500">Assign stops to a fleet driver with COD tracking</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewTripModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTrip} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
                {/* Driver Selection */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Select Driver *</label>
                  {drivers.filter((d) => d.active).length === 0 ? (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
                      No active fleet drivers registered. Please register a driver in the Fleet tab first.
                    </div>
                  ) : (
                    <select
                      required
                      value={tripDriverId}
                      onChange={(e) => setTripDriverId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    >
                      <option value="">-- Choose fleet driver --</option>
                      {drivers
                        .filter((d) => d.active)
                        .map((drv) => (
                          <option key={drv._id} value={drv._id}>
                            {drv.name} ({drv.vehicleType}) - {drv.vehicleNumber} {drv.activeTrip ? "⚠️ (Currently on Active Trip)" : "✓ (Ready)"}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                {/* Orders to Deliver */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 block">
                      Select Delivery Stops / Orders * ({tripOrderIds.length} selected)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const eligible = orders.filter((o) => !o.tripId && o.status !== "DELIVERED" && o.status !== "CANCELLED" && o.status !== "REJECTED");
                          setTripOrderIds(eligible.map((o) => o._id));
                        }}
                        className="text-blue-600 hover:underline font-bold text-[11px]"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setTripOrderIds([])}
                        className="text-slate-500 hover:underline font-medium text-[11px]"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto bg-slate-50/50">
                    {orders.filter((o) => !o.tripId && o.status !== "DELIVERED" && o.status !== "CANCELLED" && o.status !== "REJECTED").length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        No unassigned delivery orders available. Orders must not already be assigned to an active trip.
                      </div>
                    ) : (
                      orders
                        .filter((o) => !o.tripId && o.status !== "DELIVERED" && o.status !== "CANCELLED" && o.status !== "REJECTED")
                        .map((o) => {
                          const isSelected = tripOrderIds.includes(o._id);
                          const isCod = o.cashOnDelivery?.isCod ?? (o.platform === "DIRECT_STORE");
                          const codAmt = o.cashOnDelivery?.expectedAmount ?? o.financials?.totalBill ?? 0;

                          return (
                            <label
                              key={o._id}
                              className={`p-3 flex items-start gap-3 cursor-pointer transition ${
                                isSelected ? "bg-blue-50/70" : "hover:bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setTripOrderIds([...tripOrderIds, o._id]);
                                  } else {
                                    setTripOrderIds(tripOrderIds.filter((id) => id !== o._id));
                                  }
                                }}
                                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-slate-900 text-xs">
                                    {o.externalOrderId}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                    {o.platform}
                                  </span>
                                </div>
                                <div className="font-medium text-slate-800 text-xs mt-0.5">
                                  {o.customer.name} • {o.customer.phone}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {o.customer.deliveryAddress}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">{o.items.length} item(s)</span>
                                  {isCod ? (
                                    <span className="font-mono font-bold text-amber-700">
                                      COD: {formatCurrency(codAmt)}
                                    </span>
                                  ) : (
                                    <span className="font-bold text-emerald-700">Prepaid</span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Dispatch options & notes */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 bg-blue-50/60 rounded-xl border border-blue-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tripDispatchImmediately}
                      onChange={(e) => setTripDispatchImmediately(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-blue-900 block text-xs">
                        Dispatch Immediately
                      </span>
                      <span className="text-[10px] text-blue-700">
                        Mark stops as Out for Delivery and notify driver's mobile runsheet app.
                      </span>
                    </div>
                  </label>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Route & Driver Instructions (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Deliver Havelock Town orders first, collect cash carefully"
                      value={tripNotes}
                      onChange={(e) => setTripNotes(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-xs"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewTripModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTrip || tripOrderIds.length === 0 || !tripDriverId}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs disabled:opacity-50 transition shadow-sm"
                  >
                    {submittingTrip ? "Creating Runsheet..." : `Create Trip (${tripOrderIds.length} stops)`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 6: PRINT DELIVERY RUNSHEET MANIFEST */}
        {selectedRunsheetTrip && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-5 shadow-2xl flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Trip Runsheet & Manifest</h3>
                    <p className="text-xs text-slate-500 font-mono">Trip #{selectedRunsheetTrip.tripNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRunsheetTrip(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3">
                <DeliveryRunsheetSlip
                  data={{
                    tripNumber: selectedRunsheetTrip.tripNumber,
                    storeName: businessName,
                    dispatchedAt: selectedRunsheetTrip.dispatchedAt,
                    driverName: selectedRunsheetTrip.driverName,
                    driverPhone: selectedRunsheetTrip.driverPhone,
                    vehicleType: selectedRunsheetTrip.vehicleType,
                    vehicleNumber: selectedRunsheetTrip.vehicleNumber,
                    totalStops: selectedRunsheetTrip.totalStops,
                    completedStops: selectedRunsheetTrip.completedStops,
                    totalCodExpected: selectedRunsheetTrip.totalCodExpected,
                    totalCodCollected: selectedRunsheetTrip.totalCodCollected,
                    stops: selectedRunsheetTrip.stops.map((s) => ({
                      stopSequence: s.stopSequence,
                      orderNumber: s.orderNumber,
                      customerName: s.customerName,
                      customerPhone: s.customerPhone,
                      deliveryAddress: s.deliveryAddress,
                      deliveryNotes: s.deliveryNotes,
                      isCod: s.isCod,
                      codAmount: s.codAmount,
                      status: s.status,
                    })),
                    notes: selectedRunsheetTrip.notes,
                    driverPortalUrl: (() => {
                      const drv = drivers.find((d) => d._id === selectedRunsheetTrip.driverId);
                      return drv?.driverToken && typeof window !== "undefined"
                        ? `${window.location.origin}/delivery/driver/${drv.driverToken}`
                        : undefined;
                    })(),
                  }}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRunsheetTrip(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Runsheet (80mm / A4)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 7: CASHIER COD RECONCILIATION */}
        {reconcilingTrip && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Driver Cash Handover</h3>
                    <p className="text-xs text-slate-500 font-mono">Trip #{reconcilingTrip.tripNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReconcilingTrip(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleReconcileTrip} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
                {/* Trip summary */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{reconcilingTrip.driverName}</span>
                    <span className="font-mono text-slate-500 text-[11px]">{reconcilingTrip.vehicleNumber}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Stops Completed: <strong className="text-slate-800">{reconcilingTrip.completedStops} / {reconcilingTrip.totalStops}</strong>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Expected COD</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {formatCurrency(reconcilingTrip.totalCodExpected)}
                      </span>
                    </div>
                    <div className="bg-amber-50 p-2 rounded-xl border border-amber-200">
                      <span className="text-[10px] text-amber-700 block font-bold uppercase">Driver Logged</span>
                      <span className="font-mono font-black text-amber-800 text-xs">
                        {formatCurrency(reconcilingTrip.totalCodCollected)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Physical Cash Input */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Physical Cash Bag Handed Over by Driver (LKR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={cashDrawerAmountSubmitted}
                    onChange={(e) => setCashDrawerAmountSubmitted(e.target.value)}
                    className="w-full p-3 bg-slate-50 border-2 border-amber-500 rounded-xl font-mono text-xl font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-amber-200"
                    placeholder="e.g. 5200"
                    autoFocus
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Count notes and coins from driver's cash bag into the store POS drawer.
                  </span>
                </div>

                {/* Variance Feedback */}
                {(() => {
                  const submitted = parseFloat(cashDrawerAmountSubmitted) || 0;
                  const diff = submitted - reconcilingTrip.totalCodCollected;
                  if (isNaN(submitted)) return null;

                  if (diff === 0) {
                    return (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Exact Match: Physical cash matches driver doorstep collection.</span>
                      </div>
                    );
                  } else if (diff < 0) {
                    return (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-bold text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Shortage of {formatCurrency(Math.abs(diff))}: Driver cash is less than logged.</span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-bold text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Overage of {formatCurrency(diff)}: Driver submitted extra cash.</span>
                      </div>
                    );
                  }
                })()}

                {/* Cashier Notes */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cashier Discrepancy / Handover Notes</label>
                  <textarea
                    rows={2}
                    value={cashierReconciliationNotes}
                    onChange={(e) => setCashierReconciliationNotes(e.target.value)}
                    placeholder="e.g. Customer rounded up Rs. 50, driver verified all 4 stops."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReconcilingTrip(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReconciliation || !cashDrawerAmountSubmitted}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs disabled:opacity-50 transition shadow-sm"
                  >
                    {submittingReconciliation ? "Reconciling..." : "Confirm & Deposit to Drawer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 8: DOORSTEP PROOF OF DELIVERY (POD) VIEWER */}
        {viewingPodOrder && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Proof of Delivery (POD)</h3>
                    <p className="text-xs text-slate-500 font-mono">Order #{viewingPodOrder.externalOrderId}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingPodOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
                {/* Customer & Delivery Details */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{viewingPodOrder.customer?.name}</span>
                    <span className="font-mono text-slate-500">{viewingPodOrder.customer?.phone}</span>
                  </div>
                  <div className="text-slate-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{viewingPodOrder.customer?.deliveryAddress}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Received by: <strong className="text-slate-800">{viewingPodOrder.proofOfDelivery?.receivedBy || "Customer"}</strong>
                    </span>
                    <span>
                      {viewingPodOrder.proofOfDelivery?.deliveredAt
                        ? new Date(viewingPodOrder.proofOfDelivery.deliveredAt).toLocaleString("en-LK")
                        : "Delivered"}
                    </span>
                  </div>
                </div>

                {/* Cash-on-Delivery Breakdown if COD */}
                {viewingPodOrder.cashOnDelivery?.isCod && (
                  <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-1 text-xs">
                    <div className="font-bold text-amber-900 uppercase text-[10px] tracking-wider">
                      Cash on Delivery Reconciliation
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-center">
                      <div className="bg-white p-2 rounded-xl border border-amber-200">
                        <span className="text-[10px] text-slate-400 block">Expected</span>
                        <span className="font-bold text-slate-800">
                          {formatCurrency(viewingPodOrder.cashOnDelivery.expectedAmount)}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-amber-200">
                        <span className="text-[10px] text-amber-700 block font-bold">Collected</span>
                        <span className="font-black text-amber-800">
                          {formatCurrency(viewingPodOrder.cashOnDelivery.collectedAmount || 0)}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-amber-200">
                        <span className="text-[10px] text-slate-400 block">Change Given</span>
                        <span className="font-bold text-slate-700">
                          {formatCurrency(viewingPodOrder.cashOnDelivery.changeGiven || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Proof Visuals: Signature & Photo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Customer Touch Signature</label>
                    {viewingPodOrder.proofOfDelivery?.signatureUrl ? (
                      <div className="bg-white p-2 rounded-2xl border border-slate-200 flex items-center justify-center">
                        <img
                          src={viewingPodOrder.proofOfDelivery.signatureUrl}
                          alt="Customer Signature"
                          className="w-full h-36 object-contain bg-slate-50/50 rounded-xl"
                        />
                      </div>
                    ) : (
                      <div className="h-36 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
                        No signature recorded
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Doorstep Photo Verification</label>
                    {viewingPodOrder.proofOfDelivery?.photoUrl ? (
                      <div className="bg-white p-2 rounded-2xl border border-slate-200 flex items-center justify-center">
                        <img
                          src={viewingPodOrder.proofOfDelivery.photoUrl}
                          alt="Doorstep Photo"
                          className="w-full h-36 object-cover rounded-xl"
                        />
                      </div>
                    ) : (
                      <div className="h-36 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
                        No doorstep photo uploaded
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery failure reason if applicable */}
                {viewingPodOrder.deliveryFailure && (
                  <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 space-y-1">
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>Delivery Attempt Failed: {viewingPodOrder.deliveryFailure.reason}</span>
                    </div>
                    {viewingPodOrder.deliveryFailure.notes && (
                      <p className="text-[11px] text-rose-700">{viewingPodOrder.deliveryFailure.notes}</p>
                    )}
                    {viewingPodOrder.deliveryFailure.failedAt && (
                      <span className="text-[10px] text-rose-500 block">
                        Attempted at: {new Date(viewingPodOrder.deliveryFailure.failedAt).toLocaleString("en-LK")}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingPodOrder(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                >
                  Close Proof of Delivery
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 9: ROUTE MAP & STOPS VISUALIZER */}
        {viewingRouteTrip && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Route className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Route Itinerary & Stops — Trip #{viewingRouteTrip.tripNumber}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Driver: <strong className="text-slate-800">{viewingRouteTrip.driverName}</strong> ({viewingRouteTrip.vehicleNumber}) • {viewingRouteTrip.completedStops} of {viewingRouteTrip.totalStops} stops completed
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingRouteTrip(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
                {/* Driver Navigation Action Bar */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Turn-by-Turn Route Navigation
                    </span>
                    <span className="text-xs text-slate-700 font-medium">
                      Open all sequenced stops directly in Google Maps directions:
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/${viewingRouteTrip.stops
                        .map((s) => encodeURIComponent(s.deliveryAddress))
                        .join("/")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 shadow-sm transition shrink-0"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Google Maps Route</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleSendTrackingSms(undefined, viewingRouteTrip._id)}
                      disabled={sendingSmsTripId === viewingRouteTrip._id}
                      className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingSmsTripId === viewingRouteTrip._id ? "Sending..." : "SMS All Stops"}</span>
                    </button>
                  </div>
                </div>

                {/* Stops Sequenced Itinerary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Sequenced Delivery Stops ({viewingRouteTrip.stops.length})</span>
                    <span className="text-[11px] text-slate-400">Total COD: {formatCurrency(viewingRouteTrip.totalCodExpected)}</span>
                  </div>

                  <div className="space-y-2.5">
                    {viewingRouteTrip.stops.map((stop) => {
                      const trackingLink = `${typeof window !== "undefined" ? window.location.origin : ""}/delivery/track/${stop.orderId}`;
                      const isDelivered = stop.status === "DELIVERED";
                      const isFailed = stop.status === "FAILED";

                      return (
                        <div
                          key={stop.stopSequence}
                          className={`p-3.5 rounded-2xl border transition shadow-2xs space-y-2.5 ${
                            isDelivered
                              ? "bg-emerald-50/60 border-emerald-200"
                              : isFailed
                              ? "bg-rose-50/60 border-rose-200"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-7 h-7 rounded-full font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                                  isDelivered
                                    ? "bg-emerald-600 text-white"
                                    : isFailed
                                    ? "bg-rose-600 text-white"
                                    : "bg-slate-900 text-white"
                                }`}
                              >
                                {stop.stopSequence}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{stop.customerName}</span>
                                  <span className="font-mono text-slate-500 text-[11px]">({stop.orderNumber})</span>
                                </div>
                                <span className="text-slate-500 font-mono text-[11px] block">{stop.customerPhone}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isDelivered
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isFailed
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {stop.status}
                              </span>
                              <div className="mt-1 font-mono font-bold text-xs">
                                {stop.isCod ? (
                                  <span className="text-amber-800">COD: {formatCurrency(stop.codAmount)}</span>
                                ) : (
                                  <span className="text-emerald-700">Prepaid</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Address */}
                          <div className="flex items-start gap-1.5 text-slate-600 text-xs pl-9">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span>{stop.deliveryAddress}</span>
                          </div>

                          {stop.deliveryNotes && (
                            <div className="ml-9 p-1.5 bg-slate-50 rounded-lg text-[10px] text-slate-500 border border-slate-100">
                              Note: {stop.deliveryNotes}
                            </div>
                          )}

                          {/* Stop Action Bar */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px] pl-9">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                stop.deliveryAddress
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1 font-bold"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>Map Pin</span>
                            </a>

                            <div className="flex items-center gap-1">
                              <a
                                href={trackingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-1"
                              >
                                <Radio className="w-3 h-3 text-emerald-600" />
                                <span>Track</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(trackingLink);
                                  setCopiedTrackingOrderId(stop.orderId);
                                  setTimeout(() => setCopiedTrackingOrderId(null), 3000);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                                title="Copy tracking link"
                              >
                                {copiedTrackingOrderId === stop.orderId ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <a
                                href={buildWhatsAppUrl(
                                  stop.customerPhone,
                                  `Dear ${stop.customerName}, your order ${stop.orderNumber} is on the way! Track live: ${trackingLink}`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-emerald-600 hover:text-emerald-700 rounded hover:bg-emerald-50"
                                title="Send via WhatsApp"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </a>

                              <button
                                type="button"
                                onClick={() => handleSendTrackingSms(stop.orderId)}
                                disabled={sendingSmsOrderId === stop.orderId}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                              >
                                <Send className="w-3 h-3" />
                                <span>{sendingSmsOrderId === stop.orderId ? "..." : "SMS"}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingRouteTrip(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Close Route Itinerary
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: LOAD NEW VAN & ALLOCATE STOCK ================= */}
        {isLoadVanModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Load New Van & Allocate Stock</h3>
                    <p className="text-xs text-slate-500">
                      Allocate store inventory to delivery vehicle. Store stock will be deducted immediately.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoadVanModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateVanSession} className="py-4 space-y-4">
                {/* Driver & Route Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Assigned Driver & Vehicle <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newVanDriverId}
                      onChange={(e) => setNewVanDriverId(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Select Driver --</option>
                      {drivers.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name} &bull; {d.vehicleNumber} ({d.vehicleType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Route / Sales Zone</label>
                    <input
                      type="text"
                      value={newVanRouteZone}
                      onChange={(e) => setNewVanRouteZone(e.target.value)}
                      placeholder="e.g. Colombo 03, Kollupitiya, Bambalapitiya"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Shift Notes / Route Memo</label>
                  <input
                    type="text"
                    value={newVanNotes}
                    onChange={(e) => setNewVanNotes(e.target.value)}
                    placeholder="e.g. Wholesale dairy and snack distribution route"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Product Catalog Picker */}
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Select Products from Store Inventory</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {storeProducts.length} store items available
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={storeProductSearch}
                      onChange={(e) => setStoreProductSearch(e.target.value)}
                      placeholder="Search product name or barcode..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Filtered products chips */}
                  <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1">
                    {storeProducts
                      .filter((p) => {
                        if (!storeProductSearch.trim()) return true;
                        const q = storeProductSearch.toLowerCase();
                        return (
                          p.name.toLowerCase().includes(q) ||
                          (p.barcode && p.barcode.includes(q))
                        );
                      })
                      .slice(0, 10)
                      .map((prod) => (
                        <div
                          key={prod._id}
                          className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2 hover:border-blue-400 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-xs text-slate-900 truncate block">
                              {prod.name}
                            </span>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2">
                              <span>Stock: {prod.stockQuantity} {prod.unit || "unit"}</span>
                              <span>&bull;</span>
                              <span className="text-emerald-700 font-semibold">
                                Rs. {(prod.sellingPrice || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddProductToVan(prod)}
                            disabled={prod.stockQuantity <= 0}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 disabled:opacity-30 text-blue-700 rounded-lg text-xs font-bold transition shrink-0"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Selected Van Items Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Van Loading Manifest ({newVanItems.length} items)
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      Total Valuation: Rs.{" "}
                      {newVanItems
                        .reduce((sum, it) => sum + it.unitPrice * it.loadedQty, 0)
                        .toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {newVanItems.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                      No products added yet. Click &ldquo;+ Add&rdquo; from the store catalog above.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-3">Product</th>
                            <th className="py-2 px-2 text-right">Store Stock</th>
                            <th className="py-2 px-2 text-right">Loaded Qty</th>
                            <th className="py-2 px-2 text-right">Unit Price</th>
                            <th className="py-2 px-2 text-right">Total (Rs.)</th>
                            <th className="py-2 px-2 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {newVanItems.map((item) => (
                            <tr key={item.productId} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {item.productName}
                              </td>
                              <td className="py-2 px-2 text-right text-slate-500">
                                {item.maxStock} {item.unit}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <input
                                  type="number"
                                  min="0.1"
                                  max={item.maxStock}
                                  step="any"
                                  value={item.loadedQty}
                                  onChange={(e) =>
                                    handleUpdateVanItemQty(
                                      item.productId,
                                      parseFloat(e.target.value) || 1
                                    )
                                  }
                                  className="w-16 bg-white border border-slate-200 rounded p-1 text-right font-bold text-xs text-slate-900"
                                />
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-slate-600">
                                Rs. {item.unitPrice.toFixed(2)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                                Rs. {(item.unitPrice * item.loadedQty).toFixed(2)}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVanItem(item.productId)}
                                  className="text-rose-500 hover:text-rose-700 p-1 rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLoadVanModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingVanLoad || newVanItems.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
                  >
                    {submittingVanLoad ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Deducting Stock & Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm Loading & Deduct Store Stock</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: VAN RECONCILIATION & RETURN ================= */}
        {reconcilingVanSession && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Van Shift Stock Audit & Cash Settlement
                    </h3>
                    <p className="text-xs text-slate-500">
                      Session #{reconcilingVanSession.sessionNumber} &bull; {reconcilingVanSession.driverName} ({reconcilingVanSession.vehicleNumber})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReconcilingVanSession(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitVanReconciliation} className="py-4 space-y-4">
                {/* Product Return & Damage Table */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    1. Stock Count & Unsold Goods Return
                  </span>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                        <tr>
                          <th className="py-2 px-3">Product</th>
                          <th className="py-2 px-2 text-right">Loaded</th>
                          <th className="py-2 px-2 text-right">Sold</th>
                          <th className="py-2 px-2 text-right">Remaining</th>
                          <th className="py-2 px-2 text-right">Returned Qty</th>
                          <th className="py-2 px-2 text-right">Damaged Qty</th>
                          <th className="py-2 px-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {reconcilingVanSession.items.map((it: any) => {
                          const state = vanReturnItemsState[it.productId.toString()] || {
                            returnedQty: it.remainingQty,
                            damagedQty: 0,
                          };
                          const accounted = it.soldQty + Number(state.returnedQty) + Number(state.damagedQty);
                          const discrepancy = Number((it.loadedQty - accounted).toFixed(3));

                          return (
                            <tr key={it.productId} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {it.productName}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-slate-700">
                                {it.loadedQty}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-emerald-700 font-bold">
                                {it.soldQty}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-slate-500">
                                {it.remainingQty}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={state.returnedQty}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setVanReturnItemsState((prev) => ({
                                      ...prev,
                                      [it.productId.toString()]: {
                                        ...prev[it.productId.toString()],
                                        returnedQty: val,
                                      },
                                    }));
                                  }}
                                  className="w-16 bg-white border border-slate-200 rounded p-1 text-right font-bold text-xs text-slate-900"
                                />
                              </td>
                              <td className="py-2 px-2 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={state.damagedQty}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setVanReturnItemsState((prev) => ({
                                      ...prev,
                                      [it.productId.toString()]: {
                                        ...prev[it.productId.toString()],
                                        damagedQty: val,
                                      },
                                    }));
                                  }}
                                  className="w-14 bg-white border border-slate-200 rounded p-1 text-right font-bold text-xs text-amber-700"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                {discrepancy === 0 ? (
                                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                                    Exact
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold">
                                    {discrepancy > 0 ? `-${discrepancy}` : `+${Math.abs(discrepancy)}`}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cash Settlement Section */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    2. Physical Cash Settlement
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-400 text-[10px] block">Net Route Revenue</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(reconcilingVanSession.salesSummary?.netSalesTotal || 0)}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-400 text-[10px] block">Expected Cash Collection</span>
                      <span className="font-mono font-bold text-blue-700">
                        {formatCurrency(reconcilingVanSession.salesSummary?.cashCollected || 0)}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-400 text-[10px] block">LankaQR Collected</span>
                      <span className="font-mono font-bold text-teal-700">
                        {formatCurrency(reconcilingVanSession.salesSummary?.lankaQrCollected || 0)}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-400 text-[10px] block">Credit Booked</span>
                      <span className="font-mono font-bold text-purple-700">
                        {formatCurrency(reconcilingVanSession.salesSummary?.creditCollected || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Physical Cash Submitted by Driver (Rs.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={vanPhysicalCashSubmitted}
                        onChange={(e) => setVanPhysicalCashSubmitted(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Cash Shortage / Overage Variance
                      </label>
                      <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold flex items-center justify-between">
                        <span>Difference:</span>
                        <span
                          className={
                            (parseFloat(vanPhysicalCashSubmitted) || 0) -
                              (reconcilingVanSession.salesSummary?.cashCollected || 0) ===
                            0
                              ? "text-emerald-600"
                              : (parseFloat(vanPhysicalCashSubmitted) || 0) -
                                  (reconcilingVanSession.salesSummary?.cashCollected || 0) <
                                0
                              ? "text-rose-600"
                              : "text-blue-600"
                          }
                        >
                          {formatCurrency(
                            (parseFloat(vanPhysicalCashSubmitted) || 0) -
                              (reconcilingVanSession.salesSummary?.cashCollected || 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Cashier Settlement Notes</label>
                    <input
                      type="text"
                      value={vanReconciliationNotes}
                      onChange={(e) => setVanReconciliationNotes(e.target.value)}
                      placeholder="e.g. Received cash bag #4; verified with driver"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReconcilingVanSession(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingVanReconciliation}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
                  >
                    {submittingVanReconciliation ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Restoring Stock to Store...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Audit & Restore Returned Stock to Store</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: PRINT VAN LOADING SHEET & MANIFEST ================= */}
        {selectedVanSlipSession && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8">
              <div className="flex justify-end pb-2">
                <button
                  type="button"
                  onClick={() => setSelectedVanSlipSession(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <VanLoadingSheetSlip
                data={{
                  sessionNumber: selectedVanSlipSession.sessionNumber,
                  storeName: businessName,
                  driverName: selectedVanSlipSession.driverName,
                  driverPhone: selectedVanSlipSession.driverPhone,
                  vehicleType: selectedVanSlipSession.vehicleType,
                  vehicleNumber: selectedVanSlipSession.vehicleNumber,
                  routeZone: selectedVanSlipSession.routeZone,
                  status: selectedVanSlipSession.status,
                  loadedAt: selectedVanSlipSession.loadedAt,
                  startedAt: selectedVanSlipSession.startedAt,
                  completedAt: selectedVanSlipSession.completedAt,
                  reconciledAt: selectedVanSlipSession.reconciledAt,
                  items: selectedVanSlipSession.items || [],
                  salesSummary: selectedVanSlipSession.salesSummary || {
                    totalSalesCount: 0,
                    grossSalesTotal: 0,
                    discountsTotal: 0,
                    netSalesTotal: 0,
                    cashCollected: 0,
                    lankaQrCollected: 0,
                    creditCollected: 0,
                    otherCollected: 0,
                  },
                  cashierReconciliation: selectedVanSlipSession.cashierReconciliation,
                  vanPosUrl: typeof window !== "undefined" ? window.location.origin : undefined,
                }}
                onPrint={() => window.print()}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
