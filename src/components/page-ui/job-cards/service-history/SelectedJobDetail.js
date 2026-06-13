// file location: src/components/page-ui/job-cards/service-history/SelectedJobDetail.js
// Detail panel for the job selected in the JobHistoryTree. Shows a header strip
// (date, mileage, status, advisor, technician, parts user), the requests / work
// carried out, and a parts tally (allocated / on order / back order / total).
//
// The presentational sub-pieces (JobFieldsGrid, WorkCarriedOutList,
// PartsTallyList) are layer-agnostic plain blocks so the Compare modal can reuse
// them inside its own <LayerTheme> columns. Layer alternation (CLAUDE.md §3.0):
// <LayerSurface> section → <LayerTheme> blocks.

import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import {
  DASH,
  formatMiles,
  formatNumber,
  formatText,
  statusBadgeClass,
} from "./historyFormat";

const eyebrowStyle = {
  margin: 0,
  fontSize: "0.7rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--accentText)",
  fontWeight: 700,
};

const fieldLabelStyle = {
  fontSize: "0.6rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(var(--text-1-rgb), 0.6)",
  fontWeight: 700,
};

const fieldValueStyle = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "var(--text-1)",
  wordBreak: "break-word",
};

const blockTitleStyle = {
  margin: 0,
  fontSize: "0.75rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-1)",
  fontWeight: 700,
};

// Header strip: appointment date, mileage, status, advisor, tech, parts user.
export function JobFieldsGrid({ job }) {
  const fields = [
    { label: "Date of Appointment", value: formatText(job.serviceDateFormatted) },
    { label: "Mileage", value: formatMiles(job.mileage) },
    { label: "Status", node: (
      <span className={`app-badge ${statusBadgeClass(job.status)}`}>{formatText(job.status)}</span>
    ) },
    { label: "Advisor", value: formatText(job.advisor) },
    { label: "Technician", value: formatText(job.technician) },
    { label: "Parts User", value: formatText(job.partsUser) },
  ];
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-3)",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
      }}
    >
      {fields.map((field) => (
        <div key={field.label} style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
          <span style={fieldLabelStyle}>{field.label}</span>
          {field.node || <span style={fieldValueStyle}>{field.value}</span>}
        </div>
      ))}
    </div>
  );
}

// Requests / work carried out on the job, one per row.
export function WorkCarriedOutList({ job }) {
  const items = Array.isArray(job.combinedRequests) ? job.combinedRequests : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <p style={blockTitleStyle}>Requests / Work Carried Out</p>
      {items.length ? (
        <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {items.map((item, index) => (
            <li key={item?.requestId || item?.vhcItemId || index} style={{ color: "var(--text-1)", lineHeight: 1.4 }}>
              {formatText(item?.text || item?.description)}
            </li>
          ))}
        </ul>
      ) : (
        <span style={{ color: "rgba(var(--text-1-rgb), 0.6)" }}>{DASH}</span>
      )}
    </div>
  );
}

// Parts tally in list view: allocated / on order / back order / total.
export function PartsTallyList({ parts }) {
  const tally = parts || { allocated: 0, onOrder: 0, backOrder: 0, total: 0 };
  const rows = [
    { label: "Allocated", value: tally.allocated },
    { label: "On Order", value: tally.onOrder },
    { label: "Back Order", value: tally.backOrder },
    { label: "Total Parts", value: tally.total, strong: true },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <p style={blockTitleStyle}>Parts on this Job</p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 0",
              // Row separators are the one allowed in-list line (CLAUDE.md §3.0a).
              borderBottom: "var(--separating-line)",
            }}
          >
            <span style={{ color: "var(--text-1)", fontWeight: row.strong ? 700 : 500 }}>{row.label}</span>
            <span style={{ color: "var(--text-1)", fontWeight: 700 }}>{formatNumber(row.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SelectedJobDetail({ job }) {
  return (
    <LayerSurface
      sectionKey="jobcard-service-history-selected"
      parentKey="jobcard-tab-service-history"
      gap="var(--space-4)"
    >
      <p style={eyebrowStyle}>
        {job ? `Selected job — ${formatText(job.jobNumber)}` : "Selected job"}
      </p>

      {job ? (
        <>
          <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)">
            <JobFieldsGrid job={job} />
          </LayerTheme>
          <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)">
            <WorkCarriedOutList job={job} />
          </LayerTheme>
          <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)">
            <PartsTallyList parts={job.parts} />
          </LayerTheme>
        </>
      ) : (
        <p style={{ color: "rgba(var(--text-1-rgb), 0.6)", margin: 0 }}>
          Select a job from the history above to see its details.
        </p>
      )}
    </LayerSurface>
  );
}
