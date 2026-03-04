const normaliseColour = (value) => {
  if (!value) return null;
  const colour = value.toString().toLowerCase();
  if (colour.includes("red")) return "red";
  if (colour.includes("amber") || colour.includes("yellow")) return "amber";
  if (colour.includes("green")) return "green";
  if (colour.includes("grey") || colour.includes("gray")) return "grey";
  return null;
};

export const normaliseDecisionStatus = (value) => {
  if (!value) return null;
  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "n/a" || normalized === "na" || normalized === "not applicable") {
    return "n/a";
  }
  if (
    normalized === "authorised" ||
    normalized === "authorized" ||
    normalized === "approved" ||
    normalized.includes("authorised") ||
    normalized.includes("authorized")
  ) {
    return "authorized";
  }
  if (
    normalized === "declined" ||
    normalized === "decline" ||
    normalized === "declinded" ||
    normalized.includes("declin")
  ) {
    return "declined";
  }
  if (
    normalized === "completed" ||
    normalized === "complete" ||
    normalized.includes("complet")
  ) {
    return "completed";
  }
  if (normalized === "pending" || normalized.includes("pending")) return "pending";
  return normalized;
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
