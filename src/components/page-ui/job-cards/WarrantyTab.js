// file location: src/components/page-ui/job-cards/WarrantyTab.js
// Warranty tab — consolidated into one file per CLAUDE.md §4.3 (one file per tab).
// Previously split across warranty/*; behaviour and markup are unchanged. Renders
// the restyled link flow when no warranty job is linked, and the full
// warranty-claim workspace (summary, timeline, requests, parts & labour summary,
// linked-job, notes) when one is. All claim/request mutations route through
// src/lib/database/warranty.js; warranty data itself is loaded server-side in the
// job-card API route and arrives on jobData.warranty*.
//
// Layer alternation (CLAUDE.md §3.0): the tab root is the <LayerSurface> shell,
// so every direct child section is a <LayerTheme> (depth 1), and any strip nested
// inside a section flips back to <LayerSurface> (depth 2). Shared pure formatters
// live in ./historyFormat (also used by the Service History tab).
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { supabase } from "@/lib/database/supabaseClient";
import { updateJob } from "@/lib/database/jobs";
import { createJobNote, getNotesByJob } from "@/lib/database/notes";
import {
  ensureWarrantyClaim,
  updateWarrantyClaim,
  createWarrantyRequest,
  updateWarrantyRequest,
} from "@/lib/database/warranty";
import { formatCurrency, DASH } from "./historyFormat";

/* ════════════════════════════════════════════════════════════════════════
   WarrantyLinkPanel — empty-state: link (or change) the paired warranty job.
   ════════════════════════════════════════════════════════════════════════ */
function WarrantyLinkPanel({
  jobData,
  canEdit = false,
  onLinkComplete = () => {},
  alert = (msg) => window.alert(msg),
}) {
  const [linkMode, setLinkMode] = useState(false);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const isLinked = Boolean(jobData?.linkedWarrantyJobId);

  const loadWarrantyJobs = useCallback(async () => {
    if (!canEdit) return;
    setLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, job_number, status, job_source, vehicle_reg, vehicle_make_model, warranty_linked_job_id"
        )
        .eq("job_source", "Warranty")
        .neq("id", jobData.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const filtered = (data || []).filter(
        (record) =>
          !record.warranty_linked_job_id || record.warranty_linked_job_id === jobData.id
      );
      setAvailableJobs(filtered);
      setLinkError(filtered.length ? "" : "No warranty jobs are available to link right now.");
    } catch (err) {
      console.error("❌ Failed to load warranty jobs:", err);
      setLinkError(err?.message || "Failed to load warranty jobs.");
    } finally {
      setLoadingJobs(false);
    }
  }, [canEdit, jobData?.id]);

  useEffect(() => {
    if (linkMode) {
      loadWarrantyJobs();
    } else {
      setAvailableJobs([]);
      setSelectedJobId("");
      setLinkError("");
    }
  }, [linkMode, loadWarrantyJobs]);

  const handleLinkJob = async () => {
    if (!selectedJobId) {
      setLinkError("Select a warranty job card to link.");
      return;
    }
    const numericJobId = Number(selectedJobId);
    if (Number.isNaN(numericJobId)) {
      setLinkError("Invalid job selection.");
      return;
    }
    const targetJob = availableJobs.find((job) => job.id === numericJobId) || null;
    if (!targetJob) {
      setLinkError("Selected warranty job is no longer available.");
      return;
    }

    const targetIsWarranty = (targetJob.job_source || "").toLowerCase() === "warranty";
    const currentIsWarranty = (jobData?.jobSource || "").toLowerCase() === "warranty";
    const masterJobId =
      !currentIsWarranty && targetIsWarranty
        ? jobData.id
        : currentIsWarranty && !targetIsWarranty
        ? targetJob.id
        : jobData.id;

    setLinking(true);
    setLinkError("");

    const currentUpdate = await updateJob(jobData.id, {
      warranty_linked_job_id: numericJobId,
      warranty_vhc_master_job_id: masterJobId,
    });
    if (!currentUpdate?.success) {
      setLinkError(currentUpdate?.error?.message || "Failed to update primary job.");
      setLinking(false);
      return;
    }

    const targetUpdate = await updateJob(numericJobId, {
      warranty_linked_job_id: jobData.id,
      warranty_vhc_master_job_id: masterJobId,
      status: jobData.status,
    });
    if (!targetUpdate?.success) {
      await updateJob(jobData.id, {
        warranty_linked_job_id: null,
        warranty_vhc_master_job_id: null,
      });
      setLinkError(targetUpdate?.error?.message || "Failed to update warranty job.");
      setLinking(false);
      return;
    }

    alert("✅ Warranty job card linked successfully.");
    setLinkMode(false);
    setSelectedJobId("");
    setAvailableJobs([]);
    setLinking(false);
    onLinkComplete();
  };

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-link"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
    >
      <div>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
          Warranty Job Card
        </h3>
        <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--text-1)", opacity: 0.75 }}>
          No warranty job card is linked to this job yet. Link one to manage its claim,
          authorisations, and parts &amp; labour from here.
        </p>
      </div>

      {!canEdit && (
        <div className="app-status-message app-status-message--info">
          You do not have permission to link a warranty job on this job card.
        </div>
      )}

      {canEdit && !linkMode && (
        <div>
          <button
            type="button"
            className="app-btn app-btn--primary"
            onClick={() => setLinkMode(true)}
          >
            {isLinked ? "Change Linked Warranty Job" : "Link Warranty Job Card"}
          </button>
        </div>
      )}

      {canEdit && linkMode && (
        <LayerSurface
          sectionKey="jobcard-tab-warranty-link-form"
          parentKey="jobcard-tab-warranty-link"
          gap="12px"
        >
          <DropdownField
            label="Select Warranty Job"
            placeholder={loadingJobs ? "Loading warranty jobs..." : "Choose a warranty job number"}
            value={selectedJobId}
            onValueChange={(val) => setSelectedJobId(val)}
            disabled={loadingJobs || linking}
            options={availableJobs.map((job) => ({
              value: String(job.id),
              label: `${job.job_number} · ${job.vehicle_reg || "No Reg"} · ${
                job.vehicle_make_model || "Warranty Job"
              }`,
            }))}
          />
          {linkError && (
            <p style={{ margin: 0, fontSize: "12px", color: "var(--danger)" }}>{linkError}</p>
          )}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={handleLinkJob}
              disabled={linking || !selectedJobId}
            >
              {linking ? "Linking..." : "Link Job"}
            </button>
            <button
              type="button"
              className="app-btn app-btn--ghost"
              onClick={() => setLinkMode(false)}
              disabled={linking}
            >
              Cancel
            </button>
          </div>
        </LayerSurface>
      )}
    </LayerTheme>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   WarrantySummary — top summary strip for a linked claim. Section is a
   LayerTheme; the stat tiles inside flip back to LayerSurface (depth 2).
   ════════════════════════════════════════════════════════════════════════ */
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

function WarrantySummary({
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

/* ════════════════════════════════════════════════════════════════════════
   WarrantyTimeline — created → auth requested → authorised → work completed →
   claim submitted → claim paid. Each stage is driven by a real timestamp on the
   warranty_claims row. Section is a LayerTheme; the stepper rail is plain layout.
   ════════════════════════════════════════════════════════════════════════ */
const formatTimelineStamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function WarrantyTimeline({
  claim,
  canEdit = false,
  busy = false,
  onUpdateClaim = () => {},
  style,
}) {
  // Stage config — `field` is the warranty_claims column; `markable` stages get a
  // button to stamp them once their predecessor is complete.
  const stages = [
    { key: "created", label: "Created", field: "created_at", markable: false },
    {
      key: "requested",
      label: "Authorisation Requested",
      field: "authorisation_requested_at",
      markable: false,
    },
    { key: "authorised", label: "Authorised", field: "authorised_at", markable: false },
    {
      key: "work_completed",
      label: "Work Completed",
      field: "work_completed_at",
      markable: true,
    },
    {
      key: "claim_submitted",
      label: "Claim Submitted",
      field: "claim_submitted_at",
      markable: true,
    },
    { key: "claim_paid", label: "Claim Paid", field: "claim_paid_at", markable: true },
  ];

  const resolved = stages.map((stage) => ({
    ...stage,
    stamp: claim?.[stage.field] || null,
    done: Boolean(claim?.[stage.field]),
  }));
  // The first not-done stage is "current".
  const currentIndex = resolved.findIndex((stage) => !stage.done);

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-timeline"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
      style={style}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Warranty Timeline
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {resolved.map((stage, index) => {
          const isCurrent = index === currentIndex;
          const isLast = index === resolved.length - 1;
          const dotColor = stage.done
            ? "var(--success)"
            : isCurrent
            ? "var(--accent-strong)"
            : "var(--grey-accent-light)";
          // Mark-done is offered for markable stages once the previous stage is done.
          const prevDone = index === 0 || resolved[index - 1].done;
          const canMark = canEdit && stage.markable && !stage.done && prevDone;

          return (
            <div key={stage.key} style={{ display: "flex", gap: "12px", minHeight: "52px" }}>
              {/* Dot + connector rail (background-coloured, not a border). */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "var(--radius-pill)",
                    background: dotColor,
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                />
                {!isLast && (
                  <span
                    style={{
                      width: "2px",
                      flex: 1,
                      minHeight: "20px",
                      background: stage.done ? "var(--success)" : "var(--grey-accent-light)",
                    }}
                  />
                )}
              </div>

              {/* Label + timestamp / action */}
              <div style={{ paddingBottom: "16px", flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: isCurrent || stage.done ? 700 : 500,
                    color: stage.done || isCurrent ? "var(--text-1)" : "var(--text-1)",
                    opacity: stage.done || isCurrent ? 1 : 0.6,
                  }}
                >
                  {stage.label}
                </div>
                {stage.stamp ? (
                  <div style={{ fontSize: "12px", color: "var(--text-1)", opacity: 0.7 }}>
                    {formatTimelineStamp(stage.stamp)}
                  </div>
                ) : canMark ? (
                  <button
                    type="button"
                    className="app-btn app-btn--ghost"
                    onClick={() =>
                      onUpdateClaim({ [stage.field]: new Date().toISOString() })
                    }
                    disabled={busy}
                    style={{ marginTop: "4px" }}
                  >
                    Mark done
                  </button>
                ) : (
                  <div style={{ fontSize: "12px", color: "var(--text-1)", opacity: 0.5 }}>
                    Pending
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </LayerTheme>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   WarrantyRequestsTable — table of warranty_requests rows plus an inline
   add-request form. Section is a LayerTheme; the add-request form flips to
   LayerSurface.
   ════════════════════════════════════════════════════════════════════════ */
const TYPE_OPTIONS = [
  { value: "authorisation", label: "Authorisation" },
  { value: "parts", label: "Parts" },
  { value: "labour", label: "Labour" },
  { value: "goodwill", label: "Goodwill" },
];

const STATUS_TONE = {
  pending: "app-badge--warning",
  approved: "app-badge--success",
  rejected: "app-badge--danger",
};

const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

const formatRequestDate = (value) => {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const requesterName = (request) => {
  const user = request?.requestedByUser;
  if (!user) return DASH;
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || DASH;
};

function WarrantyRequestsTable({
  requests = [],
  canEdit = false,
  busy = false,
  onAddRequest = () => {},
  onUpdateRequest = () => {},
  style,
}) {
  const [adding, setAdding] = useState(false);
  const [draftType, setDraftType] = useState("authorisation");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftNote, setDraftNote] = useState("");

  const resetDraft = () => {
    setDraftType("authorisation");
    setDraftAmount("");
    setDraftNote("");
    setAdding(false);
  };

  const handleAdd = () => {
    onAddRequest({
      requestType: draftType,
      amount: Number(draftAmount) || 0,
      note: draftNote,
    });
    resetDraft();
  };

  const sorted = [...requests].sort(
    (a, b) => new Date(b.request_date || 0) - new Date(a.request_date || 0)
  );

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-requests"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
      style={style}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
          Warranty Requests / Authorisation
        </h3>
        {canEdit && !adding && (
          <button type="button" className="app-btn app-btn--primary" onClick={() => setAdding(true)}>
            Add Request
          </button>
        )}
      </div>

      {canEdit && adding && (
        <LayerSurface
          sectionKey="jobcard-tab-warranty-requests-form"
          parentKey="jobcard-tab-warranty-requests"
          gap="12px"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <label>Type</label>
              <DropdownField
                value={draftType}
                onValueChange={setDraftType}
                options={TYPE_OPTIONS}
                disabled={busy}
              />
            </div>
            <div>
              <label>Amount (inc VAT)</label>
              <input
                className="app-input"
                type="number"
                min="0"
                step="0.01"
                value={draftAmount}
                onChange={(e) => setDraftAmount(e.target.value)}
                placeholder="0.00"
                disabled={busy}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Note (optional)</label>
              <input
                className="app-input"
                type="text"
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="Reason / reference"
                disabled={busy}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={handleAdd}
              disabled={busy}
            >
              {busy ? "Saving..." : "Save Request"}
            </button>
            <button
              type="button"
              className="app-btn app-btn--ghost"
              onClick={resetDraft}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </LayerSurface>
      )}

      {sorted.length === 0 ? (
        <div className="app-status-message app-status-message--info">
          No warranty requests have been raised yet.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="app-data-table app-data-table--rounded">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Requested By</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((request) => {
                const status = request.status || "pending";
                return (
                  <tr key={request.id}>
                    <td>{formatRequestDate(request.request_date)}</td>
                    <td>{TYPE_LABEL[request.request_type] || request.request_type || DASH}</td>
                    <td>
                      <span className={`app-badge ${STATUS_TONE[status] || "app-badge--neutral"}`}>
                        {status}
                      </span>
                    </td>
                    <td>{formatCurrency(Number(request.amount) || 0)}</td>
                    <td>{requesterName(request)}</td>
                    {canEdit && (
                      <td>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {status !== "approved" && (
                            <button
                              type="button"
                              className="app-table-action-btn app-table-action-btn--primary"
                              onClick={() => onUpdateRequest(request.id, { status: "approved" })}
                              disabled={busy}
                            >
                              Approve
                            </button>
                          )}
                          {status !== "rejected" && (
                            <button
                              type="button"
                              className="app-table-action-btn app-table-action-btn--danger"
                              onClick={() => onUpdateRequest(request.id, { status: "rejected" })}
                              disabled={busy}
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </LayerTheme>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   WarrantyPartsLabourSummary — labour/parts net + inc-VAT totals table beside a
   two-segment ring (labour green, parts red, total inc VAT centred). The ring is
   an SVG functional diagram primitive — its strokes are allowlisted (§3.0a).
   ════════════════════════════════════════════════════════════════════════ */
const RING_SIZE = 150;
const RING_STROKE = 16;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CENTER = RING_SIZE / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function WarrantyPartsLabourSummary({ totals, style }) {
  const labourGross = totals?.labour?.gross || 0;
  const labourNet = totals?.labour?.net || 0;
  const partsGross = totals?.parts?.gross || 0;
  const partsNet = totals?.parts?.net || 0;
  const totalGross = totals?.total?.gross || 0;
  const totalNet = totals?.total?.net || 0;

  // Ring segments — labour (green) then parts (red), accumulating arc offsets.
  const segments = [
    { key: "labour", label: "Labour", token: "var(--success)", value: labourGross },
    { key: "parts", label: "Parts", token: "var(--danger)", value: partsGross },
  ];
  const ringTotal = labourGross + partsGross;
  let accumulated = 0;
  const arcs =
    ringTotal > 0
      ? segments
          .filter((seg) => seg.value > 0)
          .map((seg) => {
            const dash = (seg.value / ringTotal) * RING_CIRCUMFERENCE;
            const arc = {
              key: seg.key,
              token: seg.token,
              dasharray: `${dash} ${RING_CIRCUMFERENCE - dash}`,
              dashoffset: -accumulated,
            };
            accumulated += dash;
            return arc;
          })
      : [];

  const rows = [
    { key: "labour", label: "Labour", net: labourNet, gross: labourGross },
    { key: "parts", label: "Parts", net: partsNet, gross: partsGross },
  ];

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-parts-labour"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
      style={style}
    >
      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
        Parts &amp; Labour Summary (Warranty)
      </h3>

      <LayerSurface
        sectionKey="jobcard-tab-warranty-parts-labour-body"
        parentKey="jobcard-tab-warranty-parts-labour"
        gap="20px"
        style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}
      >
        {/* Ring + centre total */}
        <div style={{ position: "relative", width: RING_SIZE, height: RING_SIZE, flexShrink: 0 }}>
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            role="img"
            aria-label={`Warranty total ${formatCurrency(totalGross)} inc VAT`}
          >
            <g transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}>
              <circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke="rgba(var(--grey-accent-rgb), 0.22)"
                strokeWidth={RING_STROKE}
              />
              {arcs.map((arc) => (
                <circle
                  key={arc.key}
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={arc.token}
                  strokeWidth={RING_STROKE}
                  strokeDasharray={arc.dasharray}
                  strokeDashoffset={arc.dashoffset}
                  strokeLinecap="butt"
                />
              ))}
            </g>
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-1)", lineHeight: 1 }}>
              {formatCurrency(totalGross)}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-1)",
                opacity: 0.6,
                marginTop: "2px",
              }}
            >
              total inc VAT
            </span>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: "1 1 280px", minWidth: 0, overflowX: "auto" }}>
          <table className="app-data-table app-data-table--rounded">
            <thead>
              <tr>
                <th>Type</th>
                <th>Total ex VAT</th>
                <th>Total inc VAT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "var(--radius-pill)",
                          background: row.key === "labour" ? "var(--success)" : "var(--danger)",
                          flexShrink: 0,
                        }}
                      />
                      {row.label}
                    </span>
                  </td>
                  <td>{formatCurrency(row.net)}</td>
                  <td>{formatCurrency(row.gross)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{formatCurrency(totalNet)}</td>
                <td style={{ fontWeight: 700 }}>{formatCurrency(totalGross)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LayerSurface>
    </LayerTheme>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   WarrantyLinkedJobSection — the warranty job's work-line descriptions plus a
   button that navigates to that job card. Section is a LayerTheme; the
   description list flips to LayerSurface (depth 2).
   ════════════════════════════════════════════════════════════════════════ */
function WarrantyLinkedJobSection({ jobData, linkedJob, style }) {
  const router = useRouter();
  const requests = jobData?.warrantyLinkedRequests || [];

  const handleView = () => {
    if (!linkedJob?.jobNumber) return;
    router.push(`/job-cards/${linkedJob.jobNumber}`);
  };

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-linked-job"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
      style={style}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
            Linked Warranty Job
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-1)", opacity: 0.7 }}>
            #{linkedJob?.jobNumber || "—"}
            {linkedJob?.status ? ` · ${linkedJob.status}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="app-btn app-btn--primary"
          onClick={handleView}
          disabled={!linkedJob?.jobNumber}
        >
          View Warranty Job
        </button>
      </div>

      <LayerSurface
        sectionKey="jobcard-tab-warranty-linked-job-lines"
        parentKey="jobcard-tab-warranty-linked-job"
        gap="8px"
      >
        {requests.length === 0 ? (
          <span style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.7 }}>
            No work lines recorded on the linked warranty job yet.
          </span>
        ) : (
          requests.map((request, index) => (
            <div
              key={request.request_id || index}
              style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--accentText)",
                  minWidth: "20px",
                }}
              >
                {index + 1}.
              </span>
              <span style={{ fontSize: "14px", color: "var(--text-1)", flex: 1, minWidth: 0 }}>
                {request.description || "Untitled work line"}
                {request.hours ? (
                  <span style={{ opacity: 0.6 }}> · {request.hours}h</span>
                ) : null}
              </span>
            </div>
          ))
        )}
      </LayerSurface>
    </LayerTheme>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   WarrantyNotesPanel — notes written to the LINKED warranty job's job_notes.
   Section is a LayerTheme; the composer and each note flip to LayerSurface.
   ════════════════════════════════════════════════════════════════════════ */
const formatNoteStamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const authorName = (note) => {
  const user = note?.user;
  if (!user) return "Staff";
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Staff";
};

function WarrantyNotesPanel({
  warrantyJobId,
  linkedJob,
  actingUserId = null,
  canEdit = false,
  alert = (msg) => window.alert(msg),
}) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!warrantyJobId) return;
    setLoading(true);
    try {
      const data = await getNotesByJob(warrantyJobId);
      setNotes(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [warrantyJobId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text || !warrantyJobId) return;
    setSaving(true);
    try {
      const res = await createJobNote({
        job_id: warrantyJobId,
        user_id: actingUserId,
        note_text: text,
      });
      if (!res?.success) {
        alert(res?.error?.message || "Failed to add warranty note.");
        return;
      }
      setDraft("");
      await loadNotes();
    } finally {
      setSaving(false);
    }
  };

  return (
    <LayerTheme
      sectionKey="jobcard-tab-warranty-notes"
      parentKey="jobcard-tab-warranty-panel"
      gap="14px"
    >
      <div>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-1)" }}>
          Warranty Notes
        </h3>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-1)", opacity: 0.7 }}>
          Notes are added to the linked warranty job (#{linkedJob?.jobNumber || "—"}).
        </p>
      </div>

      {canEdit && (
        <LayerSurface
          sectionKey="jobcard-tab-warranty-notes-composer"
          parentKey="jobcard-tab-warranty-notes"
          gap="10px"
        >
          <textarea
            className="app-input"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a warranty note…"
            disabled={saving}
            style={{ resize: "vertical" }}
          />
          <div>
            <button
              type="button"
              className="app-btn app-btn--primary"
              onClick={handleAdd}
              disabled={saving || !draft.trim()}
            >
              {saving ? "Adding…" : "Add Note"}
            </button>
          </div>
        </LayerSurface>
      )}

      {loading ? (
        <span style={{ fontSize: "13px", color: "var(--text-1)", opacity: 0.7 }}>
          Loading notes…
        </span>
      ) : notes.length === 0 ? (
        <div className="app-status-message app-status-message--info">
          No warranty notes yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {notes.map((note) => (
            <LayerSurface
              key={note.note_id}
              radius="var(--radius-sm)"
              padding="12px"
              gap="6px"
            >
              <span style={{ fontSize: "14px", color: "var(--text-1)", whiteSpace: "pre-wrap" }}>
                {note.note_text}
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-1)", opacity: 0.6 }}>
                {authorName(note)} · {formatNoteStamp(note.created_at)}
              </span>
            </LayerSurface>
          ))}
        </div>
      )}
    </LayerTheme>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   WarrantyTab — default export, the tab orchestrator.
   ════════════════════════════════════════════════════════════════════════ */
// Responsive 2-up row: two equal tracks side by side on wide screens, auto-
// collapsing to a single column once both 340px columns no longer fit.
const twoColRowStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
  gap: "var(--page-stack-gap)",
  alignItems: "stretch",
};
// Each paired card stretches to the full cell (equal heights) and may shrink
// below its content width so inner tables can scroll rather than overflow.
const twoColCardStyle = { height: "100%", minWidth: 0 };

export default function WarrantyTab({
  jobData,
  canEdit = false,
  actingUserId = null,
  onLinkComplete = () => {},
  onRefresh = () => {},
  alert = (msg) => window.alert(msg),
}) {
  const linkedJob = jobData?.linkedWarrantyJob || null;
  const isLinked = Boolean(jobData?.linkedWarrantyJobId);
  const claim = jobData?.warrantyClaim || null;
  const requests = jobData?.warrantyRequests || [];
  const totals = jobData?.warrantyTotals || null;
  // The job that owns the warranty claim (the warranty job, not the host).
  const warrantyJobId = jobData?.warrantyJobId || jobData?.linkedWarrantyJobId || null;

  const [busy, setBusy] = useState(false);

  // Ensure the claim row exists, then run an update against it. Centralises the
  // "create-on-first-edit" behaviour so every editor can assume a claim id.
  const withClaim = useCallback(
    async (run) => {
      if (!warrantyJobId) return;
      setBusy(true);
      try {
        let claimId = claim?.id;
        if (!claimId) {
          const created = await ensureWarrantyClaim(
            warrantyJobId,
            jobData?.id || null,
            actingUserId
          );
          if (!created?.success) {
            alert(created?.error?.message || "Failed to start warranty claim.");
            return;
          }
          claimId = created.data.id;
        }
        await run(claimId);
        onRefresh();
      } finally {
        setBusy(false);
      }
    },
    [warrantyJobId, claim?.id, jobData?.id, actingUserId, onRefresh, alert]
  );

  const handleUpdateClaim = useCallback(
    (patch) =>
      withClaim(async (claimId) => {
        const res = await updateWarrantyClaim(claimId, patch, actingUserId);
        if (!res?.success) alert(res?.error?.message || "Failed to update warranty claim.");
      }),
    [withClaim, actingUserId, alert]
  );

  const handleAddRequest = useCallback(
    ({ requestType, amount, note }) =>
      withClaim(async (claimId) => {
        const res = await createWarrantyRequest({
          claimId,
          warrantyJobId,
          requestType,
          amount,
          note,
          requestedBy: actingUserId,
        });
        if (!res?.success) alert(res?.error?.message || "Failed to add warranty request.");
      }),
    [withClaim, warrantyJobId, actingUserId, alert]
  );

  const handleUpdateRequest = useCallback(
    async (requestId, patch) => {
      setBusy(true);
      try {
        const res = await updateWarrantyRequest(requestId, patch);
        if (!res?.success) {
          alert(res?.error?.message || "Failed to update warranty request.");
          return;
        }
        onRefresh();
      } finally {
        setBusy(false);
      }
    },
    [onRefresh, alert]
  );

  return (
    <LayerSurface
      sectionKey="jobcard-tab-warranty-panel"
      sectionType="section-shell"
      parentKey="jobcard-tab-warranty"
      backgroundToken="surface"
      shell
      gap="var(--page-stack-gap)"
    >
      {!isLinked ? (
        <WarrantyLinkPanel
          jobData={jobData}
          canEdit={canEdit}
          onLinkComplete={onLinkComplete}
          alert={alert}
        />
      ) : (
        <>
          {/* Full-width header summary. */}
          <WarrantySummary
            linkedJob={linkedJob}
            claim={claim}
            totals={totals}
            canEdit={canEdit}
            busy={busy}
            onUpdateClaim={handleUpdateClaim}
          />

          {/* Two-up rows: collapse to a single column below ~700px (the grid's
              auto-fit minmax falls back to one track when both 340px columns no
              longer fit). The wrapper divs are plain layout — not surfaces — so
              the LayerSurface→LayerTheme alternation is unaffected. */}
          <div style={twoColRowStyle}>
            <WarrantyTimeline
              jobData={jobData}
              claim={claim}
              canEdit={canEdit}
              busy={busy}
              onUpdateClaim={handleUpdateClaim}
              style={twoColCardStyle}
            />
            <WarrantyRequestsTable
              requests={requests}
              canEdit={canEdit}
              busy={busy}
              onAddRequest={handleAddRequest}
              onUpdateRequest={handleUpdateRequest}
              style={twoColCardStyle}
            />
          </div>

          <div style={twoColRowStyle}>
            <WarrantyPartsLabourSummary totals={totals} style={twoColCardStyle} />
            <WarrantyLinkedJobSection
              jobData={jobData}
              linkedJob={linkedJob}
              style={twoColCardStyle}
            />
          </div>

          {/* Full-width notes. */}
          <WarrantyNotesPanel
            warrantyJobId={warrantyJobId}
            linkedJob={linkedJob}
            actingUserId={actingUserId}
            canEdit={canEdit}
            alert={alert}
          />
        </>
      )}
    </LayerSurface>
  );
}
