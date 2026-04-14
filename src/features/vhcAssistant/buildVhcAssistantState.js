// file location: src/features/vhcAssistant/buildVhcAssistantState.js

import {
  ASSISTANT_STAGES,
  isActionableCheck,
  isCompleteFlag,
  normalizeDecision,
  normalizeSeverity,
  normalizeText,
  toNumber,
} from "./vhcAssistantRules";

const isMissingLabour = (row = {}) => toNumber(row?.labour_hours ?? row?.labourHours, 0) <= 0;

const isMissingParts = (row = {}) => {
  const raw = row?.parts_cost ?? row?.partsCost;
  if (raw === null || raw === undefined || raw === "") return true;
  return Number(raw) < 0;
};

const collectPartMap = (partsRows = []) => {
  const byVhcId = new Map();
  (Array.isArray(partsRows) ? partsRows : []).forEach((row) => {
    const vhcItemId = row?.vhc_item_id ?? row?.vhcItemId ?? row?.vhcId;
    if (vhcItemId === null || vhcItemId === undefined || vhcItemId === "") return;
    const key = String(vhcItemId);
    if (!byVhcId.has(key)) byVhcId.set(key, []);
    byVhcId.get(key).push(row);
  });
  return byVhcId;
};

const buildSectionCompletion = (sectionStatus = {}) => {
  const entries = Object.entries(sectionStatus || {});
  if (entries.length === 0) {
    return { total: 0, complete: 0, incompleteKeys: [] };
  }

  const incompleteKeys = entries
    .filter(([, value]) => normalizeText(value) !== "complete")
    .map(([key]) => key);

  return {
    total: entries.length,
    complete: entries.length - incompleteKeys.length,
    incompleteKeys,
  };
};

const calculateReadinessScore = ({
  sectionCompletion,
  unresolvedUrgent,
  missingLabour,
  missingParts,
  awaitingCustomerDecision,
  authorisedNotComplete,
  sentToCustomer,
  blockedByReadOnly,
}) => {
  let score = 100;

  if (sectionCompletion.total > 0) {
    const sectionPenalty = Math.round(((sectionCompletion.incompleteKeys.length || 0) / sectionCompletion.total) * 35);
    score -= sectionPenalty;
  }

  score -= Math.min(unresolvedUrgent * 10, 25);
  score -= Math.min(missingLabour * 8, 20);
  score -= Math.min(missingParts * 8, 20);
  score -= Math.min(awaitingCustomerDecision * 4, 12);
  score -= Math.min(authorisedNotComplete * 6, 15);

  if (sentToCustomer) score += 5;
  if (blockedByReadOnly) score -= 10;

  return Math.max(0, Math.min(100, score));
};

export const buildVhcAssistantState = ({
  checks = [],
  partsRows = [],
  sectionStatus = {},
  vhcRequired = true,
  vhcCompletedAt = null,
  sentToCustomer = false,
  canEdit = true,
  context = "internal",
  writeUpComplete = null,
} = {}) => {
  const actionableChecks = (Array.isArray(checks) ? checks : []).filter(isActionableCheck);
  const hasChecks = actionableChecks.length > 0;
  const partMap = collectPartMap(partsRows);

  const counters = {
    total: actionableChecks.length,
    red: 0,
    amber: 0,
    green: 0,
    grey: 0,
    pending: 0,
    awaitingCustomerDecision: 0,
    authorized: 0,
    declined: 0,
    completed: 0,
    unresolvedUrgent: 0,
    missingLabour: 0,
    missingParts: 0,
    authorisedWithoutLinkedParts: 0,
    authorisedNotComplete: 0,
  };

  actionableChecks.forEach((row) => {
    const severity = normalizeSeverity(row?.severity || row?.status || row?.health_status);
    const decision = normalizeDecision(row);
    const rowComplete = isCompleteFlag(row?.Complete ?? row?.complete) || decision === "completed";
    const rowId = row?.vhc_id ?? row?.vhcId;

    if (severity && Object.prototype.hasOwnProperty.call(counters, severity)) counters[severity] += 1;

    if (decision === "awaiting_customer_decision") counters.awaitingCustomerDecision += 1;
    if (decision === "authorized") counters.authorized += 1;
    if (decision === "declined") counters.declined += 1;
    if (rowComplete) counters.completed += 1;
    if (decision === "pending") counters.pending += 1;

    const urgent = severity === "red" || severity === "amber";
    const unresolved = urgent && !["declined", "completed"].includes(decision) && !rowComplete;
    if (unresolved) counters.unresolvedUrgent += 1;

    const labourMissing = unresolved && isMissingLabour(row);
    const partsMissing = unresolved && isMissingParts(row);
    if (labourMissing) counters.missingLabour += 1;
    if (partsMissing) counters.missingParts += 1;

    if (decision === "authorized" && !rowComplete) {
      counters.authorisedNotComplete += 1;
      const linked = rowId !== null && rowId !== undefined ? partMap.get(String(rowId)) : null;
      if (!linked || linked.length === 0) {
        counters.authorisedWithoutLinkedParts += 1;
      }
    }
  });

  const sectionCompletion = buildSectionCompletion(sectionStatus);
  const allSectionsComplete = sectionCompletion.total > 0 && sectionCompletion.incompleteKeys.length === 0;
  const canSendToCustomer =
    vhcRequired &&
    counters.awaitingCustomerDecision > 0 &&
    counters.missingLabour === 0 &&
    counters.missingParts === 0 &&
    allSectionsComplete;

  const blockedByReadOnly = !canEdit;
  const readinessScore = calculateReadinessScore({
    sectionCompletion,
    unresolvedUrgent: counters.unresolvedUrgent,
    missingLabour: counters.missingLabour,
    missingParts: counters.missingParts,
    awaitingCustomerDecision: counters.awaitingCustomerDecision,
    authorisedNotComplete: counters.authorisedNotComplete,
    sentToCustomer,
    blockedByReadOnly,
  });

  let stage = ASSISTANT_STAGES.NOT_STARTED;
  if (!vhcRequired) stage = ASSISTANT_STAGES.COMPLETED;
  else if (vhcCompletedAt) stage = ASSISTANT_STAGES.COMPLETED;
  else if (!hasChecks) stage = ASSISTANT_STAGES.NOT_STARTED;
  else if (!allSectionsComplete) stage = ASSISTANT_STAGES.DATA_CAPTURE_IN_PROGRESS;
  else if (counters.missingLabour > 0 || counters.missingParts > 0) stage = ASSISTANT_STAGES.REVIEW_REQUIRED;
  else if (counters.awaitingCustomerDecision > 0 && !sentToCustomer) stage = ASSISTANT_STAGES.READY_TO_SEND;
  else if (counters.awaitingCustomerDecision > 0 && sentToCustomer) stage = ASSISTANT_STAGES.SENT_WAITING_RESPONSE;
  else if (counters.authorisedNotComplete > 0) stage = ASSISTANT_STAGES.AUTHORISED_WORK_IN_PROGRESS;
  else if (counters.authorized > 0 || counters.declined > 0) stage = ASSISTANT_STAGES.DECISIONS_RECEIVED;

  const blockers = [];
  if (blockedByReadOnly) blockers.push("This job is read-only; VHC updates are locked.");
  if (sectionCompletion.incompleteKeys.length > 0) {
    blockers.push(`${sectionCompletion.incompleteKeys.length} VHC section(s) still incomplete.`);
  }
  if (counters.missingLabour > 0) blockers.push(`${counters.missingLabour} urgent item(s) still missing labour time.`);
  if (counters.missingParts > 0) blockers.push(`${counters.missingParts} urgent item(s) still missing parts handling.`);
  if (counters.authorisedWithoutLinkedParts > 0) {
    blockers.push(`${counters.authorisedWithoutLinkedParts} authorised item(s) have no linked parts row.`);
  }

  const stageLabels = {
    [ASSISTANT_STAGES.NOT_STARTED]: "VHC not started",
    [ASSISTANT_STAGES.DATA_CAPTURE_IN_PROGRESS]: "Data capture in progress",
    [ASSISTANT_STAGES.REVIEW_REQUIRED]: "Review needed before customer-ready",
    [ASSISTANT_STAGES.READY_TO_SEND]: "Ready to send to customer",
    [ASSISTANT_STAGES.AWAITING_CUSTOMER_DECISION]: "Awaiting customer decision",
    [ASSISTANT_STAGES.SENT_WAITING_RESPONSE]: "Sent and waiting for customer response",
    [ASSISTANT_STAGES.DECISIONS_RECEIVED]: "Customer decisions received",
    [ASSISTANT_STAGES.AUTHORISED_WORK_IN_PROGRESS]: "Authorised work in progress",
    [ASSISTANT_STAGES.COMPLETED]: "VHC complete",
  };

  return {
    context,
    stage,
    stageLabel: stageLabels[stage] || "VHC in progress",
    readinessScore,
    counters,
    sectionCompletion,
    allSectionsComplete,
    canSendToCustomer,
    sentToCustomer,
    hasChecks,
    blockedByReadOnly,
    blockers,
    writeUpComplete: typeof writeUpComplete === "boolean" ? writeUpComplete : null,
  };
};

export default buildVhcAssistantState;
