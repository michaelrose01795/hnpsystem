// file location: src/components/page-ui/job-cards/view/job-cards-view-ui.js
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerSurface from "@/components/ui/LayerSurface";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import PopupModal from "@/components/popups/popupStyleApi";

const formatQuickNoteDate = (value) => {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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
    PageShell,
    PageSkeleton,
    SearchBar,
    SectionShell,
    TabGroup,
    activeStatusFilter,
    activeTab,
    baseJobs,
    combinedStatusOptions,
    closeQuickNote,
    divisionFilter,
    emptyStateMessage,
    formatDetectedJobTypeLabel,
    goToJobCard,
    handleCardNavigation,
    handleDivisionFilterChange,
    handleSearchValueChange,
    handleStatusChange,
    handleStatusFilterChange,
    operationalNow,
    operationalStatusCounts,
    nextJobsTechnicians,
    onOpenQuickNote,
    popupCardStyles,
    popupJob,
    popupOverlayStyles,
    popupPrimaryActionButtonStyle,
    popupQuietActionButtonStyle,
    popupSecondaryActionButtonStyle,
    popupStatusLabel,
    prefetchJob,
    quickNoteError,
    quickNoteHidden,
    quickNoteJob,
    quickNoteLoading,
    quickNoteNotes,
    quickNoteSaving,
    quickNoteText,
    router,
    saveQuickNote,
    searchPlaceholder,
    searchValues,
    setActiveTab,
    setPopupJob,
    setQuickNoteHidden,
    setQuickNoteText,
    sortedJobs,
    statusCounts,
    statusTabs,
    tabOptions,
    technicianLoads,
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
                <DevLayoutSection className="job-cards-view-filter-controls" sectionKey="job-cards-view-filter-controls" parentKey="job-cards-view-filter-shell" sectionType="toolbar">
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
                  </DevLayoutSection>
              </div>
            </div>
          </SectionShell>

          <LayerTheme sectionKey="job-cards-view-operational-statuses" parentKey="job-cards-view-shell" sectionType="content-card" className="app-summary-section app-job-operational-summary" radius="var(--radius-sm)">
            <div className="app-summary-grid" role="list" aria-label="Operational job status counts">
              {OPERATIONAL_STATUS_ITEMS.map((item) => <LayerSurface key={item.key} as="div" className="app-summary-item" radius="var(--radius-sm)" role="listitem">
                <span className="app-summary-label">{item.label}</span>
                <strong className="app-summary-value">{operationalStatusCounts?.[item.key] || 0}</strong>
              </LayerSurface>)}
            </div>
          </LayerTheme>

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
              {sortedJobs.length === 0 ? <LayerTheme sectionKey="job-cards-view-empty-state" parentKey="job-cards-view-list-viewport" sectionType="state-banner" radius="var(--radius-sm)" padding="8px">
                  <EmptyState variant="bare" role="status" icon="🔍" title={emptyStateMessage} />
                </LayerTheme> : sortedJobs.map((job, index) => <JobListCard key={job.jobNumber} sectionKey={`job-cards-view-job-row-${job.jobNumber || index + 1}`} parentKey="job-cards-view-list-viewport" job={job} index={index} nextJobsTechnicians={nextJobsTechnicians} now={operationalNow} technicianLoads={technicianLoads} onNavigate={() => handleCardNavigation(job.jobNumber)} onOpenQuickNote={onOpenQuickNote} onMouseEnter={() => prefetchJob(job.jobNumber)} />)}
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
                      backgroundColor: "var(--secondary)",
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
                        color: "var(--surfaceTextMuted)"
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
                <DropdownField
                  value={popupStatusLabel || ""}
                  onChange={e => handleStatusChange(popupJob.id, e.target.value)}
                  options={combinedStatusOptions}
                  style={{ width: "100%" }}
                />
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
      <PopupModal
        isOpen={Boolean(quickNoteJob)}
        onClose={closeQuickNote}
        closeOnBackdrop={!quickNoteSaving}
        ariaLabel={`Add note to job ${quickNoteJob?.jobNumber || ""}`}
        cardClassName="app-job-quick-note"
        cardStyle={{ width: "min(100%, 760px)" }}>
        {quickNoteJob && <div className="app-job-quick-note__content">
          <header className="app-popup-compact-header">
            <h2>Add note to job {quickNoteJob.jobNumber}</h2>
            <div className="app-popup-compact-header__actions">
              <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/job-cards/${quickNoteJob.jobNumber}?tab=notes`)}>Open full notes</Button>
              <Button type="button" variant="primary" size="sm" busy={quickNoteSaving} onClick={saveQuickNote} disabled={!quickNoteText.trim()}>
                Save note
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={closeQuickNote} disabled={quickNoteSaving}>
                Close
              </Button>
            </div>
          </header>

          <LayerTheme as="section" className="app-job-quick-note__summary" radius="var(--radius-sm)" padding="var(--space-sm)" aria-label="Job summary">
            <div className="app-summary-grid">
              <div className="app-summary-item"><span className="app-summary-label">Registration</span><strong className="app-summary-value">{quickNoteJob.reg || "Not set"}</strong></div>
              <div className="app-summary-item"><span className="app-summary-label">Customer</span><strong className="app-summary-value">{quickNoteJob.customer || "Not set"}</strong></div>
              <div className="app-summary-item"><span className="app-summary-label">Status</span><strong className="app-summary-value">{quickNoteJob.status || "Not set"}</strong></div>
              <div className="app-summary-item"><span className="app-summary-label">Technician</span><strong className="app-summary-value">{quickNoteJob.assignedTech?.fullName || quickNoteJob.assignedTech?.name || quickNoteJob.technician || "Unassigned"}</strong></div>
              <div className="app-summary-item"><span className="app-summary-label">Requests</span><strong className="app-summary-value">{Array.isArray(quickNoteJob.jobRequests) ? quickNoteJob.jobRequests.length : 0}</strong></div>
              <div className="app-summary-item"><span className="app-summary-label">Notes</span><strong className="app-summary-value">{quickNoteNotes.length}</strong></div>
            </div>
          </LayerTheme>

          <label className="app-job-quick-note__field">
            <span>Note</span>
            <textarea
              className="app-input app-input--textarea"
              value={quickNoteText}
              onChange={(event) => setQuickNoteText(event.target.value)}
              placeholder="Add workshop, customer-contact or handover details..."
              rows={5}
              autoFocus />
          </label>

          <label className="app-job-quick-note__visibility">
            <input type="checkbox" className="app-toggle app-toggle--checkbox" checked={quickNoteHidden} onChange={(event) => setQuickNoteHidden(event.target.checked)} />
            <span><strong>Internal note</strong><small>{quickNoteHidden ? "Hidden from the customer" : "Visible to the customer"}</small></span>
          </label>

          {quickNoteError && <div className="app-status-message app-status-message--danger" role="alert">{quickNoteError}</div>}

          <LayerTheme as="section" className="app-job-quick-note__recent" radius="var(--radius-sm)" padding="var(--section-card-padding)" aria-label="Recent notes">
            <div className="app-job-quick-note__section-heading">
              <h3>Recent notes</h3>
            </div>
            {quickNoteLoading ? <p className="app-job-quick-note__empty">Loading notes...</p> : quickNoteNotes.length === 0 ? <p className="app-job-quick-note__empty">No notes have been added to this job.</p> : <ol>
              {quickNoteNotes.slice(0, 4).map((note) => <li key={note.noteId}>
                <div className="app-job-quick-note__note-meta">
                  <strong>{note.createdBy || "Unknown"}</strong>
                  <span>{formatQuickNoteDate(note.createdAt)}</span>
                  <span className={`app-badge ${note.hiddenFromCustomer ? "app-badge--warning" : "app-badge--success"}`}>{note.hiddenFromCustomer ? "Internal" : "Customer visible"}</span>
                </div>
                <p>{note.noteText}</p>
              </li>)}
            </ol>}
          </LayerTheme>

        </div>}
      </PopupModal>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
