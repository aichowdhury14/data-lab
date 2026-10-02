import type { T } from "../i18n";
import type { Cell } from "./generate";

export type RawRow = Record<string, Cell>;
export interface State {
  rows: RawRow[];
  rejected: (RawRow & { reason: string })[];
}

// Deliberately messy data, like a real CSV export from three different systems.
export const RAW: RawRow[] = [
  { txn_id: "T001", customer: "  rahim ahmed ", city: "dhaka", amount: "BDT 1,200", date: "2024-01-05", channel: "bKash" },
  { txn_id: "T002", customer: "Nusrat Akter", city: "Dhaka ", amount: "2500", date: "05/01/2024", channel: "bkash" },
  { txn_id: "T003", customer: "KARIM HOSSAIN", city: "CTG", amount: "", date: "2024-01-07", channel: "Card" },
  { txn_id: "T002", customer: "Nusrat Akter", city: "Dhaka ", amount: "2500", date: "05/01/2024", channel: "bkash" },
  { txn_id: "T004", customer: "sadia islam", city: "chattogram", amount: "-300", date: "2024/01/08", channel: "CARD" },
  { txn_id: "T005", customer: "Tanvir Rahman", city: "Khulna", amount: "4,750.50", date: "Jan 9, 2024", channel: "Cash" },
  { txn_id: "T006", customer: "Mim Begum", city: "Sylhet", amount: "BDT 900", date: "2024-13-45", channel: "bkash" },
  { txn_id: "T007", customer: "arif khan", city: "dhaka", amount: "1800", date: "2024-01-10", channel: "Bank transfer" },
  { txn_id: "T008", customer: " Jannat Das", city: "RAJSHAHI", amount: "3,300", date: "10/01/2024", channel: "BKASH" },
];

const titleCase = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

const CITY: Record<string, string> = { dhaka: "Dhaka", ctg: "Chattogram", chattogram: "Chattogram", chittagong: "Chattogram", khulna: "Khulna", sylhet: "Sylhet", rajshahi: "Rajshahi" };
const CHANNEL: Record<string, string> = { bkash: "bKash", card: "Card", cash: "Cash", banktransfer: "Bank Transfer" };
export const VALID_CHANNELS = new Set(Object.values(CHANNEL));
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function iso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    : null;
}

export function parseDate(s: string): string | null {
  let m = s.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // Bangladesh uses day-first
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = s.trim().match(/^([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[1].toLowerCase());
    return mi >= 0 ? iso(+m[3], mi + 1, +m[2]) : null;
  }
  return null;
}

export function parseAmount(s: string): number | null {
  const cleaned = s.replace(/BDT|,|\s/gi, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface Step {
  id: string;
  title: T;
  why: T;
  code: string;
  apply: (s: State) => State;
}

export const STEPS: Step[] = [
  {
    id: "extract",
    title: { en: "Extract", bn: "এক্সট্র্যাক্ট" },
    why: {
      en: "First, read the file exactly as it arrives and keep an untouched copy. Nothing is fixed yet — everything is still plain text. If something goes wrong later, you can always start again from this copy.",
      bn: "প্রথমে ফাইলটা যেমন আসে ঠিক তেমনই পড়ুন, আর একটা অপরিবর্তিত কপি রেখে দিন। এখনো কিছুই ঠিক করা হয়নি — সবই সাধারণ টেক্সট। পরে কোনো ভুল হলে এই কপি থেকে আবার শুরু করা যাবে।",
    },
    code: 'df = pd.read_csv("transactions_raw.csv", dtype=str)',
    apply: (s) => s,
  },
  {
    id: "text",
    title: { en: "Standardise text", bn: "টেক্সট মানসম্মত করা" },
    why: {
      en: "The same city is written as “dhaka”, “Dhaka ” and “CTG”. A computer thinks these are three different cities! So we remove extra spaces, fix capital letters, and turn nicknames like CTG into one correct name.",
      bn: "একই শহর লেখা আছে “dhaka”, “Dhaka ” আর “CTG” হিসেবে। কম্পিউটার ভাবে এগুলো তিনটা আলাদা শহর! তাই বাড়তি স্পেস সরাই, বড়-ছোট হাতের অক্ষর ঠিক করি, আর CTG-এর মতো ডাকনামকে একটা সঠিক নামে বদলাই।",
    },
    code: 'df["customer"] = df["customer"].str.strip().str.title()\ndf["city"] = df["city"].str.strip().str.lower().map(CITY_MAP)\ndf["channel"] = df["channel"].str.lower().str.replace(" ", "").map(CHANNEL_MAP)',
    apply: (s) => ({
      ...s,
      rows: s.rows.map((r) => ({
        ...r,
        customer: titleCase(String(r.customer)),
        city: CITY[String(r.city).trim().toLowerCase()] ?? titleCase(String(r.city)),
        channel: CHANNEL[String(r.channel).toLowerCase().replace(/\s/g, "")] ?? String(r.channel),
      })),
    }),
  },
  {
    id: "amount",
    title: { en: "Parse amounts", bn: "পরিমাণ পার্স করা" },
    why: {
      en: "“BDT 1,200” looks like money to us, but to a computer it's just text — it can't add it up. We remove “BDT” and the comma to get the number 1200. An empty amount becomes NULL (unknown), not 0.",
      bn: "“BDT 1,200” আমাদের কাছে টাকা মনে হয়, কিন্তু কম্পিউটারের কাছে এটা শুধুই লেখা — যোগ করা যায় না। “BDT” আর কমা সরিয়ে পাই ১২০০ সংখ্যাটা। খালি পরিমাণ হয় NULL (অজানা), ০ নয়।",
    },
    code: 'df["amount"] = pd.to_numeric(\n    df["amount"].str.replace(r"BDT|,|\\s", "", regex=True),\n    errors="coerce")',
    apply: (s) => ({ ...s, rows: s.rows.map((r) => ({ ...r, amount: parseAmount(String(r.amount)) })) }),
  },
  {
    id: "date",
    title: { en: "Parse dates", bn: "তারিখ পার্স করা" },
    why: {
      en: "Dates come in four different styles. Worse, 05/01/2024 means 5 January in Bangladesh but 1 May in the USA! We change every date to one clear style: YYYY-MM-DD. Impossible dates (month 13!) become NULL.",
      bn: "তারিখ এসেছে চার রকম ধরনে। আরও ঝামেলা: 05/01/2024 বাংলাদেশে ৫ জানুয়ারি, কিন্তু আমেরিকায় ১ মে! তাই সব তারিখ একটাই পরিষ্কার ধরনে আনি: YYYY-MM-DD। অসম্ভব তারিখ (১৩ নম্বর মাস!) হয়ে যায় NULL।",
    },
    code: 'df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce").dt.strftime("%Y-%m-%d")',
    apply: (s) => ({ ...s, rows: s.rows.map((r) => ({ ...r, date: parseDate(String(r.date)) })) }),
  },
  {
    id: "dedupe",
    title: { en: "Remove duplicates", bn: "ডুপ্লিকেট সরানো" },
    why: {
      en: "Transaction T002 arrived twice (the source system sent it again). If we keep both, the money is counted twice. So we keep only one row per transaction ID.",
      bn: "T002 লেনদেনটা দুবার এসেছে (উৎস সিস্টেম আবার পাঠিয়েছে)। দুটোই রাখলে টাকা দুবার গোনা হবে। তাই প্রতিটা লেনদেন আইডির জন্য শুধু একটা সারি রাখি।",
    },
    code: 'df = df.drop_duplicates(subset="txn_id", keep="first")',
    apply: (s) => {
      const seen = new Set<string>();
      return { ...s, rows: s.rows.filter((r) => (seen.has(String(r.txn_id)) ? false : (seen.add(String(r.txn_id)), true))) };
    },
  },
  {
    id: "validate",
    title: { en: "Validate & quarantine", bn: "যাচাই ও আলাদা করা" },
    why: {
      en: "A last check with simple business rules: the amount must exist and be more than 0, and the date must be real. Rows that fail are not thrown away silently — they go to a “rejected” list with the reason, so someone can fix them.",
      bn: "শেষ পরীক্ষা, কিছু সহজ ব্যবসায়িক নিয়ম দিয়ে: পরিমাণ থাকতে হবে আর ০-এর বেশি হতে হবে, তারিখ সত্যিকারের হতে হবে। যে সারি ফেল করে তাকে চুপচাপ ফেলে দেওয়া হয় না — কারণসহ “rejected” তালিকায় যায়, যাতে কেউ পরে ঠিক করতে পারে।",
    },
    code: 'bad = df[df.amount.isna() | (df.amount <= 0) | df.date.isna()]\ngood = df.drop(bad.index)',
    apply: (s) => {
      const rows: RawRow[] = [];
      const rejected: State["rejected"] = [];
      for (const r of s.rows) {
        const reason =
          r.amount === null ? "amount missing" : (r.amount as number) <= 0 ? "amount not positive" : r.date === null ? "invalid date" : "";
        reason ? rejected.push({ ...r, reason }) : rows.push(r);
      }
      return { rows, rejected };
    },
  },
];

export function runUpTo(step: number): State {
  let s: State = { rows: RAW, rejected: [] };
  for (let i = 1; i <= step; i++) s = STEPS[i].apply(s);
  return s;
}

export interface Check {
  name: T;
  pass: boolean;
  detail: string;
}

export function qualityChecks(s: State): Check[] {
  const rows = s.rows;
  const ids = rows.map((r) => r.txn_id);
  const dupes = ids.length - new Set(ids).size;
  const nullAmt = rows.filter((r) => r.amount === null || r.amount === "").length;
  const nonPos = rows.filter((r) => typeof r.amount === "number" && r.amount <= 0).length;
  const textAmt = rows.filter((r) => typeof r.amount === "string" && r.amount !== "").length;
  const badDate = rows.filter((r) => typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)).length;
  const badChan = rows.filter((r) => !VALID_CHANNELS.has(String(r.channel))).length;
  return [
    { name: { en: "No duplicate txn_id", bn: "txn_id ডুপ্লিকেট নেই" }, pass: dupes === 0, detail: `${dupes} duplicate(s)` },
    { name: { en: "amount is numeric", bn: "amount সংখ্যা" }, pass: textAmt === 0, detail: `${textAmt} text value(s)` },
    { name: { en: "amount is present", bn: "amount আছে" }, pass: nullAmt === 0, detail: `${nullAmt} missing` },
    { name: { en: "amount is positive", bn: "amount ধনাত্মক" }, pass: nonPos === 0, detail: `${nonPos} ≤ 0` },
    { name: { en: "dates are ISO & valid", bn: "তারিখ ISO ও বৈধ" }, pass: badDate === 0, detail: `${badDate} bad` },
    { name: { en: "channel is a known value", bn: "channel পরিচিত মান" }, pass: badChan === 0, detail: `${badChan} unknown` },
  ];
}

export const LOAD_SETUP = (rows: RawRow[]) =>
  `CREATE TABLE clean_txn (txn_id TEXT PRIMARY KEY, customer TEXT, city TEXT, amount REAL, txn_date TEXT, channel TEXT);\n` +
  rows
    .map(
      (r) =>
        `INSERT INTO clean_txn VALUES ('${r.txn_id}','${String(r.customer).replace(/'/g, "''")}','${r.city}',${r.amount},'${r.date}','${r.channel}');`,
    )
    .join("\n");

export const GOLD_SQL = "SELECT city, COUNT(*) AS txns, SUM(amount) AS total_bdt\nFROM clean_txn\nGROUP BY city\nORDER BY total_bdt DESC;";
