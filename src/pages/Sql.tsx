import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLang, type T } from "../i18n";
import { LESSONS, type Lesson } from "../data/lessons";
import { CHALLENGES, POINTS, type Challenge } from "../data/challenges";
import { SCHEMA } from "../data/schema";
import { resetDb, runQuery, type QueryResult } from "../data/db";
import { compare, sortsResult, type Grade } from "../data/check";
import { explainSql } from "../data/explain";
import { Callout, DataTable, PageHead, Plain, Tabs } from "../components/ui";
import { Quiz } from "../components/Quiz";
import { Bars, XY } from "../components/charts";
import { markDone, useMark, useProgress } from "../progress";
import { digits } from "../numerals";

// ---- local, per-browser records ------------------------------------------------------
const SOLVED_KEY = "datalab-sql-solved";
const CHALLENGE_KEY = "datalab-sql-challenges";
function readJson<V>(key: string, fallback: V): V {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
const CHECKABLE = LESSONS.filter((l) => l.solutions).length;
const MAX_POINTS = CHALLENGES.reduce((a, c) => a + POINTS[c.level], 0);

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

const PLAYGROUND = -1;
const CHALLENGE_MODE = -2;
const LEVEL: Record<Lesson["level"], T> = {
  beginner: { en: "Beginner", bn: "শুরুর ধাপ" },
  intermediate: { en: "Intermediate", bn: "মাঝারি ধাপ" },
  practice: { en: "Practice with new data", bn: "নতুন ডেটায় অনুশীলন" },
};
const CH_LEVEL: Record<Challenge["level"], T> = {
  easy: { en: "Easy", bn: "সহজ" },
  medium: { en: "Medium", bn: "মাঝারি" },
  hard: { en: "Hard", bn: "কঠিন" },
};
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const starterFor = (c: Challenge) => `-- ${c.tables.join(", ")}\nSELECT `;

export default function Sql() {
  const { t } = useLang();
  const [idx, setIdx] = useState(0);
  const lesson = idx >= 0 ? LESSONS[idx] : null;
  const [chIdx, setChIdx] = useState(0);
  const challenge = idx === CHALLENGE_MODE ? CHALLENGES[chIdx] : null;
  const solutions = lesson?.solutions ?? challenge?.solutions;

  const [sql, setSql] = useState(LESSONS[0].sql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"table" | "chart">("table");
  const [grade, setGrade] = useState<Grade | "error" | "checking" | null>(null);
  const [wrong, setWrong] = useState(0);
  const [showSol, setShowSol] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [params] = useSearchParams();
  const done = useProgress().sql ?? [];
  const [solved, setSolved] = useState<string[]>(() => readJson(SOLVED_KEY, []));
  const [records, setRecords] = useState<Record<string, number>>(() => readJson(CHALLENGE_KEY, {}));
  const [party, setParty] = useState(0);
  const [chStart, setChStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useMark("sql", lesson?.id ?? null);

  const solvedNow = typeof grade === "object" && grade?.ok;
  const score = CHALLENGES.reduce((a, c) => a + (records[c.id] !== undefined ? POINTS[c.level] : 0), 0);

  // challenge timer (stops once solved)
  useEffect(() => {
    if (!challenge || solvedNow) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [challenge, solvedNow]);

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

  const resetTask = () => {
    setGrade(null);
    setWrong(0);
    setShowSol(false);
    setShowHint(false);
  };

  const openChallenge = (i: number, q?: string) => {
    resetTask();
    setIdx(CHALLENGE_MODE);
    setChIdx(i);
    setChStart(Date.now());
    setNow(Date.now());
    const start = q ?? starterFor(CHALLENGES[i]);
    setSql(start);
    setResult(null);
    setError(null);
    if (q) run(q);
  };

  // Opened from a shared link? Restore the lesson / challenge and the query.
  useEffect(() => {
    const shared = params.get("q");
    const q = shared ? decodeQuery(shared) : null;
    const ci = CHALLENGES.findIndex((c) => c.id === params.get("challenge"));
    if (ci >= 0) return openChallenge(ci, q ?? undefined);
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
    resetTask();
    if (i === CHALLENGE_MODE) {
      const next = CHALLENGES.findIndex((c) => records[c.id] === undefined);
      return openChallenge(next >= 0 ? next : 0);
    }
    setIdx(i);
    const q = i === PLAYGROUND ? "SELECT * FROM customers LIMIT 5;" : LESSONS[i].sql;
    setSql(q);
    run(q);
  };

  /** Runs the learner's query and each accepted solution, then compares the results. */
  const check = async () => {
    if (!solutions) return;
    setGrade("checking");
    let mine: QueryResult;
    try {
      mine = await runQuery(sql);
      setResult(mine);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGrade("error");
      setWrong((w) => w + 1);
      return;
    }
    let best: Grade | null = null;
    for (const sol of solutions) {
      const g = compare(mine, await runQuery(sol), sortsResult(sol));
      if (g.ok) {
        best = g;
        break;
      }
      best ??= g;
    }
    setGrade(best);
    if (!best?.ok) return setWrong((w) => w + 1);
    setParty(Date.now());
    if (lesson) {
      markDone("sql", lesson.id);
      if (!solved.includes(lesson.id)) {
        const next = [...solved, lesson.id];
        setSolved(next);
        writeJson(SOLVED_KEY, next);
      }
    }
    if (challenge) {
      const ms = Date.now() - chStart;
      setNow(Date.now());
      if (records[challenge.id] === undefined || ms < records[challenge.id]) {
        const next = { ...records, [challenge.id]: ms };
        setRecords(next);
        writeJson(CHALLENGE_KEY, next);
      }
    }
  };

  const share = async () => {
    const ctx = challenge ? `challenge=${challenge.id}&` : lesson ? `lesson=${lesson.id}&` : "";
    const url = `${location.origin}/sql?${ctx}q=${encodeQuery(sql)}`;
    const phone = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
    if (phone && navigator.share) {
      try {
        await navigator.share({ title: "Data Lab · SQL", text: lesson ? `Try my answer to “${t(lesson.title)}”` : challenge ? `Can you beat my SQL challenge? ${t(challenge.q)}` : "Try this SQL query", url });
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

  const steps = useMemo(() => (explainOpen ? explainSql(sql) : []), [explainOpen, sql]);

  const checkBox = solutions && (
    <div className="check-box">
      <div className="row">
        <button className="btn" onClick={check} disabled={grade === "checking"}>
          ✓ {t({ en: "Check my answer", bn: "আমার উত্তর যাচাই করুন" })}
        </button>
        {challenge && !solvedNow && (
          <button className="btn ghost" onClick={() => setShowHint(!showHint)}>
            🧭 {t({ en: "Hint", bn: "ইঙ্গিত" })}
          </button>
        )}
        {!solvedNow && (lesson ? wrong >= 1 : wrong >= 2) && (
          <button className="btn ghost" onClick={() => setShowSol(!showSol)}>
            💡 {showSol ? t({ en: "Hide solution", bn: "সমাধান লুকান" }) : t({ en: "Show solution", bn: "সমাধান দেখুন" })}
          </button>
        )}
      </div>
      {showHint && challenge && <p className="hint-msg">🧭 {t(challenge.hint)}</p>}
      {grade && grade !== "checking" && <Feedback grade={grade} challenge={!!challenge} />}
      {party > 0 && solvedNow && (
        <div className="confetti" key={party} aria-hidden>
          {Array.from({ length: 18 }, (_, k) => (
            <i key={k} style={{ ["--x" as string]: `${(k * 37) % 100}%`, ["--d" as string]: `${(k % 6) * 0.05}s`, ["--c" as string]: `var(--c${(k % 7) + 1})` }} />
          ))}
        </div>
      )}
      {showSol && (
        <div className="solution">
          <pre>{solutions[0]}</pre>
          <button
            className="btn ghost"
            onClick={() => {
              setSql(solutions[0]);
              run(solutions[0]);
            }}
          >
            {t({ en: "Put it in the editor", bn: "এডিটরে বসান" })}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHead
        title={{ en: "SQL", bn: "এসকিউএল" }}
        sub={{
          en: "SQL is a simple language for asking a database questions, like “who are my top 10 customers?”. Every lesson runs on a real database inside your browser. Change the query, press Run, and see what happens — you can't break anything.",
          bn: "SQL হলো ডেটাবেসকে প্রশ্ন করার একটা সহজ ভাষা, যেমন “আমার সেরা ১০ জন গ্রাহক কারা?”। প্রতিটা পাঠ আপনার ব্রাউজারের ভেতরেই একটা আসল ডেটাবেসে চলে। কোয়েরি বদলান, Run চাপুন, দেখুন কী হয় — কিছুই নষ্ট হবে না।",
        }}
        art="sql"
        track="sql"
      />
      <div className="sql-layout">
        <aside>
          <div className="solved-meter" title={t({ en: "Lessons solved with “Check my answer”", bn: "“আমার উত্তর যাচাই করুন” দিয়ে সমাধান করা পাঠ" })}>
            <span>
              🏆 {t({ en: "Solved", bn: "সমাধান" })} <b>{digits(String(solved.length))}</b> / {digits(String(CHECKABLE))}
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
                  <span className={`n${solved.includes(l.id) ? " solved" : done.includes(l.id) ? " seen" : ""}`}>{solved.includes(l.id) ? "✓" : digits(String(i + 1))}</span>
                  <span>{t(l.title)}</span>
                </button>
              </li>
            ))}
            <li style={{ marginTop: 8 }}>
              <div className="list-head">{t({ en: "Test yourself", bn: "নিজেকে যাচাই" })}</div>
              <button className={idx === CHALLENGE_MODE ? "on" : ""} onClick={() => open(CHALLENGE_MODE)}>
                <span className="n">🎯</span>
                <span>
                  {t({ en: "SQL challenges", bn: "SQL চ্যালেঞ্জ" })} <small className="muted">· {digits(String(score))} {t({ en: "pts", bn: "পয়েন্ট" })}</small>
                </span>
              </button>
            </li>
            <li>
              <button className={idx === PLAYGROUND ? "on" : ""} onClick={() => open(PLAYGROUND)}>
                <span className="n">✎</span>
                <span>{t({ en: "Free playground", bn: "ফ্রি প্লেগ্রাউন্ড" })}</span>
              </button>
            </li>
          </ul>
          <Schema />
        </aside>

        <section>
          {lesson && (
            <>
              <div className="row">
                <h2 style={{ margin: 0 }}>
                  {digits(String(idx + 1))}. {t(lesson.title)}
                </h2>
                <span className={`badge ${lesson.level === "beginner" ? "" : "mid"}`}>{t(LEVEL[lesson.level])}</span>
              </div>
              <p>{t(lesson.concept)}</p>
              <Plain text={lesson.analogy} />
              <Callout kind="idea" title={{ en: "Your turn", bn: "এবার আপনার পালা" }}>
                <p>{t(lesson.task)}</p>
                {checkBox}
              </Callout>
            </>
          )}

          {challenge && (
            <>
              <div className="row spread">
                <h2 style={{ margin: 0 }}>🎯 {t({ en: "SQL challenges", bn: "SQL চ্যালেঞ্জ" })}</h2>
                <span className="score-pill">
                  {t({ en: "Score", bn: "স্কোর" })} <b>{digits(String(score))}</b> / {digits(String(MAX_POINTS))}
                </span>
              </div>
              <p className="muted" style={{ marginTop: 6 }}>
                {t({
                  en: "Real questions, no instructions — just you, the data and SQL. Answers are checked the same forgiving way as the lessons. Beat your best time!",
                  bn: "আসল প্রশ্ন, কোনো নির্দেশনা নেই — শুধু আপনি, ডেটা আর SQL। পাঠের মতোই সহজভাবে উত্তর যাচাই হয়। নিজের সেরা সময় ভাঙুন!",
                })}
              </p>
              <div className="ch-list">
                {CHALLENGES.map((c, i) => (
                  <button key={c.id} className={`ch-chip ${c.level}${i === chIdx ? " on" : ""}${records[c.id] !== undefined ? " done" : ""}`} onClick={() => openChallenge(i)}>
                    {records[c.id] !== undefined ? "✓" : digits(String(i + 1))}
                  </button>
                ))}
              </div>
              <div className={`card ch-card ${challenge.level}`}>
                <div className="row spread">
                  <span className="row" style={{ gap: 6 }}>
                    <span className={`badge ch-${challenge.level}`}>{t(CH_LEVEL[challenge.level])}</span>
                    <span className="badge">+{digits(String(POINTS[challenge.level]))} {t({ en: "pts", bn: "পয়েন্ট" })}</span>
                    <span className="muted small">
                      {t({ en: "Tables:", bn: "টেবিল:" })} <code>{challenge.tables.join(", ")}</code>
                    </span>
                  </span>
                  <span className={`ch-timer${solvedNow ? " stopped" : ""}`}>
                    ⏱ {digits(clock((solvedNow ? Math.min(now, Date.now()) : now) - chStart))}
                    {records[challenge.id] !== undefined && (
                      <small>
                        {" "}
                        · {t({ en: "best", bn: "সেরা" })} {digits(clock(records[challenge.id]))}
                      </small>
                    )}
                  </span>
                </div>
                <p className="ch-q">{t(challenge.q)}</p>
                {checkBox}
                {solvedNow && chIdx < CHALLENGES.length - 1 && (
                  <button className="btn" style={{ marginTop: 10 }} onClick={() => openChallenge(chIdx + 1)}>
                    {t({ en: "Next challenge", bn: "পরের চ্যালেঞ্জ" })} →
                  </button>
                )}
              </div>
            </>
          )}

          {!lesson && !challenge && (
            <p className="muted">
              {t({
                en: "Write any SELECT query on any of the 8 tables (see the list on the left). If something goes wrong, press “Reset database”.",
                bn: "বাঁ পাশের তালিকার ৮টা টেবিলের যেকোনোটায় যেকোনো SELECT কোয়েরি লিখুন। কিছু গোলমাল হলে “ডেটাবেস রিসেট” চাপুন।",
              })}
            </p>
          )}

          <textarea
            className="code"
            value={sql}
            spellCheck={false}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey && solutions) check();
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
              <button className={`btn ghost${explainOpen ? " active" : ""}`} onClick={() => setExplainOpen(!explainOpen)} aria-expanded={explainOpen}>
                🧠 {t({ en: "Explain", bn: "ব্যাখ্যা" })}
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
            <span className="muted small">
              Ctrl + Enter {t({ en: "run", bn: "চালান" })}
              {solutions ? ` · Ctrl + Shift + Enter ${t({ en: "check", bn: "যাচাই" })}` : ""}
            </span>
          </div>

          {explainOpen && (
            <div className="explain card">
              <div className="row spread">
                <h3 style={{ margin: 0 }}>🧠 {t({ en: "What this query does, step by step", bn: "এই কোয়েরি ধাপে ধাপে কী করে" })}</h3>
                <span className="muted small">{t({ en: "in the order SQL runs it", bn: "SQL যে ক্রমে চালায়" })}</span>
              </div>
              {steps.length ? (
                <ol className="explain-steps">
                  {steps.map((s, i) => (
                    <li key={i}>
                      <span className="ex-ico">{s.icon}</span>
                      <div>
                        <b>{t(s.title)}</b>
                        <p>
                          <Codeish text={t(s.text)} />
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted">{t({ en: "Type a query to see its explanation.", bn: "ব্যাখ্যা দেখতে একটা কোয়েরি লিখুন।" })}</p>
              )}
            </div>
          )}

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
              <p className="muted small">{digits(t({ en: `${result.rows.length} rows · ${result.ms.toFixed(1)} ms`, bn: `${result.rows.length}টি সারি · ${result.ms.toFixed(1)} ms` }))}</p>
            </>
          )}

          {lesson && (
            <div className="row">
              {idx > 0 && (
                <button className="btn ghost" onClick={() => open(idx - 1)}>
                  ← {t({ en: "Previous", bn: "আগের" })}
                </button>
              )}
              {idx < LESSONS.length - 1 && (
                <button className="btn" onClick={() => open(idx + 1)}>
                  {t({ en: "Next lesson", bn: "পরের পাঠ" })} →
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      <Quiz id="sql" />
    </>
  );
}

/** Renders `backtick` segments as inline code. */
function Codeish({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : <span key={i}>{part}</span>))}
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
  const timeLike = r.rows.every((row) => /^\d{4}-\d{2}/.test(String(row[0])));
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

function Feedback({ grade, challenge }: { grade: Grade | "error"; challenge?: boolean }) {
  const { t } = useLang();
  if (grade === "error")
    return <p className="check-msg no">{t({ en: "❌ Your query has an error (see the red box below). Fix it, then check again.", bn: "❌ আপনার কোয়েরিতে ভুল আছে (নিচের লাল বক্স দেখুন)। ঠিক করে আবার যাচাই করুন।" })}</p>;
  if (grade.ok)
    return (
      <p className="check-msg ok">
        {challenge
          ? t({ en: "✅ Correct! Challenge solved — points added to your score.", bn: "✅ একদম ঠিক! চ্যালেঞ্জ সমাধান — স্কোরে পয়েন্ট যোগ হলো।" })
          : t({ en: "✅ Correct! Nicely done — this lesson is now marked as solved.", bn: "✅ একদম ঠিক! দারুণ — এই পাঠটি সমাধান হিসেবে চিহ্নিত হলো।" })}
      </p>
    );
  if (grade.reason === "rows")
    return (
      <p className="check-msg no">
        {digits(
          t({
            en: `🤔 Not yet. Your result has ${grade.got} rows, but the answer has ${grade.expected}. Check your WHERE, HAVING or LIMIT.`,
            bn: `🤔 এখনো হয়নি। আপনার ফলাফলে ${grade.got}টি সারি, কিন্তু উত্তরে আছে ${grade.expected}টি। WHERE, HAVING বা LIMIT আবার দেখুন।`,
          }),
        )}
      </p>
    );
  if (grade.reason === "order")
    return <p className="check-msg no">{t({ en: "🔀 Almost! The right rows, but in the wrong order. Check your ORDER BY (and ASC / DESC).", bn: "🔀 প্রায় হয়ে গেছে! সারিগুলো ঠিক, কিন্তু ক্রম ভুল। ORDER BY (আর ASC / DESC) দেখুন।" })}</p>;
  return (
    <p className="check-msg no">
      {digits(
        t({
          en: `🧐 Close! The right number of rows (${grade.expected}), but some values are different. Check your calculation or GROUP BY.`,
          bn: `🧐 কাছাকাছি! সারির সংখ্যা ঠিক (${grade.expected}), কিন্তু কিছু মান আলাদা। হিসাব বা GROUP BY আবার দেখুন।`,
        }),
      )}
    </p>
  );
}
