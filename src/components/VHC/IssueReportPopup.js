// Shared chrome for every VHC issue-report popup.
// The form body stays with its owning inspection component, while the modal,
// header, close action, accessibility label, and staffglobal hooks stay uniform.
import React from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";

export default function IssueReportPopup({
  isOpen,
  title,
  onClose,
  width = "720px",
  children,
}) {
  const dialogTitle = `${title || "VHC"} issue report`;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={dialogTitle}
      cardStyle={{
        width: `min(${width}, 100%)`,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, maxHeight: "inherit" }}>
        <LayerTheme
          as="header"
          className="app-popup-compact-header"
          radius="0"
          padding="var(--section-card-padding)"
          gap="var(--layout-card-gap)"
          sectionType="toolbar"
          style={{ flexDirection: "row", minWidth: 0 }}
        >
          <h3 style={{ color: "var(--text-1)", fontSize: "20px", fontWeight: 800 }}>
            {dialogTitle}
          </h3>
          <div className="app-popup-compact-header__actions">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </LayerTheme>
        {children}
      </div>
    </PopupModal>
  );
}
