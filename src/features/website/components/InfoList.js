// file location: src/features/website/components/InfoList.js
//
// Label / value pairs laid out side by side across a card (custglobal.css
// .ws-info-list). Used for company details, contact details and "at a glance"
// facts on the full-width /website pages.
//
// items: [label, value, href?][] — a falsy entry is skipped, so callers can
// write `condition ? [...] : null` inline.

export default function InfoList({ items }) {
  const rows = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!rows.length) return null;
  return (
    <dl className="ws-info-list">
      {rows.map(([label, value, href]) => (
        <div key={label} className="ws-info-item">
          <dt className="ws-info-label">{label}</dt>
          <dd className="ws-info-value">{href ? <a href={href}>{value}</a> : value}</dd>
        </div>
      ))}
    </dl>
  );
}
