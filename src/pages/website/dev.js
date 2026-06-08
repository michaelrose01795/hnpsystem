// file location: src/pages/website/dev.js
//
// ─────────────────────────────────────────────────────────────────────────────
//  /website/dev — CUSTGLOBAL SHOWCASE = SINGLE SOURCE OF TRUTH
// ─────────────────────────────────────────────────────────────────────────────
//  Mirror of /dev/user-diagnostic but for the CUSTOMER (/website) side of the
//  app. Every raw element rendered here is styled by `src/styles/custglobal.css`
//  via the `html.website-scope` selector toggled in `useWebsiteScope`.
//
//  Rules:
//    1. If you change how a customer-facing UI element looks here, propagate
//       the change to the matching rule in:
//         - src/styles/custglobal.css   (raw <button>/<select>/<input>/...,
//                                        .app-btn (Secondary action),
//                                        .website-banner,
//                                        .website-calendar, theme-insulation
//                                        + control-system token block at the
//                                        top of the file)
//         - src/styles/theme.css        (token values: --accentMainRgb, ...)
//       so the rest of the /website routes follow the showcase, not the other
//       way around. There are only TWO button styles on /website now —
//       Primary action (raw <button>, blue iOS-26 liquid glass) and Secondary
//       action (.app-btn, same chrome with a brand-red tint). Every other
//       interactive control reuses the Primary capsule (44px tall) so a
//       button, a date input, a select trigger and the file picker line up
//       on the same row.
//    2. Access is URL-only — this page is intentionally NOT linked from the
//       site nav, login, or profile. Type `/website/dev` into the address bar.
//       It is gated by `canShowDevPages()` so it disappears when dev tools
//       are turned off in production.
//    3. The `website-scope` class on <html> is what activates custglobal.css.
//       Without it, every element falls back to the staff design system.
//    4. Token swatches read computed values live via getComputedStyle, so if
//       the brand red ever changes in theme.css / custglobal.css, the
//       swatches update without anyone editing this file.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { canShowDevPages } from "@/lib/dev-tools/config";
import useWebsiteScope from "@/features/website/hooks/useWebsiteScope";
import WebsiteNativeSelect from "@/features/website/components/WebsiteNativeSelect";
import WebsiteNativeDateTimeInput from "@/features/website/components/WebsiteNativeDateTimeInput";
import {
  CustomerBadge,
  CustomerButton,
  CustomerCard,
  CustomerInput,
  CustomerModal,
  CustomerPageShell,
  CustomerSearchBar,
  CustomerSection,
  CustomerSelect,
  CustomerTable,
  CustomerTabs,
  CustomerToolbar,
} from "@/components/customer-global";

// /website light/dark/system theme cycle (mirrors src/pages/website/
// profile.js). The choice is persisted to localStorage and applied by
// writing data-website-theme onto <html>; custglobal.css repaints the
// showcase for whichever concrete theme is written. "system" resolves
// to a real light/dark value before the attribute is set.
const WEBSITE_THEME_KEY = "hnp-website-theme";
const WEBSITE_THEME_CYCLE = ["light", "dark", "system"];

const resolveWebsiteTheme = (preference) => {
  if (preference === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    return "dark";
  }
  return preference;
};

// Tokens we want to surface in the live token reference. These are the
// variables custglobal.css re-asserts under `html.website-scope` so the
// staff theme can't bleed into /website.
const PINNED_TOKENS = [
  { name: "--font-family", purpose: "App-wide font stack (Inter via next/font, SF Pro, system fallbacks) — shared with the staff app via theme.css" },
  { name: "--accentMain", purpose: "Brand red — fills, accents, logo wash" },
  { name: "--accentText", purpose: "Brand red text colour" },
  { name: "--primary", purpose: "Legacy alias of brand red" },
  { name: "--primary-hover", purpose: "Brand red, darkened for hover" },
  { name: "--primary-pressed", purpose: "Brand red, darkest for active/pressed" },
  { name: "--accentMainRgb", purpose: "Brand red as raw RGB triplet (for rgba(...))" },
  { name: "--onAccentText", purpose: "Text colour on top of a brand-red fill" },
  { name: "--surface", purpose: "Customer dark surface (#07070b)" },
  { name: "--surfaceMain", purpose: "Legacy alias of --surface" },
  { name: "--surfaceText", purpose: "Primary text on customer surface (white)" },
  { name: "--txt-bright", purpose: "Top-tier white text" },
  { name: "--txt-soft", purpose: "Secondary text (78% white)" },
  { name: "--txt-mute", purpose: "Muted text (55% white)" },
  { name: "--txt-faint", purpose: "Faintest text (32% white)" },
  { name: "--ghostbutton-ring", purpose: "Legacy outline token (buttons now use the liquid-glass capsule)" },
  { name: "--input-ring", purpose: "Legacy outline token (inputs now use the liquid-glass capsule)" },
  { name: "--checkbox-ring", purpose: "Outline for the radio group dot" },
  { name: "--focus-ring", purpose: "Keyboard-focus halo (box-shadow)" },
  { name: "--website-control-height", purpose: "Shared 44px height for buttons / inputs / select / file picker / banner" },
  { name: "--website-control-radius", purpose: "Shared corner radius for the liquid-glass capsule" },
  { name: "--website-field-gap", purpose: "Gap between stacked form fields (10px)" },
  { name: "--scrollbar-thumb", purpose: "Brand-red scrollbar thumb" },
  { name: "--scrollbar-thumb-hover", purpose: "Brand-red scrollbar thumb, hovered" },
];

// Read computed values from <html> after mount so the swatches reflect the
// actual cascade (insulation overrides + any dynamic theme noise).
function useComputedTokens(tokenNames) {
  const [values, setValues] = useState({});
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const next = {};
      tokenNames.forEach((name) => {
        next[name] = (cs.getPropertyValue(name) || "").trim();
      });
      setValues(next);
    };
    read();
    // Re-read once after a tick in case the theme provider applies inline
    // styles after the first paint.
    const id = window.setTimeout(read, 100);
    return () => window.clearTimeout(id);
  }, [tokenNames]);
  return values;
}

function ShowcaseSection({ id, title, wide, children }) {
  return (
    <section
      id={id}
      className={`website-dev-section${wide ? " website-dev-section--wide" : ""}`}
    >
      <header className="website-dev-section__header">
        <h2 className="website-dev-section__title">{title}</h2>
      </header>
      <div className="website-dev-section__body">{children}</div>
    </section>
  );
}

function Row({ label, children }) {
  return (
    <div className="website-dev-row">
      <div className="website-dev-row__label">{label}</div>
      <div className="website-dev-row__body">{children}</div>
    </div>
  );
}

function Swatch({ label, color, note, big }) {
  return (
    <div className="website-dev-swatch">
      <div
        className={`website-dev-swatch__chip${big ? " website-dev-swatch__chip--big" : ""}`}
        style={{ background: color }}
      />
      <div className="website-dev-swatch__meta">
        <div className="website-dev-swatch__label">{label}</div>
        {note ? <div className="website-dev-swatch__note">{note}</div> : null}
      </div>
    </div>
  );
}

function TokenRow({ name, value, purpose }) {
  // Build a visual swatch from the resolved value. If it's a colour-like
  // value (#hex, rgb, rgba) we can paint it directly. For comma-separated
  // RGB triplets, wrap them in rgb(). For non-colour tokens (rings,
  // shadows) we just show the resolved string with no swatch.
  const isColorLike =
    /^#[0-9a-f]{3,8}$/i.test(value) ||
    /^rgba?\(/i.test(value) ||
    /^hsla?\(/i.test(value);
  const isRgbTriplet = /^\d+\s*,\s*\d+\s*,\s*\d+$/.test(value);
  const swatchColor = isColorLike ? value : isRgbTriplet ? `rgb(${value})` : null;
  return (
    <tr>
      <td className="website-dev-token-cell website-dev-token-cell--chip">
        {swatchColor ? (
          <span className="website-dev-token-chip" style={{ background: swatchColor }} />
        ) : (
          <span className="website-dev-token-chip website-dev-token-chip--missing" />
        )}
      </td>
      <td className="website-dev-token-cell website-dev-token-cell--name">
        <code className="website-dev-code">{name}</code>
      </td>
      <td className="website-dev-token-cell website-dev-token-cell--value">
        <code className="website-dev-code-mono">{value || "(unset)"}</code>
      </td>
      <td className="website-dev-token-cell website-dev-token-cell--purpose">{purpose}</td>
    </tr>
  );
}

export default function WebsiteDevShowcasePage() {
  useWebsiteScope();

  const tokenNames = useMemo(() => PINNED_TOKENS.map((t) => t.name), []);
  const tokens = useComputedTokens(tokenNames);

  // Local state for the interactive controls.
  const [textValue, setTextValue] = useState("Michael Rose");
  const [textareaValue, setTextareaValue] = useState(
    "I'd like to book my Land Rover in for its annual service next week."
  );
  const [nativeSelectValue, setNativeSelectValue] = useState("service");
  const [dateValue, setDateValue] = useState("2026-05-21");
  const [timeValue, setTimeValue] = useState("09:30");
  const [radio, setRadio] = useState("standard");
  const [customerGlobalTab, setCustomerGlobalTab] = useState("profile");
  const [customerGlobalSearch, setCustomerGlobalSearch] = useState("Defender");
  const [customerGlobalModalOpen, setCustomerGlobalModalOpen] = useState(false);

  // Theme cycle preference: "light" | "dark" | "system". Defaults to
  // dark until the stored choice loads on mount.
  const [websiteThemePref, setWebsiteThemePref] = useState("dark");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(WEBSITE_THEME_KEY);
    if (stored && WEBSITE_THEME_CYCLE.includes(stored)) {
      setWebsiteThemePref(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const apply = () => {
      document.documentElement.setAttribute(
        "data-website-theme",
        resolveWebsiteTheme(websiteThemePref),
      );
    };
    apply();
    let media;
    if (websiteThemePref === "system" && window.matchMedia) {
      media = window.matchMedia("(prefers-color-scheme: light)");
      media.addEventListener("change", apply);
    }
    return () => {
      if (media) media.removeEventListener("change", apply);
      document.documentElement.removeAttribute("data-website-theme");
    };
  }, [websiteThemePref]);

  const cycleWebsiteTheme = () => {
    setWebsiteThemePref((prev) => {
      const idx = WEBSITE_THEME_CYCLE.indexOf(prev);
      const next = WEBSITE_THEME_CYCLE[(idx + 1) % WEBSITE_THEME_CYCLE.length];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(WEBSITE_THEME_KEY, next);
      }
      return next;
    });
  };

  if (!canShowDevPages()) {
    return (
      <div className="website-dev-locked">
        <h1 className="website-dev-locked__title">Not available</h1>
        <p className="website-dev-locked__body">This page is disabled in the current environment.</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>/website/dev — Customer UI Showcase</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="website-dev-shell">
        {/* Title row — page heading on the left, theme cycle button on
            the right. The wrapper takes the full grid row (same as the
            .website-dev-page-title span) so the button sits flush right. */}
        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <h1 className="website-dev-page-title" style={{ gridColumn: "auto" }}>
            Customer UI Showcase
          </h1>
          <button
            type="button"
            onClick={cycleWebsiteTheme}
            aria-label={`Theme: ${websiteThemePref}. Click to cycle light, dark, system.`}
          >
            {`Theme: ${websiteThemePref.charAt(0).toUpperCase()}${websiteThemePref.slice(1)}`}
          </button>
        </div>

        {/* ── Brand & surface ────────────────────────────────────── */}
        <ShowcaseSection
          id="brand"
          title="Brand & Surface"
        >
          <Row label="Brand red">
            <div className="website-dev-swatch-row">
              <Swatch label="--accentMain" color="#b91c1c" note="#b91c1c · the brand red" big />
              <Swatch label="--primary-hover" color="#981717" note="#981717" />
              <Swatch label="--primary-pressed" color="#7e1313" note="#7e1313" />
            </div>
          </Row>
          <Row label="Dark surface">
            <div className="website-dev-swatch-row">
              <Swatch label="--surface" color="#07070b" note="#07070b · body base" big />
              <Swatch
                label="Glass layer"
                color="rgba(255,255,255,0.04)"
                note="rgba(255,255,255,0.04) · cards"
              />
              <Swatch
                label="Glass hover"
                color="rgba(255,255,255,0.08)"
                note="rgba(255,255,255,0.08)"
              />
            </div>
          </Row>
          <Row label="Body wash">
            <div className="website-dev-wash-preview">
              <span className="website-dev-wash-caption">
                Brand-red glows in the top-right + bottom-left, with soft cool-grey glows
                in the top-left + bottom-right, all over #07070b. Defined in{" "}
                <code className="website-dev-code">html.website-scope body</code>.
              </span>
            </div>
          </Row>
          <Row label="Text scale">
            <div className="website-dev-text-scale">
              <span className="website-dev-text-bright">txt-bright · #ffffff</span>
              <span className="website-dev-text-soft">txt-soft · rgba(255,255,255,0.78)</span>
              <span className="website-dev-text-mute">txt-mute · rgba(255,255,255,0.55)</span>
              <span className="website-dev-text-faint">txt-faint · rgba(255,255,255,0.32)</span>
            </div>
          </Row>
        </ShowcaseSection>

        {/* ── Typography ─────────────────────────────────────────── */}
        <ShowcaseSection id="typography" title="Typography & Links">
          <Row label="Headings">
            <div>
              <h1 className="website-dev-heading-one">Heading 1 — page</h1>
              <h3 className="website-dev-heading-two">Heading 2 — sub-section</h3>
            </div>
          </Row>
          <Row label="Small / meta">
            <p className="website-dev-meta">
              Updated 2 minutes ago · Reference 8842-A
            </p>
          </Row>
          <Row label="Inline code">
            <p className="website-dev-copy">
              Open <code className="website-dev-code">/website/profile</code> to see the customer
              account.
            </p>
          </Row>
        </ShowcaseSection>

        {/* ── Buttons ────────────────────────────────────────────── */}
        <ShowcaseSection
          id="buttons"
          title="Buttons"
        >
          <Row label="Primary action">
            <div className="website-dev-cluster">
              <button type="button">Continue</button>
              <button type="button">Reschedule</button>
              <button type="button" disabled>
                Disabled
              </button>
            </div>
          </Row>
          <Row label="Secondary action (.app-btn)">
            <div className="website-dev-cluster">
              <button type="button" className="app-btn">
                Confirm
              </button>
              <button type="button" className="app-btn">
                Sign out
              </button>
              <button type="button" className="app-btn" disabled>
                Disabled
              </button>
            </div>
          </Row>
        </ShowcaseSection>

        {/* ── Form fields ────────────────────────────────────────── */}
        <ShowcaseSection
          id="inputs"
          title="Form Fields"
        >
          <Row label="Text Box">
            <input
              type="text"
              placeholder="Text Box"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </Row>
          <Row label="Textarea">
            <textarea
              className="website-dev-wide-control"
              placeholder="Tell us about your enquiry"
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
              rows={1}
            />
          </Row>
        </ShowcaseSection>

        {/* ── Selects ────────────────────────────────────────────── */}
        <ShowcaseSection
          id="selects"
          title="Selects"
        >
          <Row label="Native <select>">
            <div className="website-dev-control-width">
              <WebsiteNativeSelect
                value={nativeSelectValue}
                onChange={setNativeSelectValue}
                options={[
                  { value: "service", label: "Service Booking", hint: "Annual & interim" },
                  { value: "mot", label: "MOT Test", hint: "Class 4" },
                  { value: "valuation", label: "Vehicle Valuation" },
                  { value: "callback", label: "Call-back Request" },
                ]}
              />
            </div>
          </Row>
          <Row label="Disabled native">
            <div className="website-dev-control-width">
              <WebsiteNativeSelect
                disabled
                value="service"
                onChange={() => {}}
                options={[{ value: "service", label: "Service Booking" }]}
              />
            </div>
          </Row>
          <Row label="Inline Dropdown List (.website-native-select__menu)">
            <div className="website-dev-control-width">
              <ul
                role="listbox"
                aria-label="Booking type"
                className="website-native-select__menu website-dev-select-static"
              >
                <li role="option" aria-selected="false" className="website-native-select__option">
                  <span className="website-native-select__option-label">Service Booking</span>
                  <span className="website-native-select__option-hint">Annual &amp; interim</span>
                </li>
                <li
                  role="option"
                  aria-selected="true"
                  className="website-native-select__option website-native-select__option--selected"
                >
                  <span className="website-native-select__option-label">MOT Test</span>
                  <span className="website-native-select__option-hint">Class 4</span>
                </li>
                <li
                  role="option"
                  aria-selected="false"
                  className="website-native-select__option website-native-select__option--active"
                >
                  <span className="website-native-select__option-label">Vehicle Valuation</span>
                </li>
                <li role="option" aria-selected="false" className="website-native-select__option">
                  <span className="website-native-select__option-label">Call-back Request</span>
                </li>
              </ul>
            </div>
          </Row>
        </ShowcaseSection>

        {/* ── Date / time ────────────────────────────────────────── */}
        <ShowcaseSection
          id="dates"
          title="Date & Time"
        >
          <Row label='input type="date"'>
            <div className="website-dev-control-width">
              <WebsiteNativeDateTimeInput
                type="date"
                value={dateValue}
                onChange={setDateValue}
                placeholder="Pick a preferred date"
              />
            </div>
          </Row>
          <Row label='input type="time"'>
            <div className="website-dev-control-width">
              <WebsiteNativeDateTimeInput
                type="time"
                value={timeValue}
                onChange={setTimeValue}
                placeholder="Pick a preferred time"
              />
            </div>
          </Row>
          <Row label="Inline Calendar Surface (.website-calendar)">
            <div className="website-dev-calendar-preview">
              <div className="website-calendar website-dev-calendar-static">
                <div className="website-calendar__header">
                  <button type="button" className="website-calendar__nav">
                    ‹
                  </button>
                  <div className="website-calendar__title">May 2026</div>
                  <button type="button" className="website-calendar__nav">
                    ›
                  </button>
                </div>
                <div className="website-calendar__weekdays">
                  {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="website-calendar__grid">
                  {Array.from({ length: 35 }, (_, i) => {
                    const day = i - 3;
                    const inMonth = day >= 1 && day <= 31;
                    const isToday = day === 15;
                    const isSelected = day === 21;
                    // Sat / Sun are the last two columns (Mo–Su grid) — not selectable.
                    const isWeekend = i % 7 >= 5;
                    const cls = [
                      "website-calendar__day",
                      !inMonth && "website-calendar__day--muted",
                      isToday && "website-calendar__day--today",
                      isSelected && "website-calendar__day--selected",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={isWeekend}
                        className={cls}
                      >
                        {inMonth ? day : ""}
                      </button>
                    );
                  })}
                </div>
                <div className="website-calendar__footer">
                  <button type="button">Clear</button>
                  <button type="button" className="app-btn">Today</button>
                </div>
              </div>
            </div>
          </Row>
        </ShowcaseSection>

        {/* ── Choice controls ────────────────────────────────────── */}
        <ShowcaseSection
          id="choice"
          title="Radio Group"
        >
          <Row label="Radio group">
            <div className="website-dev-choice-list">
              {[
                { value: "standard", label: "Standard service" },
                { value: "premium", label: "Premium service" },
                { value: "motability", label: "Motability service" },
              ].map((opt) => (
                <label key={opt.value} className="website-dev-choice">
                  <input
                    type="radio"
                    name="customer-tier"
                    value={opt.value}
                    checked={radio === opt.value}
                    onChange={() => setRadio(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </Row>
        </ShowcaseSection>

        {/* ── File input ─────────────────────────────────────────── */}
        <ShowcaseSection
          id="file"
          title="File Input"
        >
          <Row label='input type="file"'>
            <input type="file" />
          </Row>
          <Row label="Multiple">
            <input type="file" multiple />
          </Row>
        </ShowcaseSection>

        {/* ── Cards / surfaces ───────────────────────────────────── */}
        <ShowcaseSection
          id="cards"
          title="Cards & Surfaces"
        >
          <Row label="Card">
            <div className="website-dev-flat-card">
              <p className="website-dev-card-eyebrow">Section wrapper</p>
              <h3 className="website-dev-card-title">Flat card</h3>
              <p className="website-dev-card-lead">
                Very faint white tint (rgba(255,255,255,0.03)), 18px radius, no
                backdrop blur. This is the only card style on /website — the
                same panel that wraps every section on this showcase page.
              </p>
            </div>
          </Row>
          <Row label="Banner / alert (.website-banner)">
            <div className="website-banner">
              <strong className="website-dev-banner-strong">MOT due 18 June 2026.</strong>
              <span className="website-dev-banner-copy">
                Book before the deadline to avoid a re-test fee.
              </span>
            </div>
          </Row>
        </ShowcaseSection>

        {/* ── Scrollable container (red scrollbar) ───────────────── */}
        <ShowcaseSection
          id="customer-global"
          title="Customer Global Components"
          wide
        >
          <CustomerPageShell
            title="Customer Global UI"
            subtitle="Reusable customer wrappers backed by the split customer-global CSS family."
            actions={
              <CustomerToolbar>
                <CustomerButton type="button" variant="secondary">Secondary</CustomerButton>
                <CustomerButton type="button" onClick={() => setCustomerGlobalModalOpen(true)}>Open modal</CustomerButton>
              </CustomerToolbar>
            }
          >
            <CustomerSection
              title="Controls"
              subtitle="Buttons, tabs, fields, search and badges stay under customer-global classes."
              action={<CustomerBadge tone="success">Global</CustomerBadge>}
            >
              <CustomerToolbar>
                <CustomerButton type="button">Primary</CustomerButton>
                <CustomerButton type="button" variant="secondary">Secondary</CustomerButton>
              </CustomerToolbar>
              <CustomerTabs
                tabs={[
                  { key: "profile", label: "Profile" },
                  { key: "vehicles", label: "Vehicles" },
                  { key: "bookings", label: "Bookings" },
                ]}
                activeKey={customerGlobalTab}
                onChange={setCustomerGlobalTab}
              />
              <CustomerToolbar>
                <CustomerInput label="Customer" name="customer-global-name" defaultValue="Alex Humphries" />
                <CustomerSelect
                  label="Request"
                  name="customer-global-request"
                  defaultValue="service"
                  options={[
                    { value: "service", label: "Service" },
                    { value: "mot", label: "MOT" },
                    { value: "repair", label: "Repair" },
                  ]}
                />
                <CustomerSearchBar
                  value={customerGlobalSearch}
                  onChange={(event) => setCustomerGlobalSearch(event.target.value)}
                  onClear={() => setCustomerGlobalSearch("")}
                  placeholder="Search customer UI"
                />
              </CustomerToolbar>
              <CustomerToolbar>
                <CustomerBadge tone="neutral">Neutral</CustomerBadge>
                <CustomerBadge tone="warning">Warning</CustomerBadge>
                <CustomerBadge tone="danger">Danger</CustomerBadge>
              </CustomerToolbar>
            </CustomerSection>

            <CustomerCard title="Flattened customer card" subtitle="Direct child of the customer page stack.">
              Customer screens can use this central wrapper without a page-specific card recipe.
            </CustomerCard>

            <CustomerSection layer="theme" title="Customer table" subtitle="Rows are rendered by the page; table chrome is global.">
              <CustomerTable
                columns={[
                  { key: "item", label: "Item" },
                  { key: "className", label: "Global class" },
                  { key: "status", label: "Status", render: (row) => <CustomerBadge tone={row.tone}>{row.status}</CustomerBadge> },
                ]}
                rows={[
                  { id: "button", item: "Button", className: ".customer-button", status: "Ready", tone: "success" },
                  { id: "card", item: "Card", className: ".customer-card", status: "Ready", tone: "success" },
                  { id: "modal", item: "Modal", className: ".customer-modal", status: "Previewed", tone: "warning" },
                ]}
              />
            </CustomerSection>

            <CustomerModal
              open={customerGlobalModalOpen}
              title="Customer global modal"
              onClose={() => setCustomerGlobalModalOpen(false)}
              actions={
                <>
                  <CustomerButton type="button" variant="secondary" onClick={() => setCustomerGlobalModalOpen(false)}>Cancel</CustomerButton>
                  <CustomerButton type="button" onClick={() => setCustomerGlobalModalOpen(false)}>Save</CustomerButton>
                </>
              }
            >
              Modal chrome is centralised through CustomerModal and customer-modals.css.
            </CustomerModal>
          </CustomerPageShell>
        </ShowcaseSection>

        <ShowcaseSection
          id="scrollbar"
          title="Scrollbar"
        >
          <Row label="Scroll container">
            <div className="website-dev-scroll-host">
              {Array.from({ length: 18 }, (_, i) => (
                <p key={i} className="website-dev-scroll-row">
                  Row {i + 1} — scroll vertically to expose the red thumb.
                </p>
              ))}
            </div>
          </Row>
        </ShowcaseSection>

        {/* ── Component reference ────────────────────────────────── */}
        <ShowcaseSection
          id="components"
          title="Component Reference"
          wide
        >
          <ul className="website-dev-ref-list">
            <li>
              <code className="website-dev-code">WebsiteNativeSelect</code> —{" "}
              <code className="website-dev-code-mono">
                src/features/website/components/WebsiteNativeSelect.js
              </code>
              <div className="website-dev-ref-note">
                Keeps a hidden native select for forms and renders the custom dark list.
              </div>
            </li>
            <li>
              <code className="website-dev-code">WebsiteNativeDateTimeInput</code> —{" "}
              <code className="website-dev-code-mono">
                src/features/website/components/WebsiteNativeDateTimeInput.js
              </code>
              <div className="website-dev-ref-note">
                Keeps hidden native date/time inputs and renders the custom calendar/time panels.
              </div>
            </li>
            <li>
              <code className="website-dev-code">useWebsiteScope</code> —{" "}
              <code className="website-dev-code-mono">
                src/features/website/hooks/useWebsiteScope.js
              </code>
              <div className="website-dev-ref-note">
                Adds <code className="website-dev-code">website-scope</code> to{" "}
                <code className="website-dev-code">&lt;html&gt;</code> while a /website page is
                mounted. <code className="website-dev-code">_app.js</code> also toggles this for
                any <code className="website-dev-code">/website/*</code> path.
              </div>
            </li>
            <li>
              <code className="website-dev-code">custglobal.css</code> —{" "}
              <code className="website-dev-code-mono">src/styles/custglobal.css</code>
              <div className="website-dev-ref-note">
                Theme insulation + raw element styling. Anything inside{" "}
                <code className="website-dev-code">html.website-scope</code> only applies on
                /website routes.
              </div>
            </li>
          </ul>
        </ShowcaseSection>

        {/* ── Live token reference (pinned to the bottom) ────────── */}
        <ShowcaseSection
          id="tokens"
          title="Live Token Reference"
          wide
        >
          <div className="website-dev-token-table-wrap">
            <table className="website-dev-token-table">
              <thead>
                <tr>
                  <th className="website-dev-token-th" />
                  <th className="website-dev-token-th">Token</th>
                  <th className="website-dev-token-th">Computed value</th>
                  <th className="website-dev-token-th">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {PINNED_TOKENS.map((t) => (
                  <TokenRow
                    key={t.name}
                    name={t.name}
                    value={tokens[t.name] || ""}
                    purpose={t.purpose}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </ShowcaseSection>
      </main>
    </>
  );
}

// Skip the persistent <Layout> shell (sidebar / app chrome) — /website routes
// render bare, like login.js and profile.js do.
WebsiteDevShowcasePage.getLayout = (page) => page;
