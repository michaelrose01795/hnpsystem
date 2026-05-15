// file location: src/features/websiteManager/panels/SeoPanel.js
// SEO / meta details editor — per-page meta title, description, slug,
// canonical URL, social share image and search-engine indexing.
import React, { useEffect, useMemo, useState } from "react";
import Section from "@/components/Section";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import { EmptyState, cellStyle, headCellStyle } from "../helpers";

const labelStyle = {
  fontSize: "0.72rem",
  color: "var(--text-1)",
  fontWeight: 600,
};

const RECOMMENDED_TITLE = 60;
const RECOMMENDED_DESC = 155;

export default function SeoPanel({ pages, seo, onUpdateSeo }) {
  const [selectedPageKey, setSelectedPageKey] = useState(pages[0]?.key || "");
  const [draft, setDraft] = useState(() => seo[pages[0]?.key] || {});
  const [query, setQuery] = useState("");

  // Reload the form whenever the chosen page changes.
  useEffect(() => {
    setDraft(seo[selectedPageKey] ? { ...seo[selectedPageKey] } : {});
  }, [selectedPageKey, seo]);

  const selectedPage = pages.find((p) => p.key === selectedPageKey);
  const patch = (p) => setDraft((prev) => ({ ...prev, ...p }));

  const dirty = useMemo(() => {
    const original = seo[selectedPageKey] || {};
    return JSON.stringify(original) !== JSON.stringify(draft);
  }, [seo, selectedPageKey, draft]);

  const handleSave = () => {
    onUpdateSeo(selectedPageKey, {
      metaTitle: (draft.metaTitle || "").trim(),
      metaDescription: (draft.metaDescription || "").trim(),
      slug: (draft.slug || "").trim(),
      canonical: (draft.canonical || "").trim(),
      ogImage: (draft.ogImage || "").trim(),
      indexed: Boolean(draft.indexed),
    });
  };

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (seo[p.key]?.metaTitle || "").toLowerCase().includes(q)
    );
  }, [pages, seo, query]);

  const titleLen = (draft.metaTitle || "").length;
  const descLen = (draft.metaDescription || "").length;

  return (
    <>
      <Section
        title="SEO & Meta Details"
        subtitle="Control how each page appears in search engines and when shared on social media."
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 300 }}>
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
            onChange={(e) => setSelectedPageKey(e.target.value)}
          >
            {pages.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {!selectedPage ? (
          <EmptyState message="Select a page to edit its SEO details." />
        ) : (
          <LayerTheme padding="16px" gap="12px">
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={labelStyle}>
                Meta title{" "}
                <span
                  style={{
                    color:
                      titleLen > RECOMMENDED_TITLE
                        ? "var(--warning-dark, var(--text-1))"
                        : "var(--text-1)",
                  }}
                >
                  ({titleLen}/{RECOMMENDED_TITLE})
                </span>
              </span>
              <input
                className="app-input"
                value={draft.metaTitle || ""}
                onChange={(e) => patch({ metaTitle: e.target.value })}
                placeholder="Page title shown in search results"
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={labelStyle}>
                Meta description{" "}
                <span
                  style={{
                    color:
                      descLen > RECOMMENDED_DESC
                        ? "var(--warning-dark, var(--text-1))"
                        : "var(--text-1)",
                  }}
                >
                  ({descLen}/{RECOMMENDED_DESC})
                </span>
              </span>
              <textarea
                className="app-input"
                rows={3}
                value={draft.metaDescription || ""}
                onChange={(e) => patch({ metaDescription: e.target.value })}
                placeholder="Short summary shown beneath the title in search results"
                style={{ resize: "vertical" }}
              />
            </label>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
                <span style={labelStyle}>URL slug</span>
                <input
                  className="app-input"
                  value={draft.slug || ""}
                  onChange={(e) => patch({ slug: e.target.value })}
                  placeholder="/page-slug"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "2 1 280px" }}>
                <span style={labelStyle}>Canonical URL</span>
                <input
                  className="app-input"
                  value={draft.canonical || ""}
                  onChange={(e) => patch({ canonical: e.target.value })}
                  placeholder="https://www.humphriesparks.co.uk/…"
                />
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={labelStyle}>Social share image (filename in Media Library)</span>
              <input
                className="app-input"
                value={draft.ogImage || ""}
                onChange={(e) => patch({ ogImage: e.target.value })}
                placeholder="e.g. homepage-hero.jpg"
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={Boolean(draft.indexed)}
                onChange={(e) => patch({ indexed: e.target.checked })}
              />
              <span style={{ fontSize: "0.88rem" }}>
                Allow search engines to index this page
              </span>
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <Button
                type="button"
                variant="primary"
                disabled={!dirty}
                onClick={handleSave}
              >
                Save SEO details
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!dirty}
                onClick={() => setDraft({ ...(seo[selectedPageKey] || {}) })}
              >
                Reset
              </Button>
            </div>
          </LayerTheme>
        )}
      </Section>

      <Section title="SEO Overview">
        <input
          className="app-input"
          type="search"
          placeholder="Search pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        {filteredPages.length === 0 ? (
          <EmptyState message="No pages match your search." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}
            >
              <thead>
                <tr>
                  <th style={headCellStyle}>Page</th>
                  <th style={headCellStyle}>Meta title</th>
                  <th style={headCellStyle}>Slug</th>
                  <th style={headCellStyle}>Indexing</th>
                </tr>
              </thead>
              <tbody>
                {filteredPages.map((p) => {
                  const entry = seo[p.key] || {};
                  return (
                    <tr key={p.key}>
                      <td style={{ ...cellStyle, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ ...cellStyle, color: "var(--text-1)" }}>
                        {entry.metaTitle || "—"}
                      </td>
                      <td style={{ ...cellStyle, color: "var(--text-1)", fontFamily: "monospace" }}>
                        {entry.slug || "—"}
                      </td>
                      <td style={cellStyle}>
                        <span
                          className={`app-badge ${
                            entry.indexed === false
                              ? "app-badge--neutral"
                              : "app-badge--success"
                          } app-badge--uppercase`}
                        >
                          {entry.indexed === false ? "No-index" : "Indexed"}
                        </span>
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
