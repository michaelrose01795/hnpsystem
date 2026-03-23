// file location: src/lib/vhc/assistant.js

const norm = (value) => String(value || "").trim().toLowerCase();

const isTruthyCompleteFlag = (value) => {
  if (value === true || value === 1) return true;
  const text = norm(value);
  return ["true", "1", "yes", "y", "complete", "completed"].includes(text);
};

export const buildVhcTechnicianAssistantSummary = ({
  checks = [],
  sectionStatus = {},
  writeUpComplete = false,
  partsAuthorisedCount = 0,
} = {}) => {
  const rows = Array.isArray(checks) ? checks : [];
  const actionableRows = rows.filter((row) => {
    const section = norm(row?.section);
    return section !== "vhc_checksheet" && section !== "vhc checksheet";
  });

  let pricingMissing = 0;
  let awaitingDecision = 0;
  let authorisedNotComplete = 0;
  let declined = 0;
  let resolved = 0;

  actionableRows.forEach((row) => {
    const decision = norm(row?.approval_status || row?.approvalStatus || row?.authorization_state || row?.authorizationState || row?.display_status);
    const labourHours = Number(row?.labour_hours ?? row?.labourHours);
    const partsCost = Number(row?.parts_cost ?? row?.partsCost);
    const labourMissing = !Number.isFinite(labourHours) || labourHours <= 0;
    const partsMissing = !Number.isFinite(partsCost) || partsCost < 0;
    const completeFlag = isTruthyCompleteFlag(row?.Complete ?? row?.complete);

    if (decision === "declined") {
      declined += 1;
      resolved += 1;
      return;
    }

    if (decision === "authorized" || decision === "authorised") {
      if (completeFlag || norm(row?.display_status) === "completed" || decision === "completed") {
        resolved += 1;
      } else {
        authorisedNotComplete += 1;
      }
      return;
    }

    if (decision === "awaiting_customer_decision" || decision === "awaiting customer decision") {
      awaitingDecision += 1;
    }

    if (labourMissing || partsMissing) {
      pricingMissing += 1;
    }
  });

  const incompleteSections = Object.entries(sectionStatus || {})
    .filter(([, value]) => norm(value) !== "complete")
    .map(([key]) => key);

  const blockers = [];
  if (incompleteSections.length > 0) blockers.push(`${incompleteSections.length} VHC section(s) not complete`);
  if (pricingMissing > 0) blockers.push(`${pricingMissing} item(s) need labour/parts pricing`);
  if (awaitingDecision > 0) blockers.push(`${awaitingDecision} item(s) awaiting customer decision`);
  if (authorisedNotComplete > 0) blockers.push(`${authorisedNotComplete} authorised item(s) still need completion`);

  const recommendations = [];
  if (pricingMissing > 0) recommendations.push("Add missing labour and parts values before sending customer updates.");
  if (awaitingDecision > 0) recommendations.push("Use View VHC then Send to Customer for rows awaiting customer decisions.");
  if (authorisedNotComplete > 0) recommendations.push("Complete authorised rows or add evidence explaining any delay.");
  if (partsAuthorisedCount === 0 && actionableRows.length > 0) recommendations.push("Capture parts requirements so Parts can action allocations quickly.");
  if (!writeUpComplete) recommendations.push("Finish technician write-up checks so handover is clean.");

  if (recommendations.length === 0) {
    recommendations.push("No critical blockers found. Review customer evidence quality and proceed to next workflow step.");
  }

  return {
    totals: {
      totalRows: actionableRows.length,
      resolved,
      declined,
      authorisedNotComplete,
      awaitingDecision,
      pricingMissing,
    },
    blockers,
    recommendations,
  };
};

export default buildVhcTechnicianAssistantSummary;
