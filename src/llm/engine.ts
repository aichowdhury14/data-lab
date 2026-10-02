// Miniature, fully transparent versions of the pieces inside a large language model.
import type { T } from "../i18n";
import { seeded } from "../ml/extra";

// ---- Corpus -------------------------------------------------------------------
export const CORPUS = [
  "the bank approved the loan for the customer",
  "the customer paid the loan on time",
  "the bank charges interest on every loan",
  "a high credit score means low risk",
  "a low credit score means high risk",
  "the customer sent money with bkash",
  "the customer saved money in the bank",
  "the bank offers a savings account with good interest",
  "the stock price went up today",
  "the stock price went down after the news",
  "investors buy the stock when the price is low",
  "investors sell the stock when the price is high",
  "the model predicts the risk of default",
  "the model learns patterns from the data",
  "the data shows that income affects spending",
  "good data makes a good model",
  "the analyst writes sql to query the data",
  "the engineer builds a pipeline to clean the data",
  "the customer opened a new account in dhaka",
  "the bank in dhaka has many customers",
  "interest rates went up this year",
  "the loan has a fixed interest rate",
  "a late payment can hurt the credit score",
  "mobile banking makes payments easy",
  "the customer pays bills with mobile banking",
  "fraud detection protects the customer",
  "the model flags fraud when a payment looks unusual",
  "saving a little money every month builds wealth",
  "গ্রাহক ব্যাংক থেকে ঋণ নিলেন",
  "ব্যাংক ঋণের উপর সুদ নেয়",
  "গ্রাহক বিকাশে টাকা পাঠালেন",
  "ভালো ক্রেডিট স্কোর মানে কম ঝুঁকি",
  "শেয়ারের দাম আজ বেড়েছে",
  "মডেল ডেটা থেকে শেখে",
  "প্রতি মাসে অল্প টাকা সঞ্চয় করুন",
  "ঢাকায় ব্যাংকের অনেক গ্রাহক আছে",
];

// ---- Byte-pair-encoding tokenizer (SentencePiece style, ▁ marks a word start) ---
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const split = (w: string) => Array.from("▁" + w);

function trainBpe(maxMerges: number): [string, string][] {
  const freq = new Map<string, number>();
  for (const line of CORPUS) for (const w of words(line)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const vocab = [...freq].map(([w, f]) => ({ sym: split(w), f }));
  const merges: [string, string][] = [];
  while (merges.length < maxMerges) {
    const pairs = new Map<string, number>();
    for (const { sym, f } of vocab) for (let i = 0; i + 1 < sym.length; i++) pairs.set(sym[i] + "\u0000" + sym[i + 1], (pairs.get(sym[i] + "\u0000" + sym[i + 1]) ?? 0) + f);
    let best = "";
    let bestF = 1;
    for (const [p, f] of pairs) if (f > bestF) [best, bestF] = [p, f];
    if (!best) break;
    const [a, b] = best.split("\u0000");
    merges.push([a, b]);
    for (const v of vocab) v.sym = applyMerge(v.sym, a, b);
  }
  return merges;
}

function applyMerge(sym: string[], a: string, b: string) {
  const out: string[] = [];
  for (let i = 0; i < sym.length; i++) {
    if (i + 1 < sym.length && sym[i] === a && sym[i + 1] === b) {
      out.push(a + b);
      i++;
    } else out.push(sym[i]);
  }
  return out;
}

// Trained lazily, the first time the tokenizer is used (keeps the AI page quick to open).
let merges: [string, string][] | null = null;
export const getMerges = () => (merges ??= trainBpe(400));

export function tokenize(text: string, nMerges = getMerges().length): string[] {
  const MERGES = getMerges();
  const out: string[] = [];
  for (const w of words(text.toLowerCase())) {
    let sym = split(w);
    for (let m = 0; m < nMerges && sym.length > 1; m++) sym = applyMerge(sym, MERGES[m][0], MERGES[m][1]);
    out.push(...sym);
  }
  return out;
}

/** Stable id for a token so learners see numbers, not just strings. */
export function tokenId(tok: string) {
  let h = 2166136261;
  for (const ch of tok) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return (h >>> 0) % 50000;
}

// ---- Word embeddings ------------------------------------------------------------
// Hand-made meaning dimensions so the geometry is explainable.
export const DIMS = ["finance", "lending", "risk", "digital", "place", "food", "growth", "Bangladesh", "capital", "country", "India"];
type Vec = number[];
const v = (o: Partial<Record<string, number>>): Vec => DIMS.map((d) => o[d] ?? 0);

const BASE: Record<string, Vec> = {
  bank: v({ finance: 1, lending: 0.5 }),
  loan: v({ finance: 0.8, lending: 1, risk: 0.3 }),
  credit: v({ finance: 0.7, lending: 0.8 }),
  interest: v({ finance: 0.9, lending: 0.6, growth: 0.3 }),
  debt: v({ finance: 0.6, lending: 0.9, risk: 0.6 }),
  default: v({ finance: 0.5, lending: 0.7, risk: 1 }),
  fraud: v({ finance: 0.4, risk: 1, digital: 0.4 }),
  risk: v({ finance: 0.4, risk: 0.9 }),
  savings: v({ finance: 0.9, growth: 0.6 }),
  deposit: v({ finance: 1, growth: 0.4 }),
  profit: v({ finance: 0.8, growth: 1 }),
  investment: v({ finance: 0.8, growth: 0.8, risk: 0.2 }),
  stock: v({ finance: 0.7, growth: 0.6, risk: 0.4 }),
  bkash: v({ finance: 0.6, digital: 1, Bangladesh: 0.6 }),
  mobile: v({ digital: 1 }),
  app: v({ digital: 0.9 }),
  internet: v({ digital: 0.9, growth: 0.1 }),
  phone: v({ digital: 0.8, place: 0.05 }),
  dhaka: v({ place: 1, Bangladesh: 1, capital: 1 }),
  chattogram: v({ place: 1, Bangladesh: 1 }),
  bangladesh: v({ place: 1, Bangladesh: 1, country: 1 }),
  india: v({ place: 1, India: 1, country: 1 }),
  delhi: v({ place: 1, India: 1, capital: 1 }),
  mumbai: v({ place: 1, India: 1 }),
  rice: v({ food: 1, Bangladesh: 0.4 }),
  fish: v({ food: 1, Bangladesh: 0.3 }),
  tea: v({ food: 0.9, Bangladesh: 0.3 }),
  hilsa: v({ food: 1, Bangladesh: 0.8 }),
};
// Bangla words share the meaning of their English twin: a multilingual embedding space.
const TWINS: Record<string, string> = { ব্যাংক: "bank", ঋণ: "loan", সুদ: "interest", ঢাকা: "dhaka", ভাত: "rice", মাছ: "fish", ঝুঁকি: "risk", বিকাশ: "bkash" };

const rnd = seeded(99);
export const EMB: Record<string, Vec> = {};
for (const [w, vec] of Object.entries(BASE)) EMB[w] = vec.map((x) => x + (rnd() - 0.5) * 0.12);
for (const [bn, en] of Object.entries(TWINS)) EMB[bn] = BASE[en].map((x) => x + (rnd() - 0.5) * 0.12);

export const GROUP_OF = (w: string): number => {
  const e = EMB[w];
  const top = e.indexOf(Math.max(...e));
  return [0, 0, 1, 2, 3, 4, 0, 3, 3, 3, 3][top];
};
export const GROUP_NAMES: T[] = [
  { en: "finance", bn: "অর্থ" },
  { en: "risk", bn: "ঝুঁকি" },
  { en: "digital", bn: "ডিজিটাল" },
  { en: "places", bn: "স্থান" },
  { en: "food", bn: "খাবার" },
];

export const dot = (a: Vec, b: Vec) => a.reduce((s, x, i) => s + x * b[i], 0);
export const cosine = (a: Vec, b: Vec) => dot(a, b) / (Math.hypot(...a) * Math.hypot(...b) || 1);

export function nearest(q: Vec, k: number, exclude: string[] = []) {
  return Object.entries(EMB)
    .filter(([w]) => !exclude.includes(w))
    .map(([w, e]) => ({ w, s: cosine(q, e) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k);
}

/** Embedding for any word: known words use the table, unknown ones get a small pseudo-random vector. */
export function embed(w: string): Vec {
  const k = w.toLowerCase();
  if (EMB[k]) return EMB[k];
  const r = seeded(tokenId(k) + 1);
  return DIMS.map(() => (r() - 0.5) * 0.5);
}

export function softmax(xs: number[]) {
  const m = Math.max(...xs);
  const e = xs.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

/** Toy self-attention: query = key = embedding (plus a little position signal). */
export function attention(tokens: string[], sharpness: number, causal: boolean) {
  const E = tokens.map((t, i) => [...embed(t), Math.cos(i / 2) * 0.3, Math.sin(i / 2) * 0.3]);
  const d = E[0]?.length ?? 1;
  return E.map((q, i) =>
    softmax(E.map((k, j) => (causal && j > i ? -Infinity : (dot(q, k) / Math.sqrt(d)) * sharpness))),
  );
}

// ---- Next-word model (n-gram language model) -----------------------------------
const BOS = "<s>";
export const EOS = "</s>";
const bigram = new Map<string, Map<string, number>>();
const trigram = new Map<string, Map<string, number>>();
const unigram = new Map<string, number>();
const inc = (m: Map<string, Map<string, number>>, k: string, w: string) => {
  const row = m.get(k) ?? m.set(k, new Map()).get(k)!;
  row.set(w, (row.get(w) ?? 0) + 1);
};
for (const line of CORPUS) {
  const ws = [BOS, BOS, ...words(line), EOS];
  for (let i = 2; i < ws.length; i++) {
    inc(bigram, ws[i - 1], ws[i]);
    inc(trigram, ws[i - 2] + " " + ws[i - 1], ws[i]);
    unigram.set(ws[i], (unigram.get(ws[i]) ?? 0) + 1);
  }
}

export interface Candidate {
  w: string;
  count: number;
  logit: number;
  p: number;
  kept: boolean;
}

/** Next-word distribution after temperature, top-k and top-p, like an LLM's sampling settings. */
export function nextWord(context: string, temperature: number, topK: number, topP: number): { source: "trigram" | "bigram" | "unigram"; cands: Candidate[] } {
  const ws = [BOS, BOS, ...words(context.toLowerCase())];
  const a = ws[ws.length - 2];
  const b = ws[ws.length - 1];
  let source: "trigram" | "bigram" | "unigram" = "trigram";
  let row = trigram.get(a + " " + b);
  if (!row) {
    source = "bigram";
    row = bigram.get(b);
  }
  if (!row) {
    source = "unigram";
    row = unigram;
  }
  const entries = [...row].sort((x, y) => y[1] - x[1]);
  const logits = entries.map(([, c]) => Math.log(c));
  const probs = softmax(logits.map((l) => l / Math.max(temperature, 0.01)));
  let cum = 0;
  const cands = entries.map(([w, count], i) => {
    const kept = i < topK && cum < topP;
    cum += probs[i];
    return { w, count, logit: logits[i], p: probs[i], kept };
  });
  const keptMass = cands.filter((c) => c.kept).reduce((s, c) => s + c.p, 0);
  return { source, cands: cands.map((c) => ({ ...c, p: c.kept ? c.p / keptMass : 0 })) };
}

export function sample(cands: Candidate[]) {
  let r = Math.random();
  for (const c of cands) {
    if (!c.kept) continue;
    r -= c.p;
    if (r <= 0) return c.w;
  }
  return cands.find((c) => c.kept)?.w ?? EOS;
}

// ---- Retrieval-augmented generation -------------------------------------------
export const DOCS: { title: T; text: T }[] = [
  { title: { en: "Loan eligibility", bn: "ঋণের যোগ্যতা" }, text: { en: "To get a personal loan you need a credit score above 650 and a stable monthly income of at least 20,000 BDT.", bn: "পার্সোনাল ঋণ পেতে ৬৫০-এর বেশি ক্রেডিট স্কোর এবং কমপক্ষে ২০,০০০ টাকা স্থির মাসিক আয় লাগবে।" } },
  { title: { en: "Loan interest rates", bn: "ঋণের সুদের হার" }, text: { en: "Personal loan interest rates range from 9% to 14% a year, depending on the credit score.", bn: "পার্সোনাল ঋণের বার্ষিক সুদের হার ৯% থেকে ১৪%, ক্রেডিট স্কোরের ওপর নির্ভর করে।" } },
  { title: { en: "Mobile transfer limit", bn: "মোবাইল ট্রান্সফার সীমা" }, text: { en: "You can send up to 25,000 BDT per transaction and 100,000 BDT per day with mobile banking.", bn: "মোবাইল ব্যাংকিংয়ে প্রতি লেনদেনে ২৫,০০০ টাকা এবং দিনে ১,০০,০০০ টাকা পর্যন্ত পাঠানো যায়।" } },
  { title: { en: "Savings account", bn: "সঞ্চয়ী হিসাব" }, text: { en: "Savings accounts earn 5% yearly interest, paid every month, with no minimum balance.", bn: "সঞ্চয়ী হিসাবে বছরে ৫% সুদ, প্রতি মাসে দেওয়া হয়, কোনো ন্যূনতম ব্যালান্স লাগে না।" } },
  { title: { en: "Late payment", bn: "দেরিতে পরিশোধ" }, text: { en: "A late loan payment adds a 2% fee and lowers your credit score.", bn: "ঋণের কিস্তি দেরিতে দিলে ২% জরিমানা হয় এবং ক্রেডিট স্কোর কমে যায়।" } },
  { title: { en: "Fraud safety", bn: "প্রতারণা থেকে নিরাপত্তা" }, text: { en: "Never share your PIN or OTP with anyone. The bank will never ask for your PIN by phone.", bn: "কাউকে কখনো আপনার পিন বা ওটিপি দেবেন না। ব্যাংক কখনো ফোনে পিন চায় না।" } },
  { title: { en: "Lost card", bn: "কার্ড হারালে" }, text: { en: "If your card is lost, block it in the mobile app immediately and request a new card.", bn: "কার্ড হারালে সঙ্গে সঙ্গে মোবাইল অ্যাপে ব্লক করুন এবং নতুন কার্ডের আবেদন করুন।" } },
  { title: { en: "Opening an account", bn: "হিসাব খোলা" }, text: { en: "To open an account bring your NID card, one photo and an active phone number.", bn: "হিসাব খুলতে আপনার এনআইডি কার্ড, একটি ছবি এবং সচল ফোন নম্বর আনুন।" } },
  { title: { en: "Improving credit score", bn: "ক্রেডিট স্কোর বাড়ানো" }, text: { en: "Your credit score rises when you repay on time and keep your debt low compared to income.", bn: "সময়মতো পরিশোধ করলে এবং আয়ের তুলনায় ঋণ কম রাখলে ক্রেডিট স্কোর বাড়ে।" } },
  { title: { en: "Branch hours", bn: "শাখার সময়" }, text: { en: "Branches are open Sunday to Thursday, 10am to 4pm. The app works 24/7.", bn: "শাখা রবিবার থেকে বৃহস্পতিবার সকাল ১০টা থেকে বিকাল ৪টা খোলা। অ্যাপ ২৪/৭ চলে।" } },
];

const STOP = new Set("a an the to of and or is are you your i my me for with in on at by can how what when do does it be will from per much many there".split(" "));
const terms = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .flatMap((w) => [w, ...(w.length > 4 ? [w.slice(0, 4)] : [])]); // crude stemming: also index the first 4 letters

const docTerms = DOCS.map((d) => terms(d.title.en + " " + d.text.en + " " + d.title.bn + " " + d.text.bn));
const df = new Map<string, number>();
docTerms.forEach((ts) => new Set(ts).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)));
const idf = (t: string) => Math.log((DOCS.length + 1) / ((df.get(t) ?? 0) + 1)) + 1;
const tfidf = (ts: string[]) => {
  const m = new Map<string, number>();
  ts.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1));
  for (const [t, c] of m) m.set(t, c * idf(t));
  return m;
};
const docVecs = docTerms.map(tfidf);
const cos = (a: Map<string, number>, b: Map<string, number>) => {
  let d = 0;
  for (const [t, x] of a) d += x * (b.get(t) ?? 0);
  const na = Math.hypot(...a.values());
  const nb = Math.hypot(...b.values());
  return na && nb ? d / (na * nb) : 0;
};

export function retrieve(query: string) {
  const q = tfidf(terms(query));
  return DOCS.map((d, i) => ({ i, doc: d, score: cos(q, docVecs[i]) })).sort((a, b) => b.score - a.score);
}

// ---- Publicly reported model sizes (parameters, billions) ------------------------
export const MODEL_SIZES = [
  { name: "BERT-Large", year: 2018, params: 0.34 },
  { name: "GPT-2", year: 2019, params: 1.5 },
  { name: "T5-11B", year: 2019.6, params: 11 },
  { name: "GPT-3", year: 2020.4, params: 175 },
  { name: "PaLM", year: 2022.3, params: 540 },
  { name: "LLaMA", year: 2023.1, params: 65 },
  { name: "Llama 2", year: 2023.5, params: 70 },
  { name: "Llama 3.1", year: 2024.5, params: 405 },
];
