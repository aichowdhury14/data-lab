import { useEffect, useState } from "react";
import { useLang, type T } from "../i18n";
import type { QueryResult } from "../data/db";
import { fmt } from "../components/charts";
import { Callout, DataTable, Plain } from "../components/ui";

type Rows = QueryResult["rows"];
interface Task {
  q: T;
  keywords: string[];
  think: T;
  sql: string;
  answer: (rows: Rows) => T;
}

const EID_MONTHS = ["2024-03", "2024-04", "2024-05", "2024-06", "2025-03", "2025-05", "2025-06"];

export const TASKS: Task[] = [
  {
    q: { en: "Which city has the most bank customers?", bn: "কোন শহরে ব্যাংকের গ্রাহক সবচেয়ে বেশি?" },
    keywords: ["city", "cities", "customer", "শহর", "গ্রাহক"],
    think: { en: "I need to count customers per city. The customers table has a city column, so I'll GROUP BY city and sort.", bn: "প্রতিটা শহরে কতজন গ্রাহক, সেটা গুনতে হবে। customers টেবিলে city কলাম আছে, তাই city দিয়ে GROUP BY করে সাজাব।" },
    sql: "SELECT city, COUNT(*) AS customers\nFROM customers\nGROUP BY city\nORDER BY customers DESC;",
    answer: (r) => ({
      en: `${r[0][0]} has the most customers (${r[0][1]}), followed by ${r[1][0]} (${r[1][1]}).`,
      bn: `সবচেয়ে বেশি গ্রাহক ${r[0][0]}-এ (${r[0][1]} জন), এরপর ${r[1][0]} (${r[1][1]} জন)।`,
    }),
  },
  {
    q: { en: "What was the online shop's best month?", bn: "অনলাইন শপের সবচেয়ে ভালো মাস কোনটা ছিল?" },
    keywords: ["month", "best", "sales", "shop", "revenue", "মাস", "বিক্রি", "শপ", "ভালো"],
    think: { en: "“Best” means the most revenue. Revenue = quantity × unit_price in shop_orders. I'll group by month and take the top.", bn: "“সবচেয়ে ভালো” মানে সবচেয়ে বেশি আয়। shop_orders-এ আয় = quantity × unit_price। মাস অনুযায়ী ভাগ করে সবার ওপরেরটা নেব।" },
    sql: "SELECT strftime('%Y-%m', order_date) AS month,\n       SUM(quantity * unit_price) AS revenue\nFROM shop_orders\nGROUP BY month\nORDER BY revenue DESC\nLIMIT 5;",
    answer: (r) => {
      const eid = EID_MONTHS.includes(String(r[0][0]));
      return {
        en: `The best month was ${r[0][0]} with ${fmt(r[0][1] as number)} ৳ in sales${eid ? " — that's the Eid shopping season." : "."}`,
        bn: `সবচেয়ে ভালো মাস ছিল ${r[0][0]}, বিক্রি ${fmt(r[0][1] as number)} ৳${eid ? " — এটাই ঈদের কেনাকাটার মৌসুম।" : "।"}`,
      };
    },
  },
  {
    q: { en: "Which department loses the most employees?", bn: "কোন বিভাগ থেকে সবচেয়ে বেশি কর্মী চাকরি ছাড়ে?" },
    keywords: ["department", "quit", "leave", "employee", "attrition", "বিভাগ", "চাকরি", "ছাড়", "কর্মী"],
    think: { en: "left_company is 1 when someone quit, so AVG(left_company) per department is the quit rate. I'll sort by it.", bn: "কেউ চাকরি ছাড়লে left_company হয় ১, তাই প্রতিটা বিভাগের AVG(left_company) হলো চাকরি ছাড়ার হার। সেটা দিয়ে সাজাব।" },
    sql: "SELECT department,\n       COUNT(*) AS employees,\n       ROUND(100.0 * AVG(left_company), 1) AS quit_pct\nFROM employees\nGROUP BY department\nORDER BY quit_pct DESC;",
    answer: (r) => ({
      en: `${r[0][0]} has the highest quit rate: ${r[0][2]}% of ${r[0][1]} people left. ${r[r.length - 1][0]} has the lowest (${r[r.length - 1][2]}%).`,
      bn: `সবচেয়ে বেশি চাকরি ছাড়ার হার ${r[0][0]}-এ: ${r[0][1]} জনের ${r[0][2]}% চলে গেছেন। সবচেয়ে কম ${r[r.length - 1][0]}-এ (${r[r.length - 1][2]}%)।`,
    }),
  },
  {
    q: { en: "When is Dhaka's air the worst?", bn: "ঢাকার বাতাস কখন সবচেয়ে খারাপ থাকে?" },
    keywords: ["air", "aqi", "pollution", "dhaka", "worst", "বাতাস", "বায়ু", "দূষণ", "ঢাকা"],
    think: { en: "Higher AQI = dirtier air. I'll average AQI for each month in dhaka_air and look at the top.", bn: "AQI যত বেশি, বাতাস তত দূষিত। dhaka_air-এ প্রতি মাসের গড় AQI বের করে সবার ওপরেরগুলো দেখব।" },
    sql: "SELECT month, ROUND(AVG(aqi)) AS avg_aqi\nFROM dhaka_air\nGROUP BY month\nORDER BY avg_aqi DESC\nLIMIT 3;",
    answer: (r) => ({
      en: `The worst air is in ${r[0][0]} (average AQI ${r[0][1]}), then ${r[1][0]} and ${r[2][0]}. Winter months are the most polluted.`,
      bn: `সবচেয়ে খারাপ বাতাস ${r[0][0]}-এ (গড় AQI ${r[0][1]}), এরপর ${r[1][0]} আর ${r[2][0]}। শীতের মাসগুলোতে দূষণ সবচেয়ে বেশি।`,
    }),
  },
  {
    q: { en: "Do students who study more get better scores?", bn: "যারা বেশি পড়ে তারা কি বেশি নম্বর পায়?" },
    keywords: ["study", "student", "score", "exam", "পড়", "শিক্ষার্থী", "নম্বর", "পরীক্ষা"],
    think: { en: "I'll split students into “10+ hours a week” and “under 10 hours”, then compare their average scores.", bn: "শিক্ষার্থীদের “সপ্তাহে ১০+ ঘণ্টা” আর “১০ ঘণ্টার কম” — এই দুই দলে ভাগ করে গড় নম্বর তুলনা করব।" },
    sql: "SELECT CASE WHEN study_hours_week >= 10 THEN '10+ hours' ELSE 'under 10 hours' END AS study,\n       COUNT(*) AS students,\n       ROUND(AVG(final_score), 1) AS avg_score\nFROM students\nGROUP BY study\nORDER BY avg_score DESC;",
    answer: (r) => ({
      en: `Yes. Students who study ${r[0][0]} average ${r[0][2]} marks, versus ${r[1][2]} for ${r[1][0]}.`,
      bn: `হ্যাঁ। যারা ${r[0][0] === "10+ hours" ? "সপ্তাহে ১০+ ঘণ্টা" : "১০ ঘণ্টার কম"} পড়ে তাদের গড় নম্বর ${r[0][2]}, আর অন্যদের ${r[1][2]}।`,
    }),
  },
  {
    q: { en: "What share of loans default?", bn: "কত শতাংশ ঋণ খেলাপি হয়?" },
    keywords: ["loan", "default", "ঋণ", "খেলাপি"],
    think: { en: "defaulted is 0 or 1, so its average is the default rate. One simple query on the loans table.", bn: "defaulted হয় ০ নয়তো ১, তাই এর গড়ই খেলাপির হার। loans টেবিলে একটা সহজ কোয়েরি।" },
    sql: "SELECT COUNT(*) AS loans,\n       ROUND(100.0 * AVG(defaulted), 1) AS default_pct\nFROM loans;",
    answer: (r) => ({
      en: `${r[0][1]}% of the ${r[0][0]} loans defaulted — about 1 in ${Math.round(100 / (r[0][1] as number))}.`,
      bn: `${r[0][0]}টি ঋণের ${r[0][1]}% খেলাপি হয়েছে — মোটামুটি প্রতি ${Math.round(100 / (r[0][1] as number))}টায় ১টা।`,
    }),
  },
];

/** Picks the task whose keywords best match the question (a stand-in for the LLM's understanding). */
export function route(question: string): number {
  const q = question.toLowerCase();
  let best = -1;
  let bestScore = 0;
  TASKS.forEach((task, i) => {
    const score = task.keywords.filter((k) => q.includes(k)).length;
    if (score > bestScore) [best, bestScore] = [i, score];
  });
  return best;
}

const STEPS: { ico: string; label: T }[] = [
  { ico: "🧠", label: { en: "Think", bn: "ভাবা" } },
  { ico: "🛠️", label: { en: "Use a tool", bn: "টুল ব্যবহার" } },
  { ico: "👀", label: { en: "Read the result", bn: "ফলাফল পড়া" } },
  { ico: "💬", label: { en: "Answer", bn: "উত্তর" } },
];

export function Agent() {
  const { t, lang } = useLang();
  const [question, setQuestion] = useState(TASKS[0].q[lang]);
  const [taskIdx, setTaskIdx] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ask = async (q: string) => {
    const i = route(q);
    setTaskIdx(i);
    setStep(0);
    setResult(null);
    setErr(null);
    if (i < 0) return;
    try {
      const { runQuery } = await import("../data/db");
      setResult(await runQuery(TASKS[i].sql));
    } catch (e) {
      setErr(String(e));
    }
  };

  // reveal the agent's steps one by one, like a real agent streaming its work
  useEffect(() => {
    if (taskIdx === null || taskIdx < 0 || step >= 4) return;
    const id = setTimeout(() => setStep((s) => s + 1), 900);
    return () => clearTimeout(id);
  }, [taskIdx, step]);

  const task = taskIdx !== null && taskIdx >= 0 ? TASKS[taskIdx] : null;

  return (
    <>
      <p>
        {t({
          en: "The newest trend in AI is agents: instead of only chatting, the model works in a loop — think, use a tool, read the result, then answer. Here the tool is SQL on this site's real data. Ask a question and watch each step.",
          bn: "এআই-এর সবচেয়ে নতুন ধারা হলো এজেন্ট: শুধু কথা না বলে মডেল একটা চক্রে কাজ করে — ভাবে, একটা টুল ব্যবহার করে, ফলাফল পড়ে, তারপর উত্তর দেয়। এখানে টুলটা হলো এই সাইটের আসল ডেটার ওপর SQL। একটা প্রশ্ন করুন আর প্রতিটা ধাপ দেখুন।",
        })}
      </p>
      <Plain k="agent" />
      <div className="agent-loop">
        {STEPS.map((s, i) => (
          <div key={i} className={`agent-step${task && step > i ? " done" : ""}${task && step === i ? " on" : ""}`}>
            <span>{s.ico}</span>
            {t(s.label)}
          </div>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 8 }}>
        <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(question)} style={{ flex: 1, minWidth: 220, fontSize: "1rem" }} />
        <button className="btn" onClick={() => ask(question)}>
          🤖 {t({ en: "Ask the agent", bn: "এজেন্টকে জিজ্ঞাসা করুন" })}
        </button>
      </div>
      <div className="chips" style={{ marginBottom: 14 }}>
        {TASKS.map((x, i) => (
          <button
            key={i}
            className="chip-btn"
            onClick={() => {
              setQuestion(x.q[lang]);
              ask(x.q[lang]);
            }}
          >
            {x.q[lang]}
          </button>
        ))}
      </div>

      {taskIdx === -1 && (
        <div className="agent-msg">
          <b>🤖</b>{" "}
          {t({
            en: "Sorry, I can only answer questions about this site's datasets (customers, shop orders, employees, Dhaka air, students, loans). Try one of the example questions!",
            bn: "দুঃখিত, আমি শুধু এই সাইটের ডেটাসেট নিয়ে প্রশ্নের উত্তর দিতে পারি (গ্রাহক, শপের অর্ডার, কর্মী, ঢাকার বাতাস, শিক্ষার্থী, ঋণ)। উদাহরণের প্রশ্নগুলোর একটা চেষ্টা করুন!",
          })}
        </div>
      )}
      {task && (
        <div className="agent-trace">
          {step >= 1 && (
            <div className="agent-msg">
              <small>🧠 {t({ en: "Thinking", bn: "ভাবছে" })}</small>
              <p>{t(task.think)}</p>
            </div>
          )}
          {step >= 2 && (
            <div className="agent-msg tool">
              <small>🛠️ {t({ en: "Tool call: run_sql", bn: "টুল কল: run_sql" })}</small>
              <pre>{task.sql}</pre>
            </div>
          )}
          {step >= 3 && (
            <div className="agent-msg">
              <small>👀 {t({ en: "Result from the database", bn: "ডেটাবেস থেকে ফলাফল" })}</small>
              {err && <div className="err">{err}</div>}
              {result && <DataTable columns={result.columns} rows={result.rows} max={10} />}
            </div>
          )}
          {step >= 4 && result && (
            <div className="agent-msg answer">
              <small>💬 {t({ en: "Final answer", bn: "চূড়ান্ত উত্তর" })}</small>
              <p>{t(task.answer(result.rows))}</p>
            </div>
          )}
          {step < 4 && <div className="typing">●●●</div>}
        </div>
      )}
      <Callout kind="warn" title={{ en: "What's real and what's simulated here", bn: "এখানে কোনটা আসল আর কোনটা অনুকরণ" }}>
        <p>
          {t({
            en: "The SQL really runs on the data, and the answer comes from the real result. But choosing the query is scripted: a real agent asks an LLM to write the SQL itself — which is why real agents need checks (read-only database access, query review, test questions).",
            bn: "SQL সত্যিই ডেটার ওপর চলে, আর উত্তর আসে আসল ফলাফল থেকে। কিন্তু কোন কোয়েরি চলবে সেটা আগে থেকে লেখা: সত্যিকারের এজেন্ট এলএলএমকে দিয়েই SQL লেখায় — এজন্যই আসল এজেন্টে নিরাপত্তা লাগে (শুধু পড়ার অনুমতি, কোয়েরি যাচাই, পরীক্ষার প্রশ্ন)।",
          })}
        </p>
      </Callout>
    </>
  );
}
