// file location: src/features/website/hooks/useWebsiteContent.js
//
// Content source-of-truth for the public /website page.
//
// Strategy: render from the data modules under src/features/website/data/* on
// the very first frame (so there is no skeleton flash and the page survives the
// database being unreachable), then fetch /api/website/content on mount and
// swap in the live DB content for the parts of the tree the database still
// owns — the site chrome. Every page SECTION stays on its code module for the
// life of the page: see codeOwnedContent.js and mergeWithFallback below.
//
// Additionally, when /website is rendered inside the staff Live Preview editor
// iframe (?preview=editor), this hook listens for postMessage patches from the
// parent staff app and applies them to local state - that gives the WYSIWYG
// "type a field, see the change instantly in the preview" experience.

import { useEffect, useRef, useState } from "react";

import { siteContent as staticSiteContent } from "../data/siteContent";
import { vehicles as staticVehicles } from "../data/vehicles";
import { offers as staticOffers } from "../data/offers";
import { reviews as staticReviews } from "../data/reviews";
import { team as staticTeam, teamDepartments as staticTeamDepartments } from "../data/team";
import { timeline as staticTimeline } from "../data/timeline";
import { brands as staticBrands } from "../data/brands";
import { blogPosts as staticBlogPosts } from "../data/blogPosts";
import { partsContent as staticPartsContent } from "../data/partsContent";
import {
  navLinks as staticNavLinks,
  sectionLayout as staticSectionLayout,
  design as staticDesign,
} from "../data/siteDesign";
import {
  CODE_OWNED_COLLECTIONS,
  CODE_OWNED_SITE_CONTENT,
  isCodeOwnedSection,
} from "../data/codeOwnedContent";
import { PREVIEW_MESSAGE_TYPES } from "./useWebsitePreviewMode";

// Every page SECTION is now owned by the modules imported above, with the
// database deliberately out of the loop: whatever /api/website/content returns
// for these keys is discarded in mergeWithFallback, and Live Preview patches
// aimed at them are ignored. The register — which sections, and which file
// owns each one — is src/features/website/data/codeOwnedContent.js.
//
// What still comes from the database: the site chrome. Brand identity and the
// footer (siteContent.brand / siteContent.footer), the top-bar links, the
// block running order and heading copy, and the design tokens. Those keep
// their Website Manager editors.

const STATIC_FALLBACK = {
  siteContent: {
    ...staticSiteContent,
    partsContent: staticPartsContent,
  },
  vehicles: staticVehicles,
  offers: staticOffers,
  reviews: staticReviews,
  team: staticTeam,
  teamDepartments: staticTeamDepartments,
  timeline: staticTimeline,
  brands: staticBrands,
  blogPosts: staticBlogPosts,
  navLinks: staticNavLinks,
  sectionLayout: staticSectionLayout,
  design: staticDesign,
};

export default function useWebsiteContent() {
  const [content, setContent] = useState(STATIC_FALLBACK);
  const [source, setSource] = useState("static"); // "static" | "live"
  const fetched = useRef(false);

  // ---- Initial fetch from /api/website/content -----------------------------
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/website/content", {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json?.success || !json.data) return;
        setContent((prev) => mergeWithFallback(json.data, prev));
        setSource("live");
      } catch (err) {
        console.warn("[useWebsiteContent] live fetch failed, using static fallback:", err);
      }
    })();

    return () => {
      cancelled = true;
      // React StrictMode mounts effects twice in development. Without this
      // reset the FIRST run is the only one that ever fetches (the `fetched`
      // guard blocks the second), and its result is thrown away by the
      // `cancelled` check from this very cleanup — so the page sat on its
      // static fallback for the whole dev session no matter what was in the
      // database. Letting the second mount re-fetch costs one request and
      // keeps the guard doing its real job (no repeat fetch per re-render).
      fetched.current = false;
    };
  }, []);

  // ---- Live patches from the staff Live Preview editor ---------------------
  // When the iframe is in editor mode, the parent posts patches as the user
  // types. Apply them to the in-memory content tree so the change is visible
  // immediately. Also accept a REFRESH message to force a re-fetch.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handle = (event) => {
      const msg = event?.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === PREVIEW_MESSAGE_TYPES.PATCH) {
        setContent((prev) =>
          applyLivePatch(prev, msg.sectionKey, msg.payload, msg.rowId)
        );
      } else if (msg.type === PREVIEW_MESSAGE_TYPES.REFRESH) {
        refetchAndApply(setContent, setSource);
      }
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);

  return { content, source };
}

async function refetchAndApply(setContent, setSource) {
  try {
    const res = await fetch("/api/website/content", { credentials: "same-origin" });
    if (!res.ok) return;
    const json = await res.json();
    if (!json?.success || !json.data) return;
    setContent((prev) => mergeWithFallback(json.data, prev));
    setSource("live");
  } catch {
    /* silent */
  }
}

/* ============================================================================
   applyLivePatch
   ----------------------------------------------------------------------------
   Maps a Live Preview edit (one form's draft) onto the public content tree.
   Each schema sectionKey corresponds to either a slot under siteContent
   (singletons) or a top-level array (collections), with the column names
   re-mapped to the camelCase fields WebsitePage actually reads.
============================================================================ */

function applyLivePatch(prev, sectionKey, payload, rowId) {
  if (!sectionKey || !payload) return prev;
  // A code-owned section cannot be edited from the staff preview — showing
  // the typed value would promise a change the published page never makes.
  if (isCodeOwnedSection(sectionKey)) return prev;
  const next = { ...prev, siteContent: { ...prev.siteContent } };

  switch (sectionKey) {
    case "brand":
      next.siteContent.brand = {
        ...next.siteContent.brand,
        name: payload.name ?? next.siteContent.brand?.name,
        logoUrl: payload.logo_url ?? next.siteContent.brand?.logoUrl,
        logoWhiteUrl:
          payload.logo_white_url ?? next.siteContent.brand?.logoWhiteUrl,
      };
      return next;

    case "footer":
      next.siteContent.footer = {
        ...next.siteContent.footer,
        legal: payload.legal_links ?? next.siteContent.footer?.legal,
        fcaReg: payload.fca_reg ?? next.siteContent.footer?.fcaReg,
        creditDisclosure:
          payload.credit_disclosure ??
          next.siteContent.footer?.creditDisclosure,
      };
      return next;

    /* ------------------- site builder (chrome) ------------------ */

    case "nav": {
      const list = ensureList(prev.navLinks).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        id: row.id,
        label: row.label,
        href: row.href,
        filter: row.filter || null,
      }));
      next.navLinks = list;
      return next;
    }

    case "section-layout": {
      const list = ensureList(prev.sectionLayout).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        id: row.id,
        label: row.label,
        anchor: row.anchor || row.id,
        eyebrow: row.eyebrow || null,
        title: row.title || null,
        lead: row.lead || null,
        tint: Boolean(row.tint),
      }));
      next.sectionLayout = list;
      return next;
    }

    // Design is a singleton, so the whole draft maps straight onto the design
    // slot. Columns absent from the draft keep their current value.
    case "design":
      next.design = {
        ...prev.design,
        accentHex: payload.accent_hex ?? prev.design?.accentHex,
        accentHoverHex: payload.accent_hover_hex ?? prev.design?.accentHoverHex,
        defaultTheme: payload.default_theme ?? prev.design?.defaultTheme,
        containerWidth: payload.container_width ?? prev.design?.containerWidth,
        cornerRadius: payload.corner_radius ?? prev.design?.cornerRadius,
        buttonRadius: payload.button_radius ?? prev.design?.buttonRadius,
        sectionSpacing: payload.section_spacing ?? prev.design?.sectionSpacing,
        navHeight: payload.nav_height ?? prev.design?.navHeight,
        logoHeight: payload.logo_height ?? prev.design?.logoHeight,
        headingFont: payload.heading_font ?? prev.design?.headingFont,
        navSticky: payload.nav_sticky ?? prev.design?.navSticky,
        showNavPhone: payload.show_nav_phone ?? prev.design?.showNavPhone,
        showNavAccount: payload.show_nav_account ?? prev.design?.showNavAccount,
        showBrandStrip: payload.show_brand_strip ?? prev.design?.showBrandStrip,
      };
      return next;

    default:
      return prev;
  }
}

const ensureList = (v) => (Array.isArray(v) ? v : []);

// Update an existing row in-place, or insert if missing. The mapper turns
// snake_case DB columns into the camelCase fields WebsitePage reads.
function applyRowPatch(list, rowId, payload, mapper) {
  if (!rowId) return;
  const mapped = mapper(payload);
  const idx = list.findIndex(
    (r) => r?.id === rowId || r?.year === rowId // timeline uses year as semantic id
  );
  if (idx >= 0) list[idx] = { ...list[idx], ...mapped };
  else list.push(mapped);
}

function mergeWithFallback(live, fallback) {
  const out = { ...fallback, ...live };
  // Code-owned sections ignore the API payload entirely, so a stale or
  // half-populated website_* table can never reach the page — and an empty
  // array in code means the section is empty on the site, not "fall back to
  // whatever the database still holds".
  CODE_OWNED_COLLECTIONS.forEach((key) => {
    out[key] = fallback[key];
  });
  out.siteContent = { ...fallback.siteContent, ...(live.siteContent || {}) };
  CODE_OWNED_SITE_CONTENT.forEach((slot) => {
    out.siteContent[slot] = fallback.siteContent[slot];
  });
  const fillEmpty = (key) => {
    const v = live[key];
    if (!Array.isArray(v) || v.length === 0) out[key] = fallback[key];
  };
  [
    // Builder collections. An empty array here means the builder migration has
    // not been applied (or every row is draft) — fall back rather than render
    // a site with no navigation and no sections.
    "navLinks",
    "sectionLayout",
  ].forEach(fillEmpty);
  // Design is a singleton and comes back null when the table is missing.
  // Field-level merge so a partially-populated row still gets sane defaults.
  out.design = { ...fallback.design, ...(live.design || {}) };
  return out;
}
