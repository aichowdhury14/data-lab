# Data Lab · ডেটা ল্যাব

🌐 **Live site: https://data-lab-ai.vercel.app**

**Learn data & AI by playing with it.** An interactive, bilingual (English / বাংলা) learning site for data analysis, SQL, data engineering, machine learning and large language models — beginner to intermediate.

Everything runs in the browser on 8 simulated, Bangladesh-flavoured datasets. There is no backend, no sign-up, and nothing is uploaded. Every concept comes with a plain-language explanation, an everyday analogy (💡 *Think of it like this*) and a short quiz.

## What's inside

| Section | What the learner does |
|---|---|
| **📊 Data Analysis** | Profile a dataset, histograms, group comparisons with bar + box plots, correlation heatmap, trends and donut charts. Download any dataset as CSV, or **upload your own CSV**. |
| **🗄️ SQL** | 18 lessons on a real SQLite engine (WebAssembly) with **✓ Check my answer** (16 lessons, forgiving grading, hints, solutions, solved tracker), **🧠 Explain** (plain-language, step-by-step breakdown of any query, rule-based), **🎯 SQL challenges** (9 timed puzzles, points, best times), **🔗 shareable links** that reopen the same lesson or challenge, results as table or chart. |
| **🏗️ Data Engineering** | 4 labs: **ETL pipeline** (clean a messy file step by step with quality checks), **star schema** (fact + dimension tables, storage saved, a real business query), **streaming** (live payments, 3-second windows, instant fraud alerts vs a nightly batch), **orchestration** (Airflow-style DAG with parallel tasks, retries, failures, Gantt chart and logs). |
| **🤖 Machine Learning** | 11 models written from scratch: linear & logistic regression, decision tree, **random forest**, **gradient boosting** (with a model leaderboard), k-NN, k-means, RFM segmentation, a **“bought this, also bought” recommender**, a neural-network playground and forecasting. Missions check your slider settings (best depth, best k, the bank's recall rule). |
| **✨ AI & LLM** | How an LLM works, tokenizer, embeddings, attention, next-word sampling, **train a tiny GPT live in your browser** (from-scratch transformer + autograd, in a Web Worker, on Bangla text), RAG, an AI agent (text-to-SQL) and prompting. |
| **📖 Glossary** | Every term in one or two plain sentences, searchable in both languages, plus a **flashcards** mode to test yourself. |
| **🎓 Certificates** | Finish a track to unlock a certificate with your name (drawn in the browser): download PNG, print / save PDF, or **Add to LinkedIn profile**. Every section shows your certificate progress, and a pop-up congratulates you the moment one unlocks. |
| **🎯 Today's SQL challenge** | A new challenge on the home page every day. |

Also: **“Find it in the data”** questions in Analysis, **Bangla digits (১২৩)** option in Bangla mode, per-page HTML + sitemap for **search engines**, **GitHub Actions CI** (tests + build on every push), animated sun/moon theme switch with a circular reveal, sliding EN / বাংলা switch (both remembered, applied before the first paint — no flash), cross-fading page transitions, per-browser progress tracking, quizzes, a 404 page, an error safety net, keyboard skip-link and focus styles, and motion that respects “reduce motion”.

### Datasets (all simulated)
`customers` · `transactions` · `loans` · `stock_prices` · `shop_orders` (with Eid sales spikes) · `employees` (attrition) · `dhaka_air` (daily AQI 2024) · `students` (study hours vs score) — 6,752 rows in total, generated from a fixed seed so everyone sees the same numbers.

## Performance

- Instant loading shell; fonts never block the first paint (~0.3 s first paint).
- Pages download on demand and start loading when you hover a menu item.
- Theme / language switches re-render only what changes; heavy charts are memoised and drawn in idle time.
- k-NN uses top-k selection instead of full sorts; the tokenizer trains lazily.
- Background is a fixed, composited layer, so scrolling stays at 60 fps.

## Live view counter

The home page and footer show a live badge: **total views** and **people online now**.

- Visits are stored in Supabase (project `bd-invest-hub`, private schema `datalab`, table `datalab.visits`). The site can only call two functions: `datalab_record_visit` and `datalab_stats`.
- One visit = one browser session; reloads within 30 minutes count once. Visits from `localhost` are never counted.
- “Online now” uses Supabase Realtime presence (one entry per browser, updates within seconds).
- The Supabase client loads only after the page is idle, so it never slows the first paint.

See your numbers any time in the Supabase SQL editor:

```sql
select public.datalab_stats();                                   -- views, unique visitors, today
select date_trunc('day', created_at) as day, count(*) as visits
from datalab.visits group by 1 order by 1 desc;                    -- visits per day
select path, lang, count(*) from datalab.visits group by 1, 2 order by 3 desc;  -- landing page + language
```

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm test           # 140 checks: every SQL lesson, pipeline, datasets, every ML model, RFM, LLM engine, agent, CSV
```

## Deploy on Vercel

It is a static Vite site; [vercel.json](vercel.json) is already configured (SPA rewrite so deep links work, long-term caching for assets). No environment variables are needed.

**Option A – CLI**
```bash
npm i -g vercel
vercel login
vercel --prod
```

**Option B – Git**: push this folder to GitHub → vercel.com/new → import the repo. Vercel auto-detects Vite (build `npm run build`, output `dist`).

## Code map

```
src/
  App.tsx              shell: nav, theme, routes, titles, 404, error boundary, footer
  i18n.tsx             language context (every string is { en, bn })
  progress.ts          localStorage progress tracking
  content/             plain-language analogies, quizzes, glossary
  data/generate.ts     seeded generator for all 8 datasets
  data/db.ts, schema.ts   in-browser SQLite (sql.js)
  data/lessons.ts      SQL lessons
  data/pipeline.ts     ETL steps + quality checks
  data/csv.ts          CSV download / upload
  ml/core.ts, extra.ts regression, logistic, tree, k-means, k-NN, neural net, ROC, forecasting, PCA
  llm/engine.ts        tokenizer, embeddings, attention, n-gram LM, TF-IDF RAG
  components/          SVG charts, UI kit, quiz, hero SQL console + data ticker, illustrations
  pages/               Home, Analysis, Sql, Engineering (+EngMore), ML (+MLMore, MLRfm), LLM (+LLMAgent), Glossary
  styles.css → styles-v2.css → styles-theme.css   base → components → data theme
```

## Adding content

- **SQL lesson**: append to `LESSONS` in `src/data/lessons.ts` (include an `analogy`); `npm test` checks it returns rows.
- **Dataset**: generate rows in `src/data/generate.ts`, add to `DATASETS`, add its DDL to `src/data/schema.ts`. It appears in Analysis, SQL and the home page automatically.
- **Analogy / quiz / glossary term**: edit the files in `src/content/`.
- **Language**: widen `Lang` / `T` in `src/i18n.tsx`; TypeScript then points to every missing translation.

## Author

Built by **Atiqul Islam Chowdhury** — AI & ML Engineer · Senior Data Scientist · [aichowdhury14.github.io](https://aichowdhury14.github.io/)

## Roadmap

- Python in the browser (Pyodide) for pandas lessons.
- More daily challenges and a weekly streak.
