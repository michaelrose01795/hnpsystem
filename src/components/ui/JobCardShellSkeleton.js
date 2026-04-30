// file location: src/components/ui/JobCardShellSkeleton.js
// Shell-first loading skeletons for the job card pages.
// These render immediately using only the job number from the URL — no data required —
// so the full page frame is visible while data fetches in the background.
//
// data-dev-section annotations mirror the real page's section keys and types so
// captureLayoutFingerprint produces meaningful block coordinates instead of one giant
// rectangle. Without these, the fingerprint falls back to the entire app-page-stack
// child and the Layout overlay renders a single grey slab on the next visit.

import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";

// ─── Shared token references (match the actual pages) ──────────────────────
const shellBg = "var(--tab-container-bg)";
const radius = "var(--radius-sm)";
const radiusXs = "var(--radius-xs)";

// ─── Small primitives ───────────────────────────────────────────────────────

function SkeletonBadge({ width = "72px" }) {
  return (
    <SkeletonBlock
      width={width}
      height="30px"
      borderRadius="var(--control-radius-xs)"
    />
  );
}

function SkeletonButton({ width = "100px" }) {
  return (
    <SkeletonBlock
      width={width}
      height="var(--control-height, 36px)"
      borderRadius="var(--control-radius)"
    />
  );
}

// ─── Main job card page shell skeleton ─────────────────────────────────────
// Mirrors src/pages/job-cards/[jobNumber].js structure.
// Section keys/types match the real page so fingerprint blocks land at the
// same positions as the live sections — overlay shimmer and shell skeleton
// stay visually consistent.

const DEFAULT_TABS = [
  "Customer Requests",
  "Contact",
  "Scheduling",
  "Service History",
  "Notes",
  "Parts",
  "Write Up",
  "VHC",
  "Warranty",
  "Clocking",
  "Messages",
  "Documents",
  "Invoice",
];

export function JobCardPageShellSkeleton({ jobNumber }) {
  return (
    <div
      data-dev-section="1"
      data-dev-section-key="jobcard-page-shell"
      data-dev-section-type="page-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <SkeletonKeyframes />

      {/* Header section — annotated so fingerprint captures it as a named block */}
      <section
        data-dev-section="1"
        data-dev-section-key="jobcard-header"
        data-dev-section-type="section-header-row"
        data-dev-section-parent="jobcard-page-shell"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "20px",
          backgroundColor: shellBg,
          borderRadius: radius,
          flexShrink: 0,
        }}
      >
        {/* Row 1: title + badges + action buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                margin: 0,
                color: "var(--primary)",
                fontSize: "28px",
                fontWeight: "700",
              }}
            >
              Job Card #{jobNumber}
            </h1>
            <SkeletonBadge width="68px" />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <SkeletonButton width="88px" />
            <SkeletonButton width="104px" />
            <SkeletonButton width="80px" />
          </div>
        </div>

        {/* Row 2: timestamps */}
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <SkeletonBlock width="180px" height="14px" borderRadius="5px" />
          <SkeletonBlock width="150px" height="14px" borderRadius="5px" />
        </div>
      </section>

      {/* Workflow assistant card — own annotation so fingerprint shows a mid-card strip */}
      <div
        data-dev-section="1"
        data-dev-section-key="jobcard-workflow"
        data-dev-section-type="content-card"
        data-dev-section-parent="jobcard-page-shell"
        style={{ borderRadius: radius }}
      >
        <SkeletonBlock width="100%" height="54px" borderRadius={radius} />
      </div>

      {/* Vehicle & Customer Info Bar — section-shell (filtered by fingerprint) wraps four
          individually annotated content-card divs so each card appears as its own block */}
      <section
        data-dev-section="1"
        data-dev-section-key="jobcard-summary-shell"
        data-dev-section-type="section-shell"
        data-dev-section-parent="jobcard-page-shell"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
          gap: "10px",
          flexShrink: 0,
          backgroundColor: shellBg,
          borderRadius: radius,
          padding: "8px",
        }}
      >
        {[130, 130, 130, 130].map((h, i) => (
          <div
            key={i}
            data-dev-section="1"
            data-dev-section-key={`jobcard-info-card-${i}`}
            data-dev-section-type="content-card"
            data-dev-section-parent="jobcard-summary-shell"
            style={{ borderRadius: radiusXs, height: `${h}px` }}
          >
            <SkeletonBlock width="100%" height="100%" borderRadius={radiusXs} />
          </div>
        ))}
      </section>

      {/* Tab bar — annotated as tab-row so the strip shows as its own fingerprint block */}
      <div
        data-dev-section="1"
        data-dev-section-key="jobcard-tab-row"
        data-dev-section-type="tab-row"
        data-dev-section-parent="jobcard-page-shell"
        style={{
          display: "flex",
          gap: "6px",
          flexWrap: "nowrap",
          overflowX: "hidden",
          backgroundColor: shellBg,
          borderRadius: radius,
          padding: "8px",
          flexShrink: 0,
        }}
      >
        {DEFAULT_TABS.map((label) => (
          <SkeletonBlock
            key={label}
            width={`${label.length * 8 + 24}px`}
            height="34px"
            borderRadius="var(--control-radius)"
          />
        ))}
      </div>

      {/* Tab content — annotated content-card so fingerprint has the large bottom block */}
      <div
        data-dev-section="1"
        data-dev-section-key="jobcard-tab-content"
        data-dev-section-type="content-card"
        data-dev-section-parent="jobcard-page-shell"
        style={{
          backgroundColor: shellBg,
          borderRadius: radius,
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          flexShrink: 0,
          minHeight: "320px",
        }}
      >
        <SkeletonBlock width="35%" height="16px" borderRadius="5px" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          <SkeletonBlock width="100%" height="90px" borderRadius={radiusXs} />
          <SkeletonBlock width="100%" height="90px" borderRadius={radiusXs} />
          <SkeletonBlock width="100%" height="90px" borderRadius={radiusXs} />
        </div>
        <SkeletonBlock width="100%" height="48px" borderRadius={radiusXs} />
        <SkeletonBlock width="75%" height="14px" borderRadius="5px" />
        <SkeletonBlock width="60%" height="14px" borderRadius="5px" />
      </div>
    </div>
  );
}

// ─── Tech "My Jobs" job card shell skeleton ─────────────────────────────────
// Mirrors src/pages/job-cards/myjobs/[jobNumber].js.
// Same data-dev-section strategy: leaf sections are individually annotated so the
// fingerprint has real structural blocks (header, 3 stat cards, tab row, content).

const MYJOB_TABS = ["Overview", "VHC", "Parts", "Notes", "Write-Up", "Documents"];

export function MyJobCardShellSkeleton({ jobNumber }) {
  return (
    <div
      data-dev-section="1"
      data-dev-section-key="myjob-page-shell"
      data-dev-section-type="page-shell"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "8px 16px",
        overflowY: "auto",
        gap: "12px",
      }}
    >
      <SkeletonKeyframes />

      {/* Header */}
      <div
        data-dev-section="1"
        data-dev-section-key="myjob-header"
        data-dev-section-type="section-header-row"
        data-dev-section-parent="myjob-page-shell"
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginBottom: "12px",
          padding: "12px",
          backgroundColor: "var(--theme)",
          borderRadius: radiusXs,
          flexShrink: 0,
        }}
      >
        {/* Job number — sits directly inside header, no nested card */}
        <h1
          style={{
            color: "var(--primary)",
            fontSize: "28px",
            fontWeight: "700",
            margin: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {jobNumber}
        </h1>

        <SkeletonBlock width="170px" height="14px" borderRadius="5px" />

        {/* Right side: status + buttons — sit directly inside header, no nested cards */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <SkeletonBadge width="100px" />
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <SkeletonButton width="96px" />
            <SkeletonButton width="112px" />
          </div>
        </div>
      </div>

      {/* Quick stats — section-shell (filtered) with three individually annotated cards */}
      <div
        data-dev-section="1"
        data-dev-section-key="myjob-quick-stats"
        data-dev-section-type="section-shell"
        data-dev-section-parent="myjob-page-shell"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "12px",
          marginBottom: "12px",
          padding: "12px",
          backgroundColor: "var(--theme)",
          borderRadius: radiusXs,
          flexShrink: 0,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            data-dev-section="1"
            data-dev-section-key={`myjob-stat-${i}`}
            data-dev-section-type="content-card"
            data-dev-section-parent="myjob-quick-stats"
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: radiusXs,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "108px",
            }}
          >
            <SkeletonBlock width="60px" height="28px" borderRadius="var(--control-radius)" />
            <SkeletonBlock width="80px" height="12px" borderRadius="4px" />
          </div>
        ))}
      </div>

      {/* Tab row */}
      <div
        data-dev-section="1"
        data-dev-section-key="myjob-tab-row"
        data-dev-section-type="tab-row"
        data-dev-section-parent="myjob-page-shell"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
          overflowX: "hidden",
          flexShrink: 0,
        }}
      >
        {MYJOB_TABS.map((label) => (
          <SkeletonBlock
            key={label}
            width={`${label.length * 9 + 20}px`}
            height="34px"
            borderRadius="var(--control-radius)"
          />
        ))}
      </div>

      {/* Tab content — wraps in myjob-main-content shell to match the live page's theme background */}
      <div
        data-dev-section="1"
        data-dev-section-key="myjob-main-content"
        data-dev-section-type="section-shell"
        data-dev-section-parent="myjob-page-shell"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "12px",
          backgroundColor: "var(--theme)",
          borderRadius: radiusXs,
          minHeight: "240px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "12px",
          }}
        >
          <SkeletonBlock width="100%" height="110px" borderRadius={radiusXs} />
          <SkeletonBlock width="100%" height="110px" borderRadius={radiusXs} />
        </div>
        <SkeletonBlock width="100%" height="60px" borderRadius={radiusXs} />
        <SkeletonBlock width="65%" height="14px" borderRadius="5px" />
        <SkeletonBlock width="50%" height="14px" borderRadius="5px" />
      </div>
    </div>
  );
}
