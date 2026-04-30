// file location: src/components/accounts/AccountsSettingsModal.js
import React from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import AccountsSettingsPanel from "@/components/accounts/AccountsSettingsPanel";

export default function AccountsSettingsModal({ isOpen, onClose }) {
  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Accounts settings"
      cardStyle={{
        maxWidth: "1200px",
        padding: "0",
        overflow: "hidden",
      }}
    >
      <div style={{ maxHeight: "90vh", overflowY: "auto", background: "var(--theme)" }}>
        <AccountsSettingsPanel embedded onClose={onClose} />
      </div>
    </PopupModal>
  );
}
