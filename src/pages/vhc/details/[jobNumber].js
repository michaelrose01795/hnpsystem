"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";
import { summarizePartsPipeline } from "@/lib/partsPipeline";
import { getJobByNumberOrReg } from "@/lib/database/jobs";
import { getVhcWorkflowStatus } from "@/lib/database/vhc";
import {
  STATUS_COLORS,
  computeSeverityTotals,
  deriveVhcDashboardStatus,
  parseVhcBuilderPayload,
  summariseTechnicianVhc,
} from "@/lib/vhc/summary";

const VAT_RATE = 0.2;
const EMPTY_SUMMARY = { sections: [], itemCount: 0 };

const formatMoney = (value = 0) => {
  const numeric = Number.parseFloat(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0.00";
  }
  return numeric.toFixed(2);
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const sumAuthorizedItems = (items) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, entry) => {
    if (!entry) return sum;
    const amount = Number.parseFloat(
      entry.amount ??
        entry.total ??
        entry.value ??
        entry.price ??
        entry.cost ??
        (typeof entry === "number" ? entry : 0),
    );
    if (!Number.isFinite(amount)) {
      return sum;
    }
    return sum + amount;
  }, 0);
};

const Badge = ({ label, color }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "4px 12px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 600,
      color: "#fff",
      backgroundColor: color || "#9ca3af",
      textTransform: "capitalize",
    }}
  >
    {label}
  </span>
);

export default function VHCDetailedView() {
  const router = useRouter();
  const { jobNumber } = router.query;

  const [job, setJob] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [builderSummary, setBuilderSummary] = useState(EMPTY_SUMMARY);
  const [severityTotals, setSeverityTotals] = useState({ red: 0, amber: 0, grey: 0 });
  const [vhcStatus, setVhcStatus] = useState("VHC not started");
  const [partsItems, setPartsItems] = useState([]);
  const [authorizedValue, setAuthorizedValue] = useState(0);
  const [declinedCount, setDeclinedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobNumber) return;
    let cancelled = false;

    const fetchPartsForJob = async (jobId) => {
      const { data, error: partsError } = await supabase
        .from("parts_job_items")
        .select(
          `
            id,
            status,
            quantity_requested,
            quantity_allocated,
            quantity_fitted,
            part:part_id(id, part_number, name)
          `,
        )
        .eq("job_id", jobId);

      if (partsError) {
        console.error("❌ Failed to load parts for VHC detail", partsError);
        return;
      }

      if (cancelled) return;

      const mapped = (data || []).map((row) => ({
        id: row.id,
        status: row.status,
        quantity: row.quantity_requested || row.quantity_allocated || row.quantity_fitted || 1,
        partName: row.part?.name || "Part",
        partNumber: row.part?.part_number || "",
      }));

      setPartsItems(mapped);
    };

    const fetchFinancialsForJob = async (jobId) => {
      const [authResponse, declineResponse] = await Promise.all([
        supabase.from("vhc_authorizations").select("authorized_items").eq("job_id", jobId),
        supabase.from("vhc_declinations").select("id").eq("job_id", jobId),
      ]);

      if (authResponse.error) {
        console.error("❌ Failed to load VHC authorizations", authResponse.error);
      }
      if (declineResponse.error) {
        console.error("❌ Failed to load VHC declinations", declineResponse.error);
      }
      if (cancelled) return;

      const authorizedNet = (authResponse.data || []).reduce(
        (sum, row) => sum + sumAuthorizedItems(row?.authorized_items),
        0,
      );
      setAuthorizedValue(authorizedNet);
      setDeclinedCount((declineResponse.data || []).length);
    };

    const loadJob = async () => {
      setLoading(true);
      setError(null);
      try {
        const jobRecord = await getJobByNumberOrReg(jobNumber);
        if (cancelled) return;

        if (!jobRecord) {
          setJob(null);
          setError("Job not found.");
          return;
        }

        setJob(jobRecord);

        const builderPayload = parseVhcBuilderPayload(jobRecord.vhcChecks || []);
        const summary = summariseTechnicianVhc(builderPayload) || EMPTY_SUMMARY;
        setBuilderSummary(summary);
        setSeverityTotals(
          computeSeverityTotals({
            builderSummary: summary,
            checks: jobRecord.vhcChecks || [],
          }),
        );

        const workflowRow = await getVhcWorkflowStatus(jobRecord.id).catch((workflowError) => {
          console.error("❌ Failed to fetch VHC workflow status", workflowError);
          return null;
        });

        if (cancelled) return;

        setWorkflow(workflowRow);
        const resolvedStatus = deriveVhcDashboardStatus({
          job: jobRecord,
          workflow: workflowRow,
          hasChecks: summary.sections.length > 0,
        });
        if (resolvedStatus) {
          setVhcStatus(resolvedStatus);
        } else if (!jobRecord.vhcRequired) {
          setVhcStatus("Not required");
        } else {
          setVhcStatus("VHC not started");
        }

        await Promise.all([fetchPartsForJob(jobRecord.id), fetchFinancialsForJob(jobRecord.id)]);
      } catch (err) {
        if (!cancelled) {
          console.error("❌ Failed to load VHC details", err);
          setError(err.message || "Failed to load VHC details.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadJob();

    return () => {
      cancelled = true;
    };
  }, [jobNumber]);

  const partsPipelineSummary = useMemo(
    () =>
      summarizePartsPipeline(partsItems, {
        quantityField: (part) => part.quantity || 1,
      }),
    [partsItems],
  );

  const statusColor = STATUS_COLORS[vhcStatus] || "#9ca3af";
  const totalChecksLogged = builderSummary?.itemCount || 0;
  const sections = builderSummary?.sections || [];
  const authorizedGross = authorizedValue * (1 + VAT_RATE);

  if (loading) {
    return (
      <Layout>
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            color: "#4b5563",
          }}
        >
          Loading VHC details…
        </div>
      </Layout>
    );
  }

  if (error || !job) {
    return (
      <Layout>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            color: "#b91c1c",
            fontSize: "16px",
          }}
        >
          <p>{error || "Unable to load that job."}</p>
          <button
            onClick={() => router.push("/vhc/dashboard")}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "1px solid #ef4444",
              background: "#fff",
              color: "#b91c1c",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Back to VHC Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        style={{
          height: "100%",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflowY: "auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <button
              onClick={() => router.push("/vhc/dashboard")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              ← Back
            </button>
            <div style={{ flex: 1, minWidth: "220px" }}>
              <div style={{ fontSize: "14px", color: "#6b7280" }}>Job {job.jobNumber}</div>
              <h1 style={{ fontSize: "24px", margin: "4px 0", color: "#111827" }}>Vehicle Health Check</h1>
              <div style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937" }}>{job.reg || "Registration pending"}</div>
            </div>
            <Link
              href={`/job-cards/${job.jobNumber}`}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                color: "#111827",
                fontWeight: 600,
              }}
            >
              Open Job Card
            </Link>
          </div>

          {job.vhcRequired === false && (
            <div
              style={{
                borderRadius: "12px",
                border: "1px solid #fed7aa",
                background: "#fff7ed",
                padding: "12px 16px",
                color: "#9a3412",
                fontWeight: 500,
              }}
            >
              This job was not flagged for a VHC when it was created. Any checks shown below were captured manually after check-in.
            </div>
          )}

          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              border: "1px solid #f3f4f6",
              padding: "20px",
              boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>Vehicle</span>
              <strong style={{ fontSize: "16px", color: "#111827" }}>{job.makeModel || "Not recorded"}</strong>
              <span style={{ fontSize: "13px", color: "#4b5563" }}>Mileage: {job.mileage ? `${job.mileage} miles` : "Unknown"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>Customer</span>
              <strong style={{ fontSize: "16px", color: "#111827" }}>{job.customer || "Not recorded"}</strong>
              <span style={{ fontSize: "13px", color: "#4b5563" }}>{job.customerPhone || job.customerEmail || "No contact on file"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>Timeline</span>
              <span style={{ fontSize: "13px", color: "#4b5563" }}>Checked in: {job.checkedInAt ? formatDateTime(job.checkedInAt) : "Not yet"}</span>
              <span style={{ fontSize: "13px", color: "#4b5563" }}>Last sent: {workflow?.lastSentAt ? formatDateTime(workflow.lastSentAt) : "Never"}</span>
              <span style={{ fontSize: "13px", color: "#4b5563" }}>VHC completed: {job.vhcCompletedAt ? formatDateTime(job.vhcCompletedAt) : workflow?.vhcCompletedAt ? formatDateTime(workflow.vhcCompletedAt) : "Not complete"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>Current VHC status</span>
              <Badge label={vhcStatus} color={statusColor} />
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              border: "1px solid #f3f4f6",
              padding: "20px",
              boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#111827" }}>Totals</h2>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>All figures use live data</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
              }}
            >
              {[
                { label: "Red items", value: severityTotals.red, accent: "#ef4444" },
                { label: "Amber items", value: severityTotals.amber, accent: "#f97316" },
                { label: "Grey items", value: severityTotals.grey, accent: "#6b7280" },
                { label: "Total checks logged", value: totalChecksLogged, accent: "#111827" },
                { label: "Authorised (inc VAT)", value: `£${formatMoney(authorizedGross)}`, accent: "#0f766e" },
                { label: "Declined decisions", value: declinedCount, accent: "#b91c1c" },
                { label: "Parts lines tracked", value: partsPipelineSummary.totalCount, accent: "#1d4ed8" },
                { label: "Last customer share", value: workflow?.vhcSentAt ? formatDateTime(workflow.vhcSentAt) : "Not sent", accent: "#6b7280" },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    border: "1px solid #f1f5f9",
                    borderRadius: "12px",
                    padding: "14px",
                    background: "#f9fafb",
                  }}
                >
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>{card.label}</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: card.accent }}>{card.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              border: "1px solid #f3f4f6",
              padding: "20px",
              boxShadow: "0 4px 12px rgba(15,23,42,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>Parts pipeline</div>
                <h2 style={{ margin: 0, fontSize: "18px", color: "#111827" }}>Tracked part movements</h2>
              </div>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>{partsPipelineSummary.totalCount} active line{partsPipelineSummary.totalCount === 1 ? "" : "s"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              {(partsPipelineSummary.stageSummary || []).map((stage) => (
                <div
                  key={stage.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "12px",
                    background: stage.count > 0 ? "#fff7ed" : "#f9fafb",
                  }}
                >
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>{stage.label}</div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#ea580c" }}>{stage.count}</div>
                  <p style={{ fontSize: "12px", color: "#6b7280", margin: "4px 0 0" }}>{stage.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              border: "1px solid #f3f4f6",
              padding: "20px",
              boxShadow: "0 4px 12px rgba(15,23,42,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#111827" }}>Captured checks</h2>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>{sections.length} section{sections.length === 1 ? "" : "s"}</span>
            </div>
            {sections.length === 0 ? (
              <div style={{ padding: "20px", borderRadius: "12px", background: "#f8fafc", textAlign: "center", color: "#475569" }}>
                No digital VHC data has been recorded for this job yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {sections.map((section) => (
                  <div key={section.key || section.title} style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                      <div>
                        <div style={{ fontSize: "14px", color: "#6b7280" }}>Section</div>
                        <div style={{ fontSize: "18px", fontWeight: 600, color: "#111827" }}>{section.title}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {section.metrics?.red ? <Badge label={`${section.metrics.red} Red`} color="#dc2626" /> : null}
                        {section.metrics?.amber ? <Badge label={`${section.metrics.amber} Amber`} color="#f97316" /> : null}
                        {section.metrics?.grey ? <Badge label={`${section.metrics.grey} Grey`} color="#6b7280" /> : null}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {(section.items || []).map((item, index) => (
                        <div
                          key={`${section.key || section.title}-${index}`}
                          style={{
                            border: "1px solid #f1f5f9",
                            borderRadius: "10px",
                            padding: "12px",
                            background: "#fdfdfd",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px", gap: "12px" }}>
                            <span style={{ fontSize: "16px", fontWeight: 600, color: "#111827" }}>{item.heading}</span>
                            {item.status ? <Badge label={item.status} color={STATUS_COLORS[item.status] || "#9ca3af"} /> : null}
                          </div>
                          {item.rows?.length ? (
                            <ul style={{ margin: 0, paddingLeft: "18px", color: "#374151", fontSize: "13px" }}>
                              {item.rows.map((row, rowIndex) => (
                                <li key={`${section.key || section.title}-${index}-row-${rowIndex}`}>{row}</li>
                              ))}
                            </ul>
                          ) : null}
                          {item.concerns?.length ? (
                            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                              {item.concerns.map((concern, concernIndex) => (
                                <div key={`${section.key || section.title}-${index}-concern-${concernIndex}`} style={{ display: "flex", gap: "6px", fontSize: "13px", color: "#374151" }}>
                                  <span style={{ fontWeight: 600, color: STATUS_COLORS[concern.status] || "#b45309" }}>{concern.status}:</span>
                                  <span>{concern.text}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
