// file location: src/features/website/components/WebsiteIcon.js
//
// The one glyph set for the customer /website. Line icons drawn in
// `currentColor`, so an icon takes the ink of whatever it sits in (a nav
// capsule, an accent badge, a trust tile) and follows the light / dark tokens
// with no colour of its own. Size comes from custglobal.css (`.ws-icon`, or
// the class a caller adds), never from props.
//
// Always decorative: the control or text beside it carries the accessible
// name, so every icon is aria-hidden. Add a glyph by adding a key below.

const GLYPHS = {
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  wrench: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  pound: (
    <>
      <path d="M18 20H7c1.5-1 2.5-2.6 2.5-4.5V8.5A3.5 3.5 0 0 1 16.2 7" />
      <path d="M6.5 13.5H14" />
    </>
  ),
  star: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  family: (
    <>
      <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </>
  ),
  inspect: (
    <>
      <path d="m9 11 3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  bolt: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  award: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,

  // Benefit and action cards — Sell Your Car, Service & Parts, Motability.
  truck: (
    <>
      <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12z" />
      <circle cx="7.5" cy="8" r="1" />
    </>
  ),
  bank: <path d="m3 10 9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />,
  clipboard: <path d="M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 14l2 2 4-4" />,
  gauge: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0M12 17l4-5" />
      <circle cx="12" cy="17" r="1" />
    </>
  ),
  tyre: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  box: <path d="m3 7 9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10" />,
  sparkle: <path d="m12 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />,
  badge: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="m9.5 9 1.8 1.8L14.5 7.5M8.5 14 7 22l5-3 5 3-1.5-8" />
    </>
  ),
  key: (
    <>
      <circle cx="15" cy="9" r="4" />
      <path d="M12.2 11.8 4 20M6.5 17.5 9 20M8.5 15.5 11 18" />
    </>
  ),
  sliders: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4" />,
};

export const WEBSITE_ICON_NAMES = Object.keys(GLYPHS);

export default function WebsiteIcon({ name, className = "" }) {
  const glyph = GLYPHS[name];
  if (!glyph) return null;
  return (
    <svg
      className={className ? `ws-icon ${className}` : "ws-icon"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph}
    </svg>
  );
}
