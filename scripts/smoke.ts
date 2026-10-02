// Run with: npm test   — checks that every SQL lesson executes and the ML code behaves sensibly.
import initSqlJs from "sql.js";
import { DATASETS, columnsOf } from "../src/data/generate";
import { SCHEMA } from "../src/data/schema";
import { LESSONS } from "../src/data/lessons";
import { STEPS, RAW, runUpTo, qualityChecks, LOAD_SETUP, GOLD_SQL } from "../src/data/pipeline";
import { roc, knn, netInit, netTrain, netForward, toyData, forecast, mae, pca2 } from "../src/ml/extra";
import { tokenize, getMerges, EMB, nearest, retrieve, nextWord, attention } from "../src/llm/engine";
import { buildTree, confusion, fitScaler, applyScaler, trainLogistic, predictProba, kmeansFit, linClosedForm, linInit, linStep, treeProba, splitIndices } from "../src/ml/core";

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failed++;
};

const SQL = await initSqlJs();
const db = new SQL.Database();
for (const ds of DATASETS) {
  const cols = columnsOf(ds.rows);
  db.run(`CREATE TABLE ${ds.id} (${SCHEMA[ds.id]});`);
  const st = db.prepare(`INSERT INTO ${ds.id} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`);
  for (const r of ds.rows) st.run(cols.map((c) => r[c]) as never);
  st.free();
  console.log(`  ${ds.id}: ${ds.rows.length} rows`);
}

for (const l of LESSONS) {
  try {
    const res = db.exec(l.sql);
    const n = res[0]?.values.length ?? 0;
    ok(n > 0, `SQL lesson "${l.id}" returns ${n} rows`);
  } catch (e) {
    ok(false, `SQL lesson "${l.id}" threw: ${e}`);
  }
}
console.log(db.exec(LESSONS[LESSONS.length - 1].sql)[0].values.map((r) => r.join(" | ")).join("\n"));

// pipeline
const final = runUpTo(STEPS.length - 1);
ok(final.rows.length === 5 && final.rejected.length === 3, `pipeline: 9 raw -> ${final.rows.length} clean + ${final.rejected.length} rejected`);
ok(qualityChecks({ rows: RAW, rejected: [] }).some((c) => !c.pass), "pipeline: raw data fails checks");
ok(qualityChecks(final).every((c) => c.pass), "pipeline: clean data passes all checks");
const g = new SQL.Database();
g.run(LOAD_SETUP(final.rows));
ok(g.exec(GOLD_SQL)[0].values.length > 0, "pipeline: gold query runs on loaded table");

// ML
const loans = db.exec("SELECT l.defaulted, c.credit_score, l.amount*1.0/(c.monthly_income*12), l.interest_rate FROM loans l JOIN customers c ON c.id=l.customer_id")[0].values as number[][];
const X = loans.map((r) => r.slice(1));
const y = loans.map((r) => r[0]);
const sp = splitIndices(X.length, 0.25);
const sc = fitScaler(sp.train.map((i) => X[i]));
const Zt = applyScaler(sp.train.map((i) => X[i]), sc);
const Zs = applyScaler(sp.test.map((i) => X[i]), sc);
const yt = sp.train.map((i) => y[i]);
const ys = sp.test.map((i) => y[i]);
const { model, losses } = trainLogistic(Zt, yt, 200, 0.3);
ok(losses[losses.length - 1] < losses[0], "logistic: loss decreases");
ok(model.w[0] < 0, `logistic: credit score weight is negative (${model.w[0].toFixed(2)})`);
const m = confusion(ys, Zs.map((x) => (predictProba(model, x) >= 0.5 ? 1 : 0)));
console.log(`  default rate ${(100 * y.reduce((a, b) => a + b, 0) / y.length).toFixed(1)}%, test acc ${(m.accuracy * 100).toFixed(1)}%, recall ${(m.recall * 100).toFixed(1)}%`);
const tree = buildTree(sp.train.map((i) => X[i]), yt, 4);
const tacc = sp.test.map((i, k) => ((treeProba(tree, X[i]) >= 0.5 ? 1 : 0) === ys[k] ? 1 : 0) as number).reduce((a, b) => a + b, 0) / ys.length;
ok(!tree.leaf && tacc > 0.6, `tree: test accuracy ${(tacc * 100).toFixed(1)}%`);

const sd = db.exec("SELECT c.monthly_income/1000.0, SUM(t.amount)/1000.0 FROM customers c JOIN transactions t ON t.customer_id=c.id GROUP BY c.id")[0].values as number[][];
const xs = sd.map((r) => r[0]);
const ysd = sd.map((r) => r[1]);
const zx = applyScaler(xs.map((v) => [v]), fitScaler(xs.map((v) => [v]))).map((r) => r[0]);
const zy = applyScaler(ysd.map((v) => [v]), fitScaler(ysd.map((v) => [v]))).map((r) => r[0]);
let s = linInit();
for (let i = 0; i < 300; i++) s = linStep(zx, zy, s, 0.1);
const ex = linClosedForm(zx, zy);
ok(Math.abs(s.w - ex.w) < 0.01, `linear: GD slope ${s.w.toFixed(3)} ~ closed form ${ex.w.toFixed(3)}`);
const km = kmeansFit(zx.map((a, i) => [a, zy[i]] as [number, number]), 3);
const k1 = kmeansFit(zx.map((a, i) => [a, zy[i]] as [number, number]), 1);
ok(km.inertia < k1.inertia, "kmeans: k=3 inertia < k=1 inertia");

// --- new ML models
const r = roc(ys, Zs.map((x) => predictProba(model, x)));
ok(r.auc > 0.75, `roc: AUC ${r.auc.toFixed(3)}`);
const kn = knn(Zt.map((z) => [z[0], z[1]] as [number, number]), yt, [-2, 2], 9);
ok(kn.p > 0.5, `knn: low score + high loan ratio looks risky (p=${kn.p.toFixed(2)})`);
for (const toy of ["circle", "xor", "moons"] as const) {
  const d = toyData(toy);
  const net = netInit([2, 6, 6, 1]);
  let first = 0, last = 0;
  for (let e = 0; e < 1500; e++) { last = netTrain(net, d.X, d.y, 0.3); if (e === 0) first = last; }
  const acc = d.X.filter((x, i) => ((netForward(net, x).at(-1)![0] >= 0.5 ? 1 : 0) === d.y[i])).length / d.X.length;
  ok(acc > 0.9 && last < first, `neural net learns ${toy}: acc ${(acc * 100).toFixed(0)}%, loss ${first.toFixed(2)} -> ${last.toFixed(2)}`);
}
const prices = db.exec("SELECT close FROM stock_prices WHERE ticker='GP' ORDER BY trade_date")[0].values.map((v) => v[0] as number);
const fc = forecast(prices.slice(0, 200), "holt", 50, { window: 10, alpha: 0.4, beta: 0.1 });
ok(fc.forecast.length === 50 && fc.fitted.length === 200 && isFinite(mae(prices.slice(200), fc.forecast)), "forecast: shapes and error are valid");
const pc = pca2(Object.values(EMB));
ok(pc.explained[0] >= pc.explained[1] && pc.explained[0] + pc.explained[1] <= 1.0001, `pca: explained ${pc.explained.map((e) => e.toFixed(2)).join(", ")}`);

// --- LLM engine
const MERGES = getMerges();
ok(MERGES.length > 50, `bpe: learned ${MERGES.length} merges`);
ok(tokenize("the customer", 0).length > tokenize("the customer").length, "bpe: merges reduce token count");
ok(tokenize("the customer").join("|") === "▁the|▁customer", `bpe: frequent words become single tokens (${tokenize("the customer").join("|")})`);
const an = nearest(EMB.dhaka.map((x, i) => x - EMB.bangladesh[i] + EMB.india[i]), 1, ["dhaka", "bangladesh", "india"])[0].w;
ok(an === "delhi", `embeddings: dhaka - bangladesh + india = ${an}`);
ok(nearest(EMB["ঋণ"], 1, ["ঋণ"])[0].w === "loan", "embeddings: ঋণ is nearest to loan");
const top = (q: string) => retrieve(q)[0].doc.title.en;
ok(top("What credit score do I need for a loan?") === "Loan eligibility", `rag: credit score question -> ${top("What credit score do I need for a loan?")}`);
ok(top("কার্ড হারিয়ে গেছে, কী করব?") === "Lost card", `rag: Bangla lost-card question -> ${top("কার্ড হারিয়ে গেছে, কী করব?")}`);
ok(top("Someone called asking for my OTP") === "Fraud safety", `rag: OTP question -> ${top("Someone called asking for my OTP")}`);
const nw = nextWord("the stock price", 1, 20, 1);
ok(Math.abs(nw.cands.reduce((a, c) => a + c.p, 0) - 1) < 1e-9 && nw.cands[0].w === "went", `sampling: distribution sums to 1, top = ${nw.cands[0].w} (${nw.source})`);
ok(nextWord("the stock price", 0.1, 1, 1).cands.filter((c) => c.kept).length === 1, "sampling: top-k=1 keeps one candidate");
const att = attention(["bank", "loan", "fish"], 3, true);
ok(att.every((row) => Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 1e-9) && att[0][1] === 0, "attention: rows sum to 1, causal mask hides the future");

// --- new datasets
const one = (q: string) => db.exec(q)[0].values[0];
const [orders, custs] = one("SELECT COUNT(*), COUNT(DISTINCT customer_id) FROM shop_orders") as number[];
ok(orders > 1000 && custs > 200, `shop_orders: ${orders} orders from ${custs} customers`);
const eid = one("SELECT SUM(quantity*unit_price) FROM shop_orders WHERE strftime('%Y-%m', order_date) IN ('2024-03','2024-06','2025-03','2025-05')")[0] as number;
const calm = one("SELECT SUM(quantity*unit_price) FROM shop_orders WHERE strftime('%Y-%m', order_date) IN ('2024-08','2024-09','2024-11','2024-12')")[0] as number;
ok(eid > calm * 1.3, `shop_orders: Eid months sell more (${Math.round(eid / 1000)}k vs ${Math.round(calm / 1000)}k)`);
const quit = db.exec("SELECT satisfaction, AVG(left_company) FROM employees GROUP BY satisfaction ORDER BY satisfaction")[0].values as number[][];
ok(quit[0][1] > quit[quit.length - 1][1], `employees: unhappy people quit more (${(quit[0][1] * 100).toFixed(0)}% vs ${(quit[quit.length - 1][1] * 100).toFixed(0)}%)`);
const air = db.exec("SELECT month, AVG(aqi) FROM dhaka_air GROUP BY month")[0].values as [string, number][];
const aqi = Object.fromEntries(air);
ok(aqi.Jan > 2 * aqi.Jul, `dhaka_air: January (${Math.round(aqi.Jan)}) much worse than July (${Math.round(aqi.Jul)})`);
const st = db.exec("SELECT study_hours_week, final_score FROM students")[0].values as number[][];
const { pearson } = await import("../src/ml/core");
const rs = pearson(st.map((r) => r[0]), st.map((r) => r[1]));
ok(rs > 0.6, `students: study hours vs score r = ${rs.toFixed(2)}`);

// --- RFM
const { buildRfm, SEGMENTS } = await import("../src/pages/MLRfm");
const rfm = buildRfm();
const segCount = SEGMENTS.map((_, i) => rfm.filter((c) => c.seg === i).length);
ok(segCount.filter((n) => n > 0).length >= 6, `rfm: ${segCount.filter((n) => n > 0).length} non-empty segments (${segCount.join(", ")})`);
const champs = rfm.filter((c) => c.seg === 0);
const champRev = champs.reduce((a, c) => a + c.monetary, 0) / rfm.reduce((a, c) => a + c.monetary, 0);
ok(champRev > champs.length / rfm.length, `rfm: champions are ${((champs.length / rfm.length) * 100).toFixed(0)}% of customers but ${(champRev * 100).toFixed(0)}% of revenue`);
ok(rfm.every((c) => [c.r, c.f, c.m].every((s) => s >= 1 && s <= 5)), "rfm: all scores are between 1 and 5");

// --- AI agent
const { TASKS, route } = await import("../src/pages/LLMAgent");
TASKS.forEach((task, i) => {
  ok(route(task.q.en) === i && route(task.q.bn) === i, `agent: routes "${task.q.en}" (EN + BN)`);
  const res = db.exec(task.sql)[0];
  const ans = task.answer(res.values as never);
  ok(!/undefined|NaN/.test(ans.en + ans.bn), `agent: answer -> ${ans.en}`);
});
ok(route("what is the weather on mars") === -1, "agent: unrelated question is refused");

// --- CSV
const { toCsv, parseCsv } = await import("../src/data/csv");
const back = parseCsv(toCsv(DATASETS[0].rows.slice(0, 5)));
ok(JSON.stringify(back) === JSON.stringify(DATASETS[0].rows.slice(0, 5)), "csv: download -> upload round-trip is lossless");
ok(parseCsv('a,b\n"x, y",2\n"say ""hi""",3')[1].a === 'say "hi"', "csv: quoted commas and quotes are parsed");

// --- SQL answer checker
const { compare, sortsResult } = await import("../src/data/check");
const res = (q: string) => {
  const r = db.exec(q)[0];
  return { columns: r?.columns ?? [], rows: (r?.values ?? []) as unknown[][] };
};
for (const l of LESSONS.filter((x) => x.solutions)) {
  const sol = l.solutions![0];
  ok(res(sol).rows.length > 0 && compare(res(sol), res(sol), sortsResult(sol)).ok, `checker: "${l.id}" solution returns rows and grades itself correct`);
  const starter = compare(res(l.sql), res(sol), sortsResult(sol));
  ok(!starter.ok, `checker: "${l.id}" unchanged starter query is NOT accepted`);
}
const extraCol = compare(res("SELECT name, city, age FROM customers WHERE age BETWEEN 30 AND 40 AND city IN ('Sylhet','Khulna')"), res(LESSONS.find((l) => l.id === "where")!.solutions![0]), false);
ok(extraCol.ok, "checker: extra columns and different column order are accepted");
const wrongOrder = compare(res("SELECT name FROM customers ORDER BY age DESC, credit_score DESC LIMIT 5"), res("SELECT name FROM customers ORDER BY age, credit_score DESC LIMIT 5"), true);
ok(!wrongOrder.ok, `checker: wrong sort is rejected (${!wrongOrder.ok ? wrongOrder.reason : ""})`);
const rounded = compare(res("SELECT department, ROUND(100.0*AVG(left_company),1) AS pct FROM employees GROUP BY department ORDER BY pct DESC"), res(LESSONS.find((l) => l.id === "attrition")!.solutions![0]), true);
ok(rounded.ok, "checker: attrition answer with an extra rounded column is accepted");
ok(sortsResult("SELECT * FROM (SELECT RANK() OVER (ORDER BY x) r FROM t)") === false && sortsResult("SELECT a FROM t ORDER BY a") === true, "checker: ORDER BY inside OVER() is not treated as sorting the result");

db.close();
console.log(failed ? `\n${failed} FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
