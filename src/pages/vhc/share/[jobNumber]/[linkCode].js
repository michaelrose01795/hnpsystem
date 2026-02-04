// file location: src/pages/vhc/share/[jobNumber]/[linkCode].js
// Public shareable VHC preview page - no login required, read-only view
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { useTheme } from "@/styles/themeProvider";
import { summariseTechnicianVhc, parseVhcBuilderPayload } from "@/lib/vhc/summary";
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
  const [vhcIdAliases, setVhcIdAliases] = useState({});
  const [authorizedViewRows, setAuthorizedViewRows] = useState([]);

  // For theme-aware logo
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const { resolvedMode } = useTheme();
  const logoSrc = (isMounted ? resolvedMode : "light") === "dark"
    ? "/images/logo/DarkLogo.png"
    : "/images/logo/LightLogo.png"; 

  // Read-only pill style that switches background for light/dark themes
  const readOnlyPillStyle = useMemo(() => {
    const isDark = (isMounted ? resolvedMode : "light") === "dark";
    return {
      padding: "6px 12px",
      background: isDark ? "var(--surface)" : "var(--info-surface)",
      border: "1px solid var(--info-surface)",
      borderRadius: "8px",
      fontSize: "12px",
      color: "var(--info)",
    };
  }, [resolvedMode, isMounted]);

  // Expiry box style: purple theme in dark mode, danger (red) in light mode
  const expireBoxStyle = useMemo(() => {
    const isDark = (isMounted ? resolvedMode : "light") === "dark";
    if (isDark) {
      return {
        padding: "6px 12px",
        background: "rgba(var(--accent-purple-rgb), 0.08)",
        border: "1px solid rgba(var(--accent-purple-rgb), 0.25)",
        borderRadius: "8px",
        fontSize: "12px",
        color: "var(--accent-purple)",
        textAlign: "right",
        fontWeight: 600,
      };
    }

    return {
      padding: "6px 12px",
      background: "rgba(var(--danger-rgb), 0.08)",
      border: "1px solid rgba(var(--danger-rgb), 0.25)",
      borderRadius: "8px",
      fontSize: "12px",
      color: "var(--danger)",
      textAlign: "right",
      fontWeight: 600,
    };
  }, [resolvedMode, isMounted]);

  // Validate link and fetch job data
  useEffect(() => {
    if (!jobNumber || !linkCode) return;

    const validateAndFetch = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/job-cards/${jobNumber}/share-link?linkCode=${linkCode}`);
        let data;
        try {
          data = await response.json();
        } catch (parseErr) {
          console.error("Failed to parse JSON from share API", parseErr);
          setError("Failed to load job data (invalid response)");
          setLoading(false);
          return;
        }

        if (!response.ok) {
          console.error("Share API error", { status: response.status, body: data });
          if (response.status === 410) {
            setError("This link has expired. Please request a new link from the service team.");
          } else if (response.status === 404) {
            setError("This link is invalid or the job was not found.");
          } else {
            const serverMsg = data && data.error ? data.error : "Failed to load job data";
            const warningMsg = data && data.warnings ? ` (warnings: ${data.warnings.join(", ")})` : "";
            // Append debug details in development
            const debugDetails = (data && data.details) ? `\nDetails: ${data.details}` : (data && data.debug && process.env.NODE_ENV !== 'production' ? `\nDebug: ${JSON.stringify(data.debug)}` : "");
            setError(serverMsg + warningMsg + debugDetails);
          }
          return;
        }

        if (data && data.warnings && data.warnings.length > 0) {
          console.warn("Share API returned warnings:", data.warnings, data.debug || {});
        }

        const { jobData, expiresAt: linkExpiresAt } = data;
        const { vhc_checks = [], parts_job_items = [], job_files = [], vhc_item_aliases = [], vhc_authorized_items = [], ...jobFields } = jobData || {};

        setJob(jobFields);
        setVhcChecksData(vhc_checks || []);
        setPartsJobItems(parts_job_items || []);
        setJobFiles(job_files || []);
        setExpiresAt(linkExpiresAt);

        // Build alias map for display IDs -> canonical VHC IDs (same as customer preview)
        const aliasMap = {};
        (vhc_item_aliases || []).forEach((alias) => {
          if (alias?.display_id && alias?.vhc_item_id) {
            aliasMap[String(alias.display_id)] = String(alias.vhc_item_id);
          }
        });
        setVhcIdAliases(aliasMap);

        // Load authorized view rows from the same table used by customer preview
        setAuthorizedViewRows(vhc_authorized_items || []);
      } catch (err) {
        console.error("Error fetching job data:", err);
        setError("Failed to load job data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    validateAndFetch();
  }, [jobNumber, linkCode]);

  // Parse VHC data from checksheet — prefer the checksheet stored in the `vhc_checks` table (section='VHC_CHECKSHEET'), fall back to job.checksheet
  const vhcData = useMemo(() => {
    const fromDb = parseVhcBuilderPayload(vhcChecksData || []);
    if (fromDb) return fromDb;
    if (!job?.checksheet) return null;
    try {
      return typeof job.checksheet === "string" ? JSON.parse(job.checksheet) : job.checksheet;
    } catch (err) {
      console.error("Failed to parse checksheet JSON from job.checksheet:", err, { jobChecksheet: job?.checksheet });
      return null;
    }
  }, [vhcChecksData, job?.checksheet]);

  // Helper to normalise colour/status (copied from customer-preview)
  const normaliseColour = (value) => {
    if (!value) return null;
    const lower = String(value).toLowerCase().trim();
    if (lower.includes("red")) return "red";
    if (lower.includes("amber") || lower.includes("yellow") || lower.includes("orange")) return "amber";
    if (lower.includes("green") || lower.includes("good") || lower.includes("pass")) return "green";
    if (lower.includes("grey") || lower.includes("gray") || lower.includes("neutral")) return "grey";
    return "grey";
  };

  // Helper to build stable display ID
  const buildStableDisplayId = (sectionName, item, index) => {
    const heading = item.heading || item.label || item.name || "";
    const prefix = sectionName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const suffix = heading.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    return `${prefix}-${suffix}-${index}`;
  };

  // Helper to resolve category for item (simple heuristics)
  const resolveCategoryForItem = (sectionName, heading) => {
    const lower = (sectionName || "").toLowerCase();
    if (lower.includes("wheel") || lower.includes("tyre")) {
      return { id: "wheels_tyres", label: "Wheels & Tyres" };
    }
    if (lower.includes("brake") || lower.includes("hub")) {
      return { id: "brakes_hubs", label: "Brakes & Hubs" };
    }
    if (lower.includes("service") || lower.includes("bonnet") || lower.includes("oil")) {
      return { id: "service_indicator", label: "Service Indicator & Under Bonnet" };
    }
    if (lower.includes("external")) {
      return { id: "external_inspection", label: "External" };
    }
    if (lower.includes("internal") || lower.includes("electrics")) {
      return { id: "internal_electrics", label: "Internal" };
    }
    if (lower.includes("underside")) {
      return { id: "underside", label: "Underside" };
    }
    return { id: "other", label: sectionName };
  };

  // Resolve canonical VHC ID from display ID using alias map
  const resolveCanonicalVhcId = useCallback((displayId) => {
    const key = String(displayId || "");
    return vhcIdAliases[key] || key;
  }, [vhcIdAliases]);

  // Build lookup map for vhc_checks by vhc_id (and include aliases)
  const vhcChecksMap = useMemo(() => {
    const map = new Map();
    vhcChecksData.forEach((check) => {
      if (check?.vhc_id) {
        map.set(String(check.vhc_id), check);
      }
    });
    // Also add entries for aliased display IDs so lookups work both ways
    Object.entries(vhcIdAliases).forEach(([displayId, canonicalId]) => {
      const check = map.get(String(canonicalId));
      if (check && !map.has(displayId)) {
        map.set(displayId, check);
      }
    });
    return map;
  }, [vhcChecksData, vhcIdAliases]);

  // Helper to compute an item's effective severity by checking several sources
  const getEffectiveSeverity = useCallback((item) => {
    if (!item) return null;

    // 1) Check directly attached vhc_check (most authoritative)
    const directCheck = item.vhcCheck || vhcChecksMap.get(String(item.id)) || vhcChecksMap.get(resolveCanonicalVhcId(String(item.id)));
    // Prefer explicit severity column over approval/display status so original red/amber/green is authoritative
    let s = normaliseColour(directCheck?.severity || directCheck?.display_status) || item.rawSeverity || item.severityKey || resolveSeverityKey(item.rawSeverity, directCheck?.severity || directCheck?.display_status);
    if (s && s !== "grey") return s;

    // 2) Inspect concerns (some checks put severity on concerns)
    if (Array.isArray(item.concerns)) {
      for (const c of item.concerns) {
        const cs = normaliseColour(c?.status || c?.colour || c?.display_status);
        if (cs && cs !== "grey") return cs;
      }
    }

    // 3) Inspect any rows on the item
    if (Array.isArray(item.rows)) {
      for (const r of item.rows) {
        const rs = normaliseColour(r?.status || r?.colour || r?.display_status);
        if (rs && rs !== "grey") return rs;
      }
    }

    // 4) Try to find a matching vhc_check by section/title (some DB rows use display IDs)
    if (vhcChecksData && vhcChecksData.length > 0) {
      const lowerLabel = (item.label || "").toString().toLowerCase().trim();
      const lowerSection = (item.sectionName || "").toString().toLowerCase().trim();
      const match = vhcChecksData.find((c) => {
        if (!c) return false;
        const sec = (c.section || "").toLowerCase();
        const title = (c.issue_title || c.section || "").toLowerCase();
        if (lowerSection && sec.includes(lowerSection)) return true;
        if (lowerLabel && title.includes(lowerLabel)) return true;
        return false;
      });
      if (match) {
        const ms = normaliseColour(match.display_status || match.severity);
        if (ms && ms !== "grey") return ms;
      }
    }

    // 5) No stronger severity found
    return null;
  }, [vhcChecksData, vhcChecksMap, resolveCanonicalVhcId]);

  // Build summary items from sections and database records (matches customer-preview)
  const summaryItems = useMemo(() => {
    const items = [];
    const processedIds = new Set();

    // First, process items from checksheet sections
    const sections = (vhcData && (vhcData.sections || vhcData.sections || [])) || [];
    sections.forEach((section) => {
      const sectionName = section.name || section.title || "Vehicle Health Check";
      (section.items || []).forEach((item, index) => {
        const severity = normaliseColour(item.status || item.colour || section.colour || section.status);
        if (!severity) return;

        const legacyId = `${sectionName}-${index}`;
        const id = item.vhc_id
          ? String(item.vhc_id)
          : vhcIdAliases[legacyId]
          ? legacyId
          : buildStableDisplayId(sectionName, item, index);

        const heading = item.heading || item.label || item.issue_title || item.name || item.title || sectionName;
        const category = resolveCategoryForItem(sectionName, heading);
        const concerns = Array.isArray(item.concerns) ? item.concerns : [];
        const primaryConcern = concerns.find((c) => normaliseColour(c?.status) === severity) || concerns[0] || null;

        const canonicalId = vhcIdAliases[String(id)] || String(id);
        const vhcCheck = vhcChecksMap.get(canonicalId) || vhcChecksMap.get(id);
        const approvalStatus = normaliseDecisionStatus(vhcCheck?.approval_status) || "pending";

        items.push({
          id: String(id),
          label: heading || "Recorded item",
          notes: item.notes || item.issue_description || "",
          measurement: item.measurement || "",
          concernText: primaryConcern?.text || "",
          rows: Array.isArray(item.rows) ? item.rows : [],
          sectionName,
          category,
          categoryLabel: category.label,
          rawSeverity: severity,
          severityKey: severity,
          concerns,
          wheelKey: item.wheelKey || null,
          approvalStatus,
        });

        processedIds.add(String(id));
        if (canonicalId !== String(id)) {
          processedIds.add(canonicalId);
        }
      });
    });

    // ALWAYS process vhc_checks records from database, not just as fallback
    vhcChecksData.forEach((check) => {


      if (!check?.vhc_id) return;
      if (processedIds.has(String(check.vhc_id))) return;
      if (check.section === "VHC_CHECKSHEET") return;

      // Prefer explicit severity column over approval/display status so original red/amber/green wins
      let severity = normaliseColour(check.severity || check.display_status);
      if (!severity) {
        const combinedText = `${check.section || ""} ${check.issue_title || ""}`.toLowerCase();
        if (combinedText.includes("red")) severity = "red";
        else if (combinedText.includes("amber") || combinedText.includes("orange")) severity = "amber";
        else if (combinedText.includes("green") || combinedText.includes("good")) severity = "green";
        else severity = "grey";
      }
      // Ensure fallback still checks severity first
      severity = severity || normaliseColour(check?.severity || check?.display_status);
      const sectionName = check.section || "Other";
      const category = resolveCategoryForItem(sectionName, check.issue_title);

      items.push({
        id: String(check.vhc_id),
        label: check.issue_title || check.section || "Recorded item",
        notes: check.issue_description || "",
        measurement: check.measurement || "",
        concernText: "",
        rows: [],
        sectionName,
        category,
        categoryLabel: category.label,
        rawSeverity: severity,
        severityKey: severity,
        concerns: [],
        wheelKey: null,
        approvalStatus: normaliseDecisionStatus(check.approval_status) || "pending",
        fromDatabase: true,
      });

      processedIds.add(String(check.vhc_id));
    });



    return items;
  }, [vhcData, vhcChecksData, vhcChecksMap, vhcIdAliases]);



  // Build set of authorized view IDs from vhc_authorized_items table (same as customer preview)
  const authorizedViewIds = useMemo(() => {
    const ids = new Set();
    (authorizedViewRows || []).forEach((row) => {
      if (row?.vhc_item_id) {
        ids.add(String(row.vhc_item_id));
      }
    });
    return ids;
  }, [authorizedViewRows]);

  // Calculate labour hours by VHC item
  const labourHoursByVhcItem = useMemo(() => {
    const map = new Map();

    // Get labour hours from vhc_checks
    vhcChecksData.forEach((check) => {
      if (!check?.vhc_id) return;
      const hours = Number(check.labour_hours);
      if (Number.isFinite(hours) && hours > 0) {
        map.set(String(check.vhc_id), hours);
      }
    });

    // Also check parts_job_items for labour hours
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

  // Build severity lists with proper categorization (matching customer-preview logic)
  const severityLists = useMemo(() => {
    const lists = { red: [], amber: [], green: [], grey: [], authorized: [], declined: [] };

    summaryItems.forEach((item) => {
      const itemId = String(item.id);
      const canonicalId = resolveCanonicalVhcId(itemId);
      const vhcCheck = vhcChecksMap.get(canonicalId) || vhcChecksMap.get(itemId);

      // Get approval status from vhc_checks table
      let decisionKey = normaliseDecisionStatus(vhcCheck?.approval_status) || item.approvalStatus || "pending";

      // Cross-check with authorizedViewIds for consistency with VhcDetailsPanel
      // If item shows as authorized but isn't in authorizedViewIds, treat as pending
      if (decisionKey === "authorized" || decisionKey === "completed") {
        if (authorizedViewIds.size > 0 && !authorizedViewIds.has(canonicalId) && !authorizedViewIds.has(itemId)) {
          decisionKey = "pending";
        }
      }

      // Prefer database severity (vhc_checks.display_status or severity), fall back to item values
      // prefer explicit severity column over display_status (approval) so authorisation doesn't mask original severity
      const rawSeverity = normaliseColour(vhcCheck?.severity || vhcCheck?.display_status) || item.severityKey || item.rawSeverity || resolveSeverityKey(item.rawSeverity, vhcCheck?.severity || vhcCheck?.display_status);

      const enrichedItem = {
        ...item,
        vhcCheck,
        approvalStatus: decisionKey,
        rawSeverity,
        labourHours: labourHoursByVhcItem.get(itemId) || (vhcCheck?.labour_hours ? Number(vhcCheck.labour_hours) : 0),
        partsCost: partsCostByVhcItem.get(itemId) || (vhcCheck?.parts_cost ? Number(vhcCheck.parts_cost) : 0),
        totalOverride: vhcCheck?.total_override,
        total: resolveItemTotal(itemId),
      };

      // Categorize by approval status first, then by severity
      if (decisionKey === "authorized" || decisionKey === "completed") {
        lists.authorized.push(enrichedItem);
      } else if (decisionKey === "declined") {
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
  }, [summaryItems, vhcChecksMap, authorizedViewIds, labourHoursByVhcItem, partsCostByVhcItem, resolveItemTotal, resolveCanonicalVhcId]);

  // Calculate financial totals
  const customerTotals = useMemo(() => {
    // Compute red/amber totals by checking rawSeverity across ALL summaryItems so authorised/declined items are included
    let red = 0;
    let amber = 0;
    summaryItems.forEach((item) => {
      const total = resolveItemTotal(item.id) || 0;
      const effective = getEffectiveSeverity(item) || normaliseColour((vhcChecksMap.get(String(item.id))?.display_status || vhcChecksMap.get(String(item.id))?.severity)) || item.rawSeverity || item.severityKey || resolveSeverityKey(item.rawSeverity, vhcChecksMap.get(String(item.id))?.display_status);
      if (effective === "red") red += total;
      else if (effective === "amber") amber += total;
    });

    const calculateListTotal = (list) => list.reduce((sum, item) => sum + (item.total || 0), 0);

    return {
      red,
      amber,
      green: calculateListTotal(severityLists.green),
      authorized: calculateListTotal(severityLists.authorized),
      declined: calculateListTotal(severityLists.declined),
    };
  }, [summaryItems, severityLists, vhcChecksMap, resolveItemTotal]);

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
  const renderCustomerRow = (item, severity) => {    // Defensive: ensure item exists
    if (!item) return null;    const isAuthorized = item.approvalStatus === "authorized" || item.approvalStatus === "completed";
    const isDeclined = item.approvalStatus === "declined";

    const detailLabel = item.label || item.sectionName || "Recorded item";
    const detailContent = item.concernText || item.notes || "";
    const measurement = item.measurement || "";
    const categoryLabel = item.categoryLabel || item.sectionName || "Recorded Section";
    const total = item.total || 0;

    // Compute original severity (DB-first), expose for dev UI
    const computeOriginalSeverity = () => {
      let s = normaliseColour(item.vhcCheck?.display_status || item.vhcCheck?.severity) || item.rawSeverity || item.severityKey || normaliseColour(item.display_status || item.severity);
      if (!s && typeof resolveCanonicalVhcId === 'function' && vhcChecksMap) {
        try {
          const canonical = resolveCanonicalVhcId(String(item.id));
          const check = vhcChecksMap.get(String(canonical)) || vhcChecksMap.get(String(item.id));
          s = normaliseColour(check?.display_status || check?.severity);
        } catch (err) {
          // ignore
        }
      }
      return s;
    };

    const originalSeverity = computeOriginalSeverity();

    const getRowBackground = () => {
      if (isAuthorized || isDeclined) {
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
          position: 'relative',
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

    // Ensure Authorized/Declined sections show red items first, then amber
    let displayItems = items;
    if (severity === "authorized" || severity === "declined") {
      const severityRank = (s) => (s === "red" ? 0 : s === "amber" ? 1 : s === "green" ? 2 : 3);

      const getEffectiveSeverity = (it) => {
        let s = it.severityKey || it.rawSeverity || null;
        if (!s) {
          s = normaliseColour(it.vhcCheck?.display_status || it.vhcCheck?.severity || it.display_status || it.severity);
        }
        if (!s) {
          try {
            const canonical = resolveCanonicalVhcId(String(it.id));
            const check = vhcChecksMap.get(String(canonical)) || vhcChecksMap.get(String(it.id));
            s = normaliseColour(check?.display_status || check?.severity);
          } catch (err) {
            // swallow
          }
        }
        return s;
      };

      displayItems = [...items].sort((a, b) => severityRank(getEffectiveSeverity(a)) - severityRank(getEffectiveSeverity(b)));


    }

    return (
      <div
        style={{
          border: `1px solid ${theme.border || "var(--info-surface)"}`,
          borderRadius: "16px",
          background: (severity === "authorized" || severity === "declined") ? "var(--surface)" : (theme.background || "var(--surface)"),
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
        {displayItems.length === 0 ? (
          <div style={{ padding: "16px", fontSize: "13px", color: "var(--info)" }}>
            No items recorded.
          </div>
        ) : (
          displayItems.map((item) => renderCustomerRow(item, severity))
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
  const customerInfo = job?.customer;

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "24px" }}>
            {/* Logo on the left to match customer-preview */}
            <div style={{ flexShrink: 0 }}>
              <Image
                src={logoSrc}
                alt="HP Logo"
                width={120}
                height={50}
                style={{ objectFit: "contain" }}
                priority
              />
            </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--accent-purple)", margin: 0 }}>
                  Vehicle Health Check
                </h1>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "13px", color: "var(--info-dark)" }}>
                  <span style={{ fontWeight: 600 }}>Job #{jobNumber}</span>
                  {vehicleInfo?.registration && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ color: "var(--info)" }}>Reg:</span>
                      <span style={{ fontWeight: 600 }}>{vehicleInfo.registration}</span>
                    </span>
                  )}
                  {(vehicleInfo?.make || vehicleInfo?.model) && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ color: "var(--info)" }}>Vehicle:</span>
                      <span>{[vehicleInfo.make, vehicleInfo.model].filter(Boolean).join(" ")}</span>
                    </span>
                  )}
                  {customerInfo?.name && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ color: "var(--info)" }}>Customer:</span>
                      <span>{customerInfo.name}</span>
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                {expiresAt && (
                  <div style={expireBoxStyle}>
                    <div style={{ fontSize: "12px", textAlign: "right", color: expireBoxStyle.color }}>
                      <span style={{ fontWeight: 600, color: expireBoxStyle.color }}>Link expires:</span>
                      <span style={{ marginLeft: "6px", fontWeight: 600 }}>{new Date(expiresAt).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Read-only pill - theme aware */}
                <div style={{ ...readOnlyPillStyle, borderColor: ( (isMounted ? resolvedMode : "light") === "dark" ) ? "rgba(var(--accent-purple-rgb), 0.25)" : "rgba(var(--danger-rgb), 0.25)", color: ( (isMounted ? resolvedMode : "light") === "dark" ) ? "var(--accent-purple)" : "var(--danger)" }}>
                  Read-only
                </div>
              </div>
            </div>
          </div>
        </header>



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
