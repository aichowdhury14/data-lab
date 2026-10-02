import { useCallback, useEffect, useState } from "react";
import { useLang, type T } from "../i18n";
import { LESSONS, type Lesson } from "../data/lessons";
import { SCHEMA } from "../data/schema";
import { resetDb, runQuery, type QueryResult } from "../data/db";
import { Callout, DataTable, PageHead, Plain, Tabs } from "../components/ui";
import { Quiz } from "../components/Quiz";
import { Bars, XY } from "../components/charts";
import { useSearchParams } from "react-router-dom";
import { compare, sortsResult, type Grade } from "../data/check";

// Lessons the learner has actually solved (separate from merely opened).
const SOLVED_KEY = "datalab-sql-solved";
function readSolved(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SOLVED_KEY) ?? "[]");
  } catch {
    return [];
  }
}
const CHECKABLE = LESSONS.filter((l) => l.solutions).length;

// Shareable links: the query travels in the URL as URL-safe base64 of its UTF-8 bytes.
const encodeQuery = (q: string) => btoa(String.fromCharCode(...new TextEncoder().encode(q))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function decodeQuery(s: string): string | null {
  try {
    const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
import { markDone, useMark, useProgress } from "../progress";

const PLAYGROUND = -1;
const LEVEL: Record<Lesson["level"], T> = {
  beginner: { en: "Beginner", bn: "শুরুর ধাপ" },
  intermediate: { en: "Intermediate", bn: "মাঝারি ধাপ" },
  practice: { en: "Practice with new data", bn: "নতুন ডেটায় অনুশীলন" },
};

export default function Sql() {
  const { t } = useLang();
  const [idx, setIdx] = useState(0);
  const lesson = idx === PLAYGROUND ? null : LESSONS[idx];
  const [sql, setSql] = useState(LESSONS[0].sql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"table" | "chart">("table");
  const [grade, setGrade] = useState<Grade | "error" | "checking" | null>(null);
  const [showSol, setShowSol] = useState(false);
  const [copied, setCopied] = useState(false);
  const [params] = useSearchParams();
  const done = useProgress().sql ?? [];
  const [solved, setSolved] = useState<string[]>(readSolved);
  const [party, setParty] = useState(0);
  useMark("sql", lesson?.id ?? null);

  const run = useCallback(async (q: string) => {
    setBusy(true);
    try {
      setResult(await runQuery(q));
      setError(null);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  // Opened from a shared link? Load that query into the playground and run it.
  useEffect(() => {
    const shared = params.get("q");
    const q = shared ? decodeQuery(shared) : null;
    const li = LESSONS.findIndex((l) => l.id === params.get("lesson"));
    if (li >= 0) setIdx(li);
    if (q) {
      if (li < 0) setIdx(PLAYGROUND);
      setSql(q);
      run(q);
    } else if (li >= 0) {
      setSql(LESSONS[li].sql);
      run(LESSONS[li].sql);
    } else run(LESSONS[0].sql);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (i: number) => {
    setGrade(null);
    setShowSol(false);
    setIdx(i);
    const q = i === PLAYGROUND ? "SELECT * FROM customers LIMIT 5;" : LESSONS[i].sql;
    setSql(q);
    run(q);
  };

  /** Runs the learner's query and each accepted solution, then compares the results. */
  const check = async () => {
    if (!lesson?.solutions) return;
    setGrade("checking");
    let mine: QueryResult;
    try {
      mine = await runQuery(sql);
      setResult(mine);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGrade("error");
      return;
    }
    let best: Grade | null = null;
    for (const sol of lesson.solutions) {
      const g = compare(mine, await runQuery(sol), sortsResult(sol));
      if (g.ok) {
        best = g;
        break;
      }
      best ??= g;
    }
    setGrade(best);
    if (best?.ok) {
      markDone("sql", lesson.id);
      setParty(Date.now());
      if (!solved.includes(lesson.id)) {
        const next = [...solved, lesson.id];
        setSolved(next);
        try {
          localStorage.setItem(SOLVED_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
    }
  };

  const share = async () => {
    const url = `${location.origin}/sql?${lesson ? `lesson=${lesson.id}&` : ""}q=${encodeQuery(sql)}`;
    const phone = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
    if (phone && navigator.share) {
      try {
        await navigator.share({ title: "Data Lab · SQL", text: lesson ? `Try my answer to “${t(lesson.title)}”` : "Try this SQL query", url });
        return;
      } catch {
        /* cancelled — fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <>
      <PageHead
        title={{ en: "SQL", bn: "এসকিউএল" }}
        sub={{
          en: "SQL is a simple language for asking a database questions, like “who are my top 10 customers?”. Every lesson runs on a real database inside your browser. Change the query, press Run, and see what happens — you can't break anything.",
          bn: "SQL হলো ডেটাবেসকে প্রশ্ন করার একটা সহজ ভাষা, যেমন “আমার সেরা ১০ জন গ্রাহক কারা?”। প্রতিটা পাঠ আপনার ব্রাউজারের ভেতরেই একটা আসল ডেটাবেসে চলে। কোয়েরি বদলান, Run চাপুন, দেখুন কী হয় — কিছুই নষ্ট হবে না।",
        }}
        art="sql"
      />
      <div className="sql-layout">
        <aside>
          <div className="solved-meter" title={t({ en: "Lessons solved with “Check my answer”", bn: "“আমার উত্তর যাচাই করুন” দিয়ে সমাধান করা পাঠ" })}>
            <span>
              🏆 {t({ en: "Solved", bn: "সমাধান" })} <b>{solved.length}</b> / {CHECKABLE}
            </span>
            <div className="progress">
              <div style={{ width: `${(solved.length / CHECKABLE) * 100}%` }} />
            </div>
          </div>
          <ul className="lesson-list">
            {LESSONS.map((l, i) => (
              <li key={l.id}>
                {(i === 0 || LESSONS[i - 1].level !== l.level) && <div className="list-head">{t(LEVEL[l.level])}</div>}
                <button className={idx === i ? "on" : ""} onClick={() => open(i)}>
                  <span className={`n${solved.includes(l.id) ? " solved" : done.includes(l.id) ? " seen" : ""}`}>{solved.includes(l.id) ? "✓" : i + 1}</span>
                  <span>{t(l.title)}</span>
                </button>
              </li>
            ))}
            <li style={{ marginTop: 8 }}>
              <button className={idx === PLAYGROUND ? "on" : ""} onClick={() => open(PLAYGROUND)}>
                <span className="n">✎</span>
                <span>{t({ en: "Free playground", bn: "ফ্রি প্লেগ্রাউন্ড" })}</span>
              </button>
            </li>
          </ul>
          <Schema />
        </aside>

        <section>
          {lesson ? (
            <>
              <div className="row">
                <h2 style={{ margin: 0 }}>
                  {idx + 1}. {t(lesson.title)}
                </h2>
                <span className={`badge ${lesson.level === "beginner" ? "" : "mid"}`}>{t(LEVEL[lesson.level])}</span>
              </div>
              <p>{t(lesson.concept)}</p>
              <Plain text={lesson.analogy} />
            </>
          ) : (
            <p className="muted">
              {t({
                en: "Write any SELECT query on any of the 8 tables (see the list on the left). If something goes wrong, press “Reset database”.",
                bn: "বাঁ পাশের তালিকার ৮টা টেবিলের যেকোনোটায় যেকোনো SELECT কোয়েরি লিখুন। কিছু গোলমাল হলে “ডেটাবেস রিসেট” চাপুন।",
              })}
            </p>
          )}

          {lesson && (
            <Callout kind="idea" title={{ en: "Your turn", bn: "এবার আপনার পালা" }}>
              <p>{t(lesson.task)}</p>
              {lesson.solutions && (
                <div className="check-box">
                  <div className="row">
                    <button className="btn" onClick={check} disabled={grade === "checking"}>
                      ✓ {t({ en: "Check my answer", bn: "আমার উত্তর যাচাই করুন" })}
                    </button>
                    {grade && grade !== "checking" && !(typeof grade === "object" && grade.ok) && (
                      <button className="btn ghost" onClick={() => setShowSol(!showSol)}>
                        💡 {showSol ? t({ en: "Hide solution", bn: "সমাধান লুকান" }) : t({ en: "Show solution", bn: "সমাধান দেখুন" })}
                      </button>
                    )}
                  </div>
                  {grade && grade !== "checking" && <Feedback grade={grade} />}
                  {party > 0 && typeof grade === "object" && grade?.ok && (
                    <div className="confetti" key={party} aria-hidden>
                      {Array.from({ length: 18 }, (_, k) => (
                        <i key={k} style={{ ["--x" as string]: `${(k * 37) % 100}%`, ["--d" as string]: `${(k % 6) * 0.05}s`, ["--c" as string]: `var(--c${(k % 7) + 1})` }} />
                      ))}
                    </div>
                  )}
                  {showSol && (
                    <div className="solution">
                      <pre>{lesson.solutions[0]}</pre>
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setSql(lesson.solutions![0]);
                          run(lesson.solutions![0]);
                        }}
                      >
                        {t({ en: "Put it in the editor", bn: "এডিটরে বসান" })}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Callout>
          )}
          <textarea
            className="code"
            value={sql}
            spellCheck={false}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey && lesson?.solutions) check();
                else run(sql);
              }
            }}
            aria-label="SQL editor"
          />
          <div className="row spread" style={{ margin: "8px 0 14px" }}>
            <div className="row">
              <button className="btn" onClick={() => run(sql)} disabled={busy}>
                ▶ {t({ en: "Run", bn: "চালান" })}
              </button>
              {lesson && (
                <button className="btn ghost" onClick={() => open(idx)}>
                  {t({ en: "Reset query", bn: "কোয়েরি রিসেট" })}
                </button>
              )}
              <button
                className="btn ghost"
                onClick={() => {
                  resetDb();
                  run(sql);
                }}
              >
                {t({ en: "Reset database", bn: "ডেটাবেস রিসেট" })}
              </button>
              <button className="btn ghost" onClick={share} title={t({ en: "Copy a link that opens this exact query", bn: "এই কোয়েরিসহ খুলবে এমন লিংক কপি করুন" })}>
                {copied ? "✓ " + t({ en: "Link copied!", bn: "লিংক কপি হয়েছে!" }) : "🔗 " + t({ en: "Share query", bn: "কোয়েরি শেয়ার" })}
              </button>
            </div>
            <span className="muted small">Ctrl + Enter {t({ en: "run", bn: "চালান" })}{lesson?.solutions ? ` · Ctrl + Shift + Enter ${t({ en: "check", bn: "যাচাই" })}` : ""}</span>
          </div>

          {error && <div className="err">{error}</div>}
          {result && (
            <>
              {result.columns.length ? (
                <>
                  {chartable(result) && (
                    <Tabs
                      value={view}
                      onChange={setView}
                      tabs={[
                        { id: "table", label: { en: "▦ Table", bn: "▦ টেবিল" } },
                        { id: "chart", label: { en: "📈 Chart", bn: "📈 চার্ট" } },
                      ]}
                    />
                  )}
                  {view === "chart" && chartable(result) ? <ResultChart r={result} /> : <DataTable columns={result.columns} rows={result.rows} max={100} />}
                </>
              ) : (
                <p className="muted">{t({ en: "Query ran, no rows returned.", bn: "কোয়েরি চলেছে, কোনো সারি ফেরেনি।" })}</p>
              )}
              <p className="muted small">
                {t({ en: `${result.rows.length} rows · ${result.ms.toFixed(1)} ms`, bn: `${result.rows.length}টি সারি · ${result.ms.toFixed(1)} ms` })}
              </p>
            </>
          )}

          <div className="row">
            {idx > 0 && (
              <button className="btn ghost" onClick={() => open(idx === PLAYGROUND ? 0 : idx - 1)}>
                ← {t({ en: "Previous", bn: "আগের" })}
              </button>
            )}
            {idx !== PLAYGROUND && idx < LESSONS.length - 1 && (
              <button className="btn" onClick={() => open(idx + 1)}>
                {t({ en: "Next lesson", bn: "পরের পাঠ" })} →
              </button>
            )}
          </div>
        </section>
      </div>
      <Quiz id="sql" />
    </>
  );
}

function Schema() {
  const { t } = useLang();
  return (
    <details className="card schema" style={{ marginTop: 16 }} open>
      <summary>
        <b>{t({ en: "Tables", bn: "টেবিল" })}</b>
      </summary>
      {Object.entries(SCHEMA).map(([name, cols]) => (
        <div key={name}>
          <b>{name}</b>
          <code>{cols.replace(/ PRIMARY KEY/g, " 🔑").split(", ").join(", ")}</code>
        </div>
      ))}
      <p className="muted small" style={{ margin: 0 }}>
        {t({ en: "transactions.customer_id and loans.customer_id point to customers.id.", bn: "transactions.customer_id ও loans.customer_id গিয়ে customers.id-তে মেলে।" })}
      </p>
    </details>
  );
}

/** A result can be charted when it has a label column followed by at least one numeric column. */
function chartable(r: QueryResult) {
  return r.rows.length > 1 && r.rows.length <= 400 && r.columns.length >= 2 && r.rows.every((row) => typeof row[row.length - 1] === "number");
}

function ResultChart({ r }: { r: QueryResult }) {
  const numIdx = r.columns.map((_, j) => j).filter((j) => j > 0 && r.rows.every((row) => typeof row[j] === "number"));
  const timeLike = r.rows.every((row) => /^d{4}-d{2}/.test(String(row[0])));
  const col = numIdx[numIdx.length - 1];
  if (timeLike) {
    return (
      <div className="card">
        <XY
          series={numIdx.slice(-3).map((j) => ({ name: r.columns[j], pts: r.rows.map((row, i) => [i, row[j] as number] as [number, number]) }))}
          xFmt={(v) => String(r.rows[Math.round(v)]?.[0] ?? "").slice(0, 10)}
          h={280}
        />
      </div>
    );
  }
  return (
    <div className="card">
      <Bars
        items={r.rows.slice(0, 30).map((row) => ({ label: String(row[0]), value: row[col] as number }))}
        yLabel={r.columns[col]}
        xLabel={r.columns[0]}
        colors={r.rows.slice(0, 30).map((_, i) => `var(--c${(i % 8) + 1})`)}
      />
    </div>
  );
}

function Feedback({ grade }: { grade: Grade | "error" }) {
  const { t } = useLang();
  if (grade === "error")
    return <p className="check-msg no">{t({ en: "❌ Your query has an error (see the red box above). Fix it, then check again.", bn: "❌ আপনার কোয়েরিতে ভুল আছে (ওপরের লাল বক্স দেখুন)। ঠিক করে আবার যাচাই করুন।" })}</p>;
  if (grade.ok)
    return <p className="check-msg ok">{t({ en: "✅ Correct! Nicely done — this lesson is now marked as solved.", bn: "✅ একদম ঠিক! দারুণ — এই পাঠটি সমাধান হিসেবে চিহ্নিত হলো।" })}</p>;
  if (grade.reason === "rows")
    return (
      <p className="check-msg no">
        {t({
          en: `🤔 Not yet. Your result has ${grade.got} rows, but the answer has ${grade.expected}. Check your WHERE, HAVING or LIMIT.`,
          bn: `🤔 এখনো হয়নি। আপনার ফলাফলে ${grade.got}টি সারি, কিন্তু উত্তরে আছে ${grade.expected}টি। WHERE, HAVING বা LIMIT আবার দেখুন।`,
        })}
      </p>
    );
  if (grade.reason === "order")
    return <p className="check-msg no">{t({ en: "🔀 Almost! The right rows, but in the wrong order. Check your ORDER BY (and ASC / DESC).", bn: "🔀 প্রায় হয়ে গেছে! সারিগুলো ঠিক, কিন্তু ক্রম ভুল। ORDER BY (আর ASC / DESC) দেখুন।" })}</p>;
  return (
    <p className="check-msg no">
      {t({
        en: `🧐 Close! The right number of rows (${grade.expected}), but some values are different. Check your calculation or GROUP BY.`,
        bn: `🧐 কাছাকাছি! সারির সংখ্যা ঠিক (${grade.expected}), কিন্তু কিছু মান আলাদা। হিসাব বা GROUP BY আবার দেখুন।`,
      })}
    </p>
  );
}
