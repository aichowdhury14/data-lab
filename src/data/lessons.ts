import type { T } from "../i18n";

export interface Lesson {
  id: string;
  level: "beginner" | "intermediate" | "practice";
  title: T;
  concept: T;
  /** An everyday comparison that makes the idea click. */
  analogy: T;
  sql: string;
  task: T;
  /** Expected answer(s) for the task; any one matching counts as correct. */
  solutions?: string[];
}

export const LESSONS: Lesson[] = [
  {
    id: "select",
    level: "beginner",
    title: { en: "SELECT & FROM", bn: "SELECT ও FROM" },
    concept: {
      en: "SELECT says which columns you want to see. FROM says which table to look in. LIMIT 10 means “just show me the first 10 rows”.",
      bn: "SELECT বলে কোন কোন কলাম দেখতে চান। FROM বলে কোন টেবিল থেকে। LIMIT 10 মানে “শুধু প্রথম ১০টা সারি দেখাও”।",
    },
    analogy: {
      en: "A table is like an Excel sheet. SELECT picks the columns, FROM picks the sheet.",
      bn: "টেবিল হলো একটা এক্সেল শিটের মতো। SELECT কলাম বাছে, FROM বাছে কোন শিট।",
    },
    sql: "SELECT name, city, monthly_income\nFROM customers\nLIMIT 10;",
    task: {
      en: "Add age and credit_score to the list. Then try SELECT * — the star means “every column”.",
      bn: "তালিকায় age আর credit_score যোগ করুন। তারপর SELECT * লিখে দেখুন — তারকা (*) মানে “সব কলাম”।",
    },
    solutions: ["SELECT age, credit_score FROM customers LIMIT 10;"],
  },
  {
    id: "where",
    level: "beginner",
    title: { en: "WHERE: keep only some rows", bn: "WHERE: শুধু দরকারি সারি" },
    concept: {
      en: "WHERE is a filter. Only rows that match your condition stay. Join two conditions with AND (both must be true) or OR (either one is enough).",
      bn: "WHERE হলো ছাঁকনি। শুধু যে সারিগুলো আপনার শর্ত মানে, সেগুলোই থাকে। দুটো শর্ত AND (দুটোই সত্য হতে হবে) বা OR (যেকোনো একটা হলেই চলবে) দিয়ে জোড়া যায়।",
    },
    analogy: {
      en: "Like the filter button in Excel or Daraz: “show only Dhaka, only score above 700”.",
      bn: "এক্সেল বা দারাজের ফিল্টার বাটনের মতো: “শুধু ঢাকা, শুধু ৭০০-র বেশি স্কোর দেখাও”।",
    },
    sql: "SELECT name, city, credit_score\nFROM customers\nWHERE city = 'Dhaka' AND credit_score > 700;",
    task: {
      en: "Find customers from Sylhet or Khulna who are 30 to 40 years old. Hint: city IN ('Sylhet','Khulna') AND age BETWEEN 30 AND 40.",
      bn: "সিলেট বা খুলনার ৩০ থেকে ৪০ বছর বয়সী গ্রাহক খুঁজুন। ইঙ্গিত: city IN ('Sylhet','Khulna') AND age BETWEEN 30 AND 40।",
    },
    solutions: ["SELECT name FROM customers WHERE city IN ('Sylhet','Khulna') AND age BETWEEN 30 AND 40;"],
  },
  {
    id: "order",
    level: "beginner",
    title: { en: "ORDER BY: sort the list", bn: "ORDER BY: সাজানো" },
    concept: {
      en: "ORDER BY sorts the result. Small to big is the default. Add DESC to go big to small. With LIMIT you get a “top 10” list.",
      bn: "ORDER BY ফলাফল সাজায়। ডিফল্টে ছোট থেকে বড়। বড় থেকে ছোট চাইলে DESC লিখুন। সাথে LIMIT দিলে পেয়ে যাবেন “সেরা ১০” তালিকা।",
    },
    analogy: {
      en: "Like sorting a class result sheet from highest marks to lowest.",
      bn: "ক্লাসের রেজাল্ট শিট সবচেয়ে বেশি নম্বর থেকে কম নম্বরে সাজানোর মতো।",
    },
    sql: "SELECT name, city, monthly_income\nFROM customers\nORDER BY monthly_income DESC\nLIMIT 10;",
    task: {
      en: "Who are the 5 youngest customers? If two have the same age, show the higher credit score first (ORDER BY age, credit_score DESC).",
      bn: "সবচেয়ে কম বয়সী ৫ জন কে? দুজনের বয়স এক হলে যার ক্রেডিট স্কোর বেশি সে আগে (ORDER BY age, credit_score DESC)।",
    },
    solutions: ["SELECT name FROM customers ORDER BY age, credit_score DESC LIMIT 5;"],
  },
  {
    id: "aggregate",
    level: "beginner",
    title: { en: "Count, sum, average", bn: "গোনা, যোগ, গড়" },
    concept: {
      en: "These functions turn many rows into one number: COUNT (how many), SUM (total), AVG (average), MIN (smallest), MAX (largest). AS gives the answer a nice name.",
      bn: "এই ফাংশনগুলো অনেক সারিকে একটা সংখ্যায় নিয়ে আসে: COUNT (কয়টা), SUM (মোট), AVG (গড়), MIN (সবচেয়ে ছোট), MAX (সবচেয়ে বড়)। AS দিয়ে উত্তরের একটা সুন্দর নাম দেওয়া যায়।",
    },
    analogy: {
      en: "Like the summary at the bottom of a bank statement: total spent, number of transactions.",
      bn: "ব্যাংক স্টেটমেন্টের নিচের সারাংশের মতো: মোট খরচ, কতগুলো লেনদেন।",
    },
    sql: "SELECT COUNT(*) AS customers,\n       ROUND(AVG(monthly_income)) AS avg_income,\n       MIN(credit_score) AS min_score,\n       MAX(credit_score) AS max_score\nFROM customers;",
    task: {
      en: "What is the total amount of all transactions? How many different payment channels are there? (COUNT(DISTINCT channel))",
      bn: "সব লেনদেনের মোট পরিমাণ কত? কয়টা আলাদা পেমেন্ট মাধ্যম আছে? (COUNT(DISTINCT channel))",
    },
    solutions: ["SELECT SUM(amount), COUNT(DISTINCT channel) FROM transactions;"],
  },
  {
    id: "groupby",
    level: "beginner",
    title: { en: "GROUP BY: totals per group", bn: "GROUP BY: দলভিত্তিক হিসাব" },
    concept: {
      en: "GROUP BY puts rows into groups (for example, one group per city) and then counts or averages each group separately.",
      bn: "GROUP BY সারিগুলোকে দলে ভাগ করে (যেমন প্রতিটা শহরের জন্য একটা দল), তারপর প্রতিটা দলের আলাদা আলাদা গোনা বা গড় করে।",
    },
    analogy: {
      en: "Like sorting receipts into piles — one pile per city — and adding up each pile.",
      bn: "রসিদগুলো শহর অনুযায়ী আলাদা আলাদা স্তূপে রেখে প্রতিটা স্তূপের যোগফল বের করার মতো।",
    },
    sql: "SELECT city,\n       COUNT(*) AS customers,\n       ROUND(AVG(monthly_income)) AS avg_income\nFROM customers\nGROUP BY city\nORDER BY avg_income DESC;",
    task: {
      en: "Group transactions by channel and show the total amount for each. Which channel moves the most money?",
      bn: "লেনদেনগুলো channel অনুযায়ী ভাগ করে প্রতিটার মোট টাকা দেখান। কোন মাধ্যমে সবচেয়ে বেশি টাকা যায়?",
    },
    solutions: ["SELECT channel, SUM(amount) FROM transactions GROUP BY channel;"],
  },
  {
    id: "having",
    level: "beginner",
    title: { en: "HAVING: filter the groups", bn: "HAVING: দল ছাঁকা" },
    concept: {
      en: "WHERE filters rows before grouping. HAVING filters the groups after counting. So “only groups with more than 50 rows” needs HAVING.",
      bn: "WHERE দল বানানোর আগে সারি ছাঁকে। HAVING গোনার পরে দল ছাঁকে। তাই “শুধু যেসব দলে ৫০টার বেশি সারি” — এর জন্য HAVING লাগবে।",
    },
    analogy: {
      en: "WHERE throws away some receipts. HAVING throws away some whole piles.",
      bn: "WHERE কিছু রসিদ ফেলে দেয়। HAVING পুরো কিছু স্তূপই বাদ দেয়।",
    },
    sql: "SELECT category, COUNT(*) AS n, SUM(amount) AS total\nFROM transactions\nWHERE channel = 'bKash'          -- row filter\nGROUP BY category\nHAVING COUNT(*) > 50             -- group filter\nORDER BY total DESC;",
    task: {
      en: "Change the channel to 'Card' and the HAVING number to 80. What changed?",
      bn: "channel বদলে 'Card' করুন আর HAVING-এর সংখ্যা ৮০ করুন। কী বদলাল?",
    },
    solutions: ["SELECT category, COUNT(*) FROM transactions WHERE channel = 'Card' GROUP BY category HAVING COUNT(*) > 80;"],
  },
  {
    id: "case",
    level: "beginner",
    title: { en: "CASE WHEN: make labels", bn: "CASE WHEN: লেবেল বানানো" },
    concept: {
      en: "CASE WHEN is SQL's “if … then …”. It turns numbers into labels like Excellent / Good / Fair / Poor. Then you can group by the label.",
      bn: "CASE WHEN হলো SQL-এর “যদি … তাহলে …”। এটা সংখ্যাকে লেবেলে বদলে দেয়, যেমন Excellent / Good / Fair / Poor। তারপর সেই লেবেল দিয়ে দল বানানো যায়।",
    },
    analogy: {
      en: "Exactly like turning exam marks into grades: 80+ is A+, 70+ is A, and so on.",
      bn: "ঠিক যেমন পরীক্ষার নম্বর থেকে গ্রেড বানানো হয়: ৮০+ হলে A+, ৭০+ হলে A, এভাবে।",
    },
    sql: "SELECT CASE WHEN credit_score >= 750 THEN 'Excellent'\n            WHEN credit_score >= 650 THEN 'Good'\n            WHEN credit_score >= 550 THEN 'Fair'\n            ELSE 'Poor' END AS band,\n       COUNT(*) AS customers\nFROM customers\nGROUP BY band\nORDER BY MIN(credit_score) DESC;",
    task: {
      en: "Make age groups: under 30, 30–44, and 45+. How many customers are in each?",
      bn: "বয়সের দল বানান: ৩০-এর কম, ৩০–৪৪, আর ৪৫+। প্রতিটায় কতজন গ্রাহক?",
    },
    solutions: ["SELECT COUNT(*) FROM customers GROUP BY CASE WHEN age < 30 THEN 1 WHEN age < 45 THEN 2 ELSE 3 END;"],
  },
  {
    id: "join",
    level: "intermediate",
    title: { en: "JOIN: connect two tables", bn: "JOIN: দুটো টেবিল জোড়া" },
    concept: {
      en: "Names live in the customers table and spending lives in the transactions table. JOIN connects them using the ID they share (customer_id = id). The short letters t and c are nicknames for the tables.",
      bn: "নাম আছে customers টেবিলে, আর খরচ আছে transactions টেবিলে। দুটোতেই যে আইডি আছে (customer_id = id), JOIN সেটা দিয়ে জোড়া লাগায়। t আর c হলো টেবিলের ডাকনাম।",
    },
    analogy: {
      en: "Like matching a receipt to a customer using their phone number.",
      bn: "ফোন নম্বর মিলিয়ে কোন রসিদ কোন গ্রাহকের, সেটা বের করার মতো।",
    },
    sql: "SELECT c.name, c.city, t.txn_date, t.category, t.amount\nFROM transactions t\nJOIN customers c ON c.id = t.customer_id\nWHERE t.amount > 10000\nORDER BY t.amount DESC\nLIMIT 15;",
    task: {
      en: "Find total spending per city: JOIN the tables, then GROUP BY c.city with SUM(t.amount).",
      bn: "শহরভিত্তিক মোট খরচ বের করুন: টেবিল JOIN করুন, তারপর c.city দিয়ে GROUP BY আর SUM(t.amount)।",
    },
    solutions: ["SELECT c.city, SUM(t.amount) FROM transactions t JOIN customers c ON c.id = t.customer_id GROUP BY c.city;"],
  },
  {
    id: "leftjoin",
    level: "intermediate",
    title: { en: "LEFT JOIN: who has none?", bn: "LEFT JOIN: কার কিছুই নেই?" },
    concept: {
      en: "A normal JOIN drops anyone without a match. LEFT JOIN keeps everyone from the first table, even with no match — the missing side becomes NULL (empty).",
      bn: "সাধারণ JOIN যার মিল নেই তাকে বাদ দেয়। LEFT JOIN প্রথম টেবিলের সবাইকে রাখে, মিল না থাকলেও — যেদিকে কিছু নেই সেটা NULL (খালি) হয়ে যায়।",
    },
    analogy: {
      en: "A class attendance list: every student stays on the list, even the ones who never came.",
      bn: "ক্লাসের হাজিরা খাতা: যে কোনোদিন আসেনি, তার নামও খাতায় থাকে।",
    },
    sql: "SELECT c.id, c.name, c.credit_score, COUNT(l.id) AS loans\nFROM customers c\nLEFT JOIN loans l ON l.customer_id = c.id\nGROUP BY c.id\nHAVING loans = 0\nORDER BY c.credit_score DESC\nLIMIT 20;",
    task: {
      en: "These are good customers with no loan yet — a perfect list for the marketing team! Now change HAVING to find people with 3 or more loans.",
      bn: "এরা ভালো গ্রাহক কিন্তু এখনো ঋণ নেননি — মার্কেটিং টিমের জন্য দারুণ তালিকা! এবার HAVING বদলে ৩ বা তার বেশি ঋণ আছে এমন মানুষ খুঁজুন।",
    },
    solutions: ["SELECT c.id FROM customers c LEFT JOIN loans l ON l.customer_id = c.id GROUP BY c.id HAVING COUNT(l.id) >= 3;"],
  },
  {
    id: "subquery",
    level: "intermediate",
    title: { en: "A query inside a query", bn: "কোয়েরির ভেতরে কোয়েরি" },
    concept: {
      en: "The query in brackets runs first and gives one answer (the average income). The outer query then uses that answer as its filter.",
      bn: "ব্র্যাকেটের ভেতরের কোয়েরিটা আগে চলে আর একটা উত্তর দেয় (গড় আয়)। তারপর বাইরের কোয়েরি সেই উত্তর দিয়ে ছাঁকে।",
    },
    analogy: {
      en: "“Who earns more than average?” — first you work out the average, then you compare.",
      bn: "“কে গড়ের চেয়ে বেশি আয় করে?” — আগে গড় বের করেন, তারপর তুলনা করেন।",
    },
    sql: "SELECT name, monthly_income\nFROM customers\nWHERE monthly_income > (SELECT AVG(monthly_income) FROM customers)\nORDER BY monthly_income DESC\nLIMIT 10;",
    task: {
      en: "Find the loans that are bigger than the average loan. How many are there?",
      bn: "গড় ঋণের চেয়ে বড় ঋণগুলো খুঁজুন। কয়টা আছে?",
    },
    solutions: ["SELECT COUNT(*) FROM loans WHERE amount > (SELECT AVG(amount) FROM loans);","SELECT id FROM loans WHERE amount > (SELECT AVG(amount) FROM loans);"],
  },
  {
    id: "cte",
    level: "intermediate",
    title: { en: "WITH: step-by-step queries", bn: "WITH: ধাপে ধাপে কোয়েরি" },
    concept: {
      en: "WITH lets you name a middle step, so a long query reads top to bottom like a recipe. strftime('%Y-%m', date) pulls out the year and month, like 2024-03.",
      bn: "WITH দিয়ে মাঝের একটা ধাপের নাম দেওয়া যায়, ফলে লম্বা কোয়েরি রান্নার রেসিপির মতো ওপর থেকে নিচে পড়া যায়। strftime('%Y-%m', date) তারিখ থেকে বছর আর মাস বের করে, যেমন 2024-03।",
    },
    analogy: {
      en: "Step 1: make the dough. Step 2: use the dough to make roti. Each step has a name.",
      bn: "ধাপ ১: আটা মাখুন। ধাপ ২: সেই আটা দিয়ে রুটি বানান। প্রতিটা ধাপের একটা নাম আছে।",
    },
    sql: "WITH monthly AS (\n  SELECT strftime('%Y-%m', txn_date) AS month,\n         category,\n         SUM(amount) AS total\n  FROM transactions\n  GROUP BY month, category\n)\nSELECT month,\n       SUM(total) AS all_spend,\n       MAX(total) AS biggest_category\nFROM monthly\nGROUP BY month\nORDER BY month;",
    task: {
      en: "Add a second step that counts transactions per month, then JOIN the two steps together.",
      bn: "আরেকটা ধাপ যোগ করুন যেটা প্রতি মাসের লেনদেন গোনে, তারপর দুটো ধাপ JOIN করুন।",
    },
    solutions: ["SELECT strftime('%Y-%m', txn_date) AS month, COUNT(*) FROM transactions GROUP BY month ORDER BY month;"],
  },
  {
    id: "window-rank",
    level: "intermediate",
    title: { en: "RANK: top 3 in each city", bn: "RANK: প্রতি শহরে সেরা ৩" },
    concept: {
      en: "Window functions do maths across related rows but keep every row. PARTITION BY city means “rank separately inside each city”.",
      bn: "উইন্ডো ফাংশন সম্পর্কিত সারিগুলো নিয়ে হিসাব করে, কিন্তু কোনো সারি হারায় না। PARTITION BY city মানে “প্রতিটা শহরের ভেতরে আলাদা করে র‍্যাঙ্ক করো”।",
    },
    analogy: {
      en: "Like giving 1st, 2nd and 3rd place in every school separately, not one ranking for the whole country.",
      bn: "পুরো দেশের জন্য একটা মেধাতালিকা না করে প্রতিটা স্কুলে আলাদা করে ১ম, ২য়, ৩য় দেওয়ার মতো।",
    },
    sql: "SELECT * FROM (\n  SELECT city, name, monthly_income,\n         RANK() OVER (PARTITION BY city ORDER BY monthly_income DESC) AS rank_in_city\n  FROM customers\n)\nWHERE rank_in_city <= 3\nORDER BY city, rank_in_city;",
    task: {
      en: "Rank by credit_score instead. Then try ROW_NUMBER() and DENSE_RANK() — what do they do when two people tie?",
      bn: "এবার credit_score দিয়ে র‍্যাঙ্ক করুন। তারপর ROW_NUMBER() আর DENSE_RANK() চেষ্টা করুন — দুজন সমান হলে এরা কী করে?",
    },
    solutions: ["SELECT name FROM (SELECT name, RANK() OVER (PARTITION BY city ORDER BY credit_score DESC) AS r FROM customers) WHERE r <= 3;"],
  },
  {
    id: "window-ma",
    level: "intermediate",
    title: { en: "Moving average & LAG", bn: "মুভিং অ্যাভারেজ ও LAG" },
    concept: {
      en: "A moving average takes the average of the last 5 days, so a bumpy price line becomes smooth. LAG() looks at yesterday's row, so you can see the daily change.",
      bn: "মুভিং অ্যাভারেজ শেষ ৫ দিনের গড় নেয়, ফলে এবড়োখেবড়ো দামের রেখা মসৃণ হয়ে যায়। LAG() গতকালের সারিটা দেখে, তাই প্রতিদিনের পরিবর্তন বোঝা যায়।",
    },
    analogy: {
      en: "Instead of judging a batsman by one innings, you look at his average over the last 5 matches.",
      bn: "একজন ব্যাটসম্যানকে এক ইনিংস দেখে বিচার না করে শেষ ৫ ম্যাচের গড় দেখার মতো।",
    },
    sql: "SELECT trade_date, close,\n       ROUND(AVG(close) OVER (ORDER BY trade_date\n             ROWS BETWEEN 4 PRECEDING AND CURRENT ROW), 2) AS ma5,\n       ROUND(close - LAG(close) OVER (ORDER BY trade_date), 2) AS daily_change\nFROM stock_prices\nWHERE ticker = 'GP'\nORDER BY trade_date\nLIMIT 20;",
    task: {
      en: "Switch to ticker 'BRACBANK' and use a 10-day window. Bonus: add a running total of volume.",
      bn: "ticker বদলে 'BRACBANK' করুন আর ১০ দিনের উইন্ডো নিন। বোনাস: volume-এর চলমান যোগফল যোগ করুন।",
    },
    solutions: ["SELECT trade_date, ROUND(AVG(close) OVER (ORDER BY trade_date ROWS BETWEEN 9 PRECEDING AND CURRENT ROW), 2) FROM stock_prices WHERE ticker = 'BRACBANK' ORDER BY trade_date LIMIT 20;"],
  },
  {
    id: "capstone",
    level: "intermediate",
    title: { en: "Project: loan risk", bn: "প্রজেক্ট: ঋণের ঝুঁকি" },
    concept: {
      en: "Now we use everything together: JOIN loans to customers, label credit scores with CASE, and find the default rate for each label. Tip: the average of a 0/1 column is the percentage of 1s.",
      bn: "এবার সব একসাথে: loans-কে customers-এর সাথে JOIN, CASE দিয়ে ক্রেডিট স্কোরের লেবেল, তারপর প্রতিটা লেবেলের খেলাপির হার। টিপস: ০/১ কলামের গড় মানেই ১-এর শতকরা হার।",
    },
    analogy: {
      en: "This is the kind of report a real bank risk team makes every month.",
      bn: "সত্যিকারের ব্যাংকের রিস্ক টিম প্রতি মাসে ঠিক এরকম রিপোর্ট বানায়।",
    },
    sql: "WITH scored AS (\n  SELECT l.amount, l.defaulted,\n         CASE WHEN c.credit_score >= 750 THEN '1 Excellent'\n              WHEN c.credit_score >= 650 THEN '2 Good'\n              WHEN c.credit_score >= 550 THEN '3 Fair'\n              ELSE '4 Poor' END AS band\n  FROM loans l\n  JOIN customers c ON c.id = l.customer_id\n)\nSELECT band,\n       COUNT(*) AS loans,\n       ROUND(100.0 * AVG(defaulted), 1) AS default_pct,\n       SUM(CASE WHEN defaulted = 1 THEN amount ELSE 0 END) AS defaulted_amount\nFROM scored\nGROUP BY band\nORDER BY band;",
    task: {
      en: "Does the default rate go up as the credit score goes down? The Machine Learning page teaches a computer this exact pattern.",
      bn: "ক্রেডিট স্কোর কমলে কি খেলাপির হার বাড়ে? মেশিন লার্নিং পাতায় কম্পিউটারকে ঠিক এই প্যাটার্নটাই শেখানো হয়।",
    },
  },
  // ---- practice with the newer datasets ----
  {
    id: "eid-sales",
    level: "practice",
    title: { en: "Practice: Eid shopping rush", bn: "অনুশীলন: ঈদের কেনাকাটা" },
    concept: {
      en: "The online shop's revenue = quantity × unit_price. Group it by month and see what happens before each Eid.",
      bn: "অনলাইন শপের আয় = quantity × unit_price। মাস অনুযায়ী ভাগ করে দেখুন প্রতি ঈদের আগে কী হয়।",
    },
    analogy: {
      en: "Every shopkeeper in Bangladesh knows this pattern — now you can prove it with data.",
      bn: "বাংলাদেশের প্রত্যেক দোকানদার এই প্যাটার্ন জানেন — এবার ডেটা দিয়ে প্রমাণ করুন।",
    },
    sql: "SELECT strftime('%Y-%m', order_date) AS month,\n       COUNT(*) AS orders,\n       SUM(quantity * unit_price) AS revenue\nFROM shop_orders\nGROUP BY month\nORDER BY month;",
    task: {
      en: "Switch to the 📈 Chart view. Then show only Fashion sales per month (add WHERE category = 'Fashion') — watch the Eid peaks get even sharper.",
      bn: "📈 চার্ট ভিউতে যান। তারপর শুধু ফ্যাশনের মাসভিত্তিক বিক্রি দেখান (WHERE category = 'Fashion' যোগ করুন) — দেখুন ঈদের চূড়াগুলো আরও তীক্ষ্ণ হয়।",
    },
    solutions: ["SELECT strftime('%Y-%m', order_date) AS month, SUM(quantity * unit_price) FROM shop_orders WHERE category = 'Fashion' GROUP BY month ORDER BY month;"],
  },
  {
    id: "attrition",
    level: "practice",
    title: { en: "Practice: who quits?", bn: "অনুশীলন: কারা চাকরি ছাড়ে?" },
    concept: {
      en: "left_company is 1 if the person quit. AVG(left_company) per group gives you the quit rate of that group.",
      bn: "কেউ চাকরি ছাড়লে left_company হয় ১। প্রতিটা দলের AVG(left_company) মানেই সেই দলের চাকরি ছাড়ার হার।",
    },
    analogy: {
      en: "HR teams use exactly this to decide where to improve work life first.",
      bn: "কোথায় আগে কাজের পরিবেশ ভালো করতে হবে, সেটা ঠিক করতে HR টিম ঠিক এভাবেই হিসাব করে।",
    },
    sql: "SELECT satisfaction,\n       COUNT(*) AS employees,\n       ROUND(100.0 * AVG(left_company), 1) AS quit_pct,\n       ROUND(AVG(overtime_hours)) AS avg_overtime\nFROM employees\nGROUP BY satisfaction\nORDER BY satisfaction;",
    task: {
      en: "Now group by department instead. Which department loses the most people? Does remote work help?",
      bn: "এবার department দিয়ে দল বানান। কোন বিভাগ থেকে সবচেয়ে বেশি মানুষ চলে যায়? রিমোট কাজ কি সাহায্য করে?",
    },
    solutions: ["SELECT department FROM employees GROUP BY department ORDER BY AVG(left_company) DESC;"],
  },
  {
    id: "air",
    level: "practice",
    title: { en: "Practice: Dhaka's air", bn: "অনুশীলন: ঢাকার বাতাস" },
    concept: {
      en: "AQI above 150 is unhealthy for everyone. Count the unhealthy days in each month with SUM(CASE WHEN …).",
      bn: "AQI ১৫০-এর বেশি মানে সবার জন্যই অস্বাস্থ্যকর। প্রতি মাসে কত দিন অস্বাস্থ্যকর ছিল, SUM(CASE WHEN …) দিয়ে গুনুন।",
    },
    analogy: {
      en: "A weather report, but for the air you breathe.",
      bn: "আবহাওয়ার খবরের মতো, তবে আপনি যে বাতাসে শ্বাস নেন তার জন্য।",
    },
    sql: "SELECT month,\n       ROUND(AVG(aqi)) AS avg_aqi,\n       SUM(CASE WHEN aqi > 150 THEN 1 ELSE 0 END) AS unhealthy_days,\n       ROUND(SUM(rainfall_mm)) AS total_rain_mm\nFROM dhaka_air\nGROUP BY month\nORDER BY MIN(date);",
    task: {
      en: "Look at avg_aqi next to total_rain_mm. What does rain do to the air? Try the Chart view.",
      bn: "avg_aqi-এর পাশে total_rain_mm দেখুন। বৃষ্টি বাতাসের কী করে? চার্ট ভিউ দেখুন।",
    },
  },
  {
    id: "study",
    level: "practice",
    title: { en: "Practice: does studying pay?", bn: "অনুশীলন: পড়াশোনার ফল কি মেলে?" },
    concept: {
      en: "Put students into groups by study hours, then compare their average score and pass rate.",
      bn: "শিক্ষার্থীদের পড়ার ঘণ্টা অনুযায়ী দলে ভাগ করুন, তারপর তাদের গড় নম্বর আর পাসের হার তুলনা করুন।",
    },
    analogy: {
      en: "The answer your parents always gave — now with numbers.",
      bn: "বাবা-মা সবসময় যা বলেন — এবার সংখ্যা দিয়ে।",
    },
    sql: "SELECT CASE WHEN study_hours_week < 5 THEN '1: under 5 h'\n            WHEN study_hours_week < 10 THEN '2: 5-9 h'\n            WHEN study_hours_week < 15 THEN '3: 10-14 h'\n            ELSE '4: 15+ h' END AS study_band,\n       COUNT(*) AS students,\n       ROUND(AVG(final_score), 1) AS avg_score,\n       ROUND(100.0 * AVG(passed)) AS pass_pct\nFROM students\nGROUP BY study_band\nORDER BY study_band;",
    task: {
      en: "Do the same with attendance_pct (e.g. under 60%, 60–80%, 80%+). Which matters more?",
      bn: "attendance_pct দিয়েও একই কাজ করুন (যেমন ৬০%-এর কম, ৬০–৮০%, ৮০%+)। কোনটা বেশি গুরুত্বপূর্ণ?",
    },
    solutions: ["SELECT COUNT(*) FROM students GROUP BY CASE WHEN attendance_pct < 60 THEN 1 WHEN attendance_pct < 80 THEN 2 ELSE 3 END;"],
  },
];
