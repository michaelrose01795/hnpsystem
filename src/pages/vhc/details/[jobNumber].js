"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";

const STATUS_BADGES = {
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#10b981",
  grey: "#6b7280",
};

const TYRE_POSITIONS = [
  { key: "frontLeft", label: "Nearside Front" },
  { key: "frontRight", label: "Offside Front" },
  { key: "rearLeft", label: "Nearside Rear" },
  { key: "rearRight", label: "Offside Rear" },
];

const TAB_OPTIONS = [
  { id: "summary", label: "Summary" },
  { id: "health-check", label: "Health Check" },
  { id: "full-vhc-report", label: "Full VHC Report" },
];

const COLOUR_CLASS = {
  red: "#fee2e2",
  amber: "#fef3c7",
  green: "#ecfdf5",
  grey: "#f3f4f6",
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

const safeJsonParse = (payload) => {
  if (!payload) return null;
  if (typeof payload === "object") return payload;
  try {
    return JSON.parse(payload);
  } catch (_err) {
    return null;
  }
};

const emptyPlaceholder = (value) => (value || value === 0 ? value : "—");

const normaliseColour = (value) => {
  if (!value) return null;
  const colour = value.toString().toLowerCase();
  if (colour.includes("red")) return "red";
  if (colour.includes("amber") || colour.includes("yellow")) return "amber";
  if (colour.includes("green")) return "green";
  if (colour.includes("grey") || colour.includes("gray")) return "grey";
  return null;
};

const formatMeasurement = (value) => {
  if (!value && value !== 0) return null;
  if (Array.isArray(value)) {
    const merged = value.filter(Boolean).map((item) => item.toString().trim()).join(" / ");
    return merged || null;
  }
  if (typeof value === "object") {
    const merged = Object.values(value)
      .filter(Boolean)
      .map((item) => item.toString().trim())
      .join(" / ");
    return merged || null;
  }
  return value.toString();
};

const extractTyres = (builderData) => {
  if (!builderData) return [];
  const source = builderData.wheels || builderData.tyres || {};
  return TYRE_POSITIONS.map(({ key, label }) => {
    const entry = source[key] || source[label] || {};
    const condition = normaliseColour(entry.condition || entry.colour || entry.status);
    return {
      key,
      label,
      make: entry.make || entry.brand || entry.manufacturer || null,
      size: entry.size || entry.tyreSize || null,
      load: entry.load || entry.loadIndex || entry.load_index || null,
      speed: entry.speed || entry.speedRating || entry.speed_rating || null,
      tread: {
        outer: entry.outer || entry.treadOuter || entry.tread?.outer || entry.depth?.outer || null,
        middle: entry.middle || entry.treadMiddle || entry.tread?.middle || entry.depth?.middle || null,
        inner: entry.inner || entry.treadInner || entry.tread?.inner || entry.depth?.inner || null,
      },
      condition,
    };
  });
};

const extractBrakes = (builderData) => {
  if (!builderData) return [];
  const brakes = builderData.brakes || builderData.brakesHubs || [];
  if (Array.isArray(brakes)) {
    return brakes.map((entry, index) => ({
      key: entry.id || index,
      label: entry.position || entry.label || `Brake ${index + 1}`,
      pads: entry.padMeasurement || entry.padMeasurements || entry.pads || entry.measurement || null,
      discs: entry.discMeasurement || entry.discMeasurements || entry.discs || null,
      status: normaliseColour(entry.condition || entry.status),
      notes: entry.notes || entry.description || null,
    }));
  }
  return Object.entries(brakes).map(([key, entry]) => ({
    key,
    label: entry.label || key,
    pads: entry.padMeasurement || entry.padMeasurements || entry.pads || entry.measurement || null,
    discs: entry.discMeasurement || entry.discMeasurements || entry.discs || null,
    status: normaliseColour(entry.condition || entry.status),
    notes: entry.notes || entry.description || null,
  }));
};

const buildSeverityGroups = (sections = []) => {
  const buckets = { red: new Map(), amber: new Map() };
  sections.forEach((section) => {
    const title = section.name || section.title || "Vehicle Health Check";
    (section.items || []).forEach((item) => {
      const colour = normaliseColour(item.colour || item.status || section.colour);
      if (colour === "red" || colour === "amber") {
        const bucket = buckets[colour];
        const next = bucket.get(title) || [];
        next.push(item);
        bucket.set(title, next);
      }
    });
  });
  return buckets;
};

const formatSectionItem = (item) => {
  const parts = [];
  if (item.label) parts.push(item.label);
  if (item.measurement) parts.push(item.measurement);
  if (item.notes) parts.push(item.notes);
  return parts.length > 0 ? parts.join(" – ") : "Recorded item";
};

const HealthCheckSection = ({ section }) => {
  const colour = normaliseColour(section.colour);
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "16px",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>{section.name || section.title || "Section"}</h4>
        {colour ? (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              background: COLOUR_CLASS[colour] || "#f3f4f6",
              color: STATUS_BADGES[colour] || "#374151",
              fontSize: "12px",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {colour}
          </span>
        ) : null}
      </div>
      {(section.items || []).length === 0 ? (
        <p style={{ margin: 0, color: "#9ca3af", fontStyle: "italic" }}>No items recorded.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(section.items || []).map((item, index) => {
            const itemColour = normaliseColour(item.colour || item.status);
            return (
              <div
                key={`${section.name || "section"}-${index}`}
                style={{
                  border: "1px solid #f3f4f6",
                  borderRadius: "8px",
                  padding: "12px",
                  background: "#fafafa",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{item.label || "Item"}</span>
                  {itemColour ? (
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: COLOUR_CLASS[itemColour] || "#f3f4f6",
                        color: STATUS_BADGES[itemColour] || "#374151",
                        textTransform: "capitalize",
                      }}
                    >
                      {itemColour}
                    </span>
                  ) : null}
                </div>
                {item.measurement ? (
                  <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>{item.measurement}</p>
                ) : null}
                {item.notes ? (
                  <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>{item.notes}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function VhcDetailsPage() {
  const router = useRouter();
  const { jobNumber } = router.query;

  const [job, setJob] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [builderData, setBuilderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    if (!jobNumber) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const jobPromise = supabase
          .from("jobs")
          .select(
            `*,
            customer:customers(*),
            vehicle:vehicles(*),
            assigned_technician:profiles(*)`
          )
          .eq("job_number", jobNumber)
          .single();

        const vhcPromise = supabase
          .from("vhc_submissions")
          .select("*")
          .eq("job_number", jobNumber)
          .single();

        const [{ data: jobRow, error: jobError }, { data: vhcRow, error: vhcError }] = await Promise.all([
          jobPromise,
          vhcPromise,
        ]);

        if (jobError) throw jobError;
        if (vhcError && vhcError.message !== "Row not found") throw vhcError;

        setJob(jobRow || null);
        setSubmission(vhcRow || null);
        setBuilderData(safeJsonParse(vhcRow?.builder_payload));
      } catch (err) {
        console.error("Failed to load VHC details", err);
        setError("Unable to load VHC details for this job.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jobNumber]);

  const tyreDetails = useMemo(() => extractTyres(builderData), [builderData]);
  const brakeDetails = useMemo(() => extractBrakes(builderData), [builderData]);
  const sections = useMemo(() => builderData?.sections || [], [builderData]);
  const severityBuckets = useMemo(() => buildSeverityGroups(sections), [sections]);

  const customerName = useMemo(() => {
    if (!job?.customer) return "—";
    if (job.customer.name) return job.customer.name;
    const first = job.customer.firstname || job.customer.first_name;
    const last = job.customer.lastname || job.customer.last_name;
    const combined = [first, last].filter(Boolean).join(" ").trim();
    return combined || job.customer.email || "—";
  }, [job]);

  if (!jobNumber) {
    return (
      <Layout>
        <div style={{ padding: "24px" }}>Provide a job number to view VHC details.</div>
      </Layout>
    );
  }

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
        <div style={{ padding: "24px", color: "#b91c1c" }}>{error}</div>
      </Layout>
    );
  }

  const tyreGrid = (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Tyres</h3>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>Both axles shown with live measurements and load data.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
        {tyreDetails.map((tyre) => {
          const bg = COLOUR_CLASS[tyre.condition] || "#fff";
          const borderColour = STATUS_BADGES[tyre.condition] || "#e5e7eb";
          return (
            <div
              key={tyre.key}
              style={{
                border: `1px solid ${borderColour}`,
                borderRadius: "12px",
                padding: "12px",
                background: bg,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{tyre.label}</strong>
                {tyre.condition ? (
                  <span style={{ fontSize: "12px", fontWeight: 600, color: STATUS_BADGES[tyre.condition] }}>{tyre.condition}</span>
                ) : (
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>No data</span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(80px, 1fr))", gap: "8px" }}>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#9ca3af" }}>Make</div>
                  <div style={{ fontWeight: 600 }}>{emptyPlaceholder(tyre.make)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#9ca3af" }}>Size</div>
                  <div style={{ fontWeight: 600 }}>{emptyPlaceholder(tyre.size)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#9ca3af" }}>Load</div>
                  <div style={{ fontWeight: 600 }}>{emptyPlaceholder(tyre.load)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#9ca3af" }}>Speed</div>
                  <div style={{ fontWeight: 600 }}>{emptyPlaceholder(tyre.speed)}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#9ca3af" }}>Tread depths</div>
                <div style={{ display: "flex", gap: "8px", marginTop: "4px", fontWeight: 600 }}>
                  <span>Outer: {emptyPlaceholder(tyre.tread.outer)}</span>
                  <span>Middle: {emptyPlaceholder(tyre.tread.middle)}</span>
                  <span>Inner: {emptyPlaceholder(tyre.tread.inner)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const brakesGrid = (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Brakes</h3>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>Pad and disc measurements recorded during the inspection.</p>
      </div>
      {brakeDetails.length === 0 ? (
        <p style={{ margin: 0, color: "#9ca3af", fontStyle: "italic" }}>No brake measurements recorded.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
          {brakeDetails.map((brake) => (
            <div
              key={brake.key}
              style={{
                border: `1px solid ${STATUS_BADGES[brake.status] || "#e5e7eb"}`,
                borderRadius: "12px",
                padding: "12px",
                background: COLOUR_CLASS[brake.status] || "#fff",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{brake.label}</strong>
                {brake.status ? (
                  <span style={{ fontSize: "12px", fontWeight: 600, color: STATUS_BADGES[brake.status] }}>{brake.status}</span>
                ) : null}
              </div>
              {formatMeasurement(brake.pads) ? (
                <div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase" }}>Pads</div>
                  <div style={{ fontWeight: 600 }}>{formatMeasurement(brake.pads)}</div>
                </div>
              ) : null}
              {formatMeasurement(brake.discs) ? (
                <div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase" }}>Discs</div>
                  <div style={{ fontWeight: 600 }}>{formatMeasurement(brake.discs)}</div>
                </div>
              ) : null}
              {brake.notes ? (
                <p style={{ margin: 0, fontSize: "12px", color: "#4b5563" }}>{brake.notes}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSeverityPanel = (label, bucket, accent) => {
    if (!bucket || bucket.size === 0) return null;
    return (
      <div
        style={{
          background: "#fff",
          border: `1px solid ${accent}33`,
          borderRadius: "16px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: accent }}>{label}</h3>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>Grouped by technician section.</p>
        </div>
        {Array.from(bucket.entries()).map(([sectionName, items]) => (
          <div key={sectionName} style={{ border: "1px solid #f3f4f6", borderRadius: "12px", padding: "12px", background: "#fafafa" }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>{sectionName}</h4>
            <ul style={{ margin: 0, paddingLeft: "18px", color: "#374151", fontSize: "13px" }}>
              {items.map((item, index) => (
                <li key={`${sectionName}-${index}`}>{formatSectionItem(item)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  const jobHeader = (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        padding: "16px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.16em" }}>Job</div>
        <div style={{ fontSize: "20px", fontWeight: 700 }}>{job?.job_number || "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.16em" }}>Reg</div>
        <div style={{ fontSize: "20px", fontWeight: 700 }}>{job?.vehicle?.registration || job?.vehicle_reg || "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.16em" }}>Customer</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{customerName}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.16em" }}>Mileage</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{job?.vehicle?.mileage ? `${job.vehicle.mileage} mi` : job?.mileage ? `${job.mileage} mi` : "—"}</div>
      </div>
      <div>
        <div style={{ fontSize: "12px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.16em" }}>Submitted</div>
        <div style={{ fontSize: "15px", fontWeight: 600 }}>{formatDateTime(submission?.submitted_at || job?.created_at)}</div>
      </div>
      <div style={{ justifySelf: "end" }}>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "999px",
            background: "#111827",
            color: "#fff",
            fontWeight: 600,
            textTransform: "capitalize",
          }}
        >
          {submission?.status || "—"}
        </span>
      </div>
    </div>
  );

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => router.push("/vhc/dashboard")}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "8px 14px",
              background: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
          <Link href={job?.job_number ? `/job-cards/${job.job_number}` : "/job-cards"} style={{ fontWeight: 600, color: "#d10000" }}>
            View job card →
          </Link>
        </div>

        {jobHeader}

        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", gap: "8px" }}>
          {TAB_OPTIONS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: "10px 14px",
                  borderBottom: isActive ? "3px solid #d10000" : "3px solid transparent",
                  color: isActive ? "#111827" : "#6b7280",
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "summary" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {renderSeverityPanel("Red items", severityBuckets.red, "#ef4444")}
            {renderSeverityPanel("Amber items", severityBuckets.amber, "#f59e0b")}
            {tyreGrid}
            {brakesGrid}
          </div>
        )}

        {activeTab === "health-check" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {sections.length === 0 ? (
              <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No health check entries recorded.</p>
            ) : (
              sections.map((section) => <HealthCheckSection key={section.name || section.title} section={section} />)
            )}
          </div>
        )}

        {activeTab === "full-vhc-report" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {sections.length === 0 ? (
              <p style={{ color: "#9ca3af", fontStyle: "italic" }}>No VHC sections available.</p>
            ) : (
              sections.map((section) => (
                <div key={`${section.name || "section"}-full`} style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>{section.name || section.title || "Section"}</h4>
                    {section.colour ? (
                      <span style={{ fontSize: "12px", fontWeight: 600, color: STATUS_BADGES[normaliseColour(section.colour)] || "#374151" }}>
                        {section.colour}
                      </span>
                    ) : null}
                  </div>
                  {(section.items || []).length === 0 ? (
                    <p style={{ margin: "8px 0 0", color: "#9ca3af", fontStyle: "italic" }}>No items recorded.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                      {(section.items || []).map((item, index) => (
                        <div key={`${section.name || "section"}-full-${index}`} style={{ border: "1px solid #f3f4f6", borderRadius: "10px", padding: "12px", background: "#fafafa" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 600 }}>{item.label || "Item"}</span>
                            {item.colour ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  padding: "2px 8px",
                                  borderRadius: "999px",
                                  background: COLOUR_CLASS[normaliseColour(item.colour)] || "#f3f4f6",
                                  color: STATUS_BADGES[normaliseColour(item.colour)] || "#374151",
                                  textTransform: "capitalize",
                                }}
                              >
                                {item.colour}
                              </span>
                            ) : null}
                          </div>
                          {item.measurement ? <p style={{ margin: "4px 0", color: "#374151" }}>{item.measurement}</p> : null}
                          {item.notes ? <p style={{ margin: 0, color: "#6b7280" }}>{item.notes}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
