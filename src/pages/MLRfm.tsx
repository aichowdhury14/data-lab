import { useMemo, useState } from "react";
import { useLang, type T } from "../i18n";
import { customerById, dataset } from "../data/generate";
import { mean, sum } from "../ml/core";
import { Donut, HBars, Heatmap, Scatter, fmt } from "../components/charts";
import { Callout, Plain } from "../components/ui";

// ---- RFM maths ----------------------------------------------------------------------
const TODAY = Date.parse("2025-07-01"); // the day we do the analysis
const START = Date.parse("2024-01-01");
const DAY = 86400000;

interface Cust {
  id: number;
  name: string;
  city: string;
  orders: { t: number; value: number }[];
  recency: number; // days since last order
  frequency: number; // number of orders
  monetary: number; // total spent, BDT
  r: number;
  f: number;
  m: number;
  seg: number;
}

/** 1–5 score by rank. Equal values always get the same score. */
function quintile(values: number[], higherIsBetter: boolean): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  return values.map((v) => {
    const rank = sorted.indexOf(v); // first position of this value
    const s = Math.min(5, Math.floor((rank * 5) / n) + 1);
    return higherIsBetter ? s : 6 - s;
  });
}

export const SEGMENTS: { name: T; color: string; action: T }[] = [
  { name: { en: "Champions", bn: "চ্যাম্পিয়ন" }, color: "var(--c3)", action: { en: "Reward them: early access, VIP offers, ask for reviews.", bn: "পুরস্কৃত করুন: আগে আগে নতুন পণ্য, ভিআইপি অফার, রিভিউ চান।" } },
  { name: { en: "Loyal", bn: "অনুগত" }, color: "var(--c1)", action: { en: "Upsell higher-value products; start a loyalty programme.", bn: "দামি পণ্য অফার করুন; লয়্যালটি প্রোগ্রাম চালু করুন।" } },
  { name: { en: "Potential loyalists", bn: "সম্ভাব্য অনুগত" }, color: "var(--c6)", action: { en: "Offer a membership or a “buy 3, get 1” deal to build the habit.", bn: "মেম্বারশিপ বা “৩টা কিনলে ১টা ফ্রি” অফার দিয়ে অভ্যাস তৈরি করুন।" } },
  { name: { en: "New customers", bn: "নতুন গ্রাহক" }, color: "var(--c4)", action: { en: "Welcome them well: a thank-you message and a small coupon for order #2.", bn: "ভালোভাবে স্বাগত জানান: ধন্যবাদ বার্তা আর দ্বিতীয় অর্ডারের জন্য ছোট কুপন।" } },
  { name: { en: "Need attention", bn: "মনোযোগ দরকার" }, color: "var(--c5)", action: { en: "Send personal recommendations before they drift away.", bn: "দূরে সরে যাওয়ার আগে তাদের পছন্দমতো সাজেশন পাঠান।" } },
  { name: { en: "At risk", bn: "ঝুঁকিতে" }, color: "var(--c2)", action: { en: "They used to buy a lot but stopped. Call or send a strong win-back offer now.", bn: "আগে অনেক কিনতেন, এখন বন্ধ। এখনই ফোন দিন বা ফিরিয়ে আনার জন্য ভালো অফার পাঠান।" } },
  { name: { en: "Hibernating", bn: "ঘুমন্ত" }, color: "var(--c8)", action: { en: "Remind them with a seasonal offer (e.g. before Eid).", bn: "মৌসুমি অফার দিয়ে মনে করিয়ে দিন (যেমন ঈদের আগে)।" } },
  { name: { en: "Lost", bn: "হারিয়ে গেছেন" }, color: "var(--c7)", action: { en: "Low priority. Try one cheap campaign; don't spend much here.", bn: "কম গুরুত্ব। একটা কম খরচের ক্যাম্পেইন চালান; এখানে বেশি টাকা খরচ করবেন না।" } },
];

function segmentOf(r: number, f: number): number {
  if (r >= 4 && f >= 4) return 0;
  if (r >= 3 && f >= 4) return 1;
  if (r >= 4 && f >= 2) return 2;
  if (r >= 4) return 3;
  if (r === 3) return 4;
  if (f >= 3) return 5;
  if (r === 2) return 6;
  return 7;
}

export function buildRfm(): Cust[] {
  const by = new Map<number, { t: number; value: number }[]>();
  for (const o of dataset("shop_orders").rows) {
    const list = by.get(o.customer_id as number) ?? by.set(o.customer_id as number, []).get(o.customer_id as number)!;
    list.push({ t: Date.parse(o.order_date as string), value: (o.quantity as number) * (o.unit_price as number) });
  }
  const base = [...by].map(([id, orders]) => {
    const c = customerById.get(id)!;
    return {
      id,
      name: c.name as string,
      city: c.city as string,
      orders,
      recency: Math.round((TODAY - Math.max(...orders.map((o) => o.t))) / DAY),
      frequency: orders.length,
      monetary: sum(orders.map((o) => o.value)),
    };
  });
  const R = quintile(base.map((c) => c.recency), false);
  const F = quintile(base.map((c) => c.frequency), true);
  const M = quintile(base.map((c) => c.monetary), true);
  return base.map((c, i) => ({ ...c, r: R[i], f: F[i], m: M[i], seg: segmentOf(R[i], F[i]) }));
}

const RFM_SQL = `WITH per_customer AS (
  SELECT customer_id,
         julianday('2025-07-01') - julianday(MAX(order_date)) AS recency_days,
         COUNT(*)                     AS frequency,
         SUM(quantity * unit_price)   AS monetary
  FROM shop_orders
  GROUP BY customer_id
)
SELECT customer_id, recency_days, frequency, monetary,
       NTILE(5) OVER (ORDER BY recency_days DESC) AS r_score,
       NTILE(5) OVER (ORDER BY frequency)         AS f_score,
       NTILE(5) OVER (ORDER BY monetary)          AS m_score
FROM per_customer
ORDER BY r_score DESC, f_score DESC;`;

function Score({ v }: { v: number }) {
  return (
    <span className="score-dots" aria-label={`${v} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= v ? "on" : ""} />
      ))}
    </span>
  );
}

function Timeline({ c }: { c: Cust }) {
  const { t } = useLang();
  const W = 640;
  const H = 86;
  const x = (ts: number) => 16 + ((ts - START) / (TODAY - START)) * (W - 32);
  const last = Math.max(...c.orders.map((o) => o.t));
  const maxV = Math.max(...c.orders.map((o) => o.value));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart timeline-svg">
      <line x1={16} x2={W - 16} y1={44} y2={44} stroke="var(--line)" strokeWidth={3} strokeLinecap="round" />
      {["2024-01-01", "2024-07-01", "2025-01-01", "2025-07-01"].map((d, i, all) => (
        <text key={d} x={x(Date.parse(d))} y={80} textAnchor={i === 0 ? "start" : i === all.length - 1 ? "end" : "middle"} className="tick">
          {d.slice(0, 7)}
        </text>
      ))}
      <path d={`M${x(last)},22 L${x(last)},16 L${x(TODAY)},16 L${x(TODAY)},22`} fill="none" stroke="var(--c2)" strokeWidth={1.5} />
      <text x={(x(last) + x(TODAY)) / 2} y={11} textAnchor="middle" className="tick" style={{ fill: "var(--c2)" }}>
        R = {c.recency} {t({ en: "days", bn: "দিন" })}
      </text>
      {c.orders.map((o, i) => (
        <circle key={i} cx={x(o.t)} cy={44} r={4 + (o.value / maxV) * 6} fill="var(--c1)" opacity={0.75}>
          <title>{`${new Date(o.t).toISOString().slice(0, 10)} · ${fmt(o.value)} ৳`}</title>
        </circle>
      ))}
      <line x1={x(TODAY)} x2={x(TODAY)} y1={28} y2={60} stroke="var(--c2)" strokeWidth={2} strokeDasharray="3 3" />
      <text x={x(TODAY) - 4} y={64} textAnchor="end" className="tick" style={{ fill: "var(--c2)" }}>
        {t({ en: "today", bn: "আজ" })}
      </text>
    </svg>
  );
}

export function RFM() {
  const { t } = useLang();
  const custs = useMemo(buildRfm, []);
  const [sel, setSel] = useState(() => custs.find((c) => c.seg === 0)?.id ?? custs[0].id);
  const c = custs.find((x) => x.id === sel)!;
  const totalRev = sum(custs.map((x) => x.monetary));
  const segStats = SEGMENTS.map((s, i) => {
    const m = custs.filter((x) => x.seg === i);
    return {
      i,
      s,
      n: m.length,
      rev: sum(m.map((x) => x.monetary)),
      rec: m.length ? mean(m.map((x) => x.recency)) : 0,
      freq: m.length ? mean(m.map((x) => x.frequency)) : 0,
      mon: m.length ? mean(m.map((x) => x.monetary)) : 0,
    };
  }).filter((x) => x.n > 0);
  const grid = [5, 4, 3, 2, 1].map((r) => [1, 2, 3, 4, 5].map((f) => custs.filter((x) => x.r === r && x.f === f).length));
  const champsShare = (segStats.find((x) => x.i === 0)?.rev ?? 0) / totalRev;
  const champsCount = (segStats.find((x) => x.i === 0)?.n ?? 0) / custs.length;

  return (
    <>
      <p>
        {t({
          en: "Not every customer is equal. RFM is a simple, very popular way for shops to sort customers by asking three questions about their shopping history. No complex maths — just counting and sorting. We use the online-shop orders (Jan 2024 – Jun 2025) and pretend today is 1 July 2025.",
          bn: "সব গ্রাহক সমান নন। RFM হলো দোকানগুলোর খুব জনপ্রিয় আর সহজ একটা উপায়, যেখানে কেনাকাটার ইতিহাস নিয়ে তিনটা প্রশ্ন করে গ্রাহকদের ভাগ করা হয়। কোনো জটিল অঙ্ক নেই — শুধু গোনা আর সাজানো। আমরা অনলাইন শপের অর্ডার (জানুয়ারি ২০২৪ – জুন ২০২৫) ব্যবহার করছি, আর ধরে নিচ্ছি আজ ১ জুলাই ২০২৫।",
        })}
      </p>
      <Plain k="rfm" />
      <div className="grid cols3">
        {[
          ["⏱️", "R · Recency", { en: "How recently did they buy?", bn: "শেষ কবে কিনেছেন?" }, { en: "Days since the last order. Fewer days = better score.", bn: "শেষ অর্ডারের পর কত দিন গেছে। যত কম দিন, তত ভালো স্কোর।" }],
          ["🔁", "F · Frequency", { en: "How often do they buy?", bn: "কত ঘন ঘন কেনেন?" }, { en: "Number of orders. More orders = better score.", bn: "মোট অর্ডারের সংখ্যা। যত বেশি অর্ডার, তত ভালো স্কোর।" }],
          ["💰", "M · Monetary", { en: "How much do they spend?", bn: "কত টাকা খরচ করেন?" }, { en: "Total money spent. More money = better score.", bn: "মোট কত টাকা খরচ করেছেন। যত বেশি টাকা, তত ভালো স্কোর।" }],
        ].map(([ico, name, q, d]) => (
          <div key={name as string} className="card rfm-card">
            <span className="big-ico">{ico as string}</span>
            <b>{name as string}</b>
            <p style={{ margin: "0.2rem 0" }}>{t(q as T)}</p>
            <p className="muted small" style={{ margin: 0 }}>
              {t(d as T)}
            </p>
          </div>
        ))}
      </div>
      <p className="muted small">
        {t({
          en: "Each customer gets a score from 1 to 5 for each letter: we line everyone up and split the line into five equal groups. Top 20% get a 5, bottom 20% get a 1.",
          bn: "প্রতিটা অক্ষরের জন্য প্রত্যেক গ্রাহক ১ থেকে ৫ পর্যন্ত একটা স্কোর পান: সবাইকে লাইনে দাঁড় করিয়ে লাইনটাকে সমান পাঁচ ভাগে ভাগ করা হয়। ওপরের ২০% পান ৫, নিচের ২০% পান ১।",
        })}
      </p>

      <div className="card" style={{ marginTop: 8 }}>
        <div className="row spread">
          <h3 style={{ margin: 0 }}>{t({ en: "Look at one customer", bn: "একজন গ্রাহককে দেখুন" })}</h3>
          <div className="row">
            <select value={sel} onChange={(e) => setSel(Number(e.target.value))}>
              {custs.map((x) => (
                <option key={x.id} value={x.id}>
                  #{x.id} {x.name} — {t(SEGMENTS[x.seg].name)}
                </option>
              ))}
            </select>
            <button className="btn ghost" onClick={() => setSel(custs[Math.floor(Math.random() * custs.length)].id)}>
              🎲 {t({ en: "Random", bn: "এলোমেলো" })}
            </button>
          </div>
        </div>
        <Timeline c={c} />
        <div className="grid cols3" style={{ gap: 10 }}>
          <div className="stat">
            <span>⏱️ {t({ en: "Recency", bn: "রিসেন্সি" })}</span>
            <b>
              {c.recency} {t({ en: "days ago", bn: "দিন আগে" })}
            </b>
            <Score v={c.r} />
          </div>
          <div className="stat">
            <span>🔁 {t({ en: "Frequency", bn: "ফ্রিকোয়েন্সি" })}</span>
            <b>
              {c.frequency} {t({ en: c.frequency === 1 ? "order" : "orders", bn: "টি অর্ডার" })}
            </b>
            <Score v={c.f} />
          </div>
          <div className="stat">
            <span>💰 {t({ en: "Monetary", bn: "মনিটারি" })}</span>
            <b>{fmt(c.monetary)} ৳</b>
            <Score v={c.m} />
          </div>
        </div>
        <div className="seg-result" style={{ ["--seg" as string]: SEGMENTS[c.seg].color }}>
          <span className="seg-pill">{t(SEGMENTS[c.seg].name)}</span>
          <span>
            <b>{t({ en: "What to do:", bn: "কী করবেন:" })}</b> {t(SEGMENTS[c.seg].action)}
          </span>
        </div>
      </div>

      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t({ en: "How many customers in each segment?", bn: "কোন ভাগে কতজন গ্রাহক?" })}</h3>
          <HBars items={segStats.map((x) => ({ label: t(x.s.name), value: x.n, color: x.s.color }))} format={(v) => String(v)} />
          <h3 style={{ marginTop: 14 }}>{t({ en: "Who brings the money?", bn: "টাকা আসে কাদের কাছ থেকে?" })}</h3>
          <Donut items={segStats.map((x) => ({ label: t(x.s.name), value: x.rev }))} size={190} center={fmt(totalRev) + " ৳"} />
          <Callout kind="idea" title={{ en: "The 80/20 rule in action", bn: "৮০/২০ নিয়ম চোখের সামনে" }}>
            <p>
              {t({
                en: `Champions are only ${(champsCount * 100).toFixed(0)}% of customers but bring ${(champsShare * 100).toFixed(0)}% of all revenue. Losing one of them hurts far more than losing a “Lost” customer.`,
                bn: `চ্যাম্পিয়নরা মোট গ্রাহকের মাত্র ${(champsCount * 100).toFixed(0)}%, কিন্তু মোট আয়ের ${(champsShare * 100).toFixed(0)}% আনেন। এদের একজনকে হারানো একজন “হারিয়ে যাওয়া” গ্রাহককে হারানোর চেয়ে অনেক বেশি ক্ষতির।`,
              })}
            </p>
          </Callout>
        </div>
        <div className="card">
          <h3>{t({ en: "The RFM map: Recency × Frequency", bn: "RFM মানচিত্র: রিসেন্সি × ফ্রিকোয়েন্সি" })}</h3>
          <Heatmap rows={["R=5", "R=4", "R=3", "R=2", "R=1"]} cols={["F=1", "F=2", "F=3", "F=4", "F=5"]} values={grid} format={(v) => String(v)} cell={62} />
          <p className="muted small">
            {t({
              en: "Each box = number of customers. Top-right (bought recently AND often) are your Champions. Bottom-right (used to buy often, but not lately) are At risk — act fast!",
              bn: "প্রতিটা ঘর = কতজন গ্রাহক। ওপরে-ডানে (সম্প্রতি কিনেছেন এবং ঘন ঘন কেনেন) আপনার চ্যাম্পিয়ন। নিচে-ডানে (আগে ঘন ঘন কিনতেন, ইদানীং না) ঝুঁকিতে — দ্রুত ব্যবস্থা নিন!",
            })}
          </p>
          <h3>{t({ en: "Orders vs money spent", bn: "অর্ডার বনাম খরচ" })}</h3>
          <Scatter
            points={custs.map((x) => ({ x: x.frequency, y: x.monetary / 1000, c: [2, 0, 5, 3, 4, 1, 7, 6][x.seg], r: x.id === sel ? 7 : 3.6 }))}
            xLabel={t({ en: "number of orders", bn: "অর্ডারের সংখ্যা" })}
            yLabel={t({ en: "total spent (thousand ৳)", bn: "মোট খরচ (হাজার ৳)" })}
            h={260}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t({ en: "Segment summary & action plan", bn: "ভাগের সারাংশ ও কর্মপরিকল্পনা" })}</h3>
        <div className="table-wrap" style={{ maxHeight: "none" }}>
          <table>
            <thead>
              <tr>
                <th>{t({ en: "segment", bn: "ভাগ" })}</th>
                <th>{t({ en: "customers", bn: "গ্রাহক" })}</th>
                <th>{t({ en: "last order (avg days)", bn: "শেষ অর্ডার (গড় দিন)" })}</th>
                <th>{t({ en: "orders (avg)", bn: "অর্ডার (গড়)" })}</th>
                <th>{t({ en: "spent (avg ৳)", bn: "খরচ (গড় ৳)" })}</th>
                <th>{t({ en: "share of revenue", bn: "আয়ের ভাগ" })}</th>
                <th>{t({ en: "what to do", bn: "কী করবেন" })}</th>
              </tr>
            </thead>
            <tbody>
              {segStats.map((x) => (
                <tr key={x.i}>
                  <td>
                    <span className="seg-dot" style={{ background: x.s.color }} /> {t(x.s.name)}
                  </td>
                  <td className="num">{x.n}</td>
                  <td className="num">{x.rec.toFixed(0)}</td>
                  <td className="num">{x.freq.toFixed(1)}</td>
                  <td className="num">{fmt(x.mon)}</td>
                  <td className="num">{((x.rev / totalRev) * 100).toFixed(1)}%</td>
                  <td style={{ whiteSpace: "normal", minWidth: 260 }}>{t(x.s.action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t({ en: "The same thing in SQL", bn: "একই কাজ SQL-এ" })}</h3>
          <pre className="prompt-box">{RFM_SQL}</pre>
          <p className="muted small" style={{ margin: 0 }}>
            {t({ en: "Copy this into the SQL page's Free playground and press Run. NTILE(5) splits people into five equal groups.", bn: "এটা কপি করে SQL পাতার ফ্রি প্লেগ্রাউন্ডে বসিয়ে Run চাপুন। NTILE(5) মানুষকে সমান পাঁচ ভাগে ভাগ করে।" })}
          </p>
        </div>
        <Callout kind="tip" title={{ en: "RFM or K-means?", bn: "RFM নাকি K-means?" }}>
          <p>
            {t({
              en: "RFM uses simple rules that anyone in marketing can understand and explain. K-means (also on this page) finds groups automatically, but the groups have no names. Many companies start with RFM, then try clustering later.",
              bn: "RFM সহজ নিয়ম ব্যবহার করে, যা মার্কেটিংয়ের যে কেউ বুঝতে ও বোঝাতে পারেন। K-means (এই পাতাতেই আছে) নিজে থেকে দল খোঁজে, কিন্তু দলগুলোর কোনো নাম থাকে না। অনেক কোম্পানি আগে RFM দিয়ে শুরু করে, পরে ক্লাস্টারিং চেষ্টা করে।",
            })}
          </p>
          <p>
            {t({ en: "Used by: e-commerce, supermarkets, mobile operators, banks — anyone with repeat customers.", bn: "কারা ব্যবহার করে: ই-কমার্স, সুপারশপ, মোবাইল অপারেটর, ব্যাংক — যাদেরই বারবার আসা গ্রাহক আছে।" })}
          </p>
        </Callout>
      </div>
    </>
  );
}
