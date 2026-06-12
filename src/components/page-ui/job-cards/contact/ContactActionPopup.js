// file location: src/components/page-ui/job-cards/contact/ContactActionPopup.js
// Popup shown when a Call / Text / Email / WhatsApp action button is pressed in
// the Customer Contact section. It surfaces the relevant contact detail and an
// "Open" button that launches the device's native app via tel:/sms:/mailto:/wa.me.
import React from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import {
  toTelHref,
  toSmsHref,
  toMailtoHref,
  toWhatsAppUrl,
} from "./contactConstants";

// Build the per-action config: the detail to show, the launch URL, and whether to
// open in a new tab (WhatsApp web) vs navigate the current document (tel/sms/mailto).
function resolveAction(action, contact) {
  switch (action) {
    case "call":
      return {
        title: "Call customer",
        detailLabel: "Phone",
        detail: contact.mobile || contact.telephone,
        href: toTelHref(contact.mobile || contact.telephone),
        openLabel: "Open dialler",
        newTab: false,
      };
    case "text":
      return {
        title: "Text customer",
        detailLabel: "Mobile",
        detail: contact.mobile || contact.telephone,
        href: toSmsHref(contact.mobile || contact.telephone),
        openLabel: "Open messages",
        newTab: false,
      };
    case "email":
      return {
        title: "Email customer",
        detailLabel: "Email",
        detail: contact.email,
        href: toMailtoHref(contact.email),
        openLabel: "Open email app",
        newTab: false,
      };
    case "whatsapp":
      return {
        title: "WhatsApp customer",
        detailLabel: "Mobile",
        detail: contact.mobile || contact.telephone,
        href: toWhatsAppUrl(contact.mobile || contact.telephone),
        openLabel: "Open WhatsApp",
        newTab: true,
      };
    default:
      return null;
  }
}

export default function ContactActionPopup({ action, contact = {}, onClose }) {
  const config = action ? resolveAction(action, contact) : null;
  if (!config) return null;

  const hasDetail = Boolean(config.detail);

  const handleOpen = () => {
    if (!hasDetail) return;
    if (config.newTab) {
      window.open(config.href, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = config.href;
    }
    onClose?.();
  };

  return (
    <PopupModal
      isOpen={Boolean(action)}
      onClose={onClose}
      ariaLabel={config.title}
      cardStyle={{
        width: "min(420px, 100%)",
        padding: "var(--space-7)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.72rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--accentText)",
            fontWeight: 700,
          }}
        >
          {config.title}
        </p>
        <p style={{ margin: 0, color: "var(--text-1)", fontSize: "1.05rem", fontWeight: 600 }}>
          {contact.name || "Customer"}
        </p>
      </div>

      <div
        className="app-layout-surface-subtle"
        style={{ gap: "4px" }}
      >
        <span
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-1)",
            opacity: 0.7,
            fontWeight: 700,
          }}
        >
          {config.detailLabel}
        </span>
        <span style={{ fontSize: "1.05rem", color: "var(--text-1)", fontWeight: 600, wordBreak: "break-word" }}>
          {config.detail || "Not on file"}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleOpen} disabled={!hasDetail}>
          {config.openLabel}
        </Button>
      </div>
    </PopupModal>
  );
}
