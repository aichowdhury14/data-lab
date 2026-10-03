import { useMemo, useState } from "react";
import { useLang } from "../i18n";
import { DATASETS, columnsOf, dataset, type Dataset, type Row } from "../data/generate";
import { downloadCsv, parseCsv } from "../data/csv";
import { mean, median, pearson, std } from "../ml/core";
import { Bars, BoxPlot, Donut, Heatmap, Lines, Scatter, XY, fmt } from "../components/charts";
import { Callout, DataTable, PageHead, Plain, Slider, Stat, Tabs } from "../components/ui";
import { Quiz } from "../components/Quiz";
import { DataQuestions } from "../components/Missions";

function NoNumbers() {
  const { t } = useLang();
  return <p className="muted">{t({ en: "This dataset doesn't have enough number columns for this tab. Try another dataset.", bn: "এই ট্যাবের জন্য এই ডেটাসেটে যথেষ্ট সংখ্যার কলাম নেই। অন্য একটা ডেটাসেট বাছুন।" })}</p>;
}
import { useMark } from "../progress";

type Tab = "profile" | "distribution" | "compare" | "relate" | "trends";

const isNum = (rows: Row[], c: string) => rows.every((r) => r[c] === null || typeof r[c] === "number");

const isId = (c: string) => /(^|_)id$/i.test(c);

export default function Analysis() {
  const { t } = useLang();
  const [dsId, setDsId] = useState("students");
  const [tab, setTab] = useState<Tab>("profile");
  const [uploaded, setUploaded] = useState<Dataset | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  useMark("analysis", tab);
  const all = uploaded ? [...DATASETS, uploaded] : DATASETS;
  const ds = all.find((d) => d.id === dsId) ?? DATASETS[0];
  const { cols, numCols, catCols } = useMemo(() => {
    const cols = columnsOf(ds.rows);
    const numeric = new Map(cols.map((c) => [c, isNum(ds.rows, c)]));
    const distinct = new Map(cols.map((c) => [c, new Set(ds.rows.map((r) => r[c])).size]));
    return {
      cols,
      numCols: cols.filter((c) => numeric.get(c) && !isId(c)),
      catCols: cols.filter(
        (c) => (!numeric.get(c) && !/date|joined|name/i.test(c) && distinct.get(c)! <= 40) || (numeric.get(c) && !isId(c) && distinct.get(c)! <= 6),
      ),
    };
  }, [ds]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) throw new Error("empty");
      setUploaded({ id: "my_file", title: { en: `Your file: ${file.name}`, bn: `আপনার ফাইল: ${file.name}` }, desc: { en: `${rows.length} rows from your computer. It stays in your browser.`, bn: `আপনার কম্পিউটার থেকে ${rows.length}টা সারি। এটা আপনার ব্রাউজারেই থাকে।` }, rows });
      setDsId("my_file");
      setUploadErr(null);
    } catch {
      setUploadErr(t({ en: "Couldn't read that file. Please use a .csv file with a header row.", bn: "ফাইলটা পড়া গেল না। হেডার সারিসহ একটা .csv ফাইল দিন।" }));
    }
  };

  return (
    <>
      <PageHead
        title={{ en: "Data Analysis", bn: "ডেটা অ্যানালাইসিস" }}
        sub={{
          en: "Data analysis means looking at data carefully to answer a question. Pick a dataset below and go through the five tabs — from “what's in here?” to “what changed over time?”.",
          bn: "ডেটা অ্যানালাইসিস মানে মনোযোগ দিয়ে ডেটা দেখে একটা প্রশ্নের উত্তর খোঁজা। নিচে একটা ডেটাসেট বাছুন, তারপর পাঁচটা ট্যাব একে একে দেখুন — “এখানে কী আছে?” থেকে “সময়ের সাথে কী বদলাল?” পর্যন্ত।",
        }}
        art="analysis"
      />
      <div className="row" style={{ marginBottom: 12 }}>
        <label>
          {t({ en: "Dataset", bn: "ডেটাসেট" })}{" "}
          <select value={dsId} onChange={(e) => setDsId(e.target.value)}>
            {all.map((d) => (
              <option key={d.id} value={d.id}>
                {t(d.title)} ({d.rows.length})
              </option>
            ))}
          </select>
        </label>
        <button className="btn ghost" onClick={() => downloadCsv(ds.id, ds.rows)}>
          ⬇ {t({ en: "Download CSV", bn: "CSV ডাউনলোড" })}
        </button>
        <label className="btn ghost upload">
          ⬆ {t({ en: "Use my own CSV", bn: "নিজের CSV দিন" })}
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} hidden />
        </label>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        {t(ds.desc)}
      </p>
      {uploadErr && <div className="err">{uploadErr}</div>}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "profile", label: { en: "1 · What's in it?", bn: "১ · কী আছে?" } },
          { id: "distribution", label: { en: "2 · How is it spread?", bn: "২ · কেমন ছড়ানো?" } },
          { id: "compare", label: { en: "3 · Compare groups", bn: "৩ · গ্রুপ তুলনা" } },
          { id: "relate", label: { en: "4 · Relationships", bn: "৪ · সম্পর্ক" } },
          { id: "trends", label: { en: "5 · Trends & shares", bn: "৫ · ট্রেন্ড ও ভাগ" } },
        ]}
      />
      <Plain k={`analysis-${tab}`} />
      {tab === "trends" && <Trends />}
      {tab === "profile" && <Profile rows={ds.rows} cols={cols} />}
      {tab === "distribution" &&
        (numCols.length ? <Distribution key={dsId} rows={ds.rows} numCols={numCols} dsId={dsId} /> : <NoNumbers />)}
      {tab === "compare" &&
        (numCols.length ? <Compare key={dsId} table={dsId} rows={ds.rows} numCols={numCols} catCols={catCols} /> : <NoNumbers />)}
      {tab === "relate" && (numCols.length > 1 ? <Relate key={dsId} rows={ds.rows} numCols={numCols} /> : <NoNumbers />)}
      <DataQuestions />
      <Quiz id="analysis" />
    </>
  );
}

function Profile({ rows, cols }: { rows: Row[]; cols: string[] }) {
  const { t } = useLang();
  const prof = cols.map((c) => {
    const vals = rows.map((r) => r[c]).filter((v) => v !== null);
    const nums = vals.filter((v): v is number => typeof v === "number");
    const numeric = nums.length === vals.length;
    return {
      c,
      type: numeric ? "number" : "text",
      nulls: rows.length - vals.length,
      unique: new Set(vals).size,
      min: numeric ? Math.min(...nums) : null,
      max: numeric ? Math.max(...nums) : null,
      mean: numeric ? mean(nums) : null,
    };
  });
  const head = rows.slice(0, 8);
  return (
    <>
      <h3>{t({ en: "A first look (first 8 rows)", bn: "প্রথম দেখা (প্রথম ৮টি সারি)" })}</h3>
      <DataTable columns={cols} rows={head.map((r) => cols.map((c) => r[c]))} />
      <h3 style={{ marginTop: 24 }}>{t({ en: "Column profile", bn: "কলাম প্রোফাইল" })}</h3>
      <DataTable
        columns={[t({ en: "column", bn: "কলাম" }), t({ en: "type", bn: "ধরন" }), "nulls", "unique", "min", "max", "mean"]}
        rows={prof.map((p) => [p.c, p.type, p.nulls, p.unique, p.min, p.max, p.mean])}
      />
      <Callout kind="idea" title={{ en: "How to read this", bn: "কীভাবে পড়বেন" }}>
        <p>
          {t({
            en: "Rows × columns tells you the size. A column with many nulls needs a decision (drop, fill, or ask why). A text column with few unique values is a category you can group by; one with a unique value on every row is an ID.",
            bn: "সারি × কলাম থেকে আকার বোঝা যায়। যে কলামে অনেক null, সেখানে সিদ্ধান্ত নিতে হয় (বাদ, পূরণ, বা কারণ খোঁজা)। কম ইউনিক মানের টেক্সট কলাম হলো ক্যাটাগরি, যা দিয়ে গ্রুপ করা যায়; প্রতি সারিতে আলাদা মান থাকলে সেটি ID।",
          })}
        </p>
      </Callout>
      <p className="muted small">
        {t({ en: `This dataset has ${rows.length} rows and ${cols.length} columns.`, bn: `এই ডেটাসেটে ${rows.length}টি সারি ও ${cols.length}টি কলাম আছে।` })}
      </p>
    </>
  );
}

function Distribution({ rows, numCols, dsId }: { rows: Row[]; numCols: string[]; dsId: string }) {
  const { t } = useLang();
  const [col, setCol] = useState(numCols[0]);
  const [bins, setBins] = useState(12);
  const values = rows.map((r) => r[col] as number);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const w = (hi - lo) / bins || 1;
  const counts = Array(bins).fill(0);
  values.forEach((v) => counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++);
  const m = mean(values);
  const med = median(values);
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <label>
          {t({ en: "Column", bn: "কলাম" })}{" "}
          <select value={col} onChange={(e) => setCol(e.target.value)}>
            {numCols.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <Slider label={t({ en: "Bins", bn: "বিন সংখ্যা" })} value={bins} min={4} max={30} step={1} onChange={setBins} />
      </div>
      <div className="grid cols2">
        <div className="card">
          <Bars
            items={counts.map((c, i) => ({ label: fmt(lo + i * w), value: c }))}
            xLabel={col}
            yLabel={t({ en: "count", bn: "সংখ্যা" })}
          />
        </div>
        <div className="card">
          <div className="stats">
            <Stat label="mean" value={fmt(m)} />
            <Stat label="median" value={fmt(med)} />
            <Stat label="std dev" value={fmt(std(values))} />
            <Stat label="min" value={fmt(lo)} />
            <Stat label="max" value={fmt(hi)} />
            <Stat label="n" value={String(values.length)} />
          </div>
          <Callout kind="idea" title={{ en: "Mean vs median", bn: "গড় বনাম মধ্যমা" }}>
            <p>
              {m > med * 1.05
                ? t({
                    en: "The mean is noticeably above the median: a few very large values pull it up (right-skewed). For things like income, the median describes a 'typical' person better.",
                    bn: "গড় মধ্যমার চেয়ে বেশ বড়: কিছু অনেক বড় মান গড়কে টেনে তুলছে (ডানদিকে ঝোঁকা)। আয়ের মতো বিষয়ে 'সাধারণ' মানুষকে মধ্যমা ভালো বোঝায়।",
                  })
                : t({
                    en: "The mean and median are close, so the data is fairly symmetric here.",
                    bn: "গড় ও মধ্যমা কাছাকাছি, অর্থাৎ ডেটা মোটামুটি প্রতিসম।",
                  })}
            </p>
          </Callout>
          <p className="muted small">
            {t({ en: "Try changing the number of bins: too few hides the shape, too many shows noise.", bn: "বিন সংখ্যা বদলে দেখুন: খুব কম হলে আকৃতি লুকায়, খুব বেশি হলে শুধু নয়েজ দেখায়।" })}
          </p>
        </div>
      </div>
      {dsId === "stock_prices" && <PriceLines rows={rows} />}
    </>
  );
}

function PriceLines({ rows }: { rows: Row[] }) {
  const { t } = useLang();
  const tickers = [...new Set(rows.map((r) => r.ticker as string))];
  const base = tickers.map((tk) => {
    const s = rows.filter((r) => r.ticker === tk).map((r) => r.close as number);
    return { name: tk, values: s.map((v) => (v / s[0]) * 100) };
  });
  return (
    <>
      <h3 style={{ marginTop: 24 }}>{t({ en: "Prices over time (rebased to 100)", bn: "সময়ের সাথে দাম (শুরুকে ১০০ ধরে)" })}</h3>
      <div className="card">
        <Lines series={base} xLabel={t({ en: "trading day", bn: "কার্যদিবস" })} />
      </div>
    </>
  );
}

const AGGS = ["avg", "sum", "count"] as const;

function Compare({ table, rows, numCols, catCols }: { table: string; rows: Row[]; numCols: string[]; catCols: string[] }) {
  const { t } = useLang();
  const [cat, setCat] = useState(catCols[0]);
  const [num, setNum] = useState(numCols[0]);
  const [agg, setAgg] = useState<(typeof AGGS)[number]>("avg");
  if (!catCols.length) {
    return <p className="muted">{t({ en: "This dataset has no category columns to group by. Try another dataset.", bn: "এই ডেটাসেটে গ্রুপ করার মতো ক্যাটাগরি কলাম নেই। অন্য ডেটাসেট বেছে নিন।" })}</p>;
  }
  const groups = new Map<string, number[]>();
  rows.forEach((r) => {
    const k = String(r[cat]);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r[num] as number);
  });
  const items = [...groups]
    .map(([label, v]) => ({ label, value: agg === "avg" ? mean(v) : agg === "sum" ? v.reduce((a, b) => a + b, 0) : v.length }))
    .sort((a, b) => b.value - a.value);
  const sql = `SELECT ${cat}, ${agg === "avg" ? `AVG(${num})` : agg === "sum" ? `SUM(${num})` : "COUNT(*)"} AS value\nFROM ${table}\nGROUP BY ${cat}\nORDER BY value DESC;`;
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <label>
          {t({ en: "Group by", bn: "গ্রুপ করুন" })}{" "}
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            {catCols.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          {t({ en: "Measure", bn: "পরিমাপ" })}{" "}
          <select value={num} onChange={(e) => setNum(e.target.value)}>
            {numCols.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          {t({ en: "Summary", bn: "সারাংশ" })}{" "}
          <select value={agg} onChange={(e) => setAgg(e.target.value as (typeof AGGS)[number])}>
            {AGGS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid cols2">
        <div className="card">
          <Bars items={items} xLabel={cat} yLabel={`${agg}(${agg === "count" ? "*" : num})`} colors={items.map((_, i) => `var(--c${(i % 8) + 1})`)} />
        </div>
        <div className="card">
          <h3>{t({ en: "The whole spread per group (box plot)", bn: "প্রতি গ্রুপের পুরো বিস্তার (বক্স প্লট)" })}</h3>
          <BoxPlot groups={items.map((i) => ({ label: i.label, values: groups.get(i.label)! }))} yLabel={num} h={260} />
          <p className="muted small" style={{ margin: 0 }}>
            {t({
              en: "Box = middle 50% of values, thick line = median, whiskers = typical range, dots = outliers. An average hides all of this.",
              bn: "বাক্স = মাঝের ৫০% মান, মোটা দাগ = মধ্যমা, হুইস্কার = সাধারণ পরিসর, বিন্দু = আউটলায়ার। শুধু গড় এসব লুকিয়ে রাখে।",
            })}
          </p>
        </div>
      </div>
      <DataTable columns={[cat, agg]} rows={items.map((i) => [i.label, i.value])} />
      <Callout kind="tip" title={{ en: "This is a GROUP BY", bn: "এটাই GROUP BY" }}>
        <p>{t({ en: "The chart above is exactly what this SQL computes:", bn: "ওপরের চার্ট ঠিক এই SQL-এর ফল:" })}</p>
        <pre style={{ margin: 0, overflow: "auto" }}>{sql}</pre>
      </Callout>
      <Callout kind="warn" title={{ en: "Careful", bn: "সতর্কতা" }}>
        <p>
          {t({
            en: "A difference between groups is not automatically meaningful. Check the group sizes (use count) before trusting an average from 5 rows.",
            bn: "গ্রুপের মধ্যে পার্থক্য মানেই অর্থপূর্ণ নয়। ৫টি সারির গড়কে বিশ্বাস করার আগে গ্রুপের আকার (count) দেখুন।",
          })}
        </p>
      </Callout>
    </>
  );
}

function Relate({ rows, numCols }: { rows: Row[]; numCols: string[] }) {
  const { t } = useLang();
  const [x, setX] = useState(numCols[0]);
  const [y, setY] = useState(numCols[1] ?? numCols[0]);
  const xs = rows.map((r) => r[x] as number);
  const ys = rows.map((r) => r[y] as number);
  const r = pearson(xs, ys);
  const strength = Math.abs(r) > 0.7 ? { en: "strong", bn: "শক্তিশালী" } : Math.abs(r) > 0.4 ? { en: "moderate", bn: "মাঝারি" } : { en: "weak", bn: "দুর্বল" };
  const sample = rows.length > 400 ? rows.filter((_, i) => i % Math.ceil(rows.length / 400) === 0) : rows;
  const matrix = numCols.map((a) => numCols.map((b) => pearson(rows.map((r) => r[a] as number), rows.map((r) => r[b] as number))));
  return (
    <>
      {numCols.length > 2 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>{t({ en: "Correlation heatmap: every pair at once", bn: "কোরিলেশন হিটম্যাপ: সব জোড়া একসাথে" })}</h3>
          <Heatmap rows={numCols} cols={numCols} values={matrix} diverging max={1} cell={84} />
          <p className="muted small" style={{ margin: 0 }}>
            {t({
              en: "Blue = move together, orange = move opposite, pale = unrelated. The diagonal is always 1 (a column vs itself). Pick a pair below to look closer.",
              bn: "নীল = একসাথে বাড়ে, কমলা = উল্টো দিকে চলে, হালকা = সম্পর্কহীন। কর্ণ বরাবর সবসময় ১ (নিজের সাথে নিজে)। কাছ থেকে দেখতে নিচে একটি জোড়া বাছুন।",
            })}
          </p>
        </div>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <label>
          X{" "}
          <select value={x} onChange={(e) => setX(e.target.value)}>
            {numCols.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Y{" "}
          <select value={y} onChange={(e) => setY(e.target.value)}>
            {numCols.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid cols2">
        <div className="card">
          <Scatter points={sample.map((row) => ({ x: row[x] as number, y: row[y] as number }))} xLabel={x} yLabel={y} />
        </div>
        <div className="card">
          <Stat label={t({ en: "Pearson correlation r", bn: "পিয়ারসন কোরিলেশন r" })} value={isNaN(r) ? "–" : r.toFixed(3)} />
          <p>
            {isNaN(r)
              ? ""
              : t({
                  en: `A ${strength.en} ${r >= 0 ? "positive" : "negative"} relationship: when ${x} goes up, ${y} tends to go ${r >= 0 ? "up" : "down"}.`,
                  bn: `একটি ${strength.bn} ${r >= 0 ? "ধনাত্মক" : "ঋণাত্মক"} সম্পর্ক: ${x} বাড়লে ${y} সাধারণত ${r >= 0 ? "বাড়ে" : "কমে"}।`,
                })}
          </p>
          <Callout kind="warn" title={{ en: "Correlation ≠ causation", bn: "কোরিলেশন ≠ কারণ" }}>
            <p>
              {t({
                en: "r ranges from −1 to +1. It only measures straight-line co-movement, and says nothing about which variable causes the other.",
                bn: "r-এর মান −১ থেকে +১। এটি শুধু সরলরেখার মতো একসাথে বদলানো মাপে; কোনটি কোনটির কারণ তা বলে না।",
              })}
            </p>
          </Callout>
        </div>
      </div>
    </>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Trends() {
  const { t } = useLang();
  const tx = dataset("transactions").rows;
  const cats = useMemo(() => [...new Set(tx.map((r) => r.category as string))], [tx]);
  const [picked, setPicked] = useState<string[]>(["Groceries", "Shopping", "Dining"]);
  const [hover, setHover] = useState<number | null>(null);

  const monthly = (filter: (r: Row) => boolean) => {
    const m = new Array(12).fill(0);
    tx.forEach((r) => filter(r) && (m[Number(String(r.txn_date).slice(5, 7)) - 1] += r.amount as number));
    return m;
  };
  const total = monthly(() => true);
  const share = (key: string) => {
    const m = new Map<string, number>();
    tx.forEach((r) => m.set(String(r[key]), (m.get(String(r[key])) ?? 0) + (r.amount as number)));
    return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const heat = cats.map((c) => monthly((r) => r.category === c));

  return (
    <>
      <div className="card">
        <h3>{t({ en: "Total spending per month, 2024", bn: "২০২৪ সালে মাসভিত্তিক মোট খরচ" })}</h3>
        <XY
          series={[{ name: "total", pts: total.map((v, i) => [i, v] as [number, number]), area: true }]}
          xFmt={(v) => MONTHS[Math.round(v)] ?? ""}
          xDomain={[0, 11]}
          yLabel="BDT"
          h={240}
        />
      </div>
      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t({ en: "Compare categories", bn: "ক্যাটাগরি তুলনা" })}</h3>
          <div className="chips">
            {cats.map((c) => (
              <button
                key={c}
                className={`chip-btn${picked.includes(c) ? " on" : ""}`}
                onClick={() => setPicked(picked.includes(c) ? picked.filter((x) => x !== c) : [...picked, c])}
              >
                {c}
              </button>
            ))}
          </div>
          {picked.length ? (
            <XY
              series={picked.map((c) => ({ name: c, pts: monthly((r) => r.category === c).map((v, i) => [i, v] as [number, number]) }))}
              xFmt={(v) => MONTHS[Math.round(v)] ?? ""}
              xDomain={[0, 11]}
              h={250}
            />
          ) : (
            <p className="muted">{t({ en: "Pick at least one category.", bn: "অন্তত একটি ক্যাটাগরি বাছুন।" })}</p>
          )}
        </div>
        <div className="card">
          <h3>{t({ en: "Where does the money go?", bn: "টাকা কোথায় যায়?" })}</h3>
          <Donut items={share("category")} center={fmt(share("category").reduce((a, b) => a + b.value, 0))} />
          <h3 style={{ marginTop: 16 }}>{t({ en: "Which channel carries it?", bn: "কোন মাধ্যমে যায়?" })}</h3>
          <Donut items={share("channel")} size={180} />
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t({ en: "Heatmap: category × month", bn: "হিটম্যাপ: ক্যাটাগরি × মাস" })}</h3>
        <Heatmap rows={cats} cols={MONTHS} values={heat} cell={52} format={fmt} onHover={setHover} active={hover} />
        <p className="muted small" style={{ margin: 0 }}>
          {t({
            en: "Darker = more money. Heatmaps let your eye find patterns in a big table instantly. Hover a row to focus on it.",
            bn: "গাঢ় = বেশি টাকা। হিটম্যাপে বড় টেবিলের প্যাটার্ন চোখ মুহূর্তেই খুঁজে পায়। একটি সারিতে মাউস রাখলে সেটি ফোকাস হবে।",
          })}
        </p>
      </div>
      <Callout kind="tip" title={{ en: "Which chart when?", bn: "কখন কোন চার্ট?" }}>
        <p>
          {t({
            en: "Line → change over time. Bar → compare categories. Donut → parts of a whole (few slices only). Histogram/box → distribution. Scatter → relationship. Heatmap → two categories at once.",
            bn: "লাইন → সময়ের সাথে পরিবর্তন। বার → ক্যাটাগরি তুলনা। ডোনাট → সমগ্রের অংশ (অল্প কয়েকটি ভাগ)। হিস্টোগ্রাম/বক্স → বিন্যাস। স্ক্যাটার → সম্পর্ক। হিটম্যাপ → একসাথে দুটি ক্যাটাগরি।",
          })}
        </p>
      </Callout>
    </>
  );
}
