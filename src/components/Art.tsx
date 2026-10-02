// Hand-drawn SVG illustrations. They use theme colours, so they work in light and dark mode, and animate with CSS.

export type ArtKind = "analysis" | "sql" | "engineering" | "ml" | "llm";

export function SectionArt({ kind }: { kind: ArtKind }) {
  return (
    <svg viewBox="0 0 160 110" className="art section-art" aria-hidden>
      <rect x="4" y="6" width="152" height="98" rx="18" className="art-blob" />
      {kind === "analysis" && (
        <g>
          {[30, 52, 40, 68].map((h, i) => (
            <rect key={i} x={30 + i * 24} y={88 - h} width="16" height={h} rx="4" fill={`var(--c${i + 1})`} className="grow" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
          <circle cx="122" cy="34" r="14" fill="none" stroke="var(--c2)" strokeWidth="4" />
          <line x1="132" y1="44" x2="142" y2="54" stroke="var(--c2)" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      {kind === "sql" && (
        <g>
          <ellipse cx="62" cy="30" rx="30" ry="9" fill="var(--c1)" />
          <path d="M32 30v44c0 5 13 9 30 9s30-4 30-9V30" fill="var(--c1)" opacity=".7" />
          <ellipse cx="62" cy="52" rx="30" ry="8" fill="none" stroke="var(--card)" strokeWidth="2" opacity=".7" />
          <rect x="100" y="34" width="44" height="40" rx="6" className="art-card" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x="106" y={41 + i * 10} width={i === 1 ? 24 : 32} height="5" rx="2.5" fill="var(--c3)" className="blink" style={{ animationDelay: `${i * 0.3}s` }} />
          ))}
        </g>
      )}
      {kind === "engineering" && (
        <g>
          <path d="M20 56h120" stroke="var(--line)" strokeWidth="10" strokeLinecap="round" />
          <path d="M20 56h120" stroke="var(--c3)" strokeWidth="4" strokeDasharray="8 10" className="flow-fast" />
          {[34, 80, 126].map((x, i) => (
            <g key={i}>
              <circle cx={x} cy="56" r="16" fill={["var(--c2)", "var(--c5)", "var(--c3)"][i]} />
              <text x={x} y="61" textAnchor="middle" className="art-icon">
                {["E", "T", "L"][i]}
              </text>
            </g>
          ))}
        </g>
      )}
      {kind === "ml" && (
        <g>
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={i} cx={22 + ((i * 37) % 110)} cy={22 + ((i * 53) % 70)} r="5" fill={i % 2 ? "var(--c1)" : "var(--c2)"} opacity=".8" />
          ))}
          <path d="M18 92 C60 80, 70 20, 140 18" stroke="var(--c3)" strokeWidth="4" fill="none" strokeLinecap="round" className="draw" />
        </g>
      )}
      {kind === "llm" && (
        <g>
          <rect x="18" y="22" width="80" height="30" rx="12" fill="var(--c1)" />
          <rect x="62" y="60" width="80" height="30" rx="12" fill="var(--c4)" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={88 + i * 14} cy="75" r="4" fill="#fff" className="blink" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
          <text x="30" y="42" className="art-icon" style={{ fontSize: 13 }}>
            Hi! হাই
          </text>
        </g>
      )}
    </svg>
  );
}
