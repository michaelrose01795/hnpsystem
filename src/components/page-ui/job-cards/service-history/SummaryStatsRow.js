// file location: src/components/page-ui/job-cards/service-history/SummaryStatsRow.js
// Top "Overview" section of the Service History tab: six summary metrics for the
// vehicle's full job history, derived by useVehicleHistoryAnalytics.
//
// Layer alternation (CLAUDE.md §3.0): rendered as a <LayerSurface> section whose
// nested metric tiles are <LayerTheme> (surface → theme).

import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import {
  DASH,
  formatCurrency,
  formatMiles,
  formatNumber,
  formatText,
} from "./historyFormat";

const eyebrowStyle = {
  margin: 0,
  fontSize: "0.7rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--accentText)",
  fontWeight: 700,
};

const labelStyle = {
  fontSize: "0.65rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(var(--text-1-rgb), 0.6)",
  fontWeight: 700,
};

const valueStyle = {
  fontSize: "1.5rem",
  fontWeight: 700,
  color: "var(--text-1)",
  lineHeight: 1.1,
  wordBreak: "break-word",
};

export default function SummaryStatsRow({ analytics }) {
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
            <span style={labelStyle}>{tile.label}</span>
            <span style={valueStyle}>{tile.value ?? DASH}</span>
          </LayerTheme>
        ))}
      </div>
    </LayerSurface>
  );
}
