// A tiny GPT (one attention layer + one feed-forward layer), trained from scratch in the browser.
// Everything is here: a minimal automatic-differentiation engine for matrices, the model, the
// Adam optimiser, and text generation. No ML library.
import { seeded } from "../ml/extra";

// ---- a minimal autograd for matrices -----------------------------------------------------
export class Mat {
  g: Float64Array;
  back: (() => void) | null = null;
  constructor(
    public r: number,
    public c: number,
    public d: Float64Array = new Float64Array(r * c),
    public prev: Mat[] = [],
  ) {
    this.g = new Float64Array(r * c);
  }
}

const out = (r: number, c: number, prev: Mat[]) => new Mat(r, c, new Float64Array(r * c), prev);

export function matmul(a: Mat, b: Mat): Mat {
  const o = out(a.r, b.c, [a, b]);
  for (let i = 0; i < a.r; i++)
    for (let k = 0; k < a.c; k++) {
      const av = a.d[i * a.c + k];
      if (av === 0) continue;
      for (let j = 0; j < b.c; j++) o.d[i * b.c + j] += av * b.d[k * b.c + j];
    }
  o.back = () => {
    for (let i = 0; i < a.r; i++)
      for (let k = 0; k < a.c; k++) {
        let s = 0;
        for (let j = 0; j < b.c; j++) {
          const gij = o.g[i * b.c + j];
          s += gij * b.d[k * b.c + j];
          b.g[k * b.c + j] += a.d[i * a.c + k] * gij;
        }
        a.g[i * a.c + k] += s;
      }
  };
  return o;
}

/** a · bᵀ (used for queries × keys). */
export function matmulT(a: Mat, b: Mat): Mat {
  const o = out(a.r, b.r, [a, b]);
  for (let i = 0; i < a.r; i++)
    for (let j = 0; j < b.r; j++) {
      let s = 0;
      for (let k = 0; k < a.c; k++) s += a.d[i * a.c + k] * b.d[j * b.c + k];
      o.d[i * b.r + j] = s;
    }
  o.back = () => {
    for (let i = 0; i < a.r; i++)
      for (let j = 0; j < b.r; j++) {
        const gij = o.g[i * b.r + j];
        if (gij === 0) continue;
        for (let k = 0; k < a.c; k++) {
          a.g[i * a.c + k] += gij * b.d[j * b.c + k];
          b.g[j * b.c + k] += gij * a.d[i * a.c + k];
        }
      }
  };
  return o;
}

export function add(a: Mat, b: Mat): Mat {
  const o = out(a.r, a.c, [a, b]);
  for (let i = 0; i < o.d.length; i++) o.d[i] = a.d[i] + b.d[i];
  o.back = () => {
    for (let i = 0; i < o.d.length; i++) {
      a.g[i] += o.g[i];
      b.g[i] += o.g[i];
    }
  };
  return o;
}

/** adds a 1×c bias row to every row */
export function addBias(a: Mat, bias: Mat): Mat {
  const o = out(a.r, a.c, [a, bias]);
  for (let i = 0; i < a.r; i++) for (let j = 0; j < a.c; j++) o.d[i * a.c + j] = a.d[i * a.c + j] + bias.d[j];
  o.back = () => {
    for (let i = 0; i < a.r; i++)
      for (let j = 0; j < a.c; j++) {
        a.g[i * a.c + j] += o.g[i * a.c + j];
        bias.g[j] += o.g[i * a.c + j];
      }
  };
  return o;
}

export function relu(a: Mat): Mat {
  const o = out(a.r, a.c, [a]);
  for (let i = 0; i < o.d.length; i++) o.d[i] = a.d[i] > 0 ? a.d[i] : 0;
  o.back = () => {
    for (let i = 0; i < o.d.length; i++) if (a.d[i] > 0) a.g[i] += o.g[i];
  };
  return o;
}

export function scale(a: Mat, s: number): Mat {
  const o = out(a.r, a.c, [a]);
  for (let i = 0; i < o.d.length; i++) o.d[i] = a.d[i] * s;
  o.back = () => {
    for (let i = 0; i < o.d.length; i++) a.g[i] += o.g[i] * s;
  };
  return o;
}

/** Row-wise softmax that only lets row i look at columns 0..i (a GPT can't peek at the future). */
export function causalSoftmax(a: Mat): Mat {
  const o = out(a.r, a.c, [a]);
  for (let i = 0; i < a.r; i++) {
    let m = -Infinity;
    for (let j = 0; j <= i; j++) m = Math.max(m, a.d[i * a.c + j]);
    let s = 0;
    for (let j = 0; j <= i; j++) s += o.d[i * a.c + j] = Math.exp(a.d[i * a.c + j] - m);
    for (let j = 0; j <= i; j++) o.d[i * a.c + j] /= s;
  }
  o.back = () => {
    for (let i = 0; i < a.r; i++) {
      let dot = 0;
      for (let j = 0; j <= i; j++) dot += o.g[i * a.c + j] * o.d[i * a.c + j];
      for (let j = 0; j <= i; j++) a.g[i * a.c + j] += o.d[i * a.c + j] * (o.g[i * a.c + j] - dot);
    }
  };
  return o;
}

/** Picks rows of an embedding table (token ids → vectors). */
export function gather(table: Mat, ids: number[]): Mat {
  const o = out(ids.length, table.c, [table]);
  ids.forEach((id, i) => o.d.set(table.d.subarray(id * table.c, (id + 1) * table.c), i * table.c));
  o.back = () => ids.forEach((id, i) => {
    for (let j = 0; j < table.c; j++) table.g[id * table.c + j] += o.g[i * table.c + j];
  });
  return o;
}

/** Mean cross-entropy of each row's logits against the target id. Returns a 1×1 matrix. */
export function crossEntropy(logits: Mat, targets: number[]): Mat {
  const o = out(1, 1, [logits]);
  const probs = new Float64Array(logits.d.length);
  let loss = 0;
  for (let i = 0; i < logits.r; i++) {
    let m = -Infinity;
    for (let j = 0; j < logits.c; j++) m = Math.max(m, logits.d[i * logits.c + j]);
    let s = 0;
    for (let j = 0; j < logits.c; j++) s += probs[i * logits.c + j] = Math.exp(logits.d[i * logits.c + j] - m);
    for (let j = 0; j < logits.c; j++) probs[i * logits.c + j] /= s;
    loss -= Math.log(probs[i * logits.c + targets[i]] + 1e-12);
  }
  o.d[0] = loss / logits.r;
  o.back = () => {
    const g = o.g[0] / logits.r;
    for (let i = 0; i < logits.r; i++)
      for (let j = 0; j < logits.c; j++) logits.g[i * logits.c + j] += g * (probs[i * logits.c + j] - (j === targets[i] ? 1 : 0));
  };
  return o;
}

export function backward(root: Mat, seed = 1) {
  const order: Mat[] = [];
  const seen = new Set<Mat>();
  const visit = (m: Mat) => {
    if (seen.has(m)) return;
    seen.add(m);
    m.prev.forEach(visit);
    order.push(m);
  };
  visit(root);
  root.g[0] += seed;
  for (let i = order.length - 1; i >= 0; i--) order[i].back?.();
}

// ---- the model ------------------------------------------------------------------------------
export interface Config {
  ctx: number; // context length (characters the model can look back at)
  d: number; // embedding size
  hidden: number; // feed-forward size
}
// Sized to train smoothly in a browser tab (~11.6k parameters).
export const DEFAULT_CONFIG: Config = { ctx: 24, d: 32, hidden: 48 };
export const MAX_STEPS = 1500;

export class TinyGPT {
  vocab: string[];
  index: Map<string, number>;
  params: Record<string, Mat>;
  private m: Map<Mat, Float64Array> = new Map();
  private v: Map<Mat, Float64Array> = new Map();
  step = 0;

  constructor(
    text: string,
    public cfg: Config = DEFAULT_CONFIG,
    seed = 7,
  ) {
    this.vocab = [...new Set(Array.from(text))].sort();
    this.index = new Map(this.vocab.map((ch, i) => [ch, i]));
    const rnd = seeded(seed);
    const V = this.vocab.length;
    const { d, hidden, ctx } = cfg;
    const mat = (r: number, c: number, std: number) => new Mat(r, c, Float64Array.from({ length: r * c }, () => (rnd() * 2 - 1) * std * Math.sqrt(3)));
    this.params = {
      wte: mat(V, d, 0.3),
      wpe: mat(ctx, d, 0.1),
      Wq: mat(d, d, 1 / Math.sqrt(d)),
      Wk: mat(d, d, 1 / Math.sqrt(d)),
      Wv: mat(d, d, 1 / Math.sqrt(d)),
      Wo: mat(d, d, 0.5 / Math.sqrt(d)),
      W1: mat(d, hidden, 1 / Math.sqrt(d)),
      b1: new Mat(1, hidden),
      W2: mat(hidden, d, 0.5 / Math.sqrt(hidden)),
      b2: new Mat(1, d),
      Wout: mat(d, V, 1 / Math.sqrt(d)),
      bout: new Mat(1, V),
    };
  }

  get size() {
    return Object.values(this.params).reduce((a, p) => a + p.d.length, 0);
  }

  encode(s: string) {
    return Array.from(s)
      .map((ch) => this.index.get(ch))
      .filter((x): x is number => x !== undefined);
  }

  /** Forward pass for one sequence of ids. Returns logits (n×V) and the attention matrix (n×n). */
  forward(ids: number[]) {
    const p = this.params;
    const n = ids.length;
    const pos = gather(p.wpe, Array.from({ length: n }, (_, i) => i));
    const x = add(gather(p.wte, ids), pos);
    const q = matmul(x, p.Wq);
    const k = matmul(x, p.Wk);
    const v = matmul(x, p.Wv);
    const att = causalSoftmax(scale(matmulT(q, k), 1 / Math.sqrt(this.cfg.d)));
    const x2 = add(x, matmul(matmul(att, v), p.Wo));
    const ff = addBias(matmul(relu(addBias(matmul(x2, p.W1), p.b1)), p.W2), p.b2);
    const x3 = add(x2, ff);
    const logits = addBias(matmul(x3, p.Wout), p.bout);
    return { logits, att };
  }

  /** One optimisation step on `batch` random windows of the training ids. Returns the mean loss. */
  trainStep(data: number[], batch = 8, lr = 4e-3, rnd: () => number = Math.random): number {
    const params = Object.values(this.params);
    params.forEach((p) => p.g.fill(0));
    const T = this.cfg.ctx;
    let total = 0;
    for (let b = 0; b < batch; b++) {
      const start = Math.floor(rnd() * (data.length - T - 1));
      const ids = data.slice(start, start + T);
      const targets = data.slice(start + 1, start + T + 1);
      const loss = crossEntropy(this.forward(ids).logits, targets);
      total += loss.d[0];
      backward(loss, 1 / batch);
    }
    // gradient clipping keeps early training stable
    let norm = 0;
    params.forEach((p) => p.g.forEach((g) => (norm += g * g)));
    const clip = Math.min(1, 1 / (Math.sqrt(norm) + 1e-12));
    // Adam
    this.step++;
    const b1 = 0.9;
    const b2 = 0.999;
    for (const p of params) {
      const m = this.m.get(p) ?? this.m.set(p, new Float64Array(p.d.length)).get(p)!;
      const v = this.v.get(p) ?? this.v.set(p, new Float64Array(p.d.length)).get(p)!;
      for (let i = 0; i < p.d.length; i++) {
        const g = p.g[i] * clip;
        m[i] = b1 * m[i] + (1 - b1) * g;
        v[i] = b2 * v[i] + (1 - b2) * g * g;
        const mh = m[i] / (1 - b1 ** this.step);
        const vh = v[i] / (1 - b2 ** this.step);
        p.d[i] -= (lr * mh) / (Math.sqrt(vh) + 1e-8);
      }
    }
    return total / batch;
  }

  /** Continue `prompt` by sampling one character at a time. */
  generate(prompt: string, n = 60, temperature = 0.8, rnd: () => number = Math.random): string {
    const ids = this.encode(prompt);
    if (!ids.length) ids.push(this.index.get("\n") ?? 0);
    let text = "";
    for (let s = 0; s < n; s++) {
      const ctx = ids.slice(-this.cfg.ctx);
      const { logits } = this.forward(ctx);
      const V = this.vocab.length;
      const row = logits.d.subarray((ctx.length - 1) * V, ctx.length * V);
      const t = Math.max(temperature, 0.05);
      let m = -Infinity;
      for (const l of row) m = Math.max(m, l / t);
      const p = Array.from(row, (l) => Math.exp(l / t - m));
      const z = p.reduce((a, b) => a + b, 0);
      let r = rnd() * z;
      let next = 0;
      for (; next < V - 1; next++) {
        r -= p[next];
        if (r <= 0) break;
      }
      ids.push(next);
      const ch = this.vocab[next];
      if (ch === "\n") break;
      text += ch;
    }
    return text;
  }

  /** Attention weights for a short text (who looks at whom), for the heatmap. */
  attention(text: string) {
    const ids = this.encode(text).slice(-Math.min(this.cfg.ctx, 16));
    const { att } = this.forward(ids);
    const n = ids.length;
    return { tokens: ids.map((i) => this.vocab[i]), weights: Array.from({ length: n }, (_, i) => Array.from(att.d.subarray(i * n, (i + 1) * n))) };
  }
}
