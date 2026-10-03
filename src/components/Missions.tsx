import { useMemo, useState, type ReactNode } from "react";
import { useLang, type T } from "../i18n";
import { dataset } from "../data/generate";
import { mean, pearson } from "../ml/core";
import { digits } from "../numerals";

// ---------------------------------------------------------------------------------------
// ML missions: "move the controls until …", checked against the real model numbers.
// ---------------------------------------------------------------------------------------
export interface MissionResult {
  ok: boolean;
  msg: T;
}

export function Mission({ title, goal, evaluate, children }: { title: T; goal: T; evaluate: () => MissionResult; children?: ReactNode }) {
  const { t } = useLang();
  const [res, setRes] = useState<MissionResult | null>(null);
  return (
    <div className={`mission${res?.ok ? " done" : ""}`}>
      <div className="mission-head">
        <span className="mission-ico">🎯</span>
        <div>
          <b>{t(title)}</b>
          <p>{t(goal)}</p>
        </div>
      </div>
      {children}
      <div className="row">
        <button className="btn" onClick={() => setRes(evaluate())}>
          ✓ {t({ en: "Check my setting", bn: "আমার সেটিং যাচাই করুন" })}
        </button>
        {res && <span className={`check-msg ${res.ok ? "ok" : "no"}`}>{digits(t(res.msg))}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Analysis: "find it in the data" — answers are computed from the datasets at runtime.
// ---------------------------------------------------------------------------------------
interface DQ {
  q: T;
  where: T;
  options: T[];
  answer: number;
  why: T;
}

const MONTH_BN: Record<string, string> = { Jan: "জানুয়ারি", Feb: "ফেব্রুয়ারি", Mar: "মার্চ", Apr: "এপ্রিল", May: "মে", Jun: "জুন", Jul: "জুলাই", Aug: "আগস্ট", Sep: "সেপ্টেম্বর", Oct: "অক্টোবর", Nov: "নভেম্বর", Dec: "ডিসেম্বর" };
const CITY_BN: Record<string, string> = { Dhaka: "ঢাকা", Chattogram: "চট্টগ্রাম", Khulna: "খুলনা", Rajshahi: "রাজশাহী", Sylhet: "সিলেট" };
const DEPT_BN: Record<string, string> = { Sales: "সেলস", IT: "আইটি", Finance: "ফাইন্যান্স", HR: "এইচআর", Operations: "অপারেশনস" };

function groupAvg(id: string, key: string, val: string) {
  const m = new Map<string, number[]>();
  for (const r of dataset(id).rows) (m.get(String(r[key])) ?? m.set(String(r[key]), []).get(String(r[key]))!).push(r[val] as number);
  return [...m].map(([k, v]) => ({ k, v: mean(v) }));
}
const argmax = <X,>(xs: X[], f: (x: X) => number) => xs.reduce((a, b) => (f(b) > f(a) ? b : a));

function buildQuestions(): DQ[] {
  const city = groupAvg("customers", "city", "monthly_income");
  const topCity = argmax(city, (c) => c.v);
  const air = groupAvg("dhaka_air", "month", "aqi");
  const worst = argmax(air, (a) => a.v);
  const airOpts = [worst.k, ...["Jul", "Apr", "Oct", "Sep"].filter((m) => m !== worst.k).slice(0, 3)];
  const dept = groupAvg("employees", "department", "left_company");
  const topDept = argmax(dept, (d) => d.v);
  const st = dataset("students").rows;
  const r = pearson(st.map((s) => s.study_hours_week as number), st.map((s) => s.final_score as number));
  const buckets = [0, 0.4, 0.8, -0.8];
  const loans = dataset("loans").rows;
  const rate = mean(loans.map((l) => l.defaulted as number));
  const rates = [0.05, 0.2, 0.4, 0.6];
  const nearest = (xs: number[], v: number) => xs.indexOf(argmax(xs, (x) => -Math.abs(x - v)));
  return [
    {
      q: { en: "Which city's customers earn the most on average?", bn: "কোন শহরের গ্রাহকদের গড় আয় সবচেয়ে বেশি?" },
      where: { en: "Dataset “Customers” → tab 3 · Compare groups → group by city, measure monthly_income, summary avg.", bn: "ডেটাসেট “গ্রাহক” → ৩ নম্বর ট্যাব · গ্রুপ তুলনা → city দিয়ে গ্রুপ, monthly_income পরিমাপ, avg সারাংশ।" },
      options: city.map((c) => ({ en: c.k, bn: CITY_BN[c.k] ?? c.k })),
      answer: city.indexOf(topCity),
      why: { en: `${topCity.k}: average income ${Math.round(topCity.v).toLocaleString("en-US")} ৳ a month.`, bn: `${CITY_BN[topCity.k] ?? topCity.k}: গড় মাসিক আয় ${Math.round(topCity.v).toLocaleString("en-US")} ৳।` },
    },
    {
      q: { en: "In which month was Dhaka's air the worst on average?", bn: "গড়ে কোন মাসে ঢাকার বাতাস সবচেয়ে খারাপ ছিল?" },
      where: { en: "Dataset “Dhaka air quality” → tab 3 · Compare groups → group by month, measure aqi, summary avg.", bn: "ডেটাসেট “ঢাকার বায়ুমান” → ৩ নম্বর ট্যাব → month দিয়ে গ্রুপ, aqi পরিমাপ, avg সারাংশ।" },
      options: airOpts.map((m) => ({ en: m, bn: MONTH_BN[m] ?? m })),
      answer: 0,
      why: { en: `${worst.k}: average AQI ${Math.round(worst.v)} — winter traps smoke and dust near the ground.`, bn: `${MONTH_BN[worst.k] ?? worst.k}: গড় AQI ${Math.round(worst.v)} — শীতে ধোঁয়া আর ধুলো মাটির কাছে আটকে থাকে।` },
    },
    {
      q: { en: "Which department loses the biggest share of its people?", bn: "কোন বিভাগ থেকে সবচেয়ে বেশি অনুপাতে মানুষ চাকরি ছাড়ে?" },
      where: { en: "Dataset “Employees” → tab 3 · Compare groups → group by department, measure left_company, summary avg.", bn: "ডেটাসেট “কর্মী” → ৩ নম্বর ট্যাব → department দিয়ে গ্রুপ, left_company পরিমাপ, avg সারাংশ।" },
      options: dept.map((d) => ({ en: d.k, bn: DEPT_BN[d.k] ?? d.k })),
      answer: dept.indexOf(topDept),
      why: { en: `${topDept.k}: ${(topDept.v * 100).toFixed(1)}% quit. (The average of a 0/1 column is a percentage.)`, bn: `${DEPT_BN[topDept.k] ?? topDept.k}: ${(topDept.v * 100).toFixed(1)}% চাকরি ছেড়েছেন। (০/১ কলামের গড় মানেই শতাংশ।)` },
    },
    {
      q: { en: "How strongly are study hours and exam score related?", bn: "পড়ার ঘণ্টা আর পরীক্ষার নম্বর কতটা জোরালোভাবে সম্পর্কিত?" },
      where: { en: "Dataset “Students” → tab 4 · Relationships → X = study_hours_week, Y = final_score.", bn: "ডেটাসেট “শিক্ষার্থী” → ৪ নম্বর ট্যাব · সম্পর্ক → X = study_hours_week, Y = final_score।" },
      options: [
        { en: "No relationship (r ≈ 0)", bn: "কোনো সম্পর্ক নেই (r ≈ ০)" },
        { en: "Weak–moderate (r ≈ 0.4)", bn: "দুর্বল–মাঝারি (r ≈ ০.৪)" },
        { en: "Strong positive (r ≈ 0.8)", bn: "জোরালো ধনাত্মক (r ≈ ০.৮)" },
        { en: "Strong negative (r ≈ −0.8)", bn: "জোরালো ঋণাত্মক (r ≈ −০.৮)" },
      ],
      answer: nearest(buckets, r),
      why: { en: `r = ${r.toFixed(2)}: more study hours go with higher scores, quite reliably.`, bn: `r = ${r.toFixed(2)}: বেশি পড়ার ঘণ্টার সাথে নম্বরও বেশি, বেশ নিয়মিতভাবে।` },
    },
    {
      q: { en: "Roughly what share of loans end in default?", bn: "মোটামুটি কত শতাংশ ঋণ খেলাপি হয়?" },
      where: { en: "Dataset “Loans” → tab 2 · How is it spread? → column defaulted (look at the mean).", bn: "ডেটাসেট “ঋণ” → ২ নম্বর ট্যাব · কেমন ছড়ানো → defaulted কলাম (গড় দেখুন)।" },
      options: rates.map((x) => ({ en: `about ${x * 100}%`, bn: `প্রায় ${x * 100}%` })),
      answer: nearest(rates, rate),
      why: { en: `${(rate * 100).toFixed(1)}% of the ${loans.length} loans defaulted — about 1 in 5.`, bn: `${loans.length}টি ঋণের ${(rate * 100).toFixed(1)}% খেলাপি — মোটামুটি প্রতি ৫টায় ১টা।` },
    },
  ];
}

export function DataQuestions() {
  const { t } = useLang();
  const qs = useMemo(buildQuestions, []);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = qs[i];
  const finished = i >= qs.length;
  const choose = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    if (k === q.answer) setScore((s) => s + 1);
  };
  return (
    <section className="card data-q">
      <div className="row spread">
        <h3 style={{ margin: 0 }}>🎯 {t({ en: "Find it in the data", bn: "ডেটায় খুঁজে বের করুন" })}</h3>
        <span className="badge">{digits(`${Math.min(i + (picked !== null ? 1 : 0), qs.length)} / ${qs.length}`)}</span>
      </div>
      {finished ? (
        <div style={{ marginTop: 10 }}>
          <p className="check-msg ok">
            {digits(t({ en: `🏁 Done! You got ${score} of ${qs.length} right.`, bn: `🏁 শেষ! ${qs.length}টার মধ্যে ${score}টা ঠিক।` }))}
          </p>
          <button
            className="btn ghost"
            style={{ marginTop: 8 }}
            onClick={() => {
              setI(0);
              setPicked(null);
              setScore(0);
            }}
          >
            ↺ {t({ en: "Start again", bn: "আবার শুরু" })}
          </button>
        </div>
      ) : (
        <>
          <p className="dq-q">{t(q.q)}</p>
          <p className="muted small" style={{ marginTop: 0 }}>
            🧭 {t({ en: "Where to look:", bn: "কোথায় দেখবেন:" })} {t(q.where)}
          </p>
          <div className="quiz-opts">
            {q.options.map((o, k) => {
              const state = picked === null ? "" : k === q.answer ? "right" : picked === k ? "wrong" : "";
              return (
                <button key={k} className={`quiz-opt ${state}`} disabled={picked !== null} onClick={() => choose(k)}>
                  {state === "right" ? "✓ " : state === "wrong" ? "✗ " : ""}
                  {digits(t(o))}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <>
              <p className={`quiz-why ${picked === q.answer ? "ok" : "no"}`}>{digits(t(q.why))}</p>
              <button
                className="btn"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setI(i + 1);
                  setPicked(null);
                }}
              >
                {i < qs.length - 1 ? t({ en: "Next question", bn: "পরের প্রশ্ন" }) : t({ en: "See my score", bn: "আমার স্কোর দেখুন" })} →
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
