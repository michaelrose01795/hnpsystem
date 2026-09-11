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
// Rows shared by the three top-row cards: 1 header, 2 the first field row
// (Delivery Method / Registration Number / First Name + Last Name), 3-5 the
// remaining Customer Details field rows, 6 the customer action buttons, 7 page
// extras. Every card spans all seven, so none can end on a different grid line.
const TOP_ROW_ROWS = 7;
const TOP_ROW_EXTRAS_ROW = TOP_ROW_ROWS;
// Rows 2-5 are reserved at label + control height whether or not a card fills
// them, so the row keeps the height of a populated Customer Details card even
// while the customer is still the two-button empty state.
const TOP_ROW_FIELD_ROW = "minmax(calc(var(--control-height) + 22px), auto)";
const TOP_ROW_GRID_ROWS = `auto repeat(4, ${TOP_ROW_FIELD_ROW}) minmax(var(--control-height), auto) auto`;
// Delivery / Vehicle / Customer are one set: identical width, identical height,
// and a height floor that scales with the viewport rather than a fixed pixel value.
const TOP_ROW_CARD_MIN_HEIGHT = "clamp(320px, 40vh, 460px)";
const TOP_ROW_CARD_STYLE = {
  minWidth: 0,
  width: "100%",
  minHeight: TOP_ROW_CARD_MIN_HEIGHT,
  boxSizing: "border-box",
  // staffglobal gives every <section> a 10px bottom margin. Delivery renders as
  // a section and Vehicle / Customer as divs, so the margin ate 10px off the
  // stretched Delivery card and it ended above the other two.
  marginBottom: 0,
};

// The four notes a parts order carries. Keys are form fields; on save they map
// onto the notes / customer_notes / delivery_notes / invoice_notes columns, so
// this card reads the same as the Notes card on /order/[orderNumber].
const ORDER_NOTE_FIELDS = [
  ["internal_notes", "Order notes", "Supplier, stock or handling notes…"],
  ["customer_notes", "Customer notes", "What the customer told us…"],
  ["delivery_notes", "Delivery notes", "Notes for the delivery driver…"],
  ["invoice_notes", "Invoice notes", "Notes to appear on the invoice…"],
];

// Keep the notes preview a fixed size whatever the notes hold — the full text is
// read and edited in the notes popup. Mirrors /order/[orderNumber].
const NOTE_PREVIEW_WORDS = 4;
function notePreview(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "None recorded";
  const words = text.split(" ");
  return words.length <= NOTE_PREVIEW_WORDS ? text : `${words.slice(0, NOTE_PREVIEW_WORDS).join(" ")}…`;
}

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
    <div className="app-summary-item app-summary-item--theme">
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
  // Everything that does not belong on the single-line part row — discount,
  // line notes, unlink, remove — lives in this per-line Edit popup.
  const [editPartId, setEditPartId] = useState(null);
  // All four order notes are read on the Delivery card and edited in one popup.
  const [notesOpen, setNotesOpen] = useState(false);
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
    activePartLine,
    focusedPartLine,
    openPartSearch,
    partLines,
    setFocusedPartLine,
    partSearchLoading,
    partSearchOpen,
    partSearchQuery,
    partSearchResults,
    removePart,
    savingMode,
    selectPart,
    stockShortages,
    stockPromptOpen,
    stockResolution,
    setStockResolution,
    closeStockPrompt,
    confirmStockResolution,
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
    withoutVehicle,
  } = props;

  // Delivery charge only applies when the parts are coming to us; on a
  // collection the Notes card takes that row instead of leaving it empty, so it
  // sits directly under the date / time pickers.
  const showDeliveryCharge = form.delivery_type !== "collection";
  const notesStartRow = showDeliveryCharge ? 5 : 4;

  const populatedLines = partLines.filter((line) => line.part_number || line.part_name);

  // "Search catalogue" is wired to a line rather than to the order: whichever
  // Part number box was last clicked, falling back to the first empty line.
  // Mirrors resolvePartTarget() on the page so the hint matches what happens.
  const searchTargetLine =
    partLines.find((line) => line.client_id === focusedPartLine) ||
    partLines.find((line) => !line.part_number && !line.part_name) ||
    null;
  const searchTargetIndex = searchTargetLine ? partLines.indexOf(searchTargetLine) : -1;
  const activeSearchIndex = partLines.findIndex((line) => line.client_id === activePartLine);
  const editLineIndex = partLines.findIndex((line) => line.client_id === editPartId);
  const editLine = editLineIndex === -1 ? null : partLines[editLineIndex];

  return (
    <>
      <form onSubmit={handleSubmit} className="app-page-stack">
        {/* Page title and status on the left, order actions on the right. */}
        <DevLayoutSection as="header" className="app-page-header" sectionKey="new-order-workflow-header" sectionType="page-header" parentKey="app-layout-page-card">
          <div className="app-page-header__text">
            <h1 className="app-page-header__title">New Order</h1>
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
                gridTemplateRows: TOP_ROW_GRID_ROWS,
                alignItems: "stretch",
                columnGap: "16px",
                rowGap: 0,
                width: "100%",
              }
            : {
                display: "grid",
                // One full-width column below the breakpoint. auto-fit let a lone
                // wrapped card stretch across the collapsed tracks, so the three
                // cards stopped matching each other at in-between widths.
                gridTemplateColumns: "minmax(0, 1fr)",
                gridAutoRows: "minmax(min-content, 1fr)",
                alignItems: "stretch",
                gap: "16px",
                width: "100%",
              }}
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
              ...TOP_ROW_CARD_STYLE,
              ...(rowsAligned
                ? { display: "grid", gridTemplateRows: "subgrid", gridRow: `1 / span ${TOP_ROW_ROWS}` }
                : null),
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

            {showDeliveryCharge ? (
              <FormField label="Delivery charge" htmlFor="delivery-charge" style={rowStyle(4)}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "50%" }}>
                  <input id="delivery-charge" name="delivery_charge" className="app-input" type="number" min="0" step="0.01" style={{ minWidth: 0, flex: 1 }} value={form.delivery_charge} onChange={(event) => handleFieldChange("delivery_charge", event.target.value)} />
                  <span style={{ pointerEvents: "none", flexShrink: 0 }}>£</span>
                </div>
              </FormField>
            ) : null}

            {/* Notes sit with Delivery so the adviser records them while booking.
                Previews only — the full text is written in the notes popup, the
                same arrangement the created order uses on /order/[orderNumber].
                Spans the rest of the shared subgrid so the card still ends on the
                same grid line as Vehicle and Customer. */}
            <LayerSurface
              sectionKey="new-order-delivery-notes"
              parentKey="new-order-delivery"
              radius="var(--radius-sm)"
              padding="10px 12px"
              gap="var(--space-sm)"
              style={{
                minWidth: 0,
                overflowWrap: "anywhere",
                ...(rowsAligned
                  ? {
                      gridRow: `${notesStartRow} / span ${TOP_ROW_ROWS - notesStartRow + 1}`,
                      marginTop: "-2px", // card row gap is 12px; trim 2px so Notes sits 10px below the row above
                    }
                  : null),
              }}
            >
              <div className="app-layout-toolbar-row">
                <h3>Notes</h3>
                <div className="app-page-header__actions" style={{ marginLeft: "auto" }}>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setNotesOpen(true)}>Edit notes</Button>
                </div>
              </div>
              <dl
                className="app-job-summary-panel__meta"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
                  gap: "var(--layout-card-gap)",
                  width: "100%",
                }}
              >
                {ORDER_NOTE_FIELDS.map(([key, label]) => (
                  <div key={key} className="app-job-summary-panel__meta-item" style={{ minWidth: 0 }}>
                    {/* Field labels read as labels rather than the shared meta caps. */}
                    <dt style={{ fontWeight: 400, textTransform: "none", marginBottom: "var(--space-xs)" }}>{label}</dt>
                    <dd style={{ fontSize: "var(--text-body-sm)", lineHeight: 1.5, fontWeight: 600, whiteSpace: "pre-line", margin: 0 }}>
                      {notePreview(form[key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </LayerSurface>
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
            style={TOP_ROW_CARD_STYLE}
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
            gap="12px"
            subgrid={rowsAligned}
            subgridRows={TOP_ROW_ROWS}
            className="new-order-aligned-card"
            style={TOP_ROW_CARD_STYLE}
          >
            {/* Parts-order extras. The card above is byte-identical to /new-job;
                anything specific to a parts order hangs below it, pinned to the
                shared extras row so it grows the whole row rather than this card
                alone. */}
            {customer && customerOrders.length > 0 ? (
              <div style={rowsAligned ? { gridRow: TOP_ROW_EXTRAS_ROW } : undefined}>
                <StatusMessage tone="warning">
                  {customerOrders.length} open order{customerOrders.length === 1 ? "" : "s"} already exist for this customer: {customerOrders.map((order) => order.order_number).join(", ")}.
                </StatusMessage>
              </div>
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
              {searchTargetIndex !== -1 ? <span className="app-field-hint">Fills Part {searchTargetIndex + 1}</span> : null}
              <Button
                type="button"
                variant="secondary"
                title={searchTargetIndex !== -1 ? `Search the catalogue and fill Part ${searchTargetIndex + 1}` : "Search the catalogue"}
                onClick={() => openPartSearch(
                  searchTargetLine?.client_id || null,
                  searchTargetLine?.part_number || searchTargetLine?.part_name || [form.vehicle_make, form.vehicle_model].filter(Boolean).join(" ")
                )}
              >Search catalogue</Button>
              <Button type="button" variant="secondary" onClick={addManualPart}>Add Part</Button>
            </div>
          </div>

          <div style={{ maxHeight: "360px", overflowY: "auto", overflowX: "auto", paddingRight: "4px" }}>
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
                  {/* One line per part, on a fixed column template so every row
                      lines up. Discount, notes, unlink and remove live in the
                      Edit popup rather than competing for width here. */}
                  <div className="new-order-part-row">
                    <strong className="new-order-part-row__index">Part {index + 1}</strong>
                    {/* Clicking a Part number box targets that line, so the
                        Search catalogue button above fills this row. */}
                    <input name={`${line.client_id}_number`} className="app-input" value={line.part_number} onFocus={() => setFocusedPartLine(line.client_id)} onChange={(event) => handlePartChange(line.client_id, "part_number", event.target.value.toUpperCase())} placeholder="Part number" aria-label={`Part ${index + 1} part number`} />
                    <input name={`${line.client_id}_name`} className="app-input" value={line.part_name} onChange={(event) => handlePartChange(line.client_id, "part_name", event.target.value)} placeholder="Description" aria-label={`Part ${index + 1} description`} />
                    <div className="new-order-part-row__meta">
                      <span className={`app-badge app-badge--${availability.tone}`}>{availability.label}</span>
                      <span className="app-field-hint">{line.catalog_snapshot?.storage_location || "No location"}</span>
                    </div>
                    <div className="new-order-part-row__unit">
                      <input type="number" min="1" step="1" value={line.quantity} onChange={(event) => handlePartChange(line.client_id, "quantity", event.target.value)} className="app-input" aria-label={`Part ${index + 1} quantity`} />
                      <span aria-hidden="true">×</span>
                    </div>
                    <div className="new-order-part-row__unit">
                      <input type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => handlePartChange(line.client_id, "unit_price", event.target.value)} placeholder="Price" className="app-input" aria-label={`Part ${index + 1} unit price`} />
                      <span aria-hidden="true">£</span>
                    </div>
                    <strong className="new-order-part-row__total">{money(lineTotal)}</strong>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setEditPartId(line.client_id)} aria-label={`Edit part ${index + 1}`}>Edit</Button>
                  </div>
                  {replacement ? <StatusMessage tone="warning">Superseded by {replacement}</StatusMessage> : null}
                </LayerSurface>
              );
            })}
          </div>
        </LayerTheme>

        <NotesPopup
          isOpen={notesOpen}
          form={form}
          onChange={handleFieldChange}
          onClose={() => setNotesOpen(false)}
        />

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
                  <label className="app-toggle-field"><input name="notify_sms" className="app-toggle app-toggle--checkbox" type="checkbox" checked={form.notify_sms} onChange={(event) => handleFieldChange("notify_sms", event.target.checked)} /><span>SMS</span></label>
                  <label className="app-toggle-field"><input name="notify_email" className="app-toggle app-toggle--checkbox" type="checkbox" checked={form.notify_email} onChange={(event) => handleFieldChange("notify_email", event.target.checked)} /><span>Email</span></label>
                  <label className="app-toggle-field"><input name="notify_phone" className="app-toggle app-toggle--checkbox" type="checkbox" checked={form.notify_phone} onChange={(event) => handleFieldChange("notify_phone", event.target.checked)} /><span>Phone</span></label>
                </ToolbarRow>
                <label className="app-toggle-field"><input name="reserve_stock" className="app-toggle app-toggle--checkbox" type="checkbox" checked={form.reserve_stock} onChange={(event) => handleFieldChange("reserve_stock", event.target.checked)} /><span>Reserve available catalogue stock when order is created</span></label>
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
              <div><strong>Parts catalogue</strong><div className="app-field-hint">{activeSearchIndex !== -1 ? `Filling Part ${activeSearchIndex + 1}. ` : ""}Search by part number, description, OEM reference, location or vehicle detail.</div></div>
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

      {/* Create order raises this when a catalogue line cannot be covered from
          stock. The order cannot be created until the adviser says how those
          parts are being supplied, so it can never be collected or shipped
          with parts that are not here and no arrival date on record. */}
      {stockPromptOpen ? (
        <PopupModal maxWidth="620px" onClose={closeStockPrompt} ariaLabel="Confirm parts supply">
          <div className="app-page-stack" style={{ padding: "var(--section-card-padding)" }}>
            <header className="app-popup-compact-header">
              <div>
                <strong>Parts not in stock</strong>
                <div className="app-field-hint">{stockShortages.length} line{stockShortages.length === 1 ? "" : "s"} cannot be covered from the shelf. Confirm how they are being supplied before the order is created.</div>
              </div>
            </header>
            <LayerTheme sectionKey="new-order-stock-shortages" parentKey="shared-popup-card" sectionType="content-card" radius="var(--radius-sm)" padding="10px" gap="var(--space-xs)">
              {stockShortages.map((entry) => (
                <div key={entry.client_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span><strong>{entry.part_number || entry.part_name || "Part"}</strong>{entry.part_number && entry.part_name ? ` · ${entry.part_name}` : ""}</span>
                  <span className="app-field-hint">{entry.required} required · {entry.available} available{entry.on_order > 0 ? ` · ${entry.on_order} on order` : ""}</span>
                </div>
              ))}
            </LayerTheme>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Button type="button" variant={stockResolution.mode === "goods_in" ? "primary" : "secondary"} aria-pressed={stockResolution.mode === "goods_in"} onClick={() => setStockResolution((current) => ({ ...current, mode: "goods_in" }))}>Goods in now</Button>
              <Button type="button" variant={stockResolution.mode === "ordered" ? "primary" : "secondary"} aria-pressed={stockResolution.mode === "ordered"} onClick={() => setStockResolution((current) => ({ ...current, mode: "ordered" }))}>Ordered from supplier</Button>
            </div>
            {stockResolution.mode === "goods_in" ? (
              <StatusMessage tone="warning">The parts are being booked in at the counter today. Stock will not be reserved for these lines — book them in before the order is handed over.</StatusMessage>
            ) : null}
            {stockResolution.mode === "ordered" ? (
              <>
                <CalendarField name="parts_arrival_date" label="Parts arrival date" value={stockResolution.arrival_date} onValueChange={(value) => setStockResolution((current) => ({ ...current, arrival_date: value }))} />
                <FormField label="Supplier reference" hint="Optional — supplier order or ETA reference." htmlFor="parts-supply-reference">
                  <input id="parts-supply-reference" name="parts_supply_reference" className="app-input" value={stockResolution.reference} onChange={(event) => setStockResolution((current) => ({ ...current, reference: event.target.value }))} placeholder="Supplier order number" />
                </FormField>
                <StatusMessage tone="warning">
                  {stockResolution.arrival_date
                    ? `The order is held until ${stockResolution.arrival_date} — the ${form.delivery_type === "collection" ? "collection" : "delivery"} date moves to that date at the earliest and the hold is written onto the delivery notes.`
                    : "Add the date the parts land. The order cannot be created without it."}
                </StatusMessage>
              </>
            ) : null}
            <ToolbarRow style={{ justifyContent: "flex-end" }}>
              <Button type="button" variant="secondary" onClick={closeStockPrompt}>Back to order</Button>
              <Button
                type="button"
                disabled={!stockResolution.mode || (stockResolution.mode === "ordered" && !stockResolution.arrival_date)}
                onClick={confirmStockResolution}
              >Confirm and create order</Button>
            </ToolbarRow>
          </div>
        </PopupModal>
      ) : null}

      {editLine ? (
        <PopupModal maxWidth="560px" onClose={() => setEditPartId(null)} ariaLabel={`Edit part ${editLineIndex + 1}`}>
          <div className="app-page-stack" style={{ padding: "var(--section-card-padding)" }}>
            <header className="app-popup-compact-header">
              <div>
                <strong>Part {editLineIndex + 1}</strong>
                <div className="app-field-hint">{editLine.part_number || editLine.part_name || "New line"} · {editLine.catalog_snapshot?.storage_location || "No location"}</div>
              </div>
              {/* Line actions sit in the header rather than a footer toolbar so
                  the popup ends on the line total. */}
              <div className="app-popup-compact-header__actions">
                <Button type="button" variant="secondary" size="sm" onClick={() => {
                  const query = editLine.part_number || editLine.part_name;
                  setEditPartId(null);
                  openPartSearch(editLine.client_id, query);
                }}>Alternatives</Button>
                {editLine.part_catalog_id ? <Button type="button" variant="secondary" size="sm" onClick={() => clearPartLink(editLine.client_id)}>Unlink catalogue part</Button> : null}
                <Button type="button" variant="danger" size="sm" onClick={() => {
                  removePart(editLine.client_id);
                  setEditPartId(null);
                }}>Delete part</Button>
                <Button type="button" size="sm" onClick={() => setEditPartId(null)}>Done</Button>
              </div>
            </header>

            {supersededPart(editLine) ? <StatusMessage tone="warning">Superseded by {supersededPart(editLine)}</StatusMessage> : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              <FormField label="Part number" htmlFor="edit-part-number">
                <input id="edit-part-number" name="edit_part_number" className="app-input" value={editLine.part_number} onChange={(event) => handlePartChange(editLine.client_id, "part_number", event.target.value.toUpperCase())} placeholder="Part number" />
              </FormField>
              <FormField label="Description" htmlFor="edit-part-name">
                <input id="edit-part-name" name="edit_part_name" className="app-input" value={editLine.part_name} onChange={(event) => handlePartChange(editLine.client_id, "part_name", event.target.value)} placeholder="Description" />
              </FormField>
              <FormField label="Quantity" htmlFor="edit-part-quantity">
                <input id="edit-part-quantity" name="edit_part_quantity" type="number" min="1" step="1" className="app-input" value={editLine.quantity} onChange={(event) => handlePartChange(editLine.client_id, "quantity", event.target.value)} />
              </FormField>
              <FormField label="Unit price" htmlFor="edit-part-price">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input id="edit-part-price" name="edit_part_price" type="number" min="0" step="0.01" className="app-input" style={{ minWidth: 0, flex: 1 }} value={editLine.unit_price} onChange={(event) => handlePartChange(editLine.client_id, "unit_price", event.target.value)} />
                  <span aria-hidden="true" style={{ flexShrink: 0 }}>£</span>
                </div>
              </FormField>
              <FormField label="Discount" hint="Percentage off the unit price." htmlFor="edit-part-discount">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input id="edit-part-discount" name="edit_part_discount" type="number" min="0" max="100" step="0.1" className="app-input" style={{ minWidth: 0, flex: 1 }} value={editLine.discount} onChange={(event) => handlePartChange(editLine.client_id, "discount", event.target.value)} />
                  <span aria-hidden="true" style={{ flexShrink: 0 }}>%</span>
                </div>
              </FormField>
              <FormField label="Availability">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "var(--control-height)" }}>
                  <span className={`app-badge app-badge--${partAvailability(editLine).tone}`}>{partAvailability(editLine).label}</span>
                </div>
              </FormField>
            </div>

            <FormField label="Line notes" hint="Saved against this order line." htmlFor="edit-part-notes">
              <textarea id="edit-part-notes" name="edit_part_notes" className="app-input app-input--textarea" rows={3} value={editLine.notes || ""} onChange={(event) => handlePartChange(editLine.client_id, "notes", event.target.value)} placeholder="Supplier, fitment or handling notes" />
            </FormField>

            <div className="app-summary-section">
              <div className="app-summary-grid">
                <SummaryItem label="Line total">
                  {money((Number(editLine.quantity) || 0) * (Number(editLine.unit_price) || 0) * (1 - Math.min(Math.max(Number(editLine.discount) || 0, 0), 100) / 100))}
                </SummaryItem>
              </div>
            </div>

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

        /* The three cards are sized by their grid track, never by their own
           content, so they keep matching widths and heights at every width. */
        html.staff-scope .new-order-aligned-top-row > .new-order-aligned-card {
          height: 100%;
          width: 100%;
          min-width: 0;
          align-self: stretch;
          justify-self: stretch;
        }

        html.staff-scope .new-order-aligned-card__header {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        /* Part lines: one row each, on a shared column template so the fields
           line up down the list. The list scrolls sideways below ~880px
           rather than wrapping a line onto two. */
        html.staff-scope .new-order-part-row {
          display: grid;
          grid-template-columns: auto minmax(110px, 150px) minmax(160px, 1fr) minmax(150px, 210px) 78px 108px 88px auto;
          align-items: center;
          gap: 10px;
          min-width: 860px;
        }

        html.staff-scope .new-order-part-row > * {
          min-width: 0;
        }

        html.staff-scope .new-order-part-row__index,
        html.staff-scope .new-order-part-row__total {
          white-space: nowrap;
        }

        html.staff-scope .new-order-part-row__total {
          text-align: right;
        }

        html.staff-scope .new-order-part-row__meta {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        html.staff-scope .new-order-part-row__meta > .app-field-hint {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        html.staff-scope .new-order-part-row__unit {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        html.staff-scope .new-order-part-row__unit > .app-input {
          min-width: 0;
          flex: 1;
        }

        html.staff-scope .new-order-part-row__unit > span {
          flex-shrink: 0;
          pointer-events: none;
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

// Inherit the canonical popup shell while keeping the notes editor compact.
// Matches the notes popup on /order/[orderNumber].
const NOTES_POPUP_CARD_STYLE = {
  width: "min(100%, 560px)",
  maxWidth: "560px",
  padding: "var(--page-card-padding)",
};

// One popup for every note on the order being created. There is nothing to save
// here — the notes go to the database with the rest of the form.
function NotesPopup({ isOpen, form, onChange, onClose }) {
  if (!isOpen) return null;
  return (
    <PopupModal isOpen onClose={onClose} ariaLabel="Order notes" cardStyle={NOTES_POPUP_CARD_STYLE}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)", minWidth: 0 }}>
        {/* Compact popup header convention: title left, actions top right. */}
        <header className="app-popup-compact-header">
          <h2>Notes</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" size="sm" onClick={onClose}>Done</Button>
          </div>
        </header>
        {ORDER_NOTE_FIELDS.map(([key, label, placeholder]) => (
          <FormField key={key} label={label} htmlFor={`new-order-${key}`}>
            <textarea
              id={`new-order-${key}`}
              name={key}
              className="app-input app-input--textarea"
              rows={4}
              value={form[key] || ""}
              onChange={(event) => onChange(key, event.target.value)}
              placeholder={placeholder}
            />
          </FormField>
        ))}
      </div>
    </PopupModal>
  );
}
