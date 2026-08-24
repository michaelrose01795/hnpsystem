// file location: src/lib/vhc/brakeDiagramValues.js
// Derives the four brake-diagram button values from the selected axle components.

const DIAGRAM_SEVERITY_RANK = {
  Red: 1,
  Amber: 2,
  Green: 3,
  Replace: 1,
  Monitor: 2,
  Good: 3,
  critical: 1,
  advisory: 2,
  good: 3,
  unknown: 4,
};

const RANK_TO_DIAGRAM_STATUS = {
  1: "critical",
  2: "advisory",
  3: "good",
  4: "unknown",
};

const resolveDiagramRank = (value) => DIAGRAM_SEVERITY_RANK[value] ?? 4;
const mapRankToDiagramStatus = (rank) => RANK_TO_DIAGRAM_STATUS[rank] ?? "unknown";

const getConcernRank = (concerns = []) =>
  concerns.reduce(
    (minRank, concern) => Math.min(minRank, resolveDiagramRank(concern?.status)),
    4,
  );

const getPadStatus = (value) => {
  const reading = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(reading)) return "unknown";
  if (reading <= 2) return "critical";
  if (reading < 4) return "advisory";
  return "good";
};

const parsePadMeasurement = (measurement) => {
  const first = String(measurement || "")
    .split(/[, ]+/)
    .map((value) => value.trim())
    .find(Boolean);
  const parsed = parseFloat(first);
  return Number.isFinite(parsed) ? parsed : null;
};

const computeAxleSeverityRank = (padSection = {}, discSection = {}) => {
  const padMeasurement = String(padSection.measurement || "").trim();
  const padHasData =
    padMeasurement !== "" ||
    (Array.isArray(padSection.concerns) && padSection.concerns.length > 0) ||
    (padSection.status && padSection.status !== "Green");
  const discValues = Array.isArray(discSection.measurements?.values)
    ? discSection.measurements.values
    : [];
  const discHasMeasurement = discValues.some((value) => String(value || "").trim() !== "");
  const discHasData =
    discHasMeasurement ||
    (Array.isArray(discSection.concerns) && discSection.concerns.length > 0) ||
    ((discSection.measurements?.status || "Green") !== "Green") ||
    ((discSection.visual?.status || "Green") !== "Green");
  if (!padHasData && !discHasData) return 4;

  const discStatus =
    (discSection.tab || "measurements") === "visual"
      ? discSection.visual?.status
      : discSection.measurements?.status;

  return Math.min(
    resolveDiagramRank(getPadStatus(padSection.measurement)),
    resolveDiagramRank(padSection.status),
    getConcernRank(padSection.concerns || []),
    resolveDiagramRank(discStatus),
    getConcernRank(discSection.concerns || []),
  );
};

export const buildBrakeDiagramValues = (data = {}, showDrum = false) => {
  const frontSeverityRank = computeAxleSeverityRank(data.frontPads, data.frontDiscs);
  const frontValue = parsePadMeasurement(data.frontPads?.measurement);
  const frontEntry = {
    value: frontValue,
    severity: mapRankToDiagramStatus(frontSeverityRank),
  };

  if (showDrum) {
    const rearDrum = data.rearDrums || {};
    const rearDrumRank = Math.min(
      resolveDiagramRank(rearDrum.status),
      getConcernRank(rearDrum.concerns || []),
    );
    const rearEntry = {
      value: "drum",
      severity: mapRankToDiagramStatus(rearDrumRank),
      isDrum: true,
    };

    return { nsf: frontEntry, osf: frontEntry, nsr: rearEntry, osr: rearEntry };
  }

  const rearSeverityRank = computeAxleSeverityRank(data.rearPads, data.rearDiscs);
  const rearEntry = {
    value: parsePadMeasurement(data.rearPads?.measurement),
    severity: mapRankToDiagramStatus(rearSeverityRank),
  };

  return { nsf: frontEntry, osf: frontEntry, nsr: rearEntry, osr: rearEntry };
};
