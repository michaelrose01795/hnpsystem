// file location: src/components/JobCards/MobileMechanicEligibility.js

import React, { useEffect, useMemo } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
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
    <span aria-hidden="true" className={className}>
      {ok === true ? "✓" : ok === false ? "×" : "…"}
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

  const statusMeta =
    verdict.status === "eligible"
      ? { label: "Eligible", className: "app-badge app-badge--success" }
      : verdict.status === "pending"
        ? { label: "Checking…", className: "app-badge app-badge--neutral" }
        : { label: "Not eligible", className: "app-badge app-badge--danger" };

  return (
    <div>
      <label>Mobile Mechanic Eligibility</label>

      <LayerSurface
        radius="var(--radius-sm)"
        padding="10px 12px"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: "10px",
        }}
      >
        <span className={statusMeta.className}>{statusMeta.label}</span>
        <span>Rules: service · Suzuki · ≤ 3 yrs · ≤ 40 min drive</span>
      </LayerSurface>

      <ul
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
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <RuleIcon ok={rule.ok} />
            <span style={{ flex: 1 }}>
              <strong>{rule.label}</strong>
              {rule.detail ? <span> — {rule.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      <div
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
                title={disabled ? "This job does not meet the Mobile Mechanic rules" : undefined}
              >
                {choice ? "Yes" : "No"}
              </button>
            );
          })}
        </div>
      </div>

      {isMobileMechanic && verdict.eligible ? (
        <StatusMessage tone="success" style={{ marginTop: "10px" }}>
          This job will be saved as a Mobile Mechanic booking. The customer&apos;s
          address and mobile number will be used as the on-site contact.
        </StatusMessage>
      ) : null}
    </div>
  );
}
