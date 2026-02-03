// file location: src/pages/vhc/share/[jobNumber]/[linkCode].js
// Public shareable VHC preview page - no login required, read-only view
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { summariseTechnicianVhc } from "@/lib/vhc/summary";
import { normaliseDecisionStatus, resolveSeverityKey } from "@/lib/vhc/summaryStatus";

const formatCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "£0.00";
  return `£${num.toFixed(2)}`;
};

const SEVERITY_THEME = {
  red: {
    background: "var(--danger-surface)",
    border: "var(--danger-surface)",
    text: "var(--danger)",
  },
  amber: {
    background: "var(--warning-surface)",
    border: "var(--warning-surface)",
    text: "var(--warning)",
  },
  green: {
    background: "var(--success-surface)",
    border: "var(--success)",
    text: "var(--success)",
  },
  grey: {
    background: "var(--info-surface)",
    border: "var(--info-surface)",
    text: "var(--info)",
  },
  authorized: {
    background: "var(--success-surface)",
    border: "var(--success)",
    text: "var(--success)",
  },
  declined: {
    background: "var(--danger-surface)",
    border: "var(--danger)",
    text: "var(--danger)",
  },
};

const TAB_OPTIONS = [
  { id: "summary", label: "Summary" },
  { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" },
];

const LABOUR_RATE = 85;

export default function PublicSharePreviewPage() {
  const router = useRouter();
  const { jobNumber, linkCode } = router.query;

  const [job, setJob] = useState(null);
  const [vhcChecksData, setVhcChecksData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [jobFiles, setJobFiles] = useState([]);
  const [partsJobItems, setPartsJobItems] = useState([]);
  const [expiresAt, setExpiresAt] = useState(null);

  // Validate link and fetch job data
  useEffect(() => {
    if (!jobNumber || !linkCode) return;

    const validateAndFetch = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/job-cards/${jobNumber}/share-link?linkCode=${linkCode}`);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 410) {
            setError("This link has expired. Please request a new link from the service team.");
          } else if (response.status === 404) {
            setError("This link is invalid or the job was not found.");
          } else {
            setError(data.error || "Failed to load job data");
          }
          return;
        }

        const { jobData, expiresAt: linkExpiresAt } = data;
        const { vhc_checks = [], parts_job_items = [], job_files = [], ...jobFields } = jobData;

        setJob(jobFields);
        setVhcChecksData(vhc_checks || []);
        setPartsJobItems(parts_job_items || []);
        setJobFiles(job_files || []);
        setExpiresAt(linkExpiresAt);
      } catch (err) {
        console.error("Error fetching job data:", err);
        setError("Failed to load job data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    validateAndFetch();
  }, [jobNumber, linkCode]);

  // Parse VHC data from checksheet
  const vhcData = useMemo(() => {
    if (!job?.checksheet) return null;
    try {
      return typeof job.checksheet === "string" ? JSON.parse(job.checksheet) : job.checksheet;
    } catch {
      return null;
    }
  }, [job?.checksheet]);

  // Summarize VHC items from checksheet
  const summaryItems = useMemo(() => {
    if (!vhcData) return [];
    return summariseTechnicianVhc(vhcData);
  }, [vhcData]);

  // Build lookup map for vhc_checks by vhc_id
  const vhcChecksMap = useMemo(() => {
    const map = new Map();
    vhcChecksData.forEach((check) => {
      if (check?.vhc_id) {
        map.set(String(check.vhc_id), check);
      }
    });
    return map;
  }, [vhcChecksData]);

  // Calculate labour hours by VHC item
  const labourHoursByVhcItem = useMemo(() => {
    const map = new Map();

    vhcChecksData.forEach((check) => {
      if (!check?.vhc_id) return;
      const hours = Number(check.labour_hours);
      if (Number.isFinite(hours) && hours > 0) {
        map.set(String(check.vhc_id), hours);
      }
    });

    partsJobItems.forEach((part) => {
      if (!part?.vhc_item_id) return;
      const hours = Number(part.labour_hours);
      if (Number.isFinite(hours) && hours > 0) {
        const key = String(part.vhc_item_id);
        const current = map.get(key) || 0;
        map.set(key, Math.max(current, hours));
      }
    });

    return map;
  }, [vhcChecksData, partsJobItems]);

  // Calculate parts cost by VHC item
  const partsCostByVhcItem = useMemo(() => {
    const map = new Map();

    partsJobItems.forEach((part) => {
      if (!part?.vhc_item_id) return;
      const key = String(part.vhc_item_id);
      const qty = Number(part.quantity_requested) || 1;
      const unitPrice = Number(part.unit_price ?? part.part?.unit_price ?? 0);
      if (Number.isFinite(unitPrice)) {
        map.set(key, (map.get(key) || 0) + (qty * unitPrice));
      }
    });

    return map;
  }, [partsJobItems]);

  // Resolve total for an item
  const resolveItemTotal = (itemId) => {
    const vhcCheck = vhcChecksMap.get(String(itemId));

    if (vhcCheck?.total_override && Number(vhcCheck.total_override) > 0) {
      return Number(vhcCheck.total_override);
    }

    const labourHours = labourHoursByVhcItem.get(String(itemId)) ||
                        (vhcCheck?.labour_hours ? Number(vhcCheck.labour_hours) : 0);
    const partsCost = partsCostByVhcItem.get(String(itemId)) ||
                      (vhcCheck?.parts_cost ? Number(vhcCheck.parts_cost) : 0);

    const labourCost = Number.isFinite(labourHours) ? labourHours * LABOUR_RATE : 0;
    return labourCost + partsCost;
  };

  // Build severity lists with proper categorization
  const severityLists = useMemo(() => {
    const lists = { red: [], amber: [], green: [], grey: [], authorized: [], declined: [] };

    summaryItems.forEach((item) => {
      const itemId = String(item.id);
      const vhcCheck = vhcChecksMap.get(itemId);

      const approvalStatus = normaliseDecisionStatus(vhcCheck?.approval_status);
      const rawSeverity = item.severityKey || item.rawSeverity ||
                          resolveSeverityKey(item.rawSeverity, vhcCheck?.display_status);

      const enrichedItem = {
        ...item,
        vhcCheck,
        approvalStatus,
        rawSeverity,
        labourHours: labourHoursByVhcItem.get(itemId) || (vhcCheck?.labour_hours ? Number(vhcCheck.labour_hours) : 0),
        partsCost: partsCostByVhcItem.get(itemId) || (vhcCheck?.parts_cost ? Number(vhcCheck.parts_cost) : 0),
        totalOverride: vhcCheck?.total_override,
        total: resolveItemTotal(itemId),
      };

      if (approvalStatus === "authorized" || approvalStatus === "completed") {
        lists.authorized.push(enrichedItem);
      } else if (approvalStatus === "declined") {
        lists.declined.push(enrichedItem);
      } else if (rawSeverity === "red") {
        lists.red.push(enrichedItem);
      } else if (rawSeverity === "amber") {
        lists.amber.push(enrichedItem);
      } else if (rawSeverity === "green" || rawSeverity === "grey") {
        lists.green.push(enrichedItem);
      } else {
        lists.grey.push(enrichedItem);
      }
    });

    return lists;
  }, [summaryItems, vhcChecksMap, labourHoursByVhcItem, partsCostByVhcItem]);

  // Calculate financial totals
  const customerTotals = useMemo(() => {
    const calculateListTotal = (list) =>
      list.reduce((sum, item) => sum + (item.total || 0), 0);

    return {
      red: calculateListTotal(severityLists.red),
      amber: calculateListTotal(severityLists.amber),
      green: calculateListTotal(severityLists.green),
      authorized: calculateListTotal(severityLists.authorized),
      declined: calculateListTotal(severityLists.declined),
    };
  }, [severityLists]);

  // Filter photos and videos
  const photoFiles = useMemo(() => {
    return jobFiles.filter((file) => {
      const type = (file.file_type || "").toLowerCase();
      const name = (file.file_name || "").toLowerCase();
      return type.startsWith("image") || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name);
    });
  }, [jobFiles]);

  const videoFiles = useMemo(() => {
    return jobFiles.filter((file) => {
      const type = (file.file_type || "").toLowerCase();
      const name = (file.file_name || "").toLowerCase();
      return type.startsWith("video") || /\.(mp4|mov|avi|mkv|webm)$/i.test(name);
    });
  }, [jobFiles]);

  // Render read-only customer row
  const renderCustomerRow = (item, severity) => {
    const isAuthorized = item.approvalStatus === "authorized" || item.approvalStatus === "completed";
    const isDeclined = item.approvalStatus === "declined";

    const detailLabel = item.label || item.sectionName || "Recorded item";
    const detailContent = item.concernText || item.notes || "";
    const measurement = item.measurement || "";
    const categoryLabel = item.categoryLabel || item.sectionName || "Recorded Section";
    const total = item.total || 0;

    const getRowBackground = () => {
      if (isAuthorized || isDeclined) {
        const originalSeverity = item.rawSeverity;
        if (originalSeverity === "red") {
          return "var(--danger-surface)";
        } else if (originalSeverity === "amber") {
          return "var(--warning-surface)";
        }
      }
      return "transparent";
    };

    return (
      <div
        key={`${severity}-${item.id}`}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "14px 16px",
          borderBottom: "1px solid var(--info-surface)",
          background: getRowBackground(),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ minWidth: "240px", flex: 1 }}>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
              {categoryLabel}
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--accent-purple)", marginTop: "4px" }}>
              {detailLabel}
            </div>
            {detailContent && (
              <div style={{ fontSize: "13px", color: "var(--info-dark)", marginTop: "4px" }}>{detailContent}</div>
            )}
            {measurement && (
              <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "4px" }}>{measurement}</div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>{formatCurrency(total)}</div>

            {/* Status badge for authorized/declined items (read-only) */}
            {(isAuthorized || isDeclined) && (
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: "16px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: isAuthorized ? "var(--success-surface)" : "var(--danger-surface)",
                  color: isAuthorized ? "var(--success)" : "var(--danger)",
                }}
              >
                {isAuthorized ? "Authorised" : "Declined"}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render customer section
  const renderCustomerSection = (title, items, severity) => {
    const theme = SEVERITY_THEME[severity] || { border: "var(--info-surface)", background: "var(--surface)" };

    let authorizedTotal = 0;
    let declinedTotal = 0;

    items.forEach((item) => {
      const total = item.total || 0;
      if (item.approvalStatus === "authorized" || item.approvalStatus === "completed") {
        authorizedTotal += total;
      } else if (item.approvalStatus === "declined") {
        declinedTotal += total;
      }
    });

    return (
      <div
        style={{
          border: `1px solid ${theme.border || "var(--info-surface)"}`,
          borderRadius: "16px",
          background: theme.background || "var(--surface)",
          overflow: "hidden",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            fontWeight: 700,
            color: theme.text || "var(--accent-purple)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: "12px",
            borderBottom: "1px solid var(--info-surface)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{title}</span>
            {(authorizedTotal > 0 || declinedTotal > 0) && (
              <div style={{ display: "flex", gap: "16px", fontSize: "11px", textTransform: "none", fontWeight: 600 }}>
                {authorizedTotal > 0 && (
                  <span style={{ color: "var(--success)" }}>
                    Authorised: {formatCurrency(authorizedTotal)}
                  </span>
                )}
                {declinedTotal > 0 && (
                  <span style={{ color: "var(--danger)" }}>
                    Declined: {formatCurrency(declinedTotal)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {items.length === 0 ? (
          <div style={{ padding: "16px", fontSize: "13px", color: "var(--info)" }}>
            No items recorded.
          </div>
        ) : (
          items.map((item) => renderCustomerRow(item, severity))
        )}
      </div>
    );
  };

  // Render Financial Totals Grid
  const renderFinancialTotalsGrid = () => {
    const gridItems = [
      { label: "Red Work", value: customerTotals.red, color: "var(--danger)" },
      { label: "Amber Work", value: customerTotals.amber, color: "var(--warning)" },
      { label: "Authorized", value: customerTotals.authorized, color: "var(--success)" },
      { label: "Declined", value: customerTotals.declined, color: "var(--info)" },
    ];

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        {gridItems.map((item) => (
          <div
            key={item.label}
            style={{
              padding: "12px",
              border: `1px solid ${item.color}33`,
              borderRadius: "12px",
              background: `${item.color}11`,
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--info)", marginBottom: "4px" }}>
              {item.label}
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: item.color }}>
              {formatCurrency(item.value)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render Summary Tab
  const renderSummaryTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {renderFinancialTotalsGrid()}

      {severityLists.red && severityLists.red.length > 0 &&
        renderCustomerSection("Red Items", severityLists.red, "red")}

      {severityLists.amber && severityLists.amber.length > 0 &&
        renderCustomerSection("Amber Items", severityLists.amber, "amber")}

      {severityLists.authorized && severityLists.authorized.length > 0 &&
        renderCustomerSection("Authorised", severityLists.authorized, "authorized")}

      {severityLists.declined && severityLists.declined.length > 0 &&
        renderCustomerSection("Declined", severityLists.declined, "declined")}

      {renderCustomerSection("Green Items", severityLists.green || [], "green")}
    </div>
  );

  // Render Photos Tab
  const renderPhotosTab = () => (
    <div>
      {photoFiles.length === 0 ? (
        <div
          style={{
            padding: "18px",
            border: "1px solid var(--info-surface)",
            borderRadius: "12px",
            background: "var(--info-surface)",
            color: "var(--info)",
            fontSize: "13px",
          }}
        >
          No photos have been uploaded for this job.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {photoFiles.map((file) => (
            <div
              key={file.file_id}
              style={{
                background: "var(--surface)",
                borderRadius: "12px",
                border: "1px solid var(--info-surface)",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "relative", paddingTop: "75%", background: "var(--info-surface)" }}>
                <img
                  src={file.file_url}
                  alt={file.file_name || "Photo"}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  loading="lazy"
                />
              </div>
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--accent-purple)", wordBreak: "break-word" }}>
                  {file.file_name || "Unnamed photo"}
                </div>
                {file.folder && (
                  <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "4px" }}>
                    {file.folder}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render Videos Tab
  const renderVideosTab = () => (
    <div>
      {videoFiles.length === 0 ? (
        <div
          style={{
            padding: "18px",
            border: "1px solid var(--info-surface)",
            borderRadius: "12px",
            background: "var(--info-surface)",
            color: "var(--info)",
            fontSize: "13px",
          }}
        >
          No videos have been uploaded for this job.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {videoFiles.map((file) => (
            <div
              key={file.file_id}
              style={{
                background: "var(--surface)",
                borderRadius: "12px",
                border: "1px solid var(--info-surface)",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "relative", paddingTop: "56.25%", background: "var(--accent-purple)" }}>
                <video
                  src={file.file_url}
                  controls
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--accent-purple)", wordBreak: "break-word" }}>
                  {file.file_name || "Unnamed video"}
                </div>
                {file.folder && (
                  <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "4px" }}>
                    {file.folder}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-light)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "16px", color: "var(--info)" }}>Loading vehicle health check...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Head>
          <title>Vehicle Health Check</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-light)" }}>
          <div style={{ textAlign: "center", padding: "24px", maxWidth: "400px" }}>
            <div style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: "var(--warning-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px"
            }}>
              ⚠️
            </div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "8px" }}>
              Unable to Load Report
            </div>
            <div style={{ fontSize: "14px", color: "var(--info)", marginBottom: "24px" }}>
              {error}
            </div>
          </div>
        </div>
      </>
    );
  }

  const vehicleInfo = job?.vehicle;

  return (
    <>
      <Head>
        <title>Vehicle Health Check - Job #{jobNumber}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div style={{ minHeight: "100vh", background: "var(--surface-light)" }}>
        {/* Header */}
        <header
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--info-surface)",
            padding: "16px 24px",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent-purple)", margin: 0 }}>
                  Vehicle Health Check
                </h1>
                <div style={{ fontSize: "14px", color: "var(--info)", marginTop: "4px" }}>
                  Job #{jobNumber}
                  {vehicleInfo && ` • ${vehicleInfo.registration || ""} ${vehicleInfo.make || ""} ${vehicleInfo.model || ""}`.trim()}
                </div>
              </div>
              {expiresAt && (
                <div style={{
                  padding: "6px 12px",
                  background: "var(--info-surface)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "var(--info)"
                }}>
                  Link expires: {new Date(expiresAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Read-only notice banner */}
        <div style={{ background: "var(--info-surface)", padding: "10px 24px", borderBottom: "1px solid var(--info-surface)" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px" }}>ℹ️</span>
            <span style={{ fontSize: "13px", color: "var(--info-dark)" }}>
              This is a read-only preview of the vehicle health check report.
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--info-surface)" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "16px 24px",
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === tab.id ? "3px solid var(--primary)" : "3px solid transparent",
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    fontSize: "14px",
                    color: activeTab === tab.id ? "var(--primary)" : "var(--info)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {tab.label}
                  {tab.id === "photos" && photoFiles.length > 0 && (
                    <span style={{ marginLeft: "8px", background: "var(--info-surface)", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>
                      {photoFiles.length}
                    </span>
                  )}
                  {tab.id === "videos" && videoFiles.length > 0 && (
                    <span style={{ marginLeft: "8px", background: "var(--info-surface)", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>
                      {videoFiles.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
          {activeTab === "summary" && renderSummaryTab()}
          {activeTab === "photos" && renderPhotosTab()}
          {activeTab === "videos" && renderVideosTab()}
        </main>

        {/* Footer */}
        <footer
          style={{
            background: "var(--surface)",
            borderTop: "1px solid var(--info-surface)",
            padding: "16px 24px",
            marginTop: "auto",
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "var(--info)" }}>
              Vehicle Health Check Report • Job #{jobNumber}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
