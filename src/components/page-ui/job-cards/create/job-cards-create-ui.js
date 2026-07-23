// file location: src/components/page-ui/job-cards/create/job-cards-create-ui.js
import { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";
import PopupModal from "@/components/popups/popupStyleApi";

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
    jobSource,
    jobTabs,
    newCustomerPrefill,
    normalizeHoursToTwoDecimals,
    persistPresetDefaultHours,
    populatedRequests,
    primeJobData,
    questionPromptsIndex,
    removeJobTab,
    requests,
    router,
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

  const [moreRequestIndex, setMoreRequestIndex] = useState(null);
  const moreRequest = moreRequestIndex !== null ? requests?.[moreRequestIndex] : null;
  const updateRequestField = (index, field, value) => {
    const updated = [...requests];
    updated[index] = { ...updated[index], [field]: value };
    setRequests(updated);
  };
  const updateRequestPaymentType = (index, value) => {
    handlePaymentTypeChange(index, value);
    if (value === "Warranty") setJobSource("Warranty");
  };
  const moneyInputStyle = {
    width: "118px",
    flexShrink: 0
  };
  const yesNoToggleStyle = {
    flexWrap: "nowrap",
    minWidth: "max-content"
  };
  const yesNoButtonStyle = {
    flex: "1 1 0",
    minWidth: "64px"
  };
  const moreFieldStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0
  };
  const moreGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px"
  };

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <DevLayoutSection sectionKey="job-cards-create-page-shell" sectionType="page-shell" shell widthMode="page" style={{
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: 0,
    overflow: "hidden"
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
              return <button key={option.id} type="button" role="tab" onClick={() => setActiveTabIndex(option.index)} aria-selected={isActive} data-tone="default" className={`tab-api__item${isActive ? " is-active" : ""}`}>
                      {option.label}
                    </button>;
            })}
                {!isSubJobMode && <button type="button" onClick={addNewJobTab} data-tone="default" className="tab-api__item job-cards-create-add-linked-button" title="Add another linked job">
                    +
                  </button>}
              </div>

              {!isSubJobMode && hasLinkedJobCards && <Button type="button" onClick={() => removeJobTab(activeTabIndex)} variant="ghost" size="sm" pill className="job-cards-create-remove-linked-button">
                  Remove selected
                </Button>}
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
                </span> : <Button type="button" onClick={() => setShowDetectedRequestsPopup(true)} variant="secondary" size="sm" pill style={{
            width: "100%",
            justifyContent: "center"
          }}>
                  <strong style={{ whiteSpace: "nowrap" }}>
                    Request 1
                  </strong>
                  <span style={{
              minWidth: 0,
              flex: "0 1 auto",
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
                  {populatedRequests.length > 1 ? <span className="app-badge app-badge--accent-soft" style={{
              flexShrink: 0
            }}>
                      +{populatedRequests.length - 1} more
                    </span> : null}
                </Button>}
            </div>
          </div>
          <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap"
      }}>
            {/* Job Source Badge */}
            <span className={`app-badge app-badge--control ${jobSource === "Warranty" ? "app-badge--warning" : "app-badge--success"}`}>
              {jobSource}
            </span>
            <Button type="button" data-presentation="create-submit" onClick={handleSaveJob}>
              {jobTabs.length > 1 ? `Save ${jobTabs.length} Jobs` : "Save Job Card"}
            </Button>
          </div>
        </DevLayoutSection>

        {/* ✅ Sub-job Mode Banner */}
        {isSubJobMode && primeJobData && <LayerTheme sectionKey="job-cards-create-subjob-banner" sectionType="status-banner" parentKey="job-cards-create-page-shell" padding="12px 16px" radius="var(--radius-xs)" style={{
      marginBottom: "8px",
      flexDirection: "row",
      alignItems: "center",
      gap: "12px"
    }}>
            <span style={{
        fontSize: "18px"
      }}>🔗</span>
            <div style={{
        flex: 1
      }}>
              <strong>
                Creating sub-job linked to Job {primeJobData.jobNumber}
              </strong>
              <span style={{
          marginLeft: "12px"
        }}>
                Customer and vehicle details are inherited from the prime job
              </span>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/job-cards/${primeJobData.jobNumber}`)}>
              View Prime Job
            </Button>
          </LayerTheme>}

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
            <LayerTheme sectionKey="job-cards-create-job-information" sectionType="content-card" parentKey="job-cards-create-top-row" radius="var(--radius-md)" gap="16px" style={{
          flex: "1 1 260px",
          minWidth: 0,
          minHeight: "420px",
          boxSizing: "border-box",
          overflowY: "auto"
        }}>
              <div style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: "12px",
            paddingBottom: "12px"
          }}>
                <div style={{
              minWidth: 0
            }}>
                  <h3>
                    Job Information
                  </h3>
                </div>
              </div>

              <div style={{
            display: "grid",
            gap: "12px"
          }}>
                <div>
                  <label>
                    Customer Status
                  </label>
                  <div className="tab-api tab-api--wrap">
                    {["Waiting", "Loan Car", "Collection", "Neither"].map(status => <button key={status} type="button" aria-pressed={waitingStatus === status} data-tone="default" className={`tab-api__item${waitingStatus === status ? " is-active" : ""}`} onClick={() => setWaitingStatus(status)}>
                        {status}
                      </button>)}
                  </div>
                </div>

                <div>
                  <label>
                    Job Source
                  </label>
                  <div className="tab-api tab-api--wrap">
                    {["Retail", "Warranty"].map(src => <button key={src} type="button" aria-pressed={jobSource === src} data-tone="default" className={`tab-api__item${jobSource === src ? " is-active" : ""}`} onClick={() => setJobSource(src)}>
                        {src}
                      </button>)}
                  </div>
                </div>

                {/* Mobile Mechanic eligibility — evaluates the current
                    customer + vehicle + detected job types and exposes a
                    Yes/No toggle gated by the eligibility verdict.
                    Customer postcode drives a drive-time lookup inside the
                    component; no extra API wiring is needed here. */}
                <MobileMechanicEligibility customer={customerForm} vehicle={vehicle} jobDetections={jobDetections} jobCategories={jobCategories} isMobileMechanic={isMobileMechanic} onSelectionChange={setIsMobileMechanic} />
              </div>
            </LayerTheme>

            {/* Vehicle Details Section - responsive, min 260px. Outer ref div hosts the ResizeObserver target; inner LayerTheme paints the surface. */}
            <div ref={vehicleSectionRef} style={{ flex: "1 1 260px", minWidth: 0, display: "flex" }}>
            <LayerTheme sectionKey="job-cards-create-vehicle-details" sectionType="content-card" parentKey="job-cards-create-top-row" radius="var(--radius-md)" gap="16px" style={{
          flex: "1 1 auto",
          minWidth: 0,
          minHeight: "420px",
          boxSizing: "border-box",
          overflowY: "auto"
        }}>
              <h3>
                Vehicle Details
                {isSubJobMode && <span className="app-badge app-badge--accent-soft" style={{ marginLeft: "8px" }}>
                    Inherited
                  </span>}
              </h3>

              {vehicleNotification && <StatusMessage tone={vehicleNotification.type === "success" ? "success" : "danger"} style={{
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
                  <span>{vehicleNotification.message}</span>
                  <Button type="button" variant="ghost" size="xs" className="app-btn--icon" onClick={() => setVehicleNotification(null)} style={{
              marginLeft: "auto"
            }} aria-label="Dismiss vehicle notification">
                    ×
                  </Button>
                </StatusMessage>}

              <div style={{
            marginBottom: "16px"
          }}>
                <label htmlFor="vehicle-registration">
                  Registration Number
                </label>
                <div style={{
              display: "flex",
              gap: "12px",
              alignItems: "center"
            }}>
                  <input id="vehicle-registration" type="text" value={vehicle.reg} onChange={e => setVehicle({
                ...vehicle,
                reg: e.target.value
              })} placeholder="e.g. AB12 CDE" className="app-input" style={{ flex: 1 }} />
                  <Button type="button" data-presentation="create-reg-lookup" onClick={handleFetchVehicleData} busy={isLoadingVehicle}>
                    {isLoadingVehicle ? "Loading..." : "Search"}
                  </Button>
                </div>
              </div>

              {error && <StatusMessage tone="danger">
                  {error}
                </StatusMessage>}

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
                      <label htmlFor={`vehicle-${key}`}>
                        {labelMap[key]}
                      </label>
                      <input id={`vehicle-${key}`} className="app-input" value={vehicle[key] || "Not available"} readOnly />
                    </div>;
            })}

                <div>
                  <label htmlFor="vehicle-mileage">
                    Current Mileage
                  </label>
                  <input id="vehicle-mileage" type="number" value={vehicle.mileage} onChange={e => setVehicle({
                ...vehicle,
                mileage: e.target.value
              })} placeholder="Enter mileage" className="app-input" />
                </div>
              </div>
            </LayerTheme>
            </div>

            {/* Customer Details Section - responsive, min 260px */}
            <LayerTheme sectionKey="job-cards-create-customer-details" sectionType="content-card" parentKey="job-cards-create-top-row" radius="var(--radius-md)" gap="16px" style={{
          flex: "1 1 260px",
          minWidth: 0,
          minHeight: "420px",
          boxSizing: "border-box",
          overflowY: "auto"
        }}>
              <h3>
                Customer Details
                {isSubJobMode && <span className="app-badge app-badge--accent-soft" style={{ marginLeft: "8px" }}>
                    Inherited
                  </span>}
              </h3>

              {customerNotification && <StatusMessage tone={customerNotification.type === "success" ? "success" : "danger"} style={{
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
                  <span>{customerNotification.message}</span>
                  <Button type="button" variant="ghost" size="xs" className="app-btn--icon" onClick={() => setCustomerNotification(null)} style={{
              marginLeft: "auto"
            }} aria-label="Dismiss customer notification">
                    ×
                  </Button>
                </StatusMessage>}

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
                          <label htmlFor={input.type === "multi-select" ? undefined : `customer-${input.field}`}>
                            {input.label}
                          </label>
                          {input.type === "textarea" ? <textarea id={`customer-${input.field}`} value={customerForm[input.field] || ""} onChange={e => handleCustomerFieldChange(input.field, e.target.value)} disabled={!isCustomerEditing || isSavingCustomer} placeholder={input.placeholder} rows={3} className="app-input app-input--textarea" /> : input.type === "multi-select" ? <div style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  width: "100%"
                }}>
                              {["phone", "email", "sms"].map(pref => {
                    const active = Array.isArray(customerForm.contactPreference) && customerForm.contactPreference.includes(pref);
                    return <Button key={pref} type="button" variant="secondary" size="sm" className={active ? "is-active" : ""} aria-pressed={active} onClick={() => toggleContactPreference(pref)}>
                                     {pref === "sms" ? "SMS" : pref.charAt(0).toUpperCase() + pref.slice(1)}
                                   </Button>;
                  })}
                            </div> : <input id={`customer-${input.field}`} type={input.type} value={customerForm[input.field] || ""} onChange={e => handleCustomerFieldChange(input.field, e.target.value)} disabled={!isCustomerEditing || isSavingCustomer} placeholder={input.placeholder} className="app-input" />}
                        </div>)}
                    </div> : <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "8px"
            }}>
                      {customerFieldDefinitions.filter(input => input.field !== "contactPreference").map(input => <div key={input.field} style={{
                gridColumn: input.field === "firstName" || input.field === "lastName" || input.field === "mobile" || input.field === "telephone" ? "auto" : "1 / -1",
                minWidth: 0
              }}>
                            <label htmlFor={`customer-readonly-${input.field}`}>
                              {input.label}
                            </label>
                            <input id={`customer-readonly-${input.field}`} className="app-input" value={customerForm[input.field] || "Not provided"} readOnly />
                          </div>)}
                    </div>}

                  <div style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap"
            }}>
                    {isCustomerEditing ? <>
                        <Button type="button" onClick={handleSaveCustomerEdits} busy={isSavingCustomer} style={{
                  flex: 1
                }}>
                          {isSavingCustomer ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={handleCancelCustomerEdit} disabled={isSavingCustomer} style={{
                  flex: 1
                }}>
                          Cancel
                        </Button>
                      </> : <>
                        <Button type="button" variant="secondary" onClick={handleStartCustomerEdit} style={{
                  width: "100%",
                  maxWidth: "320px",
                  alignSelf: "center"
                }}>
                          Edit Customer
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setCustomer(null)} disabled={isSavingCustomer} style={{
                  width: "100%",
                  maxWidth: "320px",
                  alignSelf: "center"
                }}>
                          Clear Customer
                        </Button>
                      </>}
                  </div>

                  {isCustomerEditing && <Button type="button" variant="ghost" onClick={() => setCustomer(null)} disabled={isSavingCustomer} style={{
              width: "100%",
              maxWidth: "320px",
              alignSelf: "center"
            }}>
                      Clear Customer
                    </Button>}
                </div> : <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            alignItems: "center"
          }}>
                  <Button type="button" onClick={() => setShowNewCustomer(true)} style={{
              width: "100%",
              maxWidth: "320px"
            }}>
                    New Customer
                  </Button>
                  <Button type="button" data-presentation="create-customer-lookup" variant="secondary" onClick={() => setShowExistingCustomer(true)} style={{
              width: "100%",
              maxWidth: "320px"
            }}>
                    Search Existing Customer
                  </Button>
                </div>}
            </LayerTheme>
          </DevLayoutSection>

          {/* ✅ Job Requests Section - Full Width */}
          <LayerTheme sectionKey="job-cards-create-job-requests" sectionType="section-shell" parentKey="job-cards-create-content" radius="var(--radius-md)">
            <h3>
              Job Requests
            </h3>
            <div style={{
          maxHeight: "360px",
          overflowY: "auto",
          paddingRight: "4px",
          marginBottom: "12px"
        }}>
              {requests.map((req, i) => <LayerSurface key={`job-request-row-${i}`} sectionKey={`job-cards-create-job-request-${i + 1}`} sectionType="content-card" parentKey="job-cards-create-job-requests" radius="var(--radius-sm)" padding="10px" style={{
            marginBottom: "10px"
          }}>
                  <strong style={{ marginBottom: "10px" }}>
                    Request {i + 1}
                  </strong>
                  <div style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "nowrap",
              overflowX: "auto",
              paddingBottom: "2px"
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
                flex: "1 1 auto",
                minWidth: "280px"
              }} />
                    <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                width: "72px",
                flexShrink: 0
              }}>
                      <input type="number" min="0.00" step="0.01" value={req.time || ""} onChange={e => handleTimeChange(i, e.target.value)} placeholder="" className="app-input" style={{
                  width: "52px"
                }} onBlur={() => {
                  const updated = [...requests];
                  updated[i].time = normalizeHoursToTwoDecimals(updated[i]?.time);
                  setRequests(updated);
                  persistPresetDefaultHours(updated[i]);
                }} />
                      <span style={{
                  pointerEvents: "none",
                  flexShrink: 0
                }}>
                        h
                      </span>
                    </div>
                    <input type="number" min="0" step="0.01" value={req.setPrice ?? req.price ?? ""} onChange={e => updateRequestField(i, "setPrice", e.target.value)} placeholder="Cost" aria-label={`Request ${i + 1} cost`} className="app-input" style={moneyInputStyle} />
                    {/* Open the Question Prompts helper for this specific
                        request row. Disabled when the request text is empty
                        so advisors don't hit it by mistake — an empty
                        request falls back to generic questions which aren't
                        as useful on a live call. */}
                    <Button type="button" variant="secondary" size="sm" onClick={() => setQuestionPromptsIndex(i)} disabled={!String(req.text || "").trim()} title="Show suggested questions to ask the customer">
                      Question Prompts
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setMoreRequestIndex(i)}>
                      More
                    </Button>
                  </div>
                </LayerSurface>)}
            </div>
            <Button type="button" variant="secondary" onClick={handleAddRequest}>
              + Add Request
            </Button>
          </LayerTheme>

          {/* ✅ Bottom Row: Cosmetic Damage, Add VHC, Full Car Details */}
          <DevLayoutSection sectionKey="job-cards-create-bottom-row" sectionType="section-shell" parentKey="job-cards-create-content" shell className="job-cards-create-bottom-row">
            <LayerTheme sectionKey="job-cards-create-cosmetic-damage" sectionType="content-card" parentKey="job-cards-create-bottom-row" className="job-cards-create-bottom-card" radius="var(--radius-md)" gap="12px">
              <div className="job-cards-create-bottom-card-header" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "8px"
          }}>
                <h4>
                  Cosmetic Damage
                </h4>
                <div className="tab-api" style={yesNoToggleStyle}>
                  {[true, false].map(choice => <button key={choice ? "yes" : "no"} onClick={() => setCosmeticDamagePresent(choice)} type="button" aria-pressed={cosmeticDamagePresent === choice} data-tone="default" className={`tab-api__item${cosmeticDamagePresent === choice ? " is-active" : ""}`} style={yesNoButtonStyle}>
                      {choice ? "Yes" : "No"}
                    </button>)}
                </div>
              </div>
              {cosmeticDamagePresent && <textarea value={cosmeticNotes} onChange={e => setCosmeticNotes(e.target.value)} placeholder="Describe any scratches, dents, or cosmetic damage..." className="app-input app-input--textarea cosmetic-notes-active" />}
            </LayerTheme>
            <LayerTheme sectionKey="job-cards-create-wash" sectionType="content-card" parentKey="job-cards-create-bottom-row" className="job-cards-create-bottom-card" radius="var(--radius-md)" gap="12px" style={{
          justifyContent: "space-between"
        }}>
              <div className="job-cards-create-bottom-card-header" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px"
          }}>
                <h4>
                  Wash
                </h4>
                <div className="tab-api" style={yesNoToggleStyle}>
                  {[true, false].map(choice => <button key={`wash-${choice ? "yes" : "no"}`} type="button" onClick={() => setWashRequired(choice)} aria-pressed={washRequired === choice} data-tone="default" className={`tab-api__item${washRequired === choice ? " is-active" : ""}`} style={yesNoButtonStyle}>
                      {choice ? "Yes" : "No"}
                    </button>)}
                </div>
              </div>
            </LayerTheme>
            <LayerTheme sectionKey="job-cards-create-vhc-required" sectionType="content-card" parentKey="job-cards-create-bottom-row" className="job-cards-create-bottom-card" radius="var(--radius-md)" gap="12px">
              <div className="job-cards-create-bottom-card-header" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px"
          }}>
                <h4>
                  VHC Required?
                </h4>
                <div className="tab-api" style={yesNoToggleStyle}>
                  {[true, false].map(choice => <button key={`vhc-${choice ? "yes" : "no"}`} type="button" onClick={() => setVhcRequired(choice)} aria-pressed={vhcRequired === choice} data-tone="default" className={`tab-api__item${vhcRequired === choice ? " is-active" : ""}`} style={yesNoButtonStyle}>
                      {choice ? "Yes" : "No"}
                    </button>)}
                </div>
              </div>
            </LayerTheme>
            <LayerTheme sectionKey="job-cards-create-documents" sectionType="content-card" parentKey="job-cards-create-bottom-row" className="job-cards-create-bottom-card" radius="var(--radius-md)" gap="12px" style={{
          justifyContent: "space-between"
        }}>
              <div className="job-cards-create-bottom-card-header" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px"
          }}>
                <h4>
                  Documents
                </h4>
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowDocumentsPopup(true)}>
                  Manage Documents
                </Button>
              </div>
            </LayerTheme>
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
        {moreRequestIndex !== null && moreRequest && <PopupModal
          isOpen
          onClose={() => setMoreRequestIndex(null)}
          ariaLabel={`Request ${moreRequestIndex + 1} details`}
          cardStyle={{
        width: "100%",
        maxWidth: "760px"
      }}>
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="app-popup-compact-header">
                  <h3>Request {moreRequestIndex + 1} Details</h3>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setMoreRequestIndex(null)}>Close</Button>
                </div>
                <div style={moreFieldStyle}>
                  <label>Request Description</label>
                  <textarea value={moreRequest.text || ""} onChange={e => handleRequestChange(moreRequestIndex, e.target.value)} className="app-input app-input--textarea" />
                </div>
                <div style={moreGridStyle}>
                  <div style={moreFieldStyle}>
                    <label>Labour Time</label>
                    <input type="number" min="0" step="0.01" value={moreRequest.time || ""} onChange={e => handleTimeChange(moreRequestIndex, e.target.value)} onBlur={() => {
                const updated = [...requests];
                updated[moreRequestIndex].time = normalizeHoursToTwoDecimals(updated[moreRequestIndex]?.time);
                setRequests(updated);
                persistPresetDefaultHours(updated[moreRequestIndex]);
              }} className="app-input" />
                  </div>
                  <div style={moreFieldStyle}>
                    <label>Labour Price</label>
                    <input type="number" min="0" step="0.01" value={moreRequest.labourPrice || ""} onChange={e => updateRequestField(moreRequestIndex, "labourPrice", e.target.value)} className="app-input" />
                  </div>
                  <div style={moreFieldStyle}>
                    <label>Menu Price</label>
                    <input type="number" min="0" step="0.01" value={moreRequest.menuPrice || ""} onChange={e => updateRequestField(moreRequestIndex, "menuPrice", e.target.value)} className="app-input" />
                  </div>
                  <div style={moreFieldStyle}>
                    <label>Set Price</label>
                    <input type="number" min="0" step="0.01" value={moreRequest.setPrice || ""} onChange={e => updateRequestField(moreRequestIndex, "setPrice", e.target.value)} className="app-input" />
                  </div>
                  <div style={moreFieldStyle}>
                    <label>Discount</label>
                    <input type="number" min="0" step="0.01" value={moreRequest.discount || ""} onChange={e => updateRequestField(moreRequestIndex, "discount", e.target.value)} className="app-input" />
                  </div>
                  <div style={moreFieldStyle}>
                    <label>Account Type</label>
                    <DropdownField value={moreRequest.paymentType || "Customer"} onChange={e => updateRequestPaymentType(moreRequestIndex, e.target.value)} options={PAYMENT_TYPE_OPTIONS} className="job-request-payment-dropdown" />
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "44px" }}>
                  <input type="checkbox" className="app-toggle app-toggle--checkbox" checked={Boolean(moreRequest.specialRate)} onChange={e => updateRequestField(moreRequestIndex, "specialRate", e.target.checked)} />
                  Special labour rate
                </label>
                <div style={moreFieldStyle}>
                  <label>Internal Notes</label>
                  <textarea value={moreRequest.noteText || ""} onChange={e => updateRequestField(moreRequestIndex, "noteText", e.target.value)} className="app-input app-input--textarea" />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <Button type="button" variant="danger" onClick={() => {
                handleRemoveRequest(moreRequestIndex);
                setMoreRequestIndex(null);
              }}>Remove Request</Button>
                  <Button type="button" onClick={() => setMoreRequestIndex(null)}>Done</Button>
                </div>
              </div>
          </PopupModal>}
        {showDetectedRequestsPopup && <PopupModal
          isOpen
          onClose={() => setShowDetectedRequestsPopup(false)}
          ariaLabel="Detected job requests"
          cardStyle={{
        width: "100%",
        maxWidth: "620px"
      }}>
              <div style={{
          padding: "28px"
        }}>
                <div className="app-popup-compact-header">
                  <h3>
                    Job Requests
                  </h3>
                  <Button type="button" variant="ghost" size="xs" className="app-btn--icon" onClick={() => setShowDetectedRequestsPopup(false)} aria-label="Close job requests popup">
                    ×
                  </Button>
                </div>

                <div style={{
            display: "grid",
            gap: "10px"
          }}>
                  {populatedRequests.map(request => {
              const requestDetections = visibleJobDetections.filter(detection => Number(detection.requestIndex) === request.index);
              return <LayerTheme key={`detected-request-popup-${request.index}`} radius="var(--radius-sm)" padding="14px 16px" style={{
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
                          <strong>
                            Request {request.index + 1}
                          </strong>
                          {requestDetections.length > 0 ? <div style={{
                    display: "flex",
                    gap: "6px",
                    flexWrap: "wrap",
                    justifyContent: "flex-end"
                  }}>
                              {requestDetections.map((detection, index) => <span key={`request-detection-${request.index}-${index}`} className="app-badge app-badge--accent-soft">
                                  {detection.jobType}
                                </span>)}
                            </div> : null}
                        </div>
                        <div style={{ whiteSpace: "pre-wrap" }}>
                          {request.text}
                        </div>
                      </LayerTheme>;
            })}
                </div>
              </div>
          </PopupModal>}
      </DevLayoutSection>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
