// file location: src/features/websiteManager/panels/OverviewPanel.js
// Website pages overview + publish/status monitoring.
//
// Presentation follows the standard staff page contract: <Section> cards, the
// canonical <EmptyState>, `.app-data-table` for tables (which supplies its own
// cell padding and row rules) and `.website-manager__*` classes for anything
// bespoke. No inline visual styling.
import React, { useEffect, useMemo, useState } from "react";
import Section from "@/components/Section";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { SECTIONS_BY_PAGE } from "../editors/sectionSchemas";
import { fetchSection } from "../websiteApi";
import { fetchProducts, fetchOrders } from "../shopApi";
import { StatusBadge, StatCard, formatDateTime } from "../helpers";

export default function OverviewPanel({
  pages,
  seo,
  media,
  activity,
  onTogglePageStatus,
  onOpenPage,
}) {
  // Section count per page is derived from the editor schema map — the generic
  // "block" abstraction was retired in Phase 2.
  const sectionCounts = useMemo(
    () =>
      Object.fromEntries(
        pages.map((p) => [p.key, (SECTIONS_BY_PAGE[p.key] || []).length])
      ),
    [pages]
  );

  // Live stock counts. Vehicles + offers come from website_*; products and
  // orders come from shop_*. Low-stock = stock_qty < 5 && published.
  const [stock, setStock] = useState({
    vehicles: null,
    offers: null,
    products: null,
    lowStock: [],
    pendingOrders: null,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const [vehicles, offers, products, orders] = await Promise.all([
        fetchSection("vehicles").catch(() => []),
        fetchSection("offers").catch(() => []),
        fetchProducts().catch(() => []),
        fetchOrders().catch(() => []),
      ]);
      if (!active) return;
      setStock({
        vehicles: (vehicles || []).filter((v) => v.status === "published").length,
        offers: (offers || []).filter((o) => o.status === "published").length,
        products: (products || []).filter((p) => p.status === "published").length,
        lowStock: (products || []).filter(
          (p) => p.status === "published" && p.stock_qty < 5
        ),
        pendingOrders: (orders || []).filter(
          (o) => o.status === "paid" || o.status === "fulfilling"
        ).length,
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const stats = useMemo(() => {
    const todayKey = new Date().toDateString();
    const published = pages.filter((p) => p.status === "published").length;
    return {
      published,
      drafts: pages.length - published,
      changesToday: activity.filter((a) => new Date(a.at).toDateString() === todayKey)
        .length,
      notIndexed: pages.filter((p) => seo[p.key] && seo[p.key].indexed === false).length,
    };
  }, [pages, activity, seo]);

  const draftPages = pages.filter((p) => p.status === "draft");

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pages.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.route.toLowerCase().includes(q);
    });
  }, [pages, query, statusFilter]);

  const count = (v) => (v == null ? "…" : v);

  return (
    <>
      <Section title="Publish and status">
        <div className="website-manager__stat-grid">
          <StatCard label="Total pages" value={pages.length} />
          <StatCard label="Published" value={stats.published} />
          <StatCard label="In draft" value={stats.drafts} />
          <StatCard label="Media assets" value={media.length} />
          <StatCard label="Changes today" value={stats.changesToday} />
          <StatCard label="Not indexed" value={stats.notIndexed} />
        </div>

        <div className="website-manager__stat-grid">
          <StatCard label="Vehicles live" value={count(stock.vehicles)} />
          <StatCard label="Offers live" value={count(stock.offers)} />
          <StatCard label="Products live" value={count(stock.products)} />
          <StatCard label="Orders to fulfil" value={count(stock.pendingOrders)} />
        </div>

        {stock.lowStock.length > 0 && (
          <LayerTheme gap="var(--space-2)">
            <span className="website-manager__editor-title">Low stock</span>
            <div className="website-manager__chip-row">
              {stock.lowStock.map((p) => (
                <span
                  key={p.id}
                  className="app-badge app-badge--warning"
                  title={`SKU ${p.sku || p.id}`}
                >
                  {p.name} — {p.stock_qty} left
                </span>
              ))}
            </div>
          </LayerTheme>
        )}

        {draftPages.length > 0 && (
          <LayerTheme gap="var(--space-2)">
            <span className="website-manager__editor-title">Pages needing attention</span>
            <div className="website-manager__chip-row">
              {draftPages.map((p) => (
                <span key={p.key} className="app-badge app-badge--warning">
                  {p.name} — draft
                </span>
              ))}
            </div>
          </LayerTheme>
        )}
      </Section>

      <Section title="Website pages">
        <div className="website-manager__toolbar">
          <input
            className="app-input"
            type="search"
            placeholder="Search pages…"
            aria-label="Search pages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <DropdownField
            className="website-manager__toolbar-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            options={[
              { value: "all", label: "All statuses" },
              { value: "published", label: "Published only" },
              { value: "draft", label: "Draft only" },
            ]}
          />
        </div>

        {filteredPages.length === 0 ? (
          <EmptyState
            variant="bare"
            role="status"
            title="No pages match your search"
            description="Clear the search box or change the status filter to see the rest of the site."
          />
        ) : (
          <div className="website-manager__table-scroll">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Route</th>
                  <th>Sections</th>
                  <th>SEO</th>
                  <th>Status</th>
                  <th>Last edited by</th>
                  <th>Last edited</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPages.map((p) => {
                  const indexed = seo[p.key] ? seo[p.key].indexed : true;
                  return (
                    <tr key={p.key}>
                      <td className="website-manager__cell-strong">{p.name}</td>
                      <td className="website-manager__cell-mono">{p.route}</td>
                      <td>{sectionCounts[p.key] || 0}</td>
                      <td>
                        <span
                          className={`app-badge ${
                            indexed ? "app-badge--success" : "app-badge--neutral"
                          } app-badge--uppercase`}
                        >
                          {indexed ? "Indexed" : "No-index"}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="website-manager__cell-muted">{p.lastEditedBy || "—"}</td>
                      <td className="website-manager__cell-muted">
                        {p.lastEditedAt ? formatDateTime(p.lastEditedAt) : "Live content"}
                      </td>
                      <td>
                        <div className="website-manager__row-actions">
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => onTogglePageStatus(p.key)}
                          >
                            {p.status === "published" ? "Set to draft" : "Publish"}
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="xs"
                            onClick={() => onOpenPage(p.key)}
                          >
                            Manage
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
