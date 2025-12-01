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

export default function VhcDetailsPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const [loading, setLoading] = useState(true);
  const [jobData, setJobData] = useState(null);
  const [vhcSummary, setVhcSummary] = useState({ sections: [], totals: { total: 0, red: 0, amber: 0, grey: 0 } });
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
      {section.metrics.grey > 0 ? (
        <span style={{ ...buildBadgeStyle("Neutral"), fontSize: "10px" }}>
          {section.metrics.grey} Grey
        </span>
      ) : null}
    </div>
  );

  const renderSectionItem = (item, index) => {
    const badgeStyle = buildBadgeStyle(item.status || "Neutral");
    const showBadge = item.status && item.status !== "Neutral";
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
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>Job #{jobData.jobNumber}</span>
            <Link href={`/job-cards/${jobData.jobNumber}`} style={{ fontSize: "13px", color: "#d10000", fontWeight: 600 }}>
              View job card →
            </Link>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            border: "1px solid #f3f4f6",
            padding: "24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span style={{ fontSize: "12px", color: "#9ca3af", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Vehicle
            </span>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#111827", margin: 0 }}>
              {jobData.reg || "—"}
            </h1>
            <p style={{ margin: 0, color: "#4b5563" }}>
              {jobData.makeModel || jobData.vehicle_make_model || "Vehicle details unavailable"}
            </p>
            <div
              style={{
                backgroundColor: statusColor,
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px 14px",
                borderRadius: "999px",
                fontWeight: 600,
                marginTop: "6px",
              }}
            >
              {vhcStatus}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#9ca3af", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Customer
            </span>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
              {jobData.customer || "Unknown customer"}
            </p>
            <p style={{ margin: 0, color: "#4b5563" }}>{jobData.customerEmail || "No email on record"}</p>
            <p style={{ margin: 0, color: "#4b5563" }}>{jobData.customerPhone || "No phone on record"}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#9ca3af", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Workflow milestones
            </span>
            {timelineEvents.length === 0 ? (
              <p style={{ margin: 0, color: "#6b7280" }}>We haven't recorded any VHC milestones yet.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "18px", color: "#374151", fontSize: "13px" }}>
                {timelineEvents.map((event) => (
                  <li key={`${event.label}-${event.value}`} style={{ marginBottom: "6px" }}>
                    <strong>{event.label}:</strong> {formatDateTime(event.value)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
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
            { label: "Sections captured", value: sections.length, color: "#0f172a" },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                flex: "1 1 200px",
                borderRadius: "12px",
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

        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            border: "1px solid #f3f4f6",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#111827" }}>VHC sections</h2>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>
              {vhcSummary.itemCount} cards captured by technicians
            </span>
          </div>

          {sections.length === 0 ? (
            <div
              style={{
                padding: "24px",
                borderRadius: "12px",
                border: "1px dashed #e5e7eb",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              No technician VHC data found for this job yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {sections.map((section) => (
                <div
                  key={section.key}
                  style={{
                    border: "1px solid #f3f4f6",
                    borderRadius: "12px",
                    padding: "16px",
                    backgroundColor: "#fff",
                    boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#111827" }}>{section.title}</h3>
                      <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
                        {section.type === "mandatory" ? "Mandatory section" : "Optional section"}
                      </p>
                    </div>
                    {renderSectionMetrics(section)}
                  </div>
                  <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    {section.items.map((item, idx) => renderSectionItem(item, idx))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
