import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n";
import type { FromWorker, ToWorker } from "../llm/tinygpt.worker";
import { BN_CORPUS } from "../llm/bnCorpus";
import { MAX_STEPS } from "../llm/tinygpt";
import { Heatmap, XY } from "../components/charts";
import { Callout, Plain, Slider, Stat } from "../components/ui";
import { digits } from "../numerals";

interface SampleLine {
  step: number;
  prompt: string;
  text: string;
  mine?: boolean;
}

export function TrainGPT() {
  const { t } = useLang();
  const worker = useRef<Worker | null>(null);
  const [info, setInfo] = useState<{ vocab: number; params: number; chars: number } | null>(null);
  const [step, setStep] = useState(0);
  const [loss, setLoss] = useState<number | null>(null);
  const [speed, setSpeed] = useState(0);
  const [curve, setCurve] = useState<[number, number][]>([]);
  const [samples, setSamples] = useState<SampleLine[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [prompt, setPrompt] = useState("আমরা ");
  const [temp, setTemp] = useState(0.7);
  const [att, setAtt] = useState<{ tokens: string[]; weights: number[][] } | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("../llm/tinygpt.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === "init") {
        setInfo(m);
        setStep(0);
        setLoss(null);
        setCurve([]);
        setSamples([]);
        setFinished(false);
        setAtt(null);
      } else if (m.type === "tick") {
        setStep(m.step);
        setLoss(m.loss);
        setSpeed(m.stepsPerSec);
        setCurve((c) => [...c, [m.step, m.loss] as [number, number]].slice(-400));
      } else if (m.type === "auto" || m.type === "sample") setSamples((s) => [{ step: m.step, prompt: m.prompt, text: m.text, mine: m.type === "sample" }, ...s].slice(0, 12));
      else if (m.type === "attention") setAtt({ tokens: m.tokens, weights: m.weights });
      else if (m.type === "done") {
        setRunning(false);
        setFinished(true);
        w.postMessage({ type: "attention", text: "শিক্ষাই জাতির" } satisfies ToWorker);
      }
    };
    return () => w.terminate();
  }, []);

  const send = (m: ToWorker) => worker.current?.postMessage(m);
  const toggle = () => {
    if (running) {
      send({ type: "pause" });
      send({ type: "attention", text: "শিক্ষাই জাতির" });
    } else send({ type: "start" });
    setRunning(!running);
  };
  const uniform = info ? Math.log(info.vocab) : 4;

  return (
    <>
      <p>
        {t({
          en: "Here you train a real (tiny) GPT yourself — right now, inside your browser. It reads 44 short Bangla sentences one character at a time and learns to guess the next character. Press ▶ and watch its writing go from random letters to real Bangla words.",
          bn: "এখানে আপনি নিজেই একটা আসল (খুব ছোট) GPT ট্রেন করবেন — এখনই, আপনার ব্রাউজারের ভেতরে। এটা ৪৪টা ছোট বাংলা বাক্য একটা একটা অক্ষর করে পড়ে, আর পরের অক্ষরটা আন্দাজ করতে শেখে। ▶ চাপুন আর দেখুন এর লেখা কীভাবে এলোমেলো অক্ষর থেকে আসল বাংলা শব্দ হয়ে ওঠে।",
        })}
      </p>
      <Plain
        text={{
          en: "Like a child learning to write by copying sentences: at first only scribbles, then letters, then words, then whole sentences. ChatGPT learned the same way — with billions of sentences instead of 44.",
          bn: "যেমন একটা শিশু বাক্য দেখে দেখে লিখতে শেখে: প্রথমে শুধু আঁকিবুঁকি, তারপর অক্ষর, তারপর শব্দ, তারপর পুরো বাক্য। ChatGPT-ও এভাবেই শিখেছে — ৪৪টার বদলে শত কোটি বাক্য দিয়ে।",
        }}
      />
      <div className="grid cols2">
        <div className="card">
          <div className="row">
            <button className="btn" onClick={toggle} disabled={finished || !info}>
              {running ? "⏸ " + t({ en: "Pause", bn: "থামান" }) : "▶ " + t({ en: step ? "Continue training" : "Start training", bn: step ? "ট্রেনিং চালিয়ে যান" : "ট্রেনিং শুরু করুন" })}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                send({ type: "reset" });
                setRunning(false);
              }}
            >
              ↺ {t({ en: "New random model", bn: "নতুন এলোমেলো মডেল" })}
            </button>
          </div>
          <div className="stats" style={{ marginTop: 12 }}>
            <Stat label={t({ en: "training steps", bn: "ট্রেনিং ধাপ" })} value={`${step} / ${MAX_STEPS}`} />
            <Stat label={t({ en: "error (loss)", bn: "ভুল (loss)" })} value={loss === null ? "–" : loss.toFixed(2)} />
            <Stat label={t({ en: "speed", bn: "গতি" })} value={running ? `${speed.toFixed(0)}/s` : "–"} />
            <Stat label={t({ en: "parameters", bn: "প্যারামিটার" })} value={info ? info.params.toLocaleString("en-US") : "–"} />
          </div>
          <h3 style={{ marginTop: 14 }}>{t({ en: "Error while learning", bn: "শেখার সময় ভুল" })}</h3>
          {curve.length > 1 ? (
            <XY
              series={[
                { name: t({ en: "model", bn: "মডেল" }), pts: curve, area: true, color: "var(--c4)" },
                { name: t({ en: "random guessing", bn: "এলোমেলো আন্দাজ" }), pts: [[curve[0][0], uniform], [Math.max(curve[curve.length - 1][0], 10), uniform]], dashed: true, color: "var(--c8)" },
              ]}
              yDomain={[0, Math.max(uniform, curve[0][1]) * 1.05]}
              xLabel={t({ en: "training step", bn: "ট্রেনিং ধাপ" })}
              yLabel="loss"
              h={210}
            />
          ) : (
            <p className="muted small">{t({ en: "Press ▶ to start. The error starts near “random guessing” and falls as it learns.", bn: "শুরু করতে ▶ চাপুন। ভুল শুরু হয় “এলোমেলো আন্দাজ”-এর কাছ থেকে, আর শিখতে শিখতে কমে।" })}</p>
          )}
        </div>
        <div className="card">
          <h3>{t({ en: "What it writes as it learns", bn: "শিখতে শিখতে এটা কী লেখে" })}</h3>
          <div className="gpt-samples">
            {samples.length ? (
              samples.map((s, i) => (
                <div key={`${s.step}-${i}`} className={`gpt-line${i === 0 ? " latest" : ""}${s.mine ? " mine" : ""}`}>
                  <small>{digits(`#${s.step}`)}</small>
                  <span>
                    <b>{s.prompt}</b>
                    {s.text || "…"}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted small">{t({ en: "Samples appear here as it trains.", bn: "ট্রেনিং চলার সাথে সাথে এখানে লেখা আসবে।" })}</p>
            )}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ flex: 1, minWidth: 120 }} aria-label="prompt" />
            <button className="btn ghost" onClick={() => send({ type: "sample", prompt, temp })} disabled={!info}>
              ✍️ {t({ en: "Write", bn: "লিখুক" })}
            </button>
          </div>
          <Slider label={t({ en: "temperature (creativity)", bn: "টেম্পারেচার (সৃজনশীলতা)" })} value={temp} min={0.1} max={1.5} step={0.1} show={temp.toFixed(1)} onChange={setTemp} />
        </div>
      </div>
      <div className="grid cols2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>{t({ en: "Where it looks (attention)", bn: "এটা কোথায় তাকায় (অ্যাটেনশন)" })}</h3>
          {att ? (
            <>
              <Heatmap rows={att.tokens.map((c, i) => `${i}:${c === " " ? "␣" : c}`)} cols={att.tokens.map((c) => (c === " " ? "␣" : c))} values={att.weights} max={1} cell={30} format={(v) => (v * 100).toFixed(0)} />
              <p className="muted small" style={{ margin: 0 }}>
                {t({ en: "Each row is one character; dark cells are the earlier characters it pays attention to when guessing what comes next. It can never look right (the future).", bn: "প্রতিটা সারি একটা অক্ষর; গাঢ় ঘরগুলো হলো আগের সেই অক্ষর, যাদের দিকে তাকিয়ে সে পরেরটা আন্দাজ করে। সে কখনো ডানে (ভবিষ্যতে) তাকাতে পারে না।" })}
              </p>
            </>
          ) : (
            <p className="muted small">{t({ en: "Pause the training to see the learned attention pattern for “শিক্ষাই জাতির”.", bn: "“শিক্ষাই জাতির”-এর শেখা অ্যাটেনশন দেখতে ট্রেনিং থামান।" })}</p>
          )}
        </div>
        <Callout kind="idea" title={{ en: "What's inside (and what's honest)", bn: "ভেতরে কী আছে (আর সত্যি কথা)" }}>
          <p>
            {digits(
              t({
                en: `Characters → embeddings (vectors) + position → one self-attention layer → one feed-forward layer → a guess for the next character. ${info ? info.params.toLocaleString("en-US") : "~11,600"} numbers are learned with gradient descent (Adam). ChatGPT-class models have hundreds of billions.`,
                bn: `অক্ষর → এমবেডিং (ভেক্টর) + অবস্থান → একটা সেলফ-অ্যাটেনশন লেয়ার → একটা ফিড-ফরোয়ার্ড লেয়ার → পরের অক্ষরের আন্দাজ। ${info ? info.params.toLocaleString("en-US") : "~১১,৬০০"}টি সংখ্যা গ্রেডিয়েন্ট ডিসেন্ট (Adam) দিয়ে শেখা হয়। ChatGPT-শ্রেণির মডেলে থাকে শত শত বিলিয়ন।`,
              }),
            )}
          </p>
          <p>
            {t({
              en: "With only 44 sentences it soon starts copying them (very low error = memorising) — exactly the overfitting you saw with decision trees. Real LLMs avoid this by reading far more text than they could ever memorise.",
              bn: "মাত্র ৪৪টা বাক্য থাকায় কিছুক্ষণ পরেই সে এগুলো হুবহু নকল করতে শুরু করে (খুব কম ভুল = মুখস্থ) — ডিসিশন ট্রিতে দেখা সেই ওভারফিটিং। আসল এলএলএম এটা এড়ায়, কারণ তারা মুখস্থ করার সাধ্যের চেয়ে অনেক বেশি লেখা পড়ে।",
            })}
          </p>
          <details>
            <summary className="small">{t({ en: "See the training text", bn: "ট্রেনিংয়ের লেখা দেখুন" })}</summary>
            <pre className="prompt-box" style={{ maxHeight: 200 }}>
              {BN_CORPUS}
            </pre>
          </details>
        </Callout>
      </div>
    </>
  );
}
