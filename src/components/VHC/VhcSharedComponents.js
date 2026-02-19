// Reusable components for VHC Details Panel
import React from "react";

// Empty state message component (used 5+ times)
export const EmptyStateMessage = ({ message }) => (
  <div
    style={{
      padding: "18px",
      border: "1px solid var(--info-surface)",
      borderRadius: "12px",
      background: "var(--info-surface)",
      color: "var(--info)",
      fontSize: "13px",
    }}
  >
    {message}
  </div>
);

// Severity badge component (used 10+ times)
export const SeverityBadge = ({ severity, label, style = {} }) => {
  const getSeverityStyles = (severity) => {
    const baseStyles = {
      padding: "4px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.03em",
    };

    const severityColors = {
      red: {
        background: "var(--danger-surface)",
        color: "var(--danger-dark)",
        border: "1px solid var(--danger)",
      },
      amber: {
        background: "var(--warning-surface)",
        color: "var(--warning-dark)",
        border: "1px solid var(--warning)",
      },
      green: {
        background: "var(--success-surface)",
        color: "var(--success)",
        border: "1px solid var(--success)",
      },
      authorized: {
        background: "var(--success-surface)",
        color: "var(--success)",
        border: "1px solid var(--success)",
      },
      declined: {
        background: "var(--danger-surface)",
        color: "var(--danger-dark)",
        border: "1px solid var(--danger)",
      },
    };

    return { ...baseStyles, ...(severityColors[severity] || severityColors.green) };
  };

  return (
    <span style={{ ...getSeverityStyles(severity), ...style }}>
      {label || severity}
    </span>
  );
};

// VHC Item cell component (used 2+ times)
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
    return <td style={{ padding: "12px 16px" }}></td>;
  }

  return (
    <td style={{ padding: "12px 16px" }}>
      <div>
        <div
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--info)",
          }}
        >
          {vhcItem?.categoryLabel || vhcItem?.category?.label || ""}
        </div>
        <div
          style={{
            fontWeight: 700,
            fontSize: "14px",
            color: "var(--accent-purple)",
            marginTop: "2px",
          }}
        >
          {vhcItem?.label || "VHC Item"}
        </div>
        {(vhcItem?.notes || vhcItem?.concernText) && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--info-dark)",
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
              color: "var(--info)",
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
    { label: "Authorized", value: totals.authorized, color: "var(--success)" },
    { label: "Declined", value: totals.declined, color: "var(--info)" },
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
            border: `1px solid ${item.color}33`,
            borderRadius: "12px",
            background: `${item.color}11`,
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "var(--info)",
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
          background: "var(--info-surface)",
          color: "var(--info)",
          label: "—",
        };
    }
  };

  const status = getStatusStyle();

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "999px",
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

// Part row component for tables
export const PartRowCells = ({ part, showActions = false, onAction }) => {
  const partData = part.part || {};
  const price = part.unit_price ?? partData.unit_price ?? 0;

  return (
    <>
      <td style={{ padding: "12px 16px", color: "var(--accent-purple)", fontWeight: 600 }}>
        {partData.name || "—"}
      </td>
      <td style={{ padding: "12px 16px", color: "var(--info-dark)" }}>
        {partData.part_number || "—"}
      </td>
      <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--info-dark)" }}>
        {part.quantity_requested || 1}
      </td>
      <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--info-dark)", fontWeight: 600 }}>
        £{Number(price).toFixed(2)}
      </td>
    </>
  );
};
