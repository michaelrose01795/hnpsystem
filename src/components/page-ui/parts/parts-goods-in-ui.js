// file location: src/components/page-ui/parts/parts-goods-in-ui.js

export default function GoodsInPageUi(props) {
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
    compactFieldWrapStyle,
    completing,
    completionPromptOpen,
    confirmDialog,
    createDefaultPartForm,
    currencyFormatter,
    dangerButtonStyle,
    fetchGoodsIn,
    fieldGridStyle,
    fileInputRef,
    filteredBinLocations,
    goodsInItems,
    goodsInRecord,
    handleAddPart,
    handleCompleteGoodsIn,
    handleCompletionDismiss,
    handleFinishGoodsIn,
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
    partSearchOpen,
    primaryButtonStyle,
    removingItemId,
    savingPart,
    scanBusy,
    secondaryButtonStyle,
    sectionCardStyle,
    setActiveTab,
    setCompletionPromptOpen,
    setConfirmDialog,
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
    wideCompactFieldWrapStyle,
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
          border: 1px solid var(--surface-light);
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
          color: var(--text-primary);
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
          border: 1px solid var(--surface-light);
          background: var(--layer-section-level-2);
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
          border: 1px solid var(--surface-light);
          background: var(--layer-section-level-2);
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
        }
      `}</style>
      <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "12px"
  }}>
        {toast && <div style={{
      padding: "12px 16px",
      borderRadius: "var(--radius-sm)",
      background: toast.type === "error" ? "var(--danger-surface)" : toast.type === "success" ? "var(--success-surface)" : "var(--info-surface)",
      color: toast.type === "error" ? "var(--danger)" : toast.type === "success" ? "var(--success-dark)" : "var(--info)"
    }}>
            {toast.message}
          </div>}

        <TabGroup items={ADVANCED_TABS.map(tab => ({
      value: tab.id,
      label: tab.label
    }))} value={activeTab} onChange={value => {
      setActiveTab(value);
      setIsAdvancedPanelOpen(true);
    }} ariaLabel="Part detail tabs" />

        <section style={sectionCardStyle} className="app-section-card invoice-details-section">
          <div className="invoice-details-toolbar">
            <h2 style={{
          margin: 0
        }}>Invoice details</h2>
            <div style={{
          display: "flex",
          gap: "10px"
        }}>
              <button style={secondaryButtonStyle} onClick={() => setSupplierModalOpen(true)}>
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
            <div style={fieldGridStyle}>
              <div>
                <label style={labelStyle}>Supplier</label>
                <input style={inputStyle} value={invoiceForm.supplierName} onChange={event => handleInvoiceChange("supplierName", event.target.value)} placeholder="Supplier name" />
                {invoiceForm.supplierAccountNumber && <small style={{
              color: "var(--text-secondary)"
            }}>
                    Account #{invoiceForm.supplierAccountNumber}
                  </small>}
              </div>
              <div>
                <label style={labelStyle}>Invoice number</label>
                <input style={inputStyle} value={invoiceForm.invoiceNumber} onChange={event => handleInvoiceChange("invoiceNumber", event.target.value)} placeholder="INV-001" />
              </div>
              <div>
                <label style={labelStyle}>Delivery note number</label>
                <input style={inputStyle} value={invoiceForm.deliveryNoteNumber} onChange={event => handleInvoiceChange("deliveryNoteNumber", event.target.value)} placeholder="DN-001" />
              </div>
              <div style={compactFieldWrapStyle}>
                <label style={labelStyle}>Invoice date</label>
                <div className="compact-calendar">
                  <CalendarField value={invoiceForm.invoiceDate} onChange={event => handleInvoiceChange("invoiceDate", event.target.value)} name="invoiceDate" helperText="" style={{
                width: "100%"
              }} />
                </div>
              </div>
              <div style={compactFieldWrapStyle}>
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
              <div style={wideCompactFieldWrapStyle}>
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
                <textarea style={notesTextareaStyle} value={invoiceForm.notes} onChange={event => handleInvoiceChange("notes", event.target.value)} placeholder="Internal notes" />
              </div>
            </div>
            {invoiceScanPayload && <div style={{
          fontSize: "0.85rem",
          color: "var(--text-secondary)"
        }}>
                Last scan: {invoiceScanPayload.fileName} ·
                {invoiceScanPayload.extracted.invoiceNumber && ` Invoice ${invoiceScanPayload.extracted.invoiceNumber}`}
              </div>}
          </div>
        </section>

        <section style={sectionCardStyle} className="app-section-card add-part-section">
          <div className="add-part-toolbar">
            <h2 style={{
          margin: 0
        }}>Add part</h2>
            <button style={secondaryButtonStyle} onClick={() => setPartSearchOpen(true)}>
              Search catalogue
            </button>
          </div>
          {partError && <div style={{
        border: "1px solid var(--danger)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 14px",
        color: "var(--danger)",
        background: "var(--danger-surface)"
      }}>
              {partError}
            </div>}
          <div className="add-part-fields-shell">
            <div className="add-part-fields-grid">
              <div style={addPartFieldStyle}>
                <label style={labelStyle}>Part number</label>
                <input style={addPartInputStyle} value={partForm.partNumber} onKeyDown={event => {
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
              zIndex: 1000
            }} onMouseDown={event => event.preventDefault()}>
                    {filteredBinLocations.length === 0 ? <div style={{
                padding: "10px 12px",
                fontSize: "0.9rem",
                color: "var(--text-secondary)"
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
                color: "var(--text-primary)"
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

          {isAdvancedPanelOpen && <div style={{
        marginTop: "12px"
      }}>
              <div style={{
          marginTop: "14px"
        }}>
                {activeTab === "global" && <div style={fieldGridStyle}>
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
                  </div>}
                {activeTab === "dealer" && <div style={fieldGridStyle}>
                    <input style={inputStyle} placeholder="Dealer code" value={partForm.dealerDetails.dealerCode} onChange={event => handleNestedPartChange("dealerDetails", "dealerCode", event.target.value)} />
                    <input style={inputStyle} placeholder="Tier" value={partForm.dealerDetails.tier} onChange={event => handleNestedPartChange("dealerDetails", "tier", event.target.value)} />
                    <textarea style={textareaStyle} placeholder="Dealer notes" value={partForm.dealerDetails.notes} onChange={event => handleNestedPartChange("dealerDetails", "notes", event.target.value)} />
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
                    <textarea style={textareaStyle} placeholder="Audi notes" value={partForm.audiMetadata.notes} onChange={event => handleNestedPartChange("audiMetadata", "notes", event.target.value)} />
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
              <button onClick={() => setPartForm(createDefaultPartForm())} style={{
            ...secondaryButtonStyle,
            padding: "8px 14px"
          }} disabled={savingPart}>
                Clear
              </button>
              <button style={{
            ...primaryButtonStyle(savingPart),
            padding: "10px 16px"
          }} onClick={handleAddPart} disabled={savingPart}>
                {savingPart ? "Adding..." : "Add part"}
              </button>
            </div>
          </div>
        </section>

        <section className="app-section-card" style={sectionCardStyle}>
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
            return <div style={{
              display: "flex",
              gap: "16px",
              fontSize: "0.9rem",
              color: "var(--text-secondary)"
            }}>
                    <span>Total Cost: <strong style={{
                  color: "var(--text-primary)"
                }}>{currencyFormatter.format(totalCost)}</strong></span>
                    <span>Total Retail: <strong style={{
                  color: "var(--text-primary)"
                }}>{currencyFormatter.format(totalRetail)}</strong></span>
                  </div>;
          })()}
            </div>
            <div style={{
          display: "flex",
          gap: "10px"
        }}>
              <button style={secondaryButtonStyle} onClick={() => goodsInRecord && fetchGoodsIn(goodsInRecord.id)} disabled={!goodsInRecord}>
                Refresh
              </button>
              <button style={primaryButtonStyle(completing)} onClick={handleCompleteGoodsIn} disabled={completing}>
                {completing ? "Completing..." : "Complete"}
              </button>
            </div>
          </div>
          {goodsInItems.length === 0 ? <div style={{
        padding: "24px",
        textAlign: "center",
        color: "var(--text-secondary)"
      }}>
              No lines yet. Add a part to populate this invoice.
            </div> : <ScrollArea maxHeight="420px" style={{
        borderRadius: "var(--radius-lg)",
        border: "none",
        overflowX: "hidden",
        background: "var(--layer-section-level-2)"
      }}>
              <table style={invoiceTableStyles}>
                <thead>
                  <tr style={{
              textAlign: "left"
            }}>
                    <th style={invoiceHeaderCellStyle}>Part number</th>
                    <th style={invoiceHeaderCellStyle}>Description</th>
                    <th style={invoiceHeaderCellStyle}>Retail</th>
                    <th style={invoiceHeaderCellStyle}>Cost</th>
                    <th style={invoiceHeaderCellStyle}>Surcharge</th>
                    <th style={invoiceHeaderCellStyle}>Qty</th>
                    <th style={invoiceHeaderCellStyle}>Cost total</th>
                    <th style={invoiceHeaderCellStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {goodsInItems.map(item => {
              const cost = Number(item.cost_price || 0);
              const qty = Number(item.quantity || 0);
              return <tr key={item.id} style={invoiceRowStyle}>
                        <td style={{
                  ...invoiceCellStyle,
                  fontWeight: 600
                }}>{item.part_number}</td>
                        <td style={{
                  ...invoiceCellStyle,
                  color: "var(--text-secondary)"
                }}>{item.description}</td>
                        <td style={invoiceCellStyle}>
                          {item.retail_price ? currencyFormatter.format(item.retail_price) : "--"}
                        </td>
                        <td style={invoiceCellStyle}>
                          {item.cost_price ? currencyFormatter.format(item.cost_price) : "--"}
                        </td>
                        <td style={invoiceCellStyle}>{item.surcharge || "--"}</td>
                        <td style={invoiceCellStyle}>{item.quantity}</td>
                        <td style={invoiceCellStyle}>{currencyFormatter.format(cost * qty || 0)}</td>
                        <td style={{
                  ...invoiceCellStyle,
                  textAlign: "right"
                }}>
                          <button style={{
                    ...dangerButtonStyle,
                    opacity: removingItemId === item.id ? 0.6 : 1
                  }} onClick={() => handleRemoveItem(item.id)} disabled={removingItemId === item.id}>
                            {removingItemId === item.id ? "Removing" : "Remove"}
                          </button>
                        </td>
                      </tr>;
            })}
                </tbody>
              </table>
            </ScrollArea>}
        </section>
      </div>

      {supplierModalOpen && <SupplierSearchModal onClose={() => setSupplierModalOpen(false)} onSelect={handleSupplierSelected} initialQuery={invoiceForm.supplierName} />}
      {partSearchOpen && <GoodsInPartSearchModal onClose={() => setPartSearchOpen(false)} onSelect={handlePartSelected} initialQuery={partForm.partNumber} />}
      {jobModalOpen && <JobAssignmentModal items={goodsInItems} actingUserUuid={actingUserUuid} actingUserNumeric={actingUserNumeric} onClose={() => {
    setJobModalOpen(false);
    setCompletionPromptOpen(true);
  }} onAssigned={handleJobItemsAssigned} onFinish={handleFinishGoodsIn} />}
      {completionPromptOpen && <CompletionPrompt goodsInNumber={goodsInRecord?.goods_in_number} onClose={handleCompletionDismiss} onAddToJob={() => {
    setCompletionPromptOpen(false);
    setJobModalOpen(true);
  }} />}
      <ConfirmationDialog isOpen={!!confirmDialog} message={confirmDialog?.message} cancelLabel="Cancel" confirmLabel="Remove" onCancel={() => setConfirmDialog(null)} onConfirm={confirmDialog?.onConfirm} />
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
