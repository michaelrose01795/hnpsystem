// file location: src/features/website/components/HistoryTimeline.js
//
// "Our story since 1947" — the milestones from data/timeline.js as one joined
// timeline (custglobal.css .ws-timeline). Across the width on a wide screen,
// scrolling sideways and snapping to each year; down the left edge on a phone.
//
// A milestone with an `image` shows it above its copy (period photography);
// one without is a plain card. The heading takes its year from the first
// milestone, so it stays true if the list is re-ordered or trimmed.

const asList = (v) => (Array.isArray(v) ? v : []);

export default function HistoryTimeline({ milestones }) {
  const items = asList(milestones).filter((t) => t?.year);
  if (!items.length) return null;
  const first = items[0].year;
  const last = items[items.length - 1].year;
  return (
    <div className="ws-history">
      <div className="ws-history-head">
        <h3 className="ws-h3">Our story since {first}</h3>
        <span className="ws-history-span">
          {items.length > 1 ? `${first} – ${last}` : first} · {items.length} milestone{items.length === 1 ? "" : "s"}
        </span>
      </div>
      {/* Focusable so a keyboard user can scroll the rail sideways. */}
      <ol className="ws-timeline" aria-label="Company history" tabIndex={0}>
        {items.map((t) => (
          <li key={t.year} className="ws-milestone">
            <span className="ws-milestone-marker" aria-hidden="true" />
            <span className="ws-milestone-year">{t.year}</span>
            <article className="ws-card ws-milestone-card">
              {t.image ? (
                <div className="ws-milestone-media">
                  <img src={t.image} alt={t.imageAlt || `${t.title || "Humphries & Parks"}, ${t.year}`} loading="lazy" />
                </div>
              ) : null}
              <div className="ws-milestone-body">
                {t.title ? <h4 className="ws-card-title">{t.title}</h4> : null}
                {t.body ? <p className="ws-muted">{t.body}</p> : null}
              </div>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
