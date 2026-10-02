export const SCHEMA: Record<string, string> = {
  customers: "id INTEGER PRIMARY KEY, name TEXT, age INTEGER, city TEXT, segment TEXT, monthly_income INTEGER, credit_score INTEGER, joined TEXT",
  transactions: "id INTEGER PRIMARY KEY, customer_id INTEGER, txn_date TEXT, category TEXT, amount INTEGER, channel TEXT",
  loans: "id INTEGER PRIMARY KEY, customer_id INTEGER, amount INTEGER, term_months INTEGER, interest_rate REAL, issued_date TEXT, defaulted INTEGER",
  stock_prices: "trade_date TEXT, ticker TEXT, close REAL, volume INTEGER",
  shop_orders: "order_id INTEGER PRIMARY KEY, customer_id INTEGER, order_date TEXT, product TEXT, category TEXT, quantity INTEGER, unit_price INTEGER, payment TEXT",
  employees: "id INTEGER PRIMARY KEY, name TEXT, department TEXT, years_experience INTEGER, monthly_salary INTEGER, overtime_hours INTEGER, satisfaction INTEGER, remote INTEGER, left_company INTEGER",
  dhaka_air: "date TEXT, month TEXT, aqi INTEGER, temperature_c REAL, rainfall_mm INTEGER, humidity_pct INTEGER",
  students: "id INTEGER PRIMARY KEY, name TEXT, study_group TEXT, study_hours_week INTEGER, attendance_pct INTEGER, sleep_hours REAL, final_score INTEGER, passed INTEGER",
};
