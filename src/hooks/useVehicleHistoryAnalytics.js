// file location: src/hooks/useVehicleHistoryAnalytics.js
// Derives the summary metrics + mileage-trend series shown at the top of the
// redesigned Service History tab from a vehicleJobHistory array (the shape
// produced by mapCustomerJobsToHistory in src/lib/jobCards/utils.js).
//
// Pure derivation only — no fetching. The history array is supplied by the
// page via the useJob hook, so this keeps the UI components dumb.

import { useMemo } from "react";

// Normalise a request description for the "recurring issue" match: lowercase,
// collapse whitespace, strip surrounding punctuation. Two requests count as the
// same issue when their normalised text is identical.
const normaliseIssueText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

// Pull every request label off a single history job, regardless of which
// request shape it carries (combinedRequests covers requests + approved VHC).
const collectIssueTexts = (job) => {
  const items = Array.isArray(job?.combinedRequests) ? job.combinedRequests : [];
  return items
    .map((item) => normaliseIssueText(item?.text || item?.description || ""))
    .filter(Boolean);
};

const toMileageNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

/**
 * @param {Array} vehicleJobHistory - jobs from mapCustomerJobsToHistory
 * @returns analytics object consumed by the Service History summary + chart
 */
export function useVehicleHistoryAnalytics(vehicleJobHistory) {
  return useMemo(() => {
    const history = Array.isArray(vehicleJobHistory) ? vehicleJobHistory : [];
    const totalJobs = history.length;

    // Mileage readings paired with their service date, ascending by date, used
    // both for the trend chart and the mileage metrics.
    const mileagePoints = history
      .map((job) => ({
        date: job.serviceDate ? new Date(job.serviceDate) : null,
        dateFormatted: job.serviceDateFormatted || "",
        mileage: toMileageNumber(job.mileage),
        jobNumber: job.jobNumber,
      }))
      .filter((point) => point.mileage !== null && point.date && !Number.isNaN(point.date.getTime()))
      .sort((a, b) => a.date - b.date);

    const mileageValues = mileagePoints.map((p) => p.mileage);
    // "Total mileage" = the latest odometer reading we hold for the vehicle.
    const totalMileage = mileageValues.length ? Math.max(...mileageValues) : null;
    const minMileage = mileageValues.length ? Math.min(...mileageValues) : null;
    // "Average mileage per job" = mean distance covered between consecutive
    // recorded services (needs at least two readings to mean anything).
    const avgMileagePerJob =
      mileageValues.length >= 2
        ? Math.round((totalMileage - minMileage) / (mileageValues.length - 1))
        : null;

    // Average spend = mean of invoice totals across jobs that carry one.
    const spends = history
      .map((job) => (typeof job.spend === "number" && Number.isFinite(job.spend) ? job.spend : null))
      .filter((value) => value !== null);
    const avgSpend = spends.length
      ? spends.reduce((sum, value) => sum + value, 0) / spends.length
      : null;

    // Last service = most recent service date across all jobs.
    const datedJobs = history
      .map((job) => ({
        date: job.serviceDate ? new Date(job.serviceDate) : null,
        formatted: job.serviceDateFormatted || "",
      }))
      .filter((entry) => entry.date && !Number.isNaN(entry.date.getTime()))
      .sort((a, b) => b.date - a.date);
    const lastService = datedJobs.length ? datedJobs[0].formatted : null;

    // Recurring issues = distinct request descriptions that appear on 2+ jobs.
    const issueJobCounts = new Map(); // normalisedText -> Set(jobNumber)
    history.forEach((job) => {
      const seen = new Set(collectIssueTexts(job));
      seen.forEach((text) => {
        if (!issueJobCounts.has(text)) issueJobCounts.set(text, new Set());
        issueJobCounts.get(text).add(job.jobNumber || job.id);
      });
    });
    const recurringIssuesCount = Array.from(issueJobCounts.values()).filter(
      (jobSet) => jobSet.size >= 2
    ).length;

    return {
      totalJobs,
      totalMileage,
      avgMileagePerJob,
      avgSpend,
      lastService,
      recurringIssuesCount,
      mileagePoints,
    };
  }, [vehicleJobHistory]);
}

export default useVehicleHistoryAnalytics;
