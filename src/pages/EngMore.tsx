import { useEffect, useMemo, useRef, useState } from "react";
import { useLang, type T } from "../i18n";
import { customerById, dataset, type Row } from "../data/generate";
import { Bars, HBars, Heatmap, fmt } from "../components/charts";
import { Callout, DataTable, Slider, Stat } from "../components/ui";

// =====================================================================================
// 1. Star schema — split one wide table into a fact table and small dimension tables
// =====================================================================================
const EIDS = ["2024-04-10", "2024-06-17", "2025-03-31", "2025-06-07"].map((d) => Date.parse(d));
const DAY = 86400000;

interface Model {
  id: string;
  title: string;
  kind: "fact" | "dim";
  cols: string[]; // 🔑 = primary key, ↗ = foreign key
  rows: Row[];
  x: number;
  y: number;
}

function buildStar() {
  const orders = dataset("shop_orders").rows;
  const productKey = new Map<string, number>();
  const dimProduct: Row[] = [];
  const paymentKey = new Map<string, number>();
  const dimPayment: Row[] = [];
  const dateSeen = new Set<number>();
  const dimDate: Row[] = [];
  const custSeen = new Set<number>();
  const dimCustomer: Row[] = [];
  const fact: Row[] = [];
  for (const o of orders) {
    const p = String(o.product);
    if (!productKey.has(p)) {
      productKey.set(p, productKey.size + 1);
      dimProduct.push({ product_key: productKey.size, product: p, category: o.category, unit_price: o.unit_price });
    }
    const pay = String(o.payment);
    if (!paymentKey.has(pay)) {
      paymentKey.set(pay, paymentKey.size + 1);
      dimPayment.push({ payment_key: paymentKey.size, method: pay, is_digital: pay === "Cash on Delivery" ? 0 : 1 });
    }
    const d = String(o.order_date);
    const dk = Number(d.replace(/-/g, ""));
    if (!dateSeen.has(dk)) {
      dateSeen.add(dk);
      const ts = Date.parse(d);
      const m = Number(d.slice(5, 7));
      dimDate.push({ date_key: dk, date: d, month: d.slice(0, 7), quarter: `${d.slice(0, 4)}-Q${Math.ceil(m / 3)}`, eid_season: EIDS.some((e) => e - ts >= 0 && e - ts < 21 * DAY) ? 1 : 0 });
    }
    const cid = o.customer_id as number;
    if (!custSeen.has(cid)) {
      custSeen.add(cid);
      const c = customerById.get(cid)!;
      dimCustomer.push({ customer_key: cid, name: c.name, city: c.city, segment: c.segment });
    }
    fact.push({
      order_id: o.order_id,
      date_key: dk,
      customer_key: cid,
      product_key: productKey.get(p)!,
      payment_key: paymentKey.get(pay)!,
      quantity: o.quantity,
      revenue: (o.quantity as number) * (o.unit_price as number),
    });
  }
  dimDate.sort((a, b) => (a.date_key as number) - (b.date_key as number));
  dimCustomer.sort((a, b) => (a.customer_key as number) - (b.customer_key as number));
  const models: Model[] = [
    { id: "fact_sales", title: "fact_sales", kind: "fact", cols: ["🔑 order_id", "↗ date_key", "↗ customer_key", "↗ product_key", "↗ payment_key", "quantity", "revenue"], rows: fact, x: 290, y: 120 },
    { id: "dim_customer", title: "dim_customer", kind: "dim", cols: ["🔑 customer_key", "name", "city", "segment"], rows: dimCustomer, x: 20, y: 20 },
    { id: "dim_product", title: "dim_product", kind: "dim", cols: ["🔑 product_key", "product", "category", "unit_price"], rows: dimProduct, x: 560, y: 20 },
    { id: "dim_date", title: "dim_date", kind: "dim", cols: ["🔑 date_key", "date", "month", "quarter", "eid_season"], rows: dimDate, x: 20, y: 250 },
    { id: "dim_payment", title: "dim_payment", kind: "dim", cols: ["🔑 payment_key", "method", "is_digital"], rows: dimPayment, x: 560, y: 270 },
  ];
  // Rough storage: count characters, as if every value were written out in a CSV.
  const chars = (rows: Row[]) => rows.reduce((a, r) => a + Object.values(r).reduce((b: number, v) => b + String(v ?? "").length + 1, 0), 0);
  const wide = orders.map((o) => {
    const c = customerById.get(o.customer_id as number)!;
    return { ...o, name: c.name, city: c.city, segment: c.segment };
  });
  const sizes = { wide: chars(wide), star: models.reduce((a, m) => a + chars(m.rows), 0) };
  // revenue by category × quarter, the classic star-schema query
  const quarters = [...new Set(dimDate.map((d) => String(d.quarter)))];
  const cats = [...new Set(dimProduct.map((p) => String(p.category)))];
  const qOf = new Map(dimDate.map((d) => [d.date_key as number, String(d.quarter)]));
  const cOf = new Map(dimProduct.map((p) => [p.product_key as number, String(p.category)]));
  const cube = cats.map((c) => quarters.map((q) => fact.filter((f) => cOf.get(f.product_key as number) === c && qOf.get(f.date_key as number) === q).reduce((a, f) => a + (f.revenue as number), 0)));
  return { models, sizes, quarters, cats, cube };
}

const BOX_W = 150;
const ROW_H = 17;

export function StarSchema() {
  const { t } = useLang();
  const star = useMemo(buildStar, []);
  const [sel, setSel] = useState("fact_sales");
  const m = star.models.find((x) => x.id === sel)!;
  const fact = star.models[0];
  const boxH = (mm: Model) => 40 + mm.cols.length * ROW_H;
  const saved = 1 - star.sizes.star / star.sizes.wide;

  return (
    <>
      <p>
        {t({
          en: "The shop's orders arrive as one wide table where the customer's name, city, product and category are repeated on every single row. Data warehouses split this into a star: one fact table with the numbers (what happened), and small dimension tables with the descriptions (who, what, when, how). Click any table.",
          bn: "শপের অর্ডারগুলো আসে একটা চওড়া টেবিলে, যেখানে প্রতিটা সারিতে গ্রাহকের নাম, শহর, পণ্য আর ক্যাটাগরি বারবার লেখা। ডেটা ওয়্যারহাউস এটাকে একটা তারার (star) মতো ভাগ করে: একটা ফ্যাক্ট টেবিল যেখানে সংখ্যাগুলো (কী ঘটেছে), আর কয়েকটা ছোট ডাইমেনশন টেবিল যেখানে বর্ণনা (কে, কী, কখন, কীভাবে)। যেকোনো টেবিলে ক্লিক করুন।",
        })}
      </p>
      <div className="card">
        <svg viewBox="0 0 730 400" className="chart star-svg">
          {star.models.slice(1).map((d) => {
            const fx = fact.x + (d.x < fact.x ? 0 : BOX_W);
            const fy = fact.y + 28 + (fact.cols.findIndex((c) => c.includes(d.cols[0].slice(3))) + 0.5) * ROW_H;
            const dx = d.x + (d.x < fact.x ? BOX_W : 0);
            const dy = d.y + 28 + 0.5 * ROW_H;
            const on = sel === d.id || sel === "fact_sales";
            return <path key={d.id} d={`M${fx},${fy} C${(fx + dx) / 2},${fy} ${(fx + dx) / 2},${dy} ${dx},${dy}`} className={`star-link${on ? " on" : ""}`} />;
          })}
          {star.models.map((mm) => (
            <g key={mm.id} transform={`translate(${mm.x},${mm.y})`} onClick={() => setSel(mm.id)} className={`star-box ${mm.kind}${sel === mm.id ? " on" : ""}`}>
              <rect width={BOX_W} height={boxH(mm)} rx={10} className="star-body" />
              <path d={`M0,10 a10,10 0 0 1 10,-10 h${BOX_W - 20} a10,10 0 0 1 10,10 v18 h-${BOX_W} z`} className="star-head" />
              <text x={10} y={19} className="star-title">
                {mm.title}
              </text>
              {mm.cols.map((c, i) => (
                <text key={c} x={10} y={28 + (i + 0.75) * ROW_H} className="star-col">
                  {c}
                </text>
              ))}
              <text x={BOX_W - 8} y={boxH(mm) - 6} textAnchor="end" className="star-count">
                {mm.rows.length.toLocaleString()} rows
              </text>
            </g>
          ))}
        </svg>
        <p className="muted small center" style={{ margin: 0 }}>
          🔑 {t({ en: "primary key (unique ID)", bn: "প্রাইমারি কী (অনন্য আইডি)" })} · ↗ {t({ en: "foreign key (points to a dimension)", bn: "ফরেন কী (ডাইমেনশনের দিকে নির্দেশ করে)" })}
        </p>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row spread">
          <h3 style={{ margin: 0 }}>
            <code>{m.title}</code> — {m.rows.length.toLocaleString()} {t({ en: "rows", bn: "সারি" })}
          </h3>
          <span className={`badge ${m.kind === "fact" ? "mid" : ""}`}>{m.kind === "fact" ? t({ en: "fact: the numbers", bn: "ফ্যাক্ট: সংখ্যাগুলো" }) : t({ en: "dimension: the descriptions", bn: "ডাইমেনশন: বর্ণনাগুলো" })}</span>
        </div>
        <DataTable columns={Object.keys(m.rows[0])} rows={m.rows.slice(0, 8).map((r) => Object.values(r))} max={8} />
      </div>
      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t({ en: "Why bother? Less repeated data", bn: "কেন করব? কম পুনরাবৃত্তি" })}</h3>
          <HBars
            items={[
              { label: t({ en: "one wide table", bn: "একটা চওড়া টেবিল" }), value: star.sizes.wide / 1024, color: "var(--c2)" },
              { label: t({ en: "star schema", bn: "স্টার স্কিমা" }), value: star.sizes.star / 1024, color: "var(--c3)" },
            ]}
            format={(v) => `${v.toFixed(0)} KB`}
          />
          <p className="muted small">
            {t({
              en: `The star stores the same information in ${(saved * 100).toFixed(0)}% less space, because “Smartwatch, Electronics” is written once in dim_product instead of on every order. Fix a typo once, and every report is fixed.`,
              bn: `স্টার একই তথ্য ${(saved * 100).toFixed(0)}% কম জায়গায় রাখে, কারণ “Smartwatch, Electronics” প্রতিটা অর্ডারে না লিখে dim_product-এ একবারই লেখা থাকে। একবার একটা বানান ঠিক করলেই সব রিপোর্ট ঠিক হয়ে যায়।`,
            })}
          </p>
          <pre className="prompt-box">{`SELECT p.category, d.quarter,
       SUM(f.revenue) AS revenue
FROM fact_sales f
JOIN dim_product p ON p.product_key = f.product_key
JOIN dim_date    d ON d.date_key    = f.date_key
GROUP BY p.category, d.quarter;`}</pre>
        </div>
        <div className="card">
          <h3>{t({ en: "Result: revenue by category × quarter", bn: "ফলাফল: ক্যাটাগরি × কোয়ার্টার অনুযায়ী আয়" })}</h3>
          <Heatmap rows={star.cats} cols={star.quarters.map((q) => q.replace("20", "'"))} values={star.cube} format={fmt} cell={58} />
          <p className="muted small" style={{ margin: 0 }}>
            {t({
              en: "This is the most common kind of business question: a number (revenue) sliced by descriptions (category, time). The star shape makes it fast and simple. Fashion lights up in the Eid quarters.",
              bn: "এটাই সবচেয়ে সাধারণ ব্যবসায়িক প্রশ্ন: একটা সংখ্যা (আয়), বর্ণনা (ক্যাটাগরি, সময়) দিয়ে ভাগ করা। স্টার আকৃতি এটাকে দ্রুত আর সহজ করে। ঈদের কোয়ার্টারগুলোতে ফ্যাশন জ্বলজ্বল করে।",
            })}
          </p>
        </div>
      </div>
    </>
  );
}

// =====================================================================================
// 2. Streaming — events processed the moment they arrive
// =====================================================================================
interface Ev {
  id: number;
  ts: number;
  user: string;
  amount: number;
  city: string;
}
interface Alert {
  id: number;
  ts: number;
  user: string;
  reason: T;
  amount: number;
}
const USERS = Array.from({ length: 24 }, (_, i) => `U${String(i + 1).padStart(2, "0")}`);
const CITIES = ["Dhaka", "Chattogram", "Khulna", "Rajshahi", "Sylhet"];
const WINDOW_MS = 3000;
const BIG = 20000;

function randomEvent(id: number, ts: number): Ev {
  const big = Math.random() < 0.02;
  const amount = big ? 20000 + Math.round(Math.random() * 40000) : Math.round(Math.exp(5.5 + Math.random() * 3) / 10) * 10;
  return { id, ts, user: USERS[Math.floor(Math.random() * USERS.length)], amount, city: CITIES[Math.floor(Math.random() * CITIES.length)] };
}

export function Streaming() {
  const { t } = useLang();
  const [running, setRunning] = useState(true);
  const [rate, setRate] = useState(4);
  const [events, setEvents] = useState<Ev[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState({ n: 0, sum: 0 });
  const [batch, setBatch] = useState<{ n: number; sum: number; alerts: number } | null>(null);
  const start = useRef(Date.now());
  const nextId = useRef(1);
  const [now, setNow] = useState(Date.now());

  const store = useRef<Ev[]>([]);
  // The streaming "job": every event is checked against the rules the moment it arrives.
  const ingest = (incoming: Ev[]) => {
    const newAlerts: Alert[] = [];
    for (const e of incoming) {
      store.current = [...store.current, e].slice(-400);
      if (e.amount >= BIG) newAlerts.push({ id: e.id, ts: e.ts, user: e.user, amount: e.amount, reason: { en: "large transfer", bn: "বড় অঙ্কের ট্রান্সফার" } });
      const w = Math.floor((e.ts - start.current) / WINDOW_MS);
      const same = store.current.filter((x) => x.user === e.user && Math.floor((x.ts - start.current) / WINDOW_MS) === w);
      if (same.length === 3) newAlerts.push({ id: e.id + 0.5, ts: e.ts, user: e.user, amount: e.amount, reason: { en: "3 payments in 3 seconds", bn: "৩ সেকেন্ডে ৩টা পেমেন্ট" } });
    }
    setEvents(store.current);
    if (newAlerts.length) setAlerts((a) => [...newAlerts.reverse(), ...a].slice(0, 6));
    setTotal((tt) => ({ n: tt.n + incoming.length, sum: tt.sum + incoming.reduce((a, e) => a + e.amount, 0) }));
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const ts = Date.now();
      ingest([randomEvent(nextId.current++, ts)]);
    }, 1000 / rate);
    return () => clearInterval(id);
  }, [running, rate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const injectFraud = () => {
    const ts = Date.now();
    const u = "U99";
    ingest([0, 1, 2].map((k) => ({ id: nextId.current++, ts: ts + k, user: u, amount: 4800 + k * 100, city: "Dhaka" })));
  };

  const curW = Math.floor((now - start.current) / WINDOW_MS);
  const windows = Array.from({ length: 12 }, (_, k) => {
    const w = curW - 11 + k;
    const inW = events.filter((e) => Math.floor((e.ts - start.current) / WINDOW_MS) === w);
    return { label: k === 11 ? t({ en: "now", bn: "এখন" }) : `-${(11 - k) * 3}s`, value: inW.reduce((a, e) => a + e.amount, 0) };
  });

  return (
    <>
      <p>
        {t({
          en: "Some data can't wait for tomorrow. Here, mobile-money payments arrive live (one dot = one payment). A streaming job adds them up in 3-second windows and checks every payment the moment it lands. Press “Inject fraud” and watch the alert appear instantly.",
          bn: "কিছু ডেটা আগামীকাল পর্যন্ত অপেক্ষা করতে পারে না। এখানে মোবাইল-মানি পেমেন্ট লাইভ আসছে (একটা বিন্দু = একটা পেমেন্ট)। একটা স্ট্রিমিং জব ৩ সেকেন্ডের উইন্ডোতে সেগুলো যোগ করে, আর প্রতিটা পেমেন্ট আসামাত্রই পরীক্ষা করে। “জালিয়াতি ঢোকান” চাপুন আর দেখুন সতর্কবার্তা কত দ্রুত আসে।",
        })}
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => setRunning(!running)}>
          {running ? "⏸ " + t({ en: "Pause stream", bn: "স্ট্রিম থামান" }) : "▶ " + t({ en: "Resume stream", bn: "স্ট্রিম চালান" })}
        </button>
        <button className="btn ghost" onClick={injectFraud}>
          🚨 {t({ en: "Inject fraud", bn: "জালিয়াতি ঢোকান" })}
        </button>
        <Slider label={t({ en: "payments per second", bn: "প্রতি সেকেন্ডে পেমেন্ট" })} value={rate} min={1} max={12} step={1} onChange={setRate} />
      </div>
      <div className="grid cols2">
        <div className="card">
          <h3>
            <span className={`live-dot${running ? " on" : ""}`} /> {t({ en: "Live event stream", bn: "লাইভ ইভেন্ট স্ট্রিম" })}
          </h3>
          <div className="stream-list">
            {events
              .slice(-9)
              .reverse()
              .map((e) => (
                <div key={e.id} className={`stream-row${e.amount >= BIG || e.user === "U99" ? " hot" : ""}`}>
                  <code>{new Date(e.ts).toLocaleTimeString("en-GB")}</code>
                  <span>{e.user}</span>
                  <span className="muted">{e.city}</span>
                  <b>{e.amount.toLocaleString()} ৳</b>
                </div>
              ))}
            {!events.length && <p className="muted small">{t({ en: "Waiting for events…", bn: "ইভেন্টের অপেক্ষায়…" })}</p>}
          </div>
          <div className="stats" style={{ marginTop: 10 }}>
            <Stat label={t({ en: "events processed", bn: "প্রসেস হওয়া ইভেন্ট" })} value={total.n.toLocaleString()} />
            <Stat label={t({ en: "money moved", bn: "মোট লেনদেন" })} value={fmt(total.sum) + " ৳"} />
            <Stat label={t({ en: "alert delay", bn: "সতর্কবার্তার দেরি" })} value="< 1s" />
          </div>
        </div>
        <div className="card">
          <h3>{t({ en: "Money per 3-second window", bn: "প্রতি ৩ সেকেন্ডের উইন্ডোতে টাকা" })}</h3>
          <Bars items={windows} h={200} colors={windows.map((_, k) => (k === 11 ? "var(--c4)" : "var(--c6)"))} />
          <h3>🚨 {t({ en: "Fraud alerts", bn: "জালিয়াতির সতর্কবার্তা" })}</h3>
          {alerts.length ? (
            alerts.map((a) => (
              <div key={a.id} className="alert-row">
                <code>{new Date(a.ts).toLocaleTimeString("en-GB")}</code> <b>{a.user}</b> — {t(a.reason)} ({a.amount.toLocaleString()} ৳)
              </div>
            ))
          ) : (
            <p className="muted small">{t({ en: "No alerts yet. Try “Inject fraud”.", bn: "এখনো কোনো সতর্কবার্তা নেই। “জালিয়াতি ঢোকান” চেষ্টা করুন।" })}</p>
          )}
        </div>
      </div>
      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t({ en: "Compare: the nightly batch job", bn: "তুলনা: রাতের ব্যাচ জব" })}</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            {t({
              en: "A batch job runs once, on everything collected so far — like a report at 2 AM. Cheaper and simpler, but a fraud at 10 AM is only discovered ~16 hours later.",
              bn: "ব্যাচ জব একবারে চলে, এখন পর্যন্ত জমা সব ডেটার ওপর — যেমন রাত ২টার রিপোর্ট। সস্তা আর সহজ, কিন্তু সকাল ১০টার জালিয়াতি ধরা পড়ে প্রায় ১৬ ঘণ্টা পরে।",
            })}
          </p>
          <button className="btn ghost" onClick={() => setBatch({ n: events.length, sum: events.reduce((a, e) => a + e.amount, 0), alerts: events.filter((e) => e.amount >= BIG).length })}>
            🗓️ {t({ en: "Run batch job now", bn: "এখনই ব্যাচ জব চালান" })}
          </button>
          {batch && (
            <div className="stats" style={{ marginTop: 10 }}>
              <Stat label={t({ en: "rows read", bn: "পড়া সারি" })} value={batch.n.toLocaleString()} />
              <Stat label={t({ en: "total", bn: "মোট" })} value={fmt(batch.sum) + " ৳"} />
              <Stat label={t({ en: "large transfers", bn: "বড় ট্রান্সফার" })} value={String(batch.alerts)} />
            </div>
          )}
        </div>
        <Callout kind="tip" title={{ en: "Which one should I use?", bn: "কোনটা ব্যবহার করব?" }}>
          <p>
            {t({
              en: "Batch for most reports and dashboards (daily sales, monthly finance). Streaming only when minutes matter: fraud, ride tracking, stock prices, live delivery status. Tools: Kafka to carry events, Flink or Spark Streaming to process them.",
              bn: "বেশিরভাগ রিপোর্ট আর ড্যাশবোর্ডের জন্য ব্যাচ (দৈনিক বিক্রি, মাসিক হিসাব)। স্ট্রিমিং শুধু তখন, যখন মিনিটও গুরুত্বপূর্ণ: জালিয়াতি, রাইড ট্র্যাকিং, শেয়ারের দাম, লাইভ ডেলিভারি। টুল: ইভেন্ট বহনের জন্য Kafka, প্রসেস করতে Flink বা Spark Streaming।",
            })}
          </p>
        </Callout>
      </div>
    </>
  );
}

// =====================================================================================
// 3. Orchestration — a DAG of tasks, run in the right order, with retries
// =====================================================================================
interface Task {
  id: string;
  deps: string[];
  col: number;
  row: number;
}
const DAG: Task[] = [
  { id: "extract_orders", deps: [], col: 0, row: 0 },
  { id: "extract_customers", deps: [], col: 0, row: 1 },
  { id: "clean_orders", deps: ["extract_orders"], col: 1, row: 0 },
  { id: "clean_customers", deps: ["extract_customers"], col: 1, row: 1 },
  { id: "quality_checks", deps: ["clean_orders", "clean_customers"], col: 2, row: 0.5 },
  { id: "build_star_schema", deps: ["quality_checks"], col: 3, row: 0.5 },
  { id: "refresh_dashboard", deps: ["build_star_schema"], col: 4, row: 0 },
  { id: "email_report", deps: ["build_star_schema"], col: 4, row: 1 },
];
type Mode = "ok" | "flaky" | "broken";
interface Seg {
  start: number;
  end: number;
  ok: boolean;
}
interface Plan {
  segs: Record<string, Seg[]>;
  blockedAt: Record<string, number>; // when a task learns its upstream failed
  end: number;
}

function plan(mode: Mode): Plan {
  const segs: Record<string, Seg[]> = {};
  const blockedAt: Record<string, number> = {};
  const done: Record<string, { at: number; ok: boolean }> = {};
  for (const task of DAG) {
    const deps = task.deps.map((d) => done[d]);
    const ready = Math.max(0, ...deps.map((d) => d.at));
    if (deps.some((d) => !d.ok)) {
      blockedAt[task.id] = ready;
      done[task.id] = { at: ready, ok: false };
      segs[task.id] = [];
      continue;
    }
    const list: Seg[] = [];
    let start = ready;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const dur = 40 + Math.round(Math.random() * 110);
      const fail = (mode === "flaky" && task.id === "quality_checks" && attempt === 1) || (mode === "broken" && task.id === "clean_customers");
      list.push({ start, end: start + dur, ok: !fail });
      if (!fail) break;
      start += dur + 30; // wait before retrying
    }
    segs[task.id] = list;
    const last = list[list.length - 1];
    done[task.id] = { at: last.end, ok: last.ok };
  }
  return { segs, blockedAt, end: Math.max(...Object.values(done).map((d) => d.at)) };
}

type Status = "queued" | "running" | "retrying" | "waiting_retry" | "success" | "failed" | "upstream_failed";
function statusAt(p: Plan, id: string, clock: number): Status {
  if (p.blockedAt[id] !== undefined) return clock >= p.blockedAt[id] ? "upstream_failed" : "queued";
  const s = p.segs[id];
  if (!s.length || clock < s[0].start) return "queued";
  for (let i = 0; i < s.length; i++) {
    if (clock < s[i].end) return clock >= s[i].start ? (i > 0 ? "retrying" : "running") : "waiting_retry";
  }
  return s[s.length - 1].ok ? "success" : "failed";
}

const STATUS_LABEL: Record<Status, T> = {
  queued: { en: "queued", bn: "অপেক্ষায়" },
  running: { en: "running", bn: "চলছে" },
  retrying: { en: "retrying", bn: "আবার চেষ্টা" },
  waiting_retry: { en: "will retry", bn: "আবার চেষ্টা করবে" },
  success: { en: "success", bn: "সফল" },
  failed: { en: "failed", bn: "ব্যর্থ" },
  upstream_failed: { en: "skipped", bn: "বাদ পড়েছে" },
};

const clockText = (s: number) => {
  const total = 2 * 3600 + Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `0${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export function Orchestration() {
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>("ok");
  const [p, setP] = useState<Plan>(() => plan("ok"));
  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  });

  const run = () => {
    setP(plan(mode));
    setClock(0);
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setClock((c) => {
        const next = c + dt * 90; // 1 real second = 90 simulated seconds
        if (next >= p.end + 5) {
          setPlaying(false);
          return p.end + 5;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, p]);

  const W = 820;
  const node = (task: Task) => ({ x: 14 + task.col * 162, y: 24 + task.row * 92 });
  const NW = 140;
  const NH = 46;
  const statuses = Object.fromEntries(DAG.map((d) => [d.id, statusAt(p, d.id, clock)])) as Record<string, Status>;
  const started = clock > 0;

  const logs: { at: number; text: string; kind: string }[] = [];
  for (const task of DAG) {
    p.segs[task.id].forEach((s, i) => {
      logs.push({ at: s.start, text: `${task.id}: ${i ? `retry ${i} started` : "started"}`, kind: "info" });
      logs.push({ at: s.end, text: `${task.id}: ${s.ok ? "succeeded" : `FAILED (attempt ${i + 1})`}`, kind: s.ok ? "ok" : "bad" });
    });
    if (p.blockedAt[task.id] !== undefined) logs.push({ at: p.blockedAt[task.id], text: `${task.id}: skipped (upstream failed)`, kind: "warn" });
  }
  const shownLogs = started ? logs.filter((l) => l.at <= clock).sort((a, b) => a.at - b.at) : [];
  const anyFailed = Object.values(statuses).includes("failed");
  const allDone = !playing && started && Object.values(statuses).every((s) => s === "success");
  const gx = (s: number) => 132 + (s / (p.end + 5)) * 380;

  return (
    <>
      <p>
        {t({
          en: "A real pipeline has many tasks that depend on each other: you can't clean data before you extract it. An orchestrator (like Apache Airflow) runs them in the right order every night, runs independent tasks at the same time, and retries a task if it fails. The diagram is called a DAG — a one-way flow chart with no loops.",
          bn: "সত্যিকারের পাইপলাইনে অনেক কাজ থাকে যারা একে অপরের ওপর নির্ভর করে: ডেটা আনার আগে পরিষ্কার করা যায় না। অর্কেস্ট্রেটর (যেমন Apache Airflow) প্রতি রাতে কাজগুলো সঠিক ক্রমে চালায়, স্বাধীন কাজগুলো একসাথে চালায়, আর কোনো কাজ ব্যর্থ হলে আবার চেষ্টা করে। এই ডায়াগ্রামকে বলে DAG — লুপ ছাড়া একমুখী একটা ফ্লো-চার্ট।",
        })}
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={run} disabled={playing}>
          ▶ {t({ en: "Trigger DAG run", bn: "DAG চালু করুন" })}
        </button>
        <div className="chips">
          {(
            [
              ["ok", { en: "✅ everything works", bn: "✅ সব ঠিক আছে" }],
              ["flaky", { en: "🔁 a flaky task (fails once)", bn: "🔁 একটা অস্থির কাজ (একবার ব্যর্থ)" }],
              ["broken", { en: "💥 a broken source", bn: "💥 একটা নষ্ট উৎস" }],
            ] as [Mode, T][]
          ).map(([m, label]) => (
            <button key={m} className={`chip-btn${mode === m ? " on" : ""}`} onClick={() => setMode(m)} disabled={playing}>
              {t(label)}
            </button>
          ))}
        </div>
        <code className="clock">🕑 {clockText(clock)}</code>
      </div>
      <div className="card">
        <div className="row spread">
          <h3 style={{ margin: 0 }}>
            <code>nightly_sales_pipeline</code>
          </h3>
          <span className="muted small">
            <code>schedule: 0 2 * * *</code> · {t({ en: "every night at 2 AM", bn: "প্রতি রাত ২টায়" })}
          </span>
        </div>
        <svg viewBox={`0 0 ${W} 190`} className="chart dag-svg">
          <defs>
            <marker id="dag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
            </marker>
          </defs>
          {DAG.flatMap((task) =>
            task.deps.map((d) => {
              const a = node(DAG.find((x) => x.id === d)!);
              const b = node(task);
              const flowing = statuses[d] === "success" && ["running", "retrying"].includes(statuses[task.id]);
              return (
                <path
                  key={d + task.id}
                  d={`M${a.x + NW},${a.y + NH / 2} C${a.x + NW + 14},${a.y + NH / 2} ${b.x - 14},${b.y + NH / 2} ${b.x - 2},${b.y + NH / 2}`}
                  className={`dag-edge${flowing ? " flowing" : ""}`}
                  markerEnd="url(#dag-arrow)"
                />
              );
            }),
          )}
          {DAG.map((task) => {
            const { x, y } = node(task);
            const s = statuses[task.id];
            return (
              <g key={task.id} transform={`translate(${x},${y})`} className={`dag-node ${s}`}>
                <rect width={NW} height={NH} rx={10} />
                <text x={10} y={19} className="dag-name">
                  {task.id}
                </text>
                <text x={10} y={36} className="dag-status">
                  ● {t(STATUS_LABEL[s])}
                  {p.segs[task.id].length > 1 && clock >= p.segs[task.id][1].start ? ` · ${p.segs[task.id].filter((sg) => sg.start <= clock).length}×` : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t({ en: "Timeline (Gantt chart)", bn: "সময়রেখা (গ্যান্ট চার্ট)" })}</h3>
          <svg viewBox={`0 0 520 ${DAG.length * 24 + 26}`} className="chart gantt">
            {DAG.map((task, i) => (
              <g key={task.id} transform={`translate(0,${i * 24})`}>
                <text x={0} y={16} className="tick">
                  {task.id}
                </text>
                <rect x={132} y={5} width={380} height={14} rx={4} fill="var(--bg2)" />
                {started &&
                  p.segs[task.id]
                    .filter((s) => s.start <= clock)
                    .map((s, k) => (
                      <rect key={k} x={gx(s.start)} y={5} width={Math.max(2, gx(Math.min(s.end, clock)) - gx(s.start))} height={14} rx={4} fill={s.end <= clock ? (s.ok ? "var(--good)" : "var(--bad)") : "var(--c1)"} />
                    ))}
              </g>
            ))}
            {started && <line x1={gx(clock)} x2={gx(clock)} y1={0} y2={DAG.length * 24} stroke="var(--c4)" strokeWidth={2} />}
            <text x={132} y={DAG.length * 24 + 18} className="tick">
              02:00
            </text>
            <text x={512} y={DAG.length * 24 + 18} textAnchor="end" className="tick">
              {clockText(p.end + 5)}
            </text>
          </svg>
          {allDone && <p className="ok-text small">✓ {t({ en: "All tasks succeeded. The dashboard is fresh for the morning!", bn: "সব কাজ সফল। সকালের জন্য ড্যাশবোর্ড তৈরি!" })}</p>}
          {anyFailed && !playing && (
            <p className="small" style={{ color: "var(--bad)", fontWeight: 600 }}>
              ✗{" "}
              {t({
                en: "A task failed 3 times, so everything after it was skipped and the on-call engineer gets an alert. The old dashboard stays — better old data than wrong data.",
                bn: "একটা কাজ ৩ বার ব্যর্থ হয়েছে, তাই এর পরের সবকিছু বাদ পড়েছে আর দায়িত্বে থাকা ইঞ্জিনিয়ারের কাছে সতর্কবার্তা গেছে। পুরোনো ড্যাশবোর্ডই থাকছে — ভুল ডেটার চেয়ে পুরোনো ডেটা ভালো।",
              })}
            </p>
          )}
        </div>
        <div className="card">
          <h3>{t({ en: "Task logs", bn: "কাজের লগ" })}</h3>
          <div className="log-box" ref={logRef}>
            {shownLogs.length ? (
              shownLogs.map((l, i) => (
                <div key={i} className={`log ${l.kind}`}>
                  <span>[{clockText(l.at)}]</span> {l.text}
                </div>
              ))
            ) : (
              <span className="muted">{t({ en: "Press “Trigger DAG run” to start.", bn: "শুরু করতে “DAG চালু করুন” চাপুন।" })}</span>
            )}
          </div>
          <p className="muted small" style={{ margin: "8px 0 0" }}>
            {t({
              en: "Notice: the two extract tasks run at the same time (they don't depend on each other), and the last two run in parallel too.",
              bn: "লক্ষ করুন: দুটো extract কাজ একসাথে চলে (এরা একে অপরের ওপর নির্ভর করে না), আর শেষের দুটোও একসাথে চলে।",
            })}
          </p>
        </div>
      </div>
    </>
  );
}
