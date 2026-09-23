// file location: src/features/website/data/siteDesign.js
//
// Static fallback for the three site-builder slices (top bar, block running
// order, visual design). Same role as the other modules in this folder: these
// values render on the very first frame and whenever /api/website/content is
// unreachable, then the live rows from website_nav / website_section_layout /
// website_design replace them.
//
// These MUST stay in step with the seed block of
// supabase/migrations/20260901120000_website_builder_nav_design_layout.sql —
// they are the same data, one copy for the browser and one for the database.

export const navLinks = [
  { id: "new", label: "New", href: "#cars", filter: "new" },
  { id: "used", label: "Used", href: "#cars", filter: "used" },
  { id: "offers", label: "Offers", href: "#offers", filter: null },
  { id: "shop", label: "Shop", href: "#shop", filter: null },
  { id: "sell", label: "Sell Your Car", href: "#sell", filter: null },
  { id: "service", label: "Service & Parts", href: "#service", filter: null },
  { id: "motability", label: "Motability", href: "#motability", filter: null },
  { id: "about", label: "About Us", href: "#about", filter: null },
  { id: "blog", label: "Blog", href: "#blog", filter: null },
  { id: "contact", label: "Contact Us", href: "#contact", filter: null },
];

// `id` is the block key WebsitePage renders; `anchor` is the DOM id the nav
// scrolls to. They differ only for the hero, whose anchor is "top".
export const sectionLayout = [
  { id: "hero", label: "Hero banner", anchor: "top", eyebrow: null, title: null, lead: null, tint: false },
  {
    id: "brands",
    label: "Partner brand strip",
    anchor: "brands",
    eyebrow: null,
    title: "Authorised retailer for",
    lead: null,
    tint: true,
  },
  {
    id: "cars",
    label: "Featured vehicles",
    anchor: "cars",
    eyebrow: "Our Cars",
    title: "Find your next car at Humphries & Parks",
    lead: "Every used car arrives with a 120-point inspection, a minimum 6-month MOT and a free 6-month warranty. New Suzuki, KGM and Mitsubishi available with manufacturer offers.",
    tint: false,
  },
  {
    id: "offers",
    label: "Manufacturer offers",
    anchor: "offers",
    eyebrow: "Latest Offers",
    title: "Current manufacturer offers",
    lead: "Finance and savings available across the Suzuki range — speak to the team for full terms.",
    tint: true,
  },
  {
    id: "shop",
    label: "Shop",
    anchor: "shop",
    eyebrow: "Shop",
    title: "Parts & accessories",
    lead: "Genuine Suzuki, KGM and Mitsubishi parts and accessories — shipped UK-wide. Add to cart and checkout in minutes.",
    tint: true,
  },
  {
    id: "sell",
    label: "Sell Your Car",
    anchor: "sell",
    eyebrow: null,
    title: null,
    lead: "We buy any car — any age, any mileage, any make — with free home collection and instant payment.",
    tint: false,
  },
  { id: "service", label: "Service & Parts", anchor: "service", eyebrow: null, title: null, lead: null, tint: true },
  { id: "motability", label: "Motability", anchor: "motability", eyebrow: null, title: null, lead: null, tint: false },
  { id: "about", label: "About Us", anchor: "about", eyebrow: null, title: null, lead: null, tint: true },
  {
    id: "reviews",
    label: "Customer reviews",
    anchor: "reviews",
    eyebrow: "Reviews",
    title: "Why families across Kent keep coming back",
    lead: "Independently verified reviews from AutoTrader, JudgeService, Google and Trustpilot.",
    tint: false,
  },
  {
    id: "team",
    label: "Meet the team",
    anchor: "team",
    eyebrow: "Meet the Team",
    title: "The people behind Humphries & Parks",
    lead: "Three generations of family ownership and a team that treats every customer as one of our own.",
    tint: true,
  },
  {
    id: "blog",
    label: "Blog",
    anchor: "blog",
    eyebrow: "Blog",
    title: "Helpful guides for car buyers in Kent",
    lead: "Practical, plain-English advice from the showroom floor.",
    tint: false,
  },
  { id: "contact", label: "Contact", anchor: "contact", eyebrow: null, title: null, lead: null, tint: true },
];

export const design = {
  accentHex: "#b91c1c",
  accentHoverHex: "#981717",
  defaultTheme: "dark",
  containerWidth: "1200px",
  cornerRadius: "18px",
  buttonRadius: "999px",
  sectionSpacing: "comfortable",
  navHeight: "66px",
  logoHeight: "38px",
  headingFont: "system",
  navSticky: true,
  showNavPhone: true,
  showNavAccount: true,
  showBrandStrip: true,
};

// Section vertical rhythm. The `comfortable` value is exactly the clamp that
// was hard-coded on `.ws-section` in custglobal.css before design settings
// existed, so an unedited site renders byte-identically.
export const SECTION_SPACING_SCALE = {
  compact: "clamp(32px, 5vw, 64px)",
  comfortable: "clamp(56px, 8vw, 104px)",
  spacious: "clamp(80px, 11vw, 148px)",
};

export const HEADING_FONT_STACKS = {
  system: "",
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

// "#b91c1c" -> "185, 28, 28". custglobal.css uses --accentMainRgb inside
// rgba() for the primary button glow, so a hex alone is not enough.
export function hexToRgbTriplet(hex, fallback = "185, 28, 28") {
  if (typeof hex !== "string") return fallback;
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return fallback;
  const int = parseInt(match[1], 16);
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
}

/* ---------------------------------------------------------------------------
   design -> CSS custom properties applied to `.ws-page`.
   Returning a plain object (rather than a class) is what lets a single saved
   design value repaint the whole public site: every `.ws-*` rule in
   custglobal.css already reads these tokens.
--------------------------------------------------------------------------- */
export function designToCssVars(d) {
  const merged = { ...design, ...(d || {}) };
  const vars = {
    "--accentMain": merged.accentHex,
    "--accentText": merged.accentHex,
    "--primary": merged.accentHex,
    "--primary-hover": merged.accentHoverHex,
    "--accentMainRgb": hexToRgbTriplet(merged.accentHex),
    "--ws-maxw": merged.containerWidth,
    "--ws-radius": merged.cornerRadius,
    "--ws-btn-radius": merged.buttonRadius,
    "--ws-nav-h": merged.navHeight,
    "--ws-logo-h": merged.logoHeight,
    "--ws-section-pad":
      SECTION_SPACING_SCALE[merged.sectionSpacing] || SECTION_SPACING_SCALE.comfortable,
    "--ws-nav-position": merged.navSticky ? "sticky" : "relative",
  };
  const headingStack = HEADING_FONT_STACKS[merged.headingFont];
  if (headingStack) vars["--ws-heading-font"] = headingStack;
  return vars;
}
