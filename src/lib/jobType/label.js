const normalizeJobTypeKey = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const acronymLabels = new Set(["EML", "TPMS", "MOT", "ABS", "HVAC"]);

export const formatDetectedJobTypeLabel = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const normalized = raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized
    .split(" ")
    .map((segment) => {
      const upper = segment.toUpperCase();
      if (acronymLabels.has(upper)) return upper;
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join(" ");
};

const JOB_TYPE_KEYWORDS = [
  { label: "MOT", keywords: ["mot"] },
  { label: "Service", keywords: ["service", "oil", "inspection", "maintenance"] },
  { label: "Diagnose", keywords: ["diagnos", "fault", "warning", "investigation", "check"] },
];

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
      .map((value) => (typeof value === "string" ? value : ""))
      .filter(Boolean)
      .join(" ");
  }
  return "";
};

export const deriveJobTypeLabelFromJob = (job = {}) => {
  const rawCategories = Array.isArray(job?.jobCategories) ? job.jobCategories : [];

  if (rawCategories.length > 0) {
    const formatted = Array.from(
      new Set(
        rawCategories
          .map((entry) => formatDetectedJobTypeLabel(entry))
          .filter(Boolean)
      )
    );
    if (formatted.length > 0) return formatted.join(", ");
  }

  const categories = rawCategories.map(normalizeJobTypeKey);
  if (categories.some((category) => category.includes("mot"))) return "MOT";
  if (categories.some((category) => category.includes("service"))) return "Service";
  if (categories.some((category) => category.includes("diag"))) return "Diagnose";

  const requestText = extractRequestText(job?.requests);
  const haystack = [job?.description || "", requestText].join(" ").toLowerCase();
  for (const mapping of JOB_TYPE_KEYWORDS) {
    if (mapping.keywords.some((keyword) => haystack.includes(keyword))) {
      return mapping.label;
    }
  }

  const baseType = normalizeJobTypeKey(job?.type);
  if (baseType.includes("mot")) return "MOT";
  if (baseType.includes("service")) return "Service";
  if (baseType.includes("diag")) return "Diagnose";

  return "Other";
};
