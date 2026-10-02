// Loaded lazily (after the page is idle) so the Supabase client never slows down the first paint.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

export interface LiveStats {
  views?: number;
  visitors?: number;
  today?: number;
  online?: number;
  status: "loading" | "ready" | "error";
}
type Set = (patch: Partial<LiveStats>) => void;

function visitorId(): string {
  try {
    let id = localStorage.getItem("datalab-visitor");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("datalab-visitor", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Development and test runs on this computer are never counted. */
const isLocal = () => /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);

export function connect(set: Set) {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const id = visitorId();

  const apply = (data: unknown) => {
    const d = data as { views: number; visitors: number; today: number };
    set({ views: d.views, visitors: d.visitors, today: d.today, status: "ready" });
  };

  // 1. Count this visit once per browser session (the database also ignores repeats within 30 minutes).
  let counted = false;
  try {
    counted = sessionStorage.getItem("datalab-counted") === "1";
  } catch {
    /* ignore */
  }
  const first =
    isLocal() || counted
      ? sb.rpc("datalab_stats")
      : sb.rpc("datalab_record_visit", { p_visitor: id, p_path: location.pathname, p_lang: document.documentElement.lang });
  first.then(({ data, error }) => {
    if (error || !data) return set({ status: "error" });
    apply(data);
    try {
      if (!isLocal()) sessionStorage.setItem("datalab-counted", "1");
    } catch {
      /* ignore */
    }
  });

  // 2. "Online now": everyone with the site open joins one presence channel (one entry per browser).
  const channel = sb.channel("datalab-online", { config: { presence: { key: id } } });
  channel
    .on("presence", { event: "sync" }, () => set({ online: Object.keys(channel.presenceState()).length }))
    .subscribe((status) => {
      if (status === "SUBSCRIBED") channel.track({ since: Date.now() });
    });

  // 3. Refresh the totals every minute while the tab is visible.
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    sb.rpc("datalab_stats").then(({ data, error }) => !error && data && apply(data));
  }, 60_000);
}
