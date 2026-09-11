// file location: src/components/page-ui/valet/valet-ui.js

export default function ValetDashboardUi(props) {
  const {
    CalendarField,
    DevLayoutSection,
    LayerTheme,
    InlineLoading,
    SearchBar,
    ValetJobRow,
    buildChecklist,
    error,
    etaNow,
    etaSignalsByJobId,
    filteredJobs,
    formatDateOnlyLabel,
    getTodayDateValue,
    handleToggle,
    loading,
    router,
    savingMap,
    searchTerm,
    selectedDay,
    setSearchTerm,
    setSelectedDay,
    TableSkeleton,
    valetState,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <DevLayoutSection sectionKey="valet-loading-shell" sectionType="page-shell" shell>
          <DevLayoutSection sectionKey="valet-loading-panel" parentKey="valet-loading-shell" sectionType="content-card" style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100%",
      padding: "40px",
      fontSize: "16px"
    }}>
            <InlineLoading width={180} label="Loading user" />
          </DevLayoutSection>
        </DevLayoutSection>
      </>; // render extracted page section.

    case "section2":
      return <>
        <DevLayoutSection sectionKey="valet-auth-shell" sectionType="page-shell" shell>
          <DevLayoutSection sectionKey="valet-auth-message" parentKey="valet-auth-shell" sectionType="content-card" style={{
      padding: "24px"
    }}>
            <p style={{
        color: "var(--primary)",
        fontWeight: 600
      }}>
              You must be logged in to view valet jobs.
            </p>
          </DevLayoutSection>
        </DevLayoutSection>
      </>; // render extracted page section.

    case "section3":
      return <>
        <DevLayoutSection sectionKey="valet-no-access-shell" sectionType="page-shell" shell>
          <DevLayoutSection sectionKey="valet-no-access-message" parentKey="valet-no-access-shell" sectionType="content-card" style={{
      padding: "24px"
    }}>
            <p style={{
        color: "var(--primary)",
        fontWeight: 600
      }}>
              You do not have access to the valet dashboard.
            </p>
          </DevLayoutSection>
        </DevLayoutSection>
      </>; // render extracted page section.

    case "section4":
      return <div className="app-page-stack">
        <DevLayoutSection sectionKey="valet-controls-shell" parentKey="app-layout-page-card" sectionType="section-shell" className="app-page-stack">
          <DevLayoutSection data-presentation="valet-filters" sectionKey="valet-filter-row" parentKey="valet-controls-shell" sectionType="filter-row" style={{
        display: "flex",
        gap: "12px",
        flexWrap: "wrap",
        alignItems: "center"
      }}>
            <SearchBar value={searchTerm} onChange={event => setSearchTerm(event.target.value)} onClear={() => setSearchTerm("")} placeholder="Search by reg, job number, customer, or vehicle" style={{
          flex: 1,
          minWidth: "240px"
        }} />
            <div style={{
          minWidth: "220px",
          flex: "0 0 220px"
        }}>
              <CalendarField value={selectedDay} onChange={event => setSelectedDay(event.target.value)} placeholder="Filter by day" size="md" />
            </div>
            <button type="button" onClick={() => setSelectedDay(getTodayDateValue())} style={{
          padding: "10px 14px",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface)",
          color: "var(--text-1)",
          fontWeight: 600,
          cursor: "pointer"
        }}>
              Today
            </button>
            <button type="button" onClick={() => setSelectedDay("")} style={{
          padding: "10px 14px",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface)",
          color: "var(--text-1)",
          fontWeight: 600,
          cursor: "pointer"
        }}>
              All days
            </button>
            <span
              className="app-btn"
              data-dev-section-key="valet-showing-jobs-label"
              data-dev-section-type="badge"
              data-dev-section-parent="valet-filter-row"
              data-dev-background-token="success-surface"
              style={{
          minHeight: "44px",
          height: "44px",
          padding: "0 16px",
          borderRadius: "var(--control-radius)",
          background: "var(--success-surface)",
          color: "var(--success-text)",
          fontSize: "14px",
          fontWeight: 700,
          cursor: "default",
          pointerEvents: "none"
        }}>
              Showing {filteredJobs.length} job
              {filteredJobs.length === 1 ? "" : "s"}
            </span>
          </DevLayoutSection>
          {error && <DevLayoutSection sectionKey="valet-error-banner" parentKey="valet-controls-shell" sectionType="content-card" style={{
        padding: "12px 16px",
        borderRadius: "var(--radius-xs)",
        backgroundColor: "var(--danger-surface)",
        color: "var(--danger)",
        fontSize: "14px",
        fontWeight: 600
      }}>
              {error}
            </DevLayoutSection>}
        </DevLayoutSection>

        {loading ? <LayerTheme sectionKey="valet-jobs-loading" parentKey="app-layout-page-card" sectionType="content-card">
            <div className="app-table-shell-wrap app-table-shell-scroll">
              <TableSkeleton
                label="Loading valet jobs"
                rows={8}
                columns={["Job Number", "Reg", "Customer", "Vehicle Here", "Workshop", "MOT", "Wash", "EST Tech Completion"]}
              />
            </div>
          </LayerTheme> : filteredJobs.length === 0 ? <LayerTheme data-presentation="valet-table" sectionKey="valet-jobs-empty" parentKey="app-layout-page-card" sectionType="content-card" style={{
      textAlign: "center",
      color: "var(--surfaceTextMuted)",
      fontSize: "16px"
    }}>
            {selectedDay ? `No valet jobs found for ${formatDateOnlyLabel(selectedDay)}.` : "No jobs requiring wash were found."}
          </LayerTheme> : <LayerTheme sectionKey="valet-jobs-list" parentKey="app-layout-page-card" sectionType="content-card">
            <div className="app-table-shell-wrap app-table-shell-scroll">
            <table
              className="app-data-table app-table-shell app-table-shell--with-headings"
              data-dev-section="1"
              data-dev-section-key="valet-jobs-table"
              data-dev-section-type="data-table"
              data-dev-section-parent="valet-jobs-list">
              <thead
                data-dev-section="1"
                data-dev-section-key="valet-jobs-headings"
                data-dev-section-type="table-headings"
                data-dev-section-parent="valet-jobs-table">
                <tr>
                  <th>Job Number</th>
                  <th>Reg</th>
                  <th>Customer</th>
                  <th style={{ textAlign: "center" }}>Vehicle Here</th>
                  <th style={{ textAlign: "center" }}>Workshop</th>
                  <th style={{ textAlign: "center" }}>MOT</th>
                  <th style={{ textAlign: "center" }}>Wash</th>
                  <th style={{ textAlign: "right" }}>EST Tech Completion</th>
                </tr>
              </thead>
              <tbody
                data-dev-section="1"
                data-dev-section-key="valet-jobs-rows"
                data-dev-section-type="table-rows"
                data-dev-section-parent="valet-jobs-table">
                {filteredJobs.map((job, index) => <ValetJobRow key={job.id || job.jobNumber || `valet-job-${index}`} job={job} checklist={valetState[job.id] || buildChecklist(job)} onToggle={handleToggle} isSaving={Boolean(savingMap[job.id])} etaSignals={etaSignalsByJobId[job.id] || null} now={etaNow} onOpenJob={selectedJob => {
          const selectedJobNumber = selectedJob?.jobNumber;
          if (!selectedJobNumber) return;
          void router.push(`/valet/${encodeURIComponent(selectedJobNumber)}`);
        }} />)}
              </tbody>
            </table>
            </div>
          </LayerTheme>}
    </div>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
