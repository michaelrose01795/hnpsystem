// file location: src/components/VHC/VhcCustomerDescriptionModal.js
// Centred edit popup used in the Summary tab of the VHC details panel for
// overriding the technician's issue description with a customer-friendly
// version. Saving an empty value clears the override and reverts to the tech
// description. Backdrop / aria-modal markup matches the popup-backdrop pattern
// already wired up in src/styles/globals.css.
"use client";

import React, { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
    <div
      className="popup-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay, rgba(15, 23, 42, 0.4))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit customer description"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--page-card-bg, var(--surface))",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-xl, 0 24px 48px rgba(0,0,0,0.18))",
          padding: "var(--section-card-padding, 20px)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--info)",
            }}
          >
            {categoryLabel || "Customer description"}
          </div>
          <h2
            style={{
              margin: "4px 0 0",
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--accentMain, var(--primary))",
            }}
          >
            {itemLabel || "Edit customer description"}
          </h2>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          What you write here is what the customer will see on the Summary tab,
          customer preview, share link and the view / copy / send flows. The
          technician's original health-check description is not changed.
        </p>

        {technicianDescription ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--info-surface, var(--surface-muted))",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--info)",
                marginBottom: 4,
              }}
            >
              Technician's description
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45 }}>
              {technicianDescription}
            </div>
          </div>
        ) : null}

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 12,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Customer description
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
            rows={5}
            placeholder="Leave empty to use the technician's description"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              minHeight: 110,
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
              fontSize: 14,
              lineHeight: 1.5,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </label>

        {error ? (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: "var(--radius-xs)",
              background: "var(--danger-surface, rgba(239,68,68,0.1))",
              border: "1px solid var(--danger, rgba(239,68,68,0.4))",
              color: "var(--danger, #ef4444)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleResetToTech}
            disabled={saving}
            style={{
              padding: "10px 14px",
              minHeight: 40,
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontWeight: 600,
              fontSize: 13,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Use technician's text
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => onClose?.()}
              disabled={saving}
              style={{
                padding: "10px 14px",
                minHeight: 40,
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-primary)",
                fontWeight: 600,
                fontSize: 13,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "10px 16px",
                minHeight: 40,
                borderRadius: "var(--radius-xs)",
                border: "none",
                background: "var(--accentMain, var(--primary))",
                color: "var(--onAccentText, #fff)",
                fontWeight: 700,
                fontSize: 13,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
