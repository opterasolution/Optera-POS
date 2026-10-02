"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { Language, translations, TranslationsSchema } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, fallback?: string) => string;
  strings: TranslationsSchema;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "sl_pos_language";

export function LanguageProvider({
  children,
  defaultLang = "en",
}: {
  children: React.ReactNode;
  defaultLang?: Language;
}) {
  const [language, setLanguageState] = useState<Language>(defaultLang);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language;
      if (stored && (stored === "en" || stored === "si" || stored === "ta")) {
        setLanguageState(stored);
      }
    } catch {}
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      if (typeof document !== "undefined") {
        document.documentElement.lang = lang;
      }
    } catch {}
  };

  const strings = useMemo(() => {
    return translations[language] || translations.en;
  }, [language]);

  const t = (path: string, fallback?: string): string => {
    try {
      const parts = path.split(".");
      let current: any = strings;

      for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
          current = current[part];
        } else {
          // Fallback to English dictionary if key missing in current language
          let enCurrent: any = translations.en;
          for (const enPart of parts) {
            if (enCurrent && typeof enCurrent === "object" && enPart in enCurrent) {
              enCurrent = enCurrent[enPart];
            } else {
              return fallback || path;
            }
          }
          return typeof enCurrent === "string" ? enCurrent : fallback || path;
        }
      }

      return typeof current === "string" ? current : fallback || path;
    } catch {
      return fallback || path;
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, strings }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback for components outside LanguageProvider
    return {
      language: "en" as Language,
      setLanguage: () => {},
      t: (path: string, fallback?: string) => fallback || path,
      strings: translations.en,
    };
  }
  return context;
}

export const useTranslation = useLanguage;
