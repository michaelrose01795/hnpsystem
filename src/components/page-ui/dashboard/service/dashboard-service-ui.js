// file location: src/components/page-ui/dashboard/service/dashboard-service-ui.js

export default function ServiceDashboardUi(props) {
  const {
    MetricCard,
    PieChart,
    ProgressBar,
    QueueItem,
    Section,
    TrendBlock,
    data,
    error,
    loading,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div>
        <header className="app-section-card" style={{
      background: "var(--surface-light)"
    }}>
          <p style={{
        margin: 0,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--primary-dark)"
      }}>
            Service dashboard
          </p>
          <h1 style={{
        margin: "6px 0 0",
        color: "var(--primary-dark)"
      }}>Advisor cockpit</h1>
          <p style={{
        margin: "6px 0 0",
        color: "var(--info)"
      }}>
            Appointment throughput, customer status, and VHC approvals all in one pane.
          </p>
        </header>

        <Section title="Appointments today">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Counting today&apos;s arrivals…</p> : error ? <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <MetricCard label="Appointments today" value={data.appointmentsToday} helper="Scheduled between 00:00 and midnight" />}
        </Section>

        <Section title="Progress" subtitle="Jobs completed vs checked in">
          <ProgressBar completed={data.progress.completed} target={data.progress.scheduled} />
        </Section>

        <Section title="Waiting mix" subtitle="Loan, waiting, and collection split">
          <PieChart breakdown={data.waitingBreakdown} />
        </Section>

        <Section title="Appointment trends" subtitle="Last 7 days">
          <TrendBlock data={data.appointmentTrends} />
        </Section>

        <Section title="Upcoming jobs">
          {data.upcomingJobs.length === 0 ? <p style={{
        margin: 0,
        color: "var(--info)"
      }}>No upcoming jobs right now.</p> : <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
              {data.upcomingJobs.map(job => <QueueItem key={job.id} job={job} />)}
            </div>}
        </Section>

        <Section title="VHC severity" subtitle="Weekly breakdown">
          {data.vhcSeverityTrend.length === 0 ? <p style={{
        margin: 0,
        color: "var(--info)"
      }}>No VHC data for the week yet.</p> : <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}>
              {data.vhcSeverityTrend.map(point => {
          const total = point.red + point.amber + point.green || 1;
          return <div key={point.label} style={{
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
                    <span style={{
              width: 35,
              fontSize: "0.85rem",
              color: "var(--info)"
            }}>{point.label}</span>
                    <div style={{
              flex: 1,
              height: 8,
              background: "var(--surface)",
              borderRadius: 4
            }}>
                      <div style={{
                position: "relative",
                width: "100%",
                height: "100%",
                display: "flex",
                borderRadius: 4,
                overflow: "hidden"
              }}>
                        <div style={{
                  width: `${Math.round(point.red / total * 100)}%`,
                  background: "var(--danger)"
                }} />
                        <div style={{
                  width: `${Math.round(point.amber / total * 100)}%`,
                  background: "var(--warning)"
                }} />
                        <div style={{
                  width: `${Math.round(point.green / total * 100)}%`,
                  background: "var(--success)"
                }} />
                      </div>
                    </div>
                    <strong style={{
              color: "var(--primary-dark)",
              fontSize: "0.85rem"
            }}>{total}</strong>
                  </div>;
        })}
            </div>}
        </Section>

        <Section title="VHCs awaiting approval">
          {data.awaitingVhc.length === 0 ? <p style={{
        margin: 0,
        color: "var(--info)"
      }}>No pending VHC approvals.</p> : <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
              {data.awaitingVhc.map(job => <QueueItem key={job.id} job={job} />)}
            </div>}
        </Section>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
