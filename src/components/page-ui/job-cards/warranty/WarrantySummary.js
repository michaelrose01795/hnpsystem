// file location: src/components/page-ui/job-cards/warranty/WarrantySummary.js
// Top summary strip for a linked warranty claim: the linked job, the (derived,
// read-only) claim value, the editable authorisation status, and the editable
// customer-liability figure. Section is a LayerTheme; the stat tiles inside flip
// back to LayerSurface (depth 2).
import React, { useEffect, useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import LayerSurface from "@/components/ui/LayerSurface";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { formatCurrency } from "@/components/page-ui/job-cards/service-history/historyFormat";

const AUTH_OPTIONS = [
  { value: "not_requested", label: "Not Requested" },
  { value: "requested", label: "Authorisation Requested" },
  { value: "authorised", label: "Authorised" },
  { value: "rejected", label: "Rejected" },
];

const AUTH_TONE = {
  not_requested: "app-badge--neutral",
  requested: "app-badge--warning",
  authorised: "app-badge--success",
  rejected: "app-badge--danger",
};

const AUTH_LABEL = Object.fromEntries(AUTH_OPTIONS.map((o) => [o.value, o.label]));

// Stat tile — a depth-2 LayerSurface inside the LayerTheme section.
function StatTile({ label, children }) {
  return (
    <LayerSurface
      radius="var(--radius-sm)"
      padding="14px"
      gap="6px"
      style={{ flex: "1 1 180px", minWidth: 0 }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--text-1)",
          opacity: 0.6,
        }}
      >
        {label}
      </span>
      {children}
    </LayerSurface>
  );
}

export default function WarrantySummary({
  linkedJob,
  claim,
  totals,
  canEdit = false,
  busy = false,
  onUpdateClaim = () => {},
}) {
  const authStatus = claim?.authorisation_status || "not_requested";
  const liabilityValue = Number(claim?.customer_liability) || 0;
  const claimValue = totals?.total?.gross ?? null;

  const [liabilityDraft, setLiabilityDraft] = useState(String(liabilityValue));
  useEffect(() => {
    setLiabilityDraft(String(Number(claim?.customer_liability) || 0));
  }, [claim?.customer_liability]);

  const liabilityDirty = Number(liabilityDraft || 0) !== liabilityValue;

  const handleAuthChange = (next) => {
    if (next === authStatus) return;
    const patch = { authorisation_status: next };
    // Stamp the matching timeline timestamp the first time a stage is reached.
    if (next === "requested" && !claim?.authorisation_requested_at) {
      patch.authorisation_requested_at = new Date().toISOString();
    }
    if (next === "authorised" && !claim?.authorised_at) {
      patch.authorised_at = new Date().toISOString();
      if (!claim?.authorisation_requested_at) {
        patch.authorisation_requested_at = new Date().toISOString();
      }
    }
    onUpdateClaim(patch);
  };

  const handleLiabilitySave = () => {
    if (!liabilityDirty) return;
    onUpdateClaim({ customer_liability: Number(liabilityDraft) || 0 });
  };

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-summary"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Warranty Claim Summary
      </h3>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        <StatTile label="Warranty Job Linked">
          <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--accentText)" }}>
            #{linkedJob?.jobNumber || "—"}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-1)", opacity: 0.7 }}>
            {linkedJob?.reg || "No reg"}
            {linkedJob?.makeModel ? ` · ${linkedJob.makeModel}` : ""}
          </span>
        </StatTile>

        <StatTile label="Claim Value (inc VAT)">
          <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-1)" }}>
            {claimValue === null ? "—" : formatCurrency(claimValue)}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-1)", opacity: 0.7 }}>
            {totals ? `${formatCurrency(totals.total.net)} ex VAT` : "Derived from parts + labour"}
          </span>
        </StatTile>

        <StatTile label="Warranty Authorisation">
          {canEdit ? (
            <DropdownField
              value={authStatus}
              onValueChange={handleAuthChange}
              disabled={busy}
              options={AUTH_OPTIONS}
            />
          ) : (
            <span className={`app-badge ${AUTH_TONE[authStatus] || "app-badge--neutral"}`}>
              {AUTH_LABEL[authStatus] || authStatus}
            </span>
          )}
          {claim?.authorisation_reference && (
            <span style={{ fontSize: "12px", color: "var(--text-1)", opacity: 0.7 }}>
              Ref: {claim.authorisation_reference}
            </span>
          )}
        </StatTile>

        <StatTile label="Customer Liability">
          {canEdit ? (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                className="app-input"
                type="number"
                min="0"
                step="0.01"
                value={liabilityDraft}
                onChange={(e) => setLiabilityDraft(e.target.value)}
                onBlur={handleLiabilitySave}
                disabled={busy}
                style={{ maxWidth: "120px" }}
              />
              {liabilityDirty && (
                <button
                  type="button"
                  className="app-btn app-btn--primary"
                  onClick={handleLiabilitySave}
                  disabled={busy}
                >
                  Save
                </button>
              )}
            </div>
          ) : (
            <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-1)" }}>
              {formatCurrency(liabilityValue)}
            </span>
          )}
        </StatTile>
      </div>
    </LayerTheme>
  );
}
