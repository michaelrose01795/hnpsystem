// file location: src/lib/jobCards/vhcSeverity.js
//
// Job-card VHC severity derivation. Moved verbatim out of
// src/pages/job-cards/[jobNumber].js so the technician route can reuse the
// shared job-card components without importing that 13k-line page.

const deriveVhcSeverity = (check = {}) => {
  const fields = [
  check.severity,
  check.traffic_light,
  check.trafficLight,
  check.status,
  check.section,
  check.issue_title,
  check.issueDescription,
  check.issue_description];


  for (const field of fields) {
    if (!field || typeof field !== "string") continue;
    const lower = field.toLowerCase();
    if (lower.includes("red")) return "red";
    if (lower.includes("amber") || lower.includes("orange")) return "amber";
    if (lower.includes("grey") || lower.includes("gray") || lower.includes("green")) return "grey";
  }

  return null;
};

const resolveVhcSeverity = (check = {}) => deriveVhcSeverity(check) || "grey";

export { deriveVhcSeverity, resolveVhcSeverity };
