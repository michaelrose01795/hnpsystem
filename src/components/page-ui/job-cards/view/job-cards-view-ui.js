// file location: src/components/page-ui/job-cards/view/job-cards-view-ui.js
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerSurface from "@/components/ui/LayerSurface";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";

const OPERATIONAL_STATUS_ITEMS = [
  { key: "arrived", label: "Arrived" },
  { key: "waiting", label: "Waiting" },
  { key: "inWorkshop", label: "In workshop" },
  { key: "awaitingParts", label: "Awaiting parts" },
  { key: "awaitingAuthorisation", label: "Awaiting auth" },
  { key: "ready", label: "Ready" },
  { key: "overdue", label: "Overdue" },
  { key: "carryOvers", label: "Carry overs" },
];

export default function ViewJobCardsUi(props) {
  const {
    DevLayoutSection,
    DropdownField,
    JobListCard,
    OrderListCard,
    PageShell,
    PageSkeleton,
    SearchBar,
    SectionShell,
    TabGroup,
    activeStatusFilter,
    activeTab,
    baseJobs,
    combinedStatusOptions,
    divisionFilter,
    emptyStateMessage,
    formatDetectedJobTypeLabel,
    goToJobCard,
    handleCardNavigation,
    handleDivisionFilterChange,
    handleSearchValueChange,
    handleStatusChange,
    handleStatusFilterChange,
    isCompactView,
    isOrdersTab,
    operationalNow,
    operationalStatusCounts,
    ordersLoading,
    popupCardStyles,
    popupJob,
    popupOverlayStyles,
    popupPrimaryActionButtonStyle,
    popupQuietActionButtonStyle,
    popupSecondaryActionButtonStyle,
    popupStatusLabel,
    prefetchJob,
    router,
    searchPlaceholder,
    searchValues,
    setActiveTab,
    setPopupJob,
    sortedJobs,
    statusCounts,
    statusTabs,
    tabOptions,
    technicianLoads,
    toggleJobViewDensity,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <PageSkeleton />; // render extracted page section.

    case "section2":
      return <>
      <PageShell sectionKey="job-cards-view-shell">
      <div className="app-page-stack job-cards-view-page-stack">
          <SectionShell sectionKey="job-cards-view-filter-shell" parentKey="job-cards-view-shell" className="job-cards-view-filter-shell">
            <div className="job-cards-view-toolbar">
              <div className="job-cards-view-tabs">
                <TabGroup items={tabOptions} value={activeTab} onChange={setActiveTab} ariaLabel="Job card tabs" className="tab-api--wrap" />
              </div>
              <div className="job-cards-view-search-shell">
                <SearchBar data-presentation="job-cards-search" className="job-cards-view-searchbar" placeholder={searchPlaceholder} value={searchValues[activeTab]} onChange={event => handleSearchValueChange(activeTab, event.target.value)} onClear={() => handleSearchValueChange(activeTab, "")} />
                {!isOrdersTab && <DevLayoutSection className="job-cards-view-filter-controls" sectionKey="job-cards-view-filter-controls" parentKey="job-cards-view-filter-shell" sectionType="toolbar">
                    <DevLayoutSection data-presentation="job-cards-division-filter" className="job-cards-view-filter-slot" sectionKey="job-cards-view-filter-controls-division-slot" parentKey="job-cards-view-filter-controls" sectionType="filter-control">
                      <DevLayoutSection className="job-cards-view-filter-control" sectionKey="job-cards-view-division-filter" parentKey="job-cards-view-filter-controls-division-slot" sectionType="filter-control">
                        <DropdownField className="job-cards-filter" value={divisionFilter} options={[{
                      value: "All",
                      label: "Division filter: All"
                    }, {
                      value: "Retail",
                      label: "Division filter: Retail"
                    }, {
                      value: "Sales",
                      label: "Division filter: Sales"
                    }]} size="sm" onValueChange={value => handleDivisionFilterChange(value)} />
                      </DevLayoutSection>
                    </DevLayoutSection>
                    <DevLayoutSection data-presentation="job-cards-status-filter" className="job-cards-view-filter-slot" sectionKey="job-cards-view-filter-controls-status-slot" parentKey="job-cards-view-filter-controls" sectionType="filter-control">
                      <DevLayoutSection className="job-cards-view-filter-control" sectionKey="job-cards-view-status-filter" parentKey="job-cards-view-filter-controls-status-slot" sectionType="filter-control">
                        <DropdownField className="job-cards-filter" value={activeStatusFilter} options={statusTabs.map(status => ({
                      value: status,
                      label: `Status filter: ${status}`,
                      description: status === "All" ? `${baseJobs.length} total` : `${statusCounts[status] || 0} jobs`
                    }))} size="sm" onValueChange={value => handleStatusFilterChange(activeTab, value)} />
                      </DevLayoutSection>
                    </DevLayoutSection>
                  </DevLayoutSection>}
                <Button type="button" variant={isCompactView ? "primary" : "secondary"} className="app-btn--icon app-hover-tooltip job-cards-view-density-toggle" onClick={toggleJobViewDensity} aria-label={isCompactView ? "Use detailed job rows" : "Use compact job rows"} aria-pressed={isCompactView} data-tooltip={isCompactView ? "Detailed job rows" : "Compact job rows"}>
                  <svg className="job-cards-view-density-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true" focusable="false">
                    <path d="M8 6h11M8 12h11M8 18h11" />
                    <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth="3" />
                  </svg>
                </Button>
              </div>
            </div>
          </SectionShell>

          {!isOrdersTab && <LayerTheme sectionKey="job-cards-view-operational-statuses" parentKey="job-cards-view-shell" sectionType="content-card" className="app-summary-section app-job-operational-summary" radius="var(--radius-sm)">
            <div className="app-summary-grid" role="list" aria-label="Operational job status counts">
              {OPERATIONAL_STATUS_ITEMS.map((item) => <LayerSurface key={item.key} as="div" className="app-summary-item" radius="var(--radius-sm)" role="listitem">
                <span className="app-summary-label">{item.label}</span>
                <strong className="app-summary-value">{operationalStatusCounts?.[item.key] || 0}</strong>
              </LayerSurface>)}
            </div>
          </LayerTheme>}

          <SectionShell sectionKey="job-cards-view-list-shell" parentKey="job-cards-view-shell" style={{
          flex: 1,
          overflow: "hidden",
          padding: "10px",
          minHeight: "0"
        }}>
            <DevLayoutSection sectionKey="job-cards-view-list-viewport" parentKey="job-cards-view-list-shell" sectionType="scroll-region" style={{
            height: "100%",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
            }}>
              {isOrdersTab && ordersLoading ? <LayerTheme sectionKey="job-cards-view-orders-loading" parentKey="job-cards-view-list-viewport" sectionType="state-banner" radius="var(--radius-sm)" padding="32px" style={{
              textAlign: "center",
              color: "var(--text-2)"
            }}>
                  Loading orders...
                </LayerTheme> : sortedJobs.length === 0 ? <LayerTheme sectionKey="job-cards-view-empty-state" parentKey="job-cards-view-list-viewport" sectionType="state-banner" radius="var(--radius-sm)" padding="8px">
                  <EmptyState variant="bare" role="status" icon="🔍" title={emptyStateMessage} />
                </LayerTheme> : sortedJobs.map((job, index) => isOrdersTab ? <OrderListCard key={job.id || job.orderNumber} sectionKey={`job-cards-view-order-row-${job.id || job.orderNumber || index + 1}`} parentKey="job-cards-view-list-viewport" order={job} index={index} onNavigate={() => router.push(`/new-order/${job.orderNumber}`)} /> : <JobListCard key={job.jobNumber} sectionKey={`job-cards-view-job-row-${job.jobNumber || index + 1}`} parentKey="job-cards-view-list-viewport" compactView={isCompactView} job={job} index={index} now={operationalNow} technicianLoad={technicianLoads?.[job.assignedTech?.id || job.assignedTo] || null} onNavigate={() => handleCardNavigation(job.jobNumber)} onOpenTab={(tab) => router.push(`/job-cards/${job.jobNumber}?tab=${tab}`)} onMouseEnter={() => prefetchJob(job.jobNumber)} />)}
            </DevLayoutSection>
          </SectionShell>

          {/* ✅ Job Popup - Enhanced with all new fields */}
          {popupJob && <>
              <DevLayoutSection sectionKey="job-cards-view-quick-view-overlay" parentKey="job-cards-view-shell" sectionType="floating-action" style={{
            ...popupOverlayStyles,
            zIndex: "var(--z-modal)"
          }} onClick={() => setPopupJob(null)}>
              <DevLayoutSection sectionKey="job-cards-view-quick-view-card" parentKey="job-cards-view-quick-view-overlay" sectionType="content-card" onClick={e => e.stopPropagation()} style={{
              ...popupCardStyles,
              padding: "var(--page-card-padding)",
              maxWidth: "700px",
              width: "90%",
              maxHeight: "85vh",
              overflowY: "auto"
            }}>
              {/* Popup Header */}
              <div style={{
                marginBottom: "24px"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start"
                }}>
                  <div>
                    <h2 style={{
                      fontSize: "24px",
                      fontWeight: "700",
                      color: "var(--text-1)",
                      marginBottom: "4px"
                    }}>
                      {popupJob.jobNumber}
                    </h2>
                    <p style={{
                      fontSize: "16px",
                      color: "var(--grey-accent)",
                      margin: 0
                    }}>
                      {popupJob.customer}
                    </p>
                  </div>
                  {/* ✅ Job Source Badge */}
                  <div style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                    justifyContent: "flex-end"
                  }}>
                    {popupJob.jobDivision && <span style={{
                      backgroundColor: popupJob.jobDivision.toLowerCase() === "sales" ? "var(--theme)" : "var(--success-surface)",
                      color: popupJob.jobDivision.toLowerCase() === "sales" ? "var(--info)" : "var(--success-dark)",
                      padding: "8px 16px",
                      borderRadius: "var(--control-radius-xs)",
                      fontSize: "12px",
                      fontWeight: "600",
                      letterSpacing: "0.3px"
                    }}>
                        {popupJob.jobDivision}
                      </span>}
                    <span style={{
                      backgroundColor: popupJob.jobSource === "Warranty" ? "var(--warning)" : "var(--success)",
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: "var(--control-radius-xs)",
                      fontSize: "12px",
                      fontWeight: "600",
                      border: "1px solid transparent",
                      letterSpacing: "0.3px"
                    }}>
                      {popupJob.jobSource || "Retail"}
                    </span>
                    {/* ✅ Prime/Sub-job badge */}
                    {popupJob.primeJobNumber && <span style={{
                      backgroundColor: "var(--primary-surface)",
                      color: "var(--primary)",
                      padding: "8px 16px",
                      borderRadius: "var(--radius-xs)",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                        {popupJob.isPrimeJob ? "🔗 Prime Job" : `Sub-job of #${popupJob.primeJobNumber}`}
                      </span>}
                  </div>
                </div>
              </div>

              {/* ✅ Job Details - Enhanced */}
              <LayerTheme radius="var(--radius-sm)" style={{
                marginBottom: "20px"
              }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px"
                }}>
                  <div style={{
                    fontSize: "14px",
                    color: "var(--grey-accent)"
                  }}>
                    <strong>Registration:</strong> {popupJob.reg}
                  </div>
                  {popupJob.makeModel && <div style={{
                    fontSize: "14px",
                    color: "var(--grey-accent)"
                  }}>
                      <strong>Vehicle:</strong> {popupJob.makeModel}
                    </div>}
                  {popupJob.vin && <div style={{
                    fontSize: "14px",
                    color: "var(--grey-accent)"
                  }}>
                      <strong>VIN:</strong> {popupJob.vin}
                    </div>}
                  {popupJob.mileage && <div style={{
                    fontSize: "14px",
                    color: "var(--grey-accent)"
                  }}>
                      <strong>Mileage:</strong> {Number(popupJob.mileage || 0).toLocaleString()} miles
                    </div>}
                  {/* ✅ Waiting Status */}
                  {popupJob.waitingStatus && popupJob.waitingStatus !== "Neither" && <div style={{
                    fontSize: "14px",
                    color: "var(--grey-accent)"
                  }}>
                      <strong>Customer Status:</strong> {popupJob.waitingStatus}
                    </div>}
                  {popupJob.appointment && <div style={{
                    fontSize: "14px",
                    color: "var(--grey-accent)"
                  }}>
                      <strong>Appointment:</strong> {popupJob.appointment.date} at {popupJob.appointment.time}
                    </div>}
                </div>

                {/* ✅ Job Categories */}
                {popupJob.jobCategories && popupJob.jobCategories.length > 0 && <div style={{
                  marginTop: "12px"
                }}>
                    <strong style={{
                    fontSize: "14px",
                    color: "var(--grey-accent)"
                  }}>Job Types:</strong>
                    <div style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginTop: "6px"
                  }}>
                      {popupJob.jobCategories.map((category, idx) => <span key={idx} style={{
                      backgroundColor: "var(--surface)",
                      color: "var(--text-1)",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-xs)",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}>
                          {formatDetectedJobTypeLabel(category)}
                        </span>)}
                    </div>
                  </div>}

                {/* ✅ Job Requests */}
                {popupJob.requests && popupJob.requests.length > 0 && <div style={{
                  marginTop: "12px"
                }}>
                    <strong style={{
                    fontSize: "14px",
                    color: "var(--grey-accent)"
                  }}>Customer Requests:</strong>
                    <ul style={{
                    margin: "6px 0 0 0",
                    paddingLeft: "20px"
                  }}>
                      {popupJob.requests.map((req, idx) => <li key={idx} style={{
                      fontSize: "13px",
                      color: "var(--grey-accent)",
                      marginBottom: "4px"
                    }}>
                          {req.text || req} 
                          {req.time && <span style={{
                        color: "var(--grey-accent-light)"
                      }}> ({req.time}h)</span>}
                          {req.paymentType && req.paymentType !== "Customer" && <span style={{
                        marginLeft: "8px",
                        backgroundColor: "var(--warning-surface)",
                        padding: "2px 6px",
                        borderRadius: "var(--radius-xs)",
                        fontSize: "11px"
                      }}>
                              {req.paymentType}
                            </span>}
                        </li>)}
                    </ul>
                  </div>}

                {/* ✅ Cosmetic Notes */}
                {popupJob.cosmeticNotes && <div style={{
                  marginTop: "12px"
                }}>
                    <strong style={{
                    fontSize: "14px",
                    color: "var(--grey-accent)"
                  }}>Cosmetic Damage:</strong>
                    <p style={{
                    fontSize: "13px",
                    color: "var(--grey-accent)",
                    margin: "4px 0 0 0"
                  }}>
                      {popupJob.cosmeticNotes}
                    </p>
                  </div>}
              </LayerTheme>

              {/* Status Badges */}
              <div style={{
                display: "flex",
                gap: "12px",
                marginBottom: "20px",
                flexWrap: "wrap"
              }}>
                <div style={{
                  backgroundColor: "var(--theme)",
                  color: "var(--info-dark)",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  VHC Checks: {popupJob.vhcChecks?.length || 0}
                </div>
                <div style={{
                  backgroundColor: "var(--warning-surface)",
                  color: "var(--accent-purple)",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  Parts Requests: {popupJob.partsRequests?.length || 0}
                </div>
                <div style={{
                  backgroundColor: "var(--success-surface)",
                  color: "var(--success-dark)",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  Notes: {popupJob.notes?.length || 0}
                </div>
                {/* ✅ Files Badge */}
                {popupJob.files && popupJob.files.length > 0 && <div style={{
                  backgroundColor: "var(--theme)",
                  color: "var(--accent-purple)",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                    Files: {popupJob.files.length}
                  </div>}
                {/* ✅ VHC Required Badge */}
                {popupJob.vhcRequired && <div style={{
                  backgroundColor: "var(--surface)",
                  color: "var(--accent-purple)",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                    VHC REQUIRED
                  </div>}
              </div>

              {/* Status Dropdown */}
              <div style={{
                marginBottom: "20px"
              }}>
                <label style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "var(--grey-accent)",
                  display: "block",
                  marginBottom: "8px"
                }}>
                  Update Status
                </label>
                <select value={popupStatusLabel || ""} onChange={e => handleStatusChange(popupJob.id, e.target.value)} style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "14px",
                  borderRadius: "var(--radius-xs)",
                  border: "none",
                  backgroundColor: "var(--surface)",
                  cursor: "pointer"
                }}>
                  {combinedStatusOptions.map(statusOption => <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>)}
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap"
              }}>
                <button onClick={() => goToJobCard(popupJob.jobNumber)} style={popupPrimaryActionButtonStyle} onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = "var(--primary-selected)";
                  e.currentTarget.style.borderColor = "var(--primary-selected)";
                }} onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = "var(--accent-purple)";
                  e.currentTarget.style.borderColor = "var(--accent-purple)";
                }}>
                  View Full Details
                </button>

                <button onClick={() => router.push(`/tech/${popupJob.jobNumber}?tab=vhc`)} style={popupSecondaryActionButtonStyle} onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = "var(--surface)";
                  e.currentTarget.style.borderColor = "var(--accent-purple)";
                }} onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = "var(--theme)";
                  e.currentTarget.style.borderColor = "var(--accent-purple)";
                }}>
                  View VHC
                </button>

                <button onClick={() => router.push(`/job-cards/${popupJob.jobNumber}?tab=write-up`)} style={popupSecondaryActionButtonStyle} onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = "var(--surface)";
                  e.currentTarget.style.borderColor = "var(--accent-purple)";
                }} onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = "var(--theme)";
                  e.currentTarget.style.borderColor = "var(--accent-purple)";
                }}>
                  Write-Up
                </button>
              </div>

              {/* Close Button */}
              <button onClick={() => setPopupJob(null)} style={popupQuietActionButtonStyle} onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = "var(--theme)";
                e.currentTarget.style.borderColor = "var(--accent-purple)";
              }} onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = "var(--surface)";
                e.currentTarget.style.borderColor = "var(--theme)";
              }}>
                Close
              </button>
            </DevLayoutSection>
          </DevLayoutSection>
            </>}
      </div>
      </PageShell>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
