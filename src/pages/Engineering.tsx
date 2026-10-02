import { useEffect, useMemo, useState } from "react";
import { useLang, type T } from "../i18n";
import { GOLD_SQL, LOAD_SETUP, RAW, STEPS, qualityChecks, runUpTo } from "../data/pipeline";
import { sandboxQuery, type QueryResult } from "../data/db";
import { Callout, DataTable, PageHead, Plain, Tabs } from "../components/ui";
import { Quiz } from "../components/Quiz";
import { Bars } from "../components/charts";
import { useMark } from "../progress";
import { Orchestration, StarSchema, Streaming } from "./EngMore";

const STEP_ICONS = ["📥", "🔤", "💰", "📅", "🧹", "🛡️", "🗄️"];

type Tab = "pipeline" | "star" | "stream" | "dag" | "concepts";
const COLS = ["txn_id", "customer", "city", "amount", "date", "channel"];
const PLAIN_KEY: Partial<Record<Tab, string>> = { pipeline: "eng-pipeline", star: "eng-star", stream: "eng-stream", dag: "eng-dag" };

export default function Engineering() {
  const [tab, setTab] = useState<Tab>("pipeline");
  useMark("engineering", tab === "pipeline" || tab === "concepts" ? null : `lab-${tab}`);
  return (
    <>
      <PageHead
        title={{ en: "Data Engineering", bn: "ডেটা ইঞ্জিনিয়ারিং" }}
        sub={{
          en: "Real data is messy: extra spaces, wrong dates, the same row twice. Data engineers build the “pipes” that clean it, organise it and deliver it on time, so everyone else can trust the numbers. Try the four labs below, in order.",
          bn: "আসল ডেটা এলোমেলো হয়: বাড়তি স্পেস, ভুল তারিখ, একই সারি দুবার। ডেটা ইঞ্জিনিয়াররা এমন “পাইপ” বানান যা ডেটা পরিষ্কার করে, গুছিয়ে রাখে আর সময়মতো পৌঁছে দেয়, যাতে সবাই সংখ্যাগুলো বিশ্বাস করতে পারে। নিচের চারটা ল্যাব ক্রম অনুযায়ী করে দেখুন।",
        }}
        art="engineering"
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "pipeline", label: { en: "1 · Clean data (ETL)", bn: "১ · ডেটা পরিষ্কার (ETL)" } },
          { id: "star", label: { en: "2 · Model data (star schema)", bn: "২ · ডেটা সাজানো (স্টার স্কিমা)" } },
          { id: "stream", label: { en: "3 · Live data (streaming)", bn: "৩ · লাইভ ডেটা (স্ট্রিমিং)" } },
          { id: "dag", label: { en: "4 · Schedule it (orchestration)", bn: "৪ · সময়মতো চালানো (অর্কেস্ট্রেশন)" } },
          { id: "concepts", label: { en: "Key ideas", bn: "মূল ধারণা" } },
        ]}
      />
      {PLAIN_KEY[tab] && <Plain k={PLAIN_KEY[tab]} />}
      {tab === "pipeline" && <Pipeline />}
      {tab === "star" && <StarSchema />}
      {tab === "stream" && <Streaming />}
      {tab === "dag" && <Orchestration />}
      {tab === "concepts" && <Concepts />}
      <Quiz id="engineering" />
    </>
  );
}

function Pipeline() {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const last = STEPS.length; // index of the "load" pseudo-step
  const before = useMemo(() => runUpTo(Math.max(step - 1, 0)), [step]);
  const after = useMemo(() => runUpTo(Math.min(step, last - 1)), [step, last]);
  const final = useMemo(() => runUpTo(last - 1), [last]);
  const counts = useMemo(() => STEPS.map((_, i) => runUpTo(i).rows.length), []);
  useMark("engineering", String(step));

  return (
    <>
      <div className="flow">
        {[...STEPS.map((s) => s.title), { en: "Load", bn: "লোড" }].map((title, i) => (
          <button key={i} className={`flow-step ${step === i ? "on" : i < step ? "done" : ""}`} onClick={() => setStep(i)}>
            <span className="flow-ico">{STEP_ICONS[i]}</span>
            <span className="flow-title">{t(title)}</span>
            <span className="flow-count">
              {i < last ? counts[i] : counts[last - 1]} {t({ en: "rows", bn: "সারি" })}
            </span>
          </button>
        ))}
      </div>
      <div className="flow-bar">
        <div style={{ width: `${(step / last) * 100}%` }} />
      </div>

      {step < last ? (
        <>
          <p>{t(STEPS[step].why)}</p>
          <pre className="card" style={{ overflow: "auto", margin: "0 0 16px" }}>
            {STEPS[step].code}
          </pre>
          <div className="grid cols2">
            <div>
              <h3>{step === 0 ? t({ en: "Raw input", bn: "কাঁচা ইনপুট" }) : t({ en: "Before", bn: "আগে" })}</h3>
              <DataTable columns={COLS} rows={(step === 0 ? RAW : before.rows).map((r) => COLS.map((c) => r[c]))} />
            </div>
            {step > 0 && (
              <div>
                <h3>
                  {t({ en: "After", bn: "পরে" })}{" "}
                  <span className="muted small">
                    ({before.rows.length} → {after.rows.length} {t({ en: "rows", bn: "সারি" })})
                  </span>
                </h3>
                <DataTable columns={COLS} rows={after.rows.map((r) => COLS.map((c) => r[c]))} />
              </div>
            )}
          </div>
          {after.rejected.length > 0 && (
            <>
              <h3 style={{ marginTop: 20 }}>{t({ en: "Rejected (quarantine)", bn: "বাতিল (কোয়ারেন্টাইন)" })}</h3>
              <DataTable columns={[...COLS, "reason"]} rows={after.rejected.map((r) => [...COLS.map((c) => r[c]), r.reason])} />
            </>
          )}
          <Checks state={step === 0 ? { rows: RAW, rejected: [] } : after} />
        </>
      ) : (
        <Load rows={final.rows} />
      )}

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ← {t({ en: "Back", bn: "পেছনে" })}
        </button>
        <button className="btn" disabled={step === last} onClick={() => setStep(step + 1)}>
          {t({ en: "Next step", bn: "পরের ধাপ" })} →
        </button>
      </div>
    </>
  );
}

function Checks({ state }: { state: ReturnType<typeof runUpTo> }) {
  const { t } = useLang();
  const checks = qualityChecks(state);
  const failing = checks.filter((c) => !c.pass).length;
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3>
        {t({ en: "Data quality checks on this stage", bn: "এই ধাপের ডেটা কোয়ালিটি চেক" })}{" "}
        <span className="badge" style={failing ? { background: "color-mix(in srgb, var(--bad) 15%, var(--bg))", color: "var(--bad)" } : undefined}>
          {failing ? t({ en: `${failing} failing`, bn: `${failing}টি ব্যর্থ` }) : t({ en: "all pass", bn: "সব পাস" })}
        </span>
      </h3>
      {checks.map((c, i) => (
        <div key={i} className="check">
          <span className={c.pass ? "ok" : "no"}>{c.pass ? "✓" : "✗"}</span>
          <span>{t(c.name)}</span>
          <span className="muted small">{c.detail}</span>
        </div>
      ))}
    </div>
  );
}

function Load({ rows }: { rows: ReturnType<typeof runUpTo>["rows"] }) {
  const { t } = useLang();
  const [res, setRes] = useState<QueryResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const setup = useMemo(() => LOAD_SETUP(rows), [rows]);
  useEffect(() => {
    sandboxQuery(setup, GOLD_SQL).then(setRes, (e) => setErr(String(e)));
  }, [setup]);
  return (
    <>
      <p>
        {t({
          en: "Finally, load the clean rows into a database table. A PRIMARY KEY on txn_id means a re-run can never insert the same transaction twice (that property is called idempotency). Then analysts query the 'gold' summary below with plain SQL.",
          bn: "সবশেষে পরিষ্কার সারিগুলো ডেটাবেস টেবিলে লোড করুন। txn_id-তে PRIMARY KEY থাকায় পুনরায় চালালেও একই লেনদেন দুবার ঢুকবে না (এই গুণকে বলে আইডেম্পটেন্সি)। এরপর বিশ্লেষকেরা নিচের ‘গোল্ড’ সারাংশ সাধারণ SQL দিয়ে কোয়েরি করেন।",
        })}
      </p>
      <div className="grid cols2">
        <div>
          <h3>{t({ en: "Load (SQL)", bn: "লোড (SQL)" })}</h3>
          <pre className="card" style={{ overflow: "auto", maxHeight: 280, margin: 0 }}>
            {setup.split("\n").slice(0, 4).join("\n") + "\n…"}
          </pre>
          <h3 style={{ marginTop: 16 }}>{t({ en: "Gold query", bn: "গোল্ড কোয়েরি" })}</h3>
          <pre className="card" style={{ margin: 0 }}>
            {GOLD_SQL}
          </pre>
        </div>
        <div>
          <h3>{t({ en: "Result", bn: "ফলাফল" })}</h3>
          {err && <div className="err">{err}</div>}
          {res && <DataTable columns={res.columns} rows={res.rows} />}
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t({ en: "Rows surviving each stage", bn: "প্রতিটি ধাপে টিকে থাকা সারি" })}</h3>
        <Bars
          items={STEPS.map((st, i) => ({ label: t(st.title), value: runUpTo(i).rows.length }))}
          colors={STEPS.map((_, i) => (i === STEPS.length - 1 ? "var(--c3)" : "var(--c1)"))}
          h={220}
        />
      </div>
      <Callout kind="idea" title={{ en: "What you just saw", bn: "যা দেখলেন" }}>
        <p>
          {t({
            en: "9 messy rows became 5 trustworthy ones (1 duplicate removed, 3 quarantined). In production the same steps run on millions of rows, on a schedule, with alerts when a check fails.",
            bn: "৯টি এলোমেলো সারি হলো ৫টি নির্ভরযোগ্য সারি (১টি ডুপ্লিকেট বাদ, ৩টি কোয়ারেন্টাইনে)। প্রোডাকশনে এই একই ধাপ লক্ষ লক্ষ সারিতে, নির্দিষ্ট সময়ে চলে, আর কোনো চেক ব্যর্থ হলে অ্যালার্ট যায়।",
          })}
        </p>
      </Callout>
    </>
  );
}

const CONCEPTS: { title: T; body: T }[] = [
  {
    title: { en: "ETL vs ELT", bn: "ETL বনাম ELT" },
    body: {
      en: "ETL = Extract (collect), Transform (clean), Load (save). ELT does the same steps in a different order: save the raw data first, then clean it inside a big database. ELT is popular today because storage is cheap.",
      bn: "ETL = Extract (সংগ্রহ), Transform (পরিষ্কার), Load (সংরক্ষণ)। ELT একই কাজ অন্য ক্রমে করে: আগে কাঁচা ডেটা সংরক্ষণ, তারপর বড় ডেটাবেসের ভেতরে পরিষ্কার। স্টোরেজ এখন সস্তা, তাই ELT জনপ্রিয়।",
    },
  },
  {
    title: { en: "Batch vs streaming", bn: "ব্যাচ বনাম স্ট্রিমিং" },
    body: {
      en: "Batch means processing data in bundles, like a nightly sales report. Streaming means handling each event the moment it happens, like a fraud alert on a bKash transfer within seconds.",
      bn: "ব্যাচ মানে ডেটা একসাথে গুচ্ছ করে প্রসেস করা, যেমন রাতের বিক্রয় রিপোর্ট। স্ট্রিমিং মানে প্রতিটা ঘটনা ঘটার সাথে সাথেই সামলানো, যেমন বিকাশ ট্রান্সফারে কয়েক সেকেন্ডের মধ্যে জালিয়াতির সতর্কবার্তা।",
    },
  },
  {
    title: { en: "Medallion layers", bn: "মেডেলিয়ন স্তর" },
    body: {
      en: "Think of three shelves. Bronze: raw data, just as it came. Silver: cleaned and checked (what you built above). Gold: ready-made summaries for reports and dashboards.",
      bn: "তিনটা তাক কল্পনা করুন। ব্রোঞ্জ: কাঁচা ডেটা, যেমন এসেছে তেমন। সিলভার: পরিষ্কার ও যাচাই করা (ওপরে যা বানালেন)। গোল্ড: রিপোর্ট আর ড্যাশবোর্ডের জন্য তৈরি সারাংশ।",
    },
  },
  {
    title: { en: "Idempotency", bn: "আইডেম্পটেন্সি" },
    body: {
      en: "If a job runs twice by mistake, the result must be the same as running it once — no double counting. Primary keys and “insert or update” (upsert) make sure of this.",
      bn: "ভুল করে কোনো কাজ দুবার চললেও ফল একবার চালানোর মতোই হতে হবে — দুবার গোনা চলবে না। প্রাইমারি কী আর “থাকলে আপডেট, না থাকলে যোগ” (upsert) দিয়ে এটা নিশ্চিত করা হয়।",
    },
  },
  {
    title: { en: "Orchestration", bn: "অর্কেস্ট্রেশন" },
    body: {
      en: "An orchestrator (Airflow, Dagster, Prefect) is like an alarm clock plus a to-do list for pipelines: it runs each step in the right order at the right time, retries if something fails, and alerts you.",
      bn: "অর্কেস্ট্রেটর (Airflow, Dagster, Prefect) হলো পাইপলাইনের জন্য অ্যালার্ম ঘড়ি আর কাজের তালিকা একসাথে: প্রতিটা ধাপ ঠিক সময়ে ঠিক ক্রমে চালায়, কিছু ব্যর্থ হলে আবার চেষ্টা করে, আর আপনাকে জানায়।",
    },
  },
  {
    title: { en: "Data quality & contracts", bn: "ডেটা কোয়ালিটি ও চুক্তি" },
    body: {
      en: "Check your data the way a shop checks goods before selling: no duplicates, no missing IDs, prices above zero, today's data has arrived. If a check fails, stop — don't let bad numbers reach the boss's dashboard.",
      bn: "দোকান যেমন বিক্রির আগে মাল পরীক্ষা করে, তেমনি ডেটা পরীক্ষা করুন: ডুপ্লিকেট নেই, আইডি বাদ নেই, দাম শূন্যের বেশি, আজকের ডেটা এসেছে। কোনো পরীক্ষা ফেল করলে থামুন — ভুল সংখ্যা যেন বসের ড্যাশবোর্ডে না পৌঁছায়।",
    },
  },
  {
    title: { en: "File formats", bn: "ফাইল ফরম্যাট" },
    body: {
      en: "CSV is easy to open in Excel but slow and big. Parquet stores data column by column and compresses it, so reports read only what they need — often 10× smaller and faster.",
      bn: "CSV এক্সেলে সহজে খোলা যায়, কিন্তু ধীর আর বড়। Parquet ডেটা কলাম ধরে ধরে সংকুচিত করে রাখে, তাই রিপোর্ট শুধু দরকারি অংশটুকু পড়ে — প্রায়ই ১০ গুণ ছোট ও দ্রুত।",
    },
  },
];

function Concepts() {
  const { t } = useLang();
  return (
    <div className="grid cols2">
      {CONCEPTS.map((c, i) => (
        <div key={i} className="card">
          <h3>{t(c.title)}</h3>
          <p style={{ margin: 0 }}>{t(c.body)}</p>
        </div>
      ))}
    </div>
  );
}
