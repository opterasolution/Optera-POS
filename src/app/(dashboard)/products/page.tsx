"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Package,
  Plus,
  Search,
  Barcode,
  Tags,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Boxes,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Category {
  _id: string;
  name: string;
  color?: string;
}

interface Product {
  _id: string;
  name: string;
  categoryId?: { _id: string; name: string; color?: string } | string;
  sku?: string;
  barcode?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  isActive: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Status feedback
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Product Form State
  const [productForm, setProductForm] = useState({
    name: "",
    categoryId: "",
    sku: "",
    barcode: "",
    costPrice: 0,
    sellingPrice: 0,
    stockQuantity: 0,
    lowStockThreshold: 5,
    unit: "packet",
  });

  // Category Form State
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
  });

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        fetch(`/api/products?q=${encodeURIComponent(searchQuery)}&category=${selectedCategory}`),
        fetch("/api/categories"),
      ]);
      const prodJson = await prodRes.json();
      const catJson = await catRes.json();

      if (prodJson.success) setProducts(prodJson.products || []);
      if (catJson.success) setCategories(catJson.categories || []);
    } catch {
      setStatusMessage({ type: "error", text: "Failed to load products catalog." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, selectedCategory]);

  // Open Edit Product
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      categoryId: typeof p.categoryId === "object" ? p.categoryId?._id || "" : p.categoryId || "",
      sku: p.sku || "",
      barcode: p.barcode || "",
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      unit: p.unit || "pcs",
    });
    setIsProductModalOpen(true);
  };

  // Open New Product
  const openNewProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: "",
      categoryId: categories[0]?._id || "",
      sku: "",
      barcode: "",
      costPrice: 0,
      sellingPrice: 0,
      stockQuantity: 10,
      lowStockThreshold: 5,
      unit: "packet",
    });
    setIsProductModalOpen(true);
  };

  // Handle Product Save
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);

    try {
      const url = editingProduct ? `/api/products/${editingProduct._id}` : "/api/products";
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productForm),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMessage({
          type: "success",
          text: editingProduct ? "Product updated successfully." : "Product added to catalog.",
        });
        setIsProductModalOpen(false);
        loadData();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to save product." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Error saving product." });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Category Save
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      const data = await res.json();

      if (data.success) {
        setStatusMessage({ type: "success", text: `Category "${categoryForm.name}" created!` });
        setIsCategoryModalOpen(false);
        setCategoryForm({ name: "", description: "", color: "#3b82f6" });
        loadData();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to create category." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Error creating category." });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Deactivate Product
  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate "${name}"?`)) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: "success", text: `Product "${name}" deactivated.` });
        loadData();
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to deactivate." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Error deactivating product." });
    }
  };

  // Generate random retail barcode
  const generateRandomBarcode = () => {
    const randomEan = "479" + Math.floor(100000000 + Math.random() * 900000000);
    setProductForm({ ...productForm, barcode: randomEan });
  };

  // Profit Margin calculation
  const marginRs = productForm.sellingPrice - productForm.costPrice;
  const marginPercent =
    productForm.costPrice > 0
      ? Math.round((marginRs / productForm.costPrice) * 100)
      : productForm.sellingPrice > 0
      ? 100
      : 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" /> Products & Catalog
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage retail items, barcodes, categories, and stock thresholds in Sri Lankan Rupees (LKR).
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Tags className="w-3.5 h-3.5" />
              <span>New Category</span>
            </button>

            <button
              onClick={openNewProductModal}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center justify-between ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2.5 font-medium">
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product name, barcode, or SKU..."
                className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-lg font-medium shrink-0 transition-colors ${
                selectedCategory === "all"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Categories
            </button>
            {categories.map((c) => (
              <button
                key={c._id}
                onClick={() => setSelectedCategory(c._id)}
                className={`px-3 py-1.5 rounded-lg font-medium shrink-0 transition-colors ${
                  selectedCategory === c._id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Barcode / SKU</th>
                  <th className="py-3 px-4 text-right">Cost Price</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-center">Stock Level</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Loading products catalog...
                    </td>
                  </tr>
                ) : products.length > 0 ? (
                  products.map((p) => {
                    const isLow = p.stockQuantity <= p.lowStockThreshold && p.stockQuantity > 0;
                    const isOut = p.stockQuantity <= 0;
                    const catName = typeof p.categoryId === "object" ? p.categoryId?.name : "General";

                    return (
                      <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-400 capitalize">Unit: {p.unit}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[10px]">
                            {catName}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {p.barcode ? (
                            <div className="flex items-center gap-1">
                              <Barcode className="w-3.5 h-3.5 text-slate-400" />
                              <span>{p.barcode}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300">No Barcode</span>
                          )}
                          {p.sku && <div className="text-[10px] text-slate-400">SKU: {p.sku}</div>}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 font-mono">
                          {formatCurrency(p.costPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                          {formatCurrency(p.sellingPrice)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isOut
                                ? "bg-rose-100 text-rose-800"
                                : isLow
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {p.stockQuantity} {p.unit}
                            {isOut && " (Out)"}
                            {isLow && " (Low)"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(p)}
                              title="Edit Product"
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeactivate(p._id, p.name)}
                              title="Deactivate Product"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No products found. Click "Add Product" to create your first catalog item!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal 1: Add/Edit Product */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h3>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleProductSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="e.g. Munchee Super Cream Cracker 490g"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                    <select
                      value={productForm.categoryId}
                      onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">No Category</option>
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measure</label>
                    <select
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="packet">packet</option>
                      <option value="bottle">bottle</option>
                      <option value="pcs">pcs</option>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="tin">tin</option>
                      <option value="box">box</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">Barcode</label>
                      <button
                        type="button"
                        onClick={generateRandomBarcode}
                        className="text-[10px] text-blue-600 font-semibold hover:underline"
                      >
                        Auto-Generate
                      </button>
                    </div>
                    <input
                      type="text"
                      value={productForm.barcode}
                      onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                      placeholder="Scan with USB reader or type"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">SKU / Code</label>
                    <input
                      type="text"
                      value={productForm.sku}
                      onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                      placeholder="e.g. BIS-001"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Price & Margin Calculation Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Cost Price (Rs.) *
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        required
                        value={productForm.costPrice}
                        onChange={(e) =>
                          setProductForm({ ...productForm, costPrice: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Selling Price (Rs.) *
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        required
                        value={productForm.sellingPrice}
                        onChange={(e) =>
                          setProductForm({ ...productForm, sellingPrice: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 text-slate-600 font-medium">
                    <span>Gross Margin:</span>
                    <span
                      className={`font-bold ${
                        marginRs > 0 ? "text-emerald-700" : marginRs < 0 ? "text-rose-600" : "text-slate-600"
                      }`}
                    >
                      {formatCurrency(marginRs)} ({marginPercent}%)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Current Stock Qty
                    </label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={productForm.stockQuantity}
                      onChange={(e) =>
                        setProductForm({ ...productForm, stockQuantity: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Low-Stock Limit
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={productForm.lowStockThreshold}
                      onChange={(e) =>
                        setProductForm({ ...productForm, lowStockThreshold: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : editingProduct ? "Save Changes" : "Create Product"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Add Category */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Create New Category</h3>
                <button
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCategorySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder="e.g. Spices & Condiments"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    placeholder="Brief description"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    POS Button Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={categoryForm.color}
                      onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    />
                    <span className="text-xs font-mono text-slate-600">{categoryForm.color}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
                  >
                    {submitting ? "Creating..." : "Save Category"}
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
