// file location: src/components/staff-global/StaffModal.js
// Staff modal shell. It uses the existing popup backdrop/card classes so modal
// behavior and scroll locking remain compatible with the app shell.
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import StaffButton from "./StaffButton";

export default function StaffModal({
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
    <div className="staff-modal popup-backdrop" role="presentation" {...rest}>
      <LayerSurface as="section" className={`staff-modal-panel popup-card ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title || "Dialog"}>
        <header className="staff-modal-header">
          {title ? <h2 className="staff-modal-title">{title}</h2> : null}
          {onClose ? (
            <StaffButton type="button" variant="ghost" size="xs" onClick={onClose}>
              Close
            </StaffButton>
          ) : null}
        </header>
        <div className="staff-modal-body">{children}</div>
        {actions ? <footer className="staff-modal-actions">{actions}</footer> : null}
      </LayerSurface>
    </div>
  );
}
