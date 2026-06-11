// file location: src/components/page-ui/job-cards/job-cards-job-number-ui.js
import LoanCarSchedulePanel from "@/components/LoanCars/LoanCarSchedulePanel";
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)

export default function JobCardDetailPageUi(props) {
  const {
    CAR_LOCATIONS,
    ClockingTab,
    ContactTab,
    CustomerRequestsTab,
    DocumentsTab,
    DocumentsUploadPopup,
    InvoiceSection,
    JobCardErrorBoundary,
    JobCardPageShellSkeleton,
    KEY_LOCATIONS,
    LocationUpdateModal,
    MessagesTab,
    NotesTabNew,
    PartsTabNew,
    SchedulingTab,
    ServiceHistoryTab,
    VHCTab,
    WarrantyTab,
    WriteUpForm,
    actingUserId,
    actingUserNumericId,
    activeTab,
    alert,
    appointmentSaving,
    bookingApprovalSaving,
    bookingFlowSaving,
    canEdit,
    canEditPartsWriteUpVhc,
    canEditTrackingLocations,
    canManageDocuments,
    canViewPartsTab,
    checkingIn,
    clockingLockDescription,
    createCustomerDisplaySlug,
    creatingInvoice,
    customerSaving,
    customerVehicles,
    customerVehiclesLoading,
    dbUserId,
    emptyTrackingForm,
    error,
    fetchDocuments,
    fetchJobData,
    formatCurrency,
    generalReadOnlyLockDescription,
    handleAppointmentRebook,
    handleAppointmentSave,
    handleBookingApproval,
    handleBookingFlowSave,
    handleCheckIn,
    handleCreateInvoice,
    handleCustomerDetailsSave,
    handleDeleteDocument,
    handleDocumentFileUploaded,
    handleInvoicePaymentCompleted,
    handleLinkJob,
    handleNoteAdded,
    handleNotesChange,
    handleReleaseJob,
    handleArchiveJob,
    jobReleased,
    handleRenameDocument,
    handleReplaceDocument,
    handleSchedulingLogisticsChange,
    handleTabClick,
    handleTabsDragEnd,
    handleTabsDragMove,
    handleTabsDragStart,
    handleToggleVhcRequired,
    handleTrackerSave,
    handleUpdateRequestPrePickLocation,
    handleUpdateRequests,
    handleWriteUpCompletionChange,
    handleWriteUpRequestStatusesChange,
    handleWriteUpSaveSuccess,
    handleWriteUpTasksSnapshotChange,
    highlightedNoteIds,
    invoiceBlockingReasons,
    invoicePrerequisitesMet,
    isArchiveMode,
    isBookedStatus,
    isOpenStatus,
    isCheckedIn,
    isClockingLockedByStatus,
    isInPrimeGroup,
    isInvoiceOrBeyondReadOnly,
    isLinkPopupOpen,
    isLinking,
    isPartsWriteUpVhcLockedByStatus,
    isValetMode,
    jobData,
    jobDivisionLabel,
    jobDivisionLower,
    jobDocuments,
    jobNotes,
    jobNumber,
    jobVhcChecks,
    linkError,
    linkJobInput,
    lockAlertStyle,
    lockedTabIds,
    mileageInputDirtyRef,
    normalizeKeyLocationLabel,
    overallStatusId,
    overallStatusLabel,
    pageStackStyle,
    partsTabCompleteInstant,
    partsWriteUpVhcLockDescription,
    popupCardStyles,
    popupOverlayStyles,
    relatedJobs,
    relatedJobsLoading,
    renderError,
    router,
    setInvoiceViewState,
    setIsLinkPopupOpen,
    setLinkError,
    setLinkJobInput,
    setShowDocumentsPopup,
    setTrackerQuickModalOpen,
    setVehicleMileageInput,
    setVhcFinancialTotalsFromPanel,
    sharedJobCardShellBackground,
    showCreateInvoiceButton,
    showDocumentsPopup,
    showProformaCompleteSection,
    showReleaseButton,
    summaryPrimaryTextStyle,
    summarySecondaryTextStyle,
    tabs,
    tabsOverflowing,
    tabsScrollRef,
    trackerEntry,
    trackerQuickModalOpen,
    user,
    vehicleJobHistory,
    vehicleMileageInput,
    vhcCustomerStatusMeta,
    reloadVhcCustomerStatus,
    vhcFinancialTotals,
    vhcSummaryCounts,
    vhcTabAmberReadyInstant,
    vhcTabCompleteInstant,
    writeUpCompleteInstant,
    writeUpTabMounted,
  } = props; // receive page logic props.
  const normaliseBadgeText = (value) => String(value || "").trim().toLowerCase();
  const jobHeaderStatusToneClass = (() => {
    const status = normaliseBadgeText(overallStatusLabel);
    if (status === "open" || status === "released" || status === "complete" || status === "completed") return "app-badge--success";
    if (status.includes("checked") || status.includes("progress")) return "app-badge--accent-soft";
    if (status.includes("waiting") || status.includes("hold") || status.includes("pending")) return "app-badge--warning";
    if (status.includes("cancel") || status.includes("failed")) return "app-badge--danger";
    return "app-badge--neutral";
  })();
  const jobDivisionToneClass = jobDivisionLower === "sales" ? "app-badge--accent-soft" : "app-badge--success";

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <JobCardPageShellSkeleton jobNumber={jobNumber} />; // render extracted page section.

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
      marginBottom: "10px"
    }}>
            {error || "Job card not found"}
          </h2>
          <p style={{
      color: "var(--grey-accent)",
      marginBottom: "30px"
    }}>
            Job #{jobNumber} could not be loaded from the database.
          </p>
          <div style={{
      display: "flex",
      gap: "10px"
    }}>
            <button onClick={() => router.push("/jobs")} style={{
        padding: "var(--control-padding)",
        backgroundColor: "var(--primary)",
        color: "var(--text-2)",
        border: "none",
        borderRadius: "var(--control-radius)",
        cursor: "pointer",
        fontWeight: "600",
        fontSize: "var(--control-font-size)",
        minHeight: "var(--control-height)",
        transition: "background-color 0.2s"
      }} onMouseEnter={e => e.target.style.backgroundColor = "var(--primary-selected)"} onMouseLeave={e => e.target.style.backgroundColor = "var(--primary)"}>
              View All Job Cards
            </button>
          </div>
        </div>
      </>; // render extracted page section.

    case "section3":
      return <JobCardErrorBoundary>
      <>
      <div style={{
        ...pageStackStyle,
        gap: "10px",
        rowGap: "10px"
      }} data-dev-section="1" data-dev-section-key="jobcard-page-shell" data-dev-section-type="page-shell" data-dev-shell="1">
        {isArchiveMode && <LayerSurface as="section" sectionKey="jobcard-archive-banner" sectionType="section-shell" parentKey="jobcard-page-shell" radius="var(--radius-sm)" padding="12px 16px" style={{
        color: "var(--danger-dark)",
        fontSize: "0.95rem",
        fontWeight: 600
      }}>
            Archived copy &middot; Job #{jobData.jobNumber} is read-only. VHC, notes, and documents are preserved for audit.
          </LayerSurface>}

        {isInvoiceOrBeyondReadOnly && !isArchiveMode && <LayerSurface as="section" radius="var(--radius-sm)" padding="12px 16px" style={{
        color: "var(--text-1)",
        fontSize: "0.95rem",
        fontWeight: 600
      }}>
            Job card is read-only in {jobData.status}. Key/car location updates remain available until archive. Awaiting job to be archived.
          </LayerSurface>}

        {/* ✅ Header Section */}
        <LayerTheme as="section" sectionKey="jobcard-header" sectionType="section-header-row" parentKey="jobcard-page-shell" radius="var(--radius-sm)" padding="20px" gap="12px" style={{
        flexShrink: 0,
        margin: 0
      }}>
          {/* Row 1: Title + Action Buttons */}
          <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px"
        }}>
            <div style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap"
          }} data-presentation="job-detail-status">
              <h1 style={{
              margin: 0,
              color: "var(--primary)",
              fontSize: "28px",
              fontWeight: "700"
            }}>
                Job Card #{jobData.jobNumber}
              </h1>
              <span className={`app-badge app-badge--control app-badge--uppercase ${jobHeaderStatusToneClass}`}>
                {overallStatusLabel}
              </span>
              {jobData.jobSource === "Warranty" && <span style={{
              height: "44px",
              padding: "0 16px",
              display: "inline-flex",
              alignItems: "center",
              backgroundColor: "var(--warning-surface)",
              color: "var(--danger)",
              borderRadius: "var(--control-radius-xs)",
              fontWeight: "600",
              fontSize: "13px",
              border: "none",
              letterSpacing: "0.3px"
            }}>
                  {jobData.jobSource}
                </span>}
              {jobDivisionLabel && <span className={`app-badge app-badge--control app-badge--uppercase ${jobDivisionToneClass}`}>
                  {jobDivisionLabel}
                </span>}
            </div>
            <div style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
            flexShrink: 0
          }}>
            {/* ✅ Job Nav Buttons */}
            {isInPrimeGroup && <>
                <button className="app-btn app-btn--sm app-btn--primary">
                  #{jobData.jobNumber}
                </button>
                {relatedJobsLoading && <span style={{
                fontSize: "12px",
                color: "var(--grey-accent)"
              }}>…</span>}
                {relatedJobs.map(rJob => {
                const statusColor = rJob.status === "Open" || rJob.status === "Released" ? "var(--success-dark)" : rJob.status === "Complete" ? "var(--accent-strong)" : "var(--warning)";
                return <button key={rJob.id} className="app-btn app-btn--sm app-btn--secondary" onClick={() => router.push(`/job-cards/${rJob.jobNumber}`)}>
                      #{rJob.jobNumber}
                      <span style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: statusColor
                  }}>{rJob.status}</span>
                    </button>;
              })}
              </>}
            {/* Link Job — hidden once job reaches Invoiced / Released / Archived (read-only). */}
            {!isInvoiceOrBeyondReadOnly && !isArchiveMode &&
            <button className="app-btn app-btn--sm app-btn--primary" onClick={() => setIsLinkPopupOpen(true)}>
                Link Job
              </button>}
            {/* Archive — replaces Link Job once the job is Released (awaits archival). */}
            {jobReleased && !isArchiveMode &&
            <button className="app-btn app-btn--sm app-btn--primary" onClick={handleArchiveJob}>
                Archive Job
              </button>}
            {(isOpenStatus || isBookedStatus) && !isCheckedIn && <button onClick={handleCheckIn} disabled={checkingIn || !canEdit} style={{
              padding: "var(--control-padding)",
              backgroundColor: "var(--primary)",
              color: "var(--text-2)",
              border: "none",
              borderRadius: "var(--control-radius)",
              cursor: checkingIn || !canEdit ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "var(--control-font-size)",
              minHeight: "var(--control-height)",
              transition: "background-color 0.2s",
              opacity: checkingIn || !canEdit ? 0.7 : 1
            }} onMouseEnter={e => {
              if (!checkingIn && canEdit) {
                e.target.style.backgroundColor = "var(--primary-hover)";
              }
            }} onMouseLeave={e => {
              if (!checkingIn && canEdit) {
                e.target.style.backgroundColor = "var(--primary)";
              }
            }}>
                {checkingIn ? "Checking In..." : "Check In"}
              </button>}
            {showReleaseButton && <button onClick={async () => {
              const result = await handleReleaseJob();
              if (!result?.success) {
                alert(result?.error || "Unable to release vehicle");
              }
            }} style={{
              padding: "var(--control-padding)",
              backgroundColor: "var(--success)",
              color: "var(--text-2)",
              border: "none",
              borderRadius: "var(--control-radius)",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "var(--control-font-size)",
              minHeight: "var(--control-height)"
            }}>
                Release
              </button>}
            </div>
          </div>

        </LayerTheme>

        {/* ✅ Vehicle & Customer Info Bar */}
        <LayerTheme as="section" sectionKey="jobcard-summary-shell" sectionType="section-shell" parentKey="jobcard-page-shell" shell radius="var(--radius-sm)" padding="8px" gap="10px" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
        flexShrink: 0,
        margin: 0
      }}>
          <LayerSurface sectionKey="jobcard-summary-vehicle" sectionType="content-card" parentKey="jobcard-summary-shell" radius="var(--radius-sm)" padding="12px 14px" style={{
          minWidth: 0,
          overflow: "hidden"
        }}>
            <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            alignItems: "start",
            columnGap: "10px",
            marginBottom: "4px"
          }}>
              <div style={{
              ...summaryPrimaryTextStyle,
              marginBottom: 0
            }}>
                {jobData.reg || "N/A"}
              </div>
              <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap"
            }}>
                <span style={{
                fontSize: "13px",
                color: "var(--text-1)",
                fontWeight: "600"
              }}>Mileage</span>
                <input type="text" inputMode="numeric" maxLength={7} value={vehicleMileageInput} onChange={event => {
                const digitsOnly = (event.target.value || "").replace(/\D/g, "").slice(0, 7);
                mileageInputDirtyRef.current = true;
                setVehicleMileageInput(digitsOnly);
              }} disabled={!canEdit} aria-label="Vehicle mileage" className="app-input vehicle-mileage-input" style={{
                width: "86px",
                margin: 0,
                height: "30px",
                minHeight: "30px",
                maxHeight: "30px",
                padding: "0 10px",
                borderRadius: "var(--input-radius)",
                fontSize: "14px",
                fontWeight: "600",
                lineHeight: "30px",
                textAlign: "right",
                fontFamily: "inherit",
                opacity: 1,
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "textfield"
              }} />
              </div>
            </div>
            <div style={summarySecondaryTextStyle}>
              {String(jobData.make || jobData.makeModel || `${jobData.make} ${jobData.model}` || "N/A")}
            </div>
          </LayerSurface>

          <LayerSurface sectionKey="jobcard-summary-customer" sectionType="content-card" parentKey="jobcard-summary-shell" radius="var(--radius-sm)" padding="12px 14px" style={{
          minWidth: 0,
          overflow: "hidden",
          cursor: jobData.customerId || jobData.customerFirstName || jobData.customerLastName || jobData.customer ? "pointer" : "default"
        }}>
          <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "center",
          columnGap: "10px"
        }}>
            <div onClick={() => {
            const fallbackNameParts = (jobData.customer || "").split(" ").map(part => part.trim()).filter(Boolean);
            const fallbackFirst = fallbackNameParts[0] || "";
            const fallbackLast = fallbackNameParts.slice(1).join(" ");
            const slug = createCustomerDisplaySlug(jobData.customerFirstName || fallbackFirst, jobData.customerLastName || fallbackLast) || null;
            const target = slug || jobData.customerId || null;
            if (target) {
              router.push(`/customers/${target}`);
            }
          }}>
              <div style={summaryPrimaryTextStyle}>
                {jobData.customer || "N/A"}
              </div>
              <div style={summarySecondaryTextStyle}>
                {jobData.customerPhone || jobData.customerEmail || "No contact info"}
              </div>
            </div>
            {vhcCustomerStatusMeta ? (
            <span
              title={vhcCustomerStatusMeta.detail}
              className={`app-badge app-badge--control app-badge--uppercase ${
                vhcCustomerStatusMeta.label === "Viewed" ? "app-badge--success" : vhcCustomerStatusMeta.label === "Sent" ? "app-badge--accent-soft" : "app-badge--warning"
              }`}
            >
              VHC: {vhcCustomerStatusMeta.label}
            </span>
            ) : null}
          </div>
          </LayerSurface>

          <LayerSurface sectionKey="jobcard-summary-vhc-financials" sectionType="stat-card" parentKey="jobcard-summary-shell" radius="var(--radius-sm)" padding="12px 14px" style={{
          minWidth: 0,
          overflow: "hidden"
        }}>
            <div style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "8px"
          }}>
              <div style={{
              flex: 1,
              minWidth: 0
            }}>
                <div style={{
                fontSize: "11px",
                color: "var(--danger)",
                marginBottom: "4px"
              }}>DECLINED</div>
                <div style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "var(--danger)",
                marginBottom: "4px"
              }}>
                  {formatCurrency(vhcFinancialTotals.declined)}
                </div>
              </div>
              <div style={{
              width: "1px",
              backgroundColor: "var(--surface)",
              flexShrink: 0
            }} />
              <div style={{
              flex: 1,
              minWidth: 0,
              textAlign: "right"
            }}>
                <div style={{
                fontSize: "11px",
                color: "var(--success)",
                marginBottom: "4px"
              }}>AUTHORISED</div>
                <div style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "var(--success)",
                marginBottom: "4px"
              }}>
                  {formatCurrency(vhcFinancialTotals.authorized)}
                </div>
              </div>
            </div>
          </LayerSurface>

          <LayerSurface sectionKey="jobcard-summary-locations" sectionType="content-card" parentKey="jobcard-summary-shell" radius="var(--radius-sm)" padding="12px 14px" style={{
          flexDirection: "row",
          alignItems: "stretch",
          minWidth: 0,
          overflow: "hidden",
          cursor: canEditTrackingLocations ? "pointer" : "default",
          opacity: canEditTrackingLocations ? 1 : 0.75
        }}>
          <div onClick={() => {
          if (canEditTrackingLocations) {
            setTrackerQuickModalOpen(true);
          }
        }} style={{ display: "flex", flexDirection: "row", alignItems: "stretch", flex: 1, gap: 0 }}>
            <div style={{
            flex: 1,
            minWidth: 0
          }}>
              <div style={{
              fontSize: "11px",
              color: "var(--text-1)",
              marginBottom: "4px"
            }}>
                Key location
              </div>
              <div style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "var(--text-1)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
                {normalizeKeyLocationLabel(trackerEntry?.keyLocation) || KEY_LOCATIONS[0].label}
              </div>
            </div>
            <div style={{
            width: "1px",
            backgroundColor: "var(--surface)",
            flexShrink: 0
          }} />
            <div style={{
            flex: 1,
            minWidth: 0,
            textAlign: "right"
          }}>
              <div style={{
              fontSize: "11px",
              color: "var(--text-1)",
              marginBottom: "4px"
            }}>
                Car location
              </div>
              <div style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "var(--text-1)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
                {trackerEntry?.vehicleLocation || CAR_LOCATIONS[0].label}
              </div>
            </div>
          </div>
          </LayerSurface>
        </LayerTheme>

        {/* ✅ Tabs Navigation */}
        <section style={{
        padding: 0,
        margin: 0
      }}>
          <div data-presentation="job-detail-tabs" ref={tabsScrollRef} onMouseDown={tabsOverflowing ? handleTabsDragStart : undefined} onMouseMove={tabsOverflowing ? handleTabsDragMove : undefined} onMouseUp={tabsOverflowing ? handleTabsDragEnd : undefined} onMouseLeave={tabsOverflowing ? handleTabsDragEnd : undefined}>
          <LayerTheme
            sectionKey="jobcard-tab-row"
            sectionType="tab-row"
            parentKey="jobcard-page-shell"
            backgroundToken="theme"
            data-dev-text-preview="Job card tab navigation"
            className={`tab-scroll-row${tabsOverflowing ? " is-overflowing" : ""}`}
            radius="var(--radius-sm)"
            padding="8px"
            gap="6px"
            style={{
              flexDirection: "row",
              flexWrap: "nowrap",
              alignItems: "center",
              overflowX: "auto",
              overflowY: "hidden"
            }}
          >
            {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            const isLocked = lockedTabIds.has(tab.id);
            const isPartsTab = tab.id === "parts";
            const isWriteUpTab = tab.id === "write-up";
            const isVhcTab = tab.id === "vhc";
            const isVhcCompleteHighlight = isVhcTab && vhcTabCompleteInstant;
            const isVhcAmberHighlight = isVhcTab && vhcTabAmberReadyInstant;
            const isCompleteHighlight = isPartsTab && partsTabCompleteInstant || isWriteUpTab && writeUpCompleteInstant || isVhcCompleteHighlight;
            const tabTone = isCompleteHighlight ? "success" : isVhcAmberHighlight ? "warning" : "default";
            return <button key={tab.id} className={`tab-api__item${isActive ? " is-active" : ""}`} data-tone={tabTone} onClick={e => {
              handleTabClick(tab.id);
              e.currentTarget.scrollIntoView({
                behavior: "smooth",
                inline: "center",
                block: "nearest"
              });
            }}>
                  {tab.icon && <span>{tab.icon}</span>}
                  <span>{tab.label}</span>
                  {/* "Lock" text removed from tab buttons per design — the
                      lock state is communicated by the in-tab "Locked: ..."
                      alert (see lockAlertStyle blocks below) instead. */}
                  {tab.badge && <span className={`app-badge app-badge--control ${tab.id === "notes" ? "app-badge--danger-strong app-badge--round-count jobcard-tab-notes-badge" : "app-badge--accent-strong"}`}>
                      {tab.badge}
                    </span>}
                </button>;
          })}
          </LayerTheme>
          </div>
        </section>
        <style jsx global>{`
          .tab-scroll-row::-webkit-scrollbar {
            display: none;
          }
          .vehicle-mileage-input::placeholder {
            color: var(--grey-accent);
            font-size: 14px;
            font-weight: 600;
          }
          .vehicle-mileage-input::-webkit-outer-spin-button,
          .vehicle-mileage-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          .vehicle-mileage-input {
            -moz-appearance: textfield;
            appearance: textfield;
            height: 30px !important;
            min-height: 30px !important;
            max-height: 30px !important;
            line-height: 30px !important;
          }
          .vehicle-mileage-input:disabled {
            opacity: 1;
            -webkit-text-fill-color: var(--text-1);
            color: var(--text-1);
          }
          .vehicle-mileage-input:focus,
          .vehicle-mileage-input:active {
            height: 30px !important;
            min-height: 30px !important;
            max-height: 30px !important;
          }
          .edit-requests-hours-input::-webkit-outer-spin-button,
          .edit-requests-hours-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          .edit-requests-hours-input {
            -moz-appearance: textfield;
            appearance: textfield;
          }
        `}</style>

        {/* ✅ Tab Content */}
        <LayerTheme as="section" className="app-layout-section-shell" sectionKey="jobcard-tab-content-shell" sectionType="section-shell" parentKey="jobcard-page-shell" shell radius="var(--section-card-radius)" padding="var(--section-card-padding)" gap="var(--space-4)" data-dev-text-preview={`Job card tab content shell. Active tab: ${tabs.find(tab => tab.id === activeTab)?.label || activeTab}.`} data-dev-active-tab={activeTab}>
          {/* Per-tab containers below use the canonical .app-page-stack class
              (CLAUDE.md §3.3) so the in-tab Locked alert and the tab body sit
              on a vertical flex stack with --page-stack-gap.
              The visibility toggle uses `display: undefined` for the active tab
              (lets the class's `display: flex` apply) and `display: "none"` for
              hidden tabs so they keep their state without rendering. */}
          {/* Keep tabs mounted for state retention, but defer write-up mounting to idle/user intent. */}
          <div className="app-page-stack" style={{
          display: activeTab === "customer-requests" ? undefined : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-customer-requests" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Customer requests tab content">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Customer Requests</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <CustomerRequestsTab jobData={jobData} canEdit={canEdit} onUpdate={handleUpdateRequests} onUpdateRequestPrePickLocation={handleUpdateRequestPrePickLocation} onToggleVhcRequired={handleToggleVhcRequired} overallStatusId={overallStatusId} vhcSummary={vhcSummaryCounts} vhcChecks={jobVhcChecks} notes={jobNotes} partsJobItems={jobData?.parts_job_items || []} />
          </div>

          <div className="app-page-stack" style={{
          display: activeTab === "contact" ? undefined : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-contact" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Contact tab content">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Contact</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <ContactTab jobData={jobData} canEdit={canEdit} onSaveCustomerDetails={handleCustomerDetailsSave} customerSaving={customerSaving} />
          </div>

          <div className="app-page-stack" style={{
          display: activeTab === "scheduling" ? undefined : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-scheduling" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Scheduling tab content">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Scheduling</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <SchedulingTab jobData={jobData} canEdit={canEdit} customerVehicles={customerVehicles} customerVehiclesLoading={customerVehiclesLoading} bookingRequest={jobData?.bookingRequest} onBookingFlowSave={handleBookingFlowSave} bookingFlowSaving={bookingFlowSaving} onBookingApproval={handleBookingApproval} bookingApprovalSaving={bookingApprovalSaving} onAppointmentSave={handleAppointmentSave} onAppointmentRebook={handleAppointmentRebook} appointmentSaving={appointmentSaving} onLogisticsSelectionChange={handleSchedulingLogisticsChange} />
          </div>

          <div className="app-page-stack" style={{
          display: activeTab === "loan-car" ? undefined : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-loan-car" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Loan car booking tab content">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Loan Car</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <LoanCarSchedulePanel jobData={jobData} highlightedJobNumber={jobData?.jobNumber || jobNumber} highlightedReg={jobData?.reg || ""} />
          </div>

          <div className="app-page-stack" style={{
          display: activeTab === "service-history" ? undefined : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-service-history" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Service history tab content">
            <ServiceHistoryTab vehicleJobHistory={vehicleJobHistory} />
          </div>

          {canViewPartsTab && <div className="app-page-stack" style={{
          display: activeTab === "parts" ? undefined : "none",
          gap: "10px" // parts search ↔ workspace gap set to 10px; overrides .app-page-stack's 20px --page-stack-gap for this tab only
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-parts" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Parts tab content">
              {isPartsWriteUpVhcLockedByStatus && <div style={lockAlertStyle} role="status" aria-live="polite">
                  <strong>Locked: Parts</strong>
                  <span>{partsWriteUpVhcLockDescription}</span>
                </div>}
              <PartsTabNew jobData={jobData} canEdit={canEditPartsWriteUpVhc} onRefreshJob={() => fetchJobData({
            silent: true,
            force: true
          })} actingUserId={actingUserId} actingUserNumericId={actingUserNumericId} invoiceReady={invoicePrerequisitesMet} />
            </div>}

          <div className="app-page-stack" style={{
          display: activeTab === "notes" ? undefined : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-notes" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Notes tab content">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Notes</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <NotesTabNew jobData={jobData} canEdit={canEdit} actingUserNumericId={actingUserNumericId} onNotesChange={handleNotesChange} onNoteAdded={handleNoteAdded} highlightNoteIds={highlightedNoteIds} noteHistoryJobs={vehicleJobHistory} />
          </div>

          {/* Write-up keeps its inner full-height flex column because the form
              manages its own scroll. The outer stack still flips visibility. */}
          <div className="app-page-stack" style={{
          display: activeTab === "write-up" ? undefined : "none",
          height: "100%"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-writeup" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Write-up tab content">
            <div style={{
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}>
              {isPartsWriteUpVhcLockedByStatus && <div style={lockAlertStyle} role="status" aria-live="polite">
                  <strong>Locked: Write Up</strong>
                  <span>{partsWriteUpVhcLockDescription}</span>
                </div>}
              {writeUpTabMounted || activeTab === "write-up" ? <WriteUpForm jobNumber={jobData?.jobNumber || jobNumber} jobCardData={jobData ? { jobCard: jobData } : null} showHeader={false} readOnly={!canEditPartsWriteUpVhc} onSaveSuccess={handleWriteUpSaveSuccess} onCompletionChange={handleWriteUpCompletionChange} onRequestStatusesChange={handleWriteUpRequestStatusesChange} onTasksSnapshotChange={handleWriteUpTasksSnapshotChange} /> : null}
            </div>
          </div>

          <div className="app-page-stack" style={{
          display: activeTab === "vhc" ? undefined : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-vhc" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="VHC tab content">
            {isPartsWriteUpVhcLockedByStatus && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: VHC</strong>
                <span>{partsWriteUpVhcLockDescription}</span>
              </div>}
            <VHCTab jobNumber={jobNumber} jobData={jobData} canEdit={canEditPartsWriteUpVhc} canShowCustomerActions={vhcTabAmberReadyInstant} actingUserId={actingUserId} actingUserNumericId={actingUserNumericId} actingUserName={user?.name || user?.email || ""} onFinancialTotalsChange={setVhcFinancialTotalsFromPanel} onJobDataRefresh={() => fetchJobData({
            silent: true,
            force: true
          })} onVhcCustomerStatusReload={reloadVhcCustomerStatus} onUpdateRequestPrePickLocation={handleUpdateRequestPrePickLocation} />
          </div>

          <div className="app-page-stack" style={{
          display: activeTab === "warranty" ? undefined : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-warranty" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Warranty tab content">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Warranty</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <WarrantyTab jobData={jobData} canEdit={canEdit} onLinkComplete={() => fetchJobData({
            silent: true,
            force: true
          })} />
          </div>

          <div className="app-page-stack" style={{
          display: activeTab === "clocking" ? undefined : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-clocking" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Clocking tab">
            {isClockingLockedByStatus && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Clocking</strong>
                <span>{clockingLockDescription}</span>
              </div>}
            <ClockingTab jobData={jobData} canEdit={canEdit && !isClockingLockedByStatus} disabledMessageOverride={isClockingLockedByStatus ? clockingLockDescription : ""} />
          </div>

          <LayerSurface
            className="app-page-stack"
            sectionKey="jobcard-tab-messages"
            sectionType="content-card"
            parentKey="jobcard-tab-content-shell"
            backgroundToken="surface"
            data-dev-text-preview="Messages tab content"
            style={{
              display: activeTab === "messages" ? undefined : "none"
            }}>
            <MessagesTab thread={jobData?.messagingThread} jobId={jobData?.id || null} jobNumber={jobData?.jobNumber || jobNumber} customerEmail={jobData?.customerEmail} customerName={jobData?.customer || ""} dbUserId={dbUserId} />
          </LayerSurface>

          <div className="app-page-stack" style={{
          display: activeTab === "documents" ? undefined : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-documents" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Documents tab content">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Documents</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <DocumentsTab documents={jobDocuments} canDelete={canManageDocuments} onDelete={handleDeleteDocument} onManageDocuments={canManageDocuments ? () => setShowDocumentsPopup(true) : undefined} valetMode={isValetMode} valetJobId={jobData?.id || null} valetJobNumber={jobData?.jobNumber || jobNumber || ""} valetUserId={dbUserId || null} clockingLocked={isClockingLockedByStatus} clockingLockDescription={clockingLockDescription} onValetUploadComplete={() => fetchJobData({
            silent: true,
            force: true
          })} onRenameDocument={handleRenameDocument} onReplaceDocument={canManageDocuments ? handleReplaceDocument : undefined} />
          </div>

          <div className="app-page-stack" data-invoice-print-area style={{
          display: activeTab === "invoice" ? undefined : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-invoice" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell" data-dev-text-preview="Invoice tab content">
            {showCreateInvoiceButton && <div style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "16px"
          }}>
                <button type="button" onClick={handleCreateInvoice} disabled={creatingInvoice} style={{
              padding: "var(--control-padding)",
              backgroundColor: "var(--primary)",
              color: "var(--text-2)",
              border: "none",
              borderRadius: "var(--control-radius)",
              cursor: creatingInvoice ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: "var(--control-font-size)",
              minHeight: "var(--control-height)",
              transition: "background-color 0.2s",
              opacity: creatingInvoice ? 0.7 : 1
            }} onMouseEnter={e => {
              if (!creatingInvoice) e.currentTarget.style.backgroundColor = "var(--primary-hover)";
            }} onMouseLeave={e => {
              if (!creatingInvoice) e.currentTarget.style.backgroundColor = "var(--primary)";
            }}>
                  {creatingInvoice ? "Creating Invoice..." : "Create Invoice"}
                </button>
              </div>}
            {!invoicePrerequisitesMet && <div style={{
            padding: "24px",
            border: "none",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--warning-surface)",
            color: "var(--warning-dark)",
            marginBottom: "16px"
          }}>
                <h3 style={{
              marginTop: 0,
              color: "var(--warning-dark)"
            }}>Invoice prerequisites incomplete</h3>
                <p style={{
              marginBottom: "12px"
            }}>
                  Review the invoice layout below, but complete these tasks before sharing with the customer:
                </p>
                <ul style={{
              margin: 0,
              paddingLeft: "20px",
              color: "var(--danger-dark)",
              fontWeight: 600
            }}>
                  {invoiceBlockingReasons.map(reason => <li key={reason} style={{
                marginBottom: "6px"
              }}>
                      {reason}
                    </li>)}
                </ul>
              </div>}
            <InvoiceSection jobData={jobData} invoiceReady={showProformaCompleteSection} onInvoiceStateChange={setInvoiceViewState} onPaymentCompleted={handleInvoicePaymentCompleted} onReleaseRequested={handleReleaseJob} />
          </div>
        </LayerTheme>
        <DocumentsUploadPopup open={showDocumentsPopup} onClose={() => setShowDocumentsPopup(false)} jobId={jobData?.id ? String(jobData.id) : null} userId={user?.user_id || actingUserId || null} onAfterUpload={() => {
        fetchJobData({
          silent: true,
          force: true
        });
        fetchDocuments();
      }} onFileUploaded={handleDocumentFileUploaded} existingDocuments={jobDocuments} />
        {trackerQuickModalOpen && <LocationUpdateModal entry={{
        ...emptyTrackingForm,
        jobNumber: jobData?.jobNumber || "",
        reg: jobData?.reg || "",
        customer: jobData?.customer || "",
        serviceType: jobData?.type || jobData?.serviceType || "",
        vehicleLocation: trackerEntry?.vehicleLocation ? trackerEntry.vehicleLocation : emptyTrackingForm.vehicleLocation,
        keyLocation: trackerEntry?.keyLocation ? normalizeKeyLocationLabel(trackerEntry.keyLocation) : emptyTrackingForm.keyLocation
      }} onClose={() => setTrackerQuickModalOpen(false)} onSave={handleTrackerSave} />}

      </div>

      {/* ✅ Link Job Popup */}
      {isLinkPopupOpen && <div style={{
      ...popupOverlayStyles,
      zIndex: 1200
    }} onClick={() => {
      setIsLinkPopupOpen(false);
      setLinkJobInput("");
      setLinkError(null);
    }}>
          <div style={{
        ...popupCardStyles,
        maxWidth: "400px",
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }} onClick={e => e.stopPropagation()}>
            <h3 style={{
          margin: 0,
          fontSize: "20px",
          fontWeight: "700",
          color: "var(--primary)"
        }}>Link Job Card</h3>
            <input className="app-input" type="text" placeholder="e.g. 00099" value={linkJobInput} onChange={e => {
          setLinkJobInput(e.target.value);
          setLinkError(null);
        }} onKeyDown={e => {
          if (e.key === "Enter") handleLinkJob();
        }} autoFocus />
            {linkError && <p style={{
          margin: 0,
          fontSize: "13px",
          color: "var(--danger)"
        }}>{linkError}</p>}
            <div style={{
          display: "flex",
          gap: "8px",
          justifyContent: "flex-end"
        }}>
              <button className="app-btn app-btn--secondary" onClick={() => {
            setIsLinkPopupOpen(false);
            setLinkJobInput("");
            setLinkError(null);
          }}>
                Cancel
              </button>
              <button className="app-btn app-btn--primary" onClick={handleLinkJob} disabled={isLinking}>
                {isLinking ? "Linking…" : "Link"}
              </button>
            </div>
          </div>
        </div>}

      </>
    </JobCardErrorBoundary>; // render extracted page section.

    case "section4":
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
      marginBottom: "10px"
    }}>
            Job card failed to render
          </h2>
          <p style={{
      color: "var(--grey-accent)",
      marginBottom: "18px"
    }}>
            {renderError?.message || String(renderError)}
          </p>
          <p style={{
      color: "var(--grey-accent)",
      marginBottom: "30px",
      fontSize: "13px"
    }}>
            Check the console for the stack trace.
          </p>
        </div>
      </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
