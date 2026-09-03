// file location: src/features/websiteManager/panels/SeoPanel.js
// SEO / meta details editor — per-page meta title, description, slug,
// canonical URL, social share image and search-engine indexing, with a live
// Google-style result preview.
import React, { useEffect, useMemo, useState } from "react";
import Section from "@/components/Section";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";

const RECOMMENDED_TITLE = 60;
const RECOMMENDED_DESC = 155;
const SITE_ORIGIN = "https://www.humphriesparks.co.uk";

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

  const dirty = useMemo(
    () => JSON.stringify(seo[selectedPageKey] || {}) !== JSON.stringify(draft),
    [seo, selectedPageKey, draft]
  );

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
  const counter = (len, max) => (
    <span className={len > max ? "website-manager__counter--over" : undefined}>
      {` (${len}/${max})`}
    </span>
  );

  return (
    <>
      <Section title="SEO and sharing">
        <div className="website-manager__toolbar">
          <DropdownField
            className="website-manager__toolbar-filter"
            label="Website page"
            value={selectedPageKey}
            onChange={(e) => setSelectedPageKey(e.target.value)}
            options={pages.map((p) => ({ value: p.key, label: p.name }))}
          />
        </div>

        {!selectedPage ? (
          <EmptyState
            variant="bare"
            title="No page selected"
            description="Choose a website page above to edit the meta details search engines and social networks show for it."
          />
        ) : (
          <LayerTheme gap="var(--space-3)">
            <label className="website-manager__field">
              <span className="website-manager__label">
                Meta title
                {counter(titleLen, RECOMMENDED_TITLE)}
              </span>
              <input
                className="app-input"
                value={draft.metaTitle || ""}
                onChange={(e) => patch({ metaTitle: e.target.value })}
                placeholder="Page title shown in search results"
              />
            </label>

            <label className="website-manager__field">
              <span className="website-manager__label">
                Meta description
                {counter(descLen, RECOMMENDED_DESC)}
              </span>
              <textarea
                className="app-input website-manager__textarea"
                rows={3}
                value={draft.metaDescription || ""}
                onChange={(e) => patch({ metaDescription: e.target.value })}
                placeholder="Short summary shown beneath the title in search results"
              />
            </label>

            <div className="website-manager__field-row">
              <label className="website-manager__field">
                <span className="website-manager__label">URL slug</span>
                <input
                  className="app-input"
                  value={draft.slug || ""}
                  onChange={(e) => patch({ slug: e.target.value })}
                  placeholder="/page-slug"
                />
              </label>
              <label className="website-manager__field website-manager__field--wide">
                <span className="website-manager__label">Canonical URL</span>
                <input
                  className="app-input"
                  value={draft.canonical || ""}
                  onChange={(e) => patch({ canonical: e.target.value })}
                  placeholder={`${SITE_ORIGIN}/…`}
                />
              </label>
            </div>

            <label className="website-manager__field">
              <span className="website-manager__label">Social share image</span>
              <input
                className="app-input"
                value={draft.ogImage || ""}
                onChange={(e) => patch({ ogImage: e.target.value })}
                placeholder="Filename from the Media library, e.g. homepage-hero.jpg"
              />
            </label>

            <label className="website-manager__bool">
              <input
                className="app-toggle--checkbox"
                type="checkbox"
                checked={Boolean(draft.indexed)}
                onChange={(e) => patch({ indexed: e.target.checked })}
              />
              <span>Allow search engines to index this page</span>
            </label>

            <LayerSurface
              className="website-manager__search-preview"
              radius="var(--radius-sm)"
              padding="var(--space-3)"
              gap="var(--space-1)"
            >
              <span className="website-manager__search-preview-url">
                {draft.canonical || `${SITE_ORIGIN}${draft.slug || "/"}`}
              </span>
              <strong>{draft.metaTitle || selectedPage.name}</strong>
              <span>
                {draft.metaDescription ||
                  "Add a meta description to preview the search result copy."}
              </span>
            </LayerSurface>

            <div className="website-manager__actions">
              <Button type="button" variant="primary" disabled={!dirty} onClick={handleSave}>
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

      <Section title="SEO overview">
        <div className="website-manager__toolbar">
          <input
            className="app-input"
            type="search"
            placeholder="Search pages…"
            aria-label="Search pages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {filteredPages.length === 0 ? (
          <EmptyState
            variant="bare"
            role="status"
            title="No pages match your search"
            description="Clear the search box to see every page's meta details."
          />
        ) : (
          <div className="website-manager__table-scroll">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Meta title</th>
                  <th>Slug</th>
                  <th>Indexing</th>
                </tr>
              </thead>
              <tbody>
                {filteredPages.map((p) => {
                  const entry = seo[p.key] || {};
                  return (
                    <tr key={p.key}>
                      <td className="website-manager__cell-strong">{p.name}</td>
                      <td className="website-manager__cell-muted">{entry.metaTitle || "—"}</td>
                      <td className="website-manager__cell-mono">{entry.slug || "—"}</td>
                      <td>
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
