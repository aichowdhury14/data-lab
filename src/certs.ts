// Certificate eligibility, shared by the certificate page, the home banner, the per-page progress
// pills and the "unlocked!" toast — so every place agrees on the rules.
import type { T } from "./i18n";
import { TRACKS, useProgress, type Track } from "./progress";

export type CertId = Track | "graduate";
export const SQL_SOLVED_NEEDED = 10;

export const TRACK_INFO: Record<CertId, { title: T; icon: string; to: string }> = {
  analysis: { title: { en: "Data Analysis", bn: "ডেটা অ্যানালাইসিস" }, icon: "📊", to: "/analysis" },
  sql: { title: { en: "SQL", bn: "এসকিউএল" }, icon: "🗄️", to: "/sql" },
  engineering: { title: { en: "Data Engineering", bn: "ডেটা ইঞ্জিনিয়ারিং" }, icon: "🏗️", to: "/engineering" },
  ml: { title: { en: "Machine Learning", bn: "মেশিন লার্নিং" }, icon: "🤖", to: "/ml" },
  llm: { title: { en: "AI & Large Language Models", bn: "এআই ও লার্জ ল্যাঙ্গুয়েজ মডেল" }, icon: "✨", to: "/llm" },
  graduate: { title: { en: "Data Lab Graduate (all five tracks)", bn: "ডেটা ল্যাব গ্র্যাজুয়েট (পাঁচটি ট্র্যাক)" }, icon: "🎓", to: "/" },
};

export function readSqlSolved(): number {
  try {
    return (JSON.parse(localStorage.getItem("datalab-sql-solved") ?? "[]") as string[]).length;
  } catch {
    return 0;
  }
}

export interface CertState {
  done: number;
  total: number;
  ok: boolean;
  /** SQL only: lessons solved with "Check my answer" */
  solved?: number;
}

export function certStatus(progress: Partial<Record<Track, string[]>>, solved: number): Record<CertId, CertState> {
  const s = {} as Record<CertId, CertState>;
  (Object.keys(TRACKS) as Track[]).forEach((k) => {
    const done = Math.min(progress[k]?.length ?? 0, TRACKS[k]);
    const explored = done >= TRACKS[k];
    s[k] = k === "sql" ? { done, total: TRACKS[k], ok: explored && solved >= SQL_SOLVED_NEEDED, solved } : { done, total: TRACKS[k], ok: explored };
  });
  const tracksDone = (Object.keys(TRACKS) as Track[]).filter((k) => s[k].ok).length;
  s.graduate = { done: tracksDone, total: 5, ok: tracksDone === 5 };
  return s;
}

/** Live certificate status (re-computed whenever progress changes). */
export function useCertStatus() {
  const progress = useProgress();
  return certStatus(progress, readSqlSolved());
}
