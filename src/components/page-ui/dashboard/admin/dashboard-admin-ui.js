// file location: src/components/page-ui/dashboard/admin/dashboard-admin-ui.js

export default function AdminDashboardUi(props) {
  const {
    HolidayList,
    LayerTheme,
    MetricCard,
    NoticeList,
    data,
    error,
    loading,
  } = props; // receive page logic props.

  const DashboardSection = ({ sectionKey, title, subtitle, children }) => (
    <LayerTheme
      as="section"
      sectionKey={sectionKey}
      gap="12px"
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--accentText)" }}>{title}</h2>
        {subtitle && <p style={{ margin: "6px 0 0", color: "var(--surfaceTextMuted)" }}>{subtitle}</p>}
      </div>
      {children}
    </LayerTheme>
  );

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div>
        <DashboardSection sectionKey="dashboard-admin-auto-content-card-1" title="System statistics" subtitle="Jobs, appointments, and parts throughput">
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
        </DashboardSection>

        <DashboardSection sectionKey="dashboard-admin-auto-content-card-2" title="New users" subtitle="Last 7 days">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Counting new users…</p> : <MetricCard label="New users" value={data.newUsers} helper="Registered in last 7 days" />}
        </DashboardSection>

        <DashboardSection sectionKey="dashboard-admin-auto-content-card-3" title="Upcoming holidays" subtitle="Next 7 days">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading holiday requests…</p> : <HolidayList holidays={data.holidays} />}
        </DashboardSection>

        <DashboardSection sectionKey="dashboard-admin-auto-content-card-4" title="Notices" subtitle="Latest alerts">
          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading notices…</p> : <NoticeList notices={data.notices} />}
        </DashboardSection>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
