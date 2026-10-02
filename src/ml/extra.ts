// More algorithms: k-NN, a small neural network, ROC/AUC, forecasting and PCA.
import { mean, sum, type Pt } from "./core";

export function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- ROC curve ------------------------------------------------------------------
export function roc(y: number[], p: number[]) {
  const P = sum(y);
  const N = y.length - P;
  const pts: Pt[] = [[0, 0]];
  for (const t of [...new Set(p)].sort((a, b) => b - a)) {
    let tp = 0;
    let fp = 0;
    p.forEach((v, i) => {
      if (v >= t) y[i] ? tp++ : fp++;
    });
    pts.push([fp / N, tp / P]);
  }
  pts.push([1, 1]);
  let auc = 0;
  for (let i = 1; i < pts.length; i++) auc += (pts[i][0] - pts[i - 1][0]) * (pts[i][1] + pts[i - 1][1]) * 0.5;
  return { pts, auc };
}

// ---- k-nearest neighbours ----------------------------------------------------------
export function knn(train: Pt[], labels: number[], q: Pt, k: number) {
  // Keep a small sorted list of the k best instead of sorting every point: O(n·k) instead of O(n log n),
  // which matters because the decision map calls this hundreds of times.
  const bestD: number[] = [];
  const bestI: number[] = [];
  for (let i = 0; i < train.length; i++) {
    const d = (train[i][0] - q[0]) ** 2 + (train[i][1] - q[1]) ** 2;
    if (bestD.length === k && d >= bestD[k - 1]) continue;
    let j = bestD.length < k ? bestD.length : k - 1;
    while (j > 0 && bestD[j - 1] > d) {
      bestD[j] = bestD[j - 1];
      bestI[j] = bestI[j - 1];
      j--;
    }
    bestD[j] = d;
    bestI[j] = i;
  }
  return { neighbors: bestI, p: sum(bestI.map((i) => labels[i])) / bestI.length };
}

// ---- Neural network (multi-layer perceptron) ------------------------------------
export interface Net {
  sizes: number[];
  W: number[][][]; // W[l][j][i]: weight from node i in layer l to node j in layer l+1
  b: number[][];
}

export function netInit(sizes: number[], seed = 3): Net {
  const r = seeded(seed);
  const W: number[][][] = [];
  const b: number[][] = [];
  for (let l = 0; l + 1 < sizes.length; l++) {
    const scale = Math.sqrt(1 / sizes[l]);
    W.push(Array.from({ length: sizes[l + 1] }, () => Array.from({ length: sizes[l] }, () => (r() * 2 - 1) * scale * 1.5)));
    b.push(new Array(sizes[l + 1]).fill(0));
  }
  return { sizes, W, b };
}

/** Returns activations of every layer. Hidden layers use tanh, the output uses sigmoid. */
export function netForward(net: Net, x: number[]): number[][] {
  const acts = [x];
  for (let l = 0; l < net.W.length; l++) {
    const last = l === net.W.length - 1;
    const prev = acts[l];
    acts.push(
      net.W[l].map((row, j) => {
        let z = net.b[l][j];
        for (let i = 0; i < row.length; i++) z += row[i] * prev[i];
        return last ? 1 / (1 + Math.exp(-z)) : Math.tanh(z);
      }),
    );
  }
  return acts;
}

/** One epoch of full-batch gradient descent (mutates the network). Returns the mean log-loss. */
export function netTrain(net: Net, X: number[][], y: number[], lr: number): number {
  const gW = net.W.map((m) => m.map((row) => row.map(() => 0)));
  const gb = net.b.map((v) => v.map(() => 0));
  let loss = 0;
  for (let s = 0; s < X.length; s++) {
    const acts = netForward(net, X[s]);
    const out = acts[acts.length - 1][0];
    loss += -(y[s] * Math.log(out + 1e-9) + (1 - y[s]) * Math.log(1 - out + 1e-9));
    let delta = [out - y[s]];
    for (let l = net.W.length - 1; l >= 0; l--) {
      const a = acts[l];
      for (let j = 0; j < delta.length; j++) {
        gb[l][j] += delta[j];
        for (let i = 0; i < a.length; i++) gW[l][j][i] += delta[j] * a[i];
      }
      if (l > 0) {
        delta = a.map((ai, i) => {
          let s2 = 0;
          for (let j = 0; j < delta.length; j++) s2 += net.W[l][j][i] * delta[j];
          return s2 * (1 - ai * ai);
        });
      }
    }
  }
  const n = X.length;
  for (let l = 0; l < net.W.length; l++) {
    for (let j = 0; j < net.W[l].length; j++) {
      net.b[l][j] -= (lr * gb[l][j]) / n;
      for (let i = 0; i < net.W[l][j].length; i++) net.W[l][j][i] -= (lr * gW[l][j][i]) / n;
    }
  }
  return loss / n;
}

export type Toy = "circle" | "xor" | "moons" | "spiral";
export function toyData(kind: Toy, n = 220, seed = 11): { X: Pt[]; y: number[] } {
  const r = seeded(seed);
  const noise = () => (r() - 0.5) * 0.18;
  const X: Pt[] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % 2;
    let p: Pt;
    if (kind === "circle") {
      const rad = c ? r() * 0.45 : 0.7 + r() * 0.35;
      const a = r() * Math.PI * 2;
      p = [rad * Math.cos(a), rad * Math.sin(a)];
    } else if (kind === "xor") {
      p = [r() * 2 - 1, r() * 2 - 1];
      const label = p[0] * p[1] > 0 ? 1 : 0;
      p = [p[0] + Math.sign(p[0]) * 0.05, p[1] + Math.sign(p[1]) * 0.05];
      X.push(p);
      y.push(label);
      continue;
    } else if (kind === "moons") {
      const a = r() * Math.PI;
      p = c ? [Math.cos(a) * 0.8 - 0.4, Math.sin(a) * 0.8 - 0.2] : [0.4 - Math.cos(a) * 0.8, 0.2 - Math.sin(a) * 0.8];
    } else {
      const t = (i / n) * 2.2 + 0.25;
      const a = t * Math.PI * 1.6 + (c ? Math.PI : 0);
      p = [(t / 2.45) * Math.cos(a), (t / 2.45) * Math.sin(a)];
    }
    X.push([p[0] + noise(), p[1] + noise()]);
    y.push(c);
  }
  return { X, y };
}

// ---- Forecasting ----------------------------------------------------------------
export type Method = "naive" | "ma" | "ses" | "holt";
/** Returns one-step-ahead fitted values over the history, then an h-step forecast. */
export function forecast(series: number[], method: Method, h: number, opts: { window: number; alpha: number; beta: number }) {
  const fitted: (number | null)[] = [];
  let fc: number[] = [];
  if (method === "naive") {
    series.forEach((_, i) => fitted.push(i ? series[i - 1] : null));
    fc = new Array(h).fill(series[series.length - 1]);
  } else if (method === "ma") {
    const w = opts.window;
    series.forEach((_, i) => fitted.push(i >= w ? mean(series.slice(i - w, i)) : null));
    fc = new Array(h).fill(mean(series.slice(-w)));
  } else if (method === "ses") {
    let level = series[0];
    series.forEach((v) => {
      fitted.push(level);
      level = opts.alpha * v + (1 - opts.alpha) * level;
    });
    fc = new Array(h).fill(level);
  } else {
    let level = series[0];
    let trend = series[1] - series[0];
    series.forEach((v) => {
      fitted.push(level + trend);
      const prev = level;
      level = opts.alpha * v + (1 - opts.alpha) * (level + trend);
      trend = opts.beta * (level - prev) + (1 - opts.beta) * trend;
    });
    fc = Array.from({ length: h }, (_, k) => level + (k + 1) * trend);
  }
  return { fitted, forecast: fc };
}

export const mae = (a: number[], b: number[]) => mean(a.map((v, i) => Math.abs(v - b[i])));
export const mape = (a: number[], b: number[]) => mean(a.map((v, i) => Math.abs((v - b[i]) / v))) * 100;

// ---- PCA (power iteration) ------------------------------------------------------
export function pca2(X: number[][]): { proj: Pt[]; explained: [number, number] } {
  const d = X[0].length;
  const mu = Array.from({ length: d }, (_, j) => mean(X.map((r) => r[j])));
  const C = X.map((r) => r.map((v, j) => v - mu[j]));
  const cov = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => sum(C.map((r) => r[i] * r[j])) / (X.length - 1)));
  const trace = sum(cov.map((r, i) => r[i]));
  const comps: number[][] = [];
  const lambdas: number[] = [];
  const M = cov.map((r) => [...r]);
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: d }, (_, i) => 1 / Math.sqrt(d) + i * 1e-3);
    for (let it = 0; it < 200; it++) {
      const nv = M.map((r) => sum(r.map((x, j) => x * v[j])));
      const norm = Math.hypot(...nv) || 1;
      v = nv.map((x) => x / norm);
    }
    const lambda = sum(M.map((r, i) => v[i] * sum(r.map((x, j) => x * v[j]))));
    comps.push(v);
    lambdas.push(lambda);
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) M[i][j] -= lambda * v[i] * v[j];
  }
  return {
    proj: C.map((r) => [sum(r.map((x, j) => x * comps[0][j])), sum(r.map((x, j) => x * comps[1][j]))] as Pt),
    explained: [lambdas[0] / trace, lambdas[1] / trace],
  };
}
