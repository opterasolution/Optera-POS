"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import {
  ShieldCheck,
  Download,
  RotateCcw,
  Clock,
  Database,
  Users,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Lock,
  Calendar,
  Sparkles,
  ArrowLeft,
  Server,
  X,
  FileDown,
  Layers,
  Settings,
} from "lucide-react";

interface SnapshotCollectionMeta {
  name: string;
  count: number;
  sizeBytes: number;
}

interface BackupSnapshotItem {
  _id: string;
  snapshotId: string;
  type: "AUTOMATED_DAILY" | "AUTOMATED_WEEKLY" | "MANUAL" | "PRE_UPGRADE";
  status: "COMPLETED" | "IN_PROGRESS" | "FAILED" | "RESTORED";
  collections: SnapshotCollectionMeta[];
  totalRecords: number;
  fileSizeBytes: number;
  checksumSha256: string;
  storageLocation: "CLOUD_VAULT" | "LOCAL_VAULT";
  initiator: string;
  retentionDays: number;
  expiresAt: string;
  restoredAt?: string;
  restoredBy?: string;
  notes?: string;
  createdAt: string;
}

export default function BackupsPage() {
  const [snapshots, setSnapshots] = useState<BackupSnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Restore Modal State
  const [restoreModalSnapshot, setRestoreModalSnapshot] = useState<BackupSnapshotItem | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [restoring, setRestoring] = useState(false);

  // Copied hash state
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Load Snapshots
  const fetchSnapshots = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/backup/snapshots");
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      }
    } catch (err) {
      console.error("Failed to load snapshots:", err);
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSnapshots(false);
  }, []);

  const notify = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Create Snapshot
  const handleCreateSnapshot = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/backup/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "MANUAL", notes: "Manual cloud backup snapshot" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify("success", data.message || "Snapshot created successfully!");
        fetchSnapshots(true);
      } else {
        notify("error", data.error || "Failed to create snapshot");
      }
    } catch {
      notify("error", "Network error creating snapshot");
    } finally {
      setCreating(false);
    }
  };

  // Execute Restore
  const handleExecuteRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreModalSnapshot) return;
    if (confirmInput.trim() !== "CONFIRM RESTORE") {
      notify("error", 'You must type "CONFIRM RESTORE" to proceed');
      return;
    }

    setRestoring(true);
    try {
      const res = await fetch(`/api/backup/snapshots/${restoreModalSnapshot._id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationText: confirmInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify("success", data.message || "Disaster recovery restored database!");
        setRestoreModalSnapshot(null);
        setConfirmInput("");
        fetchSnapshots(true);
      } else {
        notify("error", data.error || "Restore operation failed");
      }
    } catch {
      notify("error", "Network error during database restore");
    } finally {
      setRestoring(false);
    }
  };

  // Prune / Delete Snapshot
  const handleDeleteSnapshot = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete snapshot ${name}?`)) return;
    try {
      const res = await fetch(`/api/backup/snapshots/${id}`, { method: "DELETE" });
      if (res.ok) {
        notify("success", `Snapshot ${name} deleted`);
        fetchSnapshots(true);
      }
    } catch {
      notify("error", "Failed to delete snapshot");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const totalArchivedRecords = snapshots.reduce((sum, s) => sum + (s.totalRecords || 0), 0);
  const lastBackupTime = snapshots[0]?.createdAt
    ? new Date(snapshots[0].createdAt).toLocaleString()
    : "Never";

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 shadow-2xs"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Cloud Backup & Disaster Recovery
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  SHA-256 Verified
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Automated daily snapshots, Inland Revenue Department data exports & point-in-time recovery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateSnapshot}
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow-md transition disabled:opacity-50"
            >
              <Server className={`w-4 h-4 ${creating ? "animate-spin" : ""}`} />
              <span>{creating ? "Generating Snapshot..." : "Create Instant Backup"}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchSnapshots(false)}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-2xs transition"
              title="Refresh Snapshots"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 animate-bounce ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Vault Health Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold">Vault Security</div>
              <div className="text-base font-black text-slate-900">Protected & Active</div>
              <div className="text-[10px] text-emerald-600 font-bold">256-Bit Cryptographic Hash</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold">Archived Snapshots</div>
              <div className="text-base font-black text-slate-900">{snapshots.length} Vault Snapshots</div>
              <div className="text-[10px] text-slate-400">{totalArchivedRecords.toLocaleString()} Records</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold">Last Backup</div>
              <div className="text-xs font-black text-slate-900 truncate max-w-[150px]" title={lastBackupTime}>
                {lastBackupTime}
              </div>
              <div className="text-[10px] text-amber-700 font-semibold">Status: Verified OK</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold">Automated Schedule</div>
              <div className="text-base font-black text-slate-900">Daily at 02:00 AM</div>
              <div className="text-[10px] text-purple-700 font-semibold">Retention: 30 Days</div>
            </div>
          </div>
        </div>

        {/* One-Click Merchant Data Export Center */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <FileDown className="w-4 h-4 text-blue-600" />
                One-Click Business Data Portability (CSV Exports)
              </h3>
              <p className="text-xs text-slate-500">
                Instantly export full records for accountant review, inventory reconciliation, or Sri Lanka IRD tax audits.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <a
              href="/api/backup/export?type=PRODUCTS"
              download
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="font-bold text-xs text-slate-900">Products & Inventory</div>
                  <div className="text-[10px] text-slate-500">Barcodes, stock, prices</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition" />
            </a>

            <a
              href="/api/backup/export?type=SALES"
              download
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-bold text-xs text-slate-900">Sales Invoices Ledger</div>
                  <div className="text-[10px] text-slate-500">Line items, taxes, totals</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition" />
            </a>

            <a
              href="/api/backup/export?type=CUSTOMERS"
              download
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="font-bold text-xs text-slate-900">Customer Credit Book</div>
                  <div className="text-[10px] text-slate-500">Phone numbers, debts</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition" />
            </a>

            <a
              href="/api/backup/export?type=EXPENSES"
              download
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                <div>
                  <div className="font-bold text-xs text-slate-900">Expenses & Cash Drops</div>
                  <div className="text-[10px] text-slate-500">Vouchers, petty cash</div>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition" />
            </a>
          </div>
        </div>

        {/* Snapshot Vault Table */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-700" />
              <h3 className="font-black text-slate-900 text-sm">Historical Cloud Snapshot Vault</h3>
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              Showing {snapshots.length} snapshots
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3.5">Snapshot ID & Timestamp</th>
                  <th className="p-3.5">Type & Initiator</th>
                  <th className="p-3.5">Collections & Records</th>
                  <th className="p-3.5">Size</th>
                  <th className="p-3.5">SHA-256 Checksum</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Loading snapshot vault records...
                    </td>
                  </tr>
                ) : snapshots.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No snapshots available. Click "Create Instant Backup" above to generate your first backup.
                    </td>
                  </tr>
                ) : (
                  snapshots.map((snap) => {
                    const isRestored = snap.status === "RESTORED";
                    const shortHash = `${snap.checksumSha256.slice(0, 8)}...${snap.checksumSha256.slice(-8)}`;

                    return (
                      <tr key={snap._id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5">
                          <div className="font-mono font-black text-slate-900">{snap.snapshotId}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{new Date(snap.createdAt).toLocaleString()}</span>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              snap.type.startsWith("AUTOMATED")
                                ? "bg-blue-50 text-blue-800 border border-blue-200"
                                : "bg-purple-50 text-purple-800 border border-purple-200"
                            }`}
                          >
                            {snap.type.replace("_", " ")}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-1 truncate max-w-[130px]">
                            {snap.initiator}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-slate-800 font-mono">
                            {snap.totalRecords.toLocaleString()} Records
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {snap.collections?.length || 0} Collections
                          </div>
                        </td>

                        <td className="p-3.5 font-mono text-slate-700">
                          {formatBytes(snap.fileSizeBytes)}
                        </td>

                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 cursor-pointer"
                              title="Click to copy full SHA-256 hash"
                              onClick={() => copyToClipboard(snap.checksumSha256)}
                            >
                              {shortHash}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(snap.checksumSha256)}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                            >
                              {copiedHash === snap.checksumSha256 ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isRestored
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {snap.status}
                          </span>
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={`/api/backup/snapshots/${snap._id}/download`}
                              download
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                              title="Download Backup JSON File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                setRestoreModalSnapshot(snap);
                                setConfirmInput("");
                              }}
                              className="p-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition"
                              title="Point-in-Time Restore"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSnapshot(snap._id, snap.snapshotId)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                              title="Delete Snapshot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= MODAL: POINT-IN-TIME DISASTER RECOVERY ================= */}
        {restoreModalSnapshot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-red-300 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-red-100 text-red-700">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      Point-in-Time Disaster Recovery
                    </h3>
                    <p className="text-xs text-slate-500">
                      Snapshot: {restoreModalSnapshot.snapshotId}
                    </p>
                  </div>
                </div>

                <button onClick={() => setRestoreModalSnapshot(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Warning Notice */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Cryptographic Integrity Gate Active</span>
                </div>
                <p>
                  The system will verify the <strong>SHA-256 checksum</strong> before applying any changes.
                  All current database records will be rolled back to the exact state captured on{" "}
                  <strong>{new Date(restoreModalSnapshot.createdAt).toLocaleString()}</strong>.
                </p>
              </div>

              {/* Snapshot Metadata Breakdown */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Records:</span>
                  <span className="font-bold text-slate-900">{restoreModalSnapshot.totalRecords.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Uncompressed Size:</span>
                  <span className="font-bold text-slate-900">{formatBytes(restoreModalSnapshot.fileSizeBytes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">SHA-256 Hash:</span>
                  <span className="text-[10px] text-slate-700 truncate max-w-[240px]">
                    {restoreModalSnapshot.checksumSha256}
                  </span>
                </div>
              </div>

              {/* Confirmation Input Form */}
              <form onSubmit={handleExecuteRestore} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    To authorize recovery, please type <span className="text-red-600 font-mono font-black">CONFIRM RESTORE</span> below:
                  </label>
                  <input
                    type="text"
                    placeholder="CONFIRM RESTORE"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-sm tracking-wider"
                    required
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRestoreModalSnapshot(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={confirmInput !== "CONFIRM RESTORE" || restoring}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md transition disabled:opacity-40"
                  >
                    {restoring ? "Verifying & Restoring..." : "Verify Hash & Execute Restore"}
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
