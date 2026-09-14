// file location: src/features/website/components/BenefitCards.js
//
// A responsive row of icon cards — the one card pattern the /website home page
// uses for "why choose us" points and for action tiles.
//
//   items  [{ id, icon, title, body, href?, cta? }]
//          `href` + `cta` add a button to the foot of the card, which turns
//          a benefit into an action card. Internal paths route through
//          next/link; tel: / external links stay plain anchors.
//   compact  tighter padding and a horizontal icon, for 2–4 short points
//
// Styling: custglobal.css @family marketing (.ws-benefits, .ws-benefit*).
// An empty list renders nothing.

import Link from "next/link";

import WebsiteIcon from "./WebsiteIcon";

const asList = (v) => (Array.isArray(v) ? v : []);

function CardAction({ href, label, title }) {
  if (!href || !label) return null;
  const common = {
    className: "ws-btn ws-btn--ghost",
    // The visible label ("Book a service") is short; the accessible name
    // keeps the card title so a screen-reader list of links stays distinct.
    "aria-label": title && !label.includes(title) ? `${label}: ${title}` : undefined,
  };
  return String(href).startsWith("/") ? (
    <Link href={href} {...common}>
      {label}
    </Link>
  ) : (
    <a href={href} {...common}>
      {label}
    </a>
  );
}

export default function BenefitCards({ items, compact = false, headingLevel = 3 }) {
  const list = asList(items).filter((item) => item?.title);
  if (!list.length) return null;
  const Heading = `h${headingLevel}`;
  return (
    <ul className={compact ? "ws-benefits ws-benefits--compact" : "ws-benefits"}>
      {list.map((item) => (
        <li key={item.id || item.title} className="ws-card ws-benefit">
          {item.icon ? (
            <span className="ws-icon-badge">
              <WebsiteIcon name={item.icon} />
            </span>
          ) : null}
          <div className="ws-benefit-body">
            <Heading className="ws-card-title">{item.title}</Heading>
            {item.body ? <p className="ws-muted">{item.body}</p> : null}
          </div>
          {item.href && item.cta ? (
            <div className="ws-benefit-action">
              <CardAction href={item.href} label={item.cta} title={item.title} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
