// file location: src/features/websiteManager/panels/PageContentPanel.js
// Per-page content management: add / edit / delete / reorder / publish content
// blocks for any public website page (Homepage, New Cars, Used Cars, Offers,
// Sell Your Car, Service & Parts, Motability, About Us, Blog, Contact Us).
import React, { useEffect, useMemo, useState } from "react";
import Section from "@/components/Section";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import { BLOCK_TYPES } from "../websiteData";
import {
  StatusBadge,
  EmptyState,
  formatDateTime,
  cellStyle,
  headCellStyle,
} from "../helpers";

const EMPTY_DRAFT = {
  title: "",
  type: BLOCK_TYPES[0],
  summary: "",
  status: "draft",
};

export default function PageContentPanel({
  pages,
  content,
  initialPageKey,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlock,
  onMoveBlock,
  onToggleBlock,
  onTogglePageStatus,
}) {
  const [selectedPageKey, setSelectedPageKey] = useState(
    initialPageKey || pages[0]?.key || ""
  );
  const [query, setQuery] = useState("");
  // editor.mode: null (closed) | "add" | "edit"
  const [editor, setEditor] = useState({ mode: null, blockId: null, draft: EMPTY_DRAFT });

  // Honour the "Manage" jump from the Overview tab.
  useEffect(() => {
    if (initialPageKey) setSelectedPageKey(initialPageKey);
  }, [initialPageKey]);

  const selectedPage = pages.find((p) => p.key === selectedPageKey);
  const blocks = useMemo(
    () => content[selectedPageKey] || [],
    [content, selectedPageKey]
  );

  const filteredBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return blocks;
    return blocks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.type.toLowerCase().includes(q) ||
        b.summary.toLowerCase().includes(q)
    );
  }, [blocks, query]);

  const closeEditor = () =>
    setEditor({ mode: null, blockId: null, draft: EMPTY_DRAFT });

  const openAdd = () =>
    setEditor({ mode: "add", blockId: null, draft: EMPTY_DRAFT });

  const openEdit = (block) =>
    setEditor({
      mode: "edit",
      blockId: block.id,
      draft: {
        title: block.title,
        type: block.type,
        summary: block.summary,
        status: block.status,
      },
    });

  const setDraft = (patch) =>
    setEditor((prev) => ({ ...prev, draft: { ...prev.draft, ...patch } }));

  const handleSave = () => {
    const draft = {
      title: editor.draft.title.trim(),
      type: editor.draft.type,
      summary: editor.draft.summary.trim(),
      status: editor.draft.status,
    };
    if (!draft.title) {
      window.alert("Please enter a title for this content block.");
      return;
    }
    if (editor.mode === "add") {
      onAddBlock(selectedPageKey, draft);
    } else if (editor.mode === "edit") {
      onUpdateBlock(selectedPageKey, editor.blockId, draft);
    }
    closeEditor();
  };

  const handleDelete = (block) => {
    if (
      window.confirm(
        `Delete the content block "${block.title}"? This cannot be undone.`
      )
    ) {
      onDeleteBlock(selectedPageKey, block.id);
      if (editor.blockId === block.id) closeEditor();
    }
  };

  // Map the (possibly filtered) row back to its true index for reorder bounds.
  const trueIndex = (blockId) => blocks.findIndex((b) => b.id === blockId);

  return (
    <>
      <Section
        title="Page Content"
        subtitle="Choose a page, then add, edit, reorder, publish or remove its content blocks."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 240px" }}>
            <span
              style={{
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-1)",
                fontWeight: 700,
              }}
            >
              Website page
            </span>
            <select
              className="app-input"
              value={selectedPageKey}
              onChange={(e) => {
                setSelectedPageKey(e.target.value);
                closeEditor();
              }}
            >
              {pages.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {selectedPage && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusBadge status={selectedPage.status} />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onTogglePageStatus(selectedPage.key)}
              >
                {selectedPage.status === "published"
                  ? "Switch page to draft"
                  : "Publish page"}
              </Button>
            </div>
          )}
        </div>

        {selectedPage && (
          <div style={{ fontSize: "0.82rem", color: "var(--text-1)" }}>
            Route <span style={{ fontFamily: "monospace" }}>{selectedPage.route}</span>{" "}
            · {blocks.length} content block{blocks.length === 1 ? "" : "s"} ·{" "}
            {selectedPage.lastEditedAt
              ? `last edited by ${selectedPage.lastEditedBy} on ${formatDateTime(
                  selectedPage.lastEditedAt
                )}`
              : "live website content — not yet edited here"}
          </div>
        )}
      </Section>

      <Section title={`Content Blocks${selectedPage ? ` — ${selectedPage.name}` : ""}`}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <input
            className="app-input"
            type="search"
            placeholder="Search content blocks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: "1 1 220px", minWidth: 200 }}
          />
          <Button type="button" variant="primary" onClick={openAdd}>
            + Add content block
          </Button>
        </div>

        {/* Inline add / edit editor */}
        {editor.mode && (
          <LayerTheme padding="16px" gap="12px">
            <div style={{ fontWeight: 700, color: "var(--accentText)" }}>
              {editor.mode === "add" ? "New content block" : "Edit content block"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "2 1 260px" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-1)", fontWeight: 600 }}>
                  Title
                </span>
                <input
                  className="app-input"
                  value={editor.draft.title}
                  onChange={(e) => setDraft({ title: e.target.value })}
                  placeholder="e.g. Spring Service Promo"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-1)", fontWeight: 600 }}>
                  Block type
                </span>
                <select
                  className="app-input"
                  value={editor.draft.type}
                  onChange={(e) => setDraft({ type: e.target.value })}
                >
                  {BLOCK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-1)", fontWeight: 600 }}>
                  Status
                </span>
                <select
                  className="app-input"
                  value={editor.draft.status}
                  onChange={(e) => setDraft({ status: e.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-1)", fontWeight: 600 }}>
                Summary / content notes
              </span>
              <textarea
                className="app-input"
                rows={3}
                value={editor.draft.summary}
                onChange={(e) => setDraft({ summary: e.target.value })}
                placeholder="Describe what this block shows on the page."
                style={{ resize: "vertical" }}
              />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="button" variant="primary" onClick={handleSave}>
                {editor.mode === "add" ? "Add block" : "Save changes"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeEditor}>
                Cancel
              </Button>
            </div>
          </LayerTheme>
        )}

        {filteredBlocks.length === 0 ? (
          <EmptyState
            message={
              blocks.length === 0
                ? "This page has no content blocks yet. Use “Add content block” to create one."
                : "No content blocks match your search."
            }
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}
            >
              <thead>
                <tr>
                  <th style={{ ...headCellStyle, width: 48 }}>#</th>
                  <th style={headCellStyle}>Title</th>
                  <th style={headCellStyle}>Type</th>
                  <th style={headCellStyle}>Summary</th>
                  <th style={headCellStyle}>Status</th>
                  <th style={headCellStyle}>Last edited</th>
                  <th style={headCellStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBlocks.map((b) => {
                  const idx = trueIndex(b.id);
                  return (
                    <tr key={b.id}>
                      <td style={{ ...cellStyle, color: "var(--text-1)" }}>{idx + 1}</td>
                      <td style={{ ...cellStyle, fontWeight: 600 }}>{b.title}</td>
                      <td style={{ ...cellStyle, color: "var(--text-1)" }}>{b.type}</td>
                      <td style={{ ...cellStyle, color: "var(--text-1)", maxWidth: 320 }}>
                        {b.summary || "—"}
                      </td>
                      <td style={cellStyle}>
                        <StatusBadge status={b.status} />
                      </td>
                      <td style={{ ...cellStyle, color: "var(--text-1)" }}>
                        {b.lastEditedAt ? (
                          <>
                            {formatDateTime(b.lastEditedAt)}
                            <div style={{ fontSize: "0.74rem" }}>by {b.lastEditedBy}</div>
                          </>
                        ) : (
                          "Live content"
                        )}
                      </td>
                      <td style={cellStyle}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            disabled={idx <= 0}
                            onClick={() => onMoveBlock(selectedPageKey, b.id, -1)}
                            aria-label="Move up"
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            disabled={idx >= blocks.length - 1}
                            onClick={() => onMoveBlock(selectedPageKey, b.id, 1)}
                            aria-label="Move down"
                          >
                            ↓
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => openEdit(b)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => onToggleBlock(selectedPageKey, b.id)}
                          >
                            {b.status === "published" ? "Unpublish" : "Publish"}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="xs"
                            onClick={() => handleDelete(b)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
