// file location: src/components/page-ui/job-cards/myjobs/job-cards-myjobs-ui.js

export default function MyJobsPageUi(props) {
  const {
    DevLayoutSection,
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
    router,
    rowSkeletonCells,
    searchTerm,
    setFilter,
    setPrefilledJobNumber,
    setSearchTerm,
    setShowStartJobModal,
    showStartJobModal,
    summarizePartsPipeline,
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
      <DevLayoutSection sectionKey="myjobs-page-shell" sectionType="page-shell" backgroundToken="surface-page" shell className="app-page-stack" style={{
    minHeight: "100%"
  }}>
        {/* Header */}
        <DevLayoutSection sectionKey="myjobs-page-header" sectionType="toolbar" parentKey="myjobs-page-shell" className="myjobs-page-header" style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
          <div></div>

        </DevLayoutSection>

        {/* Search and Filter Bar */}
        <DevLayoutSection sectionKey="myjobs-filter-toolbar" sectionType="filter-row" parentKey="myjobs-page-shell" backgroundToken="surface-filter-card" style={{
      display: "flex",
      gap: "12px",
      alignItems: "center",
      flexWrap: "wrap",
      padding: "12px",
      backgroundColor: "var(--accent-surface)",
      border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
      borderRadius: "var(--radius-sm)",
      color: "var(--search-text)"
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
        }) => <button key={value} onClick={() => setFilter(value)} style={{
          minHeight: "var(--control-height-md)",
          padding: "0 16px",
          backgroundColor: filter === value ? "var(--primary)" : "var(--surface)",
          color: filter === value ? "var(--surface)" : "var(--primary)",
          border: "1px solid var(--primary)",
          borderRadius: "var(--input-radius)",
          cursor: "pointer",
          fontSize: "0.9rem",
          fontWeight: filter === value ? "600" : "500",
          whiteSpace: "nowrap",
          transition: "all 0.2s",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center"
        }} onMouseEnter={e => {
          if (filter !== value) {
            e.target.style.backgroundColor = "var(--surface-light)";
          }
        }} onMouseLeave={e => {
          if (filter !== value) {
            e.target.style.backgroundColor = "var(--surface)";
          }
        }}>
                {label}
              </button>)}
          </div>
        </DevLayoutSection>

        {/* Jobs List */}
        <DevLayoutSection sectionKey="myjobs-results-shell" sectionType="content-card" parentKey="myjobs-page-shell" backgroundToken="surface-results-card" style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      borderRadius: "var(--radius-xl)",
      border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
      background: "var(--accent-surface)",
      padding: "var(--page-card-padding)",
      overflow: "hidden",
      minHeight: 0
    }}>
          {loading ? <div data-dev-section="1" data-dev-section-key="myjobs-results-scroll" data-dev-section-type="content-card" data-dev-section-parent="myjobs-results-shell" role="status" aria-live="polite" aria-label="Loading jobs" style={{
        flex: 1,
        overflowY: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        paddingRight: "8px",
        minHeight: 0
      }}>
              {/* Header strip — identical to the real header so the column
                  rhythm matches when real data arrives. */}
              <div className="myjobs-header" data-dev-section="1" data-dev-section-key="myjobs-results-header" data-dev-section-type="table-headings" data-dev-section-parent="myjobs-results-scroll" style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "8px 16px",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "var(--accent-surface-hover)",
          border: "none",
          fontSize: "12px",
          fontWeight: "700",
          color: "var(--primary-dark)",
          textTransform: "uppercase",
          letterSpacing: "0.04em"
        }}>
                <div style={{
            minWidth: "110px",
            textAlign: "center"
          }}>Status</div>
                <div style={{
            minWidth: "90px"
          }}>Job</div>
                <div style={{
            minWidth: "80px"
          }}>Reg</div>
                <div style={{
            minWidth: "140px",
            flex: "0 0 auto"
          }}>Customer</div>
                <div style={{
            minWidth: "160px",
            flex: "1 1 auto"
          }}>Make/Model</div>
                <div style={{
            minWidth: "80px"
          }}>Type</div>
              </div>
              {Array.from({
          length: SKELETON_ROW_COUNT
        }).map((_, rowIndex) => <div key={`myjobs-skeleton-${rowIndex}`} className="myjobs-row" data-dev-section="1" data-dev-section-key={`myjobs-row-skeleton-${rowIndex}`} data-dev-section-type="content-card" data-dev-section-parent="myjobs-results-scroll" style={{
          border: "none",
          padding: "12px 16px",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "var(--surface)",
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
                  {/* Status badge skeleton — matches the pill shape + min-width */}
                  <SkeletonBlock width="110px" height="24px" borderRadius="var(--radius-xs)" />
                  <SkeletonBlock width={rowSkeletonCells[1].width} height="16px" />
                  <SkeletonBlock width={rowSkeletonCells[2].width} height="14px" />
                  <SkeletonBlock width={rowSkeletonCells[3].width} height="14px" />
                  <div style={{
            flex: "1 1 auto",
            minWidth: "160px"
          }}>
                    <SkeletonBlock width={rowSkeletonCells[4].width} height="14px" />
                  </div>
                  <SkeletonBlock width={rowSkeletonCells[5].width} height="12px" />
                </div>)}
            </div> : filteredJobs.length === 0 ? <div data-dev-section="1" data-dev-section-key="myjobs-empty-state" data-dev-section-type="content-card" data-dev-section-parent="myjobs-results-shell" data-dev-background-token="surface-empty-state" style={{
        backgroundColor: "transparent",
        padding: "60px",
        borderRadius: "var(--radius-md)",
        border: "none",
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
          color: "var(--text-secondary)",
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
            </div> : <div data-dev-section="1" data-dev-section-key="myjobs-results-scroll" data-dev-section-type="content-card" data-dev-section-parent="myjobs-results-shell" style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        paddingRight: "8px",
        minHeight: 0
      }}>
              <div className="myjobs-header" data-dev-section="1" data-dev-section-key="myjobs-results-header" data-dev-section-type="table-headings" data-dev-section-parent="myjobs-results-scroll" style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "8px 16px",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "var(--accent-surface-hover)",
          border: "none",
          fontSize: "12px",
          fontWeight: "700",
          color: "var(--primary-dark)",
          textTransform: "uppercase",
          letterSpacing: "0.04em"
        }}>
                <div style={{
            minWidth: "110px",
            textAlign: "center"
          }}>Status</div>
                <div style={{
            minWidth: "90px"
          }}>Job</div>
                <div style={{
            minWidth: "80px"
          }}>Reg</div>
                <div style={{
            minWidth: "140px",
            flex: "0 0 auto"
          }}>Customer</div>
                <div style={{
            minWidth: "160px",
            flex: "1 1 auto"
          }}>Make/Model</div>
                <div style={{
            minWidth: "80px"
          }}>Type</div>
              </div>
              {filteredJobs.map(job => {
          const isClockedOn = activeJobIds.has(job.id);
          const displayStatusLabel = resolveTechStatusLabel(job, {
            isClockedOn
          });
          const statusStyle = getStatusBadgeStyle(displayStatusLabel);
          const statusTooltip = resolveTechStatusTooltip(job, {
            isClockedOn
          });
          const description = job.description?.trim();
          const makeModel = getMakeModel(job);

          // ✅ VHC Status Indicator
          const vhcRequired = job.vhcRequired === true;
          const vhcColor = vhcRequired ? "var(--info)" : "var(--danger)"; // Green if required, Red if not
          const vhcBgColor = vhcRequired ? "var(--success)" : "var(--danger-surface)";
          const vhcText = vhcRequired ? "VHC Required" : "No VHC";
          const handleVhcBadgeClick = event => {
            if (!vhcRequired || !job.jobNumber) return;
            event.stopPropagation();
            router.push(`/job-cards/myjobs/${job.jobNumber}?tab=vhc`);
          };
          const handleVhcBadgeKeyDown = event => {
            if (!vhcRequired) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleVhcBadgeClick(event);
            }
          };
          const jobType = deriveJobTypeDisplay(job, {
            includeExtraCount: true
          });
          const partsPending = (job.partsRequests || []).some(request => {
            const status = (request.status || "").toLowerCase();
            return !["picked", "fitted", "cancelled"].includes(status);
          });
          const partsIndicatorColor = partsPending ? "var(--danger)" : "var(--info)";
          const jobPipeline = summarizePartsPipeline(job.partsAllocations || [], {
            quantityField: "quantityRequested"
          });
          const stageBadges = (jobPipeline.stageSummary || []).filter(stage => stage.count > 0);
          return <div key={job.id || job.jobNumber} className="myjobs-row" data-dev-section="1" data-dev-section-key={`myjobs-row-${job.id || job.jobNumber}`} data-dev-section-type="content-card" data-dev-section-parent="myjobs-results-scroll" data-dev-background-token={`myjobs-status-${getTechStatusCategory(displayStatusLabel)}`} onClick={() => handleJobClick(job)} style={{
            border: "none",
            padding: "12px 16px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--surface)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            position: "relative",
            zIndex: 0
          }} onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.borderColor = "var(--primary)";
            e.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
            prefetchJob(job.jobNumber); // warm SWR cache on hover
          }} onMouseLeave={e => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.zIndex = "0";
          }}>
                    {/* Status Badge */}
                    <div className="myjobs-cell myjobs-status" title={statusTooltip} style={{
              backgroundColor: statusStyle.background,
              color: statusStyle.color,
              padding: "6px 12px",
              borderRadius: "var(--radius-xs)",
              fontSize: "11px",
              fontWeight: "700",
              whiteSpace: "nowrap",
              minWidth: "110px",
              textAlign: "center"
            }}>
                      {displayStatusLabel}
                    </div>

                    {/* Job Number */}
                    <span className="myjobs-cell myjobs-jobnumber" style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "var(--text-primary)",
              minWidth: "90px"
            }}>
                      {job.jobNumber || "No Job #"}
                    </span>

                    {/* Registration */}
                    <span className="myjobs-cell myjobs-reg" style={{
              fontSize: "14px",
              color: "var(--text-secondary)",
              fontWeight: "600",
              minWidth: "80px"
            }}>
                      {job.reg || "No Reg"}
                    </span>

                    {/* Customer */}
                    <span className="myjobs-cell myjobs-customer" style={{
              fontSize: "13px",
              color: "var(--text-primary)",
              minWidth: "140px",
              flex: "0 0 auto"
            }}>
                      {job.customer || "Unknown"}
                    </span>

                    {/* Make/Model */}
                    <span className="myjobs-cell myjobs-make" style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              minWidth: "160px",
              flex: "1 1 auto"
            }}>
                      {makeModel}
                    </span>

                    {/* Job Type */}
                    <span className="myjobs-cell myjobs-type" style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              minWidth: "80px"
            }}>
                      {jobType}
                    </span>

                  </div>;
        })}
            </div>}
        </DevLayoutSection>

        {/* Job Count Summary */}
        <DevLayoutSection sectionKey="myjobs-summary" sectionType="content-card" parentKey="myjobs-page-shell" backgroundToken="surface-summary-card" className="app-section-card" style={{
      border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
      background: "var(--accent-surface)"
    }}>
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
        </DevLayoutSection>

      </DevLayoutSection>

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
            padding: 10px 12px !important;
            font-size: 0.82rem !important;
          }
          :global([data-dev-section-key="myjobs-results-shell"]) {
            padding: 12px !important;
            border-radius: 16px !important;
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
