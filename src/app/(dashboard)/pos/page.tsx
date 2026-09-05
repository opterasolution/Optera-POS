"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/layout/AppLayout";
import {
  ShoppingCart,
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  User,
  CreditCard,
  QrCode,
  Banknote,
  Building2,
  Receipt,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Printer,
  ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Product {
  _id: string;
  name: string;
  barcode?: string;
  sku?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  unit: string;
  categoryId?: { _id: string; name: string; color?: string } | string;
}

interface Category {
  _id: string;
  name: string;
  color?: string;
}

interface CartItem {
  productId: string;
  name: string;
  barcode?: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  stockQuantity: number;
  unit: string;
  discount: number;
}

interface BusinessSettings {
  name: string;
  phone: string;
  address: string;
  currency: string;
  taxSettings: {
    enabled: boolean;
    name: string;
    rate: number;
    type: "INCLUSIVE" | "EXCLUSIVE";
  };
  receiptSettings: {
    headerMessage: string;
    footerMessage: string;
    defaultWidth: "58mm" | "80mm";
  };
}

export default function POSPage() {
  const { data: session } = useSession();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [barcodeInput, setBarcodeInput] = useState("");

  // Customer & Discount
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderDiscount, setOrderDiscount] = useState(0);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "QR" | "BANK_TRANSFER">("CASH");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [submittingSale, setSubmittingSale] = useState(false);

  // Post-Sale Modal & Receipt State
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Barcode input ref
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load Products, Categories, and Business Settings
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, bizRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/categories"),
        fetch("/api/business"),
      ]);

      const [prodData, catData, bizData] = await Promise.all([
        prodRes.json(),
        catRes.json(),
        bizRes.json(),
      ]);

      if (prodData.success) setProducts(prodData.products || []);
      if (catData.success) setCategories(catData.categories || []);
      if (bizData.success) setBusiness(bizData.business);
    } catch {
      setStatusMessage({ type: "error", text: "Failed to initialize POS counter." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Keyboard shortcut: focus barcode input on F2
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.stockQuantity <= 0) {
      setStatusMessage({ type: "error", text: `"${product.name}" is currently OUT OF STOCK.` });
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.productId === product._id);

      if (existingIndex > -1) {
        const item = prevCart[existingIndex];
        if (item.quantity + 1 > product.stockQuantity) {
          setStatusMessage({
            type: "error",
            text: `Cannot add more. Only ${product.stockQuantity} ${product.unit} available in stock.`,
          });
          return prevCart;
        }

        const updated = [...prevCart];
        updated[existingIndex] = { ...item, quantity: item.quantity + 1 };
        return updated;
      }

      return [
        ...prevCart,
        {
          productId: product._id,
          name: product.name,
          barcode: product.barcode,
          unitPrice: product.sellingPrice,
          costPrice: product.costPrice,
          quantity: 1,
          stockQuantity: product.stockQuantity,
          unit: product.unit,
          discount: 0,
        },
      ];
    });

    setStatusMessage(null);
  };

  // Adjust Cart Quantity
  const updateQuantity = (productId: string, newQty: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.productId === productId) {
            if (newQty <= 0) return null;
            if (newQty > item.stockQuantity) {
              setStatusMessage({
                type: "error",
                text: `Limit reached: only ${item.stockQuantity} in stock.`,
              });
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove Item from Cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Clear Cart
  const clearCart = () => {
    if (cart.length > 0 && confirm("Are you sure you want to clear the active cart?")) {
      setCart([]);
      setOrderDiscount(0);
      setStatusMessage(null);
    }
  };

  // Handle Barcode Scan (Enter key from USB scanner)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const matched = products.find(
      (p) => p.barcode === code || p.sku?.toLowerCase() === code.toLowerCase()
    );

    if (matched) {
      addToCart(matched);
      setBarcodeInput("");
      setStatusMessage({ type: "success", text: `Scanned: ${matched.name}` });
    } else {
      setStatusMessage({ type: "error", text: `No product found matching barcode "${code}".` });
      setBarcodeInput("");
    }
  };

  // Financial Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalDiscount = orderDiscount;

  // Sri Lanka Tax Calculation
  const isTaxEnabled = business?.taxSettings?.enabled || false;
  const taxRate = isTaxEnabled ? business?.taxSettings?.rate || 0 : 0;
  const isExclusive = business?.taxSettings?.type === "EXCLUSIVE";

  let taxAmount = 0;
  let netTotal = subtotal - totalDiscount;

  if (isTaxEnabled) {
    if (isExclusive) {
      taxAmount = ((subtotal - totalDiscount) * taxRate) / 100;
      netTotal += taxAmount;
    } else {
      // Inclusive: tax is already inside the price
      taxAmount = (netTotal * taxRate) / (100 + taxRate);
    }
  }

  // Cash Change Calculation
  const cashGivenNum = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, cashGivenNum - netTotal);

  // Fast cash buttons
  const quickCashOptions = [
    Math.ceil(netTotal),
    Math.ceil(netTotal / 500) * 500 || 500,
    1000,
    2000,
    5000,
  ].filter((val, idx, self) => val >= netTotal && self.indexOf(val) === idx);

  // Open Checkout Modal
  const openCheckout = () => {
    if (cart.length === 0) {
      setStatusMessage({ type: "error", text: "Cart is empty. Add products to proceed." });
      return;
    }
    setCashReceived(Math.ceil(netTotal).toString());
    setIsCheckoutOpen(true);
  };

  // Complete Sale Submission
  const handleCompleteSale = async () => {
    if (paymentMethod === "CASH" && cashGivenNum < netTotal) {
      alert(`Cash received (Rs. ${cashGivenNum}) is less than total bill (Rs. ${netTotal.toFixed(2)}).`);
      return;
    }

    setSubmittingSale(true);

    try {
      const salePayload = {
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
        customerName: customerName.trim() || "Walk-in Customer",
        customerPhone: customerPhone.trim() || undefined,
        discountTotal: totalDiscount,
        paymentMethod,
        cashReceived: paymentMethod === "CASH" ? cashGivenNum : undefined,
        changeGiven: paymentMethod === "CASH" ? changeDue : undefined,
        paymentReference: paymentReference.trim() || undefined,
      };

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(salePayload),
      });

      const data = await res.json();

      if (data.success) {
        setCompletedSale(data.sale);
        setIsCheckoutOpen(false);
        setCart([]);
        setOrderDiscount(0);
        // Refresh product stock
        loadInitialData();
      } else {
        alert(data.error || "Failed to complete sale.");
      }
    } catch {
      alert("Error communicating with server. Please try again.");
    } finally {
      setSubmittingSale(false);
    }
  };

  // Native Thermal Print Trigger
  const triggerPrint = () => {
    window.print();
  };

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === "all" ||
      (typeof p.categoryId === "object" ? p.categoryId?._id === selectedCategory : p.categoryId === selectedCategory);

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.barcode?.includes(q) ||
      p.sku?.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3.5rem)] md:h-screen flex flex-col lg:flex-row overflow-hidden bg-slate-100">
        {/* ================= LEFT SIDE (60%): PRODUCTS & BARCODE ================= */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-white">
          {/* Top Bar: Barcode Scanner & Search */}
          <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/80 space-y-2.5">
            <div className="flex items-center gap-2">
              {/* Barcode Scanner Input Form */}
              <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600">
                  <Barcode className="w-5 h-5" />
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode with USB scanner (or press F2)..."
                  className="w-full pl-10 pr-20 py-2.5 bg-white border-2 border-emerald-500/80 rounded-xl text-xs sm:text-sm font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                >
                  Scan
                </button>
              </form>

              {/* Text Search */}
              <div className="w-48 sm:w-64 relative hidden sm:block">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item name..."
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Category Filter Horizontal Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-colors ${
                  selectedCategory === "all"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                All Products
              </button>
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  onClick={() => setSelectedCategory(cat._id)}
                  style={{
                    borderColor: selectedCategory === cat._id ? cat.color || "#3b82f6" : undefined,
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium shrink-0 transition-all border ${
                    selectedCategory === cat._id
                      ? "bg-blue-600 text-white font-semibold shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Toast */}
          {statusMessage && (
            <div
              className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {statusMessage.type === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button onClick={() => setStatusMessage(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Product Grid (Large touch/click friendly cards) */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Loading products catalog...
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredProducts.map((p) => {
                  const isOut = p.stockQuantity <= 0;
                  const isLow = p.stockQuantity <= 5 && !isOut;

                  return (
                    <button
                      key={p._id}
                      onClick={() => addToCart(p)}
                      disabled={isOut}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all group relative overflow-hidden ${
                        isOut
                          ? "opacity-50 bg-slate-50 border-slate-200 cursor-not-allowed"
                          : "bg-white border-slate-200 hover:border-blue-500 hover:shadow-md active:scale-[0.98]"
                      }`}
                    >
                      <div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {p.barcode ? `EAN: ${p.barcode}` : p.sku || "RETAIL"}
                        </span>
                        <h4 className="font-semibold text-slate-800 text-xs sm:text-sm line-clamp-2 mt-0.5 leading-tight group-hover:text-blue-600">
                          {p.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-end justify-between">
                        <div>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono block">
                            {formatCurrency(p.sellingPrice)}
                          </span>
                          <span className="text-[10px] text-slate-400 capitalize">per {p.unit}</span>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isOut
                              ? "bg-rose-100 text-rose-800"
                              : isLow
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isOut ? "Out" : `${p.stockQuantity} left`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-6 text-center">
                <Search className="w-8 h-8 text-slate-300 mb-2" />
                <p>No products match your search or filter.</p>
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT SIDE (40%): CHECKOUT CART ================= */}
        <div className="w-full lg:w-[420px] xl:w-[460px] bg-white flex flex-col h-full shadow-lg border-t lg:border-t-0 border-slate-200 z-10">
          {/* Cart Header */}
          <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <h2 className="font-bold text-sm text-slate-900">Active Order</h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Customer Selection Bar */}
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2 text-xs">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name (Walk-in)"
              className="w-full bg-transparent text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone (07XXXXXXXX)"
              className="w-32 bg-transparent text-xs text-right font-mono text-slate-600 placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Cart Line Items List */}
          <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100">
            {cart.length > 0 ? (
              cart.map((item) => (
                <div key={item.productId} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h5 className="font-semibold text-xs text-slate-800 truncate leading-tight">
                      {item.name}
                    </h5>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatCurrency(item.unitPrice)} / {item.unit}
                    </span>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1 shrink-0 bg-slate-100 rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-bold text-xs font-mono text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="text-right shrink-0 min-w-[70px]">
                    <span className="font-bold text-xs text-slate-900 font-mono block">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="text-[10px] text-slate-400 hover:text-rose-600 mt-0.5"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <p className="font-medium text-slate-600">Your cart is empty</p>
                <p className="text-[11px] text-slate-400">
                  Scan a barcode or click any product on the left to start billing.
                </p>
              </div>
            )}
          </div>

          {/* Financial Summary & Pay Action */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2.5">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>

              {/* Discount Row */}
              <div className="flex justify-between items-center text-slate-600">
                <span>Discount (Rs.):</span>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  value={orderDiscount || ""}
                  onChange={(e) => setOrderDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-20 px-2 py-0.5 text-right font-mono text-xs border border-slate-200 rounded bg-white"
                />
              </div>

              {/* Tax Row */}
              {isTaxEnabled && (
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>
                    {business?.taxSettings?.name || "Tax"} ({taxRate}%
                    {isExclusive ? " excl." : " incl."}):
                  </span>
                  <span className="font-mono">{formatCurrency(taxAmount)}</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>GRAND TOTAL:</span>
                <span className="text-blue-700 font-mono text-lg">{formatCurrency(netTotal)}</span>
              </div>
            </div>

            {/* High Visibility Checkout Action */}
            <button
              onClick={openCheckout}
              disabled={cart.length === 0}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>PAY / CHECKOUT</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= FAST PAYMENT MODAL ================= */}
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Select Payment Method</h3>
                  <p className="text-xs text-slate-500">Bill: {customerName}</p>
                </div>
                <button onClick={() => setIsCheckoutOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Bill Amount Highlight */}
              <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-100 text-center">
                <span className="text-xs text-blue-700 font-medium">Total Amount Due</span>
                <div className="text-3xl font-black text-blue-950 font-mono mt-0.5">
                  {formatCurrency(netTotal)}
                </div>
              </div>

              {/* Payment Method Selector Pills */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    paymentMethod === "CASH"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash Payment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("CARD")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    paymentMethod === "CARD"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Credit / Debit Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("QR")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    paymentMethod === "QR"
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>LankaQR / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("BANK_TRANSFER")}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold transition-all ${
                    paymentMethod === "BANK_TRANSFER"
                      ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Bank Transfer</span>
                </button>
              </div>

              {/* Cash Change UX Calculator */}
              {paymentMethod === "CASH" && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cash Received from Customer (Rs.)
                    </label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-base font-bold font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-900"
                    />
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {quickCashOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setCashReceived(opt.toString())}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-700 transition-colors"
                      >
                        Rs. {opt}
                      </button>
                    ))}
                  </div>

                  {/* Change Due Box */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Balance / Change Due:</span>
                    <span
                      className={`text-lg font-black font-mono ${
                        changeDue >= 0 && cashGivenNum >= netTotal
                          ? "text-emerald-700"
                          : "text-rose-600 text-xs font-semibold"
                      }`}
                    >
                      {cashGivenNum >= netTotal
                        ? formatCurrency(changeDue)
                        : "Insufficient cash tendered"}
                    </span>
                  </div>
                </div>
              )}

              {/* Reference note for Card / QR */}
              {paymentMethod !== "CASH" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Approval / Reference Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. Card slip # or LankaQR Ref"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Complete Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCompleteSale}
                  disabled={submittingSale || (paymentMethod === "CASH" && cashGivenNum < netTotal)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 transition-all disabled:opacity-50"
                >
                  {submittingSale ? "Recording Sale..." : "Complete & Confirm Sale"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= SALE COMPLETED & PRINT THERMAL RECEIPT MODAL ================= */}
        {completedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[95vh] overflow-y-auto">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-lg">Sale Completed!</h3>
                <p className="text-xs text-slate-500 font-mono">Invoice #{completedSale.invoiceNumber}</p>
              </div>

              {/* Printable Thermal Receipt Preview Area */}
              <div
                id="printable-receipt"
                className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl font-mono text-[11px] text-slate-800 space-y-2 shadow-inner"
              >
                <div className="text-center font-bold text-xs uppercase">
                  {business?.name || "KANDY SUPER GROCERS"}
                </div>
                <div className="text-center text-[10px] text-slate-600 leading-tight">
                  {business?.address || "Peradeniya Road, Kandy"}
                  <br />
                  Tel: {business?.phone || "0771234567"}
                </div>
                <div className="text-center text-[10px] text-slate-500 italic">
                  {business?.receiptSettings?.headerMessage || "Thank you for shopping with us!"}
                </div>

                <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>Invoice: {completedSale.invoiceNumber}</span>
                    <span>{new Date(completedSale.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier: {completedSale.cashierName}</span>
                    <span>Method: {completedSale.paymentMethod}</span>
                  </div>
                </div>

                <div className="border-t border-slate-300 pt-1.5 space-y-1">
                  {completedSale.items.map((it: any, idx: number) => (
                    <div key={idx}>
                      <div className="flex justify-between font-semibold">
                        <span className="truncate pr-2">{it.name}</span>
                        <span>{formatCurrency(it.total)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pl-2">
                        <span>
                          {it.quantity} x {formatCurrency(it.unitPrice)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-right font-medium">
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(completedSale.subtotal)}</span>
                  </div>
                  {completedSale.discountTotal > 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>Discount:</span>
                      <span>-{formatCurrency(completedSale.discountTotal)}</span>
                    </div>
                  )}
                  {completedSale.taxTotal > 0 && (
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>Tax:</span>
                      <span>+{formatCurrency(completedSale.taxTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(completedSale.netTotal)}</span>
                  </div>
                  {completedSale.paymentMethod === "CASH" && (
                    <>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>Cash Tendered:</span>
                        <span>{formatCurrency(completedSale.cashReceived)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold text-emerald-700">
                        <span>Change Returned:</span>
                        <span>{formatCurrency(completedSale.changeGiven)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-500">
                  {business?.receiptSettings?.footerMessage || "Please come again!"}
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
                  onClick={() => setCompletedSale(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Next Sale (New Cart)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
