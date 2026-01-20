/* eslint-disable no-console */

const assertEqual = (label, actual, expected) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
  }
};

const resolveJobLabel = (status, getMainStatusMetadata) => {
  const meta = getMainStatusMetadata(status);
  return meta?.label || status || null;
};

const resolveSubLabel = (status, getSubStatusMetadata) => {
  const meta = getSubStatusMetadata(status);
  return meta?.label || status || null;
};

const resolveTechLabel = (status, techCompletionStatus, normalizer, techStatuses, techDisplay) => {
  const completion = normalizer(techCompletionStatus);
  const resolved = completion === techStatuses.COMPLETE ? completion : normalizer(status) || techStatuses.IN_PROGRESS;
  return techDisplay[resolved] || null;
};

const buildVhcStatus = ({ required, completedAt, sentAt, authorisedAt, declinedAt, hasChecks }) => {
  if (!required) return "not_required";
  if (declinedAt) return "declined";
  if (authorisedAt) return "authorised";
  if (sentAt) return "sent";
  if (completedAt) return "completed";
  if (hasChecks) return "in_progress";
  return "pending";
};

const buildPartsSummary = (rows = []) => {
  const summary = {
    totalItems: rows.length,
    waiting: 0,
    onOrder: 0,
    prePicked: 0,
    ready: 0,
  };

  rows.forEach((row) => {
    const normalized = String(row.status || "").toLowerCase();
    if (["waiting_authorisation", "pending", "awaiting_stock"].includes(normalized)) {
      summary.waiting += 1;
    } else if (normalized === "on_order") {
      summary.onOrder += 1;
    } else if (["pre_picked", "picked"].includes(normalized)) {
      summary.prePicked += 1;
    } else if (["stock", "allocated", "fitted"].includes(normalized)) {
      summary.ready += 1;
    }
  });

  return summary;
};

const buildPartsStatus = (summary) => {
  if (!summary || summary.totalItems === 0) return "none";
  if (summary.waiting > 0 || summary.onOrder > 0) return "blocked";
  if (summary.prePicked > 0) return "pre_picked";
  if (summary.ready > 0) return "ready";
  return "in_progress";
};

const resolveInvoiceStatus = (invoice) => {
  if (!invoice) return "missing";
  return invoice.payment_status || "Draft";
};

const run = async () => {
  const statusFlow = await import("../src/lib/status/statusFlow.js");
  const techCatalog = await import("../src/lib/status/catalog/tech.js");

  const { getMainStatusMetadata, getSubStatusMetadata } = statusFlow;
  const { DISPLAY: TECH_DISPLAY, NORMALIZE: NORMALIZE_TECH, STATUSES: TECH_STATUSES } = techCatalog;

  assertEqual("Job status booked", resolveJobLabel("booked", getMainStatusMetadata), "Booked");
  assertEqual(
    "Job status customer_arrived",
    resolveJobLabel("customer_arrived", getMainStatusMetadata),
    "Checked In"
  );
  assertEqual("Job status invoicing", resolveJobLabel("invoicing", getMainStatusMetadata), "Invoiced");
  assertEqual("Job status cancelled", resolveJobLabel("cancelled", getMainStatusMetadata), "Complete");
  assertEqual("Job status open", resolveJobLabel("Open", getMainStatusMetadata), "Open");

  assertEqual(
    "Sub status vhc_priced",
    resolveSubLabel("vhc_priced", getSubStatusMetadata),
    "Pricing Completed"
  );
  assertEqual(
    "Sub status tech_complete",
    resolveSubLabel("tech_complete", getSubStatusMetadata),
    "Technician Work Completed"
  );

  assertEqual(
    "Tech status waiting",
    resolveTechLabel("Booked", null, NORMALIZE_TECH, TECH_STATUSES, TECH_DISPLAY),
    "Waiting"
  );
  assertEqual(
    "Tech status in progress",
    resolveTechLabel("In Progress", null, NORMALIZE_TECH, TECH_STATUSES, TECH_DISPLAY),
    "In Progress"
  );
  assertEqual(
    "Tech status complete",
    resolveTechLabel("Checked In", "tech_complete", NORMALIZE_TECH, TECH_STATUSES, TECH_DISPLAY),
    "Complete"
  );

  assertEqual(
    "Workflow VHC not required",
    buildVhcStatus({ required: false }),
    "not_required"
  );
  assertEqual(
    "Workflow VHC declined",
    buildVhcStatus({ required: true, declinedAt: "2024-01-01" }),
    "declined"
  );

  assertEqual(
    "Workflow parts blocked",
    buildPartsStatus(buildPartsSummary([{ status: "pending" }])),
    "blocked"
  );
  assertEqual(
    "Workflow parts pre picked",
    buildPartsStatus(buildPartsSummary([{ status: "pre_picked" }])),
    "pre_picked"
  );

  assertEqual(
    "Workflow invoice sent",
    resolveInvoiceStatus({ payment_status: "Sent" }),
    "Sent"
  );
  assertEqual("Workflow invoice draft", resolveInvoiceStatus({}), "Draft");
  assertEqual("Workflow invoice missing", resolveInvoiceStatus(null), "missing");

  console.log("Status snapshot smoke test: PASS");
};

run().catch((error) => {
  console.error("Status snapshot smoke test: FAIL");
  console.error(error.message || error);
  process.exit(1);
});
