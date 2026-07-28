// file location: src/components/JobCards/TechnicianJobLayout.js
// Shared structural source for technician job-detail pages and their loading state.
// Keep shell sizing, spacing, section metadata and responsive grids here so the
// live page and skeleton cannot drift apart as the technician workflow evolves.

import LayerTheme from "@/components/ui/LayerTheme";

export const TECHNICIAN_JOB_TABS = [
  { id: "overview", label: "Overview" },
  { id: "vhc", label: "VHC" },
  { id: "write-up", label: "Write-Up" },
  { id: "parts", label: "Parts" },
  { id: "notes", label: "Notes" },
  { id: "documents", label: "Documents" },
];

export const TECHNICIAN_JOB_TAB_LABELS = Object.fromEntries(
  TECHNICIAN_JOB_TABS.map((tab) => [tab.id, tab.label])
);

export function TechnicianJobHeader({ children }) {
  return (
    <LayerTheme
      as="div"
      sectionKey="myjob-header"
      sectionType="section-header-row"
      parentKey="app-layout-page-card"
      radius="var(--radius-sm)"
      padding="20px"
      gap="12px"
      style={{
        flexDirection: "row",
        alignItems: "center",
        margin: 0,
        flexShrink: 0,
      }}
    >
      {children}
    </LayerTheme>
  );
}

export function TechnicianJobSummaryGrid({ children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
        gap: "10px",
        margin: 0,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

export function TechnicianJobSummaryCard({
  children,
  sectionKey,
  sectionType = "content-card",
  style,
  ...rest
}) {
  return (
    <LayerTheme
      sectionKey={sectionKey}
      sectionType={sectionType}
      parentKey="app-layout-page-card"
      radius="var(--radius-sm)"
      padding="12px 14px"
      style={style}
      {...rest}
    >
      {children}
    </LayerTheme>
  );
}

export function TechnicianJobTabRow({ children }) {
  return (
    <LayerTheme
      as="div"
      className="tab-scroll-row"
      sectionKey="myjob-tab-row"
      sectionType="tab-row"
      parentKey="app-layout-page-card"
      backgroundToken="theme"
      data-dev-text-preview="My job tab navigation"
      radius="var(--radius-sm)"
      padding="8px"
      gap="6px"
      style={{
        flexDirection: "row",
        flexWrap: "nowrap",
        alignItems: "center",
        justifyContent: "flex-start",
        overflowX: "auto",
        overflowY: "hidden",
        flex: "0 0 auto",
        margin: 0,
      }}
    >
      {children}
    </LayerTheme>
  );
}

export function TechnicianJobContentShell({ activeTab, children }) {
  return (
    <LayerTheme
      as="section"
      className="app-layout-section-shell"
      sectionKey="myjob-main-content"
      sectionType="section-shell"
      parentKey="app-layout-page-card"
      backgroundToken="theme"
      shell
      radius="var(--section-card-radius)"
      padding="var(--section-card-padding)"
      gap="var(--space-4)"
      data-dev-page="My job detail"
      data-dev-tab={activeTab}
      data-dev-card-section="tab content shell"
      data-dev-text-preview={`Tab content shell: ${activeTab}`}
      data-dev-active-tab={activeTab}
      data-dev-active-tab-label={activeTab}
      style={{
        flex: 1,
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {children}
    </LayerTheme>
  );
}
