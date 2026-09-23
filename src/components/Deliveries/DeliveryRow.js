// file location: src/components/Deliveries/DeliveryRow.js
//
// One stop on the day's route.
//
// Dense by design: stop number, planned time/window, customer + address +
// clickable phone, reference + item/package count, value + payment state,
// linked job/vehicle, driver + van, status, and the actions legal from the
// current state. Everything visual is the shared staff system — LayerSurface,
// .app-badge--*, Button, and the token geometry in ./deliveryStyles.
//
// Two structural decisions worth keeping:
//
//  * The row is NOT one big button. The phone number and the job link are
//    themselves interactive, so wrapping the lot in a <button> (as the previous
//    version did) nested controls inside a control. Selection is an explicit
//    "Details" action instead.
//  * The information cells are an auto-fit grid, not a fixed 7-column track.
//    With the detail panel open the list column is ~600px wide, and fixed
//    minimum widths overflowed the card.

import React from "react";
import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import Button from "@/components/ui/Button";
import {
  deliveryStatusBadgeClass,
  deliveryStatusLabel,
  deliveryFailureReasonLabel,
  getDeliveryActions,
  isOpenDeliveryStatus,
} from "@/features/deliveries/deliveryStatus";
import {
  deliveryReference,
  formatCurrency,
  formatDeliveryAddress,
  formatDeliveryWindow,
  formatLoadSummary,
  isDeliveryOverdue,
  navigationHref,
  telHref,
} from "@/features/deliveries/deliveryFormatting";
import { deliveryStyles, deliveryText } from "./deliveryStyles";

const stopHandleLabel = (delivery, index) =>
  `Stop ${index + 1}: ${delivery.customerDisplayName || "delivery"}. Press ArrowUp or ArrowDown to change the route order.`;

export default function DeliveryRow({
  delivery,
  index,
  total,
  selected,
  stacked,
  capabilities,
  busy,
  isDragging,
  isDropTarget,
  onSelect,
  onAction,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onKeyboardMove,
}) {
  const open = isOpenDeliveryStatus(delivery.status);
  const overdue = isDeliveryOverdue(delivery, { open });
  const actions = getDeliveryActions(delivery, capabilities);
  const phone = delivery.contactPhone;
  const navigate = navigationHref(delivery);
  const canReorder = capabilities?.reorder === true;

  const timing = (
    <div style={deliveryStyles.cell}>
      <span style={deliveryText.label}>When</span>
      <span style={overdue ? deliveryText.danger : deliveryText.value}>
        {formatDeliveryWindow(delivery)}
      </span>
      <div style={deliveryStyles.badgeStrip}>
        {delivery.is_urgent ? (
          <span className="app-badge app-badge--danger-strong app-badge--uppercase">Urgent</span>
        ) : null}
        {delivery.is_collection ? (
          <span className="app-badge app-badge--neutral">Collection</span>
        ) : null}
      </div>
    </div>
  );

  const identity = (
    <div style={deliveryStyles.cell}>
      <span style={deliveryText.label}>Customer</span>
      <strong style={{ ...deliveryText.valueStrong, ...deliveryStyles.truncate }}>
        {delivery.customerDisplayName || delivery.customer_name || "Customer"}
      </strong>
      <span style={{ ...deliveryText.muted, ...deliveryStyles.truncate }} title={delivery.addressLine}>
        {formatDeliveryAddress(delivery) ||
          "No address recorded"}
      </span>
      {phone ? (
        <a href={telHref(phone)} style={deliveryText.link}>
          {phone}
        </a>
      ) : (
        <span style={deliveryText.caption}>No contact number</span>
      )}
    </div>
  );

  const reference = (
    <div style={deliveryStyles.cell}>
      <span style={deliveryText.label}>Reference</span>
      <span style={{ ...deliveryText.value, ...deliveryStyles.truncate }}>
        {deliveryReference(delivery)}
      </span>
      <span style={deliveryText.caption}>{formatLoadSummary(delivery)}</span>
      {delivery.missing_items ? (
        <div style={deliveryStyles.badgeStrip}>
          <span className="app-badge app-badge--warning">Missing items</span>
        </div>
      ) : null}
    </div>
  );

  const money = (
    <div style={deliveryStyles.cell}>
      <span style={deliveryText.label}>Value</span>
      <span style={deliveryText.valueStrong}>{formatCurrency(delivery.value)}</span>
      <div style={deliveryStyles.badgeStrip}>
        <span className={`app-badge ${delivery.isPaid ? "app-badge--success" : "app-badge--danger"}`}>
          {delivery.isPaid ? "Paid" : "Payment due"}
        </span>
      </div>
    </div>
  );

  const linked = (
    <div style={deliveryStyles.cell}>
      <span style={deliveryText.label}>Job &amp; driver</span>
      {delivery.jobNumber ? (
        <Link href={`/job-cards/${encodeURIComponent(delivery.jobNumber)}`} style={deliveryText.link}>
          {delivery.jobNumber}
        </Link>
      ) : (
        <span style={deliveryText.caption}>No workshop job</span>
      )}
      {delivery.vehicleDetails ? (
        <span style={{ ...deliveryText.muted, ...deliveryStyles.truncate }}>
          {delivery.vehicleDetails}
        </span>
      ) : null}
      <span style={{ ...deliveryText.caption, ...deliveryStyles.truncate }}>
        {delivery.driver_name || "Unassigned"}
        {delivery.vehicle_reg ? ` · ${delivery.vehicle_reg}` : ""}
      </span>
    </div>
  );

  const statusCell = (
    <div style={deliveryStyles.cell}>
      <span style={deliveryText.label}>Status</span>
      <div style={deliveryStyles.badgeStrip}>
        <span className={deliveryStatusBadgeClass(delivery.status)}>
          {deliveryStatusLabel(delivery.status)}
        </span>
      </div>
      {delivery.failed_reason ? (
        <span style={deliveryText.danger}>
          {deliveryFailureReasonLabel(delivery.failed_reason)}
        </span>
      ) : null}
      {delivery.pod_recipient_name ? (
        <span style={deliveryText.caption}>Signed: {delivery.pod_recipient_name}</span>
      ) : null}
    </div>
  );

  const actionCell = (
    <div style={deliveryStyles.rowActions}>
      <Button variant="ghost" size="sm" onClick={() => onSelect(delivery)} aria-pressed={selected}>
        {selected ? "Hide details" : "Details"}
      </Button>
      {navigate ? (
        <a
          className="app-btn app-btn--secondary app-btn--sm"
          href={navigate}
          target="_blank"
          rel="noreferrer"
        >
          Navigate
        </a>
      ) : null}
      {phone ? (
        <a className="app-btn app-btn--secondary app-btn--sm" href={telHref(phone)}>
          Call
        </a>
      ) : null}
      {delivery.invoice_id ? (
        <Link
          className="app-btn app-btn--secondary app-btn--sm"
          href={`/accounts/invoices/${encodeURIComponent(delivery.invoice_id)}`}
        >
          Invoice
        </Link>
      ) : null}
      {delivery.pod_photo_url || delivery.pod_signature_url ? (
        <a
          className="app-btn app-btn--secondary app-btn--sm"
          href={delivery.pod_photo_url || delivery.pod_signature_url}
          target="_blank"
          rel="noreferrer"
        >
          View POD
        </a>
      ) : null}
      {actions.map((action) => (
        <Button
          key={action.key}
          variant={action.variant}
          size="sm"
          busy={busy === action.key}
          disabled={Boolean(busy)}
          onClick={() => onAction(delivery, action.key)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );

  const handle = (
    <div style={deliveryStyles.stopColumn}>
      <button
        type="button"
        className="app-btn app-btn--secondary app-btn--sm"
        draggable={canReorder}
        aria-label={stopHandleLabel(delivery, index)}
        aria-disabled={!canReorder}
        title={canReorder ? "Drag, or use the arrow keys, to change the route order" : "Stop number"}
        onDragStart={canReorder ? (event) => onDragStart(event, delivery.id) : undefined}
        onDragEnd={canReorder ? onDragEnd : undefined}
        onKeyDown={(event) => {
          if (!canReorder) return;
          if (event.key === "ArrowUp" && index > 0) {
            event.preventDefault();
            onKeyboardMove(delivery.id, -1);
          }
          if (event.key === "ArrowDown" && index < total - 1) {
            event.preventDefault();
            onKeyboardMove(delivery.id, 1);
          }
        }}
        style={{ width: "100%", cursor: canReorder ? "grab" : "default" }}
      >
        <span style={deliveryText.stopNumber}>{index + 1}</span>
      </button>
      <span style={deliveryText.caption}>Stop</span>
    </div>
  );

  // Drag and selection feedback use opacity and an outline, never a border —
  // borders are reserved for inputs, checkboxes, ghost buttons and focus rings.
  // Selection is an outline rather than a second theme layer, because two theme
  // layers in a row is the one thing the layer rules forbid (CLAUDE.md 3.0).
  const rowOutline = isDropTarget
    ? "2px dashed var(--input-ring-color)"
    : selected
    ? "2px solid var(--accent-strong)"
    : "none";

  return (
    <LayerSurface
      as="article"
      padding="var(--space-3)"
      gap="var(--space-sm)"
      radius="var(--radius-sm)"
      aria-label={`Stop ${index + 1}, ${delivery.customerDisplayName || "delivery"}, ${deliveryStatusLabel(delivery.status)}`}
      aria-current={selected ? "true" : undefined}
      data-delivery-id={delivery.id}
      data-row-state={selected ? "active" : open ? undefined : "muted"}
      onDragOver={canReorder ? (event) => onDragOver(event, delivery.id) : undefined}
      onDrop={canReorder ? (event) => onDrop(event, delivery.id) : undefined}
      style={{
        width: "100%",
        opacity: isDragging ? 0.45 : open ? 1 : 0.72,
        outline: rowOutline,
        outlineOffset: "2px",
      }}
    >
      <div style={deliveryStyles.rowGrid}>
        {handle}
        <div style={deliveryStyles.rowBody}>
          <div style={stacked ? deliveryStyles.rowCellsStacked : deliveryStyles.rowCells}>
            {timing}
            {identity}
            {reference}
            {money}
            {linked}
            {statusCell}
          </div>
          {actionCell}
        </div>
      </div>
    </LayerSurface>
  );
}
