// file location: src/components/customer-global/CustomerModal.js
// Customer modal shell for customer-facing dialogs.
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import CustomerButton from "./CustomerButton";

export default function CustomerModal({
  open,
  title,
  children,
  actions,
  onClose,
  className = "",
  ...rest
}) {
  if (!open) return null;

  return (
    <div className="customer-modal" role="presentation" {...rest}>
      <LayerSurface as="section" className={`customer-modal-panel ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title || "Dialog"}>
        <header className="customer-modal-header">
          {title ? <h2 className="customer-modal-title">{title}</h2> : null}
          {onClose ? (
            <CustomerButton type="button" variant="secondary" onClick={onClose}>
              Close
            </CustomerButton>
          ) : null}
        </header>
        <div className="customer-modal-body">{children}</div>
        {actions ? <footer className="customer-modal-actions">{actions}</footer> : null}
      </LayerSurface>
    </div>
  );
}
