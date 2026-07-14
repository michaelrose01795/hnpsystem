// file location: src/components/page-ui/dashboard/painting/dashboard-painting-ui.js
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

function ThemedSection({ LayerTheme, sectionKey, title, subtitle, children }) {
  return (
    <LayerTheme
      as="section"
      sectionKey={sectionKey}
      parentKey="dashboard-painting-shell"
      sectionType="content-card"
      backgroundToken="theme"
      gap="12px"
      data-dev-text-preview={subtitle ? `${title} ${subtitle}` : title}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-accent)" }}>{title}</h2>
        {subtitle && <p style={{ margin: "6px 0 0", color: "var(--text-1)" }}>{subtitle}</p>}
      </div>
      {children}
    </LayerTheme>
  );
}

export default function PaintingDashboardUi(props) {
  const {
    LayerTheme,
    MetricCard,
    QueueList,
    TrendBlock,
    data,
    error,
    loading,
  } = props;

  switch (props.view) {
    case "section1":
      return (
        <DevLayoutSection
          sectionKey="dashboard-painting-shell"
          parentKey="app-layout-page-card"
          sectionType="page-shell"
          shell
          backgroundToken="transparent"
          data-dev-text-preview="Painting dashboard"
          style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}
        >
          <ThemedSection
            LayerTheme={LayerTheme}
            sectionKey="dashboard-painting-auto-content-card-1"
            title="Bodyshop jobs"
          >
            {loading ? (
              <p style={{ margin: 0, color: "var(--text-1)" }}>Loading bodyshop jobs...</p>
            ) : error ? (
              <p style={{ margin: 0, color: "var(--text-1)" }}>{error}</p>
            ) : (
              <MetricCard
                sectionKey="dashboard-painting-bodyshop-jobs-card"
                parentKey="dashboard-painting-auto-content-card-1"
                label="Bodyshop jobs"
                value={data.bodyshopCount}
                helper="Jobs requiring bodywork"
              />
            )}
          </ThemedSection>

          <ThemedSection
            LayerTheme={LayerTheme}
            sectionKey="dashboard-painting-auto-content-card-2"
            title="Paint queue"
            subtitle="Jobs still in progress"
          >
            {loading ? (
              <p style={{ margin: 0, color: "var(--text-1)" }}>Loading queue...</p>
            ) : error ? (
              <p style={{ margin: 0, color: "var(--text-1)" }}>{error}</p>
            ) : (
              <QueueList queue={data.queue} parentKey="dashboard-painting-auto-content-card-2" />
            )}
          </ThemedSection>

          <ThemedSection
            LayerTheme={LayerTheme}
            sectionKey="dashboard-painting-auto-content-card-3"
            title="Paint completion trend"
            subtitle="Report KPI: completed paint jobs, last 7 days"
          >
            <TrendBlock data={data.trends} parentKey="dashboard-painting-auto-content-card-3" />
          </ThemedSection>
        </DevLayoutSection>
      );
    default:
      return null;
  }
}
