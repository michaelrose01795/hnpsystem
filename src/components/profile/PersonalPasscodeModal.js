// file location: src/components/profile/PersonalPasscodeModal.js
// Shared PIN modal used by both ProfilePersonalTab and the new Payslips card.
// Mirrors the original modal that lived inline in ProfilePersonalTab so the
// look/feel is identical wherever the personal lock is invoked.

import React, { useEffect, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";

const passcodeCardStyle = {
  width: "min(100%, 420px)",
  padding: "24px",
  display: "grid",
  gap: "16px",
};

const passcodeInputStyle = {
  fontSize: "1.1rem",
  letterSpacing: "0.3em",
  textAlign: "center",
};

export default function PersonalPasscodeModal({
  isOpen,
  mode = "unlock",
  isSubmitting = false,
  error = "",
  unlockTitle = "Unlock personal dashboard",
  unlockHint = "Enter your 4-digit passcode to open the personal dashboard.",
  setupTitle = "Create your personal passcode",
  setupHint = "Set a 4-digit passcode to protect your personal dashboard.",
  onSubmit,
  onClose,
}) {
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setPasscode("");
    setConfirmPasscode("");
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit?.({ passcode, confirmPasscode });
  };

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={mode === "setup" ? setupTitle : unlockTitle}
      cardStyle={passcodeCardStyle}
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
        <div style={{ display: "grid", gap: "8px" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
            {mode === "setup" ? setupTitle : unlockTitle}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5 }}>
            {mode === "setup" ? setupHint : unlockHint}
          </div>
        </div>

        <input
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoFocus
          className="app-input"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value.replace(/\D/g, "").slice(0, 4))}
          style={passcodeInputStyle}
          placeholder="0000"
        />

        {mode === "setup" ? (
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            className="app-input"
            value={confirmPasscode}
            onChange={(event) => setConfirmPasscode(event.target.value.replace(/\D/g, "").slice(0, 4))}
            style={passcodeInputStyle}
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
          <Button type="button" variant="secondary" size="sm" pill onClick={onClose}>
            Close
          </Button>
          <Button type="submit" variant="primary" size="sm" pill disabled={isSubmitting}>
            {isSubmitting
              ? mode === "setup"
                ? "Saving..."
                : "Unlocking..."
              : mode === "setup"
                ? "Save passcode"
                : "Unlock"}
          </Button>
        </div>
      </form>
    </PopupModal>
  );
}
