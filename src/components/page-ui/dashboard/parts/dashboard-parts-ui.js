// file location: src/components/page-ui/dashboard/parts/dashboard-parts-ui.js

export default function PartsDashboardUi(props) {
  const {
    ListBlock,
    MetricCard,
    Section,
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
    color: "var(--primary-dark)"
  }}>
          You do not have access to the Parts dashboard.
        </div>
      </>; // render extracted page section.

    case "section2":
      return <>
      <div>
        <header className="app-section-card" style={{
      border: "none"
    }}>
          <p style={{
        margin: 0,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "var(--primary-dark)"
      }}>Parts desk</p>
          <h1 style={{
        margin: "6px 0 0",
        color: "var(--primary-dark)"
      }}>Operations overview</h1>
          <p style={{
        margin: "6px 0 0",
        color: "var(--info)"
      }}>
            Live stock, inbound, and request telemetry from the parts catalogue.
          </p>
        </header>

        <Section title="Request snapshot" subtitle="New and pre-picks today">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading request counts…</p> : error ? <p style={{
        color: "var(--primary)"
      }}>{error}</p> : data ? <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px"
      }}>
              <MetricCard label="Parts requests" value={requestSummary.totalRequests ?? 0} helper="Open requests" />
              <MetricCard label="Parts on order" value={requestSummary.partsOnOrder ?? 0} helper="Units on order" />
              <MetricCard label="Pre picked" value={requestSummary.prePicked ?? 0} helper="Assigned to racks" />
              <MetricCard label="Delayed orders" value={requestSummary.delayedOrders ?? 0} helper="Missing qty" />
            </div> : <p style={{
        color: "var(--info)"
      }}>No request data available yet.</p>}
        </Section>

        <Section title="Requests trend" subtitle="Last 7 days">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading request trends…</p> : trendData.length === 0 ? <p style={{
        color: "var(--info)"
      }}>No trend data available yet.</p> : <TrendBlock data={trendData} />}
        </Section>

        <Section title="Stock levels" subtitle="Lowest availability items">
          {loading ? <p style={{
        margin: 0,
        color: "var(--info)"
      }}>Loading stock alerts…</p> : stockAlerts.length === 0 ? <p style={{
        margin: 0,
        color: "var(--info)"
      }}>No low stock alerts yet.</p> : <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}>
              {stockAlerts.map(part => <div key={part.id} style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          background: "var(--surface)"
        }}>
                  <div>
                    <strong>{part.label}</strong>
                    <p style={{
              margin: "4px 0 0",
              color: "var(--info)",
              fontSize: "0.85rem"
            }}>
                      Reorder at {part.reorderLevel}
                    </p>
                  </div>
                  <div style={{
            textAlign: "right"
          }}>
                    <p style={{
              margin: 0,
              color: "var(--primary-dark)"
            }}>{part.inStock}</p>
                    <p style={{
              margin: "4px 0 0",
              fontSize: "0.8rem",
              color: "var(--info)"
            }}>In stock</p>
                  </div>
                </div>)}
            </div>}
        </Section>

        <Section title="Requests by status">
          {loading ? <p style={{
        margin: 0,
        color: "var(--info)"
      }}>Loading request status breakdown…</p> : requestsByStatus.length === 0 ? <p style={{
        margin: 0,
        color: "var(--info)"
      }}>Waiting for request data.</p> : <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px"
      }}>
              {requestsByStatus.map(row => <div key={row.status} style={{
          padding: "10px 14px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          background: "var(--surface)",
          minWidth: 150
        }}>
                  <p style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--info)"
          }}>{row.status}</p>
                  <strong style={{
            color: "var(--primary-dark)"
          }}>{row.count}</strong>
                </div>)}
            </div>}
        </Section>

        <Section title="Recent requests" subtitle="Most recent entries">
          {loading ? <p style={{
        margin: 0,
        color: "var(--info)"
      }}>Loading recent requests…</p> : <ListBlock title="Recent requests" items={recentRequests} />}
        </Section>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
