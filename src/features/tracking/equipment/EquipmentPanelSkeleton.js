// file location: src/features/tracking/equipment/EquipmentPanelSkeleton.js
//
// The Equipment/Tools register's loading placeholder. It lives in its own small
// module so /tracking/Equipment-Tools can show it from the first paint — while
// the session resolves and the panel chunk downloads — and the panel shows the
// same placeholder while its list loads, so nothing swaps in between.

import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import { SkeletonBlock, SkeletonKeyframes, TableSkeleton } from "@/components/ui/LoadingSkeleton";

export default function EquipmentPanelSkeleton({ view = "cards" }) {
  if (view === "compact") {
    return (
      <div className="app-table-scroll">
        <TableSkeleton
          className="app-data-table--compact"
          columns={["Equipment", "Location", "Status", "Next due", "Last checked", "By", ""]}
          rows={6}
          label="Loading equipment"
        />
      </div>
    );
  }

  return (
    <div className="equipment-grid" role="status" aria-live="polite" aria-busy="true" aria-label="Loading equipment">
      <SkeletonKeyframes />
      {Array.from({ length: 6 }, (_, index) => (
        <LayerTheme key={index} className="equipment-card" radius="var(--radius-sm)" padding="20px 24px" gap="10px">
          <div className="equipment-card__head">
            <div style={{ display: "grid", gap: "6px", minWidth: 0, flex: 1 }}>
              <SkeletonBlock width={index % 2 ? "58%" : "72%"} height="16px" />
              <SkeletonBlock width="46%" height="12px" />
            </div>
            <SkeletonBlock width="72px" height="14px" />
          </div>
          <div className="equipment-card__rows">
            {["64%", "48%", "52%", "40%", "56%"].map((width, row) => (
              <div key={row} className="equipment-card__row">
                <SkeletonBlock width="88px" height="12px" />
                <SkeletonBlock width={width} height="12px" />
              </div>
            ))}
          </div>
          <div className="equipment-card__actions">
            <SkeletonBlock height="36px" />
            <SkeletonBlock height="36px" />
          </div>
        </LayerTheme>
      ))}
    </div>
  );
}
