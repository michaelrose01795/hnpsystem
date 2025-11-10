// file location: src/pages/vhc/dashboard.js
"use client";

import React, { useEffect, useState } from "react"; // import React hooks for stateful UI
import Layout from "../../components/Layout"; // import shared layout component
import { useRouter } from "next/router"; // import router hook for navigation
import { getAllJobs } from "../../lib/database/jobs"; // import Supabase helper to fetch jobs
import { getVhcChecksByJob } from "../../lib/database/vhc"; // import Supabase helper to fetch technician VHC data (note: lowercase 'hc')
import { useUser } from "../../context/UserContext"; // import context hook to read current user roles

// ✅ Status color mapping for the headline badge
const STATUS_COLORS = {
  Outstanding: "#9ca3af",
  Accepted: "#d10000",
  "In Progress": "#3b82f6",
  "Awaiting Authorization": "#fbbf24",
  Authorized: "#9333ea",
  Ready: "#10b981",
  "Carry Over": "#f97316",
  Complete: "#06b6d4",
  Sent: "#8b5cf6",
  Viewed: "#06b6d4",
  "Parts Request": "#f97316",
};

// ✅ Severity priority map so we can compare statuses consistently
const STATUS_PRIORITY = { Red: 3, Amber: 2, Green: 1, Grey: 0 };

// ✅ Badge palette used to keep all severity chips on brand
const ITEM_STATUS_COLORS = {
  Red: { background: "rgba(239,68,68,0.16)", color: "#ef4444", border: "rgba(239,68,68,0.32)" },
  Amber: { background: "rgba(245,158,11,0.16)", color: "#b45309", border: "rgba(245,158,11,0.32)" },
  Green: { background: "rgba(16,185,129,0.16)", color: "#059669", border: "rgba(16,185,129,0.32)" },
  Neutral: { background: "rgba(107,114,128,0.16)", color: "#374151", border: "rgba(107,114,128,0.28)" },
};

// ✅ Text color palette for individual concern lines
const CONCERN_STATUS_COLORS = {
  Red: "#ef4444",
  Amber: "#b45309",
  Green: "#059669",
  Grey: "#6b7280",
};

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
};

// ✅ Headings for optional sections so the dashboard mirrors the technician workspace
const OPTIONAL_SECTION_TITLES = {
  externalInspection: "External / Drive-in Inspection",
  internalElectrics: "Internal / Lamps / Electrics",
  underside: "Underside Inspection",
};

// ✅ Normalise an incoming status string to a consistent label
const normaliseStatus = (status) => {
  if (status === null || status === undefined) return null; // skip undefined entries
  const source = typeof status === "string" ? status : String(status); // ensure we are working with a string
  const raw = source.trim().toLowerCase(); // lowercase for comparison
  if (!raw) return null; // nothing to do with empty strings
  switch (raw) {
    case "red":
      return "Red"; // critical issue
    case "amber":
    case "yellow":
    case "monitor":
      return "Amber"; // advisory issue
    case "green":
    case "good":
    case "ok":
      return "Green"; // passed check
    case "grey":
    case "gray":
    case "not checked":
      return "Grey"; // not inspected
    case "replace":
      return "Red"; // drum selector maps to replace
    case "visual check":
      return "Amber"; // drum selector visual check
    default:
      return source.trim().charAt(0).toUpperCase() + source.trim().slice(1); // fall back to capitalised string
  }
};

// ✅ Determine the most severe status from an array of values
const determineDominantStatus = (statuses = []) => {
  let dominant = null; // hold the current most severe status
  statuses.forEach((status) => {
    const normalised = normaliseStatus(status); // convert to consistent casing
    if (!normalised) return; // skip blanks
    const priority = STATUS_PRIORITY[normalised]; // read severity priority
    if (typeof priority === "number") {
      if (dominant === null || (STATUS_PRIORITY[dominant] ?? -1) < priority) {
        dominant = normalised; // replace with higher priority status
      }
    } else if (!dominant) {
      dominant = normalised; // keep descriptive labels like "Service Reminder" when no severity yet
    }
  });
  return dominant; // return the most relevant status
};

// ✅ Standardise a concern entry so the renderer can treat them uniformly
const normaliseConcern = (concern) => {
  if (!concern || typeof concern !== "object") return null; // guard invalid shapes
  const textSource =
    concern.text ?? concern.issue ?? concern.description ?? concern.note ?? ""; // pick the first available description
  const text = typeof textSource === "string" ? textSource.trim() : String(textSource || "").trim(); // coerce to string
  if (!text) return null; // ignore empty text
  const status = normaliseStatus(concern.status) || "Amber"; // default to amber when unknown
  return { status, text }; // return the cleaned concern object
};

// ✅ Format comma separated measurements into a tidy mm string
const formatMeasurementList = (value) => {
  if (value === null || value === undefined) return null; // skip undefined
  const segments = Array.isArray(value) ? value : value.toString().split(/[, ]+/); // support string or array input
  const cleaned = segments
    .map((segment) => segment.toString().trim()) // trim whitespace
    .filter((segment) => segment !== "") // remove blanks
    .map((segment) => (segment.endsWith("mm") ? segment : `${segment}mm`)); // ensure we display mm suffix
  if (cleaned.length === 0) return null; // nothing to show
  return cleaned.join(" / "); // join with slashes for readability
};

// ✅ Calculate the average tread depth for a tyre
const calculateAverageTread = (tread = {}) => {
  const values = ["outer", "middle", "inner"]
    .map((key) => {
      const reading = tread?.[key]; // read each position
      const numeric = Number.parseFloat(reading); // convert to number
      return Number.isFinite(numeric) ? numeric : null; // keep valid numbers only
    })
    .filter((value) => value !== null); // drop nulls
  if (values.length === 0) return null; // nothing recorded
  const average = values.reduce((sum, value) => sum + value, 0) / values.length; // arithmetic mean
  return average.toFixed(1); // show single decimal place
};

// ✅ Convert tread readings into a labelled bullet string
const formatTreadSegments = (tread = {}) => {
  const segments = [
    ["outer", "Outer"],
    ["middle", "Middle"],
    ["inner", "Inner"],
  ]
    .map(([key, label]) => {
      const reading = tread?.[key]; // read the value for this position
      if (reading === null || reading === undefined) return null; // skip missing values
      const readingText = reading.toString().trim(); // convert to string
      if (!readingText) return null; // skip blank strings
      return `${label} ${readingText}${readingText.endsWith("mm") ? "" : "mm"}`; // append mm suffix when needed
    })
    .filter(Boolean); // remove nulls
  return segments.length > 0 ? segments.join(" • ") : null; // join using bullet separator
};

// ✅ Format spare tyre month/year into MM/YYYY for display
const formatSpareDate = (spare = {}) => {
  const month = spare.month; // read month value
  const year = spare.year; // read year value
  if (!month || !year) return null; // skip if either is missing
  const monthText = month.toString().padStart(2, "0"); // ensure double digit month
  return `${monthText}/${year}`; // build final formatted string
};

// ✅ Create a wheels & tyres section with measurement detail and concerns
const buildTyreSection = (tyres) => {
  if (!tyres || typeof tyres !== "object") return null; // guard missing data
  const items = []; // store cards for each wheel
  let red = 0; // count red concerns
  let amber = 0; // count amber concerns

  const processWheel = (wheelKey) => {
    const tyre = tyres[wheelKey]; // pull tyre data for this wheel
    if (!tyre || typeof tyre !== "object") return; // skip missing entries
    const rows = []; // description rows
    if (tyre.manufacturer) rows.push(`Make: ${tyre.manufacturer}`); // include manufacturer
    if (tyre.size) rows.push(`Size: ${tyre.size}`); // include size
    const loadSpeed = []; // collect load and speed ratings
    if (tyre.load) loadSpeed.push(`Load ${tyre.load}`); // add load rating
    if (tyre.speed) loadSpeed.push(`Speed ${tyre.speed}`); // add speed rating
    if (loadSpeed.length > 0) rows.push(loadSpeed.join(" • ")); // show combined load/speed
    if (typeof tyre.runFlat === "boolean") {
      rows.push(`Run Flat: ${tyre.runFlat ? "Yes" : "No"}`); // note run-flat flag
    }
    const treadSummary = formatTreadSegments(tyre.tread); // build tread detail string
    if (treadSummary) {
      rows.push(`Tread: ${treadSummary}`); // include tread readings
    }
    const averageTread = calculateAverageTread(tyre.tread); // compute average tread
    if (averageTread) {
      rows.push(`Average Tread: ${averageTread}mm`); // include average tread depth
    }
    const concerns = Array.isArray(tyre.concerns)
      ? tyre.concerns.map(normaliseConcern).filter(Boolean)
      : []; // normalise concerns for this wheel
    concerns.forEach((concern) => {
      if (concern.status === "Red") red += 1; // accumulate red issues
      if (concern.status === "Amber") amber += 1; // accumulate amber issues
    });
    const status = determineDominantStatus(
      concerns.map((concern) => concern.status),
    ); // determine highest severity for the wheel
    if (rows.length === 0 && concerns.length === 0) return; // skip empty cards
    items.push({
      heading: WHEEL_LABELS[wheelKey] || `${wheelKey} Wheel`, // card heading
      status: status || (rows.length > 0 ? "Green" : null), // show green badge when data present but no issues
      rows, // descriptive rows
      concerns, // concern list
    });
  };

  ["NSF", "OSF", "NSR", "OSR"].forEach(processWheel); // iterate over each main wheel

  const spare = tyres.Spare; // spare or repair kit data
  if (spare && typeof spare === "object") {
    const rows = []; // spare card rows
    const typeLabel = spare.type ? SPARE_TYPE_LABELS[spare.type] || spare.type : null; // translate spare type
    if (typeLabel) rows.push(`Type: ${typeLabel}`); // include spare type
    if (spare.condition) rows.push(`Condition: ${spare.condition}`); // include condition text
    const dateText = formatSpareDate(spare); // format month/year
    if (dateText) rows.push(`Manufactured: ${dateText}`); // include manufacture date
    if (spare.note) rows.push(`Notes: ${spare.note}`); // include technician notes
    const details = spare.details || {}; // nested spare tyre details
    if (details.manufacturer) rows.push(`Make: ${details.manufacturer}`); // include make
    if (details.size) rows.push(`Size: ${details.size}`); // include size
    const loadSpeed = []; // load/speed for spare
    if (details.load) loadSpeed.push(`Load ${details.load}`);
    if (details.speed) loadSpeed.push(`Speed ${details.speed}`);
    if (loadSpeed.length > 0) rows.push(loadSpeed.join(" • "));
    const spareConcerns = Array.isArray(spare.concerns)
      ? spare.concerns.map(normaliseConcern).filter(Boolean)
      : []; // normalise spare concerns
    spareConcerns.forEach((concern) => {
      if (concern.status === "Red") red += 1; // accumulate red issues
      if (concern.status === "Amber") amber += 1; // accumulate amber issues
    });
    const status = determineDominantStatus(spareConcerns.map((concern) => concern.status)); // highest severity for spare
    if (rows.length > 0 || spareConcerns.length > 0) {
      items.push({
        heading: "Spare / Repair Kit", // card heading
        status: status || (rows.length > 0 ? "Green" : null), // show badge when data present
        rows, // descriptive rows
        concerns: spareConcerns, // concern list
      });
    }
  }

  if (items.length === 0) return null; // skip section entirely if nothing recorded

  return {
    key: "wheelsTyres", // unique key for section rendering
    title: "Wheels & Tyres", // section heading text
    type: "mandatory", // mark as mandatory section
    metrics: { total: red + amber, red, amber }, // aggregated severity counts
    items, // card data for the renderer
  };
};

// ✅ Create a brakes & hubs section including pad/disc data and concerns
const buildBrakesSection = (brakes) => {
  if (!brakes || typeof brakes !== "object") return null; // guard missing data
  const items = []; // cards to render
  let red = 0; // red counter
  let amber = 0; // amber counter

  const appendPad = (key, label) => {
    const pad = brakes[key]; // read pad data
    if (!pad || typeof pad !== "object") return; // skip missing entries
    const rows = []; // descriptive rows
    const measurement = formatMeasurementList(pad.measurement); // format pad measurements
    if (measurement) rows.push(`Pad Measurement: ${measurement}`); // show measurement values
    const statusLabel = normaliseStatus(pad.status); // normalise pad status
    if (statusLabel) rows.push(`Status: ${statusLabel}`); // include status text
    if (statusLabel === "Red") red += 1; // pad status counts towards red
    if (statusLabel === "Amber") amber += 1; // pad status counts towards amber
    const concerns = Array.isArray(pad.concerns)
      ? pad.concerns.map(normaliseConcern).filter(Boolean)
      : []; // normalise pad concerns
    concerns.forEach((concern) => {
      if (concern.status === "Red") red += 1; // accumulate red concerns
      if (concern.status === "Amber") amber += 1; // accumulate amber concerns
    });
    const overallStatus = determineDominantStatus([
      statusLabel,
      ...concerns.map((concern) => concern.status),
    ]); // compute highest severity for the card
    if (rows.length === 0 && concerns.length === 0) return; // skip empty cards
    items.push({
      heading: label, // card heading
      status: overallStatus || (rows.length > 0 ? "Green" : null), // show severity badge
      rows, // descriptive rows
      concerns, // concerns to list under card
    });
  };

  appendPad("frontPads", "Front Pads"); // summarise front pads
  appendPad("rearPads", "Rear Pads"); // summarise rear pads

  const appendDisc = (key, label) => {
    const disc = brakes[key]; // read disc data
    if (!disc || typeof disc !== "object") return; // skip missing entries
    const rows = []; // descriptive rows
    const measurement = formatMeasurementList(
      disc.measurements?.thickness || disc.measurements?.values,
    ); // format disc measurements
    if (measurement) rows.push(`Thickness: ${measurement}`); // include thickness string
    const measurementStatus = normaliseStatus(disc.measurements?.status); // measurement severity
    if (measurementStatus) rows.push(`Measurement: ${measurementStatus}`); // include measurement status text
    const visualStatus = normaliseStatus(disc.visual?.status); // visual inspection severity
    if (visualStatus) rows.push(`Visual: ${visualStatus}`); // include visual status text
    const discSeverity = determineDominantStatus([measurementStatus, visualStatus]); // combined severity for disc
    if (discSeverity === "Red") red += 1; // count red disc finding
    if (discSeverity === "Amber") amber += 1; // count amber disc finding
    const concerns = Array.isArray(disc.concerns)
      ? disc.concerns.map(normaliseConcern).filter(Boolean)
      : []; // normalise disc concerns
    concerns.forEach((concern) => {
      if (concern.status === "Red") red += 1; // accumulate red concerns
      if (concern.status === "Amber") amber += 1; // accumulate amber concerns
    });
    const overallStatus = determineDominantStatus([
      discSeverity,
      ...concerns.map((concern) => concern.status),
    ]); // compute dominant badge status
    if (rows.length === 0 && concerns.length === 0) return; // skip empty cards
    items.push({
      heading: label, // card heading
      status: overallStatus || (rows.length > 0 ? "Green" : null), // severity badge for disc
      rows, // descriptive rows
      concerns, // concern list
    });
  };

  appendDisc("frontDiscs", "Front Discs"); // summarise front discs
  appendDisc("rearDiscs", "Rear Discs"); // summarise rear discs

  const rearDrums = brakes.rearDrums; // rear drum summary data
  if (rearDrums && typeof rearDrums === "object" && rearDrums.status) {
    const drumStatus = normaliseStatus(rearDrums.status); // normalise drum status
    if (drumStatus === "Red") red += 1; // count replace recommendation as red
    if (drumStatus === "Amber") amber += 1; // count advisory as amber
    items.push({
      heading: "Rear Drums", // card heading
      status: drumStatus || "Neutral", // show severity badge if recognised
      rows: [`Condition: ${rearDrums.status}`], // display original status text for context
      concerns: [], // drums currently use single status rather than concern list
    });
  }

  if (items.length === 0) return null; // skip entire section if nothing recorded

  return {
    key: "brakesHubs", // unique key for renderer
    title: "Brakes & Hubs", // section heading
    type: "mandatory", // mark as mandatory section
    metrics: { total: red + amber, red, amber }, // severity totals for badges
    items, // cards to render
  };
};

// ✅ Create a section for service indicator & under bonnet checks
const buildServiceIndicatorSection = (service) => {
  if (!service || typeof service !== "object") return null; // guard missing data
  const items = []; // cards for this section
  let red = 0; // red concern count
  let amber = 0; // amber concern count

  const overviewRows = []; // overview card rows
  if (service.serviceChoice) {
    const label = SERVICE_CHOICE_LABELS[service.serviceChoice] || service.serviceChoice; // translate service choice
    overviewRows.push(`Service Reminder: ${label}`); // include service reminder choice
  }
  if (service.oilStatus) {
    overviewRows.push(`Oil Change: ${service.oilStatus}`); // include oil status choice
  }
  if (overviewRows.length > 0) {
    items.push({
      heading: "Service Overview", // card heading
      status: "Green", // service overview with no direct severity defaults to green
      rows: overviewRows, // descriptive rows
      concerns: [], // no concerns attached to overview card
    });
  }

  const grouped = new Map(); // group concerns by source so we get one card per area
  (Array.isArray(service.concerns) ? service.concerns : []).forEach((concern) => {
    const normalised = normaliseConcern(concern); // clean the concern entry
    if (!normalised) return; // skip empty concerns
    const key = concern.source || "General"; // group key for this concern
    const label = SERVICE_SOURCE_LABELS[key] || (typeof key === "string" ? key : "General"); // translate heading
    if (!grouped.has(key)) {
      grouped.set(key, {
        heading: label, // initial card heading
        status: normalised.status, // seed severity
        rows: [], // no additional rows required
        concerns: [], // store concern list
      });
    }
    const entry = grouped.get(key); // retrieve grouped card
    entry.concerns.push(normalised); // append concern to the card
    entry.status = determineDominantStatus([entry.status, normalised.status]); // update severity badge
    if (normalised.status === "Red") red += 1; // count red concern
    if (normalised.status === "Amber") amber += 1; // count amber concern
  });

  grouped.forEach((value) => {
    items.push(value); // append grouped concern cards to the section
  });

  if (items.length === 0) return null; // skip section if nothing captured

  return {
    key: "serviceIndicator", // unique key for renderer
    title: "Service Indicator & Under Bonnet", // section heading text
    type: "mandatory", // mark as mandatory
    metrics: { total: red + amber, red, amber }, // severity counts for badges
    items, // cards to render
  };
};

// ✅ Create an optional section (external, internal, underside) from concern lists
const buildOptionalConcernSection = (data, title, key) => {
  if (!data || typeof data !== "object") return null; // guard missing data
  const items = []; // cards to render
  let red = 0; // red concern counter
  let amber = 0; // amber concern counter

  Object.entries(data).forEach(([category, entry]) => {
    const rawConcerns = Array.isArray(entry?.concerns) ? entry.concerns : []; // raw concern list
    const concerns = rawConcerns
      .map(normaliseConcern)
      .filter((concern) => concern && (concern.status === "Red" || concern.status === "Amber")); // only keep amber/red concerns per requirements
    if (concerns.length === 0) return; // skip categories without actionable items
    concerns.forEach((concern) => {
      if (concern.status === "Red") red += 1; // accumulate red totals
      if (concern.status === "Amber") amber += 1; // accumulate amber totals
    });
    items.push({
      heading: category, // card heading uses the category label
      status: determineDominantStatus(concerns.map((concern) => concern.status)) || "Amber", // badge severity for the card
      rows: [], // optional sections rely on concern bullets only
      concerns, // list of concerns for the card
    });
  });

  if (items.length === 0) return null; // skip section entirely when nothing actionable

  return {
    key, // unique key for renderer
    title, // section heading text
    type: "optional", // mark as optional
    metrics: { total: red + amber, red, amber }, // severity totals used for badges
    items, // cards to render
  };
};

// ✅ Summarise the full technician VHC payload into dashboard friendly sections
const summariseTechnicianVhc = (vhcData) => {
  if (!vhcData || typeof vhcData !== "object") {
    return { sections: [], totals: { total: 0, red: 0, amber: 0 }, itemCount: 0 }; // default when no payload found
  }

  const sections = []; // collect section summaries
  const totals = { total: 0, red: 0, amber: 0 }; // aggregate severity totals
  let itemCount = 0; // count number of cards generated across all sections

  const pushSection = (section) => {
    if (!section) return; // skip null sections
    sections.push(section); // store section for rendering
    totals.red += section.metrics?.red || 0; // accumulate red totals
    totals.amber += section.metrics?.amber || 0; // accumulate amber totals
    totals.total += section.metrics?.total || 0; // accumulate overall actionable total
    itemCount += section.items?.length || 0; // accumulate total number of cards
  };

  pushSection(buildTyreSection(vhcData.wheelsTyres)); // append wheels & tyres section
  pushSection(buildBrakesSection(vhcData.brakesHubs)); // append brakes & hubs section
  pushSection(buildServiceIndicatorSection(vhcData.serviceIndicator)); // append service indicator section

  Object.entries(OPTIONAL_SECTION_TITLES).forEach(([key, title]) => {
    pushSection(buildOptionalConcernSection(vhcData[key], title, key)); // append optional sections when amber/red concerns exist
  });

  return { sections, totals, itemCount }; // return structured summary for the dashboard
};

// ✅ Extract the technician VHC JSON blob from Supabase records
const parseVhcBuilderPayload = (checks) => {
  if (!Array.isArray(checks)) return null; // guard invalid inputs
  const record = checks.find((entry) => entry.section === "VHC_CHECKSHEET"); // technician builder data lives in this section
  if (!record) return null; // bail if not present
  const payload = record.data ?? record.issue_description ?? null; // Supabase row stores JSON in issue_description
  if (!payload) return null; // skip empty rows
  if (typeof payload === "object") return payload; // already parsed
  try {
    return JSON.parse(payload); // attempt to parse JSON string
  } catch (error) {
    console.warn("⚠️ Unable to parse VHC builder payload:", error); // log parsing issue for debugging
    return null; // fall back gracefully
  }
};

// ✅ Helper function to get customer name
const getCustomerName = (customer) => {
  if (!customer) return "N/A"; // handle missing customer
  if (typeof customer === "string") return customer; // simple string
  if (typeof customer === "object") {
    return `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.email || "N/A"; // combine object fields
  }
  return "N/A"; // default fallback
};

// ✅ Get last visit bubble color
const getLastVisitColor = (lastVisitDate) => {
  if (!lastVisitDate || lastVisitDate === "First visit") return null; // no bubble for first visit

  const visitDate = new Date(lastVisitDate); // parse last visit date
  const today = new Date(); // current date
  const monthsDiff = (today - visitDate) / (1000 * 60 * 60 * 24 * 30); // approximate months difference

  if (monthsDiff <= 4) return "#10b981"; // recent visit -> green
  return "#fbbf24"; // otherwise amber
};

// ✅ Get next service bubble color
const getNextServiceColor = (nextServiceDate) => {
  if (!nextServiceDate || nextServiceDate === "Not scheduled") return null; // skip if unscheduled

  const serviceDate = new Date(nextServiceDate); // parse next service date
  const today = new Date(); // current date
  const monthsDiff = (serviceDate - today) / (1000 * 60 * 60 * 24 * 30); // approximate months until next service

  if (monthsDiff <= 1) return "#ef4444"; // due within a month -> red
  if (monthsDiff <= 3) return "#fbbf24"; // due within three months -> amber
  return "#10b981"; // plenty of time -> green
};

// ✅ Get MOT expiry bubble color
const getMOTColor = (motExpiry) => {
  if (!motExpiry) return null; // skip if no MOT date

  const expiryDate = new Date(motExpiry); // parse expiry date
  const today = new Date(); // current date
  const monthsDiff = (expiryDate - today) / (1000 * 60 * 60 * 24 * 30); // approximate months until expiry

  if (monthsDiff < 1) return "#ef4444"; // expires within a month -> red
  if (monthsDiff < 3) return "#fbbf24"; // expires within three months -> amber
  if (monthsDiff >= 4) return "#10b981"; // more than four months -> green
  return "#fbbf24"; // default amber
};

// ✅ Build badge styles for section/item badges
const buildBadgeStyle = (status) => {
  const palette = ITEM_STATUS_COLORS[status] || ITEM_STATUS_COLORS.Neutral; // choose palette or neutral fallback
  return {
    backgroundColor: palette.background, // badge background color
    color: palette.color, // badge text color
    border: `1px solid ${palette.border}`, // badge border color
    borderRadius: "999px", // pill badge shape
    padding: "2px 10px", // badge padding
    fontSize: "11px", // badge text size
    fontWeight: "600", // make it bold for clarity
    letterSpacing: "0.3px", // subtle spacing for readability
  };
};

// ✅ Resolve concern status color with safe fallback
const getConcernColor = (status) => CONCERN_STATUS_COLORS[status] || CONCERN_STATUS_COLORS.Grey;

// ✅ VHC Job Card Component
const VHCJobCard = ({ job, onClick, partsMode }) => {
  const lastVisitColor = getLastVisitColor(job.lastVisit); // determine color for last visit pill
  const nextServiceColor = getNextServiceColor(job.nextService); // determine color for next service pill
  const motColor = getMOTColor(job.motExpiry); // determine color for MOT pill
  const statusColor = STATUS_COLORS[job.vhcStatus] || "#9ca3af"; // pick brand color for status badge
  const showPartsCounter = partsMode || job.vhcStatus === "Parts Request"; // decide whether counter shows parts or checks
  const counterValue = showPartsCounter ? job.partsCount || 0 : job.sectionItemCount || 0; // derive counter value
  const counterLabel = showPartsCounter ? "Parts" : "Checks"; // counter label text
  const counterBackground = counterValue > 0
    ? showPartsCounter
      ? "#fef3c7"
      : "#e0f2fe"
    : "#f5f5f5"; // background color for counter pill
  const counterColor = counterValue > 0
    ? showPartsCounter
      ? "#b45309"
      : "#0369a1"
    : "#999"; // text color for counter pill

  const renderSectionMetrics = (section) => (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {section.metrics.red > 0 ? (
        <span style={{ ...buildBadgeStyle("Red"), fontSize: "10px" }}>
          {section.metrics.red} Red
        </span>
      ) : null}
      {section.metrics.amber > 0 ? (
        <span style={{ ...buildBadgeStyle("Amber"), fontSize: "10px" }}>
          {section.metrics.amber} Amber
        </span>
      ) : null}
    </div>
  );

  const renderSectionItem = (item, index) => {
    const badgeStyle = buildBadgeStyle(item.status || "Neutral"); // compute badge colors
    const showBadge = item.status && item.status !== "Neutral"; // hide neutral badges to reduce noise
    return (
      <div
        key={`${item.heading}-${index}`}
        style={{
          border: "1px solid #f3f4f6",
          borderRadius: "10px",
          backgroundColor: "#fff",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>{item.heading}</span>
          {showBadge ? <span style={badgeStyle}>{item.status}</span> : null}
        </div>
        {item.rows?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {item.rows.map((line, lineIdx) => (
              <span key={`${item.heading}-row-${lineIdx}`} style={{ fontSize: "12px", color: "#4b5563" }}>
                {line}
              </span>
            ))}
          </div>
        ) : null}
        {item.concerns?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {item.concerns.map((concern, concernIdx) => (
              <div
                key={`${item.heading}-concern-${concernIdx}`}
                style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}
              >
                <span style={{ fontSize: "10px", color: "#d1d5db", lineHeight: "18px" }}>•</span>
                <span style={{ fontSize: "12px", color: "#4b5563" }}>
                  <span style={{ fontWeight: "600", color: getConcernColor(concern.status) }}>
                    {concern.status}:
                  </span>{" "}
                  {concern.text}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      style={{
        border: "1px solid #ffe5e5",
        padding: "16px 20px",
        borderRadius: "12px",
        backgroundColor: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        cursor: "pointer",
        transition: "all 0.3s ease",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)"; // lift card on hover
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(209,0,0,0.15)"; // add red glow
        e.currentTarget.style.borderColor = "#ffb3b3"; // tint border red
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)"; // reset transform
        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)"; // reset shadow
        e.currentTarget.style.borderColor = "#ffe5e5"; // reset border color
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          width: "100%",
        }}
      >
        {/* Left Side - Vehicle and customer info */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", width: "600px", flexShrink: 0 }}>
          <div
            style={{
              backgroundColor: statusColor,
              color: "white",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
              whiteSpace: "nowrap",
              minWidth: "160px",
              textAlign: "center",
            }}
          >
            {job.vhcStatus}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#1a1a1a",
                  whiteSpace: "nowrap",
                }}
              >
                {job.reg || "N/A"}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  color: "#666",
                  whiteSpace: "nowrap",
                }}
              >
                {getCustomerName(job.customer)}
              </span>
            </div>
            <span
              style={{
                fontSize: "13px",
                color: "#999",
                whiteSpace: "nowrap",
              }}
            >
              {job.makeModel || "N/A"}
            </span>
          </div>
        </div>

        {/* Right Side - status metrics */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            flex: 1,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ textAlign: "center", minWidth: "90px" }}>
            {lastVisitColor ? (
              <div
                style={{
                  backgroundColor: lastVisitColor,
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                {job.lastVisit}
              </div>
            ) : (
              <span style={{ fontSize: "11px", color: "#ccc" }}>First visit</span>
            )}
          </div>

          <div style={{ textAlign: "center", minWidth: "90px" }}>
            {nextServiceColor ? (
              <div
                style={{
                  backgroundColor: nextServiceColor,
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                {job.nextService}
              </div>
            ) : (
              <span style={{ fontSize: "11px", color: "#ccc" }}>-</span>
            )}
          </div>

          <div style={{ textAlign: "center", minWidth: "90px" }}>
            {motColor ? (
              <div
                style={{
                  backgroundColor: motColor,
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                {job.motExpiry || "N/A"}
              </div>
            ) : (
              <span style={{ fontSize: "11px", color: "#ccc" }}>-</span>
            )}
          </div>

          <div style={{ width: "1px", height: "35px", backgroundColor: "#e5e5e5" }}></div>

          <div style={{ textAlign: "center", minWidth: "80px" }}>
            <div
              style={{
                backgroundColor: counterBackground,
                color: counterColor,
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                alignItems: "center",
              }}
            >
              <span>{counterValue}</span>
              <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {counterLabel}
              </span>
            </div>
          </div>

          {job.partsCount > 0 && (
            <div style={{ textAlign: "center", minWidth: "80px" }}>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#b45309",
                }}
              >
                £{job.partsValue || "0.00"}
              </span>
              <div
                style={{
                  fontSize: "10px",
                  color: "#b45309",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Parts
              </div>
            </div>
          )}

          <div style={{ textAlign: "center", minWidth: "70px" }}>
            <div
              style={{
                backgroundColor: "rgba(239,68,68,0.12)",
                color: "#ef4444",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                alignItems: "center",
              }}
            >
              <span>{job.redIssues || 0}</span>
              <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Red</span>
            </div>
          </div>

          <div style={{ textAlign: "center", minWidth: "70px" }}>
            <div
              style={{
                backgroundColor: "rgba(245,158,11,0.12)",
                color: "#b45309",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "600",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                alignItems: "center",
              }}
            >
              <span>{job.amberIssues || 0}</span>
              <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Amber</span>
            </div>
          </div>

          <div style={{ width: "1px", height: "35px", backgroundColor: "#e5e5e5" }}></div>

          <div
            style={{
              textAlign: "center",
              minWidth: "120px",
              fontSize: "11px",
              color: "#999",
            }}
          >
            {job.createdAt
              ? new Date(job.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A"}
          </div>
        </div>
      </div>

      {job.vhcSections?.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          {job.vhcSections.map((section) => (
            <div
              key={section.key}
              style={{
                flex: "1 1 260px",
                minWidth: "260px",
                borderRadius: "12px",
                border: "1px solid #ffe5e5",
                background: "linear-gradient(180deg,#fffafa,#fff5f5)",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#d10000" }}>{section.title}</span>
                {renderSectionMetrics(section)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {section.items.map((item, idx) => renderSectionItem(item, idx))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

// ✅ Status filter tabs used by the dashboard header
const STATUS_TABS = [
  "All",
  "Outstanding",
  "Accepted",
  "In Progress",
  "Awaiting Authorization",
  "Authorized",
  "Ready",
  "Carry Over",
  "Parts Request",
  "Complete",
];

// ✅ Main VHC dashboard page component
export default function VHCDashboard() {
  const router = useRouter(); // router for navigation
  const [vhcJobs, setVhcJobs] = useState([]); // store jobs shown on dashboard
  const [loading, setLoading] = useState(true); // loading state for fetch cycle
  const [filter, setFilter] = useState("All"); // active status filter
  const [search, setSearch] = useState({ reg: "", jobNumber: "", customer: "" }); // search inputs
  const [currentPage, setCurrentPage] = useState(1); // pagination state
  const itemsPerPage = 10; // page size
  const { user } = useUser(); // current user context
  const userRoles = (user?.roles || []).map((role) => role.toLowerCase()); // normalise role list
  const isPartsRole = userRoles.some((role) => role === "parts" || role === "parts manager"); // detect parts users
  const workshopViewRoles = [
    "service",
    "service manager",
    "workshop manager",
    "after sales director",
    "general manager",
    "admin",
    "techs",
  ]; // roles allowed to see full workshop data
  const hasWorkshopPrivileges = userRoles.some((role) => workshopViewRoles.includes(role)); // detect workshop access
  const partsOnlyMode = isPartsRole && !hasWorkshopPrivileges; // limit parts team to relevant jobs

  useEffect(() => {
    const fetchVhcJobs = async () => {
      setLoading(true); // start loading state
      console.log("📋 Fetching VHC dashboard data..."); // debug log

      try {
        const jobs = await getAllJobs(); // fetch jobs from Supabase
        console.log("✅ Jobs fetched:", jobs.length); // debug count

        const vhcEligibleJobs = jobs.filter((job) => {
          const requiresVhc = job.vhcRequired === true; // job flagged as requiring VHC
          const hasStandalonePartRequest = !requiresVhc && (
            (Array.isArray(job.partsRequests) && job.partsRequests.length > 0) ||
            (Array.isArray(job.partsAllocations) && job.partsAllocations.length > 0)
          ); // jobs with parts requests still surface for parts team
          return requiresVhc || hasStandalonePartRequest; // include relevant jobs
        });
        console.log(
          "✅ Jobs requiring VHC or carrying standalone part requests:",
          vhcEligibleJobs.length,
        ); // debug filtered count

        const jobsWithVhc = await Promise.all(
          vhcEligibleJobs.map(async (job) => {
            const checks = await getVhcChecksByJob(job.id); // fetch technician VHC records (note: lowercase 'hc')

            const allocationCount = Array.isArray(job.partsAllocations)
              ? job.partsAllocations.length
              : 0; // count allocations tied to job
            const requestCount = Array.isArray(job.partsRequests)
              ? job.partsRequests.length
              : 0; // count raw part requests
            const partsCount = allocationCount + requestCount; // combined parts counter

            const builderPayload = parseVhcBuilderPayload(checks); // extract technician VHC JSON blob
            const builderSummary = summariseTechnicianVhc(builderPayload); // summarise into dashboard sections
            const hasBuilderSections = builderSummary.sections.length > 0; // track whether we have technician data

            const legacyRedIssues = checks.filter((check) =>
              typeof check.section === "string" && check.section.toLowerCase().includes("brake"),
            ).length; // legacy red counts from classic checks
            const legacyAmberIssues = checks.filter((check) =>
              typeof check.section === "string" && check.section.toLowerCase().includes("tyre"),
            ).length; // legacy amber counts from classic checks

            const sectionItemCount = hasBuilderSections
              ? Math.max(builderSummary.itemCount, builderSummary.sections.length)
              : checks.length > 0
              ? checks.length
              : partsCount; // number of cards/sections available for counter display

            let vhcStatus = "Outstanding"; // default dashboard status
            if (hasBuilderSections) {
              if (builderSummary.totals.red > 0) {
                vhcStatus = "In Progress"; // red items need attention
              } else if (builderSummary.totals.amber > 0) {
                vhcStatus = "Awaiting Authorization"; // amber items logged
              } else {
                vhcStatus = "Complete"; // all technician sections recorded with no amber/red
              }
            } else if (partsCount > 0) {
              vhcStatus = "Parts Request"; // no technician data but parts activity present
            } else if (legacyRedIssues > 0) {
              vhcStatus = "In Progress"; // legacy red entries fallback
            } else if (legacyAmberIssues > 0) {
              vhcStatus = "Awaiting Authorization"; // legacy amber entries fallback
            } else if (checks.length > 0) {
              vhcStatus = "Complete"; // legacy entries exist with no amber/red
            }

            const redIssues = hasBuilderSections ? builderSummary.totals.red : legacyRedIssues; // final red count
            const amberIssues = hasBuilderSections ? builderSummary.totals.amber : legacyAmberIssues; // final amber count

            const allocationValue = (job.partsAllocations || []).reduce((sum, allocation) => {
              const qty = allocation.quantityRequested || allocation.quantityAllocated || 0; // use requested or allocated quantity
              const price = Number.parseFloat(allocation.unitPrice) || 0; // unit price for allocation
              return sum + qty * price; // accumulate allocation value
            }, 0);
            const requestValue = (job.partsRequests || []).reduce((sum, request) => {
              const qty = request.quantity || request.quantityRequested || 0; // use available quantity field
              const price = Number.parseFloat(request.unitPrice) || 0; // unit price for request
              return sum + qty * price; // accumulate request value
            }, 0);
            const partsValue = allocationValue + requestValue; // combined parts value for display

            return {
              id: job.id,
              jobNumber: job.jobNumber,
              reg: job.reg,
              customer: job.customer,
              makeModel: job.makeModel,
              vhcStatus,
              vhcSections: hasBuilderSections ? builderSummary.sections : [],
              sectionItemCount,
              redIssues,
              amberIssues,
              partsCount,
              partsValue: partsValue.toFixed(2),
              lastVisit: job.lastVisit || "First visit",
              nextService: job.nextService || "Not scheduled",
              motExpiry: job.motExpiry || null,
              createdAt: job.createdAt,
            };
          }),
        );

        const scopedJobs = partsOnlyMode
          ? jobsWithVhc.filter((job) => {
              if (job.partsCount > 0) return true; // parts users see jobs with parts activity
              return (job.redIssues || 0) > 0 || (job.amberIssues || 0) > 0; // otherwise only show jobs with actionable items
            })
          : jobsWithVhc; // workshop roles see all filtered jobs

        console.log("✅ VHC data processed for", scopedJobs.length, "jobs"); // debug log
        setVhcJobs(scopedJobs); // update state with processed data
      } catch (error) {
        console.error("❌ Error fetching VHC data:", error); // log fetch failure
      } finally {
        setLoading(false); // stop loading state
      }
    };

    fetchVhcJobs(); // kick off fetch cycle
  }, [partsOnlyMode]);

  const filteredJobs = vhcJobs
    .filter((job) => filter === "All" || job.vhcStatus === filter) // status filter
    .filter((job) => {
      const customerName = getCustomerName(job.customer).toLowerCase(); // normalise customer name
      return (
        job.reg?.toLowerCase().includes(search.reg.toLowerCase()) &&
        job.jobNumber?.toString().includes(search.jobNumber) &&
        customerName.includes(search.customer.toLowerCase())
      ); // apply search filters
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first ordering

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage) || 1; // derive total pagination pages
  const startIndex = (currentPage - 1) * itemsPerPage; // current page start index
  const endIndex = startIndex + itemsPerPage; // current page end index
  const currentJobs = filteredJobs.slice(startIndex, endIndex); // jobs to display on the current page

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage); // update page when within bounds
    }
  };

  useEffect(() => {
    setCurrentPage(1); // reset pagination when filters change
  }, [filter, search]);

  const handleJobClick = (jobNumber) => {
    router.push(`/vhc/details/${jobNumber}`); // navigate to technician detail view
  };

  return (
    <Layout>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "8px 16px",
          overflow: "hidden",
        }}
      >
        {/* Search Section */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            marginBottom: "12px",
            padding: "12px",
            backgroundColor: "#fff",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
            flexShrink: 0,
          }}
        >
          <input
            type="text"
            placeholder="Search Registration"
            value={search.reg}
            onChange={(e) => setSearch({ ...search, reg: e.target.value })}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search Job Number"
            value={search.jobNumber}
            onChange={(e) => setSearch({ ...search, jobNumber: e.target.value })}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search Customer"
            value={search.customer}
            onChange={(e) => setSearch({ ...search, customer: e.target.value })}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>

        {/* Status Filter Tabs */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "12px",
            overflowX: "auto",
            paddingBottom: "4px",
            flexShrink: 0,
          }}
        >
          {STATUS_TABS.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: "8px 16px",
                border: filter === status ? "2px solid #d10000" : "1px solid #d10000",
                color: filter === status ? "#fff" : "#d10000",
                backgroundColor: filter === status ? "#d10000" : "#fff",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: filter === status ? "600" : "500",
                fontSize: "14px",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {partsOnlyMode && (
          <div
            style={{
              backgroundColor: "#fff8ed",
              border: "1px solid #ffddaf",
              borderRadius: "12px",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
              color: "#92400e",
            }}
          >
            <span style={{ fontSize: "20px" }}>🧰</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <strong>Parts-focused VHC view</strong>
              <span style={{ fontSize: "13px" }}>
                Showing jobs with outstanding part requests or costed VHC recommendations so you can update customer-ready information.
              </span>
            </div>
          </div>
        )}

        {/* Job List Section */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: "24px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            border: "1px solid #ffe5e5",
            background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
            padding: "24px",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {loading ? null : filteredJobs.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ fontSize: "64px" }}>🔍</div>
              <p style={{ color: "#666", fontSize: "18px", fontWeight: "600" }}>
                No VHC reports found
              </p>
            </div>
          ) : (
            <>
              {/* Column Headers */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingBottom: "16px",
                  marginBottom: "16px",
                  borderBottom: "2px solid #ffd6d6",
                  flexShrink: 0,
                }}
              >
                <div style={{ width: "600px", flexShrink: 0 }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#000" }}>
                    VEHICLE DETAILS
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    flex: 1,
                    justifyContent: "flex-end",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "90px", textAlign: "center" }}>Last Visit</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "90px", textAlign: "center" }}>Next Service</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "90px", textAlign: "center" }}>MOT</span>
                  <div style={{ width: "1px" }}></div>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "70px", textAlign: "center" }}>Checks</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "70px", textAlign: "center" }}>Red</span>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "70px", textAlign: "center" }}>Amber</span>
                  <div style={{ width: "1px" }}></div>
                  <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "120px", textAlign: "center" }}>Time</span>
                </div>
              </div>

              {/* Job Cards */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  paddingRight: "8px",
                  marginBottom: "16px",
                  minHeight: 0,
                }}
              >
                {currentJobs.map((job) => (
                  <VHCJobCard
                    key={job.id}
                    job={job}
                    partsMode={partsOnlyMode}
                    onClick={() => handleJobClick(job.jobNumber)}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div
                style={{
                  flexShrink: 0,
                  paddingTop: "16px",
                  borderTop: "2px solid #ffd6d6",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                      backgroundColor: currentPage === 1 ? "#f5f5f5" : "#fff",
                      color: currentPage === 1 ? "#999" : "#333",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                      backgroundColor: currentPage === totalPages ? "#f5f5f5" : "#fff",
                      color: currentPage === totalPages ? "#999" : "#333",
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      fontWeight: "600",
                    }}
                  >
                    Next →
                  </button>
                </div>
                <span style={{ display: "block", textAlign: "center", fontSize: "12px", color: "#888" }}>
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}