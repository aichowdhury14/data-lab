# Data Lab Â· à¦¡à§‡à¦Ÿà¦¾ à¦²à§à¦¯à¦¾à¦¬

🌐 **Live site: https://data-lab-ai.vercel.app**

**Learn data & AI by playing with it.** An interactive, bilingual (English / à¦¬à¦¾à¦‚à¦²à¦¾) learning site for data analysis, SQL, data engineering, machine learning and large language models â€” beginner to intermediate.

Everything runs in the browser on 8 simulated, Bangladesh-flavoured datasets. There is no backend, no sign-up, and nothing is uploaded. Every concept comes with a plain-language explanation, an everyday analogy (ðŸ’¡ *Think of it like this*) and a short quiz.

## What's inside

| Section | What the learner does |
|---|---|
| **ðŸ“Š Data Analysis** | Profile a dataset, histograms, group comparisons with bar + box plots, correlation heatmap, trends and donut charts. Download any dataset as CSV, or **upload your own CSV**. |
| **ðŸ—„ï¸ SQL** | 18 lessons on a real SQLite engine (WebAssembly): 7 beginner, 7 intermediate, 4 practice on the newer datasets. Results switch between table and chart. Free playground. |
| **ðŸ—ï¸ Data Engineering** | 4 labs: **ETL pipeline** (clean a messy file step by step with quality checks), **star schema** (fact + dimension tables, storage saved, a real business query), **streaming** (live payments, 3-second windows, instant fraud alerts vs a nightly batch), **orchestration** (Airflow-style DAG with parallel tasks, retries, failures, Gantt chart and logs). |
| **ðŸ¤– Machine Learning** | 8 models written from scratch: linear regression (4 datasets, animated gradient descent), logistic regression (ROC, confusion matrix, threshold), decision tree, k-NN, k-means, **RFM customer segmentation**, a neural-network playground and time-series forecasting. |
| **âœ¨ AI & LLM** | How an LLM works, tokenizer (English vs Bangla cost), embeddings map + word arithmetic, attention, next-word sampling (temperature / top-k / top-p), RAG, an **AI agent** that answers questions by writing and running SQL, and prompting tips. |
| **ðŸ“– Glossary** | 37 terms in one or two plain sentences, searchable in both languages. |

Also: animated sun/moon theme switch with a circular reveal, sliding EN / à¦¬à¦¾à¦‚à¦²à¦¾ switch (both remembered, applied before the first paint â€” no flash), cross-fading page transitions, per-browser progress tracking, quizzes, a 404 page, an error safety net, keyboard skip-link and focus styles, and motion that respects â€œreduce motionâ€.

### Datasets (all simulated)
`customers` Â· `transactions` Â· `loans` Â· `stock_prices` Â· `shop_orders` (with Eid sales spikes) Â· `employees` (attrition) Â· `dhaka_air` (daily AQI 2024) Â· `students` (study hours vs score) â€” 6,752 rows in total, generated from a fixed seed so everyone sees the same numbers.

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
- â€œOnline nowâ€ uses Supabase Realtime presence (one entry per browser, updates within seconds).
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
npm test           # 68 checks: every SQL lesson, pipeline, datasets, every ML model, RFM, LLM engine, agent, CSV
```

## Deploy on Vercel

It is a static Vite site; [vercel.json](vercel.json) is already configured (SPA rewrite so deep links work, long-term caching for assets). No environment variables are needed.

**Option A â€“ CLI**
```bash
npm i -g vercel
vercel login
vercel --prod
```

**Option B â€“ Git**: push this folder to GitHub â†’ vercel.com/new â†’ import the repo. Vercel auto-detects Vite (build `npm run build`, output `dist`).

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
  styles.css â†’ styles-v2.css â†’ styles-theme.css   base â†’ components â†’ data theme
```

## Adding content

- **SQL lesson**: append to `LESSONS` in `src/data/lessons.ts` (include an `analogy`); `npm test` checks it returns rows.
- **Dataset**: generate rows in `src/data/generate.ts`, add to `DATASETS`, add its DDL to `src/data/schema.ts`. It appears in Analysis, SQL and the home page automatically.
- **Analogy / quiz / glossary term**: edit the files in `src/content/`.
- **Language**: widen `Lang` / `T` in `src/i18n.tsx`; TypeScript then points to every missing translation.

## Author

Built by **Atiqul Islam Chowdhury** â€” AI & ML Engineer Â· Senior Data Scientist Â· [aichowdhury14.github.io](https://aichowdhury14.github.io/)

## Roadmap

- â€œCheck my answerâ€ SQL challenges that compare result sets, shareable query links.
- Python in the browser (Pyodide) for pandas lessons.
- A tiny real transformer you can train in the browser; random forest / gradient boosting.
- Certificates / badges per track.
