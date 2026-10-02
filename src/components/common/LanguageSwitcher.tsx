"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  variant?: "pills" | "dropdown" | "minimal";
  className?: string;
  showIcon?: boolean;
}

export default function LanguageSwitcher({
  variant = "pills",
  className = "",
  showIcon = true,
}: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  const options: Array<{ code: "en" | "si" | "ta"; label: string; short: string }> = [
    { code: "en", label: "English", short: "EN" },
    { code: "si", label: "සිංහල", short: "සිං" },
    { code: "ta", label: "தமிழ்", short: "தமி" },
  ];

  if (variant === "minimal") {
    return (
      <div className={`inline-flex items-center gap-1 text-xs font-semibold ${className}`}>
        {showIcon && <Globe className="w-3.5 h-3.5 text-slate-400" />}
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as "en" | "si" | "ta")}
          className="bg-transparent text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
        >
          {options.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shadow-2xs ${className}`}
    >
      {showIcon && (
        <div className="pl-1.5 pr-0.5 text-slate-400">
          <Globe className="w-3.5 h-3.5" />
        </div>
      )}
      {options.map((opt) => {
        const isActive = language === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLanguage(opt.code)}
            title={opt.label}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
              isActive
                ? "bg-white text-blue-600 shadow-xs scale-100"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <span>{opt.short}</span>
          </button>
        );
      })}
    </div>
  );
}
