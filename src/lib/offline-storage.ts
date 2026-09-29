/**
 * Sri Lanka POS — Local Offline Storage & Queue Manager
 * 
 * Provides crash-resilient caching for product catalogs, store settings,
 * and pending offline transactions when retail counters experience network drops.
 */

export interface CachedProduct {
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

export interface CachedCategory {
  _id: string;
  name: string;
  color?: string;
}

export interface OfflineSaleRecord {
  offlineId: string; // Unique client UUID
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }>;
  customerName?: string;
  customerPhone?: string;
  discountTotal?: number;
  paymentMethod: "CASH" | "CARD" | "QR" | "BANK_TRANSFER" | "OTHER";
  cashReceived?: number;
  changeGiven?: number;
  paymentReference?: string;
  registerId?: string;
  registerName?: string;
  subtotal: number;
  taxTotal: number;
  netTotal: number;
  createdAt: string; // ISO string
  tempInvoiceNumber: string;
}

const isClient = () => typeof window !== "undefined";

const PREFIX = "slpos_";

function getBizKey(businessId: string, suffix: string): string {
  const safeId = businessId || "default";
  return `${PREFIX}${safeId}_${suffix}`;
}

/**
 * Saves product catalog and categories into local storage cache
 */
export function saveCatalogCache(
  businessId: string,
  products: CachedProduct[],
  categories?: CachedCategory[],
  businessSettings?: any
) {
  if (!isClient()) return;
  try {
    if (products) {
      localStorage.setItem(getBizKey(businessId, "products"), JSON.stringify(products));
      localStorage.setItem(getBizKey(businessId, "products_updated_at"), new Date().toISOString());
    }
    if (categories) {
      localStorage.setItem(getBizKey(businessId, "categories"), JSON.stringify(categories));
    }
    if (businessSettings) {
      localStorage.setItem(getBizKey(businessId, "settings"), JSON.stringify(businessSettings));
    }
  } catch (err) {
    console.warn("Could not save catalog cache to localStorage (quota or disabled):", err);
  }
}

/**
 * Retrieves cached catalog from local storage
 */
export function getCatalogCache(businessId: string): {
  products: CachedProduct[];
  categories: CachedCategory[];
  settings: any | null;
  lastUpdated: string | null;
} {
  if (!isClient()) {
    return { products: [], categories: [], settings: null, lastUpdated: null };
  }

  try {
    const rawProd = localStorage.getItem(getBizKey(businessId, "products"));
    const rawCat = localStorage.getItem(getBizKey(businessId, "categories"));
    const rawSet = localStorage.getItem(getBizKey(businessId, "settings"));
    const lastUpdated = localStorage.getItem(getBizKey(businessId, "products_updated_at"));

    return {
      products: rawProd ? JSON.parse(rawProd) : [],
      categories: rawCat ? JSON.parse(rawCat) : [],
      settings: rawSet ? JSON.parse(rawSet) : null,
      lastUpdated,
    };
  } catch (err) {
    console.warn("Failed to read catalog cache from localStorage:", err);
    return { products: [], categories: [], settings: null, lastUpdated: null };
  }
}

/**
 * Locally decrements stock quantity for items sold while offline so cashiers
 * see up-to-date remaining quantities.
 */
export function decrementLocalStockCache(
  businessId: string,
  soldItems: Array<{ productId: string; quantity: number }>
) {
  if (!isClient()) return;
  try {
    const { products } = getCatalogCache(businessId);
    if (!products || products.length === 0) return;

    const soldMap = new Map(soldItems.map((i) => [i.productId, i.quantity]));
    const updated = products.map((p) => {
      const soldQty = soldMap.get(p._id);
      if (soldQty) {
        return { ...p, stockQuantity: Math.max(0, p.stockQuantity - soldQty) };
      }
      return p;
    });

    localStorage.setItem(getBizKey(businessId, "products"), JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to update local stock cache:", err);
  }
}

/**
 * Pushes a completed offline sale into the synchronization queue
 */
export function enqueueOfflineSale(businessId: string, sale: OfflineSaleRecord) {
  if (!isClient()) return;
  try {
    const queue = getQueuedOfflineSales(businessId);
    // Prevent duplicate push if same offlineId
    const existingIdx = queue.findIndex((s) => s.offlineId === sale.offlineId);
    if (existingIdx > -1) {
      queue[existingIdx] = sale;
    } else {
      queue.push(sale);
    }
    localStorage.setItem(getBizKey(businessId, "offline_queue"), JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to enqueue offline sale:", err);
  }
}

/**
 * Returns all pending offline sales waiting for cloud synchronization
 */
export function getQueuedOfflineSales(businessId: string): OfflineSaleRecord[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(getBizKey(businessId, "offline_queue"));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Removes a successfully synced sale from the offline queue
 */
export function removeQueuedOfflineSale(businessId: string, offlineId: string) {
  if (!isClient()) return;
  try {
    const queue = getQueuedOfflineSales(businessId);
    const filtered = queue.filter((s) => s.offlineId !== offlineId);
    localStorage.setItem(getBizKey(businessId, "offline_queue"), JSON.stringify(filtered));
  } catch (err) {
    console.warn("Failed to remove queued offline sale:", err);
  }
}

/**
 * Clears the offline queue (e.g. after full batch synchronization)
 */
export function clearOfflineQueue(businessId: string) {
  if (!isClient()) return;
  try {
    localStorage.removeItem(getBizKey(businessId, "offline_queue"));
  } catch {}
}

/**
 * Returns the count of pending offline sales for badge display
 */
export function getQueuedSalesCount(businessId: string): number {
  return getQueuedOfflineSales(businessId).length;
}
