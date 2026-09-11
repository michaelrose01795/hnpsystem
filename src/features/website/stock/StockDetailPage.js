// file location: src/features/website/stock/StockDetailPage.js
// /website/stock/<reg> — one vehicle, addressed by its registration.
//
// The reg is the URL because it is what a customer has in front of them (off
// the windscreen, off a text message, off the advert). It is NOT the record's
// identity — the stock number is. getStockByReg resolves a plate to the
// CURRENT listing only, so a plate that has been through the forecourt before
// can never surface the old advert's price or photos. When a known plate has
// no current listing the page says so plainly and points at the search,
// instead of 404ing on a link the customer was given in good faith.

import { useState } from "react";
import Link from "next/link";

import StockShell from "./StockShell";
import {
  getStockByReg,
  wasPreviouslyInStock,
  formatPrice,
  formatMileage,
  mileageLabel,
} from "@/lib/stock/vehicleStock";

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

// The headline strip under the price. Only rows with a value are drawn, so an
// electric car does not show an empty engine size.
const keyFacts = (v) =>
  [
    { label: "Mileage", value: mileageLabel(v) },
    { label: "Year", value: v.year },
    { label: "Fuel", value: v.fuel },
    { label: "Gearbox", value: v.transmission },
    { label: "Body", value: v.bodyStyle },
    { label: "Owners", value: v.condition === "new" ? "Brand new" : v.owners },
  ].filter((f) => f.value !== null && f.value !== undefined && f.value !== "");

const specRows = (v) =>
  [
    { label: "Stock number", value: v.stockNumber },
    { label: "Registration", value: v.reg },
    { label: "Make", value: v.make },
    { label: "Model", value: `${v.model} ${v.derivative}` },
    { label: "Year", value: v.year },
    { label: "Mileage", value: v.condition === "new" ? mileageLabel(v) : formatMileage(v.mileage) },
    { label: "Colour", value: v.colour },
    { label: "Body style", value: v.bodyStyle },
    { label: "Doors", value: v.doors },
    { label: "Seats", value: v.seats },
    { label: "Fuel", value: v.fuel },
    { label: "Transmission", value: v.transmission },
    { label: "Engine size", value: v.engineSize ? `${v.engineSize} litre` : null },
    { label: "Electric range", value: v.rangeMiles ? `${v.rangeMiles} miles` : null },
    { label: "CO₂ emissions", value: Number.isFinite(v.co2) ? `${v.co2} g/km` : null },
    { label: "Combined economy", value: v.mpg ? `${v.mpg} mpg` : null },
    { label: "Previous owners", value: v.condition === "new" ? "None — brand new" : v.owners },
    { label: "MOT due", value: formatDate(v.motDue) },
    { label: "Service history", value: v.serviceHistory },
    { label: "Location", value: v.location },
    { label: "In stock since", value: formatDate(v.stockedAt) },
  ].filter((row) => row.value !== null && row.value !== undefined && row.value !== "");

export default function StockDetailPage({ reg }) {
  const vehicle = getStockByReg(reg);
  const soldPreviously = !vehicle && wasPreviouslyInStock(reg);
  const [activeImage, setActiveImage] = useState(0);

  if (!vehicle) {
    return (
      <StockShell
        title="Vehicle not available — Humphries & Parks"
        description="This vehicle is no longer in stock at Humphries & Parks."
      >
        <section className="ws-section">
          <div className="ws-container">
            <div className="ws-card ws-stock-empty">
              <span className="ws-eyebrow">Not in stock</span>
              <h1 className="ws-h2">
                {soldPreviously ? "This one has been sold" : "We could not find that vehicle"}
              </h1>
              <p className="ws-muted">
                {soldPreviously
                  ? "That registration has been through our forecourt, but it is not for sale with us at the moment. Similar cars come in most weeks."
                  : "The registration in that link is not in our current stock. It may have sold, or the link may be out of date."}
              </p>
              <div className="ws-stock-empty-actions">
                <Link href="/website/available-stock" className="ws-btn ws-btn--primary">
                  Browse available stock
                </Link>
                <Link href="/website#contact" className="ws-btn ws-btn--ghost">
                  Ask us to find one
                </Link>
              </div>
            </div>
          </div>
        </section>
      </StockShell>
    );
  }

  const images = vehicle.images?.length ? vehicle.images : [];
  const heading = `${vehicle.make} ${vehicle.model} ${vehicle.derivative}`;

  return (
    <StockShell
      title={`${heading} — Humphries & Parks`}
      description={`${vehicle.year} ${heading} in ${vehicle.colour}, ${mileageLabel(vehicle)}, ${formatPrice(vehicle.price)}. Stock number ${vehicle.stockNumber} at Humphries & Parks, West Malling.`}
    >
      <section className="ws-section ws-stock-detail">
        <div className="ws-container">
          <nav className="ws-stock-breadcrumb" aria-label="Breadcrumb">
            <Link href="/website">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href={{ pathname: "/website/available-stock", query: { filter: vehicle.condition } }}>
              {vehicle.condition === "new" ? "New cars" : "Used cars"}
            </Link>
            <span aria-hidden="true">/</span>
            <span>{vehicle.reg}</span>
          </nav>

          <div className="ws-stock-detail-layout">
            {/* ---------------- Gallery ---------------- */}
            <div className="ws-stock-gallery">
              <div className="ws-stock-gallery-main">
                {images[activeImage] ? (
                  <img src={images[activeImage]} alt={heading} loading="eager" />
                ) : null}
                {vehicle.badge ? <span className="ws-badge">{vehicle.badge}</span> : null}
                <span className="ws-vehicle-condition">
                  {vehicle.condition === "new" ? "New" : "Used"}
                </span>
              </div>
              {images.length > 1 ? (
                <div className="ws-stock-thumbs">
                  {images.map((src, idx) => (
                    <button
                      key={src}
                      type="button"
                      className={
                        idx === activeImage ? "ws-stock-thumb ws-stock-thumb--active" : "ws-stock-thumb"
                      }
                      onClick={() => setActiveImage(idx)}
                      aria-label={`Show photo ${idx + 1} of ${images.length}`}
                    >
                      <img src={src} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* ---------------- Buying panel ---------------- */}
            <aside className="ws-card ws-stock-buy">
              <span className="ws-vehicle-brand">
                {vehicle.make} · {vehicle.year} · {vehicle.reg}
              </span>
              <h1 className="ws-h3">{heading}</h1>
              <p className="ws-stock-price">{formatPrice(vehicle.price)}</p>
              {vehicle.monthly ? (
                <p className="ws-stock-monthly">
                  from <strong>{formatPrice(vehicle.monthly)}</strong> per month, representative
                </p>
              ) : null}

              <dl className="ws-stock-facts">
                {keyFacts(vehicle).map((f) => (
                  <div key={f.label} className="ws-stock-fact">
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="ws-stock-actions">
                <Link href="/website#contact" className="ws-btn ws-btn--primary">
                  Enquire about this car
                </Link>
                <Link href="/website#contact" className="ws-btn ws-btn--ghost">
                  Book a test drive
                </Link>
              </div>
              <p className="ws-stock-stockno">
                Stock number <strong>{vehicle.stockNumber}</strong> · {vehicle.location}
              </p>
            </aside>
          </div>

          {/* ---------------- Detail ---------------- */}
          <div className="ws-stock-detail-body">
            <div className="ws-card ws-stock-panel">
              <h2 className="ws-h3">About this {vehicle.model}</h2>
              <p className="ws-muted">{vehicle.description}</p>
              {vehicle.highlights?.length ? (
                <ul className="ws-ticks">
                  {vehicle.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="ws-card ws-stock-panel">
              <h2 className="ws-h3">Specification</h2>
              <table className="ws-stock-spec">
                <tbody>
                  {specRows(vehicle).map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {vehicle.features?.length ? (
              <div className="ws-card ws-stock-panel">
                <h2 className="ws-h3">Equipment</h2>
                <ul className="ws-ticks">
                  {vehicle.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="ws-section-more">
            <Link
              href={{ pathname: "/website/available-stock", query: { filter: vehicle.condition } }}
              className="ws-btn ws-btn--ghost"
            >
              Back to {vehicle.condition === "new" ? "new" : "used"} stock
            </Link>
          </div>
        </div>
      </section>
    </StockShell>
  );
}
