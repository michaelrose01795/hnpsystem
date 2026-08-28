// file location: src/components/Deliveries/DeliveryDetailPanel.js
//
// The selected stop, in full: customer, address, invoice, items, packages,
// value, payment state, driver, van, notes, proof of delivery, core returns and
// the history trail — plus the actions legal from the current state.
//
// Assignment controls are the shared DropdownField / TimePickerField / .app-input
// and are hidden entirely (not merely disabled) for a role that cannot assign,
// so a driver's panel is the run sheet rather than a locked planning form.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import DeliveryRouteMap from "./DeliveryRouteMap";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import {
  deliveryFailureReasonLabel,
  deliveryStatusBadgeClass,
  deliveryStatusLabel,
  getDeliveryActions,
} from "@/features/deliveries/deliveryStatus";
import {
  deliveryReference,
  formatCurrency,
  formatDeliveryAddress,
  formatDeliveryWindow,
  formatIsoDate,
  formatTimestampTime,
  navigationHref,
  telHref,
} from "@/features/deliveries/deliveryFormatting";
import { deliveryStyles, deliveryText } from "./deliveryStyles";

// `parts_delivery_jobs.items` is free-form jsonb and two shapes are already in
// the table: the invoice-line shape ({ description, quantity, total }) written
// by /delivery-planner, and a shorter parts shape ({ name, partNumber, qty }).
// Both are read rather than one being "fixed" — the rows are real history.
const describeItem = (item = {}) => {
  const name = item.description || item.part_name || item.name || "Item";
  const number = item.part_number || item.partNumber;
  return number ? `${name} (${number})` : name;
};

const Field = ({ label, children }) => (
  <div style={deliveryStyles.cell}>
    <span style={deliveryText.label}>{label}</span>
    <span style={deliveryText.value}>{children}</span>
  </div>
);

// The workflow timeline, built from the timestamps the row already carries so
// it stays correct even before the first event row exists.
const TIMELINE_STEPS = [
  ["Picked", "picked_at"],
  ["Ready", "ready_at"],
  ["Loaded", "loaded_at"],
  ["Dispatched", "dispatched_at"],
  ["Delivered", "completed_at"],
  ["Failed", "failed_at"],
  ["Returned", "returned_at"],
];

export default function DeliveryDetailPanel({
  delivery,
  events = [],
  drivers = [],
  vehicles = [],
  capabilities,
  stacked,
  busy,
  map,
  mapLoading,
  mapError,
  onAction,
  onPatch,
  onClose,
  onOpenProof,
  onSelectStopId,
}) {
  const [notesDraft, setNotesDraft] = useState("");
  const [packagesDraft, setPackagesDraft] = useState("0");
  const [missingDraft, setMissingDraft] = useState("");

  // Re-seed the editable drafts whenever a different stop is selected, so the
  // panel never shows the previous stop's unsaved text.
  useEffect(() => {
    setNotesDraft(delivery?.notes || "");
    setPackagesDraft(String(delivery?.package_count ?? 0));
    setMissingDraft(delivery?.missing_items || "");
  }, [delivery?.id, delivery?.notes, delivery?.package_count, delivery?.missing_items]);

  // The route is part of the panel chrome, not part of a selected stop — it
  // runs the full width at the top of the panel, stays on screen with nothing
  // selected so the day's shape is always visible, and a stop can be picked
  // straight off it.
  const routeMap = (
    <DeliveryRouteMap
      error={mapError}
      loading={mapLoading}
      map={map}
      onSelectStop={onSelectStopId}
      selectedId={delivery?.id || ""}
    />
  );

  if (!delivery) {
    return (
      <LayerTheme
        as="section"
        sectionKey="parts-deliveries-detail"
        sectionType="content-card"
        data-presentation="deliveries-detail"
        style={stacked ? deliveryStyles.detailCardStacked : deliveryStyles.detailCard}
      >
        {routeMap}
        <div style={deliveryStyles.cell}>
          <span style={deliveryText.label}>Delivery detail</span>
          <span style={deliveryText.muted}>
            Choose a stop from the route — on the list or on the map — to see its customer,
            invoice, items and delivery actions.
          </span>
        </div>
      </LayerTheme>
    );
  }

  const actions = getDeliveryActions(delivery, capabilities);
  const canAssign = capabilities?.assign === true;
  const canPick = capabilities?.pick === true;
  const items = Array.isArray(delivery.items) ? delivery.items : [];
  const navigate = navigationHref(delivery);

  const driverOptions = [
    { value: "", label: "Unassigned" },
    ...drivers.map((driver) => ({
      value: String(driver.userId),
      label: driver.name,
      description: driver.role,
    })),
  ];

  const vehicleOptions = [
    { value: "", label: "No vehicle" },
    ...vehicles.map((vehicle) => ({ value: vehicle.reg, label: vehicle.label })),
  ];

  return (
    <LayerTheme
      as="section"
      sectionKey="parts-deliveries-detail"
      sectionType="content-card"
      data-presentation="deliveries-detail"
      style={stacked ? deliveryStyles.detailCardStacked : deliveryStyles.detailCard}
    >
      {routeMap}

      <div style={deliveryStyles.modalHeader}>
        <div style={deliveryStyles.cell}>
          <span style={deliveryText.label}>Stop {delivery.sort_order || "—"}</span>
          <strong style={deliveryText.valueStrong}>
            {delivery.customerDisplayName || delivery.customer_name || "Customer"}
          </strong>
          <div style={deliveryStyles.badgeStrip}>
            <span className={deliveryStatusBadgeClass(delivery.status)}>
              {deliveryStatusLabel(delivery.status)}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close delivery details">
          Close
        </Button>
      </div>

      <div style={deliveryStyles.detailScroll}>
        {/* Contact + address */}
        <LayerSurface padding="var(--space-3)" gap="var(--space-sm)" radius="var(--radius-sm)">
          <div style={deliveryStyles.detailGrid}>
            <Field label="Reference">{deliveryReference(delivery)}</Field>
            <Field label="Delivery date">{formatIsoDate(delivery.delivery_date)}</Field>
            <Field label="Time">{formatDeliveryWindow(delivery)}</Field>
            <Field label="Value">{formatCurrency(delivery.value)}</Field>
          </div>
          <div style={deliveryStyles.cell}>
            <span style={deliveryText.label}>Address</span>
            <span style={deliveryText.value}>
              {formatDeliveryAddress(delivery) ||
                "No address recorded"}
            </span>
          </div>
          <div style={deliveryStyles.badgeStrip}>
            {delivery.contactPhone ? (
              <a className="app-btn app-btn--secondary app-btn--sm" href={telHref(delivery.contactPhone)}>
                Call {delivery.contactPhone}
              </a>
            ) : null}
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
            {delivery.invoice_id ? (
              <Link
                className="app-btn app-btn--secondary app-btn--sm"
                href={`/accounts/invoices/${encodeURIComponent(delivery.invoice_id)}`}
              >
                View invoice
              </Link>
            ) : null}
            {delivery.jobNumber ? (
              <Link
                className="app-btn app-btn--secondary app-btn--sm"
                href={`/job-cards/${encodeURIComponent(delivery.jobNumber)}`}
              >
                Job {delivery.jobNumber}
              </Link>
            ) : null}
          </div>
          <div style={deliveryStyles.badgeStrip}>
            <span
              className={`app-badge ${delivery.isPaid ? "app-badge--success" : "app-badge--danger"}`}
            >
              {delivery.isPaid ? "Paid" : "Payment due on delivery"}
            </span>
            {delivery.payment_method ? (
              <span className="app-badge app-badge--neutral">{delivery.payment_method}</span>
            ) : null}
            {delivery.is_urgent ? (
              <span className="app-badge app-badge--danger-strong">Urgent</span>
            ) : null}
            {delivery.is_collection ? (
              <span className="app-badge app-badge--neutral">Customer collection</span>
            ) : null}
          </div>
        </LayerSurface>

        {/* Items */}
        <LayerSurface padding="var(--space-3)" gap="var(--space-sm)" radius="var(--radius-sm)">
          <span style={deliveryText.label}>Items</span>
          {items.length === 0 ? (
            <span style={deliveryText.muted}>
              {delivery.part_name
                ? `${delivery.part_name}${delivery.part_number ? ` (${delivery.part_number})` : ""} × ${delivery.quantity || 1}`
                : "No item breakdown recorded on this delivery."}
            </span>
          ) : (
            // Deliberately a list, not an .app-data-table. The table family is
            // built for a full-width grid: dropped into this 380px flex column
            // it lays out at its own intrinsic width and its flex parent
            // collapses around it, so the rows escape the card.
            <ul style={deliveryStyles.itemList}>
              {items.map((item, itemIndex) => (
                <li key={item.key || `${describeItem(item)}-${itemIndex}`} style={deliveryStyles.itemRow}>
                  <span style={{ ...deliveryText.value, ...deliveryStyles.truncate }}>
                    {describeItem(item)}
                  </span>
                  <span style={deliveryText.caption}>×{item.quantity ?? item.qty ?? 1}</span>
                  <span style={deliveryText.value}>
                    {formatCurrency(item.total ?? item.unit_price ?? item.price ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {delivery.surchargeValue > 0 ? (
            <span style={deliveryText.muted}>
              Surcharge / core value: {formatCurrency(delivery.surchargeValue)}
            </span>
          ) : null}
          {delivery.core_return_expected ? (
            <div style={deliveryStyles.badgeStrip}>
              <span
                className={`app-badge ${delivery.core_return_collected ? "app-badge--success" : "app-badge--warning"}`}
              >
                {delivery.core_return_collected ? "Core collected" : "Core return outstanding"}
              </span>
            </div>
          ) : null}
        </LayerSurface>

        {/* Assignment */}
        {canAssign ? (
          <LayerSurface padding="var(--space-3)" gap="var(--space-sm)" radius="var(--radius-sm)">
            <span style={deliveryText.label}>Assignment</span>
            <div style={deliveryStyles.fieldPair}>
              <DropdownField
                label="Driver"
                name="driver_id"
                options={driverOptions}
                value={delivery.driver_id ? String(delivery.driver_id) : ""}
                onValueChange={(value, option) =>
                  onPatch(delivery, {
                    driver_id: value || null,
                    driver_name: value ? option?.label || null : null,
                  })
                }
              />
              <DropdownField
                label="Delivery vehicle"
                name="vehicle_reg"
                options={vehicleOptions}
                value={delivery.vehicle_reg || ""}
                onValueChange={(value) => onPatch(delivery, { vehicle_reg: value || null })}
              />
            </div>
            <div style={deliveryStyles.fieldPair}>
              <TimePickerField
                label="Planned time"
                name="planned_time"
                value={(delivery.planned_time || "").slice(0, 5)}
                onValueChange={(value) => onPatch(delivery, { planned_time: value || null })}
              />
              <TimePickerField
                label="Window from"
                name="window_start"
                value={(delivery.window_start || "").slice(0, 5)}
                onValueChange={(value) => onPatch(delivery, { window_start: value || null })}
              />
              <TimePickerField
                label="Window to"
                name="window_end"
                value={(delivery.window_end || "").slice(0, 5)}
                onValueChange={(value) => onPatch(delivery, { window_end: value || null })}
              />
            </div>
            <div style={deliveryStyles.badgeStrip}>
              <label style={deliveryStyles.cellInline}>
                <input
                  type="checkbox"
                  className="app-toggle app-toggle--checkbox"
                  checked={Boolean(delivery.is_urgent)}
                  onChange={(event) => onPatch(delivery, { is_urgent: event.target.checked })}
                />
                <span style={deliveryText.value}>Urgent</span>
              </label>
              <label style={deliveryStyles.cellInline}>
                <input
                  type="checkbox"
                  className="app-toggle app-toggle--checkbox"
                  checked={Boolean(delivery.is_collection)}
                  onChange={(event) => onPatch(delivery, { is_collection: event.target.checked })}
                />
                <span style={deliveryText.value}>Customer collection</span>
              </label>
            </div>
          </LayerSurface>
        ) : (
          <LayerSurface padding="var(--space-3)" gap="var(--space-sm)" radius="var(--radius-sm)">
            <div style={deliveryStyles.detailGrid}>
              <Field label="Driver">{delivery.driver_name || "Unassigned"}</Field>
              <Field label="Vehicle">{delivery.vehicle_reg || "Not set"}</Field>
            </div>
          </LayerSurface>
        )}

        {/* Picking + notes */}
        <LayerSurface padding="var(--space-3)" gap="var(--space-sm)" radius="var(--radius-sm)">
          <span style={deliveryText.label}>Picking and notes</span>
          {canPick ? (
            <div style={deliveryStyles.fieldPair}>
              <label style={deliveryStyles.cell}>
                <span style={deliveryText.label}>Packages</span>
                <input
                  className="app-input"
                  type="number"
                  min="0"
                  value={packagesDraft}
                  onChange={(event) => setPackagesDraft(event.target.value)}
                  onBlur={() => {
                    const next = Number.parseInt(packagesDraft, 10) || 0;
                    if (next !== (delivery.package_count ?? 0)) {
                      onPatch(delivery, { package_count: next });
                    }
                  }}
                />
              </label>
              <label style={deliveryStyles.cell}>
                <span style={deliveryText.label}>Missing items</span>
                <input
                  className="app-input"
                  type="text"
                  value={missingDraft}
                  placeholder="e.g. 1 × brake disc on back order"
                  onChange={(event) => setMissingDraft(event.target.value)}
                  onBlur={() => {
                    if ((missingDraft || "") !== (delivery.missing_items || "")) {
                      onPatch(delivery, { missing_items: missingDraft });
                    }
                  }}
                />
              </label>
            </div>
          ) : (
            <div style={deliveryStyles.detailGrid}>
              <Field label="Packages">{delivery.package_count ?? 0}</Field>
              <Field label="Missing items">{delivery.missing_items || "None"}</Field>
            </div>
          )}
          <label style={deliveryStyles.cell}>
            <span style={deliveryText.label}>Delivery notes</span>
            <textarea
              className="app-input app-input--textarea"
              rows={3}
              value={notesDraft}
              placeholder="Gate code, delivery point, who to ask for…"
              onChange={(event) => setNotesDraft(event.target.value)}
              onBlur={() => {
                if ((notesDraft || "") !== (delivery.notes || "")) {
                  onPatch(delivery, { notes: notesDraft });
                }
              }}
            />
          </label>
        </LayerSurface>

        {/* Proof of delivery */}
        <LayerSurface padding="var(--space-3)" gap="var(--space-sm)" radius="var(--radius-sm)">
          <span style={deliveryText.label}>Proof of delivery</span>
          {delivery.pod_recipient_name ? (
            <div style={deliveryStyles.detailGrid}>
              <Field label="Received by">{delivery.pod_recipient_name}</Field>
              <Field label="Captured">{formatTimestampTime(delivery.pod_captured_at) || "—"}</Field>
            </div>
          ) : (
            <span style={deliveryText.muted}>Not captured yet.</span>
          )}
          {delivery.pod_notes ? <span style={deliveryText.muted}>{delivery.pod_notes}</span> : null}
          <div style={deliveryStyles.badgeStrip}>
            {delivery.pod_photo_url ? (
              <a
                className="app-btn app-btn--secondary app-btn--sm"
                href={delivery.pod_photo_url}
                target="_blank"
                rel="noreferrer"
              >
                Photo
              </a>
            ) : null}
            {delivery.pod_signature_url ? (
              <a
                className="app-btn app-btn--secondary app-btn--sm"
                href={delivery.pod_signature_url}
                target="_blank"
                rel="noreferrer"
              >
                Signature
              </a>
            ) : null}
            {capabilities?.drive ? (
              <Button variant="secondary" size="sm" onClick={() => onOpenProof(delivery)}>
                {delivery.pod_recipient_name ? "Update proof" : "Capture proof"}
              </Button>
            ) : null}
          </div>
          {delivery.failed_reason ? (
            <div className="app-status-message app-status-message--warning">
              Failed: {deliveryFailureReasonLabel(delivery.failed_reason)}
              {delivery.failed_notes ? ` — ${delivery.failed_notes}` : ""}
            </div>
          ) : null}
        </LayerSurface>

        {/* History */}
        <LayerSurface padding="var(--space-3)" gap="var(--space-sm)" radius="var(--radius-sm)">
          <span style={deliveryText.label}>History</span>
          <div style={deliveryStyles.cellInline}>
            {TIMELINE_STEPS.filter(([, column]) => delivery[column]).map(([label, column]) => (
              <span key={column} className="app-badge app-badge--neutral">
                {label} {formatTimestampTime(delivery[column])}
              </span>
            ))}
          </div>
          {events.length === 0 ? (
            <span style={deliveryText.muted}>No changes recorded yet.</span>
          ) : (
            <div style={deliveryStyles.eventList}>
              {events.map((event) => (
                <div key={event.id} style={deliveryStyles.cell}>
                  <span style={deliveryText.value}>{event.summary}</span>
                  <span style={deliveryText.caption}>
                    {formatTimestampTime(event.created_at)} · {event.actor_name || "System"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </LayerSurface>
      </div>

      {actions.length > 0 ? (
        <div style={deliveryStyles.detailActions}>
          {actions.map((action) => (
            <Button
              key={action.key}
              variant={action.variant}
              busy={busy === action.key}
              disabled={Boolean(busy)}
              onClick={() => onAction(delivery, action.key)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </LayerTheme>
  );
}
