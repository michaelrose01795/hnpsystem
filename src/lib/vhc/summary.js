// file location: src/lib/vhc/summary.js
// Shared helpers for parsing technician VHC payloads and deriving dashboard-friendly summaries.

// ✅ Brand color mapping for high-level VHC status badges
export const STATUS_COLORS = {
  "VHC not started": "var(--info)",
  "In progress": "var(--info)",
  "Waiting for parts": "var(--danger)",
  "Sent to customer": "var(--accent-purple)",
  "Awaiting approval": "var(--warning)",
  Approved: "var(--info)",
  Declined: "var(--danger)",
  Completed: "var(--info)",
};

// ✅ Canonical list of workflow statuses that should appear on VHC surfaces
export const VALID_VHC_STATUSES = [
  "VHC not started",
  "In progress",
  "Waiting for parts",
  "Sent to customer",
  "Awaiting approval",
  "Approved",
  "Declined",
  "Completed",
];

// ✅ Severity priority map so we can compare statuses consistently
export const STATUS_PRIORITY = { Red: 3, Amber: 2, Green: 1, Grey: 0 };

// ✅ Friendly labels for each wheel position so the dashboard matches technician language
const WHEEL_LABELS = {
  NSF: "NSF Wheel",
  OSF: "OSF Wheel",
  NSR: "NSR Wheel",
  OSR: "OSR Wheel",
};

// ✅ Human readable mapping for spare wheel / repair kit types
const SPARE_TYPE_LABELS = {
  spare: "Full-size Spare",
  repair_kit: "Tyre Repair Kit",
  space_saver: "Space Saver",
  boot_full: "Boot Full",
  not_checked: "Not Checked",
};

// ✅ Friendly names for the service indicator choices captured in the modal
const SERVICE_CHOICE_LABELS = {
  reset: "Service Reminder Reset",
  not_required: "Service Reminder Not Required",
  no_reminder: "No Service Reminder",
  indicator_on: "Service Indicator On",
};

// ✅ Friendly names for service related concern sources
const SERVICE_SOURCE_LABELS = {
  service: "Service Reminder",
  oil: "Engine Oil",
  "Service reminder/Oil level": "Service reminder/Oil level",
};

// ✅ Headings for optional sections so the dashboard mirrors the technician workspace
const OPTIONAL_SECTION_TITLES = {
  externalInspection: "External",
  internalElectrics: "Internal",
  underside: "Underside",
};

// ✅ Normalise job status strings for consistent comparisons
const normaliseWorkflowLabel = (value) => (value ? value.toString().trim().toLowerCase() : "");

// ✅ Map raw job/workflow status into the dashboard-friendly buckets
export const deriveVhcDashboardStatus = ({ job = {}, workflow = null, hasChecks = false }) => {
  const jobStatus = normaliseWorkflowLabel(job.status);
  const workflowStatus = normaliseWorkflowLabel(workflow?.status);
  const vhcChecksCount = typeof workflow?.vhcChecksCount === "number" ? workflow.vhcChecksCount : 0;
  const jobCheckCount = Array.isArray(job.vhcChecks) ? job.vhcChecks.length : 0;
  const authorizationCount = Number.isFinite(Number(workflow?.authorizationCount))
    ? Number(workflow.authorizationCount)
    : 0;
  const declinationCount = Number.isFinite(Number(workflow?.declinationCount))
    ? Number(workflow.declinationCount)
    : 0;
  const hasSentTimestamp = Boolean(workflow?.vhcSentAt || workflow?.lastSentAt || job.vhcSentAt);
  const completedAt = workflow?.vhcCompletedAt || job.vhcCompletedAt;

  const statusIncludes = (source, terms = []) => terms.some((term) => source.includes(term));

  const mapWorkflowStatus = (label) => {
    if (!label) return null;
    if (statusIncludes(label, ["vhc_complete", "vhc completed", "vhccomplete", "complete"])) {
      return "Completed";
    }
    if (statusIncludes(label, ["vhc_declined", "vhc declined"])) {
      return "Declined";
    }
    if (statusIncludes(label, ["vhc_approved", "vhc approved"])) {
      return "Approved";
    }
    if (statusIncludes(label, ["waiting_for_parts", "waiting for parts", "vhc_waiting"])) {
      return "Waiting for parts";
    }
    if (
      statusIncludes(label, ["vhc_sent_to_customer", "vhc sent to customer", "vhc_sent", "vhc sent"]) ||
      statusIncludes(label, ["sent_to_customer"])
    ) {
      return "Sent to customer";
    }
    if (statusIncludes(label, ["awaiting approval", "awaiting_authorization"])) {
      return "Awaiting approval";
    }
    if (
      statusIncludes(label, ["vhc_in_progress", "vhc sent to service", "vhc_sent_to_service", "vhc_priced", "vhc priced"]) ||
      statusIncludes(label, ["vhc"])
    ) {
      return "In progress";
    }
    return null;
  };

  if (completedAt) {
    return "Completed";
  }

  const mappedWorkflowStatus = mapWorkflowStatus(workflowStatus);
  if (mappedWorkflowStatus) {
    return mappedWorkflowStatus;
  }

  if (declinationCount > 0) {
    return "Declined";
  }

  if (authorizationCount > 0) {
    return "Approved";
  }

  const mappedJobStatus = mapWorkflowStatus(jobStatus);
  if (mappedJobStatus) {
    return mappedJobStatus;
  }

  if (hasSentTimestamp) {
    return "Awaiting approval";
  }

  if (vhcChecksCount > 0 || jobCheckCount > 0 || hasChecks) {
    return "In progress";
  }

  if (job.vhcRequired) {
    return "VHC not started";
  }

  return null;
};

// ✅ Normalise an incoming status string to a consistent label
export const normaliseStatus = (status) => {
  if (status === null || status === undefined) return null;
  const source = typeof status === "string" ? status : String(status);
  const raw = source.trim().toLowerCase();
  if (!raw) return null;
  switch (raw) {
    case "red":
      return "Red";
    case "amber":
    case "yellow":
    case "monitor":
      return "Amber";
    case "green":
    case "good":
    case "ok":
      return "Green";
    case "grey":
    case "gray":
    case "not checked":
      return "Grey";
    case "replace":
      return "Red";
    case "visual check":
      return "Amber";
    default:
      return source.trim().charAt(0).toUpperCase() + source.trim().slice(1);
  }
};

// ✅ Determine the most severe status from an array of values
export const determineDominantStatus = (statuses = []) => {
  let dominant = null;
  statuses.forEach((status) => {
    const normalised = normaliseStatus(status);
    if (!normalised) return;
    const priority = STATUS_PRIORITY[normalised];
    if (typeof priority === "number") {
      if (dominant === null || (STATUS_PRIORITY[dominant] ?? -1) < priority) {
        dominant = normalised;
      }
    } else if (!dominant) {
      dominant = normalised;
    }
  });
  return dominant;
};

// ✅ Standardise a concern entry so the renderer can treat them uniformly
const normaliseConcern = (concern) => {
  if (!concern || typeof concern !== "object") return null;
  const textSource = concern.text ?? concern.issue ?? concern.description ?? concern.note ?? "";
  const text = typeof textSource === "string" ? textSource.trim() : String(textSource || "").trim();
  if (!text) return null;
  const status = normaliseStatus(concern.status) || "Amber";
  return { status, text };
};

// ✅ Format comma separated measurements into a tidy mm string
const formatMeasurementList = (value) => {
  if (value === null || value === undefined) return null;
  const segments = Array.isArray(value) ? value : value.toString().split(/[, ]+/);
  const cleaned = segments
    .map((segment) => segment.toString().trim())
    .filter((segment) => segment !== "")
    .map((segment) => (segment.endsWith("mm") ? segment : `${segment}mm`));
  if (cleaned.length === 0) return null;
  return cleaned.join(" / ");
};

// ✅ Calculate the average tread depth for a tyre
const calculateAverageTread = (tread = {}) => {
  const values = ["outer", "middle", "inner"]
    .map((key) => {
      const reading = tread?.[key];
      const numeric = Number.parseFloat(reading);
      return Number.isFinite(numeric) ? numeric : null;
    })
    .filter((value) => value !== null);
  if (values.length === 0) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return average.toFixed(1);
};

const determineTreadSeverity = (tread = {}) => {
  const readings = ["outer", "middle", "inner"]
    .map((key) => {
      const value = Number.parseFloat(tread?.[key]);
      return Number.isFinite(value) ? value : null;
    })
    .filter((value) => value !== null);
  if (readings.length === 0) return null;
  const averageDepth = readings.reduce((sum, value) => sum + value, 0) / readings.length;
  if (averageDepth <= 2.5) return "Red";
  if (averageDepth <= 3.5) return "Amber";
  return "Green";
};

// ✅ Convert tread readings into a labelled bullet string
const formatTreadSegments = (tread = {}) => {
  const segments = [
    ["outer", "Outer"],
    ["middle", "Middle"],
    ["inner", "Inner"],
  ]
    .map(([key, label]) => {
      const reading = tread?.[key];
      if (reading === null || reading === undefined) return null;
      const readingText = reading.toString().trim();
      if (!readingText) return null;
      return `${label} ${readingText}${readingText.endsWith("mm") ? "" : "mm"}`;
    })
    .filter(Boolean);
  return segments.length > 0 ? segments.join(" • ") : null;
};

// ✅ Format spare tyre month/year into MM/YYYY for display
const formatSpareDate = (spare = {}) => {
  const month = spare.month;
  const year = spare.year;
  if (!month || !year) return null;
  const monthText = month.toString().padStart(2, "0");
  return `${monthText}/${year}`;
};

// ✅ Create a wheels & tyres section with measurement detail and concerns
const buildTyreSection = (tyres) => {
  if (!tyres || typeof tyres !== "object") return null;
  const items = [];
  let red = 0;
  let amber = 0;
  let grey = 0;

  const processWheel = (wheelKey) => {
    const tyre = tyres[wheelKey];
    if (!tyre || typeof tyre !== "object") return;
    const rows = [];
    if (tyre.manufacturer) rows.push(`Make: ${tyre.manufacturer}`);
    if (tyre.size) rows.push(`Size: ${tyre.size}`);
    const loadSpeed = [];
    if (tyre.load) loadSpeed.push(`Load ${tyre.load}`);
    if (tyre.speed) loadSpeed.push(`Speed ${tyre.speed}`);
    if (loadSpeed.length > 0) rows.push(loadSpeed.join(" • "));
    if (typeof tyre.runFlat === "boolean") {
      rows.push(`Run Flat: ${tyre.runFlat ? "Yes" : "No"}`);
    }
    const treadSummary = formatTreadSegments(tyre.tread);
    if (treadSummary) {
      rows.push(`Tread: ${treadSummary}`);
    }
    const averageTread = calculateAverageTread(tyre.tread);
    if (averageTread) {
      rows.push(`Average Tread: ${averageTread}mm`);
    }
    const concerns = Array.isArray(tyre.concerns)
      ? tyre.concerns.map(normaliseConcern).filter(Boolean)
      : [];
    concerns.forEach((concern) => {
      if (concern.status === "Red") red += 1;
      if (concern.status === "Amber") amber += 1;
      if (concern.status === "Grey") grey += 1;
    });
    const treadSeverity = determineTreadSeverity(tyre.tread);
    const status = determineDominantStatus([
      treadSeverity,
      ...concerns.map((concern) => concern.status),
    ]);
    if (rows.length === 0 && concerns.length === 0) return;
    items.push({
      heading: WHEEL_LABELS[wheelKey] || `${wheelKey} Wheel`,
      status: status || (rows.length > 0 ? "Green" : null),
      rows,
      concerns,
      wheelKey,
    });
  };

  ["NSF", "OSF", "NSR", "OSR"].forEach(processWheel);

  const spare = tyres.Spare;
  if (spare && typeof spare === "object") {
    const rows = [];
    const typeLabel = spare.type ? SPARE_TYPE_LABELS[spare.type] || spare.type : null;
    if (typeLabel) rows.push(`Type: ${typeLabel}`);
    if (spare.condition) rows.push(`Condition: ${spare.condition}`);
    const dateText = formatSpareDate(spare);
    if (dateText) rows.push(`Manufactured: ${dateText}`);
    if (spare.note) rows.push(`Notes: ${spare.note}`);
    const details = spare.details || {};
    if (details.manufacturer) rows.push(`Make: ${details.manufacturer}`);
    if (details.size) rows.push(`Size: ${details.size}`);
    const loadSpeed = [];
    if (details.load) loadSpeed.push(`Load ${details.load}`);
    if (details.speed) loadSpeed.push(`Speed ${details.speed}`);
    if (loadSpeed.length > 0) rows.push(loadSpeed.join(" • "));
    const spareConcerns = Array.isArray(spare.concerns)
      ? spare.concerns.map(normaliseConcern).filter(Boolean)
      : [];
    spareConcerns.forEach((concern) => {
      if (concern.status === "Red") red += 1;
      if (concern.status === "Amber") amber += 1;
      if (concern.status === "Grey") grey += 1;
    });
    const status = determineDominantStatus(spareConcerns.map((concern) => concern.status));
    if (rows.length > 0 || spareConcerns.length > 0) {
      items.push({
        heading: "Spare / Repair Kit",
        status: status || (rows.length > 0 ? "Green" : null),
        rows,
        concerns: spareConcerns,
      });
    }
  }

  if (items.length === 0) return null;

  return {
    key: "wheelsTyres",
    title: "Wheels & Tyres",
    type: "mandatory",
    metrics: { total: red + amber + grey, red, amber, grey },
    items,
  };
};

// ✅ Build a brakes & hubs section with pad/disc measurements
const buildBrakesSection = (brakes) => {
  if (!brakes || typeof brakes !== "object") return null;
  const items = [];
  let red = 0;
  let amber = 0;
  let grey = 0;

  const addPadSection = (key, label) => {
    const pad = brakes[key];
    if (!pad) return;
    const rows = [];
    const statusLabel = normaliseStatus(pad.status);
    const measurementText = formatMeasurementList(pad.measurement);
    if (measurementText) rows.push(`Pad measurements: ${measurementText}`);
    const concerns = Array.isArray(pad.concerns) ? pad.concerns.map(normaliseConcern).filter(Boolean) : [];
    concerns.forEach((concern) => {
      if (concern.status === "Red") red += 1;
      if (concern.status === "Amber") amber += 1;
      if (concern.status === "Grey") grey += 1;
    });
    if (!statusLabel && rows.length === 0 && concerns.length === 0) return;
    items.push({
      heading: label,
      status: statusLabel || determineDominantStatus(concerns.map((concern) => concern.status)),
      rows,
      concerns,
    });
  };

  const addDiscSection = (key, label) => {
    const disc = brakes[key];
    if (!disc) return;
    const rows = [];
    const measurementStatus = normaliseStatus(disc.measurements?.status);
    const visualStatus = normaliseStatus(disc.visual?.status);
    const thicknessValues = formatMeasurementList(disc.measurements?.values);
    if (thicknessValues) rows.push(`Measurements: ${thicknessValues}`);
    const visualNotes = (disc.visual?.notes || disc.visual?.note || "").trim();
    if (visualNotes) rows.push(`Visual: ${visualNotes}`);
    const concerns = Array.isArray(disc.concerns) ? disc.concerns.map(normaliseConcern).filter(Boolean) : [];
    concerns.forEach((concern) => {
      if (concern.status === "Red") red += 1;
      if (concern.status === "Amber") amber += 1;
      if (concern.status === "Grey") grey += 1;
    });
    const overallStatus = determineDominantStatus([
      measurementStatus,
      visualStatus,
      ...concerns.map((concern) => concern.status),
    ]);
    if (rows.length === 0 && concerns.length === 0 && !overallStatus) return;
    items.push({
      heading: label,
      status: overallStatus,
      rows,
      concerns,
    });
  };

  addPadSection("frontPads", "Front Pads");
  addPadSection("rearPads", "Rear Pads");
  addDiscSection("frontDiscs", "Front Discs");
  addDiscSection("rearDiscs", "Rear Discs");

  const rearDrums = brakes.rearDrums;
  if (rearDrums && typeof rearDrums === "object") {
    const drumStatus = normaliseStatus(rearDrums.status);
    const concerns = Array.isArray(rearDrums.concerns) ? rearDrums.concerns.map(normaliseConcern).filter(Boolean) : [];
    concerns.forEach((concern) => {
      if (concern.status === "Red") red += 1;
      if (concern.status === "Amber") amber += 1;
      if (concern.status === "Grey") grey += 1;
    });
    if (drumStatus || concerns.length > 0) {
      items.push({
        heading: "Rear Drums",
        status: drumStatus,
        rows: [],
        concerns,
      });
    }
  }

  if (items.length === 0) return null;

  return {
    key: "brakesHubs",
    title: "Brakes & Hubs",
    type: "mandatory",
    metrics: { total: red + amber + grey, red, amber, grey },
    items,
  };
};

// ✅ Build a service indicator/under bonnet section
const buildServiceIndicatorSection = (serviceSection) => {
  const entries = Array.isArray(serviceSection)
    ? serviceSection
    : serviceSection && typeof serviceSection === "object"
    ? [serviceSection]
    : [];
  if (entries.length === 0) return null;
  const items = [];
  let red = 0;
  let amber = 0;
  let grey = 0;

  entries.forEach((service) => {
    if (!service || typeof service !== "object") return;
    const derivedOilStatus =
      service.oilStatus === "Bad"
        ? "Red"
        : service.oilStatus === "Good" || service.oilStatus === "EV"
        ? "Green"
        : null;
    const badgeStatus =
      normaliseStatus(service.status) ||
      determineDominantStatus([service.serviceChoice, derivedOilStatus].filter(Boolean));
    const rows = [];
    if (service.serviceChoice) {
      const label = SERVICE_CHOICE_LABELS[service.serviceChoice] || service.serviceChoice;
      rows.push(label);
    }
    if (service.oilStatus) {
      rows.push(`Oil level: ${service.oilStatus}`);
      if (service.oilStatus === "Bad") red += 1;
      if (service.oilStatus === "Good" || service.oilStatus === "EV") grey += 1;
    }
    if (service.oilLevel) rows.push(`Oil level: ${service.oilLevel}`);
    if (service.oilCondition) rows.push(`Oil condition: ${service.oilCondition}`);
    if (service.notes) rows.push(service.notes);
    const concerns = Array.isArray(service.concerns)
      ? service.concerns.map((entry) => {
          const normalised = normaliseConcern(entry);
          if (!normalised) return null;
          const sourceLabel = entry.source && SERVICE_SOURCE_LABELS[entry.source] ? `${SERVICE_SOURCE_LABELS[entry.source]} – ` : "";
          return { ...normalised, text: `${sourceLabel}${normalised.text}` };
        })
      : [];
    concerns.filter(Boolean).forEach((entry) => {
      if (entry.status === "Red") red += 1;
      if (entry.status === "Amber") amber += 1;
      if (entry.status === "Grey") grey += 1;
    });
    items.push({
      heading: service.heading || "Service reminder / oil",
      status: badgeStatus,
      rows,
      concerns: concerns.filter(Boolean),
    });
  });

  if (items.length === 0) return null;

  return {
    key: "serviceIndicator",
    title: "Service Indicator & Under Bonnet",
    type: "mandatory",
    metrics: { total: red + amber + grey, red, amber, grey },
    items,
  };
};

// ✅ Build optional sections (external/internal/underside)
const buildOptionalConcernSection = (data, title, key) => {
  if (!data) return null;
  const items = [];
  let red = 0;
  let amber = 0;
  let grey = 0;

  const entryList = Array.isArray(data)
    ? data
    : typeof data === "object"
    ? Object.entries(data).map(([heading, entry]) => ({ heading, ...entry }))
    : [];

  entryList.forEach((entry) => {
    const baseHeading = entry.heading || entry.title || entry.name || "Inspection item";
    const baseRows = [];
    if (entry.notes) {
      const text = entry.notes.toString().trim();
      if (text) baseRows.push(text);
    }

    const rawConcerns = Array.isArray(entry?.concerns) ? entry.concerns : [];
    const concerns = rawConcerns.map(normaliseConcern).filter((concern) => concern);

    if (concerns.length > 0) {
      concerns.forEach((concern) => {
        if (concern.status === "Red") red += 1;
        if (concern.status === "Amber") amber += 1;
        if (concern.status === "Grey") grey += 1;
        items.push({
          heading: baseHeading,
          status: concern.status,
          rows: baseRows,
          concerns: [concern],
        });
      });
      return;
    }

    const derivedStatus = normaliseStatus(entry.status) || null;
    if (derivedStatus) {
      if (derivedStatus === "Red") red += 1;
      if (derivedStatus === "Amber") amber += 1;
      if (derivedStatus === "Grey") grey += 1;
      items.push({
        heading: baseHeading,
        status: derivedStatus,
        rows: baseRows,
        concerns: [],
      });
    }
  });

  if (items.length === 0) return null;

  return {
    key,
    title,
    type: "optional",
    metrics: { total: red + amber + grey, red, amber, grey },
    items,
  };
};

// ✅ Summarise the full technician VHC payload into dashboard friendly sections
export const summariseTechnicianVhc = (vhcData) => {
  if (!vhcData || typeof vhcData !== "object") {
    return { sections: [], totals: { total: 0, red: 0, amber: 0, grey: 0 }, itemCount: 0 };
  }

  const sections = [];
  const totals = { total: 0, red: 0, amber: 0, grey: 0 };
  let itemCount = 0;

  const pushSection = (section) => {
    if (!section) return;
    sections.push(section);
    totals.red += section.metrics?.red || 0;
    totals.amber += section.metrics?.amber || 0;
    totals.grey += section.metrics?.grey || 0;
    totals.total += section.metrics?.total || 0;
    itemCount += section.items?.length || 0;
  };

  pushSection(buildTyreSection(vhcData.wheelsTyres));
  pushSection(buildBrakesSection(vhcData.brakesHubs));
  pushSection(buildServiceIndicatorSection(vhcData.serviceIndicator));

  Object.entries(OPTIONAL_SECTION_TITLES).forEach(([key, sectionTitle]) => {
    pushSection(buildOptionalConcernSection(vhcData[key], sectionTitle, key));
  });

  return { sections, totals, itemCount };
};

// ✅ Roll up severity counts from sections and legacy checks to expose Red/Amber/Grey totals
export const computeSeverityTotals = ({ builderSummary, checks, legacyRedIssues = 0, legacyAmberIssues = 0 }) => {
  const totals = { red: 0, amber: 0, grey: 0 };

  const recordStatus = (value) => {
    const normalised = normaliseStatus(value);
    if (normalised === "Red") totals.red += 1;
    else if (normalised === "Amber") totals.amber += 1;
    else if (normalised === "Grey" || normalised === "Neutral") totals.grey += 1;
  };

  (builderSummary?.sections || []).forEach((section) => {
    (section.items || []).forEach((item) => {
      recordStatus(item.status);
      (item.concerns || []).forEach((concern) => recordStatus(concern.status));
    });
  });

  (checks || []).forEach((check) => {
    if (check.section === "VHC_CHECKSHEET") return;
    const derived = determineDominantStatus([
      check.status,
      check.section,
      check.issueTitle,
      check.issueDescription,
    ]);
    recordStatus(derived);
  });

  totals.red += legacyRedIssues;
  totals.amber += legacyAmberIssues;

  return totals;
};

// ✅ Extract the technician VHC JSON blob from Supabase records
export const parseVhcBuilderPayload = (checks) => {
  if (!Array.isArray(checks)) return null;
  const record = checks.find((entry) => entry.section === "VHC_CHECKSHEET");
  if (!record) return null;
  const payload = record.data ?? record.issue_description ?? null;
  if (!payload) return null;
  if (typeof payload === "object") return payload;
  try {
    return JSON.parse(payload);
  } catch (_error) {
    return null;
  }
};
