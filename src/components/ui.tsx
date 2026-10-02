import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useLang, type T } from "../i18n";
import type { Cell } from "../data/generate";
import { SectionArt, type ArtKind } from "./Art";
import { PLAIN } from "../content/plain";

export function DataTable({ columns, rows, max = 50 }: { columns: string[]; rows: Cell[][] | unknown[][]; max?: number }) {
  const { t } = useLang();
  const shown = rows.slice(0, max);
  const num = (v: unknown) => typeof v === "number";
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              {(r as unknown[]).map((v, j) => (
                <td key={j} className={num(v) ? "num" : v === null ? "null" : ""}>
                  {v === null ? "NULL" : num(v) && !Number.isInteger(v) ? (v as number).toFixed(2) : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > max && (
        <p className="muted small pad">
          {t({ en: `Showing ${max} of ${rows.length} rows`, bn: `${rows.length}টির মধ্যে ${max}টি সারি দেখানো হচ্ছে` })}
        </p>
      )}
    </div>
  );
}

export function Callout({ kind = "tip", title, children }: { kind?: "tip" | "warn" | "idea"; title?: T; children: ReactNode }) {
  const { t } = useLang();
  return (
    <aside className={`callout ${kind}`}>
      {title && <strong>{t(title)}</strong>}
      <div>{children}</div>
    </aside>
  );
}

/** "Think of it like this" — an everyday analogy, by key from content/plain.ts or given directly. */
export function Plain({ k, text }: { k?: string; text?: T }) {
  const { t } = useLang();
  const body = text ?? (k ? PLAIN[k] : undefined);
  if (!body) return null;
  return (
    <aside className="plain">
      <span className="plain-ico" aria-hidden>
        💡
      </span>
      <div>
        <strong>{t({ en: "Think of it like this", bn: "সহজ করে বললে" })}</strong>
        <p>{t(body)}</p>
      </div>
    </aside>
  );
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { id: K; label: T }[]; value: K; onChange: (k: K) => void }) {
  const { t } = useLang();
  return (
    <div className="tabs" role="tablist">
      {tabs.map((x) => (
        <button key={x.id} role="tab" aria-selected={value === x.id} className={value === x.id ? "on" : ""} onClick={() => onChange(x.id)}>
          {t(x.label)}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat" title={hint}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  show,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  show?: string;
}) {
  return (
    <label className="slider">
      <span>
        {label} <b>{show ?? value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function PageHead({ title, sub, art }: { title: T; sub: T; art?: ArtKind }) {
  const { t } = useLang();
  const { pathname } = useLocation();
  return (
    <header className="page-head">
      <div>
        <div className="path" aria-hidden>
          ~/data-lab<b>{pathname}</b>
          <span className="cursor">▌</span>
        </div>
        <h1>{t(title)}</h1>
        <p>{t(sub)}</p>
      </div>
      {art && <SectionArt kind={art} />}
    </header>
  );
}

export interface PickerItem<K extends string> {
  id: K;
  icon: string;
  label: T;
  tag: T;
  done?: boolean;
}

/** A grid of big clickable tiles — friendlier than tabs when there are many choices. */
export function Picker<K extends string>({ items, value, onChange }: { items: PickerItem<K>[]; value: K; onChange: (k: K) => void }) {
  const { t } = useLang();
  return (
    <div className="picker" role="tablist">
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={value === it.id} className={value === it.id ? "on" : ""} onClick={() => onChange(it.id)}>
          <span className="ico">{it.icon}</span>
          <span className="txt">
            <b>{t(it.label)}</b>
            <small>{t(it.tag)}</small>
          </span>
          {it.done && <span className="tick-done">✓</span>}
        </button>
      ))}
    </div>
  );
}
