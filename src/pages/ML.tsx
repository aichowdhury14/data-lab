import { useEffect, useMemo, useState } from "react";
import { useLang, type T } from "../i18n";
import { customerById, dataset } from "../data/generate";
import {
  applyScaler,
  buildTree,
  confusion,
  fitScaler,
  kmeansFit,
  kmeansInit,
  kmeansStep,
  linClosedForm,
  linInit,
  linStep,
  mean,
  predictProba,
  splitIndices,
  std,
  trainLogistic,
  treePath,
  treeProba,
  type LinState,
  type Pt,
  type TreeNode,
} from "../ml/core";
import { Bars, Legend, Lines, Scatter, XY, fmt } from "../components/charts";
import { Callout, PageHead, Picker, Slider, Stat, type PickerItem, Plain } from "../components/ui";
import { roc } from "../ml/extra";
import { useMark, useProgress } from "../progress";
import { KNN, NeuralNet, Forecast } from "./MLMore";
import { RFM } from "./MLRfm";
import { Quiz } from "../components/Quiz";

type Tab = "linear" | "logistic" | "tree" | "knn" | "kmeans" | "rfm" | "nn" | "forecast";

const MODELS: PickerItem<Tab>[] = [
  { id: "linear", icon: "📈", label: { en: "Linear regression", bn: "লিনিয়ার রিগ্রেশন" }, tag: { en: "guess a number", bn: "একটা সংখ্যা আন্দাজ" } },
  { id: "logistic", icon: "🎯", label: { en: "Logistic regression", bn: "লজিস্টিক রিগ্রেশন" }, tag: { en: "answer yes or no", bn: "হ্যাঁ বা না উত্তর" } },
  { id: "tree", icon: "🌳", label: { en: "Decision tree", bn: "ডিসিশন ট্রি" }, tag: { en: "a game of 20 questions", bn: "২০ প্রশ্নের খেলা" } },
  { id: "knn", icon: "📍", label: { en: "k-nearest neighbours", bn: "k-নিকটতম প্রতিবেশী" }, tag: { en: "ask the neighbours", bn: "প্রতিবেশীকে জিজ্ঞাসা" } },
  { id: "kmeans", icon: "🫧", label: { en: "K-means clustering", bn: "কে-মিনস ক্লাস্টারিং" }, tag: { en: "find groups by itself", bn: "নিজে নিজে দল খোঁজে" } },
  { id: "rfm", icon: "🛍️", label: { en: "RFM customer segments", bn: "RFM গ্রাহক বিভাজন" }, tag: { en: "marketing · who to target", bn: "মার্কেটিং · কাকে টার্গেট করবেন" } },
  { id: "nn", icon: "🧠", label: { en: "Neural network", bn: "নিউরাল নেটওয়ার্ক" }, tag: { en: "the brain behind AI", bn: "এআই-এর মস্তিষ্ক" } },
  { id: "forecast", icon: "🔮", label: { en: "Time-series forecast", bn: "টাইম-সিরিজ পূর্বাভাস" }, tag: { en: "guess the future", bn: "ভবিষ্যৎ আন্দাজ" } },
];

// ---- data prepared once ----------------------------------------------------------
const customers = dataset("customers").rows;
const spendByCustomer = new Map<number, number>();
for (const t of dataset("transactions").rows) {
  spendByCustomer.set(t.customer_id as number, (spendByCustomer.get(t.customer_id as number) ?? 0) + (t.amount as number));
}
const SPEND = customers.map((c) => ({ income: (c.monthly_income as number) / 1000, spend: (spendByCustomer.get(c.id as number) ?? 0) / 1000 }));

const FEATURES: T[] = [
  { en: "credit score", bn: "ক্রেডিট স্কোর" },
  { en: "loan ÷ yearly income", bn: "ঋণ ÷ বার্ষিক আয়" },
  { en: "interest rate %", bn: "সুদের হার %" },
];
const LOANS = dataset("loans").rows.map((l) => {
  const c = customerById.get(l.customer_id as number)!;
  return {
    x: [c.credit_score as number, (l.amount as number) / ((c.monthly_income as number) * 12), l.interest_rate as number],
    y: l.defaulted as number,
  };
});
const SPLIT = splitIndices(LOANS.length, 0.25);
const Xtrain = SPLIT.train.map((i) => LOANS[i].x);
const ytrain = SPLIT.train.map((i) => LOANS[i].y);
const Xtest = SPLIT.test.map((i) => LOANS[i].x);
const ytest = SPLIT.test.map((i) => LOANS[i].y);
const DEFAULT_RATE = mean(LOANS.map((l) => l.y));

interface Applicant {
  credit: number;
  lti: number;
  rate: number;
}

export default function ML() {
  const [tab, setTab] = useState<Tab>("linear");
  useMark("ml", tab);
  const done = useProgress().ml ?? [];
  const [app, setApp] = useState<Applicant>({ credit: 600, lti: 0.9, rate: 14 });
  return (
    <>
      <PageHead
        title={{ en: "Machine Learning", bn: "মেশিন লার্নিং" }}
        sub={{
          en: "Machine learning means teaching a computer from examples, instead of writing every rule by hand. Pick a model below, press the buttons, and watch it learn — no maths degree needed.",
          bn: "মেশিন লার্নিং মানে প্রতিটা নিয়ম হাতে না লিখে উদাহরণ দেখিয়ে কম্পিউটারকে শেখানো। নিচে একটা মডেল বাছুন, বাটন চাপুন, আর তাকে শিখতে দেখুন — অঙ্কে পণ্ডিত হওয়ার দরকার নেই।",
        }}
        art="ml"
      />
      <Picker items={MODELS.map((m) => ({ ...m, done: done.includes(m.id) }))} value={tab} onChange={setTab} />
      <div className="model-body" key={tab}>
      {tab === "linear" && <Linear />}
      {tab === "logistic" && <Logistic app={app} setApp={setApp} />}
      {tab === "tree" && <Tree app={app} setApp={setApp} />}
      {tab === "kmeans" && <KMeans />}
      {tab === "knn" && <KNN />}
      {tab === "nn" && <NeuralNet />}
      {tab === "forecast" && <Forecast />}
      {tab === "rfm" && <RFM />}
      </div>
      <Quiz id="ml" />
    </>
  );
}

// ---- 1. Linear regression ---------------------------------------------------------
interface Pair {
  id: string;
  label: T;
  x: number[];
  y: number[];
  xLabel: T;
  yLabel: T;
  range: [number, number, number]; // slider min, max, step
  out: (v: number) => string;
}
const col = (id: string, c: string, scale = 1) => dataset(id).rows.map((r) => (r[c] as number) / scale);
const PAIRS: Pair[] = [
  {
    id: "students",
    label: { en: "📚 Study hours → exam score", bn: "📚 পড়ার ঘণ্টা → পরীক্ষার নম্বর" },
    x: col("students", "study_hours_week"),
    y: col("students", "final_score"),
    xLabel: { en: "study hours per week", bn: "সপ্তাহে পড়ার ঘণ্টা" },
    yLabel: { en: "final exam score", bn: "ফাইনাল পরীক্ষার নম্বর" },
    range: [0, 25, 1],
    out: (v) => `${Math.round(Math.min(100, Math.max(0, v)))} / 100`,
  },
  {
    id: "bank",
    label: { en: "🏦 Income → yearly spending", bn: "🏦 আয় → বছরের খরচ" },
    x: SPEND.map((p) => p.income),
    y: SPEND.map((p) => p.spend),
    xLabel: { en: "monthly income (thousand BDT)", bn: "মাসিক আয় (হাজার টাকা)" },
    yLabel: { en: "2024 spending (thousand BDT)", bn: "২০২৪ সালের খরচ (হাজার টাকা)" },
    range: [12, 250, 1],
    out: (v) => `${fmt(Math.max(v, 0) * 1000)} ৳`,
  },
  {
    id: "employees",
    label: { en: "💼 Experience → salary", bn: "💼 অভিজ্ঞতা → বেতন" },
    x: col("employees", "years_experience"),
    y: col("employees", "monthly_salary", 1000),
    xLabel: { en: "years of experience", bn: "অভিজ্ঞতা (বছর)" },
    yLabel: { en: "monthly salary (thousand BDT)", bn: "মাসিক বেতন (হাজার টাকা)" },
    range: [0, 20, 1],
    out: (v) => `${fmt(Math.max(v, 0) * 1000)} ৳`,
  },
  {
    id: "air",
    label: { en: "🌫️ Temperature → air pollution", bn: "🌫️ তাপমাত্রা → বায়ুদূষণ" },
    x: col("dhaka_air", "temperature_c"),
    y: col("dhaka_air", "aqi"),
    xLabel: { en: "temperature (°C)", bn: "তাপমাত্রা (°C)" },
    yLabel: { en: "air quality index (higher = worse)", bn: "বায়ুমান সূচক (বেশি = খারাপ)" },
    range: [12, 36, 0.5],
    out: (v) => `AQI ${Math.round(Math.max(v, 0))}`,
  },
];

function Linear() {
  const { t } = useLang();
  const [pairId, setPairId] = useState("students");
  const pair = PAIRS.find((p) => p.id === pairId)!;
  const [lr, setLr] = useState(0.05);
  const [hist, setHist] = useState<LinState[]>([linInit()]);
  const [playing, setPlaying] = useState(false);
  const [xin, setXin] = useState(10);

  const { xs, ys, mx, sx, my, sy, zx, zy } = useMemo(() => {
    const xs = pair.x;
    const ys = pair.y;
    const mx = mean(xs);
    const sx = std(xs);
    const my = mean(ys);
    const sy = std(ys);
    return { xs, ys, mx, sx, my, sy, zx: xs.map((v) => (v - mx) / sx), zy: ys.map((v) => (v - my) / sy) };
  }, [pair]);
  const cur = hist[hist.length - 1];
  const exact = useMemo(() => linClosedForm(zx, zy), [zx, zy]);

  const choose = (id: string) => {
    const p = PAIRS.find((q) => q.id === id)!;
    setPairId(id);
    setPlaying(false);
    setHist([linInit()]);
    setXin(Math.round((p.range[0] + p.range[1]) / 2));
  };

  const advance = (n: number) =>
    setHist((h) => {
      const out = [...h];
      for (let i = 0; i < n; i++) out.push(linStep(zx, zy, out[out.length - 1], lr));
      return out.slice(-600);
    });

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => advance(1), 60);
    return () => clearInterval(id);
  });

  // back to original units
  const slope = (sy * cur.w) / sx;
  const icpt = my + sy * cur.b - slope * mx;
  const losses = hist.map((h) => h.loss).filter((l) => isFinite(l));
  const close = Math.abs(cur.w - exact.w) < 0.01 && cur.epoch > 0;

  return (
    <>
      <p>
        {t({
          en: "Linear regression guesses one number from another — for example, a student's exam score from their study hours. The computer starts with a bad guess (the orange line) and improves it step by step. Pick a dataset, press “Step” or “Animate”, and watch the line slide into place.",
          bn: "লিনিয়ার রিগ্রেশন একটা সংখ্যা দেখে আরেকটা সংখ্যা আন্দাজ করে — যেমন পড়ার ঘণ্টা দেখে পরীক্ষার নম্বর। কম্পিউটার একটা ভুল আন্দাজ (কমলা দাগ) দিয়ে শুরু করে, তারপর ধাপে ধাপে ঠিক করে। একটা ডেটাসেট বাছুন, “এক ধাপ” বা “অ্যানিমেট” চাপুন, আর দেখুন দাগটা কীভাবে ঠিক জায়গায় সরে আসে।",
        })}
      </p>
      <Plain k="linear" />
      <div className="chips" style={{ marginBottom: 12 }}>
        {PAIRS.map((p) => (
          <button key={p.id} className={`chip-btn${p.id === pairId ? " on" : ""}`} onClick={() => choose(p.id)}>
            {t(p.label)}
          </button>
        ))}
      </div>
      <div className="grid cols2">
        <div className="card">
          <Scatter points={xs.map((x, i) => ({ x, y: ys[i] }))} line={{ a: icpt, b: slope }} xLabel={t(pair.xLabel)} yLabel={t(pair.yLabel)} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => advance(1)}>
              {t({ en: "Step", bn: "এক ধাপ" })}
            </button>
            <button className="btn ghost" onClick={() => advance(25)}>
              +25
            </button>
            <button className="btn ghost" onClick={() => setPlaying(!playing)}>
              {playing ? "⏸" : "▶"} {t({ en: "Animate", bn: "অ্যানিমেট" })}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setPlaying(false);
                setHist([linInit()]);
              }}
            >
              {t({ en: "Reset", bn: "রিসেট" })}
            </button>
          </div>
          <div style={{ marginTop: 10 }}>
            <Slider label={t({ en: "Learning rate (how big each step is)", bn: "লার্নিং রেট (প্রতিটা ধাপ কত বড়)" })} value={lr} min={0.005} max={1.05} step={0.005} onChange={setLr} />
          </div>
        </div>
        <div className="card">
          <div className="stats">
            <Stat label={t({ en: "steps taken", bn: "কত ধাপ হলো" })} value={String(cur.epoch)} />
            <Stat label={t({ en: "a (where the line starts)", bn: "a (দাগ কোথায় শুরু)" })} value={fmt(icpt)} />
            <Stat label={t({ en: "b (how steep it is)", bn: "b (দাগ কতটা খাড়া)" })} value={slope.toFixed(2)} />
            <Stat label={t({ en: "error (lower is better)", bn: "ভুল (যত কম তত ভালো)" })} value={isFinite(cur.loss) ? cur.loss.toFixed(3) : "–"} />
          </div>
          <h3 style={{ marginTop: 14 }}>{t({ en: "The error goes down as it learns", bn: "শিখতে শিখতে ভুল কমে" })}</h3>
          {losses.length > 1 ? (
            <Lines series={[{ name: "error", values: losses }]} h={190} xLabel={t({ en: "step", bn: "ধাপ" })} />
          ) : (
            <p className="muted small">{t({ en: "Press “Step” to start learning.", bn: "শেখা শুরু করতে “এক ধাপ” চাপুন।" })}</p>
          )}
          <p className={`small ${close ? "ok-text" : "muted"}`}>
            {close
              ? t({ en: "✓ The line has found the best fit. Learning is done!", bn: "✓ দাগটা সবচেয়ে ভালো জায়গা খুঁজে পেয়েছে। শেখা শেষ!" })
              : t({ en: "Keep stepping until the error stops going down.", bn: "যতক্ষণ ভুল কমা বন্ধ না হয়, ধাপ চালিয়ে যান।" })}
          </p>
        </div>
      </div>
      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t({ en: "Now use the model", bn: "এবার মডেলটা ব্যবহার করুন" })}</h3>
          <Slider label={t(pair.xLabel)} value={xin} min={pair.range[0]} max={pair.range[1]} step={pair.range[2]} onChange={setXin} />
          <p style={{ margin: "8px 0 0" }}>
            {t({ en: "The model guesses:", bn: "মডেলের আন্দাজ:" })} <b className="big-answer">{pair.out(icpt + slope * xin)}</b>
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            {t({ en: "It's a guess from the line, not a promise — real people vary (see how the dots spread around the line).", bn: "এটা দাগ থেকে আন্দাজ, নিশ্চয়তা নয় — বাস্তবে মানুষ আলাদা আলাদা হয় (দেখুন বিন্দুগুলো দাগের চারপাশে কতটা ছড়ানো)।" })}
          </p>
        </div>
        <Callout kind="idea" title={{ en: "Try this", bn: "এটা করে দেখুন" }}>
          <p>
            {t({
              en: "Set the learning rate very small: the line crawls. Set it near 1: the line jumps around wildly and the error explodes. Somewhere in between is just right — every AI model has this same problem.",
              bn: "লার্নিং রেট খুব ছোট করুন: দাগ শামুকের মতো চলে। ১-এর কাছে নিন: দাগ পাগলের মতো লাফায় আর ভুল বাড়তেই থাকে। মাঝামাঝি কোথাও একদম ঠিক — প্রতিটা এআই মডেলেরই এই একই সমস্যা।",
            })}
          </p>
        </Callout>
      </div>
    </>
  );
}

// ---- shared applicant form -------------------------------------------------------
function ApplicantForm({ app, setApp }: { app: Applicant; setApp: (a: Applicant) => void }) {
  const { t } = useLang();
  return (
    <div className="card">
      <h3>{t({ en: "Try a loan applicant", bn: "একজন ঋণ আবেদনকারী পরীক্ষা করুন" })}</h3>
      <Slider label={t(FEATURES[0])} value={app.credit} min={300} max={850} step={5} onChange={(v) => setApp({ ...app, credit: v })} />
      <Slider label={t(FEATURES[1])} value={app.lti} min={0.1} max={2} step={0.05} show={app.lti.toFixed(2)} onChange={(v) => setApp({ ...app, lti: v })} />
      <Slider label={t(FEATURES[2])} value={app.rate} min={7} max={22} step={0.5} onChange={(v) => setApp({ ...app, rate: v })} />
    </div>
  );
}

// ---- 2. Logistic regression -------------------------------------------------------
function Logistic({ app, setApp }: { app: Applicant; setApp: (a: Applicant) => void }) {
  const { t } = useLang();
  const [epochs, setEpochs] = useState(150);
  const [threshold, setThreshold] = useState(0.5);

  const scaler = useMemo(() => fitScaler(Xtrain), []);
  const Ztrain = useMemo(() => applyScaler(Xtrain, scaler), [scaler]);
  const Ztest = useMemo(() => applyScaler(Xtest, scaler), [scaler]);
  const { model, losses } = useMemo(() => trainLogistic(Ztrain, ytrain, epochs, 0.3), [Ztrain, epochs]);

  const probs = Ztest.map((x) => predictProba(model, x));
  const m = confusion(ytest, probs.map((p) => (p >= threshold ? 1 : 0)));
  const baseline = 1 - mean(ytest);
  const z = applyScaler([[app.credit, app.lti, app.rate]], scaler)[0];
  const pApp = predictProba(model, z);
  const zApp = model.b + model.w.reduce((a, wj, j) => a + wj * z[j], 0);
  const maxW = Math.max(...model.w.map(Math.abs), 1e-9);
  const curve = roc(ytest, probs);
  const fpr = m.fp / (m.fp + m.tn || 1);

  return (
    <>
      <p>
        {t({
          en: "Question: will this person pay back their loan — yes or no? The model looks at three things (credit score, loan size, interest rate), gives each one a weight, and turns the total into a chance between 0% and 100%. It learns from 75% of past loans and is tested on the other 25%, which it has never seen.",
          bn: "প্রশ্ন: এই মানুষটি কি ঋণ ফেরত দেবেন — হ্যাঁ নাকি না? মডেল তিনটা জিনিস দেখে (ক্রেডিট স্কোর, ঋণের পরিমাণ, সুদের হার), প্রতিটাকে একটা গুরুত্ব (ওজন) দেয়, তারপর মোটটাকে ০% থেকে ১০০%-এর একটা সম্ভাবনায় বদলায়। পুরোনো ঋণের ৭৫% দেখে শেখে, আর বাকি ২৫% দিয়ে তার পরীক্ষা হয় — যেগুলো সে আগে কখনো দেখেনি।",
        })}
      </p>
      <Plain k="logistic" />
      <div className="grid cols2">
        <div className="card">
          <Slider label={t({ en: "Training rounds (epochs)", bn: "প্রশিক্ষণ রাউন্ড (epoch)" })} value={epochs} min={1} max={500} step={1} onChange={setEpochs} />
          <h3 style={{ marginTop: 12 }}>{t({ en: "Loss (lower = better fit)", bn: "লস (কম = ভালো মিল)" })}</h3>
          {losses.length > 1 ? <Lines series={[{ name: "loss", values: losses }]} h={170} xLabel="epoch" /> : <p className="muted small">–</p>}
          <h3>{t({ en: "What the model learned (weights)", bn: "মডেল যা শিখল (ওজন)" })}</h3>
          {model.w.map((w, j) => (
            <div key={j} className="bar-h">
              <span>{t(FEATURES[j])}</span>
              <div className="track">
                <div
                  className="fill"
                  style={{
                    left: w >= 0 ? "50%" : `${50 - (Math.abs(w) / maxW) * 50}%`,
                    width: `${(Math.abs(w) / maxW) * 50}%`,
                    background: w >= 0 ? "var(--bad)" : "var(--good)",
                  }}
                />
              </div>
              <b>{w.toFixed(2)}</b>
            </div>
          ))}
          <p className="muted small">
            {t({
              en: "Red (positive) pushes toward default, green (negative) toward repayment. Features were standardised so weights are comparable.",
              bn: "লাল (ধনাত্মক) খেলাপির দিকে, সবুজ (ঋণাত্মক) পরিশোধের দিকে ঠেলে। ফিচারগুলো স্ট্যান্ডার্ডাইজ করা, তাই ওজন তুলনীয়।",
            })}
          </p>
        </div>

        <div className="card">
          <Slider label={t({ en: "Decision threshold (flag as default if p ≥)", bn: "সিদ্ধান্তের সীমা (p ≥ হলে খেলাপি)" })} value={threshold} min={0.05} max={0.95} step={0.05} show={threshold.toFixed(2)} onChange={setThreshold} />
          <h3 style={{ marginTop: 12 }}>{t({ en: "Test-set confusion matrix", bn: "টেস্ট সেটের কনফিউশন ম্যাট্রিক্স" })}</h3>
          <div className="cm">
            <div className="h" />
            <div className="h">{t({ en: "predicted: OK", bn: "অনুমান: ঠিক" })}</div>
            <div className="h">{t({ en: "predicted: default", bn: "অনুমান: খেলাপি" })}</div>
            <div className="h">{t({ en: "actually OK", bn: "আসলে ঠিক" })}</div>
            <div className="good">
              <b>{m.tn}</b>TN
            </div>
            <div className="badc">
              <b>{m.fp}</b>FP
            </div>
            <div className="h">{t({ en: "actually default", bn: "আসলে খেলাপি" })}</div>
            <div className="badc">
              <b>{m.fn}</b>FN
            </div>
            <div className="good">
              <b>{m.tp}</b>TP
            </div>
          </div>
          <div className="stats" style={{ marginTop: 12 }}>
            <Stat label="accuracy" value={(m.accuracy * 100).toFixed(1) + "%"} />
            <Stat label="precision" value={(m.precision * 100).toFixed(1) + "%"} hint="Of those flagged, how many really defaulted?" />
            <Stat label="recall" value={(m.recall * 100).toFixed(1) + "%"} hint="Of the real defaults, how many did we catch?" />
            <Stat label="F1" value={m.f1.toFixed(2)} />
          </div>
          <p className="muted small">
            {t({
              en: `Baseline: always guessing “no default” is already ${(baseline * 100).toFixed(0)}% accurate because only ${(DEFAULT_RATE * 100).toFixed(0)}% of loans default. That's why accuracy alone is misleading — look at recall too.`,
              bn: `বেসলাইন: সবসময় “খেলাপি নয়” বললেই ${(baseline * 100).toFixed(0)}% সঠিক, কারণ মাত্র ${(DEFAULT_RATE * 100).toFixed(0)}% ঋণ খেলাপি। তাই শুধু accuracy বিভ্রান্তিকর — recall-ও দেখুন।`,
            })}
          </p>
        </div>
      </div>

      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t({ en: "ROC curve", bn: "ROC কার্ভ" })}</h3>
          <XY
            series={[
              { name: "model", pts: curve.pts, area: true },
              { name: t({ en: "random guess", bn: "এলোমেলো অনুমান" }), pts: [[0, 0], [1, 1]], dashed: true, color: "var(--c8)" },
            ]}
            markers={[{ x: fpr, y: m.recall, label: `t=${threshold.toFixed(2)}` }]}
            xDomain={[0, 1]}
            yDomain={[0, 1.02]}
            xLabel={t({ en: "false positive rate", bn: "ভুল পজিটিভ হার" })}
            yLabel={t({ en: "true positive rate (recall)", bn: "সঠিক পজিটিভ হার (recall)" })}
            h={280}
          />
          <p className="muted small" style={{ margin: 0 }}>
            {t({
              en: `AUC = ${curve.auc.toFixed(3)}. Every threshold is one point on this curve; the orange dot is yours. 1.0 is perfect, 0.5 is a coin toss.`,
              bn: `AUC = ${curve.auc.toFixed(3)}। প্রতিটি থ্রেশহোল্ড এই কার্ভের একটি বিন্দু; কমলা বিন্দুটি আপনার। ১.০ নিখুঁত, ০.৫ মানে কয়েন টস।`,
            })}
          </p>
        </div>
        <ApplicantForm app={app} setApp={setApp} />
      </div>
      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t({ en: "Predicted default probability", bn: "অনুমিত খেলাপির সম্ভাবনা" })}</h3>
          <div className="gauge">
            <div className="gauge-fill" style={{ width: `${pApp * 100}%`, background: pApp >= threshold ? "var(--bad)" : "var(--good)" }} />
            <div className="gauge-mark" style={{ left: `${threshold * 100}%` }} />
          </div>
          <div className="stats">
            <Stat label="p(default)" value={(pApp * 100).toFixed(1) + "%"} />
            <Stat label={t({ en: "decision", bn: "সিদ্ধান্ত" })} value={pApp >= threshold ? t({ en: "Flag", bn: "ঝুঁকিপূর্ণ" }) : t({ en: "Approve", bn: "অনুমোদন" })} />
          </div>
          <Callout kind="warn" title={{ en: "Precision vs recall trade-off", bn: "প্রিসিশন বনাম রিকল ট্রেড-অফ" }}>
            <p>
              {t({
                en: "Lower the threshold: you catch more real defaults (recall ↑) but wrongly reject more good borrowers (precision ↓). A bank must decide which mistake costs more.",
                bn: "সীমা কমালে আরও বেশি আসল খেলাপি ধরা পড়ে (recall ↑) কিন্তু ভালো ঋণগ্রহীতাকে ভুল করে বাদ দেওয়া বাড়ে (precision ↓)। ব্যাংককে ঠিক করতে হয় কোন ভুলের খরচ বেশি।",
              })}
            </p>
          </Callout>
        </div>
        <div className="card">
          <h3>{t({ en: "The sigmoid: score → probability", bn: "সিগময়েড: স্কোর → সম্ভাবনা" })}</h3>
          <XY
            series={[{ name: "sigmoid", pts: Array.from({ length: 61 }, (_, i) => [i / 5 - 6, 1 / (1 + Math.exp(-(i / 5 - 6)))] as [number, number]) }]}
            markers={[{ x: Math.max(-6, Math.min(6, zApp)), y: pApp, label: t({ en: "applicant", bn: "আবেদনকারী" }) }]}
            xDomain={[-6, 6]}
            yDomain={[0, 1]}
            xLabel={t({ en: "z = b + w₁x₁ + w₂x₂ + w₃x₃", bn: "z = b + w₁x₁ + w₂x₂ + w₃x₃" })}
            yLabel="p(default)"
            h={250}
          />
          <p className="muted small" style={{ margin: 0 }}>
            {t({
              en: "The model adds up weighted features into one score z, then the S-curve squashes any z into 0–1. Move the applicant sliders and watch the dot slide along the curve.",
              bn: "মডেল ওজনযুক্ত ফিচার যোগ করে একটি স্কোর z বানায়, তারপর S-কার্ভ যেকোনো z-কে ০–১-এর মধ্যে আনে। আবেদনকারীর স্লাইডার নাড়ুন, বিন্দুটি কার্ভ বরাবর সরবে।",
            })}
          </p>
        </div>
      </div>
    </>
  );
}

// ---- 3. Decision tree -------------------------------------------------------------
const fmtFeat = (j: number, v: number) => (j === 0 ? v.toFixed(0) : j === 1 ? v.toFixed(2) : v.toFixed(1));

function Tree({ app, setApp }: { app: Applicant; setApp: (a: Applicant) => void }) {
  const { t } = useLang();
  const [depth, setDepth] = useState(3);
  const tree = useMemo(() => buildTree(Xtrain, ytrain, depth), [depth]);
  const acc = (tr: TreeNode, X: number[][], y: number[]) => mean(X.map((x, i) => ((treeProba(tr, x) >= 0.5 ? 1 : 0) === y[i] ? 1 : 0)));
  const curve = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7, 8].map((d) => {
        const tr = buildTree(Xtrain, ytrain, d);
        return { train: acc(tr, Xtrain, ytrain), test: acc(tr, Xtest, ytest) };
      }),
    [],
  );
  const x = [app.credit, app.lti, app.rate];
  const path = useMemo(() => new Set(treePath(tree, x)), [tree, app.credit, app.lti, app.rate]); // eslint-disable-line react-hooks/exhaustive-deps
  const leaf = [...path].pop()!;

  const NodeView = ({ node }: { node: TreeNode }) => {
    const on = path.has(node) ? "on" : "";
    if (node.leaf) {
      const p = node.pos / node.n;
      return (
        <span className={`leaf ${on}`}>
          → {p >= 0.5 ? t({ en: "DEFAULT", bn: "খেলাপি" }) : t({ en: "repays", bn: "পরিশোধ করে" })} ({(p * 100).toFixed(0)}% {t({ en: "default", bn: "খেলাপি" })}, n={node.n})
        </span>
      );
    }
    return (
      <>
        <span className={`rule ${on}`}>
          {t(FEATURES[node.feature!])} ≤ {fmtFeat(node.feature!, node.threshold!)} ?
        </span>
        <ul>
          <li>
            <span className="muted">{t({ en: "yes", bn: "হ্যাঁ" })} </span>
            <NodeView node={node.left!} />
          </li>
          <li>
            <span className="muted">{t({ en: "no", bn: "না" })} </span>
            <NodeView node={node.right!} />
          </li>
        </ul>
      </>
    );
  };

  return (
    <>
      <p>
        {t({
          en: "A decision tree learns a short list of yes/no questions from past loans, like “Is the credit score below 600?”. You can read every rule, which is why banks love it. Move the depth slider to allow more questions.",
          bn: "ডিসিশন ট্রি পুরোনো ঋণগুলো থেকে কয়েকটা সহজ হ্যাঁ/না প্রশ্ন শেখে, যেমন “ক্রেডিট স্কোর কি ৬০০-র কম?”। প্রতিটা নিয়ম পড়া যায়, তাই ব্যাংক এটা খুব পছন্দ করে। বেশি প্রশ্ন করতে দিতে গভীরতার স্লাইডার বাড়ান।",
        })}
      </p>
      <Plain k="tree" />
      <div className="grid cols2">
        <div className="card">
          <Slider label={t({ en: "Maximum depth (number of questions in a row)", bn: "সর্বোচ্চ গভীরতা (পরপর প্রশ্নের সংখ্যা)" })} value={depth} min={1} max={6} step={1} onChange={setDepth} />
          <div className="tree" style={{ marginTop: 12, overflow: "auto", maxHeight: 460 }}>
            <NodeView node={tree} />
          </div>
        </div>
        <div className="card">
          <h3>{t({ en: "Accuracy vs depth", bn: "গভীরতা অনুযায়ী accuracy" })}</h3>
          <Lines
            series={[
              { name: t({ en: "train", bn: "ট্রেনিং" }), values: curve.map((c) => c.train) },
              { name: t({ en: "test (unseen)", bn: "টেস্ট (অদেখা)" }), values: curve.map((c) => c.test) },
            ]}
            xOffset={1}
            xLabel={t({ en: "max depth", bn: "সর্বোচ্চ গভীরতা" })}
            h={220}
          />
          <Callout kind="warn" title={{ en: "Overfitting", bn: "ওভারফিটিং" }}>
            <p>
              {t({
                en: "Deeper trees memorise the training loans, so training accuracy keeps rising — but test accuracy stalls or falls. A model must be judged on data it has never seen.",
                bn: "গভীর ট্রি প্রশিক্ষণের ঋণ মুখস্থ করে ফেলে, তাই ট্রেনিং accuracy বাড়তেই থাকে — কিন্তু টেস্ট accuracy থেমে যায় বা কমে। মডেলকে বিচার করতে হয় তার অদেখা ডেটায়।",
              })}
            </p>
          </Callout>
        </div>
      </div>
      <div className="grid cols2" style={{ marginTop: 16 }}>
        <ApplicantForm app={app} setApp={setApp} />
        <div className="card">
          <h3>{t({ en: "This applicant lands in the highlighted leaf", bn: "এই আবেদনকারী হাইলাইট করা পাতায় পৌঁছায়" })}</h3>
          <div className="stats">
            <Stat label="p(default)" value={((leaf.pos / leaf.n) * 100).toFixed(0) + "%"} />
            <Stat label={t({ en: "loans in leaf", bn: "পাতায় ঋণ" })} value={String(leaf.n)} />
          </div>
          <p className="muted small">
            {t({ en: "Trees need no feature scaling: thresholds are in real units (score points, ratio, %).", bn: "ট্রির জন্য ফিচার স্কেলিং লাগে না: সীমাগুলো বাস্তব এককে (স্কোর, অনুপাত, %)।" })}
          </p>
        </div>
      </div>
    </>
  );
}

// ---- 4. K-means -------------------------------------------------------------------
function KMeans() {
  const { t } = useLang();
  const [k, setK] = useState(3);
  const raw: Pt[] = SPEND.map((p) => [p.income, p.spend]);
  const sc = useMemo(() => fitScaler(raw), []); // eslint-disable-line react-hooks/exhaustive-deps
  const Z = useMemo(() => applyScaler(raw, sc) as Pt[], [sc]); // eslint-disable-line react-hooks/exhaustive-deps
  const [centroids, setCentroids] = useState<Pt[]>(() => kmeansInit(Z, 3));
  const [iter, setIter] = useState(0);

  const reset = (nk: number) => {
    setK(nk);
    setCentroids(kmeansInit(Z, nk));
    setIter(0);
  };
  const cur = kmeansStep(Z, centroids); // .assign is relative to the current centroids
  const inertia = Z.reduce((a, p, i) => a + (p[0] - centroids[cur.assign[i]][0]) ** 2 + (p[1] - centroids[cur.assign[i]][1]) ** 2, 0);
  const toRaw = (c: Pt) => ({ x: c[0] * sc.std[0] + sc.mean[0], y: c[1] * sc.std[1] + sc.mean[1] });
  const converged = cur.moved < 1e-6;
  const elbow = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8].map((kk) => kmeansFit(Z, kk).inertia), [Z]);

  return (
    <>
      <p>
        {t({
          en: "Here nobody tells the computer the right answer. K-means finds groups of similar customers all by itself. Press “Step” and watch the ✕ marks (the centre of each group) move until they settle.",
          bn: "এখানে কেউ কম্পিউটারকে সঠিক উত্তর বলে দেয় না। K-means নিজে নিজেই একরকম গ্রাহকদের দল খুঁজে বের করে। “এক ধাপ” চাপুন আর দেখুন ✕ চিহ্নগুলো (প্রতিটা দলের কেন্দ্র) সরতে সরতে কোথায় থামে।",
        })}
      </p>
      <Plain k="kmeans" />
      <div className="grid cols2">
        <div className="card">
          <Scatter
            points={SPEND.map((p, i) => ({ x: p.income, y: p.spend, c: cur.assign[i] }))}
            centers={centroids.map(toRaw)}
            xLabel={t({ en: "monthly income (k BDT)", bn: "মাসিক আয় (হাজার টাকা)" })}
            yLabel={t({ en: "2024 spend (k BDT)", bn: "২০২৪ খরচ (হাজার টাকা)" })}
          />
          <Legend names={Array.from({ length: k }, (_, i) => `${t({ en: "cluster", bn: "ক্লাস্টার" })} ${i + 1}`)} />
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn"
              disabled={converged}
              onClick={() => {
                setCentroids(cur.centroids);
                setIter(iter + 1);
              }}
            >
              {t({ en: "Step", bn: "এক ধাপ" })}
            </button>
            <button
              className="btn ghost"
              disabled={converged}
              onClick={() => {
                let c = centroids;
                let n = iter;
                for (let i = 0; i < 50; i++) {
                  const o = kmeansStep(Z, c);
                  c = o.centroids;
                  n++;
                  if (o.moved < 1e-6) break;
                }
                setCentroids(c);
                setIter(n);
              }}
            >
              {t({ en: "Run to the end", bn: "শেষ পর্যন্ত চালান" })}
            </button>
            <button className="btn ghost" onClick={() => reset(k)}>
              {t({ en: "Reset", bn: "রিসেট" })}
            </button>
          </div>
          <div style={{ marginTop: 10 }}>
            <Slider label={t({ en: "Number of clusters k", bn: "ক্লাস্টার সংখ্যা k" })} value={k} min={1} max={6} step={1} onChange={reset} />
          </div>
        </div>
        <div className="card">
          <div className="stats">
            <Stat label={t({ en: "iterations", bn: "পুনরাবৃত্তি" })} value={String(iter)} />
            <Stat label={t({ en: "inertia", bn: "ইনার্শিয়া" })} value={inertia.toFixed(1)} hint="Sum of squared distances to the assigned centre" />
            <Stat label={t({ en: "status", bn: "অবস্থা" })} value={converged ? t({ en: "converged", bn: "স্থির" }) : t({ en: "moving", bn: "চলছে" })} />
          </div>
          <h3 style={{ marginTop: 14 }}>{t({ en: "Cluster profiles", bn: "ক্লাস্টারের পরিচিতি" })}</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t({ en: "customers", bn: "গ্রাহক" })}</th>
                <th>{t({ en: "avg income (k)", bn: "গড় আয় (হা.)" })}</th>
                <th>{t({ en: "avg spend (k)", bn: "গড় খরচ (হা.)" })}</th>
              </tr>
            </thead>
            <tbody>
              {centroids.map((_, ci) => {
                const mine = SPEND.filter((_, i) => cur.assign[i] === ci);
                return (
                  <tr key={ci}>
                    <td>{ci + 1}</td>
                    <td className="num">{mine.length}</td>
                    <td className="num">{mine.length ? fmt(mean(mine.map((p) => p.income))) : "–"}</td>
                    <td className="num">{mine.length ? fmt(mean(mine.map((p) => p.spend))) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <h3 style={{ marginTop: 14 }}>{t({ en: "Choosing k: the elbow", bn: "k বাছাই: কনুই" })}</h3>
          <Bars items={elbow.map((v, i) => ({ label: `k=${i + 1}`, value: v }))} h={190} yLabel={t({ en: "inertia", bn: "ইনার্শিয়া" })} />
          <p className="muted small">
            {t({
              en: "Inertia always falls as k grows. Pick the k where the drop starts to flatten — the 'elbow'.",
              bn: "k বাড়লে ইনার্শিয়া সবসময় কমে। যে k-তে কমা চ্যাপ্টা হতে শুরু করে — সেই ‘কনুই’ বেছে নিন।",
            })}
          </p>
        </div>
      </div>
      <Callout kind="idea" title={{ en: "Why standardise first?", bn: "আগে স্ট্যান্ডার্ডাইজ কেন?" }}>
        <p>
          {t({
            en: "Distance treats both axes equally, so a feature with bigger numbers would dominate. We rescale each axis to mean 0 and spread 1 before clustering, then draw the result back in real units.",
            bn: "দূরত্ব দুই অক্ষকে সমান গুরুত্ব দেয়, তাই বড় সংখ্যার ফিচার প্রাধান্য পেত। ক্লাস্টারিংয়ের আগে প্রতিটি অক্ষকে গড় ০ ও ছড়ানো ১-এ আনা হয়, ফল আবার বাস্তব এককে আঁকা হয়।",
          })}
        </p>
      </Callout>
    </>
  );
}
