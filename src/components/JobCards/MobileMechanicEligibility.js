// file location: src/components/JobCards/MobileMechanicEligibility.js

import React, { useEffect, useMemo } from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import StatusMessage from "@/components/ui/StatusMessage";
import { evaluateMobileMechanicEligibility } from "@/lib/mobileMechanic/eligibility";
import useDriveTimeToHNP from "@/hooks/useDriveTimeToHNP";

function RuleIcon({ ok }) {
  const className =
    ok === true
      ? "app-badge app-badge--success-strong"
      : ok === false
        ? "app-badge app-badge--danger-strong"
        : "app-badge app-badge--neutral";

  return (
    <span aria-hidden="true" className={`${className} job-cards-create-mobile-eligibility-grid__rule-icon`}>
      {ok === true ? "✓" : ok === false ? "×" : (
        <span className="job-cards-create-mobile-eligibility-grid__pending-dots">
          <span />
          <span />
          <span />
        </span>
      )}
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
}) {
  const postcode = customer?.postcode || "";
  const driveTime = useDriveTimeToHNP(postcode);

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

  useEffect(() => {
    if (isMobileMechanic && !verdict.eligible) {
      onSelectionChange?.(false);
    }
  }, [verdict.eligible, isMobileMechanic, onSelectionChange]);

  return (
    <DevLayoutSection
      sectionKey="job-cards-create-mobile-mechanic-eligibility"
      sectionType="section-shell"
      parentKey="job-cards-create-job-information"
      className="job-cards-create-mobile-eligibility-grid"
      shell
    >
      <ul
        className="job-cards-create-mobile-eligibility-grid__rules"
        style={{
          listStyle: "none",
          margin: "0 0 12px",
          padding: 0,
          display: "grid",
          gap: "6px",
        }}
      >
        {verdict.rules.map((rule) => (
          <li
            key={rule.id}
            className="job-cards-create-mobile-eligibility-grid__rule"
            style={{
              display: "grid",
              gap: 0,
            }}
          >
            <label className="job-cards-create-mobile-eligibility-grid__rule-label">
              {rule.label}
            </label>
            <div className="app-input job-cards-create-mobile-eligibility-grid__rule-detail">
              <RuleIcon ok={rule.ok} />
              <span>{rule.detail || "Not available"}</span>
            </div>
          </li>
        ))}
      </ul>

      <div
        className="job-cards-create-mobile-eligibility-grid__choice"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <span>Send as Mobile Mechanic?</span>
        <div
          className="tab-api"
          style={{ flexWrap: "nowrap", minWidth: "max-content" }}
          aria-disabled={!verdict.eligible ? "true" : "false"}
        >
          {[true, false].map((choice) => {
            const disabled = !verdict.eligible && choice === true;
            return (
              <button
                key={choice ? "yes" : "no"}
                type="button"
                onClick={() => {
                  if (!disabled) onSelectionChange?.(choice);
                }}
                disabled={disabled}
                aria-pressed={isMobileMechanic === choice}
                data-tone="default"
                className={`tab-api__item${isMobileMechanic === choice ? " is-active" : ""}`}
                style={{ flex: "1 1 0", minWidth: "64px" }}
                title={disabled ? "This job does not meet the Mobile Mechanic rules" : undefined}
              >
                {choice ? "Yes" : "No"}
              </button>
            );
          })}
        </div>
      </div>

      {isMobileMechanic && verdict.eligible ? (
        <StatusMessage
          className="job-cards-create-mobile-eligibility-grid__message"
          tone="success"
          style={{ marginTop: "10px" }}
        >
          This job will be saved as a Mobile Mechanic booking. The customer&apos;s
          address and mobile number will be used as the on-site contact.
        </StatusMessage>
      ) : null}
    </DevLayoutSection>
  );
}
