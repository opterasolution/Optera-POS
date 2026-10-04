"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Truck,
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  QrCode as QrIcon,
  CreditCard,
  BookOpen,
  ArrowLeft,
  CheckCircle2,
  Share2,
  Printer,
  RefreshCw,
  AlertTriangle,
  User,
  Phone,
  Tag,
  PackageCheck,
  Check,
  X,
} from "lucide-react";
import { formatCurrency, formatSLDateTime } from "@/lib/formatters";
import QRCodeImage from "@/components/common/QRCodeImage";

interface VanSessionItem {
  productId: string;
  productName: string;
  nameSinhala?: string;
  nameTamil?: string;
  barcode?: string;
  unit: string;
  costPrice: number;
  unitPrice: number;
  wholesalePrice?: number;
  loadedQty: number;
  soldQty: number;
  returnedQty: number;
  damagedQty: number;
  remainingQty: number;
}

interface CartItem {
  productId: string;
  productName: string;
  unit: string;
  unitPrice: number;
  wholesalePrice?: number;
  priceTier: "RETAIL" | "WHOLESALE";
  quantity: number;
  discount: number;
  maxAvailable: number;
}

interface CustomerOption {
  _id: string;
  name: string;
  phone?: string;
  companyName?: string;
  creditLimit?: number;
  balance?: number;
}

export default function DriverVanPosPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Loaded data
  const [driver, setDriver] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  // Search & price tier
  const [searchQuery, setSearchQuery] = useState("");
  const [globalPriceTier, setGlobalPriceTier] = useState<"RETAIL" | "WHOLESALE">("RETAIL");

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Customer selection
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualCustomerPhone, setManualCustomerPhone] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QR" | "CREDIT">("CASH");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [saleDiscount, setSaleDiscount] = useState<number>(0);

  // Post Checkout Success Modal
  const [lastSaleResult, setLastSaleResult] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const loadSessionData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch(`/api/public/driver/van-pos/session?token=${token}`);
      const data = await res.json();
      if (data.success) {
        setDriver(data.driver);
        setBusiness(data.business);
        setSession(data.session);
        setCustomers(data.customers || []);
      } else {
        setErrorMessage(data.error || "Failed to load van session.");
      }
    } catch {
      setErrorMessage("Network error connecting to store server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionData();
  }, [token]);

  // Cart calculations
  const cartSubtotal = cart.reduce((sum, item) => {
    const price =
      item.priceTier === "WHOLESALE" && item.wholesalePrice && item.wholesalePrice > 0
        ? item.wholesalePrice
        : item.unitPrice;
    return sum + price * item.quantity;
  }, 0);

  const cartNetTotal = Math.max(0, cartSubtotal - saleDiscount);
  const cashNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, cashNum - cartNetTotal);

  // Add to cart helper
  const handleAddToCart = (item: VanSessionItem) => {
    if (item.remainingQty <= 0) return;

    setCart((prev) => {
      const existing = prev.find((c) => c.productId === item.productId.toString());
      if (existing) {
        if (existing.quantity >= item.remainingQty) return prev;
        return prev.map((c) =>
          c.productId === item.productId.toString()
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          productId: item.productId.toString(),
          productName: item.productName,
          unit: item.unit,
          unitPrice: item.unitPrice,
          wholesalePrice: item.wholesalePrice,
          priceTier: globalPriceTier,
          quantity: 1,
          discount: 0,
          maxAvailable: item.remainingQty,
        },
      ];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.productId === productId) {
            const nextQty = c.quantity + delta;
            if (nextQty <= 0) return null;
            if (nextQty > c.maxAvailable) return c;
            return { ...c, quantity: nextQty };
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  };

  const handleToggleTier = (productId: string) => {
    setCart((prev) =>
      prev.map((c) =>
        c.productId === productId
          ? { ...c, priceTier: c.priceTier === "RETAIL" ? "WHOLESALE" : "RETAIL" }
          : c
      )
    );
  };

  const handleApplyQuickCash = (amount: number) => {
    setCashTendered(amount.toString());
  };

  // Checkout submission
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === "CREDIT" && !selectedCustomer) {
      alert("Please select a registered customer for Credit sales.");
      return;
    }

    if (paymentMethod === "CASH" && cashTendered && cashNum < cartNetTotal) {
      alert(`Cash received (Rs. ${cashNum}) is less than total (Rs. ${cartNetTotal}).`);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/public/driver/van-pos/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          items: cart.map((c) => ({
            productId: c.productId,
            quantity: c.quantity,
            priceTier: c.priceTier,
            discount: c.discount,
          })),
          customerId: selectedCustomer?._id,
          customerName: selectedCustomer ? selectedCustomer.name : manualCustomerName || "Spot Cash",
          customerPhone: selectedCustomer ? selectedCustomer.phone : manualCustomerPhone,
          paymentMethod,
          cashReceived: paymentMethod === "CASH" ? (cashTendered ? cashNum : cartNetTotal) : cartNetTotal,
          discountTotal: saleDiscount,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Checkout failed");
        return;
      }

      setLastSaleResult(data);
      setShowReceiptModal(true);

      // Reset cart and update in-transit state
      setCart([]);
      setCashTendered("");
      setSelectedCustomer(null);
      setManualCustomerName("");
      setManualCustomerPhone("");
      setCartOpen(false);

      if (data.updatedSession) {
        setSession((prev: any) => ({
          ...prev,
          salesSummary: data.updatedSession.salesSummary,
          items: data.updatedSession.items,
        }));
      }
    } catch {
      alert("Error submitting sale. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products by search
  const filteredProducts = (session?.items || []).filter((it: VanSessionItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      it.productName.toLowerCase().includes(q) ||
      (it.nameSinhala && it.nameSinhala.toLowerCase().includes(q)) ||
      (it.barcode && it.barcode.toLowerCase().includes(q))
    );
  });

  const filteredCustomerList = customers.filter((c) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mb-3" />
        <p className="text-sm font-semibold">Loading Van POS...</p>
      </div>
    );
  }

  if (errorMessage || !session) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">No Active Van Session</h1>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          {errorMessage || "You do not have an active van loading session assigned. Please ask the store dispatcher to load your van."}
        </p>
        <button
          onClick={() => router.push(`/delivery/driver/${token}`)}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Delivery Runsheet</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Mobile Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/delivery/driver/${token}`)}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
            title="Back to Deliveries"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-400" />
                <span>Van Mobile POS</span>
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {session.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {driver?.name} &bull; {session.vehicleNumber}
            </p>
          </div>
        </div>

        {/* Cart Toggle Button */}
        <button
          onClick={() => setCartOpen(true)}
          className="relative px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-600/30"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Rs. {cartNetTotal.toFixed(0)}</span>
          {cart.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center border-2 border-slate-900">
              {cart.reduce((sum, it) => sum + it.quantity, 0)}
            </span>
          )}
        </button>
      </header>

      {/* Metrics Banner */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs">
        <div>
          <span className="text-slate-400 block text-[10px] uppercase font-bold">Shift Spot Sales</span>
          <span className="font-bold text-emerald-400">
            Rs. {(session.salesSummary?.netSalesTotal || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-slate-500 text-[10px] ml-1.5">({session.salesSummary?.totalSalesCount || 0} sales)</span>
        </div>
        <div className="text-right">
          <span className="text-slate-400 block text-[10px] uppercase font-bold">In-Transit Stock</span>
          <span className="font-mono text-slate-200">
            {session.items?.reduce((sum: number, it: any) => sum + (it.remainingQty || 0), 0).toFixed(0)} units remaining
          </span>
        </div>
      </div>

      {/* Controls Bar: Search & Wholesale Toggle */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search van items or scan barcode..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Retail vs Wholesale Tier Quick Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">Default Price Tier:</span>
          <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex text-[11px] font-bold">
            <button
              onClick={() => setGlobalPriceTier("RETAIL")}
              className={`px-3 py-1 rounded-md transition ${
                globalPriceTier === "RETAIL"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Retail
            </button>
            <button
              onClick={() => setGlobalPriceTier("WHOLESALE")}
              className={`px-3 py-1 rounded-md transition ${
                globalPriceTier === "WHOLESALE"
                  ? "bg-purple-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Wholesale
            </button>
          </div>
        </div>
      </div>

      {/* Product List Grid */}
      <main className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No products match &ldquo;{searchQuery}&rdquo; in this van loading.
          </div>
        ) : (
          filteredProducts.map((item: VanSessionItem) => {
            const inCart = cart.find((c) => c.productId === item.productId.toString());
            const isOutOfStock = item.remainingQty <= 0;
            const currentPrice =
              globalPriceTier === "WHOLESALE" && item.wholesalePrice && item.wholesalePrice > 0
                ? item.wholesalePrice
                : item.unitPrice;

            return (
              <div
                key={item.productId.toString()}
                className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                  isOutOfStock
                    ? "bg-slate-900/30 border-slate-900 opacity-50"
                    : inCart
                    ? "bg-blue-950/20 border-blue-500/40"
                    : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs text-white truncate">{item.productName}</h3>
                    {item.remainingQty <= 3 && item.remainingQty > 0 && (
                      <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[9px] font-black">
                        Low Stock
                      </span>
                    )}
                  </div>
                  {item.nameSinhala && (
                    <p className="text-[10px] text-slate-400 truncate">{item.nameSinhala}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-[11px]">
                    <span className="font-bold text-emerald-400">
                      Rs. {currentPrice.toFixed(2)}{" "}
                      <span className="text-[10px] text-slate-400 font-normal">/ {item.unit}</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        isOutOfStock ? "text-rose-400" : "text-slate-400"
                      }`}
                    >
                      {item.remainingQty} {item.unit} left
                    </span>
                  </div>
                </div>

                {/* Add / Qty Controls */}
                <div>
                  {inCart ? (
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-blue-500/40 rounded-xl p-1">
                      <button
                        onClick={() => handleUpdateQty(item.productId.toString(), -1)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-xs px-2 text-white">{inCart.quantity}</span>
                      <button
                        onClick={() => handleUpdateQty(item.productId.toString(), 1)}
                        disabled={inCart.quantity >= item.remainingQty}
                        className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 flex items-center justify-center text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddToCart(item)}
                      disabled={isOutOfStock}
                      className="px-3.5 py-2 bg-blue-600/90 hover:bg-blue-600 disabled:opacity-20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Cart Drawer / Slide-over Modal */}
      {cartOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end animate-in fade-in">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[90vh] flex flex-col">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-400" />
                <h2 className="font-bold text-sm text-white">Spot Sale Checkout Cart</h2>
                <span className="text-xs text-slate-400">({cart.length} items)</span>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Cart Items List */}
              <div className="space-y-2">
                {cart.map((item) => {
                  const unitPrice =
                    item.priceTier === "WHOLESALE" && item.wholesalePrice && item.wholesalePrice > 0
                      ? item.wholesalePrice
                      : item.unitPrice;
                  const lineTotal = unitPrice * item.quantity;

                  return (
                    <div
                      key={item.productId}
                      className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs text-white truncate">{item.productName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => handleToggleTier(item.productId)}
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                              item.priceTier === "WHOLESALE"
                                ? "bg-purple-950/60 text-purple-300 border-purple-700"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            {item.priceTier}
                          </button>
                          <span className="text-[11px] text-slate-400">
                            Rs. {unitPrice.toFixed(2)} &times; {item.quantity} ={" "}
                            <span className="font-bold text-white">Rs. {lineTotal.toFixed(2)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleUpdateQty(item.productId, -1)}
                          className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQty(item.productId, 1)}
                          disabled={item.quantity >= item.maxAvailable}
                          className="w-6 h-6 rounded bg-slate-800 disabled:opacity-30 flex items-center justify-center text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.productId)}
                          className="w-6 h-6 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 flex items-center justify-center ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Customer Selector */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-300 block uppercase">
                  Customer / Credit Account
                </span>

                {selectedCustomer ? (
                  <div className="flex items-center justify-between bg-blue-950/30 border border-blue-500/40 p-2.5 rounded-lg">
                    <div>
                      <div className="font-bold text-xs text-blue-200">{selectedCustomer.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {selectedCustomer.phone || "No phone"} &bull; Balance: Rs.{" "}
                        {(selectedCustomer.balance || 0).toFixed(2)} / Limit: Rs.{" "}
                        {(selectedCustomer.creditLimit || 0).toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search existing credit customers..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    {customerSearch && (
                      <div className="max-h-28 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-lg bg-slate-900 text-xs">
                        {filteredCustomerList.slice(0, 5).map((cust) => (
                          <div
                            key={cust._id}
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setCustomerSearch("");
                            }}
                            className="p-2 hover:bg-slate-800 cursor-pointer flex justify-between"
                          >
                            <span className="font-semibold text-white">{cust.name}</span>
                            <span className="text-slate-400 text-[10px]">{cust.phone || ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <input
                        type="text"
                        value={manualCustomerName}
                        onChange={(e) => setManualCustomerName(e.target.value)}
                        placeholder="Or spot customer name"
                        className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={manualCustomerPhone}
                        onChange={(e) => setManualCustomerPhone(e.target.value)}
                        placeholder="Customer mobile #"
                        className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Methods */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-slate-300 block uppercase">
                  Payment Method
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentMethod("CASH")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition ${
                      paymentMethod === "CASH"
                        ? "bg-blue-600 border-blue-400 text-white font-bold"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs">Cash</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("QR")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition ${
                      paymentMethod === "QR"
                        ? "bg-emerald-600 border-emerald-400 text-white font-bold"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <QrIcon className="w-4 h-4" />
                    <span className="text-xs">LankaQR</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("CREDIT")}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition ${
                      paymentMethod === "CREDIT"
                        ? "bg-purple-600 border-purple-400 text-white font-bold"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span className="text-xs">Credit</span>
                  </button>
                </div>

                {/* Cash Tender & Change */}
                {paymentMethod === "CASH" && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Cash Received (Rs.):</span>
                      <input
                        type="number"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder={cartNetTotal.toString()}
                        className="w-32 bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-right text-xs text-white font-bold"
                      />
                    </div>
                    {/* Quick tender pills */}
                    <div className="flex gap-1.5 justify-end">
                      {[cartNetTotal, 1000, 2000, 5000]
                        .filter((amt, i, arr) => arr.indexOf(amt) === i && amt >= cartNetTotal)
                        .map((amt) => (
                          <button
                            key={amt}
                            onClick={() => handleApplyQuickCash(amt)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300"
                          >
                            Rs. {amt}
                          </button>
                        ))}
                    </div>
                    {cashNum >= cartNetTotal && (
                      <div className="flex justify-between text-xs font-bold text-emerald-400 pt-1">
                        <span>Change Given:</span>
                        <span>Rs. {changeDue.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* LankaQR Live View in Drawer */}
                {paymentMethod === "QR" && (
                  <div className="p-3 bg-white text-slate-900 rounded-xl text-center space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Scan with any Sri Lankan Bank / Wallet App
                    </span>
                    <div className="flex justify-center">
                      <QRCodeImage
                        value={`LANKAQR://PAY?m=${encodeURIComponent(
                          business?.name || "Store"
                        )}&amt=${cartNetTotal.toFixed(2)}&cur=LKR`}
                        size={120}
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 font-semibold">
                      Amount: Rs. {cartNetTotal.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {/* Order Totals Summary */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span>Rs. {cartSubtotal.toFixed(2)}</span>
                </div>
                {saleDiscount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Discount</span>
                    <span>- Rs. {saleDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-slate-800">
                  <span>Net Total</span>
                  <span className="text-emerald-400 font-mono">Rs. {cartNetTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Complete Sale Button */}
            <div className="p-4 border-t border-slate-800 bg-slate-900">
              <button
                onClick={handleCheckout}
                disabled={submitting || cart.length === 0}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Sale...</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-5 h-5" />
                    <span>Complete Spot Sale &bull; Rs. {cartNetTotal.toFixed(2)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Checkout Thermal Receipt & WhatsApp Modal */}
      {showReceiptModal && lastSaleResult && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 text-slate-100">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-base text-white">Sale Recorded!</h3>
              <p className="text-xs text-slate-400 font-mono">
                {lastSaleResult.sale?.invoiceNumber}
              </p>
            </div>

            {/* Receipt Summary Box */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Customer:</span>
                <span className="font-semibold text-white">
                  {lastSaleResult.sale?.customerName}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Payment:</span>
                <span className="font-semibold text-white">
                  {lastSaleResult.sale?.paymentMethod}
                </span>
              </div>
              <div className="flex justify-between font-bold text-emerald-400 text-sm pt-1 border-t border-slate-800">
                <span>Net Total:</span>
                <span>Rs. {lastSaleResult.sale?.netTotal?.toFixed(2)}</span>
              </div>
              {lastSaleResult.sale?.changeGiven > 0 && (
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Change Given:</span>
                  <span>Rs. {lastSaleResult.sale?.changeGiven?.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Actions: WhatsApp Share & Print */}
            <div className="space-y-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  lastSaleResult.whatsappReceiptText || ""
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow"
              >
                <Share2 className="w-4 h-4" />
                <span>Share WhatsApp Receipt</span>
              </a>

              <button
                onClick={() => window.print()}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Thermal Receipt</span>
              </button>

              <button
                onClick={() => setShowReceiptModal(false)}
                className="w-full py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Start Next Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
