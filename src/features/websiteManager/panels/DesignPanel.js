// file location: src/features/websiteManager/panels/DesignPanel.js
//
// "Design & layout" — the site-builder half of the Website Manager.
//
// Three sub-tabs, each editing one of the tables added by
// supabase/migrations/20260901120000_website_builder_nav_design_layout.sql:
//
//   Style     website_design          accent, spacing, corners, top-bar options
//   Top bar   website_nav             the public /website navigation links
//   Sections  website_section_layout  which blocks render, in what order, with
//                                     what heading copy and background tint
//
// The Style tab pairs the form with a live /website iframe and forwards every
// keystroke into it as a `hnp:content-patch`, so a colour or spacing change is
// visible on the real site before it is saved — the same mechanism the Visual
// editor tab uses for content.

import React, { useCallback, useEffect, useRef, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import SectionEditor from "../editors/SectionEditor";
import CollectionManager from "./CollectionManager";
import { BUILDER_SCHEMAS } from "../editors/sectionSchemas";
import { fetchSection, patchSingleton } from "../websiteApi";
import { PREVIEW_MESSAGE_TYPES } from "@/features/website/hooks/useWebsitePreviewMode";
import { design as WEBSITE_DESIGN_DEFAULTS } from "@/features/website/data/siteDesign";

const SUB_TABS = [
  { value: "style", label: "Style" },
  { value: "nav", label: "Top bar" },
  { value: "sections", label: "Sections" },
];

// Blocks WebsitePage has a renderer for. Staff can hide or reorder any of
// them and edit their heading copy, but deleting the row would leave the
// renderer orphaned, so the delete button is withheld.
// website_design column defaults, in DB (snake_case) shape. Mirrors the column
// defaults in the migration and the camelCase `design` object in
// src/features/website/data/siteDesign.js — that module is the single source
// for the literal values so the three copies cannot drift apart.
const DESIGN_COLUMN_DEFAULTS = {
  id: "default",
  accent_hex: WEBSITE_DESIGN_DEFAULTS.accentHex,
  accent_hover_hex: WEBSITE_DESIGN_DEFAULTS.accentHoverHex,
  default_theme: WEBSITE_DESIGN_DEFAULTS.defaultTheme,
  container_width: WEBSITE_DESIGN_DEFAULTS.containerWidth,
  corner_radius: WEBSITE_DESIGN_DEFAULTS.cornerRadius,
  button_radius: WEBSITE_DESIGN_DEFAULTS.buttonRadius,
  section_spacing: WEBSITE_DESIGN_DEFAULTS.sectionSpacing,
  nav_height: WEBSITE_DESIGN_DEFAULTS.navHeight,
  logo_height: WEBSITE_DESIGN_DEFAULTS.logoHeight,
  heading_font: WEBSITE_DESIGN_DEFAULTS.headingFont,
  nav_sticky: WEBSITE_DESIGN_DEFAULTS.navSticky,
  show_nav_phone: WEBSITE_DESIGN_DEFAULTS.showNavPhone,
  show_nav_account: WEBSITE_DESIGN_DEFAULTS.showNavAccount,
  show_brand_strip: WEBSITE_DESIGN_DEFAULTS.showBrandStrip,
};

const RENDERABLE_BLOCKS = [
  "hero",
  "brands",
  "cars",
  "offers",
  "shop",
  "sell",
  "service",
  "motability",
  "about",
  "reviews",
  "team",
  "blog",
  "contact",
];

export default function DesignPanel() {
  const [tab, setTab] = useState("style");

  return (
    <>
      <Section title="Design and layout">
        <TabGroup
          items={SUB_TABS}
          value={tab}
          onChange={setTab}
          ariaLabel="Design and layout sections"
        />
      </Section>

      {tab === "style" && <StyleTab />}

      {tab === "nav" && (
        <CollectionManager
          sectionKey="nav"
          schema={BUILDER_SCHEMAS.nav}
          title="Top bar links"
          addLabel="link"
          deriveId={(draft) => draft.label}
          columns={[
            { label: "Links to", render: (row) => row.href, className: "website-manager__cell-mono" },
            {
              label: "Car filter",
              render: (row) => row.filter || "—",
              className: "website-manager__cell-muted",
            },
          ]}
          emptyTitle="No navigation links"
          emptyDescription="The public site is showing its built-in navigation. Add a link to take control of the top bar."
        />
      )}

      {tab === "sections" && (
        <CollectionManager
          sectionKey="section-layout"
          schema={BUILDER_SCHEMAS["section-layout"]}
          title="Page sections"
          addLabel="section"
          deriveId={(draft) => draft.label}
          lockedIds={RENDERABLE_BLOCKS}
          columns={[
            { label: "Anchor", render: (row) => `#${row.anchor || row.id}`, className: "website-manager__cell-mono" },
            {
              label: "Heading",
              render: (row) => row.title || "—",
              className: "website-manager__cell-muted",
            },
            { label: "Tint", render: (row) => (row.tint ? "Tinted" : "Plain"), className: "website-manager__cell-muted" },
            {
              // A layout row only draws if WebsitePage has a renderer for its
              // block key. Surfacing that stops a hand-added row from looking
              // published while rendering nothing.
              label: "Renders",
              render: (row) =>
                RENDERABLE_BLOCKS.includes(row.id) ? (
                  <span className="app-badge app-badge--success app-badge--uppercase">Yes</span>
                ) : (
                  <span className="app-badge app-badge--warning app-badge--uppercase">
                    No renderer
                  </span>
                ),
            },
          ]}
          emptyTitle="No section layout rows"
          emptyDescription="The public site is falling back to its built-in section order. Apply the site-builder migration to take control of it here."
        />
      )}
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Style — the design singleton, with a live /website preview beside it     */
/* ---------------------------------------------------------------------- */

function StyleTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const row = await fetchSection("design");
        // Seed the form from the site defaults when the singleton row is
        // missing. Saving a blank form would otherwise write empty strings
        // into the design columns and repaint /website with no accent.
        if (active) setData({ ...DESIGN_COLUMN_DEFAULTS, ...(row || {}) });
      } catch (e) {
        if (active) setError(e?.message || "Design settings could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const postToIframe = useCallback((message) => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage(message, window.location.origin);
  }, []);

  // Forward each keystroke so the preview repaints before anything is saved.
  const handleChange = useCallback(
    (draft) => {
      postToIframe({
        type: PREVIEW_MESSAGE_TYPES.PATCH,
        sectionKey: "design",
        rowId: null,
        payload: draft,
      });
    },
    [postToIframe]
  );

  const handleSave = async (draft) => {
    const saved = await patchSingleton("design", draft);
    setData(saved || draft);
    postToIframe({ type: PREVIEW_MESSAGE_TYPES.REFRESH });
  };

  return (
    <Section title="Style">
      {error && (
        <div className="website-manager__notice website-manager__notice--warning" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <p className="website-manager__meta">Loading…</p>
      ) : (
        <div className="website-manager__design-split">
          <SectionEditor
            schema={BUILDER_SCHEMAS.design}
            initialValue={data || {}}
            onChange={handleChange}
            onSave={handleSave}
            saveLabel="Save design"
          />
          <div className="website-manager__design-preview">
            <div className="website-manager__actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setReloadKey((n) => n + 1)}
              >
                Reload preview
              </Button>
            </div>
            <iframe
              ref={iframeRef}
              key={reloadKey}
              title="Website design preview"
              src={`/website?preview=editor&v=${reloadKey}`}
            />
          </div>
        </div>
      )}
    </Section>
  );
}
