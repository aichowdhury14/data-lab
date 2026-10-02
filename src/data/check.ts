// Grades a learner's SQL result against an expected answer.
// Forgiving on purpose: extra columns, different column names and column order are all fine —
// only the values the solution produces must appear. Row order matters only if the solution sorts.

export interface Result {
  columns: string[];
  rows: unknown[][];
}
export type Grade =
  | { ok: true }
  | { ok: false; reason: "rows"; expected: number; got: number }
  | { ok: false; reason: "values" | "order"; expected: number };

const norm = (v: unknown) => (v === null || v === undefined ? "∅" : typeof v === "number" ? (Math.round(v * 10) / 10).toFixed(1) : String(v).trim().toLowerCase());

/** True when the query sorts its final result (an ORDER BY outside any brackets, e.g. not inside OVER(...)). */
export function sortsResult(sql: string) {
  let s = sql;
  while (/\([^()]*\)/.test(s)) s = s.replace(/\([^()]*\)/g, "");
  return /\border\s+by\b/i.test(s);
}

export function compare(user: Result, solution: Result, ordered: boolean): Grade {
  if (user.rows.length !== solution.rows.length) return { ok: false, reason: "rows", expected: solution.rows.length, got: user.rows.length };
  const userCols = user.columns.map((_, j) => user.rows.map((r) => norm(r[j])));
  const used = new Set<number>();
  let orderProblem = false;
  for (let j = 0; j < solution.columns.length; j++) {
    const want = solution.rows.map((r) => norm(r[j]));
    const wantSorted = [...want].sort().join("\u0000");
    let found = -1;
    for (let k = 0; k < userCols.length && found < 0; k++) {
      if (used.has(k)) continue;
      if ([...userCols[k]].sort().join("\u0000") !== wantSorted) continue;
      if (ordered && userCols[k].join("\u0000") !== want.join("\u0000")) {
        orderProblem = true;
        continue;
      }
      found = k;
    }
    if (found < 0) return { ok: false, reason: orderProblem ? "order" : "values", expected: solution.rows.length };
    used.add(found);
  }
  return { ok: true };
}
