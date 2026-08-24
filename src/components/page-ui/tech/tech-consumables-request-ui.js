// file location: src/components/page-ui/tech/tech-consumables-request-ui.js
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import PopupModal from "@/components/popups/popupStyleApi";
import { MonthPickerField } from "@/components/ui/monthPickerAPI";

// Quantity steppers intentionally use the compact 32px table-control geometry.
// Lock every sizing axis so the global 44px raw-button floor cannot distort the circles.
const quantityCircleButtonStyle = {
  width: "var(--table-action-btn-height)",
  minWidth: "var(--table-action-btn-height)",
  maxWidth: "var(--table-action-btn-height)",
  height: "var(--table-action-btn-height)",
  minHeight: "var(--table-action-btn-height)",
  maxHeight: "var(--table-action-btn-height)",
  flex: "0 0 var(--table-action-btn-height)",
  aspectRatio: "1 / 1",
  padding: 0,
  borderRadius: "50%",
  lineHeight: 1,
};

const quantityInputStyle = {
  width: "72px",
  height: "var(--table-action-btn-height)",
  minHeight: "var(--table-action-btn-height)",
  maxHeight: "var(--table-action-btn-height)",
  padding: "0 8px",
  textAlign: "center",
};

export default function TechConsumableRequestPageUi(props) {
  const {
    DevLayoutSection,
    Link,
    SearchBar,
    addStockItemToSelection,
    addingTemporaryItem,
    applyStockSearch,
    cardStyle,
    clearStockSearch,
    createTemporaryStockItem,
    fieldLabelStyle,
    filteredRequests,
    findStockItemByName,
    handleStockSearchKeyDown,
    isMobile,
    loadingRequests,
    openSendPopup,
    pageWrapperStyle,
    requestCardMetaGridStyle,
    requestCardStyle,
    requestError,
    requestForm,
    requestMonth,
    requestPanelStyle,
    requestsToolbarStyle,
    removeSelectedStockItem,
    searchTerm,
    selectedStockItems,
    sendError,
    sendLoading,
    sendSelectedByEmail,
    sendSelectedToRequests,
    setRequestForm,
    setRequestMonth,
    setSearchTerm,
    setShowSendPopup,
    setShowStockList,
    showSendPopup,
    showStockList,
    statusBadgeStyles,
    stockError,
    stockItems,
    stockLoading,
    stockMatches,
    successMessage,
    tableHeaderStyle,
    updateSelectedStockQuantity,
    visibleStockItems,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <DevLayoutSection sectionKey="tech-consumables-access-shell" sectionType="page-shell" shell widthMode="page" style={{
    padding: "40px",
    maxWidth: "720px",
    margin: "0 auto"
  }}>
          <LayerSurface as="section" sectionKey="tech-consumables-access-card" parentKey="tech-consumables-access-shell" sectionType="content-card" style={{
      ...cardStyle,
      textAlign: "center"
    }}>
            <h1 style={{
        color: "var(--primary-selected)",
        marginBottom: "16px"
      }}>
              Technician Access Only
            </h1>
            <p style={{
        marginBottom: "16px",
        color: "var(--grey-accent-dark)"
      }}>
              This page is reserved for workshop technicians to request
              consumables. Please navigate back to the news feed if this was in
              error.
            </p>
            <DevLayoutSection as="div" sectionKey="tech-consumables-access-action" parentKey="tech-consumables-access-card" sectionType="floating-action" backgroundToken="transparent">
              <Link href="/newsfeed" style={{
          display: "inline-block",
          padding: "var(--control-padding)",
          borderRadius: "var(--control-radius)",
          background: "var(--primary)",
          color: "var(--onAccentText)",
          fontWeight: 600,
          textDecoration: "none"
        }}>
                Return to news feed
              </Link>
            </DevLayoutSection>
          </LayerSurface>
        </DevLayoutSection>
      </>; // render extracted page section.

    case "section2":
      return <>
      <div style={pageWrapperStyle}>
        <LayerTheme as="section" sectionKey="tech-consumables-request-panel" sectionType="content-card" style={requestPanelStyle}>
          <DevLayoutSection as="div" sectionKey="tech-consumables-stock-workspace" parentKey="tech-consumables-request-panel" sectionType="form-grid" backgroundToken="transparent" style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}>
            <DevLayoutSection as="div" sectionKey="tech-consumables-item-field" parentKey="tech-consumables-stock-workspace" sectionType="form-block" backgroundToken="surface" style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary-selected)" }}>Stock Check</h2>
                <span style={{ color: "var(--text-1)", fontSize: "0.9rem" }}>
                  {stockLoading ? "Loading…" : `${stockItems.length} items`}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", width: "100%" }}>
                <SearchBar
                  value={requestForm.partName}
                  onChange={(event) => setRequestForm({ partName: event.target.value })}
                  onClear={clearStockSearch}
                  onKeyDown={handleStockSearchKeyDown}
                  placeholder="Search consumables"
                  inputMode="search"
                  enterKeyHint="search"
                  style={{ flex: "1 1 220px", minWidth: "200px" }}
                />
                <Button type="button" onClick={applyStockSearch} variant="secondary" disabled={stockLoading}>
                  Search
                </Button>
                <Button type="button" onClick={() => setShowStockList((previous) => !previous)} variant="secondary" disabled={stockLoading || stockItems.length === 0}>
                  {showStockList ? "Hide list" : "Show list"}
                </Button>
                <Button type="button" onClick={openSendPopup} variant="primary" disabled={selectedStockItems.length === 0}>
                  Send
                </Button>
              </div>
              {requestForm.partName.trim() && <DevLayoutSection as="div" sectionKey="tech-consumables-stock-suggestions" parentKey="tech-consumables-item-field" sectionType="content-card" backgroundToken="surface-light" style={{
            marginTop: "4px",
            border: "none",
            borderRadius: "var(--control-radius)",
            padding: "8px",
            background: "var(--surface)",
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
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                alignContent: "flex-start",
                gap: "8px",
                width: "100%"
              }}>
                        {stockMatches.map(item => <Button key={item.id} type="button" onClick={() => addStockItemToSelection(item)} variant="secondary" size="sm" style={{ flex: "0 1 auto", maxWidth: "100%" }}>
                            Add {item.name}
                          </Button>)}
                      </div>
                    </> : <span style={{
              color: "var(--grey-accent-dark)",
              fontSize: "0.85rem"
            }}>
                      No matching stock items. Add this item to stock to include it below.
                    </span>}
                  {requestForm.partName.trim() && !stockLoading && !findStockItemByName(requestForm.partName) && <Button type="button" onClick={() => createTemporaryStockItem(requestForm.partName.trim())} busy={addingTemporaryItem} variant="secondary" size="sm" style={{ alignSelf: "flex-start" }}>
                      {`Add "${requestForm.partName.trim()}" to stock`}
                    </Button>}
                  {stockError && <span style={{
              color: "var(--primary-selected)",
              fontSize: "0.8rem"
            }}>{stockError}</span>}
                </DevLayoutSection>}
            </DevLayoutSection>

            {showStockList && (
              <DevLayoutSection as="div" sectionKey="tech-consumables-stock-list" parentKey="tech-consumables-stock-workspace" sectionType="list" backgroundToken="transparent" style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
                {visibleStockItems.length > 0 ? visibleStockItems.map((item) => (
                  <Button key={item.id} type="button" onClick={() => addStockItemToSelection(item)} variant="secondary" size="sm" style={{ alignSelf: "flex-start" }}>
                    Add {item.name}
                  </Button>
                )) : (
                  <p style={{ margin: 0, color: "var(--text-1)" }}>No consumables match the current search.</p>
                )}
              </DevLayoutSection>
            )}

            <LayerSurface as="div" sectionKey="tech-consumables-selected-table-shell" parentKey="tech-consumables-stock-workspace" sectionType="data-table-shell" padding="0" style={{ overflowX: "auto" }}>
              <table className="app-data-table" style={{ width: "100%", minWidth: "520px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "88px" }}>Select</th>
                    <th>Consumable name</th>
                    <th style={{ width: "210px" }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStockItems.length > 0 ? selectedStockItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input type="checkbox" checked onChange={() => removeSelectedStockItem(item.id)} aria-label={`Remove ${item.name} from the request`} />
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <button className="app-table-action-btn" type="button" onClick={() => updateSelectedStockQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1} aria-label={`Decrease quantity for ${item.name}`} style={quantityCircleButtonStyle}>-</button>
                          <input className="app-input" type="number" min="1" max="999" step="1" inputMode="numeric" value={item.quantity} onChange={(event) => updateSelectedStockQuantity(item.id, event.target.value)} aria-label={`Quantity for ${item.name}`} style={quantityInputStyle} />
                          <button className="app-table-action-btn" type="button" onClick={() => updateSelectedStockQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= 999} aria-label={`Increase quantity for ${item.name}`} style={quantityCircleButtonStyle}>+</button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", color: "var(--text-1)" }}>
                        Search for a consumable and add it to begin the stock check.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </LayerSurface>
          </DevLayoutSection>
        </LayerTheme>

        <DevLayoutSection as="section" sectionKey="tech-consumables-requests-panel" sectionType="section-shell" shell backgroundToken="accent" className="app-layout-surface-accent">
          <DevLayoutSection as="div" sectionKey="tech-consumables-requests-toolbar" parentKey="tech-consumables-requests-panel" sectionType="toolbar" backgroundToken="transparent" style={requestsToolbarStyle}>
            <h2 style={{
          margin: 0,
          fontSize: "1.2rem",
          color: "var(--primary-selected)"
        }}>Requests</h2>
            <DevLayoutSection as="div" sectionKey="tech-consumables-requests-filters" parentKey="tech-consumables-requests-toolbar" sectionType="filter-row" backgroundToken="transparent" style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "flex-end",
          gap: "10px",
          width: isMobile ? "100%" : "auto"
        }}>
              <DevLayoutSection as="div" sectionKey="tech-consumables-requests-month" parentKey="tech-consumables-requests-filters" sectionType="filter-row" backgroundToken="search-surface" style={{
            width: isMobile ? "100%" : "320px"
          }}>
                <MonthPickerField
                  value={requestMonth}
                  onValueChange={setRequestMonth}
                  aria-label="Filter requests by month"
                />
              </DevLayoutSection>
              <DevLayoutSection as="div" sectionKey="tech-consumables-requests-search" parentKey="tech-consumables-requests-filters" sectionType="filter-row" backgroundToken="search-surface" style={{
            maxWidth: isMobile ? "100%" : "240px",
            width: "100%"
          }}>
                <SearchBar placeholder="Search requests" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} onClear={() => setSearchTerm("")} style={{
              maxWidth: isMobile ? "100%" : "240px"
            }} />
              </DevLayoutSection>
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
        color: "var(--primary-selected)"
      }}>
              {requestError}
            </DevLayoutSection>}

          {isMobile ? <DevLayoutSection as="div" sectionKey="tech-consumables-request-mobile-list" parentKey="tech-consumables-requests-panel" sectionType="list" backgroundToken="surface" style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
              {loadingRequests ? <LayerSurface padding="14px" gap="12px" style={{
          ...requestCardStyle,
          textAlign: "center",
          color: "var(--text-1)"
        }}>
                  Loading requests…
                </LayerSurface> : filteredRequests.length > 0 ? filteredRequests.map(request => <LayerSurface key={request.id} as="article" sectionKey={`tech-consumables-request-mobile-card-${request.id}`} sectionType="content-card" parentKey="tech-consumables-request-mobile-list" padding="14px" gap="12px" style={requestCardStyle}>
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
                color: "var(--text-1)",
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
                        {request.status === "fulfilled" || request.status === "arrived" ? "✅" : request.status === "urgent" ? "⏰" : request.status === "rejected" ? "✖️" : "📦"}
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
                color: "var(--text-1)",
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
                color: "var(--text-1)"
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
                color: "var(--text-1)",
                wordBreak: "break-word"
              }}>
                          {request.requestedByName || "—"}
                        </div>
                      </div>
                    </div>
                  </LayerSurface>) : <LayerSurface padding="14px" gap="12px" style={{
          ...requestCardStyle,
          textAlign: "center",
          color: "var(--text-1)"
        }}>
                  No consumable requests match the current filter.
                </LayerSurface>}
            </DevLayoutSection> : <LayerSurface as="div" sectionKey="tech-consumables-request-auto-data-table-1-shell" parentKey="tech-consumables-requests-panel" sectionType="data-table-shell" padding="0" style={{
        overflowX: "auto",
        maxHeight: "604px",
        overflowY: "auto"
      }}>
              <DevLayoutSection as="table" sectionKey="tech-consumables-request-auto-data-table-1" parentKey="tech-consumables-request-auto-data-table-1-shell" sectionType="data-table" backgroundToken="surface" className="app-data-table" style={{
          minWidth: "640px",
          background: "var(--surface)"
        }}>
                <thead data-dev-section="1" data-dev-section-key="tech-consumables-request-auto-data-table-1-headings" data-dev-section-type="table-headings" data-dev-section-parent="tech-consumables-request-auto-data-table-1" style={{
            // Opaque sticky header: --theme-hover is translucent, so composite it over
            // opaque --surface so scrolling rows never read through the heading.
            background: "linear-gradient(var(--theme-hover), var(--theme-hover)), var(--surface)",
            position: "sticky",
            top: 0,
            zIndex: 1
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
                color: "var(--text-1)",
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
                  justifyContent: "center",
                  gap: "6px",
                  height: "32px",
                  padding: "0 14px",
                  borderRadius: "var(--radius-pill)",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  ...(statusBadgeStyles[request.status] || statusBadgeStyles.pending)
                }}>
                            {request.status === "fulfilled" || request.status === "arrived" ? "✅" : request.status === "urgent" ? "⏰" : request.status === "rejected" ? "✖️" : "📦"}
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td style={{
                padding: "12px",
                fontWeight: 600,
                color: "var(--text-1)"
              }}>{request.itemName}</td>
                        <td style={{
                padding: "12px",
                color: "var(--text-1)"
              }}>{request.quantity}</td>
                        <td style={{
                padding: "12px",
                color: "var(--text-1)"
              }}>
                          {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                }) : "—"}
                        </td>
                        <td style={{
                padding: "12px",
                color: "var(--text-1)"
              }}>{request.requestedByName || "—"}</td>
                      </tr>) : <tr data-dev-section="1" data-dev-section-key="tech-consumables-requests-empty-row" data-dev-section-type="empty-state" data-dev-section-parent="tech-consumables-request-auto-data-table-1-rows" style={{
              background: "var(--surface)"
            }}>
                      <td colSpan={5} style={{
                padding: "18px 12px",
                color: "var(--text-1)",
                textAlign: "center"
              }}>
                        No consumable requests match the current filter.
                      </td>
                    </tr>}
                </tbody>
              </DevLayoutSection>
            </LayerSurface>}
        </DevLayoutSection>
      </div>
      <PopupModal
        isOpen={showSendPopup}
        onClose={sendLoading ? undefined : () => setShowSendPopup(false)}
        closeOnBackdrop={false}
        ariaLabel="Send consumable request"
        cardStyle={{ width: "min(100%, 620px)", padding: "var(--section-card-padding)" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}>
          <div className="app-popup-compact-header">
            <h2 style={{ margin: 0, color: "var(--primary-selected)" }}>Send consumable request</h2>
            <div className="app-popup-compact-header__actions">
              <Button type="button" onClick={sendSelectedToRequests} busy={sendLoading} variant="primary" size="sm">
                Send to Requests
              </Button>
              <Button type="button" onClick={sendSelectedByEmail} variant="secondary" size="sm" disabled={sendLoading}>
                Send Email
              </Button>
              <Button type="button" onClick={() => setShowSendPopup(false)} variant="secondary" size="sm" disabled={sendLoading}>
                Close
              </Button>
            </div>
          </div>
          <div style={{
            width: "100%",
            overflowX: "auto",
            overflowY: selectedStockItems.length > 10 ? "auto" : "visible",
            maxHeight: selectedStockItems.length > 10 ? "484px" : "none", // One 44px heading plus ten global 44px table rows.
          }}>
            <table className="app-data-table app-data-table--rounded" aria-label="Consumables ready to send">
              <thead>
                <tr style={{ height: "var(--table-row-height)" }}>
                  <th>Consumable name</th>
                  <th style={{ width: "120px" }}>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {selectedStockItems.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sendError && <p role="alert" style={{ margin: 0, color: "var(--primary-selected)", fontWeight: 600 }}>{sendError}</p>}
        </div>
      </PopupModal>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
