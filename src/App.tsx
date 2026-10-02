import { Component, lazy, memo, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useLang, type T } from "./i18n";
import { DATASETS } from "./data/generate";
import Home from "./pages/Home";
import { CreatorCard } from "./components/Creator";
import { LiveStats, startLiveStats } from "./components/LiveStats";
import { setRevealOrigin, smoothly } from "./transition";

// Heavy pages load on demand — and start loading as soon as you hover / focus / touch a menu item,
// so by the time you click, the page is usually ready.
const PAGES: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "/analysis": () => import("./pages/Analysis"),
  "/sql": () => import("./pages/Sql"),
  "/engineering": () => import("./pages/Engineering"),
  "/ml": () => import("./pages/ML"),
  "/llm": () => import("./pages/LLM"),
  "/glossary": () => import("./pages/Glossary"),
};
const Analysis = lazy(PAGES["/analysis"]);
const Sql = lazy(PAGES["/sql"]);
const Engineering = lazy(PAGES["/engineering"]);
const ML = lazy(PAGES["/ml"]);
const LLM = lazy(PAGES["/llm"]);
const Glossary = lazy(PAGES["/glossary"]);
const prefetch = (to: string) => void PAGES[to]?.().catch(() => {});

export const NAV: { to: string; icon: string; label: T }[] = [
  { to: "/analysis", icon: "📊", label: { en: "Analysis", bn: "অ্যানালাইসিস" } },
  { to: "/sql", icon: "🗄️", label: { en: "SQL", bn: "এসকিউএল" } },
  { to: "/engineering", icon: "🏗️", label: { en: "Engineering", bn: "ইঞ্জিনিয়ারিং" } },
  { to: "/ml", icon: "🤖", label: { en: "Machine Learning", bn: "মেশিন লার্নিং" } },
  { to: "/llm", icon: "✨", label: { en: "AI & LLM", bn: "এআই ও এলএলএম" } },
  { to: "/glossary", icon: "📖", label: { en: "Glossary", bn: "শব্দকোষ" } },
];

type Theme = "light" | "dark";
const systemTheme = (): Theme => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const currentTheme = (): Theme => (document.documentElement.dataset.theme as Theme | undefined) ?? systemTheme();

/** Sun/moon switch. Owns its own state, so toggling never re-renders the rest of the app. */
const ThemeSwitch = memo(function ThemeSwitch() {
  const { t } = useLang();
  const [theme, setTheme] = useState<Theme>(currentTheme);
  // follow the OS setting until the user picks a theme themselves
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => !document.documentElement.dataset.theme && setTheme(systemTheme());
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    setRevealOrigin(e.currentTarget);
    const next: Theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
    smoothly(() => {
      document.documentElement.dataset.theme = next;
      setTheme(next);
    }, "theme-vt");
  };
  const label = theme === "dark" ? t({ en: "Switch to light mode", bn: "লাইট মোডে যান" }) : t({ en: "Switch to dark mode", bn: "ডার্ক মোডে যান" });
  return (
    <button className={`theme-switch ${theme}`} onClick={toggle} role="switch" aria-checked={theme === "dark"} aria-label={label} title={label}>
      <span className="ts-track">
        <span className="ts-icon sun">☀</span>
        <span className="ts-icon moon">☾</span>
        <span className="ts-knob" />
      </span>
    </button>
  );
});

/** EN / বাংলা segmented switch with a sliding highlight. */
const LangSwitch = memo(function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className={`lang-switch ${lang}`} role="group" aria-label="Language">
      <span className="ls-pill" aria-hidden />
      <button aria-pressed={lang === "en"} onClick={() => lang !== "en" && setLang("en")}>
        EN
      </button>
      <button aria-pressed={lang === "bn"} onClick={() => lang !== "bn" && setLang("bn")}>
        বাংলা
      </button>
    </div>
  );
});

/** Adds a soft shadow to the top bar once the page is scrolled (no React re-renders). */
function useScrolledClass() {
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => document.documentElement.classList.toggle("scrolled", window.scrollY > 8));
    };
    window.addEventListener("scroll", on, { passive: true });
    on();
    return () => window.removeEventListener("scroll", on);
  }, []);
}

/** Scrolls to the top and sets a useful browser-tab title on every page change. */
function RouteEffects() {
  const { pathname } = useLocation();
  const { t, lang } = useLang();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    const item = NAV.find((n) => n.to === pathname);
    document.title = item ? `${t(item.label)} · Data Lab` : "Data Lab · ডেটা ল্যাব";
  }, [pathname, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className="logo-svg">
      <rect width="32" height="32" rx="8" className="logo-bg" />
      <rect x="7" y="17" width="4" height="8" rx="1.5" fill="#fff" opacity=".7" />
      <rect x="14" y="11" width="4" height="14" rx="1.5" fill="#fff" opacity=".85" />
      <rect x="21" y="6" width="4" height="19" rx="1.5" fill="#fff" />
    </svg>
  );
}

/** Keeps one broken widget from blanking the whole site. */
class ErrorBoundary extends Component<{ children: ReactNode; fallback: (reset: () => void) => ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error(err);
  }
  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}

function Oops({ reset }: { reset: () => void }) {
  const { t } = useLang();
  return (
    <div className="empty-state">
      <div className="empty-code">ERROR: 1 row failed to load</div>
      <h2>{t({ en: "Something went wrong on this page", bn: "এই পাতায় কিছু একটা গোলমাল হয়েছে" })}</h2>
      <p className="muted">{t({ en: "Your progress is safe. Try again, or go back to the home page.", bn: "আপনার অগ্রগতি নিরাপদ আছে। আবার চেষ্টা করুন, অথবা হোম পেজে ফিরে যান।" })}</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn" onClick={reset}>
          ↻ {t({ en: "Try again", bn: "আবার চেষ্টা" })}
        </button>
        <Link className="btn ghost" to="/" onClick={reset}>
          {t({ en: "Home", bn: "হোম" })}
        </Link>
      </div>
    </div>
  );
}

function NotFound() {
  const { t } = useLang();
  return (
    <div className="empty-state">
      <pre className="empty-code">{`SELECT * FROM pages WHERE url = '${location.pathname.replace(/'/g, "")}';\n-- 0 rows returned (404)`}</pre>
      <h2>{t({ en: "This page doesn't exist", bn: "এই পাতাটা নেই" })}</h2>
      <p className="muted">{t({ en: "Maybe the link is old. Pick a section from the menu above.", bn: "হয়তো লিংকটা পুরোনো। ওপরের মেনু থেকে একটা অংশ বেছে নিন।" })}</p>
      <Link className="btn" to="/">
        ← {t({ en: "Back to home", bn: "হোমে ফিরে যান" })}
      </Link>
    </div>
  );
}

export default function App() {
  const { t } = useLang();
  const { pathname } = useLocation();
  useScrolledClass();
  useEffect(startLiveStats, []);
  const rows = DATASETS.reduce((a, d) => a + d.rows.length, 0);
  return (
    <div className="app">
      <a href="#main" className="skip">
        {t({ en: "Skip to content", bn: "মূল অংশে যান" })}
      </a>
      <header className="topbar">
        <NavLink to="/" className="brand" viewTransition>
          <Logo />
          <span>
            Data Lab <small>ডেটা ল্যাব</small>
          </span>
        </NavLink>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} viewTransition onMouseEnter={() => prefetch(n.to)} onFocus={() => prefetch(n.to)} onTouchStart={() => prefetch(n.to)}>
              <span className="nav-ico">{n.icon}</span>
              {t(n.label)}
            </NavLink>
          ))}
        </nav>
        <div className="row" style={{ gap: 8 }}>
          <ThemeSwitch />
          <LangSwitch />
        </div>
      </header>
      <main id="main" key={pathname} className="page-enter">
        <RouteEffects />
        <ErrorBoundary key={pathname} fallback={(reset) => <Oops reset={reset} />}>
          <Suspense fallback={<div className="loader" aria-label="Loading" />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/sql" element={<Sql />} />
              <Route path="/engineering" element={<Engineering />} />
              <Route path="/ml" element={<ML />} />
              <Route path="/llm" element={<LLM />} />
              <Route path="/glossary" element={<Glossary />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <div className="brand">
              <Logo size={24} />
              <span>
                Data Lab <small>ডেটা ল্যাব</small>
              </span>
            </div>
            <p className="muted small">
              {t({
                en: "Learn data analysis, SQL, data engineering, machine learning and AI by playing with real-looking data — in English and বাংলা.",
                bn: "বাস্তবের মতো ডেটা নিয়ে খেলতে খেলতে ডেটা অ্যানালাইসিস, এসকিউএল, ডেটা ইঞ্জিনিয়ারিং, মেশিন লার্নিং আর এআই শিখুন — বাংলা ও ইংরেজিতে।",
              })}
            </p>
          </div>
          <div>
            <b className="footer-h">{t({ en: "Learn", bn: "শিখুন" })}</b>
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} viewTransition onMouseEnter={() => prefetch(n.to)}>
                {t(n.label)}
              </Link>
            ))}
          </div>
          <div>
            <b className="footer-h">{t({ en: "Under the hood", bn: "ভেতরের তথ্য" })}</b>
            <code>datasets: {DATASETS.length}</code>
            <code>rows: {rows.toLocaleString()}</code>
            <code>engine: SQLite (WebAssembly)</code>
            <code>server: none · 100% in-browser</code>
          </div>
          <div>
            <CreatorCard compact />
            <LiveStats variant="footer" />
          </div>
        </div>
        <p className="footer-note">
          {t({
            en: "All data is simulated for learning. Everything runs in your browser — nothing is uploaded.",
            bn: "সব ডেটা শেখার জন্য কাল্পনিকভাবে তৈরি। সবকিছু আপনার ব্রাউজারেই চলে — কিছুই আপলোড হয় না।",
          })}
        </p>
      </footer>
    </div>
  );
}
