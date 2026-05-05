// file location: src/components/page-ui/dashboard/valeting/dashboard-valeting-ui.js

export default function ValetingDashboardUi(props) {
  const {
    LayerSurface,
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
      <div>
        {/* Wash bay overview — outer LayerTheme (tinted) so MetricCards inside flip to LayerSurface */}
        <LayerTheme as="section" gap="12px">
          <h2 style={{
        margin: 0,
        fontSize: "1.2rem",
        color: "var(--primary-selected)"
      }}>Wash bay overview</h2>
          {loading ?
      <p style={{
        color: "var(--info)"
      }}>Gathering metrics…</p> : error ?
      <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px"
      }}>
              <MetricCard label="Cars waiting wash" value={data.waitingCount} helper="Checked in but not started" />
              <MetricCard label="Cars washed" value={data.washedCount} helper="Wash completed" />
              <MetricCard label="Cars delayed" value={data.delayedCount} helper="Includes delay flag" />
              <MetricCard label="Cars in queue" value={data.waitingQueue.length} helper="Vehicles queued right now" />
            </div>}
        </LayerTheme>

        {/* Queue trend — outer LayerTheme; trend rows inside flip to LayerSurface */}
        <LayerTheme as="section" gap="12px">
          <div>
            <h2 style={{
          margin: 0,
          fontSize: "1.2rem",
          color: "var(--primary-selected)"
        }}>Queue trend</h2>
            <p style={{
          margin: "6px 0 0",
          color: "var(--info)"
        }}>Wash starts last 7 days</p>
          </div>
          {loading ?
      <p style={{
        color: "var(--info)"
      }}>Building trend view…</p> : <TrendBlock data={data.trends} />
      }
        </LayerTheme>

        {/* Queue board — outer LayerSurface; rows inside flip to LayerTheme */}
        <LayerSurface as="section" gap="12px">
          <div>
            <h2 style={{
          margin: 0,
          fontSize: "1.2rem",
          color: "var(--primary-selected)"
        }}>Queue board</h2>
            <p style={{
          margin: "6px 0 0",
          color: "var(--info)"
        }}>Cars checked in and ready</p>
          </div>
          {loading ?
      <p style={{
        color: "var(--info)"
      }}>Refreshing queue…</p> : error ?
      <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <QueueBoard queue={data.waitingQueue} />
      }
        </LayerSurface>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
