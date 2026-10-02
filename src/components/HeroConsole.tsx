import { memo, useEffect, useMemo, useState } from "react";
import { dataset } from "../data/generate";
import { mean, pearson } from "../ml/core";
import { fmt } from "./charts";

// A fake SQL console for the hero: it "types" a real query, then shows the real answer (computed in JS,
// so the home page doesn't need to download the SQLite engine).

interface Demo {
  sql: string;
  cols: [string, string];
  rows: [string, number][];
  unit?: string;
}

function groupSum(id: string, key: string, val: (r: Record<string, unknown>) => number, agg: "sum" | "avg" | "count") {
  const m = new Map<string, number[]>();
  for (const r of dataset(id).rows) {
    const k = String(r[key]);
    (m.get(k) ?? m.set(k, []).get(k)!).push(val(r));
  }
  return [...m].map(([k, v]) => [k, agg === "sum" ? v.reduce((a, b) => a + b, 0) : agg === "avg" ? mean(v) : v.length] as [string, number]);
}

function buildDemos(): Demo[] {
  return [
    {
      sql: "SELECT city, COUNT(*) AS customers\nFROM customers\nGROUP BY city ORDER BY 2 DESC;",
      cols: ["city", "customers"],
      rows: groupSum("customers", "city", () => 1, "count").sort((a, b) => b[1] - a[1]),
    },
    {
      sql: "SELECT category, SUM(quantity*unit_price) AS revenue\nFROM shop_orders\nGROUP BY category ORDER BY 2 DESC;",
      cols: ["category", "revenue ৳"],
      rows: groupSum("shop_orders", "category", (r) => (r.quantity as number) * (r.unit_price as number), "sum").sort((a, b) => b[1] - a[1]),
    },
    {
      sql: "SELECT month, ROUND(AVG(aqi)) AS avg_aqi\nFROM dhaka_air\nGROUP BY month ORDER BY 2 DESC LIMIT 5;",
      cols: ["month", "avg_aqi"],
      rows: groupSum("dhaka_air", "month", (r) => r.aqi as number, "avg")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    },
    {
      sql: "SELECT department, AVG(left_company) AS quit_rate\nFROM employees\nGROUP BY department ORDER BY 2 DESC;",
      cols: ["department", "quit_rate %"],
      rows: groupSum("employees", "department", (r) => (r.left_company as number) * 100, "avg").sort((a, b) => b[1] - a[1]),
    },
  ];
}

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const HeroConsole = memo(function HeroConsole() {
  const demos = useMemo(buildDemos, []);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const d = demos[i];
  const done = typed >= d.sql.length;

  useEffect(() => {
    if (reduceMotion()) {
      setTyped(d.sql.length);
      return;
    }
    if (!done) {
      const id = setTimeout(() => setTyped((n) => n + 2), 22);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setI((x) => (x + 1) % demos.length);
      setTyped(0);
    }, 4200);
    return () => clearTimeout(id);
  }, [typed, done, d, demos.length]);

  const max = Math.max(...d.rows.map((r) => r[1]));
  return (
    <div className="console" aria-label="Example SQL query and result">
      <div className="console-bar">
        <i />
        <i />
        <i />
        <span>data-lab › sqlite</span>
        <span className="console-tabs">
          {demos.map((_, k) => (
            <b key={k} className={k === i ? "on" : ""} />
          ))}
        </span>
      </div>
      <pre className="console-sql">
        <span className="prompt">sql&gt; </span>
        {d.sql.slice(0, typed)}
        {!done && <span className="caret">▌</span>}
      </pre>
      <div className={`console-out${done ? " show" : ""}`}>
        <div className="console-head">
          <span>{d.cols[0]}</span>
          <span>{d.cols[1]}</span>
        </div>
        {d.rows.slice(0, 5).map(([k, v], r) => (
          <div key={k} className="console-row" style={{ animationDelay: `${r * 0.07}s` }}>
            <span>{k}</span>
            <span className="bar">
              <i style={{ width: `${(v / max) * 100}%` }} />
            </span>
            <b>{fmt(v)}</b>
          </div>
        ))}
        <div className="console-foot">
          {Math.min(d.rows.length, 5)} rows · {(0.4 + (i * 0.37) % 1.2).toFixed(1)} ms
        </div>
      </div>
    </div>
  );
});

export const DataTicker = memo(function DataTicker() {
  const facts = useMemo(() => {
    const air = groupSum("dhaka_air", "month", (r) => r.aqi as number, "avg");
    const jan = air.find((a) => a[0] === "Jan")![1];
    const loans = dataset("loans").rows;
    const st = dataset("students").rows;
    const tx = dataset("transactions").rows;
    const channels = groupSum("transactions", "channel", (r) => r.amount as number, "sum").sort((a, b) => b[1] - a[1]);
    const shop = groupSum("shop_orders", "order_date", (r) => (r.quantity as number) * (r.unit_price as number), "sum");
    const byMonth = new Map<string, number>();
    shop.forEach(([d, v]) => byMonth.set(d.slice(0, 7), (byMonth.get(d.slice(0, 7)) ?? 0) + v));
    const best = [...byMonth].sort((a, b) => b[1] - a[1])[0];
    const quit = groupSum("employees", "department", (r) => r.left_company as number, "avg").sort((a, b) => b[1] - a[1])[0];
    return [
      `customers.count = ${dataset("customers").rows.length}`,
      `avg(dhaka_air.aqi | Jan) = ${Math.round(jan)}`,
      `loans.default_rate = ${(mean(loans.map((l) => l.defaulted as number)) * 100).toFixed(1)}%`,
      `shop_orders.best_month = ${best[0]} (${fmt(best[1])} ৳)`,
      `corr(study_hours, score) = ${pearson(st.map((s) => s.study_hours_week as number), st.map((s) => s.final_score as number)).toFixed(2)}`,
      `transactions.top_channel = ${channels[0][0]}`,
      `employees.quit_rate(${quit[0]}) = ${(quit[1] * 100).toFixed(1)}%`,
      `sum(transactions.amount) = ${fmt(tx.reduce((a, r) => a + (r.amount as number), 0))} ৳`,
    ];
  }, []);
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker-track">
        {[...facts, ...facts].map((f, i) => (
          <span key={i}>
            <i>▸</i> {f}
          </span>
        ))}
      </div>
    </div>
  );
});
