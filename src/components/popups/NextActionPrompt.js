// file location: src/components/popups/NextActionPrompt.js
"use client";

import React, { useMemo, useState } from "react"; // import React helpers
import { useNextAction } from "@/context/NextActionContext"; // import next action context hook
import { useUser } from "@/context/UserContext"; // import user context to capture performer id
import { useTheme } from "@/styles/themeProvider";
import ModalPortal from "./ModalPortal";

const KEY_LOCATIONS = [
  "Completed Hooks – Row A",
  "Completed Hooks – Row B",
  "Jobs In Hooks – Service Desk",
  "Warranty Board",
  "Sales Desk Key Safe",
];

const VEHICLE_LOCATIONS = [
  "Front Row – Bay A",
  "Front Row – Bay B",
  "Workshop Holding Lane",
  "Valet Lane",
  "Customer Collection Bays",
];

const statusLabelForAction = (actionType, fallback) => {
  if (actionType === "job_checked_in") return "Awaiting Workshop";
  if (actionType === "vhc_complete") return "Awaiting Advisor";
  if (actionType === "job_complete") return "Ready For Collection";
  return fallback || "Ready For Collection";
};

export default function NextActionPrompt() {
  const { nextAction, clearNextAction, markOpened } = useNextAction(); // read action state
  const { dbUserId, user } = useUser(); // read supabase user id and identity
  const { resolvedMode } = useTheme();
  const closeButtonColor = resolvedMode === "dark" ? "var(--accent-purple)" : "var(--danger)";
  const [isOpen, setIsOpen] = useState(false); // track modal visibility
  const [keyLocation, setKeyLocation] = useState(KEY_LOCATIONS[0]); // selected key hook
  const [vehicleLocation, setVehicleLocation] = useState(VEHICLE_LOCATIONS[0]); // selected bay
  const [notes, setNotes] = useState(""); // additional notes
  const [isSubmitting, setIsSubmitting] = useState(false); // submission flag
  const [feedback, setFeedback] = useState(null); // store success or error message

  const buttonLabel = useMemo(() => {
    if (!nextAction) return "Next Action";
    if (nextAction.actionType === "job_checked_in") return "Log Key Drop";
    if (nextAction.actionType === "vhc_complete") return "VHC Next Steps";
    if (nextAction.actionType === "job_complete") return "Complete Actions";
    return "Next Action";
  }, [nextAction]);

  if (!nextAction) {
    return null; // do not render if there is no active action
  }

  const openPrompt = () => {
    markOpened(); // flag that the user has interacted
    setIsOpen(true);
    setFeedback(null);
    setKeyLocation(KEY_LOCATIONS[0]);
    setVehicleLocation(VEHICLE_LOCATIONS[0]);
    setNotes("");
  };

  const closePrompt = () => {
    setIsOpen(false);
    clearNextAction();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/tracking/next-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: nextAction.actionType,
          jobId: nextAction.jobId,
          jobNumber: nextAction.jobNumber,
          vehicleId: nextAction.vehicleId,
          vehicleReg: nextAction.vehicleReg,
          keyLocation,
          vehicleLocation,
          notes,
          performedBy: dbUserId || user?.id || null,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorPayload?.message || "Failed to log action");
      }

      setFeedback({ type: "success", message: "Next action logged and tracker updated." });
      setTimeout(() => {
        closePrompt();
      }, 1200);
    } catch (error) {
      console.error("Failed to log next action", error);
      setFeedback({ type: "error", message: error.message || "Unable to save action" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openPrompt}
        style={{
          padding: "8px 16px",
          borderRadius: "14px",
          border: "none",
          background: "var(--danger)",
          color: "white",
          fontWeight: 700,
          fontSize: "0.85rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          boxShadow: "none",
        }}
      >
        <span role="img" aria-label="Next action">🔔</span>
        {buttonLabel}
      </button>

      {isOpen && (
        <ModalPortal>
          <div className="popup-backdrop" style={{ padding: "20px", zIndex: 1000 }}>
            <div
              className="popup-card"
              style={{
                width: "min(520px, 100%)",
                borderRadius: "24px",
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                boxShadow: "none",
              }}
            >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--danger)" }}>
                  Next Action Required
                </p>
                <h2 style={{ margin: "4px 0 0", color: "var(--info-dark)" }}>{nextAction.title}</h2>
                <p style={{ margin: "8px 0 0", color: "var(--info-dark)", lineHeight: 1.5 }}>{nextAction.instruction}</p>
              </div>
              <button
                type="button"
                onClick={closePrompt}
                style={{
                  border: "none",
                  background: "transparent",
                  color: closeButtonColor,
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  lineHeight: 1,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
                aria-label="Close next action"
              >
                Close
              </button>
            </div>

            <div
            style={{
              padding: "16px",
              borderRadius: "16px",
              background: "rgba(var(--danger-rgb), 0.1)",
              border: "1px solid rgba(var(--danger-rgb), 0.25)",
              display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--info)", letterSpacing: "0.08em" }}>Job Number</p>
                <strong style={{ fontSize: "1rem", color: "var(--danger)" }}>{nextAction.jobNumber || "Unknown"}</strong>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--info)", letterSpacing: "0.08em" }}>Registration</p>
                <strong style={{ fontSize: "1rem", color: "var(--info-dark)" }}>{nextAction.vehicleReg || "N/A"}</strong>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--info)", letterSpacing: "0.08em" }}>Suggested Status</p>
                <strong style={{ fontSize: "1rem", color: "var(--info-dark)" }}>
                  {statusLabelForAction(nextAction.actionType, nextAction.defaultVehicleStatus)}
                </strong>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--info-dark)", fontWeight: 600 }}>
                Key Location
                <select
                  value={keyLocation}
                  onChange={(event) => setKeyLocation(event.target.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid rgba(var(--danger-rgb), 0.3)",
                    background: "var(--surface)",
                    color: "var(--info-dark)",
                    fontWeight: 600,
                  }}
                >
                  {KEY_LOCATIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--info-dark)", fontWeight: 600 }}>
                Vehicle Location
                <select
                  value={vehicleLocation}
                  onChange={(event) => setVehicleLocation(event.target.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid rgba(var(--danger-rgb), 0.3)",
                    background: "var(--surface)",
                    color: "var(--info-dark)",
                    fontWeight: 600,
                  }}
                >
                  {VEHICLE_LOCATIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--info-dark)", fontWeight: 600 }}>
                Additional Notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add hook number, valet status or customer handover notes..."
                  rows={3}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </label>

              {feedback && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    backgroundColor: feedback.type === "success" ? "var(--success-surface)" : "var(--danger-surface)",
                    color: feedback.type === "success" ? "var(--success-dark)" : "var(--danger)",
                    fontWeight: 600,
                  }}
                >
                  {feedback.message}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={closePrompt}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "12px",
                    border: "1px solid var(--info)",
                    background: "var(--surface)",
                    color: "var(--info-dark)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Skip
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "12px",
                    border: "none",
                    background: isSubmitting
                      ? "var(--danger)"
                      : "var(--danger)",
                    color: "white",
                    fontWeight: 700,
                    cursor: isSubmitting ? "wait" : "pointer",
                    boxShadow: "none",
                    minWidth: "140px",
                  }}
                >
                  {isSubmitting ? "Saving..." : "Log Action"}
                </button>
              </div>
            </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
