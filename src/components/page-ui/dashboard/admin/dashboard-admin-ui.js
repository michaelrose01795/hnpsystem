// file location: src/components/page-ui/dashboard/admin/dashboard-admin-ui.js

export default function AdminDashboardUi(props) {
  const {
    HolidayList,
    MetricCard,
    NoticeList,
    Section,
    data,
    error,
    loading,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div>
        <header className="app-section-card" style={{
      border: "1px solid var(--accent-purple-surface)"
    }}>
          <p style={{
        margin: 0,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--primary-dark)"
      }}>
            Admin pulse
          </p>
          <h1 style={{
        margin: "6px 0 0",
        color: "var(--primary-dark)"
      }}>System health</h1>
          <p style={{
        margin: "6px 0 0",
        color: "var(--info)"
      }}>
            Track jobs, appointments, requests, and notices in one place.
          </p>
        </header>

        <Section title="System statistics" subtitle="Jobs, appointments, and parts throughput">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading system stats…</p> : error ? <p style={{
        color: "var(--primary)"
      }}>{error}</p> : <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px"
      }}>
              <MetricCard label="Total jobs" value={data.totalJobs} helper="Job records" />
              <MetricCard label="Appointments today" value={data.appointmentsToday} helper="Scheduled slots" />
              <MetricCard label="Parts requests" value={data.partsRequests} helper="Active requests" />
            </div>}
        </Section>

        <Section title="New users" subtitle="Last 7 days">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Counting new users…</p> : <MetricCard label="New users" value={data.newUsers} helper="Registered in last 7 days" />}
        </Section>

        <Section title="Upcoming holidays" subtitle="Next 7 days">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading holiday requests…</p> : <HolidayList holidays={data.holidays} />}
        </Section>

        <Section title="Notices" subtitle="Latest alerts">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading notices…</p> : <NoticeList notices={data.notices} />}
        </Section>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
