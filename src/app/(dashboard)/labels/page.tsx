"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import {
  Barcode,
  Printer,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  Sliders,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Layers,
  ShoppingBag,
  Sparkles,
  Scale,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import ShelfEdgeLabel from "@/components/labels/ShelfEdgeLabel";
import ProductBarcodeSticker from "@/components/labels/ProductBarcodeSticker";
import CompactSticker from "@/components/labels/CompactSticker";
import A4LabelSheet, { A4LabelItem } from "@/components/labels/A4LabelSheet";
import ScaleBarcodeSticker from "@/components/labels/ScaleBarcodeSticker";
import { generateScaleBarcode } from "@/lib/hardware/barcode-scale";

interface QueueItem {
  productId: string;
  name: string;
  nameSinhala?: string;
  nameTamil?: string;
  sellingPrice: number;
  barcode?: string;
  sku?: string;
  pluCode?: string;
  isWeighable?: boolean;
  tareWeightGrams?: number;
  weightKg?: number;
  category?: string;
  unit?: string;
  printQuantity: number;
}

type LabelTemplate = "SHELF_EDGE" | "PRODUCT_STICKER" | "COMPACT" | "A4_SHEET" | "SCALE_STICKER";

function LabelsContent() {
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get("productId");

  // State
  const [products, setProducts] = useState<any[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Queue state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate>("SHELF_EDGE");

  // Options
  const [showStoreName, setShowStoreName] = useState(true);
  const [showDate, setShowDate] = useState(true);

  // Modals
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [loadingPo, setLoadingPo] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch products, business, and POs
  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, bizRes, poRes] = await Promise.all([
        fetch("/api/products?limit=250"),
        fetch("/api/business"),
        fetch("/api/purchases"),
      ]);

      const [prodData, bizData, poData] = await Promise.all([
        prodRes.json(),
        bizRes.json(),
        poRes.json(),
      ]);

      if (prodData.success) {
        setProducts(prodData.products || []);

        // If initialProductId was provided via URL
        if (initialProductId && prodData.products) {
          const match = prodData.products.find((p: any) => p._id === initialProductId);
          if (match) {
            setQueue([
              {
                productId: match._id,
                name: match.name,
                sellingPrice: match.sellingPrice,
                barcode: match.barcode,
                sku: match.sku,
                category: match.category,
                unit: match.unit,
                printQuantity: 5,
              },
            ]);
          }
        }
      }

      if (bizData.success) {
        setBusiness(bizData.business);
      }

      if (poData.success) {
        setPurchaseOrders(poData.purchases || []);
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "Failed to load product catalog data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [initialProductId]);

  // Add product to print queue
  const handleAddToQueue = (product: any) => {
    setQueue((prev) => {
      const existing = prev.find((item) => item.productId === product._id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product._id
            ? { ...item, printQuantity: item.printQuantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          nameSinhala: product.nameSinhala,
          nameTamil: product.nameTamil,
          sellingPrice: product.sellingPrice,
          barcode: product.barcode,
          sku: product.sku,
          pluCode: product.pluCode,
          isWeighable: product.isWeighable,
          tareWeightGrams: product.tareWeightGrams,
          weightKg: 1.0,
          category: product.category,
          unit: product.unit,
          printQuantity: 1,
        },
      ];
    });
  };

  // Quick populate with all weighable produce items
  const handleLoadAllProduce = () => {
    const produce = products.filter(
      (p) => p.isWeighable || Boolean(p.pluCode) || p.unit?.toLowerCase().includes("kg")
    );
    if (produce.length === 0) {
      alert("No weighable produce items found in catalog. Add or seed weighable products first.");
      return;
    }
    const newItems: QueueItem[] = produce.map((p) => ({
      productId: p._id,
      name: p.name,
      nameSinhala: p.nameSinhala,
      nameTamil: p.nameTamil,
      sellingPrice: p.sellingPrice,
      barcode: p.barcode,
      sku: p.sku,
      pluCode: p.pluCode,
      isWeighable: true,
      tareWeightGrams: p.tareWeightGrams || 5,
      weightKg: 1.0,
      category: p.category,
      unit: p.unit || "kg",
      printQuantity: 2,
    }));
    setQueue(newItems);
    setSelectedTemplate("SCALE_STICKER");
    setStatusMessage({
      type: "success",
      text: `Loaded ${produce.length} weighable produce items into Scale Sticker queue!`,
    });
  };

  // Import items from a Purchase Order
  const handleImportPo = (po: any) => {
    if (!po.items || po.items.length === 0) {
      alert("This purchase order has no items.");
      return;
    }

    const imported: QueueItem[] = po.items.map((item: any) => {
      const match = products.find((p) => p._id === (item.productId?._id || item.productId));
      return {
        productId: item.productId?._id || item.productId,
        name: item.name || match?.name || "Product",
        sellingPrice: match?.sellingPrice || item.unitCost * 1.25,
        barcode: item.barcode || match?.barcode,
        sku: match?.sku,
        category: match?.category,
        unit: match?.unit,
        printQuantity: item.receivedQuantity || item.quantity || 1,
      };
    });

    setQueue((prev) => {
      // Merge by productId or append
      const map = new Map(prev.map((i) => [i.productId, i]));
      for (const it of imported) {
        if (map.has(it.productId)) {
          const ex = map.get(it.productId)!;
          map.set(it.productId, { ...ex, printQuantity: ex.printQuantity + it.printQuantity });
        } else {
          map.set(it.productId, it);
        }
      }
      return Array.from(map.values());
    });

    setIsPoModalOpen(false);
    setStatusMessage({
      type: "success",
      text: `Imported ${imported.length} items from PO ${po.poNumber}.`,
    });
  };

  // Bulk quantity adjustments
  const handleSetAllQuantities = (qty: number) => {
    setQueue((prev) => prev.map((item) => ({ ...item, printQuantity: qty })));
  };

  // Total label count
  const totalLabelsToPrint = useMemo(() => {
    return queue.reduce((acc, item) => acc + (item.printQuantity || 0), 0);
  }, [queue]);

  // Flattened array of items for preview and printing (repeating based on printQuantity)
  const expandedPrintItems = useMemo(() => {
    const list: any[] = [];
    for (const item of queue) {
      for (let i = 0; i < (item.printQuantity || 0); i++) {
        list.push(item);
      }
    }
    return list;
  }, [queue]);

  // Filtered search list
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [products, searchQuery]);

  const storeName = business?.name || "SRI LANKA RETAIL";

  return (
    <AppLayout>
      <div className="space-y-6 pb-16">
        {/* Printable Root Area: ONLY shown during print */}
        <div id="thermal-print-area" className="hidden print:block bg-white text-black p-0 m-0">
          <style jsx global>{`
            @media print {
              body {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              header,
              aside,
              nav,
              .no-print,
              button {
                display: none !important;
              }
              .shelf-edge-label,
              .product-barcode-sticker,
              .compact-sticker,
              .scale-barcode-sticker {
                page-break-after: always;
                page-break-inside: avoid;
                margin: 0 auto !important;
              }
              .a4-sheet {
                page-break-after: always;
                page-break-inside: avoid;
              }
            }
          `}</style>

          {selectedTemplate === "SHELF_EDGE" && (
            <div className="space-y-1">
              {expandedPrintItems.map((item, idx) => (
                <div key={idx} className="print-label-wrapper py-1">
                  <ShelfEdgeLabel
                    product={item}
                    businessName={storeName}
                    showStoreName={showStoreName}
                    showDate={showDate}
                  />
                </div>
              ))}
            </div>
          )}

          {selectedTemplate === "PRODUCT_STICKER" && (
            <div className="space-y-1">
              {expandedPrintItems.map((item, idx) => (
                <div key={idx} className="print-label-wrapper py-0.5">
                  <ProductBarcodeSticker
                    product={item}
                    businessName={storeName}
                    showStoreName={showStoreName}
                    showDate={showDate}
                  />
                </div>
              ))}
            </div>
          )}

          {selectedTemplate === "COMPACT" && (
            <div className="space-y-1">
              {expandedPrintItems.map((item, idx) => (
                <div key={idx} className="print-label-wrapper py-0.5">
                  <CompactSticker product={item} />
                </div>
              ))}
            </div>
          )}

          {selectedTemplate === "SCALE_STICKER" && (
            <div className="space-y-1">
              {expandedPrintItems.map((item, idx) => {
                const weight = item.weightKg || 1.0;
                const total = Math.round(item.sellingPrice * weight * 100) / 100;
                const barcode = generateScaleBarcode({
                  type: "WEIGHT",
                  pluCode: item.pluCode || "101",
                  weightKg: weight,
                });
                return (
                  <div key={idx} className="print-label-wrapper scale-barcode-sticker py-0.5">
                    <ScaleBarcodeSticker
                      storeName={storeName}
                      storePhone={business?.phone}
                      productName={item.name}
                      productNameSinhala={item.nameSinhala}
                      productNameTamil={item.nameTamil}
                      pluCode={item.pluCode}
                      unitPrice={item.sellingPrice}
                      netWeightKg={weight}
                      tareGrams={item.tareWeightGrams || 5}
                      totalPrice={total}
                      barcode={barcode}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {selectedTemplate === "A4_SHEET" && (
            <A4LabelSheet
              items={expandedPrintItems}
              businessName={storeName}
              showStoreName={showStoreName}
              showDate={showDate}
            />
          )}
        </div>

        {/* Regular UI Area: Hidden during print */}
        <div className="print:hidden space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Barcode className="w-5 h-5" />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                  Barcode & Shelf-Edge Labels
                </h1>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Print supermarket shelf-edge talkers (80mm), packaging stickers (50x25mm), and A4 adhesive sheets
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleLoadAllProduce}
                className="flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-700 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/40 shadow-sm transition"
              >
                <Scale className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Produce Scale Stickers
              </button>

              <button
                onClick={() => setIsPoModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/50 shadow-sm transition"
              >
                <FileText className="w-4 h-4 text-indigo-500" />
                Import from PO
              </button>

              <button
                onClick={() => window.print()}
                disabled={queue.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition active:scale-95"
              >
                <Printer className="w-4 h-4" />
                Print {totalLabelsToPrint > 0 ? `(${totalLabelsToPrint})` : ""}
              </button>
            </div>
          </div>

          {/* Toast Message */}
          {statusMessage && (
            <div
              className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main 2-Column Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Print Queue Manager */}
            <div className="lg:col-span-7 space-y-4">
              {/* Product Search & Barcode Scan Input */}
              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product name, scan barcode, or enter SKU..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                </div>

                {/* Autocomplete Search Dropdown */}
                {filteredProducts.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredProducts.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => {
                          handleAddToQueue(p);
                          setSearchQuery("");
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between transition text-xs"
                      >
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-white">{p.name}</div>
                          <div className="text-zinc-500 text-[11px]">
                            {p.barcode ? `Barcode: ${p.barcode}` : p.sku ? `SKU: ${p.sku}` : "No Code"} | Stock: {p.stockQuantity} {p.unit}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-blue-600 dark:text-blue-400">
                            {formatCurrency(p.sellingPrice)}
                          </span>
                          <span className="ml-2 text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.5 rounded">
                            + Add
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Queue Table Card */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Print Queue ({queue.length} items)
                    </span>
                    <span className="text-xs font-black px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-full">
                      {totalLabelsToPrint} Labels Total
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-zinc-400 text-[11px] mr-1">Bulk Qty:</span>
                    <button
                      onClick={() => handleSetAllQuantities(1)}
                      className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 rounded font-semibold text-zinc-700 dark:text-zinc-300"
                    >
                      1
                    </button>
                    <button
                      onClick={() => handleSetAllQuantities(5)}
                      className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 rounded font-semibold text-zinc-700 dark:text-zinc-300"
                    >
                      5
                    </button>
                    <button
                      onClick={() => handleSetAllQuantities(10)}
                      className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 rounded font-semibold text-zinc-700 dark:text-zinc-300"
                    >
                      10
                    </button>
                    {queue.length > 0 && (
                      <button
                        onClick={() => setQueue([])}
                        className="ml-2 text-rose-500 hover:text-rose-700 font-bold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-[460px] overflow-y-auto">
                  {queue.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 space-y-2">
                      <Barcode className="w-10 h-10 mx-auto text-zinc-300 stroke-1" />
                      <p className="text-xs">Your print queue is empty.</p>
                      <p className="text-[11px] text-zinc-500">
                        Search products above or click "Import from PO" to begin.
                      </p>
                    </div>
                  ) : (
                    queue.map((item, idx) => (
                      <div
                        key={item.productId}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-zinc-900 dark:text-white truncate">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-zinc-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono">{item.barcode || item.sku || "NO BARCODE"}</span>
                            <span>•</span>
                            <span className="font-bold text-zinc-700 dark:text-zinc-300">
                              {formatCurrency(item.sellingPrice)}
                            </span>
                          </div>
                        </div>

                        {/* If SCALE_STICKER: Show Net Weight adjustment */}
                        {selectedTemplate === "SCALE_STICKER" && (
                          <div className="flex items-center gap-1 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-lg px-2 py-1">
                            <span className="text-[10px] text-teal-700 dark:text-teal-400 font-bold">Wt:</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0.01"
                              value={item.weightKg || 1.0}
                              onChange={(e) => {
                                const val = Math.max(0.01, parseFloat(e.target.value) || 0.1);
                                setQueue((prev) =>
                                  prev.map((q, i) => (i === idx ? { ...q, weightKg: val } : q))
                                );
                              }}
                              className="w-14 text-center font-mono font-bold text-xs bg-white dark:bg-zinc-900 border border-teal-300 dark:border-teal-700 rounded px-1"
                            />
                            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">kg</span>
                          </div>
                        )}

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setQueue((prev) =>
                                prev.map((q, i) =>
                                  i === idx
                                    ? { ...q, printQuantity: Math.max(1, q.printQuantity - 1) }
                                    : q
                                )
                              )
                            }
                            className="w-7 h-7 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 font-bold"
                          >
                            -
                          </button>

                          <input
                            type="number"
                            min={1}
                            value={item.printQuantity}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setQueue((prev) =>
                                prev.map((q, i) =>
                                  i === idx ? { ...q, printQuantity: val } : q
                                )
                              );
                            }}
                            className="w-12 py-1 text-center font-bold text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setQueue((prev) =>
                                prev.map((q, i) =>
                                  i === idx ? { ...q, printQuantity: q.printQuantity + 1 } : q
                                )
                              )
                            }
                            className="w-7 h-7 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 font-bold"
                          >
                            +
                          </button>

                          <button
                            type="button"
                            onClick={() => setQueue((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 transition ml-1"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Label Format & Live Preview */}
            <div className="lg:col-span-5 space-y-4">
              {/* Template Selector Card */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
                  Select Label Format
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate("SHELF_EDGE")}
                    className={`p-2 rounded-xl border text-left transition ${
                      selectedTemplate === "SHELF_EDGE"
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-300 ring-2 ring-blue-500/20"
                        : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="font-bold text-xs">1. Shelf-Edge</div>
                    <div className="text-[10px] text-zinc-500">80mm Gondola</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTemplate("PRODUCT_STICKER")}
                    className={`p-2 rounded-xl border text-left transition ${
                      selectedTemplate === "PRODUCT_STICKER"
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-300 ring-2 ring-blue-500/20"
                        : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="font-bold text-xs">2. Product Sticker</div>
                    <div className="text-[10px] text-zinc-500">50x25mm Standard</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTemplate("COMPACT")}
                    className={`p-2 rounded-xl border text-left transition ${
                      selectedTemplate === "COMPACT"
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-300 ring-2 ring-blue-500/20"
                        : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="font-bold text-xs">3. Compact Mini</div>
                    <div className="text-[10px] text-zinc-500">38x20mm Meds</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTemplate("SCALE_STICKER")}
                    className={`p-2 rounded-xl border text-left transition ${
                      selectedTemplate === "SCALE_STICKER"
                        ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-900 dark:text-teal-300 ring-2 ring-teal-500/20 font-bold"
                        : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1 text-teal-600 dark:text-teal-400">
                      <Scale className="w-3.5 h-3.5" /> 4. Scale Sticker
                    </div>
                    <div className="text-[10px] text-zinc-500">58x40mm Produce</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTemplate("A4_SHEET")}
                    className={`p-2 rounded-xl border text-left transition ${
                      selectedTemplate === "A4_SHEET"
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-300 ring-2 ring-blue-500/20"
                        : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="font-bold text-xs">5. A4 Sheet</div>
                    <div className="text-[10px] text-zinc-500">24-up Laser</div>
                  </button>
                </div>

                {/* Option Toggles */}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={showStoreName}
                      onChange={(e) => setShowStoreName(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Include Store Name</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={showDate}
                      onChange={(e) => setShowDate(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Include Print Date</span>
                  </label>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
                  <span className="uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                    Live Print Preview
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {queue.length > 0 ? "Showing first item in queue" : "Sample Preview"}
                  </span>
                </div>

                <div className="p-4 bg-zinc-100 dark:bg-zinc-950 rounded-xl flex items-center justify-center min-h-[220px] overflow-hidden border border-dashed border-zinc-300 dark:border-zinc-800">
                  {queue.length > 0 ? (
                    (() => {
                      const sampleProduct = queue[0];
                      if (selectedTemplate === "SHELF_EDGE") {
                        return (
                          <ShelfEdgeLabel
                            product={sampleProduct}
                            businessName={storeName}
                            showStoreName={showStoreName}
                            showDate={showDate}
                          />
                        );
                      }
                      if (selectedTemplate === "PRODUCT_STICKER") {
                        return (
                          <ProductBarcodeSticker
                            product={sampleProduct}
                            businessName={storeName}
                            showStoreName={showStoreName}
                            showDate={showDate}
                          />
                        );
                      }
                      if (selectedTemplate === "COMPACT") {
                        return <CompactSticker product={sampleProduct} />;
                      }
                      if (selectedTemplate === "SCALE_STICKER") {
                        const weight = sampleProduct.weightKg || 1.0;
                        const total = Math.round(sampleProduct.sellingPrice * weight * 100) / 100;
                        const barcode = generateScaleBarcode({
                          type: "WEIGHT",
                          pluCode: sampleProduct.pluCode || "101",
                          weightKg: weight,
                        });
                        return (
                          <ScaleBarcodeSticker
                            storeName={storeName}
                            storePhone={business?.phone}
                            productName={sampleProduct.name}
                            productNameSinhala={sampleProduct.nameSinhala}
                            productNameTamil={sampleProduct.nameTamil}
                            pluCode={sampleProduct.pluCode}
                            unitPrice={sampleProduct.sellingPrice}
                            netWeightKg={weight}
                            tareGrams={sampleProduct.tareWeightGrams || 5}
                            totalPrice={total}
                            barcode={barcode}
                          />
                        );
                      }
                      return (
                        <div className="scale-75 origin-top">
                          <A4LabelSheet
                            items={[sampleProduct, sampleProduct, sampleProduct]}
                            businessName={storeName}
                            showStoreName={showStoreName}
                            showDate={showDate}
                          />
                        </div>
                      );
                    })()
                  ) : (
                    <ShelfEdgeLabel
                      product={{
                        name: "Munchee Super Cream Cracker 490g",
                        sellingPrice: 380,
                        barcode: "4792038000123",
                        sku: "MUNCH-SCC-490",
                        category: "Biscuits",
                        unit: "490 g",
                      }}
                      businessName={storeName}
                      showStoreName={showStoreName}
                      showDate={showDate}
                    />
                  )}
                </div>

                <div className="text-[11px] text-zinc-500 text-center">
                  Tip: Use Google Chrome print dialog with "Margins: None" for direct thermal roll alignment.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Import from Purchase Order (GRN) Modal */}
        {isPoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl my-8 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                      Import Labels from Purchase Order
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Batch-generate price stickers matching received inventory quantities
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPoModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800">
                {purchaseOrders.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-400">
                    No purchase orders found. Create purchase orders under "Purchases & Vendors".
                  </div>
                ) : (
                  purchaseOrders.map((po) => (
                    <div
                      key={po._id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition text-xs"
                    >
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          <span>{po.poNumber}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              po.status === "RECEIVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-zinc-100 text-zinc-800"
                            }`}
                          >
                            {po.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          Supplier: {po.supplierName} • {po.items?.length || 0} line items
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleImportPo(po)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                      >
                        Import Items
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function LabelsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading Label Studio...</div>}>
      <LabelsContent />
    </Suspense>
  );
}
