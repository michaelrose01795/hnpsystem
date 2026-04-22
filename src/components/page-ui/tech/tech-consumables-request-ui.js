// file location: src/components/page-ui/tech/tech-consumables-request-ui.js

export default function TechConsumableRequestPageUi(props) {
  const {
    DevLayoutSection,
    Link,
    SearchBar,
    StockCheckPopup,
    addingTemporaryItem,
    cardStyle,
    createTemporaryStockItem,
    dbUserId,
    fetchRequests,
    fieldLabelStyle,
    filteredRequests,
    findStockItemByName,
    handleInputChange,
    handleSubmit,
    inputStyle,
    isMobile,
    isWorkshopManager,
    loadingRequests,
    pageWrapperStyle,
    requestCardMetaGridStyle,
    requestCardStyle,
    requestError,
    requestForm,
    requestFormStyle,
    requestHeaderStyle,
    requestPanelStyle,
    requestsToolbarStyle,
    searchTerm,
    setRequestForm,
    setSearchTerm,
    setShowStockCheck,
    showStockCheck,
    statusBadgeStyles,
    stockError,
    stockLoading,
    stockMatches,
    successMessage,
    tableHeaderStyle,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <DevLayoutSection sectionKey="tech-consumables-access-shell" sectionType="page-shell" shell widthMode="page" style={{
    padding: "40px",
    maxWidth: "720px",
    margin: "0 auto"
  }}>
          <DevLayoutSection as="section" sectionKey="tech-consumables-access-card" parentKey="tech-consumables-access-shell" sectionType="content-card" backgroundToken="surface" style={{
      ...cardStyle,
      textAlign: "center"
    }}>
            <h1 style={{
        color: "var(--primary-dark)",
        marginBottom: "16px"
      }}>
              Technician Access Only
            </h1>
            <p style={{
        marginBottom: "16px",
        color: "var(--grey-accent-dark)"
      }}>
              This page is reserved for workshop technicians to request
              consumables. Please navigate back to your dashboard if this was in
              error.
            </p>
            <DevLayoutSection as="div" sectionKey="tech-consumables-access-action" parentKey="tech-consumables-access-card" sectionType="floating-action" backgroundToken="transparent">
              <Link href="/dashboard" style={{
          display: "inline-block",
          padding: "var(--control-padding)",
          borderRadius: "var(--control-radius)",
          background: "var(--primary)",
          color: "var(--surface)",
          fontWeight: 600,
          textDecoration: "none"
        }}>
                Return to dashboard
              </Link>
            </DevLayoutSection>
          </DevLayoutSection>
        </DevLayoutSection>
      </>; // render extracted page section.

    case "section2":
      return <>
      <div style={pageWrapperStyle}>
        <DevLayoutSection as="section" sectionKey="tech-consumables-request-panel" sectionType="content-card" backgroundToken="accent" className="app-layout-surface-accent" style={requestPanelStyle}>
          <DevLayoutSection as="div" sectionKey="tech-consumables-request-header" parentKey="tech-consumables-request-panel" sectionType="section-header-row" backgroundToken="transparent" style={requestHeaderStyle}>
            <div>
              <h1 style={{
            margin: 0,
            fontSize: "1.6rem",
            color: "var(--primary-dark)"
          }}></h1>
            </div>
            <DevLayoutSection as="div" sectionKey="tech-consumables-stock-check-action" parentKey="tech-consumables-request-header" sectionType="floating-action" backgroundToken="transparent">
              <button type="button" onClick={() => setShowStockCheck(true)} style={{
            padding: "var(--control-padding)",
            borderRadius: "var(--control-radius)",
            border: "1px solid var(--primary)",
            background: "var(--surface)",
            color: "var(--primary-dark)",
            fontWeight: 600,
            cursor: "pointer",
            width: isMobile ? "100%" : "auto"
          }}>
                Stock Check
              </button>
            </DevLayoutSection>
          </DevLayoutSection>

          <DevLayoutSection as="form" sectionKey="tech-consumables-request-form" parentKey="tech-consumables-request-panel" sectionType="form-grid" backgroundToken="transparent" onSubmit={handleSubmit} style={requestFormStyle}>
            <DevLayoutSection as="div" sectionKey="tech-consumables-item-field" parentKey="tech-consumables-request-form" sectionType="form-block" backgroundToken="surface" style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
              <label htmlFor="partName" style={fieldLabelStyle}>
                Consumable
              </label>
              <input id="partName" name="partName" type="text" aria-label="Part Name" value={requestForm.partName} onChange={handleInputChange} placeholder="e.g. Nitrile gloves" style={inputStyle} required />
              {requestForm.partName.trim() && <DevLayoutSection as="div" sectionKey="tech-consumables-stock-suggestions" parentKey="tech-consumables-item-field" sectionType="content-card" backgroundToken="surface-light" style={{
            marginTop: "4px",
            border: "none",
            borderRadius: "var(--control-radius)",
            padding: "8px",
            background: "var(--surface-lightest)",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}>
                  {stockLoading ? <span style={{
              color: "var(--grey-accent-dark)",
              fontSize: "0.85rem"
            }}>Searching stock…</span> : stockMatches.length > 0 ? <>
                      <span style={{
                color: "var(--grey-accent-dark)",
                fontSize: "0.8rem"
              }}>Matching stock items:</span>
                      <div data-dev-section="1" data-dev-section-key="tech-consumables-stock-suggestion-list" data-dev-section-type="list" data-dev-section-parent="tech-consumables-stock-suggestions" style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}>
                        {stockMatches.map(item => <button key={item.id} type="button" onClick={() => setRequestForm(previous => ({
                  ...previous,
                  partName: item.name
                }))} style={{
                  textAlign: "left",
                  border: "none",
                  borderRadius: "var(--control-radius)",
                  padding: "6px 10px",
                  background: "var(--surface)",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  color: "var(--primary-dark)"
                }}>
                            {item.name}
                          </button>)}
                      </div>
                    </> : <span style={{
              color: "var(--grey-accent-dark)",
              fontSize: "0.85rem"
            }}>
                      No matching stock items. Create a temporary entry below.
                    </span>}
                  {requestForm.partName.trim() && !stockLoading && !findStockItemByName(requestForm.partName) && <button type="button" onClick={() => createTemporaryStockItem(requestForm.partName.trim())} disabled={addingTemporaryItem} style={{
              padding: "6px 12px",
              borderRadius: "var(--control-radius)",
              border: "1px solid var(--primary)",
              background: addingTemporaryItem ? "rgba(var(--primary-rgb),0.35)" : "var(--surface)",
              color: "var(--primary-dark)",
              fontWeight: 600,
              cursor: addingTemporaryItem ? "not-allowed" : "pointer",
              alignSelf: "flex-start"
            }}>
                      {addingTemporaryItem ? "Adding…" : `Add "${requestForm.partName.trim()}" to stock`}
                    </button>}
                  {stockError && <span style={{
              color: "var(--primary-dark)",
              fontSize: "0.8rem"
            }}>{stockError}</span>}
                </DevLayoutSection>}
            </DevLayoutSection>

            <DevLayoutSection as="div" sectionKey="tech-consumables-quantity-field" parentKey="tech-consumables-request-form" sectionType="form-block" backgroundToken="surface" style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
              <label htmlFor="quantity" style={fieldLabelStyle}>
                Quantity
              </label>
              <input id="quantity" name="quantity" type="number" aria-label="Quantity Needed" min="1" step="1" value={requestForm.quantity} onChange={handleInputChange} style={inputStyle} />
            </DevLayoutSection>

            <DevLayoutSection as="div" sectionKey="tech-consumables-submit-action" parentKey="tech-consumables-request-form" sectionType="toolbar" backgroundToken="transparent" style={{
          gridColumn: "span 1",
          display: "flex",
          justifyContent: "flex-end"
        }}>
              <button type="submit" style={{
            padding: "var(--control-padding)",
            borderRadius: "var(--control-radius)",
            border: "none",
            background: "var(--primary)",
            color: "var(--surface)",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "none",
            width: "100%"
          }}>
                Submit Request
              </button>
            </DevLayoutSection>
          </DevLayoutSection>
        </DevLayoutSection>

        <DevLayoutSection as="section" sectionKey="tech-consumables-requests-panel" sectionType="section-shell" shell backgroundToken="accent" className="app-layout-surface-accent">
          <DevLayoutSection as="div" sectionKey="tech-consumables-requests-toolbar" parentKey="tech-consumables-requests-panel" sectionType="toolbar" backgroundToken="transparent" style={requestsToolbarStyle}>
            <h2 style={{
          margin: 0,
          fontSize: "1.2rem",
          color: "var(--primary-dark)"
        }}>Requests</h2>
            <DevLayoutSection as="div" sectionKey="tech-consumables-requests-search" parentKey="tech-consumables-requests-toolbar" sectionType="filter-row" backgroundToken="search-surface" style={{
          maxWidth: isMobile ? "100%" : "240px",
          width: "100%"
        }}>
              <SearchBar placeholder="Search requests" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} onClear={() => setSearchTerm("")} style={{
            maxWidth: isMobile ? "100%" : "240px"
          }} />
            </DevLayoutSection>
          </DevLayoutSection>
          {successMessage && <DevLayoutSection as="p" sectionKey="tech-consumables-success-banner" parentKey="tech-consumables-requests-panel" sectionType="state-banner" backgroundToken="success-surface" style={{
        margin: "0 0 12px",
        color: "var(--success-dark)"
      }}>
              {successMessage}
            </DevLayoutSection>}
          {requestError && <DevLayoutSection as="p" sectionKey="tech-consumables-error-banner" parentKey="tech-consumables-requests-panel" sectionType="state-banner" backgroundToken="danger-surface" style={{
        margin: "0 0 12px",
        color: "var(--primary-dark)"
      }}>
              {requestError}
            </DevLayoutSection>}

          {isMobile ? <DevLayoutSection as="div" sectionKey="tech-consumables-request-mobile-list" parentKey="tech-consumables-requests-panel" sectionType="list" backgroundToken="surface" style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
              {loadingRequests ? <div style={{
          ...requestCardStyle,
          textAlign: "center",
          color: "var(--text-secondary)"
        }}>
                  Loading requests…
                </div> : filteredRequests.length > 0 ? filteredRequests.map(request => <article key={request.id} data-dev-section="1" data-dev-section-key={`tech-consumables-request-mobile-card-${request.id}`} data-dev-section-type="content-card" data-dev-section-parent="tech-consumables-request-mobile-list" style={requestCardStyle}>
                    <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px"
          }}>
                      <div style={{
              minWidth: 0
            }}>
                        <div style={{
                fontWeight: 700,
                color: "var(--text-primary)",
                wordBreak: "break-word"
              }}>
                          {request.itemName}
                        </div>
                      </div>
                      <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "var(--radius-pill)",
              fontWeight: 600,
              fontSize: "0.75rem",
              whiteSpace: "nowrap",
              ...(statusBadgeStyles[request.status] || statusBadgeStyles.pending)
            }}>
                        {request.status === "fulfilled" ? "✅" : request.status === "urgent" ? "⏰" : request.status === "rejected" ? "✖️" : request.status === "ordered" ? "📦" : "📦"}
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </div>
                    <div style={requestCardMetaGridStyle}>
                      <div style={{
              minWidth: 0
            }}>
                        <div style={fieldLabelStyle}>Quantity</div>
                        <div style={{
                marginTop: "4px",
                color: "var(--text-primary)",
                fontWeight: 600
              }}>
                          {request.quantity}
                        </div>
                      </div>
                      <div style={{
              minWidth: 0
            }}>
                        <div style={fieldLabelStyle}>Requested</div>
                        <div style={{
                marginTop: "4px",
                color: "var(--text-secondary)"
              }}>
                          {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                }) : "—"}
                        </div>
                      </div>
                      <div style={{
              gridColumn: "1 / -1",
              minWidth: 0
            }}>
                        <div style={fieldLabelStyle}>Requested By</div>
                        <div style={{
                marginTop: "4px",
                color: "var(--text-secondary)",
                wordBreak: "break-word"
              }}>
                          {request.requestedByName || "—"}
                        </div>
                      </div>
                    </div>
                  </article>) : <div style={{
          ...requestCardStyle,
          textAlign: "center",
          color: "var(--text-secondary)"
        }}>
                  No consumable requests match the current filter.
                </div>}
            </DevLayoutSection> : <DevLayoutSection as="div" sectionKey="tech-consumables-request-auto-data-table-1-shell" parentKey="tech-consumables-requests-panel" sectionType="data-table-shell" backgroundToken="surface" className="app-section-card" style={{
        overflowX: "auto",
        maxHeight: "420px",
        overflowY: "auto",
        padding: 0,
        background: "var(--surface)"
      }}>
              <DevLayoutSection as="table" sectionKey="tech-consumables-request-auto-data-table-1" parentKey="tech-consumables-request-auto-data-table-1-shell" sectionType="data-table" backgroundToken="surface" className="app-data-table" style={{
          minWidth: "640px",
          background: "var(--surface)"
        }}>
                <thead data-dev-section="1" data-dev-section-key="tech-consumables-request-auto-data-table-1-headings" data-dev-section-type="table-headings" data-dev-section-parent="tech-consumables-request-auto-data-table-1" style={{
            background: "var(--accent-surface-hover)"
          }}>
                  <tr>
                    <th style={tableHeaderStyle}>Status</th>
                    <th style={tableHeaderStyle}>Part Name</th>
                    <th style={tableHeaderStyle}>Quantity</th>
                    <th style={tableHeaderStyle}>Requested</th>
                    <th style={tableHeaderStyle}>Requested By</th>
                  </tr>
                </thead>
                <tbody data-dev-section="1" data-dev-section-key="tech-consumables-request-auto-data-table-1-rows" data-dev-section-type="table-rows" data-dev-section-parent="tech-consumables-request-auto-data-table-1">
                  {loadingRequests ? <tr data-dev-section="1" data-dev-section-key="tech-consumables-requests-loading-row" data-dev-section-type="state-banner" data-dev-section-parent="tech-consumables-request-auto-data-table-1-rows" style={{
              background: "var(--surface)"
            }}>
                      <td colSpan={5} style={{
                padding: "18px 12px",
                color: "var(--text-secondary)",
                textAlign: "center"
              }}>
                        Loading requests…
                      </td>
                    </tr> : filteredRequests.length > 0 ? filteredRequests.map(request => <tr key={request.id} data-dev-section="1" data-dev-section-key={`tech-consumables-request-auto-data-table-1-row-${request.id}`} data-dev-section-type="table-row" data-dev-section-parent="tech-consumables-request-auto-data-table-1-rows" style={{
              background: "var(--surface)"
            }}>
                        <td style={{
                padding: "12px"
              }}>
                          <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-pill)",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  ...(statusBadgeStyles[request.status] || statusBadgeStyles.pending)
                }}>
                            {request.status === "fulfilled" ? "✅" : request.status === "urgent" ? "⏰" : request.status === "rejected" ? "✖️" : request.status === "ordered" ? "📦" : "📦"}
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td style={{
                padding: "12px",
                fontWeight: 600,
                color: "var(--text-primary)"
              }}>{request.itemName}</td>
                        <td style={{
                padding: "12px",
                color: "var(--text-secondary)"
              }}>{request.quantity}</td>
                        <td style={{
                padding: "12px",
                color: "var(--text-secondary)"
              }}>
                          {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                }) : "—"}
                        </td>
                        <td style={{
                padding: "12px",
                color: "var(--text-secondary)"
              }}>{request.requestedByName || "—"}</td>
                      </tr>) : <tr data-dev-section="1" data-dev-section-key="tech-consumables-requests-empty-row" data-dev-section-type="empty-state" data-dev-section-parent="tech-consumables-request-auto-data-table-1-rows" style={{
              background: "var(--surface)"
            }}>
                      <td colSpan={5} style={{
                padding: "18px 12px",
                color: "var(--text-secondary)",
                textAlign: "center"
              }}>
                        No consumable requests match the current filter.
                      </td>
                    </tr>}
                </tbody>
              </DevLayoutSection>
            </DevLayoutSection>}
        </DevLayoutSection>
      </div>
      {showStockCheck && <StockCheckPopup open={showStockCheck} onClose={() => setShowStockCheck(false)} isManager={isWorkshopManager} technicianId={dbUserId} onRequestsSubmitted={fetchRequests} />}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
