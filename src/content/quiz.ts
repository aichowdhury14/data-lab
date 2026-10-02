import type { T } from "../i18n";

export interface Question {
  q: T;
  options: T[];
  answer: number;
  why: T;
}

export const QUIZZES: Record<string, Question[]> = {
  analysis: [
    {
      q: { en: "Most people earn a little, a few earn a lot. Which number best describes a “typical” income?", bn: "বেশিরভাগ মানুষ অল্প আয় করে, কয়েকজন অনেক বেশি। “সাধারণ” আয় বোঝাতে কোন সংখ্যাটা সবচেয়ে ভালো?" },
      options: [{ en: "The mean (average)", bn: "গড় (mean)" }, { en: "The median (middle value)", bn: "মধ্যমা (median, মাঝের মান)" }, { en: "The maximum", bn: "সর্বোচ্চ মান" }],
      answer: 1,
      why: { en: "A few very rich people pull the average up. The median is the person exactly in the middle, so it isn't fooled.", bn: "কয়েকজন খুব ধনী মানুষ গড়কে টেনে ওপরে তোলে। মধ্যমা হলো ঠিক মাঝের মানুষটি, তাই সে বিভ্রান্ত হয় না।" },
    },
    {
      q: { en: "Ice-cream sales and drowning cases rise together in summer. So…", bn: "গরমকালে আইসক্রিম বিক্রি আর পানিতে ডোবার ঘটনা একসাথে বাড়ে। তাহলে…" },
      options: [{ en: "Ice-cream causes drowning", bn: "আইসক্রিম ডোবার কারণ" }, { en: "They are correlated, but hot weather drives both", bn: "এরা একসাথে বাড়ে, কিন্তু দুটোর পেছনেই গরম আবহাওয়া" }, { en: "It's just a coincidence", bn: "এটা নিছক কাকতালীয়" }],
      answer: 1,
      why: { en: "Correlation is not causation. A hidden third thing (summer) moves both.", bn: "কোরিলেশন মানেই কারণ নয়। লুকানো তৃতীয় একটা জিনিস (গরমকাল) দুটোকেই বাড়ায়।" },
    },
    {
      q: { en: "Which chart is best for showing sales over 12 months?", bn: "১২ মাসের বিক্রি দেখাতে কোন চার্ট সবচেয়ে ভালো?" },
      options: [{ en: "Line chart", bn: "লাইন চার্ট" }, { en: "Donut chart", bn: "ডোনাট চার্ট" }, { en: "Scatter plot", bn: "স্ক্যাটার প্লট" }],
      answer: 0,
      why: { en: "Lines are made for change over time. Donuts show parts of a whole; scatter shows relationships.", bn: "সময়ের সাথে পরিবর্তন দেখাতেই লাইন চার্ট। ডোনাট দেখায় সমগ্রের অংশ; স্ক্যাটার দেখায় সম্পর্ক।" },
    },
  ],
  sql: [
    {
      q: { en: "You want only customers from Dhaka. Which keyword do you use?", bn: "শুধু ঢাকার গ্রাহক চান। কোন শব্দটা লিখবেন?" },
      options: [{ en: "ORDER BY", bn: "ORDER BY" }, { en: "WHERE", bn: "WHERE" }, { en: "GROUP BY", bn: "GROUP BY" }],
      answer: 1,
      why: { en: "WHERE filters rows: WHERE city = 'Dhaka'.", bn: "WHERE সারি ছাঁকে: WHERE city = 'Dhaka'।" },
    },
    {
      q: { en: "“Average income per city” needs…", bn: "“প্রতিটা শহরের গড় আয়” বের করতে লাগবে…" },
      options: [{ en: "AVG + GROUP BY city", bn: "AVG + GROUP BY city" }, { en: "SUM + ORDER BY", bn: "SUM + ORDER BY" }, { en: "JOIN only", bn: "শুধু JOIN" }],
      answer: 0,
      why: { en: "GROUP BY makes one group per city, AVG works out each group's average.", bn: "GROUP BY প্রতিটা শহরের জন্য একটা দল বানায়, AVG প্রতিটা দলের গড় বের করে।" },
    },
    {
      q: { en: "You want every customer, including the ones with no loans. Which JOIN?", bn: "সব গ্রাহক চান, যাদের কোনো ঋণ নেই তারাও। কোন JOIN?" },
      options: [{ en: "JOIN (inner)", bn: "JOIN (ইনার)" }, { en: "LEFT JOIN", bn: "LEFT JOIN" }],
      answer: 1,
      why: { en: "LEFT JOIN keeps everyone from the first table, even without a match.", bn: "LEFT JOIN প্রথম টেবিলের সবাইকে রাখে, মিল না থাকলেও।" },
    },
  ],
  engineering: [
    {
      q: { en: "A row has amount = “BDT 1,200”. What must happen before you can add it up?", bn: "একটা সারিতে amount = “BDT 1,200”। যোগ করার আগে কী করতে হবে?" },
      options: [{ en: "Nothing", bn: "কিছুই না" }, { en: "Remove “BDT” and the comma, then turn it into a number", bn: "“BDT” আর কমা সরিয়ে সংখ্যায় বদলাতে হবে" }, { en: "Delete the row", bn: "সারিটা মুছে ফেলতে হবে" }],
      answer: 1,
      why: { en: "It's text right now. Cleaning turns it into the number 1200.", bn: "এটা এখন টেক্সট। পরিষ্কার করলে এটা ১২০০ সংখ্যা হয়ে যাবে।" },
    },
    {
      q: { en: "A bad row (negative amount) should be…", bn: "একটা খারাপ সারি (ঋণাত্মক পরিমাণ) নিয়ে কী করা উচিত?" },
      options: [{ en: "Silently deleted", bn: "চুপচাপ মুছে ফেলা" }, { en: "Moved to a “rejected” table with the reason", bn: "কারণসহ “rejected” টেবিলে রাখা" }, { en: "Kept as it is", bn: "যেমন আছে তেমন রাখা" }],
      answer: 1,
      why: { en: "Quarantine keeps a record so someone can fix the source system.", bn: "আলাদা করে রাখলে রেকর্ড থাকে, পরে কেউ উৎসটা ঠিক করতে পারে।" },
    },
    {
      q: { en: "Running the same pipeline twice should give…", bn: "একই পাইপলাইন দুবার চালালে কী হওয়া উচিত?" },
      options: [{ en: "Double the data", bn: "দ্বিগুণ ডেটা" }, { en: "The same result as running it once", bn: "একবার চালানোর মতো একই ফল" }],
      answer: 1,
      why: { en: "That's called idempotency. A retry must never count money twice.", bn: "একে বলে আইডেম্পটেন্সি। আবার চালালে টাকা যেন দুবার গোনা না হয়।" },
    },
    {
      q: { en: "A bank wants to stop a fraud payment within seconds. It needs…", bn: "একটা ব্যাংক কয়েক সেকেন্ডের মধ্যে জালিয়াতির পেমেন্ট আটকাতে চায়। তার দরকার…" },
      options: [{ en: "A nightly batch job", bn: "রাতের ব্যাচ জব" }, { en: "A streaming pipeline", bn: "স্ট্রিমিং পাইপলাইন" }, { en: "A bigger Excel file", bn: "আরও বড় এক্সেল ফাইল" }],
      answer: 1,
      why: { en: "Streaming checks each event the moment it arrives. A batch job would find the fraud hours later.", bn: "স্ট্রিমিং প্রতিটা ইভেন্ট আসামাত্রই পরীক্ষা করে। ব্যাচ জব জালিয়াতি ধরত কয়েক ঘণ্টা পরে।" },
    },
    {
      q: { en: "In a star schema, the table with the numbers (quantity, revenue) is the…", bn: "স্টার স্কিমায় যে টেবিলে সংখ্যাগুলো থাকে (পরিমাণ, আয়), সেটা হলো…" },
      options: [{ en: "Dimension table", bn: "ডাইমেনশন টেবিল" }, { en: "Fact table", bn: "ফ্যাক্ট টেবিল" }],
      answer: 1,
      why: { en: "Facts are the measurable events. Dimensions describe them (who, what, when).", bn: "ফ্যাক্ট হলো মাপা যায় এমন ঘটনা। ডাইমেনশন সেগুলোর বর্ণনা দেয় (কে, কী, কখন)।" },
    },
  ],
  ml: [
    {
      q: { en: "Predicting a house price (a number) is…", bn: "বাড়ির দাম (একটা সংখ্যা) অনুমান করা হলো…" },
      options: [{ en: "Regression", bn: "রিগ্রেশন" }, { en: "Classification", bn: "ক্লাসিফিকেশন" }, { en: "Clustering", bn: "ক্লাস্টারিং" }],
      answer: 0,
      why: { en: "Regression predicts numbers. Classification predicts categories (yes/no). Clustering finds groups.", bn: "রিগ্রেশন সংখ্যা অনুমান করে। ক্লাসিফিকেশন ক্যাটাগরি (হ্যাঁ/না)। ক্লাস্টারিং দল খোঁজে।" },
    },
    {
      q: { en: "A model gets 100% on training data but 60% on new data. This is…", bn: "মডেল ট্রেনিং ডেটায় ১০০% কিন্তু নতুন ডেটায় ৬০% পায়। এটা হলো…" },
      options: [{ en: "A great model", bn: "দারুণ মডেল" }, { en: "Overfitting (it memorised instead of learning)", bn: "ওভারফিটিং (শেখার বদলে মুখস্থ করেছে)" }],
      answer: 1,
      why: { en: "Like a student who memorised last year's answers. Always test on data the model has never seen.", bn: "গত বছরের প্রশ্নের উত্তর মুখস্থ করা ছাত্রের মতো। সবসময় অদেখা ডেটায় পরীক্ষা করুন।" },
    },
    {
      q: { en: "In RFM, a customer with R=5, F=5, M=5 is…", bn: "RFM-এ যে গ্রাহকের R=5, F=5, M=5, তিনি…" },
      options: [{ en: "A Champion", bn: "চ্যাম্পিয়ন" }, { en: "Lost", bn: "হারিয়ে যাওয়া" }, { en: "New", bn: "নতুন" }],
      answer: 0,
      why: { en: "Bought recently, buys often, spends a lot — your best customer.", bn: "সম্প্রতি কিনেছেন, ঘন ঘন কেনেন, অনেক খরচ করেন — আপনার সেরা গ্রাহক।" },
    },
  ],
  llm: [
    {
      q: { en: "At its core, an LLM…", bn: "মূলে একটা এলএলএম…" },
      options: [{ en: "Looks up answers in a database", bn: "ডেটাবেসে উত্তর খোঁজে" }, { en: "Predicts the next token, again and again", bn: "বারবার পরের টোকেন অনুমান করে" }, { en: "Searches Google", bn: "গুগলে সার্চ করে" }],
      answer: 1,
      why: { en: "Everything — chatting, coding, translating — comes from repeated next-token prediction.", bn: "চ্যাট, কোডিং, অনুবাদ — সবই আসে বারবার পরের টোকেন অনুমান থেকে।" },
    },
    {
      q: { en: "You want answers based on your company's own policy documents. Use…", bn: "কোম্পানির নিজস্ব নীতিমালা থেকে উত্তর চান। কী ব্যবহার করবেন?" },
      options: [{ en: "RAG", bn: "RAG" }, { en: "Higher temperature", bn: "বেশি টেম্পারেচার" }, { en: "More tokens", bn: "বেশি টোকেন" }],
      answer: 0,
      why: { en: "RAG finds the right passages and gives them to the model, so it answers from facts.", bn: "RAG সঠিক অংশগুলো খুঁজে মডেলকে দেয়, তাই সে তথ্য দেখে উত্তর দেয়।" },
    },
    {
      q: { en: "For a bank chatbot that must be consistent, temperature should be…", bn: "যে ব্যাংক চ্যাটবটকে সবসময় একই রকম উত্তর দিতে হবে, তার টেম্পারেচার হওয়া উচিত…" },
      options: [{ en: "Low", bn: "কম" }, { en: "High", bn: "বেশি" }],
      answer: 0,
      why: { en: "Low temperature = safe, predictable answers. High = creative but risky.", bn: "কম টেম্পারেচার = নিরাপদ, অনুমানযোগ্য উত্তর। বেশি = সৃজনশীল কিন্তু ঝুঁকিপূর্ণ।" },
    },
  ],
};
