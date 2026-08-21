"use client";

import Link from "next/link";
import { useState } from "react";
import KpiTrendChart from "@/components/reporting/KpiTrendChart";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { SkeletonBlock, SkeletonKeyframes, SkeletonTableRow } from "@/components/ui/LoadingSkeleton";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";

const roundHours = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
};

const formatHours = (value) => `${roundHours(value).toFixed(2)}h`;

const formatChange = (value, suffix = "h") => {
  const parsed = roundHours(value);
  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(suffix === "%" ? 1 : 2)}${suffix}`;
};

const getTargetState = (efficiency) => {
  const value = Number(efficiency || 0);
  if (value >= 110) return { label: "Above target", className: "app-badge--success-strong" };
  if (value >= 100) return { label: "On target", className: "app-badge--success" };
  if (value >= 80) return { label: "Near target", className: "app-badge--warning" };
  return { label: "Below target", className: "app-badge--danger" };
};

function PanelHeader({ title, aside, className = "" }) {
  return (
    <header className={`efficiency-insight-header${className ? ` ${className}` : ""}`}>
      <h3>{title}</h3>
      {aside}
    </header>
  );
}

function EmptyMessage({ children }) {
  return <p className="efficiency-insight-empty">{children}</p>;
}

function HeadlineComparisonSkeleton({ showAction = true }) {
  return (
    <div className="efficiency-headline-comparison" aria-hidden="true">
      <SkeletonBlock width="150px" height="11px" />
      <SkeletonBlock width="72px" height="24px" />
      <SkeletonBlock width="110px" height="11px" />
      {showAction ? <SkeletonBlock width="112px" height="var(--control-height-sm)" /> : null}
    </div>
  );
}

function HeadlineSkeleton() {
  return (
    <>
      <div className="efficiency-headline-main" aria-hidden="true">
        <div>
          <SkeletonBlock width="220px" height="10px" />
          <div className="efficiency-headline-value-row efficiency-skeleton-value-row">
            <SkeletonBlock width="180px" height="64px" />
            <SkeletonBlock width="96px" height="24px" borderRadius="var(--radius-pill)" />
          </div>
          <SkeletonBlock width="280px" height="12px" />
        </div>
        <HeadlineComparisonSkeleton />
      </div>
      <div className="efficiency-kpi-grid" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, index) => (
          <LayerSurface key={index} className="efficiency-kpi-card" padding="var(--space-sm)" gap="8px">
            <SkeletonBlock width={index % 2 ? "74%" : "62%"} height="11px" />
            <SkeletonBlock width={index % 3 ? "58%" : "46%"} height="20px" />
          </LayerSurface>
        ))}
      </div>
    </>
  );
}

function ComparisonSkeleton() {
  return (
    <div className="efficiency-comparison-list" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <LayerSurface key={index} className="efficiency-comparison-row" padding="var(--space-sm)">
          <div><SkeletonBlock width="82px" height="14px" /><SkeletonBlock width="112px" height="10px" /></div>
          <div><SkeletonBlock width="58px" height="14px" /><SkeletonBlock width="76px" height="10px" /></div>
          <SkeletonBlock width="48px" height="14px" />
        </LayerSurface>
      ))}
    </div>
  );
}

function TrendSkeleton() {
  return (
    <div className="efficiency-trend-chart" aria-hidden="true">
      <SkeletonBlock width="100%" height="160px" />
      <SkeletonBlock width="250px" height="11px" />
    </div>
  );
}

function BreakdownSkeleton() {
  return (
    <div className="efficiency-breakdown-list" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="efficiency-breakdown-row" key={index}>
          <div><SkeletonBlock width="120px" height="11px" /><SkeletonBlock width="48px" height="11px" /></div>
          <SkeletonBlock width="100%" height="8px" borderRadius="var(--radius-pill)" />
        </div>
      ))}
    </div>
  );
}

function TargetProgressSkeleton() {
  return (
    <div className="efficiency-target-skeleton" aria-hidden="true">
      <div className="efficiency-target-progress-copy"><SkeletonBlock width="84px" height="32px" /><SkeletonBlock width="64px" height="12px" /></div>
      <SkeletonBlock width="100%" height="8px" borderRadius="var(--radius-pill)" />
      <div className="efficiency-target-progress-meta"><SkeletonBlock width="92px" height="11px" /><SkeletonBlock width="82px" height="11px" /></div>
    </div>
  );
}

function LostTimeSkeleton() {
  return (
    <div className="efficiency-lost-time-grid" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <LayerSurface key={index} padding="var(--space-sm)" gap="8px">
          <SkeletonBlock width="86%" height="11px" />
          <SkeletonBlock width="54px" height="22px" />
        </LayerSurface>
      ))}
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <div className="efficiency-alert-list efficiency-alert-list--skeleton" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="efficiency-alert-skeleton-row" key={index}>
          <SkeletonBlock width="58px" height="22px" borderRadius="var(--radius-pill)" />
          <div><SkeletonBlock width="150px" height="12px" /><SkeletonBlock width="220px" height="10px" /></div>
        </div>
      ))}
    </div>
  );
}

function JobsTableSkeleton({ showTechnician }) {
  const columns = showTechnician ? 6 : 5;
  return (
    <div className="app-table-shell-scroll efficiency-analysis-table" data-app-table-shell-scroll aria-hidden="true">
      <table className="app-table-shell app-table-shell--with-headings">
        <thead><tr>{Array.from({ length: columns }).map((_, index) => <th key={index}><SkeletonBlock width={index === 2 ? "120px" : "72px"} height="11px" /></th>)}</tr></thead>
        <tbody>{Array.from({ length: 4 }).map((_, index) => <SkeletonTableRow key={index} cols={columns} />)}</tbody>
      </table>
    </div>
  );
}

function CategoriesSkeleton() {
  return (
    <div className="efficiency-category-grid" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <LayerSurface key={index} padding="var(--space-sm)" className="efficiency-category-card">
          <div><SkeletonBlock width="92px" height="13px" /><SkeletonBlock width="54px" height="22px" borderRadius="var(--radius-pill)" /></div>
          <SkeletonBlock width="150px" height="11px" />
        </LayerSurface>
      ))}
    </div>
  );
}

function TrendChart({ points }) {
  const series = (points || [])
    .filter((point) => Number.isFinite(Number(point?.efficiencyPct)))
    .map((point) => ({
      key: point.date || point.label,
      value: Number(point.efficiencyPct),
    }));

  if (!series.length) return <EmptyMessage>No efficiency points are available for this period.</EmptyMessage>;

  const values = series.map(({ value }) => value);
  const lowest = Math.min(...values);
  const highest = Math.max(...values);

  return (
    <div
      className="efficiency-trend-chart"
      role="group"
      aria-label={`Efficiency trend from ${series[0].key} to ${series.at(-1).key}`}
    >
      <KpiTrendChart
        series={series}
        unit="percent"
        format="0.0"
        height={160}
        includeZero={false}
        sectionType="data-visualization"
      />
      <p className="efficiency-trend-summary">
        Target: <strong>100%</strong> · Period range: <strong>{lowest.toFixed(1)}–{highest.toFixed(1)}%</strong>
      </p>
    </div>
  );
}

function JobsTable({ jobs }) {
  if (!jobs.length) return <EmptyMessage>No jobs match this view in the selected period.</EmptyMessage>;
  const showTechnician = jobs.some((job) => job.technicianName);
  return (
    <div className="app-table-shell-scroll efficiency-analysis-table" data-app-table-shell-scroll>
      <table className="app-table-shell app-table-shell--with-headings">
        <thead>
          <tr>
            <th>Job</th>
            {showTechnician ? <th>Technician</th> : null}
            <th>Description</th>
            <th>Allocated</th>
            <th>Actual</th>
            <th>Difference</th>
          </tr>
        </thead>
        <tbody>
          {jobs.slice(0, 8).map((job) => (
            <tr key={job.key}>
              <td>
                <Link className="efficiency-job-link" href={`/job-cards/${encodeURIComponent(job.jobNumber)}`}>
                  {job.jobNumber}
                </Link>
              </td>
              {showTechnician ? <td>{job.technicianName || "—"}</td> : null}
              <td>{job.description}</td>
              <td>{formatHours(job.allocatedHours)}</td>
              <td>{formatHours(job.actualHours)}</td>
              <td className={job.difference > 0 ? "is-negative" : "is-positive"}>
                {formatChange(job.difference)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EfficiencyInsights({
  technicianName,
  technicianRole,
  clockingHref,
  periodLabel,
  metrics,
  previousMetrics,
  comparisons,
  trend,
  jobs,
  categories,
  alerts,
  analysisLoading = false,
  analysisError = "",
  hideHeadline = false,
  loading = false,
}) {
  const [jobView, setJobView] = useState("over");
  const targetState = getTargetState(metrics?.efficiencyPct);
  const previousChange = roundHours(
    Number(metrics?.efficiencyPct || 0) - Number(previousMetrics?.efficiencyPct || 0)
  );
  const dayComparison = comparisons?.find((item) => item.key === "day");
  const timeBreakdown = [
    { label: "Productive job time", value: metrics?.productiveHours || 0, tone: "productive" },
    { label: "Overtime", value: metrics?.overtimeHours || 0, tone: "overtime" },
    { label: "Unallocated", value: metrics?.unallocatedHours || 0, tone: "unallocated" },
  ];
  const maxTime = Math.max(1, ...timeBreakdown.map((item) => item.value));
  const overAllocatedHours = (jobs?.over || []).reduce(
    (sum, job) => sum + Math.max(Number(job.difference || 0), 0),
    0
  );
  const latestTrendPoint = trend?.at(-1);
  const latestTrendState = getTargetState(latestTrendPoint?.efficiencyPct);
  const analysisPending = loading || analysisLoading;

  return (
    <div className="efficiency-insights-stack" aria-busy={loading || analysisLoading || undefined}>
      {(loading || analysisLoading) ? <SkeletonKeyframes /> : null}
      {!hideHeadline ? <LayerTheme className="efficiency-headline" as="section">
        {loading ? <HeadlineSkeleton /> : <><div className="efficiency-headline-main">
          <div>
            <p className="efficiency-insight-eyebrow">{technicianName}{technicianRole ? ` · ${technicianRole}` : ""} · {periodLabel}</p>
            <div className="efficiency-headline-value-row">
              <strong>{Number(metrics?.efficiencyPct || 0).toFixed(1)}%</strong>
              <span className={`app-badge ${targetState.className}`}>{targetState.label}</span>
            </div>
            <p className="efficiency-headline-caption">Allocated time divided by productive logged time</p>
          </div>
          {analysisLoading ? <HeadlineComparisonSkeleton showAction={Boolean(clockingHref)} /> : <div className="efficiency-headline-comparison">
            <span>Previous equivalent period</span>
            <strong className={previousChange >= 0 ? "is-positive" : "is-negative"}>
              {formatChange(previousChange, "%")}
            </strong>
            <small>{Number(previousMetrics?.efficiencyPct || 0).toFixed(1)}% previously</small>
            {clockingHref ? <Link className="app-btn app-btn--secondary app-btn--sm" href={clockingHref}>Open clocking</Link> : null}
          </div>}
        </div>
        <div className="efficiency-kpi-grid">
          {[
            ["Logged total", formatHours(metrics?.loggedHours)],
            ["Allocated total", formatHours(metrics?.allocatedHours)],
            ["Total difference", formatChange(metrics?.allocationDifference || 0)],
            ["Current target", formatHours(metrics?.targetHours)],
            ["Full month target", formatHours(metrics?.fullMonthTargetHours)],
            ["Productive hours", formatHours(metrics?.productiveHours)],
            ["Overtime", formatHours(metrics?.overtimeHours)],
            ["Unallocated / idle", formatHours(metrics?.unallocatedHours)],
          ].map(([label, value]) => (
            <LayerSurface key={label} className="efficiency-kpi-card" padding="var(--space-sm)" gap="4px">
              <span>{label}</span>
              <strong>{value}</strong>
            </LayerSurface>
          ))}
        </div></>}
      </LayerTheme> : null}

      <div className="efficiency-primary-analysis-grid">
        <LayerTheme as="section" className="efficiency-analysis-panel efficiency-comparison-panel">
          <PanelHeader title="Comparable periods" />
          {analysisPending ? <ComparisonSkeleton /> : <div className="efficiency-comparison-list">
            {(comparisons || []).map((comparison) => (
              <LayerSurface key={comparison.key} className="efficiency-comparison-row" padding="var(--space-sm)">
                <div>
                  <strong>{comparison.label}</strong>
                  <span>{formatHours(comparison.current.productiveHours)} productive</span>
                </div>
                <div>
                  <strong>{comparison.current.efficiencyPct.toFixed(1)}%</strong>
                  <span>{formatHours(comparison.current.targetHours)} target</span>
                </div>
                <span className={comparison.efficiencyChange >= 0 ? "is-positive" : "is-negative"}>
                  {formatChange(comparison.efficiencyChange, "%")}
                </span>
              </LayerSurface>
            ))}
          </div>}
        </LayerTheme>

        <LayerTheme as="section" className="efficiency-analysis-panel efficiency-trend-panel">
          <PanelHeader
            title="Efficiency trend"
            className="efficiency-trend-header"
            aside={(
              <div className="efficiency-trend-header-meta">
                {analysisPending ? <><SkeletonBlock width="96px" height="22px" borderRadius="var(--radius-pill)" /><SkeletonBlock width="94px" height="22px" borderRadius="var(--radius-pill)" /></> : <><span className="app-badge app-badge--neutral">{periodLabel}</span>
                {latestTrendPoint ? (
                  <span className={`app-badge ${latestTrendState.className}`}>
                    Latest {Number(latestTrendPoint.efficiencyPct || 0).toFixed(1)}%
                  </span>
                ) : null}</>}
              </div>
            )}
          />
          {analysisPending ? <TrendSkeleton /> : null}
          {!analysisPending && analysisError ? <EmptyMessage>{analysisError}</EmptyMessage> : null}
          {!analysisPending && !analysisError ? <TrendChart points={trend} /> : null}
        </LayerTheme>

        <LayerTheme as="section" className="efficiency-analysis-panel">
          <PanelHeader title="Time breakdown" />
          {loading ? <BreakdownSkeleton /> : <div className="efficiency-breakdown-list">
            {timeBreakdown.map((item) => (
              <div key={item.label} className="efficiency-breakdown-row">
                <div><span>{item.label}</span><strong>{formatHours(item.value)}</strong></div>
                <div className="efficiency-breakdown-track">
                  <span className={`is-${item.tone}`} style={{ width: `${Math.max(3, (item.value / maxTime) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>}
          {!loading ? <p className="efficiency-panel-note">Waiting, idle and break time are not classified because current efficiency and job-clocking records do not identify them reliably.</p> : null}
        </LayerTheme>

        <LayerTheme as="section" className="efficiency-analysis-panel">
          <PanelHeader title="Daily target progress" />
          {analysisPending ? <TargetProgressSkeleton /> : <><div className="efficiency-target-progress-copy">
            <strong>{formatHours(dayComparison?.current?.productiveHours || 0)}</strong>
            <span>of {formatHours(dayComparison?.current?.targetHours || 0)}</span>
          </div>
          <div className="efficiency-target-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(dayComparison?.current?.targetProgressPct || 0, 100)}>
            <span style={{ width: `${Math.min(dayComparison?.current?.targetProgressPct || 0, 100)}%` }} />
          </div>
          <div className="efficiency-target-progress-meta">
            <span>{Number(dayComparison?.current?.targetProgressPct || 0).toFixed(1)}% complete</span>
            <span>{formatHours(dayComparison?.current?.remainingTargetHours || 0)} remaining</span>
          </div></>}
        </LayerTheme>
      </div>

      <div className="efficiency-secondary-analysis-grid">
        <LayerTheme as="section" className="efficiency-analysis-panel">
          <PanelHeader title="Lost time analysis" />
          {analysisPending ? <LostTimeSkeleton /> : <div className="efficiency-lost-time-grid">
            <LayerSurface padding="var(--space-sm)"><span>Jobs over allocation</span><strong>{formatHours(overAllocatedHours)}</strong></LayerSurface>
            <LayerSurface padding="var(--space-sm)"><span>Unallocated job time</span><strong>{formatHours(metrics?.unallocatedHours)}</strong></LayerSurface>
            <LayerSurface padding="var(--space-sm)"><span>Clocking issues</span><strong>{alerts?.length || 0}</strong></LayerSurface>
          </div>}
          {!analysisPending ? <p className="efficiency-panel-note">Parts delays, customer authorisation and technical-support delays are excluded because these records are not linked consistently enough for a reliable total.</p> : null}
        </LayerTheme>

        <LayerTheme as="section" className="efficiency-analysis-panel">
          <PanelHeader title="Clocking alerts" aside={analysisPending ? <SkeletonBlock width="42px" height="22px" borderRadius="var(--radius-pill)" /> : <span className="app-badge app-badge--neutral">{alerts?.length || 0}</span>} />
          {analysisPending ? <AlertsSkeleton /> : !alerts?.length ? <EmptyMessage>No clocking-quality issues found for this period.</EmptyMessage> : (
            <ul className="efficiency-alert-list">
              {alerts.slice(0, 6).map((alert) => (
                <li key={alert.key}>
                  <span className={`app-badge app-badge--${alert.severity === "neutral" ? "neutral" : alert.severity}`}>{alert.severity}</span>
                  <div><strong>{alert.title}</strong><span>{alert.detail}</span></div>
                </li>
              ))}
            </ul>
          )}
        </LayerTheme>
      </div>

      <LayerTheme as="section" className="efficiency-analysis-panel">
        <PanelHeader
          title={jobView === "over" ? "Jobs affecting efficiency" : "Best performing jobs"}
          aside={loading ? <SkeletonBlock width="230px" height="var(--control-height-sm)" /> : (
            <TabGroup
              value={jobView}
              onChange={setJobView}
              ariaLabel="Job allocation result"
              items={[
                { value: "over", label: `Over allocation (${jobs?.over?.length || 0})` },
                { value: "under", label: `Best performing (${jobs?.under?.length || 0})` },
              ]}
            />
          )}
        />
        {loading ? <JobsTableSkeleton showTechnician={hideHeadline} /> : <JobsTable jobs={jobs?.[jobView] || []} />}
      </LayerTheme>

      <LayerTheme as="section" className="efficiency-analysis-panel">
        <PanelHeader title="Job category analysis" />
        {loading ? <CategoriesSkeleton /> : !categories?.length ? <EmptyMessage>No reliable job categories are available for this period.</EmptyMessage> : (
          <div className="efficiency-category-grid">
            {categories.map((category) => {
              const state = getTargetState(category.efficiencyPct);
              return (
                <LayerSurface key={category.category} padding="var(--space-sm)" className="efficiency-category-card">
                  <div><strong>{category.category}</strong><span className={`app-badge ${state.className}`}>{category.efficiencyPct.toFixed(1)}%</span></div>
                  <span>{formatHours(category.actualHours)} logged · {formatHours(category.allocatedHours)} allocated</span>
                </LayerSurface>
              );
            })}
          </div>
        )}
      </LayerTheme>

      {/* These classes are feature-local because the panel packing and SVG sizing are unique to this workspace. */}
      <style jsx>{`
        .efficiency-insights-stack { display: flex; flex-direction: column; gap: var(--page-stack-gap); min-width: 0; color: var(--surfaceText); }
        :global(.efficiency-headline) { gap: var(--space-md); }
        .efficiency-headline-main { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-lg); align-items: end; }
        .efficiency-headline-value-row { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
        .efficiency-skeleton-value-row { margin: var(--space-sm) 0; }
        .efficiency-headline-value-row > strong { color: var(--primary-selected); font-size: clamp(2.5rem, 7vw, 4.6rem); line-height: .9; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
        .efficiency-headline-caption, .efficiency-panel-note { color: var(--surfaceTextMuted); font-size: var(--text-caption); margin: var(--space-xs) 0 0; }
        .efficiency-headline-comparison { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; text-align: right; }
        .efficiency-headline-comparison span, .efficiency-headline-comparison small { color: var(--surfaceTextMuted); }
        .efficiency-headline-comparison strong { font-size: 1.35rem; font-variant-numeric: tabular-nums; }
        .efficiency-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: var(--space-sm); }
        :global(.efficiency-kpi-card span) { color: var(--surfaceTextMuted); font-size: var(--text-caption); }
        :global(.efficiency-kpi-card strong) { color: var(--surfaceText); font-size: 1.15rem; font-variant-numeric: tabular-nums; }
        .efficiency-primary-analysis-grid { display: grid; grid-template-columns: minmax(280px, .8fr) minmax(420px, 1.4fr); gap: var(--page-stack-gap); align-items: stretch; }
        .efficiency-secondary-analysis-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: var(--page-stack-gap); }
        :global(.efficiency-analysis-panel) { min-height: 0; }
        .efficiency-insight-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-sm); flex-wrap: wrap; }
        .efficiency-insight-header h3 { margin: 0; color: var(--primary-selected); font-size: 1rem; letter-spacing: -.01em; }
        .efficiency-trend-header { align-items: center; flex-wrap: nowrap; }
        .efficiency-trend-header h3 { white-space: nowrap; }
        .efficiency-insight-eyebrow { margin: 0 0 3px; color: var(--surfaceTextMuted); font-size: .68rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
        .efficiency-comparison-list { display: flex; flex-direction: column; gap: var(--space-xs); }
        :global(.efficiency-comparison-row) { display: grid !important; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; }
        :global(.efficiency-comparison-row > div) { display: flex; flex-direction: column; gap: 2px; }
        :global(.efficiency-comparison-row span) { color: var(--surfaceTextMuted); font-size: var(--text-caption); }
        .is-positive { color: var(--success) !important; font-weight: 700; }
        .is-negative { color: var(--danger) !important; font-weight: 700; }
        .efficiency-trend-chart { min-width: 0; display: flex; flex-direction: column; gap: var(--space-xs); }
        .efficiency-trend-header-meta { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-xs); flex: 0 0 auto; flex-wrap: nowrap; }
        .efficiency-trend-summary { margin: 0; color: var(--surfaceTextMuted); font-size: var(--text-caption); }
        .efficiency-trend-summary strong { color: var(--surfaceText); font-variant-numeric: tabular-nums; }
        .efficiency-breakdown-list { display: flex; flex-direction: column; gap: var(--space-sm); }
        .efficiency-breakdown-row > div:first-child { display: flex; justify-content: space-between; gap: var(--space-sm); font-size: var(--text-caption); }
        .efficiency-breakdown-track, .efficiency-target-progress { height: 8px; margin-top: 5px; background: var(--surface); border-radius: var(--radius-pill); overflow: hidden; }
        .efficiency-breakdown-track span, .efficiency-target-progress span { display: block; height: 100%; border-radius: inherit; background: var(--primary); }
        .efficiency-breakdown-track .is-overtime { background: var(--info); }
        .efficiency-breakdown-track .is-unallocated { background: var(--warning); }
        .efficiency-target-progress-copy { display: flex; align-items: baseline; gap: var(--space-xs); }
        .efficiency-target-progress-copy strong { color: var(--primary-selected); font-size: 2rem; }
        .efficiency-target-progress-copy span, .efficiency-target-progress-meta { color: var(--surfaceTextMuted); }
        .efficiency-target-progress-meta { display: flex; justify-content: space-between; gap: var(--space-sm); margin-top: var(--space-xs); font-size: var(--text-caption); }
        .efficiency-target-skeleton { display: flex; flex-direction: column; gap: var(--space-xs); }
        .efficiency-lost-time-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--space-sm); }
        :global(.efficiency-lost-time-grid > div span) { color: var(--surfaceTextMuted); font-size: var(--text-caption); }
        :global(.efficiency-lost-time-grid > div strong) { font-size: 1.3rem; font-variant-numeric: tabular-nums; }
        .efficiency-alert-list { list-style: none; display: flex; flex-direction: column; gap: var(--space-xs); padding: 0; margin: 0; }
        .efficiency-alert-list li { display: flex; align-items: flex-start; gap: var(--space-sm); padding-bottom: var(--space-xs); border-bottom: 1px solid var(--separating-line); }
        .efficiency-alert-list li:last-child { border-bottom: 0; }
        .efficiency-alert-list li div { display: flex; flex-direction: column; gap: 2px; }
        .efficiency-alert-list li div span { color: var(--surfaceTextMuted); font-size: var(--text-caption); }
        .efficiency-alert-list--skeleton { margin: 0; }
        .efficiency-alert-skeleton-row { display: flex; align-items: flex-start; gap: var(--space-sm); padding-bottom: var(--space-xs); }
        .efficiency-alert-skeleton-row > div { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .efficiency-insight-empty { color: var(--surfaceTextMuted); margin: auto 0; padding: var(--space-lg) 0; text-align: center; }
        .efficiency-analysis-table { max-height: 330px; overflow: auto; }
        .efficiency-analysis-table table { min-width: 700px; }
        .efficiency-job-link { color: var(--primary-selected); font-weight: 700; text-decoration: none; }
        .efficiency-job-link:hover { text-decoration: underline; }
        .efficiency-category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--space-sm); }
        :global(.efficiency-category-card > div) { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); }
        :global(.efficiency-category-card > span) { color: var(--surfaceTextMuted); font-size: var(--text-caption); }
        @media (max-width: 980px) {
          .efficiency-primary-analysis-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 620px) {
          .efficiency-headline-main { grid-template-columns: 1fr; align-items: start; }
          .efficiency-headline-comparison { align-items: flex-start; text-align: left; }
          .efficiency-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          :global(.efficiency-comparison-row) { grid-template-columns: minmax(0, 1fr) auto; }
          :global(.efficiency-comparison-row > span) { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  );
}

