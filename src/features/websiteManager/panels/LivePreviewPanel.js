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
// New and Used are the same `cars` block with a different starting filter,
// exactly as the public nav does it (src/features/website/data/navTabs.js).
//
// This tab is read-only for now. Editing content still lives in the Pages &
// sections tab, and the Design & layout tab keeps the WYSIWYG `?preview=editor`
// embed.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Section from "@/components/Section";
import Button from "@/components/ui/Button";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { PREVIEW_MESSAGE_TYPES } from "@/features/website/hooks/useWebsitePreviewMode";

// The whole site, then one tab per public nav entry (plus the homepage banner).
// `blocks` are layout row ids from WebsitePage's BLOCK_RENDERERS; `filter`
// seeds the Cars filter; `whole` means the full scrolling site instead.
const SECTION_TABS = [
  { key: "site", name: "Website", whole: true },
  { key: "home", name: "Homepage", blocks: ["hero", "brands"] },
  { key: "new", name: "New", blocks: ["cars"], filter: "new" },
  { key: "used", name: "Used", blocks: ["cars"], filter: "used" },
  { key: "offers", name: "Offers", blocks: ["offers"] },
  { key: "shop", name: "Shop", blocks: ["shop"] },
  { key: "sell", name: "Sell Your Car", blocks: ["sell"] },
  { key: "service", name: "Service & Parts", blocks: ["service"] },
  { key: "motability", name: "Motability", blocks: ["motability"] },
  { key: "about", name: "About Us", blocks: ["about", "reviews", "team"] },
  { key: "blog", name: "Blog", blocks: ["blog"] },
  { key: "contact", name: "Contact Us", blocks: ["contact"] },
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
    </>
  );
}
