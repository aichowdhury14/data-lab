import { useState } from "react";
import { useLang } from "../i18n";
import { QUIZZES } from "../content/quiz";

/** A short "check yourself" quiz with instant feedback. */
export function Quiz({ id }: { id: string }) {
  const { t } = useLang();
  const qs = QUIZZES[id] ?? [];
  const [picked, setPicked] = useState<(number | null)[]>(() => qs.map(() => null));
  const score = picked.filter((p, i) => p === qs[i].answer).length;
  const answered = picked.filter((p) => p !== null).length;
  if (!qs.length) return null;
  return (
    <section className="quiz card">
      <div className="row spread">
        <h2 style={{ margin: 0 }}>🧠 {t({ en: "Quick check", bn: "ঝটপট যাচাই" })}</h2>
        <span className="badge">
          {answered === qs.length
            ? t({ en: `${score} / ${qs.length} correct`, bn: `${qs.length}টার মধ্যে ${score}টা সঠিক` })
            : t({ en: `${answered} / ${qs.length} answered`, bn: `${qs.length}টার মধ্যে ${answered}টার উত্তর দিয়েছেন` })}
        </span>
      </div>
      {qs.map((q, i) => (
        <div key={i} className="quiz-q">
          <p>
            <b>{i + 1}.</b> {t(q.q)}
          </p>
          <div className="quiz-opts">
            {q.options.map((o, j) => {
              const state = picked[i] === null ? "" : j === q.answer ? "right" : picked[i] === j ? "wrong" : "";
              return (
                <button key={j} className={`quiz-opt ${state}`} disabled={picked[i] !== null} onClick={() => setPicked(picked.map((p, k) => (k === i ? j : p)))}>
                  {state === "right" ? "✓ " : state === "wrong" ? "✗ " : ""}
                  {t(o)}
                </button>
              );
            })}
          </div>
          {picked[i] !== null && <p className={`quiz-why ${picked[i] === q.answer ? "ok" : "no"}`}>{t(q.why)}</p>}
        </div>
      ))}
      {answered > 0 && (
        <button className="btn ghost" onClick={() => setPicked(qs.map(() => null))}>
          ↺ {t({ en: "Try again", bn: "আবার চেষ্টা করুন" })}
        </button>
      )}
    </section>
  );
}
