// file location: src/components/support/SupportReportModal.js
//
// The "Report a problem" popup for the Help & Diagnostics ("support") feature.
// Built on the shared PopupModal and the canonical shared dropdown
// (DropdownField — see CLAUDE.md §3.4: never a raw <select>).
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
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";
import { useAlerts } from "@/context/AlertContext";
import { useSupportReport } from "@/context/SupportReportContext";
import { SUPPORT_CATEGORIES, DEFAULT_SUPPORT_CATEGORY } from "@/lib/support/reportSubmission";
import { buildEnrichedDescription } from "@/lib/support/diagnosticAnalysis";
import { loadDraft, saveDraft, clearDraft } from "@/lib/support/supportDraft";
import SupportScreenshotsField from "@/components/support/SupportScreenshotField";
import { recordReportCreated } from "@/lib/support/feedbackDevBridge";

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
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Could not send your report.");
      }

      clearDraft(getStorage());
      // Record the created report (origin + reference + alert id) so the toast
      // that launched it flips to "Reported ✓" (dedup) and the dev diagnostics
      // page can list reports created from clicked errors.
      recordReportCreated({
        origin: trigger?.origin || "support-modal",
        referenceCode: trigger?.referenceCode,
        message: trigger?.message || trimmed.slice(0, 120),
        alertId: trigger?.alertId,
      });
      pushAlert("✅ Thanks — your report has been sent to the team.", "success");
      closeSupportReport();
    } catch (err) {
      setError(err.message || "Could not send your report.");
      pushAlert("❌ We couldn't send your report. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={isSubmitting ? undefined : closeSupportReport}
      ariaLabel="Report a problem"
      // Hide (don't unmount) the popup during screen capture so it never appears
      // in the screenshot; the component stays mounted, preserving all form state.
      backdropStyle={isCapturing ? { visibility: "hidden", pointerEvents: "none" } : undefined}
      cardStyle={{
        width: "min(560px, 100%)",
        padding: "clamp(20px, 4vw, 28px)",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--accentText)",
            }}
          >
            Help &amp; Support
          </p>
          <h2 style={{ margin: "4px 0 0", color: "var(--text-1)" }}>Report a problem</h2>
          <p style={{ margin: "6px 0 0", color: "var(--text-1)", opacity: 0.7, lineHeight: 1.5, fontSize: "0.9rem" }}>
            Tell us what went wrong. We&apos;ll attach a private technical snapshot to help us fix it.
          </p>
        </div>
        <button
          type="button"
          className="app-btn app-btn--ghost"
          onClick={closeSupportReport}
          disabled={isSubmitting}
          aria-label="Close report"
          style={{ minHeight: "44px" }}
        >
          Close
        </button>
      </div>

      {analysis?.probableCause && analysis.probableCause.confidence >= 0.3 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            background: "var(--theme)",
            fontSize: "0.85rem",
            color: "var(--text-1)",
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <strong style={{ fontWeight: 600 }}>Diagnostic assistant</strong>
            <span
              className="app-badge app-badge--control"
              style={{ fontSize: "0.7rem" }}
            >
              {Math.round(analysis.probableCause.confidence * 100)}% confidence
            </span>
          </div>
          <span style={{ opacity: 0.85 }}>{analysis.probableCause.summary}</span>
          {analysis.affected?.component && (
            <span style={{ opacity: 0.7, fontSize: "0.8rem" }}>
              Likely in <strong>{analysis.affected.component}</strong>
              {analysis.affected.codeOwnership?.file
                ? ` · ${analysis.affected.codeOwnership.file}${
                    analysis.affected.codeOwnership.line ? `:${analysis.affected.codeOwnership.line}` : ""
                  }`
                : ""}
            </span>
          )}
          <span style={{ opacity: 0.6, fontSize: "0.78rem" }}>
            We&apos;ve pre-filled the description below from this — please edit or correct it.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ color: "var(--text-1)", fontWeight: 600 }}>What kind of problem is it?</span>
          <DropdownField
            aria-label="What kind of problem is it?"
            options={SUPPORT_CATEGORIES}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Choose a category"
          />
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-1)", fontWeight: 600 }}>
          <span>
            What happened? <span style={{ color: "var(--accentText)" }}>*</span>
          </span>
          <textarea
            ref={descriptionRef}
            className="app-input app-input--textarea"
            value={description}
            rows={7}
            maxLength={5000}
            onChange={handleDescriptionChange}
            placeholder="Describe what you were doing and what went wrong…"
            style={{ resize: "vertical" }}
          />
        </label>

        <SupportScreenshotsField
          initialScreenshots={screenshots}
          resetSignal={resetSignal}
          autoStart={autoStartCaptureRef.current}
          onChange={setScreenshots}
          onCaptureVisibilityChange={setIsCapturing}
        />

        {/* Transparency disclosure — the CATEGORIES of private data attached,
            never the values (plan §4/§5). */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            background: "var(--theme)",
            fontSize: "0.8rem",
            color: "var(--text-1)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ fontWeight: 600 }}>What we attach to help us investigate</strong>
          <span style={{ opacity: 0.8 }}>
            The page you&apos;re on, your role, device &amp; browser, recent actions, and any errors. It
            never includes passwords, tokens, cookies, or full personal data — and only the support team
            can see it.
          </span>
        </div>

        {error && (
          <div className="app-status-message app-status-message--danger" role="alert">
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", flexWrap: "wrap" }}>
          <button
            type="button"
            className="app-btn app-btn--ghost"
            onClick={handleClear}
            disabled={isSubmitting || isCapturing}
            style={{ minHeight: "44px" }}
          >
            Clear
          </button>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="app-btn app-btn--secondary"
              onClick={closeSupportReport}
              disabled={isSubmitting}
              style={{ minHeight: "44px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="app-btn app-btn--primary"
              disabled={isSubmitting || isCapturing}
              style={{ minHeight: "44px", minWidth: "140px" }}
            >
              {isSubmitting ? "Sending…" : "Send report"}
            </button>
          </div>
        </div>
      </form>
    </PopupModal>
  );
}
