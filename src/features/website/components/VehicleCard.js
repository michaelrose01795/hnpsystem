// file location: src/features/website/components/VehicleCard.js
// One vehicle advert card. Shared by the Cars block on /website and the
// results grid on /website/available-stock so a car looks identical wherever a
// customer meets it.
//
// Takes the card shape built in src/features/website/data/vehicles.js. A card
// with an `href` renders as a link into /website/stock/<reg>; one without
// (a legacy website_vehicles row that predates the stock link) still renders,
// just not clickable — an advert that goes nowhere is worse than a static one.

import Link from "next/link";

export default function VehicleCard({ vehicle, priority = false }) {
  const v = vehicle || {};
  const title = [v.brand, v.model].filter(Boolean).join(" ");

  const body = (
    <>
      <div className="ws-vehicle-media">
        {v.image ? (
          <img src={v.image} alt={title} loading={priority ? "eager" : "lazy"} />
        ) : null}
        {v.badge ? <span className="ws-badge">{v.badge}</span> : null}
        {v.type ? (
          <span className="ws-vehicle-condition">{v.type === "new" ? "New" : "Used"}</span>
        ) : null}
      </div>
      <div className="ws-card-body">
        <span className="ws-vehicle-brand">
          {v.brand}
          {v.year ? ` · ${v.year}` : ""}
        </span>
        <h3 className="ws-card-title">{v.model}</h3>
        <p className="ws-vehicle-price">{v.price}</p>
        <dl className="ws-vehicle-facts">
          {v.miles ? (
            <div className="ws-vehicle-fact">
              <dt>Mileage</dt>
              <dd>{v.miles}</dd>
            </div>
          ) : null}
          {v.reg ? (
            <div className="ws-vehicle-fact">
              <dt>Registration</dt>
              <dd>{v.reg}</dd>
            </div>
          ) : null}
          {v.stockNumber ? (
            <div className="ws-vehicle-fact">
              <dt>Stock no.</dt>
              <dd>{v.stockNumber}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </>
  );

  if (!v.href) {
    return <article className="ws-card ws-vehicle">{body}</article>;
  }

  return (
    <Link href={v.href} className="ws-card ws-vehicle ws-vehicle--link">
      {body}
    </Link>
  );
}
