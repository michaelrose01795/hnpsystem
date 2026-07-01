// file location: src/components/dev-platform/DeveloperPicker.js
//
// Phase 9 — searchable developer picker for assignment. Built on the canonical
// DropdownField (CLAUDE.md §3.4a — every select control in the app is
// DropdownField; never a raw <select>), fed the directory the intelligence API
// derives from report identities (developerDirectory.js). Emits the chosen
// developer id (or null to unassign) via onSelect.

import React, { useMemo } from "react";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";

const UNASSIGNED = "__unassigned__";

export default function DeveloperPicker({ directory = [], value = null, onSelect, label = "Assign to", disabled = false }) {
  const options = useMemo(() => {
    const opts = [
      { value: UNASSIGNED, label: "Unassigned", description: "Clear the assignee" },
    ];
    for (const dev of directory) {
      if (dev.id == null) continue; // can only assign to a real numeric user id
      opts.push({
        value: String(dev.id),
        label: dev.isCurrent ? `${dev.username} (me)` : dev.username,
        description: `${dev.assignedCount} assigned · ${dev.reportedCount} reported`,
      });
    }
    return opts;
  }, [directory]);

  return (
    <DropdownField
      label={label}
      options={options}
      value={value == null ? UNASSIGNED : String(value)}
      disabled={disabled}
      onValueChange={(val) => {
        if (val === UNASSIGNED || val === "") onSelect?.(null);
        else onSelect?.(Number.parseInt(val, 10));
      }}
    />
  );
}
