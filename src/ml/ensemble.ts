// Ensembles (random forest, gradient boosting) and an item-to-item recommender — all from scratch.
import { buildTree, sigmoid, treeProba, type TreeNode } from "./core";
import { seeded } from "./extra";

// ---- Random forest ---------------------------------------------------------------------
export interface ForestOptions {
  trees: number;
  depth: number;
  /** how many features each split may look at (classic choice: √features, at least 1) */
  mtry: number;
  seed?: number;
}

/** Many trees, each trained on a bootstrap sample with random feature subsets — then they vote. */
export function trainForest(X: number[][], y: number[], o: ForestOptions): TreeNode[] {
  const rnd = seeded(o.seed ?? 42);
  const d = X[0].length;
  const pick = () => {
    const all = Array.from({ length: d }, (_, i) => i);
    for (let i = d - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, Math.max(1, o.mtry));
  };
  const forest: TreeNode[] = [];
  for (let t = 0; t < o.trees; t++) {
    const idx = Array.from({ length: X.length }, () => Math.floor(rnd() * X.length));
    forest.push(buildTree(idx.map((i) => X[i]), idx.map((i) => y[i]), o.depth, 5, 0, pick));
  }
  return forest;
}

/** Average of the first `upTo` trees' probabilities (lets the UI show "accuracy vs number of trees"). */
export const forestProba = (forest: TreeNode[], x: number[], upTo = forest.length) => {
  let s = 0;
  for (let i = 0; i < upTo; i++) s += treeProba(forest[i], x);
  return s / upTo;
};

/** How much each feature reduced impurity across all trees, normalised to sum to 1. */
export function featureImportance(trees: TreeNode[], d: number): number[] {
  const imp = new Array(d).fill(0);
  const walk = (n: TreeNode) => {
    if (n.leaf) return;
    imp[n.feature!] += n.gain ?? 0;
    walk(n.left!);
    walk(n.right!);
  };
  trees.forEach(walk);
  const total = imp.reduce((a, b) => a + b, 0) || 1;
  return imp.map((v) => v / total);
}

// ---- Gradient boosting (log-loss, small regression trees, Newton leaf values) ------------
export interface RegNode {
  leaf: boolean;
  value: number;
  feature?: number;
  threshold?: number;
  left?: RegNode;
  right?: RegNode;
}

const LAMBDA = 1;

/** Regression tree on gradients g and hessians h (the XGBoost-style split gain). */
function buildRegTree(X: number[][], g: number[], h: number[], maxDepth: number, minLeaf: number, depth = 0): RegNode {
  const G = g.reduce((a, b) => a + b, 0);
  const H = h.reduce((a, b) => a + b, 0);
  const node: RegNode = { leaf: true, value: G / (H + LAMBDA) };
  if (depth >= maxDepth || g.length < minLeaf * 2) return node;
  const parentScore = (G * G) / (H + LAMBDA);
  let best = { gain: 1e-9, f: -1, t: 0 };
  for (let f = 0; f < X[0].length; f++) {
    const sorted = [...new Set(X.map((r) => r[f]))].sort((a, b) => a - b);
    const step = Math.max(1, Math.floor(sorted.length / 24));
    for (let i = 0; i + 1 < sorted.length; i += step) {
      const t = (sorted[i] + sorted[Math.min(i + step, sorted.length - 1)]) / 2;
      let gl = 0;
      let hl = 0;
      let nl = 0;
      for (let r = 0; r < X.length; r++)
        if (X[r][f] <= t) {
          gl += g[r];
          hl += h[r];
          nl++;
        }
      if (nl < minLeaf || X.length - nl < minLeaf) continue;
      const gr = G - gl;
      const hr = H - hl;
      const gain = (gl * gl) / (hl + LAMBDA) + (gr * gr) / (hr + LAMBDA) - parentScore;
      if (gain > best.gain) best = { gain, f, t };
    }
  }
  if (best.f < 0) return node;
  const li: number[] = [];
  const ri: number[] = [];
  X.forEach((r, i) => (r[best.f] <= best.t ? li : ri).push(i));
  const sub = (ids: number[]) => buildRegTree(ids.map((i) => X[i]), ids.map((i) => g[i]), ids.map((i) => h[i]), maxDepth, minLeaf, depth + 1);
  return { leaf: false, value: node.value, feature: best.f, threshold: best.t, left: sub(li), right: sub(ri) };
}

const regPredict = (n: RegNode, x: number[]): number => (n.leaf ? n.value : regPredict(x[n.feature!] <= n.threshold! ? n.left! : n.right!, x));

export interface GBM {
  base: number;
  lr: number;
  trees: RegNode[];
}

/** Each new small tree learns to fix the mistakes (gradients) of all the trees before it. */
export function trainGBM(X: number[][], y: number[], o: { rounds: number; lr: number; depth: number }): GBM {
  const p0 = Math.min(0.99, Math.max(0.01, y.reduce((a, b) => a + b, 0) / y.length));
  const base = Math.log(p0 / (1 - p0));
  const F = new Array(X.length).fill(base);
  const trees: RegNode[] = [];
  for (let m = 0; m < o.rounds; m++) {
    const p = F.map(sigmoid);
    const g = p.map((pi, i) => y[i] - pi); // negative gradient of log-loss
    const h = p.map((pi) => Math.max(pi * (1 - pi), 1e-6));
    const tree = buildRegTree(X, g, h, o.depth, 5);
    trees.push(tree);
    for (let i = 0; i < X.length; i++) F[i] += o.lr * regPredict(tree, X[i]);
  }
  return { base, lr: o.lr, trees };
}

export const gbmProba = (m: GBM, x: number[], upTo = m.trees.length) => {
  let f = m.base;
  for (let i = 0; i < upTo; i++) f += m.lr * regPredict(m.trees[i], x);
  return sigmoid(f);
};

export const logLoss = (y: number[], p: number[]) => -y.reduce((a, yi, i) => a + (yi ? Math.log(p[i] + 1e-12) : Math.log(1 - p[i] + 1e-12)), 0) / y.length;
export const accuracy = (y: number[], p: number[], th = 0.5) => y.reduce((a, yi, i) => a + ((p[i] >= th ? 1 : 0) === yi ? 1 : 0), 0) / y.length;

// ---- Recommender: "customers who bought this also bought" --------------------------------
export interface Basket {
  products: string[];
  buyers: Map<string, Set<number>>;
  byCustomer: Map<number, Set<string>>;
}

export function buildBaskets(orders: { customer_id: number; product: string }[]): Basket {
  const buyers = new Map<string, Set<number>>();
  const byCustomer = new Map<number, Set<string>>();
  for (const o of orders) {
    (buyers.get(o.product) ?? buyers.set(o.product, new Set()).get(o.product)!).add(o.customer_id);
    (byCustomer.get(o.customer_id) ?? byCustomer.set(o.customer_id, new Set()).get(o.customer_id)!).add(o.product);
  }
  return { products: [...buyers.keys()].sort(), buyers, byCustomer };
}

/** Cosine similarity of two products' buyer sets, plus the raw overlap for a human explanation. */
export function similar(b: Basket, product: string, k = 5) {
  const A = b.buyers.get(product)!;
  return b.products
    .filter((p) => p !== product)
    .map((p) => {
      const B = b.buyers.get(p)!;
      let both = 0;
      A.forEach((c) => B.has(c) && both++);
      return { product: p, score: both / Math.sqrt(A.size * B.size), both, of: A.size, alsoPct: both / A.size };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}

/** Recommend products a customer hasn't bought, scored by similarity to what they did buy. */
export function recommendFor(b: Basket, customer: number, k = 3) {
  const owned = b.byCustomer.get(customer) ?? new Set<string>();
  // score = total similarity to everything they own; "because" = the owned product that matches best
  const scores = new Map<string, { score: number; because: string; best: number }>();
  for (const have of owned) {
    for (const s of similar(b, have, b.products.length)) {
      if (owned.has(s.product)) continue;
      const cur = scores.get(s.product) ?? { score: 0, because: have, best: -1 };
      cur.score += s.score;
      if (s.score > cur.best) [cur.best, cur.because] = [s.score, have];
      scores.set(s.product, cur);
    }
  }
  return [...scores]
    .map(([product, v]) => ({ product, score: v.score, because: v.because }))
    .sort((a, b2) => b2.score - a.score)
    .slice(0, k);
}
