// Bangla numerals (০১২৩৪৫৬৭৮৯) for data displays: charts, tables, stat tiles, counters.
// Code and SQL are never converted, so learners can still copy queries.
// The mode is set by LangProvider during render, so every display reads the current value.

export type NumeralMode = "latin" | "bn";
let mode: NumeralMode = "latin";
const BN = "০১২৩৪৫৬৭৮৯";

export const setNumeralMode = (m: NumeralMode) => {
  mode = m;
};
export const numeralMode = () => mode;

/** Converts ASCII digits in an already-formatted display string. */
export const digits = (s: string): string => (mode === "bn" ? s.replace(/[0-9]/g, (d) => BN[+d]) : s);
