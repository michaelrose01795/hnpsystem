// file location: src/lib/hr/disciplinaryCases.js
//
// `hr_disciplinary_cases` stores one free-text `notes` column, but the
// Disciplinary tab shows four things about an incident: what happened, the job
// it relates to, who recorded it and how it was resolved. Rather than add
// columns, richer records serialise that detail into `notes` as JSON — the same
// approach `hr_absences` already takes for leave requests
// (src/lib/hr/leaveRequests.js).
//
// Legacy rows hold a plain sentence. Those still parse: the sentence becomes the
// summary and the other fields come back empty, so nothing that predates this
// convention breaks.

const toTrimmedString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const parseDisciplinaryNotes = (value) => {
  const fallback = { summary: "", jobNumber: "", recordedBy: "", outcome: "" };

  if (!value) return fallback;

  if (typeof value === "object") {
    return {
      summary: toTrimmedString(value.summary ?? value.notes ?? ""),
      jobNumber: toTrimmedString(value.jobNumber ?? value.job_number ?? ""),
      recordedBy: toTrimmedString(value.recordedBy ?? value.recorded_by ?? ""),
      outcome: toTrimmedString(value.outcome ?? ""),
    };
  }

  try {
    const parsed = JSON.parse(value);
    // A JSON scalar (a quoted string, a number) is not a record — treat it as
    // plain text rather than reading fields off it.
    if (!parsed || typeof parsed !== "object") {
      return { ...fallback, summary: toTrimmedString(value) };
    }
    return parseDisciplinaryNotes(parsed);
  } catch (_error) {
    return { ...fallback, summary: toTrimmedString(value) };
  }
};

export const serializeDisciplinaryNotes = (value = {}) => {
  const parsed = parseDisciplinaryNotes(value);
  return JSON.stringify({
    summary: parsed.summary,
    jobNumber: parsed.jobNumber,
    recordedBy: parsed.recordedBy,
    outcome: parsed.outcome,
  });
};

// "monitoring" / "open" / "closed" are the stored values; these are what a
// manager reads on the tab.
export const formatCaseStatus = (status) => {
  const normalised = toTrimmedString(status).toLowerCase();
  if (normalised === "open") return "Open";
  if (normalised === "monitoring") return "Monitoring";
  if (normalised === "closed") return "Closed";
  return toTrimmedString(status) || "Open";
};
