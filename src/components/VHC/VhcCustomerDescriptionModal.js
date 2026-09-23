// file location: src/components/VHC/VhcCustomerDescriptionModal.js
// Centred edit popup used in the Summary tab of the VHC details panel for
// overriding the technician's issue description with a customer-friendly
// version. Saving an empty value clears the override and reverts to the tech
// description. Backdrop / aria-modal markup matches the popup-backdrop pattern
// already wired up in src/styles/staffglobal.css.
"use client";

import React, { useEffect, useRef, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";

export default function VhcCustomerDescriptionModal({
  open,
  onClose,
  itemLabel,
  categoryLabel,
  technicianDescription,
  initialCustomerDescription,
  onSave,
}) {
  const [value, setValue] = useState(initialCustomerDescription || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(initialCustomerDescription || "");
      setError("");
      // Focus on next tick so the modal mount transition completes first.
      const timer = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open, initialCustomerDescription]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(value);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Could not save the customer description.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToTech = () => {
    setValue("");
  };

  return (
    <PopupModal
      isOpen
      onClose={saving ? undefined : onClose}
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      ariaLabel="Edit customer description"
      cardStyle={{
        width: "min(100%, 640px)",
        padding: "var(--section-card-padding)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--layout-card-gap)",
      }}
    >
      <header className="app-popup-compact-header">
        <h2>{itemLabel || "Edit customer description"}</h2>
        <div className="app-popup-compact-header__actions">
          <Button type="button" variant="primary" busy={saving} onClick={handleSave}>
            Save
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={handleResetToTech}>
            Use technician's text
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Close
          </Button>
        </div>
      </header>

      <p style={{ margin: 0, color: "var(--text-1)", lineHeight: 1.5 }}>
        {categoryLabel ? `${categoryLabel}. ` : ""}
        This wording is shown in the Summary tab, preview, share link and send flows.
        The technician's original VHC note stays unchanged.
      </p>

      {technicianDescription ? (
        <LayerTheme radius="var(--radius-sm)" padding="12px 14px" gap="4px">
          <strong>Technician&apos;s description</strong>
          <span>{technicianDescription}</span>
        </LayerTheme>
      ) : null}

      <label htmlFor="vhc-customer-description">Customer description</label>
      <textarea
        id="vhc-customer-description"
        ref={textareaRef}
        className="app-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={saving}
        rows={5}
        placeholder="Leave empty to use the technician's description"
        style={{ width: "100%", minHeight: "130px", resize: "vertical" }}
      />

      {error ? <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p> : null}
    </PopupModal>
  );
}
