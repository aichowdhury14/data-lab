import { useEffect, useMemo, useState } from "react";
import { useLang, type T } from "../i18n";
import {
  DIMS,
  DOCS,
  EMB,
  EOS,
  GROUP_NAMES,
  GROUP_OF,
  getMerges,
  MODEL_SIZES,
  attention,
  nearest,
  nextWord,
  retrieve,
  sample,
  tokenId,
  tokenize,
} from "../llm/engine";
import { pca2 } from "../ml/extra";
import { HBars, Heatmap, Legend, PALETTE, Scatter, XY } from "../components/charts";
import { Callout, PageHead, Picker, Slider, Stat, type PickerItem, Plain } from "../components/ui";
import { useMark, useProgress } from "../progress";
import { Agent } from "./LLMAgent";
import { TrainGPT } from "./LLMTrain";
import { Quiz } from "../components/Quiz";

type Tab = "overview" | "tokens" | "embed" | "attention" | "generate" | "train" | "rag" | "agent" | "prompt";

const LABS: PickerItem<Tab>[] = [
  { id: "overview", icon: "🗺️", label: { en: "How an LLM works", bn: "এলএলএম কীভাবে কাজ করে" }, tag: { en: "the big picture", bn: "পুরো ছবি" } },
  { id: "tokens", icon: "🧩", label: { en: "Tokenizer", bn: "টোকেনাইজার" }, tag: { en: "text → pieces", bn: "টেক্সট → টুকরো" } },
  { id: "embed", icon: "🧭", label: { en: "Embeddings", bn: "এমবেডিং" }, tag: { en: "meaning as numbers", bn: "সংখ্যায় অর্থ" } },
  { id: "attention", icon: "🔦", label: { en: "Attention", bn: "অ্যাটেনশন" }, tag: { en: "who looks at whom", bn: "কে কার দিকে তাকায়" } },
  { id: "generate", icon: "🎲", label: { en: "Next-word sampling", bn: "পরের শব্দ বাছাই" }, tag: { en: "temperature, top-k, top-p", bn: "টেম্পারেচার, top-k, top-p" } },
  { id: "train", icon: "🏋️", label: { en: "Train a tiny GPT", bn: "ছোট GPT ট্রেন করুন" }, tag: { en: "live, in your browser", bn: "লাইভ, ব্রাউজারেই" } },
  { id: "rag", icon: "📚", label: { en: "RAG", bn: "RAG" }, tag: { en: "answer from your documents", bn: "নিজের ডকুমেন্ট থেকে উত্তর" } },
  { id: "agent", icon: "🤖", label: { en: "AI agent", bn: "এআই এজেন্ট" }, tag: { en: "think → use tools → answer", bn: "ভাবা → টুল → উত্তর" } },
  { id: "prompt", icon: "💬", label: { en: "Prompting & limits", bn: "প্রম্পটিং ও সীমাবদ্ধতা" }, tag: { en: "write better prompts", bn: "ভালো প্রম্পট লেখা" } },
];

export default function LLM() {
  const [tab, setTab] = useState<Tab>("overview");
  useMark("llm", tab);
  const done = useProgress().llm ?? [];
  return (
    <>
      <PageHead
        title={{ en: "AI & Large Language Models", bn: "এআই ও লার্জ ল্যাঙ্গুয়েজ মডেল" }}
        sub={{
          en: "ChatGPT, Claude and Gemini all do one simple thing really well: guess the next word. Each lab below rebuilds one small part of that machine, so you can play with it and see how it works.",
          bn: "ChatGPT, Claude আর Gemini সবাই একটা সহজ কাজ খুব ভালোভাবে করে: পরের শব্দটা আন্দাজ করা। নিচের প্রতিটা ল্যাবে সেই যন্ত্রের একটা ছোট অংশ বানানো হয়েছে, যাতে আপনি নিজে নেড়েচেড়ে দেখতে পারেন এটা কীভাবে কাজ করে।",
        }}
        art="llm"
      />
      <Picker items={LABS.map((l) => ({ ...l, done: done.includes(l.id) }))} value={tab} onChange={setTab} />
      <div className="model-body" key={tab}>
        {tab === "overview" && <Overview go={setTab} />}
        {tab === "tokens" && <Tokens />}
        {tab === "embed" && <Embeddings />}
        {tab === "attention" && <Attention />}
        {tab === "generate" && <Generate />}
        {tab === "rag" && <Rag />}
        {tab === "train" && <TrainGPT />}
        {tab === "agent" && <Agent />}
        {tab === "prompt" && <Prompting />}
      </div>
      <Quiz id="llm" />
    </>
  );
}

// ---- Overview ---------------------------------------------------------------------
const STAGES: { tab: Tab; title: T; body: T }[] = [
  { tab: "tokens", title: { en: "1. Tokenize", bn: "১. টোকেনাইজ" }, body: { en: "Split text into tokens and give each an ID.", bn: "টেক্সটকে টোকেনে ভাগ করে প্রতিটিকে একটি আইডি দেওয়া।" } },
  { tab: "embed", title: { en: "2. Embed", bn: "২. এমবেড" }, body: { en: "Turn each ID into a vector of numbers that carries meaning.", bn: "প্রতিটি আইডিকে অর্থবহ সংখ্যার ভেক্টরে রূপান্তর।" } },
  { tab: "attention", title: { en: "3. Attend ×N", bn: "৩. অ্যাটেনশন ×N" }, body: { en: "Transformer layers let every token look at the others to understand context.", bn: "ট্রান্সফর্মার লেয়ারে প্রতিটি টোকেন অন্যদের দেখে প্রসঙ্গ বোঝে।" } },
  { tab: "generate", title: { en: "4. Predict", bn: "৪. অনুমান" }, body: { en: "Output a probability for every possible next token.", bn: "সম্ভাব্য প্রতিটি পরের টোকেনের সম্ভাবনা বের করা।" } },
  { tab: "generate", title: { en: "5. Sample & repeat", bn: "৫. বাছাই ও পুনরাবৃত্তি" }, body: { en: "Pick one token, append it, and run the whole thing again.", bn: "একটি টোকেন বেছে যোগ করা, তারপর আবার পুরোটা চালানো।" } },
];

function StageVisual({ i }: { i: number }) {
  if (i === 0)
    return (
      <div className="mini-chips">
        {["▁the", "▁bank", "▁appro", "ved"].map((x, k) => (
          <span key={k} style={{ background: PALETTE[k] }}>
            {x}
          </span>
        ))}
      </div>
    );
  if (i === 1)
    return (
      <div className="mini-vec">
        {[0.8, -0.3, 0.5, 0.9, -0.6, 0.2, 0.4].map((v, k) => (
          <span key={k} style={{ height: `${Math.abs(v) * 30 + 4}px`, background: v > 0 ? "var(--c1)" : "var(--c2)" }} />
        ))}
      </div>
    );
  if (i === 2)
    return (
      <div className="mini-grid">
        {Array.from({ length: 16 }, (_, k) => (
          <span key={k} style={{ opacity: 0.15 + ((k * 7) % 10) / 12 }} />
        ))}
      </div>
    );
  if (i === 3)
    return (
      <div className="mini-probs">
        {[
          ["loan", 62],
          ["account", 21],
          ["card", 9],
        ].map(([w, p]) => (
          <div key={w}>
            <span>{w}</span>
            <i style={{ width: `${p}%` }} />
          </div>
        ))}
      </div>
    );
  return <div className="mini-text">the bank approved the <b>loan</b>▌</div>;
}

function Overview({ go }: { go: (t: Tab) => void }) {
  const { t } = useLang();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 1800);
    return () => clearInterval(id);
  }, [auto]);
  return (
    <>
      <Plain k="llm-overview" />
      <div className="stages">
        {STAGES.map((s, i) => (
          <button
            key={i}
            className={`stage${active === i ? " on" : ""}`}
            onMouseEnter={() => {
              setAuto(false);
              setActive(i);
            }}
            onClick={() => go(s.tab)}
          >
            <b>{t(s.title)}</b>
            <StageVisual i={i} />
            <small>{t(s.body)}</small>
          </button>
        ))}
      </div>
      <p className="muted small center">{t({ en: "Hover a stage to pause · click to open its lab", bn: "থামাতে কোনো ধাপে মাউস রাখুন · ল্যাব খুলতে ক্লিক করুন" })}</p>

      <div className="grid cols2" style={{ marginTop: 12 }}>
        <div className="card">
          <h3>{t({ en: "Models keep getting bigger", bn: "মডেল ক্রমশ বড় হচ্ছে" })}</h3>
          <XY
            series={[{ name: "params", pts: MODEL_SIZES.map((m) => [m.year, m.params] as [number, number]), color: "var(--c4)" }]}
            markers={MODEL_SIZES.map((m) => ({ x: m.year, y: m.params, label: m.name, color: "var(--c4)" }))}
            ylog
            xDomain={[2017.6, 2025.2]}
            xFmt={(v) => String(Math.round(v))}
            yLabel={t({ en: "parameters (billions, log scale)", bn: "প্যারামিটার (বিলিয়ন, লগ স্কেল)" })}
            h={300}
          />
          <p className="muted small" style={{ margin: 0 }}>
            {t({
              en: "Publicly reported sizes. Each grid line is 10× the one below. Many newer models no longer publish their size.",
              bn: "প্রকাশ্যে জানানো আকার। প্রতিটি গ্রিড লাইন নিচেরটির ১০ গুণ। নতুন অনেক মডেল এখন আর আকার প্রকাশ করে না।",
            })}
          </p>
        </div>
        <div className="card">
          <h3>{t({ en: "Three ideas to remember", bn: "মনে রাখার তিনটি ধারণা" })}</h3>
          <ol className="steps">
            <li>
              {t({
                en: "An LLM is a next-token predictor trained on a huge amount of text. Everything else — chatting, coding, translating — emerges from that.",
                bn: "এলএলএম হলো বিপুল টেক্সটে প্রশিক্ষিত পরের-টোকেন অনুমানকারী। চ্যাট, কোডিং, অনুবাদ — সবকিছু এখান থেকেই আসে।",
              })}
            </li>
            <li>
              {t({
                en: "Its 'knowledge' lives in billions of learned numbers (parameters), not in a database. It can be confidently wrong (hallucinate).",
                bn: "এর ‘জ্ঞান’ থাকে শত কোটি শেখা সংখ্যায় (প্যারামিটার), ডেটাবেসে নয়। তাই এটি আত্মবিশ্বাসের সাথে ভুলও বলতে পারে (হ্যালুসিনেশন)।",
              })}
            </li>
            <li>
              {t({
                en: "You steer it with the prompt, with retrieved documents (RAG), and with fine-tuning on your own examples.",
                bn: "প্রম্পট, খুঁজে আনা ডকুমেন্ট (RAG) এবং নিজের উদাহরণে ফাইন-টিউনিং দিয়ে একে নিয়ন্ত্রণ করা যায়।",
              })}
            </li>
          </ol>
          <Callout kind="tip" title={{ en: "LLM vs the ML you just learned", bn: "এলএলএম বনাম যে এমএল শিখলেন" }}>
            <p>
              {t({
                en: "Same core idea as logistic regression — weights, a loss, gradient descent — just billions of weights and text instead of three loan features.",
                bn: "মূল ধারণা লজিস্টিক রিগ্রেশনের মতোই — ওজন, লস, গ্রেডিয়েন্ট ডিসেন্ট — শুধু তিনটি ঋণ-ফিচারের বদলে শত কোটি ওজন আর টেক্সট।",
              })}
            </p>
          </Callout>
        </div>
      </div>
    </>
  );
}

// ---- Tokenizer ----------------------------------------------------------------------
const hue = (tok: string) => PALETTE[tokenId(tok) % PALETTE.length];

function Tokens() {
  const { t } = useLang();
  const [text, setText] = useState("The customer paid the loan on time. গ্রাহক ব্যাংক থেকে ঋণ নিলেন।");
  const MERGES = getMerges();
  const [merges, setMerges] = useState(MERGES.length);
  const [showIds, setShowIds] = useState(false);
  const toks = tokenize(text, merges);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const isBn = (w: string) => /[ঀ-৿]/.test(w);
  const per = (f: (w: string) => boolean) => {
    const ws = words.filter(f);
    return ws.length ? tokenize(ws.join(" "), merges).length / ws.length : 0;
  };
  const curve = useMemo(() => {
    const pts: [number, number][] = [];
    for (let m = 0; m <= MERGES.length; m += Math.max(1, Math.floor(MERGES.length / 30))) pts.push([m, tokenize(text, m).length]);
    return pts;
  }, [text, MERGES]);

  return (
    <>
      <p>
        {t({
          en: "Before a model can read your text, it cuts it into small pieces called tokens. Type anything in the box — English or Bangla — and watch it get cut. Move the slider to see how a tokenizer slowly learns bigger pieces.",
          bn: "মডেল আপনার লেখা পড়ার আগে সেটাকে ছোট ছোট টুকরোয় কাটে, যাদের বলে টোকেন। বক্সে যা খুশি লিখুন — ইংরেজি বা বাংলা — আর দেখুন কীভাবে কাটা হয়। স্লাইডার নাড়িয়ে দেখুন টোকেনাইজার কীভাবে ধীরে ধীরে বড় টুকরো চিনতে শেখে।",
        })}
      </p>
      <Plain k="tokens" />
      <textarea className="code" style={{ minHeight: 80, fontFamily: "inherit", fontSize: "1rem" }} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row spread" style={{ margin: "10px 0" }}>
        <Slider label={t({ en: "merges learned", bn: "শেখা মার্জ" })} value={merges} min={0} max={MERGES.length} step={1} onChange={setMerges} />
        <label className="row small">
          <input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} /> {t({ en: "show token IDs", bn: "টোকেন আইডি দেখান" })}
        </label>
      </div>
      <div className="token-box">
        {toks.map((tk, i) => (
          <span key={i} className="token" style={{ ["--tc" as string]: hue(tk) }} title={`id ${tokenId(tk)}`}>
            {showIds ? tokenId(tk) : tk.replace("▁", "·")}
          </span>
        ))}
      </div>
      <div className="stats" style={{ marginTop: 12 }}>
        <Stat label={t({ en: "characters", bn: "অক্ষর" })} value={String(Array.from(text).length)} />
        <Stat label={t({ en: "words", bn: "শব্দ" })} value={String(words.length)} />
        <Stat label={t({ en: "tokens", bn: "টোকেন" })} value={String(toks.length)} />
        <Stat label={t({ en: "tokens / English word", bn: "টোকেন / ইংরেজি শব্দ" })} value={per((w) => !isBn(w)).toFixed(2)} />
        <Stat label={t({ en: "tokens / Bangla word", bn: "টোকেন / বাংলা শব্দ" })} value={per(isBn).toFixed(2)} />
      </div>
      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t({ en: "More merges → fewer tokens", bn: "বেশি মার্জ → কম টোকেন" })}</h3>
          <XY
            series={[{ name: "tokens", pts: curve, area: true }]}
            markers={[{ x: merges, y: toks.length }]}
            xLabel={t({ en: "merges learned (vocabulary size)", bn: "শেখা মার্জ (শব্দভান্ডারের আকার)" })}
            yLabel={t({ en: "tokens for your text", bn: "আপনার টেক্সটের টোকেন" })}
            h={240}
          />
        </div>
        <div className="card">
          <h3>{t({ en: "First merges the tokenizer learned", bn: "টোকেনাইজারের প্রথম শেখা মার্জগুলো" })}</h3>
          <div className="merge-list">
            {MERGES.slice(0, 24).map(([a, b], i) => (
              <span key={i} className="chip">
                {a.replace("▁", "·")} + {b.replace("▁", "·")} → <b>{(a + b).replace("▁", "·")}</b>
              </span>
            ))}
          </div>
          <Callout kind="warn" title={{ en: "Why Bangla costs more", bn: "বাংলায় খরচ বেশি কেন" }}>
            <p>
              {t({
                en: "Tokenizers trained mostly on English learn few Bangla merges, so a Bangla word splits into many small pieces. More tokens = higher API cost, shorter effective memory, and often weaker answers. Compare the two 'tokens / word' numbers above.",
                bn: "মূলত ইংরেজিতে প্রশিক্ষিত টোকেনাইজার বাংলার মার্জ কম শেখে, তাই একটি বাংলা শব্দ অনেক ছোট টুকরোয় ভাঙে। বেশি টোকেন = বেশি এপিআই খরচ, কম কার্যকর মেমরি, আর প্রায়ই দুর্বল উত্তর। ওপরের দুটি ‘টোকেন / শব্দ’ সংখ্যা তুলনা করুন।",
              })}
            </p>
          </Callout>
        </div>
      </div>
    </>
  );
}

// ---- Embeddings ----------------------------------------------------------------------
const WORDS = Object.keys(EMB);
const PROJ = pca2(WORDS.map((w) => EMB[w]));
// A label is drawn only if no other word sits too close, so dense clusters stay readable.
const ROOMY = PROJ.proj.map((p, i) => PROJ.proj.every((q, j) => i === j || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.09));
const ANALOGIES: [string, string, string][] = [
  ["dhaka", "bangladesh", "india"],
  ["ঢাকা", "bangladesh", "india"],
  ["savings", "growth", "risk"],
  ["bkash", "mobile", "bank"],
];

function Embeddings() {
  const { t } = useLang();
  const [word, setWord] = useState("loan");
  const [[a, b, c], setAbc] = useState<[string, string, string]>(ANALOGIES[0]);
  const sel = WORDS.indexOf(word);
  const neigh = nearest(EMB[word], 7, [word]);
  const labelled = new Set([word, ...neigh.slice(0, 3).map((n) => n.w)]);
  const target = EMB[a].map((x, i) => x - EMB[b][i] + EMB[c][i]);
  const ans = nearest(target, 5, [a, b, c]);
  const groups = [...new Set(WORDS.map(GROUP_OF))].sort();

  return (
    <>
      <p>
        {t({
          en: "To a model, every word is a list of numbers called an embedding. Words with similar meanings get similar numbers, so they sit close together on this map. Click any word to see its closest neighbours.",
          bn: "মডেলের কাছে প্রতিটা শব্দ হলো সংখ্যার একটা তালিকা, যাকে বলে এমবেডিং। কাছাকাছি অর্থের শব্দের সংখ্যাও কাছাকাছি, তাই মানচিত্রে তারা পাশাপাশি বসে। যেকোনো শব্দে ক্লিক করে তার সবচেয়ে কাছের প্রতিবেশীদের দেখুন।",
        })}
      </p>
      <Plain k="embed" />
      <div className="grid cols2">
        <div className="card">
          <Scatter
            points={WORDS.map((w, i) => ({ x: PROJ.proj[i][0], y: PROJ.proj[i][1], c: GROUP_OF(w), label: ROOMY[i] || labelled.has(w) ? w : undefined, r: w === word ? 7 : 5 }))}
            highlight={sel}
            h={420}
            onPick={(x, y) => {
              let best = 0;
              let bd = Infinity;
              PROJ.proj.forEach((p, i) => {
                const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
                if (d < bd) [bd, best] = [d, i];
              });
              setWord(WORDS[best]);
            }}
            over={({ sx, sy }) =>
              neigh.slice(0, 4).map((n) => {
                const j = WORDS.indexOf(n.w);
                return <line key={n.w} x1={sx(PROJ.proj[sel][0])} y1={sy(PROJ.proj[sel][1])} x2={sx(PROJ.proj[j][0])} y2={sy(PROJ.proj[j][1])} stroke="var(--text)" strokeDasharray="3 3" opacity={0.5} />;
              })
            }
            xLabel={`PC1 (${(PROJ.explained[0] * 100).toFixed(0)}%)`}
            yLabel={`PC2 (${(PROJ.explained[1] * 100).toFixed(0)}%)`}
          />
          <Legend names={groups.map((g) => t(GROUP_NAMES[g]))} colors={groups.map((g) => PALETTE[g])} />
        </div>
        <div className="card">
          <div className="row">
            <h3 style={{ margin: 0 }}>
              {t({ en: "Nearest to", bn: "সবচেয়ে কাছের" })} “{word}”
            </h3>
            <select value={word} onChange={(e) => setWord(e.target.value)}>
              {WORDS.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </div>
          <HBars items={neigh.map((n) => ({ label: n.w, value: n.s, color: PALETTE[GROUP_OF(n.w)] }))} max={1} format={(v) => v.toFixed(2)} />
          <p className="muted small">{t({ en: "Cosine similarity: 1 = same direction, 0 = unrelated.", bn: "কোসাইন সিমিলারিটি: ১ = একই দিক, ০ = সম্পর্কহীন।" })}</p>
          <h3>{t({ en: `“${word}” as numbers`, bn: `সংখ্যায় “${word}”` })}</h3>
          <HBars items={DIMS.map((d, i) => ({ label: d, value: Math.max(0, EMB[word][i]), color: "var(--c4)" }))} max={1.1} format={(v) => v.toFixed(2)} />
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>{t({ en: "Vector arithmetic: meaning you can add and subtract", bn: "ভেক্টর গণিত: অর্থ যোগ-বিয়োগ করা যায়" })}</h3>
        <div className="row">
          {[a, b, c].map((w, k) => (
            <span key={k} className="row" style={{ gap: 6 }}>
              {k === 1 && <b>−</b>}
              {k === 2 && <b>+</b>}
              <select
                value={w}
                onChange={(e) => {
                  const next: [string, string, string] = [a, b, c];
                  next[k] = e.target.value;
                  setAbc(next);
                }}
              >
                {WORDS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </span>
          ))}
          <b>≈</b>
          <span className="answer-pill">{ans[0].w}</span>
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {ANALOGIES.map((an, i) => (
            <button key={i} className="chip-btn" onClick={() => setAbc(an)}>
              {an[0]} − {an[1]} + {an[2]}
            </button>
          ))}
        </div>
        <HBars items={ans.map((n) => ({ label: n.w, value: n.s, color: PALETTE[GROUP_OF(n.w)] }))} max={1} format={(v) => v.toFixed(2)} />
        <Callout kind="idea" title={{ en: "Bangla and English share one space", bn: "বাংলা ও ইংরেজি একই জায়গায়" }}>
          <p>
            {t({
              en: "Notice ঋণ sits right next to loan, and ঢাকা next to dhaka. Multilingual models learn that different words in different languages can mean the same thing — that's how they translate.",
              bn: "লক্ষ করুন ঋণ বসে আছে loan-এর ঠিক পাশে, ঢাকা আছে dhaka-র পাশে। বহুভাষিক মডেল শেখে যে ভিন্ন ভাষার ভিন্ন শব্দ একই অর্থ বহন করতে পারে — এভাবেই তারা অনুবাদ করে।",
            })}
          </p>
        </Callout>
      </div>
    </>
  );
}

// ---- Attention ----------------------------------------------------------------------
const SENTENCES = ["the bank gave a loan with low interest in dhaka", "fraud risk on the mobile app worried the bank", "customer sent money with bkash to buy fish and rice", "ব্যাংক ঋণ দিল ঢাকা শহরে কম সুদে"];

function Attention() {
  const { t } = useLang();
  const [text, setText] = useState(SENTENCES[0]);
  const [sharp, setSharp] = useState(5);
  const [causal, setCausal] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const toks = text.trim().split(/\s+/).filter(Boolean).slice(0, 14);
  const A = toks.length ? attention(toks, sharp, causal) : [];
  const firstKnown = Math.max(0, toks.findIndex((tk) => EMB[tk.toLowerCase()]));
  const f = focus !== null && focus < toks.length ? focus : firstKnown;
  const pickSentence = (s: string) => {
    setText(s);
    setFocus(null);
  };
  const W = 640;
  const step = W / Math.max(toks.length, 1);

  return (
    <>
      <p>
        {t({
          en: "To understand a sentence, each word needs to “look at” the other words. Attention decides how much each word looks at every other word. Click a word below to see where it looks — thicker lines mean more attention.",
          bn: "একটা বাক্য বুঝতে প্রতিটা শব্দকে অন্য শব্দগুলোর দিকে “তাকাতে” হয়। অ্যাটেনশন ঠিক করে কোন শব্দ কোন শব্দের দিকে কতটা তাকাবে। নিচের কোনো শব্দে ক্লিক করে দেখুন সে কোথায় তাকায় — মোটা দাগ মানে বেশি মনোযোগ।",
        })}
      </p>
      <Plain k="attention" />
      <div className="chips" style={{ marginBottom: 8 }}>
        {SENTENCES.map((s) => (
          <button key={s} className={`chip-btn${text === s ? " on" : ""}`} onClick={() => pickSentence(s)}>
            {s.length > 34 ? s.slice(0, 33) + "…" : s}
          </button>
        ))}
      </div>
      <input type="text" value={text} onChange={(e) => pickSentence(e.target.value)} style={{ width: "100%" }} />
      <div className="row" style={{ margin: "10px 0" }}>
        <Slider label={t({ en: "sharpness (1/temperature)", bn: "তীক্ষ্ণতা (১/টেম্পারেচার)" })} value={sharp} min={0.2} max={8} step={0.2} show={sharp.toFixed(1)} onChange={setSharp} />
        <label className="row small">
          <input type="checkbox" checked={causal} onChange={(e) => setCausal(e.target.checked)} />
          {t({ en: "causal mask (GPT-style: can't look ahead)", bn: "কজাল মাস্ক (GPT-ধরন: সামনে দেখা যাবে না)" })}
        </label>
      </div>
      {toks.length > 0 && (
        <>
          <div className="card">
            <h3>
              {t({ en: "What does", bn: "কী দেখে" })} “{toks[f]}” {t({ en: "attend to?", bn: "?" })}
            </h3>
            <svg viewBox={`0 0 ${W} 150`} className="chart">
              {toks.map((_, j) => {
                const w = A[f][j];
                if (w < 0.01 || j === f) return null;
                const x1 = f * step + step / 2;
                const x2 = j * step + step / 2;
                const hgt = Math.min(110, Math.abs(x2 - x1) * 0.6 + 16);
                return <path key={j} d={`M${x1},118 Q${(x1 + x2) / 2},${118 - hgt} ${x2},118`} fill="none" stroke="var(--c4)" strokeWidth={1 + w * 18} opacity={0.25 + w * 1.5} strokeLinecap="round" />;
              })}
              {toks.map((tk, j) => (
                <g key={j} onClick={() => setFocus(j)} style={{ cursor: "pointer" }}>
                  <rect x={j * step + 3} y={122} width={step - 6} height={24} rx={6} fill={j === f ? "var(--c4)" : "var(--bg2)"} stroke="var(--line)" />
                  <text x={j * step + step / 2} y={138} textAnchor="middle" className="tok-txt" style={{ fill: j === f ? "#fff" : "var(--text)" }}>
                    {tk.length > 9 ? tk.slice(0, 8) + "…" : tk}
                  </text>
                  <text x={j * step + step / 2} y={114 - Math.min(110, Math.abs(j * step - f * step) * 0.6 + 16) / 2} textAnchor="middle" className="tick">
                    {j !== f && A[f][j] >= 0.04 ? `${Math.round(A[f][j] * 100)}%` : ""}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="grid cols2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>{t({ en: "Attention matrix", bn: "অ্যাটেনশন ম্যাট্রিক্স" })}</h3>
              <Heatmap rows={toks} cols={toks} values={A} max={Math.max(...A.flat())} cell={toks.length > 9 ? 38 : 50} format={(v) => (v * 100).toFixed(0)} onHover={(r) => r !== null && setFocus(r)} active={f} />
            </div>
            <Callout kind="tip" title={{ en: "Query, Key, Value in one breath", bn: "এক নিঃশ্বাসে কোয়েরি, কি, ভ্যালু" }}>
              <p>
                {t({
                  en: "Each token makes a Query (what am I looking for?), a Key (what do I offer?) and a Value (my information). Score = Query · Key, softmax turns scores into the percentages you see, and the output is the weighted mix of Values.",
                  bn: "প্রতিটি টোকেন বানায় একটি কোয়েরি (আমি কী খুঁজছি?), একটি কি (আমি কী দিতে পারি?) ও একটি ভ্যালু (আমার তথ্য)। স্কোর = কোয়েরি · কি, softmax স্কোরকে আপনার দেখা শতাংশে রূপান্তর করে, আর আউটপুট হলো ভ্যালুগুলোর ওজনযুক্ত মিশ্রণ।",
                })}
              </p>
              <p>
                {t({
                  en: "Here Query = Key = our toy embedding, so related words (bank ↔ loan ↔ interest) attend to each other. Real models learn separate Q/K/V matrices and run dozens of attention 'heads' in parallel.",
                  bn: "এখানে কোয়েরি = কি = আমাদের খেলনা এমবেডিং, তাই সম্পর্কিত শব্দ (bank ↔ loan ↔ interest) একে অপরের দিকে তাকায়। আসল মডেল আলাদা Q/K/V ম্যাট্রিক্স শেখে এবং একসাথে ডজনখানেক অ্যাটেনশন ‘হেড’ চালায়।",
                })}
              </p>
            </Callout>
          </div>
        </>
      )}
    </>
  );
}

// ---- Next-word sampling ------------------------------------------------------------
function Generate() {
  const { t } = useLang();
  const [prompt, setPrompt] = useState("the customer");
  const [added, setAdded] = useState<string[]>([]);
  const [temp, setTemp] = useState(1);
  const [topK, setTopK] = useState(10);
  const [topP, setTopP] = useState(1);
  const context = [prompt, ...added].join(" ");
  const { source, cands } = nextWord(context, temp, topK, topP);
  const finished = added[added.length - 1] === EOS;

  const step = (n: number) => {
    let ctx = context;
    const out = [...added];
    for (let i = 0; i < n; i++) {
      if (out[out.length - 1] === EOS) break;
      const w = sample(nextWord(ctx, temp, topK, topP).cands);
      out.push(w);
      ctx += " " + w;
    }
    setAdded(out);
  };

  return (
    <>
      <p>
        {t({
          en: "Here you play the model's final step: it lists the possible next words with their chances, then picks one. Press “+ next word” again and again to build a sentence, and use the sliders to make it safe or wild. (Our model is tiny and only learned from this site's sentences.)",
          bn: "এখানে মডেলের শেষ ধাপটা নিজে খেলতে পারবেন: সে সম্ভাব্য পরের শব্দগুলো তাদের সম্ভাবনাসহ সাজায়, তারপর একটা বাছে। বারবার “+ পরের শব্দ” চেপে একটা বাক্য বানান, আর স্লাইডার দিয়ে একে নিরাপদ বা উদ্দাম করুন। (আমাদের মডেলটা খুব ছোট, শুধু এই সাইটের বাক্যগুলো থেকে শেখা।)",
        })}
      </p>
      <Plain k="generate" />
      <div className="grid cols2">
        <div className="card">
          <label className="small muted">{t({ en: "Prompt", bn: "প্রম্পট" })}</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setAdded([]);
            }}
            style={{ width: "100%" }}
          />
          <div className="gen-text">
            {prompt}{" "}
            {added.map((w, i) => (
              <span key={i} className="gen-word" style={{ animationDelay: "0s" }}>
                {w === EOS ? "⏹" : w}{" "}
              </span>
            ))}
            {!finished && <span className="caret">▌</span>}
          </div>
          <div className="row">
            <button className="btn" disabled={finished} onClick={() => step(1)}>
              + {t({ en: "next word", bn: "পরের শব্দ" })}
            </button>
            <button className="btn ghost" disabled={finished} onClick={() => step(12)}>
              ⚡ {t({ en: "generate", bn: "জেনারেট" })}
            </button>
            <button className="btn ghost" onClick={() => setAdded([])}>
              ↺
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <Slider label={t({ en: "temperature", bn: "টেম্পারেচার" })} value={temp} min={0.1} max={3} step={0.1} show={temp.toFixed(1)} onChange={setTemp} />
            <Slider label="top-k" value={topK} min={1} max={20} step={1} onChange={setTopK} />
            <Slider label="top-p" value={topP} min={0.1} max={1} step={0.05} show={topP.toFixed(2)} onChange={setTopP} />
          </div>
          <div className="chips">
            <button className="chip-btn" onClick={() => [setTemp(0.1), setTopK(1), setTopP(1)]}>
              🧊 {t({ en: "greedy (deterministic)", bn: "লোভী (নির্ধারিত)" })}
            </button>
            <button className="chip-btn" onClick={() => [setTemp(0.7), setTopK(8), setTopP(0.9)]}>
              ⚖️ {t({ en: "balanced", bn: "ভারসাম্যপূর্ণ" })}
            </button>
            <button className="chip-btn" onClick={() => [setTemp(2.5), setTopK(20), setTopP(1)]}>
              🔥 {t({ en: "wild", bn: "উদ্দাম" })}
            </button>
          </div>
        </div>
        <div className="card">
          <h3>
            {t({ en: "Next-word probabilities", bn: "পরের শব্দের সম্ভাবনা" })} <span className="badge">{source}</span>
          </h3>
          <HBars items={cands.slice(0, 14).map((c) => ({ label: c.w === EOS ? "⏹ end" : c.w, value: c.p, color: c.kept ? "var(--c4)" : "var(--c8)", dim: !c.kept }))} max={Math.max(...cands.map((c) => c.p), 0.01)} />
          <p className="muted small">
            {t({
              en: "Grey bars were cut off by top-k / top-p and can't be chosen. Low temperature sharpens the distribution (safe, repetitive); high temperature flattens it (creative, risky).",
              bn: "ধূসর বারগুলো top-k / top-p-এ বাদ পড়েছে, বাছাই করা যাবে না। কম টেম্পারেচার বিন্যাসকে তীক্ষ্ণ করে (নিরাপদ, একঘেয়ে); বেশি টেম্পারেচার চ্যাপ্টা করে (সৃজনশীল, ঝুঁকিপূর্ণ)।",
            })}
          </p>
          <Callout kind="idea" title={{ en: "Try", bn: "চেষ্টা করুন" }}>
            <p>
              {t({
                en: "Prompts: “the stock price”, “a low credit”, “investors”, or Bangla “গ্রাহক”. Generate several times with 'wild' and then 'greedy'.",
                bn: "প্রম্পট: “the stock price”, “a low credit”, “investors”, অথবা বাংলায় “গ্রাহক”। ‘উদ্দাম’ ও পরে ‘লোভী’ দিয়ে কয়েকবার জেনারেট করুন।",
              })}
            </p>
          </Callout>
        </div>
      </div>
    </>
  );
}

// ---- RAG -------------------------------------------------------------------------------
const QUESTIONS: T[] = [
  { en: "What credit score do I need for a loan?", bn: "ঋণ পেতে কত ক্রেডিট স্কোর লাগবে?" },
  { en: "How much money can I send by mobile banking?", bn: "মোবাইল ব্যাংকিংয়ে কত টাকা পাঠানো যায়?" },
  { en: "I lost my card, what should I do?", bn: "কার্ড হারিয়ে গেছে, কী করব?" },
  { en: "Someone called asking for my OTP", bn: "কেউ ফোন করে ওটিপি চাইছে" },
];

function Rag() {
  const { t, lang } = useLang();
  const [q, setQ] = useState(QUESTIONS[0][lang]);
  const ranked = retrieve(q);
  const top = ranked.filter((r) => r.score > 0).slice(0, 3);
  const promptText =
    `${t({ en: "You are a helpful bank assistant. Answer ONLY using the context. If the answer is not there, say you don't know.", bn: "আপনি একজন সহায়ক ব্যাংক সহকারী। শুধু প্রসঙ্গ ব্যবহার করে উত্তর দিন। উত্তর না থাকলে বলুন আপনি জানেন না।" })}\n\n` +
    `### ${t({ en: "Context", bn: "প্রসঙ্গ" })}\n` +
    (top.length ? top.map((r, i) => `[${i + 1}] ${t(r.doc.title)}: ${t(r.doc.text)}`).join("\n") : "—") +
    `\n\n### ${t({ en: "Question", bn: "প্রশ্ন" })}\n${q}`;

  return (
    <>
      <p>
        {t({
          en: "An LLM doesn't know your bank's rules. RAG fixes this: first search your own documents for the right paragraph, then give that paragraph to the model and say “answer only from this”. Ask a question below — in English or Bangla.",
          bn: "এলএলএম আপনার ব্যাংকের নিয়মকানুন জানে না। RAG এর সমাধান: আগে নিজের ডকুমেন্টে সঠিক অনুচ্ছেদটা খুঁজুন, তারপর সেটা মডেলকে দিয়ে বলুন “শুধু এখান থেকে উত্তর দাও”। নিচে একটা প্রশ্ন করুন — ইংরেজি বা বাংলায়।",
        })}
      </p>
      <Plain k="rag" />
      <div className="rag-flow">
        {[
          ["❓", { en: "Question", bn: "প্রশ্ন" }],
          ["🔎", { en: "Search docs", bn: "ডকুমেন্ট খোঁজা" }],
          ["📄", { en: "Top passages", bn: "সেরা অংশ" }],
          ["🧾", { en: "Build prompt", bn: "প্রম্পট বানানো" }],
          ["🤖", { en: "LLM answers", bn: "এলএলএম উত্তর" }],
        ].map(([ico, label], i) => (
          <div key={i} className="rag-step" style={{ animationDelay: `${i * 0.15}s` }}>
            <span>{ico as string}</span>
            {t(label as T)}
          </div>
        ))}
      </div>
      <input type="text" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", fontSize: "1rem" }} />
      <div className="chips" style={{ margin: "8px 0 14px" }}>
        {QUESTIONS.map((x, i) => (
          <button key={i} className="chip-btn" onClick={() => setQ(x[lang])}>
            {x[lang]}
          </button>
        ))}
      </div>
      <div className="grid cols2">
        <div className="card">
          <h3>{t({ en: "Retrieval scores (TF-IDF cosine similarity)", bn: "খোঁজার স্কোর (TF-IDF কোসাইন সিমিলারিটি)" })}</h3>
          <HBars items={ranked.map((r, i) => ({ label: t(r.doc.title), value: r.score, color: i < 3 && r.score > 0 ? "var(--c3)" : "var(--c8)", dim: i >= 3 || r.score === 0 }))} max={Math.max(ranked[0].score, 0.01)} format={(v) => v.toFixed(2)} />
          {top[0] && (
            <div className="answer-card">
              <small>{t({ en: "Best match · source [1]", bn: "সেরা মিল · উৎস [১]" })}</small>
              <p>{t(top[0].doc.text)}</p>
            </div>
          )}
          {!top.length && <p className="muted">{t({ en: "No document matched — a good RAG system answers “I don't know”.", bn: "কোনো ডকুমেন্ট মেলেনি — ভালো RAG সিস্টেম বলে “আমি জানি না”।" })}</p>}
        </div>
        <div className="card">
          <h3>{t({ en: "The prompt actually sent to the LLM", bn: "এলএলএমে আসলে যে প্রম্পট যায়" })}</h3>
          <pre className="prompt-box">{promptText}</pre>
          <p className="muted small" style={{ margin: 0 }}>
            {t({
              en: `Knowledge base: ${DOCS.length} short bank-policy notes (fictional). Production systems use neural embeddings and a vector database, but the flow is identical.`,
              bn: `জ্ঞানভান্ডার: ${DOCS.length}টি ছোট ব্যাংক-নীতির নোট (কাল্পনিক)। প্রোডাকশন সিস্টেমে নিউরাল এমবেডিং ও ভেক্টর ডেটাবেস ব্যবহার হয়, কিন্তু ধাপগুলো একই।`,
            })}
          </p>
        </div>
      </div>
    </>
  );
}

// ---- Prompting & limits --------------------------------------------------------------
const PATTERNS: { title: T; bad: T; good: T; why: T }[] = [
  {
    title: { en: "Be specific: role, task, format", bn: "নির্দিষ্ট হোন: ভূমিকা, কাজ, ফরম্যাট" },
    bad: { en: "Tell me about loans.", bn: "ঋণ সম্পর্কে বলো।" },
    good: { en: "You are a loan officer. In 5 bullet points, explain to a first-time borrower in Dhaka what affects their interest rate.", bn: "তুমি একজন ঋণ কর্মকর্তা। ঢাকার একজন প্রথমবারের ঋণগ্রহীতাকে ৫টি বুলেট পয়েন্টে বোঝাও কোন বিষয়গুলো সুদের হারকে প্রভাবিত করে।" },
    why: { en: "The model can't read your mind; context narrows the next-token choices.", bn: "মডেল আপনার মন পড়তে পারে না; প্রসঙ্গ পরের টোকেনের বিকল্প সংকুচিত করে।" },
  },
  {
    title: { en: "Few-shot: show examples", bn: "ফিউ-শট: উদাহরণ দেখান" },
    bad: { en: "Classify this transaction: 'Paid 1200 to Shwapno'.", bn: "এই লেনদেনটি শ্রেণিভুক্ত করো: 'স্বপ্নে ১২০০ টাকা দিলাম'।" },
    good: { en: "'Uber 350' → Transport\n'Rent March 15000' → Rent\n'Paid 1200 to Shwapno' →", bn: "'উবার ৩৫০' → যাতায়াত\n'মার্চের ভাড়া ১৫০০০' → ভাড়া\n'স্বপ্নে ১২০০ টাকা দিলাম' →" },
    why: { en: "Examples teach the exact label set and style without any training.", bn: "উদাহরণ কোনো প্রশিক্ষণ ছাড়াই সঠিক লেবেল ও ধরন শেখায়।" },
  },
  {
    title: { en: "Ask for step-by-step reasoning", bn: "ধাপে ধাপে যুক্তি চান" },
    bad: { en: "What is the EMI for 2 lakh at 12% over 2 years?", bn: "২ লাখ টাকা ১২% সুদে ২ বছরে ইএমআই কত?" },
    good: { en: "Calculate the EMI for 200,000 BDT at 12% yearly over 24 months. Show the formula and each step, then give the final number.", bn: "২,০০,০০০ টাকা, বার্ষিক ১২%, ২৪ মাসের ইএমআই হিসাব করো। সূত্র ও প্রতিটি ধাপ দেখাও, তারপর চূড়ান্ত সংখ্যা দাও।" },
    why: { en: "Writing intermediate steps gives the model 'room to think' and lets you check the maths.", bn: "মধ্যবর্তী ধাপ লিখলে মডেল ‘ভাবার জায়গা’ পায় এবং আপনি হিসাব যাচাই করতে পারেন।" },
  },
  {
    title: { en: "Ask for structured output", bn: "কাঠামোবদ্ধ আউটপুট চান" },
    bad: { en: "Extract info from this receipt.", bn: "এই রসিদ থেকে তথ্য বের করো।" },
    good: { en: 'Return JSON only: {"merchant": string, "date": "YYYY-MM-DD", "amount_bdt": number}', bn: 'শুধু JSON দাও: {"merchant": string, "date": "YYYY-MM-DD", "amount_bdt": number}' },
    why: { en: "Structured output can flow straight into a data pipeline or a SQL table.", bn: "কাঠামোবদ্ধ আউটপুট সরাসরি ডেটা পাইপলাইন বা SQL টেবিলে যেতে পারে।" },
  },
];

const LIMITS: { icon: string; title: T; body: T }[] = [
  { icon: "🌀", title: { en: "Hallucination", bn: "হ্যালুসিনেশন" }, body: { en: "Fluent but false answers. Verify facts and numbers; use RAG for anything that must be correct.", bn: "সাবলীল কিন্তু ভুল উত্তর। তথ্য ও সংখ্যা যাচাই করুন; যা নির্ভুল হতে হবে তার জন্য RAG ব্যবহার করুন।" } },
  { icon: "📅", title: { en: "Knowledge cutoff", bn: "জ্ঞানের সময়সীমা" }, body: { en: "A model only knows its training data up to a date. Today's interest rates need a live source.", bn: "মডেল একটি নির্দিষ্ট তারিখ পর্যন্ত প্রশিক্ষণ ডেটাই জানে। আজকের সুদের হারের জন্য লাইভ উৎস দরকার।" } },
  { icon: "⚖️", title: { en: "Bias", bn: "পক্ষপাত" }, body: { en: "Models absorb biases from their data. Never let one decide a loan alone — audit it like the ML models here.", bn: "মডেল ডেটা থেকে পক্ষপাত শুষে নেয়। শুধু মডেলকে ঋণের সিদ্ধান্ত নিতে দেবেন না — এখানকার এমএল মডেলের মতো যাচাই করুন।" } },
  { icon: "🔒", title: { en: "Privacy", bn: "গোপনীয়তা" }, body: { en: "Don't paste NID numbers, account details or customer data into public chatbots.", bn: "পাবলিক চ্যাটবটে এনআইডি নম্বর, অ্যাকাউন্টের তথ্য বা গ্রাহকের ডেটা দেবেন না।" } },
];

function Prompting() {
  const { t } = useLang();
  const [open, setOpen] = useState(0);
  return (
    <>
      <Plain k="prompt" />
      <h3>{t({ en: "Four prompt patterns (click to compare)", bn: "চারটি প্রম্পট প্যাটার্ন (তুলনা করতে ক্লিক করুন)" })}</h3>
      <div className="grid cols2">
        {PATTERNS.map((p, i) => (
          <button key={i} className={`card prompt-card${open === i ? " on" : ""}`} onClick={() => setOpen(i)}>
            <b>{t(p.title)}</b>
            {open === i ? (
              <div className="prompt-compare">
                <div className="bad">
                  <small>✗ {t({ en: "vague", bn: "অস্পষ্ট" })}</small>
                  <pre>{t(p.bad)}</pre>
                </div>
                <div className="good">
                  <small>✓ {t({ en: "better", bn: "ভালো" })}</small>
                  <pre>{t(p.good)}</pre>
                </div>
                <p className="muted small" style={{ margin: 0 }}>
                  {t(p.why)}
                </p>
              </div>
            ) : (
              <span className="muted small">{t({ en: "show example →", bn: "উদাহরণ দেখুন →" })}</span>
            )}
          </button>
        ))}
      </div>
      <h3 style={{ marginTop: 24 }}>{t({ en: "Know the limits", bn: "সীমাবদ্ধতা জানুন" })}</h3>
      <div className="grid cols2">
        {LIMITS.map((l, i) => (
          <div key={i} className="card limit-card">
            <span className="big-ico">{l.icon}</span>
            <div>
              <b>{t(l.title)}</b>
              <p className="muted" style={{ margin: 0 }}>
                {t(l.body)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <Callout kind="idea" title={{ en: "Where data skills meet LLMs", bn: "যেখানে ডেটা দক্ষতা ও এলএলএম মেলে" }}>
        <p>
          {t({
            en: "Everything else on this site still matters: SQL feeds RAG and text-to-SQL assistants, data engineering builds the document pipelines, and the ML evaluation habits (test sets, baselines, precision vs recall) are exactly how you judge an LLM app.",
            bn: "এই সাইটের বাকি সবকিছুই কাজে লাগে: SQL দিয়ে RAG ও টেক্সট-টু-SQL সহকারী চলে, ডেটা ইঞ্জিনিয়ারিং ডকুমেন্ট পাইপলাইন বানায়, আর এমএল মূল্যায়নের অভ্যাস (টেস্ট সেট, বেসলাইন, precision বনাম recall) দিয়েই এলএলএম অ্যাপ বিচার করা হয়।",
          })}
        </p>
      </Callout>
    </>
  );
}
