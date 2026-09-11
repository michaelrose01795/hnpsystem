// file location: src/features/websiteManager/panels/LivePreviewPanel.js
//
// Preview tab for the public /website.
//
// The first tab, Website, is the whole site as a customer sees it — top bar,
// every block, footer — scrolling inside its frame (`?preview=site`).
//
// Every other tab is one entry of the public top nav, and shows the real
// content of that section directly underneath the tab row. Nothing is mocked
// up: the frame loads /website with `?preview=section&block=<id>`, which tells
// WebsitePage to draw that layout block ONLY, with no top bar, no footer and no
// editing overlays (see useWebsitePreviewMode). The embed reports its rendered
// height back here, so the frame grows to fit the section and there is no inner
// scrollbar — it reads as page content rather than a shrunken picture of the
// site.
//
// Under the frame sit the editors for exactly the sections that tab renders,
// and nothing else.
//
// Content ownership (2026-09-11). Every page SECTION is now owned by a code
// module under src/features/website/data — the register is
// @/features/website/data/codeOwnedContent. The public page ignores the
// website_* rows for those sections, so an editor here would save a row that
// never renders and quietly promise a change the site never makes. Each tab
// therefore splits its sections in two:
//   - code-owned  a "Set in code" note naming the exact file to edit
//   - editable    the site chrome that is still database-backed (brand
//                 identity and the footer, on the Website tab) —
//                 singletons edited in place, collections through the shared
//                 <CollectionManager> (add / edit / delete / reorder / hide)
// For the editable ones, every keystroke is forwarded into the frame as
// `hnp:content-patch`, so the change is visible in the section above before it
// is saved; saving PATCHes the API and sends `hnp:editor-refresh` so the frame
// re-reads the canonical row.
//
// New and Used are the same `cars` block with a different starting filter,
// exactly as the public nav does it (src/features/website/data/navTabs.js), and
// their editors list only the vehicles of that type.
//
// The Design & layout tab keeps the WYSIWYG `?preview=editor` embed for the
// site chrome, and Pages & sections stays the list-driven route for bulk work.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { PREVIEW_MESSAGE_TYPES } from "@/features/website/hooks/useWebsitePreviewMode";
import {
  CODE_OWNED_SECTIONS,
  isCodeOwnedSection,
} from "@/features/website/data/codeOwnedContent";
import { SECTION_SCHEMAS } from "../editors/sectionSchemas";
import SectionEditor from "../editors/SectionEditor";
import CollectionManager from "./CollectionManager";
import { fetchSection, patchSingleton } from "../websiteApi";

// The whole site, then one tab per public nav entry (plus the homepage banner).
//   blocks   layout row ids from WebsitePage's BLOCK_RENDERERS
//   filter   seeds the Cars New / Used filter
//   whole    the full scrolling site instead of a block list
//   sections schema keys (../editors/sectionSchemas) for the content that tab
//            draws, in the order it appears. Each is either code-owned (listed
//            under "Set in code" with its file) or still editable here.
//   rowFilter narrows a collection's row list to the rows this tab shows
//   rowDefaults seeds a new row so it belongs to this tab
//   emptyState shown when `sections` is empty — i.e. the tab's content is
//            owned somewhere this panel cannot reach at all (the Shop)
const SECTION_TABS = [
  { key: "site", name: "Website", whole: true, sections: ["brand", "footer"] },
  {
    key: "home",
    name: "Homepage",
    blocks: ["hero", "brands"],
    sections: ["hero", "trust-points", "partner-brands"],
  },
  // Cars are the DMS stock, reached through src/lib/stock/vehicleStock.js — a
  // car is added, priced, photographed or withdrawn in the DMS, never here.
  { key: "new", name: "New", blocks: ["cars"], filter: "new", sections: ["vehicles"] },
  { key: "used", name: "Used", blocks: ["cars"], filter: "used", sections: ["vehicles"] },
  {
    key: "offers",
    name: "Offers",
    blocks: ["offers"],
    sections: ["offers"],
  },
  {
    key: "shop",
    name: "Shop",
    blocks: ["shop"],
    sections: [],
    emptyState: {
      title: "Shop content is managed in the Shop tab",
      description:
        "Products, prices, stock and images for the shop live under Website manager → Shop. The heading above this block is set in Design and layout → Sections.",
    },
  },
  { key: "sell", name: "Sell Your Car", blocks: ["sell"], sections: ["sell-your-car"] },
  {
    key: "service",
    name: "Service & Parts",
    blocks: ["service"],
    sections: ["service-parts"],
  },
  {
    key: "motability",
    name: "Motability",
    blocks: ["motability"],
    sections: ["motability"],
  },
  {
    key: "about",
    name: "About Us",
    blocks: ["about", "reviews", "team"],
    sections: [
      "about",
      "timeline",
      "reviews",
      "ratings",
      "team-departments",
      "team-members",
    ],
  },
  { key: "blog", name: "Blog", blocks: ["blog"], sections: ["blog-posts"] },
  { key: "contact", name: "Contact Us", blocks: ["contact"], sections: ["contact"] },
];

const DEVICES = [
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile", label: "Mobile" },
];

// Starting height before the embed reports its own. Roughly one section tall,
// so the panel does not jump far once the real measurement lands.
const INITIAL_HEIGHT = 640;

export default function LivePreviewPanel() {
  const [tabKey, setTabKey] = useState("site");
  const [device, setDevice] = useState("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(INITIAL_HEIGHT);
  const iframeRef = useRef(null);

  const activeTab = useMemo(
    () => SECTION_TABS.find((tab) => tab.key === tabKey) || SECTION_TABS[0],
    [tabKey]
  );

  // Split what this tab covers into "edit it here" and "it lives in code".
  // Driven by the register rather than a hand-kept list, so a section that
  // ever moves back to the database grows its editor again on its own.
  const codeOwnedSections = useMemo(
    () => activeTab.sections.filter(isCodeOwnedSection),
    [activeTab]
  );
  const editableSections = useMemo(
    () => activeTab.sections.filter((key) => !isCodeOwnedSection(key)),
    [activeTab]
  );

  const src = useMemo(() => {
    if (activeTab.whole) {
      return `/website?preview=site&v=${reloadKey}`;
    }
    const params = new URLSearchParams({
      preview: "section",
      block: activeTab.blocks.join(","),
      v: String(reloadKey),
    });
    if (activeTab.filter) params.set("filter", activeTab.filter);
    return `/website?${params.toString()}`;
  }, [activeTab, reloadKey]);

  // Each tab loads a fresh document, so the old section's height must not be
  // carried over into the new one.
  const resetFrame = useCallback(() => {
    setReady(false);
    setHeight(INITIAL_HEIGHT);
  }, []);

  const postToFrame = useCallback((message) => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage(message, window.location.origin);
  }, []);

  // Draft keystroke -> the frame above, so the edit shows before it is saved.
  const handleDraftChange = useCallback(
    (sectionKey, rowId, draft) => {
      postToFrame({
        type: PREVIEW_MESSAGE_TYPES.PATCH,
        sectionKey,
        rowId: rowId || null,
        payload: draft,
      });
    },
    [postToFrame]
  );

  // Saved -> ask the frame to re-read the canonical content.
  const handleSaved = useCallback(() => {
    postToFrame({ type: PREVIEW_MESSAGE_TYPES.REFRESH });
  }, [postToFrame]);

  useEffect(() => {
    const handle = (event) => {
      if (event.origin !== window.location.origin) return;
      const msg = event?.data;
      if (!msg || typeof msg !== "object") return;
      // Only this panel's frame — other /website embeds post the same types.
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (msg.type === PREVIEW_MESSAGE_TYPES.READY) {
        setReady(true);
      } else if (msg.type === PREVIEW_MESSAGE_TYPES.HEIGHT && msg.height > 0) {
        setHeight(msg.height);
      }
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);

  return (
    <>
      <Section title="Preview">
        <div className="website-manager__preview-toolbar">
          <TabGroup
            items={SECTION_TABS.map((tab) => ({ value: tab.key, label: tab.name }))}
            value={tabKey}
            onChange={(value) => {
              setTabKey(value);
              resetFrame();
            }}
            ariaLabel="Website section"
          />
          <TabGroup
            items={DEVICES}
            value={device}
            onChange={setDevice}
            ariaLabel="Website preview device"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setReloadKey((n) => n + 1);
              resetFrame();
            }}
          >
            Reload
          </Button>
        </div>
      </Section>

      <Section title={activeTab.whole ? "Whole website" : activeTab.name}>
        <div
          className={`ws-section-view ws-section-view--${device}${
            activeTab.whole ? " ws-section-view--whole" : ""
          }`}
        >
          <iframe
            ref={iframeRef}
            key={src}
            title={activeTab.whole ? "Website" : `${activeTab.name} section`}
            src={src}
            /* A section frame is sized by the embed's own measurement so it
               never scrolls internally — layout only, so it stays clear of the
               inline-styling ban (CLAUDE.md §3.0b). The whole-site frame keeps
               its fixed height from CSS and scrolls like the real site. */
            style={activeTab.whole ? undefined : { height: `${height}px` }}
            scrolling={activeTab.whole ? undefined : "no"}
          />
        </div>
        {!ready && (
          <p className="website-manager__meta">
            {activeTab.whole ? "Loading website…" : "Loading section…"}
          </p>
        )}
      </Section>

      {/* The sections this tab draws that are owned by code — named, with the
          file to edit, so the route to changing them is obvious even though
          there is no form here. */}
      {codeOwnedSections.length > 0 && (
        <Section title="Set in code">
          <p className="website-manager__meta">
            {codeOwnedSections.length === 1
              ? "This section is built from the app's code, not the database. A developer edits the file below to add, remove, reorder or reword its items — the change goes live with the next release."
              : "These sections are built from the app's code, not the database. A developer edits the files below to add, remove, reorder or reword their items — the change goes live with the next release."}
          </p>
          <ul className="website-manager__bullets">
            {codeOwnedSections.map((sectionKey) => {
              const entry = CODE_OWNED_SECTIONS[sectionKey];
              return (
                <li key={sectionKey}>
                  {entry.label} —{" "}
                  <span className="website-manager__cell-mono">{entry.file}</span> (
                  {entry.export})
                </li>
              );
            })}
          </ul>
          <p className="website-manager__meta">
            The heading, lead and running order of every block are still yours:
            Design and layout → Sections.
          </p>
        </Section>
      )}

      {editableSections.length === 0 && codeOwnedSections.length === 0 ? (
        <Section title="Edit this section">
          <EmptyState
            variant="bare"
            title={activeTab.emptyState?.title || "Nothing to edit on this tab"}
            description={activeTab.emptyState?.description || ""}
          />
        </Section>
      ) : (
        editableSections.map((sectionKey) => {
          const schema = SECTION_SCHEMAS[sectionKey];
          if (!schema) return null;
          return schema.kind === "collection" ? (
            <CollectionManager
              key={`${activeTab.key}:${sectionKey}`}
              sectionKey={sectionKey}
              schema={schema}
              filterRow={activeTab.rowFilter}
              newRowDefaults={activeTab.rowDefaults || { status: "published" }}
              deriveId={(row) => (schema.rowLabel ? schema.rowLabel(row) : "")}
              onDraftChange={(draft, rowId) =>
                handleDraftChange(sectionKey, rowId, draft)
              }
              onChanged={handleSaved}
            />
          ) : (
            <LiveSingletonEditor
              key={`${activeTab.key}:${sectionKey}`}
              sectionKey={sectionKey}
              schema={schema}
              onDraftChange={handleDraftChange}
              onSaved={handleSaved}
            />
          );
        })
      )}
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Singleton section — one row, edited in place under the preview.   */
/* Kept open rather than behind an "Edit" button: on this tab the    */
/* form IS the point, and typing repaints the section above it.      */
/* ---------------------------------------------------------------- */

function LiveSingletonEditor({ sectionKey, schema, onDraftChange, onSaved }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const loaded = await fetchSection(sectionKey);
        if (!active) return;
        setData(loaded || {});
        setError("");
      } catch (e) {
        if (active) setError(e?.message || "This section could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [sectionKey]);

  // SectionEditor re-seeds its draft whenever this identity changes, so it must
  // not be a fresh object on every render.
  const initialValue = useMemo(() => data || {}, [data]);

  const handleSave = async (draft) => {
    const saved = await patchSingleton(sectionKey, draft);
    setData(saved || draft);
    onSaved?.();
  };

  return (
    <Section title={schema.label}>
      {error && (
        <div className="website-manager__notice website-manager__notice--warning" role="alert">
          {error}
        </div>
      )}
      {loading && <p className="website-manager__meta">Loading…</p>}
      {!loading && !error && (
        <SectionEditor
          schema={schema}
          initialValue={initialValue}
          onChange={(draft) => onDraftChange(sectionKey, null, draft)}
          onSave={handleSave}
        />
      )}
    </Section>
  );
}
