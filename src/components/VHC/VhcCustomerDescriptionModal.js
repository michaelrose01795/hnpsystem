// file location: src/components/VHC/VhcCustomerDescriptionModal.js
// Centred edit popup used in the Summary tab of the VHC details panel for
// overriding the technician's issue description with a customer-friendly
// version. Saving an empty value clears the override and reverts to the tech
// description. Backdrop / aria-modal markup matches the popup-backdrop pattern
// already wired up in src/styles/globals.css.
"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

  if (!open || typeof document === "undefined") return null;

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

  const modal = (
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
        zIndex: 10000,
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit customer description"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          background: "var(--page-card-bg, var(--surface))",
          color: "var(--text-1)",
          border: "none",
          borderRadius: "var(--radius-sm)",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.24)",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: "none",
            background: "var(--theme, var(--surface))",
          }}
        >
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
              color: "var(--primary, var(--primary))",
            }}
          >
            {itemLabel || "Edit customer description"}
          </h2>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-1)", lineHeight: 1.5 }}>
            This is the customer-facing wording used in the Summary tab, preview,
            share link and send flows. The technician's original VHC note stays unchanged.
          </p>

          {technicianDescription ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                background: "var(--theme, var(--surface))",
                border: "none",
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
              <div style={{ fontSize: 13, color: "var(--text-1)", lineHeight: 1.45 }}>
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
              color: "var(--text-1)",
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
                padding: "12px 14px",
                minHeight: 130,
                borderRadius: "var(--radius-xs)",
                border: "none",
                background: "var(--theme, var(--surface))",
                color: "var(--text-1)",
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
                border: "none",
                color: "var(--danger, #ef4444)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
            padding: "14px 20px 18px",
            borderTop: "none",
            background: "var(--theme, var(--surface))",
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
              border: "none",
              background: "var(--primary, var(--primary))",
              color: "var(--onAccentText, #fff)",
              fontWeight: 700,
              fontSize: 13,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
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
                border: "none",
                background: "var(--surface)",
                color: "var(--text-1)",
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
                background: "var(--primary, var(--primary))",
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

  return createPortal(modal, document.body);
}
