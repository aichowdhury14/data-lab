import { useEffect, useMemo, useState } from "react";
import { useLang } from "../i18n";
import { dataset } from "../data/generate";
import { buildTree, treeProba } from "../ml/core";
import { roc } from "../ml/extra";
import { accuracy, buildBaskets, featureImportance, forestProba, gbmProba, logLoss, recommendFor, similar, trainForest, trainGBM } from "../ml/ensemble";
import { trainLogistic, predictProba, fitScaler, applyScaler } from "../ml/core";
import { FEATURES, Xtest, Xtrain, ytest, ytrain } from "../ml/loanData";
import { HBars, XY } from "../components/charts";
import { Callout, Plain, Slider, Stat } from "../components/ui";
import { digits } from "../numerals";

const pct = (v: number) => (v * 100).toFixed(1) + "%";
const MAX_TREES = 60;

// ---- Random forest -------------------------------------------------------------------------
export function RandomForest() {
  const { t } = useLang();
  const [trees, setTrees] = useState(25);
  const [depth, setDepth] = useState(5);
  const forest = useMemo(() => trainForest(Xtrain, ytrain, { trees: MAX_TREES, depth, mtry: 2 }), [depth]);
  const single = useMemo(() => buildTree(Xtrain, ytrain, depth), [depth]);
  const singleAcc = accuracy(ytest, Xtest.map((x) => treeProba(single, x)));
  const curve = useMemo(() => {
    const pts: [number, number][] = [];
    for (let n = 1; n <= MAX_TREES; n += n < 10 ? 1 : 5) pts.push([n, accuracy(ytest, Xtest.map((x) => forestProba(forest, x, n)))]);
    return pts;
  }, [forest]);
  const p = Xtest.map((x) => forestProba(forest, x, trees));
  const acc = accuracy(ytest, p);
  const auc = roc(ytest, p).auc;
  const imp = featureImportance(forest.slice(0, trees), 3);
  // how much the trees disagree on one example loan — the "wisdom of the crowd"
  const sample = Xtest[3];
  const votes = forest.slice(0, trees).map((tr) => treeProba(tr, sample));
  const yes = votes.filter((v) => v >= 0.5).length;

  return (
    <>
      <p>
        {t({
          en: "One decision tree can be fooled by a few unusual loans. A random forest grows many trees — each one sees a slightly different random sample of the data and only some of the columns at each question — and then lets them vote. The mistakes of individual trees cancel out.",
          bn: "একটা ডিসিশন ট্রি কয়েকটা অস্বাভাবিক ঋণ দেখে ভুল শিখতে পারে। র‍্যান্ডম ফরেস্ট অনেকগুলো ট্রি বানায় — প্রতিটা ডেটার একটু আলাদা এলোমেলো নমুনা দেখে, আর প্রতিটা প্রশ্নে কিছু কলাম দেখে — তারপর সবাই ভোট দেয়। আলাদা আলাদা ট্রির ভুলগুলো একে অপরকে কাটাকাটি করে।",
        })}
      </p>
      <Plain text={{ en: "Asking one friend for directions is risky. Asking 25 people and going with the majority is much safer — even if a few of them are wrong.", bn: "একজন বন্ধুকে রাস্তা জিজ্ঞেস করা ঝুঁকির। ২৫ জনকে জিজ্ঞেস করে বেশিরভাগ যা বলে তা মানা অনেক নিরাপদ — কয়েকজন ভুল বললেও।" }} />
      <div className="grid cols2">
        <div className="card">
          <Slider label={t({ en: "number of trees", bn: "ট্রির সংখ্যা" })} value={trees} min={1} max={MAX_TREES} step={1} onChange={setTrees} />
          <Slider label={t({ en: "max depth of each tree", bn: "প্রতিটা ট্রির সর্বোচ্চ গভীরতা" })} value={depth} min={2} max={8} step={1} onChange={setDepth} />
          <div className="stats" style={{ marginTop: 10 }}>
            <Stat label={t({ en: "forest accuracy", bn: "ফরেস্টের accuracy" })} value={pct(acc)} />
            <Stat label={t({ en: "one tree alone", bn: "শুধু একটা ট্রি" })} value={pct(singleAcc)} />
            <Stat label="AUC" value={auc.toFixed(3)} hint="How well it ranks risky loans above safe ones (1 = perfect)" />
          </div>
          <h3 style={{ marginTop: 14 }}>{t({ en: "More trees → steadier answers", bn: "বেশি ট্রি → স্থির উত্তর" })}</h3>
          <XY
            series={[
              { name: t({ en: "forest (test)", bn: "ফরেস্ট (টেস্ট)" }), pts: curve, color: "var(--c3)" },
              { name: t({ en: "single tree", bn: "একটা ট্রি" }), pts: [[1, singleAcc], [MAX_TREES, singleAcc]], dashed: true, color: "var(--c8)" },
            ]}
            markers={[{ x: trees, y: acc }]}
            xLabel={t({ en: "number of trees", bn: "ট্রির সংখ্যা" })}
            h={220}
          />
        </div>
        <div className="card">
          <h3>{t({ en: "The trees vote on one loan", bn: "একটা ঋণের ওপর ট্রিদের ভোট" })}</h3>
          <div className="votes" aria-label={`${yes} of ${trees} trees say default`}>
            {votes.map((v, i) => (
              <span key={i} className={v >= 0.5 ? "yes" : "no"} title={`tree ${i + 1}: ${(v * 100).toFixed(0)}%`} />
            ))}
          </div>
          <p className="small">
            {digits(
              t({
                en: `${yes} of ${trees} trees say “default”, ${trees - yes} say “repays”. Majority: ${yes * 2 > trees ? "default" : "repays"} (actual: ${ytest[3] ? "defaulted" : "repaid"}).`,
                bn: `${trees}টা ট্রির মধ্যে ${yes}টা বলছে “খেলাপি”, ${trees - yes}টা বলছে “পরিশোধ”। বেশিরভাগ: ${yes * 2 > trees ? "খেলাপি" : "পরিশোধ"} (আসলে: ${ytest[3] ? "খেলাপি হয়েছে" : "পরিশোধ করেছে"})।`,
              }),
            )}
          </p>
          <h3 style={{ marginTop: 14 }}>{t({ en: "What the forest relies on", bn: "ফরেস্ট কোন তথ্যের ওপর ভরসা করে" })}</h3>
          <HBars items={imp.map((v, i) => ({ label: t(FEATURES[i]), value: v, color: "var(--c4)" }))} max={1} />
          <p className="muted small" style={{ margin: 0 }}>
            {t({ en: "Feature importance: how much each column helped separate defaulters from payers, across all trees.", bn: "ফিচার ইম্পরট্যান্স: সব ট্রি মিলিয়ে কোন কলাম খেলাপি আর পরিশোধকারীকে আলাদা করতে কতটা সাহায্য করেছে।" })}
          </p>
        </div>
      </div>
    </>
  );
}

// ---- Gradient boosting ------------------------------------------------------------------------
export function Boosting() {
  const { t } = useLang();
  const [lr, setLr] = useState(0.1);
  const [rounds, setRounds] = useState(1);
  const [playing, setPlaying] = useState(false);
  const model = useMemo(() => trainGBM(Xtrain, ytrain, { rounds: 120, lr, depth: 2 }), [lr]);
  const losses = useMemo(() => {
    const train: [number, number][] = [];
    const test: [number, number][] = [];
    for (let r = 1; r <= 120; r += r < 20 ? 1 : 4) {
      train.push([r, logLoss(ytrain, Xtrain.map((x) => gbmProba(model, x, r)))]);
      test.push([r, logLoss(ytest, Xtest.map((x) => gbmProba(model, x, r)))]);
    }
    return { train, test };
  }, [model]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setRounds((r) => Math.min(120, r + 2)), 60);
    return () => clearInterval(id);
  }, [playing]);
  useEffect(() => {
    if (rounds >= 120) setPlaying(false);
  }, [rounds]);
  const p = Xtest.map((x) => gbmProba(model, x, rounds));
  const bestTest = losses.test.reduce((a, b) => (b[1] < a[1] ? b : a));

  return (
    <>
      <p>
        {t({
          en: "Boosting builds tiny trees one after another. Each new tree looks at what the previous trees got wrong and tries to fix just that. Hundreds of small corrections add up to a very strong model — this family (XGBoost, LightGBM) wins most competitions on table data.",
          bn: "বুস্টিং ছোট ছোট ট্রি একটার পর একটা বানায়। প্রতিটা নতুন ট্রি দেখে আগের ট্রিগুলো কোথায় ভুল করেছে, আর শুধু সেটুকু ঠিক করার চেষ্টা করে। শত শত ছোট সংশোধন মিলে খুব শক্তিশালী মডেল তৈরি হয় — টেবিল ডেটার বেশিরভাগ প্রতিযোগিতা এই পরিবারই (XGBoost, LightGBM) জেতে।",
        })}
      </p>
      <Plain text={{ en: "Like a student correcting a practice paper: first fix the big mistakes, then the smaller ones, then the tiny ones. Too many rounds, though, and they start memorising the paper instead of learning.", bn: "যেন একজন ছাত্র অনুশীলনের খাতা ঠিক করছে: আগে বড় ভুলগুলো, তারপর ছোটগুলো, তারপর একদম ছোটগুলো। তবে বেশি রাউন্ড চললে সে শেখার বদলে খাতাটা মুখস্থ করতে শুরু করে।" }} />
      <div className="grid cols2">
        <div className="card">
          <div className="row">
            <button className="btn" onClick={() => setRounds((r) => Math.min(120, r + 1))}>
              + {t({ en: "one more tree", bn: "আরও একটা ট্রি" })}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                if (rounds >= 120) setRounds(1);
                setPlaying(!playing);
              }}
            >
              {playing ? "⏸" : "▶"} {t({ en: "Animate", bn: "অ্যানিমেট" })}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setPlaying(false);
                setRounds(1);
              }}
            >
              ↺
            </button>
          </div>
          <Slider label={t({ en: "trees so far", bn: "এ পর্যন্ত ট্রি" })} value={rounds} min={1} max={120} step={1} onChange={setRounds} />
          <Slider label={t({ en: "learning rate (size of each correction)", bn: "লার্নিং রেট (প্রতিটা সংশোধন কত বড়)" })} value={lr} min={0.02} max={0.5} step={0.02} show={lr.toFixed(2)} onChange={(v) => setLr(v)} />
          <div className="stats" style={{ marginTop: 10 }}>
            <Stat label={t({ en: "test accuracy", bn: "টেস্ট accuracy" })} value={pct(accuracy(ytest, p))} />
            <Stat label="AUC" value={roc(ytest, p).auc.toFixed(3)} />
            <Stat label={t({ en: "test error (log-loss)", bn: "টেস্ট ভুল (log-loss)" })} value={logLoss(ytest, p).toFixed(3)} />
          </div>
        </div>
        <div className="card">
          <h3>{t({ en: "Error as trees are added", bn: "ট্রি যোগ হওয়ার সাথে ভুল" })}</h3>
          <XY
            series={[
              { name: t({ en: "training data", bn: "ট্রেনিং ডেটা" }), pts: losses.train, color: "var(--c1)" },
              { name: t({ en: "unseen test data", bn: "অদেখা টেস্ট ডেটা" }), pts: losses.test, color: "var(--c2)" },
            ]}
            markers={[{ x: rounds, y: logLoss(ytest, p) }]}
            bands={[{ from: Math.min(rounds, 119), to: 120 }]}
            xLabel={t({ en: "number of trees", bn: "ট্রির সংখ্যা" })}
            yLabel="log-loss"
            h={250}
          />
          <p className="muted small" style={{ margin: 0 }}>
            {digits(
              t({
                en: `Training error keeps falling, but test error is lowest around ${bestTest[0]} trees. Stopping there (“early stopping”) avoids memorising.`,
                bn: `ট্রেনিং ভুল কমতেই থাকে, কিন্তু টেস্ট ভুল সবচেয়ে কম প্রায় ${bestTest[0]}টা ট্রিতে। সেখানে থামলে (“আর্লি স্টপিং”) মুখস্থ করা এড়ানো যায়।`,
              }),
            )}
          </p>
        </div>
      </div>
      <Leaderboard />
    </>
  );
}

/** All loan models, trained on the same 75% and judged on the same unseen 25%. */
function Leaderboard() {
  const { t } = useLang();
  const rows = useMemo(() => {
    const sc = fitScaler(Xtrain);
    const lg = trainLogistic(applyScaler(Xtrain, sc), ytrain, 200, 0.3).model;
    const pl = applyScaler(Xtest, sc).map((x) => predictProba(lg, x));
    const tree = buildTree(Xtrain, ytrain, 4);
    const pt = Xtest.map((x) => treeProba(tree, x));
    const forest = trainForest(Xtrain, ytrain, { trees: 40, depth: 5, mtry: 2 });
    const pf = Xtest.map((x) => forestProba(forest, x));
    const gbm = trainGBM(Xtrain, ytrain, { rounds: 60, lr: 0.1, depth: 2 });
    const pg = Xtest.map((x) => gbmProba(gbm, x));
    return [
      { name: { en: "Logistic regression", bn: "লজিস্টিক রিগ্রেশন" }, p: pl },
      { name: { en: "Decision tree", bn: "ডিসিশন ট্রি" }, p: pt },
      { name: { en: "Random forest", bn: "র‍্যান্ডম ফরেস্ট" }, p: pf },
      { name: { en: "Gradient boosting", bn: "গ্রেডিয়েন্ট বুস্টিং" }, p: pg },
    ]
      .map((r) => ({ ...r, auc: roc(ytest, r.p).auc, acc: accuracy(ytest, r.p) }))
      .sort((a, b) => b.auc - a.auc);
  }, []);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>🏁 {t({ en: "Leaderboard: every loan model on the same unseen loans", bn: "লিডারবোর্ড: একই অদেখা ঋণে সব মডেল" })}</h3>
      <HBars items={rows.map((r, i) => ({ label: `${i === 0 ? "🥇 " : ""}${t(r.name)} · ${pct(r.acc)}`, value: r.auc, color: i === 0 ? "var(--c3)" : "var(--c1)" }))} max={1} format={(v) => "AUC " + v.toFixed(3)} />
      <Callout kind="tip" title={{ en: "Why AUC, not just accuracy?", bn: "শুধু accuracy নয়, কেন AUC?" }}>
        <p>
          {t({
            en: "Only ~20% of loans default, so a lazy model can score 80% accuracy by always saying “repays”. AUC measures how well a model ranks risky loans above safe ones — 0.5 is a coin toss, 1.0 is perfect.",
            bn: "মাত্র ~২০% ঋণ খেলাপি হয়, তাই একটা অলস মডেল সবসময় “পরিশোধ” বলেই ৮০% accuracy পেতে পারে। AUC মাপে মডেল ঝুঁকিপূর্ণ ঋণকে নিরাপদ ঋণের ওপরে কতটা ভালোভাবে সাজায় — ০.৫ মানে কয়েন টস, ১.০ মানে নিখুঁত।",
          })}
        </p>
      </Callout>
    </div>
  );
}

// ---- Recommender -------------------------------------------------------------------------------
const BASKETS = buildBaskets(dataset("shop_orders").rows as unknown as { customer_id: number; product: string }[]);

export function Recommender() {
  const { t } = useLang();
  const [product, setProduct] = useState("Panjabi");
  const [customer, setCustomer] = useState(5);
  const sims = similar(BASKETS, product, 6);
  const owned = [...(BASKETS.byCustomer.get(customer) ?? [])];
  const recs = recommendFor(BASKETS, customer, 3);
  const customers = [...BASKETS.byCustomer.keys()].sort((a, b) => a - b);

  return (
    <>
      <p>
        {t({
          en: "Daraz, Amazon and Netflix all do this: “people who bought this also bought…”. The idea is simple — two products are similar if the same customers tend to buy both. No AI model needed, just counting over the online-shop orders.",
          bn: "দারাজ, অ্যামাজন, নেটফ্লিক্স — সবাই এটা করে: “যারা এটা কিনেছেন তারা এটাও কিনেছেন…”। ধারণাটা সহজ — একই গ্রাহকেরা যদি দুটো পণ্য প্রায়ই একসাথে কেনেন, তাহলে পণ্য দুটো একরকম। কোনো এআই মডেল লাগে না, শুধু অনলাইন শপের অর্ডারগুলো গোনা।",
        })}
      </p>
      <Plain text={{ en: "A good shopkeeper notices that people who buy a Panjabi before Eid often come back for a Saree — and keeps them next to each other.", bn: "একজন ভালো দোকানদার খেয়াল করেন, ঈদের আগে যারা পাঞ্জাবি কেনেন তারা প্রায়ই শাড়ির জন্যও আসেন — তাই দুটো পাশাপাশি রাখেন।" }} />
      <div className="grid cols2">
        <div className="card">
          <div className="row">
            <h3 style={{ margin: 0 }}>{t({ en: "Customers who bought", bn: "যারা কিনেছেন" })}</h3>
            <select value={product} onChange={(e) => setProduct(e.target.value)}>
              {BASKETS.products.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <p className="muted small">{t({ en: "…also bought:", bn: "…তাঁরা আরও কিনেছেন:" })}</p>
          <HBars items={sims.map((s) => ({ label: s.product, value: s.alsoPct, color: "var(--c2)" }))} max={1} />
          <p className="muted small" style={{ margin: 0 }}>
            {digits(
              t({
                en: `${BASKETS.buyers.get(product)!.size} customers bought ${product}. ${Math.round(sims[0].alsoPct * 100)}% of them also bought ${sims[0].product}. Ranking uses cosine similarity, so very popular items don't win just for being popular.`,
                bn: `${BASKETS.buyers.get(product)!.size} জন গ্রাহক ${product} কিনেছেন। তাঁদের ${Math.round(sims[0].alsoPct * 100)}% ${sims[0].product}-ও কিনেছেন। সাজানো হয় কোসাইন সিমিলারিটি দিয়ে, তাই শুধু জনপ্রিয় হওয়ার কারণে কোনো পণ্য এগিয়ে যায় না।`,
              }),
            )}
          </p>
        </div>
        <div className="card">
          <div className="row">
            <h3 style={{ margin: 0 }}>{t({ en: "Recommend for customer", bn: "গ্রাহকের জন্য সাজেশন" })}</h3>
            <select value={customer} onChange={(e) => setCustomer(Number(e.target.value))}>
              {customers.map((c) => (
                <option key={c} value={c}>
                  #{c}
                </option>
              ))}
            </select>
          </div>
          <p className="small" style={{ marginBottom: 6 }}>
            {t({ en: "Already bought:", bn: "আগেই কিনেছেন:" })}{" "}
            {owned.map((o) => (
              <span key={o} className="chip">
                {o}
              </span>
            ))}
          </p>
          {recs.length ? (
            <ol className="rec-list">
              {recs.map((r) => (
                <li key={r.product}>
                  <b>{r.product}</b>
                  <span className="muted small">
                    {" "}
                    — {t({ en: "because they bought", bn: "কারণ তাঁরা কিনেছেন" })} {r.because}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">{t({ en: "This customer already owns everything we would suggest.", bn: "এই গ্রাহক আমাদের সব সাজেশন আগেই কিনে ফেলেছেন।" })}</p>
          )}
          <Callout kind="idea" title={{ en: "Try this", bn: "এটা করে দেখুন" }}>
            <p>{t({ en: "Pick a few different customers. Notice how the suggestions change with what each person already bought — that's personalisation.", bn: "কয়েকজন আলাদা গ্রাহক বেছে দেখুন। প্রত্যেকে আগে কী কিনেছেন তার ওপর সাজেশন কীভাবে বদলায় লক্ষ করুন — এটাই পার্সোনালাইজেশন।" })}</p>
          </Callout>
        </div>
      </div>
    </>
  );
}
