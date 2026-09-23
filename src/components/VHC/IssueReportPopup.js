// Shared structure for every staff-facing VHC issue-report popup.
// Owning inspection components keep their existing state and handlers; this
// component only standardises the presentation and responsive layout.
import React from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";

const SEVERITY_OPTIONS = ["Green", "Amber", "Red"];

export const formatIssueReportedTime = (issue = {}) => {
  const rawValue = issue.reportedAt || issue.reported_at || issue.createdAt || issue.created_at;
  if (!rawValue) return "";

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return "";

  return `Reported ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export function IssueSeverityButtons({ value, onChange, disabled = false }) {
  return (
    <div className="vhc-issue-report__severity-options" role="group" aria-label="Issue severity">
      {SEVERITY_OPTIONS.map((severity) => {
        const severityKey = severity.toLowerCase();
        const selected = value?.toLowerCase() === severityKey;
        return (
          <Button
            key={severity}
            type="button"
            variant="secondary"
            size="sm"
            className={`vhc-issue-report__severity vhc-issue-report__severity--${severityKey}${selected ? " is-selected" : ""}`}
            aria-pressed={selected}
            onClick={() => onChange?.(severity)}
            disabled={disabled}
          >
            {severity}
          </Button>
        );
      })}
    </div>
  );
}

export function IssueReportAddSection({
  descriptionControl,
  severity,
  onSeverityChange,
  onAdd,
  addDisabled = false,
  disabled = false,
  heading = "Add Issue",
  addLabel = "Add Issue",
}) {
  return (
    <LayerTheme as="section" className="vhc-issue-report__add" aria-labelledby="vhc-issue-report-add-heading">
      <h4 id="vhc-issue-report-add-heading" className="vhc-issue-report__section-title">
        {heading}
      </h4>
      <label className="vhc-issue-report__field">
        <span className="vhc-issue-report__label">Issue description</span>
        {descriptionControl}
      </label>
      <div className="vhc-issue-report__add-actions">
        <div className="vhc-issue-report__severity-field">
          <span className="vhc-issue-report__label">Severity</span>
          <IssueSeverityButtons value={severity} onChange={onSeverityChange} disabled={disabled} />
        </div>
        <Button variant="primary" size="sm" onClick={onAdd} disabled={addDisabled || disabled}>
          {addLabel}
        </Button>
      </div>
    </LayerTheme>
  );
}

export function IssueReportList({ count = 0, emptyMessage, children, scroll = false }) {
  return (
    <section className="vhc-issue-report__reported" aria-labelledby="vhc-issue-report-list-heading">
      <div className="vhc-issue-report__divider" aria-hidden="true" />
      <div className="vhc-issue-report__reported-heading">
        <h4 id="vhc-issue-report-list-heading" className="vhc-issue-report__section-title">
          Reported Issues
        </h4>
        <span className="app-badge app-badge--accent-soft">{count}</span>
      </div>
      {count === 0 ? (
        <LayerTheme className="vhc-issue-report__empty" padding="var(--space-md)" gap="var(--space-xs)">
          {emptyMessage || "No issues reported for this location."}
        </LayerTheme>
      ) : (
        <div className={`vhc-issue-report__rows${scroll ? " vhc-issue-report__rows--scroll" : ""}`}>
          {children}
        </div>
      )}
    </section>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="m6 7 1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

export function IssueReportRow({
  issue,
  description,
  severity,
  onSeverityChange,
  onDelete,
  disabled = false,
  overlay = null,
  // Per-row camera launcher. Rendered first in the action group so media
  // capture sits next to the issue it attaches to.
  mediaAction = null,
}) {
  const reportedTime = formatIssueReportedTime(issue);

  return (
    <LayerTheme
      className="vhc-issue-report__row"
      padding="var(--space-md)"
      gap="var(--space-3)"
      style={{ display: "grid" }}
    >
      {overlay}
      <div className="vhc-issue-report__row-copy">
        <div className="vhc-issue-report__description">{description}</div>
        {reportedTime ? <span className="vhc-issue-report__time">{reportedTime}</span> : null}
      </div>
      <div className="vhc-issue-report__row-actions">
        {mediaAction}
        <DropdownField
          value={severity}
          onChange={(event) => onSeverityChange?.(event.target.value)}
          className="vhc-concern-dropdown vhc-issue-report__severity-dropdown"
          disabled={disabled}
          aria-label="Change issue severity"
        >
          {SEVERITY_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </DropdownField>
        <Button
          variant="danger"
          size="sm"
          className="app-btn--icon vhc-issue-report__delete"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Delete issue"
          title="Delete issue"
        >
          <DeleteIcon />
        </Button>
      </div>
    </LayerTheme>
  );
}

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
      cardClassName="vhc-issue-report-popup"
      cardStyle={{
        width: `min(${width}, 100%)`,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div className="vhc-issue-report">
        <LayerTheme
          as="header"
          className="app-popup-compact-header vhc-issue-report__header"
          radius="0"
          padding="var(--layout-card-gap) var(--section-card-padding)"
          gap="var(--layout-card-gap)"
          sectionType="toolbar"
          style={{ flexDirection: "row", minWidth: 0 }}
        >
          <h3>{dialogTitle}</h3>
          <div className="app-popup-compact-header__actions">
            <Button
              variant="secondary"
              size="sm"
              className="app-btn--icon"
              onClick={onClose}
              aria-label="Close issue report"
              title="Close"
            >
              <span aria-hidden="true">×</span>
            </Button>
          </div>
        </LayerTheme>
        <div className="vhc-issue-report__body">{children}</div>
      </div>
    </PopupModal>
  );
}
