// file location: src/components/support/SupportReportModal.js
//
// Phase 3 — the "Report a problem" popup for the Help & Diagnostics ("support")
// feature. Built on the shared PopupModal (portal/backdrop/scroll-lock) and
// modelled on NextActionPrompt's local-state form pattern.
//
// What the user controls (the only things they see leave the browser):
//   - Category, optional title, required description.
//   - An optional, user-previewed + user-redactable screenshot.
//
// What is attached privately (taken once when the popup opened, in Phase 2's
// SupportReportContext.snapshot — already sanitised client-side): the diagnostics
// bundle. The user never sees the blob, but the modal is transparent about the
// CATEGORIES of data it contains (plan §4/§5). The server re-sanitises on ingest.
//
// This file is lazy-loaded by SupportControl so its (and the canvas/screenshot)
// code is only fetched when a user actually opens a report.

import React, { useEffect, useRef, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { useAlerts } from "@/context/AlertContext";
import { useSupportReport } from "@/context/SupportReportContext";
import { SUPPORT_CATEGORIES, DEFAULT_SUPPORT_CATEGORY } from "@/lib/support/reportSubmission";
import SupportScreenshotField from "@/components/support/SupportScreenshotField";

export default function SupportReportModal() {
  const { isOpen, prefill, snapshot, closeSupportReport } = useSupportReport();
  const { pushAlert } = useAlerts();

  const [category, setCategory] = useState(DEFAULT_SUPPORT_CATEGORY);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState(null); // baked PNG data URL or null
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const descriptionRef = useRef(null);

  // Reset local form state each time the popup is (re)opened, applying any
  // prefill the error boundary (Phase 4) may supply.
  useEffect(() => {
    if (!isOpen) return;
    setCategory(prefill?.category || DEFAULT_SUPPORT_CATEGORY);
    setTitle(prefill?.title || "");
    setDescription(prefill?.description || "");
    setScreenshot(null);
    setError(null);
    setIsSubmitting(false);
    // Focus the description for fast entry.
    const t = setTimeout(() => descriptionRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen, prefill]);

  if (!isOpen) return null;

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

    try {
      const response = await fetch("/api/support/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim() || null,
          description: trimmed,
          diagnostics: snapshot || {},
          screenshot, // null when the user attached none
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Could not send your report.");
      }

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

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-1)", fontWeight: 600 }}>
          What kind of problem is it?
          <select
            className="app-input app-input--select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {SUPPORT_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-1)", fontWeight: 600 }}>
          Title (optional)
          <input
            className="app-input"
            type="text"
            value={title}
            maxLength={300}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="A short summary"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-1)", fontWeight: 600 }}>
          What happened? <span style={{ color: "var(--accentText)" }}>*</span>
          <textarea
            ref={descriptionRef}
            className="app-input app-input--textarea"
            value={description}
            rows={4}
            maxLength={5000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what you were doing and what went wrong…"
            style={{ resize: "vertical" }}
          />
        </label>

        <SupportScreenshotField onChange={setScreenshot} />

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

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="app-btn app-btn--ghost"
            onClick={closeSupportReport}
            disabled={isSubmitting}
            style={{ minHeight: "44px" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="app-btn app-btn--primary"
            disabled={isSubmitting}
            style={{ minHeight: "44px", minWidth: "140px" }}
          >
            {isSubmitting ? "Sending…" : "Send report"}
          </button>
        </div>
      </form>
    </PopupModal>
  );
}
