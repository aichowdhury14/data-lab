import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../i18n";
import { SQL_SOLVED_NEEDED, TRACK_INFO, useCertStatus, type CertId } from "../certs";
import type { Track } from "../progress";
import { digits } from "../numerals";

/** "🎓 Certificate: 3 of 10 explored" — shown under every section's title. */
export function CertProgress({ track }: { track: Track }) {
  const { t } = useLang();
  const s = useCertStatus()[track];
  const pct = Math.round((s.done / s.total) * 100);
  if (s.ok)
    return (
      <Link to="/certificate" className="cert-pill ok" viewTransition>
        🎓 {t({ en: "Certificate unlocked — get yours", bn: "সনদ খুলে গেছে — এখনই নিন" })} →
      </Link>
    );
  return (
    <Link to="/certificate" className="cert-pill" viewTransition title={t({ en: "See all certificates", bn: "সব সনদ দেখুন" })}>
      <span>🎓 {t({ en: "Your certificate", bn: "আপনার সনদ" })}</span>
      <span className="cp-bar">
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="cp-txt">
        {digits(
          track === "sql"
            ? t({ en: `${s.done}/${s.total} explored · ${Math.min(s.solved ?? 0, SQL_SOLVED_NEEDED)}/${SQL_SOLVED_NEEDED} solved`, bn: `${s.done}/${s.total} দেখা · ${Math.min(s.solved ?? 0, SQL_SOLVED_NEEDED)}/${SQL_SOLVED_NEEDED} সমাধান` })
            : t({ en: `${s.done}/${s.total} explored`, bn: `${s.done}/${s.total} দেখা হয়েছে` }),
        )}
      </span>
    </Link>
  );
}

/** Pops up once, the moment a learner unlocks a certificate. */
export function CertToast() {
  const { t } = useLang();
  const status = useCertStatus();
  const [show, setShow] = useState<CertId | null>(null);
  const first = useRef(true);

  useEffect(() => {
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem("datalab-cert-notified") ?? "[]");
    } catch {
      /* ignore */
    }
    const unlocked = (Object.keys(status) as CertId[]).filter((k) => status[k].ok);
    const fresh = unlocked.filter((k) => !seen.includes(k));
    if (!fresh.length) return;
    try {
      localStorage.setItem("datalab-cert-notified", JSON.stringify([...seen, ...fresh]));
    } catch {
      /* ignore */
    }
    // on the very first page load, quietly remember older unlocks instead of greeting with a pop-up
    if (first.current && seen.length === 0 && fresh.length > 1) {
      first.current = false;
      return;
    }
    first.current = false;
    setShow(fresh.includes("graduate") ? "graduate" : fresh[0]);
  }, [status]);

  useEffect(() => {
    if (!show) return;
    const id = setTimeout(() => setShow(null), 12000);
    return () => clearTimeout(id);
  }, [show]);

  if (!show) return null;
  return (
    <div className="cert-toast" role="status">
      <span className="ct-big">🎉</span>
      <div>
        <b>{t({ en: "Certificate unlocked!", bn: "সনদ খুলে গেছে!" })}</b>
        <p>
          {t({ en: "You finished", bn: "আপনি শেষ করেছেন" })} {t(TRACK_INFO[show].title)}.
        </p>
        <Link to="/certificate" className="btn" viewTransition onClick={() => setShow(null)}>
          🎓 {t({ en: "Get my certificate", bn: "আমার সনদ নিন" })}
        </Link>
      </div>
      <button className="ct-close" onClick={() => setShow(null)} aria-label="Close">
        ×
      </button>
    </div>
  );
}
