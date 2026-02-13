const DETECTED_JOB_TYPE_LABELS = {
  EML: "EML",
  SERVICE: "Service",
  TPMS: "TPMS",
  WIPERS: "Wipers",
  AUDIO: "Audio",
  HVAC_VENTS: "HVAC / Vents",
  STEERING: "Steering",
  SUSPENSION: "Suspension",
  NUMBER_PLATE: "Number Plate",
  BODYWORK_REPAIR: "Bodywork Repair",
  TRIM_INTERIOR: "Interior Trim",
  TRIM_EXTERIOR: "Exterior Trim",
  WHEELS_TYRES: "Wheels / Tyres",
  BRAKES: "Brakes",
  DIAGNOSIS: "Diagnosis",
  OTHER: "Other",
};

const toText = (value) => (value === null || value === undefined ? "" : String(value).trim());

export const formatDetectedJobTypeLabel = (value = "") => {
  const key = toText(value).toUpperCase();
  if (!key) return "";
  if (DETECTED_JOB_TYPE_LABELS[key]) {
    return DETECTED_JOB_TYPE_LABELS[key];
  }
  return key
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const extractRequestText = (requests) => {
  if (!requests) return "";
  if (Array.isArray(requests)) {
    return requests
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") {
          return entry.text || entry.description || entry.note || entry.label || "";
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }
  if (typeof requests === "string") {
    try {
      const parsed = JSON.parse(requests);
      if (Array.isArray(parsed)) {
        return extractRequestText(parsed);
      }
    } catch {
      return requests;
    }
    return requests;
  }
  if (typeof requests === "object") {
    return Object.values(requests)
      .map((entry) => (typeof entry === "string" ? entry : ""))
      .filter(Boolean)
      .join(" ");
  }
  return "";
};

export const deriveJobTypeDisplay = (job = {}, options = {}) => {
  const includeExtraCount = options.includeExtraCount !== false;
  const fallback = options.fallback || "Other";
  const categories = Array.isArray(job?.jobCategories) ? job.jobCategories : [];

  // Primary source: AI detections persisted from create flow into jobs.job_categories
  if (categories.length > 0) {
    const primary = formatDetectedJobTypeLabel(categories[0]);
    if (primary) {
      const remaining = Math.max(0, categories.length - 1);
      if (includeExtraCount && remaining > 0) {
        return `${primary} +${remaining}`;
      }
      return primary;
    }
  }

  const baseType = toText(job?.type).toLowerCase();
  if (baseType.includes("mot")) return "MOT";
  if (baseType.includes("service")) return "Service";
  if (baseType.includes("diag")) return "Diagnose";

  const haystack = [toText(job?.description), extractRequestText(job?.requests)]
    .join(" ")
    .toLowerCase();

  if (haystack.includes("mot")) return "MOT";
  if (haystack.includes("service") || haystack.includes("inspection") || haystack.includes("maintenance")) {
    return "Service";
  }
  if (haystack.includes("diagnos") || haystack.includes("fault") || haystack.includes("warning")) {
    return "Diagnose";
  }

  return fallback;
};

