// file location: src/components/page-ui/dashboard/valeting/dashboard-valeting-ui.js

export default function ValetingDashboardUi(props) {
  const {
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
        {/* Card 3 — accent background section containing equal-sized metric cards */}
        <section style={{
      background: "var(--theme)",
      // accent tint background
      border: "1px solid rgba(var(--primary-rgb), 0.18)",
      // accent border
      borderRadius: "var(--section-card-radius)",
      // standard card radius
      padding: "var(--section-card-padding)",
      // standard card padding
      display: "flex",
      // flex column layout
      flexDirection: "column",
      // vertical stack
      gap: "12px" // spacing between title and grid
    }}>
          <h2 style={{
        margin: 0,
        fontSize: "1.2rem",
        color: "var(--primary-selected)"
      }}>Wash bay overview</h2> {/* section heading */}
          {loading ?
      // loading state
      <p style={{
        color: "var(--info)"
      }}>Gathering metrics…</p> : error ?
      // error state
      <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px"
      }}> {/* 4 equal-width columns */}
              <MetricCard label="Cars waiting wash" value={data.waitingCount} helper="Checked in but not started" /> {/* card 4 — surface */}
              <MetricCard label="Cars washed" value={data.washedCount} helper="Wash completed" /> {/* card 5 — surface */}
              <MetricCard label="Cars delayed" value={data.delayedCount} helper="Includes delay flag" /> {/* card 6 — surface */}
              <MetricCard label="Cars in queue" value={data.waitingQueue.length} helper="Vehicles queued right now" /> {/* added card — surface */}
            </div>}
        </section>

        {/* Card 7 — accent background section with surface-level rows */}
        <section style={{
      background: "var(--theme)",
      // accent tint background
      border: "1px solid rgba(var(--primary-rgb), 0.18)",
      // accent border
      borderRadius: "var(--section-card-radius)",
      // standard card radius
      padding: "var(--section-card-padding)",
      // standard card padding
      display: "flex",
      // flex column layout
      flexDirection: "column",
      // vertical stack
      gap: "12px" // spacing between heading and content
    }}>
          <div>
            <h2 style={{
          margin: 0,
          fontSize: "1.2rem",
          color: "var(--primary-selected)"
        }}>Queue trend</h2> {/* section heading */}
            <p style={{
          margin: "6px 0 0",
          color: "var(--info)"
        }}>Wash starts last 7 days</p> {/* subtitle */}
          </div>
          {loading ?
      // loading state
      <p style={{
        color: "var(--info)"
      }}>Building trend view…</p> : <TrendBlock data={data.trends} /> // trend bars — each row has surface background
      }
        </section>

        {/* Queue board — surface background section */}
        <section className="app-section-card" // surface background from globals.css
    style={{
      gap: "12px"
    }} // internal spacing
    >
          <div>
            <h2 style={{
          margin: 0,
          fontSize: "1.2rem",
          color: "var(--primary-selected)"
        }}>Queue board</h2> {/* section heading */}
            <p style={{
          margin: "6px 0 0",
          color: "var(--info)"
        }}>Cars checked in and ready</p> {/* subtitle */}
          </div>
          {loading ?
      // loading state
      <p style={{
        color: "var(--info)"
      }}>Refreshing queue…</p> : error ?
      // error state
      <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <QueueBoard queue={data.waitingQueue} /> // queue table with surface rows
      }
        </section>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
