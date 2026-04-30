// file location: src/components/page-ui/clocking/clocking-technician-slug-ui.js

export default function UserClockingHistoryUi(props) {
  const {
    CalendarField,
    ClockingHistorySection,
    DropdownField,
    PageContainer,
    PageWrapper,
    STATUS_BADGE_STYLES,
    STATUS_STATES,
    TimePickerField,
    activeJobs,
    activeJobsLoading,
    badgeBaseStyle,
    basePanelStyle,
    buttonPrimaryStyle,
    buttonSecondaryStyle,
    clockInDate,
    clockOutDate,
    deriveStatus,
    entries,
    error,
    formError,
    formFinishTime,
    formJobNumber,
    formStartTime,
    formSubmitting,
    formSuccess,
    formatDuration,
    formatTime,
    handleJobNumberChange,
    handleManualEntrySubmit,
    historyRefreshSignal,
    inputStyle,
    isManager,
    lastClockedJobId,
    lastClockedJobNumber,
    loading,
    managerBadgeStyle,
    requestOptions,
    selectedJobLockedMessage,
    selectedRequest,
    setClockInDate,
    setClockOutDate,
    setFormError,
    setFormFinishTime,
    setFormJobNumber,
    setFormStartTime,
    setFormSuccess,
    setJobRequests,
    setSelectedJobId,
    setSelectedJobLockedMessage,
    setSelectedRequest,
    tableCellStyle,
    tableHeaderStyle,
    tableStyle,
    tableWrapperStyle,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <PageWrapper>
        <PageContainer>
          <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px"
      }}>
          {error && <div style={{
          borderRadius: "var(--radius-md)",
          border: "none",
          background: "var(--surface)",
          padding: "14px 18px",
          color: "var(--danger-dark)",
          fontSize: "0.9rem"
        }}>
              {error}
            </div>}

          <section id="live-technician-activity" style={basePanelStyle}>
            <div style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center"
          }}>
              <div>
                <h2 style={{
                margin: 0,
                fontSize: "1.25rem",
                color: "var(--text-1)"
              }}>
                  Live technician activity
                </h2>
              </div>
              <span style={{
              ...badgeBaseStyle,
              background: "var(--surface)",
              border: "none",
              color: "var(--success-dark)"
            }}>
                {loading ? "Refreshing…" : "Live"}
              </span>
            </div>

            <div style={tableWrapperStyle}>
              <div style={{
              maxHeight: "520px",
              overflowY: "auto"
            }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={tableHeaderStyle}>Status</th>
                      <th style={tableHeaderStyle}>Job Number</th>
                      <th style={tableHeaderStyle}>Start</th>
                      <th style={tableHeaderStyle}>Finish</th>
                      <th style={tableHeaderStyle}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 && !loading ? <tr>
                        <td colSpan={5} style={{
                      ...tableCellStyle,
                      textAlign: "center",
                      fontSize: "0.85rem",
                      color: "var(--grey-accent)"
                    }}>
                          No clocking entries recorded yet for today.
                        </td>
                      </tr> : entries.map(record => {
                    const status = deriveStatus(record);
                    const chipStyle = STATUS_BADGE_STYLES[status];
                    return <tr key={record.id}>
                            <td style={tableCellStyle}>
                              <span style={{
                          ...badgeBaseStyle,
                          padding: "6px 14px",
                          fontSize: "0.7rem",
                          ...(chipStyle || {
                            background: "var(--surface)",
                            border: "none",
                            color: "var(--grey-accent)"
                          })
                        }}>
                                {STATUS_STATES.includes(status) ? status : "Waiting for Job"}
                              </span>
                            </td>
                            <td style={{
                        ...tableCellStyle,
                        fontWeight: 600
                      }}>{record.job_number || "—"}</td>
                            <td style={tableCellStyle}>{formatTime(record.clock_in)}</td>
                            <td style={tableCellStyle}>{formatTime(record.clock_out)}</td>
                            <td style={tableCellStyle}>{formatDuration(record.clock_in, record.clock_out)}</td>
                          </tr>;
                  })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {isManager && <section style={basePanelStyle}>
              <header style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center"
          }}>
                <div>
                  <h2 style={{
                margin: 0,
                fontSize: "1.2rem",
                color: "var(--text-1)"
              }}>
                    Manual clocking entry
                  </h2>
                </div>
                <span style={managerBadgeStyle}>
                  {activeJobsLoading ? "Fetching jobs…" : `${activeJobs.length} active jobs`}
                </span>
              </header>

              {formError && <div style={{
            borderRadius: "var(--radius-md)",
            border: "none",
            background: "var(--surface)",
            padding: "12px 14px",
            color: "var(--danger-dark)",
            fontSize: "0.9rem"
          }}>
                  {formError}
                </div>}
              {selectedJobLockedMessage && !formError && <div style={{
            borderRadius: "var(--radius-md)",
            border: "none",
            background: "var(--surface)",
            padding: "12px 14px",
            color: "var(--warning-dark)",
            fontSize: "0.9rem"
          }}>
                  {selectedJobLockedMessage}
                </div>}
              {formSuccess && <div style={{
            borderRadius: "var(--radius-md)",
            border: "none",
            background: "var(--surface)",
            padding: "12px 14px",
            color: "var(--success-dark)",
            fontSize: "0.9rem"
          }}>
                  {formSuccess}
                </div>}

              <form style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px"
          }} onSubmit={handleManualEntrySubmit}>
                {/* Row 1: Clock-in date, Clock-out date, Clock-in time, Clock-out time */}
                <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px"
            }}>
                  <CalendarField id="clockInDate" label="Clock-in date" value={clockInDate} onChange={event => {
                setClockInDate(event.target.value);
                // Auto-set clock-out date to match clock-in date
                if (!clockOutDate || clockOutDate < event.target.value) {
                  setClockOutDate(event.target.value);
                }
              }} required />
                  <CalendarField id="clockOutDate" label="Clock-out date" value={clockOutDate} onChange={event => setClockOutDate(event.target.value)} required />
                  <TimePickerField id="startTime" label="Clock-in time" value={formStartTime} onChange={event => setFormStartTime(event.target.value)} required style={inputStyle} />
                  <TimePickerField id="finishTime" label="Clock-out time" value={formFinishTime} onChange={event => setFormFinishTime(event.target.value)} required style={inputStyle} />
                </div>

                {/* Row 2: Job number, Request selector */}
                <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "16px"
            }}>
                  <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}>
                    <label htmlFor="jobNumber" style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "var(--grey-accent)"
                }}>
                      Job number
                    </label>
                    <input id="jobNumber" type="text" value={formJobNumber} onChange={event => handleJobNumberChange(event.target.value)} placeholder="Enter job number" style={inputStyle} />
                  </div>
                  <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}>
                    <label htmlFor="requestSelector" style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "var(--grey-accent)"
                }}>
                      Job / Request
                    </label>
                    <DropdownField id="requestSelector" placeholder="Select job or request" options={requestOptions} value={selectedRequest} onChange={event => setSelectedRequest(event.target.value)} disabled={!formJobNumber || Boolean(selectedJobLockedMessage)} required style={{
                  width: "100%"
                }} />
                  </div>
                </div>

                <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px"
            }}>
                  <button type="submit" disabled={formSubmitting || Boolean(selectedJobLockedMessage)} style={{
                ...buttonPrimaryStyle,
                opacity: formSubmitting || selectedJobLockedMessage ? 0.7 : 1,
                cursor: formSubmitting || selectedJobLockedMessage ? "not-allowed" : "pointer"
              }}>
                    {formSubmitting ? "Saving entry…" : "Save clocking entry"}
                  </button>
                  <button type="button" onClick={() => {
                setFormJobNumber("");
                setSelectedJobId(null);
                setSelectedJobLockedMessage("");
                setSelectedRequest("job");
                setJobRequests([]);
                setClockInDate(new Date().toISOString().split("T")[0]);
                setClockOutDate(new Date().toISOString().split("T")[0]);
                setFormStartTime("");
                setFormFinishTime("");
                setFormError("");
                setFormSuccess("");
              }} style={buttonSecondaryStyle}>
                    Reset form
                  </button>
                </div>
              </form>
            </section>}

          {isManager && lastClockedJobId && lastClockedJobNumber && <ClockingHistorySection jobId={lastClockedJobId} jobNumber={lastClockedJobNumber} requests={[]} jobAllocatedHours={null} refreshSignal={historyRefreshSignal} enableRequestClick={false} title="Clocking history" />}
          </div>
        </PageContainer>
      </PageWrapper>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
