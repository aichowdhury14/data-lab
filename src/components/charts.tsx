// Tiny SVG chart set. No chart library: the bundle stays small and everything is themeable via CSS variables.
import { useId, useState, type MouseEvent, type ReactNode } from "react";
import { digits } from "../numerals";

export const PALETTE = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];

const M = { l: 52, r: 14, t: 12, b: 38 };

/** Short human number (1.2k, 3.4L, 2.1Cr), in Bangla digits when that mode is on. */
export function fmt(n: number) {
  return digits(fmtLatin(n));
}
function fmtLatin(n: number) {
  if (!isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e7) return (n / 1e7).toFixed(1) + "Cr";
  if (a >= 1e5) return (n / 1e5).toFixed(1) + "L";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
  if (a >= 100) return n.toFixed(0);
  if (a >= 1) return n.toFixed(2).replace(/\.?0+$/, "");
  return n.toFixed(2).replace(/\.?0+$/, "") || "0";
}

export function extent(vs: number[], pad = 0.05): [number, number] {
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const p = (hi - lo) * pad;
  return [lo - p, hi + p];
}

/** "Nice" round tick values (1, 2, 5 × 10ⁿ) instead of awkward fractions. */
function niceTicks([lo, hi]: [number, number], n: number) {
  const raw = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  return out;
}

interface Scale {
  sx: (v: number) => number;
  sy: (v: number) => number;
  iw: number;
  ih: number;
}

function Frame({
  w,
  h,
  xd,
  yd,
  xLabel,
  yLabel,
  children,
  xTicks = 6,
  ylog,
  xFmt = fmt,
  onClick,
}: {
  w: number;
  h: number;
  xd?: [number, number];
  yd: [number, number];
  xLabel?: string;
  yLabel?: string;
  children: ReactNode;
  xTicks?: number;
  ylog?: boolean;
  xFmt?: (v: number) => string;
  onClick?: (e: MouseEvent<SVGSVGElement>) => void;
}) {
  const iw = w - M.l - M.r;
  const ih = h - M.t - M.b;
  const yTicks = ylog
    ? Array.from({ length: Math.floor(yd[1]) - Math.ceil(yd[0]) + 1 }, (_, i) => Math.ceil(yd[0]) + i)
    : niceTicks(yd, 4);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`chart${onClick ? " pickable" : ""}`} role="img" onClick={onClick}>
      <g transform={`translate(${M.l},${M.t})`}>
        {yTicks.map((v, i) => {
          const y = ih - ((v - yd[0]) / (yd[1] - yd[0])) * ih;
          return (
            <g key={i}>
              <line x1={0} x2={iw} y1={y} y2={y} className="grid" />
              <text x={-8} y={y + 4} textAnchor="end" className="tick">
                {ylog ? fmt(10 ** v) : fmt(v)}
              </text>
            </g>
          );
        })}
        {xd &&
          niceTicks(xd, xTicks).map((v, i) => {
            const x = ((v - xd[0]) / (xd[1] - xd[0])) * iw;
            return (
              <text key={i} x={x} y={ih + 16} textAnchor="middle" className="tick">
                {xFmt(v)}
              </text>
            );
          })}
        <line x1={0} x2={iw} y1={ih} y2={ih} className="axis" />
        {children}
        {xLabel && (
          <text x={iw / 2} y={ih + 33} textAnchor="middle" className="axis-label">
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text transform={`translate(-42,${ih / 2}) rotate(-90)`} textAnchor="middle" className="axis-label">
            {yLabel}
          </text>
        )}
      </g>
    </svg>
  );
}

export interface ScatterPoint {
  x: number;
  y: number;
  c?: number; // colour group
  label?: string;
  r?: number;
}

export function Scatter({
  points,
  line,
  centers,
  xLabel,
  yLabel,
  w = 560,
  h = 340,
  xDomain,
  yDomain,
  under,
  over,
  onPick,
  highlight,
}: {
  points: ScatterPoint[];
  line?: { a: number; b: number }; // y = a + b x
  centers?: { x: number; y: number }[];
  xLabel?: string;
  yLabel?: string;
  w?: number;
  h?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  under?: (s: Scale) => ReactNode;
  over?: (s: Scale) => ReactNode;
  onPick?: (x: number, y: number) => void;
  highlight?: number;
}) {
  const clip = useId();
  const xd = xDomain ?? extent(points.map((p) => p.x));
  const yd = yDomain ?? extent(points.map((p) => p.y));
  const iw = w - M.l - M.r;
  const ih = h - M.t - M.b;
  const sx = (v: number) => ((v - xd[0]) / (xd[1] - xd[0])) * iw;
  const sy = (v: number) => ih - ((v - yd[0]) / (yd[1] - yd[0])) * ih;
  const pick = onPick
    ? (e: MouseEvent<SVGSVGElement>) => {
        const svg = e.currentTarget;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
        const px = p.x - M.l;
        const py = p.y - M.t;
        if (px < 0 || py < 0 || px > iw || py > ih) return;
        onPick(xd[0] + (px / iw) * (xd[1] - xd[0]), yd[0] + ((ih - py) / ih) * (yd[1] - yd[0]));
      }
    : undefined;
  return (
    <Frame w={w} h={h} xd={xd} yd={yd} xLabel={xLabel} yLabel={yLabel} onClick={pick}>
      <clipPath id={clip}>
        <rect width={iw} height={ih} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        {under?.({ sx, sy, iw, ih })}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={p.r ?? (p.label ? 5 : 3.6)}
              fill={PALETTE[(p.c ?? 0) % PALETTE.length]}
              opacity={highlight === undefined || highlight === i ? 0.8 : 0.35}
              className="dot"
            />
            {p.label && (
              <text x={sx(p.x) + 7} y={sy(p.y) + 4} className="pt-label">
                {p.label}
              </text>
            )}
          </g>
        ))}
        {line && (
          <line x1={sx(xd[0])} y1={sy(line.a + line.b * xd[0])} x2={sx(xd[1])} y2={sy(line.a + line.b * xd[1])} className="fit-line" />
        )}
        {centers?.map((c, i) => (
          <g key={i} transform={`translate(${sx(c.x)},${sy(c.y)})`} className="centroid">
            <path d="M-7,-7L7,7M-7,7L7,-7" stroke="var(--bg)" strokeWidth={6} strokeLinecap="round" />
            <path d="M-7,-7L7,7M-7,7L7,-7" stroke={PALETTE[i % PALETTE.length]} strokeWidth={3} strokeLinecap="round" />
          </g>
        ))}
        {over?.({ sx, sy, iw, ih })}
      </g>
    </Frame>
  );
}

export function Bars({
  items,
  xLabel,
  yLabel,
  w = 560,
  h = 300,
  color = "var(--c1)",
  colors,
}: {
  items: { label: string; value: number }[];
  xLabel?: string;
  yLabel?: string;
  w?: number;
  h?: number;
  color?: string;
  colors?: string[];
}) {
  const iw = w - M.l - M.r;
  const ih = h - M.t - M.b;
  const yd: [number, number] = [0, Math.max(...items.map((i) => i.value), 1e-9) * 1.08];
  const bw = iw / items.length;
  const dense = items.length > 10;
  return (
    <Frame w={w} h={h} yd={yd} xLabel={xLabel} yLabel={yLabel}>
      {items.map((it, i) => {
        const bh = (it.value / yd[1]) * ih;
        return (
          <g key={i}>
            <rect x={i * bw + bw * 0.1} y={ih - bh} width={bw * 0.8} height={bh} fill={colors?.[i] ?? color} rx={3} className="bar">
              <title>{`${it.label}: ${fmt(it.value)}`}</title>
            </rect>
            {(!dense || i % Math.ceil(items.length / 8) === 0) && (
              <text x={i * bw + bw / 2} y={ih + 16} textAnchor="middle" className="tick">
                {it.label.length > 11 ? it.label.slice(0, 10) + "…" : it.label}
              </text>
            )}
          </g>
        );
      })}
    </Frame>
  );
}

/** Horizontal bars: best for ranked lists with long labels (probabilities, similarities). */
export function HBars({
  items,
  max,
  format = (v: number) => (v * 100).toFixed(1) + "%",
}: {
  items: { label: string; value: number; color?: string; dim?: boolean }[];
  max?: number;
  format?: (v: number) => string;
}) {
  const m = max ?? Math.max(...items.map((i) => i.value), 1e-9);
  return (
    <div className="hbars">
      {items.map((it, i) => (
        <div key={i} className={`hbar${it.dim ? " dim" : ""}`}>
          <span className="lbl" title={it.label}>
            {it.label}
          </span>
          <div className="track">
            <div className="fill" style={{ width: `${Math.max(0, (it.value / m) * 100)}%`, background: it.color ?? "var(--c1)" }} />
          </div>
          <b>{digits(format(it.value))}</b>
        </div>
      ))}
    </div>
  );
}

export function Lines({
  series,
  xLabel,
  yLabel,
  w = 560,
  h = 300,
  xOffset = 0,
}: {
  series: { name: string; values: number[] }[];
  xLabel?: string;
  yLabel?: string;
  w?: number;
  h?: number;
  xOffset?: number;
}) {
  return (
    <XY
      series={series.map((s) => ({ name: s.name, pts: s.values.map((v, i) => [i + xOffset, v] as [number, number]) }))}
      xLabel={xLabel}
      yLabel={yLabel}
      w={w}
      h={h}
    />
  );
}

export interface XYSeries {
  name: string;
  pts: [number, number][];
  dashed?: boolean;
  color?: string;
  area?: boolean;
}

export function XY({
  series,
  xLabel,
  yLabel,
  w = 560,
  h = 300,
  xDomain,
  yDomain,
  markers,
  ylog,
  xFmt,
  bands,
}: {
  series: XYSeries[];
  xLabel?: string;
  yLabel?: string;
  w?: number;
  h?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  markers?: { x: number; y: number; label?: string; color?: string }[];
  ylog?: boolean;
  xFmt?: (v: number) => string;
  bands?: { from: number; to: number; label?: string }[];
}) {
  const iw = w - M.l - M.r;
  const ih = h - M.t - M.b;
  const tf = (v: number) => (ylog ? Math.log10(v) : v);
  const all = series.flatMap((s) => s.pts).concat((markers ?? []).map((m) => [m.x, m.y] as [number, number]));
  const xd = xDomain ?? extent(all.map((p) => p[0]), 0);
  const yd = yDomain ?? extent(all.map((p) => tf(p[1])));
  const sx = (v: number) => ((v - xd[0]) / (xd[1] - xd[0])) * iw;
  const sy = (v: number) => ih - ((tf(v) - yd[0]) / (yd[1] - yd[0])) * ih;
  const color = (s: XYSeries, k: number) => s.color ?? PALETTE[k % PALETTE.length];
  return (
    <>
      <Frame w={w} h={h} xd={xd} yd={yd} xLabel={xLabel} yLabel={yLabel} ylog={ylog} xFmt={xFmt}>
        {bands?.map((b, i) => (
          <g key={i}>
            <rect x={sx(b.from)} width={sx(b.to) - sx(b.from)} y={0} height={ih} className="band" />
            {b.label && (
              <text x={sx(b.from) + 6} y={14} className="tick">
                {b.label}
              </text>
            )}
          </g>
        ))}
        {series.map((s, k) => {
          const d = s.pts.map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ");
          return (
            <g key={k}>
              {s.area && s.pts.length > 1 && (
                <polygon points={`${sx(s.pts[0][0])},${ih} ${d} ${sx(s.pts[s.pts.length - 1][0])},${ih}`} fill={color(s, k)} opacity={0.12} />
              )}
              <polyline fill="none" stroke={color(s, k)} strokeWidth={2.2} strokeDasharray={s.dashed ? "6 4" : undefined} points={d} className="draw" />
            </g>
          );
        })}
        {markers?.map((m, i) => (
          <g key={i}>
            <circle cx={sx(m.x)} cy={sy(m.y)} r={5.5} fill={m.color ?? "var(--c2)"} stroke="var(--card)" strokeWidth={2} />
            {m.label && (
              <text x={sx(m.x) + 8} y={sy(m.y) - 6} className="pt-label">
                {m.label}
              </text>
            )}
          </g>
        ))}
      </Frame>
      {series.length > 1 && <Legend names={series.map((s) => s.name)} colors={series.map(color)} dashed={series.map((s) => !!s.dashed)} />}
    </>
  );
}

export function Legend({ names, colors, dashed }: { names: string[]; colors?: string[]; dashed?: boolean[] }) {
  return (
    <div className="legend">
      {names.map((n, i) => (
        <span key={n + i}>
          <i style={{ background: colors?.[i] ?? PALETTE[i % PALETTE.length], opacity: dashed?.[i] ? 0.6 : 1 }} />
          {n}
        </span>
      ))}
    </div>
  );
}

export function Donut({ items, size = 220, center }: { items: { label: string; value: number }[]; size?: number; center?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const R = size / 2 - 6;
  const r0 = R * 0.6;
  let a0 = -Math.PI / 2;
  const arcs = items.map((it, i) => {
    const a1 = a0 + (it.value / total) * Math.PI * 2;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (r: number, a: number) => `${(size / 2 + r * Math.cos(a)).toFixed(2)},${(size / 2 + r * Math.sin(a)).toFixed(2)}`;
    const d = `M${p(R, a0)} A${R},${R} 0 ${big} 1 ${p(R, a1)} L${p(r0, a1)} A${r0},${r0} 0 ${big} 0 ${p(r0, a0)} Z`;
    const mid = (a0 + a1) / 2;
    a0 = a1;
    return { d, i, mid };
  });
  const shown = hover ?? null;
  return (
    <div className="donut">
      <svg viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size }}>
        {arcs.map(({ d, i, mid }) => (
          <path
            key={i}
            d={d}
            fill={PALETTE[i % PALETTE.length]}
            className="slice"
            transform={hover === i ? `translate(${Math.cos(mid) * 6},${Math.sin(mid) * 6})` : undefined}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="donut-big">
          {shown === null ? digits(center ?? fmt(total)) : digits(((items[shown].value / total) * 100).toFixed(1) + "%")}
        </text>
        <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="tick">
          {shown === null ? "" : items[shown].label}
        </text>
      </svg>
      <div className="legend col">
        {items.map((it, i) => (
          <span key={it.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={hover === i ? "on" : ""}>
            <i style={{ background: PALETTE[i % PALETTE.length] }} />
            {it.label} <b>{digits(((it.value / total) * 100).toFixed(0) + "%")}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Colour grid. Diverging mode colours negatives orange and positives blue (e.g. correlations). */
export function Heatmap({
  rows,
  cols,
  values,
  diverging,
  max,
  cell = 54,
  format = (v: number) => v.toFixed(2),
  onHover,
  active,
}: {
  rows: string[];
  cols: string[];
  values: number[][];
  diverging?: boolean;
  max?: number;
  cell?: number;
  format?: (v: number) => string;
  onHover?: (r: number | null) => void;
  active?: number | null;
}) {
  const left = Math.max(...rows.map((r) => r.length)) * 7 + 12;
  const top = Math.max(...cols.map((c) => c.length)) * 6 + 14;
  const m = max ?? Math.max(...values.flat().map(Math.abs), 1e-9);
  const w = left + cols.length * cell;
  const h = top + rows.length * cell * 0.62;
  const ch = cell * 0.62;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart heat" style={{ maxWidth: w * 1.4 }}>
      {cols.map((c, j) => (
        <text key={j} transform={`translate(${left + j * cell + cell / 2},${top - 6}) rotate(-35)`} className="tick" textAnchor="start">
          {c}
        </text>
      ))}
      {rows.map((r, i) => (
        <g key={i} onMouseEnter={() => onHover?.(i)} onMouseLeave={() => onHover?.(null)} opacity={active == null || active === i ? 1 : 0.45}>
          <text x={left - 6} y={top + i * ch + ch / 2 + 4} textAnchor="end" className="tick">
            {r}
          </text>
          {cols.map((_, j) => {
            const v = values[i][j];
            const pct = Math.min(100, (Math.abs(v) / m) * 100);
            const base = diverging && v < 0 ? "var(--c2)" : "var(--c1)";
            return (
              <g key={j}>
                <rect x={left + j * cell + 1} y={top + i * ch + 1} width={cell - 2} height={ch - 2} rx={4} style={{ fill: `color-mix(in srgb, ${base} ${pct.toFixed(0)}%, var(--bg2))` }}>
                  <title>{`${r} × ${cols[j]}: ${format(v)}`}</title>
                </rect>
                {cell >= 40 && (
                  <text x={left + j * cell + cell / 2} y={top + i * ch + ch / 2 + 4} textAnchor="middle" className="cell-txt" style={{ fill: pct > 55 ? "#fff" : "var(--text)" }}>
                    {digits(format(v))}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

export function BoxPlot({ groups, yLabel, w = 560, h = 300 }: { groups: { label: string; values: number[] }[]; yLabel?: string; w?: number; h?: number }) {
  const q = (s: number[], p: number) => {
    const i = (s.length - 1) * p;
    const lo = Math.floor(i);
    return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
  };
  const stats = groups.map((g) => {
    const s = [...g.values].sort((a, b) => a - b);
    const q1 = q(s, 0.25);
    const q3 = q(s, 0.75);
    const iqr = q3 - q1;
    const lo = s.find((v) => v >= q1 - 1.5 * iqr)!;
    const hi = [...s].reverse().find((v) => v <= q3 + 1.5 * iqr)!;
    return { label: g.label, q1, q3, med: q(s, 0.5), lo, hi, out: s.filter((v) => v < lo || v > hi) };
  });
  const yd = extent(groups.flatMap((g) => g.values));
  const iw = w - M.l - M.r;
  const ih = h - M.t - M.b;
  const sy = (v: number) => ih - ((v - yd[0]) / (yd[1] - yd[0])) * ih;
  const bw = iw / groups.length;
  return (
    <Frame w={w} h={h} yd={yd} yLabel={yLabel}>
      {stats.map((s, i) => {
        const cx = i * bw + bw / 2;
        const half = Math.min(bw * 0.28, 34);
        const col = PALETTE[i % PALETTE.length];
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={sy(s.lo)} y2={sy(s.hi)} stroke={col} strokeWidth={1.5} />
            <rect x={cx - half} width={half * 2} y={sy(s.q3)} height={Math.max(1, sy(s.q1) - sy(s.q3))} fill={col} fillOpacity={0.22} stroke={col} rx={3}>
              <title>{`${s.label}: median ${fmt(s.med)}, IQR ${fmt(s.q1)}–${fmt(s.q3)}`}</title>
            </rect>
            <line x1={cx - half} x2={cx + half} y1={sy(s.med)} y2={sy(s.med)} stroke={col} strokeWidth={3} />
            {s.out.slice(0, 40).map((o, k) => (
              <circle key={k} cx={cx + ((k % 5) - 2) * 2} cy={sy(o)} r={2.2} fill={col} opacity={0.6} />
            ))}
            <text x={cx} y={ih + 16} textAnchor="middle" className="tick">
              {s.label.length > 11 ? s.label.slice(0, 10) + "…" : s.label}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}
