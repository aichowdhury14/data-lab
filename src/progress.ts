import { useEffect, useState } from "react";

// Per-browser learning progress. It's a convenience only, so every storage access is guarded.
export const TRACKS = {
  analysis: 5,
  sql: 18,
  engineering: 10,
  ml: 8,
  llm: 8,
} as const;
export type Track = keyof typeof TRACKS;
type Progress = Partial<Record<Track, string[]>>;

const KEY = "datalab-progress";
const EVENT = "datalab-progress";

function read(): Progress {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function markDone(track: Track, item: string) {
  const p = read();
  const list = p[track] ?? [];
  if (list.includes(item)) return;
  p[track] = [...list, item];
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function resetProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useProgress() {
  const [p, setP] = useState<Progress>(read);
  useEffect(() => {
    const on = () => setP(read());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return p;
}

/** Marks an item as seen whenever it becomes the visible one. */
export function useMark(track: Track, item: string | null) {
  useEffect(() => {
    if (item) markDone(track, item);
  }, [track, item]);
}
