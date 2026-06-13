// file location: src/components/page-ui/job-cards/service-history/ServiceHistoryTab.js
// Redesigned Service History tab for a job card. Shows the vehicle's full job
// history as: a summary metrics row, a job tracking tree, a detail panel for the
// selected job, and a mileage trend chart — with "Compare jobs" and
// "Export history" actions in the section header.
//
// Replaces the legacy inline ServiceHistoryTab in src/pages/job-cards/[jobNumber].js.
// Data shape is produced by mapCustomerJobsToHistory (src/lib/jobCards/utils.js)
// and reaches this component via the page's useJob hook.

import { useEffect, useMemo, useState } from "react";
import useVehicleHistoryAnalytics from "@/hooks/useVehicleHistoryAnalytics";
import SummaryStatsRow from "./SummaryStatsRow";
import JobHistoryTree from "./JobHistoryTree";
import SelectedJobDetail from "./SelectedJobDetail";
import MileageTrendChart from "./MileageTrendChart";
import CompareJobsModal from "./CompareJobsModal";
import ExportHistoryModal from "./ExportHistoryModal";

const jobKey = (job) => job?.id ?? job?.jobNumber;

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
