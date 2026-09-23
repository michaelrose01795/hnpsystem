// file location: src/features/tracking/equipment/EquipmentViews.js
//
// The list side of the Equipment/Tools tab: summary filter tiles, the card
// (the tab's existing card, now with asset ID, location and fault indication)
// and the Compact list for managers working through larger inventories.

import React from "react";
import { Button } from "@/components/ui";
import LayerTheme from "@/components/ui/LayerTheme";
import { StatusBadge } from "@/features/customers/hub/RecordPrimitives";
import {
  describeInterval,
  formatEquipmentDate,
  getCategoryLabel,
  getLastCheckedByLabel,
  getLocationLabel,
  getWorstOpenFault,
} from "@/features/tracking/equipment/equipmentModel";

// Defined here rather than in EquipmentFormControls so the register's
// first-load chunk does not pull in the drawers' form/popup module for one span.
export function StatusText({ status }) {
  if (!status) return null;
  return <span className={`equipment-status equipment-status--${status.tone}`}>{status.detail || status.label}</span>;
}

/* ------------------------------------------------------------------------ */
/* Summary tiles                                                             */
/* ------------------------------------------------------------------------ */
export const EQUIPMENT_SUMMARY_TILES = [
  { key: "due-soon", label: "Due Soon", count: "dueSoon" },
  { key: "overdue", label: "Overdue", count: "overdue" },
  { key: "checked-today", label: "Checked Today", count: "checkedToday" },
  { key: "active", label: "Total Equipment/Tools", count: "total" },
  { key: "fault-reported", label: "Fault Reported", count: "faultReported" },
  { key: "out-of-service", label: "Out of Service", count: "outOfService" },
];

export function EquipmentSummaryBar({ summary, activeFilter, onSelect }) {
  return (
    <div className="app-summary-section">
      <div className="app-summary-grid" role="group" aria-label="Filter equipment by summary">
        {EQUIPMENT_SUMMARY_TILES.map((tile) => {
          const isActive = activeFilter === tile.key;
          const toggle = () => onSelect(isActive || tile.key === "active" ? "active" : tile.key);
          return (
            <div
              key={tile.key}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              title={isActive ? "Clear this filter" : `Show ${tile.label.toLowerCase()}`}
              className={`app-summary-item app-summary-item--theme equipment-summary-tile${isActive ? " is-active" : ""}`}
              onClick={toggle}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggle();
                }
              }}
            >
              <span className="app-summary-label">{tile.label}</span>
              <strong className="app-summary-value">{summary[tile.count] ?? 0}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Card                                                                      */
/* ------------------------------------------------------------------------ */
export function EquipmentCard({
  entry,
  capabilities,
  selectable = false,
  selected = false,
  onToggleSelect,
  onOpen,
  onHistory,
  onCheck,
  onFault,
}) {
  const { asset, status } = entry;
  const fault = getWorstOpenFault(asset);
  const retired = asset.operationalStatus === "retired";
  const rows = [
    ["Location", getLocationLabel(asset) || "Not set"],
    ["Last checked", formatEquipmentDate(asset.lastChecked, "Pending")],
    ["Next due", formatEquipmentDate(asset.nextDue, "Pending")],
    ["Check interval", describeInterval(asset)],
    ["Last Checked By", getLastCheckedByLabel(asset)],
  ];
  const openFromKeyboard = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(asset);
    }
  };
  const stop = (handler) => (event) => {
    event.stopPropagation();
    handler(asset);
  };

  return (
    <LayerTheme
      as="article"
      role="button"
      tabIndex={0}
      aria-label={`${asset.name}, ${asset.assetCode}, ${status.detail}`}
      className="equipment-card"
      radius="var(--radius-sm)"
      padding="20px 24px"
      gap="10px"
      onClick={() => onOpen(asset)}
      onKeyDown={openFromKeyboard}
    >
      <div className="equipment-card__head">
        <div className="equipment-card__title">
          {selectable && (
            <input
              type="checkbox"
              className="app-toggle app-toggle--checkbox"
              checked={selected}
              aria-label={`Select ${asset.name}`}
              onClick={(event) => event.stopPropagation()}
              onChange={() => onToggleSelect(asset.id)}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <strong className="equipment-card__name">{asset.name}</strong>
            <span className="equipment-card__meta">
              {asset.assetCode} · {getCategoryLabel(asset)}
            </span>
          </div>
        </div>
        <StatusText status={status} />
      </div>

      <div className="equipment-card__rows">
        {rows.map(([label, value]) => (
          <div key={label} className="equipment-card__row">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {fault && (
        <p className="equipment-card__alert" title={fault.description}>
          Fault ({fault.severity}): {fault.description}
        </p>
      )}

      <div className="equipment-card__actions">
        <Button type="button" variant="secondary" size="sm" onClick={stop(onHistory)} style={{ width: "100%" }}>
          View History
        </Button>
        {!retired && capabilities.reportFault && (
          <Button type="button" variant="secondary" size="sm" onClick={stop(onFault)} style={{ width: "100%" }}>
            Report fault
          </Button>
        )}
        {!retired && capabilities.check && (
          <Button type="button" variant="primary" size="sm" onClick={stop(onCheck)} style={{ width: "100%" }}>
            Log check
          </Button>
        )}
      </div>
    </LayerTheme>
  );
}

/* ------------------------------------------------------------------------ */
/* Compact list                                                              */
/* ------------------------------------------------------------------------ */
export function EquipmentCompactTable({
  entries,
  capabilities,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onOpen,
  onCheck,
}) {
  const allSelected = entries.length > 0 && entries.every(({ asset }) => selectedIds.has(asset.id));
  return (
    <div className="app-table-scroll">
      <table className="app-data-table app-data-table--compact app-data-table--clickable">
        <thead>
          <tr>
            {selectable && (
              <th className="equipment-table__select" scope="col">
                <input
                  type="checkbox"
                  className="app-toggle app-toggle--checkbox"
                  checked={allSelected}
                  aria-label="Select all shown equipment"
                  onChange={() => onToggleAll(entries.map(({ asset }) => asset.id), !allSelected)}
                />
              </th>
            )}
            <th scope="col">Equipment</th>
            <th scope="col">Location</th>
            <th scope="col">Status</th>
            <th scope="col">Next due</th>
            <th scope="col">Last checked</th>
            <th scope="col">By</th>
            <th scope="col" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {entries.map(({ asset, status }) => (
            <tr
              key={asset.id}
              tabIndex={0}
              onClick={() => onOpen(asset)}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && event.key === "Enter") onOpen(asset);
              }}
            >
              {selectable && (
                <td className="equipment-table__select">
                  <input
                    type="checkbox"
                    className="app-toggle app-toggle--checkbox"
                    checked={selectedIds.has(asset.id)}
                    aria-label={`Select ${asset.name}`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => onToggleSelect(asset.id)}
                  />
                </td>
              )}
              <td>
                <div className="equipment-table__name">
                  <span className="equipment-table__primary">{asset.name}</span>
                  <span className="equipment-table__secondary">
                    {asset.assetCode} · {getCategoryLabel(asset)}
                  </span>
                </div>
              </td>
              <td>{getLocationLabel(asset) || "—"}</td>
              <td>
                <StatusBadge tone={status.tone}>{status.detail}</StatusBadge>
              </td>
              <td className="equipment-table__nowrap">{formatEquipmentDate(asset.nextDue)}</td>
              <td className="equipment-table__nowrap">{formatEquipmentDate(asset.lastChecked)}</td>
              <td>{getLastCheckedByLabel(asset)}</td>
              <td>
                {capabilities.check && asset.operationalStatus !== "retired" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCheck(asset);
                    }}
                  >
                    Log check
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
