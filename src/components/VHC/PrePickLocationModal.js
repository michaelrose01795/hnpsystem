// file location: src/components/VHC/PrePickLocationModal.js
import React, { useState } from "react";
import VHCModalShell from "./VHCModalShell";
import Button from "@/components/ui/Button";
import { DropdownField } from "@/components/ui/dropdownAPI";

const PRE_PICK_LOCATIONS = [
  { value: "service_rack_1", label: "Service Rack 1" },
  { value: "service_rack_2", label: "Service Rack 2" },
  { value: "service_rack_3", label: "Service Rack 3" },
  { value: "service_rack_4", label: "Service Rack 4" },
  { value: "tyre_shed", label: "Tyre Shed" },
  { value: "no_pick", label: "No Pick" },
  { value: "on_order", label: "On Order" },
];

export default function PrePickLocationModal({
  isOpen,
  onClose,
  onConfirm,
  partName = "Part",
  initialLocation = "",
  allowSkip = true,
}) {
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!selectedLocation && !allowSkip) {
      setError("Please select a pre-pick location");
      return;
    }
    onConfirm(selectedLocation);
    setError("");
  };

  const handleSkip = () => {
    onConfirm("");
    setError("");
  };

  const handleClose = () => {
    setError("");
    onClose();
  };

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Set Pre-Pick Location"
      subtitle={`Select a pre-pick location for: ${partName}`}
      width="600px"
      height="auto"
      onClose={handleClose}
      footer={
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          {allowSkip && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "10px 20px",
              }}
            >
              Skip for Now
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "10px 20px",
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "10px 20px",
            }}
          >
            Confirm
          </Button>
        </div>
      }
    >
      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary)",
            }}
          >
            Pre-Pick Location
          </label>
          <DropdownField
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value);
              setError("");
            }}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "var(--radius-xs)",
              border: "none",
              background: "var(--surface)",
              color: "var(--primary)",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            <option value="">Select a location...</option>
            {PRE_PICK_LOCATIONS.map((location) => (
              <option key={location.value} value={location.value}>
                {location.label}
              </option>
            ))}
          </DropdownField>
          {error && (
            <div
              style={{
                marginTop: "8px",
                fontSize: "12px",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}
        </div>
        <div
          style={{
            padding: "12px",
            borderRadius: "var(--radius-xs)",
            background: "var(--theme)",
            fontSize: "13px",
            color: "var(--info-dark)",
          }}
        >
          <strong>Note:</strong> You can {allowSkip ? "skip this step and " : ""}
          set or update the pre-pick location later from the Parts tab.
        </div>
      </div>
    </VHCModalShell>
  );
}
