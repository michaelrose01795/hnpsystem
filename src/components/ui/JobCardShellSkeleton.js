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
import LayerTheme from "@/components/ui/LayerTheme";
import {
  TECHNICIAN_JOB_TABS,
  TechnicianJobContentShell,
  TechnicianJobHeader,
  TechnicianJobSummaryCard,
  TechnicianJobSummaryGrid,
  TechnicianJobTabRow,
} from "@/components/JobCards/TechnicianJobLayout";

// ─── Shared token references (match the actual pages) ──────────────────────
const radius = "var(--radius-sm)";

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
      role="status"
      aria-live="polite"
      aria-label={`Loading job card ${jobNumber || ""}`.trim()}
      data-dev-section="1"
      data-dev-section-key="jobcard-page-shell"
      data-dev-section-type="page-shell"
      data-dev-shell="1"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <SkeletonKeyframes />

      {/* Header mirrors the live single-row title, status and action layout. */}
      <LayerTheme
        as="section"
        sectionKey="jobcard-header"
        sectionType="section-header-row"
        parentKey="jobcard-page-shell"
        radius={radius}
        padding="20px"
        gap="12px"
        style={{ flexShrink: 0, margin: 0 }}
      >
        {/* Title, status badges and actions */}
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
            <SkeletonBadge width="82px" />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <SkeletonButton width="88px" />
            <SkeletonButton width="104px" />
          </div>
        </div>

      </LayerTheme>

      {/* Vehicle & Customer Info Bar — the summary-shell wrapper has been removed;
          the four content cards now sit directly inside the page shell (transparent
          grid, no padding) so they span edge to edge. */}
      <section
        data-dev-section="1"
        data-dev-section-key="jobcard-summary-row"
        data-dev-section-type="section-shell"
        data-dev-section-parent="jobcard-page-shell"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <LayerTheme
          sectionKey="jobcard-summary-vehicle"
          sectionType="content-card"
          parentKey="jobcard-page-shell"
          radius={radius}
          padding="12px 14px"
          gap="6px"
          style={{ minWidth: 0, minHeight: "68px", justifyContent: "center" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <SkeletonBlock width="44%" height="17px" borderRadius="5px" />
            <SkeletonBlock width="86px" height="30px" borderRadius="var(--input-radius)" />
          </div>
          <SkeletonBlock width="68%" height="12px" borderRadius="4px" />
        </LayerTheme>

        <LayerTheme
          sectionKey="jobcard-summary-customer"
          sectionType="content-card"
          parentKey="jobcard-page-shell"
          radius={radius}
          padding="12px 14px"
          gap="6px"
          style={{ minWidth: 0, minHeight: "68px", justifyContent: "center" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
              <SkeletonBlock width="58%" height="17px" borderRadius="5px" />
              <SkeletonBlock width="76%" height="12px" borderRadius="4px" />
            </div>
            <SkeletonBadge width="72px" />
          </div>
        </LayerTheme>

        {[
          { key: "jobcard-summary-vhc-financials", left: "52%", right: "62%" },
          { key: "jobcard-summary-locations", left: "68%", right: "74%" },
        ].map((card) => (
          <LayerTheme
            key={card.key}
            sectionKey={card.key}
            sectionType={card.key.includes("financials") ? "stat-card" : "content-card"}
            parentKey="jobcard-page-shell"
            radius={radius}
            padding="12px 14px"
            gap="10px"
            style={{
              minWidth: 0,
              minHeight: "68px",
              flexDirection: "row",
              alignItems: "stretch",
            }}
          >
            {[card.left, card.right].map((lineWidth, index) => (
              <div
                key={lineWidth}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: index === 0 ? "flex-start" : "flex-end",
                  gap: "6px",
                }}
              >
                <SkeletonBlock width="54%" height="11px" borderRadius="4px" />
                <SkeletonBlock width={lineWidth} height="20px" borderRadius="5px" />
              </div>
            ))}
          </LayerTheme>
        ))}
      </section>

      {/* Tab bar — annotated as tab-row so the strip shows as its own fingerprint block */}
      <LayerTheme
        sectionKey="jobcard-tab-row"
        sectionType="tab-row"
        parentKey="jobcard-page-shell"
        radius={radius}
        padding="8px"
        gap="6px"
        style={{
          flexDirection: "row",
          flexWrap: "nowrap",
          overflowX: "hidden",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        {DEFAULT_TABS.map((label) => (
          <SkeletonBlock
            key={label}
            width={`${label.length * 8 + 24}px`}
            height="35px"
            borderRadius="var(--control-radius)"
          />
        ))}
      </LayerTheme>

      {/* Default Customer Requests tab: metrics above its responsive split workspace. */}
      <LayerTheme
        as="section"
        sectionKey="jobcard-tab-content-shell"
        sectionType="section-shell"
        parentKey="jobcard-page-shell"
        shell
        radius="var(--section-card-radius)"
        padding="var(--section-card-padding)"
        gap="var(--space-4)"
        style={{
          flexShrink: 0,
          minHeight: "360px",
        }}
      >
        <div style={{ display: "flex", alignItems: "stretch", gap: "8px", flexWrap: "wrap" }}>
          <div
            style={{
              flex: "1 1 720px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "8px",
            }}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={index} width="100%" height="44px" borderRadius={radius} />
            ))}
          </div>
          <SkeletonButton width="112px" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: "16px",
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <SkeletonBlock width="100%" height="36px" borderRadius={radius} />
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} width="100%" height="46px" borderRadius={radius} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <SkeletonBlock width="38%" height="18px" borderRadius="5px" />
              <SkeletonBadge width="86px" />
            </div>
            <SkeletonBlock width="66%" height="13px" borderRadius="4px" />
            <SkeletonBlock width="100%" height="62px" borderRadius={radius} />
            <SkeletonBlock width="100%" height="62px" borderRadius={radius} />
            <SkeletonBlock width="46%" height="22px" borderRadius="5px" />
          </div>
        </div>
      </LayerTheme>
    </div>
  );
}

// ─── Tech "My Jobs" job card shell skeleton ─────────────────────────────────
// Mirrors src/pages/job-cards/myjobs/[jobNumber].js.
// Same data-dev-section strategy: leaf sections are individually annotated so the
// fingerprint has real structural blocks (header, 4 summary cards, tab row, content).

export function MyJobCardShellSkeleton({ jobNumber }) {
  return (
    <>
      <SkeletonKeyframes />

      {/* Header */}
      <TechnicianJobHeader>
        {/* Job number — sits directly inside header, no nested card */}
        <h1
          style={{
            color: "var(--text-1)",
            fontSize: "28px",
            fontWeight: "700",
            margin: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {jobNumber}
        </h1>

        <SkeletonBlock width="150px" height="12px" borderRadius="5px" />

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
            <SkeletonButton width="144px" />
          </div>
        </div>
      </TechnicianJobHeader>

      {/* Quick stats — layout-only grid with cards matching the live page keys */}
      <TechnicianJobSummaryGrid>
        {[
          { key: "myjob-summary-vehicle", primary: "58%", secondary: "76%" },
          { key: "myjob-summary-customer", primary: "72%", secondary: "62%" },
          { key: "myjob-quick-stat-clocked-hours", primary: "54%", secondary: "68%", stat: true },
          { key: "myjob-summary-locations", primary: "82%", secondary: "82%" },
        ].map((card) => (
          <TechnicianJobSummaryCard
            key={card.key}
            sectionKey={card.key}
            sectionType={card.stat ? "stat-card" : "content-card"}
            data-dev-text-preview={`Loading ${card.key}`}
            style={{
              justifyContent: "center",
              minWidth: 0,
              minHeight: "68px",
              overflow: "hidden",
            }}
          >
            <SkeletonBlock width={card.primary} height={card.stat ? "24px" : "17px"} borderRadius="5px" />
            <SkeletonBlock width={card.secondary} height="12px" borderRadius="4px" />
          </TechnicianJobSummaryCard>
        ))}
      </TechnicianJobSummaryGrid>

      {/* Tab row */}
      <TechnicianJobTabRow>
        {TECHNICIAN_JOB_TABS.map((tab) => (
          <SkeletonBlock
            key={tab.id}
            width={`${tab.label.length * 8 + 24}px`}
            height="35px"
            borderRadius="var(--control-radius)"
          />
        ))}
      </TechnicianJobTabRow>

      {/* Tab content — wraps in myjob-main-content shell to match the live page's theme background */}
      <TechnicianJobContentShell activeTab="overview">
        <div
          data-dev-section="1"
          data-dev-section-key="myjob-main-scroll"
          data-dev-section-type="section-shell"
          data-dev-section-parent="myjob-main-content"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "var(--page-stack-gap)",
            overflowY: "auto",
            minHeight: 0,
          }}
        >
          <SkeletonBlock width="100%" height="112px" borderRadius="var(--section-card-radius)" />
          <SkeletonBlock width="100%" height="72px" borderRadius="var(--section-card-radius)" />
          <SkeletonBlock width="72%" height="14px" borderRadius="5px" />
          <SkeletonBlock width="56%" height="14px" borderRadius="5px" />
        </div>
      </TechnicianJobContentShell>
    </>
  );
}
