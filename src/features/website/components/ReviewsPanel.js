// file location: src/features/website/components/ReviewsPanel.js
//
// The Reviews block on /website: an overall rating beside one card per review
// platform, a filter row (Car purchase, Workshop, … Staff mentions) and a
// snap-scrolling track of featured quotes with previous / next buttons.
//
// Content is code-owned — siteContent.ratings, data/reviews.js, data/team.js —
// and the rules for reading it live in ../reviews/reviewInsights.js. Styling
// is custglobal.css @family marketing (.ws-reviews, .ws-rating*, .ws-review*);
// the filters reuse the .ws-tabs pills and the .ws-tab-count badge.
//
// Every part is optional: no scored platform drops the overall card, no
// reviews drops the filters and the track, and a staff name only becomes a
// link while the Meet the Team block is on the page to link to (`linkStaff`).

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import Stars from "./Stars";
import {
  ALL_REVIEWS_FILTER,
  buildReviewFilters,
  buildStaffMatcher,
  filterReviews,
  splitStaffMentions,
  summariseRatings,
} from "../reviews/reviewInsights";

const asList = (v) => (Array.isArray(v) ? v : []);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Quote({ text, matcher, linkStaff }) {
  const parts = splitStaffMentions(text, matcher);
  return (
    <p className="ws-review-quote">
      “
      {parts.map((part, i) => {
        if (typeof part === "string") return <Fragment key={i}>{part}</Fragment>;
        if (!linkStaff || !part.member) return <Fragment key={i}>{part.text}</Fragment>;
        return (
          <a
            key={i}
            href={`#team-member-${part.member.id}`}
            className="ws-review-staff"
            title={part.member.role ? `${part.member.name}, ${part.member.role}` : part.member.name}
          >
            {part.text}
          </a>
        );
      })}
      ”
    </p>
  );
}

function ReviewCta({ cta }) {
  if (!cta?.href) return null;
  return (
    <a href={cta.href} target="_blank" rel="noreferrer" className="ws-btn ws-btn--primary">
      {cta.label || "Leave a review"}
    </a>
  );
}

export default function ReviewsPanel({
  ratings,
  reviews,
  topics,
  team,
  reviewCta,
  featuredLimit = 6,
  linkStaff = true,
}) {
  const reviewList = useMemo(() => asList(reviews).filter((rv) => rv?.id && rv?.quote), [reviews]);
  const matcher = useMemo(() => buildStaffMatcher(team), [team]);
  const summary = useMemo(() => summariseRatings(ratings, reviewList), [ratings, reviewList]);
  const filters = useMemo(
    () => buildReviewFilters(topics, reviewList, matcher),
    [topics, reviewList, matcher],
  );

  const [filterId, setFilterId] = useState(ALL_REVIEWS_FILTER);
  const activeFilter = filters.find((f) => f.id === filterId) || filters[0];
  const shown = useMemo(
    () => filterReviews(reviewList, activeFilter?.id, matcher).slice(0, Math.max(1, featuredLimit)),
    [reviewList, activeFilter, matcher, featuredLimit],
  );

  // Carousel edges. Both start "true" so the buttons stay hidden until the
  // track has been measured — and stay hidden when every card already fits.
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      setEdges({ start: track.scrollLeft <= 1, end: track.scrollLeft >= max - 1 });
    };
    track.scrollLeft = 0; // a new filter starts from its first review
    update();
    track.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(track);
    return () => {
      track.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [shown]);

  const page = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: "smooth" });
  };

  const hasOverall = summary.overall != null;
  const hasPlatforms = summary.platforms.length > 0;

  return (
    <div className="ws-reviews">
      {hasOverall || hasPlatforms ? (
        <div className="ws-reviews-summary">
          {hasOverall ? (
            <div className="ws-card ws-panel ws-rating-overall">
              <span className="ws-eyebrow">Overall rating</span>
              <p className="ws-rating-overall-score">
                {summary.overall.toFixed(1)}
                <span className="ws-rating-overall-max"> / 5</span>
              </p>
              <Stars rating={summary.overall} />
              <p className="ws-muted">
                Average of {plural(summary.ratedCount, "review platform")}
                {reviewList.length ? ` · ${plural(reviewList.length, "featured review")}` : ""}
              </p>
              <ReviewCta cta={reviewCta} />
              {reviewCta?.href && reviewCta?.note ? (
                <span className="ws-section-more-note">{reviewCta.note}</span>
              ) : null}
            </div>
          ) : null}
          {hasPlatforms ? (
            <ul className="ws-ratings" aria-label="Ratings by platform">
              {summary.platforms.map((p) => (
                <li key={p.source} className="ws-rating">
                  <span className="ws-rating-source">{p.source}</span>
                  {p.score != null ? (
                    <>
                      <span className="ws-rating-score">
                        {p.score.toFixed(1)}
                        <span className="ws-rating-max"> / 5</span>
                      </span>
                      <Stars rating={p.score} />
                    </>
                  ) : null}
                  <span className="ws-rating-meta">
                    {p.featured ? `${plural(p.featured, "featured review")} below` : "Verified customer reviews"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {reviewList.length ? (
        <>
          <div className="ws-reviews-toolbar">
            <div className="ws-tabs" role="group" aria-label="Filter reviews">
              {filters.map((f) => {
                const active = f.id === activeFilter?.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={active}
                    className={active ? "ws-tab ws-tab--active" : "ws-tab"}
                    onClick={() => setFilterId(f.id)}
                  >
                    {f.label}
                    <span className="ws-tab-count">{f.count}</span>
                  </button>
                );
              })}
            </div>
            {edges.start && edges.end ? null : (
              <div className="ws-review-nav">
                <button
                  type="button"
                  className="ws-review-nav-btn"
                  aria-label="Previous reviews"
                  disabled={edges.start}
                  onClick={() => page(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="ws-review-nav-btn"
                  aria-label="Next reviews"
                  disabled={edges.end}
                  onClick={() => page(1)}
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {shown.length ? (
            <ul
              ref={trackRef}
              className="ws-grid ws-grid--reviews"
              aria-label={`${activeFilter?.label || "Featured"} reviews`}
              tabIndex={0}
            >
              {shown.map((rv) => (
                <li key={rv.id} className="ws-card ws-review">
                  <div className="ws-review-top">
                    <Stars rating={rv.rating} />
                    {rv.source ? <span className="ws-review-source">{rv.source}</span> : null}
                  </div>
                  <Quote text={rv.quote} matcher={matcher} linkStaff={linkStaff} />
                  <div className="ws-review-meta">
                    <span className="ws-review-name">{rv.name}</span>
                    {rv.date ? <span className="ws-muted">{rv.date}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ws-muted ws-review-empty">
              No featured reviews for “{activeFilter?.label}” yet — see the platforms above for every review.
            </p>
          )}
        </>
      ) : null}

      {/* With no overall card to carry it, "Leave a review" sits under the
          quotes in the same strip the vehicle teaser uses. */}
      {!hasOverall && reviewCta?.href ? (
        <div className="ws-section-more">
          <ReviewCta cta={reviewCta} />
          {reviewCta.note ? <span className="ws-section-more-note">{reviewCta.note}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
