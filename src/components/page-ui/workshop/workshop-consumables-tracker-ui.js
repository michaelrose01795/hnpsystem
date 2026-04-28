// file location: src/components/page-ui/workshop/workshop-consumables-tracker-ui.js

export default function ConsumablesTrackerPageUi(props) {
  const {
    CalendarField,
    ContentWidth,
    InlineLoading,
    Link,
    PageShell,
    SearchBar,
    SectionShell,
    StockCheckPopup,
    accentDashedBorder,
    budgetInput,
    budgetSaveError,
    budgetSaveMessage,
    budgetSaving,
    canAdvanceToNextMonth,
    cardStyle,
    closeHistoryModal,
    closeOrderModal,
    consumables,
    consumablesError,
    dbUserId,
    duplicateModalStyle,
    duplicateOverlayStyle,
    fetchTechRequests,
    filteredConsumables,
    financialError,
    financialLoading,
    formatCurrency,
    formatDate,
    formattedBudgetUpdatedAt,
    getConsumableStatus,
    handleBudgetInputChange,
    handleBudgetSave,
    handleEditedOrder,
    handleMonthChange,
    handleOrderFormChange,
    handleRequestOrder,
    handleSameDetails,
    highlightRowBackground,
    historyModalConsumable,
    historyModalStyle,
    isWorkshopManager,
    loadingConsumables,
    logsError,
    logsLoading,
    logsSummary,
    monthLabel,
    monthlyLogs,
    mutedTextColor,
    openHistoryModal,
    openOrderModal,
    orderButtonStyle,
    orderForm,
    orderHistoryHeaderStyle,
    orderModalButtonStyle,
    orderModalCloseButtonStyle,
    orderModalConsumable,
    orderModalError,
    orderModalFormGroupStyle,
    orderModalInputStyle,
    orderModalLoading,
    orderModalOverlayStyle,
    orderModalSecondaryButtonStyle,
    orderModalStyle,
    orderingRequestId,
    potentialDuplicates,
    previewLogs,
    quietLabelColor,
    requestsError,
    requestsLoading,
    scheduledTableBodyStyle,
    searchQuery,
    sectionTitleStyle,
    setSearchQuery,
    setShowDuplicateModal,
    setShowEditForm,
    setShowStockCheck,
    showDuplicateModal,
    showEditForm,
    showStockCheck,
    statusBadgeStyles,
    stockCheckButtonStyle,
    tableHeaderColor,
    techRequests,
    themedBudgetInputStyle,
    themedOrderHistoryContainerStyle,
    themedOrderHistoryRowBorder,
    themedOrderHistoryRowStyle,
    toneToStyles,
    totals,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <div style={{
    padding: "40px",
    maxWidth: "720px",
    margin: "0 auto"
  }}>
          <div style={{
      ...cardStyle,
      textAlign: "center"
    }}>
            <h1 style={{
        color: "var(--text-primary)",
        marginBottom: "16px"
      }}>
              Workshop Manager Access Only
            </h1>
            <p style={{
        marginBottom: "16px",
        color: mutedTextColor
      }}>
              This consumables tracker is limited to workshop management roles. If
              you believe you should have access please contact the systems
              administrator.
            </p>
            <Link href="/dashboard" style={{
        display: "inline-block",
        padding: "10px 18px",
        borderRadius: "var(--radius-pill)",
        background: "var(--primary)",
        color: "var(--surface)",
        fontWeight: 600,
        textDecoration: "none"
      }}>
              Return to dashboard
            </Link>
          </div>
        </div>
      </>; // render extracted page section.

    case "section2":
      return <>
      <PageShell sectionKey="workshop-consumables-tracker-shell">
        <ContentWidth sectionKey="workshop-consumables-tracker-content" parentKey="workshop-consumables-tracker-shell" widthMode="content" style={{ gap: "10px" }}>
          {!orderModalConsumable && showDuplicateModal && potentialDuplicates.length > 0 && <div style={duplicateOverlayStyle}>
              <div style={duplicateModalStyle}>
                <h3 style={{
            margin: 0,
            color: "var(--text-primary)"
          }}>
                  Potential Duplicate Consumables
                </h3>
                <p style={{
            color: mutedTextColor,
            marginTop: "8px"
          }}>
                  We detected items that resolve to the same name when
                  normalised. They have been grouped into a single record for
                  this view; please tidy the source data if these should remain
                  separate.
                </p>
                <ul style={{
            paddingLeft: "20px",
            color: mutedTextColor
          }}>
                  {potentialDuplicates.map(entry => <li key={entry.normalized} style={{
              marginBottom: "6px"
            }}>
                      {entry.names.join(" / ")}
                    </li>)}
                </ul>
                <div style={{
            textAlign: "right"
          }}>
                  <button type="button" onClick={() => setShowDuplicateModal(false)} style={{
              padding: "10px 16px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--primary)",
              color: "var(--surface)",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "none"
            }}>
                    Dismiss
                  </button>
                </div>
              </div>
            </div>}
          {showStockCheck && <StockCheckPopup open={showStockCheck} onClose={() => setShowStockCheck(false)} isManager={isWorkshopManager} technicianId={dbUserId} onRequestsSubmitted={fetchTechRequests} />}
          {historyModalConsumable && <div style={orderModalOverlayStyle}>
              <div style={historyModalStyle} role="dialog" aria-modal="true">
                <button type="button" onClick={closeHistoryModal} style={orderModalCloseButtonStyle} aria-label="Close history modal">
                  âœ•
                </button>
                <h3 style={{
            margin: "0 0 6px",
            color: "var(--text-primary)"
          }}>
                  {historyModalConsumable.name} History
                </h3>
                <div style={themedOrderHistoryContainerStyle}>
                  <div style={orderHistoryHeaderStyle}>
                    <span>ITEM</span>
                    <span>QTY</span>
                    <span>UNIT</span>
                    <span>TOTAL</span>
                    <span>SUPPLIER</span>
                    <span>DATE</span>
                  </div>
                  {(historyModalConsumable.orderHistory || []).length === 0 ? <p style={{
              margin: 0,
              color: "var(--info)"
            }}>
                      No order logs recorded yet.
                    </p> : (historyModalConsumable.orderHistory || []).map((log, logIndex) => {
              const isLastLog = logIndex === historyModalConsumable.orderHistory.length - 1;
              return <div key={`history-log-${historyModalConsumable.id}-${logIndex}`} style={{
                ...themedOrderHistoryRowStyle,
                borderBottom: isLastLog ? "none" : themedOrderHistoryRowBorder
              }}>
                          <span>{log.itemName || historyModalConsumable.name}</span>
                          <span>{log.quantity ? log.quantity.toLocaleString() : "â€”"}</span>
                          <span>{formatCurrency(log.unitCost)}</span>
                          <span>{formatCurrency(log.totalCost)}</span>
                          <span>{log.supplier || "â€”"}</span>
                          <span>{formatDate(log.date)}</span>
                        </div>;
            })}
                </div>
              </div>
            </div>}
          {orderModalConsumable && <div style={orderModalOverlayStyle}>
              <div style={orderModalStyle} role="dialog" aria-modal="true">
                <button type="button" onClick={closeOrderModal} style={orderModalCloseButtonStyle} aria-label="Close order modal">
                  ✕
                </button>
                <h3 style={{
            margin: "0 0 6px",
            color: "var(--text-primary)"
          }}>
                  Order {orderModalConsumable.name}
                </h3>
                <p style={{
            margin: "0 8px 16px",
            color: mutedTextColor
          }}>
                Previous orders (latest three). &ldquo;Same Details&rdquo; will reuse the
                most recent order, while &ldquo;Edit Details&rdquo; lets you adjust the
                  quantity, unit cost, supplier, or date before logging a new entry.
                </p>
                <div style={themedOrderHistoryContainerStyle}>
                  <div style={orderHistoryHeaderStyle}>
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Unit</span>
                    <span>Total</span>
                    <span>Supplier</span>
                    <span>Date</span>
                  </div>
                  {previewLogs.length === 0 ? <p style={{
              margin: 0,
              color: "var(--info)"
            }}>
                      No previous orders logged.
                    </p> : previewLogs.map((log, index) => {
              const isLastLog = index === previewLogs.length - 1;
              return <div key={`modal-log-${index}`} style={{
                ...themedOrderHistoryRowStyle,
                borderBottom: isLastLog ? "none" : themedOrderHistoryRowBorder
              }}>
                          <span>{log.itemName || orderModalConsumable.name}</span>
                          <span>
                            {log.quantity ? log.quantity.toLocaleString() : "—"}
                          </span>
                          <span>{formatCurrency(log.unitCost)}</span>
                          <span>{formatCurrency(log.totalCost)}</span>
                          <span>{log.supplier || "—"}</span>
                          <span>{formatDate(log.date)}</span>
                        </div>;
            })}
                </div>
                <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "20px"
          }}>
                  <button type="button" onClick={handleSameDetails} disabled={orderModalLoading} style={{
              ...orderModalButtonStyle,
              background: orderModalLoading ? "rgba(var(--primary-rgb),0.4)" : "var(--primary)",
              color: "var(--surface)"
            }}>
                    {orderModalLoading ? "Ordering…" : "Same Details"}
                  </button>
                  <button type="button" onClick={() => setShowEditForm(previous => !previous)} style={orderModalSecondaryButtonStyle}>
                    {showEditForm ? "Hide Form" : "Edit Details"}
                  </button>
                </div>
                {orderModalError && <p style={{
            color: "var(--text-primary)",
            marginTop: "12px"
          }}>
                    {orderModalError}
                  </p>}
                {showEditForm && <form onSubmit={handleEditedOrder} style={{
            marginTop: "16px"
          }}>
                    <div style={orderModalFormGroupStyle}>
                      <label style={{
                fontWeight: 600,
                color: "var(--text-primary)"
              }}>
                        Quantity
                      </label>
                      <input type="number" min="0" step="1" value={orderForm.quantity} onChange={handleOrderFormChange("quantity")} style={orderModalInputStyle} required />
                    </div>
                    <div style={orderModalFormGroupStyle}>
                      <label style={{
                fontWeight: 600,
                color: "var(--text-primary)"
              }}>
                        Unit Cost (£)
                      </label>
                      <input type="number" min="0" step="0.01" value={orderForm.unitCost} onChange={handleOrderFormChange("unitCost")} style={orderModalInputStyle} required />
                    </div>
                    <div style={orderModalFormGroupStyle}>
                      <label style={{
                fontWeight: 600,
                color: "var(--text-primary)"
              }}>
                        Supplier
                      </label>
                      <input type="text" value={orderForm.supplier} onChange={handleOrderFormChange("supplier")} style={orderModalInputStyle} />
                    </div>
                    <div style={orderModalFormGroupStyle}>
                      <CalendarField label="Order Date" value={orderForm.orderDate} onChange={handleOrderFormChange("orderDate")} name="orderDate" id="orderDate" />
                    </div>
                    <button type="submit" disabled={orderModalLoading} style={{
              ...orderModalButtonStyle,
              width: "100%",
              background: orderModalLoading ? "rgba(var(--primary-rgb),0.4)" : "var(--primary)",
              color: "var(--surface)"
            }}>
                      {orderModalLoading ? "Submitting…" : "Save Details"}
                    </button>
                  </form>}
              </div>
            </div>}
            <div className="app-section-card" style={{
          ...cardStyle
        }}>
              <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}>
                <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap"
            }}>
                  <div style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                flexWrap: "wrap"
              }}>
                    <h1 style={{
                  margin: 0,
                  fontSize: "1.4rem",
                  color: "var(--text-primary)"
                }}>
                      Workshop Consumables Tracker
                    </h1>
                    <div>
                      <p style={{
                    margin: 0,
                    fontSize: "0.8rem",
                    color: quietLabelColor
                  }}>
                        Budget for {monthLabel}
                      </p>
                      <strong style={{
                    fontSize: "1.4rem",
                    color: "var(--text-primary)"
                  }}>
                        {financialLoading ? <InlineLoading width={90} height={18} label="Loading budget" /> : formatCurrency(totals.monthlyBudget)}
                      </strong>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowStockCheck(true)} style={stockCheckButtonStyle}>
                    Stock Check
                  </button>
                </div>

                <div style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              alignItems: "flex-start",
              gap: "12px"
            }}>
                  <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}>
                    <button type="button" onClick={() => handleMonthChange(-1)} style={{
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--primary)",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  cursor: "pointer"
                }}>
                      ← Previous
                    </button>
                    <span style={{
                  fontWeight: 600,
                  color: "var(--text-primary)"
                }}>
                      {monthLabel}
                    </span>
                    <button type="button" onClick={() => handleMonthChange(1)} disabled={!canAdvanceToNextMonth} style={{
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--primary)",
                  background: canAdvanceToNextMonth ? "var(--surface)" : "rgba(var(--primary-rgb),0.2)",
                  color: canAdvanceToNextMonth ? "var(--text-primary)" : "var(--text-primary)",
                  fontWeight: 600,
                  cursor: canAdvanceToNextMonth ? "pointer" : "not-allowed"
                }}>
                      Next →
                    </button>
                  </div>
                  <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                minWidth: "280px",
                flex: "1 1 320px",
                maxWidth: "460px"
              }}>
                    <div style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "flex-end"
                }}>
                      <input id="monthlyBudget" type="number" min="0" step="50" value={budgetInput} onChange={handleBudgetInputChange} style={{
                    ...themedBudgetInputStyle,
                    flex: "1 1 180px",
                    minWidth: "160px"
                  }} />
                      <button type="button" onClick={handleBudgetSave} disabled={budgetSaving || financialLoading} style={{
                    ...orderModalButtonStyle,
                    background: budgetSaving ? "rgba(var(--primary-rgb),0.4)" : "var(--primary)",
                    color: "var(--surface)",
                    width: "auto"
                  }}>
                        {budgetSaving ? "Saving…" : "Save Budget"}
                      </button>
                    </div>
                    {budgetSaveMessage && <p style={{
                  margin: 0,
                  color: "var(--success-dark)",
                  textAlign: "right"
                }}>
                        {budgetSaveMessage}
                      </p>}
                    {budgetSaveError && <p style={{
                  margin: 0,
                  color: "var(--text-primary)",
                  textAlign: "right"
                }}>
                        {budgetSaveError}
                      </p>}
                    {formattedBudgetUpdatedAt && <p style={{
                  margin: 0,
                  color: mutedTextColor,
                  fontSize: "0.85rem",
                  textAlign: "right"
                }}>
                        Last updated {formattedBudgetUpdatedAt}
                      </p>}
                  </div>
                  {financialError && <p style={{
                margin: 0,
                color: "var(--text-primary)"
              }}>{financialError}</p>}
                </div>
              </div>
            </div>

            <div className="app-section-card" style={{ ...cardStyle }}>
              <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}>
                <h2 style={{
              margin: 0,
              fontSize: "1.3rem",
              color: "var(--text-primary)"
            }}>
                  Monthly Logs
                </h2>
              </div>
              <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px"
          }}>
                <div style={{
              ...cardStyle,
              padding: "12px",
              boxShadow: "none",
              backgroundColor: "var(--surface-light)",
              border: "var(--section-card-border)"
            }}>
                  <p style={{
                margin: 0,
                color: quietLabelColor,
                fontSize: "0.8rem"
              }}>Spend</p>
                  <strong style={{
                fontSize: "1.2rem"
              }}>
                    {logsLoading ? <InlineLoading width={80} height={16} label="Loading spend" /> : formatCurrency(logsSummary.spend)}
                  </strong>
                </div>
                <div style={{
              ...cardStyle,
              padding: "12px",
              boxShadow: "none",
              backgroundColor: "var(--surface-light)",
              border: "var(--section-card-border)"
            }}>
                  <p style={{
                margin: 0,
                color: quietLabelColor,
                fontSize: "0.8rem"
              }}>Quantity</p>
                  <strong style={{
                fontSize: "1.2rem"
              }}>
                    {logsLoading ? <InlineLoading width={60} height={16} label="Loading quantity" /> : logsSummary.quantity.toLocaleString()}
                  </strong>
                </div>
                <div style={{
              ...cardStyle,
              padding: "12px",
              boxShadow: "none",
              backgroundColor: "var(--surface-light)",
              border: "var(--section-card-border)"
            }}>
                  <p style={{
                margin: 0,
                color: quietLabelColor,
                fontSize: "0.8rem"
              }}>Orders</p>
                  <strong style={{
                fontSize: "1.2rem"
              }}>
                    {logsLoading ? <InlineLoading width={60} height={16} label="Loading orders" /> : logsSummary.orders}
                  </strong>
                </div>
                <div style={{
              ...cardStyle,
              padding: "12px",
              boxShadow: "none",
              backgroundColor: "var(--surface-light)",
              border: "var(--section-card-border)"
            }}>
                  <p style={{
                margin: 0,
                color: quietLabelColor,
                fontSize: "0.8rem"
              }}>Suppliers</p>
                  <strong style={{
                fontSize: "1.2rem"
              }}>
                    {logsLoading ? <InlineLoading width={60} height={16} label="Loading suppliers" /> : logsSummary.suppliers}
                  </strong>
                </div>
              </div>
              {logsError && <p style={{
            margin: "12px 0 0",
            color: "var(--text-primary)"
          }}>{logsError}</p>}
              <div style={{
            overflowX: "auto"
          }}>
                <table style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "0 12px"
            }}>
                  <thead>
                    <tr style={{
                  textAlign: "left",
                  color: tableHeaderColor,
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em"
                }}>
                      <th style={{
                    padding: "8px"
                  }}>Date</th>
                      <th style={{
                    padding: "8px"
                  }}>Item</th>
                      <th style={{
                    padding: "8px"
                  }}>Quantity</th>
                      <th style={{
                    padding: "8px"
                  }}>Supplier</th>
                      <th style={{
                    padding: "8px"
                  }}>Total (£)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsLoading ? <tr>
                        <td colSpan={5} style={{
                    padding: "12px",
                    color: "var(--info)"
                  }}>
                          Loading logs…
                        </td>
                      </tr> : monthlyLogs.length === 0 ? <tr>
                        <td colSpan={5} style={{
                    padding: "12px",
                    color: "var(--info)"
                  }}>
                          No log entries recorded for {monthLabel}.
                        </td>
                      </tr> : monthlyLogs.map(log => <tr key={`log-${log.id || log.date}-${log.itemName}`} style={{
                  background: highlightRowBackground,
                  borderRadius: "var(--radius-sm)"
                }}>
                          <td style={{
                    padding: "12px",
                    color: mutedTextColor
                  }}>
                            {log.date ? new Date(log.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    }) : "—"}
                          </td>
                          <td style={{
                    padding: "12px",
                    fontWeight: 600,
                    color: "var(--text-secondary)"
                  }}>
                            {log.itemName || "—"}
                          </td>
                          <td style={{
                    padding: "12px",
                    color: mutedTextColor
                  }}>
                            {Number(log.quantity || 0).toLocaleString()}
                          </td>
                          <td style={{
                    padding: "12px",
                    color: mutedTextColor
                  }}>
                            {log.supplier || "—"}
                          </td>
                          <td style={{
                    padding: "12px",
                    color: mutedTextColor
                  }}>
                            {formatCurrency(log.totalValue)}
                          </td>
                        </tr>)}
                  </tbody>
                </table>
              </div>
            </div>

              <div className="app-section-card" style={{ ...cardStyle }}>
                <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "10px"
        }}>
                <div style={{
            ...cardStyle,
            padding: "16px",
            boxShadow: "none",
            backgroundColor: "var(--surface-light)",
            border: "var(--section-card-border)"
          }}>
                  <p style={{
              margin: 0,
              color: quietLabelColor,
              fontSize: "0.85rem"
            }}>
                    This Month&apos;s Spend
                  </p>
                  <h2 style={{
              margin: "6px 0 0",
              fontSize: "1.4rem",
              color: "var(--text-primary)"
            }}>
                    {financialLoading ? <InlineLoading width={110} height={22} label="Loading month spend" /> : formatCurrency(totals.monthSpend)}
                  </h2>
                </div>
                <div style={{
            ...cardStyle,
            padding: "16px",
            boxShadow: "none",
            backgroundColor: "var(--surface-light)",
            border: "var(--section-card-border)"
          }}>
                  <p style={{
              margin: 0,
              color: quietLabelColor,
              fontSize: "0.85rem"
            }}>
                    Projected Spend (All Scheduled Orders)
                  </p>
                  <h2 style={{
              margin: "6px 0 0",
              fontSize: "1.4rem",
              color: "var(--text-primary)"
            }}>
                    {financialLoading ? <InlineLoading width={110} height={22} label="Loading projected spend" /> : formatCurrency(totals.projectedSpend)}
                  </h2>
                </div>
                <div style={{
            ...cardStyle,
            padding: "16px",
            boxShadow: "none",
            backgroundColor: "var(--surface-light)",
            border: "var(--section-card-border)"
          }}>
                  <p style={{
              margin: 0,
              color: quietLabelColor,
              fontSize: "0.85rem"
            }}>
                    Budget Remaining
                  </p>
                  <h2 style={{
              margin: "6px 0 0",
              fontSize: "1.4rem",
              color: totals.monthSpend > totals.monthlyBudget ? "var(--text-primary)" : "var(--success-dark)"
            }}>
                    {financialLoading ? <InlineLoading width={110} height={22} label="Loading budget remaining" /> : formatCurrency(Math.max(totals.budgetRemaining, -999999))}
                  </h2>
                </div>
              </div>
              </div>

            <div className="app-section-card" style={{
        ...cardStyle
      }}>
              <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "center"
        }}>
                <h2 style={sectionTitleStyle}>Scheduled Consumables</h2>
                <div style={{
            minWidth: "220px",
            flex: "1 1 auto",
            maxWidth: "360px"
          }}>
                  <SearchBar value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onClear={() => setSearchQuery("")} placeholder="Search by item, date, cost, supplier…" style={{
              width: "100%"
            }} />
                </div>
              </div>
              <div style={{
          overflowX: "auto"
        }}>
                <div style={scheduledTableBodyStyle}>
                  <table style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "0 12px"
            }}>
                    <thead>
                    <tr style={{
                  textAlign: "left",
                  color: tableHeaderColor,
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em"
                }}>
                      <th style={{
                    padding: "8px"
                  }}>Status</th>
                      <th style={{
                    padding: "8px"
                  }}>Item</th>
                      <th style={{
                    padding: "8px"
                  }}>Last Ordered</th>
                      <th style={{
                    padding: "8px"
                  }}>Next Estimated</th>
                      <th style={{
                    padding: "8px"
                  }}>Estimated Qty</th>
                      <th style={{
                    padding: "8px"
                  }}>Supplier</th>
                      <th style={{
                    padding: "8px"
                  }}>Unit Cost</th>
                      <th style={{
                    padding: "8px"
                  }}>Last Order Value</th>
                      <th style={{
                    padding: "8px"
                  }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingConsumables ? <tr>
                        <td colSpan={8} style={{
                    padding: "14px",
                    color: "var(--info)"
                  }}>
                          Loading consumable data…
                        </td>
                      </tr> : consumablesError ? <tr>
                        <td colSpan={8} style={{
                    padding: "14px",
                    color: "var(--text-primary)"
                  }}>
                          {consumablesError}
                        </td>
                      </tr> : consumables.length === 0 ? <tr>
                        <td colSpan={8} style={{
                    padding: "14px",
                    color: "var(--info)"
                  }}>
                          No consumable records found.
                        </td>
                      </tr> : filteredConsumables.map(item => {
                  const status = getConsumableStatus(item);
                  const icon = status.label === "Overdue" ? "⚠️" : status.label === "Not Required" ? "ℹ️" : "⏰";
                  return <tr key={`consumable-${item.id}`} style={{
                    background: highlightRowBackground,
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer"
                  }} onClick={() => openHistoryModal(item)}>
                            <td style={{
                      padding: "12px"
                    }}>
                              <span style={toneToStyles(status.tone)}>
                                {icon}
                                {status.label}
                              </span>
                            </td>
                            <td style={{
                      padding: "12px"
                    }}>
                              <strong style={{
                        display: "block",
                        color: "var(--text-primary)"
                      }}>
                                {item.name}
                              </strong>
                            </td>
                            <td style={{
                      padding: "12px",
                      color: mutedTextColor
                    }}>
                              {formatDate(item.lastOrderDate)}
                            </td>
                            <td style={{
                      padding: "12px",
                      color: mutedTextColor
                    }}>
                              {formatDate(item.nextEstimatedOrderDate)}
                            </td>
                            <td style={{
                      padding: "12px",
                      color: mutedTextColor
                    }}>
                              {item.estimatedQuantity ? item.estimatedQuantity.toLocaleString() : "—"}
                            </td>
                            <td style={{
                      padding: "12px",
                      color: mutedTextColor
                    }}>
                              {item.supplier || "—"}
                            </td>
                            <td style={{
                      padding: "12px",
                      color: mutedTextColor
                    }}>
                              {formatCurrency(item.unitCost)}
                            </td>
                            <td style={{
                      padding: "12px",
                      color: mutedTextColor
                    }}>
                              {formatCurrency(item.lastOrderTotalValue)}
                            </td>
                            <td style={{
                      padding: "12px",
                      color: mutedTextColor
                    }}>
                              <button type="button" onClick={event => {
                        event.stopPropagation();
                        openOrderModal(item);
                      }} style={orderButtonStyle}>
                                Order
                              </button>
                            </td>
                          </tr>;
                })}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

          <div className="app-section-card" style={{
        ...cardStyle
      }}>
            <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px"
        }}>
              <h2 style={{
            margin: 0,
            fontSize: "1.3rem",
            color: "var(--text-primary)"
          }}>
                Requests
              </h2>
              <span style={{
            color: "var(--text-secondary)",
            fontSize: "0.9rem"
          }}>
                {requestsLoading ? <InlineLoading width={90} label="Loading requests" /> : `${techRequests.length} requests`}
              </span>
            </div>
            {requestsError && <p style={{
          margin: "0 0 12px",
          color: "var(--text-primary)"
        }}>
                {requestsError}
              </p>}
            <div style={{
          overflowX: "auto"
        }}>
              <table style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "0 12px"
          }}>
                <thead>
                  <tr style={{
                textAlign: "left",
                color: tableHeaderColor,
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em"
              }}>
                    <th style={{
                  padding: "8px"
                }}>Item</th>
                    <th style={{
                  padding: "8px"
                }}>Quantity</th>
                    <th style={{
                  padding: "8px"
                }}>Technician</th>
                    <th style={{
                  padding: "8px"
                }}>Requested</th>
                    <th style={{
                  padding: "8px"
                }}>Status</th>
                    <th style={{
                  padding: "8px"
                }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {techRequests.map(request => <tr key={`request-${request.id}`} style={{
                background: highlightRowBackground,
                borderRadius: "var(--radius-sm)"
              }}>
                      <td style={{
                  padding: "12px",
                  color: mutedTextColor
                }}>
                        {request.itemName}
                      </td>
                      <td style={{
                  padding: "12px",
                  color: mutedTextColor
                }}>
                        {request.quantity.toLocaleString()}
                      </td>
                      <td style={{
                  padding: "12px",
                  color: mutedTextColor
                }}>
                        {request.requestedByName || "—"}
                      </td>
                      <td style={{
                  padding: "12px",
                  color: mutedTextColor
                }}>
                        {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                  }) : "—"}
                      </td>
                      <td style={{
                  padding: "12px",
                  color: mutedTextColor
                }}>
                        <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-pill)",
                    fontWeight: 600,
                    fontSize: "var(--text-caption)",
                    ...(statusBadgeStyles[request.status === "ordered" ? "ordered" : request.status] || statusBadgeStyles.pending)
                  }}>
                          {request.status === "ordered" ? "✅" : request.status === "urgent" ? "⏰" : request.status === "rejected" ? "✖️" : "📦"}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      <td style={{
                  padding: "12px"
                }}>
                        {request.status === "pending" ? <button type="button" disabled={orderingRequestId === request.id} onClick={() => handleRequestOrder(request)} style={{
                    ...orderModalButtonStyle,
                    padding: "6px 14px",
                    fontSize: "0.9rem",
                    width: "auto"
                  }}>
                            {orderingRequestId === request.id ? "Ordering…" : "Order"}
                          </button> : request.status === "ordered" ? <span style={{
                    color: "var(--success-dark)",
                    fontWeight: 600
                  }}>
                            Ordered
                          </span> : request.status === "rejected" ? <span style={{
                    color: "var(--danger)",
                    fontWeight: 600
                  }}>
                            Rejected
                          </span> : request.status === "ordered" ? <span style={{
                    color: "var(--success-dark)",
                    fontWeight: 600
                  }}>
                            Ordered
                          </span> : request.status === "rejected" ? <span style={{
                    color: "var(--danger)",
                    fontWeight: 600
                  }}>
                            Rejected
                          </span> : <span style={{
                    color: "var(--success-dark)",
                    fontWeight: 600
                  }}>
                            Completed
                          </span>}
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </ContentWidth>
      </PageShell>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
