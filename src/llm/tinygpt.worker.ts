// Trains the tiny GPT in a background thread so the page stays smooth.
import { MAX_STEPS, TinyGPT } from "./tinygpt";
import { BN_CORPUS } from "./bnCorpus";

export type ToWorker = { type: "start" } | { type: "pause" } | { type: "reset" } | { type: "sample"; prompt: string; temp: number } | { type: "attention"; text: string };
export type FromWorker =
  | { type: "init"; vocab: number; params: number; chars: number }
  | { type: "tick"; step: number; loss: number; stepsPerSec: number }
  | { type: "auto"; step: number; prompt: string; text: string }
  | { type: "sample"; step: number; prompt: string; text: string }
  | { type: "attention"; tokens: string[]; weights: number[][] }
  | { type: "done"; step: number };

const AUTO_PROMPTS = ["আমরা ", "ঢাকা ", "ডেটা ", "প্রতিদিন "];
let model = new TinyGPT(BN_CORPUS);
let data = model.encode(BN_CORPUS);
let running = false;
let recent: number[] = [];
const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m);

const init = () => post({ type: "init", vocab: model.vocab.length, params: model.size, chars: data.length });
init();

function loop() {
  if (!running) return;
  const t0 = performance.now();
  let steps = 0;
  while (performance.now() - t0 < 80 && model.step < MAX_STEPS) {
    recent.push(model.trainStep(data));
    steps++;
    // show writing early and often at first (when it changes fastest), then every 100 steps
    if (model.step === 25 || (model.step <= 400 ? model.step % 50 === 0 : model.step % 100 === 0)) {
      const prompt = AUTO_PROMPTS[Math.floor(model.step / 50) % AUTO_PROMPTS.length];
      post({ type: "auto", step: model.step, prompt, text: model.generate(prompt, 45, 0.7) });
    }
  }
  recent = recent.slice(-20);
  const loss = recent.reduce((a, b) => a + b, 0) / recent.length;
  post({ type: "tick", step: model.step, loss, stepsPerSec: (steps / (performance.now() - t0)) * 1000 });
  if (model.step >= MAX_STEPS) {
    running = false;
    post({ type: "done", step: model.step });
    return;
  }
  setTimeout(loop, 0);
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.type === "start") {
    if (!running && model.step < MAX_STEPS) {
      running = true;
      loop();
    }
  } else if (m.type === "pause") running = false;
  else if (m.type === "reset") {
    running = false;
    model = new TinyGPT(BN_CORPUS, undefined, Math.floor(Math.random() * 1e6));
    data = model.encode(BN_CORPUS);
    recent = [];
    init();
  } else if (m.type === "sample") post({ type: "sample", step: model.step, prompt: m.prompt, text: model.generate(m.prompt, 60, m.temp) });
  else if (m.type === "attention") post({ type: "attention", ...model.attention(m.text) });
};
