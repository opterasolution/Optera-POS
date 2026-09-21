"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getQueuedOfflineSales,
  removeQueuedOfflineSale,
  getQueuedSalesCount,
  OfflineSaleRecord,
} from "@/lib/offline-storage";

interface SyncResult {
  syncedCount: number;
  results: Array<{
    offlineId: string;
    invoiceNumber: string;
    success: boolean;
  }>;
}

export function useNetworkStatus(businessId: string) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Sync state ref to avoid concurrent sync races
  const isSyncingRef = useRef(false);

  // Refresh queued bills count
  const refreshQueueCount = useCallback(() => {
    if (businessId) {
      setQueuedCount(getQueuedSalesCount(businessId));
    }
  }, [businessId]);

  // Synchronize queued offline sales with cloud database
  const syncQueuedSales = useCallback(async (): Promise<SyncResult | null> => {
    if (!businessId || isSyncingRef.current) return null;

    const queued = getQueuedOfflineSales(businessId);
    if (queued.length === 0) {
      setQueuedCount(0);
      return null;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const res = await fetch("/api/sales/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sales: queued }),
      });

      const data = await res.json();

      if (res.ok && data.success && Array.isArray(data.results)) {
        // Remove confirmed synced sales from local queue
        for (const item of data.results) {
          if (item.success && item.offlineId) {
            removeQueuedOfflineSale(businessId, item.offlineId);
          }
        }

        const remainingCount = getQueuedSalesCount(businessId);
        setQueuedCount(remainingCount);

        const syncSummary: SyncResult = {
          syncedCount: data.syncedCount || data.results.length,
          results: data.results,
        };

        setLastSyncResult(syncSummary);
        return syncSummary;
      }
      return null;
    } catch (err) {
      console.warn("Background sync failed; offline queue preserved:", err);
      return null;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      refreshQueueCount();
    }
  }, [businessId, refreshQueueCount]);

  // Setup network status listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initial check
    const currentStatus = navigator.onLine;
    setIsOnline(currentStatus);
    refreshQueueCount();

    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Auto-sync queued sales upon reconnection
      syncQueuedSales();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshQueueCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Heartbeat check every 25 seconds to verify real WAN connectivity
    const pingInterval = setInterval(async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      try {
        const pingRes = await fetch("/api/health", {
          method: "GET",
          cache: "no-store",
        });

        if (pingRes.ok) {
          if (!isOnline) {
            setIsOnline(true);
            setWasOffline(true);
            syncQueuedSales();
          }
        } else {
          setIsOnline(false);
        }
      } catch {
        // Network fetch threw; internet or host dropped
        setIsOnline(false);
      }
      refreshQueueCount();
    }, 25000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(pingInterval);
    };
  }, [businessId, isOnline, refreshQueueCount, syncQueuedSales]);

  return {
    isOnline,
    wasOffline,
    queuedCount,
    isSyncing,
    lastSyncResult,
    refreshQueueCount,
    syncQueuedSales,
  };
}
