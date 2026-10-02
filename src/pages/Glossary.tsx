import { useState } from "react";
import { useLang, type T } from "../i18n";
import { GLOSSARY, type Term } from "../content/glossary";
import { PageHead } from "../components/ui";

const TRACKS: { id: Term["track"] | "all"; label: T }[] = [
  { id: "all", label: { en: "All", bn: "সব" } },
  { id: "data", label: { en: "📊 Analysis", bn: "📊 অ্যানালাইসিস" } },
  { id: "sql", label: { en: "🗄️ SQL", bn: "🗄️ এসকিউএল" } },
  { id: "engineering", label: { en: "🏗️ Engineering", bn: "🏗️ ইঞ্জিনিয়ারিং" } },
  { id: "ml", label: { en: "🤖 Machine learning", bn: "🤖 মেশিন লার্নিং" } },
  { id: "llm", label: { en: "✨ AI & LLM", bn: "✨ এআই ও এলএলএম" } },
];

export default function Glossary() {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [track, setTrack] = useState<(typeof TRACKS)[number]["id"]>("all");
  const needle = q.trim().toLowerCase();
  const list = GLOSSARY.filter(
    (g) =>
      (track === "all" || g.track === track) &&
      (!needle || g.term.toLowerCase().includes(needle) || g.meaning.en.toLowerCase().includes(needle) || g.meaning.bn.includes(q.trim())),
  ).sort((a, b) => a.term.localeCompare(b.term));

  return (
    <>
      <PageHead
        title={{ en: "Glossary", bn: "শব্দকোষ" }}
        sub={{
          en: "Stuck on a word? Every technical term used on this site, explained in one or two plain sentences.",
          bn: "কোনো শব্দে আটকে গেছেন? এই সাইটের প্রতিটা টেকনিক্যাল শব্দ, এক-দুই লাইনের সহজ ভাষায় বোঝানো।",
        }}
      />
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t({ en: "🔎 Search a word, e.g. “token” or “JOIN”", bn: "🔎 শব্দ খুঁজুন, যেমন “token” বা “ঋণ”" })}
        style={{ width: "100%", fontSize: "1rem", padding: "0.6rem 0.8rem" }}
      />
      <div className="chips" style={{ margin: "10px 0 16px" }}>
        {TRACKS.map((x) => (
          <button key={x.id} className={`chip-btn${track === x.id ? " on" : ""}`} onClick={() => setTrack(x.id)}>
            {t(x.label)}
          </button>
        ))}
      </div>
      <div className="grid cols2">
        {list.map((g) => (
          <div key={g.term} className="card glossary-card">
            <b>{g.term}</b>
            <p style={{ margin: "0.25rem 0 0" }}>{t(g.meaning)}</p>
          </div>
        ))}
      </div>
      {!list.length && <p className="muted">{t({ en: "No matching word. Try a shorter search.", bn: "মিলে যায় এমন শব্দ নেই। ছোট করে খুঁজে দেখুন।" })}</p>}
    </>
  );
}
