import { memo, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLang, type T } from "../i18n";
import { DATASETS, dataset } from "../data/generate";
import { LESSONS } from "../data/lessons";
import { DataTicker, HeroConsole } from "../components/HeroConsole";
import { LiveStats } from "../components/LiveStats";
import { digits, numeralMode } from "../numerals";
import { Bars, Donut, Lines, Scatter, XY } from "../components/charts";
import { TRACKS, resetProgress, useProgress, type Track } from "../progress";

const PATHS: { to: string; track: Track; emoji: string; title: T; body: T; color: string }[] = [
  {
    to: "/analysis",
    track: "analysis",
    emoji: "📊",
    color: "var(--c1)",
    title: { en: "Data Analysis", bn: "ডেটা অ্যানালাইসিস" },
    body: {
      en: "Look at data and find the story: charts, averages, groups, trends. Bring your own CSV too.",
      bn: "ডেটা দেখে গল্পটা খুঁজে বের করুন: চার্ট, গড়, দল, ট্রেন্ড। নিজের CSV ফাইলও আনতে পারেন।",
    },
  },
  {
    to: "/sql",
    track: "sql",
    emoji: "🗄️",
    color: "var(--c3)",
    title: { en: "SQL", bn: "এসকিউএল" },
    body: {
      en: "Ask a database questions with simple, English-like commands. 18 lessons with answer checking, plus timed challenges.",
      bn: "ইংরেজির মতো সহজ কমান্ডে ডেটাবেসকে প্রশ্ন করুন। উত্তর যাচাইসহ ১৮টা পাঠ, আর সময় ধরে চ্যালেঞ্জ।",
    },
  },
  {
    to: "/engineering",
    track: "engineering",
    emoji: "🏗️",
    color: "var(--c5)",
    title: { en: "Data Engineering", bn: "ডেটা ইঞ্জিনিয়ারিং" },
    body: {
      en: "Turn a messy file into clean, trusted data — one step at a time, with checks along the way.",
      bn: "এলোমেলো একটা ফাইলকে পরিষ্কার, বিশ্বাসযোগ্য ডেটায় বদলান — এক ধাপ এক ধাপ করে, পথে পথে যাচাইসহ।",
    },
  },
  {
    to: "/ml",
    track: "ml",
    emoji: "🤖",
    color: "var(--c4)",
    title: { en: "Machine Learning", bn: "মেশিন লার্নিং" },
    body: {
      en: "Teach a computer from examples. 11 models you can play with — from linear regression to random forests, boosting and a recommender.",
      bn: "উদাহরণ দেখিয়ে কম্পিউটারকে শেখান। খেলার মতো চালানো যায় এমন ১১টা মডেল — লিনিয়ার রিগ্রেশন থেকে র‍্যান্ডম ফরেস্ট, বুস্টিং আর রেকমেন্ডার পর্যন্ত।",
    },
  },
  {
    to: "/llm",
    track: "llm",
    emoji: "✨",
    color: "var(--c7)",
    title: { en: "AI & LLMs", bn: "এআই ও এলএলএম" },
    body: {
      en: "See what's inside ChatGPT-style AI — tokens, attention, RAG, AI agents — and train your own tiny GPT.",
      bn: "ChatGPT-ধরনের এআই-এর ভেতরে কী আছে দেখুন — টোকেন, অ্যাটেনশন, RAG, এআই এজেন্ট — আর নিজের ছোট GPT ট্রেন করুন।",
    },
  },
];

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{digits(n.toLocaleString("en-US"))}</>;
}

/**
 * Renders its children in a quiet moment after the page has loaded (one chart at a time),
 * or immediately if it scrolls into view first. Keeps both loading and scrolling smooth.
 */
let idleQueue = Promise.resolve();
const whenIdle = () =>
  new Promise<void>((done) => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(() => done(), { timeout: 1200 });
    else setTimeout(done, 60);
  });
function Deferred({ children, height }: { children: React.ReactNode; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    const reveal = () => {
      if (alive) setShow(true);
    };
    idleQueue = idleQueue.then(whenIdle).then(reveal);
    const el = ref.current;
    let io: IntersectionObserver | undefined;
    if (el && "IntersectionObserver" in window) {
      io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && reveal(), { rootMargin: "200px" });
      io.observe(el);
    }
    return () => {
      alive = false;
      io?.disconnect();
    };
  }, []);
  return (
    <div ref={ref} style={show ? undefined : { minHeight: height }}>
      {show ? children : null}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Charts don't depend on the language, so memo() keeps them from redrawing on a language switch.
const MiniChart = memo(function MiniChart({ id }: { id: string }) {
  const rows = dataset(id).rows;
  const count = (k: string) => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(String(r[k]), (m.get(String(r[k])) ?? 0) + 1));
    return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  if (id === "customers") return <Donut items={count("city")} size={150} center="240" />;
  if (id === "transactions") return <Bars items={count("category").slice(0, 6)} h={170} color="var(--c3)" />;
  if (id === "loans")
    return (
      <Donut
        items={[
          { label: "repaid", value: rows.filter((r) => r.defaulted === 0).length },
          { label: "defaulted", value: rows.filter((r) => r.defaulted === 1).length },
        ]}
        size={150}
      />
    );
  if (id === "shop_orders") {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      const k = String(r.order_date).slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + (r.quantity as number) * (r.unit_price as number));
    });
    const months = [...m].sort((a, b) => a[0].localeCompare(b[0]));
    return (
      <XY
        series={[{ name: "sales", pts: months.map(([, v], i) => [i, v] as [number, number]), area: true, color: "var(--c2)" }]}
        xFmt={(v) => months[Math.round(v)]?.[0].slice(2) ?? ""}
        h={170}
      />
    );
  }
  if (id === "employees") return <Donut items={count("department")} size={150} />;
  if (id === "dhaka_air") {
    const byMonth = MONTHS.map((mo) => {
      const v = rows.filter((r) => r.month === mo).map((r) => r.aqi as number);
      return { label: mo, value: v.reduce((a, b) => a + b, 0) / v.length };
    });
    return <Bars items={byMonth} h={170} colors={byMonth.map((b) => (b.value > 150 ? "var(--c2)" : "var(--c3)"))} />;
  }
  if (id === "students") return <Scatter points={rows.map((r) => ({ x: r.study_hours_week as number, y: r.final_score as number, c: r.passed ? 2 : 1 }))} h={180} />;
  const s = (tk: string) => rows.filter((r) => r.ticker === tk).map((r) => r.close as number);
  const base = (v: number[]) => v.map((x) => (x / v[0]) * 100);
  return <Lines series={["GP", "BRACBANK", "SQURPHARMA"].map((n) => ({ name: n, values: base(s(n)) }))} h={190} />;
});

export default function Home() {
  const { t } = useLang();
  const progress = useProgress();
  const totalDone = (Object.keys(TRACKS) as Track[]).reduce((a, k) => a + Math.min(progress[k]?.length ?? 0, TRACKS[k]), 0);
  const total = Object.values(TRACKS).reduce((a, b) => a + b, 0);
  const totalRows = DATASETS.reduce((a, d) => a + d.rows.length, 0);

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">{t({ en: "Free · English & বাংলা · No sign-up", bn: "ফ্রি · বাংলা ও ইংরেজি · সাইন-আপ লাগে না" })}</span>
          <h1>
            {t({ en: "Learn data & AI by ", bn: "ডেটা ও এআই শিখুন " })}
            <span className="grad">{t({ en: "playing with it.", bn: "খেলতে খেলতে।" })}</span>
          </h1>
          <p>
            {t({
              en: "No boring theory first. Click, drag and press buttons on real-looking data — from your first SQL query all the way to how ChatGPT works. Everything runs right here in your browser.",
              bn: "আগে একগাদা তত্ত্ব নয়। বাস্তবের মতো ডেটায় ক্লিক করুন, টানুন, বাটন চাপুন — প্রথম SQL কোয়েরি থেকে শুরু করে ChatGPT কীভাবে কাজ করে, সব। সবকিছু চলে এখানেই, আপনার ব্রাউজারে।",
            })}
          </p>
          <div className="row">
            <Link className="btn big" to="/analysis">
              {t({ en: "I'm new — start here", bn: "আমি নতুন — এখান থেকে শুরু" })} →
            </Link>
            <Link className="btn ghost big" to="/llm">
              ✨ {t({ en: "Peek inside AI", bn: "এআই-এর ভেতরে দেখুন" })}
            </Link>
          </div>
          <LiveStats />
        </div>
        <HeroConsole />
      </section>
      <DataTicker />

      <section className="counters">
        {(
          [
            [LESSONS.length, { en: "SQL lessons", bn: "এসকিউএল পাঠ" }],
            [TRACKS.ml, { en: "ML models", bn: "এমএল মডেল" }],
            [TRACKS.llm, { en: "AI / LLM labs", bn: "এআই / এলএলএম ল্যাব" }],
            [DATASETS.length, { en: "practice datasets", bn: "অনুশীলনের ডেটাসেট" }],
            [totalRows, { en: "rows of data to explore", bn: "সারি ডেটা ঘাঁটার জন্য" }],
          ] as [number, T][]
        ).map(([n, label], i) => (
          <div key={i} className="counter">
            <b>
              <CountUp to={n} />
            </b>
            <span>{t(label)}</span>
          </div>
        ))}
      </section>

      <div className="row spread" style={{ marginTop: 28 }}>
        <h2 style={{ margin: 0 }}>{t({ en: "Pick what you want to learn", bn: "কী শিখতে চান বেছে নিন" })}</h2>
        {totalDone > 0 && (
          <span className="muted small">
            {t({ en: `Your progress: ${totalDone}/${total}`, bn: `আপনার অগ্রগতি: ${totalDone}/${total}` })} ·{" "}
            <button className="linkish" onClick={resetProgress}>
              {t({ en: "reset", bn: "রিসেট" })}
            </button>
          </span>
        )}
      </div>
      <section className="grid tracks" style={{ marginTop: 14 }}>
        {PATHS.map((p) => {
          const done = Math.min(progress[p.track]?.length ?? 0, TRACKS[p.track]);
          const pct = Math.round((done / TRACKS[p.track]) * 100);
          return (
            <Link key={p.to} to={p.to} className="card path-card" style={{ ["--tint" as string]: p.color }}>
              <div className="emoji">{p.emoji}</div>
              <h3>{t(p.title)}</h3>
              <p>{t(p.body)}</p>
              <div className="progress">
                <div style={{ width: `${pct}%` }} />
              </div>
              <span className="muted small">
                {done}/{TRACKS[p.track]} {t({ en: "explored", bn: "দেখা হয়েছে" })}
              </span>
            </Link>
          );
        })}
      </section>

      <Link to="/certificate" className="card cert-banner">
        <span className="cb-ico">🎓</span>
        <span>
          <b>{t({ en: "Earn a free certificate", bn: "ফ্রি সনদ অর্জন করুন" })}</b>
          <small>
            {t({
              en: "Finish a track and download a certificate with your name — or add it straight to your LinkedIn profile.",
              bn: "একটা ট্র্যাক শেষ করে নিজের নামে সনদ ডাউনলোড করুন — অথবা সরাসরি লিংকডইন প্রোফাইলে যোগ করুন।",
            })}
          </small>
        </span>
        <span className="cb-go">→</span>
      </Link>

      <h2>{t({ en: "Never done this before? Follow this path", bn: "আগে কখনো করেননি? এই পথে চলুন" })}</h2>
      <div className="timeline">
        {(
          [
            [{ en: "Look at data", bn: "ডেটা দেখুন" }, { en: "Open Analysis with the Students dataset. Just look and click around.", bn: "অ্যানালাইসিসে শিক্ষার্থী ডেটাসেট খুলুন। শুধু দেখুন আর ক্লিক করুন।" }, "/analysis"],
            [{ en: "Ask with SQL", bn: "এসকিউএলে প্রশ্ন" }, { en: "Do lessons 1–7. Each takes about 5 minutes.", bn: "১–৭ নম্বর পাঠ করুন। প্রতিটায় লাগে মোটামুটি ৫ মিনিট।" }, "/sql"],
            [{ en: "Clean messy data", bn: "এলোমেলো ডেটা পরিষ্কার" }, { en: "Click through the 7 pipeline steps.", bn: "পাইপলাইনের ৭টা ধাপে একে একে ক্লিক করুন।" }, "/engineering"],
            [{ en: "Teach a model", bn: "মডেলকে শেখান" }, { en: "Start with linear regression and press ▶.", bn: "লিনিয়ার রিগ্রেশন দিয়ে শুরু করে ▶ চাপুন।" }, "/ml"],
            [{ en: "Understand AI", bn: "এআই বুঝুন" }, { en: "See how ChatGPT-style models really work.", bn: "দেখুন ChatGPT-ধরনের মডেল আসলে কীভাবে কাজ করে।" }, "/llm"],
          ] as [T, T, string][]
        ).map(([title, body, to], i) => (
          <Link key={i} to={to} className="tl-item">
            <span className="tl-dot">{i + 1}</span>
            <b>{t(title)}</b>
            <p>{t(body)}</p>
          </Link>
        ))}
      </div>

      <div className="row spread" style={{ marginTop: 28 }}>
        <h2 style={{ margin: 0 }}>{t({ en: "Practice datasets", bn: "অনুশীলনের ডেটাসেট" })}</h2>
        <Link to="/glossary" className="small">
          📖 {t({ en: "Confused by a word? Open the glossary", bn: "কোনো শব্দ বুঝছেন না? শব্দকোষ খুলুন" })}
        </Link>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        {t({
          en: "All made up for learning, but shaped like real Bangladeshi data. Use them in Analysis, SQL and Machine Learning — or download them as CSV.",
          bn: "সবই শেখার জন্য বানানো, তবে বাংলাদেশের আসল ডেটার মতো করে সাজানো। অ্যানালাইসিস, এসকিউএল আর মেশিন লার্নিংয়ে ব্যবহার করুন — অথবা CSV হিসেবে ডাউনলোড করুন।",
        })}
      </p>
      <div className="grid cols2">
        {DATASETS.map((d) => (
          <div key={d.id} className="card ds-card">
            <div>
              <h3>
                {t(d.title)} <code>{d.id}</code> <span className="badge">{d.rows.length.toLocaleString()}</span>
              </h3>
              <p className="muted" style={{ margin: 0 }}>
                {t(d.desc)}
              </p>
            </div>
            <Deferred height={190}>
              <MiniChart key={`${d.id}-${numeralMode()}`} id={d.id} />
            </Deferred>
          </div>
        ))}
      </div>

    </>
  );
}
