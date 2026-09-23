// file location: src/features/websiteManager/panels/LivePreviewPanel.js
//
// WYSIWYG editor for the public /website.
//
//   - Renders /website in an iframe with `?preview=editor`, which puts the
//     page into preview mode: every editable section becomes a clickable
//     overlay (see src/features/website/components/PreviewClickTarget).
//   - When the user clicks a section in the iframe, the iframe posts a
//     `hnp:section-selected` message back here; we load that section from
//     /api/website/sections/:section and open a SectionEditor in the side pane.
//   - As the user types in the editor, we forward each draft change to the
//     iframe via `hnp:content-patch` postMessages. The iframe's
//     useWebsiteContent hook applies the patch to its in-memory state, so the
//     change is visible immediately - no reload, no jump-to-tab.
//   - On Save, we PATCH the API and ask the iframe to refresh from the API so
//     the staff sees the canonical saved version.
//
// Most edits to /website content are meant to flow through here; the Pages &
// sections tab stays as the list-driven route for bulk work.

import React, { useCallback, useEffect, useRef, useState } from "react";
import Section from "@/components/Section";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import SectionEditor from "../editors/SectionEditor";
import { SECTION_SCHEMAS } from "../editors/sectionSchemas";
import {
  fetchSection,
  patchSingleton,
  patchRow,
  createRow,
  deleteRowApi,
} from "../websiteApi";
import { slugify } from "../helpers";
import { PREVIEW_MESSAGE_TYPES } from "@/features/website/hooks/useWebsitePreviewMode";

// The public site is a single scroller, so each "page" is an anchor on it.
const PAGES = [
  { key: "home", name: "Homepage", hash: "" },
  { key: "new-cars", name: "Cars", hash: "#cars" },
  { key: "offers", name: "Offers", hash: "#offers" },
  { key: "shop", name: "Shop", hash: "#shop" },
  { key: "sell-your-car", name: "Sell Your Car", hash: "#sell" },
  { key: "service-parts", name: "Service & Parts", hash: "#service" },
  { key: "motability", name: "Motability", hash: "#motability" },
  { key: "about", name: "About Us", hash: "#about" },
  { key: "blog", name: "Blog", hash: "#blog" },
  { key: "contact", name: "Contact", hash: "#contact" },
];

const DEVICES = [
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile", label: "Mobile" },
];

export default function LivePreviewPanel() {
  const [pageKey, setPageKey] = useState("home");
  const [device, setDevice] = useState("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [iframeReady, setIframeReady] = useState(false);
  const [selection, setSelection] = useState(null); // { sectionKey, rowId }
  const [sectionData, setSectionData] = useState(null);
  const [sectionRows, setSectionRows] = useState([]);
  const [loadingSection, setLoadingSection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);

  const activePage = PAGES.find((p) => p.key === pageKey) || PAGES[0];
  const src = `/website?preview=editor&v=${reloadKey}${activePage.hash}`;

  const postToIframe = useCallback((message) => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage(message, window.location.origin);
  }, []);

  // ---- listen for the iframe's selection events ---------------------------
  useEffect(() => {
    const handle = (event) => {
      if (event.origin !== window.location.origin) return;
      const msg = event?.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === PREVIEW_MESSAGE_TYPES.READY) {
        setIframeReady(true);
      } else if (msg.type === PREVIEW_MESSAGE_TYPES.SECTION_SELECTED) {
        setSelection({ sectionKey: msg.sectionKey, rowId: null });
      } else if (msg.type === PREVIEW_MESSAGE_TYPES.ROW_SELECTED) {
        setSelection({ sectionKey: msg.sectionKey, rowId: msg.rowId });
      }
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);

  // ---- load the section payload when selection changes ---------------------
  useEffect(() => {
    if (!selection?.sectionKey) {
      setSectionData(null);
      setSectionRows([]);
      return;
    }
    // A selection with `newRow` set is a local "add" — there is nothing to
    // fetch, the blank draft is already in sectionData.
    if (selection.newRow) return;
    setLoadingSection(true);
    setError(null);
    let active = true;
    (async () => {
      try {
        const data = await fetchSection(selection.sectionKey);
        if (!active) return;
        const schema = SECTION_SCHEMAS[selection.sectionKey];
        if (schema?.kind === "collection") {
          const list = Array.isArray(data) ? data : [];
          setSectionRows(list);
          // Focus the clicked row, else the first one.
          const focus = selection.rowId
            ? list.find((r) => r.id === selection.rowId)
            : list[0];
          setSectionData(focus || { status: "published" });
        } else {
          setSectionData(data || {});
          setSectionRows([]);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoadingSection(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selection]);

  // ---- highlight selected section inside iframe ---------------------------
  useEffect(() => {
    if (!iframeReady) return;
    postToIframe({
      type: PREVIEW_MESSAGE_TYPES.HIGHLIGHT,
      sectionKey: selection?.sectionKey || null,
    });
  }, [iframeReady, selection, postToIframe]);

  // ---- live-patch the iframe as user types --------------------------------
  const handleEditorChange = useCallback(
    (draft) => {
      if (!selection?.sectionKey) return;
      postToIframe({
        type: PREVIEW_MESSAGE_TYPES.PATCH,
        sectionKey: selection.sectionKey,
        rowId: selection.rowId,
        payload: draft,
      });
    },
    [selection, postToIframe]
  );

  const schema = selection?.sectionKey ? SECTION_SCHEMAS[selection.sectionKey] : null;

  // ---- save handlers -------------------------------------------------------
  const handleSave = async (draft) => {
    if (!selection?.sectionKey) return;
    setSaving(true);
    setError(null);
    try {
      if (schema?.kind === "collection") {
        if (selection.rowId) {
          await patchRow(selection.sectionKey, selection.rowId, draft);
        } else {
          // No existing row — this is a new one. Collection rows need a stable
          // text PK; derive it from the row label so staff never type an id.
          const next = { ...draft };
          if (!next.id) {
            const label = schema.rowLabel ? schema.rowLabel(next) : "";
            const base = slugify(label, selection.sectionKey);
            let candidate = base;
            let n = 2;
            while (sectionRows.some((r) => r.id === candidate)) candidate = `${base}-${n++}`;
            next.id = candidate;
          }
          if (next.sort_order == null) next.sort_order = sectionRows.length;
          await createRow(selection.sectionKey, next);
          // Re-select the saved row so the editor stops being an "add" form.
          setSelection({ sectionKey: selection.sectionKey, rowId: next.id });
        }
      } else {
        await patchSingleton(selection.sectionKey, draft);
      }
      // Ask the iframe to re-fetch so its state reflects the canonical save.
      postToIframe({ type: PREVIEW_MESSAGE_TYPES.REFRESH });
    } catch (err) {
      setError(err.message);
      throw err; // let SectionEditor surface it inline too
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selection?.sectionKey || !selection.rowId) return;
    if (!window.confirm("Delete this row? This cannot be undone.")) return;
    try {
      await deleteRowApi(selection.sectionKey, selection.rowId);
      setSelection(null);
      postToIframe({ type: PREVIEW_MESSAGE_TYPES.REFRESH });
      setReloadKey((n) => n + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddNewRow = () => {
    setSelection({ sectionKey: selection.sectionKey, rowId: null, newRow: true });
    setSectionData({ status: "published" });
  };

  const handleSwitchRow = (row) => {
    setSelection({ sectionKey: selection.sectionKey, rowId: row.id });
  };

  return (
    <>
      <Section title="Visual editor">
        <div className="website-manager__preview-toolbar">
          <TabGroup
            items={PAGES.map((page) => ({ value: page.key, label: page.name }))}
            value={pageKey}
            onChange={(value) => {
              setPageKey(value);
              setSelection(null);
            }}
            ariaLabel="Website preview page"
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
              setIframeReady(false);
              setSelection(null);
            }}
          >
            Reload preview
          </Button>
        </div>
      </Section>

      <Section title={activePage.name}>
        <div className="ws-editor-split">
          {/* ----- left: editor pane --------------------------------------- */}
          <div className="ws-editor-pane">
            {!selection && (
              <EmptyState
                variant="bare"
                icon="🖱"
                title="Click a section in the preview"
                description="Hover the site on the right and click any outlined region. Its editor opens here and your changes show live as you type."
              />
            )}

            {selection && loadingSection && <p className="website-manager__meta">Loading section…</p>}

            {error && (
              <div className="website-manager__notice website-manager__notice--warning" role="alert">
                {error}
              </div>
            )}

            {selection && !loadingSection && schema && (
              <>
                {schema.kind === "collection" && sectionRows.length > 0 && (
                  <LayerTheme gap="var(--space-2)">
                    <span className="website-manager__label">Rows in this section</span>
                    <div className="website-manager__chip-row">
                      {sectionRows.map((row) => (
                        <Button
                          key={row.id}
                          type="button"
                          size="xs"
                          variant={selection.rowId === row.id ? "primary" : "secondary"}
                          onClick={() => handleSwitchRow(row)}
                        >
                          {schema.rowLabel ? schema.rowLabel(row) : row.id}
                        </Button>
                      ))}
                      <Button type="button" size="xs" variant="secondary" onClick={handleAddNewRow}>
                        + New row
                      </Button>
                    </div>
                  </LayerTheme>
                )}

                <SectionEditor
                  schema={schema}
                  initialValue={sectionData || {}}
                  onChange={handleEditorChange}
                  onSave={handleSave}
                  onCancel={() => setSelection(null)}
                  onDelete={
                    schema.kind === "collection" && selection.rowId ? handleDelete : null
                  }
                  saveLabel={
                    schema.kind === "collection" && !selection.rowId
                      ? "Add to the site"
                      : "Save changes"
                  }
                />

                {saving && <p className="website-manager__meta">Saving…</p>}
              </>
            )}
          </div>

          {/* ----- right: iframe ------------------------------------------- */}
          <div className={`ws-editor-preview ws-editor-preview--${device}`}>
            <iframe ref={iframeRef} key={reloadKey} title="Website preview" src={src} />
            {!iframeReady && <p className="website-manager__meta">Preview loading…</p>}
          </div>
        </div>
      </Section>
    </>
  );
}
