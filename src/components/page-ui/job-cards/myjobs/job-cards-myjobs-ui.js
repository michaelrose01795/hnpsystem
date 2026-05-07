// file location: src/components/page-ui/job-cards/myjobs/job-cards-myjobs-ui.js
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)

export default function MyJobsPageUi(props) {
  const {
    InlineLoading,
    JobCardModal,
    SKELETON_ROW_COUNT,
    SearchBar,
    SkeletonBlock,
    SkeletonKeyframes,
    activeJobIds,
    deriveJobTypeDisplay,
    filter,
    filteredJobs,
    getMakeModel,
    getStatusBadgeStyle,
    getTechStatusCategory,
    handleJobClick,
    loading,
    myJobs,
    prefetchJob,
    prefilledJobNumber,
    resolveTechStatusLabel,
    resolveTechStatusTooltip,
    rowSkeletonCells,
    searchTerm,
    setFilter,
    setPrefilledJobNumber,
    setSearchTerm,
    setShowStartJobModal,
    showStartJobModal,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <div style={{
  padding: "40px",
  display: "flex",
  justifyContent: "center"
}}>
        <InlineLoading width={180} label="Loading roster" />
      </div>; // render extracted page section.

    case "section2":
      return <>
        <div style={{
    padding: "40px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh"
  }}>
          <div style={{
      fontSize: "60px",
      marginBottom: "20px"
    }}>⚠️</div>
          <h2 style={{
      color: "var(--primary)",
      marginBottom: "10px",
      fontWeight: "700"
    }}>
            Access Denied
          </h2>
          <p style={{
      color: "var(--grey-accent)",
      fontSize: "16px"
    }}>
            This page is only accessible to Technicians and MOT Testers.
          </p>
        </div>
      </>; // render extracted page section.

    case "section3":
      return <>
      {loading && <SkeletonKeyframes />}
      <div className="app-page-stack" style={{
    minHeight: "100%"
  }}>
        {/* Search and Filter Bar */}
        <LayerTheme sectionKey="myjobs-filter-toolbar" sectionType="filter-row" parentKey="app-layout-page-card" backgroundToken="theme-filter-card" className="myjobs-filter-toolbar" style={{
      display: "flex",
      flexDirection: "row",
      gap: "12px",
      alignItems: "center",
      flexWrap: "wrap"
    }}>
          {/* Search Input */}
          <SearchBar placeholder="Search by job number, customer, reg, or vehicle..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onClear={() => setSearchTerm("")} style={{
        flex: 1,
        minWidth: "220px"
      }} />

          {/* Filter Buttons */}
          <div data-dev-section="1" data-dev-section-key="myjobs-filter-buttons" data-dev-section-type="toolbar" data-dev-section-parent="myjobs-filter-toolbar" style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap"
      }}>
            {[{
          value: "all",
          label: "All Jobs"
        }, {
          value: "in-progress",
          label: "In Progress"
        }, {
          value: "pending",
          label: "Waiting"
        }, {
          value: "complete",
          label: "Complete"
        }].map(({
          value,
          label
        }) => <Button key={value} type="button" variant="primary" className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>
                {label}
              </Button>)}
          </div>
        </LayerTheme>

        {/* Jobs List */}
        <LayerTheme sectionKey="myjobs-results-shell" sectionType="content-card" parentKey="app-layout-page-card" backgroundToken="theme-results-card" style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      minHeight: 0
    }}>
          {loading ? <div className="app-table-shell-scroll" data-dev-section="1" data-dev-section-key="myjobs-results-scroll" data-dev-section-type="data-table" data-dev-section-parent="myjobs-results-shell" role="status" aria-live="polite" aria-label="Loading jobs" style={{
        flex: 1,
        overflowY: "hidden",
        minHeight: 0
      }}>
              <table className="app-data-table app-table-shell app-table-shell--with-headings myjobs-table" data-dev-section="1" data-dev-section-key="myjobs-results-table-loading" data-dev-section-type="data-table" data-dev-section-parent="myjobs-results-scroll">
                <thead data-dev-section="1" data-dev-section-key="myjobs-results-header" data-dev-section-type="table-headings" data-dev-section-parent="myjobs-results-table-loading">
                  <tr>
                    <th>Status</th>
                    <th>Job</th>
                    <th>Reg</th>
                    <th>Customer</th>
                    <th>Make/Model</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody data-dev-section="1" data-dev-section-key="myjobs-results-loading-rows" data-dev-section-type="table-rows" data-dev-section-parent="myjobs-results-table-loading">
              {Array.from({
          length: SKELETON_ROW_COUNT
        }).map((_, rowIndex) => <tr key={`myjobs-skeleton-${rowIndex}`} data-dev-section="1" data-dev-section-key={`myjobs-row-skeleton-${rowIndex}`} data-dev-section-type="table-row" data-dev-section-parent="myjobs-results-loading-rows">
                    <td><SkeletonBlock width="110px" height="24px" borderRadius="var(--radius-xs)" /></td>
                    <td><SkeletonBlock width={rowSkeletonCells[1].width} height="16px" /></td>
                    <td><SkeletonBlock width={rowSkeletonCells[2].width} height="14px" /></td>
                    <td><SkeletonBlock width={rowSkeletonCells[3].width} height="14px" /></td>
                    <td><SkeletonBlock width={rowSkeletonCells[4].width} height="14px" /></td>
                    <td><SkeletonBlock width={rowSkeletonCells[5].width} height="12px" /></td>
                  </tr>)}
                </tbody>
              </table>
            </div> : filteredJobs.length === 0 ? <div data-dev-section="1" data-dev-section-key="myjobs-empty-state" data-dev-section-type="content-card" data-dev-section-parent="myjobs-results-shell" data-dev-background-token="surface-empty-state" style={{
        backgroundColor: "transparent",
        padding: "60px",
        textAlign: "center",
        margin: "auto",
        maxWidth: "520px"
      }}>
              <div style={{
          fontSize: "64px",
          marginBottom: "20px"
        }}>
                {searchTerm ? "🔍" : "📭"}
              </div>
              <h3 style={{
          fontSize: "20px",
          fontWeight: "600",
          color: "var(--text-1)",
          marginBottom: "8px"
        }}>
                {searchTerm ? "No jobs found" : "No jobs assigned"}
              </h3>
              <p style={{
          color: "var(--grey-accent)",
          fontSize: "14px"
        }}>
                {searchTerm ? "Try adjusting your search or filter criteria" : "You currently have no jobs assigned to you"}
              </p>
            </div> : <div className="app-table-shell-scroll" data-dev-section="1" data-dev-section-key="myjobs-results-scroll" data-dev-section-type="data-table" data-dev-section-parent="myjobs-results-shell" style={{
        flex: 1,
        overflowY: "auto",
        minHeight: 0
      }}>
              <table className="app-data-table app-table-shell app-table-shell--with-headings myjobs-table" data-dev-section="1" data-dev-section-key="myjobs-results-table" data-dev-section-type="data-table" data-dev-section-parent="myjobs-results-scroll">
                <thead data-dev-section="1" data-dev-section-key="myjobs-results-header" data-dev-section-type="table-headings" data-dev-section-parent="myjobs-results-table">
                  <tr>
                    <th>Status</th>
                    <th>Job</th>
                    <th>Reg</th>
                    <th>Customer</th>
                    <th>Make/Model</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody data-dev-section="1" data-dev-section-key="myjobs-results-rows" data-dev-section-type="table-rows" data-dev-section-parent="myjobs-results-table">
              {filteredJobs.map(job => {
          const isClockedOn = activeJobIds.has(job.id);
          const displayStatusLabel = resolveTechStatusLabel(job, {
            isClockedOn
          });
          const statusStyle = getStatusBadgeStyle(displayStatusLabel);
          const statusTooltip = resolveTechStatusTooltip(job, {
            isClockedOn
          });
          const makeModel = getMakeModel(job);
          const jobType = deriveJobTypeDisplay(job, {
            includeExtraCount: true
          });
          return <tr key={job.id || job.jobNumber} className="myjobs-row" data-dev-section="1" data-dev-section-key={`myjobs-row-${job.id || job.jobNumber}`} data-dev-section-type="table-row" data-dev-section-parent="myjobs-results-rows" data-dev-background-token={`myjobs-status-${getTechStatusCategory(displayStatusLabel)}`} onClick={() => handleJobClick(job)} style={{
            cursor: "pointer",
            transition: "all 0.2s ease",
            position: "relative",
            zIndex: 0
          }} onMouseEnter={e => {
            e.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
            prefetchJob(job.jobNumber); // warm SWR cache on hover
          }} onMouseLeave={e => {
            e.currentTarget.style.zIndex = "0";
          }}>
                    {/* Status Badge */}
                    <td className="myjobs-cell myjobs-status-cell" title={statusTooltip}>
                      <span className="myjobs-status-badge" style={{
              backgroundColor: statusStyle.background,
              color: statusStyle.color,
              height: "var(--table-action-btn-height, 32px)",
              padding: "0 12px",
              borderRadius: "var(--radius-xs)",
              fontSize: "11px",
              fontWeight: "700",
              whiteSpace: "nowrap",
              minWidth: "110px",
              textAlign: "center",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
                      {displayStatusLabel}
                      </span>
                    </td>

                    {/* Job Number */}
                    <td className="myjobs-cell myjobs-jobnumber" style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "var(--text-1)"
            }}>
                      {job.jobNumber || "No Job #"}
                    </td>

                    {/* Registration */}
                    <td className="myjobs-cell myjobs-reg" style={{
              fontSize: "14px",
              color: "var(--text-1)",
              fontWeight: "600"
            }}>
                      {job.reg || "No Reg"}
                    </td>

                    {/* Customer */}
                    <td className="myjobs-cell myjobs-customer" style={{
              fontSize: "13px",
              color: "var(--text-1)"
            }}>
                      {job.customer || "Unknown"}
                    </td>

                    {/* Make/Model */}
                    <td className="myjobs-cell myjobs-make" style={{
              fontSize: "13px",
              color: "var(--text-1)"
            }}>
                      {makeModel}
                    </td>

                    {/* Job Type */}
                    <td className="myjobs-cell myjobs-type" style={{
              fontSize: "12px",
              color: "var(--text-1)"
            }}>
                      {jobType}
                    </td>

                  </tr>;
        })}
                </tbody>
              </table>
            </div>}
        </LayerTheme>

        {/* Job Count Summary */}
        <LayerTheme sectionKey="myjobs-summary" sectionType="content-card" parentKey="app-layout-page-card" backgroundToken="theme-summary-card">
          <div data-dev-section="1" data-dev-section-key="myjobs-summary-grid" data-dev-section-type="content-card" data-dev-section-parent="myjobs-summary" style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "16px",
        textAlign: "center"
      }}>
            <div data-dev-section="1" data-dev-section-key="myjobs-summary-total" data-dev-section-type="stat-card" data-dev-section-parent="myjobs-summary-grid">
              <div style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "var(--primary)",
            marginBottom: "4px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "34px"
          }}>
                {loading ? <SkeletonBlock width="48px" height="28px" borderRadius="8px" /> : myJobs.length}
              </div>
              <div style={{
            fontSize: "13px",
            color: "var(--grey-accent)"
          }}>Total Jobs</div>
            </div>
            <div data-dev-section="1" data-dev-section-key="myjobs-summary-in-progress" data-dev-section-type="stat-card" data-dev-section-parent="myjobs-summary-grid">
              <div style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "var(--info)",
            marginBottom: "4px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "34px"
          }}>
                {loading ? <SkeletonBlock width="48px" height="28px" borderRadius="8px" /> : myJobs.filter(j => getTechStatusCategory(resolveTechStatusLabel(j, {
              isClockedOn: activeJobIds.has(j.id)
            })) === "in-progress").length}
              </div>
              <div style={{
            fontSize: "13px",
            color: "var(--grey-accent)"
          }}>In Progress</div>
            </div>
            <div data-dev-section="1" data-dev-section-key="myjobs-summary-waiting" data-dev-section-type="stat-card" data-dev-section-parent="myjobs-summary-grid">
              <div style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "var(--danger)",
            marginBottom: "4px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "34px"
          }}>
                {loading ? <SkeletonBlock width="48px" height="28px" borderRadius="8px" /> : myJobs.filter(j => getTechStatusCategory(resolveTechStatusLabel(j, {
              isClockedOn: activeJobIds.has(j.id)
            })) === "pending").length}
              </div>
              <div style={{
            fontSize: "13px",
            color: "var(--grey-accent)"
          }}>Waiting</div>
            </div>
            <div data-dev-section="1" data-dev-section-key="myjobs-summary-complete" data-dev-section-type="stat-card" data-dev-section-parent="myjobs-summary-grid">
              <div style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "var(--info)",
            marginBottom: "4px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "34px"
          }}>
                {loading ? <SkeletonBlock width="48px" height="28px" borderRadius="8px" /> : myJobs.filter(j => getTechStatusCategory(resolveTechStatusLabel(j, {
              isClockedOn: activeJobIds.has(j.id)
            })) === "complete").length}
              </div>
              <div style={{
            fontSize: "13px",
            color: "var(--grey-accent)"
          }}>Completed</div>
            </div>
          </div>
        </LayerTheme>

      </div>

      {/* Start Job Modal */}
      <JobCardModal isOpen={showStartJobModal} onClose={() => {
    setShowStartJobModal(false); // Close modal
    setPrefilledJobNumber(""); // Clear prefilled job number
  }} prefilledJobNumber={prefilledJobNumber} // Pass the prefilled job number to modal
  />
      <style jsx>{`
        @media (max-width: 480px) {
          :global(.app-page-stack) {
            gap: 12px !important;
          }
          :global([data-dev-section-key="myjobs-filter-toolbar"]) {
            padding: 12px !important;
            gap: 10px !important;
          }
          :global([data-dev-section-key="myjobs-filter-toolbar"] .search-bar) {
            min-width: 0 !important;
          }
          :global([data-dev-section-key="myjobs-filter-buttons"]) {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            width: 100%;
            gap: 8px !important;
          }
          :global([data-dev-section-key="myjobs-filter-buttons"] button) {
            width: 100%;
            min-width: 0;
          }
          :global([data-dev-section-key="myjobs-results-scroll"]) {
            gap: 10px !important;
            padding-right: 0 !important;
          }
          :global(.myjobs-row) {
            gap: 8px !important;
            padding: 12px !important;
            border-radius: 14px !important;
          }
          :global(.myjobs-status) {
            max-width: 100% !important;
          }
          :global(.myjobs-jobnumber),
          :global(.myjobs-reg),
          :global(.myjobs-type) {
            flex: 1 1 calc(50% - 4px) !important;
          }
          :global(.myjobs-customer),
          :global(.myjobs-make) {
            flex: 1 1 100% !important;
          }
          :global([data-dev-section-key="myjobs-summary"]) {
            padding: 12px !important;
          }
          :global([data-dev-section-key="myjobs-summary-grid"]) {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }
          :global([data-dev-section-key="myjobs-summary-grid"] > div) {
            border-radius: 12px;
            padding: 12px 10px;
            background: var(--surface);
          }
          :global([data-dev-section-key="myjobs-summary-grid"] > div > div:first-child) {
            font-size: 1.35rem !important;
          }
          :global([data-dev-section-key="myjobs-summary-grid"] > div > div:last-child) {
            font-size: 0.78rem !important;
          }
        }
      `}</style>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
