// file location: src/components/JobCards/MobileMechanicEligibility.js
// "Mobile Mechanic Eligibility" section rendered inside the Job Information
// card on /job-cards/create.
//
// Responsibilities:
//   1. Evaluate the 4 eligibility rules (drive time, vehicle age, make,
//      service) using the pure engine in lib/mobileMechanic/eligibility.js.
//   2. Show a status badge + itemised rule list so the advisor can see at
//      a glance why the job does or doesn't qualify.
//   3. Render a Yes / No control that only becomes interactive when every
//      rule passes — so mobile mechanic cannot be forced on jobs that
//      break the rules.
//   4. Lift the user's Yes/No selection via onSelectionChange so the
//      create page can include it in the save payload.
//
// Styling follows the existing Job Information section — no new CSS
// classes, no hardcoded colours, and the Yes/No control reuses the same
// binaryToggleGroup pattern used by Cosmetic Damage / Wash / VHC via the
// props `toggleGroupStyle` + `getToggleButtonStyle` passed in by the page.

import React, { useEffect, useMemo } from "react";
import { evaluateMobileMechanicEligibility } from "@/lib/mobileMechanic/eligibility";
import useDriveTimeToHNP from "@/hooks/useDriveTimeToHNP";

// Visual icon for each rule based on its outcome. Colour comes from theme tokens.
function RuleIcon({ ok }) {
  if (ok === true) {
    return (
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 20px",
          width: "20px",
          height: "20px",
          borderRadius: "var(--radius-pill)",
          background: "var(--success-base, var(--success))",
          color: "var(--surface)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        ✓
      </span>
    );
  }
  if (ok === false) {
    return (
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 20px",
          width: "20px",
          height: "20px",
          borderRadius: "var(--radius-pill)",
          background: "var(--danger-base, var(--danger))",
          color: "var(--surface)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        ×
      </span>
    );
  }
  // null / unknown — neutral pending dot
  return (
    <span
      aria-hidden="true"
      style={{
        flex: "0 0 20px",
        width: "20px",
        height: "20px",
        borderRadius: "var(--radius-pill)",
        background: "var(--control-bg)",
        color: "var(--text-secondary)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      …
    </span>
  );
}

export default function MobileMechanicEligibility({
  customer,
  vehicle,
  jobDetections,
  jobCategories,
  isMobileMechanic,
  onSelectionChange,
  toggleGroupStyle,
  getToggleButtonStyle,
}) {
  // Fetch drive time for the current customer postcode. The hook is a no-op
  // until a plausible UK postcode appears, so we don't spam the API on every
  // keystroke.
  const postcode = customer?.postcode || "";
  const driveTime = useDriveTimeToHNP(postcode);

  // Run the rules engine every time any input changes. Memoised so the
  // Yes/No effect below only fires on real verdict changes.
  const verdict = useMemo(
    () =>
      evaluateMobileMechanicEligibility({
        customer,
        vehicle,
        jobDetections,
        jobCategories,
        driveTime,
      }),
    [customer, vehicle, jobDetections, jobCategories, driveTime]
  );

  // Safety net: if the job stops being eligible while the user already
  // chose "Yes", flip them back to "No". This prevents a save payload
  // that says serviceMode=mobile when the rules no longer hold (e.g. the
  // advisor edited the postcode after ticking Yes).
  useEffect(() => {
    if (isMobileMechanic && !verdict.eligible) {
      onSelectionChange?.(false);
    }
  }, [verdict.eligible, isMobileMechanic, onSelectionChange]);

  const statusMeta = (() => {
    if (verdict.status === "eligible") {
      return {
        label: "Eligible",
        fg: "var(--success-dark, var(--success))",
        bg: "var(--success-surface, var(--control-bg))",
      };
    }
    if (verdict.status === "pending") {
      return {
        label: "Checking…",
        fg: "var(--text-secondary)",
        bg: "var(--control-bg)",
      };
    }
    return {
      label: "Not eligible",
      fg: "var(--danger-dark, var(--danger))",
      bg: "var(--danger-surface, var(--control-bg))",
    };
  })();

  return (
    <div>
      <label
        style={{
          fontSize: "13px",
          fontWeight: "600",
          color: "var(--text-secondary)",
          display: "block",
          marginBottom: "10px",
        }}
      >
        Mobile Mechanic Eligibility
      </label>

      {/* Status badge + brief summary line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "var(--surface)",
          marginBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 10px",
            borderRadius: "var(--radius-pill)",
            fontSize: "12px",
            fontWeight: 700,
            color: statusMeta.fg,
            backgroundColor: statusMeta.bg,
          }}
        >
          {statusMeta.label}
        </span>
        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          Rules: service · Suzuki · ≤ 3 yrs · ≤ 40 min drive
        </span>
      </div>

      {/* Itemised rule list */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          marginBottom: "12px",
          padding: 0,
          display: "grid",
          gap: "6px",
        }}
      >
        {verdict.rules.map((rule) => (
          <li
            key={rule.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              fontSize: "12px",
              lineHeight: 1.4,
              color: "var(--text-primary)",
            }}
          >
            <RuleIcon ok={rule.ok} />
            <span style={{ flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{rule.label}</span>
              {rule.detail ? (
                <span style={{ color: "var(--text-secondary)", marginLeft: "6px" }}>
                  — {rule.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {/* Yes / No control — only interactive when all rules pass. When
          ineligible, buttons remain visible but disabled, with a hint. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          Send as Mobile Mechanic?
        </span>
        <div
          style={toggleGroupStyle}
          aria-disabled={!verdict.eligible ? "true" : "false"}
        >
          {[true, false].map((choice) => {
            const disabled = !verdict.eligible && choice === true;
            const baseStyle = getToggleButtonStyle(isMobileMechanic === choice);
            return (
              <button
                key={choice ? "yes" : "no"}
                type="button"
                onClick={() => {
                  if (disabled) return;
                  onSelectionChange?.(choice);
                }}
                disabled={disabled}
                style={{
                  ...baseStyle,
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
                title={
                  disabled
                    ? "This job does not meet the Mobile Mechanic rules"
                    : undefined
                }
              >
                {choice ? "Yes" : "No"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirmation note when Yes is selected — keeps the workflow
          obvious to the advisor without adding extra fields. The
          on-site contact/address details are taken from the customer
          record at save time. */}
      {isMobileMechanic && verdict.eligible ? (
        <div
          style={{
            marginTop: "10px",
            fontSize: "12px",
            color: "var(--text-primary)",
            backgroundColor: "var(--success-surface, var(--surface))",
            borderRadius: "var(--radius-sm)",
            padding: "8px 10px",
          }}
        >
          This job will be saved as a Mobile Mechanic booking. The customer's
          address and mobile number will be used as the on-site contact.
        </div>
      ) : null}
    </div>
  );
}
