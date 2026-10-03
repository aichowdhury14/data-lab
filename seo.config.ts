// Per-page metadata used at build time to write a real HTML file for every route
// (title, description, social tags, readable intro text) plus sitemap.xml and robots.txt.
export const SITE_URL = "https://data-lab-ai.vercel.app";

export interface RouteMeta {
  path: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
}

export const ROUTES: RouteMeta[] = [
  {
    path: "/",
    title: "Data Lab · ডেটা ল্যাব — learn data & AI by playing with it",
    description: "Free, interactive, bilingual (English & বাংলা) labs for data analysis, SQL, data engineering, machine learning and LLMs — on real-looking Bangladeshi data, right in your browser.",
    heading: "Learn data & AI by playing with it · ডেটা ও এআই শিখুন খেলতে খেলতে",
    intro: "Interactive labs for Data Analysis, SQL, Data Engineering, Machine Learning and AI & LLMs, in English and Bangla. No sign-up, nothing to install.",
  },
  {
    path: "/analysis",
    title: "Data Analysis — Data Lab",
    description: "Learn data analysis hands-on: profile datasets, histograms, box plots, group comparisons, correlation heatmaps and trends — or upload your own CSV. English & বাংলা.",
    heading: "Data Analysis · ডেটা অ্যানালাইসিস",
    intro: "Look at data carefully to answer a question: what's in it, how it is spread, how groups differ, what moves together, and what changed over time.",
  },
  {
    path: "/sql",
    title: "Learn SQL interactively — Data Lab",
    description: "18 hands-on SQL lessons on a real database in your browser, with answer checking, plain-language query explanations, timed SQL challenges and shareable query links. English & বাংলা.",
    heading: "SQL · এসকিউএল",
    intro: "SQL is a simple language for asking a database questions. Practise SELECT, WHERE, GROUP BY, JOIN, CTEs and window functions on real-looking data.",
  },
  {
    path: "/engineering",
    title: "Data Engineering labs — Data Lab",
    description: "Learn data engineering by doing: clean a messy file with an ETL pipeline, design a star schema, process live streaming data and orchestrate an Airflow-style DAG.",
    heading: "Data Engineering · ডেটা ইঞ্জিনিয়ারিং",
    intro: "Data engineers build the pipes that clean data, organise it and deliver it on time. Four interactive labs: ETL, star schema, streaming and orchestration.",
  },
  {
    path: "/ml",
    title: "Machine Learning, explained interactively — Data Lab",
    description: "11 machine learning models you can play with: linear and logistic regression, decision trees, random forests, gradient boosting, k-NN, k-means, RFM segmentation, a recommender, a neural network and forecasting.",
    heading: "Machine Learning · মেশিন লার্নিং",
    intro: "Teach a computer from examples and watch it learn — every model is written from scratch with visual, step-by-step explanations.",
  },
  {
    path: "/llm",
    title: "How LLMs like ChatGPT work — Data Lab",
    description: "See inside large language models: tokenizers, embeddings, attention, next-word sampling, RAG and AI agents — and train your own tiny GPT on Bangla text, live in your browser.",
    heading: "AI & Large Language Models · এআই ও এলএলএম",
    intro: "ChatGPT, Claude and Gemini all guess the next word, very well. Each lab rebuilds one small part of that machine so you can see how it works.",
  },
  {
    path: "/glossary",
    title: "Data & AI glossary in plain words — Data Lab",
    description: "Every data, SQL, engineering, machine learning and AI term explained in one or two plain sentences, in English and বাংলা.",
    heading: "Glossary · শব্দকোষ",
    intro: "Stuck on a word? Every technical term used on Data Lab, explained simply.",
  },
  {
    path: "/certificate",
    title: "Free certificates — Data Lab",
    description: "Finish a Data Lab track and get a free certificate with your name — download it, print it, or add it to your LinkedIn profile.",
    heading: "Certificates · সনদ",
    intro: "Complete a track to unlock a certificate with your name, made right in your browser.",
  },
];
