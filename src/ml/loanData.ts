// The loan-default dataset shared by every classification model, with one fixed train/test split,
// so all models are compared on exactly the same unseen loans.
import type { T } from "../i18n";
import { customerById, dataset } from "../data/generate";
import { mean, splitIndices } from "./core";

export const FEATURES: T[] = [
  { en: "credit score", bn: "ক্রেডিট স্কোর" },
  { en: "loan ÷ yearly income", bn: "ঋণ ÷ বার্ষিক আয়" },
  { en: "interest rate %", bn: "সুদের হার %" },
];
export const LOANS = dataset("loans").rows.map((l) => {
  const c = customerById.get(l.customer_id as number)!;
  return {
    x: [c.credit_score as number, (l.amount as number) / ((c.monthly_income as number) * 12), l.interest_rate as number],
    y: l.defaulted as number,
  };
});
export const SPLIT = splitIndices(LOANS.length, 0.25);
export const Xtrain = SPLIT.train.map((i) => LOANS[i].x);
export const ytrain = SPLIT.train.map((i) => LOANS[i].y);
export const Xtest = SPLIT.test.map((i) => LOANS[i].x);
export const ytest = SPLIT.test.map((i) => LOANS[i].y);
export const DEFAULT_RATE = mean(LOANS.map((l) => l.y));
