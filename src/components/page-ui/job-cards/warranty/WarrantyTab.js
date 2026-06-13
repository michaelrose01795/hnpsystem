// file location: src/components/page-ui/job-cards/warranty/WarrantyTab.js
// Warranty tab orchestrator. Renders the restyled link flow when no warranty job
// is linked, and the full warranty-claim workspace (summary, timeline, requests,
// parts & labour summary, linked-job, notes) when one is. All claim/request
// mutations route through src/lib/database/warranty.js; warranty data itself is
// loaded server-side in the job-card API route and arrives on jobData.warranty*.
//
// Layer alternation (CLAUDE.md §3.0): this tab root is the <LayerSurface> shell,
// so every direct child section below is a <LayerTheme> (depth 1), and any strip
// nested inside a section flips back to <LayerSurface> (depth 2).
import React, { useCallback, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import {
  ensureWarrantyClaim,
  updateWarrantyClaim,
  createWarrantyRequest,
  updateWarrantyRequest,
} from "@/lib/database/warranty";
import WarrantyLinkPanel from "./WarrantyLinkPanel";
import WarrantySummary from "./WarrantySummary";
import WarrantyTimeline from "./WarrantyTimeline";
import WarrantyRequestsTable from "./WarrantyRequestsTable";
import WarrantyPartsLabourSummary from "./WarrantyPartsLabourSummary";
import WarrantyLinkedJobSection from "./WarrantyLinkedJobSection";
import WarrantyNotesPanel from "./WarrantyNotesPanel";

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
