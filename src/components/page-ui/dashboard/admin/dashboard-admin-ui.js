// file location: src/components/page-ui/dashboard/admin/dashboard-admin-ui.js

export default function AdminDashboardUi(props) {
  const {
    ContentWidth,
    HolidayList,
    LayerTheme,
    MetricCard,
    NoticeList,
    PageShell,
    data,
    error,
    loading,
  } = props; // receive page logic props.

  const DashboardSection = ({ className = "", parentKey, sectionKey, title, subtitle, children }) => (
    <LayerTheme
      as="section"
      className={`admin-dashboard-section ${className}`.trim()}
      parentKey={parentKey}
      sectionKey={sectionKey}
      gap="12px"
      style={{ minWidth: 0, height: "100%" }}
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
      return (
        <PageShell sectionKey="dashboard-admin-shell">
          <ContentWidth sectionKey="dashboard-admin-content" parentKey="dashboard-admin-shell" widthMode="content">
            <div className="admin-dashboard-grid">
              <DashboardSection
                className="admin-dashboard-section--wide"
                parentKey="dashboard-admin-content"
                sectionKey="dashboard-admin-auto-content-card-1"
                title="System statistics"
                subtitle="Jobs, appointments, and parts throughput"
              >
                {loading ? (
                  <p style={{ color: "var(--info)" }}>Loading system stats...</p>
                ) : error ? (
                  <p style={{ color: "var(--primary)" }}>{error}</p>
                ) : (
                  <div className="admin-dashboard-metrics-grid">
                    <MetricCard
                      parentKey="dashboard-admin-auto-content-card-1"
                      sectionKey="dashboard-admin-metric-total-jobs"
                      label="Total jobs"
                      value={data.totalJobs}
                      helper="Job records"
                    />
                    <MetricCard
                      parentKey="dashboard-admin-auto-content-card-1"
                      sectionKey="dashboard-admin-metric-appointments-today"
                      label="Appointments today"
                      value={data.appointmentsToday}
                      helper="Scheduled slots"
                    />
                    <MetricCard
                      parentKey="dashboard-admin-auto-content-card-1"
                      sectionKey="dashboard-admin-metric-parts-requests"
                      label="Parts requests"
                      value={data.partsRequests}
                      helper="Active requests"
                    />
                  </div>
                )}
              </DashboardSection>

              <DashboardSection
                className="admin-dashboard-section--compact"
                parentKey="dashboard-admin-content"
                sectionKey="dashboard-admin-auto-content-card-2"
                title="New users"
                subtitle="Last 7 days"
              >
                {loading ? (
                  <p style={{ color: "var(--info)" }}>Counting new users...</p>
                ) : (
                  <MetricCard
                    parentKey="dashboard-admin-auto-content-card-2"
                    sectionKey="dashboard-admin-metric-new-users"
                    label="New users"
                    value={data.newUsers}
                    helper="Registered in last 7 days"
                  />
                )}
              </DashboardSection>

              <DashboardSection
                className="admin-dashboard-section--half"
                parentKey="dashboard-admin-content"
                sectionKey="dashboard-admin-auto-content-card-3"
                title="Upcoming holidays"
                subtitle="Next 7 days"
              >
                {loading ? (
                  <p style={{ color: "var(--info)" }}>Loading holiday requests...</p>
                ) : (
                  <HolidayList holidays={data.holidays} />
                )}
              </DashboardSection>

              <DashboardSection
                className="admin-dashboard-section--half"
                parentKey="dashboard-admin-content"
                sectionKey="dashboard-admin-auto-content-card-4"
                title="Notices"
                subtitle="Latest alerts"
              >
                {loading ? (
                  <p style={{ color: "var(--info)" }}>Loading notices...</p>
                ) : (
                  <NoticeList notices={data.notices} />
                )}
              </DashboardSection>
            </div>
            <style jsx global>{`
              .admin-dashboard-grid {
                display: grid;
                grid-template-columns: repeat(12, minmax(0, 1fr));
                gap: 14px;
                align-items: stretch;
                width: 100%;
              }

              .admin-dashboard-section--wide {
                grid-column: span 8;
              }

              .admin-dashboard-section--compact {
                grid-column: span 4;
              }

              .admin-dashboard-section--half {
                grid-column: span 6;
              }

              .admin-dashboard-metrics-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 12px;
                height: 100%;
              }

              @media (max-width: 900px) {
                .admin-dashboard-section--wide,
                .admin-dashboard-section--compact,
                .admin-dashboard-section--half {
                  grid-column: 1 / -1;
                }
              }

              @media (max-width: 780px) {
                .admin-dashboard-grid {
                  grid-template-columns: 1fr;
                }

                .admin-dashboard-metrics-grid {
                  grid-template-columns: 1fr;
                }
              }
            `}</style>
          </ContentWidth>
        </PageShell>
      ); // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
