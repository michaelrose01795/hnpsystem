// file location: src/components/page-ui/appointments/appointments-ui.js

export default function AppointmentsUi(props) {
  const {
    CALENDAR_SEVERITY_STYLES,
    DEFAULT_RETAIL_TECH_COUNT,
    DEFAULT_RETAIL_TECH_HOURS,
    DropdownField,
    Popup,
    SATURDAY_SEVERITY_STYLES,
    SearchBar,
    checkingInJobId,
    currentNote,
    dates,
    formatDate,
    formatDateNoYear,
    getBookingSeverity,
    getCustomerStatusBadgeColors,
    getDayTechSummary,
    getDetectedJobTypeLabels,
    getEstimatedFinishTime,
    getJobCounts,
    getJobGroupBadge,
    getJobTypeBadgeStyle,
    getVehicleDisplay,
    handleAddAppointment,
    handleCheckIn,
    handleJobNumberInputChange,
    handleJobRowClick,
    handleJobRowHover,
    handleShowStaffOff,
    highlightJob,
    isCompactMobile,
    isJobActuallyCheckedIn,
    isLoading,
    isSameDate,
    jobNumber,
    saveNote,
    searchQuery,
    selectedDay,
    setCurrentNote,
    setSearchQuery,
    setSelectedDay,
    setShowNotePopup,
    setShowStaffOffPopup,
    setTime,
    showNotePopup,
    showStaffOffPopup,
    sortedJobs,
    staffAbsences,
    staffOffPopupDate,
    staffOffPopupDetails,
    time,
    timeSlots,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div className="app-page-stack" style={{
    height: "100%"
  }}>

        {/* Top Bar */}
        <div id="appointments-auto-content-card-2" data-dev-section-key="appointments-auto-content-card-2" data-dev-section-type="content-card" className="app-section-card" style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: "10px",
      padding: "10px",
      alignItems: "center",
      overflowX: "hidden",
      backgroundColor: "var(--theme)",
      boxShadow: "none"
    }}>
          <div style={{
        minWidth: 0
      }}>
            <SearchBar value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onClear={() => setSearchQuery("")} placeholder="Search by Job #, Name, Reg, or Vehicle..." disabled={isLoading} style={{
          width: "100%",
          minHeight: "var(--control-height-sm)",
          padding: "var(--control-padding-sm)",
          borderRadius: "var(--control-radius-sm)"
        }} />
          </div>
            <input type="text" value={jobNumber} onChange={handleJobNumberInputChange} placeholder="Job Number" disabled={isLoading} style={{
        width: "100%",
        minHeight: "var(--control-height-sm)",
        padding: "var(--control-padding-sm)",
        borderRadius: "var(--control-radius-sm)"
      }} />
            <DropdownField value={time} onChange={e => setTime(e.target.value)} disabled={isLoading} placeholder="Select time" style={{
        width: "100%"
      }} size="sm">
              {timeSlots.map(slot => <option key={slot} value={slot}>
                  {slot}
                </option>)}
            </DropdownField>
            <button onClick={() => handleAddAppointment(selectedDay.toISOString().split("T")[0])} disabled={isLoading} style={{
        width: "100%",
        minHeight: "var(--control-height-sm)",
        backgroundColor: isLoading ? "var(--surface)" : "var(--primary)",
        color: "white",
        border: "none",
        borderRadius: "var(--control-radius-sm)",
        cursor: isLoading ? "not-allowed" : "pointer",
        fontWeight: "600",
        fontSize: "var(--control-font-size)",
        whiteSpace: "nowrap",
        transition: "background-color 0.2s"
      }} onMouseEnter={e => {
        if (isLoading) return;
        const isDarkTheme = document?.documentElement?.getAttribute("data-theme") === "dark";
        e.currentTarget.style.backgroundColor = isDarkTheme ? "var(--primary-selected)" : "var(--danger)";
      }} onMouseLeave={e => !isLoading && (e.currentTarget.style.backgroundColor = "var(--primary)")}>
              {isLoading ? "Booking..." : "Book Appointment"}
            </button>
        </div>

        {/* Calendar Table Container — mirrors the .app-table-shell-* visual design inline so this table can be edited freely without fighting global !important rules. data-app-table-shell="off" opts the table out of the GlobalTableShells auto-classifier. */}
        {/* Outer wrapper owns the card visuals (border, radius, surface fallback) and clips the rounded corners. The inner scroller is transparent and gutter-free so row backgrounds paint behind the scrollbar thumb instead of being cut off by a reserved gutter. */}
        <div data-dev-section-key="appointments-auto-data-table-2-shell" data-dev-section-type="section-shell" style={{
      flex: "1 1 auto",
      minHeight: 0,
      marginBottom: "12px",
      display: "flex",
      flexDirection: "column",
      borderRadius: "var(--radius-md)",
      border: "1px solid rgba(var(--accent-purple-rgb, 122, 92, 250), 0.12)",
      background: "var(--surface)",
      overflow: "hidden"
    }}>
          <div className="appointments-calendar-table-scroll" style={{
        flex: "1 1 auto",
        minHeight: 0,
        maxHeight: "418px",
        overflowY: "auto",
        overflowX: "hidden",
        background: "transparent"
      }}>
            <table id="appointments-auto-data-table-2" data-dev-section-key="appointments-auto-data-table-2" data-dev-section-type="data-table" data-app-table-shell="off" style={{
          width: "100%",
          minWidth: "100%",
          tableLayout: "fixed",
          color: "var(--text-1)",
          background: "var(--surface)",
          borderCollapse: "separate",
          borderSpacing: 0
        }}>
              <colgroup>
                <col style={{
              width: "15%"
            }} />
                <col style={{
              width: "19%"
            }} />
                <col style={{
              width: "8%"
            }} />
                <col style={{
              width: "7%"
            }} />
                <col style={{
              width: "9%"
            }} />
                <col style={{
              width: "9%"
            }} />
                <col style={{
              width: "7%"
            }} />
                <col style={{
              width: "10%"
            }} />
                <col style={{
              width: "8%"
            }} />
                <col style={{
              width: "8%"
            }} />
              </colgroup>
              <thead data-dev-section-key="appointments-auto-data-table-2-headings" data-dev-section-type="table-headings" data-dev-section-parent="appointments-auto-data-table-2" style={{
            position: "sticky",
            top: 0,
            zIndex: 1
          }}>
                <tr>
                  {[{
                label: "Date",
                align: "left"
              }, {
                label: "Availability",
                align: "left"
              }, {
                label: "Hours",
                align: "center"
              }, {
                label: "Jobs",
                align: "center"
              }, {
                label: "Finish",
                align: "center"
              }, {
                label: "Services",
                align: "center"
              }, {
                label: "MOT",
                align: "center"
              }, {
                label: "Diagnosis",
                align: "center"
              }, {
                label: "Other",
                align: "center"
              }, {
                label: "Staff Off",
                align: "center"
              }].map(({
                label,
                align
              }, idx, arr) => <th key={label} style={{
                textAlign: align,
                whiteSpace: "nowrap",
                padding: idx === 0 ? "12px 10px 12px 14px" : idx === arr.length - 1 ? "12px 14px 12px 10px" : "12px 10px",
                background: "var(--page-shell-bg)",
                color: "var(--text-1)",
                fontSize: "0.72rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                lineHeight: 1.2,
                borderBottom: "none"
              }}>
                      {label}
                    </th>)}
                </tr>
              </thead>
              <tbody data-dev-section-key="appointments-auto-data-table-2-rows" data-dev-section-type="table-rows" data-dev-section-parent="appointments-auto-data-table-2">
                {dates.map((date, index) => {
              const dateKey = date.toDateString();
              const counts = getJobCounts(date);
              const staffEntries = staffAbsences[dateKey] || [];
              const isSelected = selectedDay.toDateString() === dateKey;
              const dayTechSummary = getDayTechSummary(date);
              const bookedHours = parseFloat(counts.totalHours) || 0;
              const totalAvailableHours = dayTechSummary.totalAvailableHours ?? DEFAULT_RETAIL_TECH_COUNT * DEFAULT_RETAIL_TECH_HOURS;
              const bookingPercent = totalAvailableHours > 0 ? bookedHours / totalAvailableHours * 100 : 0;
              const severity = getBookingSeverity(bookingPercent);
              const isWeekendSaturday = date.getDay() === 6;
              const severityStyleSource = isWeekendSaturday ? SATURDAY_SEVERITY_STYLES : CALENDAR_SEVERITY_STYLES;
              const severityStyle = severityStyleSource[severity];
              const isCalmDay = severity === "green" || !severityStyle;
              const isToday = isSameDate(date, new Date());
              const severityBorderLeft = !isCalmDay && severityStyle?.borderColor ? `4px solid ${severityStyle.borderColor}` : "4px solid var(--success)";
              const bookingPercentDisplay = Number.isFinite(bookingPercent) ? bookingPercent.toFixed(0) : "0";
              const availabilityLabelColor = isCalmDay ? "var(--success-dark)" : severityStyle?.textColor || "var(--text-1)";

              // Row background — alternating like the global .app-table-shell--with-headings, with overrides for Saturday / selected / today.
              let rowBg = "var(--surface)";
              if (isWeekendSaturday) rowBg = "var(--warning-surface)";
              if (isSelected) rowBg = "rgba(var(--primary-rgb), 0.25)";
              if (isToday) rowBg = "var(--success-surface)";
              if (isSelected && isWeekendSaturday) rowBg = "var(--warning-text)";
              if (isSelected && isToday) rowBg = "var(--success-text)";

              // Shared cell padding rhythm (12px 10px, with first/last getting 14px outer padding) — matches global table feel.
              const tdBase = {
                padding: "12px 10px",
                borderTop: index === 0 ? "none" : "1px solid rgba(var(--accent-purple-rgb, 122, 92, 250), 0.12)",
                fontSize: "0.85rem",
                lineHeight: 1.35,
                verticalAlign: "middle"
              };
              const tdFirst = { ...tdBase, paddingLeft: "14px" };
              const tdLast = { ...tdBase, paddingRight: "14px" };

              return <tr key={dateKey} className={[isWeekendSaturday ? "appt-sat-row" : "", isToday ? "appt-today-row" : "", isSelected ? "appt-selected-row" : ""].filter(Boolean).join(" ") || undefined} onClick={() => setSelectedDay(date)} style={{
                cursor: "pointer",
                backgroundColor: rowBg,
                transition: "background-color 0.2s ease"
              }}>
                    <td style={{
                  ...tdFirst,
                  borderLeft: severityBorderLeft,
                  fontWeight: isSelected ? "700" : "600"
                }}>
                      <span style={{
                    color: "var(--accent-strong)",
                    whiteSpace: "nowrap"
                  }}>{formatDate(date)}</span>
                    </td>
                    <td style={tdBase}>
                      <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap"
                  }}>
                        <span style={{
                      fontWeight: "700",
                      color: availabilityLabelColor
                    }}>
                          {dayTechSummary.availableTechs} tech{dayTechSummary.availableTechs !== 1 ? "s" : ""}
                        </span>
                        <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-pill)",
                      background: isCalmDay ? "rgba(var(--success-rgb), 0.15)" : severityStyle.backgroundColor,
                      color: availabilityLabelColor,
                      fontSize: "11px",
                      fontWeight: "700"
                    }}>
                          {bookingPercentDisplay}%
                        </span>
                      </div>
                    </td>
                    <td style={{
                  ...tdBase,
                  color: counts.totalHours > 0 ? "var(--text-1)" : "var(--grey-accent-light)",
                  fontWeight: counts.totalHours > 0 ? "700" : "500",
                  whiteSpace: "nowrap",
                  textAlign: "center"
                }}>
                      {counts.totalHours}h
                    </td>
                    <td style={{
                  ...tdBase,
                  fontWeight: counts.totalJobs > 0 ? "700" : "500",
                  textAlign: "center"
                }}>
                      {counts.totalJobs}
                    </td>
                    <td style={{
                  ...tdBase,
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                  textAlign: "center"
                }}>
                      {counts.finishTime || "-"}
                    </td>
                    <td style={{
                  ...tdBase,
                  textAlign: "center",
                  fontWeight: counts.services > 0 ? "700" : "500"
                }}>
                      {counts.services || "-"}
                    </td>
                    <td style={{
                  ...tdBase,
                  textAlign: "center",
                  fontWeight: counts.mot > 0 ? "700" : "500"
                }}>
                      {counts.mot || "-"}
                    </td>
                    <td style={{
                  ...tdBase,
                  textAlign: "center",
                  fontWeight: counts.diagnosis > 0 ? "700" : "500"
                }}>
                      {counts.diagnosis || "-"}
                    </td>
                    <td style={{
                  ...tdBase,
                  textAlign: "center",
                  fontWeight: counts.other > 0 ? "700" : "500"
                }}>
                      {counts.other || "-"}
                    </td>
                    <td style={{
                  ...tdLast,
                  textAlign: "center"
                }}>
                      {staffEntries.length > 0 ? <span role="button" tabIndex={0} onClick={event => handleShowStaffOff(event, date, staffEntries)} onKeyDown={e => e.key === "Enter" && handleShowStaffOff(e, date, staffEntries)} style={{
                    cursor: "pointer",
                    fontWeight: "700",
                    color: "var(--danger)"
                  }}>
                          {staffEntries.length}
                        </span> : "-"}
                    </td>
                  </tr>;
            })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Jobs for Selected Day Section */}
        <div className="app-page-card" style={{
      flex: "0 0 40%",
      marginBottom: "8px",
      padding: "16px",
      overflowY: "auto",
      background: "var(--theme)"
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
          fontWeight: "600"
        }}>
              Jobs for <span style={{
            color: "var(--primary)"
          }}>{formatDateNoYear(selectedDay)}</span>
            </h3>
            <span style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "6px 12px",
          backgroundColor: "var(--surface)",
          borderRadius: "var(--radius-xs)",
          border: "none",
          fontSize: "13px",
          fontWeight: "700",
          color: "var(--text-1)"
        }}>
              {sortedJobs.length} job{sortedJobs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* ✅ Enhanced Jobs Table — always shown (toggle removed) */}
          <div style={{
          overflowX: "auto",
          border: "var(--control-border)",
          borderRadius: "var(--radius-md)",
          background: "var(--theme)"
        }}>
                <table id="appointments-auto-data-table-3" data-dev-section-key="appointments-auto-data-table-3" data-dev-section-type="data-table" style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: "13px",
            backgroundColor: "transparent"
          }}>
              <thead data-dev-section-key="appointments-auto-data-table-3-headings" data-dev-section-type="table-headings" data-dev-section-parent="appointments-auto-data-table-3" style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              background: "var(--theme-hover)"
            }}>
                <tr>
                {["Time", "Job #", "Reg", "Vehicle", "Customer", "Job Type", "Customer Status", "EST Time", "Check-In"].map(head => <th key={head} style={{
                  textAlign: head === "Check-In" ? "center" : "left",
                  padding: "12px 14px",
                  background: "var(--theme-hover)",
                  color: "var(--text-1)",
                  fontWeight: "700",
                  fontSize: "11px",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  borderBottom: "1px solid rgba(var(--accent-base-rgb), 0.18)",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  whiteSpace: "nowrap"
                }}>
                      {head}
                    </th>)}
                </tr>
              </thead>
              <tbody data-dev-section-key="appointments-auto-data-table-3-rows" data-dev-section-type="table-rows" data-dev-section-parent="appointments-auto-data-table-3">
                {sortedJobs.length > 0 ? sortedJobs.map((job, idx) => {
                const isCheckedIn = isJobActuallyCheckedIn(job);
                const isCurrentlyCheckingIn = checkingInJobId === job.id;
                const cellBorder = "1px solid rgba(var(--accent-base-rgb), 0.12)";
                const rowBackground = highlightJob === job.jobNumber ? "var(--success-surface)" : idx % 2 === 0 ? "var(--section-card-bg)" : "rgba(var(--accent-base-rgb), 0.035)";
                return <tr key={idx} style={{
                  backgroundColor: rowBackground,
                  transition: "background-color 0.2s ease"
                }} onMouseEnter={e => {
                  if (highlightJob !== job.jobNumber) {
                    e.currentTarget.style.backgroundColor = "var(--theme-hover)";
                  }
                }} onMouseLeave={e => {
                  if (highlightJob !== job.jobNumber) {
                    e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "var(--section-card-bg)" : "rgba(var(--accent-base-rgb), 0.035)";
                  }
                }}>
                        <td style={{
                    padding: "12px 14px",
                    borderBottom: cellBorder,
                    fontWeight: "700",
                    whiteSpace: "nowrap"
                  }}>
                          {job.appointment?.time || "-"}
                        </td>
                        <td style={{
                    padding: "12px 14px",
                    borderBottom: cellBorder,
                    color: "var(--primary)",
                    fontWeight: "700"
                  }}>
                          <button type="button" onClick={() => handleJobRowClick(job.jobNumber || job.id)} onMouseEnter={() => handleJobRowHover(job.jobNumber || job.id)} style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      minHeight: 0,
                      borderRadius: "var(--radius-xs)",
                      background: "var(--theme)",
                      border: "none",
                      color: "var(--primary)",
                      fontWeight: "700",
                      fontSize: "inherit",
                      cursor: "pointer"
                    }}>
                            <span>{job.jobNumber || job.id || "-"}</span>
                            {(() => {
                        const badge = getJobGroupBadge(job);
                        if (!badge) return null;
                        return <span style={{
                          fontSize: "10px",
                          padding: "2px 6px",
                          borderRadius: "var(--radius-xs)",
                          backgroundColor: "var(--theme)",
                          color: "var(--accent-strong)",
                          fontWeight: "700",
                          whiteSpace: "nowrap"
                        }} title={job.isPrimeJob ? `Host job (${badge} job cards)` : `Job ${badge} — linked to host #${job.primeJobNumber}`}>
                                  {badge} Job Cards
                                </span>;
                      })()}
                          </button>
                        </td>
                        <td style={{
                    padding: "12px 14px",
                    borderBottom: cellBorder,
                    fontWeight: "600",
                    whiteSpace: "nowrap"
                  }}>
                          {job.reg || "-"}
                        </td>
                        <td style={{
                    padding: "12px 14px",
                    borderBottom: cellBorder
                  }}>
                          {getVehicleDisplay(job)}
                        </td>
                        <td style={{
                    padding: "12px 14px",
                    borderBottom: cellBorder
                  }}>
                          {job.customer || "-"}
                        </td>
                        <td style={{
                    padding: "12px 14px",
                    borderBottom: cellBorder
                  }}>
                          <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px",
                      maxHeight: "52px",
                      overflowY: "auto"
                    }}>
                            {Array.from(getDetectedJobTypeLabels(job)).filter(Boolean).map(label => <span key={label} style={{
                          ...getJobTypeBadgeStyle(label),
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "6px 12px",
                          borderRadius: "var(--radius-xs)",
                          border: "none",
                          fontWeight: "700"
                        }}>
                                {label}
                              </span>)}
                          </div>
                        </td>
                        <td style={{
                    padding: "12px 14px",
                    borderBottom: cellBorder
                  }}>
                          <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "6px 12px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "700",
                      ...getCustomerStatusBadgeColors(job.waitingStatus || "Neither")
                    }}>
                            {job.waitingStatus || "Neither"}
                          </span>
                        </td>
                        <td style={{
                    padding: "12px 14px",
                    borderBottom: cellBorder,
                    fontWeight: "700",
                    whiteSpace: "nowrap"
                  }}>
                          {getEstimatedFinishTime(job)}
                        </td>
                        <td style={{
                    padding: "12px 14px",
                    borderBottom: cellBorder,
                    textAlign: "center"
                  }}>
                          {isCheckedIn ? <span style={{
                      padding: isCompactMobile ? "8px 12px" : "8px 16px",
                      minWidth: isCompactMobile ? "90px" : "110px",
                      textAlign: "center",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: "700",
                      lineHeight: "1",
                      display: "inline-block",
                      backgroundColor: "var(--success-surface)",
                      color: "var(--success-dark)"
                    }}>
                              {isCompactMobile ? "Checked In" : "✓ Checked In"}
                            </span> : <button onClick={event => {
                      event.stopPropagation();
                      handleCheckIn(job);
                    }} disabled={isCurrentlyCheckingIn} style={{
                      padding: isCompactMobile ? "8px 12px" : "8px 16px",
                      minWidth: isCompactMobile ? "90px" : "110px",
                      minHeight: "unset",
                      backgroundColor: isCurrentlyCheckingIn ? "var(--surface)" : "var(--primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "var(--radius-xs)",
                      cursor: isCurrentlyCheckingIn ? "not-allowed" : "pointer",
                      fontSize: "13px",
                      fontWeight: "700",
                      lineHeight: "1",
                      transition: "background-color 0.2s"
                    }} onMouseEnter={e => {
                      if (!isCurrentlyCheckingIn) {
                        e.currentTarget.style.backgroundColor = "var(--primary-selected)";
                      }
                    }} onMouseLeave={e => {
                      if (!isCurrentlyCheckingIn) {
                        e.currentTarget.style.backgroundColor = "var(--primary)";
                      }
                    }}>
                              {isCurrentlyCheckingIn ? "Checking In..." : "Check In"}
                            </button>}
                        </td>
                      </tr>;
              }) : <tr>
                    <td colSpan="9" style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "var(--grey-accent-light)",
                  fontSize: "14px",
                  background: "var(--section-card-bg)"
                }}>
                      No appointments booked for this day
                    </td>
                  </tr>}
              </tbody>
            </table>
          </div>
        </div>
        {/* Add Note Popup */}
        <Popup isOpen={showNotePopup} onClose={() => setShowNotePopup(false)}>
          <h3 style={{
        marginTop: 0,
        marginBottom: "16px",
        fontSize: "20px",
        fontWeight: "600"
      }}>
            Add Note for {formatDateNoYear(selectedDay)}
          </h3>
          <textarea style={{
        width: "100%",
        height: "120px",
        padding: "12px",
        borderRadius: "var(--radius-xs)",
        border: "none",
        fontSize: "14px",
        fontFamily: "inherit",
        resize: "vertical",
        outline: "none"
      }} value={currentNote} onChange={e => setCurrentNote(e.target.value)} placeholder="Enter notes about this day's schedule..." onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "var(--surface)"} />
          <div style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: "16px",
        gap: "10px"
      }}>
            <button onClick={saveNote} style={{
          flex: 1,
          padding: "10px 20px",
          backgroundColor: "var(--primary)",
          color: "white",
          border: "none",
          borderRadius: "var(--radius-xs)",
          cursor: "pointer",
          fontWeight: "600",
          fontSize: "14px",
          transition: "background-color 0.2s"
        }} onMouseEnter={e => e.target.style.backgroundColor = "var(--danger)"} onMouseLeave={e => e.target.style.backgroundColor = "var(--primary)"}>
              Save Note
            </button>
            <button onClick={() => setShowNotePopup(false)} style={{
          flex: 1,
          padding: "10px 20px",
          backgroundColor: "var(--grey-accent)",
          color: "white",
          border: "none",
          borderRadius: "var(--radius-xs)",
          cursor: "pointer",
          fontWeight: "600",
          fontSize: "14px",
          transition: "background-color 0.2s"
        }} onMouseEnter={e => e.target.style.backgroundColor = "var(--grey-accent-dark)"} onMouseLeave={e => e.target.style.backgroundColor = "var(--grey-accent)"}>
              Cancel
            </button>
          </div>
        </Popup>
        {/* Staff Off Popup */}
        <Popup isOpen={showStaffOffPopup} onClose={() => setShowStaffOffPopup(false)}>
          <div style={{
        width: "260px"
      }}>
          {/* Header */}
          <div style={{
          marginBottom: "18px",
          paddingBottom: "14px",
          borderBottom: "var(--control-border)"
        }}>
            <h3 style={{
            margin: "0 0 8px",
            fontSize: "16px",
            fontWeight: "700",
            color: "var(--text-1)"
          }}>
              Staff Off
            </h3>
            <span style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 10px",
            borderRadius: "var(--radius-pill)",
            background: "var(--theme)",
            color: "var(--accent-strong)",
            fontSize: "12px",
            fontWeight: "600"
          }}>
              {formatDate(staffOffPopupDate || selectedDay)}
            </span>
          </div>

          {/* Entry list */}
          {staffOffPopupDetails.length > 0 ? <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          maxHeight: "calc(5 * 58px)",
          overflowY: "auto"
        }}>
              {staffOffPopupDetails.map((entry, index) => {
            const typeLower = (entry.type || "").toLowerCase();
            const typeColor = typeLower.includes("sick") ? {
              bg: "var(--warning-surface)",
              text: "var(--warning)"
            } : typeLower.includes("holiday") || typeLower.includes("annual") ? {
              bg: "var(--success-surface)",
              text: "var(--success-dark)"
            } : {
              bg: "var(--theme)",
              text: "var(--text-1)"
            };
            const initial = (entry.name || "?").charAt(0).toUpperCase();
            return <div key={`${entry.id}-${index}`} style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--section-card-bg)",
              border: "var(--control-border)"
            }}>
                    {/* Avatar initial */}
                    <div style={{
                flexShrink: 0,
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "var(--theme)",
                color: "var(--accent-strong)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "14px"
              }}>
                      {initial}
                    </div>

                    {/* Name + role */}
                    <div style={{
                flex: 1,
                minWidth: 0
              }}>
                      <div style={{
                  fontWeight: "600",
                  fontSize: "14px",
                  color: "var(--text-1)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}>
                        {entry.name}
                      </div>
                      <div style={{
                  fontSize: "11px",
                  color: "var(--text-1)",
                  marginTop: "2px"
                }}>
                        {entry.role}
                      </div>
                    </div>

                    {/* Type badge + hours */}
                    <div style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "4px"
              }}>
                      <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-pill)",
                  background: typeColor.bg,
                  color: typeColor.text,
                  fontSize: "11px",
                  fontWeight: "700",
                  whiteSpace: "nowrap"
                }}>
                        {entry.type || "Holiday"}
                      </span>
                      {entry.unavailableHours != null && <span style={{
                  fontSize: "11px",
                  color: "var(--text-1)"
                }}>
                          {entry.unavailableHours}h off
                        </span>}
                    </div>
                  </div>;
          })}
            </div> : <div style={{
          padding: "32px 16px",
          textAlign: "center",
          color: "var(--text-1)",
          fontSize: "13px"
        }}>
              <div style={{
            fontSize: "20px",
            marginBottom: "8px",
            color: "var(--grey-accent-light)",
            fontWeight: "300"
          }}>—</div>
              No approved absences for this day
            </div>}
          </div>
        </Popup>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
