import { useMemo, useState } from "react";
import { digits } from "../numerals";
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
  const [mode, setMode] = useState<"list" | "cards">("list");
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
      <div className="seg gl-mode" role="tablist">
        <button className={mode === "list" ? "on" : ""} onClick={() => setMode("list")}>
          📖 {t({ en: "Word list", bn: "শব্দের তালিকা" })}
        </button>
        <button className={mode === "cards" ? "on" : ""} onClick={() => setMode("cards")}>
          🃏 {t({ en: "Flashcards — test yourself", bn: "ফ্ল্যাশকার্ড — নিজেকে যাচাই" })}
        </button>
      </div>
      {mode === "cards" ? (
        <>
          <div className="chips" style={{ margin: "10px 0 16px" }}>
            {TRACKS.map((x) => (
              <button key={x.id} className={`chip-btn${track === x.id ? " on" : ""}`} onClick={() => setTrack(x.id)}>
                {t(x.label)}
              </button>
            ))}
          </div>
          <Flashcards key={track} terms={GLOSSARY.filter((g) => track === "all" || g.track === track)} />
        </>
      ) : (
      <>
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
      )}
    </>
  );
}

function shuffle<X>(arr: X[]): X[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Flip a card, say whether you knew it; the ones you missed come back at the end. */
function Flashcards({ terms }: { terms: Term[] }) {
  const { t } = useLang();
  const start = useMemo(() => shuffle(terms), [terms]);
  const [deck, setDeck] = useState(start);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [missed, setMissed] = useState<Term[]>([]);

  const restart = (cards: Term[]) => {
    setDeck(shuffle(cards));
    setI(0);
    setFlipped(false);
    setKnown(0);
    setMissed([]);
  };
  const answer = (gotIt: boolean) => {
    if (gotIt) setKnown((k) => k + 1);
    else setMissed((m) => [...m, deck[i]]);
    setFlipped(false);
    setI((n) => n + 1);
  };

  if (!deck.length) return <p className="muted">{t({ en: "No cards here.", bn: "এখানে কোনো কার্ড নেই।" })}</p>;

  if (i >= deck.length) {
    const pct = Math.round((known / deck.length) * 100);
    return (
      <div className="card fc-done">
        <div className="fc-score">{digits(pct + "%")}</div>
        <p>
          {digits(
            t({
              en: `You knew ${known} of ${deck.length} words.`,
              bn: `${deck.length}টির মধ্যে ${known}টি শব্দ আপনি জানতেন।`,
            }),
          )}{" "}
          {pct === 100
            ? t({ en: "Perfect — you speak data! 🎉", bn: "দারুণ — আপনি ডেটার ভাষা জানেন! 🎉" })
            : pct >= 70
              ? t({ en: "Great job. Practise the missed ones once more.", bn: "খুব ভালো। বাদ পড়াগুলো আরেকবার দেখে নিন।" })
              : t({ en: "Good start. Read the list, then try again.", bn: "ভালো শুরু। তালিকাটা পড়ে আবার চেষ্টা করুন।" })}
        </p>
        <div className="row" style={{ gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {missed.length > 0 && (
            <button className="btn" onClick={() => restart(missed)}>
              🔁 {digits(t({ en: `Practise the ${missed.length} I missed`, bn: `ভুল হওয়া ${missed.length}টি আবার` }))}
            </button>
          )}
          <button className="btn ghost" onClick={() => restart(terms)}>
            🔀 {t({ en: "Shuffle & start over", bn: "এলোমেলো করে নতুন করে" })}
          </button>
        </div>
      </div>
    );
  }

  const card = deck[i];
  return (
    <div className="fc-wrap">
      <div className="fc-top">
        <span className="muted small">{digits(t({ en: `Card ${i + 1} of ${deck.length}`, bn: `${deck.length}টির মধ্যে ${i + 1} নম্বর কার্ড` }))}</span>
        <span className="fc-bar">
          <i style={{ width: `${(i / deck.length) * 100}%` }} />
        </span>
        <span className="small">
          ✅ {digits(String(known))} · ❌ {digits(String(missed.length))}
        </span>
      </div>
      <button className={`fc-card${flipped ? " flipped" : ""}`} onClick={() => setFlipped((f) => !f)} aria-live="polite">
        <span className="fc-face fc-front">
          <b>{card.term}</b>
          <small>{t({ en: "Do you know what this means? Tap to check.", bn: "এর মানে জানেন? দেখতে চাপ দিন।" })}</small>
        </span>
        <span className="fc-face fc-back">
          <b>{card.term}</b>
          <span>{t(card.meaning)}</span>
        </span>
      </button>
      <div className="fc-actions">
        {flipped ? (
          <>
            <button className="btn ghost" onClick={() => answer(false)}>
              ❌ {t({ en: "Not yet", bn: "এখনো না" })}
            </button>
            <button className="btn" onClick={() => answer(true)}>
              ✅ {t({ en: "I knew it", bn: "জানতাম" })}
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setFlipped(true)}>
            👀 {t({ en: "Show the meaning", bn: "মানে দেখুন" })}
          </button>
        )}
      </div>
    </div>
  );
}
