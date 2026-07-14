// file location: src/components/dashboards/ReportLinkedTrend.js
//
// Dashboard bridge for report-backed trends. It renders the same KpiTrendChart
// used by report pages, so dashboard line graphs inherit the staffglobal.css
// report-graph styling and the data comes from /api/reports/trend.

import KpiTrendChart from "@/components/reporting/KpiTrendChart";
import { useKpiTrend } from "@/hooks/reporting/useReporting";

const legacyPointToSeries = (point) => ({
  key: point?.key ?? point?.label ?? "",
  value: Number(point?.value ?? point?.count ?? 0),
});

export default function ReportLinkedTrend({
  fallbackData = [],
  filter,
  format = "0,0",
  height = 120,
  kpiId,
  parentKey,
  sectionKey,
  unit = "count",
}) {
  const trend = useKpiTrend(kpiId, filter, { enabled: Boolean(kpiId) });
  const fallbackSeries = (fallbackData || []).map(legacyPointToSeries);
  const series = trend.series?.length ? trend.series : fallbackSeries;

  return (
    <KpiTrendChart
      series={series}
      unit={unit}
      format={format}
      height={height}
      loading={trend.loading && fallbackSeries.length === 0}
      sectionKey={sectionKey}
      parentKey={parentKey}
    />
  );
}
