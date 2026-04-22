// file location: src/components/page-ui/valet/valet-ui.js

export default function ValetDashboardUi(props) {
  const {
    CalendarField,
    DevLayoutSection,
    InlineLoading,
    SearchBar,
    VALET_ROW_HEIGHT,
    VALET_TABLE_COLUMNS,
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
      return <>
      <DevLayoutSection sectionKey="valet-shell" sectionType="page-shell" shell style={{
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: "20px",
    gap: "16px"
  }}>
        <DevLayoutSection sectionKey="valet-controls-shell" parentKey="valet-shell" sectionType="section-shell" style={{
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    }}>
          <DevLayoutSection sectionKey="valet-filter-row" parentKey="valet-controls-shell" sectionType="filter-row" style={{
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
          border: "1px solid rgba(var(--grey-accent-rgb), 0.3)",
          background: "var(--surface)",
          color: "var(--text-primary)",
          fontWeight: 600,
          cursor: "pointer"
        }}>
              Today
            </button>
            <button type="button" onClick={() => setSelectedDay("")} style={{
          padding: "10px 14px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid rgba(var(--grey-accent-rgb), 0.3)",
          background: "var(--surface)",
          color: "var(--text-primary)",
          fontWeight: 600,
          cursor: "pointer"
        }}>
              All days
            </button>
            <span style={{
          fontSize: "14px",
          color: "var(--grey-accent)"
        }}>
              Showing {filteredJobs.length} job
              {filteredJobs.length === 1 ? "" : "s"}
            </span>
          </DevLayoutSection>
          {!loading && filteredJobs.length > 0 && <DevLayoutSection sectionKey="valet-table-header" parentKey="valet-controls-shell" sectionType="toolbar" style={{
        display: "grid",
        gridTemplateColumns: VALET_TABLE_COLUMNS,
        gap: "10px",
        width: "100%",
        padding: "0 16px 4px",
        alignItems: "center",
        fontSize: "11px",
        fontWeight: 700,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.03em"
      }}>
              <span style={{
          minWidth: 0
        }}>Job Number</span>
              <span style={{
          minWidth: 0
        }}>Reg</span>
              <span style={{
          minWidth: 0
        }}>Customer</span>
              <span style={{
          textAlign: "center",
          minWidth: 0
        }}>Vehicle Here</span>
              <span style={{
          textAlign: "center",
          minWidth: 0
        }}>Workshop</span>
              <span style={{
          textAlign: "center",
          minWidth: 0
        }}>MOT</span>
              <span style={{
          textAlign: "center",
          minWidth: 0
        }}>Wash</span>
              <span style={{
          textAlign: "right"
        }}>EST TECH COMPLETION</span>
            </DevLayoutSection>}
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

        {loading ? <DevLayoutSection sectionKey="valet-jobs-loading" parentKey="valet-shell" sectionType="content-card" style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "60px 0",
      fontSize: "16px",
      color: "var(--grey-accent)"
    }}>
            Loading valet jobs…
          </DevLayoutSection> : filteredJobs.length === 0 ? <DevLayoutSection sectionKey="valet-jobs-empty" parentKey="valet-shell" sectionType="content-card" style={{
      padding: "60px 0",
      textAlign: "center",
      color: "var(--grey-accent-light)",
      fontSize: "16px"
    }}>
            {selectedDay ? `No valet jobs found for ${formatDateOnlyLabel(selectedDay)}.` : "No jobs requiring wash were found."}
          </DevLayoutSection> : <DevLayoutSection sectionKey="valet-jobs-list" parentKey="valet-shell" sectionType="section-shell" style={{
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      paddingBottom: "24px",
      width: "100%"
    }}>
            {filteredJobs.map(job => <DevLayoutSection key={job.id} sectionKey={`valet-job-row-${job.id}`} parentKey="valet-jobs-list" sectionType="content-card" style={{
        minHeight: VALET_ROW_HEIGHT
      }}>
                <ValetJobRow job={job} checklist={valetState[job.id] || buildChecklist(job)} onToggle={handleToggle} isSaving={Boolean(savingMap[job.id])} etaSignals={etaSignalsByJobId[job.id] || null} now={etaNow} onOpenJob={selectedJob => {
          const selectedJobNumber = selectedJob?.jobNumber;
          if (!selectedJobNumber) return;
          void router.push(`/job-cards/valet/${encodeURIComponent(selectedJobNumber)}`);
        }} />
              </DevLayoutSection>)}
          </DevLayoutSection>}
      </DevLayoutSection>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
