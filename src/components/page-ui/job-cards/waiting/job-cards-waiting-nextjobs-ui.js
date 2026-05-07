// file location: src/components/page-ui/job-cards/waiting/job-cards-waiting-nextjobs-ui.js

import React from "react"; // support extracted fragments.
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical "theme" layer primitive (alternates with LayerSurface)

export default function NextJobsPageUi(props) {
  const {
    DRAG_PREVIEW_OFFSET_PX,
    InlineLoading,
    OUTSTANDING_GRID_MAX_HEIGHT_PX,
    PANEL_HEIGHT_PX,
    SearchBar,
    activeDropTarget,
    assignedJobs,
    assignedMotJobs,
    deriveJobTypeLabel,
    dragState,
    draggingJob,
    dropIndicator,
    feedbackMessage,
    filteredOutstandingJobs,
    formatAppointmentTime,
    formatCheckedInTime,
    formatCustomerStatus,
    getJobDetailsRequestRows,
    getJobRequestItems,
    getJobRequestsCount,
    handleCardPointerDown,
    handleCloseJobDetails,
    handleOpenJobDetails,
    handleViewSelectedJobCard,
    hasAccess,
    highlightedSearchJobNumbers,
    hoveredRequestJobNumber,
    isDragActive,
    jobCardRefs,
    jobDetailsPopupPrimaryButtonStyle,
    jobDetailsPopupSecondaryButtonStyle,
    jobDetailsPopupWarningButtonStyle,
    matchesDropIndicator,
    motPanelList,
    outstandingJobs,
    renderAssigneePanel,
    searchTerm,
    selectedJob,
    setHoveredRequestJobNumber,
    setSearchTerm,
    unassignTechFromJob,
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
    textAlign: "center"
  }}>
          <h2 style={{
      color: "var(--primary)"
    }}>Access Denied</h2>
          <p>You do not have access to Next Jobs.</p>
        </div>
      </>; // render extracted page section.

    case "section3":
      return null; // render empty page state.

    case "section4":
      return <>
      <div data-presentation="nextjobs-board" style={{
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  }}>
        
        {/* ✅ Outstanding Jobs Section with Drop Zone */}
            <LayerTheme sectionKey="nextjobs-outstanding" parentKey="app-layout-page-card" sectionType="content-card" backgroundToken="theme" padding="16px" gap={undefined} style={{
      marginBottom: "12px",
      // Drop-target outline is a state indicator (drag-over highlight), not a surface border. Kept per rules.
      outline: activeDropTarget === "outstanding" ? "3px solid var(--primary)" : "none",
      boxShadow: activeDropTarget === "outstanding" ? "0 4px 12px rgba(0, 0, 0, 0.2)" : "0 2px 4px rgba(var(--shadow-rgb),0.08)",
      minHeight: OUTSTANDING_GRID_MAX_HEIGHT_PX,
      flexShrink: 0,
      transition: "all 0.2s ease",
      color: "var(--text-1)"
    }}>
          <div data-presentation="nextjobs-outstanding" data-dev-section-key="nextjobs-outstanding-header" data-dev-section-parent="nextjobs-outstanding" data-dev-section-type="toolbar" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        marginBottom: "12px"
      }}>
            <h2 style={{
          fontSize: "18px",
          fontWeight: "600",
          color: "var(--accent-purple)",
          flexShrink: 0,
          margin: 0
        }}>
              Outstanding Jobs ({outstandingJobs.length})
            </h2>
            <SearchBar placeholder="Search job number, reg, or customer..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onClear={() => setSearchTerm("")} style={{
        width: "320px",
        maxWidth: "45%",
        minWidth: "220px",
        marginLeft: "auto"
      }} />
          </div>

          <div data-dev-section-key="nextjobs-outstanding-scroll" data-dev-section-parent="nextjobs-outstanding" data-dev-section-type="section-shell" data-dnd-target-type="outstanding" data-dnd-target-key="outstanding" style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}>
            <div data-dnd-target-type="outstanding" data-dnd-target-key="outstanding" style={{
          flex: 1,
          overflowY: "auto",
          maxHeight: OUTSTANDING_GRID_MAX_HEIGHT_PX,
          paddingRight: "6px"
        }}>
              {filteredOutstandingJobs.length === 0 ? <>
                  <p style={{
              color: "var(--text-1)",
              fontSize: "14px",
              margin: 0
            }}>
                    {searchTerm.trim() ? "No matching jobs found." : "No outstanding jobs."}
                  </p>
                  {activeDropTarget === "outstanding" && draggingJob && <div style={{
              height: "3px",
              backgroundColor: "var(--primary)",
              borderRadius: "var(--radius-xs)",
              marginTop: "12px"
            }} />}
                </> : <div className="outstanding-grid">
                  {filteredOutstandingJobs.map(job => {
              const jobTypeLabel = deriveJobTypeLabel(job);
              const customerStatus = formatCustomerStatus(job.waitingStatus);
              const requestsCount = getJobRequestsCount(job);
              const requestItems = getJobRequestItems(job);
              const isSearchHighlighted = highlightedSearchJobNumbers.includes(job.jobNumber);
              const showRequestsHover = hoveredRequestJobNumber === job.jobNumber && requestItems.length > 0;
              const appointmentDisplay = formatAppointmentTime(job);
              return <React.Fragment key={job.jobNumber}>
                        {matchesDropIndicator("outstanding", "outstanding", job.jobNumber, "before") && <div style={{
                  height: "3px",
                  backgroundColor: "var(--primary)",
                  marginBottom: "8px",
                  borderRadius: "var(--radius-xs)"
                }} />}
                        <div ref={node => {
                  if (node) {
                    jobCardRefs.current[job.jobNumber] = node;
                  } else if (jobCardRefs.current[job.jobNumber]) {
                    delete jobCardRefs.current[job.jobNumber];
                  }
                }} data-dnd-job-card="true" data-dnd-job-number={job.jobNumber} onPointerDown={handleCardPointerDown(job, () => handleOpenJobDetails(job))} style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "14px",
                  position: "relative",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: draggingJob?.jobNumber === job.jobNumber ? "var(--surface)" : isSearchHighlighted ? "var(--success-surface)" : "var(--surface)",
                  cursor: hasAccess ? "grab" : "pointer",
                  transition: "border 0.2s, background-color 0.2s, transform 0.2s",
                  touchAction: "none",
                  boxShadow: isSearchHighlighted ? "0 0 0 2px rgba(34, 197, 94, 0.18), 0 8px 18px rgba(34, 197, 94, 0.22)" : "none"
                }} title={`${job.jobNumber} – ${job.customer || "Unknown customer"}`}>
                          <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px"
                  }}>
                            <div>
                              <div style={{
                        fontWeight: 700,
                        fontSize: "16px",
                        color: "var(--accent-purple)"
                      }}>
                                {job.jobNumber}
                              </div>
                              <div style={{
                        fontSize: "13px",
                        color: "var(--text-1)"
                      }}>
                                {job.reg || "Reg TBC"}
                              </div>
                            </div>
                            <span onPointerDown={event => event.stopPropagation()} onMouseEnter={() => {
                      if (requestItems.length > 0) {
                        setHoveredRequestJobNumber(job.jobNumber);
                      }
                    }} onMouseLeave={() => {
                      setHoveredRequestJobNumber(current => current === job.jobNumber ? null : current);
                    }} style={{
                      padding: "4px 10px",
                      borderRadius: "var(--control-radius)",
                      backgroundColor: "var(--danger-surface)",
                      color: "var(--danger)",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: requestItems.length > 0 ? "help" : "default"
                    }}>
                              {jobTypeLabel}
                            </span>
                          </div>
                          {showRequestsHover ? <div onPointerDown={event => event.stopPropagation()} onMouseEnter={() => setHoveredRequestJobNumber(job.jobNumber)} onMouseLeave={() => {
                    setHoveredRequestJobNumber(current => current === job.jobNumber ? null : current);
                  }} style={{
                    position: "absolute",
                    top: "48px",
                    right: "14px",
                    width: "min(320px, calc(100% - 28px))",
                    maxHeight: "160px",
                    overflowY: "auto",
                    padding: "12px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--surface)",
                    boxShadow: "0 12px 28px rgba(var(--shadow-rgb), 0.18)",
                    zIndex: 3
                  }}>
                              <div style={{
                      marginBottom: "8px",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--accent-purple)"
                    }}>
                                Job Requests
                              </div>
                              <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}>
                                {requestItems.map((request, index) => <div key={request.id} style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "flex-start",
                        fontSize: "12px",
                        color: "var(--text-1)",
                        lineHeight: "1.4"
                      }}>
                                    <span style={{
                          flexShrink: 0,
                          width: "18px",
                          color: "var(--accent-purple)",
                          fontWeight: 700
                        }}>
                                      {index + 1}.
                                    </span>
                                    <span>{request.text}</span>
                                  </div>)}
                              </div>
                            </div> : null}
                          <div style={{
                    fontSize: "13px",
                    color: "var(--text-1)"
                  }}>
                            {job.customer || "Unknown customer"}
                          </div>
                          <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    fontSize: "12px",
                    color: "var(--text-1)"
                  }}>
                            <span>
                              <strong>Requests:</strong> {requestsCount}
                            </span>
                            <span>
                              <strong>Appointment:</strong> {appointmentDisplay}
                            </span>
                            <span>
                              <strong>Checked in:</strong> {formatCheckedInTime(job.checkedInAt)}
                            </span>
                          </div>
                          <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                            <span style={{
                      padding: "4px 10px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "11px",
                      fontWeight: 600,
                      backgroundColor: "var(--surface)",
                      color: "var(--accent-purple)"
                    }}>
                              {customerStatus}
                            </span>
                            <span style={{
                      fontSize: "12px",
                      color: "var(--text-1)"
                    }}>
                              {job.status || "Status pending"}
                            </span>
                          </div>
                        </div>
                        {matchesDropIndicator("outstanding", "outstanding", job.jobNumber, "after") && <div style={{
                  height: "3px",
                  backgroundColor: "var(--primary)",
                  marginBottom: "8px",
                  borderRadius: "var(--radius-xs)"
                }} />}
                      </React.Fragment>;
            })}
                  {filteredOutstandingJobs.length > 0 && activeDropTarget === "outstanding" && !dropIndicator?.targetJobNumber && draggingJob && <div style={{
              height: "3px",
              backgroundColor: "var(--primary)",
              borderRadius: "var(--radius-xs)",
              marginTop: "4px"
            }} />}
                </div>}
            </div>
          </div>
        </LayerTheme>

        {/* ✅ Technicians Grid Section */}
            <LayerTheme sectionKey="nextjobs-technicians" parentKey="app-layout-page-card" shell sectionType="content-card" backgroundToken="theme" padding="24px" gap="24px" style={{
      flex: "1 0 auto"
    }}>
          
          <div data-presentation="nextjobs-technicians" data-dev-section-key="nextjobs-tech-grid" data-dev-section-parent="nextjobs-technicians" data-dev-section-type="data-table" data-dev-width-mode="full" style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gridAutoRows: PANEL_HEIGHT_PX,
        gap: "16px",
        width: "100%"
      }}>
            {assignedJobs.slice(0, 6).map(renderAssigneePanel)}
          </div>

              {motPanelList.length > 0 && <div data-dev-section-key="nextjobs-mot-section" data-dev-section-parent="nextjobs-technicians" data-dev-section-type="section-shell">
                  <h3 style={{
          margin: "0 0 12px 0",
          fontSize: "18px",
          fontWeight: "600",
          color: "var(--accent-purple)"
        }}>
                    MOT Testers
                  </h3>
              <div data-dev-section-key="nextjobs-mot-grid" data-dev-section-parent="nextjobs-mot-section" data-dev-section-type="data-table" data-dev-width-mode="full" style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gridAutoRows: PANEL_HEIGHT_PX,
          gap: "16px"
        }}>
                {assignedMotJobs.slice(0, 2).map(renderAssigneePanel)}
              </div>
            </div>}
        </LayerTheme>

        {isDragActive && draggingJob && <div aria-hidden="true" style={{
      position: "fixed",
      left: dragState.clientX + DRAG_PREVIEW_OFFSET_PX,
      top: dragState.clientY + DRAG_PREVIEW_OFFSET_PX,
      pointerEvents: "none",
      zIndex: 3200,
      minWidth: "180px",
      maxWidth: "260px",
      padding: "10px 12px",
      borderRadius: "var(--radius-md)",
      background: "rgba(255, 255, 255, 0.96)",
      boxShadow: "0 12px 28px rgba(0, 0, 0, 0.16)"
    }}>
            <div style={{
        fontSize: "13px",
        fontWeight: 700,
        color: "var(--accent-purple)",
        marginBottom: "2px"
      }}>
              {draggingJob.jobNumber}
            </div>
            <div style={{
        fontSize: "12px",
        color: "var(--text-1)"
      }}>
              {draggingJob.reg || "Reg TBC"}
            </div>
          </div>}

        <style jsx global>{`
          body.nextjobs-drag-active,
          body.nextjobs-drag-active * {
            user-select: none !important;
            -webkit-user-select: none !important;
            -webkit-touch-callout: none !important;
            cursor: grabbing !important;
          }
        `}</style>

        {/* ✅ JOB DETAILS POPUP */}
        {selectedJob && (() => {
      const rawDetailsRows = getJobDetailsRequestRows(selectedJob);
      const detailsRows = Array.isArray(rawDetailsRows) ? rawDetailsRows : [];
      const hasScrollableDetails = detailsRows.length > 5;
      const assignedToName = selectedJob.assignedTech?.name || "Unassigned";
      return <div className="popup-backdrop" onClick={handleCloseJobDetails}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: "500px", maxHeight: "90vh", overflow: "hidden" }}>
              <LayerSurface className="popup-card" sectionKey="nextjobs-job-details-popup" sectionType="content-card" backgroundToken="surface" radius="var(--radius-xl)" padding="32px" style={{
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative"
        }}>
              <h3 style={{
            fontWeight: "700",
            marginBottom: "16px",
            fontSize: "20px",
            color: "var(--primary)"
          }}>
                Job Details
              </h3>
              
              {feedbackMessage && <div style={{
            marginBottom: "16px",
            padding: "12px 14px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: feedbackMessage.type === "error" ? "var(--danger-surface)" : "var(--success)",
            color: feedbackMessage.type === "error" ? "var(--danger)" : "var(--text-1)",
            fontSize: "14px",
            fontWeight: 600,
            border: "none"
          }}>
                  {feedbackMessage.text}
                </div>}
              
              <div style={{
            marginBottom: "20px"
          }}>
                <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "12px"
            }}>
                  {[{
                label: "Job Number",
                value: selectedJob.jobNumber || "Not available"
              }, {
                label: "Reg",
                value: selectedJob.reg || "Not available"
              }, {
                label: "Customer",
                value: selectedJob.customer || "Unknown customer"
              }].map(item => <div key={item.label} style={{
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--theme)"
              }}>
                      <div style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--accent-purple)",
                  marginBottom: "6px"
                }}>
                        {item.label}
                      </div>
                      <div style={{
                  fontSize: "14px",
                  color: "var(--text-1)",
                  fontWeight: 600
                }}>
                        {item.value}
                      </div>
                    </div>)}
                </div>

                <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "16px"
            }}>
                  {[{
                label: "Make & Model",
                value: [selectedJob.make, selectedJob.model].filter(Boolean).join(" ") || selectedJob.makeModel || "Not available"
              }, {
                label: "Status",
                value: selectedJob.status || "Status pending"
              }, {
                label: "Assigned To",
                value: assignedToName
              }].map(item => <div key={item.label} style={{
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--theme)"
              }}>
                      <div style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--accent-purple)",
                  marginBottom: "6px"
                }}>
                        {item.label}
                      </div>
                      <div style={{
                  fontSize: "14px",
                  color: "var(--text-1)",
                  fontWeight: 600
                }}>
                        {item.value}
                      </div>
                    </div>)}
                </div>

                <div style={{
              padding: "14px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--theme)"
            }}>
                  <div style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--accent-purple)",
                marginBottom: "8px"
              }}>
                    Description
                  </div>
                  {detailsRows.length > 0 ? <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: hasScrollableDetails ? "280px" : "none",
                overflowY: hasScrollableDetails ? "auto" : "visible",
                paddingRight: hasScrollableDetails ? "4px" : 0
              }}>
                      {detailsRows.map(row => <div key={row.id} style={{
                  display: "grid",
                  gridTemplateColumns: "120px minmax(0, 1fr)",
                  gap: "10px",
                  alignItems: "start",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-xs)",
                  backgroundColor: "var(--surface)"
                }}>
                          <div style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "var(--accent-purple)"
                  }}>
                            {row.label}
                          </div>
                          <div style={{
                    fontSize: "13px",
                    color: "var(--text-1)",
                    lineHeight: "1.45"
                  }}>
                            {row.text}
                          </div>
                        </div>)}
                    </div> : <div style={{
                fontSize: "14px",
                color: "var(--text-1)"
              }}>
                      No request details recorded.
                    </div>}
                </div>
              </div>

              <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${selectedJob?.assignedTech ? 3 : 2}, minmax(0, 1fr))`,
            gap: "12px"
          }}>
                <button style={jobDetailsPopupPrimaryButtonStyle} onClick={handleViewSelectedJobCard} onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = "var(--primary-selected)";
              e.currentTarget.style.borderColor = "var(--primary-selected)";
            }} onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "var(--accent-purple)";
              e.currentTarget.style.borderColor = "var(--accent-purple)";
            }}>
                  View Job Card
                </button>
                {selectedJob.assignedTech && <button style={jobDetailsPopupWarningButtonStyle} onClick={unassignTechFromJob} // Unassign technician
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = "var(--warning)";
              e.currentTarget.style.color = "var(--text-2)";
            }} onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "var(--warning-surface)";
              e.currentTarget.style.color = "var(--warning-dark)";
            }}>
                    Unassign
                  </button>}
                <button style={jobDetailsPopupSecondaryButtonStyle} onClick={handleCloseJobDetails} // Close popup
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = "var(--surface)";
              e.currentTarget.style.borderColor = "var(--accent-purple)";
            }} onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "var(--theme)";
              e.currentTarget.style.borderColor = "var(--accent-purple)";
            }}>
                  Close
                </button>
              </div>
            </LayerSurface>
            </div>
          </div>;
    })()}
        <style jsx>{`
          .outstanding-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }
          @media (max-width: 1280px) {
            .outstanding-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
          @media (max-width: 960px) {
            .outstanding-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 640px) {
            .outstanding-grid {
              grid-template-columns: repeat(1, minmax(0, 1fr));
            }
          }
        `}</style>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
