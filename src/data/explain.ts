// Rule-based "explain my query": turns a SQL statement into plain-language steps, in the order SQL
// actually runs them. No AI involved — just careful parsing of the top-level clauses.
import type { T } from "../i18n";

export interface Step {
  icon: string;
  title: T;
  /** Body text; segments wrapped in `backticks` are shown as code. */
  text: T;
}

const KEYWORDS = ["select", "from", "where", "group by", "having", "order by", "limit"] as const;
type Clause = (typeof KEYWORDS)[number];

/** Blank out string literals and anything inside brackets, so keyword search only sees the top level. */
function maskTop(sql: string): string {
  let out = "";
  let depth = 0;
  let quote: string | null = null;
  for (const ch of sql) {
    if (quote) {
      out += " ";
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += " ";
      continue;
    }
    if (ch === "(") {
      depth++;
      out += depth === 1 ? "(" : " ";
      continue;
    }
    if (ch === ")") {
      out += depth === 1 ? ")" : " ";
      depth = Math.max(0, depth - 1);
      continue;
    }
    out += depth > 0 ? " " : ch;
  }
  return out;
}

/** Split on a top-level separator (e.g. commas, AND), ignoring brackets and strings. */
function splitTop(text: string, sep: RegExp): string[] {
  const masked = maskTop(text);
  const parts: string[] = [];
  let last = 0;
  for (const m of masked.matchAll(sep)) {
    parts.push(text.slice(last, m.index).trim());
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last).trim());
  return parts.filter(Boolean);
}

const clean = (sql: string) =>
  sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim()
    .replace(/;+\s*$/, "")
    .trim();

const short = (s: string, n = 90) => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1) + "…" : one;
};

function describeColumn(raw: string): T {
  const col = raw.replace(/\s+/g, " ").trim();
  const asMatch = /\s+as\s+("?[\p{L}\w]+"?)$/iu.exec(col) ?? /\)\s+("?[\p{L}\w]+"?)$/u.exec(col);
  const alias = asMatch?.[1];
  const expr = asMatch ? col.slice(0, asMatch.index + (asMatch[0].startsWith(")") ? 1 : 0)).trim() : col;
  const named = (en: string, bn: string): T => (alias ? { en: `${en} → called \`${alias}\``, bn: `${bn} → নাম \`${alias}\`` } : { en, bn });
  const inner = (fn: string) => new RegExp(`^${fn}\\s*\\((.*)\\)$`, "is").exec(expr)?.[1]?.trim();
  if (expr === "*") return { en: "every column", bn: "সব কলাম" };
  if (/\bover\s*\(/i.test(expr)) {
    const fn = /^(\w+)\s*\(/.exec(expr)?.[1]?.toUpperCase() ?? "window";
    const part = /partition\s+by\s+([^)]*?)(?:order\s+by|\)|$)/i.exec(expr)?.[1]?.trim();
    return named(
      `\`${fn}\` as a window function${part ? `, separately inside each \`${part}\`` : ""} — every row is kept`,
      `\`${fn}\` উইন্ডো ফাংশন হিসেবে${part ? `, প্রতিটা \`${part}\`-এর ভেতরে আলাদা করে` : ""} — কোনো সারি হারায় না`,
    );
  }
  const cnt = inner("count");
  if (cnt !== undefined) {
    if (cnt === "*" || cnt === "1") return named("count the rows", "সারিগুলো গোনা");
    const d = /^distinct\s+(.*)$/i.exec(cnt);
    if (d) return named(`count the different values of \`${d[1]}\``, `\`${d[1]}\`-এর আলাদা আলাদা মান গোনা`);
    return named(`count the rows where \`${cnt}\` is not empty`, `যেসব সারিতে \`${cnt}\` খালি নয় সেগুলো গোনা`);
  }
  for (const [fn, en, bn] of [
    ["sum", "add up", "যোগফল"],
    ["avg", "the average of", "গড়"],
    ["min", "the smallest", "সবচেয়ে ছোট"],
    ["max", "the largest", "সবচেয়ে বড়"],
  ] as const) {
    const x = inner(fn);
    if (x !== undefined) return named(`${en} \`${short(x, 50)}\``, `\`${short(x, 50)}\`-এর ${bn}`);
  }
  const r = inner("round");
  if (r !== undefined) {
    const innerDesc = describeColumn(splitTop(r, /,/g)[0]);
    return named(`${innerDesc.en}, rounded`, `${innerDesc.bn}, পূর্ণসংখ্যার কাছাকাছি করে`);
  }
  if (/^case\b/i.test(expr)) return named("a label made with `CASE WHEN` (if … then …)", "`CASE WHEN` দিয়ে বানানো লেবেল (যদি … তাহলে …)");
  if (/^strftime\s*\(/i.test(expr)) return named(`a part of a date: \`${short(expr, 50)}\``, `তারিখের একটা অংশ: \`${short(expr, 50)}\``);
  if (/^\(\s*select\b/i.test(expr)) return named("the answer of a small query inside brackets", "ব্র্যাকেটের ভেতরের ছোট কোয়েরির উত্তর");
  if (/[-+*/]/.test(expr)) return named(`a calculation: \`${short(expr, 60)}\``, `একটা হিসাব: \`${short(expr, 60)}\``);
  return named(`\`${expr}\``, `\`${expr}\``);
}

function describeCondition(cond: string): { en: string; bn: string } {
  const parts = splitTop(cond, /\s+and\s+/gi);
  const notes: { en: string; bn: string }[] = [];
  const lc = cond.toLowerCase();
  if (/\bbetween\b/.test(lc)) notes.push({ en: "BETWEEN includes both ends", bn: "BETWEEN দুই প্রান্তের মানও ধরে" });
  if (/\bin\s*\(/.test(lc) && !/\bin\s*\(\s*select/.test(lc)) notes.push({ en: "IN (…) means “any of these”", bn: "IN (…) মানে “এগুলোর যেকোনোটা”" });
  if (/\blike\b/.test(lc)) notes.push({ en: "LIKE matches a text pattern (% = anything)", bn: "LIKE টেক্সটের প্যাটার্ন মেলায় (% = যেকোনো কিছু)" });
  if (/\bis\s+(not\s+)?null\b/.test(lc)) notes.push({ en: "IS NULL checks for empty values", bn: "IS NULL খালি মান খোঁজে" });
  if (/\(\s*select\b/.test(lc)) notes.push({ en: "the query in brackets runs first and gives a value to compare with", bn: "ব্র্যাকেটের কোয়েরিটা আগে চলে আর তুলনার জন্য একটা মান দেয়" });
  if (splitTop(cond, /\s+or\s+/gi).length > 1) notes.push({ en: "OR means either side is enough", bn: "OR মানে যেকোনো একটা সত্যি হলেই চলবে" });
  const list = parts.map((p) => `\`${short(p, 70)}\``);
  const extra = notes.length ? { en: ` (${notes.map((n) => n.en).join("; ")})`, bn: ` (${notes.map((n) => n.bn).join("; ")})` } : { en: "", bn: "" };
  return { en: list.join(" and ") + extra.en, bn: list.join(" এবং ") + extra.bn };
}

function explainSelect(sql: string): Step[] {
  const masked = maskTop(sql).toLowerCase();
  const found: { k: Clause; at: number; len: number }[] = [];
  for (const k of KEYWORDS) {
    const re = new RegExp(`\\b${k.replace(" ", "\\s+")}\\b`, "g");
    const m = re.exec(masked);
    if (m) found.push({ k, at: m.index, len: m[0].length });
  }
  found.sort((a, b) => a.at - b.at);
  const clause = (k: Clause) => {
    const i = found.findIndex((f) => f.k === k);
    if (i < 0) return undefined;
    const end = i + 1 < found.length ? found[i + 1].at : sql.length;
    return sql.slice(found[i].at + found[i].len, end).trim();
  };
  const steps: Step[] = [];

  const from = clause("from");
  if (from) {
    const joinRe = /\b((?:left|right|full|inner|cross)\s+(?:outer\s+)?)?join\b/gi;
    const pieces = splitTop(from, joinRe);
    const kinds = [...maskTop(from).matchAll(joinRe)].map((m) => (m[1] ?? "").trim().toLowerCase());
    const base = pieces[0];
    const baseName = /^\(/.test(base) ? null : base.split(/\s+/)[0];
    if (!baseName) {
      // FROM ( SELECT ... ) — explain the inner query first, since it runs first
      const close = base.lastIndexOf(")");
      const inner = base.slice(1, close > 0 ? close : undefined);
      steps.push(
        ...explainSelect(inner).map((st) => ({
          ...st,
          title: { en: `Inside the brackets · ${st.title.en}`, bn: `ব্র্যাকেটের ভেতরে · ${st.title.bn}` },
        })),
      );
    }
    steps.push({
      icon: "📥",
      title: { en: "Start with the data", bn: "ডেটা দিয়ে শুরু" },
      text: baseName
        ? { en: `Read the table \`${baseName}\`${base.split(/\s+/)[1] && !/^(as)$/i.test(base.split(/\s+/)[1]) ? ` (nickname \`${base.split(/\s+/).pop()}\`)` : ""}.`, bn: `\`${baseName}\` টেবিলটা পড়ো${base.split(/\s+/).length > 1 ? ` (ডাকনাম \`${base.split(/\s+/).pop()}\`)` : ""}।` }
        : { en: "Read the result of the query inside brackets (a sub-query) as if it were a table.", bn: "ব্র্যাকেটের ভেতরের কোয়েরির (সাব-কোয়েরি) ফলাফলকে একটা টেবিলের মতো পড়ো।" },
    });
    pieces.slice(1).forEach((p, i) => {
      const [tbl, on] = splitTop(p, /\s+on\s+/gi);
      const left = kinds[i]?.startsWith("left");
      steps.push({
        icon: "🔗",
        title: left ? { en: "Connect another table (LEFT JOIN)", bn: "আরেকটা টেবিল জোড়া (LEFT JOIN)" } : { en: "Connect another table (JOIN)", bn: "আরেকটা টেবিল জোড়া (JOIN)" },
        text: {
          en: `Match each row with \`${tbl.split(/\s+/)[0]}\`${on ? ` where \`${short(on, 60)}\`` : ""}.${left ? " Rows without a match are kept, with empty (NULL) values." : " Rows without a match are dropped."}`,
          bn: `প্রতিটা সারিকে \`${tbl.split(/\s+/)[0]}\`-এর সাথে মেলাও${on ? `, যেখানে \`${short(on, 60)}\`` : ""}।${left ? " যার মিল নেই সেও থাকে, খালি (NULL) মান নিয়ে।" : " যার মিল নেই সে বাদ পড়ে।"}`,
        },
      });
    });
  }

  const where = clause("where");
  if (where) {
    const c = describeCondition(where);
    steps.push({ icon: "🔍", title: { en: "Filter rows (WHERE)", bn: "সারি ছাঁকা (WHERE)" }, text: { en: `Keep only rows where ${c.en}.`, bn: `শুধু সেই সারিগুলো রাখো যেখানে ${c.bn}।` } });
  }

  const group = clause("group by");
  if (group) {
    const cols = splitTop(group, /,/g).map((g) => `\`${short(g, 50)}\``);
    steps.push({
      icon: "🧺",
      title: { en: "Make groups (GROUP BY)", bn: "দল বানানো (GROUP BY)" },
      text: { en: `Put rows into piles — one pile for each different ${cols.join(" + ")}. Totals and averages are then worked out per pile.`, bn: `সারিগুলোকে স্তূপে ভাগ করো — প্রতিটা আলাদা ${cols.join(" + ")}-এর জন্য একটা স্তূপ। তারপর প্রতি স্তূপের যোগফল/গড় হিসাব হয়।` },
    });
  }

  const having = clause("having");
  if (having) {
    const c = describeCondition(having);
    steps.push({ icon: "🧹", title: { en: "Filter groups (HAVING)", bn: "দল ছাঁকা (HAVING)" }, text: { en: `Keep only the groups where ${c.en}.`, bn: `শুধু সেই দলগুলো রাখো যেখানে ${c.bn}।` } });
  }

  const select = clause("select");
  if (select !== undefined) {
    const distinct = /^distinct\s+/i.test(select);
    const cols = splitTop(select.replace(/^distinct\s+/i, ""), /,/g).map(describeColumn);
    steps.push({
      icon: "📋",
      title: { en: "Choose what to show (SELECT)", bn: "কী দেখাবে বাছাই (SELECT)" },
      text: {
        en: `Show ${cols.map((c, i) => `${i ? (i === cols.length - 1 ? " and " : ", ") : ""}${c.en}`).join("")}.${distinct ? " DISTINCT removes repeated rows." : ""}`,
        bn: `দেখাও: ${cols.map((c) => c.bn).join("; ")}।${distinct ? " DISTINCT একই সারি দুবার দেখায় না।" : ""}`,
      },
    });
  }

  const order = clause("order by");
  if (order) {
    const items = splitTop(order, /,/g).map((o) => {
      const desc = /\s+desc$/i.test(o);
      const name = o.replace(/\s+(asc|desc)$/i, "");
      return { en: `\`${short(name, 40)}\` (${desc ? "biggest first" : "smallest first"})`, bn: `\`${short(name, 40)}\` (${desc ? "বড় থেকে ছোট" : "ছোট থেকে বড়"})` };
    });
    steps.push({
      icon: "↕️",
      title: { en: "Sort (ORDER BY)", bn: "সাজানো (ORDER BY)" },
      text: { en: `Sort by ${items.map((i) => i.en).join(", then by ")}.`, bn: `সাজাও: ${items.map((i) => i.bn).join(", তারপর ")}।` },
    });
  }

  const limit = clause("limit");
  if (limit) steps.push({ icon: "✂️", title: { en: "Keep the first rows (LIMIT)", bn: "প্রথম কয়েকটা সারি (LIMIT)" }, text: { en: `Show only the first \`${limit}\` rows.`, bn: `শুধু প্রথম \`${limit}\`টি সারি দেখাও।` } });

  return steps;
}

export function explainSql(input: string): Step[] {
  const sql = clean(input);
  if (!sql) return [];
  const statements = splitTop(sql, /;/g);
  const main = statements[0];
  const lower = main.toLowerCase();
  const steps: Step[] = [];

  if (/^with\b/i.test(main)) {
    // WITH name AS ( ... ), name2 AS ( ... ) SELECT ...  — walk the brackets to find each step's body
    const ctes: { name: string; body: string }[] = [];
    let i = /^with\s+/i.exec(main)![0].length;
    while (i < main.length) {
      const nm = /^\s*([\p{L}\w]+)\s+as\s*\(/iu.exec(main.slice(i));
      if (!nm) break;
      let depth = 0;
      let j = i + nm[0].length - 1;
      for (; j < main.length; j++) {
        if (main[j] === "(") depth++;
        else if (main[j] === ")" && --depth === 0) break;
      }
      ctes.push({ name: nm[1], body: main.slice(i + nm[0].length, j) });
      i = j + 1;
      const comma = /^\s*,/.exec(main.slice(i));
      if (comma) i += comma[0].length;
      else break;
    }
    const lastEnd = i;
    ctes.forEach((c) => {
      const inner = explainSelect(c.body).map((s) => s.title);
      steps.push({
        icon: "🧱",
        title: { en: `Step: build \`${c.name}\` (WITH)`, bn: `ধাপ: \`${c.name}\` বানানো (WITH)` },
        text: {
          en: `First make a temporary result called \`${c.name}\`: ${inner.map((x) => x.en.replace(/\s*\(.*\)$/, "").toLowerCase()).join(" → ")}. Later steps can use it like a table.`,
          bn: `প্রথমে \`${c.name}\` নামে একটা অস্থায়ী ফলাফল বানাও: ${inner.map((x) => x.bn.replace(/\s*\(.*\)$/, "")).join(" → ")}। পরের ধাপগুলো এটাকে টেবিলের মতো ব্যবহার করতে পারে।`,
        },
      });
    });
    steps.push(...explainSelect(main.slice(lastEnd)));
  } else if (/^select\b/.test(lower)) {
    steps.push(...explainSelect(main));
  } else {
    const verb = lower.split(/\s+/)[0];
    const map: Record<string, T> = {
      create: { en: "Create a new table or view.", bn: "নতুন টেবিল বা ভিউ বানাও।" },
      insert: { en: "Add new rows to a table.", bn: "টেবিলে নতুন সারি যোগ করো।" },
      update: { en: "Change values in existing rows.", bn: "আগের সারির মান বদলাও।" },
      delete: { en: "Remove rows from a table — careful!", bn: "টেবিল থেকে সারি মুছে ফেলো — সাবধান!" },
      drop: { en: "Delete a whole table — careful! (Use “Reset database” to bring it back here.)", bn: "পুরো টেবিল মুছে ফেলো — সাবধান! (এখানে ফেরত আনতে “ডেটাবেস রিসেট” চাপুন।)" },
    };
    steps.push({ icon: "🛠️", title: { en: `A ${verb.toUpperCase()} statement`, bn: `একটা ${verb.toUpperCase()} স্টেটমেন্ট` }, text: map[verb] ?? { en: "This statement isn't a SELECT, so there is no result table to explain.", bn: "এটা SELECT নয়, তাই ব্যাখ্যা করার মতো ফলাফল টেবিল নেই।" } });
  }
  if (statements.length > 1)
    steps.push({ icon: "ℹ️", title: { en: "More statements", bn: "আরও স্টেটমেন্ট" }, text: { en: `Only the first of ${statements.length} statements is explained.`, bn: `${statements.length}টি স্টেটমেন্টের শুধু প্রথমটা ব্যাখ্যা করা হলো।` } });
  return steps;
}
