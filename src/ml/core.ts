// Small, dependency-free implementations of the classic algorithms.
// They are deliberately written for readability, not speed: learners can read them.

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : NaN);
export const std = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
export function pearson(xs: number[], ys: number[]) {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

export interface Scaler {
  mean: number[];
  std: number[];
}
export function fitScaler(X: number[][]): Scaler {
  const d = X[0].length;
  const cols = Array.from({ length: d }, (_, j) => X.map((r) => r[j]));
  return { mean: cols.map(mean), std: cols.map((c) => std(c) || 1) };
}
export const applyScaler = (X: number[][], s: Scaler) => X.map((r) => r.map((v, j) => (v - s.mean[j]) / s.std[j]));

/** Deterministic shuffle-split so train/test sets never change between renders. */
export function splitIndices(n: number, testFraction: number, seed = 7) {
  let a = seed;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const nTest = Math.round(n * testFraction);
  return { test: idx.slice(0, nTest), train: idx.slice(nTest) };
}

// ---- Linear regression (gradient descent on standardized data) -----------------
export interface LinState {
  w: number;
  b: number;
  loss: number;
  epoch: number;
}
export const linInit = (): LinState => ({ w: -1.5, b: 1.2, loss: NaN, epoch: 0 });
export function linStep(xs: number[], ys: number[], s: LinState, lr: number): LinState {
  const n = xs.length;
  let gw = 0;
  let gb = 0;
  let loss = 0;
  for (let i = 0; i < n; i++) {
    const err = s.w * xs[i] + s.b - ys[i];
    gw += (2 / n) * err * xs[i];
    gb += (2 / n) * err;
    loss += err * err;
  }
  return { w: s.w - lr * gw, b: s.b - lr * gb, loss: loss / n, epoch: s.epoch + 1 };
}
/** The exact least-squares answer, to compare against what gradient descent converges to. */
export function linClosedForm(xs: number[], ys: number[]) {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const w = num / den;
  return { w, b: my - w * mx };
}

// ---- Logistic regression --------------------------------------------------------
export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
export interface LogModel {
  w: number[];
  b: number;
}
export function trainLogistic(X: number[][], y: number[], epochs: number, lr: number): { model: LogModel; losses: number[] } {
  const d = X[0].length;
  const w = new Array(d).fill(0);
  let b = 0;
  const losses: number[] = [];
  for (let e = 0; e < epochs; e++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    let loss = 0;
    for (let i = 0; i < X.length; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * X[i][j];
      const p = sigmoid(z);
      const err = p - y[i];
      for (let j = 0; j < d; j++) gw[j] += (err * X[i][j]) / X.length;
      gb += err / X.length;
      loss += -(y[i] * Math.log(p + 1e-12) + (1 - y[i]) * Math.log(1 - p + 1e-12));
    }
    for (let j = 0; j < d; j++) w[j] -= lr * gw[j];
    b -= lr * gb;
    losses.push(loss / X.length);
  }
  return { model: { w, b }, losses };
}
export const predictProba = (m: LogModel, x: number[]) => sigmoid(m.b + m.w.reduce((a, wj, j) => a + wj * x[j], 0));

export interface Metrics {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
}
export function confusion(y: number[], pred: number[]): Metrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  y.forEach((t, i) => {
    if (pred[i] && t) tp++;
    else if (pred[i] && !t) fp++;
    else if (!pred[i] && !t) tn++;
    else fn++;
  });
  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  return {
    tp,
    fp,
    tn,
    fn,
    accuracy: (tp + tn) / y.length,
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
  };
}

// ---- k-means --------------------------------------------------------------------
export type Pt = [number, number];
export function kmeansInit(points: Pt[], k: number): Pt[] {
  // k-means++ style, but deterministic: start from point 0, then repeatedly take the farthest point.
  const centroids: Pt[] = [points[0]];
  while (centroids.length < k) {
    let best = points[0];
    let bestD = -1;
    for (const p of points) {
      const d = Math.min(...centroids.map((c) => (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    centroids.push(best);
  }
  return centroids;
}
export function kmeansStep(points: Pt[], centroids: Pt[]) {
  const assign = points.map((p) => {
    let best = 0;
    let bestD = Infinity;
    centroids.forEach((c, i) => {
      const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  });
  const next: Pt[] = centroids.map((c, i) => {
    const mine = points.filter((_, j) => assign[j] === i);
    return mine.length ? [mean(mine.map((p) => p[0])), mean(mine.map((p) => p[1]))] : c;
  });
  const inertia = sum(points.map((p, j) => (p[0] - next[assign[j]][0]) ** 2 + (p[1] - next[assign[j]][1]) ** 2));
  const moved = sum(next.map((c, i) => Math.hypot(c[0] - centroids[i][0], c[1] - centroids[i][1])));
  return { assign, centroids: next, inertia, moved };
}
export function kmeansFit(points: Pt[], k: number, maxIter = 50) {
  let c = kmeansInit(points, k);
  let out = kmeansStep(points, c);
  for (let i = 0; i < maxIter && out.moved > 1e-6; i++) {
    c = out.centroids;
    out = kmeansStep(points, c);
  }
  return out;
}

// ---- Decision tree (CART, Gini impurity) ----------------------------------------
export interface TreeNode {
  n: number;
  pos: number; // how many positives (defaults) reached this node
  leaf: boolean;
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}
const gini = (pos: number, n: number) => (n ? 1 - (pos / n) ** 2 - (1 - pos / n) ** 2 : 0);

export function buildTree(X: number[][], y: number[], maxDepth: number, minLeaf = 8, depth = 0): TreeNode {
  const n = y.length;
  const pos = sum(y);
  const node: TreeNode = { n, pos, leaf: true };
  if (depth >= maxDepth || n < minLeaf * 2 || pos === 0 || pos === n) return node;

  let best = { gain: 1e-7, f: -1, t: 0 };
  const parent = gini(pos, n);
  for (let f = 0; f < X[0].length; f++) {
    const sorted = [...new Set(X.map((r) => r[f]))].sort((a, b) => a - b);
    const step = Math.max(1, Math.floor(sorted.length / 24));
    for (let i = 0; i + 1 < sorted.length; i += step) {
      const t = (sorted[i] + sorted[Math.min(i + step, sorted.length - 1)]) / 2;
      let ln = 0;
      let lp = 0;
      for (let r = 0; r < n; r++) {
        if (X[r][f] <= t) {
          ln++;
          lp += y[r];
        }
      }
      const rn = n - ln;
      if (ln < minLeaf || rn < minLeaf) continue;
      const gain = parent - (ln / n) * gini(lp, ln) - (rn / n) * gini(pos - lp, rn);
      if (gain > best.gain) best = { gain, f, t };
    }
  }
  if (best.f < 0) return node;

  const li: number[] = [];
  const ri: number[] = [];
  X.forEach((r, i) => (r[best.f] <= best.t ? li : ri).push(i));
  return {
    n,
    pos,
    leaf: false,
    feature: best.f,
    threshold: best.t,
    left: buildTree(li.map((i) => X[i]), li.map((i) => y[i]), maxDepth, minLeaf, depth + 1),
    right: buildTree(ri.map((i) => X[i]), ri.map((i) => y[i]), maxDepth, minLeaf, depth + 1),
  };
}
export const treeProba = (t: TreeNode, x: number[]): number =>
  t.leaf ? t.pos / t.n : treeProba(x[t.feature!] <= t.threshold! ? t.left! : t.right!, x);
export function treePath(t: TreeNode, x: number[]): TreeNode[] {
  const path = [t];
  let cur = t;
  while (!cur.leaf) {
    cur = x[cur.feature!] <= cur.threshold! ? cur.left! : cur.right!;
    path.push(cur);
  }
  return path;
}
