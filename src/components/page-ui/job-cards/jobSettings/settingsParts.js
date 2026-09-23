// file location: src/components/page-ui/job-cards/jobSettings/settingsParts.js
//
// Building blocks shared by the Job Card Settings sections. Nothing here paints
// anything of its own: cards are LayerTheme on the popup's --surface
// (CLAUDE.md §3.0a-2), labels and values are the record family, hints and
// errors are the forms family, notices are StatusMessage. Inline styles are
// layout only.

import React, { useCallback, useEffect, useRef, useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import StatusMessage from "@/components/ui/StatusMessage";
import FieldError from "@/components/ui/FieldError";
import { SETTINGS_REASON_MIN_LENGTH } from "@/features/jobCards/workflow/jobSettings";

/** One titled card inside a settings section. */
export function SettingsCard({ sectionKey, title, actions, children }) {
  return (
    <LayerTheme
      as="section"
      sectionKey={sectionKey}
      sectionType="content-card"
      parentKey="shared-popup-card"
      gap="var(--layout-card-gap)"
    >
      <div className="app-popup-compact-header">
        <h3 className="app-record-heading">{title}</h3>
        {actions ? <div className="app-popup-compact-header__actions">{actions}</div> : null}
      </div>
      {children}
    </LayerTheme>
  );
}

/** Responsive grid for form fields (two-up on wide panels, stacked on phones). */
export function SettingsFieldGrid({ children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
        gap: "var(--layout-card-gap)",
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/** A labelled control, with an optional hint and inline error. */
export function SettingsField({ id, label, hint, error, children }) {
  return (
    <div className="app-record-field" style={{ minWidth: 0 }}>
      <label className="app-record-field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error ? <p className="app-field-hint">{hint}</p> : null}
      <FieldError id={id ? `${id}-error` : undefined}>{error}</FieldError>
    </div>
  );
}

/** Mandatory free-text reason for workflow-breaking actions. */
export function ReasonField({ id, label = "Reason", value, onChange, disabled, placeholder, error }) {
  const length = String(value || "").trim().length;
  return (
    <SettingsField
      id={id}
      label={label}
      error={error}
      hint={`Required — at least ${SETTINGS_REASON_MIN_LENGTH} characters (${length}). Saved to the job's audit history.`}
    >
      <textarea
        id={id}
        className="app-input app-input--textarea"
        rows={3}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error && id ? `${id}-error` : undefined}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </SettingsField>
  );
}

/** Why a control is unavailable — shown in place of, or beside, the control. */
export function LockedNotice({ children, tone = "warning" }) {
  if (!children) return null;
  return <StatusMessage tone={tone}>{children}</StatusMessage>;
}

/** Result of the last save / action in a card. */
export function useActionFeedback() {
  const [feedback, setFeedback] = useState(null);
  const show = useCallback((result, successFallback = "Saved.") => {
    if (!result) return;
    setFeedback(
      result.success
        ? { tone: "success", text: result.message || successFallback }
        : { tone: "danger", text: result.error?.message || result.error || "The change could not be saved." }
    );
  }, []);
  const clear = useCallback(() => setFeedback(null), []);
  const node = feedback ? <StatusMessage tone={feedback.tone}>{feedback.text}</StatusMessage> : null;
  return { feedback: node, show, clear };
}

/**
 * Form state seeded from saved values. When a saved value changes — after a
 * save, or a realtime change made by someone else — only that field is reset,
 * so unrelated unsaved edits survive the refresh.
 */
export function useBaselineForm(baseline) {
  const [form, setForm] = useState(baseline);
  const previousRef = useRef(baseline);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = baseline;
    const changedKeys = Object.keys(baseline).filter((key) => baseline[key] !== previous[key]);
    if (!changedKeys.length) return;
    setForm((current) => {
      const next = { ...current };
      changedKeys.forEach((key) => {
        next[key] = baseline[key];
      });
      return next;
    });
  }, [baseline]);

  const setField = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const isDirty = (keys = Object.keys(baseline)) => keys.some((key) => form[key] !== baseline[key]);
  const reset = useCallback(() => setForm(previousRef.current), []);

  return { form, setField, isDirty, reset };
}

/**
 * Registers the active section's save action with the popup header, where the
 * settings popup convention puts it (immediately left of Close). `onSave` is
 * read through a ref, so re-renders never re-register it.
 */
export function useSettingsSave(register, { dirty = false, busy = false, disabled = false, onSave, label = "Save changes" }) {
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    register?.({ dirty, busy, disabled, label, onSave: () => saveRef.current?.() });
  }, [register, dirty, busy, disabled, label]);

  useEffect(() => () => register?.(null), [register]);
}

/**
 * Why the job's ordinary fields cannot be edited by this user, or null when
 * they can. Mirrors canEdit from resolveJobCardPermissions.
 */
export function getEditLockMessage(permissions = {}, { isArchiveMode = false, statusLabel = "" } = {}) {
  if (isArchiveMode) return "This is the archived copy of the job card, so it is read-only.";
  if (!permissions.canEditBase) return "Your role can view this job card but not change it.";
  if (permissions.isInvoiceOrBeyondReadOnly) {
    return permissions.canReopenJob
      ? `Locked because the job is ${statusLabel || "read-only"}. Reopen it from Danger zone to make changes.`
      : `Locked because the job is ${statusLabel || "read-only"}. A manager can reopen it.`;
  }
  return null;
}

/** Split an ISO instant into local "YYYY-MM-DD" / "HH:MM" picker values. */
export const splitLocalDateTime = (value) => {
  if (!value) return { date: "", time: "" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };
  const pad = (number) => String(number).padStart(2, "0");
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
};

/** "12 Sep 2026, 14:05" — the settings popup's date-time format. */
export const formatSettingsDateTime = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};
