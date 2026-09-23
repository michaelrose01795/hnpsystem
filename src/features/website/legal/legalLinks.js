// file location: src/features/website/legal/legalLinks.js
//
// Resolves the footer legal links (Privacy, Cookies, Terms, Complaints) to the
// CUSTOMER site's own pages.
//
// footer.legal arrives as plain labels from the static fallback and as
// { href, label } rows from website_footer. Stored hrefs pointed at staff routes
// (/profile/privacy, /terms), which dropped a visitor out of the public site
// onto the staff side or a page-not-found. The label decides the destination
// for the known legal topics, so a stale stored href can never do that again;
// anything else is kept only if it stays on the customer site or is external.

const KNOWN_DESTINATIONS = [
  { match: /cookie/i, href: "/website/privacy#cookies" },
  { match: /complain/i, href: "/website/terms#complaints" },
  { match: /privacy|data protection|gdpr/i, href: "/website/privacy" },
  { match: /terms|conditions/i, href: "/website/terms" },
];

const isCustomerSafeHref = (href = "") =>
  href === "/website" ||
  href.startsWith("/website/") ||
  href.startsWith("/website#") ||
  href.startsWith("#") ||
  /^(https?:|mailto:|tel:)/i.test(href);

export const resolveLegalHref = (label = "", storedHref = "") => {
  const known = KNOWN_DESTINATIONS.find((entry) => entry.match.test(label));
  if (known) return known.href;
  return isCustomerSafeHref(storedHref) ? storedHref : "/website";
};

export const resolveLegalLinks = (legal) =>
  (Array.isArray(legal) ? legal : [])
    .map((entry) => {
      const label = typeof entry === "string" ? entry : entry?.label || "";
      const storedHref = typeof entry === "string" ? "" : entry?.href || "";
      return { label, href: resolveLegalHref(label, storedHref) };
    })
    .filter((entry) => entry.label);
