// file location: src/features/vhcAssistant/vhcAssistantRules.js

export const ASSISTANT_STAGES = {
  NOT_STARTED: "not_started",
  DATA_CAPTURE_IN_PROGRESS: "data_capture_in_progress",
  REVIEW_REQUIRED: "review_required",
  READY_TO_SEND: "ready_to_send",
  AWAITING_CUSTOMER_DECISION: "awaiting_customer_decision",
  SENT_WAITING_RESPONSE: "sent_waiting_response",
  DECISIONS_RECEIVED: "decisions_received",
  AUTHORISED_WORK_IN_PROGRESS: "authorised_work_in_progress",
  COMPLETED: "completed",
};

const COMPLETE_FLAGS = new Set(["true", "1", "yes", "y", "complete", "completed"]);

export const normalizeText = (value = "") => String(value || "").trim().toLowerCase();

export const normalizeSeverity = (value = "") => {
  const raw = normalizeText(value);
  if (["red", "r", "danger", "urgent"].includes(raw)) return "red";
  if (["amber", "orange", "yellow", "advisory", "warning"].includes(raw)) return "amber";
  if (["green", "ok", "okay", "good", "passed"].includes(raw)) return "green";
  if (["grey", "gray", "na", "n/a", "not_applicable"].includes(raw)) return "grey";
  return "";
};

export const normalizeDecision = (row = {}) => {
  const decision =
    normalizeText(row?.authorization_state) ||
    normalizeText(row?.authorizationState) ||
    normalizeText(row?.approval_status) ||
    normalizeText(row?.approvalStatus) ||
    normalizeText(row?.display_status) ||
    normalizeText(row?.displayStatus);

  if (["authorized", "authorised"].includes(decision)) return "authorized";
  if (decision === "declined") return "declined";
  if (decision === "completed") return "completed";
  if (["awaiting_customer_decision", "awaiting customer decision", "awaiting decision"].includes(decision)) {
    return "awaiting_customer_decision";
  }
  if (["pending", "", "unknown"].includes(decision)) return "pending";
  return decision;
};

export const isCompleteFlag = (value) => {
  if (value === true || value === 1) return true;
  return COMPLETE_FLAGS.has(normalizeText(value));
};

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const isActionableCheck = (row = {}) => {
  const section = normalizeText(row?.section);
  return section !== "vhc_checksheet" && section !== "vhc checksheet";
};
