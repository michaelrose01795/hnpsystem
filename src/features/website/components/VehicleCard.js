// file location: src/features/website/components/VehicleCard.js
// One vehicle advert card. Shared by the Cars block on /website, the results
// grid on /website/available-stock and the similar vehicles on the detail page,
// so a car looks identical wherever a customer meets it.
//
// Takes the card shape built by toVehicleCard in
// src/features/website/data/vehicles.js. Reading order is the approved
// listing hierarchy: photo, badges, vehicle name, cash price, monthly finance,
// mileage / transmission / fuel, then the "View vehicle" action. Registration
// and stock number stay in the data but are not drawn here — they belong on the
// detail page.
//
// The whole card is the link: "View vehicle" is the one real <a>, and its
// ::after stretches over the card (custglobal.css a.ws-vehicle-cta). The
// photo controls, favourite and compare sit above that layer as real buttons,
// so nothing interactive is nested inside a link.
//
// A card without an `href` (a legacy website_vehicles row that predates the
// stock link) still renders, just without the action.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import useVehicleShortlist from "../hooks/useVehicleShortlist";

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

const HeartIcon = () => (
  <Icon>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
  </Icon>
);

const CompareIcon = () => (
  <Icon>
    <path d="M16 3h5v5" />
    <path d="M21 3l-7 7" />
    <path d="M8 21H3v-5" />
    <path d="M3 21l7-7" />
  </Icon>
);

const CameraIcon = () => (
  <Icon>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </Icon>
);

const ChevronIcon = ({ direction }) => (
  <Icon>
    <path d={direction === "prev" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
  </Icon>
);

export default function VehicleCard({ vehicle, priority = false, shortlist = true }) {
  const v = vehicle || {};
  const name = v.name || [v.brand, v.model].filter(Boolean).join(" ");
  // Older card shapes (the Live Preview mapper) carry one `badge` and one
  // `image`; the stock builder carries lists.
  const badges = Array.isArray(v.badges) && v.badges.length ? v.badges : v.badge ? [v.badge] : [];
  const images = Array.isArray(v.images) && v.images.length ? v.images : v.image ? [v.image] : [];
  const specs = [v.miles, v.transmission, v.fuel].filter(Boolean);
  const subtitle = [v.derivative, v.year, v.type === "new" ? "New" : v.type === "used" ? "Used" : null]
    .filter(Boolean)
    .join(" · ");

  // The highlights strip is a continuous right-to-left rail: the badges are
  // rendered twice so the first follows the last seamlessly, and it only turns
  // over while the card is actually on screen.
  const cardRef = useRef(null);
  const [inView, setInView] = useState(false);
  const cycling = badges.length > 1;

  useEffect(() => {
    const node = cardRef.current;
    if (!cycling || !node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => setInView(entry.isIntersecting)),
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cycling]);

  const [photo, setPhoto] = useState(0);
  const step = (delta) => setPhoto((current) => (current + delta + images.length) % images.length);

  const { isFavourite, isComparing, compareFull, toggleFavourite, toggleCompare } = useVehicleShortlist();
  const canShortlist = shortlist && Boolean(v.id);
  const saved = canShortlist && isFavourite(v.id);
  const comparing = canShortlist && isComparing(v.id);

  return (
    <article ref={cardRef} className="ws-card ws-vehicle" data-linked={v.href ? "true" : "false"}>
      <div className="ws-vehicle-media">
        {images.length ? (
          <img src={images[photo]} alt={`${name}, photo ${photo + 1} of ${images.length}`} loading={priority ? "eager" : "lazy"} />
        ) : (
          <span className="ws-vehicle-noimage">Photos coming soon</span>
        )}

        {badges.length ? (
          <div className="ws-vehicle-badges">
            <ul
              className="ws-vehicle-badge-track"
              aria-label="Highlights"
              data-marquee={!cycling ? "off" : inView ? "run" : "paused"}
            >
              {badges.map((badge) => (
                <li key={badge} className="ws-badge">
                  {badge}
                </li>
              ))}
              {cycling
                ? badges.map((badge) => (
                    <li key={`repeat-${badge}`} className="ws-badge" aria-hidden="true">
                      {badge}
                    </li>
                  ))
                : null}
            </ul>
          </div>
        ) : null}

        {canShortlist ? (
          <div className="ws-vehicle-actions">
            <button
              type="button"
              className="ws-vehicle-icon-btn"
              aria-pressed={saved ? "true" : "false"}
              aria-label={saved ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
              title={saved ? "Saved to favourites" : "Save to favourites"}
              onClick={() => toggleFavourite(v.id)}
            >
              <HeartIcon />
            </button>
            <button
              type="button"
              className="ws-vehicle-icon-btn"
              aria-pressed={comparing ? "true" : "false"}
              aria-label={comparing ? `Remove ${name} from compare` : `Add ${name} to compare`}
              title={!comparing && compareFull ? "You can compare up to 3 cars" : comparing ? "In compare" : "Compare"}
              disabled={!comparing && compareFull}
              onClick={() => toggleCompare(v.id)}
            >
              <CompareIcon />
            </button>
          </div>
        ) : null}

        {images.length > 1 ? (
          <>
            <button
              type="button"
              className="ws-vehicle-gallery-btn ws-vehicle-gallery-btn--prev"
              aria-label={`Previous photo of ${name}`}
              onClick={() => step(-1)}
            >
              <ChevronIcon direction="prev" />
            </button>
            <button
              type="button"
              className="ws-vehicle-gallery-btn ws-vehicle-gallery-btn--next"
              aria-label={`Next photo of ${name}`}
              onClick={() => step(1)}
            >
              <ChevronIcon direction="next" />
            </button>
          </>
        ) : null}

        {images.length ? (
          <span className="ws-vehicle-photo-count">
            <CameraIcon />
            <span>
              {images.length > 1 ? `${photo + 1}/${images.length}` : "1"}
              <span className="ws-sr-only"> photos</span>
            </span>
          </span>
        ) : null}
      </div>

      <div className="ws-card-body ws-vehicle-body">
        <h3 className="ws-card-title">{name}</h3>
        {subtitle ? <p className="ws-vehicle-sub">{subtitle}</p> : null}

        {v.price ? <p className="ws-vehicle-price">{v.price}</p> : null}
        {v.monthly ? (
          <p className="ws-vehicle-monthly">
            or <strong>{v.monthly}</strong> a month
          </p>
        ) : null}

        {specs.length ? (
          <ul className="ws-vehicle-specs" aria-label="Key details">
            {specs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
        ) : null}

        {v.href ? (
          <Link href={v.href} className="ws-btn ws-btn--primary ws-vehicle-cta" aria-label={`View vehicle: ${name}`}>
            View vehicle
          </Link>
        ) : null}
      </div>
    </article>
  );
}
