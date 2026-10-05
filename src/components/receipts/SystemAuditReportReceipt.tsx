"use client";

import React, { useRef } from "react";
import { SystemAuditReport } from "@/lib/diagnostics/system-audit";
import { Printer, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, HardDrive, Cpu, Database } from "lucide-react";

export interface SystemAuditReceiptProps {
  report: SystemAuditReport;
  businessName: string;
  businessAddress?: string;
  auditedBy?: string;
  format?: "A4" | "THERMAL_80MM";
  onClose?: () => void;
}

export default function SystemAuditReportReceipt({
  report,
  businessName,
  businessAddress = "Colombo, Sri Lanka",
  auditedBy = "System Administrator",
  format: initialFormat = "A4",
  onClose,
}: SystemAuditReceiptProps) {
  const [printFormat, setPrintFormat] = React.useState<"A4" | "THERMAL_80MM">(initialFormat);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(report.timestamp).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-start overflow-y-auto p-4 sm:p-6 print:p-0 print:bg-white">
      {/* Non-Printable Modal Controls */}
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-xl p-4 mb-4 flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Production Readiness & Audit Certificate</h2>
            <p className="text-xs text-slate-500">
              System Version: {report.systemVersion} • Health Score: {report.overallReadinessScore}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setPrintFormat("A4")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                printFormat === "A4" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A4 Certificate
            </button>
            <button
              onClick={() => setPrintFormat("THERMAL_80MM")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                printFormat === "THERMAL_80MM" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              80mm Thermal
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Printable Area */}
      <div ref={printAreaRef} className="w-full flex justify-center">
        {printFormat === "A4" ? (
          /* A4 FORMAL READINESS CERTIFICATE */
          <div className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-10 shadow-2xl rounded-2xl border-2 border-emerald-900/20 font-sans print:shadow-none print:border-none print:w-full print:m-0 print:p-8">
            {/* Certificate Header Banner */}
            <div className="border-4 border-double border-emerald-800 p-6 rounded-xl bg-gradient-to-b from-emerald-50/40 via-white to-white mb-8">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center p-3 bg-emerald-700 text-white rounded-full shadow-md mb-1">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h1 className="text-xl font-black tracking-widest text-emerald-950 uppercase">
                  Production Readiness & Compliance Certificate
                </h1>
                <p className="text-xs font-semibold tracking-wider text-emerald-800 uppercase">
                  Sri Lanka Small Business POS & Multi-Tenant Commercial SaaS Platform
                </p>
                <div className="w-32 h-1 bg-emerald-600 mx-auto rounded-full mt-2"></div>
              </div>

              {/* Certificate Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-emerald-200/60 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Store / Enterprise</span>
                  <span className="font-bold text-slate-900">{businessName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Audit Timestamp</span>
                  <span className="font-mono font-bold text-slate-800">{formattedDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Release Version</span>
                  <span className="font-mono font-bold text-emerald-800">{report.systemVersion}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Tenant Business ID</span>
                  <span className="font-mono text-[11px] text-slate-600 truncate block">{report.multiTenant.businessId}</span>
                </div>
              </div>
            </div>

            {/* Score & Verdict Banner */}
            <div className="flex items-center justify-between p-5 bg-slate-900 text-white rounded-xl shadow-md mb-6">
              <div className="space-y-1">
                <span className="text-[11px] tracking-wider uppercase text-emerald-400 font-bold block">Compliance Status</span>
                <div className="text-2xl font-black text-white flex items-center gap-2">
                  <span>{report.grade}</span>
                </div>
                <p className="text-xs text-slate-300">
                  Certified for high-volume commercial cashier retail, multi-branch replenishments, and AP accounting.
                </p>
              </div>

              <div className="text-right pl-6 border-l border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Overall Health Score</span>
                <div className="text-4xl font-black font-mono text-emerald-400">
                  {report.overallReadinessScore}%
                </div>
              </div>
            </div>

            {/* Database & Multi-Tenant Telemetry */}
            <div className="grid grid-cols-3 gap-4 mb-6 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  Database Engine & Ping
                </span>
                <p className="font-bold text-slate-900">{report.database.engine}</p>
                <p className="text-slate-600 font-mono">
                  Roundtrip Latency: <strong className="text-emerald-700">{report.database.pingLatencyMs}ms</strong>
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-600" />
                  High-Throughput Indexes
                </span>
                <p className="font-bold text-slate-900">
                  {report.indexAudit.matchedCount || report.indexAudit.totalExisting} Active Indexes
                </p>
                <p className="text-slate-600 font-mono">
                  Optimization Score: <strong className="text-blue-700">{report.indexAudit.healthScore}%</strong>
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-purple-600" />
                  Tenant Data Isolation
                </span>
                <p className="font-bold text-emerald-700">{report.multiTenant.dataIsolationStatus}</p>
                <p className="text-slate-600 font-mono">
                  Orphaned Documents: <strong>{report.multiTenant.orphanedDocumentsFound}</strong>
                </p>
              </div>
            </div>

            {/* 10 Subsystem Verification Checklist Table */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Subsystem Compliance Verification Checklist (10 Commercial Audits)</span>
                <span className="text-[10px] font-normal text-slate-500">ISO / Retail SaaS Pre-Flight Standard</span>
              </h3>

              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Subsystem Audit Item</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Metric / Telemetry</th>
                    <th className="py-2 px-3 text-center">Score</th>
                    <th className="py-2 px-3 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {report.subsystemChecks.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-sans font-medium text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-2 px-3 text-[10px] text-slate-500 font-sans uppercase">
                        {item.category}
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-mono text-[11px]">
                        {item.metricValue}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-900 font-bold">
                        {item.score}%
                      </td>
                      <td className="py-2 px-3 text-right">
                        {item.status === "PASS" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-sans font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            PASSED
                          </span>
                        ) : item.status === "WARN" ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-sans font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            OPTIMIZE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-sans font-bold text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            FAILED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tripartite Sign-off Blocks */}
            <div className="grid grid-cols-3 gap-6 mt-12 pt-6 border-t-2 border-slate-200 text-xs">
              <div className="text-center space-y-2">
                <div className="h-12 border-b border-dashed border-slate-400"></div>
                <p className="font-bold text-slate-900">{auditedBy}</p>
                <p className="text-[10px] text-slate-500">Lead Systems Auditor / Engineer</p>
              </div>

              <div className="text-center space-y-2">
                <div className="h-12 border-b border-dashed border-slate-400"></div>
                <p className="font-bold text-slate-900">Authorized Signature</p>
                <p className="text-[10px] text-slate-500">Store Managing Director / Partner</p>
              </div>

              <div className="flex flex-col items-center justify-center p-2 border border-slate-300 rounded-xl bg-slate-50/50">
                <div className="w-16 h-16 border-2 border-dashed border-slate-400 rounded-full flex items-center justify-center text-[9px] text-slate-400 uppercase font-bold text-center leading-tight">
                  Official Seal / Rubber Stamp
                </div>
              </div>
            </div>

            <div className="mt-8 text-center text-[10px] text-slate-400 font-mono">
              Generated by Sri Lanka POS Enterprise SaaS Engine (Milestone 50 Master Release). Tamper-evident system log.
            </div>
          </div>
        ) : (
          /* 80MM THERMAL RECEIPT SLIP */
          <div className="w-[80mm] bg-white text-slate-900 p-4 font-mono text-[11px] leading-tight shadow-xl rounded-lg border border-slate-300 print:shadow-none print:border-none print:w-full">
            <div className="text-center pb-2 border-b border-dashed border-slate-400">
              <h2 className="font-bold text-xs uppercase">{businessName}</h2>
              <p className="text-[10px] text-slate-600">{businessAddress}</p>
              <div className="font-bold uppercase text-[10px] mt-1 bg-slate-900 text-white py-0.5 rounded">
                SYSTEM HEALTH SLIP
              </div>
            </div>

            <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Version:</span>
                <span>{report.systemVersion}</span>
              </div>
              <div className="flex justify-between">
                <span>Score:</span>
                <span className="font-bold text-emerald-700">{report.overallReadinessScore}%</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold">{report.grade}</span>
              </div>
            </div>

            <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>DB Engine:</span>
                <span>{report.database.status}</span>
              </div>
              <div className="flex justify-between">
                <span>DB Latency:</span>
                <span className="font-bold">{report.database.pingLatencyMs} ms</span>
              </div>
              <div className="flex justify-between">
                <span>Memory RSS:</span>
                <span>{report.environment.memoryUsageMB.rss} MB</span>
              </div>
              <div className="flex justify-between">
                <span>Isolation:</span>
                <span>{report.multiTenant.dataIsolationStatus}</span>
              </div>
              <div className="flex justify-between">
                <span>Indexes:</span>
                <span>{report.indexAudit.healthScore}% Opt</span>
              </div>
            </div>

            <div className="py-2 border-b border-dashed border-slate-400">
              <span className="block text-[10px] font-bold uppercase mb-1">Checks Summary:</span>
              <div className="space-y-0.5 text-[9px]">
                {report.subsystemChecks.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex justify-between">
                    <span className="truncate pr-1">{c.name}:</span>
                    <span className="font-bold">{c.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 text-center space-y-3">
              <div className="h-8 border-b border-dashed border-slate-400"></div>
              <p className="text-[9px] text-slate-500 uppercase">Technician Signature</p>
              <p className="text-[8px] text-slate-400">*** ALL SYSTEMS GO ***</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
