import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useBodyModalLock from "@/hooks/useBodyModalLock";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.64)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 2000,
};

const cardStyle = {
  width: "100%",
  maxWidth: "420px",
  background: "var(--surface)",
  borderRadius: "24px",
  border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
  boxShadow: "var(--shadow-lg)",
  padding: "24px",
  display: "grid",
  gap: "16px",
};

const inputStyle = {
  width: "100%",
  borderRadius: "14px",
  border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
  background: "rgba(var(--accent-purple-rgb), 0.04)",
  color: "var(--text-primary)",
  padding: "12px 14px",
  fontSize: "1.1rem",
  letterSpacing: "0.3em",
  textAlign: "center",
};

export default function PasscodeModal({
  isOpen,
  mode = "unlock",
  isSubmitting = false,
  error = "",
  onSubmit,
  onClose,
}) {
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  useBodyModalLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setPasscode("");
    setConfirmPasscode("");
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit?.({
      passcode,
      confirmPasscode,
    });
  };

  const modal = (
    <div style={overlayStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <div style={{ display: "grid", gap: "8px" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
            {mode === "setup" ? "Create your personal passcode" : "Unlock personal dashboard"}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5 }}>
            {mode === "setup"
              ? "Set a 4-digit passcode to protect your personal dashboard."
              : "Enter your 4-digit passcode to open the personal dashboard."}
          </div>
        </div>

        <input
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoFocus
          value={passcode}
          onChange={(event) => setPasscode(event.target.value.replace(/\D/g, "").slice(0, 4))}
          style={inputStyle}
          placeholder="0000"
        />

        {mode === "setup" ? (
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={confirmPasscode}
            onChange={(event) => setConfirmPasscode(event.target.value.replace(/\D/g, "").slice(0, 4))}
            style={inputStyle}
            placeholder="Confirm"
          />
        ) : null}

        {error ? (
          <div
            style={{
              borderRadius: "14px",
              padding: "10px 12px",
              background: "rgba(198, 40, 40, 0.08)",
              color: "var(--danger, #c62828)",
              fontSize: "0.84rem",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: "999px",
              border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
              background: "transparent",
              color: "var(--text-primary)",
              padding: "10px 14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              borderRadius: "999px",
              border: "none",
              background: "var(--accent-purple)",
              color: "#ffffff",
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isSubmitting ? "Saving..." : mode === "setup" ? "Save passcode" : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
