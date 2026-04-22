// file location: src/components/page-ui/job-cards/job-cards-job-number-ui.js

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
    handleRenameDocument,
    handleReplaceDocument,
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
    vhcFinancialTotals,
    vhcSummaryCounts,
    vhcTabAmberReadyInstant,
    vhcTabCompleteInstant,
    writeUpCompleteInstant,
    writeUpTabMounted,
  } = props; // receive page logic props.

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
            <button onClick={() => router.push("/job-cards/view")} style={{
        padding: "var(--control-padding)",
        backgroundColor: "var(--primary)",
        color: "var(--text-inverse)",
        border: "none",
        borderRadius: "var(--control-radius)",
        cursor: "pointer",
        fontWeight: "600",
        fontSize: "var(--control-font-size)",
        minHeight: "var(--control-height)",
        transition: "background-color 0.2s"
      }} onMouseEnter={e => e.target.style.backgroundColor = "var(--primary-dark)"} onMouseLeave={e => e.target.style.backgroundColor = "var(--primary)"}>
              View All Job Cards
            </button>
          </div>
        </div>
      </>; // render extracted page section.

    case "section3":
      return <JobCardErrorBoundary>
      <>
      <div style={pageStackStyle} data-dev-section="1" data-dev-section-key="jobcard-page-shell" data-dev-section-type="page-shell" data-dev-shell="1">
        {isArchiveMode && <section data-dev-section="1" data-dev-section-key="jobcard-archive-banner" data-dev-section-type="section-shell" data-dev-section-parent="jobcard-page-shell" style={{
        padding: "12px 16px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--danger-surface)",
        backgroundColor: "var(--surface-light)",
        color: "var(--danger-dark)",
        fontSize: "0.95rem",
        fontWeight: 600
      }}>
            Archived copy &middot; Job #{jobData.jobNumber} is read-only. VHC, notes, and documents are preserved for audit.
          </section>}

        {isInvoiceOrBeyondReadOnly && !isArchiveMode && <section style={{
        padding: "12px 16px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--warning-surface)",
        backgroundColor: "var(--surface-light)",
        color: "var(--text-secondary)",
        fontSize: "0.95rem",
        fontWeight: 600
      }}>
            Job card is read-only in {jobData.status}. Payment remains available while invoiced, and key/car location updates remain available until archive.
          </section>}

        {/* ✅ Header Section */}
        <section style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "20px",
        backgroundColor: sharedJobCardShellBackground,
        borderRadius: "var(--radius-sm)",
        border: "none",
        flexShrink: 0
      }} data-dev-section="1" data-dev-section-key="jobcard-header" data-dev-section-type="section-header-row" data-dev-section-parent="jobcard-page-shell">
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
          }}>
              <h1 style={{
              margin: 0,
              color: "var(--primary)",
              fontSize: "28px",
              fontWeight: "700"
            }}>
                Job Card #{jobData.jobNumber}
              </h1>
              <span style={{
              padding: "6px 16px",
              backgroundColor: overallStatusLabel === "Open" ? "var(--success-surface)" : overallStatusLabel === "Released" ? "var(--success-surface)" : overallStatusLabel === "Complete" ? "var(--info-surface)" : "var(--warning-surface)",
              color: overallStatusLabel === "Open" ? "var(--success-dark)" : overallStatusLabel === "Released" ? "var(--success-dark)" : overallStatusLabel === "Complete" ? "var(--info)" : "var(--danger)",
              borderRadius: "var(--control-radius-xs)",
              fontWeight: "600",
              fontSize: "13px",
              border: "1px solid currentColor",
              letterSpacing: "0.3px"
            }}>
                {overallStatusLabel}
              </span>
              {jobData.jobSource === "Warranty" && <span style={{
              padding: "6px 16px",
              backgroundColor: "var(--warning-surface)",
              color: "var(--danger)",
              borderRadius: "var(--control-radius-xs)",
              fontWeight: "600",
              fontSize: "13px",
              border: "1px solid currentColor",
              letterSpacing: "0.3px"
            }}>
                  {jobData.jobSource}
                </span>}
              {jobDivisionLabel && <span style={{
              padding: "6px 16px",
              backgroundColor: jobDivisionLower === "sales" ? "var(--info-surface)" : "var(--success-surface)",
              color: jobDivisionLower === "sales" ? "var(--info)" : "var(--success-dark)",
              borderRadius: "var(--control-radius-xs)",
              fontWeight: "600",
              fontSize: "13px",
              border: "1px solid currentColor",
              letterSpacing: "0.3px"
            }}>
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
                return <button key={rJob.id} className="app-btn app-btn--sm app-btn--secondary" style={{
                  border: "1px solid var(--accent-base)"
                }} onClick={() => router.push(`/job-cards/${rJob.jobNumber}`)}>
                      #{rJob.jobNumber}
                      <span style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: statusColor
                  }}>{rJob.status}</span>
                    </button>;
              })}
              </>}
            {/* ✅ Link Job Button */}
            <button className="app-btn app-btn--sm app-btn--primary" onClick={() => setIsLinkPopupOpen(true)}>
              Link Job
            </button>
            {isBookedStatus && !isCheckedIn && <button onClick={handleCheckIn} disabled={checkingIn || !canEdit} style={{
              padding: "var(--control-padding)",
              backgroundColor: "var(--primary)",
              color: "var(--text-inverse)",
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
                e.target.style.backgroundColor = "var(--primary-light)";
              }
            }} onMouseLeave={e => {
              if (!checkingIn && canEdit) {
                e.target.style.backgroundColor = "var(--primary)";
              }
            }}>
                {checkingIn ? "Checking In..." : "Check In"}
              </button>}
            {showCreateInvoiceButton && <button onClick={handleCreateInvoice} disabled={creatingInvoice} style={{
              padding: "var(--control-padding)",
              backgroundColor: "var(--primary)",
              color: "var(--text-inverse)",
              border: "none",
              borderRadius: "var(--control-radius)",
              cursor: creatingInvoice ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "var(--control-font-size)",
              minHeight: "var(--control-height)",
              transition: "background-color 0.2s, transform 0.2s",
              opacity: creatingInvoice ? 0.7 : 1
            }} onMouseEnter={e => {
              if (!creatingInvoice) {
                e.target.style.backgroundColor = "var(--primary-light)";
              }
            }} onMouseLeave={e => {
              if (!creatingInvoice) {
                e.target.style.backgroundColor = "var(--primary)";
              }
            }}>
                {creatingInvoice ? "Creating Invoice..." : "Create Invoice"}
              </button>}
            {showReleaseButton && <button onClick={async () => {
              const result = await handleReleaseJob();
              if (!result?.success) {
                alert(result?.error || "Unable to release vehicle");
              }
            }} style={{
              padding: "var(--control-padding)",
              backgroundColor: "var(--success)",
              color: "var(--text-inverse)",
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

          {/* Row 2: Timestamps + Related Jobs */}
          <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px"
        }}>
            <p style={{
            margin: 0,
            color: "var(--grey-accent)",
            fontSize: "14px"
          }}>
              Created: {new Date(jobData.createdAt).toLocaleString()} |
              Last Updated: {new Date(jobData.updatedAt).toLocaleString()}
            </p>
          </div>
        </section>

        {/* ✅ Vehicle & Customer Info Bar */}
        <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
        gap: "10px",
        flexShrink: 0,
        backgroundColor: sharedJobCardShellBackground,
        borderRadius: "var(--radius-sm)",
        padding: "8px"
      }} data-dev-section="1" data-dev-section-key="jobcard-summary-shell" data-dev-section-type="section-shell" data-dev-section-parent="jobcard-page-shell" data-dev-shell="1">
          <div data-dev-section="1" data-dev-section-key="jobcard-summary-vehicle" data-dev-section-type="content-card" data-dev-section-parent="jobcard-summary-shell" style={{
          padding: "12px 14px",
          backgroundColor: "var(--surface)",
          borderRadius: "var(--radius-sm)",
          border: "none",
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
              gap: "4px",
              whiteSpace: "nowrap"
            }}>
                <span style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                fontWeight: "500"
              }}>Mileage</span>
                <input type="text" inputMode="numeric" maxLength={7} value={vehicleMileageInput} onChange={event => {
                const digitsOnly = (event.target.value || "").replace(/\D/g, "").slice(0, 7);
                mileageInputDirtyRef.current = true;
                setVehicleMileageInput(digitsOnly);
              }} disabled={!canEdit} aria-label="Vehicle mileage" className="vehicle-mileage-input" style={{
                width: "64px",
                margin: 0,
                padding: "0",
                borderRadius: "0",
                border: "none",
                backgroundColor: "transparent",
                color: "var(--grey-accent)",
                fontSize: "13px",
                fontWeight: "500",
                lineHeight: 1.2,
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
          </div>

          <div data-dev-section="1" data-dev-section-key="jobcard-summary-customer" data-dev-section-type="content-card" data-dev-section-parent="jobcard-summary-shell" onClick={() => {
          const fallbackNameParts = (jobData.customer || "").split(" ").map(part => part.trim()).filter(Boolean);
          const fallbackFirst = fallbackNameParts[0] || "";
          const fallbackLast = fallbackNameParts.slice(1).join(" ");
          const slug = createCustomerDisplaySlug(jobData.customerFirstName || fallbackFirst, jobData.customerLastName || fallbackLast) || null;
          const target = slug || jobData.customerId || null;
          if (target) {
            router.push(`/customers/${target}`);
          }
        }} style={{
          padding: "12px 14px",
          backgroundColor: "var(--surface)",
          borderRadius: "var(--radius-sm)",
          border: "none",
          minWidth: 0,
          overflow: "hidden",
          cursor: jobData.customerId || jobData.customerFirstName || jobData.customerLastName || jobData.customer ? "pointer" : "default"
        }}>
            <div style={summaryPrimaryTextStyle}>
              {jobData.customer || "N/A"}
            </div>
            <div style={summarySecondaryTextStyle}>
              {jobData.customerPhone || jobData.customerEmail || "No contact info"}
            </div>
          </div>

          <div data-dev-section="1" data-dev-section-key="jobcard-summary-vhc-financials" data-dev-section-type="stat-card" data-dev-section-parent="jobcard-summary-shell" style={{
          padding: "12px 14px",
          backgroundColor: "var(--surface)",
          borderRadius: "var(--radius-sm)",
          border: "none",
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
              backgroundColor: "var(--surface-light)",
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
          </div>

          <div data-dev-section="1" data-dev-section-key="jobcard-summary-locations" data-dev-section-type="content-card" data-dev-section-parent="jobcard-summary-shell" onClick={() => {
          if (canEditTrackingLocations) {
            setTrackerQuickModalOpen(true);
          }
        }} style={{
          padding: "12px 14px",
          backgroundColor: "var(--surface)",
          borderRadius: "var(--radius-sm)",
          border: "none",
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          minWidth: 0,
          overflow: "hidden",
          cursor: canEditTrackingLocations ? "pointer" : "default",
          opacity: canEditTrackingLocations ? 1 : 0.75
        }}>
            <div style={{
            flex: 1,
            minWidth: 0
          }}>
              <div style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              marginBottom: "4px"
            }}>
                Key location
              </div>
              <div style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
                {normalizeKeyLocationLabel(trackerEntry?.keyLocation) || KEY_LOCATIONS[0].label}
              </div>
            </div>
            <div style={{
            width: "1px",
            backgroundColor: "var(--surface-light)",
            flexShrink: 0
          }} />
            <div style={{
            flex: 1,
            minWidth: 0,
            textAlign: "right"
          }}>
              <div style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              marginBottom: "4px"
            }}>
                Car location
              </div>
              <div style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
                {trackerEntry?.vehicleLocation || CAR_LOCATIONS[0].label}
              </div>
            </div>
          </div>
        </section>

        {/* ✅ Tabs Navigation */}
        <section style={{
        backgroundColor: "transparent",
        borderRadius: 0,
        padding: 0
      }}>
          <div className={`tab-scroll-row${tabsOverflowing ? " is-overflowing" : ""}`} style={{
          backgroundColor: sharedJobCardShellBackground,
          borderRadius: "var(--radius-sm)",
          padding: "8px"
        }} ref={tabsScrollRef} onMouseDown={tabsOverflowing ? handleTabsDragStart : undefined} onMouseMove={tabsOverflowing ? handleTabsDragMove : undefined} onMouseUp={tabsOverflowing ? handleTabsDragEnd : undefined} onMouseLeave={tabsOverflowing ? handleTabsDragEnd : undefined}>
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
                  {isLocked && <span aria-hidden="true">Lock</span>}
                  {tab.badge && <span className={`app-badge app-badge--control ${tab.id === "notes" ? "app-badge--danger-strong" : "app-badge--accent-strong"}`}>
                      {tab.badge}
                    </span>}
                </button>;
          })}
          </div>
        </section>
        <style jsx global>{`
          .tab-scroll-row::-webkit-scrollbar {
            display: none;
          }
          .vehicle-mileage-input::placeholder {
            color: var(--grey-accent);
            font-size: 13px;
            font-weight: 500;
          }
          .vehicle-mileage-input::-webkit-outer-spin-button,
          .vehicle-mileage-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          .vehicle-mileage-input {
            -moz-appearance: textfield;
            appearance: textfield;
            height: 1.2em !important;
            min-height: 1.2em !important;
            max-height: 1.2em !important;
          }
          .vehicle-mileage-input:disabled {
            opacity: 1;
            -webkit-text-fill-color: var(--grey-accent);
            color: var(--grey-accent);
          }
          .vehicle-mileage-input:focus,
          .vehicle-mileage-input:active {
            height: 1.2em !important;
            min-height: 1.2em !important;
            max-height: 1.2em !important;
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
        <section style={{
        backgroundColor: sharedJobCardShellBackground,
        borderRadius: "var(--radius-sm)",
        padding: "8px"
      }} data-dev-section="1" data-dev-section-key="jobcard-tab-content-shell" data-dev-section-type="section-shell" data-dev-section-parent="jobcard-page-shell" data-dev-shell="1">
          {/* Keep tabs mounted for state retention, but defer write-up mounting to idle/user intent. */}
          <div style={{
          display: activeTab === "customer-requests" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-customer-requests" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Customer Requests</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <CustomerRequestsTab jobData={jobData} canEdit={canEdit} onUpdate={handleUpdateRequests} onUpdateRequestPrePickLocation={handleUpdateRequestPrePickLocation} onToggleVhcRequired={handleToggleVhcRequired} overallStatusId={overallStatusId} vhcSummary={vhcSummaryCounts} vhcChecks={jobVhcChecks} notes={jobNotes} partsJobItems={jobData?.parts_job_items || []} />
          </div>

          <div style={{
          display: activeTab === "contact" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-contact" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Contact</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <ContactTab jobData={jobData} canEdit={canEdit} onSaveCustomerDetails={handleCustomerDetailsSave} customerSaving={customerSaving} />
          </div>

          <div style={{
          display: activeTab === "scheduling" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-scheduling" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Scheduling</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <SchedulingTab jobData={jobData} canEdit={canEdit} customerVehicles={customerVehicles} customerVehiclesLoading={customerVehiclesLoading} bookingRequest={jobData?.bookingRequest} onBookingFlowSave={handleBookingFlowSave} bookingFlowSaving={bookingFlowSaving} onBookingApproval={handleBookingApproval} bookingApprovalSaving={bookingApprovalSaving} onAppointmentSave={handleAppointmentSave} appointmentSaving={appointmentSaving} />
          </div>

          <div style={{
          display: activeTab === "service-history" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-service-history" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
            <ServiceHistoryTab vehicleJobHistory={vehicleJobHistory} />
          </div>

          {canViewPartsTab && <div style={{
          display: activeTab === "parts" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-parts" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
              {isPartsWriteUpVhcLockedByStatus && <div style={lockAlertStyle} role="status" aria-live="polite">
                  <strong>Locked: Parts</strong>
                  <span>{partsWriteUpVhcLockDescription}</span>
                </div>}
              <PartsTabNew jobData={jobData} canEdit={canEditPartsWriteUpVhc} onRefreshJob={() => fetchJobData({
            silent: true,
            force: true
          })} actingUserId={actingUserId} actingUserNumericId={actingUserNumericId} invoiceReady={invoicePrerequisitesMet} />
            </div>}

          <div style={{
          display: activeTab === "notes" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-notes" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Notes</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <NotesTabNew jobData={jobData} canEdit={canEdit} actingUserNumericId={actingUserNumericId} onNotesChange={handleNotesChange} onNoteAdded={handleNoteAdded} highlightNoteIds={highlightedNoteIds} />
          </div>

          <div style={{
          display: activeTab === "write-up" ? "block" : "none",
          height: "100%"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-writeup" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
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
              {writeUpTabMounted || activeTab === "write-up" ? <WriteUpForm jobNumber={jobData?.jobNumber || jobNumber} jobCardData={jobData} showHeader={false} readOnly={!canEditPartsWriteUpVhc} onSaveSuccess={handleWriteUpSaveSuccess} onCompletionChange={handleWriteUpCompletionChange} onRequestStatusesChange={handleWriteUpRequestStatusesChange} onTasksSnapshotChange={handleWriteUpTasksSnapshotChange} /> : null}
            </div>
          </div>

          <div style={{
          display: activeTab === "vhc" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-vhc" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
            {isPartsWriteUpVhcLockedByStatus && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: VHC</strong>
                <span>{partsWriteUpVhcLockDescription}</span>
              </div>}
            <VHCTab jobNumber={jobNumber} jobData={jobData} canEdit={canEditPartsWriteUpVhc} canShowCustomerActions={vhcTabAmberReadyInstant} actingUserId={actingUserId} actingUserNumericId={actingUserNumericId} actingUserName={user?.name || user?.email || ""} onFinancialTotalsChange={setVhcFinancialTotalsFromPanel} onJobDataRefresh={() => fetchJobData({
            silent: true,
            force: true
          })} onUpdateRequestPrePickLocation={handleUpdateRequestPrePickLocation} />
          </div>

          <div style={{
          display: activeTab === "warranty" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-warranty" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Warranty</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <WarrantyTab jobData={jobData} canEdit={canEdit} onLinkComplete={() => fetchJobData({
            silent: true,
            force: true
          })} />
          </div>

          <div style={{
          display: activeTab === "clocking" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-clocking" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
            {isClockingLockedByStatus && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Clocking</strong>
                <span>{clockingLockDescription}</span>
              </div>}
            <ClockingTab jobData={jobData} canEdit={canEdit && !isClockingLockedByStatus} disabledMessageOverride={isClockingLockedByStatus ? clockingLockDescription : ""} />
          </div>

          <div style={{
          display: activeTab === "messages" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-messages" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
            <MessagesTab thread={jobData?.messagingThread} jobNumber={jobData?.jobNumber || jobNumber} customerEmail={jobData?.customerEmail} customerName={jobData?.customer || ""} />
          </div>

          <div style={{
          display: activeTab === "documents" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-documents" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
            {isInvoiceOrBeyondReadOnly && <div style={lockAlertStyle} role="status" aria-live="polite">
                <strong>Locked: Documents</strong>
                <span>{generalReadOnlyLockDescription}</span>
              </div>}
            <DocumentsTab documents={jobDocuments} canDelete={canManageDocuments} onDelete={handleDeleteDocument} onManageDocuments={canManageDocuments ? () => setShowDocumentsPopup(true) : undefined} valetMode={isValetMode} valetJobId={jobData?.id || null} valetJobNumber={jobData?.jobNumber || jobNumber || ""} valetUserId={dbUserId || null} clockingLocked={isClockingLockedByStatus} clockingLockDescription={clockingLockDescription} onValetUploadComplete={() => fetchJobData({
            silent: true,
            force: true
          })} onRenameDocument={handleRenameDocument} onReplaceDocument={canManageDocuments ? handleReplaceDocument : undefined} />
          </div>

          <div data-invoice-print-area style={{
          display: activeTab === "invoice" ? "block" : "none"
        }} data-dev-section="1" data-dev-section-key="jobcard-tab-invoice" data-dev-section-type="content-card" data-dev-section-parent="jobcard-tab-content-shell">
            {!invoicePrerequisitesMet && <div style={{
            padding: "24px",
            border: "1px dashed var(--warning)",
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
        </section>
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
        gap: "20px",
        border: "none"
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
