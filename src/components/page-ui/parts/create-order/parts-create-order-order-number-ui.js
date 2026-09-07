import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
// file location: src/components/page-ui/parts/create-order/parts-create-order-order-number-ui.js
import Button from "@/components/ui/Button"; // shared button primitive (CLAUDE.md §3.4)
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import PopupModal from "@/components/popups/popupStyleApi"; // shared popup shell

export default function PartsOrderDetailUi(props) {
  const {
    DeliveryTab,
    InvoiceTab,
    PartsTab,
    activeTab,
    addPartRow,
    cancelPartsEdit,
    closeNotes,
    containerStyle,
    partsDraft,
    partsEditing,
    partsError,
    partsSaving,
    removePartRow,
    savePartsEdit,
    setPartField,
    startPartsEdit,
    notesDraft,
    notesError,
    notesOpen,
    notesSaving,
    openNotes,
    saveNotes,
    setNotesField,
    error,
    formatCurrency,
    formatDeliveryStatus,
    formatInvoiceStatus,
    formatOrderStatus,
    loading,
    order,
    resolvedOrderNumber,
    sectionCard,
    setActiveTab,
    statusChip,
    totals,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div style={containerStyle}>
        <LayerTheme style={sectionCard}>
          <div className="app-page-header">
            <div className="app-job-summary-panel__identity">
              <h1 className="app-job-summary-panel__title">{order?.order_number || resolvedOrderNumber || "Loading..."}</h1>
              <p className="app-job-summary-panel__subtitle">
                {order?.customer_name || "Customer"} &middot; {order?.vehicle_reg || "No registration"}
              </p>
            </div>
            <div style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--layout-card-gap)",
          flexWrap: "wrap"
        }}>
              {statusChip(formatOrderStatus(order?.status), order?.status === "complete" ? "success" : order?.status === "draft" ? "warning" : "info")}
              {formatDeliveryStatus(order?.delivery_status) !== formatOrderStatus(order?.status) &&
                statusChip(formatDeliveryStatus(order?.delivery_status), order?.delivery_status === "delivered" ? "success" : "info")}
              {statusChip(formatInvoiceStatus(order?.invoice_status), order?.invoice_status === "paid" ? "success" : order?.invoice_status === "issued" ? "info" : "warning")}
            </div>
            {/* Header totals sit top-right as their own --surface tiles above the theme layer. */}
            <div className="app-page-header__actions" style={{ marginLeft: "auto", alignItems: "stretch" }}>
              {[
                ["Parts lines", totals.itemsCount],
                ["Subtotal", formatCurrency(totals.subtotal)],
                ["Invoice total", formatCurrency(order?.invoice_total ?? totals.subtotal)],
              ].map(([label, value]) => (
                <LayerSurface key={label} className="app-job-summary-panel__stat" radius="var(--radius-sm)" padding="8px 12px" gap="var(--space-xs)" style={{ minWidth: "120px" }}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </LayerSurface>
              ))}
            </div>
          </div>
        </LayerTheme>

          {/* Three equal-width sibling cards that fill the row and collapse as the viewport narrows. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "var(--layout-card-gap)", width: "100%" }}>
            <OrderSummaryBox title="Vehicle" fields={[["Registration", order?.vehicle_reg], ["Make", order?.vehicle_make], ["Model", order?.vehicle_model], ["VIN", order?.vehicle_vin]]} />
            <OrderSummaryBox title="Customer & contact" fields={[["Customer", order?.customer_name], ["Phone", order?.customer_phone], ["Address", order?.customer_address], ["Email", order?.customer_email]]} />
            <OrderSummaryBox
              title="Notes"
              fields={[
                ["Order notes", notePreview(order?.notes)],
                ["Customer notes", notePreview(order?.customer_notes)],
                ["Delivery notes", notePreview(order?.delivery_notes)],
                ["Invoice notes", notePreview(order?.invoice_notes)],
              ]}
              onOpen={openNotes}
              openLabel="Open the notes popup to read and edit order, delivery and invoice notes"
            />
          </div>

          <NotesPopup
            isOpen={Boolean(notesOpen)}
            draft={notesDraft}
            error={notesError}
            saving={Boolean(notesSaving)}
            onChange={setNotesField}
            onClose={closeNotes}
            onSave={saveNotes}
          />

        <LayerTheme style={sectionCard}>
          {/* Tabs and the active tab's actions share one toolbar row; the row
              hands the tabs their own full-width line on mobile. */}
          <div className="app-layout-toolbar-row">
            <TabGroup
              ariaLabel="Parts order sections"
              items={[
                { key: "parts", label: "Parts" },
                { key: "delivery", label: "Delivery" },
                { key: "invoice", label: "Invoice" },
              ]}
              value={activeTab}
              onChange={setActiveTab}
            />
            {activeTab === "parts" && order && !loading && !error && (
              <div className="app-page-header__actions" style={{ marginLeft: "auto" }}>
                {partsEditing && (
                  <>
                    <Button variant="secondary" size="sm" onClick={addPartRow} disabled={partsSaving}>Add part</Button>
                    <Button variant="ghost" size="sm" onClick={cancelPartsEdit} disabled={partsSaving}>Cancel</Button>
                  </>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={partsEditing ? savePartsEdit : startPartsEdit}
                  busy={Boolean(partsEditing && partsSaving)}
                  disabled={Boolean(partsSaving)}
                >
                  {partsEditing ? (partsSaving ? "Saving…" : "Save parts") : "Edit parts"}
                </Button>
              </div>
            )}
          </div>

          {loading ? <p style={{
        color: "var(--info)"
      }}>Loading…</p> : error ? <p style={{
        color: "var(--danger)"
      }}>{error}</p> : !order ? <p style={{
        color: "var(--info)"
      }}>Parts order not found.</p> : <>
              {activeTab === "parts" && (
                <PartsTab
                  items={order.items || []}
                  editing={Boolean(partsEditing)}
                  draft={partsDraft}
                  saving={Boolean(partsSaving)}
                  editError={partsError}
                  onRemoveRow={removePartRow}
                  onFieldChange={setPartField}
                />
              )}
              {activeTab === "delivery" && <DeliveryTab order={order} />}
              {activeTab === "invoice" && <InvoiceTab order={order} totals={totals} orderNumber={resolvedOrderNumber} /> // pass order number into invoice tab
        }
            </>}
        </LayerTheme>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}

// Keep the notes card a fixed size whatever the notes hold — the full text is
// read and edited in the notes popup.
const NOTE_PREVIEW_WORDS = 4;
function notePreview(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "None recorded";
  const words = text.split(" ");
  return words.length <= NOTE_PREVIEW_WORDS ? text : `${words.slice(0, NOTE_PREVIEW_WORDS).join(" ")}…`;
}

// Group related fields inside one summary card without adding nested surfaces.
function OrderSummaryBox({ title, fields, onOpen = null, openLabel }) {
  const interactive = typeof onOpen === "function";
  return (
    <LayerTheme
      radius="var(--radius-sm)"
      padding="12px 14px"
      style={{ minWidth: 0, overflowWrap: "anywhere", width: "100%", cursor: interactive ? "pointer" : undefined }} // pointer signals the notes card opens the editor.
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? openLabel : undefined}
      onClick={interactive ? onOpen : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen();
      } : undefined}
    > {/* Match the compact padding used by job-card summary cards. */}
      <h2 className="app-job-summary-panel__title">{title}</h2>
      <dl
        className="app-job-summary-panel__meta"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))", // fields sit side by side across the card until it is too narrow.
          gap: "var(--layout-card-gap)",
          width: "100%",
        }}
      >
        {fields.map(([label, value]) => (
          <div key={label} className="app-job-summary-panel__meta-item" style={{ minWidth: 0 }}>
            <dt style={{ fontWeight: 400, textTransform: "none", marginBottom: "var(--space-xs)" }}> {/* Distinguish field labels from values without changing shared summary styles. */}
              {label}
            </dt>
            <dd style={{ fontSize: "var(--text-body-sm)", lineHeight: 1.5, fontWeight: 600, whiteSpace: "pre-line", margin: 0 }}> {/* Field values retain emphasis. */}
              {value || "Not provided"}
            </dd>
          </div>
        ))}
      </dl>
    </LayerTheme>
  );
}

// Inherit the canonical popup shell while keeping the notes editor compact.
const NOTES_POPUP_CARD_STYLE = {
  width: "min(100%, 560px)",
  maxWidth: "560px",
  padding: "var(--page-card-padding)",
};

// One popup for every note on a parts order: order, delivery and invoice.
function NotesPopup({ isOpen, draft, error, saving, onChange, onClose, onSave }) {
  const fields = [
    ["notes", "Order notes", "Notes about this order…"],
    ["customer_notes", "Customer notes", "What the customer told us…"],
    ["delivery_notes", "Delivery notes", "Notes for the delivery driver…"],
    ["invoice_notes", "Invoice notes", "Notes to appear on the invoice…"],
  ];
  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop={!saving}
      ariaLabel="Order notes"
      cardStyle={NOTES_POPUP_CARD_STYLE}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)", minWidth: 0 }}>
        {/* Compact popup header convention: title left, actions top right. */}
        <header className="app-popup-compact-header">
          <h2>Notes</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="button" variant="primary" size="sm" onClick={onSave} busy={saving} disabled={saving}>
              {saving ? "Saving…" : "Save notes"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Close
            </Button>
          </div>
        </header>
        {fields.map(([key, label, placeholder]) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", minWidth: 0 }}>
            <label htmlFor={`parts-order-${key}`} style={{ fontWeight: 600 }}>{label}</label>
            <textarea
              id={`parts-order-${key}`}
              className="app-input app-input--textarea"
              rows={4}
              value={draft?.[key] || ""}
              onChange={(event) => onChange(key, event.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
        {error && <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>}
      </div>
    </PopupModal>
  );
}
