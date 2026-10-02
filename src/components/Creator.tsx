import { useMemo } from "react";
import QRCode from "qrcode";
import { useLang } from "../i18n";

export const CREATOR = {
  name: "Atiqul Islam Chowdhury",
  title: { en: "AI & ML Engineer · Senior Data Scientist", bn: "এআই ও এমএল ইঞ্জিনিয়ার · সিনিয়র ডেটা সায়েন্টিস্ট" },
  url: "https://aichowdhury14.github.io/",
};

/** QR code drawn as an SVG grid of "data cells", in the site's theme colours. */
export function QR({ value, size = 140 }: { value: string; size?: number }) {
  const { n, cells, finders } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = modules.size;
    const finders = [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ];
    const inFinder = (x: number, y: number) => finders.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
    const cells: [number, number][] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(y, x) && !inFinder(x, y)) cells.push([x, y]);
    return { n, cells, finders };
  }, [value]);
  const q = 2; // quiet zone, in modules
  return (
    <svg viewBox={`${-q} ${-q} ${n + 2 * q} ${n + 2 * q}`} width={size} height={size} className="qr" role="img" aria-label={`QR code: ${value}`}>
      <rect x={-q} y={-q} width={n + 2 * q} height={n + 2 * q} rx={2.5} className="qr-bg" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.22} className="qr-dot" />
      ))}
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.6} className="qr-eye-out" />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.8} className="qr-eye-in" />
        </g>
      ))}
    </svg>
  );
}

/** "Built by" card: name, title, website and a scannable QR code. */
export function CreatorCard({ compact = false }: { compact?: boolean }) {
  const { t } = useLang();
  return (
    <div className={`creator${compact ? " compact" : ""}`}>
      <a href={CREATOR.url} target="_blank" rel="noopener noreferrer" className="creator-qr" title={CREATOR.url}>
        <QR value={CREATOR.url} size={compact ? 104 : 150} />
      </a>
      <div className="creator-text">
        <span className="creator-label">{t({ en: "// built by", bn: "// তৈরি করেছেন" })}</span>
        <b className="creator-name">{CREATOR.name}</b>
        <span className="creator-title">{t(CREATOR.title)}</span>
        <a href={CREATOR.url} target="_blank" rel="noopener noreferrer" className="creator-link">
          {CREATOR.url.replace(/^https:\/\//, "").replace(/\/$/, "")} ↗
        </a>
        {!compact && (
          <span className="muted small">{t({ en: "📱 Scan the code to open the portfolio on your phone.", bn: "📱 ফোনে পোর্টফোলিও খুলতে কোডটা স্ক্যান করুন।" })}</span>
        )}
      </div>
    </div>
  );
}
