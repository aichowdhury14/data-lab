import type { T } from "../i18n";

// "Think of it like this" — one everyday comparison per concept.
// Rule of thumb for writing these: short sentences, no jargon, something from daily life in Bangladesh.
export const PLAIN: Record<string, T> = {
  "analysis-profile": {
    en: "Before cooking, you check what's in the fridge. Profiling is the same: before any analysis, see what columns you have, what's missing, and what looks strange.",
    bn: "রান্নার আগে আপনি দেখে নেন ফ্রিজে কী আছে। প্রোফাইলিংও তাই: বিশ্লেষণের আগে দেখে নিন কী কী কলাম আছে, কী নেই, আর কী অদ্ভুত লাগছে।",
  },
  "analysis-distribution": {
    en: "A histogram is like lining up everyone in a class by height. You instantly see if most people are short, tall or in the middle.",
    bn: "হিস্টোগ্রাম হলো ক্লাসের সবাইকে উচ্চতা অনুযায়ী দাঁড় করানোর মতো। এক নজরেই বোঝা যায় বেশিরভাগ খাটো, লম্বা, নাকি মাঝামাঝি।",
  },
  "analysis-compare": {
    en: "Comparing groups is like comparing the average marks of Section A and Section B. But always check how many students are in each section first!",
    bn: "দল তুলনা করা মানে সেকশন A আর সেকশন B-এর গড় নম্বর তুলনা করার মতো। তবে আগে দেখে নিন প্রতিটা সেকশনে কতজন ছাত্র!",
  },
  "analysis-relate": {
    en: "Correlation asks: when one thing goes up, does the other also go up? Like ice-cream sales and hot weather. It doesn't prove one causes the other.",
    bn: "কোরিলেশন জিজ্ঞাসা করে: একটা বাড়লে কি অন্যটাও বাড়ে? যেমন গরম পড়লে আইসক্রিম বিক্রি বাড়ে। তবে এটা প্রমাণ করে না যে একটা অন্যটার কারণ।",
  },
  "analysis-trends": {
    en: "A trend line is like the story of a year told in one picture: when things went up, when they went down, and when something special happened (like Eid).",
    bn: "ট্রেন্ড লাইন হলো এক ছবিতে একটা বছরের গল্প: কখন বেড়েছে, কখন কমেছে, আর কখন বিশেষ কিছু ঘটেছে (যেমন ঈদ)।",
  },
  "eng-pipeline": {
    en: "A data pipeline is like a water filter. Dirty water (messy data) goes in at the top, passes through several filters, and clean drinking water (trusted data) comes out at the bottom.",
    bn: "ডেটা পাইপলাইন হলো পানির ফিল্টারের মতো। ওপরে ময়লা পানি (এলোমেলো ডেটা) ঢোকে, কয়েকটা ছাঁকনি পার হয়, আর নিচে বের হয় খাওয়ার উপযোগী পরিষ্কার পানি (বিশ্বাসযোগ্য ডেটা)।",
  },
  "eng-star": {
    en: "A shopkeeper doesn't write a customer's full address on every receipt. She writes a customer number, and keeps one address book. A star schema does the same: small “address books” (dimensions) plus one big receipt book of numbers (the fact table).",
    bn: "একজন দোকানদার প্রতিটা রসিদে গ্রাহকের পুরো ঠিকানা লেখেন না। তিনি একটা গ্রাহক নম্বর লেখেন, আর আলাদা একটা ঠিকানার খাতা রাখেন। স্টার স্কিমাও তাই করে: কয়েকটা ছোট “ঠিকানার খাতা” (ডাইমেনশন), আর সংখ্যার একটা বড় রসিদ খাতা (ফ্যাক্ট টেবিল)।",
  },
  "eng-stream": {
    en: "Batch is like checking your letterbox once a day. Streaming is like a phone notification — you know the moment something happens. Great for fraud alerts, but it costs more to run.",
    bn: "ব্যাচ হলো দিনে একবার চিঠির বাক্স দেখার মতো। স্ট্রিমিং হলো ফোনের নোটিফিকেশনের মতো — কিছু ঘটামাত্রই জানতে পারেন। জালিয়াতি ধরতে দারুণ, তবে চালাতে খরচ বেশি।",
  },
  "eng-dag": {
    en: "Like cooking biryani: you must soak the rice and marinate the meat before you can layer them — but soaking and marinating can happen at the same time. An orchestrator knows these rules and runs every step in the right order, every night, without anyone pressing a button.",
    bn: "বিরিয়ানি রান্নার মতো: স্তর সাজানোর আগে চাল ভেজাতে হবে আর মাংস মাখাতে হবে — কিন্তু ভেজানো আর মাখানো একসাথে করা যায়। অর্কেস্ট্রেটর এই নিয়মগুলো জানে, আর প্রতি রাতে কেউ বাটন না চাপলেও প্রতিটা ধাপ সঠিক ক্রমে চালায়।",
  },
  linear: {
    en: "You see that people who earn more usually spend more. Linear regression draws the best straight line through those dots, so you can guess anyone's spending from their income.",
    bn: "আপনি দেখলেন যারা বেশি আয় করে তারা সাধারণত বেশি খরচও করে। লিনিয়ার রিগ্রেশন বিন্দুগুলোর মাঝ দিয়ে সবচেয়ে ভালো একটা সোজা দাগ টানে, যাতে আয় দেখে যে কারো খরচ আন্দাজ করা যায়।",
  },
  logistic: {
    en: "A loan officer looks at a few things — credit score, loan size, interest — and says “risky” or “safe”. Logistic regression does the same, but gives a percentage, like “35% chance of not paying back”.",
    bn: "একজন লোন অফিসার কয়েকটা জিনিস দেখেন — ক্রেডিট স্কোর, ঋণের পরিমাণ, সুদ — তারপর বলেন “ঝুঁকিপূর্ণ” বা “নিরাপদ”। লজিস্টিক রিগ্রেশনও তাই করে, তবে শতাংশে বলে, যেমন “ঋণ ফেরত না দেওয়ার সম্ভাবনা ৩৫%”।",
  },
  tree: {
    en: "A decision tree is a game of “20 questions”. Is the credit score below 600? Yes → Is the loan big? … Each answer takes you down a branch until you reach a final answer.",
    bn: "ডিসিশন ট্রি হলো “২০ প্রশ্ন” খেলার মতো। ক্রেডিট স্কোর কি ৬০০-র কম? হ্যাঁ → ঋণ কি বড়? … প্রতিটা উত্তরে একটা ডাল ধরে নামতে নামতে শেষ উত্তরে পৌঁছানো যায়।",
  },
  knn: {
    en: "“Tell me who your friends are, and I'll tell you who you are.” k-NN finds the most similar past customers and copies what happened to most of them.",
    bn: "“সঙ্গ দেখে মানুষ চেনা যায়।” k-NN সবচেয়ে মিল থাকা পুরোনো গ্রাহকদের খুঁজে বের করে, আর তাদের বেশিরভাগের যা হয়েছিল সেটাই অনুমান করে।",
  },
  kmeans: {
    en: "Imagine sorting a pile of mixed fruit into baskets without knowing their names — you just put similar-looking ones together. K-means does this with customers.",
    bn: "ধরুন মিশ্র ফলের একটা স্তূপ নাম না জেনেই ঝুড়িতে ভাগ করছেন — দেখতে একরকম ফলগুলো একসাথে রাখছেন। K-means গ্রাহকদের নিয়ে ঠিক এই কাজটা করে।",
  },
  nn: {
    en: "One neuron can only draw a straight line. Many neurons working together can draw any shape — like many short sticks can form a circle.",
    bn: "একটা নিউরন শুধু একটা সোজা দাগ টানতে পারে। অনেকগুলো নিউরন একসাথে যেকোনো আকৃতি আঁকতে পারে — যেমন অনেকগুলো ছোট কাঠি দিয়ে একটা বৃত্ত বানানো যায়।",
  },
  forecast: {
    en: "Forecasting is like a weather forecast, but for numbers: look at the past pattern and guess what comes next. The further ahead, the less sure you can be.",
    bn: "ফোরকাস্টিং হলো সংখ্যার আবহাওয়ার পূর্বাভাস: অতীতের প্যাটার্ন দেখে সামনে কী আসছে আন্দাজ করা। যত দূরের ভবিষ্যৎ, তত কম নিশ্চিত।",
  },
  rfm: {
    en: "A shopkeeper knows: the customer who came yesterday, comes every week, and spends a lot is gold. RFM turns that gut feeling into three simple scores for every customer.",
    bn: "একজন দোকানদার জানেন: যে গ্রাহক গতকাল এসেছেন, প্রতি সপ্তাহে আসেন, আর অনেক টাকার কেনাকাটা করেন — তিনি সোনার মতো দামি। RFM এই অনুভূতিটাকে প্রতিটা গ্রাহকের জন্য তিনটা সহজ স্কোরে রূপ দেয়।",
  },
  "llm-overview": {
    en: "Your phone keyboard suggests the next word as you type. An LLM is that same idea, trained on a huge library of text — so good that it can write whole answers.",
    bn: "টাইপ করার সময় ফোনের কিবোর্ড পরের শব্দ সাজেস্ট করে। এলএলএম সেই একই ধারণা, তবে বিশাল এক লাইব্রেরির লেখা পড়ে শেখা — এত ভালো যে পুরো উত্তরই লিখে দিতে পারে।",
  },
  tokens: {
    en: "Computers can't read words, so text is cut into small pieces called tokens — like breaking a long word into syllables. Common words stay whole; rare words get cut into pieces.",
    bn: "কম্পিউটার শব্দ পড়তে পারে না, তাই লেখাকে ছোট ছোট টুকরোয় ভাগ করা হয়, যাদের বলে টোকেন — যেমন লম্বা শব্দকে বানান করে ভাঙা। চেনা শব্দ পুরো থাকে; অচেনা শব্দ টুকরো হয়ে যায়।",
  },
  embed: {
    en: "Think of a map where words live. Words with similar meanings live in the same neighbourhood: “loan”, “debt” and “ঋণ” are neighbours; “rice” lives far away.",
    bn: "ভাবুন একটা মানচিত্র, যেখানে শব্দেরা থাকে। কাছাকাছি অর্থের শব্দেরা একই পাড়ায় থাকে: “loan”, “debt” আর “ঋণ” প্রতিবেশী; “ভাত” থাকে অনেক দূরে।",
  },
  attention: {
    en: "When you read “the bank gave a loan”, your brain links “loan” back to “bank”. Attention is how the model decides which earlier words to look at for each word.",
    bn: "“ব্যাংক ঋণ দিল” পড়ার সময় আপনার মাথা “ঋণ”-কে “ব্যাংক”-এর সাথে যুক্ত করে। অ্যাটেনশন দিয়ে মডেল ঠিক করে প্রতিটা শব্দের জন্য আগের কোন শব্দগুলোর দিকে তাকাতে হবে।",
  },
  generate: {
    en: "The model doesn't plan a whole sentence. It picks one word, then the next, then the next — like a game of “continue the story”. Temperature controls how bold its choices are.",
    bn: "মডেল পুরো বাক্য আগে থেকে ভেবে রাখে না। একটা শব্দ বাছে, তারপর পরেরটা, তারপর পরেরটা — যেন “গল্পটা চালিয়ে যাও” খেলা। টেম্পারেচার ঠিক করে বাছাইগুলো কতটা সাহসী হবে।",
  },
  rag: {
    en: "An open-book exam. Instead of answering from memory (and maybe guessing wrong), the model first finds the right page in your documents, then answers from it.",
    bn: "খোলা বইয়ের পরীক্ষার মতো। মুখস্থ থেকে উত্তর না দিয়ে (আর হয়তো ভুল আন্দাজ না করে), মডেল আগে আপনার ডকুমেন্টে সঠিক পাতা খুঁজে নেয়, তারপর সেখান থেকে উত্তর দেয়।",
  },
  agent: {
    en: "A chatbot only talks. An agent can also use tools — like an assistant who can open Excel, run a query, read the result, and then tell you the answer.",
    bn: "চ্যাটবট শুধু কথা বলে। এজেন্ট টুলও ব্যবহার করতে পারে — যেন একজন সহকারী যিনি এক্সেল খুলতে পারেন, কোয়েরি চালাতে পারেন, ফলাফল পড়তে পারেন, তারপর আপনাকে উত্তর বলেন।",
  },
  prompt: {
    en: "Talking to an LLM is like briefing a new intern. The clearer your instructions and examples, the better the work you get back.",
    bn: "এলএলএমের সাথে কথা বলা মানে নতুন একজন ইন্টার্নকে কাজ বুঝিয়ে দেওয়া। নির্দেশনা আর উদাহরণ যত পরিষ্কার, কাজও তত ভালো পাবেন।",
  },
};
