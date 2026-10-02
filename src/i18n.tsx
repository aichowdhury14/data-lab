import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { smoothly } from "./transition";

export type Lang = "en" | "bn";
export type T = { en: string; bn: string };

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (x: T) => string;
}

const LangContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (x) => x.en });

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "en" || saved === "bn") return saved;
  } catch {
    /* storage unavailable */
  }
  return "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem("lang", l);
    } catch {
      /* ignore */
    }
    smoothly(() => {
      document.documentElement.lang = l;
      setLangState(l);
    });
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  // A stable context value: components only re-render when the language actually changes.
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (x) => x[lang] }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
