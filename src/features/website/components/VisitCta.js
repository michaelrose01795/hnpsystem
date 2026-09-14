// file location: src/features/website/components/VisitCta.js
//
// The "Plan your visit" call-to-action band at the head of the Contact block
// (custglobal.css .ws-visit). Copy and buttons come from
// siteContent.contact.visit: one `variant: "primary"` action, the rest ghost.
// Internal paths go through <Link>; web links open in a new tab.

import Link from "next/link";

const asList = (v) => (Array.isArray(v) ? v : []);

export default function VisitCta({ visit }) {
  const actions = asList(visit?.actions).filter((a) => a?.label && a?.href);
  if (!visit?.title && !actions.length) return null;
  return (
    <div className="ws-card ws-panel ws-visit">
      <div className="ws-visit-copy">
        {visit.eyebrow ? <span className="ws-eyebrow">{visit.eyebrow}</span> : null}
        {visit.title ? <h3 className="ws-h3">{visit.title}</h3> : null}
        {visit.lead ? <p className="ws-muted">{visit.lead}</p> : null}
      </div>
      {actions.length ? (
        <div className="ws-visit-actions">
          {actions.map((action) => {
            const className =
              action.variant === "primary" ? "ws-btn ws-btn--primary" : "ws-btn ws-btn--ghost";
            if (String(action.href).startsWith("/")) {
              return (
                <Link key={action.label} href={action.href} className={className}>
                  {action.label}
                </Link>
              );
            }
            const external = /^https?:/i.test(action.href);
            return (
              <a
                key={action.label}
                href={action.href}
                className={className}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
              >
                {action.label}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
