// file location: src/components/page-ui/job-cards/myjobs/job-cards-myjobs-job-number-ui.js

export default function TechJobDetailPageUi(props) {
  const {
    BrakesHubsDetailsModal,
    Button,
    CustomerVideoButton,
    DevLayoutSection,
    DocumentsTab,
    DocumentsUploadPopup,
    ExternalDetailsModal,
    InlineLoading,
    InternalElectricsDetailsModal,
    ModalPortal,
    MyJobCardShellSkeleton,
    ServiceIndicatorDetailsModal,
    UndersideDetailsModal,
    VhcAssistantPanel,
    VhcCameraButton,
    WheelsTyresDetailsModal,
    WriteUpForm,
    activeSection,
    activeTab,
    authorisedVhcItems,
    authorizedVhcRows,
    authorizedVhcRowsLoading,
    canClockIntoMotHandoff,
    canCompleteJob,
    canCompleteVhc,
    canManageDocuments,
    clockInLoading,
    clockOutLoading,
    completeJobFeedback,
    completeJobLockedTitle,
    customer,
    dbUserId,
    detectedJobTypes,
    fetchJobData,
    formatDateTime,
    formatPrePickLabel,
    getBadgeState,
    getOptionalCount,
    getPartsStatusStyle,
    handleAddNote,
    handleCompleteJob,
    handleCompleteVhcClick,
    handleDeleteDocument,
    handleJobClockIn,
    handleJobClockOut,
    handlePartsRequestSubmit,
    handleRenameDocument,
    handleReplaceDocument,
    handleSectionComplete,
    handleSectionDismiss,
    isHeaderCompleteStatus,
    isReopenMode,
    isVhcCompleted,
    jobCard,
    jobClocking,
    jobData,
    jobDocuments,
    jobNumber,
    jobStatusBadgeStyle,
    newNote,
    notes,
    notesLoading,
    notesSubmitting,
    openSection,
    partRequestDescription,
    partRequestQuantity,
    partRequestVhcItemId,
    partsFeedback,
    partsRequests,
    partsRequestsLoading,
    partsSubmitting,
    prePickByVhcId,
    quickStats,
    router,
    saveError,
    saveStatus,
    sectionStatus,
    setActiveTab,
    setJobData,
    setLiveWriteUpTasks,
    setNewNote,
    setPartRequestDescription,
    setPartRequestQuantity,
    setPartRequestVhcItemId,
    setPartsFeedback,
    setShowAddNote,
    setShowDocumentsPopup,
    setShowGreenItems,
    setShowJobTypesPopup,
    setShowVhcSummary,
    showAddNote,
    showDocumentsPopup,
    showGreenItems,
    showJobTypesPopup,
    showVhcReopenButton,
    showVhcSummary,
    techStatusDisplay,
    user,
    vehicle,
    vhcAssistantState,
    vhcChecks,
    vhcData,
    vhcSummaryItems,
    vhcTabAmberReady,
    visibleTabs,
    writeUpTechComplete,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <div style={{
    padding: "40px",
    textAlign: "center"
  }}>
          <h2 style={{
      color: "var(--primary)"
    }}>Access Denied</h2>
          <p>This page is only for Technicians.</p>
        </div>
      </>; // render extracted page section.

    case "section2":
      return <MyJobCardShellSkeleton jobNumber={jobNumber} />; // render extracted page section.

    case "section3":
      return <>
        <div style={{
    padding: "40px",
    textAlign: "center"
  }}>
          <h2 style={{
      color: "var(--primary)"
    }}>Job Not Found</h2>
          <button onClick={() => router.push("/job-cards/myjobs")} style={{
      padding: "12px 24px",
      backgroundColor: "var(--primary)",
      color: "white",
      border: "none",
      borderRadius: "var(--radius-xs)",
      cursor: "pointer",
      marginTop: "20px"
    }}>
            Back to My Jobs
          </button>
        </div>
      </>; // render extracted page section.

    case "section4":
      return <div style={{
  padding: "24px",
  display: "flex",
  justifyContent: "center"
}}>
        <InlineLoading width={180} label="Loading roster" />
      </div>; // render extracted page section.

    case "section5":
      return <>
      <DevLayoutSection as="div" sectionKey="myjob-page-shell" sectionType="page-shell" shell style={{
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: "8px 16px",
    overflowY: "auto",
    gap: "12px"
  }}>
        
        {/* Header Section */}
        <DevLayoutSection as="div" sectionKey="myjob-header" sectionType="section-header-row" parentKey="myjob-page-shell" style={{
      display: "flex",
      gap: "12px",
      alignItems: "center",
      marginBottom: "12px",
      padding: "12px",
      backgroundColor: "var(--page-card-bg-alt)",
      borderRadius: "var(--radius-xs)",
      flexShrink: 0
    }}>
          <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        alignSelf: "stretch",
        backgroundColor: "var(--surface)",
        border: "none",
        borderRadius: "var(--radius-sm)",
        padding: "10px 14px",
        width: "fit-content",
        flexShrink: 0
      }}>
            <h1 style={{
          color: "var(--primary)",
          fontSize: "28px",
          fontWeight: "700",
          margin: "0",
          lineHeight: 1
        }}>
              {jobCard.jobNumber}
            </h1>
          </div>
          <div style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "12px"
      }}>
            <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          backgroundColor: "var(--surface)",
          border: "none",
          borderRadius: "var(--radius-sm)",
          padding: "10px 14px",
          flexShrink: 0
        }}>
              {/* Status pill rides the shared .app-btn shape. Semantic colour
                  for non-complete states comes from STATUS_BADGE_STYLES — those
                  background/color tokens are applied inline because .app-btn
                  does not expose a per-status colour variant. */}
              <span className={isHeaderCompleteStatus ? "app-btn app-btn--primary" : "app-btn"} style={isHeaderCompleteStatus ? {
            cursor: "default",
            letterSpacing: "0.02em"
          } : {
            background: jobStatusBadgeStyle.background,
            color: jobStatusBadgeStyle.color,
            border: "none",
            cursor: "default",
            letterSpacing: "0.02em"
          }}>
                {techStatusDisplay}
              </span>
              <span style={{
            fontSize: "12px",
            color: "var(--info)"
          }}>
                Updated {formatDateTime(jobCard.updatedAt)}
              </span>
              <div style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap"
          }}>
                {/* Clock Out / Clock In / Complete Job all use the global `<Button>`
                    component so they share the canonical `.app-btn` sizing, radius
                    and hover treatment. Previously each was an inline-styled <button>
                    with hardcoded padding/border-radius — now visual appearance is
                    centrally owned by the design system. */}
                {jobClocking ? <Button variant="secondary" size="sm" onClick={handleJobClockOut} disabled={clockOutLoading || clockInLoading}>
                    {clockOutLoading ? "Clocking Out..." : "Clock Out"}
                  </Button> : <Button variant="secondary" size="sm" onClick={handleJobClockIn} disabled={clockInLoading || clockOutLoading} title={canClockIntoMotHandoff ? "Clock in to complete the remaining MOT request" : "Clock in to start technician work"}>
                    {clockInLoading ? "Clocking In..." : canClockIntoMotHandoff ? "Clock In to MOT" : "Clock In"}
                  </Button>}

                <Button variant="primary" size="sm" onClick={handleCompleteJob} disabled={!canCompleteJob || clockInLoading || clockOutLoading} title={completeJobLockedTitle}>
                  {canCompleteJob ? "Complete Job" : "Complete Job (locked)"}
                </Button>
              </div>
            </div>
          </div>
        </DevLayoutSection>

        {completeJobFeedback ? <div style={{
      padding: "12px 14px",
      borderRadius: "var(--radius-xs)",
      backgroundColor: "var(--warning-surface)",
      border: "none",
      color: "var(--warning-dark)",
      marginBottom: "12px"
    }}>
            <div style={{
        fontSize: "13px",
        fontWeight: "700",
        marginBottom: "4px"
      }}>
              {completeJobFeedback.title}
            </div>
            <div style={{
        fontSize: "13px",
        lineHeight: 1.45
      }}>
              {completeJobFeedback.detail}
            </div>
          </div> : null}

        {/* Quick Stats Grid */}
        <DevLayoutSection as="div" sectionKey="myjob-quick-stats" sectionType="section-shell" parentKey="myjob-page-shell" style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "12px",
      marginBottom: "12px",
      flexShrink: 0
    }}>
          {quickStats.map(stat => {
        const isClockedHours = stat.label === "Clocked Hours";
        const isClickable = Boolean(stat.onClick);
        const CardTag = isClockedHours || isClickable ? "button" : "div";
        return <CardTag key={stat.label} type={isClockedHours || isClickable ? "button" : undefined} onClick={() => {
          if (isClockedHours) {
            const target = document.getElementById("job-progress-total-time");
            if (target) {
              target.scrollIntoView({
                behavior: "smooth",
                block: "start"
              });
            }
            return;
          }
          if (stat.onClick) {
            stat.onClick();
          }
        }} style={{
          backgroundColor: "var(--layer-section-level-1)",
          border: "none",
          borderRadius: "var(--radius-xs)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "108px",
          cursor: isClockedHours || isClickable ? "pointer" : "default"
        }}>
                <div style={{
            fontSize: stat.pill ? "15px" : "24px",
            fontWeight: "700",
            color: stat.accent,
            backgroundColor: stat.pill ? `${stat.accent}15` : "transparent",
            padding: stat.pill ? "6px 14px" : 0,
            borderRadius: stat.pill ? "var(--control-radius)" : 0,
            letterSpacing: stat.pill ? "0.04em" : 0,
            textTransform: stat.pill ? "uppercase" : "none"
          }}>
                  {stat.value}
                </div>
                <span style={{
            fontSize: "12px",
            color: "var(--info)",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.04em"
          }}>
                  {stat.label}
                </span>
              </CardTag>;
      })}
        </DevLayoutSection>

        {/* Tab Row */}
        <DevLayoutSection as="div" className="app-layout-tab-row" sectionKey="myjob-tab-row" sectionType="tab-row" parentKey="myjob-page-shell" style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginBottom: "12px",
      overflowX: "auto",
      flexShrink: 0,
      scrollbarWidth: "thin",
      scrollbarColor: "var(--scrollbar-thumb) transparent",
      scrollBehavior: "smooth",
      WebkitOverflowScrolling: "touch"
    }}>
          {visibleTabs.map(tab => {
        const isActive = activeTab === tab;
        const isVhcTab = tab === "vhc";
        const isVhcGreen = isVhcTab && isVhcCompleted;
        const isVhcAmber = isVhcTab && vhcTabAmberReady;
        const isComplete = isVhcGreen || tab === "write-up" && writeUpTechComplete;
        const labelMap = {
          overview: "Overview",
          vhc: "VHC",
          parts: "Parts",
          notes: "Notes",
          "write-up": "Write-Up",
          documents: "Documents"
        };
        const tabTone = isComplete ? "success" : isVhcAmber ? "warning" : "default";
        const baseBackground = isActive ? "var(--primary)" : "transparent";
        const completeBackground = isActive ? "var(--success)" : "var(--success-surface)";
        const amberBackground = isActive ? "var(--warning)" : "var(--warning-surface, rgba(245, 158, 11, 0.1))";
        const background = tabTone === "success" ? completeBackground : tabTone === "warning" ? amberBackground : baseBackground;
        const color = tabTone === "success" ? isActive ? "var(--text-inverse)" : "var(--success-dark)" : tabTone === "warning" ? isActive ? "var(--text-inverse)" : "var(--warning-dark)" : isActive ? "var(--text-inverse)" : "var(--text-primary)";
        return <button key={tab} onClick={() => setActiveTab(tab)} style={{
          flex: "0 0 auto",
          borderRadius: "var(--control-radius)",
          border: "1px solid transparent",
          padding: "10px 20px",
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: "pointer",
          background,
          color,
          transition: "all 0.15s ease",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          textTransform: "capitalize",
          whiteSpace: "nowrap"
        }}>
                {labelMap[tab] || tab.replace("-", " ")}
              </button>;
      })}
        </DevLayoutSection>

        {/* Main Content Area with Scrolling */}
        <DevLayoutSection as="div" sectionKey="myjob-main-content" sectionType="section-shell" parentKey="myjob-page-shell" backgroundToken="layer-section-level-1" shell style={{
      flex: 1,
      borderRadius: "var(--radius-xs)",
      border: "none",
      backgroundColor: "var(--layer-section-level-1)",
      padding: "24px",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      minHeight: 0
    }}>
          
          <DevLayoutSection as="div" sectionKey="myjob-main-scroll" sectionType="section-shell" parentKey="myjob-main-content" backgroundToken="none" style={{
        flex: 1,
        overflowY: "auto",
        paddingRight: "8px",
        minHeight: 0
      }}>
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && <DevLayoutSection as="div" sectionKey="myjob-tab-overview" sectionType="section-shell" parentKey="myjob-main-scroll" backgroundToken="none" shell style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
              {/* Job Details */}
              <DevLayoutSection as="div" sectionKey="myjob-overview-details" sectionType="content-card" parentKey="myjob-tab-overview" backgroundToken="surface" style={{
            backgroundColor: "var(--surface)",
            padding: "24px",
            borderRadius: "var(--radius-sm)",
            border: "none"
          }}>
                <h3 style={{
              fontSize: "18px",
              fontWeight: "600",
              marginBottom: "16px"
            }}>
                  Job Details
                </h3>
                {jobCard.requests && jobCard.requests.length > 0 && <div style={{
              marginBottom: "16px"
            }}>
                    <strong style={{
                fontSize: "14px",
                color: "var(--info)",
                letterSpacing: "0.04em"
              }}>Customer Requests:</strong>
                    <div style={{
                marginTop: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                      {jobCard.requests.map((req, i) => <div key={i} style={{
                  padding: "14px 16px",
                  backgroundColor: "var(--surface-light)",
                  borderLeft: "4px solid var(--primary)",
                  borderRadius: "var(--control-radius-xs)",
                  color: "var(--info-dark)"
                }}>
                          <div>{req.text || req}</div>
                          {notes.filter(note => Array.isArray(note.linkedRequestIndices) ? note.linkedRequestIndices.includes(i + 1) : note.linkedRequestIndex === i + 1).map(note => <div key={note.noteId} style={{
                    fontSize: "11px",
                    color: "var(--info)",
                    marginTop: "6px"
                  }}>
                                Note: {note.noteText}
                              </div>)}
                        </div>)}
                    </div>
                  </div>}
                {authorisedVhcItems.length > 0 ? <div style={{
              marginTop: "24px"
            }}>
                  <div style={{
                padding: "16px",
                backgroundColor: "var(--info-surface)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--accent-purple-surface)"
              }}>
                    <div style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "var(--info-dark)",
                  marginBottom: "6px"
                }}>
                      Vehicle Health Check
                    </div>
                    <div>
                      <div>
                        <div style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "var(--info-dark)",
                      marginBottom: "10px"
                    }}>
                          Authorised items
                        </div>
                        <div style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap"
                    }}>
                          {authorisedVhcItems.map(check => {
                        const resolvedVhcId = check.vhc_id ?? check.id;
                        return <div key={resolvedVhcId || check.id} style={{
                          fontSize: "13px",
                          color: "var(--info-dark)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          alignItems: "flex-start",
                          backgroundColor: "var(--success-surface)",
                          border: "none",
                          borderRadius: "var(--radius-xs)",
                          padding: "10px 14px"
                        }}>
                                <span style={{
                            fontWeight: "600",
                            color: "var(--success)"
                          }}>
                                  {check.issue_title || check.issueTitle || check.section}
                                </span>
                                {notes.filter(note => Array.isArray(note.linkedVhcIds) ? note.linkedVhcIds.includes(resolvedVhcId) : note.linkedVhcId === resolvedVhcId).map(note => <div key={note.noteId} style={{
                            fontSize: "11px",
                            color: "var(--info)"
                          }}>
                                      Note: {note.noteText}
                                    </div>)}
                                {(() => {
                            const prePickSet = resolvedVhcId ? prePickByVhcId.get(String(resolvedVhcId)) : null;
                            if (!prePickSet || prePickSet.size === 0) return null;
                            return Array.from(prePickSet).map(location => <div key={`${resolvedVhcId}-${location}`} style={{
                              fontSize: "11px",
                              color: "var(--info)"
                            }}>
                                      Pre pick: {formatPrePickLabel(location)}
                                    </div>);
                          })()}
                              </div>;
                      })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div> : null}
                {jobCard.cosmeticNotes && <div>
                    <strong style={{
                fontSize: "14px",
                color: "var(--info)",
                letterSpacing: "0.04em"
              }}>Cosmetic Notes:</strong>
                    <p style={{
                marginTop: "10px",
                color: "var(--info-dark)",
                lineHeight: 1.6
              }}>{jobCard.cosmeticNotes}</p>
                  </div>}
              </DevLayoutSection>

              <DevLayoutSection as="div" sectionKey="myjob-overview-summary-grid" sectionType="section-shell" parentKey="myjob-tab-overview" backgroundToken="none" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "16px"
          }}>
                {/* Vehicle Info */}
                <DevLayoutSection as="div" sectionKey="myjob-overview-vehicle" sectionType="content-card" parentKey="myjob-overview-summary-grid" backgroundToken="surface" style={{
              backgroundColor: "var(--surface)",
              padding: "24px",
              borderRadius: "var(--radius-sm)",
              border: "none"
            }}>
                  <h3 style={{
                fontSize: "18px",
                fontWeight: "600",
                marginBottom: "16px"
              }}>
                    Vehicle Information
                  </h3>
                  <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "12px"
              }}>
                    <div>
                      <span style={{
                    fontSize: "13px",
                    color: "var(--grey-accent)"
                  }}>Registration:</span>
                      <p style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "var(--primary)",
                    margin: "4px 0 0 0"
                  }}>
                        {vehicle?.reg}
                      </p>
                    </div>
                    <div>
                      <span style={{
                    fontSize: "13px",
                    color: "var(--grey-accent)"
                  }}>Make & Model:</span>
                      <p style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    margin: "4px 0 0 0"
                  }}>
                        {vehicle?.makeModel}
                      </p>
                    </div>
                    {vehicle?.mileage && <div>
                        <span style={{
                    fontSize: "13px",
                    color: "var(--grey-accent)"
                  }}>Mileage:</span>
                        <p style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    margin: "4px 0 0 0"
                  }}>
                          {vehicle?.mileage.toLocaleString()} miles
                        </p>
                      </div>}
                    {vehicle?.colour && <div>
                        <span style={{
                    fontSize: "13px",
                    color: "var(--grey-accent)"
                  }}>Colour:</span>
                        <p style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    margin: "4px 0 0 0"
                  }}>
                          {vehicle?.colour}
                        </p>
                      </div>}
                  </div>
                </DevLayoutSection>

                {/* Customer Info */}
                <DevLayoutSection as="div" sectionKey="myjob-overview-customer" sectionType="content-card" parentKey="myjob-overview-summary-grid" backgroundToken="surface" style={{
              backgroundColor: "var(--surface)",
              padding: "24px",
              borderRadius: "var(--radius-sm)",
              border: "none"
            }}>
                  <h3 style={{
                fontSize: "18px",
                fontWeight: "600",
                marginBottom: "16px"
              }}>
                    Customer Information
                  </h3>
                  <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "12px"
              }}>
                    <div>
                      <span style={{
                    fontSize: "13px",
                    color: "var(--grey-accent)"
                  }}>Name:</span>
                      <p style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    margin: "4px 0 0 0"
                  }}>
                        {customer?.firstName} {customer?.lastName}
                      </p>
                    </div>
                    <div>
                      <span style={{
                    fontSize: "13px",
                    color: "var(--grey-accent)"
                  }}>Mobile:</span>
                      <p style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    margin: "4px 0 0 0"
                  }}>
                        {customer?.mobile}
                      </p>
                    </div>
                    {customer?.email && <div>
                        <span style={{
                    fontSize: "13px",
                    color: "var(--grey-accent)"
                  }}>Email:</span>
                        <p style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "var(--info)",
                    margin: "4px 0 0 0"
                  }}>
                          {customer?.email}
                        </p>
                      </div>}
                  </div>
                </DevLayoutSection>
              </DevLayoutSection>
            </DevLayoutSection>}

          {/* VHC TAB */}
          {activeTab === "vhc" && <DevLayoutSection as="div" sectionKey="myjob-tab-vhc" sectionType="section-shell" parentKey="myjob-main-scroll" backgroundToken="none" shell className="vhc-section-shell">
              {!activeSection && (showVhcReopenButton ? <DevLayoutSection as="div" sectionKey="myjob-vhc-reopen-banner" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-content-card" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px"
          }}>
                  <div>
                    <h2 className="vhc-toolbar__title">VHC Completed</h2>
                    <p className="vhc-toolbar__subtitle" style={{
                marginTop: "6px"
              }}>
                      Vehicle Health Check completed.
                    </p>
                  </div>
                  <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}>
                    <CustomerVideoButton jobNumber={jobNumber} userId={dbUserId || user?.id} vhcContextLabel={activeSection || "vhc-summary"} vhcData={vhcData} onUploadComplete={() => {
                fetchJobData();
              }} />
                    <button type="button" className="vhc-btn" onClick={handleCompleteVhcClick}>
                      Reopen VHC
                    </button>
                  </div>
                </DevLayoutSection> : <>
                  {/* VHC Header with Save Status */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-header" sectionType="toolbar" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-toolbar">
                    <div>
                      <h2 className="vhc-toolbar__title">Vehicle Health Check</h2>
                      <p className="vhc-toolbar__subtitle">
                        Complete mandatory sections to finish VHC
                      </p>
                    </div>
                    <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}>
                      {saveStatus === "saving" && <span style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)"
                }}>Saving...</span>}
                      {saveStatus === "saved" && <span style={{
                  fontSize: "13px",
                  color: "var(--success)"
                }}>Saved</span>}
                      {saveStatus === "error" && <span style={{
                  fontSize: "13px",
                  color: "var(--danger)"
                }}>{saveError || "Save failed"}</span>}
                      <button type="button" className={`vhc-btn${showVhcSummary ? " vhc-btn--active" : ""}`} onClick={() => setShowVhcSummary(prev => !prev)}>
                        {showVhcSummary ? "Close VHC summary" : "Show Summary"}
                      </button>

                      {(() => {
                  const isCompleteDisabled = !showVhcReopenButton && !canCompleteVhc;
                  const isCompleteActive = !showVhcReopenButton && canCompleteVhc;
                  return <button type="button" className={`vhc-btn${isCompleteActive ? " vhc-btn--active" : ""}`} onClick={handleCompleteVhcClick} disabled={!showVhcReopenButton && !canCompleteVhc} title={showVhcReopenButton ? "Reopen the Vehicle Health Check to make additional changes" : canCompleteVhc ? "Mark the Vehicle Health Check as complete" : "Complete all mandatory sections to finish the VHC"}>
                        {showVhcReopenButton ? "Reopen" : "Complete VHC"}
                      </button>;
                })()}

                      {/* Camera Button - Always visible for technicians */}
                      {jobNumber && <VhcCameraButton jobId={jobData?.id} jobNumber={jobNumber} userId={dbUserId || user?.id} buttonStyle={{
                  minHeight: "var(--control-height)",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-xs)",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "12px",
                  lineHeight: 1,
                  background: "var(--accent-purple-surface)",
                  color: "var(--accent-purple)",
                  transition: "all 0.18s ease"
                }} onUploadComplete={() => {
                  console.log("VHC media uploaded, refreshing job data...");
                  fetchJobData();
                }} />}
                    </div>
                  </DevLayoutSection>

                  <DevLayoutSection as="div" sectionKey="myjob-vhc-assistant" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-content-card">
                    <VhcAssistantPanel state={vhcAssistantState} title="VHC Assistant (Technician)" chromeless />
                  </DevLayoutSection>

                  {!showVhcSummary && <>
                      {/* Mandatory Sections */}
                      <DevLayoutSection as="div" sectionKey="myjob-vhc-mandatory" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-content-card">
                    <h3 className="vhc-section-heading">Mandatory Sections</h3>
                    <div className="vhc-card-grid">

                  {/* Wheels & Tyres */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-wheels" sectionType="content-card" parentKey="myjob-vhc-mandatory" backgroundToken="control-bg" className="vhc-card vhc-card--mandatory" onClick={() => openSection("wheelsTyres")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title">Wheels & Tyres</h4>
                      <span className="app-badge app-badge--control app-badge--uppercase" style={getBadgeState(sectionStatus.wheelsTyres)}>
                        {sectionStatus.wheelsTyres}
                      </span>
                    </div>
                    <p className="vhc-card__description">Check tread depth, pressure, and condition</p>
                  </DevLayoutSection>

                  {/* Brakes & Hubs */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-brakes" sectionType="content-card" parentKey="myjob-vhc-mandatory" backgroundToken="control-bg" className="vhc-card vhc-card--mandatory" onClick={() => openSection("brakesHubs")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title">Brakes & Hubs</h4>
                      <span className="app-badge app-badge--control app-badge--uppercase" style={getBadgeState(sectionStatus.brakesHubs)}>
                        {sectionStatus.brakesHubs}
                      </span>
                    </div>
                    <p className="vhc-card__description">Check pads, discs, and brake system</p>
                  </DevLayoutSection>

                  {/* Service Indicator & Under Bonnet */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-service" sectionType="content-card" parentKey="myjob-vhc-mandatory" backgroundToken="control-bg" className="vhc-card vhc-card--mandatory" onClick={() => openSection("serviceIndicator")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title">Service Indicator & Under Bonnet</h4>
                      <span className="app-badge app-badge--control app-badge--uppercase" style={getBadgeState(sectionStatus.serviceIndicator)}>
                        {sectionStatus.serviceIndicator}
                      </span>
                    </div>
                    <p className="vhc-card__description">Service reminder, oil level, under bonnet items</p>
                  </DevLayoutSection>
                </div>
                      </DevLayoutSection>

              {/* Additional Checks (Optional) */}
              <DevLayoutSection as="div" sectionKey="myjob-vhc-additional" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-content-card">
                <h3 className="vhc-section-heading">
                  Additional Checks
                  <span style={{
                    fontSize: "12px",
                    fontWeight: "normal",
                    marginLeft: "8px",
                    color: "var(--text-secondary)"
                  }}>
                    (Optional)
                  </span>
                </h3>
                <div className="vhc-card-grid">

                  {/* External */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-external" sectionType="content-card" parentKey="myjob-vhc-additional" backgroundToken="control-bg" className="vhc-card" onClick={() => openSection("externalInspection")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title">External</h4>
                      {getOptionalCount("externalInspection") > 0 && <span className="app-badge app-badge--control app-badge--uppercase" style={{
                        backgroundColor: "var(--primary-light)",
                        color: "var(--text-inverse)"
                      }}>
                          {getOptionalCount("externalInspection")} items
                        </span>}
                    </div>
                    <p className="vhc-card__description">Body, lights, glass, mirrors</p>
                  </DevLayoutSection>

                  {/* Internal & Electrics */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-internal" sectionType="content-card" parentKey="myjob-vhc-additional" backgroundToken="control-bg" className="vhc-card" onClick={() => openSection("internalElectrics")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title">Internal & Electrics</h4>
                      {getOptionalCount("internalElectrics") > 0 && <span className="app-badge app-badge--control app-badge--uppercase" style={{
                        backgroundColor: "var(--primary-light)",
                        color: "var(--text-inverse)"
                      }}>
                          {getOptionalCount("internalElectrics")} items
                        </span>}
                    </div>
                    <p className="vhc-card__description">Interior, lights, electrics, controls</p>
                  </DevLayoutSection>

                  {/* Underside */}
                  <DevLayoutSection as="div" sectionKey="myjob-vhc-card-underside" sectionType="content-card" parentKey="myjob-vhc-additional" backgroundToken="control-bg" className="vhc-card" onClick={() => openSection("underside")}>
                    <div className="vhc-card__header">
                      <h4 className="vhc-card__title">Underside</h4>
                      {getOptionalCount("underside") > 0 && <span className="app-badge app-badge--control app-badge--uppercase" style={{
                        backgroundColor: "var(--primary-light)",
                        color: "var(--text-inverse)"
                      }}>
                          {getOptionalCount("underside")} items
                        </span>}
                    </div>
                    <p className="vhc-card__description">Exhaust, suspension, steering, driveshafts</p>
                  </DevLayoutSection>
                </div>
              </DevLayoutSection>
                </>}

              {/* VHC Summary */}
              {showVhcSummary && <DevLayoutSection as="div" sectionKey="myjob-vhc-summary" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="section-card-bg" className="vhc-content-card vhc-content-card--bordered">
                  <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px"
              }}>
                    <h3 className="vhc-section-heading" style={{
                  marginBottom: 0
                }}>
                      VHC Summary
                      <span style={{
                    fontSize: "12px",
                    fontWeight: "normal",
                    marginLeft: "8px",
                    color: "var(--text-secondary)"
                  }}>
                        Review all items reported across sections
                      </span>
                    </h3>
                  </div>

                  <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px"
              }}>
                    {/* Red Items */}
                    {vhcSummaryItems.red.length > 0 && <div>
                        <div className="vhc-summary-banner" style={{
                    backgroundColor: "var(--danger-surface)"
                  }}>
                          <strong style={{
                      color: "var(--danger)"
                    }}>
                            Critical Issues ({vhcSummaryItems.red.length})
                          </strong>
                        </div>
                        {vhcSummaryItems.red.map((item, idx) => <div key={idx} className="vhc-summary-item" style={{
                    borderLeftColor: "var(--danger)"
                  }}>
                            <div className="vhc-summary-item__section" style={{
                      color: "var(--danger)"
                    }}>
                              {item.section}
                            </div>
                            <div className="vhc-summary-item__text">{item.text}</div>
                          </div>)}
                      </div>}

                    {/* Amber Items */}
                    {vhcSummaryItems.amber.length > 0 && <div>
                        <div className="vhc-summary-banner" style={{
                    backgroundColor: "var(--warning-surface)"
                  }}>
                          <strong style={{
                      color: "var(--warning)"
                    }}>
                            Advisory Items ({vhcSummaryItems.amber.length})
                          </strong>
                        </div>
                        {vhcSummaryItems.amber.map((item, idx) => <div key={idx} className="vhc-summary-item" style={{
                    borderLeftColor: "var(--warning)"
                  }}>
                            <div className="vhc-summary-item__section" style={{
                      color: "var(--warning)"
                    }}>
                              {item.section}
                            </div>
                            <div className="vhc-summary-item__text">{item.text}</div>
                          </div>)}
                      </div>}

                    {/* Green Items (Toggle) */}
                    {vhcSummaryItems.green.length > 0 && <div>
                        <div className="vhc-summary-banner" style={{
                    backgroundColor: "var(--success-surface)",
                    cursor: "pointer"
                  }} onClick={() => setShowGreenItems(!showGreenItems)}>
                          <strong style={{
                      color: "var(--success)"
                    }}>
                            OK Items ({vhcSummaryItems.green.length})
                          </strong>
                          <span style={{
                      marginLeft: "auto",
                      fontSize: "12px",
                      color: "var(--text-secondary)"
                    }}>
                            {showGreenItems ? "Hide" : "Show"}
                          </span>
                        </div>
                        {showGreenItems && vhcSummaryItems.green.map((item, idx) => <div key={idx} className="vhc-summary-item" style={{
                    borderLeftColor: "var(--success)"
                  }}>
                            <div className="vhc-summary-item__section" style={{
                      color: "var(--success)"
                    }}>
                              {item.section}
                            </div>
                            <div className="vhc-summary-item__text">{item.text}</div>
                          </div>)}
                      </div>}

                    {vhcSummaryItems.red.length === 0 && vhcSummaryItems.amber.length === 0 && vhcSummaryItems.green.length === 0 && <p style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  textAlign: "center",
                  padding: "20px"
                }}>
                        No items reported yet. Complete the VHC sections to add items.
                      </p>}
                  </div>
                </DevLayoutSection>}
                </>)}

              {/* VHC Modals */}
              {activeSection === "wheelsTyres" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-wheels" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <WheelsTyresDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("wheelsTyres", data)} onComplete={data => handleSectionComplete("wheelsTyres", data)} initialData={vhcData.wheelsTyres} isReopenMode={isReopenMode} jobId={jobData?.id || null} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => fetchJobData?.()} />
                </DevLayoutSection>}

              {activeSection === "brakesHubs" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-brakes" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <BrakesHubsDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("brakesHubs", data)} onComplete={data => handleSectionComplete("brakesHubs", data)} initialData={vhcData.brakesHubs} isReopenMode={isReopenMode} jobId={jobData?.id || null} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => fetchJobData?.()} />
                </DevLayoutSection>}

              {activeSection === "serviceIndicator" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-service" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <ServiceIndicatorDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("serviceIndicator", data)} onComplete={data => handleSectionComplete("serviceIndicator", data)} initialData={vhcData.serviceIndicator} isReopenMode={isReopenMode} jobId={jobData?.id || null} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => fetchJobData?.()} />
                </DevLayoutSection>}

              {activeSection === "externalInspection" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-external" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <ExternalDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("externalInspection", data)} onComplete={data => handleSectionComplete("externalInspection", data)} initialData={vhcData.externalInspection} isReopenMode={isReopenMode} jobId={jobData?.id || null} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => fetchJobData?.()} />
                </DevLayoutSection>}

              {activeSection === "internalElectrics" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-internal" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <InternalElectricsDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("internalElectrics", data)} onComplete={data => handleSectionComplete("internalElectrics", data)} initialData={vhcData.internalElectrics} isReopenMode={isReopenMode} jobId={jobData?.id || null} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => fetchJobData?.()} />
                </DevLayoutSection>}

              {activeSection === "underside" && <DevLayoutSection as="div" sectionKey="myjob-vhc-modal-underside" sectionType="content-card" parentKey="myjob-tab-vhc" backgroundToken="surface">
                  <UndersideDetailsModal isOpen={true} inlineMode onClose={data => handleSectionDismiss("underside", data)} onComplete={data => handleSectionComplete("underside", data)} initialData={vhcData.underside} isReopenMode={isReopenMode} jobId={jobData?.id || null} jobNumber={jobNumber} userId={dbUserId || user?.id || null} onSectionMediaUploaded={() => fetchJobData?.()} />
                </DevLayoutSection>}
            </DevLayoutSection>}

          {/* PARTS TAB */}
          {activeTab === "parts" && <DevLayoutSection as="div" sectionKey="myjob-tab-parts" sectionType="section-shell" parentKey="myjob-main-scroll" backgroundToken="none" shell style={{
          backgroundColor: "transparent",
          padding: 0,
          borderRadius: 0,
          border: "none",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          alignItems: "stretch"
        }}>
              <DevLayoutSection as="div" sectionKey="myjob-parts-request" sectionType="content-card" parentKey="myjob-tab-parts" backgroundToken="surface" style={{
            backgroundColor: "var(--surface)",
            borderRadius: "var(--radius-sm)",
            border: "none",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
                <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
                  <h3 style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: "700",
                color: "var(--warning)"
              }}>
                    Request a Part
                  </h3>
                  <span style={{
                fontSize: "12px",
                color: "var(--danger-dark)"
              }}>
                    Surfaces in the VHC parts queue
                  </span>
                </div>
                <p style={{
              margin: 0,
              color: "var(--info)",
              fontSize: "14px"
            }}>
                  Describe the specific part you need—the parts team will price, approve, and pre-pick it alongside other VHC requests.
                </p>
                <textarea rows={3} value={partRequestDescription} onChange={e => {
              setPartRequestDescription(e.target.value);
              if (partsFeedback) {
                setPartsFeedback("");
              }
            }} placeholder="e.g. Front right brake pad set (OEM) for MK3 1.6 diesel." style={{
              width: "100%",
              borderRadius: "var(--control-radius-xs)",
              border: "1px solid var(--accent-purple-surface)",
              padding: "12px",
              fontSize: "14px",
              resize: "vertical",
              minHeight: "88px",
              fontFamily: "inherit",
              outline: "none"
            }} onFocus={e => {
              e.currentTarget.style.borderColor = "var(--warning)";
            }} onBlur={e => {
              e.currentTarget.style.borderColor = "var(--accent-purple-surface)";
            }} />
                <div style={{
              display: "flex",
              gap: "12px",
              alignItems: "flex-end",
              flexWrap: "wrap"
            }}>
                  <label style={{
                display: "flex",
                flexDirection: "column",
                fontSize: "12px",
                color: "var(--info)"
              }}>
                    Quantity
                    <input type="number" min={1} value={partRequestQuantity} onChange={e => {
                  let next = Number(e.target.value);
                  if (Number.isNaN(next) || next < 1) next = 1;
                  setPartRequestQuantity(next);
                }} style={{
                  marginTop: "4px",
                  width: "80px",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid var(--accent-purple-surface)",
                  fontSize: "14px"
                }} />
                  </label>
                  {Array.isArray(vhcChecks) && vhcChecks.filter(c => c.section !== "VHC_CHECKSHEET").length > 0 && <label style={{
                display: "flex",
                flexDirection: "column",
                fontSize: "12px",
                color: "var(--info)"
              }}>
                      Link to VHC item (optional)
                      <select value={partRequestVhcItemId || ""} onChange={e => setPartRequestVhcItemId(e.target.value ? Number(e.target.value) : null)} style={{
                  marginTop: "4px",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid var(--accent-purple-surface)",
                  fontSize: "14px",
                  maxWidth: "240px"
                }}>
                        <option value="">None</option>
                        {vhcChecks.filter(c => c.section !== "VHC_CHECKSHEET").map(c => <option key={c.vhc_id} value={c.vhc_id}>
                              #{c.vhc_id} {(c.issue_title || c.section || "").slice(0, 40)}
                            </option>)}
                      </select>
                    </label>}
                  <button type="button" onClick={handlePartsRequestSubmit} disabled={partsSubmitting} style={{
                padding: "10px 22px",
                backgroundColor: partsSubmitting ? "var(--border)" : "var(--warning)",
                color: "white",
                border: "none",
                borderRadius: "var(--control-radius-xs)",
                cursor: partsSubmitting ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}>
                    {partsSubmitting ? "Submitting…" : "Request Part"}
                  </button>
                </div>
                {partsFeedback && <div style={{
              fontSize: "13px",
              color: "var(--info-dark)",
              backgroundColor: "var(--success-surface)",
              borderRadius: "var(--radius-xs)",
              padding: "10px 14px"
            }}>
                    {partsFeedback}
                  </div>}
              </DevLayoutSection>

              <DevLayoutSection as="div" sectionKey="myjob-parts-active-requests" sectionType="content-card" parentKey="myjob-tab-parts" backgroundToken="surface" style={{
            backgroundColor: "var(--surface)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--accent-purple-surface)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
                <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "10px"
            }}>
                  <h3 style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: "700"
              }}>Active Requests</h3>
                  <span style={{
                fontSize: "12px",
                color: "var(--info)"
              }}>
                    {partsRequests.length} request{partsRequests.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--info)"
            }}>
                  These entries are visible to the parts team in the VHC parts tab for pricing, approval, and pre-picks.
                </p>
                {partsRequestsLoading ? <p style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--info)"
            }}>Loading requests…</p> : partsRequests.length === 0 ? <p style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--info)"
            }}>
                    No parts have been requested yet.
                  </p> : <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxHeight: "340px",
              overflowY: "auto",
              paddingRight: "4px"
            }}>
                    {partsRequests.map(request => {
                const statusLabel = (request.status || "pending").replace(/_/g, " ").toUpperCase();
                const badgeStyle = getPartsStatusStyle(request.status);
                const quantity = request.quantity ?? 1;
                const partLabel = request.part ? `${request.part.partNumber || "#"} • ${request.part.name || "Unnamed part"}` : `Custom request #${request.request_id}`;
                const requesterName = request.requester ? `${request.requester.first_name || ""} ${request.requester.last_name || ""}`.trim() : "";
                const sourceLabel = request.requested_by ? `Tech${requesterName ? ` (${requesterName})` : ""}` : "VHC";
                return <div key={request.request_id} style={{
                  padding: "16px",
                  border: "1px solid var(--accent-purple-surface)",
                  borderRadius: "var(--control-radius-xs)",
                  backgroundColor: "var(--accent-purple-surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                          <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px"
                  }}>
                            <div style={{
                      flex: 1
                    }}>
                              <div style={{
                        fontSize: "15px",
                        fontWeight: "600",
                        color: "var(--accent-purple)"
                      }}>
                                {partLabel}
                              </div>
                              <div style={{
                        fontSize: "13px",
                        color: "var(--info-dark)",
                        marginTop: "2px"
                      }}>
                                {request.description || "No description provided."}
                              </div>
                              <div style={{
                        fontSize: "12px",
                        color: "var(--info)",
                        marginTop: "4px"
                      }}>
                                Requested by {sourceLabel}
                              </div>
                              <div style={{
                        fontSize: "12px",
                        color: "var(--info)",
                        marginTop: "4px"
                      }}>
                                Requested {formatDateTime(request.created_at)}
                              </div>
                            </div>
                            <span style={{
                      ...badgeStyle,
                      padding: "4px 14px",
                      borderRadius: "var(--control-radius)",
                      fontSize: "11px",
                      fontWeight: "600"
                    }}>
                              {statusLabel}
                            </span>
                          </div>
                          <div style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: "12px",
                    fontSize: "13px",
                    color: "var(--info)"
                  }}>
                            <span>Qty: {quantity}</span>
                          </div>
                        </div>;
              })}
                  </div>}
              </DevLayoutSection>

              {/* Parts Authorised Section */}
              <DevLayoutSection as="div" sectionKey="myjob-parts-authorised" sectionType="content-card" parentKey="myjob-tab-parts" backgroundToken="surface" style={{
            backgroundColor: "var(--surface)",
            borderRadius: "var(--radius-sm)",
            border: "none",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
                <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "10px"
            }}>
                  <h3 style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: "700",
                color: "var(--success)"
              }}>
                    Parts Authorised
                  </h3>
                  <span style={{
                fontSize: "12px",
                color: "var(--info)"
              }}>
                    {authorizedVhcRows.length} item{authorizedVhcRows.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--info)"
            }}>
                  VHC items that have been authorised by the customer.
                </p>
                {authorizedVhcRowsLoading ? <p style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--info)"
            }}>Loading authorised items…</p> : authorizedVhcRows.length === 0 ? <p style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--info)"
            }}>
                    No authorised VHC items yet.
                  </p> : <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              maxHeight: "400px",
              overflowY: "auto",
              paddingRight: "4px"
            }}>
                    {authorizedVhcRows.map(row => {
                const title = row.issue_title || row.section || "Authorised item";
                const description = row.issue_description || "";
                const section = row.section || "";
                const hours = row.labour_hours;
                const partsCost = row.parts_cost;
                const prePick = row.pre_pick_location || "";
                const noteText = row.note_text || "";
                const isComplete = row.Complete === true;
                return <div key={row.vhc_id} style={{
                  padding: "14px 16px",
                  border: "none",
                  borderLeft: "4px solid var(--success)",
                  borderRadius: "var(--control-radius-xs)",
                  backgroundColor: "var(--success-surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                          <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px"
                  }}>
                            <div style={{
                      flex: 1
                    }}>
                              <div style={{
                        fontSize: "15px",
                        fontWeight: "600",
                        color: "var(--success-dark)"
                      }}>
                                {title}
                              </div>
                              {description && description.toLowerCase() !== title.toLowerCase() && <div style={{
                        fontSize: "13px",
                        color: "var(--info-dark)",
                        marginTop: "2px"
                      }}>
                                  {description}
                                </div>}
                              {section && section !== title && <div style={{
                        fontSize: "12px",
                        color: "var(--info)",
                        marginTop: "2px"
                      }}>
                                  Section: {section}
                                </div>}
                              {noteText && <div style={{
                        fontSize: "12px",
                        color: "var(--info)",
                        marginTop: "4px"
                      }}>
                                  Note: {noteText}
                                </div>}
                              {prePick && <div style={{
                        fontSize: "12px",
                        color: "var(--info)",
                        marginTop: "4px"
                      }}>
                                  Pre-pick: {formatPrePickLabel(prePick)}
                                </div>}
                            </div>
                            <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "4px"
                    }}>
                              <span style={{
                        padding: "3px 10px",
                        borderRadius: "var(--control-radius)",
                        fontSize: "11px",
                        fontWeight: "600",
                        backgroundColor: isComplete ? "var(--info-surface)" : "var(--success-surface)",
                        color: isComplete ? "var(--info)" : "var(--success-dark)",
                        border: "none"
                      }}>
                                {isComplete ? "Complete" : "Authorised"}
                              </span>
                            </div>
                          </div>
                          <div style={{
                    display: "flex",
                    gap: "16px",
                    fontSize: "12px",
                    color: "var(--info)",
                    marginTop: "4px"
                  }}>
                            {hours != null && hours !== "" && <span>Labour: {hours}h</span>}
                            {partsCost != null && partsCost !== "" && Number(partsCost) > 0 && <span>Parts: £{Number(partsCost).toFixed(2)}</span>}
                          </div>
                        </div>;
              })}
                  </div>}
              </DevLayoutSection>
            </DevLayoutSection>}

          {/* NOTES TAB */}
          {activeTab === "notes" && <DevLayoutSection as="div" sectionKey="myjob-tab-notes" sectionType="content-card" parentKey="myjob-main-scroll" backgroundToken="surface" style={{
          backgroundColor: "var(--surface)",
          padding: "24px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
              <DevLayoutSection as="div" sectionKey="myjob-notes-toolbar" sectionType="toolbar" parentKey="myjob-tab-notes" backgroundToken="none" style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
                <h3 style={{
              fontSize: "18px",
              fontWeight: "600",
              margin: 0
            }}>
                  Technician Notes
                </h3>
                <span style={{
              fontSize: "13px",
              color: "var(--info)"
            }}>
                  {notes.length} note{notes.length === 1 ? "" : "s"}
                </span>
                <button onClick={() => setShowAddNote(true)} style={{
              padding: "10px 20px",
              backgroundColor: "var(--primary)",
              color: "var(--text-inverse)",
              border: "1px solid var(--primary)",
              borderRadius: "var(--radius-xs)",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}>
                  + Add Note
                </button>
              </DevLayoutSection>

              {showAddNote && <DevLayoutSection as="div" sectionKey="myjob-notes-compose" sectionType="content-card" parentKey="myjob-tab-notes" backgroundToken="layer-section-level-3" style={{
            padding: "20px",
            backgroundColor: "var(--layer-section-level-3)",
            borderRadius: "var(--radius-sm)",
            border: "none"
          }}>
                  <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note about the job..." style={{
              width: "100%",
              padding: "12px 14px",
              border: "none",
              borderRadius: "var(--control-radius-xs)",
              resize: "vertical",
              minHeight: "110px",
              fontSize: "14px",
              marginBottom: "12px",
              backgroundColor: "var(--surface)"
            }} />
                  <div style={{
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end"
            }}>
                    <button onClick={() => setShowAddNote(false)} style={{
                padding: "10px 18px",
                backgroundColor: "var(--surface)",
                color: "var(--info)",
                border: "none",
                borderRadius: "var(--radius-xs)",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}>
                      Cancel
                    </button>
                    <button onClick={handleAddNote} disabled={notesSubmitting} style={{
                padding: "10px 18px",
                backgroundColor: notesSubmitting ? "var(--border)" : "var(--info)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-xs)",
                cursor: notesSubmitting ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}>
                      {notesSubmitting ? "Saving..." : "Save Note"}
                    </button>
                  </div>
                </DevLayoutSection>}

              {notesLoading ? <DevLayoutSection as="div" sectionKey="myjob-notes-loading" sectionType="content-card" parentKey="myjob-tab-notes" backgroundToken="none" style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--info)"
          }}>
                  Loading notes…
                </DevLayoutSection> : notes.length === 0 ? <DevLayoutSection as="div" sectionKey="myjob-notes-empty" sectionType="content-card" parentKey="myjob-tab-notes" backgroundToken="layer-section-level-3" style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--info)",
            backgroundColor: "var(--layer-section-level-3)",
            borderRadius: "var(--radius-sm)",
            border: "none"
          }}>
                  <p style={{
              fontSize: "16px",
              fontWeight: "600",
              marginBottom: "4px"
            }}>No notes added yet</p>
                  <p style={{
              fontSize: "14px",
              color: "var(--info)"
            }}>
                    Keep technicians aligned by logging progress, issues and next steps.
                  </p>
                </DevLayoutSection> : <DevLayoutSection as="div" sectionKey="myjob-notes-list" sectionType="section-shell" parentKey="myjob-tab-notes" backgroundToken="none" style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
                  {notes.map((note, index) => {
              const noteId = note.noteId || note.note_id || note.id;
              const creatorName = note.createdBy || "Unknown";
              const createdAt = formatDateTime(note.createdAt || note.created_at);
              const updatedLabel = note.updatedAt && note.updatedAt !== note.createdAt ? ` • Updated ${formatDateTime(note.updatedAt)}` : "";
              return <DevLayoutSection as="div" key={noteId} sectionKey={`myjob-note-${noteId}`} sectionType="content-card" parentKey="myjob-notes-list" backgroundToken="layer-section-level-3" style={{
                border: "none",
                borderRadius: "var(--control-radius-xs)",
                padding: "16px",
                backgroundColor: "var(--layer-section-level-3)"
              }}>
                        <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "8px"
                }}>
                          <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                            <span style={{
                      padding: "4px 10px",
                      borderRadius: "var(--control-radius)",
                      backgroundColor: "var(--info-surface)",
                      color: "var(--info)",
                      fontSize: "11px",
                      fontWeight: 700
                    }}>
                              Note {index + 1}
                            </span>
                            <span style={{
                      fontWeight: 600
                    }}>{creatorName}</span>
                          </div>
                          <div style={{
                    fontSize: "12px",
                    color: "var(--info)"
                  }}>
                            {createdAt}
                            {updatedLabel}
                          </div>
                        </div>
                        <p style={{
                  margin: 0,
                  color: "var(--text-primary)",
                  whiteSpace: "pre-wrap"
                }}>
                          {note.noteText || note.note_text}
                        </p>
                      </DevLayoutSection>;
            })}
                </DevLayoutSection>}
            </DevLayoutSection>}

          {/* WRITE-UP TAB */}
          <DevLayoutSection as="div" sectionKey="myjob-tab-writeup" sectionType="section-shell" parentKey="myjob-main-scroll" backgroundToken="layer-section-level-2" shell style={{
          height: "100%",
          overflow: "hidden",
          display: activeTab === "write-up" ? "flex" : "none",
          flexDirection: "column",
          borderRadius: "var(--radius-sm)",
          border: "none",
          backgroundColor: "var(--layer-section-level-2)"
        }}>
            <DevLayoutSection as="div" sectionKey="myjob-writeup-form-shell" sectionType="content-card" parentKey="myjob-tab-writeup" backgroundToken="surface" style={{
            flex: 1,
            minHeight: 0,
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            backgroundColor: "var(--surface)"
          }}>
              <WriteUpForm jobNumber={jobNumber} jobCardData={jobData} showHeader={false} onCompletionChange={nextStatus => {
              setJobData(prev => {
                if (!prev?.jobCard) return prev;
                const nextWriteUp = {
                  ...(prev.jobCard.writeUp || {}),
                  completion_status: nextStatus
                };
                return {
                  ...prev,
                  jobCard: {
                    ...prev.jobCard,
                    completionStatus: nextStatus,
                    writeUp: nextWriteUp
                  }
                };
              });
            }} onTasksSnapshotChange={nextTasks => {
              setLiveWriteUpTasks(Array.isArray(nextTasks) ? nextTasks : []);
            }} />
            </DevLayoutSection>
          </DevLayoutSection>

          {/* DOCUMENTS TAB */}
          {activeTab === "documents" && <DevLayoutSection as="div" sectionKey="myjob-tab-documents" sectionType="section-shell" parentKey="myjob-main-scroll" backgroundToken="none" shell style={{
          backgroundColor: "transparent",
          padding: 0,
          borderRadius: 0,
          border: "none"
        }}>
              <DevLayoutSection as="div" sectionKey="myjob-documents-browser" sectionType="content-card" parentKey="myjob-tab-documents" backgroundToken="surface" style={{
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            backgroundColor: "var(--surface)"
          }}>
                <DocumentsTab documents={jobDocuments} canDelete={canManageDocuments} onDelete={handleDeleteDocument} onManageDocuments={canManageDocuments ? () => setShowDocumentsPopup(true) : undefined} onRenameDocument={handleRenameDocument} onReplaceDocument={canManageDocuments ? handleReplaceDocument : undefined} />
              </DevLayoutSection>
            </DevLayoutSection>}
          </DevLayoutSection>
        </DevLayoutSection>

        {/* Bottom Action Bar */}
      </DevLayoutSection>
      <DocumentsUploadPopup open={showDocumentsPopup} onClose={() => setShowDocumentsPopup(false)} jobId={jobData?.jobCard?.id ? String(jobData.jobCard.id) : null} userId={user?.user_id || dbUserId || null} onAfterUpload={fetchJobData} existingDocuments={jobDocuments} />
      {showJobTypesPopup && <ModalPortal>
          <div className="popup-backdrop" onClick={event => {
      if (event.target === event.currentTarget) {
        setShowJobTypesPopup(false);
      }
    }}>
            <div className="popup-card" style={{
        borderRadius: "var(--radius-xl)",
        width: "100%",
        maxWidth: "560px",
        maxHeight: "88vh",
        overflowY: "auto",
        border: "none"
      }} onClick={event => event.stopPropagation()}>
              <div style={{
          padding: "28px"
        }}>
                <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px"
          }}>
                  <h3 style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--primary)",
              letterSpacing: "0.02em"
            }}>
                    Job Requests
                  </h3>
                  <button type="button" onClick={() => setShowJobTypesPopup(false)} style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "22px",
              lineHeight: 1,
              color: "var(--info)"
            }} aria-label="Close job requests popup">
                    ×
                  </button>
                </div>

                <div style={{
            display: "grid",
            gap: "10px"
          }}>
                  {detectedJobTypes.map((jobType, index) => <div key={`${jobType}-${index}`} style={{
              border: "none",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--surface-light)",
              padding: "12px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px"
            }}>
                      <span style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)"
              }}>
                        {jobType}
                      </span>
                      <span style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--accent-purple)",
                letterSpacing: "0.05em",
                textTransform: "uppercase"
              }}>
                        Type {index + 1}
                      </span>
                    </div>)}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
