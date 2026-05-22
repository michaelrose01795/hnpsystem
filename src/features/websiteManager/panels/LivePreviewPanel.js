// file location: src/features/websiteManager/panels/LivePreviewPanel.js
//
// WYSIWYG editor for the public /website.
//
//   - Renders /website in an iframe with `?preview=editor`, which puts the
//     page into preview mode: every editable section becomes a clickable
//     overlay (see src/features/website/components/PreviewClickTarget).
//   - When the user clicks a section in the iframe, the iframe posts a
//     `hnp:section-selected` message back here; we load that section from
//     /api/website/sections/:section and open a SectionEditor in the
//     side pane.
//   - As the user types in the editor, we forward each draft change to the
//     iframe via `hnp:content-patch` postMessages. The iframe's
//     useWebsiteContent hook applies the patch to its in-memory state, so
//     the change is visible immediately - no reload, no jump-to-tab.
//   - On Save, we PATCH the API and ask the iframe to refresh from the API
//     so the staff sees the canonical saved version.
//
// All edits to /website content are intended to flow through this panel - the
// classic Page Content tab is kept as a fallback for power users / bulk work.

import React, { useCallback, useEffect, useRef, useState } from "react";
import Section from "@/components/Section";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import SectionEditor from "../editors/SectionEditor";
import { SECTION_SCHEMAS } from "../editors/sectionSchemas";
import {
  fetchSection,
  patchSingleton,
  patchRow,
  createRow,
  deleteRowApi,
} from "../websiteApi";
import { PREVIEW_MESSAGE_TYPES } from "@/features/website/hooks/useWebsitePreviewMode";

const PAGES = [
  { key: "home", name: "Homepage", hash: "" },
  { key: "new-cars", name: "Cars", hash: "#cars" },
  { key: "offers", name: "Offers", hash: "#offers" },
  { key: "sell-your-car", name: "Sell Your Car", hash: "#sell" },
  { key: "service-parts", name: "Service & Parts", hash: "#service" },
  { key: "motability", name: "Motability", hash: "#motability" },
  { key: "about", name: "About Us", hash: "#about" },
  { key: "blog", name: "Blog", hash: "#blog" },
  { key: "contact", name: "Contact", hash: "#contact" },
  { key: "shop", name: "Shop", hash: "#shop" },
];

export default function LivePreviewPanel() {
  const [pageKey, setPageKey] = useState("home");
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
  const src = `/website${activePage.hash}?preview=editor&v=${reloadKey}`;

  const postToIframe = useCallback((message) => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage(message, window.location.origin);
  }, []);

  // ---- listen for the iframe's selection events ---------------------------
  useEffect(() => {
    const handle = (event) => {
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
    setLoadingSection(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchSection(selection.sectionKey);
        const schema = SECTION_SCHEMAS[selection.sectionKey];
        if (schema?.kind === "collection") {
          const list = Array.isArray(data) ? data : [];
          setSectionRows(list);
          // If a specific row was clicked, focus that row; otherwise the
          // first row.
          const focus = selection.rowId
            ? list.find((r) => r.id === selection.rowId)
            : list[0];
          setSectionData(focus || { status: "published" });
        } else {
          setSectionData(data || {});
          setSectionRows([]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingSection(false);
      }
    })();
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

  // ---- save handlers -------------------------------------------------------
  const handleSave = async (draft) => {
    if (!selection?.sectionKey) return;
    setSaving(true);
    setError(null);
    try {
      const schema = SECTION_SCHEMAS[selection.sectionKey];
      if (schema?.kind === "collection") {
        if (selection.rowId) {
          await patchRow(selection.sectionKey, selection.rowId, draft);
        } else {
          // No row chosen yet — treat as new row.
          await createRow(selection.sectionKey, draft);
        }
      } else {
        await patchSingleton(selection.sectionKey, draft);
      }
      // Ask the iframe to re-fetch so its state reflects the canonical save.
      postToIframe({ type: PREVIEW_MESSAGE_TYPES.REFRESH });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selection?.sectionKey || !selection.rowId) return;
    if (!window.confirm("Delete this row? This cannot be undone.")) return;
    await deleteRowApi(selection.sectionKey, selection.rowId);
    setSelection(null);
    postToIframe({ type: PREVIEW_MESSAGE_TYPES.REFRESH });
    setReloadKey((n) => n + 1);
  };

  const handleAddNewRow = () => {
    setSelection({ sectionKey: selection.sectionKey, rowId: null });
    setSectionData({ status: "published" });
  };

  const handleSwitchRow = (row) => {
    setSelection({ sectionKey: selection.sectionKey, rowId: row.id });
  };

  const schema = selection?.sectionKey
    ? SECTION_SCHEMAS[selection.sectionKey]
    : null;

  return (
    <>
      <Section
        title="Live Preview Editor"
        subtitle="Click any section of /website on the right to edit it. Changes appear live as you type. Save to commit."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PAGES.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={p.key === pageKey ? "primary" : "secondary"}
              onClick={() => {
                setPageKey(p.key);
                setSelection(null);
              }}
            >
              {p.name}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setReloadKey((n) => n + 1);
              setIframeReady(false);
              setSelection(null);
            }}
            style={{ marginLeft: "auto" }}
          >
            Reload preview
          </Button>
        </div>
      </Section>

      <Section title={`Preview — ${activePage.name}`}>
        <div className="ws-editor-split">
          {/* ----- left: editor pane --------------------------------------- */}
          <div className="ws-editor-pane">
            {!selection && (
              <LayerTheme padding="16px" gap="8px">
                <div style={{ fontWeight: 700, color: "var(--accentText)" }}>
                  Click a section on the right
                </div>
                <div style={{ color: "var(--text-1)", fontSize: "0.9rem" }}>
                  Hover the preview and click any outlined region — the matching
                  editor opens here and your changes show live as you type.
                </div>
              </LayerTheme>
            )}

            {selection && loadingSection && (
              <div style={{ color: "var(--text-1)" }}>Loading section…</div>
            )}

            {selection && !loadingSection && schema && (
              <>
                {schema.kind === "collection" && sectionRows.length > 0 && (
                  <LayerTheme padding="12px" gap="6px">
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-1)" }}>
                      Rows in this section
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {sectionRows.map((row) => (
                        <Button
                          key={row.id}
                          type="button"
                          size="xs"
                          variant={
                            selection.rowId === row.id ? "primary" : "secondary"
                          }
                          onClick={() => handleSwitchRow(row)}
                        >
                          {schema.rowLabel ? schema.rowLabel(row) : row.id}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        onClick={handleAddNewRow}
                      >
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
                    schema.kind === "collection" && selection.rowId
                      ? handleDelete
                      : null
                  }
                />

                {saving && (
                  <div style={{ color: "var(--text-1)" }}>Saving…</div>
                )}
                {error && (
                  <div style={{ color: "#d97706", fontWeight: 600 }}>
                    {error}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ----- right: iframe ------------------------------------------- */}
          <div className="ws-editor-preview">
            <iframe
              ref={iframeRef}
              key={reloadKey}
              title="Website preview"
              src={src}
              style={{
                width: "100%",
                height: "780px",
                display: "block",
                background: "var(--theme)",
                borderRadius: 8,
              }}
            />
            {!iframeReady && (
              <div style={{ color: "var(--text-1)", marginTop: 8 }}>
                Preview loading…
              </div>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
