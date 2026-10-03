import type { T } from "../i18n";

export interface Challenge {
  id: string;
  level: "easy" | "medium" | "hard";
  tables: string[];
  q: T;
  hint: T;
  /** Accepted answers; graded with the same forgiving checker as the lessons. */
  solutions: string[];
}

export const POINTS = { easy: 10, medium: 20, hard: 30 } as const;

export const CHALLENGES: Challenge[] = [
  {
    id: "ctg-count",
    level: "easy",
    tables: ["customers"],
    q: { en: "How many customers live in Chattogram?", bn: "চট্টগ্রামে কতজন গ্রাহক থাকেন?" },
    hint: { en: "COUNT(*) with a WHERE on city.", bn: "city-র ওপর WHERE দিয়ে COUNT(*)।" },
    solutions: ["SELECT COUNT(*) FROM customers WHERE city = 'Chattogram';"],
  },
  {
    id: "top-payment",
    level: "easy",
    tables: ["shop_orders"],
    q: { en: "Which payment method is used for the most online-shop orders? (one row)", bn: "অনলাইন শপের সবচেয়ে বেশি অর্ডারে কোন পেমেন্ট মাধ্যম ব্যবহার হয়েছে? (একটা সারি)" },
    hint: { en: "GROUP BY payment, ORDER BY COUNT(*) DESC, LIMIT 1.", bn: "payment দিয়ে GROUP BY, COUNT(*) DESC দিয়ে ORDER BY, তারপর LIMIT 1।" },
    solutions: ["SELECT payment FROM shop_orders GROUP BY payment ORDER BY COUNT(*) DESC LIMIT 1;"],
  },
  {
    id: "worst-air-day",
    level: "easy",
    tables: ["dhaka_air"],
    q: { en: "On which date in 2024 was Dhaka's air the worst (highest AQI)? (one row)", bn: "২০২৪ সালের কোন তারিখে ঢাকার বাতাস সবচেয়ে খারাপ ছিল (সবচেয়ে বেশি AQI)? (একটা সারি)" },
    hint: { en: "Sort by aqi from high to low and keep 1 row.", bn: "aqi বড় থেকে ছোট সাজিয়ে ১টা সারি রাখুন।" },
    solutions: ["SELECT date FROM dhaka_air ORDER BY aqi DESC LIMIT 1;"],
  },
  {
    id: "dhaka-bkash",
    level: "medium",
    tables: ["transactions", "customers"],
    q: { en: "Which Dhaka customer spent the most money through bKash? Show their name (one row).", bn: "ঢাকার কোন গ্রাহক বিকাশে সবচেয়ে বেশি টাকা খরচ করেছেন? নাম দেখান (একটা সারি)।" },
    hint: { en: "JOIN transactions to customers, filter city and channel, GROUP BY the customer, sort by SUM(amount).", bn: "transactions-কে customers-এর সাথে JOIN করুন, city আর channel দিয়ে ছাঁকুন, গ্রাহক দিয়ে GROUP BY, তারপর SUM(amount) দিয়ে সাজান।" },
    solutions: ["SELECT c.name FROM transactions t JOIN customers c ON c.id = t.customer_id WHERE c.city = 'Dhaka' AND t.channel = 'bKash' GROUP BY c.id ORDER BY SUM(t.amount) DESC LIMIT 1;"],
  },
  {
    id: "salary-rank",
    level: "medium",
    tables: ["employees"],
    q: { en: "List every department with its average monthly salary, highest first.", bn: "প্রতিটা বিভাগ আর তার গড় মাসিক বেতন দেখান, সবচেয়ে বেশি আগে।" },
    hint: { en: "AVG(monthly_salary) with GROUP BY department, then ORDER BY … DESC.", bn: "department দিয়ে GROUP BY করে AVG(monthly_salary), তারপর ORDER BY … DESC।" },
    solutions: ["SELECT department, AVG(monthly_salary) FROM employees GROUP BY department ORDER BY AVG(monthly_salary) DESC;"],
  },
  {
    id: "pass-by-group",
    level: "medium",
    tables: ["students"],
    q: { en: "How many students passed in each study group (Science, Commerce, Arts)?", bn: "প্রতিটা বিভাগে (বিজ্ঞান, বাণিজ্য, মানবিক) কতজন শিক্ষার্থী পাস করেছে?" },
    hint: { en: "passed is 1 or 0, so SUM(passed) counts the passes. Or COUNT(*) with WHERE passed = 1.", bn: "passed হয় ১ বা ০, তাই SUM(passed) পাসের সংখ্যা দেয়। অথবা WHERE passed = 1 দিয়ে COUNT(*)।" },
    solutions: ["SELECT study_group, SUM(passed) FROM students GROUP BY study_group;"],
  },
  {
    id: "rate-risk",
    level: "hard",
    tables: ["loans"],
    q: { en: "What is the default rate (%) for loans with an interest rate above 15%, compared with all other loans? (two rows)", bn: "১৫%-এর বেশি সুদের ঋণে খেলাপির হার (%) কত, আর বাকি সব ঋণে কত? (দুটো সারি)" },
    hint: { en: "Make two groups with CASE WHEN interest_rate > 15 … and take 100.0 * AVG(defaulted).", bn: "CASE WHEN interest_rate > 15 … দিয়ে দুটো দল বানান, তারপর 100.0 * AVG(defaulted) নিন।" },
    solutions: ["SELECT ROUND(100.0 * AVG(defaulted), 1) FROM loans GROUP BY interest_rate > 15;"],
  },
  {
    id: "new-customers-2025",
    level: "hard",
    tables: ["shop_orders"],
    q: { en: "For each month of 2025, how many customers placed their very FIRST shop order? (month order)", bn: "২০২৫ সালের প্রতি মাসে কতজন গ্রাহক তাঁদের প্রথম অর্ডারটা দিয়েছেন? (মাসের ক্রমে)" },
    hint: { en: "First find each customer's MIN(order_date) in a WITH step, then count those per month for dates in 2025.", bn: "আগে WITH দিয়ে প্রতিটা গ্রাহকের MIN(order_date) বের করুন, তারপর ২০২৫-এর তারিখগুলো মাস অনুযায়ী গুনুন।" },
    solutions: [
      "WITH first AS (SELECT customer_id, MIN(order_date) AS d FROM shop_orders GROUP BY customer_id) SELECT strftime('%Y-%m', d) AS m, COUNT(*) FROM first WHERE d >= '2025-01-01' GROUP BY m ORDER BY m;",
    ],
  },
  {
    id: "default-cities",
    level: "hard",
    tables: ["loans", "customers"],
    q: { en: "Which 3 cities have the largest total amount of DEFAULTED loans? Biggest first.", bn: "কোন ৩টি শহরে খেলাপি ঋণের মোট পরিমাণ সবচেয়ে বেশি? বড় থেকে ছোট।" },
    hint: { en: "JOIN loans to customers, keep defaulted = 1, GROUP BY city, ORDER BY SUM(amount) DESC, LIMIT 3.", bn: "loans-কে customers-এর সাথে JOIN করুন, defaulted = 1 রাখুন, city দিয়ে GROUP BY, SUM(amount) DESC দিয়ে সাজান, LIMIT 3।" },
    solutions: ["SELECT c.city FROM loans l JOIN customers c ON c.id = l.customer_id WHERE l.defaulted = 1 GROUP BY c.city ORDER BY SUM(l.amount) DESC LIMIT 3;"],
  },
];
