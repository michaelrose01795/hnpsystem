// file location: src/features/website/components/OffersSection.js
//
// The #offers block on /website: filter tabs over clear offer cards.
//
// Every word on a card comes from data/offers.js, never from the photo, so the
// offer reads the same at any crop, to a screen reader, and on the day the
// artwork and the copy would otherwise disagree. An offer past its `expires`
// date drops off by itself; when none are left the caller renders nothing
// (see liveOffers, used by WebsitePage to decide whether the section shows).
//
// Styling: .ws-card / .ws-segmented / .ws-badge / .ws-vehicle-brand from the
// marketing family, plus .ws-offer-* in custglobal.css.

import { useMemo, useState } from "react";
import Link from "next/link";
import { OFFER_FILTERS } from "../data/offers";

const asList = (v) => (Array.isArray(v) ? v : []);

// ISO dates compare as strings; `expires` is inclusive.
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Offers that have not expired yet. */
export const liveOffers = (offers, today = todayIso()) =>
  asList(offers).filter((o) => o && (!o.expires || String(o.expires) >= today));

// Pinned to UTC so the server render and the browser print the same date.
const expiryFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const formatExpiry = (iso) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : expiryFormat.format(date);
};

export function OfferCard({ offer }) {
  const badge = OFFER_FILTERS.find((f) => f.id === asList(offer.categories)[0]);
  const expiry = offer.expires ? formatExpiry(offer.expires) : null;
  return (
    <article className="ws-card ws-offer-card">
      <div className="ws-offer-media">
        {offer.image ? <img src={offer.image} alt={offer.title || ""} loading="lazy" /> : null}
        {badge ? <span className="ws-badge">{badge.label}</span> : null}
      </div>
      <div className="ws-card-body ws-offer-body">
        {offer.manufacturer ? <span className="ws-vehicle-brand">{offer.manufacturer}</span> : null}
        {offer.title ? <h3 className="ws-card-title">{offer.title}</h3> : null}
        {offer.headline ? <p className="ws-offer-figure">{offer.headline}</p> : null}
        {offer.body ? <p className="ws-muted ws-offer-desc">{offer.body}</p> : null}
        <div className="ws-offer-foot">
          <span className="ws-offer-expiry">{expiry ? `Offer ends ${expiry}` : "Ongoing offer"}</span>
          {offer.href ? (
            <Link
              href={offer.href}
              className="ws-btn ws-btn--ghost"
              aria-label={`View offer: ${offer.title || offer.headline}`}
            >
              View offer
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function OffersSection({ offers, initialFilter = "all" }) {
  const [filter, setFilter] = useState(initialFilter);
  const [visibleCount, setVisibleCount] = useState(5);
  const live = useMemo(() => liveOffers(offers), [offers]);
  const shown = useMemo(
    () => (filter === "all" ? live : live.filter((o) => asList(o.categories).includes(filter))),
    [filter, live],
  );
  const active = OFFER_FILTERS.find((f) => f.id === filter) || OFFER_FILTERS[0];

  return (
    <>
      <div className="ws-segmented" role="tablist" aria-label="Filter offers">
        {OFFER_FILTERS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={filter === tab.id ? "ws-segmented-tab ws-segmented-tab--active" : "ws-segmented-tab"}
            onClick={() => {
              setFilter(tab.id);
              setVisibleCount(5);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {shown.length ? (
        <div
          className="ws-grid ws-grid--cards"
          // Local five-column cap matches the ws-grid gap and stacks on smaller screens.
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, max(220px, calc((100% - 4 * clamp(16px, 2vw, 24px)) / 5))), 1fr))" }}
        >
          {shown.slice(0, visibleCount).map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      ) : (
        <p className="ws-muted">
          No {active.label.toLowerCase()} offers running right now. Give us a call and we will tell you what is
          available.
        </p>
      )}
      {visibleCount < shown.length ? (
        <div className="ws-section-more">
          <button type="button" className="ws-btn ws-btn--ghost" onClick={() => setVisibleCount((count) => count + 5)}>
            Show more
          </button>
        </div>
      ) : null}
    </>
  );
}
