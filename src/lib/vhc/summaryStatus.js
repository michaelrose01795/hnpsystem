import { normalizeDecision, normalizeSeverity as _normalizeSeverity } from "@/lib/vhc/vhcItemState"; // Canonical normalizers.

const normaliseColour = (value) => { // Delegates to canonical severity normalizer.
  return _normalizeSeverity(value); // Single source of truth.
};

export const normaliseDecisionStatus = (value) => { // Delegates to canonical decision normalizer.
  const result = normalizeDecision(value); // Use canonical normalizer.
  if (result) return result; // Return if recognized.
  // Legacy fallback: return the raw lowercased value for unrecognized inputs.
  if (!value) return null; // Null guard.
  const normalized = value.toString().trim().toLowerCase(); // Clean the input.
  return normalized || null; // Return raw or null.
};

export const resolveSeverityKey = (rawSeverity, displayStatus) => {
  const override = normaliseColour(displayStatus);
  if (override) return override;
  return normaliseColour(rawSeverity);
};

const parseNumericValue = (value) => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : 0;
};

export const buildVhcRowStatusView = ({
  decisionValue,
  rawSeverity,
  displayStatus,
  labourHoursValue,
  labourComplete,
  partsNotRequired,
  resolvedPartsCost,
  partsCost,
  totalOverride,
}) => {
  const decisionKey = normaliseDecisionStatus(decisionValue) || "pending";
  const severityKey = resolveSeverityKey(rawSeverity, displayStatus);
  const sectionKey =
    decisionKey === "authorized" || decisionKey === "completed"
      ? "authorized"
      : decisionKey === "declined"
      ? "declined"
      : severityKey;

  if (decisionKey === "completed") {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "approved",
      color: "var(--success)",
      label: "Completed",
      showTick: true,
    };
  }

  if (decisionKey === "authorized") {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "approved",
      color: "var(--success)",
      label: "Authorised",
    };
  }

  if (decisionKey === "declined") {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "declined",
      color: "var(--danger)",
      label: "Declined",
      showCross: true,
    };
  }

  if (decisionKey === "n/a") {
    return {
      decisionKey,
      severityKey,
      sectionKey: severityKey,
      dotStateKey: "approved",
      color: "var(--success)",
      label: "N/A",
      showTick: true,
    };
  }

  const hasLabour = Boolean(labourComplete) ||
    (labourHoursValue !== null && labourHoursValue !== undefined && labourHoursValue !== "");
  const hasCosts =
    (resolvedPartsCost ?? parseNumericValue(partsCost)) > 0 ||
    parseNumericValue(totalOverride) > 0 ||
    Boolean(partsNotRequired);

  const missingLabour = !hasLabour;
  const missingParts = !hasCosts;

  if (missingLabour && missingParts) {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "missing",
      color: "var(--warning-dark)",
      label: "Add labour & parts",
    };
  }

  if (missingLabour) {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "missing",
      color: "var(--warning-dark)",
      label: "Add labour",
    };
  }

  if (missingParts) {
    return {
      decisionKey,
      severityKey,
      sectionKey,
      dotStateKey: "missing",
      color: "var(--warning-dark)",
      label: "Add parts",
    };
  }

  return {
    decisionKey,
    severityKey,
    sectionKey,
    dotStateKey: "awaiting",
    color: "var(--warning)",
    label: "Awaiting customer decision",
  };
};
