// file location: src/pages/dev/readiness.js
//
// Phase 10 — Developer Platform "Deployment Readiness" gate. Renders the
// server-aggregated per-release readiness scoring (/api/support/platform?view=
// readiness): each release gets a 0–100 score, a grade (ready / caution /
// blocked), a recommendation, the signal roll-up, blockers + warnings, and any
// existing approval record. Reviewers can Approve or Block a release, which POSTs
// to /api/support/releases/approvals; approving a 'blocked' release is an
// explicit override and is called out as such. Strictly gated to `dev`.
// CLAUDE.md compliant.

import React from "react";
import Head from "next/head";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { withDevPlatformLayout } from "@/components/dev-platform/DevPlatformLayout";
import usePlatformResource, { postJson } from "@/components/dev-platform/usePlatformResource";
import { useAlerts } from "@/context/AlertContext";
import {
  Panel,
  SubSurface,
  StatCard,
  Pill,
  KeyValue,
  KeyValueGrid,
  EmptyState,
  LoadingBlock,
  DevButton,
} from "@/components/support/dev/supportDevUi";

const ALLOWED = DEV_PLATFORM_ROLES.map((r) => r.toUpperCase());

// Grade → tone token (per the brief).
const gradeTone = (grade) =>
  grade === "ready" ? "success-base" : grade === "caution" ? "warning-base" : "danger-base";

const recommendationTone = (rec) =>
  rec === "approve" ? "success-base" : rec === "review" ? "warning-base" : "danger-base";

const approvalTone = (status) =>
  status === "approved" ? "success-base" : status === "blocked" ? "danger-base" : "text-1";

function ReleaseCard({ release, onDecision }) {
  const { releaseKey, appVersion, commitSha, lastActivity, readiness, approval } = release;
  const r = readiness || {};
  const signals = r.signals || {};
  const blockers = r.blockers || [];
  const warnings = r.warnings || [];
  const isBlocked = r.grade === "blocked";

  return (
    <Panel
      title={appVersion || releaseKey || "Untitled release"}
      subtitle={
        [
          commitSha ? commitSha.slice(0, 8) : null,
          lastActivity ? `last activity ${new Date(lastActivity).toLocaleString("en-GB")}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No release metadata"
      }
      actions={
        <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
          <DevButton
            variant="solid"
            tone="success-base"
            onClick={() => onDecision(release, "approved")}
            title={isBlocked ? "Override: approve a blocked release" : "Approve this release"}
          >
            {isBlocked ? "Approve (override)" : "Approve"}
          </DevButton>
          <DevButton
            variant="solid"
            tone="danger-base"
            onClick={() => onDecision(release, "blocked")}
            title="Block this release"
          >
            Block
          </DevButton>
        </div>
      }
    >
      {/* Score + grade + recommendation */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-sm)" }}>
        <StatCard label="Readiness score" value={`${Math.round(r.score ?? 0)}/100`} tone={gradeTone(r.grade)} />
        <StatCard label="Open critical" value={signals.openCritical ?? 0} tone="danger-base" />
        <StatCard label="Open high" value={signals.openHigh ?? 0} tone="warning-base" />
        <StatCard label="Regressions" value={signals.regressions ?? 0} tone="danger-base" />
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
        {r.grade && <Pill label={`Grade: ${r.grade}`} tone={gradeTone(r.grade)} strong />}
        {r.recommendation && <Pill label={`Recommendation: ${r.recommendation}`} tone={recommendationTone(r.recommendation)} strong />}
      </div>

      {/* Signals */}
      <SubSurface>
        <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>Signals</div>
        <KeyValueGrid>
          <KeyValue label="Total signals" value={signals.total ?? 0} />
          <KeyValue label="Open" value={signals.open ?? 0} />
          <KeyValue label="Open critical" value={signals.openCritical ?? 0} tone={signals.openCritical ? "danger-base" : undefined} />
          <KeyValue label="Open high" value={signals.openHigh ?? 0} tone={signals.openHigh ? "warning-base" : undefined} />
          <KeyValue label="Regressions" value={signals.regressions ?? 0} tone={signals.regressions ? "danger-base" : undefined} />
          <KeyValue label="Drift" value={signals.drift ?? 0} tone={signals.drift ? "warning-base" : undefined} />
        </KeyValueGrid>
      </SubSurface>

      {/* Blockers */}
      {blockers.length > 0 && (
        <SubSurface style={{ gap: "6px" }}>
          <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--danger-base)" }}>
            Blockers ({blockers.length})
          </div>
          {blockers.map((b, i) => (
            <div
              key={`${b.type}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-sm)",
                flexWrap: "wrap",
                padding: "6px 10px",
                borderRadius: "var(--radius-sm, 6px)",
                // Non-surface tinted row (Border Law: background tint, not a border).
                background: "color-mix(in srgb, var(--danger-base) 12%, transparent)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 }}>
                <Pill label={b.type} tone="danger-base" strong />
                <span style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", wordBreak: "break-word" }}>{b.detail}</span>
              </span>
              {b.weight != null && <Pill label={`weight ${b.weight}`} tone="danger-base" />}
            </div>
          ))}
        </SubSurface>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <SubSurface style={{ gap: "6px" }}>
          <div style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--warning-base)" }}>
            Warnings ({warnings.length})
          </div>
          {warnings.map((w, i) => (
            <div
              key={i}
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--text-1)",
                padding: "6px 10px",
                borderRadius: "var(--radius-sm, 6px)",
                wordBreak: "break-word",
                // Non-surface tinted row (Border Law: background tint, not a border).
                background: "color-mix(in srgb, var(--warning-base) 12%, transparent)",
              }}
            >
              {w}
            </div>
          ))}
        </SubSurface>
      )}

      {/* Current approval status */}
      {approval ? (
        <SubSurface>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: "var(--text-body-sm)", color: "var(--accentText)" }}>Approval</span>
            <Pill label={approval.status} tone={approvalTone(approval.status)} strong />
          </div>
          <KeyValueGrid>
            <KeyValue label="Approver" value={approval.approverKey} />
            <KeyValue label="Recorded score" value={approval.score != null ? `${Math.round(approval.score)}/100` : null} />
            <KeyValue label="Notes" value={approval.notes} />
            <KeyValue
              label="Updated"
              value={approval.updatedAt ? new Date(approval.updatedAt).toLocaleString("en-GB") : null}
            />
          </KeyValueGrid>
        </SubSurface>
      ) : (
        <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.7 }}>
          No approval decision recorded yet.
        </div>
      )}
    </Panel>
  );
}

function ReadinessView() {
  const { data, loading, error, reload } = usePlatformResource("/api/support/platform?view=readiness");
  const { pushAlert } = useAlerts();

  const onDecision = async (release, status) => {
    const r = release.readiness || {};
    const isOverride = r.grade === "blocked";

    if (status === "approved" && isOverride) {
      // Explicit override confirmation for approving a blocked release.
      const proceed =
        typeof window === "undefined"
          ? true
          : window.confirm(
              `This release is graded “blocked”. Approving it is an explicit override of the readiness gate. Continue?`,
            );
      if (!proceed) return;
    }

    const res = await postJson("/api/support/releases/approvals", {
      releaseKey: release.releaseKey,
      appVersion: release.appVersion,
      commitSha: release.commitSha,
      status,
      readinessScore: r.score,
      override: isOverride,
    });

    if (res.ok) {
      pushAlert(
        status === "approved"
          ? isOverride
            ? "Release approved (readiness gate overridden)."
            : "Release approved."
          : "Release blocked.",
        "success",
      );
      reload();
    } else {
      pushAlert(res.error || "Could not record the decision.", "error");
    }
  };

  if (loading) {
    return (
      <Panel title="Deployment readiness" subtitle="Scoring releases…">
        <LoadingBlock rows={4} />
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel title="Deployment readiness" actions={<DevButton small onClick={reload}>⟳ Retry</DevButton>}>
        <EmptyState icon="⚠️" title="Could not load readiness" message={error} />
      </Panel>
    );
  }

  const releases = data?.readiness || [];

  return (
    <>
      <Panel
        title="Deployment readiness"
        subtitle={`${data?.reportCount ?? 0} report(s) analysed across ${releases.length} release(s)`}
        actions={<DevButton small onClick={reload}>⟳ Refresh</DevButton>}
      />

      {releases.length === 0 ? (
        <Panel>
          <EmptyState
            icon="🚦"
            title="No releases to assess"
            message="Readiness scoring populates once deployments with captured reports exist."
          />
        </Panel>
      ) : (
        releases.map((release) => (
          <ReleaseCard key={release.releaseKey || release.appVersion} release={release} onDecision={onDecision} />
        ))
      )}
    </>
  );
}

export default function DevReadinessPage() {
  return (
    <ProtectedRoute allowedRoles={ALLOWED}>
      <Head>
        <title>Deployment Readiness — Developer Platform</title>
      </Head>
      <ReadinessView />
    </ProtectedRoute>
  );
}

DevReadinessPage.getLayout = withDevPlatformLayout({ activeKey: "readiness" });
