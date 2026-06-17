// file location: src/components/page-ui/job-cards/ServiceHistoryTab.js
// Redesigned Service History tab for a job card — consolidated into one file per
// CLAUDE.md §4.3 (one file per tab). Previously split across service-history/*;
// behaviour and markup are unchanged. Shows the vehicle's full job history as:
// a summary metrics row, a job tracking tree, a detail panel for the selected
// job, and a mileage trend chart — with "Compare jobs" and "Export history"
// actions in the section header.
//
// Data shape is produced by mapCustomerJobsToHistory (src/lib/jobCards/utils.js)
// and reaches the default export (ServiceHistoryTab) via the page's useJob hook.
// Shared pure formatters live in ./historyFormat (also used by the Warranty tab).

import { useEffect, useMemo, useState } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import useVehicleHistoryAnalytics from "@/hooks/useVehicleHistoryAnalytics";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { DropdownField } from "@/components/ui/dropdownAPI";
import PopupModal from "@/components/popups/popupStyleApi";
import { exportToCsv } from "@/utils/exportUtils";
import {
  DASH,
  formatCurrency,
  formatMiles,
  formatNumber,
  formatText,
  joinRequests,
  statusBadgeClass,
} from "./historyFormat";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// ---- shared style/util primitives (identical across the former section files) ----
const eyebrowStyle = {
  margin: 0,
  fontSize: "0.7rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--accentText)",
  fontWeight: 700,
};

const titleStyle = {
  margin: 0,
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "var(--text-1)",
};

const jobKey = (job) => job?.id ?? job?.jobNumber;

/* ════════════════════════════════════════════════════════════════════════
   SummaryStatsRow — top "Overview" section: six summary metrics for the
   vehicle's full job history, derived by useVehicleHistoryAnalytics.
   Layer alternation: <LayerSurface> section → <LayerTheme> metric tiles.
   ════════════════════════════════════════════════════════════════════════ */
const summaryLabelStyle = {
  fontSize: "0.65rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(var(--text-1-rgb), 0.6)",
  fontWeight: 700,
};

const summaryValueStyle = {
  fontSize: "1.5rem",
  fontWeight: 700,
  color: "var(--text-1)",
  lineHeight: 1.1,
  wordBreak: "break-word",
};

function SummaryStatsRow({ analytics }) {
  const tiles = [
    { label: "Total Jobs", value: formatNumber(analytics.totalJobs) },
    { label: "Total Mileage", value: formatMiles(analytics.totalMileage) },
    { label: "Avg Mileage / Job", value: formatMiles(analytics.avgMileagePerJob) },
    { label: "Avg Spend", value: formatCurrency(analytics.avgSpend) },
    { label: "Last Service", value: formatText(analytics.lastService) },
    { label: "Recurring Issues", value: formatNumber(analytics.recurringIssuesCount) },
  ];

  return (
    <LayerSurface
      sectionKey="jobcard-service-history-summary"
      parentKey="jobcard-tab-service-history"
      gap="var(--space-4)"
    >
      <p style={eyebrowStyle}>Overview</p>
      <div
        style={{
          display: "grid",
          gap: "var(--space-3)",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        }}
      >
        {tiles.map((tile) => (
          <LayerTheme
            key={tile.label}
            radius="var(--radius-sm)"
            padding="var(--space-4)"
            gap="var(--space-2)"
          >
            <span style={summaryLabelStyle}>{tile.label}</span>
            <span style={summaryValueStyle}>{tile.value ?? DASH}</span>
          </LayerTheme>
        ))}
      </div>
    </LayerSurface>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   JobHistoryTree — a vertical timeline of the vehicle's jobs. Each node shows
   job number, appointment date, status, mileage and a single " | "-separated
   line of that job's requests. Clicking a node selects it, driving the
   SelectedJobDetail panel. Selection uses a box-shadow ring (not a border).
   ════════════════════════════════════════════════════════════════════════ */
const treeMetaStyle = {
  fontSize: "0.8rem",
  color: "rgba(var(--text-1-rgb), 0.7)",
};

function JobHistoryTree({ history = [], selectedJobId, onSelect }) {
  if (!history.length) {
    return (
      <LayerSurface
        sectionKey="jobcard-service-history-tree"
        parentKey="jobcard-tab-service-history"
        gap="var(--space-4)"
      >
        <p style={eyebrowStyle}>Job history</p>
        <p style={{ color: "rgba(var(--text-1-rgb), 0.6)", margin: 0 }}>
          No previous service history for this vehicle.
        </p>
      </LayerSurface>
    );
  }

  return (
    <LayerSurface
      sectionKey="jobcard-service-history-tree"
      parentKey="jobcard-tab-service-history"
      gap="var(--space-4)"
    >
      <p style={eyebrowStyle}>Job history</p>

      {/* Tree column: a continuous rule down the left, nodes hung off it. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {history.map((job) => {
          const requests = joinRequests(job);
          const isSelected = (job.id ?? job.jobNumber) === selectedJobId;
          return (
            <div
              key={job.id || job.jobNumber}
              style={{ display: "flex", alignItems: "stretch", gap: "var(--space-3)" }}
            >
              {/* Timeline rail + node dot. The rail is a 2px tinted strip, not a
                  decorative card border, so it sits outside the Border Sweep ban. */}
              <div
                style={{
                  position: "relative",
                  width: "12px",
                  flex: "0 0 12px",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    width: "2px",
                    background: "var(--theme-hover)",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: "18px",
                    width: "12px",
                    height: "12px",
                    borderRadius: "var(--radius-pill)",
                    background: isSelected ? "var(--accent-strong)" : "var(--theme-hover)",
                  }}
                />
              </div>

              <LayerTheme
                as="button"
                type="button"
                onClick={() => onSelect?.(job.id ?? job.jobNumber)}
                radius="var(--radius-sm)"
                padding="var(--space-4)"
                gap="var(--space-2)"
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  // Selection ring via box-shadow (allowed) — never a border.
                  boxShadow: isSelected ? "var(--focus-ring, 0 0 0 2px var(--accent-strong))" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accentText)" }}>
                    {formatText(job.jobNumber)}
                  </span>
                  <span className={`app-badge ${statusBadgeClass(job.status)}`}>
                    {formatText(job.status)}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", ...treeMetaStyle }}>
                  <span>{formatText(job.serviceDateFormatted)}</span>
                  <span>{formatMiles(job.mileage)}</span>
                </div>

                <div style={{ ...treeMetaStyle, color: "var(--text-1)", lineHeight: 1.4, overflowWrap: "anywhere" }}>
                  {requests.length ? requests.join(" | ") : DASH}
                </div>
              </LayerTheme>
            </div>
          );
        })}
      </div>
    </LayerSurface>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SelectedJobDetail (+ reusable blocks JobFieldsGrid / WorkCarriedOutList /
   PartsTallyList). Detail panel for the job selected in the tree: header strip,
   the requests / work carried out, and a parts tally. The sub-blocks are
   layer-agnostic so the Compare modal can reuse them inside its own columns.
   ════════════════════════════════════════════════════════════════════════ */
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
function JobFieldsGrid({ job }) {
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
function WorkCarriedOutList({ job }) {
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
function PartsTallyList({ parts }) {
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

function SelectedJobDetail({ job }) {
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

/* ════════════════════════════════════════════════════════════════════════
   MileageTrendChart — a line chart of recorded mileage (y) against each
   appointment date (x). Chart colours resolve from CSS design tokens at render.
   ════════════════════════════════════════════════════════════════════════ */
// Read a CSS custom property off the document root, with a hard fallback so the
// chart still renders before styles resolve / during SSR hydration.
const cssVar = (name, fallback) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

function MileageTrendChart({ points = [] }) {
  // chart.js needs the canvas/DOM, so only render after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasData = Array.isArray(points) && points.length >= 2;

  const { data, options } = useMemo(() => {
    // Canvas can't parse color-mix() reliably, so resolve the RGB tokens the app
    // already exposes and build concrete rgb()/rgba() strings.
    const accentRgb = cssVar("--accentMainRgb", "185, 28, 28");
    const textRgb = cssVar("--text-1-rgb", "15, 15, 15");
    const accent = `rgb(${accentRgb})`;
    const grid = `rgba(${accentRgb}, 0.12)`;
    const muted = `rgba(${textRgb}, 0.6)`;

    return {
      data: {
        labels: points.map((p) => p.dateFormatted),
        datasets: [
          {
            label: "Mileage",
            data: points.map((p) => p.mileage),
            borderColor: accent,
            backgroundColor: `rgba(${accentRgb}, 0.14)`,
            pointBackgroundColor: accent,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: 0.25,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y.toLocaleString("en-GB")} mi`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: muted, maxRotation: 0, autoSkip: true },
            grid: { color: grid, drawBorder: false },
          },
          y: {
            ticks: {
              color: muted,
              callback: (value) => Number(value).toLocaleString("en-GB"),
            },
            grid: { color: grid, drawBorder: false },
          },
        },
      },
    };
  }, [points]);

  return (
    <LayerSurface
      sectionKey="jobcard-service-history-trend"
      parentKey="jobcard-tab-service-history"
      gap="var(--space-4)"
    >
      <p style={eyebrowStyle}>Mileage trend</p>
      {hasData && mounted ? (
        <div style={{ height: "260px", width: "100%" }}>
          <Line data={data} options={options} />
        </div>
      ) : (
        <p style={{ color: "color-mix(in srgb, var(--text-1) 60%, transparent)", margin: 0 }}>
          Not enough recorded mileage to plot a trend yet.
        </p>
      )}
    </LayerSurface>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   CompareJobsModal — pick two jobs from the history and see their details side
   by side. PopupModal card is --surface, so the comparison columns are <LayerTheme>.
   ════════════════════════════════════════════════════════════════════════ */
function ComparePicker({ label, value, onChange, history }) {
  const options = useMemo(
    () =>
      history.map((job) => ({
        value: String(jobKey(job)),
        label: formatText(job.jobNumber),
        description: formatText(job.serviceDateFormatted),
      })),
    [history]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "160px" }}>
      <span style={eyebrowStyle}>{label}</span>
      <DropdownField
        ariaLabel={`${label} job`}
        className="service-history-compare-dropdown"
        placeholder="Select a job..."
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        options={options}
      />
    </div>
  );
}

function CompareColumn({ job }) {
  if (!job) {
    return (
      <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)" style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "rgba(var(--text-1-rgb), 0.6)", margin: 0 }}>
          No job selected.
        </p>
      </LayerTheme>
    );
  }
  return (
    <LayerTheme radius="var(--radius-sm)" padding="var(--space-4)" gap="var(--space-4)" style={{ flex: 1, minWidth: 0 }}>
      <p style={titleStyle}>{formatText(job.jobNumber)}</p>
      <JobFieldsGrid job={job} />
      <WorkCarriedOutList job={job} />
      <PartsTallyList parts={job.parts} />
    </LayerTheme>
  );
}

function CompareJobsModal({ isOpen, onClose, history = [], initialJobId }) {
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  // Seed the left column with the currently-selected job each time the modal
  // opens, and default the right column to the next job for a useful first view.
  useEffect(() => {
    if (!isOpen) return;
    const seedLeft = initialJobId != null ? String(initialJobId) : "";
    setLeftId(seedLeft);
    const other = history.find((job) => String(jobKey(job)) !== seedLeft);
    setRightId(other ? String(jobKey(other)) : "");
  }, [isOpen, initialJobId, history]);

  const leftJob = history.find((job) => String(jobKey(job)) === String(leftId)) || null;
  const rightJob = history.find((job) => String(jobKey(job)) === String(rightId)) || null;

  if (!isOpen) return null;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Compare jobs"
      cardStyle={{ width: "min(100%, 980px)", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <h2 style={titleStyle}>Compare Jobs</h2>
        <button type="button" onClick={onClose} className="app-btn app-btn--ghost">Close</button>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <ComparePicker label="Job A" value={leftId} onChange={setLeftId} history={history} />
        <ComparePicker label="Job B" value={rightId} onChange={setRightId} history={history} />
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "stretch" }}>
        <CompareColumn job={leftJob} />
        <CompareColumn job={rightJob} />
      </div>
    </PopupModal>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ExportHistoryModal — choose what to export (selected job / full list /
   hand-picked items) and download a client-side CSV.
   ════════════════════════════════════════════════════════════════════════ */
const optionLabelStyle = { fontSize: "0.95rem", fontWeight: 600, color: "var(--text-1)" };
const optionHintStyle = { fontSize: "0.8rem", color: "rgba(var(--text-1-rgb), 0.6)" };

const CSV_COLUMNS = [
  "Job Number",
  "Date",
  "Status",
  "Mileage",
  "Advisor",
  "Technician",
  "Parts User",
  "Allocated",
  "On Order",
  "Back Order",
  "Total Parts",
  "Spend",
  "Requests",
];

// Flatten one history job into a CSV row keyed by CSV_COLUMNS.
const toCsvRow = (job) => {
  const parts = job.parts || {};
  return {
    "Job Number": job.jobNumber ?? "",
    Date: job.serviceDateFormatted ?? "",
    Status: job.status ?? "",
    Mileage: typeof job.mileage === "number" ? job.mileage : "",
    Advisor: job.advisor ?? "",
    Technician: job.technician ?? "",
    "Parts User": job.partsUser ?? "",
    Allocated: parts.allocated ?? 0,
    "On Order": parts.onOrder ?? 0,
    "Back Order": parts.backOrder ?? 0,
    "Total Parts": parts.total ?? 0,
    Spend: typeof job.spend === "number" ? job.spend.toFixed(2) : "",
    Requests: joinRequests(job).join(" | "),
  };
};

const EXPORT_MODES = [
  { id: "selected", label: "Selected job details", hint: "Export the currently selected job as a single row." },
  { id: "list", label: "Full history list", hint: "Export every job in this vehicle's history." },
  { id: "pick", label: "Choose history items", hint: "Tick the specific jobs you want to export." },
];

function ExportHistoryModal({ isOpen, onClose, history = [], selectedJob }) {
  const [mode, setMode] = useState("list");
  const [pickedIds, setPickedIds] = useState(() => new Set());

  useEffect(() => {
    if (!isOpen) return;
    setMode(selectedJob ? "selected" : "list");
    setPickedIds(new Set());
  }, [isOpen, selectedJob]);

  const togglePicked = (id) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rows = useMemo(() => {
    if (mode === "selected") return selectedJob ? [toCsvRow(selectedJob)] : [];
    if (mode === "pick") {
      return history.filter((job) => pickedIds.has(jobKey(job))).map(toCsvRow);
    }
    return history.map(toCsvRow);
  }, [mode, history, selectedJob, pickedIds]);

  const handleExport = () => {
    if (!rows.length) return;
    exportToCsv("vehicle-service-history.csv", rows, CSV_COLUMNS);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Export history"
      cardStyle={{ width: "min(100%, 620px)", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <h2 style={titleStyle}>Export History</h2>
        <button type="button" onClick={onClose} className="app-btn app-btn--ghost">Close</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {EXPORT_MODES.map((option) => {
          const disabled = option.id === "selected" && !selectedJob;
          return (
            <LayerTheme
              key={option.id}
              as="label"
              radius="var(--radius-sm)"
              padding="var(--space-4)"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: "var(--space-3)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <input
                type="radio"
                name="export-mode"
                value={option.id}
                checked={mode === option.id}
                disabled={disabled}
                onChange={() => setMode(option.id)}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={optionLabelStyle}>{option.label}</span>
                <span style={optionHintStyle}>{option.hint}</span>
              </span>
            </LayerTheme>
          );
        })}
      </div>

      {/* Per-item picker, only when "Choose history items" is active. */}
      {mode === "pick" && (
        <LayerTheme radius="var(--radius-sm)" padding="var(--space-3)" style={{ maxHeight: "240px", overflowY: "auto" }} className="themed-scrollbar">
          {history.map((job) => {
            const id = jobKey(job);
            return (
              <label
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "8px 0",
                  borderBottom: "var(--separating-line)",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={pickedIds.has(id)} onChange={() => togglePicked(id)} />
                <span style={{ color: "var(--text-1)" }}>
                  {job.jobNumber} — {job.serviceDateFormatted}
                </span>
              </label>
            );
          })}
        </LayerTheme>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
        <span style={{ ...optionHintStyle, alignSelf: "center", marginRight: "auto" }}>
          {rows.length} job{rows.length === 1 ? "" : "s"} ready to export
        </span>
        <button type="button" onClick={handleExport} disabled={!rows.length} className="app-btn app-btn--primary">
          Export CSV
        </button>
      </div>
    </PopupModal>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ServiceHistoryTab — default export, the tab orchestrator.
   ════════════════════════════════════════════════════════════════════════ */
const headerTitleStyle = {
  margin: 0,
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "var(--text-1)",
};

export default function ServiceHistoryTab({ vehicleJobHistory }) {
  const history = useMemo(
    () => (Array.isArray(vehicleJobHistory) ? vehicleJobHistory : []),
    [vehicleJobHistory]
  );
  const analytics = useVehicleHistoryAnalytics(history);

  const [selectedJobId, setSelectedJobId] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Default the selection to the first (most recent) job, and keep it valid if
  // the history changes underneath us.
  useEffect(() => {
    if (!history.length) {
      setSelectedJobId(null);
      return;
    }
    const stillExists = history.some((job) => jobKey(job) === selectedJobId);
    if (!stillExists) setSelectedJobId(jobKey(history[0]));
  }, [history, selectedJobId]);

  const selectedJob = history.find((job) => jobKey(job) === selectedJobId) || null;
  const hasHistory = history.length > 0;

  return (
    <div className="app-page-stack" data-dev-section-key="jobcard-tab-service-history-panel">
      {/* Section header with the two top-right actions. Not a surface — just a
          flex header row, so no layer primitive is needed here. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <h2 style={headerTitleStyle}>Service History</h2>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button
            type="button"
            className="app-btn app-btn--secondary"
            onClick={() => setCompareOpen(true)}
            disabled={history.length < 2}
            title={history.length < 2 ? "Need at least two jobs to compare" : "Compare two jobs"}
          >
            Compare jobs
          </button>
          <button
            type="button"
            className="app-btn app-btn--secondary"
            onClick={() => setExportOpen(true)}
            disabled={!hasHistory}
          >
            Export history
          </button>
        </div>
      </div>

      <SummaryStatsRow analytics={analytics} />

      {/* 50/50 split: history tree on the left, the selected-job detail and the
          mileage trend grouped together on the right. auto-fit + minmax keeps the
          two halves equal on desktop/tablet and stacks them on narrow screens
          (CLAUDE.md §3.6) without any JS width checks. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--page-stack-gap)",
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <JobHistoryTree
            history={history}
            selectedJobId={selectedJobId}
            onSelect={setSelectedJobId}
          />
        </div>

        <div
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--page-stack-gap)",
          }}
        >
          <SelectedJobDetail job={selectedJob} />
          <MileageTrendChart points={analytics.mileagePoints} />
        </div>
      </div>

      <CompareJobsModal
        isOpen={compareOpen}
        onClose={() => setCompareOpen(false)}
        history={history}
        initialJobId={selectedJobId}
      />

      <ExportHistoryModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        history={history}
        selectedJob={selectedJob}
      />
    </div>
  );
}
