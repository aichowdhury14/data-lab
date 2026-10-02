import type { T } from "../i18n";

export type Cell = string | number | null;
export type Row = Record<string, Cell>;

export interface Dataset {
  id: string;
  title: T;
  desc: T;
  rows: Row[];
}

// Deterministic RNG so everybody sees the same data (and lessons stay reproducible).
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(2024);
const normal = () => {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
};
const pick = <A,>(xs: A[]) => xs[Math.floor(rand() * xs.length)];
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const FIRST = ["Rahim", "Karim", "Nusrat", "Farhana", "Tanvir", "Sadia", "Imran", "Mim", "Arif", "Sumaiya", "Hasan", "Jannat", "Rakib", "Tasnim", "Shuvo", "Anika", "Sohel", "Nabila", "Fahim", "Ritu"];
const LAST = ["Ahmed", "Hossain", "Islam", "Rahman", "Chowdhury", "Akter", "Khan", "Sarker", "Uddin", "Begum", "Mia", "Das"];
export const CITIES = ["Dhaka", "Chattogram", "Khulna", "Rajshahi", "Sylhet"];
const CITY_WEIGHTS = [0.45, 0.2, 0.12, 0.12, 0.11];

function weighted<A>(xs: A[], ws: number[]): A {
  let r = rand() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < xs.length; i++) {
    r -= ws[i];
    if (r <= 0) return xs[i];
  }
  return xs[xs.length - 1];
}

// ---- customers -------------------------------------------------------------
const customers: Row[] = [];
for (let id = 1; id <= 240; id++) {
  const income = clamp(Math.round((15000 * Math.exp(normal() * 0.6 + 0.5)) / 1000) * 1000, 12000, 300000);
  const credit = Math.round(clamp(640 + (Math.log(income) - 10) * 90 + normal() * 55, 300, 850));
  const segment = income < 25000 ? "Basic" : income < 60000 ? "Standard" : "Premium";
  const joined = new Date(Date.UTC(2019, 0, 1) + Math.floor(rand() * 6 * 365) * 86400000);
  customers.push({
    id,
    name: `${pick(FIRST)} ${pick(LAST)}`,
    age: 21 + Math.floor(rand() * 45),
    city: weighted(CITIES, CITY_WEIGHTS),
    segment,
    monthly_income: income,
    credit_score: credit,
    joined: isoDate(joined),
  });
}

// ---- transactions ----------------------------------------------------------
const CATEGORIES = ["Rent", "Groceries", "Shopping", "Transport", "Dining", "Utilities", "Healthcare", "Mobile Recharge"];
const SHARE = [0.25, 0.12, 0.08, 0.05, 0.05, 0.04, 0.04, 0.01];
const FREQ = [1, 5, 2, 4, 3, 2, 1, 3];
const CHANNELS = ["bKash", "Card", "Cash", "Bank Transfer"];

const transactions: Row[] = [];
let txnId = 1;
for (const c of customers) {
  const n = 8 + Math.floor(rand() * 9);
  for (let i = 0; i < n; i++) {
    const k = CATEGORIES.indexOf(weighted(CATEGORIES, FREQ));
    const amount = Math.max(50, Math.round(((c.monthly_income as number) * SHARE[k] * (0.6 + rand() * 0.8)) / 10) * 10);
    const date = new Date(Date.UTC(2024, 0, 1) + Math.floor(rand() * 366) * 86400000);
    transactions.push({
      id: txnId++,
      customer_id: c.id as number,
      txn_date: isoDate(date),
      category: CATEGORIES[k],
      amount,
      channel: pick(CHANNELS),
    });
  }
}
transactions.sort((a, b) => String(a.txn_date).localeCompare(String(b.txn_date)));
transactions.forEach((t, i) => (t.id = i + 1));

// ---- loans -----------------------------------------------------------------
const loans: Row[] = [];
for (let id = 1; id <= 420; id++) {
  const c = pick(customers);
  const income = c.monthly_income as number;
  const credit = c.credit_score as number;
  const amount = Math.max(20000, Math.round((income * (2 + rand() * 10)) / 5000) * 5000);
  const term = pick([12, 24, 36, 48, 60]);
  const rate = Math.round(clamp(9 + (700 - credit) / 40 + normal() * 1.2, 7, 22) * 10) / 10;
  const ratio = amount / (income * 12);
  const z = -1.7 + (650 - credit) / 55 + 1.8 * (ratio - 0.6) + 0.12 * (rate - 12);
  const issued = new Date(Date.UTC(2021, 0, 1) + Math.floor(rand() * 3 * 365) * 86400000);
  loans.push({
    id,
    customer_id: c.id as number,
    amount,
    term_months: term,
    interest_rate: rate,
    issued_date: isoDate(issued),
    defaulted: rand() < sigmoid(z) ? 1 : 0,
  });
}

// ---- stock prices (Dhaka Stock Exchange trades Sunday–Thursday) -------------
const stocks: Row[] = [];
for (const [ticker, start, drift, vol] of [
  ["GP", 300, 0.0002, 0.012],
  ["BRACBANK", 45, 0.0006, 0.018],
  ["SQURPHARMA", 210, 0.0001, 0.01],
] as const) {
  let price: number = start;
  const d = new Date(Date.UTC(2024, 0, 1));
  let days = 0;
  while (days < 250) {
    const dow = d.getUTCDay();
    if (dow !== 5 && dow !== 6) {
      price = price * Math.exp(drift + vol * normal());
      stocks.push({
        trade_date: isoDate(d),
        ticker,
        close: Math.round(price * 100) / 100,
        volume: Math.round(200000 + rand() * 800000),
      });
      days++;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

// ---- online shop orders (for RFM & sales analysis) --------------------------------
// Each customer gets a "behaviour type" so the RFM segments come out realistic.
const PRODUCTS: [string, string, number][] = [
  ["Earbuds", "Electronics", 1500],
  ["Power bank", "Electronics", 1800],
  ["Smartwatch", "Electronics", 3500],
  ["Panjabi", "Fashion", 2200],
  ["Saree", "Fashion", 3500],
  ["Sneakers", "Fashion", 2800],
  ["Rice 5kg", "Grocery", 450],
  ["Tea 400g", "Grocery", 250],
  ["Soybean oil 5L", "Grocery", 900],
  ["Novel", "Books", 350],
  ["SQL book", "Books", 600],
  ["Rice cooker", "Home", 2800],
  ["Ceiling fan", "Home", 3200],
];
const EIDS = ["2024-04-10", "2024-06-17", "2025-03-31", "2025-06-07"].map((d) => Date.parse(d));
const DAY = 86400000;
const SHOP_START = Date.parse("2024-01-01");
const SHOP_END = Date.parse("2025-06-30");
const nearEid = (t: number) => EIDS.some((e) => e - t >= 0 && e - t < 21 * DAY);
function shopDate(from: number, to: number) {
  for (;;) {
    const t = from + Math.floor(rand() * ((to - from) / DAY + 1)) * DAY;
    if (rand() < (nearEid(t) ? 1 : 0.4)) return t;
  }
}
const shopOrders: Row[] = [];
// [share of customers, min orders, max orders, active window: 0 = whole period, 1 = early only, 2 = recent only]
const BEHAVIOUR: [number, number, number, number][] = [
  [0.15, 10, 20, 0],
  [0.2, 6, 12, 0],
  [0.15, 1, 3, 2],
  [0.2, 5, 10, 1],
  [0.3, 1, 3, 1],
];
for (const c of customers) {
  const r0 = rand();
  let acc = 0;
  const [, lo, hi, win] = BEHAVIOUR.find((b) => (acc += b[0]) >= r0) ?? BEHAVIOUR[4];
  const n = lo + Math.floor(rand() * (hi - lo + 1));
  const from = win === 2 ? SHOP_END - 60 * DAY : SHOP_START;
  const to = win === 1 ? SHOP_START + (200 + Math.floor(rand() * 150)) * DAY : SHOP_END;
  for (let i = 0; i < n; i++) {
    const t = shopDate(from, to);
    let p = pick(PRODUCTS);
    if (nearEid(t) && rand() < 0.5) p = pick(PRODUCTS.filter((x) => x[1] === "Fashion"));
    shopOrders.push({
      order_id: 0,
      customer_id: c.id as number,
      order_date: isoDate(new Date(t)),
      product: p[0],
      category: p[1],
      quantity: p[1] === "Grocery" ? 1 + Math.floor(rand() * 3) : 1,
      unit_price: p[2],
      payment: weighted(["bKash", "Nagad", "Card", "Cash on Delivery"], [0.4, 0.15, 0.15, 0.3]),
    });
  }
}
shopOrders.sort((a, b) => String(a.order_date).localeCompare(String(b.order_date)));
shopOrders.forEach((o, i) => (o.order_id = i + 1));

// ---- employees (HR attrition) -------------------------------------------------------
const DEPTS = ["Sales", "IT", "Finance", "HR", "Operations"];
const BASE_SALARY: Record<string, number> = { Sales: 35000, IT: 60000, Finance: 50000, HR: 38000, Operations: 32000 };
const employees: Row[] = [];
for (let id = 1; id <= 300; id++) {
  const dept = weighted(DEPTS, [0.3, 0.2, 0.15, 0.1, 0.25]);
  const exp = Math.floor(rand() * 15);
  const salary = Math.round((BASE_SALARY[dept] * (1 + exp * 0.07) * (0.85 + rand() * 0.3)) / 500) * 500;
  const overtime = Math.max(0, Math.round((dept === "Sales" || dept === "Operations" ? 18 : 8) + normal() * 8));
  const satisfaction = Math.round(clamp(3.6 - overtime / 25 + normal() * 0.9, 1, 5));
  const remote = dept === "IT" ? (rand() < 0.6 ? 1 : 0) : rand() < 0.15 ? 1 : 0;
  const z = -1.2 - 0.9 * (satisfaction - 3) + 0.05 * (overtime - 12) - 0.12 * exp - 0.6 * remote;
  employees.push({
    id,
    name: `${pick(FIRST)} ${pick(LAST)}`,
    department: dept,
    years_experience: exp,
    monthly_salary: salary,
    overtime_hours: overtime,
    satisfaction,
    remote,
    left_company: rand() < sigmoid(z) ? 1 : 0,
  });
}

// ---- Dhaka air quality, 2024 ----------------------------------------------------------
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dhakaAir: Row[] = [];
for (let d = 0; d < 366; d++) {
  const dt = new Date(Date.UTC(2024, 0, 1) + d * DAY);
  const yearPos = (d / 366) * 2 * Math.PI;
  const temp = 26.5 - 6.5 * Math.cos(yearPos - 0.5) + normal() * 1.5;
  const monsoon = Math.exp(-(((d - 205) / 55) ** 2));
  const rain = rand() < 0.15 + monsoon * 0.6 ? Math.round(rand() * (5 + monsoon * 60)) : 0;
  const aqi = Math.round(clamp(165 + 100 * Math.cos(yearPos - 0.15) - rain * 0.5 - monsoon * 10 + normal() * 22, 30, 400));
  dhakaAir.push({
    date: isoDate(dt),
    month: MONTH_NAMES[dt.getUTCMonth()],
    aqi,
    temperature_c: Math.round(temp * 10) / 10,
    rainfall_mm: rain,
    humidity_pct: Math.round(clamp(60 + monsoon * 25 + normal() * 6, 35, 98)),
  });
}

// ---- students (exam results) --------------------------------------------------------
const students: Row[] = [];
for (let id = 1; id <= 200; id++) {
  const hours = Math.round(clamp(8 + normal() * 5, 0, 25));
  const attendance = Math.round(clamp(78 + normal() * 12, 30, 100));
  const sleep = Math.round(clamp(7 + normal() * 1.1, 4, 10) * 10) / 10;
  const score = Math.round(clamp(8 + hours * 2.4 + attendance * 0.35 - Math.abs(sleep - 7.5) * 3 + normal() * 8, 0, 100));
  students.push({
    id,
    name: `${pick(FIRST)} ${pick(LAST)}`,
    study_group: weighted(["Science", "Commerce", "Arts"], [0.4, 0.35, 0.25]),
    study_hours_week: hours,
    attendance_pct: attendance,
    sleep_hours: sleep,
    final_score: score,
    passed: score >= 40 ? 1 : 0,
  });
}

export const DATASETS: Dataset[] = [
  {
    id: "customers",
    title: { en: "Customers", bn: "গ্রাহক" },
    desc: {
      en: "240 bank customers: city, age, income (BDT / month) and credit score.",
      bn: "২৪০ জন ব্যাংক গ্রাহক: শহর, বয়স, মাসিক আয় (টাকা) ও ক্রেডিট স্কোর।",
    },
    rows: customers,
  },
  {
    id: "transactions",
    title: { en: "Transactions", bn: "লেনদেন" },
    desc: {
      en: "Every customer's spending in 2024: category, channel (bKash, card…) and amount in BDT.",
      bn: "২০২৪ সালে প্রতিটি গ্রাহকের খরচ: ক্যাটাগরি, মাধ্যম (বিকাশ, কার্ড…) ও টাকার পরিমাণ।",
    },
    rows: transactions,
  },
  {
    id: "loans",
    title: { en: "Loans", bn: "ঋণ" },
    desc: {
      en: "420 loans with amount, term, interest rate and whether the borrower defaulted (1) or not (0).",
      bn: "৪২০টি ঋণ: পরিমাণ, মেয়াদ, সুদের হার এবং খেলাপি (১) হয়েছে কি না (০)।",
    },
    rows: loans,
  },
  {
    id: "stock_prices",
    title: { en: "Stock prices", bn: "শেয়ারের দাম" },
    desc: {
      en: "250 trading days of closing prices for three simulated DSE-style tickers.",
      bn: "তিনটি কাল্পনিক DSE-স্টাইল শেয়ারের ২৫০ কার্যদিবসের ক্লোজিং প্রাইস।",
    },
    rows: stocks,
  },
  {
    id: "shop_orders",
    title: { en: "Online shop orders", bn: "অনলাইন শপের অর্ডার" },
    desc: {
      en: "Every order from an online shop, Jan 2024 – Jun 2025: what was bought, for how much, and how it was paid. Sales jump before each Eid!",
      bn: "একটি অনলাইন শপের সব অর্ডার, জানুয়ারি ২০২৪ – জুন ২০২৫: কী কেনা হলো, দাম কত, কীভাবে টাকা দেওয়া হলো। প্রতি ঈদের আগে বিক্রি বেড়ে যায়!",
    },
    rows: shopOrders,
  },
  {
    id: "employees",
    title: { en: "Employees", bn: "কর্মী" },
    desc: {
      en: "300 employees of a company: department, salary, overtime, how happy they are (1–5), and whether they quit (1) or stayed (0).",
      bn: "একটি কোম্পানির ৩০০ জন কর্মী: বিভাগ, বেতন, ওভারটাইম, কতটা সন্তুষ্ট (১–৫), আর চাকরি ছেড়েছেন (১) নাকি আছেন (০)।",
    },
    rows: employees,
  },
  {
    id: "dhaka_air",
    title: { en: "Dhaka air quality", bn: "ঢাকার বায়ুমান" },
    desc: {
      en: "One row per day of 2024: air quality index (AQI — higher is worse), temperature, rain and humidity. Winter air is much dirtier than monsoon air.",
      bn: "২০২৪ সালের প্রতিদিনের একটি সারি: বায়ুমান সূচক (AQI — যত বেশি, তত খারাপ), তাপমাত্রা, বৃষ্টি ও আর্দ্রতা। বর্ষার চেয়ে শীতের বাতাস অনেক বেশি দূষিত।",
    },
    rows: dhakaAir,
  },
  {
    id: "students",
    title: { en: "Students", bn: "শিক্ষার্থী" },
    desc: {
      en: "200 students: study hours per week, class attendance, sleep, and final exam score. The easiest dataset to start with.",
      bn: "২০০ জন শিক্ষার্থী: সপ্তাহে কত ঘণ্টা পড়ে, ক্লাসে উপস্থিতি, ঘুম, আর ফাইনাল পরীক্ষার নম্বর। শুরু করার জন্য সবচেয়ে সহজ ডেটাসেট।",
    },
    rows: students,
  },
];

export const dataset = (id: string) => DATASETS.find((d) => d.id === id)!;
export const columnsOf = (rows: Row[]) => Object.keys(rows[0] ?? {});

export const customerById = new Map(customers.map((c) => [c.id as number, c]));
