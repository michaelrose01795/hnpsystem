// file location: src/components/page-ui/parts/create-order/parts-create-order-ui.js
import { useState } from "react";
import useIsMobile from "@/hooks/useIsMobile";
import Button from "@/components/ui/Button";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import EmptyState from "@/components/ui/EmptyState";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import StatusMessage from "@/components/ui/StatusMessage";
import ToolbarRow from "@/components/ui/ToolbarRow";
import PopupModal from "@/components/popups/popupStyleApi";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import VehicleDetailsCard from "@/components/vehicles/VehicleDetailsCard"; // shared with /new-job
import CustomerDetailsCard from "@/components/customers/CustomerDetailsCard"; // shared with /new-job

// Width at which the three top-row cards stop wrapping and can share rows.
const SIDE_BY_SIDE_BREAKPOINT = 1280;
const TOP_ROW_ROWS = 6;

const money = (value) => new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
}).format(Number(value) || 0);

function FormField({ label, hint, htmlFor, className = "", style, children }) {
  return (
    <div className={`new-order-aligned-row ${className}`.trim()} style={style}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <span className="app-field-hint">{hint}</span> : null}
    </div>
  );
}

function SummaryItem({ label, children }) {
  return (
    <div className="app-summary-item">
      <span className="app-summary-label">{label}</span>
      <strong className="app-summary-value">{children}</strong>
    </div>
  );
}

function partAvailability(line) {
  if (!line.part_catalog_id) return { label: "Manual", tone: "neutral", available: null };
  const stock = Number(line.catalog_snapshot?.qty_in_stock || 0);
  const reserved = Number(line.catalog_snapshot?.qty_reserved || 0);
  const available = Math.max(0, stock - reserved);
  const required = Number(line.quantity) || 1;
  if (available >= required) return { label: `${available} available`, tone: "success", available };
  if (Number(line.catalog_snapshot?.qty_on_order || 0) > 0) {
    return { label: `${available} available · ${line.catalog_snapshot.qty_on_order} on order`, tone: "warning", available };
  }
  return { label: "Order required", tone: "danger", available };
}

function supersededPart(line) {
  const notes = String(line.catalog_snapshot?.notes || "");
  const match = notes.match(/superseded(?:\s+by|\s+to)?\s*:?\s*([a-z0-9-]+)/i);
  return match?.[1] || "";
}

export default function PartsCreateOrderUi(props) {
  // The order summary now lives in a popup rather than a persistent aside,
  // mirroring the "More" request popup on /new-job.
  const [summaryOpen, setSummaryOpen] = useState(false);
  // Cards share grid rows only while they are actually side by side; once the
  // row wraps, each card goes back to being an ordinary stacked flex card.
  const rowsAligned = !useIsMobile(SIDE_BY_SIDE_BREAKPOINT - 1);
  const rowStyle = (row) => (rowsAligned ? { gridRow: row } : undefined);

  if (props.view === "access-denied") {
    return (
      <DevLayoutSection as="section" sectionKey="new-order-access-message" sectionType="section-shell" parentKey="app-layout-page-card">
        <StatusMessage tone="danger">You do not have permission to access parts orders.</StatusMessage>
      </DevLayoutSection>
    );
  }
  if (props.view !== "workflow") return null;

  const {
    CalendarField,
    ExistingCustomerPopup,
    NewCustomerPopup,
    SearchBar,
    TimePickerField,
    addManualPart,
    clearForm,
    clearPartLink,
    closePartSearch,
    customer,
    customerFieldDefinitions,
    customerForm,
    customerNotification,
    customerOrders,
    errorMessage,
    form,
    handleCancelCustomerEdit,
    handleCustomerFieldChange,
    handleCustomerSelect,
    handleFetchVehicleData,
    handleFieldChange,
    handlePartChange,
    handleSaveCustomerEdits,
    handleStartCustomerEdit,
    handleSubmit,
    isCustomerEditing,
    isLoadingVehicle,
    isSavingCustomer,
    newCustomerPrefill,
    openPartSearch,
    partLines,
    partSearchLoading,
    partSearchOpen,
    partSearchQuery,
    partSearchResults,
    removePart,
    savingMode,
    selectPart,
    setCustomer,
    setCustomerNotification,
    setNewCustomerPrefill,
    setPartSearchQuery,
    setShowExistingCustomer,
    setShowNewCustomer,
    setVehicle,
    setVehicleNotification,
    setWithoutVehicle,
    showExistingCustomer,
    showNewCustomer,
    toggleContactPreference,
    totals,
    vehicle,
    vehicleError,
    vehicleNotification,
    viewCustomer,
    withoutVehicle,
  } = props;

  const populatedLines = partLines.filter((line) => line.part_number || line.part_name);

  return (
    <>
      <form onSubmit={handleSubmit} className="app-page-stack">
        {/* Status on the left, order actions on the right. */}
        <DevLayoutSection as="header" className="app-page-header" sectionKey="new-order-workflow-header" sectionType="page-header" parentKey="app-layout-page-card">
          <div className="app-page-header__text">
            {errorMessage ? <StatusMessage tone="danger">{errorMessage}</StatusMessage> : null}
          </div>
          <div className="app-page-header__actions">
            <Button type="button" variant="secondary" disabled={Boolean(savingMode)} onClick={clearForm}>Clear</Button>
            <Button type="button" variant="secondary" onClick={() => setSummaryOpen(true)}>Order summary · {money(totals.total)}</Button>
            <Button type="submit" busy={savingMode === "booked"}>Create order</Button>
          </div>
        </DevLayoutSection>


        {/* Delivery, Vehicle, and Customer use equal-height responsive grid
            rows, with three equal columns at desktop widths. */}
        <DevLayoutSection
          sectionKey="new-order-top-row"
          sectionType="section-shell"
          parentKey="app-layout-page-card"
          shell
          className="new-order-aligned-top-row"
          style={rowsAligned
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(260px, 1fr))",
                gridTemplateRows: `repeat(${TOP_ROW_ROWS}, auto)`,
                alignItems: "stretch",
                columnGap: "16px",
                rowGap: 0,
                width: "100%",
              }
            : { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gridAutoRows: "1fr", alignItems: "stretch", gap: "16px", width: "100%" }}
        >
          <LayerTheme
            id="new-order-delivery"
            as="section"
            sectionKey="new-order-delivery"
            parentKey="new-order-top-row"
            className="new-order-aligned-card new-order-aligned-card--delivery"
            radius="var(--radius-md)"
            gap="12px"
            style={{
              flex: "1 1 260px",
              minWidth: 0,
              minHeight: "420px",
              boxSizing: "border-box",
              ...(rowsAligned
                ? { display: "grid", gridTemplateRows: "subgrid", gridRow: `1 / span ${TOP_ROW_ROWS}` }
                : { overflowY: "auto" }),
            }}
          >
            <div className="new-order-aligned-card__header" style={rowStyle(1)}>
              <h3>Delivery</h3>
            </div>

            {/* Fulfilment method as a segmented tab strip, headed by a plain
                field label so it matches "Colour" and the other field labels.
                The stored values (collection / delivery / courier) are
                unchanged. */}
            <FormField label="Delivery Method" style={rowStyle(2)}>
              {/* Tab items are 35px; pad the row to the 44px control height so
                  this row matches the Vehicle card's Registration Number row
                  and the fields below stay on the same lines across cards. */}
              <div style={{ display: "flex", alignItems: "center", minHeight: "var(--control-height)" }}>
              <TabGroup
                ariaLabel="Delivery method"
                value={form.delivery_type}
                onChange={(value) => handleFieldChange("delivery_type", value)}
                devSectionKey="new-order-delivery-method"
                devSectionParent="new-order-delivery"
                items={[
                  { value: "collection", label: "Collection" },
                  { value: "delivery", label: "Delivery" },
                  { value: "courier", label: "Courier" },
                ]}
              />
              </div>
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px", ...rowStyle(3) }}>
              <CalendarField name="delivery_eta" label={form.delivery_type === "collection" ? "Collection date" : "Delivery date"} value={form.delivery_eta} onValueChange={(value) => handleFieldChange("delivery_eta", value)} />
              <TimePickerField name="delivery_window" label="Preferred time" value={form.delivery_window} onValueChange={(value) => handleFieldChange("delivery_window", value)} />
            </div>

            {form.delivery_type !== "collection" ? (
              <FormField label="Delivery charge" htmlFor="delivery-charge" style={rowStyle(4)}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "50%" }}>
                  <input id="delivery-charge" name="delivery_charge" className="app-input" type="number" min="0" step="0.01" style={{ minWidth: 0, flex: 1 }} value={form.delivery_charge} onChange={(event) => handleFieldChange("delivery_charge", event.target.value)} />
                  <span style={{ pointerEvents: "none", flexShrink: 0 }}>£</span>
                </div>
              </FormField>
            ) : null}
          </LayerTheme>

          <VehicleDetailsCard
            sectionKey="new-order-vehicle"
            parentKey="new-order-top-row"
            vehicle={vehicle}
            setVehicle={setVehicle}
            onLookup={handleFetchVehicleData}
            isLoadingVehicle={isLoadingVehicle}
            error={vehicleError}
            notification={vehicleNotification}
            onDismissNotification={setVehicleNotification}
            showEngineNumber={false}
            showCurrentMileage={false}
            gap="12px"
            registrationSpacing="0"
            subgrid={rowsAligned}
            subgridRows={TOP_ROW_ROWS}
            className="new-order-aligned-card"
            style={{ flex: "1 1 260px", minWidth: 0, minHeight: "420px", boxSizing: "border-box", ...(rowsAligned ? {} : { overflowY: "auto" }) }}
          >
            {/* Parts orders may have no vehicle at all; /new-job always has one. */}
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input name="without_vehicle" className="app-toggle app-toggle--checkbox" type="checkbox" checked={withoutVehicle} onChange={(event) => setWithoutVehicle(event.target.checked)} />
              <span>Order is not linked to a vehicle</span>
            </label>
          </VehicleDetailsCard>

          <CustomerDetailsCard
            sectionKey="new-order-customer"
            parentKey="new-order-top-row"
            customer={customer}
            setCustomer={setCustomer}
            customerForm={customerForm}
            customerFieldDefinitions={customerFieldDefinitions}
            isCustomerEditing={isCustomerEditing}
            isSavingCustomer={isSavingCustomer}
            notification={customerNotification}
            onDismissNotification={setCustomerNotification}
            handleCustomerFieldChange={handleCustomerFieldChange}
            toggleContactPreference={toggleContactPreference}
            handleStartCustomerEdit={handleStartCustomerEdit}
            handleSaveCustomerEdits={handleSaveCustomerEdits}
            handleCancelCustomerEdit={handleCancelCustomerEdit}
            onExistingCustomer={() => setShowExistingCustomer(true)}
            onNewCustomer={() => setShowNewCustomer(true)}
            emptySelectionLabel="Customer"
            className="new-order-aligned-card"
            style={{ flex: "1 1 260px", minWidth: 0, minHeight: "420px", boxSizing: "border-box", overflowY: "auto", ...(rowsAligned ? { gridRow: `1 / span ${TOP_ROW_ROWS}` } : {}) }}
          >
            {/* Parts-order extras. The card above is byte-identical to /new-job;
                anything specific to a parts order hangs below it. */}
            {customer ? (
              <>
                <Button type="button" variant="secondary" disabled={!customer?.id} onClick={viewCustomer}>View Customer</Button>
                {customerOrders.length > 0 ? (
                  <StatusMessage tone="warning">
                    {customerOrders.length} open order{customerOrders.length === 1 ? "" : "s"} already exist for this customer: {customerOrders.map((order) => order.order_number).join(", ")}.
                  </StatusMessage>
                ) : null}
              </>
            ) : null}
          </CustomerDetailsCard>
        </DevLayoutSection>

        {/* Parts — full-width section below the top row, matching the Job
            Requests section on /new-job (header row + scrolling rows). */}
        <LayerTheme
          id="new-order-parts"
          as="section"
          sectionKey="new-order-parts"
          parentKey="app-layout-page-card"
          sectionType="section-shell"
          radius="var(--radius-md)"
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <h3>Parts</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <span className="app-badge app-badge--accent-soft">{populatedLines.length} lines</span>
              <Button type="button" variant="secondary" onClick={() => openPartSearch(null, [form.vehicle_make, form.vehicle_model].filter(Boolean).join(" "))}>Search catalogue</Button>
              <Button type="button" variant="secondary" onClick={addManualPart}>+ Add Part</Button>
            </div>
          </div>

          <div style={{ maxHeight: "360px", overflowY: "auto", paddingRight: "4px" }}>
            {partLines.map((line, index) => {
              const availability = partAvailability(line);
              const replacement = supersededPart(line);
              const gross = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
              const lineTotal = gross * (1 - Math.min(Math.max(Number(line.discount) || 0, 0), 100) / 100);
              return (
                <LayerSurface
                  key={line.client_id}
                  sectionKey={`new-order-part-${index + 1}`}
                  parentKey="new-order-parts"
                  sectionType="content-card"
                  radius="var(--radius-sm)"
                  padding="10px"
                  gap="6px"
                  style={{ marginBottom: "10px" }}
                >
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "nowrap", overflowX: "auto", paddingBottom: "2px" }}>
                    <strong style={{ flexShrink: 0, whiteSpace: "nowrap" }}>Part {index + 1}</strong>
                    <input name={`${line.client_id}_number`} className="app-input" style={{ flex: "0 1 140px", minWidth: "120px" }} value={line.part_number} onChange={(event) => handlePartChange(line.client_id, "part_number", event.target.value.toUpperCase())} placeholder="Part number" aria-label={`Part ${index + 1} part number`} />
                    <input name={`${line.client_id}_name`} className="app-input" style={{ flex: "1 1 240px", minWidth: "200px" }} value={line.part_name} onChange={(event) => handlePartChange(line.client_id, "part_name", event.target.value)} placeholder="Description" aria-label={`Part ${index + 1} description`} />
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto", flexShrink: 0 }}>
                      <span className={`app-badge app-badge--${availability.tone}`}>{availability.label}</span>
                      <span className="app-field-hint" style={{ whiteSpace: "nowrap" }}>{line.catalog_snapshot?.storage_location || "No location"}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "72px", flexShrink: 0 }}>
                        <input type="number" min="1" step="1" value={line.quantity} onChange={(event) => handlePartChange(line.client_id, "quantity", event.target.value)} className="app-input" style={{ width: "56px" }} aria-label={`Part ${index + 1} quantity`} />
                        <span style={{ pointerEvents: "none", flexShrink: 0 }}>×</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100px", flexShrink: 0 }}>
                        <input type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => handlePartChange(line.client_id, "unit_price", event.target.value)} placeholder="Price" className="app-input" style={{ width: "82px" }} aria-label={`Part ${index + 1} unit price`} />
                        <span style={{ pointerEvents: "none", flexShrink: 0 }}>£</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "84px", flexShrink: 0 }}>
                        <input type="number" min="0" max="100" step="0.1" value={line.discount} onChange={(event) => handlePartChange(line.client_id, "discount", event.target.value)} className="app-input" style={{ width: "64px" }} aria-label={`Part ${index + 1} discount percentage`} />
                        <span style={{ pointerEvents: "none", flexShrink: 0 }}>%</span>
                      </div>
                      <strong style={{ whiteSpace: "nowrap" }}>{money(lineTotal)}</strong>
                      <Button type="button" variant="secondary" size="sm" onClick={() => openPartSearch(line.client_id, line.part_number || line.part_name)}>
                        {replacement || availability.tone !== "success" ? "Alternatives" : "Edit"}
                      </Button>
                      {line.part_catalog_id ? <Button type="button" variant="secondary" size="sm" onClick={() => clearPartLink(line.client_id)}>Unlink</Button> : null}
                      <Button type="button" variant="danger" size="sm" onClick={() => removePart(line.client_id)}>Remove</Button>
                    </div>
                  </div>
                  {replacement ? <StatusMessage tone="warning">Superseded by {replacement}</StatusMessage> : null}
                </LayerSurface>
              );
            })}
          </div>
        </LayerTheme>

        {summaryOpen ? (
          <PopupModal maxWidth="720px" onClose={() => setSummaryOpen(false)} ariaLabel="Order summary">
            <div className="app-page-stack" style={{ padding: "var(--section-card-padding)" }}>
              <header className="app-popup-compact-header">
                <div>
                  <strong>Order summary</strong>
                  <div className="app-field-hint">{populatedLines.length} order lines · VAT at 20%</div>
                </div>
                <div className="app-popup-compact-header__actions">
                  <Button type="button" size="sm" onClick={() => setSummaryOpen(false)}>Done</Button>
                </div>
              </header>

              <div className="app-summary-section">
                <div className="app-summary-grid">
                  <SummaryItem label="Subtotal">{money(totals.subtotal)}</SummaryItem>
                  <SummaryItem label="Discount">−{money(totals.discount)}</SummaryItem>
                  <SummaryItem label="Delivery">{money(totals.delivery)}</SummaryItem>
                  <SummaryItem label="VAT">{money(totals.vat)}</SummaryItem>
                  <SummaryItem label="Total">{money(totals.total)}</SummaryItem>
                  <SummaryItem label="Pricing">{form.pricing_level}</SummaryItem>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                <DropdownField name="pricing_level" label="Customer pricing level" value={form.pricing_level} onChange={(event) => handleFieldChange("pricing_level", event.target.value)} options={[{ value: "retail", label: "Retail" }, { value: "trade", label: "Trade" }, { value: "staff", label: "Staff" }, { value: "warranty", label: "Warranty" }]} />
                <DropdownField name="payment_status" label="Payment status" value={form.payment_status} onChange={(event) => handleFieldChange("payment_status", event.target.value)} options={[{ value: "draft", label: "Not invoiced" }, { value: "issued", label: "Invoice issued" }, { value: "paid", label: "Paid" }]} />
                <DropdownField name="order_source" label="Order source" value={form.order_source} onChange={(event) => handleFieldChange("order_source", event.target.value)} options={[{ value: "phone", label: "Telephone" }, { value: "counter", label: "Parts counter" }, { value: "email", label: "Email" }, { value: "workshop", label: "Workshop" }, { value: "online", label: "Online" }]} />
                <DropdownField name="priority" label="Priority" value={form.priority} onChange={(event) => handleFieldChange("priority", event.target.value)} options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }]} />
                <DropdownField name="customer_type" label="Customer type" value={form.customer_type} onChange={(event) => handleFieldChange("customer_type", event.target.value)} options={[{ value: "retail", label: "Retail" }, { value: "trade", label: "Trade" }, { value: "internal", label: "Internal" }]} />
                <FormField label="Assigned adviser" htmlFor="assigned-adviser">
                  <input id="assigned-adviser" name="assigned_adviser" className="app-input" value={form.assigned_adviser} onChange={(event) => handleFieldChange("assigned_adviser", event.target.value)} />
                </FormField>
                <FormField label="Department" htmlFor="department">
                  <input id="department" name="department" className="app-input" value={form.department} onChange={(event) => handleFieldChange("department", event.target.value)} />
                </FormField>
                <FormField label="Customer PO / reference" htmlFor="customer-reference">
                  <input id="customer-reference" name="customer_reference" className="app-input" value={form.customer_reference} onChange={(event) => handleFieldChange("customer_reference", event.target.value)} placeholder="Optional reference" />
                </FormField>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                <FormField label="Internal notes" hint="Visible to staff only." htmlFor="internal-notes">
                  <textarea id="internal-notes" name="internal_notes" className="app-input app-input--textarea" rows={3} value={form.internal_notes} onChange={(event) => handleFieldChange("internal_notes", event.target.value)} placeholder="Supplier, stock or handling notes" />
                </FormField>
                <FormField label="Customer-visible notes" hint="Stored with invoice/order communication." htmlFor="customer-notes">
                  <textarea id="customer-notes" name="customer_notes" className="app-input app-input--textarea" rows={3} value={form.customer_notes} onChange={(event) => handleFieldChange("customer_notes", event.target.value)} placeholder="Collection or delivery message" />
                </FormField>
              </div>

              <LayerTheme sectionKey="new-order-summary-notifications" parentKey="shared-popup-card" sectionType="content-card" radius="var(--radius-sm)" padding="10px" gap="var(--space-sm)">
                <strong>Notifications</strong>
                <ToolbarRow>
                  <label><input name="notify_sms" className="app-toggle app-toggle--checkbox" type="checkbox" checked={form.notify_sms} onChange={(event) => handleFieldChange("notify_sms", event.target.checked)} /><span>SMS</span></label>
                  <label><input name="notify_email" className="app-toggle app-toggle--checkbox" type="checkbox" checked={form.notify_email} onChange={(event) => handleFieldChange("notify_email", event.target.checked)} /><span>Email</span></label>
                  <label><input name="notify_phone" className="app-toggle app-toggle--checkbox" type="checkbox" checked={form.notify_phone} onChange={(event) => handleFieldChange("notify_phone", event.target.checked)} /><span>Phone</span></label>
                </ToolbarRow>
                <label><input name="reserve_stock" className="app-toggle app-toggle--checkbox" type="checkbox" checked={form.reserve_stock} onChange={(event) => handleFieldChange("reserve_stock", event.target.checked)} /><span>Reserve available catalogue stock when order is created</span></label>
              </LayerTheme>

              <StatusMessage tone="info">Created orders link to Parts and, for collection/delivery/courier, the Delivery workflow. Supplier receipts remain managed through Goods In.</StatusMessage>

            </div>
          </PopupModal>
        ) : null}
      </form>

      {partSearchOpen ? (
        <PopupModal maxWidth="920px" onClose={closePartSearch} ariaLabel="Search parts catalogue">
          <div className="app-page-stack" style={{ padding: "var(--section-card-padding)" }}>
            <header className="app-popup-compact-header">
              <div><strong>Parts catalogue</strong><div className="app-field-hint">Search by part number, description, OEM reference, location or vehicle detail.</div></div>
              <div className="app-popup-compact-header__actions"><Button type="button" variant="secondary" size="sm" onClick={closePartSearch}>Close</Button></div>
            </header>
            <SearchBar autoFocus value={partSearchQuery} onChange={(event) => setPartSearchQuery(event.target.value)} onClear={() => setPartSearchQuery("")} placeholder="Part number, description, barcode or vehicle" ariaLabel="Search parts catalogue" />
            {partSearchLoading ? <span className="app-field-hint">Searching live catalogue…</span> : null}
            {!partSearchLoading && partSearchQuery.trim().length >= 2 && partSearchResults.length === 0 ? <EmptyState variant="bare" title="No matching parts" description="Try a different term or add a manual part line." action={<Button type="button" onClick={() => { closePartSearch(); addManualPart(); }}>Add manual part</Button>} /> : null}
            {partSearchResults.length > 0 ? (
              <LayerTheme sectionKey="new-order-catalogue-results" parentKey="shared-popup-card" sectionType="content-card" role="listbox" aria-label="Parts catalogue results" radius="var(--radius-sm)" padding="10px" gap="var(--space-xs)" style={{ maxHeight: "55dvh", overflowY: "auto" }}>
                {partSearchResults.map((part) => {
                  const available = Math.max(0, Number(part.qty_in_stock || 0) - Number(part.qty_reserved || 0));
                  return (
                    <Button key={part.id} type="button" variant="secondary" size="sm" onClick={() => selectPart(part)} style={{ width: "100%", justifyContent: "space-between", textAlign: "left" }}>
                      <span><strong>{part.part_number}</strong> · {part.description || part.name}</span>
                      <span>{available} available · {part.storage_location || "No location"} · {money(part.unit_price)}</span>
                    </Button>
                  );
                })}
              </LayerTheme>
            ) : null}
          </div>
        </PopupModal>
      ) : null}

      {showExistingCustomer && <ExistingCustomerPopup onClose={() => setShowExistingCustomer(false)} onSelect={(record) => handleCustomerSelect(record)} onCreateNew={(prefill) => {
        setNewCustomerPrefill(prefill || null);
        setShowExistingCustomer(false);
        setShowNewCustomer(true);
      }} />}

      {showNewCustomer && <NewCustomerPopup onClose={() => {
        setShowNewCustomer(false);
        setNewCustomerPrefill(null);
      }} onSelect={(record) => handleCustomerSelect(record)} initialName={newCustomerPrefill} />}

      <style jsx global>{`
        /* Matches the three-across /new-job geometry on desktop. */
        @media (min-width: 1280px) {
          html.staff-scope .new-order-aligned-top-row {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(260px, 1fr));
            column-gap: 16px !important;
            row-gap: 0 !important;
            align-items: stretch;
          }

          html.staff-scope .new-order-aligned-card {
            min-width: 0;
          }
        }

        html.staff-scope .new-order-aligned-top-row > .new-order-aligned-card {
          height: 100%;
          align-self: stretch;
        }

        html.staff-scope .new-order-aligned-card__header {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        html.staff-scope .new-order-aligned-row,
        html.staff-scope .new-order-customer-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
      `}</style>
    </>
  );
}
