// file location: src/components/page-ui/parts/parts-goods-in-ui.js
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import { useState } from "react";

export default function GoodsInPageUi(props) {
  const [historySearch, setHistorySearch] = useState("");
  const {
    ADVANCED_TABS,
    CalendarField,
    CompletionPrompt,
    ConfirmationDialog,
    DropdownField,
    FRANCHISE_OPTIONS,
    GoodsInPartSearchModal,
    JobAssignmentModal,
    PRICE_LEVEL_OPTIONS,
    ScrollArea,
    SupplierSearchModal,
    TabGroup,
    VAT_RATE_OPTIONS,
    actingUserNumeric,
    actingUserUuid,
    activeTab,
    addPartFieldStyle,
    addPartInputStyle,
    addressFieldStyle,
    completing,
    completionSummary,
    completionPromptOpen,
    confirmDialog,
    createDefaultPartForm,
    currencyFormatter,
    dangerButtonStyle,
    duplicateCandidate,
    fetchGoodsIn,
    fetchRecentGoodsIn,
    fieldGridStyle,
    fileInputRef,
    filteredBinLocations,
    goodsInItems,
    goodsInRecord,
    handleAddPart,
    handleCompleteGoodsIn,
    handleCompletionDismiss,
    handleFinishGoodsIn,
    handleIncreaseExistingLine,
    handleInvoiceChange,
    handleJobItemsAssigned,
    handleNestedPartChange,
    handlePartChange,
    handlePartSelected,
    handleRemoveItem,
    handleSalePriceChange,
    handleScanDocChange,
    handleScanDocClick,
    handleSupplierSelected,
    inputStyle,
    invoiceCellStyle,
    invoiceForm,
    invoiceHeaderCellStyle,
    invoiceRowStyle,
    invoiceScanPayload,
    invoiceTableStyles,
    isAdvancedPanelOpen,
    jobModalOpen,
    labelStyle,
    notesTextareaStyle,
    partError,
    partForm,
    partNumberInputRef,
    partSearchOpen,
    primaryButtonStyle,
    recentError,
    recentGoodsIn,
    recentLoading,
    removingItemId,
    savingPart,
    scanBusy,
    secondaryButtonStyle,
    sectionCardStyle,
    selectedCatalogPart,
    setActiveTab,
    setCompletionPromptOpen,
    setConfirmDialog,
    setDuplicateCandidate,
    setIsAdvancedPanelOpen,
    setJobModalOpen,
    setPartForm,
    setPartSearchOpen,
    setShowBinSuggestions,
    setSupplierModalOpen,
    setTimeout,
    showBinSuggestions,
    splitFieldRowStyle,
    supplierModalOpen,
    textareaStyle,
    toast,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <div style={{
    padding: "32px"
  }}>
          <h1 style={{
      marginBottom: "12px"
    }}>Goods In</h1>
          <p>You do not have permission to access this workspace.</p>
        </div>
      </>; // render extracted page section.

    case "section2":
      return <>
      <style jsx>{`
        .bin-suggestions {
          background: rgba(var(--surface-rgb), 0.98);
          box-shadow: 0 24px 48px rgba(15, 23, 42, 0.12);
        }
        .bin-suggestion-button:hover,
        .bin-suggestion-button:focus-visible {
          background: rgba(var(--primary-rgb), 0.08);
          outline: none;
        }
        .bin-suggestion-button.is-selected {
          background: rgba(var(--primary-rgb), 0.15);
        }
        [data-theme="dark"] .bin-suggestions {
          background: rgba(15, 23, 42, 0.95);
          box-shadow: 0 30px 50px rgba(0, 0, 0, 0.55);
        }
        [data-theme="dark"] .bin-suggestion-button {
          color: var(--text-1);
        }
        .add-part-section {
          padding: 20px 22px;
          gap: 16px;
        }
        .add-part-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .add-part-fields-shell {
          background: var(--surface);
          border-radius: var(--control-radius);
          padding: 12px;
          overflow: visible;
        }
        .add-part-fields-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(160px, 1fr));
          gap: 10px;
        }
        .add-part-fields-row-span-3 {
          grid-template-columns: repeat(3, minmax(160px, 1fr));
          margin-top: 10px;
        }
        .no-spinner-number {
          appearance: textfield;
          -moz-appearance: textfield;
        }
        .no-spinner-number::-webkit-outer-spin-button,
        .no-spinner-number::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .add-part-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .invoice-details-section {
          padding: 20px 22px;
          gap: 16px;
        }
        .invoice-details-shell {
          background: var(--surface);
          border-radius: var(--control-radius);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .invoice-details-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .invoice-details-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
          width: 100%;
        }
        .invoice-details-field :global(input),
        .invoice-details-field :global(textarea),
        .invoice-details-field :global(select),
        .invoice-details-field :global(.dropdown-api),
        .invoice-details-field :global(.calendar-api),
        .invoice-details-field .compact-dropdown,
        .invoice-details-field .compact-calendar {
          min-width: 0;
          width: 100%;
        }
        .goods-in-draft-header {
          display: grid;
          grid-template-columns: minmax(220px, 1.4fr) repeat(4, minmax(92px, 0.55fr));
          gap: 12px;
          align-items: center;
        }
        .goods-in-draft-title h1 {
          margin: 2px 0 0;
          font-size: var(--text-h2);
          color: var(--accentText);
          letter-spacing: -0.02em;
        }
        .goods-in-metric {
          min-width: 0;
          font-variant-numeric: tabular-nums;
        }
        .goods-in-metric small {
          display: block;
          color: var(--text-1);
          margin-bottom: 3px;
        }
        .goods-in-metric strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .goods-in-context-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
          gap: 10px;
        }
        .goods-in-context-block {
          min-width: 0;
        }
        .goods-in-summary-strip {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 0.86rem;
          font-variant-numeric: tabular-nums;
        }
        .goods-in-support-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
          gap: var(--page-stack-gap);
          align-items: start;
        }
        .goods-in-table-scroll {
          overflow-x: auto;
        }
        @media (max-width: 900px) {
          .add-part-section {
            padding: 16px;
          }
          .invoice-details-section {
            padding: 16px;
          }
          .add-part-fields-grid,
          .add-part-fields-row-span-3 {
            grid-template-columns: repeat(2, minmax(140px, 1fr));
          }
          .add-part-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .goods-in-draft-header {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .goods-in-draft-title {
            grid-column: 1 / -1;
          }
          .goods-in-support-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 560px) {
          .add-part-fields-grid,
          .add-part-fields-row-span-3,
          .goods-in-draft-header {
            grid-template-columns: 1fr;
          }
          .goods-in-draft-title {
            grid-column: auto;
          }
        }
      `}</style>
      <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    width: "100%",
    maxWidth: "100%",
    padding: "8px 0"
  }}>
        {toast && <div style={{
      padding: "12px 16px",
      borderRadius: "var(--radius-sm)",
      background: toast.type === "error" ? "var(--danger-surface)" : toast.type === "success" ? "var(--success-surface)" : "var(--theme)",
      color: toast.type === "error" ? "var(--danger)" : toast.type === "success" ? "var(--success-dark)" : "var(--info)"
    }}>
            {toast.message}
          </div>}

        {(() => {
          const totalUnits = goodsInItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
          const totalCost = goodsInItems.reduce((sum, item) => sum + Number(item.cost_price || 0) * Number(item.quantity || 0), 0);
          const ledgerReady = Boolean(invoiceForm.supplierAccountId);
          const status = goodsInRecord?.status || "not started";
          return <LayerTheme as="header" sectionKey="goods-in-draft-header" parentKey="app-layout-page-card" style={sectionCardStyle}>
            <div className="goods-in-draft-header">
              <div className="goods-in-draft-title">
                <small style={{ color: "var(--text-1)" }}>{goodsInRecord ? "Draft goods in" : "New goods in"}</small>
                <h1>{goodsInRecord?.goods_in_number || "GIN assigned on first line"}</h1>
                <div style={{ marginTop: 5, color: ledgerReady ? "var(--success-dark)" : "var(--danger)", fontWeight: 600 }}>
                  {ledgerReady ? `Ledger linked · ${invoiceForm.supplierAccountNumber || invoiceForm.supplierAccountId}` : "Supplier ledger link required"}
                </div>
              </div>
              <div className="goods-in-metric"><small>Supplier</small><strong>{invoiceForm.supplierName || "Not selected"}</strong></div>
              <div className="goods-in-metric"><small>Invoice / delivery</small><strong>{invoiceForm.invoiceNumber || "—"} · {invoiceForm.deliveryNoteNumber || "—"}</strong></div>
              <div className="goods-in-metric"><small>Status</small><strong>{status}</strong></div>
              <div className="goods-in-metric"><small>Lines / units</small><strong>{goodsInItems.length} / {totalUnits}</strong></div>
              <div className="goods-in-metric"><small>Current cost</small><strong>{currencyFormatter.format(totalCost)}</strong></div>
            </div>
          </LayerTheme>;
        })()}

        <LayerTheme
          as="section"
          data-presentation="goods-in-invoice"
          sectionKey="goods-in-invoice-details"
          parentKey="app-layout-page-card"
          style={sectionCardStyle}
          className="invoice-details-section"
        >
          <div className="invoice-details-toolbar">
            <h2 style={{
          margin: 0
        }}>Invoice details</h2>
            <div style={{
          display: "flex",
          gap: "10px"
        }}>
              <button style={primaryButtonStyle(false)} onClick={() => setSupplierModalOpen(true)}>
                Supplier search
              </button>
              <button style={secondaryButtonStyle} onClick={handleScanDocClick} disabled={scanBusy}>
                {scanBusy ? "Scanning..." : "Scan doc"}
              </button>
              <input ref={fileInputRef} type="file" accept=".txt,.pdf,.csv,.json,.doc,.docx,.jpg,.png" style={{
            display: "none"
          }} onChange={handleScanDocChange} />
            </div>
          </div>
          <div className="invoice-details-shell">
            <div style={{
              ...fieldGridStyle,
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))"
            }}>
              <div className="invoice-details-field">
                <label style={labelStyle}>Supplier</label>
                <input style={inputStyle} value={invoiceForm.supplierName} onChange={event => handleInvoiceChange("supplierName", event.target.value)} placeholder="Supplier name" />
                {invoiceForm.supplierAccountNumber && <small style={{
              color: "var(--text-1)"
            }}>
                    Account #{invoiceForm.supplierAccountNumber}
                  </small>}
              </div>
              <div className="invoice-details-field">
                <label style={labelStyle}>Invoice number</label>
                <input style={inputStyle} value={invoiceForm.invoiceNumber} onChange={event => handleInvoiceChange("invoiceNumber", event.target.value)} placeholder="INV-001" />
              </div>
              <div className="invoice-details-field">
                <label style={labelStyle}>Delivery note number</label>
                <input style={inputStyle} value={invoiceForm.deliveryNoteNumber} onChange={event => handleInvoiceChange("deliveryNoteNumber", event.target.value)} placeholder="DN-001" />
              </div>
              <div className="invoice-details-field">
                <label style={labelStyle}>Invoice date</label>
                <div className="compact-calendar">
                  <CalendarField value={invoiceForm.invoiceDate} onChange={event => handleInvoiceChange("invoiceDate", event.target.value)} name="invoiceDate" helperText="" style={{
                width: "100%"
              }} />
                </div>
              </div>
              <div className="invoice-details-field">
                <label style={labelStyle}>Price level</label>
                <div className="compact-dropdown">
                  <DropdownField value={invoiceForm.priceLevel} onChange={event => handleInvoiceChange("priceLevel", event.target.value)} style={{
                width: "100%"
              }} placeholder="Select price level">
                    {PRICE_LEVEL_OPTIONS.map(option => <option key={option.value} value={option.value}>
                        {option.label}
                      </option>)}
                  </DropdownField>
                </div>
              </div>
              <div className="invoice-details-field">
                <label style={labelStyle}>Franchise</label>
                <div className="compact-dropdown">
                  <DropdownField value={partForm.franchise} onChange={event => handlePartChange("franchise", event.target.value)} style={{
                width: "100%"
              }} placeholder="Select franchise">
                    {FRANCHISE_OPTIONS.map(option => <option key={option} value={option}>
                        {option}
                      </option>)}
                  </DropdownField>
                </div>
              </div>
              <div className="invoice-details-field">
                <label style={labelStyle}>Supplier contact</label>
                <input style={inputStyle} value={invoiceForm.supplierContact} onChange={event => handleInvoiceChange("supplierContact", event.target.value)} placeholder="Phone or email" />
              </div>
            </div>
            <div style={splitFieldRowStyle}>
              <div>
                <label style={labelStyle}>Supplier address</label>
                <div style={addressFieldStyle}>
                  {invoiceForm.supplierAddress || "—"}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea className="app-notes-input" style={notesTextareaStyle} value={invoiceForm.notes} onChange={event => handleInvoiceChange("notes", event.target.value)} placeholder="Internal notes" />
              </div>
            </div>
            {invoiceScanPayload && <div style={{
          fontSize: "0.85rem",
          color: "var(--text-1)"
        }}>
                Last scan: {invoiceScanPayload.fileName} ·
                {invoiceScanPayload.extracted.invoiceNumber && ` Invoice ${invoiceScanPayload.extracted.invoiceNumber}`}
              </div>}
          </div>
        </LayerTheme>

        <LayerTheme
          as="section"
          data-presentation="goods-in-add-part"
          sectionKey="goods-in-add-part"
          parentKey="app-layout-page-card"
          style={sectionCardStyle}
          className="add-part-section"
        >
          <div className="add-part-toolbar">
            <h2 style={{
          margin: 0
        }}>Add part</h2>
            <button style={primaryButtonStyle(false)} onClick={() => setPartSearchOpen(true)}>
              Search catalogue
            </button>
          </div>
          {partError && <div style={{
        border: "none",
        borderRadius: "var(--radius-sm)",
        padding: "10px 14px",
        color: "var(--danger)",
        background: "var(--danger-surface)"
      }}>
              {partError}
            </div>}
          {duplicateCandidate && <div className="app-status-message app-status-message--warning" role="status">
              <div><strong>This part is already on line {duplicateCandidate.line_number || "—"}.</strong> Increase that line by {partForm.quantity || 1}, or keep a separate invoice line.</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button type="button" style={primaryButtonStyle(savingPart)} onClick={handleIncreaseExistingLine} disabled={savingPart}>Increase existing line</button>
                <button type="button" style={secondaryButtonStyle} onClick={() => handleAddPart({ allowDuplicate: true })} disabled={savingPart}>Add separate line</button>
                <button type="button" style={secondaryButtonStyle} onClick={() => setDuplicateCandidate(null)} disabled={savingPart}>Review entry</button>
              </div>
            </div>}
          <div className="add-part-fields-shell">
            <div className="add-part-fields-grid">
              <div style={addPartFieldStyle}>
                <label style={labelStyle}>Part number</label>
                <input ref={partNumberInputRef} autoComplete="off" style={addPartInputStyle} value={partForm.partNumber} onKeyDown={event => {
              if (event.key === "Enter") {
                event.preventDefault();
                setPartSearchOpen(true);
              }
            }} onChange={event => handlePartChange("partNumber", event.target.value)} placeholder="e.g., FPAD1" />
              </div>
              <div style={addPartFieldStyle}>
                <label style={labelStyle}>Quantity</label>
                <input className="no-spinner-number" type="number" style={addPartInputStyle} min="0" value={partForm.quantity} onChange={event => {
              const nextValue = event.target.value;
              handlePartChange("quantity", nextValue === "" ? "" : Number(nextValue));
            }} />
              </div>
              <div style={addPartFieldStyle}>
                <label style={labelStyle}>Retail price</label>
                <input style={addPartInputStyle} value={partForm.retailPrice} onChange={event => handlePartChange("retailPrice", event.target.value)} placeholder="0.00" />
              </div>
              <div style={addPartFieldStyle}>
                <label style={labelStyle}>Cost price</label>
                <input style={addPartInputStyle} value={partForm.costPrice} onChange={event => handlePartChange("costPrice", event.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="add-part-fields-grid add-part-fields-row-span-3">
              <div style={{
            ...addPartFieldStyle,
            position: "relative",
            zIndex: showBinSuggestions ? 20 : "auto"
          }}>
                <label style={labelStyle}>Bin location</label>
                <input type="text" style={addPartInputStyle} value={partForm.binLocation} onChange={event => handlePartChange("binLocation", event.target.value)} onFocus={() => setShowBinSuggestions(true)} onBlur={() => {
              setTimeout(() => setShowBinSuggestions(false), 120);
            }} placeholder="A1" />
                {showBinSuggestions && partForm.binLocation.trim() !== "" && <div className="bin-suggestions" style={{
              position: "absolute",
              top: "100%",
              left: 0,
              width: "100%",
              minWidth: "140px",
              marginTop: "6px",
              maxHeight: "200px",
              overflowY: "auto",
              borderRadius: "var(--radius-sm)",
              zIndex: "var(--z-dropdown)"
            }} onMouseDown={event => event.preventDefault()}>
                    {filteredBinLocations.length === 0 ? <div style={{
                padding: "10px 12px",
                fontSize: "0.9rem",
                color: "var(--text-1)"
              }}>
                        No matches
                      </div> : filteredBinLocations.map(location => <button key={location} type="button" className="bin-suggestion-button" style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "1px solid transparent",
                background: "transparent",
                cursor: "pointer",
                fontSize: "0.9rem",
                color: "var(--text-1)"
              }} onClick={() => {
                handlePartChange("binLocation", location);
                setShowBinSuggestions(false);
              }}>
                          {location}
                        </button>)}
                  </div>}
              </div>
              <div style={addPartFieldStyle}>
                <label style={labelStyle}>Discount code</label>
                <input style={addPartInputStyle} value={partForm.discountCode} onChange={event => handlePartChange("discountCode", event.target.value)} />
              </div>
              <div style={addPartFieldStyle}>
                <label style={labelStyle}>Description</label>
                <input type="text" style={addPartInputStyle} value={partForm.description} onChange={event => handlePartChange("description", event.target.value)} placeholder="Description" />
              </div>
            </div>
          </div>

          <div className="goods-in-context-grid" aria-live="polite">
            {selectedCatalogPart ? <>
              <LayerSurface as="section" className="goods-in-context-block" padding="12px">
                <div style={{ fontWeight: 700 }}>Live stock preview</div>
                <div className="goods-in-summary-strip" style={{ marginTop: 8 }}>
                  <span>On hand <strong>{Number(selectedCatalogPart.qty_in_stock || 0)}</strong></span>
                  <span>Reserved <strong>{Number(selectedCatalogPart.qty_reserved || 0)}</strong></span>
                  <span>Available <strong>{Number(selectedCatalogPart.qty_in_stock || 0) - Number(selectedCatalogPart.qty_reserved || 0)}</strong></span>
                  <span>On order <strong>{Number(selectedCatalogPart.qty_on_order || 0)}</strong></span>
                  <span>After receipt <strong>{Number(selectedCatalogPart.qty_in_stock || 0) + Number(partForm.quantity || 0)}</strong></span>
                </div>
              </LayerSurface>
              <LayerSurface as="section" className="goods-in-context-block" padding="12px">
                <div style={{ fontWeight: 700 }}>Job demand · {selectedCatalogPart.open_job_count || 0}</div>
                {(selectedCatalogPart.linked_jobs || []).length ? <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  {selectedCatalogPart.linked_jobs.slice(0, 4).map((job, index) => <div key={`${job.type}-${job.job_id}-${index}`} style={{ fontSize: "0.86rem" }}>
                    <strong>{job.job_number}</strong> · qty {job.quantity || 1} · {job.status || job.job_waiting_status || "open"}
                  </div>)}
                </div> : <div style={{ color: "var(--text-1)", marginTop: 8 }}>No open job requirement is linked to this catalogue part.</div>}
              </LayerSurface>
              <LayerSurface as="section" className="goods-in-context-block" padding="12px">
                <div style={{ fontWeight: 700 }}>Price and margin check</div>
                {(() => {
                  const oldCost = Number(selectedCatalogPart.unit_cost || 0);
                  const newCost = Number(partForm.costPrice || 0);
                  const retail = Number(partForm.retailPrice || selectedCatalogPart.unit_price || 0);
                  const costChange = newCost - oldCost;
                  const costPercent = oldCost ? costChange / oldCost * 100 : 0;
                  const margin = retail ? (retail - newCost) / retail * 100 : 0;
                  const warning = margin < 15 || costChange > 0;
                  return <div style={{ marginTop: 8, color: warning ? "var(--warning-dark)" : "var(--text-1)" }}>
                    Cost {costChange >= 0 ? "+" : ""}{currencyFormatter.format(costChange)} ({costPercent >= 0 ? "+" : ""}{costPercent.toFixed(1)}%) · margin {margin.toFixed(1)}%
                    {margin < 15 ? " · Low margin—check pricing before completion." : ""}
                  </div>;
                })()}
              </LayerSurface>
            </> : partForm.partNumber.trim() ? <LayerSurface as="section" className="goods-in-context-block" padding="12px" style={{ color: "var(--warning-dark)" }}>
              <strong>Unknown catalogue part.</strong> Completion will create a new active catalogue record after validation.
            </LayerSurface> : <LayerSurface as="section" className="goods-in-context-block" padding="12px" style={{ color: "var(--text-1)" }}>
              Select a catalogue part to preview stock, open job demand and price variance.
            </LayerSurface>}
          </div>

          {isAdvancedPanelOpen && <div style={{
        marginTop: "12px"
      }}>
              <TabGroup className="tab-api--wrap" devSectionKey="goods-in-advanced-tabs" devSectionParent="goods-in-add-part" items={ADVANCED_TABS.map(tab => ({ value: tab.id, label: tab.label }))} value={activeTab} onChange={setActiveTab} ariaLabel="Advanced part detail tabs" />
              <div style={{
          marginTop: "14px"
        }}>
                {activeTab === "global" && <LayerSurface
                  as="section"
                  sectionKey="goods-in-global-details"
                  parentKey="goods-in-add-part"
                  style={sectionCardStyle}
                >
                    <div style={fieldGridStyle}>
                      <div>
                        <label style={labelStyle}>Surcharge</label>
                        <input style={inputStyle} value={partForm.surcharge} onChange={event => handlePartChange("surcharge", event.target.value)} placeholder="0.00" />
                      </div>
                      <div>
                        <label style={labelStyle}>VAT rate</label>
                        <DropdownField value={partForm.vatRate} onChange={event => handlePartChange("vatRate", event.target.value)} style={{
                  width: "100%"
                }} placeholder="Select VAT rate">
                          {VAT_RATE_OPTIONS.map(option => <option key={option.value} value={option.value}>
                              {option.label}
                            </option>)}
                        </DropdownField>
                        {partForm.vatRate === "custom" && <input style={{
                  ...inputStyle,
                  marginTop: "6px"
                }} value={partForm.vatRateCustomValue} onChange={event => handlePartChange("vatRateCustomValue", event.target.value)} placeholder="Enter custom rate" />}
                      </div>
                      <div>
                        <label style={labelStyle}>Pack size</label>
                        <input style={inputStyle} value={partForm.packSize} onChange={event => handlePartChange("packSize", event.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Sales price tiers</label>
                        <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: "8px"
                }}>
                          {partForm.salePrices.map((entry, index) => <input key={entry.label} style={inputStyle} placeholder={entry.label} value={entry.price} onChange={event => handleSalePriceChange(index, event.target.value)} />)}
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Purchase details</label>
                        <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: "8px"
                }}>
                          <input style={inputStyle} placeholder="Stock order" value={partForm.purchaseDetails.stockOrder} onChange={event => handleNestedPartChange("purchaseDetails", "stockOrder", event.target.value)} />
                          <input style={inputStyle} placeholder="VOR cost" value={partForm.purchaseDetails.vorCost} onChange={event => handleNestedPartChange("purchaseDetails", "vorCost", event.target.value)} />
                          <input style={inputStyle} placeholder="Local cost" value={partForm.purchaseDetails.localCost} onChange={event => handleNestedPartChange("purchaseDetails", "localCost", event.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Receiving discrepancy</label>
                        <DropdownField value={partForm.customAttributes.receivingDiscrepancy || ""} onChange={event => handleNestedPartChange("customAttributes", "receivingDiscrepancy", event.target.value)} style={{ width: "100%" }} placeholder="No discrepancy">
                          <option value="">No discrepancy</option>
                          <option value="short_supplied">Short supplied</option>
                          <option value="over_supplied">Over supplied</option>
                          <option value="damaged">Damaged</option>
                          <option value="wrong_item">Wrong item</option>
                        </DropdownField>
                      </div>
                      <div>
                        <label style={labelStyle}>Line notes</label>
                        <textarea className="app-notes-input" value={partForm.notes} onChange={event => handlePartChange("notes", event.target.value)} placeholder="Record discrepancy or receiving notes" />
                      </div>
                    </div>
                  </LayerSurface>}
                {activeTab === "dealer" && <div style={fieldGridStyle}>
                    <input style={inputStyle} placeholder="Dealer code" value={partForm.dealerDetails.dealerCode} onChange={event => handleNestedPartChange("dealerDetails", "dealerCode", event.target.value)} />
                    <input style={inputStyle} placeholder="Tier" value={partForm.dealerDetails.tier} onChange={event => handleNestedPartChange("dealerDetails", "tier", event.target.value)} />
                    <textarea className="app-notes-input" placeholder="Dealer notes" value={partForm.dealerDetails.notes} onChange={event => handleNestedPartChange("dealerDetails", "notes", event.target.value)} />
                  </div>}
                {activeTab === "stock" && <div style={fieldGridStyle}>
                    <input style={inputStyle} placeholder="Reorder point" value={partForm.stockDetails.reorderPoint} onChange={event => handleNestedPartChange("stockDetails", "reorderPoint", event.target.value)} />
                    <input style={inputStyle} placeholder="Bin capacity" value={partForm.stockDetails.binCapacity} onChange={event => handleNestedPartChange("stockDetails", "binCapacity", event.target.value)} />
                    <input style={inputStyle} placeholder="Alternate location" value={partForm.stockDetails.alternateLocation} onChange={event => handleNestedPartChange("stockDetails", "alternateLocation", event.target.value)} />
                  </div>}
                {activeTab === "user" && <div style={fieldGridStyle}>
                    <input style={inputStyle} placeholder="Field 1" value={partForm.userDefined.field1} onChange={event => handleNestedPartChange("userDefined", "field1", event.target.value)} />
                    <input style={inputStyle} placeholder="Field 2" value={partForm.userDefined.field2} onChange={event => handleNestedPartChange("userDefined", "field2", event.target.value)} />
                  </div>}
                {activeTab === "links" && <div>
                    {partForm.linkMetadata.map((link, index) => <div key={index} style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginBottom: "8px"
            }}>
                        <input style={inputStyle} placeholder="Label" value={link.label} onChange={event => {
                const next = [...partForm.linkMetadata];
                next[index] = {
                  ...next[index],
                  label: event.target.value
                };
                setPartForm(prev => ({
                  ...prev,
                  linkMetadata: next
                }));
              }} />
                        <input style={inputStyle} placeholder="URL" value={link.url} onChange={event => {
                const next = [...partForm.linkMetadata];
                next[index] = {
                  ...next[index],
                  url: event.target.value
                };
                setPartForm(prev => ({
                  ...prev,
                  linkMetadata: next
                }));
              }} />
                      </div>)}
                    <button style={secondaryButtonStyle} onClick={() => setPartForm(prev => ({
              ...prev,
              linkMetadata: [...prev.linkMetadata, {
                label: "",
                url: ""
              }]
            }))}>
                      Add link
                    </button>
                  </div>}
                {activeTab === "sales" && <div style={fieldGridStyle}>
                    <input type="date" style={inputStyle} value={partForm.salesHistory.lastSoldOn} onChange={event => handleNestedPartChange("salesHistory", "lastSoldOn", event.target.value)} />
                    <input style={inputStyle} placeholder="Last sold price" value={partForm.salesHistory.lastSoldPrice} onChange={event => handleNestedPartChange("salesHistory", "lastSoldPrice", event.target.value)} />
                    <input style={inputStyle} placeholder="Quantity" value={partForm.salesHistory.lastSoldQty} onChange={event => handleNestedPartChange("salesHistory", "lastSoldQty", event.target.value)} />
                  </div>}
                {activeTab === "audi" && <div style={fieldGridStyle}>
                    <input style={inputStyle} placeholder="Programme" value={partForm.audiMetadata.programme} onChange={event => handleNestedPartChange("audiMetadata", "programme", event.target.value)} />
                    <input style={inputStyle} placeholder="Reference" value={partForm.audiMetadata.reference} onChange={event => handleNestedPartChange("audiMetadata", "reference", event.target.value)} />
                    <textarea className="app-notes-input" placeholder="Audi notes" value={partForm.audiMetadata.notes} onChange={event => handleNestedPartChange("audiMetadata", "notes", event.target.value)} />
                  </div>}
                {activeTab === "additional" && <div style={fieldGridStyle}>
                    <input style={inputStyle} placeholder="Warranty" value={partForm.additionalFields.warranty} onChange={event => handleNestedPartChange("additionalFields", "warranty", event.target.value)} />
                    <input style={inputStyle} placeholder="Logistics" value={partForm.additionalFields.logistics} onChange={event => handleNestedPartChange("additionalFields", "logistics", event.target.value)} />
                    <input style={inputStyle} placeholder="Internal tag" value={partForm.additionalFields.internalTag} onChange={event => handleNestedPartChange("additionalFields", "internalTag", event.target.value)} />
                  </div>}
                {activeTab === "online" && <div style={fieldGridStyle}>
                    <label style={{
              ...labelStyle,
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
                      <input type="checkbox" checked={partForm.onlineStore.isListed} onChange={event => handleNestedPartChange("onlineStore", "isListed", event.target.checked)} />
                      Visible in online store
                    </label>
                    <input style={inputStyle} placeholder="Web title" value={partForm.onlineStore.webTitle} onChange={event => handleNestedPartChange("onlineStore", "webTitle", event.target.value)} />
                    <textarea style={textareaStyle} placeholder="Web description" value={partForm.onlineStore.webDescription} onChange={event => handleNestedPartChange("onlineStore", "webDescription", event.target.value)} />
                    <input style={inputStyle} placeholder="Online SKU" value={partForm.onlineStore.onlineSku} onChange={event => handleNestedPartChange("onlineStore", "onlineSku", event.target.value)} />
                  </div>}
              </div>
            </div>}

          <div className="add-part-actions">
            <button onClick={() => setIsAdvancedPanelOpen(state => !state)} style={{
          ...secondaryButtonStyle,
          padding: "8px 14px"
        }}>
              {isAdvancedPanelOpen ? "Hide details" : "Update details"}
            </button>
            <div style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          flexWrap: "nowrap"
        }}>
              <button className="app-btn app-btn--secondary" onClick={() => {
                setPartForm(createDefaultPartForm());
                handlePartChange("partNumber", "");
                setDuplicateCandidate(null);
                requestAnimationFrame(() => partNumberInputRef.current?.focus());
              }} disabled={savingPart}>
                Clear
              </button>
              <button type="button" className="app-btn app-btn--primary" onClick={handleAddPart} disabled={savingPart}>
                {savingPart ? "Adding..." : "Add part"}
              </button>
            </div>
          </div>
        </LayerTheme>

        <LayerTheme
          as="section"
          sectionKey="goods-in-invoice-lines"
          parentKey="app-layout-page-card"
          style={sectionCardStyle}
        >
          <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
            <div style={{
          display: "flex",
          alignItems: "center",
          gap: "16px"
        }}>
              <h2 style={{
            margin: 0
          }}>Invoice lines</h2>
              {goodsInItems.length > 0 && (() => {
            const totalCost = goodsInItems.reduce((sum, item) => {
              const cost = Number(item.cost_price || 0);
              const qty = Number(item.quantity || 0);
              return sum + cost * qty;
            }, 0);
            const totalRetail = goodsInItems.reduce((sum, item) => {
              const retail = Number(item.retail_price || 0);
              const qty = Number(item.quantity || 0);
              return sum + retail * qty;
            }, 0);
            const totalUnits = goodsInItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            const surchargeTotal = goodsInItems.reduce((sum, item) => sum + Number(item.surcharge || 0) * Number(item.quantity || 0), 0);
            return <div style={{
              display: "flex",
              gap: "16px",
              fontSize: "0.9rem",
              color: "var(--text-1)"
            }}>
                    <span>Lines <strong>{goodsInItems.length}</strong></span>
                    <span>Units <strong>{totalUnits}</strong></span>
                    <span>Cost <strong>{currencyFormatter.format(totalCost)}</strong></span>
                    <span>Retail <strong>{currencyFormatter.format(totalRetail)}</strong></span>
                    <span>Potential margin <strong>{currencyFormatter.format(totalRetail - totalCost)}</strong></span>
                    <span>Surcharge <strong>{currencyFormatter.format(surchargeTotal)}</strong></span>
                  </div>;
          })()}
            </div>
            <div style={{
          display: "flex",
          gap: "10px"
        }}>
              <button className="app-btn app-btn--secondary" style={secondaryButtonStyle} onClick={() => goodsInRecord && fetchGoodsIn(goodsInRecord.id)} disabled={!goodsInRecord}>
                Refresh
              </button>
              <button className="app-btn app-btn--primary" style={primaryButtonStyle(completing || !goodsInRecord || goodsInItems.length === 0)} onClick={handleCompleteGoodsIn} disabled={completing || !goodsInRecord || goodsInItems.length === 0}>
                {completing ? "Completing..." : "Complete"}
              </button>
            </div>
          </div>
          {goodsInItems.length === 0 ? <div style={{
        padding: "24px",
        textAlign: "center",
        color: "var(--text-1)"
      }}>
              No lines yet. Add a part to populate this invoice.
            </div> : <div className="goods-in-table-scroll"><ScrollArea maxHeight="420px" style={{ overflowX: "visible" }}>
              <table style={{ ...invoiceTableStyles, minWidth: "980px" }}>
                <thead><tr style={{ textAlign: "left" }}>
                  <th style={invoiceHeaderCellStyle}>Part / state</th><th style={invoiceHeaderCellStyle}>Description / bin</th><th style={invoiceHeaderCellStyle}>Retail</th><th style={invoiceHeaderCellStyle}>Cost</th><th style={invoiceHeaderCellStyle}>Surcharge</th><th style={invoiceHeaderCellStyle}>Received</th><th style={invoiceHeaderCellStyle}>Assigned / remaining</th><th style={invoiceHeaderCellStyle}>Cost total</th><th style={invoiceHeaderCellStyle}>Remove</th>
                </tr></thead>
                <tbody>{goodsInItems.map(item => {
                  const cost = Number(item.cost_price || 0); const qty = Number(item.quantity || 0); const assigned = item.added_to_job ? qty : 0;
                  return <tr key={item.id} style={invoiceRowStyle}>
                    <td style={{ ...invoiceCellStyle, fontWeight: 600 }}>{item.part_number}<small style={{ display: "block", color: "var(--text-1)" }}>{item.part_catalog_id ? "Catalogue" : "New part"}</small></td>
                    <td style={invoiceCellStyle}>{item.description || "—"}<small style={{ display: "block", color: "var(--text-1)" }}>Bin {item.bin_location || "not set"}</small></td>
                    <td style={invoiceCellStyle}>{item.retail_price ? currencyFormatter.format(item.retail_price) : "—"}</td><td style={invoiceCellStyle}>{item.cost_price ? currencyFormatter.format(item.cost_price) : "—"}</td><td style={invoiceCellStyle}>{item.surcharge || "—"}</td><td style={invoiceCellStyle}>{qty}</td><td style={invoiceCellStyle}>{assigned} / {Math.max(0, qty - assigned)}{item.job_number ? <small style={{ display: "block", color: "var(--text-1)" }}>{item.job_number}</small> : null}</td><td style={invoiceCellStyle}>{currencyFormatter.format(cost * qty || 0)}</td>
                    <td style={{ ...invoiceCellStyle, textAlign: "right" }}><button className="app-btn app-btn--secondary" style={{ ...dangerButtonStyle, opacity: removingItemId === item.id ? 0.6 : 1 }} onClick={() => handleRemoveItem(item.id)} disabled={removingItemId === item.id}>{removingItemId === item.id ? "Removing" : "Remove"}</button></td>
                  </tr>;
                })}</tbody>
              </table>
            </ScrollArea></div>}
        </LayerTheme>

        <div className="goods-in-support-grid">
          <LayerTheme as="section" sectionKey="goods-in-recent" parentKey="app-layout-page-card" style={sectionCardStyle}>
            <div className="invoice-details-toolbar">
              <div><h2 style={{ margin: 0 }}>Recent goods in and drafts</h2><div style={{ color: "var(--text-1)", fontSize: ".86rem", marginTop: 3 }}>Search recent GIN, supplier, invoice, delivery note, part or date.</div></div>
              <button className="app-btn app-btn--secondary" onClick={fetchRecentGoodsIn}>Refresh</button>
            </div>
            <input className="app-input" style={inputStyle} value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Search recent receiving history" />
            {recentLoading ? <div style={{ color: "var(--text-1)" }}>Loading recent records…</div> : recentError ? <div className="app-status-message app-status-message--warning">Recent records unavailable. {recentError}</div> : recentGoodsIn.length === 0 ? <div style={{ color: "var(--text-1)" }}>No recent goods-in records.</div> : <div style={{ display: "grid", gap: 8 }}>
              {recentGoodsIn.filter(record => {
                const query = historySearch.trim().toLowerCase();
                if (!query) return true;
                return [record.goods_in_number, record.supplier_name, record.invoice_number, record.delivery_note_number, record.invoice_date, ...(record.items || []).flatMap(item => [item.part_number, item.description])].some(value => String(value || "").toLowerCase().includes(query));
              }).slice(0, 6).map(record => {
                const units = (record.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                const cost = (record.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.cost_price || 0), 0);
                return <button className="app-btn app-btn--secondary" key={record.id} type="button" style={{ ...secondaryButtonStyle, width: "100%", textAlign: "left", display: "grid", gridTemplateColumns: "minmax(100px, .7fr) minmax(140px, 1.4fr) auto", gap: 10, alignItems: "center" }} onClick={() => record.status === "draft" && fetchGoodsIn(record.id)} disabled={record.status !== "draft"} title={record.status === "draft" ? "Resume this draft" : "Completed record"}>
                  <strong>{record.goods_in_number}</strong><span>{record.supplier_name || "Unknown supplier"} · {record.invoice_number || "No invoice"}</span><span>{record.status} · {record.items?.length || 0} lines / {units} units · {currencyFormatter.format(cost)}</span>
                </button>;
              })}
            </div>}
          </LayerTheme>
          <LayerTheme as="aside" sectionKey="goods-in-progress" parentKey="app-layout-page-card" style={sectionCardStyle}>
            <h2 style={{ margin: 0 }}>Receiving progress</h2>
            {(() => { const issues = [!invoiceForm.supplierAccountId && "Supplier ledger link missing", !invoiceForm.invoiceNumber.trim() && "Invoice number missing", goodsInItems.some(item => !item.bin_location) && "One or more bins missing", goodsInItems.some(item => Number(item.cost_price || 0) > Number(item.retail_price || 0)) && "Negative-margin pricing", !goodsInRecord && "Draft starts when the first part is added"].filter(Boolean); return <><div className="goods-in-summary-strip"><span>Context <strong>{invoiceForm.supplierAccountId && invoiceForm.invoiceNumber ? "ready" : "incomplete"}</strong></span><span>Lines <strong>{goodsInItems.length}</strong></span></div>{issues.length ? <ul style={{ margin: 0, paddingLeft: 20, color: "var(--warning-dark)" }}>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul> : <div style={{ color: "var(--success-dark)", fontWeight: 600 }}>Ready to complete.</div>}</>; })()}
          </LayerTheme>
        </div>

        {completionSummary && <LayerTheme as="section" sectionKey="goods-in-completion-summary" parentKey="app-layout-page-card" style={sectionCardStyle}>
          <h2 style={{ margin: 0 }}>Completion result</h2><div className="goods-in-summary-strip"><span>Lines <strong>{completionSummary.lines}</strong></span><span>Units <strong>{completionSummary.units}</strong></span><span>Updated <strong>{completionSummary.updated}</strong></span><span>Created <strong>{completionSummary.created}</strong></span><span>Failed <strong>{completionSummary.failed.length}</strong></span><span>Cost received <strong>{currencyFormatter.format(completionSummary.totalCost)}</strong></span></div>
          {completionSummary.failed.length > 0 && <div className="app-status-message app-status-message--warning">{completionSummary.failed.map(item => <div key={`${item.partNumber}-${item.error}`}><strong>{item.partNumber || "Unknown part"}:</strong> {item.error}</div>)}</div>}
        </LayerTheme>}
      </div>

      {supplierModalOpen && <SupplierSearchModal onClose={() => setSupplierModalOpen(false)} onSelect={handleSupplierSelected} initialQuery={invoiceForm.supplierName} />}
      {partSearchOpen && <GoodsInPartSearchModal onClose={() => setPartSearchOpen(false)} onSelect={handlePartSelected} initialQuery={partForm.partNumber} />}
      {jobModalOpen && <JobAssignmentModal items={goodsInItems} actingUserUuid={actingUserUuid} actingUserNumeric={actingUserNumeric} onClose={() => {
    setJobModalOpen(false);
    setCompletionPromptOpen(true);
  }} onAssigned={handleJobItemsAssigned} onFinish={handleFinishGoodsIn} />}
      {completionPromptOpen && <CompletionPrompt goodsInNumber={goodsInRecord?.goods_in_number} summary={completionSummary} currencyFormatter={currencyFormatter} onClose={handleCompletionDismiss} onAddToJob={() => {
    setCompletionPromptOpen(false);
    setJobModalOpen(true);
  }} />}
      <ConfirmationDialog isOpen={!!confirmDialog} message={confirmDialog?.message} cancelLabel="Cancel" confirmLabel="Remove" onCancel={() => setConfirmDialog(null)} onConfirm={confirmDialog?.onConfirm} />
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
