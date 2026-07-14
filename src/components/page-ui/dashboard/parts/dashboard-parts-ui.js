// file location: src/components/page-ui/dashboard/parts/dashboard-parts-ui.js

import { InlineLoading } from "@/components/ui/LoadingSkeleton";

export default function PartsDashboardUi(props) {
  const {
    LayerSurface,
    LayerTheme,
    ListBlock,
    MetricCard,
    TrendBlock,
    data,
    error,
    loading,
    recentRequests,
    requestSummary,
    requestsByStatus,
    stockAlerts,
    trendData,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <div style={{
    padding: "48px",
    textAlign: "center",
    color: "var(--primary-selected)"
  }}>
          You do not have access to the Parts dashboard.
        </div>
      </>; // render extracted page section.

    case "section2": {
      const humanizeStatus = (value) => {
        if (!value) return "Unknown";
        return String(value)
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/\b\w/g, (c) => c.toUpperCase());
      };
      const splitRowStyle = {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "var(--page-stack-gap, 16px)"
      };
      // Themed-card wrapper — replaces <Section> for this dashboard so each
      // top-level card sits on the --theme background. Per CLAUDE.md §3.0,
      // any LayerTheme inside MUST flip back to LayerSurface (handled below).
      const ThemedSection = ({ title, subtitle, children }) => (
        <LayerTheme as="section" gap="12px">
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-accent)" }}>{title}</h2>
            {subtitle && <p style={{ margin: "6px 0 0", color: "var(--text-2)" }}>{subtitle}</p>}
          </div>
          {children}
        </LayerTheme>
      );
      return <>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--page-stack-gap, 16px)" }}>
        <ThemedSection title="Request snapshot" subtitle="New and pre-picks today">
          {loading ? <InlineLoading label="Loading request counts" /> : error ? <p style={{ color: "var(--text-accent)" }}>{error}</p> : data ? <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px"
      }}>
              <MetricCard label="Parts requests" value={requestSummary.totalRequests ?? 0} helper="Open requests" />
              <MetricCard label="Parts on order" value={requestSummary.partsOnOrder ?? 0} helper="Units on order" />
              <MetricCard label="Pre picked" value={requestSummary.prePicked ?? 0} helper="Assigned to racks" />
              <MetricCard label="Delayed orders" value={requestSummary.delayedOrders ?? 0} helper="Missing qty" />
            </div> : <p style={{ color: "var(--text-2)" }}>No request data available yet.</p>}
        </ThemedSection>

        <div style={splitRowStyle}>
          <ThemedSection title="Requests trend" subtitle="Report KPI: parts requests, last 7 days">
            {loading ? <InlineLoading label="Loading request trends" /> : trendData.length === 0 ? <p style={{ color: "var(--text-2)" }}>No trend data available yet.</p> : <TrendBlock data={trendData} />}
          </ThemedSection>

          <ThemedSection title="Stock levels" subtitle="Lowest availability items">
            {loading ? <InlineLoading label="Loading stock alerts" /> : stockAlerts.length === 0 ? <p style={{ margin: 0, color: "var(--text-2)" }}>No low stock alerts yet.</p> : <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}>
                {stockAlerts.map(part => <LayerSurface key={part.id} radius="var(--radius-sm)" padding="10px 12px" style={{
            flexDirection: "row",
            justifyContent: "space-between"
          }}>
                    <div>
                      <strong style={{ color: "var(--text-1)" }}>{part.label}</strong>
                      <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "0.85rem" }}>
                        Reorder at {part.reorderLevel}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, color: "var(--text-accent)", fontWeight: 600 }}>{part.inStock}</p>
                      <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-2)" }}>In stock</p>
                    </div>
                  </LayerSurface>)}
              </div>}
          </ThemedSection>
        </div>

        <div style={splitRowStyle}>
          <ThemedSection title="Requests by status">
            {loading ? <InlineLoading label="Loading request status breakdown" /> : requestsByStatus.length === 0 ? <p style={{ margin: 0, color: "var(--text-2)" }}>Waiting for request data.</p> : <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px"
        }}>
                {requestsByStatus.map(row => <LayerSurface key={row.status} radius="var(--radius-sm)" padding="10px 14px" style={{ minWidth: 150 }}>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-2)" }}>{humanizeStatus(row.status)}</p>
                    <strong style={{ color: "var(--text-accent)", fontSize: "1.4rem" }}>{row.count}</strong>
                  </LayerSurface>)}
              </div>}
          </ThemedSection>

          <ThemedSection title="Recent requests" subtitle="Most recent entries">
            {loading ? <InlineLoading label="Loading recent requests" /> : <ListBlock title="Recent requests" items={recentRequests} />}
          </ThemedSection>
        </div>
      </div>
    </>;
    }
    default:
      return null; // keep unknown sections visually empty.
  }
}
