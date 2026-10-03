import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { useLang, type T } from "../i18n";
import { PageHead } from "../components/ui";
import { CREATOR } from "../components/Creator";
import { TRACKS, useProgress, type Track } from "../progress";
import { digits } from "../numerals";

const SITE = "https://data-lab-ai.vercel.app";
const SQL_SOLVED_NEEDED = 10;

type CertId = Track | "graduate";
const TRACK_INFO: Record<CertId, { title: T; icon: string; to: string }> = {
  analysis: { title: { en: "Data Analysis", bn: "ডেটা অ্যানালাইসিস" }, icon: "📊", to: "/analysis" },
  sql: { title: { en: "SQL", bn: "এসকিউএল" }, icon: "🗄️", to: "/sql" },
  engineering: { title: { en: "Data Engineering", bn: "ডেটা ইঞ্জিনিয়ারিং" }, icon: "🏗️", to: "/engineering" },
  ml: { title: { en: "Machine Learning", bn: "মেশিন লার্নিং" }, icon: "🤖", to: "/ml" },
  llm: { title: { en: "AI & Large Language Models", bn: "এআই ও লার্জ ল্যাঙ্গুয়েজ মডেল" }, icon: "✨", to: "/llm" },
  graduate: { title: { en: "Data Lab Graduate (all five tracks)", bn: "ডেটা ল্যাব গ্র্যাজুয়েট (পাঁচটি ট্র্যাক)" }, icon: "🎓", to: "/" },
};

function sqlSolved(): number {
  try {
    return (JSON.parse(localStorage.getItem("datalab-sql-solved") ?? "[]") as string[]).length;
  } catch {
    return 0;
  }
}

/** Short, stable certificate id from the name, track and date (FNV-1a). */
function certId(name: string, track: string, date: string) {
  let h = 2166136261;
  for (const ch of `${name.trim().toLowerCase()}|${track}|${date}`) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  const s = (h >>> 0).toString(36).toUpperCase().padStart(7, "0");
  return `DL-${track.slice(0, 3).toUpperCase()}-${s}`;
}

// ---- drawing ------------------------------------------------------------------------------------
const W = 1600;
const H = 1131;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function draw(canvas: HTMLCanvasElement, o: { name: string; track: CertId; date: Date; id: string }) {
  await Promise.all(
    ["700 64px 'Space Grotesk'", "600 40px 'Hind Siliguri'", "400 26px Inter", "500 22px 'JetBrains Mono'"].map((f) => document.fonts?.load(f).catch(() => undefined)),
  );
  const ctx = canvas.getContext("2d")!;
  canvas.width = W;
  canvas.height = H;
  const head = "'Space Grotesk', 'Hind Siliguri', system-ui, sans-serif";
  const body = "Inter, 'Hind Siliguri', system-ui, sans-serif";
  const bn = "'Hind Siliguri', Inter, sans-serif";
  const accent = "#0e7490";
  const ink = "#0f1b2d";

  // paper + graph-paper grid
  ctx.fillStyle = "#fbfdff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(14,116,144,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // frames
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = "rgba(14,116,144,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 60, W - 120, H - 120);
  // decorative chart bars in the corner
  [[0.5, 70], [0.75, 110], [1, 150]].forEach(([op, h], i) => {
    ctx.fillStyle = `rgba(14,116,144,${op})`;
    ctx.fillRect(W - 230 + i * 44, 210 - h, 30, h);
  });

  // logo + brand
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(110, 110, 64, 64, 14);
  ctx.fill();
  ctx.fillStyle = "#fff";
  [[124, 144, 10, 18], [139, 132, 10, 30], [154, 120, 10, 42]].forEach(([x, y, w, h]) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.fill();
  });
  ctx.fillStyle = ink;
  ctx.font = `700 34px ${head}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Data Lab", 192, 132);
  ctx.font = `500 24px ${bn}`;
  ctx.fillStyle = "#56657a";
  ctx.fillText("ডেটা ল্যাব", 192, 162);

  // title
  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.font = `500 24px 'JetBrains Mono', monospace`;
  ctx.fillText("// CERTIFICATE OF COMPLETION", W / 2, 280);
  ctx.fillStyle = "#56657a";
  ctx.font = `500 30px ${bn}`;
  ctx.fillText("সমাপনী সনদ", W / 2, 325);

  ctx.fillStyle = "#56657a";
  ctx.font = `400 28px ${body}`;
  ctx.fillText("This certifies that", W / 2, 410);

  // name (shrink to fit)
  let size = 84;
  ctx.fillStyle = ink;
  do {
    ctx.font = `700 ${size}px ${head}`;
    size -= 4;
  } while (ctx.measureText(o.name).width > W - 360 && size > 36);
  ctx.fillText(o.name, W / 2, 500);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 360, 560);
  ctx.lineTo(W / 2 + 360, 560);
  ctx.stroke();

  // what they completed
  const info = TRACK_INFO[o.track];
  ctx.fillStyle = "#334155";
  ctx.font = `400 28px ${body}`;
  const sentence =
    o.track === "graduate"
      ? "has completed all five tracks of Data Lab — Data Analysis, SQL, Data Engineering, Machine Learning, and AI & LLMs — learning by doing, with hands-on labs on real-looking data."
      : `has successfully completed the ${info.title.en} track of Data Lab — learning by doing, with hands-on interactive labs on real-looking data.`;
  wrap(ctx, sentence, W - 420).forEach((l, i) => ctx.fillText(l, W / 2, 625 + i * 42));
  ctx.fillStyle = accent;
  ctx.font = `600 34px ${bn}`;
  ctx.fillText(o.track === "graduate" ? "ডেটা ল্যাব গ্র্যাজুয়েট — পাঁচটি ট্র্যাকই সম্পন্ন" : `${info.title.bn} ট্র্যাক সম্পন্ন`, W / 2, o.track === "graduate" ? 780 : 740);

  // footer: date, signature, id, QR
  const y = 900;
  ctx.textAlign = "left";
  ctx.fillStyle = "#56657a";
  ctx.font = `400 22px ${body}`;
  ctx.fillText("Date", 140, y);
  ctx.fillStyle = ink;
  ctx.font = `600 28px ${body}`;
  ctx.fillText(o.date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), 140, y + 40);
  ctx.fillStyle = "#56657a";
  ctx.font = `500 20px 'JetBrains Mono', monospace`;
  ctx.fillText(`ID: ${o.id}`, 140, y + 90);

  ctx.textAlign = "center";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 200, y + 20);
  ctx.lineTo(W / 2 + 200, y + 20);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.font = `600 28px ${head}`;
  ctx.fillText(CREATOR.name, W / 2, y + 55);
  ctx.fillStyle = "#56657a";
  ctx.font = `400 21px ${body}`;
  ctx.fillText("Creator, Data Lab · AI & ML Engineer", W / 2, y + 88);

  // QR to the site
  const { modules } = QRCode.create(SITE, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const qs = 150;
  const cell = qs / (n + 4);
  const qx = W - 140 - qs;
  const qy = y - 40;
  ctx.fillStyle = "#fff";
  ctx.fillRect(qx, qy, qs, qs);
  ctx.fillStyle = "#0b1424";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (modules.get(r, c)) ctx.fillRect(qx + (c + 2) * cell, qy + (r + 2) * cell, cell + 0.4, cell + 0.4);
  ctx.fillStyle = "#56657a";
  ctx.font = `400 17px ${body}`;
  ctx.fillText("data-lab-ai.vercel.app", qx + qs / 2, qy + qs + 26);
}

// ---- page -----------------------------------------------------------------------------------------
export default function Certificate() {
  const { t } = useLang();
  const progress = useProgress();
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("datalab-cert-name") ?? "";
    } catch {
      return "";
    }
  });
  const solved = useMemo(sqlSolved, []);
  const status = useMemo(() => {
    const s = {} as Record<CertId, { done: number; total: number; ok: boolean; note?: T }>;
    (Object.keys(TRACKS) as Track[]).forEach((k) => {
      const done = Math.min(progress[k]?.length ?? 0, TRACKS[k]);
      let ok = done >= TRACKS[k];
      let note: T | undefined;
      if (k === "sql") {
        ok = ok && solved >= SQL_SOLVED_NEEDED;
        note = { en: `and solve ${SQL_SOLVED_NEEDED} lessons with “Check my answer” (${solved}/${SQL_SOLVED_NEEDED})`, bn: `এবং “আমার উত্তর যাচাই করুন” দিয়ে ${SQL_SOLVED_NEEDED}টা পাঠ সমাধান (${solved}/${SQL_SOLVED_NEEDED})` };
      }
      s[k] = { done, total: TRACKS[k], ok, note };
    });
    const all = (Object.keys(TRACKS) as Track[]).every((k) => s[k].ok);
    s.graduate = { done: (Object.keys(TRACKS) as Track[]).filter((k) => s[k].ok).length, total: 5, ok: all };
    return s;
  }, [progress, solved]);
  const firstOk = (Object.keys(status) as CertId[]).find((k) => status[k].ok);
  const [track, setTrack] = useState<CertId | null>(null);
  const chosen = track && status[track]?.ok ? track : (firstOk ?? null);
  const today = useMemo(() => new Date(), []);
  const dateKey = today.toISOString().slice(0, 10);
  const id = chosen ? certId(name || "?", chosen, dateKey) : "";
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("datalab-cert-name", name);
    } catch {
      /* ignore */
    }
    if (!chosen || !name.trim() || !canvas.current) return setReady(false);
    let alive = true;
    draw(canvas.current, { name: name.trim(), track: chosen, date: today, id }).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [name, chosen, id, today]);

  const download = () =>
    canvas.current?.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `data-lab-certificate-${chosen}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }, "image/png");
  const printIt = () => {
    const url = canvas.current?.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (!url || !w) return;
    w.document.write(`<!doctype html><title>Data Lab certificate</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0}img{width:100vw;height:100vh;object-fit:contain}</style><img src="${url}" onload="setTimeout(()=>print(),200)">`);
    w.document.close();
  };
  const linkedIn = chosen
    ? `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(chosen === "graduate" ? "Data Lab Graduate — Data & AI" : `Data Lab — ${TRACK_INFO[chosen].title.en}`)}&organizationName=${encodeURIComponent("Data Lab")}&issueYear=${today.getFullYear()}&issueMonth=${today.getMonth() + 1}&certUrl=${encodeURIComponent(SITE)}&certId=${encodeURIComponent(id)}`
    : "#";

  return (
    <>
      <PageHead
        title={{ en: "Certificates", bn: "সনদ" }}
        sub={{
          en: "Finish a track and get a certificate with your name — free, made right in your browser. Download it, print it, or add it to your LinkedIn profile.",
          bn: "একটা ট্র্যাক শেষ করুন আর নিজের নামে সনদ নিন — ফ্রি, আপনার ব্রাউজারেই তৈরি। ডাউনলোড করুন, প্রিন্ট করুন, বা লিংকডইন প্রোফাইলে যোগ করুন।",
        }}
      />
      <div className="cert-tracks">
        {(Object.keys(TRACK_INFO) as CertId[]).map((k) => {
          const s = status[k];
          return (
            <button key={k} className={`cert-track${s.ok ? " ok" : ""}${chosen === k ? " on" : ""}`} onClick={() => s.ok && setTrack(k)} disabled={!s.ok}>
              <span className="ct-ico">{s.ok ? TRACK_INFO[k].icon : "🔒"}</span>
              <span className="ct-txt">
                <b>{t(TRACK_INFO[k].title)}</b>
                <small>
                  {s.ok
                    ? t({ en: "✓ Unlocked", bn: "✓ খোলা হয়েছে" })
                    : digits(
                        k === "graduate"
                          ? t({ en: `${s.done}/5 tracks finished`, bn: `৫টার মধ্যে ${s.done}টা ট্র্যাক শেষ` })
                          : t({ en: `Explore ${s.done}/${s.total}`, bn: `দেখা হয়েছে ${s.done}/${s.total}` }) + (s.note ? ` ${t(s.note)}` : ""),
                      )}
                </small>
                {!s.ok && k !== "graduate" && (
                  <Link to={TRACK_INFO[k].to} className="small" onClick={(e) => e.stopPropagation()}>
                    {t({ en: "Continue →", bn: "চালিয়ে যান →" })}
                  </Link>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {chosen ? (
        <div className="cert-maker">
          <label className="cert-name">
            <span>{t({ en: "Your name, as it should appear", bn: "সনদে যে নাম থাকবে" })}</span>
            <input type="text" value={name} maxLength={60} placeholder={t({ en: "e.g. Nusrat Jahan", bn: "যেমন: নুসরাত জাহান" })} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="cert-preview">
            <canvas ref={canvas} aria-label="Certificate preview" style={{ display: name.trim() ? "block" : "none" }} />
            {!name.trim() && <p className="muted">{t({ en: "Type your name to see your certificate.", bn: "আপনার সনদ দেখতে নাম লিখুন।" })}</p>}
          </div>
          {ready && (
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={download}>
                ⬇ {t({ en: "Download image (PNG)", bn: "ছবি ডাউনলোড (PNG)" })}
              </button>
              <button className="btn ghost" onClick={printIt}>
                🖨 {t({ en: "Print / save as PDF", bn: "প্রিন্ট / PDF হিসেবে সেভ" })}
              </button>
              <a className="btn ghost" href={linkedIn} target="_blank" rel="noopener noreferrer">
                in {t({ en: "Add to LinkedIn profile", bn: "লিংকডইন প্রোফাইলে যোগ করুন" })}
              </a>
              <span className="muted small">ID: {id}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 20 }}>
          {t({
            en: "No certificate unlocked yet. Explore every part of a track (the home page shows your progress) to unlock its certificate.",
            bn: "এখনো কোনো সনদ খোলেনি। একটা ট্র্যাকের সব অংশ ঘুরে দেখুন (হোম পেজে অগ্রগতি দেখা যায়), তাহলে তার সনদ খুলে যাবে।",
          })}
        </p>
      )}
    </>
  );
}
