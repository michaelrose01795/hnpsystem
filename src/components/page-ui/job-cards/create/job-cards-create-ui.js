// file location: src/components/page-ui/job-cards/create/job-cards-create-ui.js

export default function CreateJobCardPageUi(props) {
  const {
    DevLayoutSection,
    DocumentsUploadPopup,
    DropdownField,
    ExistingCustomerPopup,
    MobileMechanicEligibility,
    NewCustomerPopup,
    PAYMENT_TYPE_OPTIONS,
    QuestionPromptsPopup,
    RequestPresetAutosuggestInput,
    activeTabIndex,
    addNewJobTab,
    binaryToggleGroupStyle,
    captureTempUploadMetadata,
    cosmeticDamagePresent,
    cosmeticNotes,
    customer,
    customerFieldDefinitions,
    customerForm,
    customerNotification,
    dbUserId,
    detectJobTypesForRequests,
    error,
    getBinaryToggleButtonStyle,
    getJobInfoOptionStyle,
    handleAddRequest,
    handleCancelCustomerEdit,
    handleCustomerFieldChange,
    handleCustomerSelect,
    handleFetchVehicleData,
    handlePaymentTypeChange,
    handleRemoveRequest,
    handleRequestChange,
    handleSaveCustomerEdits,
    handleSaveJob,
    handleStartCustomerEdit,
    handleTimeChange,
    hasLinkedJobCards,
    isCustomerEditing,
    isLoadingVehicle,
    isMobileMechanic,
    isSavingCustomer,
    isSubJobMode,
    jobCardSelectorOptions,
    jobCategories,
    jobDetections,
    jobInfoOptionGroupStyle,
    jobSource,
    jobTabs,
    newCustomerPrefill,
    normalizeHoursToTwoDecimals,
    persistPresetDefaultHours,
    populatedRequests,
    popupCardStyles,
    popupOverlayStyles,
    primeJobData,
    questionPromptsIndex,
    removeJobTab,
    requests,
    router,
    sectionCardStyle,
    setActiveTabIndex,
    setCosmeticDamagePresent,
    setCosmeticNotes,
    setCustomer,
    setCustomerNotification,
    setIsMobileMechanic,
    setJobCategories,
    setJobDetections,
    setJobSource,
    setNewCustomerPrefill,
    setQuestionPromptsIndex,
    setRequests,
    setShowDetectedRequestsPopup,
    setShowDocumentsPopup,
    setShowExistingCustomer,
    setShowNewCustomer,
    setVehicle,
    setVehicleNotification,
    setVhcRequired,
    setWaitingStatus,
    setWashRequired,
    showDetectedRequestsPopup,
    showDocumentsPopup,
    showExistingCustomer,
    showNewCustomer,
    toggleContactPreference,
    uploadedFiles,
    vehicle,
    vehicleNotification,
    vehicleSectionRef,
    vhcRequired,
    visibleJobDetections,
    waitingStatus,
    washRequired,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <DevLayoutSection sectionKey="job-cards-create-page-shell" sectionType="page-shell" shell widthMode="page" style={{
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: 0,
    overflow: "hidden",
    transition: "background 0.3s ease",
    background: "transparent"
  }}>
        {/* ✅ Header Section - Modern Design */}
        <DevLayoutSection sectionKey="job-cards-create-header" sectionType="toolbar" parentKey="job-cards-create-page-shell" style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: "12px",
      flexShrink: 0,
      gap: "12px",
      flexWrap: "wrap"
      }}>
          <div className="job-cards-create-header-left" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "12px",
        flexWrap: "nowrap",
        minWidth: 0,
        flex: "1 1 420px"
      }}>
            <div className="job-cards-create-selector-wrap" style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "nowrap",
          justifyContent: "flex-start",
          minWidth: 0,
          width: "100%",
          overflow: "hidden"
        }}>
              <div className="tab-api job-cards-create-selector" role="tablist" aria-label="Linked job cards" style={{
            maxWidth: "100%",
            overflowX: "auto",
            overflowY: "hidden",
            justifyContent: "flex-start",
            flexWrap: "nowrap",
            scrollbarWidth: "thin"
          }}>
                {jobCardSelectorOptions.map(option => {
              const isActive = activeTabIndex === option.index;
              return <button key={option.id} type="button" role="tab" onClick={() => setActiveTabIndex(option.index)} aria-selected={isActive} aria-pressed={isActive} data-tone="default" className={`tab-api__item${isActive ? " is-active" : ""}`}>
                      {option.label}
                    </button>;
            })}
                {!isSubJobMode && <button type="button" onClick={addNewJobTab} data-tone="default" className="tab-api__item job-cards-create-add-linked-button" title="Add another linked job" style={{
              fontWeight: 700,
              fontSize: "1.1rem",
              lineHeight: 1,
              padding: "0 10px"
            }}>
                    +
                  </button>}
              </div>

              {!isSubJobMode && hasLinkedJobCards && <button type="button" onClick={() => removeJobTab(activeTabIndex)} className="app-btn app-btn--ghost app-btn--sm app-btn--pill job-cards-create-remove-linked-button">
                  Remove selected
                </button>}
            </div>
          </div>
          <div style={{
        flex: "1 1 280px",
        minWidth: 0,
        display: "flex",
        justifyContent: "center",
        overflow: "hidden"
      }}>
            <div className="tab-api" style={{
          width: "100%",
          maxWidth: "520px",
          justifyContent: "center",
          flexWrap: "nowrap",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "thin"
        }}>
              {populatedRequests.length === 0 ? <span data-tone="default" className="tab-api__item" style={{
            opacity: 0.55,
            pointerEvents: "none",
            cursor: "default"
          }}>
                  No detected requests yet
                </span> : <button type="button" onClick={() => setShowDetectedRequestsPopup(true)} className="app-btn app-btn--secondary app-btn--sm app-btn--pill" style={{
            width: "100%",
            justifyContent: "center"
          }}>
                  <span style={{
              fontSize: "12px",
              fontWeight: "700",
              color: "var(--accent-strong)",
              whiteSpace: "nowrap"
            }}>
                    Request 1
                  </span>
                  <span style={{
              minWidth: 0,
              flex: "0 1 auto",
              fontSize: "12px",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>
                    {(() => {
                const firstIndex = populatedRequests[0]?.index;
                const detection = visibleJobDetections.find(d => Number(d.requestIndex) === firstIndex);
                if (!detection) return "Detecting…";
                return String(detection.jobType || "")
                  .replace(/_/g, " ")
                  .toLowerCase()
                  .replace(/\b\w/g, c => c.toUpperCase());
              })()}
                  </span>
                  {populatedRequests.length > 1 ? <span style={{
              flexShrink: 0,
              fontSize: "11px",
              fontWeight: "700",
              color: "var(--accent-strong)",
              background: "var(--accent-surface)",
              borderRadius: "999px",
              padding: "4px 8px"
            }}>
                      +{populatedRequests.length - 1} more
                    </span> : null}
                </button>}
            </div>
          </div>
          <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap"
      }}>
            {/* Job Source Badge */}
            <span style={{
          minHeight: "var(--control-height)",
          padding: "var(--control-padding)",
          borderRadius: "var(--control-radius)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          backgroundColor: jobSource === "Warranty" ? "var(--warning-surface)" : "var(--success-surface)",
          color: jobSource === "Warranty" ? "var(--warning-dark)" : "var(--success-dark)",
          fontSize: "var(--control-font-size)",
          fontWeight: 600,
          letterSpacing: "0.3px"
        }}>
              {jobSource}
            </span>
            <button type="button" onClick={handleSaveJob} className="app-btn app-btn--primary">
              {jobTabs.length > 1 ? `Save ${jobTabs.length} Jobs` : "Save Job Card"}
            </button>
          </div>
        </DevLayoutSection>

        {/* ✅ Sub-job Mode Banner */}
        {isSubJobMode && primeJobData && <DevLayoutSection sectionKey="job-cards-create-subjob-banner" sectionType="status-banner" parentKey="job-cards-create-page-shell" style={{
      padding: "12px 16px",
      backgroundColor: "var(--primary-surface)",
      borderRadius: "var(--radius-xs)",
      marginBottom: "8px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      border: "1px solid var(--primary-light)"
    }}>
            <span style={{
        fontSize: "18px"
      }}>🔗</span>
            <div style={{
        flex: 1
      }}>
              <span style={{
          fontWeight: 600,
          color: "var(--primary)"
        }}>
                Creating sub-job linked to Job {primeJobData.jobNumber}
              </span>
              <span style={{
          marginLeft: "12px",
          color: "var(--text-secondary)",
          fontSize: "13px"
        }}>
                Customer and vehicle details are inherited from the prime job
              </span>
            </div>
            <button onClick={() => router.push(`/job-cards/${primeJobData.jobNumber}`)} style={{
        padding: "6px 12px",
        fontSize: "12px",
        backgroundColor: "var(--primary)",
        color: "white",
        border: "none",
        borderRadius: "var(--radius-xs)",
        cursor: "pointer"
      }}>
              View Prime Job
            </button>
          </DevLayoutSection>}

        {/* ✅ Content Area */}
        <DevLayoutSection sectionKey="job-cards-create-content" sectionType="section-shell" parentKey="job-cards-create-page-shell" shell style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "16px"
    }}>
          {/* ✅ NEW LAYOUT: Top Row - Job Information, Vehicle Details, Customer Details (all 33% width) */}
          <DevLayoutSection sectionKey="job-cards-create-top-row" sectionType="section-shell" parentKey="job-cards-create-content" shell style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px",
        width: "100%"
      }}>
            {/* Job Information Section - responsive, min 260px */}
            <DevLayoutSection sectionKey="job-cards-create-job-information" sectionType="content-card" parentKey="job-cards-create-top-row" style={{
          flex: "1 1 260px",
          minWidth: 0,
          padding: "var(--section-card-padding)",
          borderRadius: "var(--radius-md)",
          ...sectionCardStyle,
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          minHeight: "420px",
          boxSizing: "border-box",
          overflowY: "auto"
        }}>
              <div style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: "12px",
            paddingBottom: "12px",
            borderBottom: "1px solid var(--accent-border)"
          }}>
                <div style={{
              minWidth: 0
            }}>
                  <h3 style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "var(--text-primary)",
                margin: 0
              }}>
                    Job Information
                  </h3>
                </div>
              </div>

              <div style={{
            display: "grid",
            gap: "12px"
          }}>
                <div>
                  <label style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "10px"
              }}>
                    Customer Status
                  </label>
                  <div style={jobInfoOptionGroupStyle}>
                    {["Waiting", "Loan Car", "Collection", "Neither"].map(status => <label key={status} style={getJobInfoOptionStyle(waitingStatus === status)}>
                        <input type="radio" name="waiting" value={status} checked={waitingStatus === status} onChange={() => setWaitingStatus(status)} style={{
                    display: "none"
                  }} />
                        <span style={{
                    fontSize: "13px",
                    textAlign: "center"
                  }}>{status}</span>
                      </label>)}
                  </div>
                </div>

                <div>
                  <label style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "10px"
              }}>
                    Job Source
                  </label>
                  <div style={jobInfoOptionGroupStyle}>
                    {["Retail", "Warranty"].map(src => <label key={src} style={getJobInfoOptionStyle(jobSource === src)}>
                        <input type="radio" name="source" value={src} checked={jobSource === src} onChange={() => setJobSource(src)} style={{
                    display: "none"
                  }} />
                        <span style={{
                    fontSize: "13px",
                    textAlign: "center"
                  }}>{src}</span>
                      </label>)}
                  </div>
                </div>

                {/* Mobile Mechanic eligibility — evaluates the current
                    customer + vehicle + detected job types and exposes a
                    Yes/No toggle gated by the eligibility verdict.
                    Customer postcode drives a drive-time lookup inside the
                    component; no extra API wiring is needed here. */}
                <MobileMechanicEligibility customer={customerForm} vehicle={vehicle} jobDetections={jobDetections} jobCategories={jobCategories} isMobileMechanic={isMobileMechanic} onSelectionChange={setIsMobileMechanic} toggleGroupStyle={binaryToggleGroupStyle} getToggleButtonStyle={getBinaryToggleButtonStyle} />
              </div>
            </DevLayoutSection>

            {/* Vehicle Details Section - responsive, min 260px */}
            <DevLayoutSection sectionKey="job-cards-create-vehicle-details" sectionType="content-card" parentKey="job-cards-create-top-row" style={{
          flex: "1 1 260px",
          minWidth: 0,
          padding: "var(--section-card-padding)",
          borderRadius: "var(--radius-md)",
          ...sectionCardStyle,
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          minHeight: "420px",
          boxSizing: "border-box",
          overflowY: "auto"
        }} ref={vehicleSectionRef}>
              <h3 style={{
            fontSize: "16px",
            fontWeight: "600",
            color: "var(--text-primary)",
            marginTop: 0,
            marginBottom: "16px"
          }}>
                Vehicle Details
                {isSubJobMode && <span style={{
              marginLeft: "8px",
              fontSize: "11px",
              fontWeight: "500",
              padding: "2px 8px",
              borderRadius: "var(--radius-xs)",
              backgroundColor: "var(--primary-surface)",
              color: "var(--primary)"
            }}>
                    Inherited
                  </span>}
              </h3>

              {vehicleNotification && <div style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: vehicleNotification.type === "success" ? "var(--success)" : "var(--danger-surface)",
            border: "none",
            color: vehicleNotification.type === "success" ? "var(--success-dark)" : "var(--danger-dark)",
            fontSize: "13px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
                  <span>{vehicleNotification.message}</span>
                  <button onClick={() => setVehicleNotification(null)} style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "inherit"
            }}>
                    ×
                  </button>
                </div>}

              <div style={{
            marginBottom: "16px"
          }}>
                <label style={{
              fontSize: "13px",
              fontWeight: "500",
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: "6px"
            }}>
                  Registration Number
                </label>
                <div style={{
              display: "flex",
              gap: "12px",
              alignItems: "center"
            }}>
                  <input type="text" value={vehicle.reg} onChange={e => setVehicle({
                ...vehicle,
                reg: e.target.value
              })} placeholder="e.g. AB12 CDE" style={{
                flex: 1,
                padding: "10px 12px",
                border: "none",
                borderRadius: "var(--radius-xs)",
                backgroundColor: "var(--surface)",
                fontSize: "14px",
                textTransform: "uppercase",
                outline: "none",
                transition: "border-color 0.2s"
              }} onFocus={e => {
                e.target.style.borderColor = "var(--primary)";
              }} onBlur={e => {
                e.target.style.borderColor = "var(--surface-light)";
              }} />
                  <button onClick={handleFetchVehicleData} disabled={isLoadingVehicle} style={{
                padding: "10px 20px",
                backgroundColor: isLoadingVehicle ? "var(--background)" : "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-xs)",
                fontWeight: "600",
                fontSize: "13px",
                cursor: isLoadingVehicle ? "not-allowed" : "pointer",
                transition: "all 0.2s"
              }} onMouseEnter={e => {
                if (!isLoadingVehicle) e.target.style.backgroundColor = "var(--primary-dark)";
              }} onMouseLeave={e => {
                if (!isLoadingVehicle) e.target.style.backgroundColor = "var(--primary)";
              }}>
                    {isLoadingVehicle ? "Loading..." : "Search"}
                  </button>
                </div>
              </div>

              {error && <div style={{
            fontSize: "12px",
            color: "var(--danger)",
            marginBottom: "12px",
            padding: "10px 12px",
            backgroundColor: "var(--danger-surface)",
            borderRadius: "var(--radius-xs)",
            border: "none"
          }}>
                  {error}
                </div>}

              <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
                {["colour", "makeModel", "chassis", "engine"].map((key, idx) => {
              const labelMap = {
                colour: "Colour",
                makeModel: "Make & Model",
                chassis: "Chassis Number",
                engine: "Engine Number"
              };
              return <div key={`${key}-${idx}`}>
                      <label style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: "4px"
                }}>
                        {labelMap[key]}
                      </label>
                      <div style={{
                  padding: "10px 12px",
                  backgroundColor: "var(--surface)",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "14px",
                  color: vehicle[key] ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: vehicle[key] ? 400 : 500
                }}>
                        {vehicle[key] || "Not available"}
                      </div>
                    </div>;
            })}

                <div>
                  <label style={{
                fontSize: "13px",
                fontWeight: "500",
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "6px"
              }}>
                    Current Mileage
                  </label>
                  <input type="number" value={vehicle.mileage} onChange={e => setVehicle({
                ...vehicle,
                mileage: e.target.value
              })} placeholder="Enter mileage" style={{
                width: "100%",
                padding: "10px 12px",
                border: "none",
                borderRadius: "var(--radius-xs)",
                backgroundColor: "var(--surface)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s"
              }} onFocus={e => {
                e.target.style.borderColor = "var(--primary)";
              }} onBlur={e => {
                e.target.style.borderColor = "var(--surface-light)";
              }} />
                </div>
              </div>
            </DevLayoutSection>

            {/* Customer Details Section - responsive, min 260px */}
            <DevLayoutSection sectionKey="job-cards-create-customer-details" sectionType="content-card" parentKey="job-cards-create-top-row" style={{
          flex: "1 1 260px",
          minWidth: 0,
          padding: "var(--section-card-padding)",
          borderRadius: "var(--radius-md)",
          ...sectionCardStyle,
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          minHeight: "420px",
          boxSizing: "border-box",
          overflowY: "auto"
        }}>
              <h3 style={{
            fontSize: "16px",
            fontWeight: "600",
            color: "var(--text-primary)",
            marginTop: 0,
            marginBottom: "16px"
          }}>
                Customer Details
                {isSubJobMode && <span style={{
              marginLeft: "8px",
              fontSize: "11px",
              fontWeight: "500",
              padding: "2px 8px",
              borderRadius: "var(--radius-xs)",
              backgroundColor: "var(--primary-surface)",
              color: "var(--primary)"
            }}>
                    Inherited
                  </span>}
              </h3>

              {customerNotification && <div style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: customerNotification.type === "success" ? "var(--success)" : "var(--danger-surface)",
            border: "none",
            color: customerNotification.type === "success" ? "var(--success-dark)" : "var(--danger-dark)",
            fontSize: "13px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
                  <span>{customerNotification.message}</span>
                  <button onClick={() => setCustomerNotification(null)} style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "inherit"
            }}>
                    ×
                  </button>
                </div>}

              {customer ? <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}>
                  {isCustomerEditing ? <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px"
            }}>
                      {customerFieldDefinitions.map(input => <div key={input.field} style={{
                gridColumn: input.field === "email" || input.field === "address" || input.field === "contactPreference" ? "1 / -1" : "auto"
              }}>
                          <label style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: "6px"
                }}>
                            {input.label}
                          </label>
                          {input.type === "textarea" ? <textarea value={customerForm[input.field] || ""} onChange={e => handleCustomerFieldChange(input.field, e.target.value)} onInput={e => {
                  if (input.field !== "address") return;
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }} disabled={!isCustomerEditing || isSavingCustomer} placeholder={input.placeholder} rows={input.field === "address" ? 1 : 3} style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "14px",
                  outline: "none",
                  transition: "border-color 0.2s",
                  backgroundColor: isCustomerEditing && !isSavingCustomer ? "var(--surface-light)" : "transparent",
                  resize: input.field === "address" ? "none" : "vertical",
                  minHeight: input.field === "address" ? "40px" : "unset",
                  overflow: "hidden",
                  lineHeight: 1.45
                }} onFocus={e => {
                  e.target.style.borderColor = "var(--primary)";
                }} onBlur={e => {
                  e.target.style.borderColor = "var(--surface-light)";
                }} /> : input.type === "multi-select" ? <div style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  padding: "6px",
                  borderRadius: "var(--control-radius)",
                  backgroundColor: isCustomerEditing ? "var(--surface-light)" : "transparent",
                  border: "none",
                  width: "100%"
                }}>
                              {["phone", "email", "sms"].map(pref => {
                    const active = Array.isArray(customerForm.contactPreference) && customerForm.contactPreference.includes(pref);
                    return <button key={pref} type="button" onClick={() => toggleContactPreference(pref)} style={{
                      padding: "8px 14px",
                      borderRadius: "var(--control-radius)",
                      border: active ? "1px solid var(--primary)" : "1px solid transparent",
                      backgroundColor: active ? "var(--surface)" : "transparent",
                      color: active ? "var(--text-primary)" : "var(--text-secondary)",
                      fontSize: "13px",
                      fontWeight: active ? "600" : "500",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textTransform: "none",
                      letterSpacing: "0"
                    }}>
                                    {pref === "sms" ? "SMS" : pref.charAt(0).toUpperCase() + pref.slice(1)}
                                  </button>;
                  })}
                            </div> : <input type={input.type} value={customerForm[input.field] || ""} onChange={e => handleCustomerFieldChange(input.field, e.target.value)} disabled={!isCustomerEditing || isSavingCustomer} placeholder={input.placeholder} style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "14px",
                  outline: "none",
                  transition: "border-color 0.2s",
                  backgroundColor: isCustomerEditing && !isSavingCustomer ? "var(--surface-light)" : "transparent",
                  color: input.type === "tel" ? "#000" : "inherit"
                }} onFocus={e => {
                  e.target.style.borderColor = "var(--primary)";
                }} onBlur={e => {
                  e.target.style.borderColor = "var(--surface-light)";
                }} />}
                        </div>)}
                    </div> : <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "8px"
            }}>
                      {customerFieldDefinitions.filter(input => input.field !== "contactPreference").map(input => <div key={input.field} style={{
                gridColumn: input.field === "firstName" || input.field === "lastName" || input.field === "mobile" || input.field === "telephone" ? "auto" : "1 / -1",
                padding: input.field === "email" ? "12px 14px" : input.field === "mobile" || input.field === "telephone" ? "12px 14px" : "10px 12px",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                border: "1px solid var(--accent-border)",
                minWidth: 0
              }}>
                            <div style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: "4px"
                }}>
                              {input.label}
                            </div>
                            <div style={{
                  fontSize: input.field === "email" ? "14px" : "13px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  lineHeight: 1.4,
                  wordBreak: "break-word"
                }}>
                              {customerForm[input.field] || "Not provided"}
                            </div>
                          </div>)}
                    </div>}

                  <div style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap"
            }}>
                    {isCustomerEditing ? <>
                        <button onClick={handleSaveCustomerEdits} disabled={isSavingCustomer} style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "14px",
                  backgroundColor: "var(--primary)",
                  color: "var(--text-inverse)",
                  border: "none",
                  borderRadius: "var(--radius-xs)",
                  cursor: isSavingCustomer ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s",
                  opacity: isSavingCustomer ? 0.7 : 1
                }} onMouseEnter={e => {
                  if (!isSavingCustomer) {
                    e.target.style.backgroundColor = "var(--primary-dark)";
                  }
                }} onMouseLeave={e => {
                  e.target.style.backgroundColor = "var(--primary)";
                }}>
                          {isSavingCustomer ? "Saving..." : "Save Changes"}
                        </button>
                        <button onClick={handleCancelCustomerEdit} disabled={isSavingCustomer} style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "14px",
                  backgroundColor: "var(--surface-light)",
                  color: "var(--text-primary)",
                  border: "none",
                  borderRadius: "var(--radius-xs)",
                  cursor: isSavingCustomer ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s",
                  opacity: isSavingCustomer ? 0.7 : 1
                }} onMouseEnter={e => {
                  if (!isSavingCustomer) {
                    e.target.style.backgroundColor = "var(--surface-muted)";
                  }
                }} onMouseLeave={e => {
                  e.target.style.backgroundColor = "var(--surface-light)";
                }}>
                          Cancel
                        </button>
                      </> : <>
                        <button onClick={handleStartCustomerEdit} style={{
                  width: "100%",
                  maxWidth: "320px",
                  padding: "14px",
                  fontSize: "14px",
                  backgroundColor: "var(--primary)",
                  color: "var(--text-inverse)",
                  border: "none",
                  borderRadius: "var(--radius-xs)",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s",
                  alignSelf: "center"
                }} onMouseEnter={e => {
                  e.target.style.backgroundColor = "var(--primary-dark)";
                }} onMouseLeave={e => {
                  e.target.style.backgroundColor = "var(--primary)";
                }}>
                          Edit Customer
                        </button>
                        <button onClick={() => setCustomer(null)} disabled={isSavingCustomer} style={{
                  width: "100%",
                  maxWidth: "320px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  backgroundColor: "var(--accent-purple-surface)",
                  color: "var(--accent-purple)",
                  border: "1px solid var(--accent-purple)",
                  borderRadius: "var(--radius-xs)",
                  cursor: isSavingCustomer ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
                  opacity: isSavingCustomer ? 0.7 : 1,
                  alignSelf: "center"
                }} onMouseEnter={e => {
                  if (!isSavingCustomer) {
                    e.target.style.backgroundColor = "var(--accent-purple)";
                    e.target.style.color = "var(--text-inverse)";
                  }
                }} onMouseLeave={e => {
                  e.target.style.backgroundColor = "var(--accent-purple-surface)";
                  e.target.style.color = "var(--accent-purple)";
                }}>
                          Clear Customer
                        </button>
                      </>}
                  </div>

                  {isCustomerEditing && <button onClick={() => setCustomer(null)} disabled={isSavingCustomer} style={{
              width: "100%",
              maxWidth: "320px",
              padding: "12px",
              fontSize: "14px",
              backgroundColor: "var(--surface-light)",
              color: "var(--text-primary)",
              border: "none",
              borderRadius: "var(--radius-xs)",
              cursor: isSavingCustomer ? "not-allowed" : "pointer",
              fontWeight: "600",
              transition: "all 0.2s",
              opacity: isSavingCustomer ? 0.7 : 1,
              alignSelf: "center"
            }} onMouseEnter={e => {
              if (!isSavingCustomer) {
                e.target.style.backgroundColor = "var(--surface-muted)";
              }
            }} onMouseLeave={e => {
              e.target.style.backgroundColor = "var(--surface-light)";
            }}>
                      Clear Customer
                    </button>}
                </div> : <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            alignItems: "center"
          }}>
                  <button onClick={() => setShowNewCustomer(true)} style={{
              width: "100%",
              maxWidth: "320px",
              padding: "14px",
              fontSize: "14px",
              backgroundColor: "var(--primary)",
              color: "var(--text-inverse)",
              border: "none",
              borderRadius: "var(--radius-xs)",
              cursor: "pointer",
              fontWeight: "600",
              transition: "all 0.2s"
            }} onMouseEnter={e => {
              e.target.style.backgroundColor = "var(--primary-dark)";
            }} onMouseLeave={e => {
              e.target.style.backgroundColor = "var(--primary)";
            }}>
                    New Customer
                  </button>
                  <button onClick={() => setShowExistingCustomer(true)} style={{
              width: "100%",
              maxWidth: "320px",
              padding: "12px 16px",
              fontSize: "14px",
              backgroundColor: "var(--accent-purple-surface)",
              color: "var(--accent-purple)",
              border: "1px solid var(--accent-purple)",
              borderRadius: "var(--radius-xs)",
              cursor: "pointer",
              fontWeight: "600",
              transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease"
            }} onMouseEnter={e => {
              e.target.style.backgroundColor = "var(--accent-purple)";
              e.target.style.color = "var(--text-inverse)";
            }} onMouseLeave={e => {
              e.target.style.backgroundColor = "var(--accent-purple-surface)";
              e.target.style.color = "var(--accent-purple)";
            }}>
                    Search Existing Customer
                  </button>
                </div>}
            </DevLayoutSection>
          </DevLayoutSection>

          {/* ✅ Job Requests Section - Full Width */}
          <DevLayoutSection sectionKey="job-cards-create-job-requests" sectionType="section-shell" parentKey="job-cards-create-content" style={{
        padding: "var(--section-card-padding)",
        borderRadius: "var(--radius-md)",
        ...sectionCardStyle
      }}>
            <h3 style={{
          fontSize: "16px",
          fontWeight: "600",
          color: "var(--text-primary)",
          marginTop: 0,
          marginBottom: "16px"
        }}>
              Job Requests
            </h3>
            <div style={{
          maxHeight: "360px",
          overflowY: "auto",
          paddingRight: "4px",
          marginBottom: "12px"
        }}>
              {requests.map((req, i) => <DevLayoutSection key={`job-request-row-${i}`} sectionKey={`job-cards-create-job-request-${i + 1}`} sectionType="content-card" parentKey="job-cards-create-job-requests" style={{
            border: "none",
            borderRadius: "var(--radius-sm)",
            marginBottom: "10px",
            padding: "10px",
            backgroundColor: "var(--surface)"
          }}>
                  <div style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "var(--text-secondary)",
              marginBottom: "10px"
            }}>
                    Request {i + 1}
                  </div>
                  <div style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap"
            }}>
                    <RequestPresetAutosuggestInput value={req.text || ""} onChange={nextValue => handleRequestChange(i, nextValue)} onPresetSelect={preset => {
                const updated = [...requests];
                updated[i] = {
                  ...updated[i],
                  text: preset.label,
                  time: Number(preset.defaultHours) > 0 ? normalizeHoursToTwoDecimals(preset.defaultHours) : "",
                  presetId: preset.id,
                  selectedPresetLabel: preset.label
                };
                const detections = detectJobTypesForRequests(updated);
                setRequests(updated);
                setJobDetections(detections);
                setJobCategories(Array.from(new Set(detections.map(d => d.jobType))));
              }} placeholder="Enter job request (MOT, Service, Diagnostic)" containerStyle={{
                flex: "1 1 520px",
                minWidth: "320px"
              }} inputStyle={{
                width: "100%",
                padding: "10px 12px",
                border: "none",
                borderRadius: "var(--radius-xs)",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s",
                backgroundColor: "var(--accent-surface)"
              }} />
                    <div style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                width: "72px",
                flexShrink: 0
              }}>
                      <input type="number" min="0.00" step="0.01" value={req.time || ""} onChange={e => handleTimeChange(i, e.target.value)} placeholder="" className="app-input" style={{
                  width: "72px",
                  paddingRight: "24px"
                }} onBlur={e => {
                  const updated = [...requests];
                  updated[i].time = normalizeHoursToTwoDecimals(updated[i]?.time);
                  setRequests(updated);
                  persistPresetDefaultHours(updated[i]);
                }} />
                      <span style={{
                  pointerEvents: "none",
                  position: "absolute",
                  right: "9px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-secondary)",
                  fontSize: "var(--control-font-size)",
                  fontWeight: 700,
                  lineHeight: 1
                }}>
                        h
                      </span>
                    </div>
                    <DropdownField value={req.paymentType || "Customer"} onChange={e => handlePaymentTypeChange(i, e.target.value)} options={PAYMENT_TYPE_OPTIONS} className="job-request-payment-dropdown" />
                    {/* Open the Question Prompts helper for this specific
                        request row. Disabled when the request text is empty
                        so advisors don't hit it by mistake — an empty
                        request falls back to generic questions which aren't
                        as useful on a live call. */}
                    <button type="button" onClick={() => setQuestionPromptsIndex(i)} className="app-btn app-btn--secondary app-btn--sm" disabled={!String(req.text || "").trim()} title="Show suggested questions to ask the customer">
                      Question Prompts
                    </button>
                    <button type="button" onClick={() => handleRemoveRequest(i)} className="app-btn app-btn--danger app-btn--sm">
                      Remove
                    </button>
                  </div>
                </DevLayoutSection>)}
            </div>
            <button type="button" onClick={handleAddRequest} className="app-btn app-btn--primary">
              + Add Request
            </button>
          </DevLayoutSection>

          {/* ✅ Bottom Row: Cosmetic Damage, Add VHC, Full Car Details */}
          <DevLayoutSection sectionKey="job-cards-create-bottom-row" sectionType="section-shell" parentKey="job-cards-create-content" shell className="job-cards-create-bottom-row">
            <DevLayoutSection sectionKey="job-cards-create-cosmetic-damage" sectionType="content-card" parentKey="job-cards-create-bottom-row" className="job-cards-create-bottom-card" style={{
          padding: "var(--section-card-padding)",
          borderRadius: "var(--radius-md)",
          ...sectionCardStyle,
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
              <div className="job-cards-create-bottom-card-header" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "8px"
          }}>
                <h4 style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "var(--text-primary)",
              margin: 0
            }}>
                  Cosmetic Damage
                </h4>
                <div className="tab-api tab-api--inline" style={binaryToggleGroupStyle}>
                  {[true, false].map(choice => <button key={choice ? "yes" : "no"} onClick={() => setCosmeticDamagePresent(choice)} type="button" aria-pressed={cosmeticDamagePresent === choice} data-tone="default" className={`tab-api__item${cosmeticDamagePresent === choice ? " is-active" : ""}`} style={getBinaryToggleButtonStyle(cosmeticDamagePresent === choice)}>
                      {choice ? "Yes" : "No"}
                    </button>)}
                </div>
              </div>
              {cosmeticDamagePresent && <textarea value={cosmeticNotes} onChange={e => setCosmeticNotes(e.target.value)} placeholder="Describe any scratches, dents, or cosmetic damage..." className="cosmetic-notes-active" style={{
            width: "100%",
            height: "80px",
            padding: "10px 12px",
            border: "none",
            borderRadius: "var(--radius-xs)",
            resize: "none",
            fontFamily: "inherit",
            fontSize: "13px",
            outline: "none",
            transition: "border-color 0.2s",
            backgroundColor: "var(--surface)",
            color: "var(--text-primary)"
          }} onFocus={e => {
            e.target.style.borderColor = "var(--primary)";
          }} onBlur={e => {
            e.target.style.borderColor = "var(--surface-light)";
          }} />}
            </DevLayoutSection>
            <DevLayoutSection sectionKey="job-cards-create-wash" sectionType="content-card" parentKey="job-cards-create-bottom-row" className="job-cards-create-bottom-card" style={{
          padding: "var(--section-card-padding)",
          borderRadius: "var(--radius-md)",
          ...sectionCardStyle,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          justifyContent: "space-between"
        }}>
              <div className="job-cards-create-bottom-card-header" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px"
          }}>
                <h4 style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "var(--text-primary)",
              margin: 0
            }}>
                  Wash
                </h4>
                <div className="tab-api tab-api--inline" style={binaryToggleGroupStyle}>
                  {[true, false].map(choice => <button key={`wash-${choice ? "yes" : "no"}`} type="button" onClick={() => setWashRequired(choice)} aria-pressed={washRequired === choice} data-tone="default" className={`tab-api__item${washRequired === choice ? " is-active" : ""}`} style={getBinaryToggleButtonStyle(washRequired === choice)}>
                      {choice ? "Yes" : "No"}
                    </button>)}
                </div>
              </div>
            </DevLayoutSection>
            <DevLayoutSection sectionKey="job-cards-create-vhc-required" sectionType="content-card" parentKey="job-cards-create-bottom-row" className="job-cards-create-bottom-card" style={{
          padding: "var(--section-card-padding)",
          borderRadius: "var(--radius-md)",
          ...sectionCardStyle,
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
              <div className="job-cards-create-bottom-card-header" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px"
          }}>
                <h4 style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "var(--text-primary)",
              margin: 0
            }}>
                  VHC Required?
                </h4>
                <div className="tab-api tab-api--inline" style={binaryToggleGroupStyle}>
                  {[true, false].map(choice => <button key={`vhc-${choice ? "yes" : "no"}`} type="button" onClick={() => setVhcRequired(choice)} aria-pressed={vhcRequired === choice} data-tone="default" className={`tab-api__item${vhcRequired === choice ? " is-active" : ""}`} style={getBinaryToggleButtonStyle(vhcRequired === choice)}>
                      {choice ? "Yes" : "No"}
                    </button>)}
                </div>
              </div>
            </DevLayoutSection>
            <DevLayoutSection sectionKey="job-cards-create-documents" sectionType="content-card" parentKey="job-cards-create-bottom-row" className="job-cards-create-bottom-card" style={{
          padding: "var(--section-card-padding)",
          borderRadius: "var(--radius-md)",
          ...sectionCardStyle,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          justifyContent: "space-between"
        }}>
              <div className="job-cards-create-bottom-card-header" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px"
          }}>
                <h4 style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "var(--text-primary)",
              margin: 0
            }}>
                  Documents
                </h4>
                <button type="button" onClick={() => setShowDocumentsPopup(true)} style={{
              padding: "10px 18px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              backgroundColor: "var(--primary)",
              color: "white",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              transition: "background-color 0.2s, transform 0.2s"
            }} onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = "var(--primary-dark)";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
            }} onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "var(--primary)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.zIndex = "0";
            }}>
                  Manage Documents
                </button>
              </div>
            </DevLayoutSection>
          </DevLayoutSection>
        </DevLayoutSection>

        {showNewCustomer && <NewCustomerPopup onClose={() => setShowNewCustomer(false)} onSelect={c => handleCustomerSelect(c)} initialName={newCustomerPrefill} />}
        {showExistingCustomer && <ExistingCustomerPopup onClose={() => setShowExistingCustomer(false)} onSelect={c => handleCustomerSelect(c)} onCreateNew={prefill => {
      setNewCustomerPrefill(prefill);
      setShowExistingCustomer(false);
      setShowNewCustomer(true);
    }} />}

        <DocumentsUploadPopup open={showDocumentsPopup} onClose={() => setShowDocumentsPopup(false)} jobId={null} userId={dbUserId || null} onTempFilesQueued={captureTempUploadMetadata} existingDocuments={uploadedFiles.map(f => ({
      name: f.fileName,
      type: f.contentType,
      url: f.url || ""
    }))} />
        {/* Question Prompts popup — rendered once per page, opens for the
            request row whose index is stored in questionPromptsIndex. */}
        <QuestionPromptsPopup open={questionPromptsIndex !== null} onClose={() => setQuestionPromptsIndex(null)} requestText={questionPromptsIndex !== null ? String(requests?.[questionPromptsIndex]?.text || "") : ""} requestIndex={questionPromptsIndex} />
        {showDetectedRequestsPopup && <div style={popupOverlayStyles} onClick={event => {
      if (event.target === event.currentTarget) {
        setShowDetectedRequestsPopup(false);
      }
    }}>
            <div style={{
        ...popupCardStyles,
        width: "100%",
        maxWidth: "620px",
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
                  <button type="button" onClick={() => setShowDetectedRequestsPopup(false)} style={{
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
                  {populatedRequests.map(request => {
              const requestDetections = visibleJobDetections.filter(detection => Number(detection.requestIndex) === request.index);
              return <div key={`detected-request-popup-${request.index}`} style={{
                border: "none",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--surface-light)",
                padding: "14px 16px",
                display: "grid",
                gap: "10px"
              }}>
                        <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap"
                }}>
                          <span style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "var(--text-primary)"
                  }}>
                            Request {request.index + 1}
                          </span>
                          {requestDetections.length > 0 ? <div style={{
                    display: "flex",
                    gap: "6px",
                    flexWrap: "wrap",
                    justifyContent: "flex-end"
                  }}>
                              {requestDetections.map((detection, index) => <span key={`request-detection-${request.index}-${index}`} className="app-btn app-btn--secondary app-btn--xs app-btn--pill" style={{
                      pointerEvents: "none"
                    }}>
                                  {detection.jobType}
                                </span>)}
                            </div> : null}
                        </div>
                        <div style={{
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: "var(--text-primary)",
                  whiteSpace: "pre-wrap"
                }}>
                          {request.text}
                        </div>
                      </div>;
            })}
                </div>
              </div>
            </div>
          </div>}
      </DevLayoutSection>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
