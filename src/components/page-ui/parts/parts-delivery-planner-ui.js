// file location: src/components/page-ui/parts/parts-delivery-planner-ui.js

export default function PartsDeliveryPlannerPageUi(props) {
  const {
    DeliveryJobModal,
    closeJobModal,
    collectionDetailsSectionStyle,
    collectionError,
    collectionListScrollStyle,
    collectionLoadTokens,
    collectionLoading,
    collectionPlannerGridStyle,
    collectionSearchMessage,
    collectionSearchSuccess,
    collectionSearchTerm,
    collectionSummaries,
    collectionTableScrollStyle,
    collectionTableSectionStyle,
    computeFuelCost,
    customerName,
    dateOptions,
    dayCardStyle,
    editingJobId,
    error,
    filteredRunsByDate,
    formatCurrency,
    formatDate,
    formatShortDate,
    formatTime,
    handleCollectionSearch,
    handleDeleteJob,
    handleInvoiceSelected,
    handleSaveJob,
    handleSelectCollectionDate,
    invoiceQuery,
    invoiceResults,
    invoiceSearchLoading,
    isSameCalendarDay,
    jobForm,
    jobModalError,
    jobModalOpen,
    jobModalSaving,
    jobQueueByDate,
    jobRowButtonStyle,
    jobStatusLabel,
    jobsError,
    jobsLoading,
    loading,
    openJobModal,
    paidPillStyle,
    plannerTab,
    plannerTabButton,
    priceLabel,
    queueCardStyle,
    queueDayStyle,
    router,
    runRowStyle,
    runs,
    searchHighlightDate,
    sectionStyle,
    selectedCollectionDate,
    selectedCollectionJobs,
    selectedCollectionQuantity,
    selectedCollectionWindow,
    selectedDate,
    setCollectionSearchMessage,
    setCollectionSearchSuccess,
    setCollectionSearchTerm,
    setInvoiceQuery,
    setPlannerTab,
    setSearchHighlightDate,
    setSelectedDate,
    statusChipStyle,
    todayKey,
    totalFuel,
    totalMileage,
    updateJobForm,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div style={{
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "22px"
  }}>
        <header className="app-section-card" style={sectionStyle}>
          <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px"
      }}>
            <div style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap"
        }}>
              <button type="button" onClick={() => setPlannerTab("delivery")} style={plannerTabButton(plannerTab === "delivery")}>
                Delivery planner
              </button>
              <button type="button" onClick={() => setPlannerTab("collection")} style={plannerTabButton(plannerTab === "collection")}>
                Collection planner
              </button>
            </div>
            <button type="button" onClick={() => openJobModal()} style={{
          borderRadius: "var(--radius-sm)",
          padding: "10px 18px",
          border: "none",
          background: "var(--primary)",
          color: "var(--surface)",
          fontWeight: 600,
          cursor: "pointer"
        }}>
              Create parts order
            </button>
          </div>
          {plannerTab === "delivery" && <>
              <div style={{
          marginTop: "8px",
          display: "flex",
          gap: "16px",
          flexWrap: "wrap"
        }}>
                <div>
                  <div style={{
              fontSize: "0.75rem",
              color: "var(--primary-dark)"
            }}>Upcoming runs</div>
                  <strong style={{
              fontSize: "1.6rem"
            }}>{runs.length}</strong>
                </div>
                <div>
                  <div style={{
              fontSize: "0.75rem",
              color: "var(--primary-dark)"
            }}>Total mileage</div>
                  <strong style={{
              fontSize: "1.6rem"
            }}>{totalMileage} km</strong>
                </div>
                <div>
                  <div style={{
              fontSize: "0.75rem",
              color: "var(--primary-dark)"
            }}>Fuel estimate</div>
                  <strong style={{
              fontSize: "1.6rem"
            }}>{formatCurrency(totalFuel)}</strong>
                </div>
              </div>
              <div style={{
          color: "var(--info-dark)",
          fontSize: "0.85rem",
          marginTop: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px"
        }}>
                <span>Fuel rate: {priceLabel}</span>
              </div>
            </>}
        </header>

        {plannerTab === "delivery" ? <>
            <section className="app-section-card" style={queueCardStyle}>
              <div>
                <p style={{
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--info-dark)",
            fontSize: "0.8rem"
          }}>
                  Invoice deliveries
                </p>
                <h2 style={{
            margin: "6px 0 0",
            color: "var(--primary-dark)"
          }}>Scheduled drop offs</h2>
                <p style={{
            margin: "4px 0 0",
            color: "var(--grey-accent-dark)"
          }}>
                  Click a job to review invoice details, payment status, and confirm the delivery date.
                </p>
              </div>
              <div style={{
          marginTop: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "14px"
        }}>
                {jobsLoading ? <p style={{
            color: "var(--info)",
            margin: 0
          }}>Loading scheduled deliveries…</p> : jobsError ? <p style={{
            color: "var(--danger)",
            margin: 0
          }}>{jobsError}</p> : jobQueueByDate.length === 0 ? <p style={{
            color: "var(--info)",
            margin: 0
          }}>
                    No invoice deliveries scheduled yet. Add a job to get started.
                  </p> : jobQueueByDate.map(([date, jobs]) => <div key={date} style={queueDayStyle}>
                      <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
                        <strong style={{
                color: "var(--primary-dark)"
              }}>
                          {date === "unscheduled" ? "Date not set" : formatDate(date)}
                        </strong>
                        <span style={{
                color: "var(--info-dark)",
                fontSize: "0.85rem"
              }}>
                          {jobs.length} job{jobs.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}>
                        {jobs.map(job => {
                const jobItems = Array.isArray(job.items) ? job.items : [];
                const qty = job.quantity || jobItems.reduce((total, item) => total + (Number(item.quantity) || 0), 0) || 1;
                const paidLabel = job.is_paid ? "Paid" : "Awaiting payment";
                return <button key={job.id} type="button" style={{
                  ...jobRowButtonStyle,
                  borderColor: "transparent",
                  background: job.status === "completed" ? "rgba(var(--success-rgb,34,139,34),0.08)" : jobRowButtonStyle.background
                }} onClick={() => openJobModal(job)}>
                              <div style={{
                    flex: "1 1 auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}>
                                <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap"
                    }}>
                                  <span style={{
                        fontWeight: 600,
                        color: "var(--primary-dark)"
                      }}>
                                    {job.invoice_number || job.job_id || "Invoice"}
                                  </span>
                                  <span style={paidPillStyle(job.is_paid)}>{paidLabel}</span>
                                </div>
                                <div style={{
                      fontSize: "0.9rem",
                      color: "var(--info-dark)"
                    }}>
                                  {job.customer_name || customerName(job.customer)} ·{" "}
                                  {job.address || job.customer?.address || "Address pending"}
                                </div>
                                <div style={{
                      fontWeight: 600,
                      color: "var(--primary-dark)"
                    }}>
                                  {job.part_name || "Parts order"} · Qty {qty}
                                </div>
                                <div style={{
                      fontSize: "0.85rem",
                      color: "var(--grey-accent-dark)"
                    }}>
                                  {jobItems.length > 0 ? jobItems.slice(0, 2).map(item => `${item.description} x${item.quantity || 1}`).join(" · ") : job.notes || "Items from invoice"}
                                </div>
                              </div>
                              <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    alignItems: "flex-end"
                  }}>
                                <span style={{
                      fontSize: "0.85rem",
                      color: "var(--info-dark)"
                    }}>
                                  {formatCurrency(job.total_price)}
                                </span>
                                <span style={statusChipStyle(job.status)}>{jobStatusLabel(job.status)}</span>
                              </div>
                            </button>;
              })}
                      </div>
                    </div>)}
              </div>
            </section>

            <section className="app-section-card" style={sectionStyle}>
              <div style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px"
        }}>
                <label style={{
            fontSize: "0.85rem",
            color: "var(--info-dark)"
          }}>
                  <span style={{
              display: "block",
              fontWeight: 600,
              marginBottom: "4px"
            }}>Filter by day</span>
                  <select value={selectedDate} onChange={event => setSelectedDate(event.target.value)} style={{
              padding: "8px 10px",
              borderRadius: "var(--radius-xs)",
              border: "none",
              fontSize: "0.9rem",
              color: "var(--primary-dark)"
            }}>
                    <option value="">All days</option>
                    {dateOptions.map(option => <option key={option.value} value={option.value}>
                        {option.label}
                      </option>)}
                  </select>
                </label>
                {selectedDate && <button type="button" onClick={() => setSelectedDate("")} style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-pill)",
            border: "none",
            background: "var(--danger-surface)",
            color: "var(--primary-dark)",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer"
          }}>
                    Clear day filter
                  </button>}
              </div>
              {loading ? <p style={{
          color: "var(--info)",
          margin: 0
        }}>Loading delivery runs…</p> : error ? <p style={{
          color: "var(--primary)",
          margin: 0
        }}>{error}</p> : filteredRunsByDate.length === 0 ? <p style={{
          margin: 0,
          color: "var(--info)"
        }}>
                  {selectedDate ? `No delivery runs scheduled for ${formatDate(selectedDate)}.` : "No delivery runs scheduled yet."}
                </p> : filteredRunsByDate.map(([date, items]) => {
          const dayMileage = items.reduce((total, item) => total + (Number(item.mileage) || 0), 0);
          const dayFuel = items.reduce((total, item) => total + (Number(item.fuel_cost) || computeFuelCost(item)), 0);
          const dayDrops = items.reduce((total, item) => total + (item.stops_count || 1), 0);
          const status = items[0]?.status?.replace(/_/g, " ") || "Planned";
          const cardLabel = date === "unscheduled" ? "Unscheduled" : formatDate(date);
          return <div key={`${date}-${status}`} style={dayCardStyle}>
                      <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
                        <div>
                          <h3 style={{
                  margin: 0,
                  color: "var(--primary-dark)"
                }}>{cardLabel}</h3>
                          <p style={{
                  margin: "4px 0 0",
                  color: "var(--grey-accent-dark)"
                }}>
                            {items.length} run{items.length === 1 ? "" : "s"} · {dayMileage} km ·{" "}
                            {formatCurrency(dayFuel)} · {dayDrops} drop{dayDrops === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--primary-dark)",
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}>
                          {status}
                        </span>
                      </div>
                      <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}>
                        {items.map(run => {
                const customer = run.customer;
                const jobNumber = run.job?.job_number || `#${run.job_id}`;
                const address = run.destination_address || customer?.address || run.customer?.name || "Address TBC";
                const fuelExpense = Number(run.fuel_cost) || computeFuelCost(run);
                return <article key={run.id} style={runRowStyle}>
                              <div>
                                <div style={{
                      fontWeight: 600,
                      color: "var(--primary-dark)"
                    }}>{jobNumber}</div>
                                <div style={{
                      fontSize: "0.9rem",
                      color: "var(--info-dark)"
                    }}>
                                  {customerName(customer)} · {address}
                                </div>
                                {run.notes ? <p style={{
                      margin: "6px 0 0",
                      fontSize: "0.8rem",
                      color: "var(--info)"
                    }}>
                                    {run.notes}
                                  </p> : null}
                              </div>
                              <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    fontSize: "0.85rem"
                  }}>
                                <div>
                                  <strong>Departure:</strong> {formatTime(run.time_leave)}
                                </div>
                                <div>
                                  <strong>Arrival:</strong> {formatTime(run.time_arrive)}
                                </div>
                                <div>
                                  <strong>Stops:</strong> {run.stops_count || 1}
                                </div>
                                <div>
                                  <strong>Mileage:</strong> {run.mileage ?? 0} km
                                </div>
                                <div>
                                  <strong>Fuel:</strong> {formatCurrency(fuelExpense)}
                                </div>
                              </div>
                            </article>;
              })}
                      </div>
                    </div>;
        })}
            </section>
          </> : <section style={collectionPlannerGridStyle}>
            <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}>
              <form onSubmit={handleCollectionSearch} style={{
          width: "100%"
        }}>
                <label style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
                  <div style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap"
            }}>
                    <input type="text" value={collectionSearchTerm} onChange={event => {
                const {
                  value
                } = event.target;
                setCollectionSearchTerm(value);
                setCollectionSearchSuccess(false);
                if (value.trim()) {
                  setCollectionSearchMessage("");
                } else {
                  setSearchHighlightDate("");
                  setCollectionSearchMessage("");
                }
              }} placeholder="Enter customer name, order number, or invoice reference" style={{
                flex: "1 1 260px",
                minWidth: "220px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                padding: "10px 12px",
                fontSize: "1rem"
              }} />
                    <button type="submit" style={{
                borderRadius: "var(--radius-sm)",
                padding: "10px 18px",
                border: "1px solid var(--primary)",
                background: "var(--primary)",
                color: "var(--surface)",
                fontWeight: 600,
                cursor: "pointer"
              }}>
                      Find booking
                    </button>
                  </div>
                </label>
              </form>
              {collectionSearchMessage && <p style={{
          margin: 0,
          color: collectionSearchSuccess ? "var(--success, #297C3B)" : "var(--danger)",
          fontWeight: 600
        }}>
                  {collectionSearchMessage}
                </p>}
            </div>
            <div style={collectionTableSectionStyle}>
              {collectionError ? <div style={{
          padding: "18px",
          color: "var(--danger)"
        }}>{collectionError}</div> : collectionLoading ? <div style={{
          padding: "18px",
          color: "var(--info)"
        }}>Loading collection schedule…</div> : <div style={{
          ...collectionTableScrollStyle,
          overflowX: "auto"
        }}>
                  <table style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "640px"
          }}>
                    <thead>
                      <tr style={{
                background: "var(--surface)",
                borderBottom: "2px solid var(--surface-light)"
              }}>
                        {["Day / Date", "Collections", "Total parts", "Earliest slot", "Load"].map(heading => <th key={heading} style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  fontSize: "0.8rem",
                  letterSpacing: "0.05em",
                  color: "var(--info-dark)",
                  textTransform: "uppercase"
                }}>
                            {heading}
                          </th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {collectionSummaries.map(summary => {
                const tone = collectionLoadTokens[summary.status] || collectionLoadTokens.light;
                const isSelected = summary.date === selectedCollectionDate;
                const isToday = isSameCalendarDay(summary.date, todayKey);
                const isSearchHighlight = Boolean(searchHighlightDate && summary.date === searchHighlightDate);
                const background = isSearchHighlight ? "rgba(var(--success-rgb,34,139,34),0.18)" : isSelected ? "rgba(var(--primary-rgb),0.12)" : isToday ? "rgba(var(--primary-rgb),0.05)" : tone.background;
                const outline = isSearchHighlight ? "0 0 0 2px rgba(var(--success-rgb,34,139,34),0.4) inset" : isSelected ? "0 0 0 2px rgba(var(--primary-rgb),0.4) inset" : "none";
                return <tr key={summary.date} onClick={() => handleSelectCollectionDate(summary.date)} style={{
                  cursor: "pointer",
                  background,
                  transition: "background 0.2s",
                  boxShadow: outline
                }}>
                            <td style={{
                    padding: "12px 14px",
                    borderTop: "1px solid var(--surface-light)"
                  }}>
                              <div style={{
                      fontWeight: 600,
                      color: "var(--primary-dark)"
                    }}>
                                {summary.date === todayKey ? "Today" : formatShortDate(summary.date)}
                              </div>
                              <div style={{
                      fontSize: "0.8rem",
                      color: "var(--grey-accent-dark)"
                    }}>
                                {summary.jobCount} booking{summary.jobCount === 1 ? "" : "s"}
                              </div>
                            </td>
                            <td style={{
                    padding: "12px 14px",
                    borderTop: "1px solid var(--surface-light)"
                  }}>
                              {summary.jobCount}
                            </td>
                            <td style={{
                    padding: "12px 14px",
                    borderTop: "1px solid var(--surface-light)"
                  }}>
                              {summary.totalQuantity}
                            </td>
                            <td style={{
                    padding: "12px 14px",
                    borderTop: "1px solid var(--surface-light)"
                  }}>
                              {summary.earliestWindow ? formatTime(summary.earliestWindow) : "TBC"}
                            </td>
                            <td style={{
                    padding: "12px 14px",
                    borderTop: "1px solid var(--surface-light)"
                  }}>
                              <span style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-pill)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      background: isSelected ? "var(--primary)" : tone.background,
                      color: isSelected ? "var(--surface)" : tone.color,
                      border: isSelected ? "1px solid var(--primary)" : "1px solid transparent"
                    }}>
                                {tone.label}
                              </span>
                            </td>
                          </tr>;
              })}
                    </tbody>
                  </table>
                </div>}
            </div>
            <div style={collectionDetailsSectionStyle}>
              <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px"
        }}>
                <div style={{
            flex: "1 1 200px"
          }}>
                  <p style={{
              margin: 0,
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              color: "var(--info-dark)",
              textTransform: "uppercase"
            }}>
                    Selected day
                  </p>
                  <strong style={{
              fontSize: "1.2rem",
              color: "var(--primary-dark)"
            }}>
                    {formatDate(selectedCollectionDate)}
                  </strong>
                </div>
                <div style={{
            flex: "1 1 160px"
          }}>
                  <p style={{
              margin: 0,
              fontSize: "0.75rem",
              color: "var(--info-dark)",
              textTransform: "uppercase"
            }}>
                    Bookings
                  </p>
                  <strong style={{
              fontSize: "1.2rem",
              color: "var(--primary-dark)"
            }}>
                    {selectedCollectionJobs.length}
                  </strong>
                </div>
                <div style={{
            flex: "1 1 160px"
          }}>
                  <p style={{
              margin: 0,
              fontSize: "0.75rem",
              color: "var(--info-dark)",
              textTransform: "uppercase"
            }}>
                    Total parts
                  </p>
                  <strong style={{
              fontSize: "1.2rem",
              color: "var(--primary-dark)"
            }}>
                    {selectedCollectionQuantity}
                  </strong>
                </div>
                <div style={{
            flex: "1 1 160px"
          }}>
                  <p style={{
              margin: 0,
              fontSize: "0.75rem",
              color: "var(--info-dark)",
              textTransform: "uppercase"
            }}>
                    First slot
                  </p>
                  <strong style={{
              fontSize: "1.2rem",
              color: "var(--primary-dark)"
            }}>
                    {selectedCollectionWindow ? formatTime(selectedCollectionWindow) : "TBC"}
                  </strong>
                </div>
              </div>
              {collectionLoading ? <p style={{
          margin: 0,
          color: "var(--info)"
        }}>Loading collection jobs…</p> : <div style={collectionListScrollStyle}>
                  {selectedCollectionJobs.length === 0 ? <p style={{
            margin: 0,
            color: "var(--info-dark)"
          }}>
                      No collections scheduled for {formatDate(selectedCollectionDate)}.
                    </p> : selectedCollectionJobs.map(job => <button key={job.id} type="button" onClick={() => router.push(`/parts/create-order/${job.order_number}`)} style={{
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            textAlign: "left",
            background: "var(--surface)",
            cursor: "pointer"
          }}>
                        <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap"
            }}>
                          <strong style={{
                color: "var(--primary-dark)"
              }}>
                            {job.customer_name || "Customer"}
                          </strong>
                          <span style={{
                fontSize: "0.85rem",
                color: "var(--info-dark)"
              }}>
                            {job.invoice_reference || job.order_number}
                          </span>
                        </div>
                        <div style={{
              fontSize: "0.85rem",
              color: "var(--grey-accent-dark)"
            }}>
                          {job.quantity} part{job.quantity === 1 ? "" : "s"} ·{" "}
                          {job.delivery_window ? formatTime(job.delivery_window) : "Time TBC"}
                        </div>
                        <div style={{
              fontSize: "0.85rem",
              color: "var(--info-dark)"
            }}>
                          {job.delivery_address || job.customer_address || "Collection address recorded on parts card"}
                        </div>
                        <div style={{
              fontSize: "0.8rem",
              color: "var(--grey-accent-dark)"
            }}>
                          Parts card #{job.order_number} · tap to open
                        </div>
                      </button>)}
                </div>}
            </div>
          </section>}
      </div>
      {jobModalOpen && <DeliveryJobModal job={jobForm} editing={Boolean(editingJobId)} onClose={closeJobModal} onSave={handleSaveJob} onDelete={handleDeleteJob} onFieldChange={updateJobForm} invoiceQuery={invoiceQuery} setInvoiceQuery={setInvoiceQuery} invoiceResults={invoiceResults} onInvoiceSelect={handleInvoiceSelected} invoiceSearching={invoiceSearchLoading} error={jobModalError} saving={jobModalSaving} />}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
