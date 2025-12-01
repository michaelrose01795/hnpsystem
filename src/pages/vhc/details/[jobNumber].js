// file location: src/pages/vhc/details/[jobNumber].js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { getJobByNumberOrReg } from "@/lib/database/jobs";
import { getVhcWorkflowStatus } from "@/lib/database/vhc";
import {
  STATUS_COLORS,
  deriveVhcDashboardStatus,
  parseVhcBuilderPayload,
  summariseTechnicianVhc,
} from "@/lib/vhc/summary";

const ITEM_STATUS_COLORS = {
  Red: { background: "rgba(239,68,68,0.16)", color: "#ef4444", border: "rgba(239,68,68,0.28)" },
  Amber: { background: "rgba(245,158,11,0.16)", color: "#b45309", border: "rgba(245,158,11,0.28)" },
  Green: { background: "rgba(16,185,129,0.16)", color: "#059669", border: "rgba(16,185,129,0.28)" },
  Neutral: { background: "rgba(107,114,128,0.16)", color: "#374151", border: "rgba(107,114,128,0.28)" },
};

const CONCERN_STATUS_COLORS = {
  Red: "#ef4444",
  Amber: "#b45309",
  Green: "#059669",
  Grey: "#6b7280",
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

const buildBadgeStyle = (status) => {
  const palette = ITEM_STATUS_COLORS[status] || ITEM_STATUS_COLORS.Neutral;
  return {
    backgroundColor: palette.background,
    color: palette.color,
    border: `1px solid ${palette.border}`,
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600,
    padding: "2px 10px",
    letterSpacing: "0.3px",
  };
};

const getConcernColor = (status) => CONCERN_STATUS_COLORS[status] || CONCERN_STATUS_COLORS.Grey;

const formatMeasurementList = (value) => {
  if (value === null || value === undefined) return null;
  const segments = Array.isArray(value) ? value : value.toString().split(/[, ]+/);
  const cleaned = segments
    .map((segment) => segment.toString().trim())
    .filter((segment) => segment !== "")
    .map((segment) => (segment.endsWith("mm") ? segment : `${segment}mm`));
  return cleaned.length > 0 ? cleaned.join(" / ") : null;
};

const formatMileage = (mileage) => {
  if (mileage === null || mileage === undefined) return null;
  const numeric = Number(mileage);
  if (Number.isNaN(numeric)) return null;
  return `${numeric.toLocaleString()} mi`;
};

const tallyConcerns = (concerns = []) =>
  concerns.reduce(
    (acc, concern) => {
      const status = (concern?.status || "").toLowerCase();
      if (status.startsWith("red")) acc.red += 1;
      else if (status.startsWith("amber") || status.startsWith("yellow")) acc.amber += 1;
      else if (status.startsWith("grey") || status.startsWith("gray")) acc.grey += 1;
      return acc;
    },
    { red: 0, amber: 0, grey: 0 },
  );

export default function VhcDetailsPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [loading, setLoading] = useState(true);
  const [jobData, setJobData] = useState(null);
  const [vhcSummary, setVhcSummary] = useState({ sections: [], totals: { total: 0, red: 0, amber: 0, grey: 0 } });
  const [vhcBuilderData, setVhcBuilderData] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [vhcStatus, setVhcStatus] = useState("VHC not started");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobNumber) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const job = await getJobByNumberOrReg(jobNumber);
        if (!job) {
          setError("Job not found. Please verify the job number.");
          setLoading(false);
          return;
        }

        if (job.vhcRequired !== true) {
          setError("This job was not flagged for a Vehicle Health Check.");
          setJobData(job);
          setLoading(false);
          return;
        }

        const workflowRow = job.id ? await getVhcWorkflowStatus(job.id) : null;
        const builderPayload = parseVhcBuilderPayload(job.vhcChecks);
        const summary = summariseTechnicianVhc(builderPayload);
        const partsCount = (job.partsRequests?.length || 0) + (job.partsAllocations?.length || 0);

        const vhcState = deriveVhcDashboardStatus({
          job,
          workflow: workflowRow,
          hasChecks: summary.itemCount > 0,
          partsCount,
        });

        setJobData(job);
        setWorkflow(workflowRow);
        setVhcSummary(summary);
        setVhcBuilderData(builderPayload);
        setVhcStatus(vhcState);
      } catch (err) {
        console.error("❌ Failed to load VHC details:", err);
        setError("We couldn't load this VHC. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [jobNumber]);

  const timelineEvents = useMemo(() => {
    if (!jobData) return [];
    const events = [];

    if (jobData.checkedInAt) {
      events.push({ label: "Checked in", value: jobData.checkedInAt });
    }
    if (workflow?.vhcSentAt || workflow?.lastSentAt) {
      events.push({ label: "VHC sent to customer", value: workflow?.vhcSentAt || workflow?.lastSentAt });
    }
    if (jobData.vhcCompletedAt || workflow?.vhcCompletedAt) {
      events.push({ label: "VHC completed", value: jobData.vhcCompletedAt || workflow?.vhcCompletedAt });
    }
    if (jobData.completedAt) {
      events.push({ label: "Job completed", value: jobData.completedAt });
    }

    return events;
  }, [jobData, workflow]);

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: "24px", color: "#6b7280" }}>Loading VHC details…</div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "#ef4444", fontWeight: 600 }}>{error}</p>
          <button
            type="button"
            onClick={() => router.push("/vhc/dashboard")}
            style={{
              alignSelf: "flex-start",
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back to VHC dashboard
          </button>
        </div>
      </Layout>
    );
  }

  if (!jobData) {
    return (
      <Layout>
        <div style={{ padding: "24px" }}>Unable to find the requested job.</div>
      </Layout>
    );
  }

  const { sections, totals } = vhcSummary;
  const statusColor = STATUS_COLORS[vhcStatus] || "#9ca3af";

  const renderBadgeRow = (stats) => (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      {stats.red > 0 ? (
        <span style={{ ...buildBadgeStyle("Red"), fontSize: "10px" }}>
          {stats.red} Red
        </span>
      ) : null}
      {stats.amber > 0 ? (
        <span style={{ ...buildBadgeStyle("Amber"), fontSize: "10px" }}>
          {stats.amber} Amber
        </span>
      ) : null}
      {stats.grey > 0 ? (
        <span style={{ ...buildBadgeStyle("Neutral"), fontSize: "10px" }}>
          {stats.grey} Grey
        </span>
      ) : null}
    </div>
  );

  const renderConcernsList = (concerns) => {
    if (!Array.isArray(concerns) || concerns.length === 0) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {concerns.map((concern, concernIdx) => (
          <div
            key={`concern-${concernIdx}-${concern?.text || concernIdx}`}
            style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}
          >
            <span style={{ fontSize: "10px", color: "#d1d5db", lineHeight: "18px" }}>•</span>
            <span style={{ fontSize: "12px", color: "#4b5563" }}>
              <span style={{ fontWeight: "600", color: getConcernColor(concern?.status) }}>
                {concern?.status || "Note"}:
              </span>{" "}
              {concern?.text || "No description provided"}
            </span>
          </div>
        ))}
      </div>
    );
  };

const renderTyreSection = () => {
  const tyres = vhcBuilderData?.wheelsTyres;
    const wheelOrder = [
      ["NSF", "Nearside Front"],
      ["OSF", "Offside Front"],
      ["NSR", "Nearside Rear"],
      ["OSR", "Offside Rear"],
    ];

    const cards = wheelOrder
      .map(([key, label]) => {
        const tyre = tyres && typeof tyres === "object" ? tyres[key] : null;
        if (!tyre || typeof tyre !== "object") return null;
        const rows = [];
        if (tyre.manufacturer) rows.push(`Manufacturer: ${tyre.manufacturer}`);
        if (tyre.size) rows.push(`Size: ${tyre.size}`);
        const loadSpeed = [];
        if (tyre.load) loadSpeed.push(`Load ${tyre.load}`);
        if (tyre.speed) loadSpeed.push(`Speed ${tyre.speed}`);
        if (loadSpeed.length > 0) rows.push(loadSpeed.join(" • "));
        if (typeof tyre.runFlat === "boolean") {
          rows.push(`Run flat: ${tyre.runFlat ? "Yes" : "No"}`);
        }
        const treadValues = tyre.tread || {};
        const treadSegments = ["outer", "middle", "inner"]
          .map((segment) => {
            const reading = treadValues[segment];
            if (reading === null || reading === undefined || reading === "") return null;
            return `${segment.charAt(0).toUpperCase() + segment.slice(1)}: ${reading}${
              reading.toString().endsWith("mm") ? "" : "mm"
            }`;
          })
          .filter(Boolean);
        if (treadSegments.length > 0) rows.push(treadSegments.join(" • "));
        const concerns = Array.isArray(tyre.concerns) ? tyre.concerns : [];
        const concernCounts = tallyConcerns(concerns);
        return (
          <div
            key={key}
            style={{
              border: "1px solid #f3f4f6",
              borderRadius: "10px",
              padding: "12px",
              backgroundColor: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{label}</span>
              {concerns.length > 0 ? renderBadgeRow(concernCounts) : null}
            </div>
            {rows.map((row) => (
              <span key={`${key}-${row}`} style={{ fontSize: "12px", color: "#4b5563" }}>
                {row}
              </span>
            ))}
            {renderConcernsList(concerns)}
          </div>
        );
      })
      .filter(Boolean);

    const spare = (() => {
      const entry = tyres.Spare;
      if (!entry || typeof entry !== "object") return null;
      const tread = entry.details?.tread || entry.tread || {};
      const depthLine = ["outer", "middle", "inner"]
        .map((segment) => {
          const value = tread[segment];
          if (value === null || value === undefined || value === "") return null;
          const pretty = value.toString().endsWith("mm") ? value : `${value}mm`;
          return `${segment.charAt(0).toUpperCase() + segment.slice(1)} ${pretty}`;
        })
        .filter(Boolean)
        .join(" • ");
      return (
        <div
          key="tyre-summary-spare"
          style={{
            border: "1px solid #f3f4f6",
            borderRadius: "10px",
            padding: "12px",
            backgroundColor: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "13px", fontWeight: 600 }}>Spare / Repair Kit</span>
          <span style={{ fontSize: "12px", color: "#4b5563" }}>Type: {entry.type || "—"}</span>
          <span style={{ fontSize: "12px", color: "#4b5563" }}>Condition: {entry.condition || "—"}</span>
          {entry.details?.manufacturer ? (
            <span style={{ fontSize: "12px", color: "#4b5563" }}>Make: {entry.details.manufacturer}</span>
          ) : null}
          {entry.details?.size ? (
            <span style={{ fontSize: "12px", color: "#4b5563" }}>Size: {entry.details.size}</span>
          ) : null}
          {depthLine ? (
            <span style={{ fontSize: "12px", color: "#374151" }}>Depths: {depthLine}</span>
          ) : (
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>Depths not recorded</span>
          )}
        </div>
      );
    })();

    if (spare) {
      cards.push(spare);
    }

    const spare = (() => {
      if (!tyres || typeof tyres !== "object") return null;
      const entry = tyres.Spare;
      if (!entry || typeof entry !== "object") return null;
      const rows = [];
      const concerns = Array.isArray(entry.concerns) ? entry.concerns : [];
      const counts = tallyConcerns(concerns);
      if (entry.type) rows.push(`Type: ${entry.type}`);
      if (entry.condition) rows.push(`Condition: ${entry.condition}`);
      if (entry.month && entry.year) {
        rows.push(`Manufactured: ${String(entry.month).padStart(2, "0")}/${entry.year}`);
      }
      if (entry.note) rows.push(`Notes: ${entry.note}`);
      const details = entry.details || {};
      if (details.manufacturer) rows.push(`Manufacturer: ${details.manufacturer}`);
      if (details.size) rows.push(`Size: ${details.size}`);
      return (
        <div
          key="spare"
          style={{
            border: "1px solid #f3f4f6",
            borderRadius: "10px",
            padding: "12px",
            backgroundColor: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Spare / Repair Kit</span>
            {concerns.length > 0 ? renderBadgeRow(counts) : null}
          </div>
          {rows.map((row) => (
            <span key={`spare-${row}`} style={{ fontSize: "12px", color: "#4b5563" }}>
              {row}
            </span>
          ))}
          {renderConcernsList(concerns)}
        </div>
      );
    })();

    if (spare) {
      cards.push(spare);
    }

    if (cards.length === 0) {
      return (
        <section
          style={{
            border: "1px solid #f3f4f6",
            borderRadius: "12px",
            padding: "16px",
            backgroundColor: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Wheels & Tyres</h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Measurements and tread readings captured by technician.</p>
            </div>
          </header>
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>No tyre data recorded yet.</p>
        </section>
      );
    }

    return (
      <section
        style={{
          border: "1px solid #f3f4f6",
          borderRadius: "12px",
          padding: "16px",
          backgroundColor: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Wheels & Tyres</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Measurements and tread readings captured by technician.</p>
          </div>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {cards}
        </div>
      </section>
    );
  };

  const renderBrakesSection = () => {
    const brakes = vhcBuilderData?.brakesHubs;
    const rows = [];

    const appendPad = (key, label) => {
      const pad = brakes?.[key];
      if (!pad || typeof pad !== "object") return;
      const measurement = formatMeasurementList(pad.measurement);
      const padRows = [];
      if (measurement) padRows.push(`Measurements: ${measurement}`);
      if (pad.status) padRows.push(`Status: ${pad.status}`);
      rows.push({
        key,
        heading: label,
        rows: padRows,
        concerns: Array.isArray(pad.concerns) ? pad.concerns : [],
      });
    };

    const appendDisc = (key, label) => {
      const disc = brakes?.[key];
      if (!disc || typeof disc !== "object") return;
      const measurement = formatMeasurementList(disc.measurements?.values || disc.measurements?.thickness);
      const discRows = [];
      if (measurement) discRows.push(`Thickness: ${measurement}`);
      if (disc.measurements?.status) discRows.push(`Measurement check: ${disc.measurements.status}`);
      if (disc.visual?.status) discRows.push(`Visual check: ${disc.visual.status}`);
      const notes = disc.visual?.notes || disc.visual?.note;
      if (notes) discRows.push(`Notes: ${notes}`);
      rows.push({
        key,
        heading: label,
        rows: discRows,
        concerns: Array.isArray(disc.concerns) ? disc.concerns : [],
      });
    };

    appendPad("frontPads", "Front Pads");
    appendPad("rearPads", "Rear Pads");
    appendDisc("frontDiscs", "Front Discs");
    appendDisc("rearDiscs", "Rear Discs");

    const drum = brakes?.rearDrums;
    if (drum && typeof drum === "object") {
      const drumRows = [];
      if (drum.status) drumRows.push(`Status: ${drum.status}`);
      rows.push({
        key: "rearDrums",
        heading: "Rear Drums",
        rows: drumRows,
        concerns: Array.isArray(drum.concerns) ? drum.concerns : [],
      });
    }

    if (rows.length === 0) {
      return (
        <section
          style={{
            border: "1px solid #f3f4f6",
            borderRadius: "12px",
            padding: "16px",
            backgroundColor: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Brakes & Hubs</h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Measurements and visual inspections captured in the workshop.</p>
            </div>
          </header>
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>No brake data recorded yet.</p>
        </section>
      );
    }

    return (
      <section
        style={{
          border: "1px solid #f3f4f6",
          borderRadius: "12px",
          padding: "16px",
          backgroundColor: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Brakes & Hubs</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Measurements and visual inspections captured in the workshop.</p>
          </div>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {rows.map((entry) => (
            <div
              key={entry.key}
              style={{
                border: "1px solid #f3f4f6",
                borderRadius: "10px",
                padding: "12px",
                backgroundColor: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{entry.heading}</span>
              {entry.rows.map((line) => (
                <span key={`${entry.key}-${line}`} style={{ fontSize: "12px", color: "#4b5563" }}>
                  {line}
                </span>
              ))}
              {renderConcernsList(entry.concerns)}
            </div>
          ))}
        </div>
      </section>
    );
  };

const renderServiceSection = () => {
    const serviceEntries = Array.isArray(vhcBuilderData?.serviceIndicator) ? vhcBuilderData.serviceIndicator : [];
    if (serviceEntries.length === 0) {
      return (
        <section
          style={{
            border: "1px solid #f3f4f6",
            borderRadius: "12px",
            padding: "16px",
            backgroundColor: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Service Indicator & Under Bonnet</h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Technician responses to service reminder and fluid checks.</p>
            </div>
          </header>
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>No service indicator data recorded yet.</p>
        </section>
      );
    }
    return (
      <section
        style={{
          border: "1px solid #f3f4f6",
          borderRadius: "12px",
          padding: "16px",
          backgroundColor: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Service Indicator & Under Bonnet</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Technician responses to service reminder and fluid checks.</p>
          </div>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {serviceEntries.map((entry, idx) => {
            const rows = [];
            if (entry.serviceChoice) rows.push(`Service choice: ${entry.serviceChoice}`);
            if (entry.oilLevel) rows.push(`Oil level: ${entry.oilLevel}`);
            if (entry.oilCondition) rows.push(`Oil condition: ${entry.oilCondition}`);
            if (entry.notes) rows.push(entry.notes);
            return (
              <div
                key={`service-${idx}`}
                style={{
                  border: "1px solid #f3f4f6",
                  borderRadius: "10px",
                  padding: "12px",
                  backgroundColor: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{entry.heading || `Entry ${idx + 1}`}</span>
                {rows.map((line) => (
                  <span key={`${idx}-${line}`} style={{ fontSize: "12px", color: "#4b5563" }}>
                    {line}
                  </span>
                ))}
                {renderConcernsList(Array.isArray(entry.concerns) ? entry.concerns : [])}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const optionalSectionConfig = [
    { key: "externalInspection", title: "External / Drive-in Inspection" },
    { key: "internalElectrics", title: "Internal / Lamps / Electrics" },
    { key: "underside", title: "Underside Inspection" },
  ];

const renderOptionalSections = () => {
    if (!vhcBuilderData) return null;
    return optionalSectionConfig
      .map(({ key, title }) => {
        const data = vhcBuilderData[key];
        const entryList = Array.isArray(data)
          ? data
          : typeof data === "object"
          ? Object.entries(data).map(([heading, entry]) => ({ heading, ...(entry || {}) }))
          : [];
        const cards = entryList
          .map((entry, idx) => {
            const concerns = Array.isArray(entry.concerns) ? entry.concerns : [];
            if (concerns.length === 0) return null;
            return (
              <div
                key={`${key}-${entry.heading || idx}`}
                style={{
                  border: "1px solid #f3f4f6",
                  borderRadius: "10px",
                  padding: "12px",
                  backgroundColor: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{entry.heading || "Inspection item"}</span>
                {renderConcernsList(concerns)}
              </div>
            );
          })
          .filter(Boolean);
        if (cards.length === 0) {
          return (
            <section
              key={key}
              style={{
                border: "1px solid #f3f4f6",
                borderRadius: "12px",
                padding: "16px",
                backgroundColor: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{title}</h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Recorded amber/red observations.</p>
                </div>
              </header>
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>No observations recorded for this section.</p>
            </section>
          );
        }
        return (
          <section
            key={key}
            style={{
              border: "1px solid #f3f4f6",
              borderRadius: "12px",
              padding: "16px",
              backgroundColor: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{title}</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>Recorded amber/red observations.</p>
              </div>
            </header>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              {cards}
            </div>
          </section>
        );
      })
      .filter(Boolean);
  };

  const summaryBits = [];
  const mileageLabel = formatMileage(jobData.mileage);
  if (mileageLabel) summaryBits.push(mileageLabel);
  if (jobData.createdAt) summaryBits.push(`Opened ${new Date(jobData.createdAt).toLocaleDateString()}`);
  if (jobData.checkedInAt) summaryBits.push(`Checked in ${new Date(jobData.checkedInAt).toLocaleDateString()}`);
  const summaryText = summaryBits.length > 0 ? summaryBits.join(" • ") : "No additional VHC summary recorded yet.";

  const renderTyreSummary = () => {
    const tyres = vhcBuilderData?.wheelsTyres;
    if (!tyres || typeof tyres !== "object") return null;
    const wheelOrder = [
      ["NSF", "Nearside Front"],
      ["OSF", "Offside Front"],
      ["NSR", "Nearside Rear"],
      ["OSR", "Offside Rear"],
    ];
    const cards = wheelOrder
      .map(([key, label]) => {
        const tyre = tyres[key];
        if (!tyre || typeof tyre !== "object") return null;
        const tread = tyre.tread || {};
        const depthLine = ["outer", "middle", "inner"]
          .map((segment) => {
            const value = tread[segment];
            if (value === null || value === undefined || value === "") return null;
            const pretty = value.toString().endsWith("mm") ? value : `${value}mm`;
            return `${segment.charAt(0).toUpperCase() + segment.slice(1)} ${pretty}`;
          })
          .filter(Boolean)
          .join(" • ");
        return (
          <div
            key={`tyre-summary-${key}`}
            style={{
              border: "1px solid #f3f4f6",
              borderRadius: "10px",
              padding: "12px",
              backgroundColor: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: "12px", color: "#4b5563" }}>Make: {tyre.manufacturer || "—"}</span>
            <span style={{ fontSize: "12px", color: "#4b5563" }}>Size: {tyre.size || "—"}</span>
            <span style={{ fontSize: "12px", color: "#4b5563" }}>
              Load / Speed: {(tyre.load || "—") + " / " + (tyre.speed || "—")}
            </span>
            {depthLine ? (
              <span style={{ fontSize: "12px", color: "#374151" }}>Depths: {depthLine}</span>
            ) : (
              <span style={{ fontSize: "12px", color: "#9ca3af" }}>Depths not recorded</span>
            )}
          </div>
        );
      })
      .filter(Boolean);

    if (cards.length === 0) return null;

    return (
      <section
        style={{
          border: "1px solid #f3f4f6",
          borderRadius: "12px",
          padding: "16px",
          backgroundColor: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <header>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Tyres overview</h3>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>Measurements and specification for each wheel.</p>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>{cards}</div>
      </section>
    );
  };

  const renderBrakeSummary = () => {
    const brakes = vhcBuilderData?.brakesHubs;
    if (!brakes || typeof brakes !== "object") return null;
    const entries = [
      { key: "frontPads", label: "Front Pads", data: brakes.frontPads },
      { key: "rearPads", label: "Rear Pads", data: brakes.rearPads },
      { key: "frontDiscs", label: "Front Discs", data: brakes.frontDiscs },
      { key: "rearDiscs", label: "Rear Discs", data: brakes.rearDiscs },
      { key: "rearDrums", label: "Rear Drums", data: brakes.rearDrums },
    ]
      .map(({ key, label, data }) => {
        if (!data || typeof data !== "object") return null;
        const rows = [];
        if (data.measurement) {
          const formatted = formatMeasurementList(data.measurement);
          if (formatted) rows.push(`Measurement: ${formatted}`);
        }
        if (data.measurements?.values || data.measurements?.thickness) {
          const formatted = formatMeasurementList(data.measurements?.values || data.measurements?.thickness);
          if (formatted) rows.push(`Measurement: ${formatted}`);
        }
        if (data.measurements?.status) rows.push(`Measurement status: ${data.measurements.status}`);
        if (data.visual?.status) rows.push(`Visual status: ${data.visual.status}`);
        if (data.visual?.notes || data.visual?.note) rows.push(data.visual?.notes || data.visual?.note);
        if (data.status && rows.length === 0) rows.push(`Status: ${data.status}`);
        if (rows.length === 0) rows.push("No measurements captured.");
        return (
          <div
            key={`brake-summary-${key}`}
            style={{
              border: "1px solid #f3f4f6",
              borderRadius: "10px",
              padding: "12px",
              backgroundColor: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600 }}>{label}</span>
            {rows.map((row, index) => (
              <span key={`${key}-${index}`} style={{ fontSize: "12px", color: "#4b5563" }}>
                {row}
              </span>
            ))}
          </div>
        );
      })
      .filter(Boolean);

    if (entries.length === 0) return null;

    return (
      <section
        style={{
          border: "1px solid #f3f4f6",
          borderRadius: "12px",
          padding: "16px",
          backgroundColor: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <header>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Brakes overview</h3>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>Pad and disc measurements recorded by technicians.</p>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>{entries}</div>
      </section>
    );
  };

  const buildRedAmberGroups = (summarySections = []) => {
    const groups = [];
    summarySections.forEach((section) => {
      const relevant = (section.items || []).filter((item) => {
        const status = (item.status || "").toLowerCase();
        const matchesStatus = status.includes("red") || status.includes("amber");
        const hasConcern = (item.concerns || []).some((concern) => {
          const cStatus = (concern.status || "").toLowerCase();
          return cStatus.includes("red") || cStatus.includes("amber");
        });
        return matchesStatus || hasConcern;
      });
      if (relevant.length > 0) {
        groups.push({ title: section.title, items: relevant });
      }
    });
    return groups;
  };

  const redAmberGroups = useMemo(() => buildRedAmberGroups(vhcSummary.sections), [vhcSummary.sections]);

  const renderRedAmberSummary = () => {
    if (redAmberGroups.length === 0) return null;
    return (
      <section
        style={{
          border: "1px solid #f3f4f6",
          borderRadius: "12px",
          padding: "16px",
          backgroundColor: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <header>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Red & amber actions</h3>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>Grouped by technician section for quick follow-up.</p>
        </header>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {redAmberGroups.map((group) => (
            <div key={group.title} style={{ border: "1px solid #f3f4f6", borderRadius: "10px", padding: "12px", background: "#fff" }}>
              <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600 }}>{group.title}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {group.items.map((item, idx) => {
                  const description = item.rows && item.rows.length > 0 ? item.rows.join(" • ") : "No measurement notes.";
                  const status = item.status ? item.status : "Requires attention";
                  const relevantConcerns = (item.concerns || []).filter((concern) => {
                    const s = (concern.status || "").toLowerCase();
                    return s.includes("red") || s.includes("amber");
                  });
                  return (
                    <div key={`${group.title}-${idx}`} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>
                        {item.heading || "VHC item"} – {status}
                      </div>
                      <div style={{ fontSize: "12px", color: "#4b5563" }}>{description}</div>
                      {renderConcernsList(relevantConcerns)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const tyreSummaryBlock = renderTyreSummary();
  const brakeSummaryBlock = renderBrakeSummary();
  const redAmberSummaryBlock = renderRedAmberSummary();

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => router.push("/vhc/dashboard")}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Back to VHC dashboard
          </button>
          <Link href={`/job-cards/${jobData.jobNumber}`} style={{ fontSize: "13px", color: "#d10000", fontWeight: 600 }}>
            View full job card →
          </Link>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #f3f4f6",
            padding: "16px 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: "140px" }}>
            <p style={{ margin: 0, fontSize: "11px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.2em" }}>Job</p>
            <p style={{ margin: "4px 0 0", fontSize: "16px", fontWeight: 700, color: "#111827" }}>#{jobData.jobNumber || "—"}</p>
          </div>
          <div style={{ minWidth: "140px" }}>
            <p style={{ margin: 0, fontSize: "11px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.2em" }}>Reg</p>
            <p style={{ margin: "4px 0 0", fontSize: "16px", fontWeight: 700, color: "#111827" }}>{jobData.reg || "—"}</p>
          </div>
          <div style={{ minWidth: "180px" }}>
            <p style={{ margin: 0, fontSize: "11px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.2em" }}>Customer</p>
            <p style={{ margin: "4px 0 0", fontSize: "16px", fontWeight: 600, color: "#111827" }}>{jobData.customer || "Unknown customer"}</p>
          </div>
          <div style={{ flex: 1, minWidth: "220px" }}>
            <p style={{ margin: 0, fontSize: "11px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.2em" }}>Summary</p>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#4b5563" }}>{summaryText}</p>
          </div>
          <div
            style={{
              backgroundColor: statusColor,
              color: "#fff",
              padding: "6px 14px",
              borderRadius: "999px",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            {vhcStatus}
          </div>
        </div>

        {timelineEvents.length > 0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #f3f4f6",
              padding: "16px",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: "12px", textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.2em" }}>
              Workflow milestones
            </p>
            <ul style={{ margin: 0, paddingLeft: "18px", color: "#374151", fontSize: "13px" }}>
              {timelineEvents.map((event) => (
                <li key={`${event.label}-${event.value}`} style={{ marginBottom: "6px" }}>
                  <strong>{event.label}:</strong> {formatDateTime(event.value)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #f3f4f6",
            padding: "20px",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          {[
            { label: "Red issues", value: totals.red, color: "#ef4444" },
            { label: "Amber issues", value: totals.amber, color: "#f97316" },
            { label: "Grey / not checked", value: totals.grey, color: "#6b7280" },
            { label: "VHC sections", value: sections.length, color: "#0f172a" },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                flex: "1 1 200px",
                borderRadius: "10px",
                border: "1px solid #f3f4f6",
                padding: "14px 16px",
                background: "#fff",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>{card.label}</p>
              <p style={{ margin: 0, marginTop: "4px", fontSize: "24px", fontWeight: 700, color: card.color }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {(tyreSummaryBlock || brakeSummaryBlock || redAmberSummaryBlock) && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {tyreSummaryBlock}
            {brakeSummaryBlock}
            {redAmberSummaryBlock}
          </div>
        )}

        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #f3f4f6",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#111827" }}>Health Check</h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
              Mirrors the technician layout from the VHC workspace.
            </p>
          </div>

          {vhcBuilderData ? (
            <>
              {renderTyreSection()}
              {renderBrakesSection()}
              {renderServiceSection()}
              {renderOptionalSections()}
            </>
          ) : (
            <div
              style={{
                padding: "24px",
                borderRadius: "10px",
                border: "1px dashed #e5e7eb",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              Technicians have not started this VHC yet.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
