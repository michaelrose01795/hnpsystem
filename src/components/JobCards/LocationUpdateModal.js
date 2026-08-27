// file location: src/components/JobCards/LocationUpdateModal.js
//
// Quick vehicle / key location update modal, shared by /job-cards/[jobNumber]
// and /tech/[jobNumber]. Moved verbatim out of the job-card page so the
// technician route no longer has to import it.
"use client";

import { useMemo, useState } from "react";
import { DropdownField } from "@/components/ui/dropdownAPI";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import {
  CAR_LOCATIONS,
  KEY_LOCATIONS,
  CAR_LOCATION_OPTIONS,
  KEY_LOCATION_OPTIONS,
  normalizeKeyLocationLabel,
  ensureDropdownOption,
  emptyTrackingForm,
} from "@/lib/jobCards/locations";

export function LocationUpdateModal({ entry, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...emptyTrackingForm,
    ...entry,
    vehicleLocation: entry?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: normalizeKeyLocationLabel(entry?.keyLocation) || KEY_LOCATIONS[0].label,
    status: entry?.status || "Waiting For Collection"
  }));
  const vehicleLocationOptions = useMemo(
    () => ensureDropdownOption(CAR_LOCATION_OPTIONS, form.vehicleLocation),
    [form.vehicleLocation]
  );
  const keyLocationOptions = useMemo(
    () => ensureDropdownOption(KEY_LOCATION_OPTIONS, form.keyLocation),
    [form.keyLocation]
  );

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ ...form, actionType: "location_update", context: "update" });
  };

  return (
    <PopupModal
      isOpen
      onClose={onClose}
      ariaLabel="Edit vehicle and key location"
      cardStyle={{
        width: "min(100%, 460px)",
        maxHeight: "96vh",
        overflowY: "visible",
        padding: "var(--section-card-padding)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>

        <div className="app-popup-compact-header">
          <h2 style={{ margin: 0, color: "var(--text-1)" }}>Edit existing</h2>
          <div className="app-popup-compact-header__actions">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Update
            </Button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-1)", fontWeight: 600 }}>
              Key Location
            </label>
            <DropdownField
              className="location-update-text-field"
              options={keyLocationOptions}
              value={form.keyLocation}
              onValueChange={(value) => handleChange("keyLocation", value)}
              placeholder="Select key location"
              size="md"
              usePortal={false}
              menuStyle={{ maxHeight: "220px", overflowY: "auto" }} />

          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-1)", fontWeight: 600 }}>
              Vehicle Location
            </label>
            <DropdownField
              className="location-update-text-field"
              options={vehicleLocationOptions}
              value={form.vehicleLocation}
              onValueChange={(value) => handleChange("vehicleLocation", value)}
              placeholder="Select location"
              size="md"
              usePortal={false}
              menuStyle={{ maxHeight: "220px", overflowY: "auto" }} />

          </div>
        </div>
        {/* This local selector prevents theme variants from recolouring the
            location values without changing the shared Dropdown API globally. */}
        <style jsx global>{`
          html.staff-scope .location-update-text-field .dropdown-api__control,
          html.staff-scope .location-update-text-field .dropdown-api__value,
          html.staff-scope .location-update-text-field .dropdown-api__chevron {
            color: var(--text-1) !important;
          }
        `}</style>

      </form>
    </PopupModal>);

}

export default LocationUpdateModal;
