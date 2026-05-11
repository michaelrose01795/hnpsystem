// file location: src/components/page-ui/dashboard/valeting/dashboard-valeting-ui.js
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

export default function ValetingDashboardUi(props) {
  const {
    LayerTheme,
    MetricCard,
    QueueBoard,
    TrendBlock,
    data,
    error,
    loading,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <DevLayoutSection
        sectionKey="dashboard-valeting-shell"
        parentKey="app-layout-page-card"
        sectionType="page-shell"
        shell
        backgroundToken="transparent"
        data-dev-text-preview="Valeting dashboard"
        style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}
      >
        {/* Wash bay overview — outer LayerTheme (tinted) so MetricCards inside flip to LayerSurface */}
        <LayerTheme
          as="section"
          sectionKey="dashboard-valeting-wash-overview"
          parentKey="dashboard-valeting-shell"
          sectionType="content-card"
          backgroundToken="theme"
          gap="12px"
          data-dev-text-preview="Wash bay overview"
        >
          <h2 style={{
        margin: 0,
        fontSize: "1.2rem",
        color: "var(--text-accent)"
      }}>Wash bay overview</h2>
          {loading ?
      <p style={{
        color: "var(--text-1)"
      }}>Gathering metrics…</p> : error ?
      <p style={{
        color: "var(--text-1)"
      }}>{error}</p> : <DevLayoutSection
        sectionKey="dashboard-valeting-wash-metrics"
        parentKey="dashboard-valeting-wash-overview"
        sectionType="section-shell"
        backgroundToken="transparent"
        data-dev-text-preview="Wash bay metrics"
        style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "16px"
      }}>
              <MetricCard sectionKey="dashboard-valeting-cars-waiting-wash" parentKey="dashboard-valeting-wash-metrics" label="Cars waiting wash" value={data.waitingCount} helper="Checked in but not started" />
              <MetricCard sectionKey="dashboard-valeting-cars-washed" parentKey="dashboard-valeting-wash-metrics" label="Cars washed" value={data.washedCount} helper="Wash completed" />
              <MetricCard sectionKey="dashboard-valeting-cars-delayed" parentKey="dashboard-valeting-wash-metrics" label="Cars delayed" value={data.delayedCount} helper="Includes delay flag" />
              <MetricCard sectionKey="dashboard-valeting-cars-in-queue" parentKey="dashboard-valeting-wash-metrics" label="Cars in queue" value={data.waitingQueue.length} helper="Vehicles queued right now" />
            </DevLayoutSection>}
        </LayerTheme>

        <DevLayoutSection
          sectionKey="dashboard-valeting-queue-split"
          parentKey="dashboard-valeting-shell"
          sectionType="section-shell"
          backgroundToken="transparent"
          data-dev-text-preview="Queue trend and queue board"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "var(--layout-card-gap)",
            alignItems: "stretch"
          }}
        >
          {/* Queue trend — outer LayerTheme; trend rows inside flip to LayerSurface */}
          <LayerTheme
            as="section"
            sectionKey="dashboard-valeting-queue-trend"
            parentKey="dashboard-valeting-queue-split"
            sectionType="content-card"
            backgroundToken="theme"
            gap="12px"
            data-dev-text-preview="Queue trend"
            style={{ minWidth: 0 }}
          >
            <div>
              <h2 style={{
            margin: 0,
            fontSize: "1.2rem",
            color: "var(--text-accent)"
          }}>Queue trend</h2>
              <p style={{
            margin: "6px 0 0",
            color: "var(--text-1)"
          }}>Wash starts last 7 days</p>
            </div>
            {loading ?
        <p style={{
          color: "var(--text-1)"
        }}>Building trend view…</p> : <TrendBlock data={data.trends} />
        }
          </LayerTheme>

          {/* Queue board — outer LayerTheme uses --theme; rows inside flip to LayerSurface */}
          <LayerTheme
            as="section"
            sectionKey="dashboard-valeting-queue-board"
            parentKey="dashboard-valeting-queue-split"
            sectionType="content-card"
            backgroundToken="theme"
            gap="12px"
            data-dev-text-preview="Queue board"
            style={{ minWidth: 0 }}
          >
            <div>
              <h2 style={{
            margin: 0,
            fontSize: "1.2rem",
            color: "var(--text-accent)"
          }}>Queue board</h2>
              <p style={{
            margin: "6px 0 0",
            color: "var(--text-1)"
          }}>Cars checked in and ready</p>
            </div>
            {loading ?
        <p style={{
          color: "var(--text-1)"
        }}>Refreshing queue…</p> : error ?
        <p style={{
          color: "var(--text-1)"
        }}>{error}</p> : <QueueBoard queue={data.waitingQueue} />
        }
          </LayerTheme>
        </DevLayoutSection>
      </DevLayoutSection>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
