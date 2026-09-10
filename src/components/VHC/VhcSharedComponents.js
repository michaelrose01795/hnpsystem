// Reusable components for VHC Details Panel
import React from "react";
import StatusMessage from "@/components/ui/StatusMessage";

// Empty state message component (used 5+ times).
// Renders the global .app-status-message--info banner (staffglobal.css) through
// the shared StatusMessage primitive, so padding / radius / tint come from the
// design system instead of the per-module 18px + --theme block this inlined.
export const EmptyStateMessage = ({ message }) => (
  <StatusMessage tone="info">{message}</StatusMessage>
);

// Severity badge component (used 10+ times). Renders a global .app-badge with
// the matching tone modifier so shape/colour come from staffglobal.css.
const SEVERITY_TONE_CLASS = {
  red: "app-badge--danger",
  amber: "app-badge--warning",
  green: "app-badge--success",
  authorized: "app-badge--success",
  declined: "app-badge--danger",
};

export const SeverityBadge = ({ severity, label, style = {}, className = "" }) => {
  const tone = SEVERITY_TONE_CLASS[severity] || SEVERITY_TONE_CLASS.green;
  const classes = ["app-badge", "app-badge--uppercase", tone, className]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} style={style}>
      {label || severity}
    </span>
  );
};

// VHC Item cell component (used 2+ times).
// Cell padding is NOT set here: the global `.app-data-table th/td` rule in
// staffglobal.css already supplies `var(--space-3) var(--space-md)` (12px 16px)
// plus the `--separating-line` row rule, so these cells must sit inside a table
// carrying the `.app-data-table` class and inherit it.
export const VhcItemCell = ({ vhcItem, locationLabel, showOnlyPartIndex = false, partIndex = 0 }) => {
  const LOCATION_LABELS = {
    front_left: "Front Left",
    front_right: "Front Right",
    rear_left: "Rear Left",
    rear_right: "Rear Right",
    front: "Front",
    rear: "Rear",
    left: "Left",
    right: "Right",
    center: "Center",
  };

  if (showOnlyPartIndex && partIndex !== 0) {
    return <td></td>;
  }

  return (
    <td>
      <div>
        <div
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-1)",
          }}
        >
          {vhcItem?.categoryLabel || vhcItem?.category?.label || ""}
        </div>
        <div
          style={{
            fontWeight: 700,
            fontSize: "14px",
            color: "var(--text-accent)",
            marginTop: "2px",
          }}
        >
          {vhcItem?.label || "VHC Item"}
        </div>
        {(vhcItem?.notes || vhcItem?.concernText) && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-1)",
              marginTop: "4px",
            }}
          >
            {vhcItem.notes || vhcItem.concernText}
          </div>
        )}
        {locationLabel && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-1)",
              marginTop: "4px",
            }}
          >
            Location: {LOCATION_LABELS[locationLabel] || locationLabel.replace(/_/g, " ")}
          </div>
        )}
      </div>
    </td>
  );
};

// Extract VHC item data helper
export const extractVhcItemData = (vhcItem, location = null) => {
  const LOCATION_LABELS = {
    front_left: "Front Left",
    front_right: "Front Right",
    rear_left: "Rear Left",
    rear_right: "Rear Right",
    front: "Front",
    rear: "Rear",
    left: "Left",
    right: "Right",
    center: "Center",
  };

  return {
    vhcLabel: vhcItem?.label || "VHC Item",
    vhcNotes: vhcItem?.notes || vhcItem?.concernText || "",
    vhcCategory: vhcItem?.categoryLabel || vhcItem?.category?.label || "",
    vhcSeverity: vhcItem?.rawSeverity || vhcItem?.displaySeverity,
    locationLabel: location
      ? LOCATION_LABELS[location] || location.replace(/_/g, " ")
      : null,
  };
};

// Financial totals grid component
export const FinancialTotalsGrid = ({ totals }) => {
  const formatCurrency = (value) => {
    const num = Number(value || 0);
    return `£${num.toFixed(2)}`;
  };

  const gridItems = [
    { label: "Red Work", value: totals.red, color: "var(--danger)" },
    { label: "Amber Work", value: totals.amber, color: "var(--warning)" },
    { label: "Authorised", value: totals.authorized, color: "var(--success)" },
    { label: "Declined", value: totals.declined, color: "var(--text-1)" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
        marginBottom: "16px",
      }}
    >
      {gridItems.map((item) => (
        <div
          key={item.label}
          style={{
            padding: "12px",
            borderRadius: "var(--radius-sm)",
            background: `${item.color}11`,
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-1)",
              marginBottom: "4px",
            }}
          >
            {item.label}
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: item.color }}>
            {formatCurrency(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
};

// Stock status badge component
export const StockStatusBadge = ({ stockStatus }) => {
  const getStatusStyle = () => {
    switch (stockStatus) {
      case "in_stock":
        return {
          background: "var(--success-surface)",
          color: "var(--success)",
          label: "In Stock",
        };
      case "no_stock":
        return {
          background: "var(--danger-surface)",
          color: "var(--danger)",
          label: "No Stock",
        };
      case "back_order":
        return {
          background: "var(--warning-surface)",
          color: "var(--warning)",
          label: "Back Order",
        };
      default:
        return {
          background: "var(--theme)",
          color: "var(--text-1)",
          label: "—",
        };
    }
  };

  const status = getStatusStyle();

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        fontSize: "11px",
        fontWeight: 600,
        background: status.background,
        color: status.color,
      }}
    >
      {status.label}
    </span>
  );
};

// Part row component for tables. Same rule as VhcItemCell: padding comes from
// the global `.app-data-table th/td` rule, not from inline styles here.
export const PartRowCells = ({ part, showActions = false, onAction }) => {
  const partData = part.part || {};
  const price = part.unit_price ?? partData.unit_price ?? 0;

  return (
    <>
      <td style={{ color: "var(--text-accent)", fontWeight: 600 }}>
        {partData.name || "—"}
      </td>
      <td style={{ color: "var(--text-1)" }}>
        {partData.part_number || "—"}
      </td>
      <td style={{ textAlign: "center", color: "var(--text-1)" }}>
        {part.quantity_requested || 1}
      </td>
      <td style={{ textAlign: "right", color: "var(--text-1)", fontWeight: 600 }}>
        £{Number(price).toFixed(2)}
      </td>
    </>
  );
};
