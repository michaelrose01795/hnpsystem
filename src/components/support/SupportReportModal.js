// file location: src/components/support/SupportReportModal.js
//
// The "Report a problem" popup for the Help & Diagnostics ("support") feature.
// Built on the shared PopupModal with the staff popup conventions: a compact
// header (title + Send / Clear / Close symbol buttons), the canonical shared
// dropdown (DropdownField — see CLAUDE.md §3.4: never a raw <select>) and
// LayerTheme panels.
//
// What the user controls (the only things they see leave the browser):
//   - Category (shared dropdown), required description, optional screenshots.
//
// Behaviour (pre-Phase-5):
//   - The description is PRE-FILLED with a plain-English summary of the last 10
//     captured actions (buildDescriptionDraft); the user edits/corrects freely.
//   - On open, the screenshot field auto-starts a capture of the underlying app
//     screen (the popup hides itself during capture — see isCapturing).
//   - The draft (category + description + screenshots) is auto-saved locally and
//     survives close/reload; it is cleared only on Send report or Clear.
//
// What is attached privately (the already-sanitised diagnostics snapshot from
// Phase 2's SupportReportContext) is never shown to the user; the modal only
// discloses the CATEGORIES of data it contains. The server re-sanitises on ingest.

import React, { useEffect, useMemo, useRef, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import StatusMessage from "@/components/ui/StatusMessage";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { useAlerts } from "@/context/AlertContext";
import { useSupportReport } from "@/context/SupportReportContext";
import { SUPPORT_CATEGORIES, DEFAULT_SUPPORT_CATEGORY } from "@/lib/support/reportSubmission";
import { buildEnrichedDescription } from "@/lib/support/diagnosticAnalysis";
import { loadDraft, saveDraft, clearDraft } from "@/lib/support/supportDraft";
import SupportScreenshotsField from "@/components/support/SupportScreenshotField";
import { recordReportCreated } from "@/lib/support/feedbackDevBridge";

// The header's Send button sits outside the <form>, so it targets it by id.
const REPORT_FORM_ID = "support-report-form";

// Layout-only overrides on the shared popup card; its look comes from the
// staff popup rules.
const REPORT_POPUP_CARD_STYLE = {
  width: "min(560px, 100%)",
  padding: "var(--page-card-padding)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--layout-card-gap)",
};

const getStorage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

export default function SupportReportModal() {
  const { isOpen, prefill, snapshot, closeSupportReport } = useSupportReport();
  const { pushAlert } = useAlerts();

  const [category, setCategory] = useState(DEFAULT_SUPPORT_CATEGORY);
  const [description, setDescription] = useState("");
  const [screenshots, setScreenshots] = useState([]); // baked PNG data URLs
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false); // hides the popup during capture
  const [error, setError] = useState(null);
  const [resetSignal, setResetSignal] = useState(0); // bumps to re-init the screenshot field

  const descriptionRef = useRef(null);
  const descriptionEditedRef = useRef(false); // don't clobber user edits with auto-fill
  const autoStartCaptureRef = useRef(false); // whether to auto-capture on this open
  const hydratingRef = useRef(false); // suppress draft-save while we set initial state

  // The assistant's analysis of the snapshot taken when the popup opened, and the
  // enriched description it generates (probable cause + affected + timeline).
  const analysis = snapshot?.analysis || null;

  // The reference code the user has already seen — on the error toast that
  // launched this popup (prefill.trigger) or on the recovery screen an error
  // boundary rendered (prefill.referenceCode). It is shown back to them here and
  // sent with the report so the report and the automatically-captured error
  // events line up on one code.
  const referenceCode = prefill?.trigger?.referenceCode || prefill?.referenceCode || null;
  const generatedDescription = useMemo(
    () => buildEnrichedDescription(snapshot || {}, analysis),
    [snapshot, analysis]
  );

  // Initialise on open: restore a saved draft if present, else auto-fill.
  useEffect(() => {
    if (!isOpen) return undefined;
    hydratingRef.current = true;

    const saved = loadDraft(getStorage());
    if (saved && (saved.description.trim() || saved.screenshots.length || saved.category)) {
      setCategory(saved.category || prefill?.category || DEFAULT_SUPPORT_CATEGORY);
      setDescription(saved.description || generatedDescription);
      setScreenshots(saved.screenshots);
      descriptionEditedRef.current = saved.descriptionEdited;
      autoStartCaptureRef.current = false; // already has a draft; don't auto-capture
    } else {
      setCategory(prefill?.category || DEFAULT_SUPPORT_CATEGORY);
      setDescription(prefill?.description || generatedDescription);
      setScreenshots([]);
      descriptionEditedRef.current = Boolean(prefill?.description);
      autoStartCaptureRef.current = true; // fresh report → offer an immediate capture
    }

    setError(null);
    setIsSubmitting(false);
    setIsCapturing(false);
    setResetSignal((n) => n + 1);

    const t = setTimeout(() => {
      descriptionRef.current?.focus();
      hydratingRef.current = false;
    }, 60);
    return () => clearTimeout(t);
  }, [isOpen, prefill, generatedDescription]);

  // Auto-save the draft whenever the editable fields change (but not while we are
  // hydrating initial state, and not mid-submit).
  useEffect(() => {
    if (!isOpen || hydratingRef.current || isSubmitting) return;
    saveDraft(getStorage(), {
      category,
      description,
      descriptionEdited: descriptionEditedRef.current,
      screenshots,
    });
  }, [isOpen, isSubmitting, category, description, screenshots]);

  if (!isOpen) return null;

  const handleDescriptionChange = (event) => {
    descriptionEditedRef.current = true;
    setDescription(event.target.value);
  };

  const handleClear = () => {
    clearDraft(getStorage());
    setCategory(DEFAULT_SUPPORT_CATEGORY);
    setDescription(generatedDescription);
    setScreenshots([]);
    descriptionEditedRef.current = false;
    autoStartCaptureRef.current = false; // explicit reset — don't surprise-capture
    setError(null);
    setResetSignal((n) => n + 1);
    descriptionRef.current?.focus();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) {
      setError("Please describe what happened.");
      descriptionRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Phase 10.1 — when the report was launched from a clicked error/warning
    // toast, the prefill carries a private `trigger` (origin + reference code +
    // the friendly message + devInfo). Fold it INTO the diagnostics blob so it
    // persists with the report and is server-re-sanitised — it is never shown to
    // the reporter (the modal only discloses the CATEGORIES of attached data), so
    // normal staff still can't see the technical detail.
    const trigger = prefill?.trigger || null;
    const diagnostics = trigger ? { ...(snapshot || {}), trigger } : snapshot || {};

    try {
      const response = await fetch("/api/support/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description: trimmed,
          diagnostics,
          screenshots, // array of baked PNG data URLs (may be empty)
          // The code already shown to the user. The server uses it to stamp this
          // report onto the error events captured AUTOMATICALLY when the failure
          // happened — so the developer opening the report sees the technical
          // trail that existed before the user typed a word.
          referenceCode,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Could not send your report.");
      }
      // Every report now gets a reference: the error code the user already saw,
      // or one the server minted. Show whichever the server confirmed.
      const confirmedReference = payload?.data?.referenceCode || referenceCode;

      clearDraft(getStorage());
      // Record the created report (origin + reference + alert id) so the toast
      // that launched it flips to "Reported ✓" (dedup) and the dev diagnostics
      // page can list reports created from clicked errors.
      recordReportCreated({
        origin: trigger?.origin || "support-modal",
        referenceCode: referenceCode || undefined,
        message: trigger?.message || trimmed.slice(0, 120),
        alertId: trigger?.alertId,
      });
      pushAlert(
        confirmedReference
          ? `✅ Thanks — your report has been sent to the team. Reference: ${confirmedReference}`
          : "✅ Thanks — your report has been sent to the team.",
        "success"
      );
      closeSupportReport();
    } catch (err) {
      setError(err.message || "Could not send your report.");
      pushAlert("❌ We couldn't send your report. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Report a problem popup: choose a category, describe what went wrong and attach optional screenshots, then send, clear or close from the header.
  return (
    <PopupModal
      isOpen={isOpen}
      onClose={isSubmitting ? undefined : closeSupportReport}
      closeOnBackdrop={!isSubmitting}
      ariaLabel="Report a problem"
      // Hide (don't unmount) the popup during screen capture so it never appears
      // in the screenshot; the component stays mounted, preserving all form state.
      backdropStyle={isCapturing ? { visibility: "hidden", pointerEvents: "none" } : undefined}
      cardStyle={REPORT_POPUP_CARD_STYLE}
    >
      {/* Staff popup convention: one title plus actions. Send and Clear sit to
          the left of Close, which the shared rules pin to the top-right corner.
          Send lives outside the form, so it submits it through `form=`. "Send
          report" is not in the label map, so its symbol is named explicitly;
          Clear (eraser) and Close (cross) resolve from their labels. */}
      <header className="app-popup-compact-header">
        <h2>Report a problem</h2>
        <div className="app-popup-compact-header__actions">
          <Button
            type="submit"
            form={REPORT_FORM_ID}
            variant="primary"
            symbol="send"
            busy={isSubmitting}
            disabled={isCapturing}
          >
            Send report
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClear}
            disabled={isSubmitting || isCapturing}
          >
            Clear
          </Button>
          <Button type="button" variant="secondary" onClick={closeSupportReport} disabled={isSubmitting}>
            Close
          </Button>
        </div>
      </header>

      {/* The code the user already saw on the toast or recovery screen. It is
          worth showing again here: it is what they quote to support, and it is
          the key the automatically-captured technical detail is filed under.
          Selectable in one drag. */}
      {referenceCode && (
        <p className="app-error-reference">
          Reference: <span className="app-error-reference__code">{referenceCode}</span>
        </p>
      )}

      {/* Diagnostic assistant: the likely cause of the problem, how confident it is and where in the system it probably sits; shown only when it is reasonably sure. */}
      {analysis?.probableCause && analysis.probableCause.confidence >= 0.3 && (
        <LayerTheme gap="var(--space-xs)">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-xs)" }}>
            <strong>Diagnostic assistant</strong>
            <span className="app-badge app-badge--neutral">
              {Math.round(analysis.probableCause.confidence * 100)}% confidence
            </span>
          </div>
          <p>{analysis.probableCause.summary}</p>
          {analysis.affected?.component && (
            <p className="app-field-hint">
              Likely in <strong>{analysis.affected.component}</strong>
              {analysis.affected.codeOwnership?.file
                ? ` · ${analysis.affected.codeOwnership.file}${
                    analysis.affected.codeOwnership.line ? `:${analysis.affected.codeOwnership.line}` : ""
                  }`
                : ""}
            </p>
          )}
          <p className="app-field-hint">
            We&apos;ve pre-filled the description below from this — please edit or correct it.
          </p>
        </LayerTheme>
      )}

      <form
        id={REPORT_FORM_ID}
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}
      >
        <DropdownField
          id="support-report-category"
          label="What kind of problem is it?"
          options={SUPPORT_CATEGORIES}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Choose a category"
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          <label htmlFor="support-report-description">
            What happened?
            <span className="app-field-required" aria-hidden="true">
              {" *"}
            </span>
          </label>
          <textarea
            id="support-report-description"
            ref={descriptionRef}
            className="app-input app-input--textarea"
            value={description}
            rows={7}
            maxLength={5000}
            aria-required="true"
            onChange={handleDescriptionChange}
            placeholder="Describe what you were doing and what went wrong…"
          />
        </div>

        <SupportScreenshotsField
          initialScreenshots={screenshots}
          resetSignal={resetSignal}
          autoStart={autoStartCaptureRef.current}
          onChange={setScreenshots}
          onCaptureVisibilityChange={setIsCapturing}
        />

        {/* What gets attached: the kinds of private technical detail sent with the report (never the actual values) and who can see it. */}
        <LayerTheme gap="var(--space-xs)">
          <strong>What we attach to help us investigate</strong>
          <p className="app-field-hint">
            The page you&apos;re on, your role, your device, browser &amp; timezone, recent actions, and any
            errors. It never includes passwords, tokens, cookies, or full personal data — and only the support
            team can see it.
          </p>
        </LayerTheme>

        {error && (
          <StatusMessage tone="danger">
            <span role="alert">{error}</span>
          </StatusMessage>
        )}
      </form>
    </PopupModal>
  );
}
