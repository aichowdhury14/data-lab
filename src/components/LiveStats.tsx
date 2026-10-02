import { memo, useSyncExternalStore } from "react";
import { useLang } from "../i18n";
import type { LiveStats as Stats } from "../live/visits";

// A tiny store shared by every badge on the page.
let state: Stats = { status: "loading" };
const subs = new Set<() => void>();
const set = (patch: Partial<Stats>) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

let started = false;
/** Connect once, after the page has settled — the counter must never compete with the first paint. */
export function startLiveStats() {
  if (started || typeof window === "undefined") return;
  started = true;
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const go = () =>
    import("../live/visits")
      .then((m) => m.connect(set))
      .catch(() => set({ status: "error" }));
  if (ric) ric(go, { timeout: 2500 });
  else setTimeout(go, 1200);
}

const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("en-US"));
const plural = (v: number | undefined, one: string, many: string) => (v === 1 ? one : many);

/** "👁 1,284 views · 🟢 3 online now" — live from Supabase. Hides itself if the counter can't be reached. */
export const LiveStats = memo(function LiveStats({ variant = "inline" }: { variant?: "inline" | "footer" }) {
  const { t } = useLang();
  const s = useSyncExternalStore(subscribe, () => state);
  if (s.status === "error") return null;
  const loading = s.status === "loading";
  const tip = loading
    ? ""
    : t({
        en: `${n(s.visitors)} unique ${plural(s.visitors, "visitor", "visitors")} · ${n(s.today)} ${plural(s.today, "visit", "visits")} today (Dhaka time)`,
        bn: `${n(s.visitors)} জন আলাদা ভিজিটর · আজ ${n(s.today)}টি ভিজিট (ঢাকার সময়)`,
      });
  return (
    <div className={`live-stats ${variant}${loading ? " loading" : ""}`} title={tip} aria-live="polite">
      <span className="ls-item">
        <span aria-hidden>👁</span>
        <b key={s.views}>{n(s.views)}</b> {t({ en: plural(s.views, "view", "views"), bn: "ভিউ" })}
      </span>
      <span className="ls-sep" aria-hidden>
        ·
      </span>
      <span className="ls-item">
        <span className="ls-dot" aria-hidden />
        <b key={`o${s.online}`}>{n(s.online)}</b> {t({ en: "online now", bn: "জন এখন অনলাইনে" })}
      </span>
      {variant === "footer" && !loading && (
        <span className="ls-sub">
          {t({
            en: `${n(s.visitors)} unique ${plural(s.visitors, "visitor", "visitors")} · ${n(s.today)} today`,
            bn: `${n(s.visitors)} জন আলাদা ভিজিটর · আজ ${n(s.today)}টি`,
          })}
        </span>
      )}
    </div>
  );
});
