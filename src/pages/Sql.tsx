import { useCallback, useEffect, useState } from "react";
import { useLang, type T } from "../i18n";
import { LESSONS, type Lesson } from "../data/lessons";
import { SCHEMA } from "../data/schema";
import { resetDb, runQuery, type QueryResult } from "../data/db";
import { Callout, DataTable, PageHead, Plain, Tabs } from "../components/ui";
import { Quiz } from "../components/Quiz";
import { Bars, XY } from "../components/charts";
import { useMark, useProgress } from "../progress";

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
  const done = useProgress().sql ?? [];
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

  useEffect(() => {
    run(LESSONS[0].sql);
  }, [run]);

  const open = (i: number) => {
    setIdx(i);
    const q = i === PLAYGROUND ? "SELECT * FROM customers LIMIT 5;" : LESSONS[i].sql;
    setSql(q);
    run(q);
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
          <ul className="lesson-list">
            {LESSONS.map((l, i) => (
              <li key={l.id}>
                {(i === 0 || LESSONS[i - 1].level !== l.level) && <div className="list-head">{t(LEVEL[l.level])}</div>}
                <button className={idx === i ? "on" : ""} onClick={() => open(i)}>
                  <span className="n">{done.includes(l.id) ? "✓" : i + 1}</span>
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

          <textarea
            className="code"
            value={sql}
            spellCheck={false}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run(sql);
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
            </div>
            <span className="muted small">Ctrl + Enter</span>
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

          {lesson && (
            <Callout kind="idea" title={{ en: "Your turn", bn: "এবার আপনার পালা" }}>
              <p>{t(lesson.task)}</p>
            </Callout>
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
