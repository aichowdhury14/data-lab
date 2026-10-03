import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { smoothly } from "./transition";
import { setNumeralMode } from "./numerals";

export type Lang = "en" | "bn";
export type T = { en: string; bn: string };

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (x: T) => string;
  /** Show Bangla digits (১২৩) in data displays while the language is Bangla. */
  bnDigits: boolean;
  setBnDigits: (v: boolean) => void;
}

const LangContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (x) => x.en, bnDigits: true, setBnDigits: () => {} });

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

function initialLang(): Lang {
  const saved = read("lang");
  return saved === "en" || saved === "bn" ? saved : "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [bnDigits, setBnDigitsState] = useState(() => read("bn-digits") !== "0");
  // set before children render, so every number formatted in this render uses the right digits
  setNumeralMode(lang === "bn" && bnDigits ? "bn" : "latin");

  const setLang = useCallback((l: Lang) => {
    write("lang", l);
    smoothly(() => {
      document.documentElement.lang = l;
      setLangState(l);
    });
  }, []);
  const setBnDigits = useCallback((v: boolean) => {
    write("bn-digits", v ? "1" : "0");
    smoothly(() => setBnDigitsState(v));
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  // A stable context value: components only re-render when the language or digit style changes.
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (x) => x[lang], bnDigits, setBnDigits }), [lang, setLang, bnDigits, setBnDigits]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
