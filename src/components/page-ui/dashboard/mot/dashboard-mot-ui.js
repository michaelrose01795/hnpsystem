// file location: src/components/page-ui/dashboard/mot/dashboard-mot-ui.js
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

// Card state helper — one place for the loading / error copy so every card on
// the dashboard behaves identically instead of repeating the branch inline.
function CardState({ loading, error, children }) {
  if (loading) return <p style={{ margin: 0, opacity: 0.7 }}>Loading…</p>;
  if (error) return <p className="app-status-message app-status-message--danger" style={{ margin: 0 }}>{error}</p>;
  return children;
}

export default function MotDashboardUi(props) {
  const {
    CardList,
    LayerTheme,
    MetricCard,
    OutcomeBar,
    TrendBlock,
    data,
    error,
    loading,
  } = props; // receive page logic props.

  // ThemeCard — top-level card for this dashboard. The page card underneath is
  // --surface, so every card here is a --theme layer and everything nested in
  // one flips back to --surface (CLAUDE.md §3.0).
  const ThemeCard = ({ sectionKey, title, subtitle, children }) => (
    <LayerTheme
      as="section"
      sectionKey={sectionKey}
      parentKey="dashboard-mot-shell"
      sectionType="content-card"
      gap="14px"
      style={{ minWidth: 0 }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.05rem", color: "var(--accent-text-on-tint)" }}>{title}</h2>
        {subtitle && <p style={{ margin: "4px 0 0", color: "var(--surfaceTextMuted)" }}>{subtitle}</p>}
      </div>
      {children}
    </LayerTheme>
  );

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return (
        <DevLayoutSection
          sectionKey="dashboard-mot-shell"
          parentKey="app-layout-page-card"
          sectionType="page-shell"
          shell
          backgroundToken="transparent"
          data-dev-text-preview="MOT dashboard"
          style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)", width: "100%" }}
        >
          {/* Row 1 — full-width activity card. Today's arrivals and the lifetime
              outcome split sit together so the tally reads as one story. */}
          <ThemeCard
            sectionKey="dashboard-mot-auto-content-card-1"
            title="MOT activity"
            subtitle="Arrivals today, and the outcome split across every recorded MOT job"
          >
            <CardState loading={loading} error={error}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                  gap: "12px"
                }}
              >
                <MetricCard label="Tests today" value={data.testsToday} helper="Checked in since midnight" />
                <MetricCard label="Passed" value={data.passCount} helper="All recorded MOT jobs" />
                <MetricCard label="Failed" value={data.failCount} helper="All recorded MOT jobs" />
                <MetricCard label="Retests" value={data.retestCount} helper="Needs a follow-up visit" />
              </div>
              <OutcomeBar pass={data.passCount} fail={data.failCount} retest={data.retestCount} />
            </CardState>
          </ThemeCard>

          {/* Row 2 — locked 50/50 on tablet and desktop, one column under ~440px. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              gap: "var(--layout-card-gap)",
              alignItems: "start",
              width: "100%"
            }}
          >
            <ThemeCard
              sectionKey="dashboard-mot-auto-content-card-2"
              title="MOT volume trend"
              subtitle="Report KPI: MOT volume, last 7 days"
            >
              <TrendBlock data={data.trends} />
            </ThemeCard>

            <ThemeCard
              sectionKey="dashboard-mot-auto-content-card-3"
              title="Recent MOT jobs"
              subtitle="Latest six vehicles checked in for test"
            >
              <CardState loading={loading} error={error}>
                <CardList items={data.recentTests} />
              </CardState>
            </ThemeCard>
          </div>
        </DevLayoutSection>
      ); // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
