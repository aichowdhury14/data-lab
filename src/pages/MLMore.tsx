import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "../i18n";
import { customerById, dataset } from "../data/generate";
import { applyScaler, fitScaler, mean, splitIndices, type Pt } from "../ml/core";
import { forecast, knn, mae, mape, netForward, netInit, netTrain, toyData, type Method, type Net, type Toy } from "../ml/extra";
import { HBars, Lines, Scatter, XY, fmt } from "../components/charts";
import { Callout, Slider, Stat, Plain } from "../components/ui";
import { Mission } from "../components/Missions";

// ---- k-nearest neighbours ----------------------------------------------------------
const KNN_RAW: Pt[] = [];
const KNN_Y: number[] = [];
for (const l of dataset("loans").rows) {
  const c = customerById.get(l.customer_id as number)!;
  KNN_RAW.push([c.credit_score as number, (l.amount as number) / ((c.monthly_income as number) * 12)]);
  KNN_Y.push(l.defaulted as number);
}
const KSPLIT = splitIndices(KNN_RAW.length, 0.25, 21);
const KSC = fitScaler(KSPLIT.train.map((i) => KNN_RAW[i]));
const KZ = applyScaler(KNN_RAW, KSC) as Pt[];
const KTR = KSPLIT.train.map((i) => KZ[i]);
const KTRY = KSPLIT.train.map((i) => KNN_Y[i]);

export function KNN() {
  const { t } = useLang();
  const [k, setK] = useState(7);
  const [q, setQ] = useState<Pt>([610, 0.7]);
  const zq = applyScaler([q], KSC)[0] as Pt;
  const res = knn(KTR, KTRY, zq, k);
  const xd: [number, number] = [Math.min(...KNN_RAW.map((p) => p[0])) - 10, Math.max(...KNN_RAW.map((p) => p[0])) + 10];
  const yd: [number, number] = [0, Math.max(...KNN_RAW.map((p) => p[1])) * 1.05];

  const grid = useMemo(() => {
    const cells: { x0: number; y0: number; x1: number; y1: number; p: number }[] = [];
    const nx = 36;
    const ny = 22;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const x0 = xd[0] + ((xd[1] - xd[0]) * i) / nx;
        const y0 = yd[0] + ((yd[1] - yd[0]) * j) / ny;
        const x1 = x0 + (xd[1] - xd[0]) / nx;
        const y1 = y0 + (yd[1] - yd[0]) / ny;
        const z = applyScaler([[(x0 + x1) / 2, (y0 + y1) / 2]], KSC)[0] as Pt;
        cells.push({ x0, y0, x1, y1, p: knn(KTR, KTRY, z, k).p });
      }
    return cells;
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps

  const accByK = useMemo(
    () =>
      [1, 3, 5, 7, 9, 13, 17, 21, 25, 31, 41].map((kk) => ({
        k: kk,
        acc: mean(KSPLIT.test.map((i) => ((knn(KTR, KTRY, KZ[i], kk).p >= 0.5 ? 1 : 0) === KNN_Y[i] ? 1 : 0))),
      })),
    [],
  );

  return (
    <>
      <p>
        {t({
          en: "k-NN is the simplest idea in machine learning: to judge a new loan, find the k most similar old loans and go with what happened to most of them. Click anywhere on the chart to put a new applicant there.",
          bn: "k-NN হলো মেশিন লার্নিংয়ের সবচেয়ে সহজ ধারণা: নতুন একটা ঋণ বিচার করতে সবচেয়ে মিল থাকা k-টা পুরোনো ঋণ খুঁজুন, আর তাদের বেশিরভাগের যা হয়েছিল সেটাই ধরে নিন। চার্টের যেকোনো জায়গায় ক্লিক করে সেখানে একজন নতুন আবেদনকারী বসান।",
        })}
      </p>
      <Plain k="knn" />
      <div className="grid cols2">
        <div className="card">
          <Scatter
            points={KSPLIT.train.map((i) => ({ x: KNN_RAW[i][0], y: KNN_RAW[i][1], c: KNN_Y[i] ? 1 : 2 }))}
            xDomain={xd}
            yDomain={yd}
            xLabel={t({ en: "credit score", bn: "ক্রেডিট স্কোর" })}
            yLabel={t({ en: "loan ÷ yearly income", bn: "ঋণ ÷ বার্ষিক আয়" })}
            h={360}
            onPick={(x, y) => setQ([x, y])}
            under={({ sx, sy }) =>
              grid.map((c, i) => (
                <rect
                  key={i}
                  x={sx(c.x0)}
                  y={sy(c.y1)}
                  width={sx(c.x1) - sx(c.x0) + 0.5}
                  height={sy(c.y0) - sy(c.y1) + 0.5}
                  style={{ fill: `color-mix(in srgb, var(--c2) ${(c.p * 100).toFixed(0)}%, var(--c3))` }}
                  opacity={0.16}
                />
              ))
            }
            over={({ sx, sy }) => (
              <g>
                {res.neighbors.map((i) => (
                  <line key={i} x1={sx(q[0])} y1={sy(q[1])} x2={sx(KNN_RAW[KSPLIT.train[i]][0])} y2={sy(KNN_RAW[KSPLIT.train[i]][1])} stroke="var(--text)" strokeWidth={1} opacity={0.5} />
                ))}
                <circle cx={sx(q[0])} cy={sy(q[1])} r={9} fill={res.p >= 0.5 ? "var(--c2)" : "var(--c3)"} stroke="var(--text)" strokeWidth={2.5} className="pulse" />
              </g>
            )}
          />
          <div className="legend">
            <span>
              <i style={{ background: "var(--c3)" }} />
              {t({ en: "repaid", bn: "পরিশোধ" })}
            </span>
            <span>
              <i style={{ background: "var(--c2)" }} />
              {t({ en: "defaulted", bn: "খেলাপি" })}
            </span>
            <span className="muted">{t({ en: "shaded background = what k-NN would predict there", bn: "ছায়াযুক্ত পটভূমি = সেখানে k-NN কী অনুমান করত" })}</span>
          </div>
          <Slider label={t({ en: "k (number of neighbours)", bn: "k (প্রতিবেশীর সংখ্যা)" })} value={k} min={1} max={41} step={2} onChange={setK} />
        </div>
        <div className="card">
          <div className="stats">
            <Stat label={t({ en: "applicant score", bn: "আবেদনকারীর স্কোর" })} value={q[0].toFixed(0)} />
            <Stat label={t({ en: "loan ÷ income", bn: "ঋণ ÷ আয়" })} value={q[1].toFixed(2)} />
            <Stat label={t({ en: "neighbours who defaulted", bn: "খেলাপি প্রতিবেশী" })} value={`${Math.round(res.p * k)} / ${k}`} />
            <Stat label={t({ en: "verdict", bn: "রায়" })} value={res.p >= 0.5 ? t({ en: "⚠ risky", bn: "⚠ ঝুঁকিপূর্ণ" }) : t({ en: "✓ safe", bn: "✓ নিরাপদ" })} />
          </div>
          <h3 style={{ marginTop: 14 }}>{t({ en: "Test accuracy for different k", bn: "বিভিন্ন k-তে টেস্ট accuracy" })}</h3>
          <XY
            series={[{ name: "accuracy", pts: accByK.map((a) => [a.k, a.acc] as [number, number]), area: true }]}
            markers={[{ x: k, y: accByK.reduce((best, a) => (Math.abs(a.k - k) < Math.abs(best.k - k) ? a : best)).acc }]}
            xLabel="k"
            h={220}
          />
          <Mission
            title={{ en: "Mission: the best k", bn: "মিশন: সেরা k" }}
            goal={{ en: "Find the k (number of neighbours) that predicts unseen loans most accurately.", bn: "এমন k (প্রতিবেশীর সংখ্যা) খুঁজুন যা অদেখা ঋণ সবচেয়ে নির্ভুলভাবে অনুমান করে।" }}
            evaluate={() => {
              const accFor = (kk: number) => mean(KSPLIT.test.map((i) => ((knn(KTR, KTRY, KZ[i], kk).p >= 0.5 ? 1 : 0) === KNN_Y[i] ? 1 : 0)));
              let best = 0;
              let bestK = 1;
              for (let kk = 1; kk <= 41; kk += 2) {
                const a = accFor(kk);
                if (a > best) [best, bestK] = [a, kk];
              }
              const mine = accFor(k);
              return mine >= best - 0.005
                ? { ok: true, msg: { en: `✅ k = ${k} reaches ${(mine * 100).toFixed(1)}% — as good as it gets.`, bn: `✅ k = ${k}-এ ${(mine * 100).toFixed(1)}% — এর চেয়ে ভালো হয় না।` } }
                : { ok: false, msg: { en: `k = ${k} gives ${(mine * 100).toFixed(1)}%. Something near k = ${bestK} does better — watch the accuracy chart.`, bn: `k = ${k}-এ ${(mine * 100).toFixed(1)}%। k = ${bestK}-এর কাছাকাছি কিছু আরও ভালো — accuracy চার্টটা দেখুন।` } };
            }}
          />
          <Callout kind="idea" title={{ en: "Small k vs big k", bn: "ছোট k বনাম বড় k" }}>
            <p>
              {t({
                en: "k = 1 copies the single closest loan — jumpy, patchy regions (overfitting). A huge k averages everyone — too smooth (underfitting). Watch the shaded map change as you move the slider.",
                bn: "k = ১ মানে শুধু সবচেয়ে কাছের ঋণটিকে নকল করা — এলোমেলো ছোপ ছোপ অঞ্চল (ওভারফিটিং)। অনেক বড় k সবার গড় নেয় — অতিরিক্ত মসৃণ (আন্ডারফিটিং)। স্লাইডার নাড়ালে ছায়াযুক্ত মানচিত্র কীভাবে বদলায় দেখুন।",
              })}
            </p>
          </Callout>
        </div>
      </div>
    </>
  );
}

// ---- Neural network playground ---------------------------------------------------
const TOYS: { id: Toy; label: string }[] = [
  { id: "circle", label: "◎ circle" },
  { id: "xor", label: "✕ xor" },
  { id: "moons", label: "☾ moons" },
  { id: "spiral", label: "🌀 spiral" },
];

function NetDiagram({ net }: { net: Net }) {
  const W = 360;
  const H = 210;
  const L = net.sizes.length;
  const pos = (l: number, i: number) => [30 + (l * (W - 60)) / (L - 1), H / 2 + (i - (net.sizes[l] - 1) / 2) * Math.min(26, (H - 30) / net.sizes[l])];
  const maxW = Math.max(...net.W.flat(2).map(Math.abs), 1e-9);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      {net.W.map((m, l) =>
        m.map((row, j) =>
          row.map((w, i) => {
            const [x1, y1] = pos(l, i);
            const [x2, y2] = pos(l + 1, j);
            return <line key={`${l}-${j}-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={w >= 0 ? "var(--c1)" : "var(--c2)"} strokeWidth={0.5 + (Math.abs(w) / maxW) * 4} opacity={0.75} />;
          }),
        ),
      )}
      {net.sizes.map((n, l) =>
        Array.from({ length: n }, (_, i) => {
          const [x, y] = pos(l, i);
          return <circle key={`${l}-${i}`} cx={x} cy={y} r={9} fill={l === 0 ? "var(--c3)" : l === L - 1 ? "var(--c4)" : "var(--card)"} stroke="var(--text)" strokeWidth={1.5} />;
        }),
      )}
      <text x={30} y={H - 4} textAnchor="middle" className="tick">
        x, y
      </text>
      <text x={W - 30} y={H - 4} textAnchor="middle" className="tick">
        p
      </text>
    </svg>
  );
}

export function NeuralNet() {
  const { t } = useLang();
  const [toy, setToy] = useState<Toy>("circle");
  const [hidden, setHidden] = useState(6);
  const [layers, setLayers] = useState(2);
  const [lr, setLr] = useState(0.3);
  const [playing, setPlaying] = useState(false);
  const [, setTick] = useState(0);
  const data = useMemo(() => toyData(toy), [toy]);
  const sizes = useMemo(() => [2, ...new Array(layers).fill(hidden), 1], [layers, hidden]);
  const net = useRef<Net>(netInit(sizes));
  const losses = useRef<number[]>([]);
  const epoch = useRef(0);

  const reset = () => {
    net.current = netInit(sizes, 3 + epoch.current);
    losses.current = [];
    epoch.current = 0;
    setTick((x) => x + 1);
  };
  useEffect(reset, [sizes, toy]); // eslint-disable-line react-hooks/exhaustive-deps

  const train = (n: number) => {
    for (let i = 0; i < n; i++) {
      const l = netTrain(net.current, data.X, data.y, lr);
      epoch.current++;
      if (epoch.current % 5 === 0) losses.current.push(l);
    }
    if (losses.current.length > 300) losses.current = losses.current.filter((_, i) => i % 2 === 0);
    setTick((x) => x + 1);
  };
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => train(10), 40);
    return () => clearInterval(id);
  });

  const N = 30;
  const cells: { x: number; y: number; p: number }[] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const x = -1.3 + (2.6 * (i + 0.5)) / N;
      const y = -1.3 + (2.6 * (j + 0.5)) / N;
      cells.push({ x, y, p: netForward(net.current, [x, y]).at(-1)![0] });
    }
  const acc = mean(data.X.map((x, i) => ((netForward(net.current, x).at(-1)![0] >= 0.5 ? 1 : 0) === data.y[i] ? 1 : 0)));
  const cw = 2.6 / N;

  return (
    <>
      <p>
        {t({
          en: "A neural network is many tiny calculators (neurons) connected in layers. Each one does something very simple, but together they can learn complicated shapes. Pick a pattern, press ▶ Train, and watch the coloured background learn to separate blue from orange.",
          bn: "নিউরাল নেটওয়ার্ক হলো স্তরে স্তরে জোড়া লাগানো অনেকগুলো ছোট ক্যালকুলেটর (নিউরন)। প্রতিটা খুব সাধারণ কাজ করে, কিন্তু সবাই মিলে জটিল আকৃতিও শিখে ফেলে। একটা প্যাটার্ন বাছুন, ▶ ট্রেন চাপুন, আর দেখুন রঙিন পটভূমি কীভাবে নীল আর কমলাকে আলাদা করতে শেখে।",
        })}
      </p>
      <Plain k="nn" />
      <div className="chips" style={{ marginBottom: 12 }}>
        {TOYS.map((d) => (
          <button key={d.id} className={`chip-btn${toy === d.id ? " on" : ""}`} onClick={() => setToy(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="grid cols2">
        <div className="card">
          <Scatter
            points={data.X.map((p, i) => ({ x: p[0], y: p[1], c: data.y[i] ? 0 : 1, r: 3.4 }))}
            xDomain={[-1.3, 1.3]}
            yDomain={[-1.3, 1.3]}
            h={380}
            w={420}
            under={({ sx, sy }) =>
              cells.map((c, i) => (
                <rect
                  key={i}
                  x={sx(c.x - cw / 2)}
                  y={sy(c.y + cw / 2)}
                  width={sx(cw) - sx(0) + 0.6}
                  height={sy(0) - sy(cw) + 0.6}
                  style={{ fill: `color-mix(in srgb, var(--c1) ${(c.p * 100).toFixed(0)}%, var(--c2))` }}
                  opacity={0.28}
                />
              ))
            }
          />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => setPlaying(!playing)}>
              {playing ? "⏸ " + t({ en: "Pause", bn: "থামুন" }) : "▶ " + t({ en: "Train", bn: "ট্রেন করুন" })}
            </button>
            <button className="btn ghost" onClick={() => train(50)}>
              +50 {t({ en: "epochs", bn: "ইপক" })}
            </button>
            <button className="btn ghost" onClick={reset}>
              ↺ {t({ en: "New weights", bn: "নতুন ওজন" })}
            </button>
          </div>
        </div>
        <div className="card">
          <div className="stats">
            <Stat label="epoch" value={String(epoch.current)} />
            <Stat label="accuracy" value={(acc * 100).toFixed(0) + "%"} />
            <Stat label="loss" value={losses.current.length ? losses.current[losses.current.length - 1].toFixed(3) : "–"} />
          </div>
          <h3 style={{ marginTop: 12 }}>{t({ en: "The network", bn: "নেটওয়ার্ক" })}</h3>
          <NetDiagram net={net.current} />
          <p className="muted small" style={{ margin: 0 }}>
            {t({ en: "Blue lines = positive weights, orange = negative; thicker = stronger.", bn: "নীল রেখা = ধনাত্মক ওজন, কমলা = ঋণাত্মক; মোটা = বেশি শক্তিশালী।" })}
          </p>
          <div className="grid cols2" style={{ gap: 8, marginTop: 8 }}>
            <Slider label={t({ en: "hidden layers", bn: "হিডেন লেয়ার" })} value={layers} min={1} max={3} step={1} onChange={setLayers} />
            <Slider label={t({ en: "neurons per layer", bn: "প্রতি লেয়ারে নিউরন" })} value={hidden} min={1} max={8} step={1} onChange={setHidden} />
          </div>
          <Slider label={t({ en: "learning rate", bn: "লার্নিং রেট" })} value={lr} min={0.03} max={1.5} step={0.03} show={lr.toFixed(2)} onChange={setLr} />
          {losses.current.length > 1 && <Lines series={[{ name: "loss", values: losses.current }]} h={150} />}
        </div>
      </div>
      <Callout kind="idea" title={{ en: "Try these", bn: "এগুলো চেষ্টা করুন" }}>
        <p>
          {t({
            en: "1 layer with 1 neuron can only draw a straight line — it fails on the circle. Add neurons and layers to solve XOR and the spiral. This is exactly why 'deep' learning uses many layers.",
            bn: "১টি লেয়ারে ১টি নিউরন শুধু সরলরেখা আঁকতে পারে — বৃত্তে ব্যর্থ হয়। XOR ও সর্পিল সমাধানে নিউরন ও লেয়ার বাড়ান। ঠিক এই কারণেই ‘ডিপ’ লার্নিংয়ে অনেক লেয়ার ব্যবহার হয়।",
          })}
        </p>
      </Callout>
    </>
  );
}

// ---- Time-series forecasting ------------------------------------------------------
const METHODS: { id: Method; label: string }[] = [
  { id: "naive", label: "Naive" },
  { id: "ma", label: "Moving average" },
  { id: "ses", label: "Exp. smoothing" },
  { id: "holt", label: "Holt (trend)" },
];
const TRAIN = 200;

export function Forecast() {
  const { t } = useLang();
  const [ticker, setTicker] = useState("BRACBANK");
  const [method, setMethod] = useState<Method>("holt");
  const [win, setWin] = useState(10);
  const [alpha, setAlpha] = useState(0.4);
  const [beta, setBeta] = useState(0.1);
  const series = useMemo(() => dataset("stock_prices").rows.filter((r) => r.ticker === ticker).map((r) => r.close as number), [ticker]);
  const hist = series.slice(0, TRAIN);
  const actual = series.slice(TRAIN);
  const opts = { window: win, alpha, beta };
  const out = forecast(hist, method, actual.length, opts);
  const scores = METHODS.map((m) => ({ m, err: mae(actual, forecast(hist, m.id, actual.length, opts).forecast) })).sort((a, b) => a.err - b.err);

  return (
    <>
      <p>
        {t({
          en: "Forecasting means guessing the future from the past. We hide the last 50 days of stock prices, ask each method to guess them, and then compare the guesses with what really happened.",
          bn: "ফোরকাস্টিং মানে অতীত দেখে ভবিষ্যৎ আন্দাজ করা। আমরা শেয়ারের দামের শেষ ৫০ দিন লুকিয়ে রাখি, প্রতিটা পদ্ধতিকে সেগুলো আন্দাজ করতে বলি, তারপর আসলে যা হয়েছিল তার সাথে মিলিয়ে দেখি।",
        })}
      </p>
      <Plain k="forecast" />
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
          {["GP", "BRACBANK", "SQURPHARMA"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <div className="chips">
          {METHODS.map((m) => (
            <button key={m.id} className={`chip-btn${method === m.id ? " on" : ""}`} onClick={() => setMethod(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <XY
          series={[
            { name: t({ en: "actual price", bn: "আসল দাম" }), pts: series.map((v, i) => [i, v] as [number, number]), color: "var(--c1)" },
            {
              name: t({ en: "model fit (1 day ahead)", bn: "মডেল ফিট (১ দিন আগে)" }),
              pts: out.fitted.map((v, i) => [i, v] as [number, number | null]).filter((p): p is [number, number] => p[1] !== null),
              dashed: true,
              color: "var(--c4)",
            },
            { name: t({ en: "forecast", bn: "পূর্বাভাস" }), pts: [[TRAIN - 1, hist[TRAIN - 1]], ...out.forecast.map((v, i) => [TRAIN + i, v] as [number, number])], color: "var(--c2)" },
          ]}
          bands={[{ from: TRAIN, to: series.length - 1, label: t({ en: "hidden future", bn: "লুকানো ভবিষ্যৎ" }) }]}
          xLabel={t({ en: "trading day", bn: "কার্যদিবস" })}
          yLabel="BDT"
          h={340}
        />
        <div className="grid cols3" style={{ gap: 10, marginTop: 8 }}>
          {method === "ma" && <Slider label={t({ en: "window (days)", bn: "উইন্ডো (দিন)" })} value={win} min={2} max={60} step={1} onChange={setWin} />}
          {(method === "ses" || method === "holt") && <Slider label="α (level)" value={alpha} min={0.05} max={1} step={0.05} show={alpha.toFixed(2)} onChange={setAlpha} />}
          {method === "holt" && <Slider label="β (trend)" value={beta} min={0} max={0.5} step={0.02} show={beta.toFixed(2)} onChange={setBeta} />}
        </div>
      </div>
      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="stats">
            <Stat label="MAE" value={fmt(mae(actual, out.forecast)) + " ৳"} hint="Mean absolute error over the 50 hidden days" />
            <Stat label="MAPE" value={mape(actual, out.forecast).toFixed(1) + "%"} hint="Mean absolute percentage error" />
          </div>
          <h3 style={{ marginTop: 12 }}>{t({ en: "Leaderboard (lower error is better)", bn: "লিডারবোর্ড (কম ত্রুটি ভালো)" })}</h3>
          <HBars
            items={scores.map((s, i) => ({ label: s.m.label, value: s.err, color: i === 0 ? "var(--c3)" : s.m.id === method ? "var(--c2)" : "var(--c8)" }))}
            format={(v) => fmt(v) + " ৳"}
          />
        </div>
        <Callout kind="warn" title={{ en: "Honest truth about stock prices", bn: "শেয়ারের দাম নিয়ে সত্যি কথা" }}>
          <p>
            {t({
              en: "These prices were generated as a random walk, like real markets are close to one. Fancy methods often fail to beat the 'naive' forecast (tomorrow = today). Always compare against a simple baseline before trusting a model.",
              bn: "এই দামগুলো র‍্যান্ডম ওয়াক হিসেবে তৈরি, আর আসল বাজারও প্রায় তেমনই। জটিল পদ্ধতি প্রায়ই ‘নাইভ’ পূর্বাভাসকে (আগামীকাল = আজ) হারাতে পারে না। মডেলকে বিশ্বাস করার আগে সবসময় সরল বেসলাইনের সাথে তুলনা করুন।",
            })}
          </p>
          <p>
            {t({
              en: "Forecasting shines on series with real structure: seasonality (Eid shopping), trends (mobile banking growth) or cycles.",
              bn: "যেসব সিরিজে আসল কাঠামো আছে সেখানে ফোরকাস্টিং ভালো কাজ করে: মৌসুমি প্রভাব (ঈদের কেনাকাটা), ট্রেন্ড (মোবাইল ব্যাংকিংয়ের বৃদ্ধি) বা চক্র।",
            })}
          </p>
        </Callout>
      </div>
    </>
  );
}
