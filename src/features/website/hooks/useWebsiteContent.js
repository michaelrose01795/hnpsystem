// file location: src/features/website/hooks/useWebsiteContent.js
//
// Content source-of-truth for the public /website page.
//
// Strategy: render from the static data modules under src/features/website/data/*
// on the very first frame (so there is no skeleton flash and the page survives
// the database being unreachable), then fetch /api/website/content on mount
// and swap in the live DB content when it arrives.
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
import { PREVIEW_MESSAGE_TYPES } from "./useWebsitePreviewMode";

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

    case "hero":
      next.siteContent.hero = {
        ...next.siteContent.hero,
        eyebrow: payload.eyebrow ?? next.siteContent.hero?.eyebrow,
        headline: payload.headline ?? next.siteContent.hero?.headline,
        subhead: payload.subhead ?? next.siteContent.hero?.subhead,
        backgroundUrl:
          payload.background_url ?? next.siteContent.hero?.backgroundUrl,
        ctas: payload.ctas ?? next.siteContent.hero?.ctas,
      };
      return next;

    case "about":
      next.siteContent.about = {
        ...next.siteContent.about,
        eyebrow: payload.eyebrow ?? next.siteContent.about?.eyebrow,
        title: payload.title ?? next.siteContent.about?.title,
        body: payload.body ?? next.siteContent.about?.body,
        imageUrl: payload.image_url ?? next.siteContent.about?.imageUrl,
      };
      return next;

    case "sell-your-car":
      next.siteContent.sellYourCar = {
        ...next.siteContent.sellYourCar,
        eyebrow: payload.eyebrow ?? next.siteContent.sellYourCar?.eyebrow,
        title: payload.title ?? next.siteContent.sellYourCar?.title,
        steps: payload.steps ?? next.siteContent.sellYourCar?.steps,
        benefits: payload.benefits ?? next.siteContent.sellYourCar?.benefits,
        cta: {
          label:
            payload.cta_label ?? next.siteContent.sellYourCar?.cta?.label,
          href: payload.cta_href ?? next.siteContent.sellYourCar?.cta?.href,
        },
      };
      return next;

    case "service-parts":
      next.siteContent.serviceAndParts = {
        ...next.siteContent.serviceAndParts,
        eyebrow:
          payload.eyebrow ?? next.siteContent.serviceAndParts?.eyebrow,
        title: payload.title ?? next.siteContent.serviceAndParts?.title,
        body: payload.body ?? next.siteContent.serviceAndParts?.body,
        hours: payload.hours ?? next.siteContent.serviceAndParts?.hours,
        imageUrl:
          payload.image_url ?? next.siteContent.serviceAndParts?.imageUrl,
      };
      return next;

    case "motability":
      next.siteContent.motability = {
        ...next.siteContent.motability,
        eyebrow: payload.eyebrow ?? next.siteContent.motability?.eyebrow,
        title: payload.title ?? next.siteContent.motability?.title,
        body: payload.body ?? next.siteContent.motability?.body,
        payments:
          payload.payments ?? next.siteContent.motability?.payments,
        rangeBrands:
          payload.range_brands ?? next.siteContent.motability?.rangeBrands,
        cta: {
          label: payload.cta_label ?? next.siteContent.motability?.cta?.label,
          href: payload.cta_href ?? next.siteContent.motability?.cta?.href,
        },
      };
      return next;

    case "parts-content":
      next.siteContent.partsContent = {
        ...next.siteContent.partsContent,
        eyebrow:
          payload.eyebrow ?? next.siteContent.partsContent?.eyebrow,
        title: payload.title ?? next.siteContent.partsContent?.title,
        body: payload.body ?? next.siteContent.partsContent?.body,
        brands: payload.brands ?? next.siteContent.partsContent?.brands,
      };
      return next;

    case "contact":
      next.siteContent.contact = {
        ...next.siteContent.contact,
        eyebrow: payload.eyebrow ?? next.siteContent.contact?.eyebrow,
        title: payload.title ?? next.siteContent.contact?.title,
        phone: payload.phone ?? next.siteContent.contact?.phone,
        phoneHref:
          payload.phone_href ?? next.siteContent.contact?.phoneHref,
        address: payload.address ?? next.siteContent.contact?.address,
        salesHours:
          payload.sales_hours ?? next.siteContent.contact?.salesHours,
        serviceHours:
          payload.service_hours ?? next.siteContent.contact?.serviceHours,
        socials: payload.socials ?? next.siteContent.contact?.socials,
        mapEmbed:
          payload.map_embed ?? next.siteContent.contact?.mapEmbed,
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

    /* ----------------------- collections ------------------------ */

    case "trust-points": {
      const list = ensureList(prev.siteContent.trustPoints).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        value: row.value,
        label: row.label,
      }));
      next.siteContent.trustPoints = list;
      return next;
    }

    case "ratings": {
      const list = ensureList(prev.siteContent.ratings).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        source: row.source,
        score: row.score,
      }));
      next.siteContent.ratings = list;
      return next;
    }

    case "partner-brands": {
      const list = ensureList(prev.brands).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        name: row.name,
        logo: row.logo_url,
      }));
      next.brands = list;
      return next;
    }

    case "vehicles": {
      const list = ensureList(prev.vehicles).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        id: row.id,
        type: row.vehicle_type,
        brand: row.brand,
        model: row.model,
        year: row.year,
        price: row.price_text,
        miles: row.miles,
        badge: row.badge,
        image: row.image_url,
      }));
      next.vehicles = list;
      return next;
    }

    case "offers": {
      const list = ensureList(prev.offers).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        id: row.id,
        title: row.title,
        headline: row.headline,
        body: row.body,
        image: row.image_url,
      }));
      next.offers = list;
      return next;
    }

    case "reviews": {
      const list = ensureList(prev.reviews).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        id: row.id,
        name: row.customer_name,
        rating: row.rating,
        source: row.source,
        date: row.review_date,
        quote: row.quote,
      }));
      next.reviews = list;
      return next;
    }

    case "team-members": {
      const list = ensureList(prev.team).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        department: row.department_id,
        photo: row.photo_url,
      }));
      next.team = list;
      return next;
    }

    case "team-departments": {
      const list = ensureList(prev.teamDepartments).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        id: row.id,
        label: row.label,
      }));
      next.teamDepartments = list;
      return next;
    }

    case "timeline": {
      const list = ensureList(prev.timeline).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        year: row.year,
        title: row.title,
        body: row.body,
      }));
      next.timeline = list;
      return next;
    }

    case "blog-posts": {
      const list = ensureList(prev.blogPosts).slice();
      applyRowPatch(list, rowId, payload, (row) => ({
        id: row.id,
        title: row.title,
        date: row.post_date,
        excerpt: row.excerpt,
        body: row.body,
        image: row.image_url,
      }));
      next.blogPosts = list;
      return next;
    }

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
  out.siteContent = { ...fallback.siteContent, ...(live.siteContent || {}) };
  const fillEmpty = (key) => {
    const v = live[key];
    if (!Array.isArray(v) || v.length === 0) out[key] = fallback[key];
  };
  ["vehicles", "offers", "reviews", "team", "teamDepartments", "timeline", "brands", "blogPosts"].forEach(
    fillEmpty
  );
  return out;
}
