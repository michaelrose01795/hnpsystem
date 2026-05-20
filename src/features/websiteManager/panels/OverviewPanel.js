// file location: src/features/websiteManager/panels/OverviewPanel.js
// Website pages overview + publish/status monitoring.
import React, { useEffect, useMemo, useState } from "react";
import Section from "@/components/Section";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import { SECTIONS_BY_PAGE } from "../editors/sectionSchemas";
import { fetchSection } from "../websiteApi";
import { fetchProducts, fetchOrders } from "../shopApi";
import {
  StatusBadge,
  EmptyState,
  formatDateTime,
  cellStyle,
  headCellStyle,
} from "../helpers";

function StatCard({ label, value, hint }) {
  return (
    <LayerTheme padding="14px" gap="4px" style={{ flex: "1 1 150px", minWidth: 150 }}>
      <div style={{ fontSize: "0.78rem", color: "var(--text-1)" }}>{label}</div>
      <div style={{ fontSize: "1.7rem", fontWeight: 700, color: "var(--accentText)" }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: "0.74rem", color: "var(--text-1)" }}>{hint}</div>
      )}
    </LayerTheme>
  );
}

export default function OverviewPanel({
  pages,
  seo,
  media,
  activity,
  onTogglePageStatus,
  onOpenPage,
}) {
  // Section count per page is now derived from the editor schema map - the
  // generic "block" abstraction was retired in Phase 2.
  const blockCounts = Object.fromEntries(
    pages.map((p) => [p.key, (SECTIONS_BY_PAGE[p.key] || []).length])
  );

  // Phase 5: live stock counts. Vehicles + offers come from website_*;
  // products + orders come from shop_*. Low-stock = stock_qty < 5 && published.
  const [stock, setStock] = useState({
    vehicles: null,
    offers: null,
    products: null,
    lowStock: [],
    pendingOrders: null,
  });
  useEffect(() => {
    (async () => {
      try {
        const [vehicles, offers, products, orders] = await Promise.all([
          fetchSection("vehicles").catch(() => []),
          fetchSection("offers").catch(() => []),
          fetchProducts().catch(() => []),
          fetchOrders().catch(() => []),
        ]);
        const lowStock = (products || []).filter(
          (p) => p.status === "published" && p.stock_qty < 5
        );
        const pendingOrders = (orders || []).filter(
          (o) => o.status === "paid" || o.status === "fulfilling"
        ).length;
        setStock({
          vehicles: (vehicles || []).filter((v) => v.status === "published").length,
          offers: (offers || []).filter((o) => o.status === "published").length,
          products: (products || []).filter((p) => p.status === "published").length,
          lowStock,
          pendingOrders,
        });
      } catch {
        /* silent - stats panel just shows dashes */
      }
    })();
  }, []);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const todayKey = new Date().toDateString();
  const stats = useMemo(() => {
    const published = pages.filter((p) => p.status === "published").length;
    const drafts = pages.length - published;
    const changesToday = activity.filter(
      (a) => new Date(a.at).toDateString() === todayKey
    ).length;
    const notIndexed = pages.filter((p) => seo[p.key] && seo[p.key].indexed === false)
      .length;
    return { published, drafts, changesToday, notIndexed };
  }, [pages, activity, seo, todayKey]);

  const draftPages = pages.filter((p) => p.status === "draft");

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pages.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) || p.route.toLowerCase().includes(q)
      );
    });
  }, [pages, query, statusFilter]);

  return (
    <>
      <Section
        title="Publish & Status Monitoring"
        subtitle="A live snapshot of what is currently live, in draft, and recently changed."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <StatCard label="Total pages" value={pages.length} />
          <StatCard label="Published" value={stats.published} hint="Visible to customers" />
          <StatCard label="In draft" value={stats.drafts} hint="Hidden from public site" />
          <StatCard label="Media assets" value={media.length} />
          <StatCard label="Changes today" value={stats.changesToday} />
          <StatCard
            label="Not indexed"
            value={stats.notIndexed}
            hint="Excluded from search engines"
          />
        </div>

        {/* Phase 5: live stock & shop counts */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <StatCard
            label="Vehicles live on /website"
            value={stock.vehicles == null ? "…" : stock.vehicles}
            hint="Published rows in website_vehicles"
          />
          <StatCard
            label="Offers live"
            value={stock.offers == null ? "…" : stock.offers}
            hint="Manufacturer promo banners shown"
          />
          <StatCard
            label="Products live"
            value={stock.products == null ? "…" : stock.products}
            hint="Catalogue items in the /shop section"
          />
          <StatCard
            label="Orders to fulfil"
            value={stock.pendingOrders == null ? "…" : stock.pendingOrders}
            hint="Paid + fulfilling status"
          />
        </div>

        {stock.lowStock.length > 0 && (
          <LayerTheme padding="14px" gap="8px">
            <div style={{ fontWeight: 700, color: "var(--accentText)" }}>
              Low stock — replenish soon
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {stock.lowStock.map((p) => (
                <span
                  key={p.id}
                  className="app-badge app-badge--warning app-badge--control"
                  title={`SKU ${p.sku || p.id}`}
                >
                  {p.name} — {p.stock_qty} left
                </span>
              ))}
            </div>
          </LayerTheme>
        )}

        {draftPages.length > 0 && (
          <LayerTheme padding="14px" gap="8px">
            <div style={{ fontWeight: 700, color: "var(--accentText)" }}>
              Pages needing attention
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {draftPages.map((p) => (
                <span
                  key={p.key}
                  className="app-badge app-badge--warning app-badge--control"
                >
                  {p.name} — draft
                </span>
              ))}
            </div>
          </LayerTheme>
        )}
      </Section>

      <Section
        title="Website Pages Overview"
        subtitle="Every public page this tool manages. Toggle a page between live and draft, or open it to manage its content."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <input
            className="app-input"
            type="search"
            placeholder="Search pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: "1 1 220px", minWidth: 200 }}
          />
          <select
            className="app-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ flex: "0 0 auto", minWidth: 160 }}
          >
            <option value="all">All statuses</option>
            <option value="published">Published only</option>
            <option value="draft">Draft only</option>
          </select>
        </div>

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
                  <th style={headCellStyle}>Route</th>
                  <th style={headCellStyle}>Sections</th>
                  <th style={headCellStyle}>SEO</th>
                  <th style={headCellStyle}>Status</th>
                  <th style={headCellStyle}>Last edited by</th>
                  <th style={headCellStyle}>Last edited</th>
                  <th style={headCellStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPages.map((p) => {
                  const indexed = seo[p.key] ? seo[p.key].indexed : true;
                  return (
                    <tr key={p.key}>
                      <td style={{ ...cellStyle, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ ...cellStyle, color: "var(--text-1)", fontFamily: "monospace" }}>
                        {p.route}
                      </td>
                      <td style={cellStyle}>{blockCounts[p.key] || 0}</td>
                      <td style={cellStyle}>
                        <span
                          className={`app-badge ${
                            indexed ? "app-badge--success" : "app-badge--neutral"
                          } app-badge--uppercase`}
                        >
                          {indexed ? "Indexed" : "No-index"}
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <StatusBadge status={p.status} />
                      </td>
                      <td style={{ ...cellStyle, color: "var(--text-1)" }}>
                        {p.lastEditedBy || "—"}
                      </td>
                      <td style={{ ...cellStyle, color: "var(--text-1)" }}>
                        {p.lastEditedAt ? formatDateTime(p.lastEditedAt) : "Live content"}
                      </td>
                      <td style={cellStyle}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => onTogglePageStatus(p.key)}
                          >
                            {p.status === "published" ? "Set to draft" : "Publish"}
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
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
