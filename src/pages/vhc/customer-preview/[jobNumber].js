// file location: src/pages/vhc/customer-preview/[jobNumber].js
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { summariseTechnicianVhc } from "@/lib/vhc/summary";
import { normaliseDecisionStatus, resolveSeverityKey } from "@/lib/vhc/summaryStatus";
import { useTheme } from "@/styles/themeProvider";

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

// Tyre wear calculation: 8mm = 0% worn (new), 0mm = 100% worn
const TYRE_NEW_DEPTH = 8;
const calculateTyreWearPercent = (depthMm) => {
  const depth = Number(depthMm);
  if (!Number.isFinite(depth) || depth < 0) return null;
  const wornPercent = Math.round(((TYRE_NEW_DEPTH - Math.min(depth, TYRE_NEW_DEPTH)) / TYRE_NEW_DEPTH) * 100);
  return Math.max(0, Math.min(100, wornPercent));
};

// Brake pad wear calculation: 10mm = 0% worn (new), 0mm = 100% worn
const PAD_NEW_THICKNESS = 10;
const calculatePadWearPercent = (thicknessMm) => {
  const thickness = Number(thicknessMm);
  if (!Number.isFinite(thickness) || thickness < 0) return null;
  const wornPercent = Math.round(((PAD_NEW_THICKNESS - Math.min(thickness, PAD_NEW_THICKNESS)) / PAD_NEW_THICKNESS) * 100);
  return Math.max(0, Math.min(100, wornPercent));
};

// Extract average tread depth from measurement string like "Tread depths: 5mm • 5mm • 5mm"
// Searches in multiple text fields to find tread depth values
const extractTreadDepth = (text) => {
  if (!text) return null;
  // Look for "Tread depths:" pattern or any mm values in tyre context
  const treadMatch = text.match(/tread\s*depths?[:\s]*([^•\n]+(?:•[^•\n]+)*)/i);
  if (treadMatch) {
    const depthSection = treadMatch[1];
    const mmMatches = depthSection.match(/(\d+(?:\.\d+)?)\s*mm/gi);
    if (mmMatches && mmMatches.length > 0) {
      const values = mmMatches.map((m) => parseFloat(m));
      const validValues = values.filter((v) => Number.isFinite(v) && v >= 0);
      if (validValues.length > 0) {
        return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
      }
    }
  }
  // Fallback: look for any mm values if in tyre context
  const mmMatches = text.match(/(\d+(?:\.\d+)?)\s*mm/gi);
  if (mmMatches && mmMatches.length > 0) {
    const values = mmMatches.map((m) => parseFloat(m));
    const validValues = values.filter((v) => Number.isFinite(v) && v >= 0 && v <= 12);
    if (validValues.length > 0) {
      return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
    }
  }
  return null;
};

// Extract pad thickness from measurement string like "Pad thickness: 8mm" or "Pad thickness: 8"
const extractPadThickness = (text) => {
  if (!text) return null;
  // Look for "Pad thickness:" pattern
  const padMatch = text.match(/pad\s*thickness[:\s]*(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (padMatch) {
    return parseFloat(padMatch[1]);
  }
  // Fallback: look for standalone number (likely mm thickness)
  const numMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    // Pad thickness is typically 0-12mm
    if (val >= 0 && val <= 15) {
      return val;
    }
  }
  return null;
};

// Get wear percentage color based on percentage
const getWearColor = (wornPercent) => {
  if (wornPercent >= 75) return "var(--danger)";
  if (wornPercent >= 50) return "var(--warning)";
  return "var(--success)";
};

export default function CustomerPreviewPage() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const { resolvedMode, isDark } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  const [job, setJob] = useState(null);
  const [vhcChecksData, setVhcChecksData] = useState([]);
  const [authorizedViewRows, setAuthorizedViewRows] = useState([]);
  const [vhcIdAliases, setVhcIdAliases] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [updatingStatus, setUpdatingStatus] = useState(new Set());
  const [jobFiles, setJobFiles] = useState([]);
  const [partsJobItems, setPartsJobItems] = useState([]);

  // Handle client-side mounting for theme
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Determine logo based on theme
  const logoSrc = (isMounted ? resolvedMode : "light") === "dark"
    ? "/images/logo/DarkLogo.png"
    : "/images/logo/LightLogo.png";

  // Fetch job data
  useEffect(() => {
    if (!jobNumber) return;

    const fetchJobData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch job with related data
        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select(`
            *,
            customer:customer_id(*),
            vehicle:vehicle_id(*),
            vhc_checks(
              vhc_id,
              job_id,
              section,
              issue_description,
              issue_title,
              measurement,
              created_at,
              updated_at,
              approval_status,
              display_status,
              approved_by,
              approved_at,
              labour_hours,
              parts_cost,
              total_override,
              labour_complete,
              parts_complete
            ),
            parts_job_items(
              id,
              part_id,
              quantity_requested,
              quantity_allocated,
              quantity_fitted,
              status,
              origin,
              vhc_item_id,
              unit_cost,
              unit_price,
              request_notes,
              created_at,
              updated_at,
              authorised,
              stock_status,
              pre_pick_location,
              labour_hours,
              part:part_id(id, part_number, name, unit_price)
            ),
            job_files(
              file_id,
              file_name,
              file_url,
              file_type,
              folder,
              uploaded_at,
              uploaded_by
            ),
            vhc_item_aliases(
              display_id,
              vhc_item_id
            )
          `)
          .eq("job_number", jobNumber)
          .maybeSingle();

        if (jobError) throw jobError;
        if (!jobData) {
          setError("Job not found");
          return;
        }

        const { vhc_checks = [], parts_job_items = [], job_files = [], vhc_item_aliases: aliasRows = [], ...jobFields } = jobData;
        setJob(jobFields);
        setVhcChecksData(vhc_checks || []);
        setPartsJobItems(parts_job_items || []);
        setJobFiles(job_files || []);

        // Log for debugging
        console.log("DEBUG: Fetched job data", {
          jobNumber,
          vhc_checks_count: (vhc_checks || []).length,
          parts_job_items_count: (parts_job_items || []).length,
          job_files_count: (job_files || []).length,
          checksheet_exists: !!jobFields.checksheet,
        });

        // Build alias map from display_id to vhc_item_id
        const aliasMap = {};
        (aliasRows || []).forEach((alias) => {
          if (alias?.display_id && alias?.vhc_item_id) {
            aliasMap[String(alias.display_id)] = String(alias.vhc_item_id);
          }
        });
        setVhcIdAliases(aliasMap);

        // Fetch authorized view items separately
        if (jobFields.id) {
          const { data: authViewData } = await supabase
            .from("vhc_authorized_items")
            .select("vhc_item_id, approval_status")
            .eq("job_id", jobFields.id);
          setAuthorizedViewRows(authViewData || []);
        }
      } catch (err) {
        console.error("Error fetching job data:", err);
        setError(err.message || "Failed to load job data");
      } finally {
        setLoading(false);
      }
    };

    fetchJobData();

    // Clean up any existing subscriptions
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [jobNumber]);

  // Set up real-time subscription for vhc_checks updates
  useEffect(() => {
    if (!job?.id) return;

    console.log(`[CUSTOMER-PREVIEW] Setting up subscription for job ${job.id}`);

    const channel = supabase
      .channel(`vhc_checks_job_${job.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "vhc_checks",
          filter: `job_id=eq.${job.id}`,
        },
        (payload) => {
          console.log("[CUSTOMER-PREVIEW] VHC UPDATE received:", payload);
          // Immediately update the vhcChecksData with the new values
          setVhcChecksData((prevData) => {
            const updated = prevData.map((check) => {
              if (check.vhc_id === payload.new.vhc_id) {
                console.log(`[CUSTOMER-PREVIEW] Updating vhc_id ${check.vhc_id}:`, {
                  old_status: check.display_status,
                  new_status: payload.new.display_status,
                });
                return { ...check, ...payload.new };
              }
              return check;
            });
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vhc_checks",
          filter: `job_id=eq.${job.id}`,
        },
        (payload) => {
          console.log("[CUSTOMER-PREVIEW] VHC INSERT received:", payload);
          setVhcChecksData((prevData) => [...prevData, payload.new]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "vhc_checks",
          filter: `job_id=eq.${job.id}`,
        },
        (payload) => {
          console.log("[CUSTOMER-PREVIEW] VHC DELETE received:", payload);
          setVhcChecksData((prevData) =>
            prevData.filter((check) => check.vhc_id !== payload.old.vhc_id)
          );
        }
      )
      .subscribe((status) => {
        console.log(`[CUSTOMER-PREVIEW] Subscription status: ${status}`);
      });

    // Cleanup subscription on unmount or when job changes
    return () => {
      console.log(`[CUSTOMER-PREVIEW] Cleaning up subscription for job ${job.id}`);
      supabase.removeChannel(channel);
    };
  }, [job?.id]);

  // Parse VHC data from checksheet
  const vhcData = useMemo(() => {
    if (!job?.checksheet) return null;
    try {
      return typeof job.checksheet === "string" ? JSON.parse(job.checksheet) : job.checksheet;
    } catch {
      return null;
    }
  }, [job?.checksheet]);

  // Get builder summary with sections from VHC data
  const builderSummary = useMemo(() => {
    return summariseTechnicianVhc(vhcData || {});
  }, [vhcData]);

  // Extract sections from builder summary
  const sections = builderSummary.sections || [];

  // Helper function to normalise colour/status
  const normaliseColour = (value) => {
    if (!value) return null;
    const lower = String(value).toLowerCase().trim();
    if (lower === "red" || lower.includes("red")) return "red";
    if (lower === "amber" || lower === "yellow" || lower === "orange" || lower.includes("amber")) return "amber";
    if (lower === "green" || lower === "good" || lower === "pass" || lower.includes("green")) return "green";
    if (lower === "grey" || lower === "gray" || lower === "neutral" || lower.includes("grey")) return "grey";
    // Default to grey if not recognized
    return "grey";
  };

  // Helper to build stable display ID
  const buildStableDisplayId = (sectionName, item, index) => {
    const heading = item.heading || item.label || item.name || "";
    const prefix = sectionName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const suffix = heading.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    return `${prefix}-${suffix}-${index}`;
  };

  // Helper to resolve category for item
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

  // Build lookup map for vhc_checks by vhc_id
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

  // Build set of authorized view IDs from vhc_authorized_items table
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
  const resolveItemTotal = useCallback((itemId) => {
    const vhcCheck = vhcChecksMap.get(String(itemId));

    // Use total_override if set
    if (vhcCheck?.total_override && Number(vhcCheck.total_override) > 0) {
      return Number(vhcCheck.total_override);
    }

    // Calculate from labour + parts
    const labourHours = labourHoursByVhcItem.get(String(itemId)) ||
                        (vhcCheck?.labour_hours ? Number(vhcCheck.labour_hours) : 0);
    const partsCost = partsCostByVhcItem.get(String(itemId)) ||
                      (vhcCheck?.parts_cost ? Number(vhcCheck.parts_cost) : 0);

    const labourCost = Number.isFinite(labourHours) ? labourHours * LABOUR_RATE : 0;
    return labourCost + partsCost;
  }, [vhcChecksMap, labourHoursByVhcItem, partsCostByVhcItem]);

  // Build summary items from sections and database records
  const summaryItems = useMemo(() => {
    const items = [];
    const processedIds = new Set();

    // First, process items from checksheet sections
    sections.forEach((section) => {
      const sectionName = section.name || section.title || "Vehicle Health Check";
      (section.items || []).forEach((item, index) => {
        // Items from sections have a 'status' field, not 'colour'
        const severity = normaliseColour(item.status || item.colour || section.colour || section.status);
        // Include items with any severity (grey is default)
        if (!severity) return;

        // Build ID - check for vhc_id first, then legacy formats, then stable display ID
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

        // Get approval status from database - resolve canonical ID first
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
    // This ensures we get all items regardless of checksheet content
    vhcChecksData.forEach((check) => {
      if (!check?.vhc_id || processedIds.has(String(check.vhc_id))) {
        return; // Skip if already processed or no vhc_id
      }

      // Skip internal VHC_CHECKSHEET metadata record
      if (check.section === "VHC_CHECKSHEET") {
        return;
      }

      // Try to determine severity from multiple sources
      let severity = normaliseColour(check.display_status || check.severity);
      
      // If no severity found, try to infer from section name or issue title
      if (!severity) {
        const combinedText = `${check.section || ""} ${check.issue_title || ""}`.toLowerCase();
        if (combinedText.includes("red")) severity = "red";
        else if (combinedText.includes("amber") || combinedText.includes("orange")) severity = "amber";
        else if (combinedText.includes("green") || combinedText.includes("good")) severity = "green";
        else severity = "grey"; // Default to grey if no severity can be determined
      }

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
        fromDatabase: true, // Mark as coming from database
      });

      processedIds.add(String(check.vhc_id));
    });

    // Log for debugging - remove later
    if (items.length === 0) {
      console.log("DEBUG: No items found in summaryItems", {
        sectionsCount: sections.length,
        vhcChecksDataCount: vhcChecksData.length,
        vhcData: vhcData,
      });
    }

    return items;
  }, [sections, vhcChecksMap, vhcIdAliases, vhcChecksData]);

  // Build severity lists with proper categorization (matching VhcDetailsPanel logic)
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

      const rawSeverity = item.severityKey || item.rawSeverity;

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

  // Handle back button
  const handleBack = useCallback(() => {
    router.push(`/job-cards/${jobNumber}?tab=summary`);
  }, [router, jobNumber]);

  // Handle authorise/decline status update
  const updateEntryStatus = useCallback(async (itemId, newStatus) => {
    if (!job?.id || !itemId) return;

    setUpdatingStatus((prev) => new Set(prev).add(itemId));

    try {
      const response = await fetch("/api/vhc/update-item-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vhcItemId: itemId,
          approvalStatus: newStatus || "pending",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update status");
      }

      // Refresh VHC checks data
      const { data: updatedChecks } = await supabase
        .from("vhc_checks")
        .select("*")
        .eq("job_id", job.id);

      if (updatedChecks) {
        setVhcChecksData(updatedChecks);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setUpdatingStatus((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [job?.id]);

  // Render customer row - matching VhcDetailsPanel design with parts and labour breakdown
  const renderCustomerRow = (item, severity) => {
    const isUpdating = updatingStatus.has(item.id);
    const isAuthorized = item.approvalStatus === "authorized" || item.approvalStatus === "completed";
    const isDeclined = item.approvalStatus === "declined";

    // Only show authorize/decline checkboxes for pending red/amber items
    const showDecision = (severity === "red" || severity === "amber") && !isAuthorized && !isDeclined;

    const detailLabel = item.label || item.sectionName || "Recorded item";
    const detailContent = item.concernText || item.notes || "";
    const measurement = item.measurement || "";
    const categoryLabel = item.categoryLabel || item.sectionName || "Recorded Section";
    const total = item.total || 0;
    
    // Get parts and labour information
    const partsCost = item.partsCost || 0;
    const labourHours = item.labourHours || 0;
    const labourCost = Number.isFinite(labourHours) ? labourHours * LABOUR_RATE : 0;

    // Calculate wear percentage for tyres and brake pads
    const categoryId = item.category?.id || "";
    const labelLower = detailLabel.toLowerCase();
    const categoryLower = categoryLabel.toLowerCase();
    let wearPercent = null;
    let wearLabel = "";

    // Combine all text fields to search for measurements
    const allText = [measurement, detailContent, detailLabel, item.notes || ""].join(" ");

    // Check if this is a tyre item (wheels_tyres category or tyre in label/category)
    const isTyreItem = categoryId === "wheels_tyres" ||
                       categoryLower.includes("tyre") ||
                       categoryLower.includes("wheel") ||
                       labelLower.includes("tyre");

    // Check if this is a brake pad item (not disc)
    const isPadItem = (categoryId === "brakes_hubs" || categoryLower.includes("brake")) &&
                      (labelLower.includes("pad") || allText.toLowerCase().includes("pad thickness")) &&
                      !labelLower.includes("disc");

    if (isTyreItem) {
      const treadDepth = extractTreadDepth(allText);
      if (treadDepth !== null) {
        wearPercent = calculateTyreWearPercent(treadDepth);
        wearLabel = "Tyre Wear";
      }
    }
    else if (isPadItem) {
      const padThickness = extractPadThickness(allText);
      if (padThickness !== null) {
        wearPercent = calculatePadWearPercent(padThickness);
        wearLabel = "Pad Wear";
      }
    }

    // Determine background color for authorized/declined rows based on original severity
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
      <tr
        key={item.id}
        style={{
          borderBottom: "1px solid var(--info-surface)",
          background: getRowBackground(),
          transition: "background 0.2s ease",
        }}
      >
        {/* Item Details Cell */}
        <td style={{ padding: "12px 8px", color: "var(--accent-purple)", wordWrap: "break-word", overflow: "hidden" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)" }}>
            {categoryLabel}
          </div>
          <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--accent-purple)", marginTop: "2px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
            <span>{detailLabel}</span>
          </div>
          {detailContent && (
            <div style={{ marginTop: "6px", fontWeight: 500, color: "var(--info-dark)" }}>- {detailContent}</div>
          )}
          {measurement ? (
            <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "4px" }}>{measurement}</div>
          ) : null}
          {/* Wear percentage indicator for tyres and brake pads */}
          {wearPercent !== null && (
            <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "80px",
                height: "8px",
                background: "var(--info-surface)",
                borderRadius: "4px",
                overflow: "hidden"
              }}>
                <div style={{
                  width: `${wearPercent}%`,
                  height: "100%",
                  background: getWearColor(wearPercent),
                  borderRadius: "4px",
                  transition: "width 0.3s ease"
                }} />
              </div>
              <span style={{
                fontSize: "11px",
                fontWeight: 600,
                color: getWearColor(wearPercent),
                minWidth: "45px"
              }}>
                {wearPercent}% Worn
              </span>
            </div>
          )}
        </td>

        {/* Parts Cost Cell */}
        <td style={{ padding: "12px 8px", textAlign: "left" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)" }}>
            {formatCurrency(partsCost)}
          </div>
        </td>

        {/* Labour Cost Cell */}
        <td style={{ padding: "12px 8px", textAlign: "left" }}>
          <div style={{ fontSize: "13px", color: "var(--info-dark)" }}>
            {labourHours > 0 ? `${labourHours}h` : "—"}
          </div>
          {labourHours > 0 && (
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-purple)", marginTop: "2px" }}>
              {formatCurrency(labourCost)}
            </div>
          )}
        </td>

        {/* Total Cell */}
        <td style={{ padding: "12px 8px", textAlign: "left" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent-purple)" }}>
            {formatCurrency(total)}
          </div>
        </td>

        {/* Status Cell */}
        <td style={{ padding: "12px 8px", textAlign: "center" }}>
          {showDecision ? (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <label style={{ display: "flex", gap: "4px", alignItems: "center", fontSize: "12px", cursor: isUpdating ? "not-allowed" : "pointer" }}>
                <input
                  type="checkbox"
                  checked={isAuthorized}
                  disabled={isUpdating}
                  onChange={(e) => updateEntryStatus(item.id, e.target.checked ? "authorized" : null)}
                  style={{ width: "14px", height: "14px", cursor: isUpdating ? "not-allowed" : "pointer" }}
                />
                <span style={{ fontSize: "11px" }}>Authorise</span>
              </label>
              <label style={{ display: "flex", gap: "4px", alignItems: "center", fontSize: "12px", cursor: isUpdating ? "not-allowed" : "pointer" }}>
                <input
                  type="checkbox"
                  checked={isDeclined}
                  disabled={isUpdating}
                  onChange={(e) => updateEntryStatus(item.id, e.target.checked ? "declined" : null)}
                  style={{ width: "14px", height: "14px", cursor: isUpdating ? "not-allowed" : "pointer" }}
                />
                <span style={{ fontSize: "11px" }}>Decline</span>
              </label>
            </div>
          ) : isAuthorized || isDeclined ? (
            <div style={{
              padding: "4px 8px",
              borderRadius: "8px",
              background: isAuthorized ? "var(--success-surface)" : "var(--danger-surface)",
              color: isAuthorized ? "var(--success)" : "var(--danger)",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              textAlign: "center"
            }}>
              {isAuthorized ? "✓ Authorised" : "✗ Declined"}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "var(--info)" }}>—</div>
          )}
        </td>
      </tr>
    );
  };

  // Render customer section - matching VhcDetailsPanel design with table layout
  const renderCustomerSection = (title, items, severity) => {
    const theme = SEVERITY_THEME[severity] || { border: "var(--info-surface)", background: "var(--surface)" };

    // Calculate authorized and declined totals for this section
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
          <div style={{ overflow: "visible" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", tableLayout: "fixed" }}>
              <thead>
                <tr
                  style={{
                    background: "var(--info-surface)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--info)",
                    fontSize: "11px",
                  }}
                >
                  <th style={{ textAlign: "left", padding: "12px 8px", width: "40%" }}>Item Details</th>
                  <th style={{ textAlign: "left", padding: "12px 8px", width: "15%" }}>Parts</th>
                  <th style={{ textAlign: "left", padding: "12px 8px", width: "18%" }}>Labour</th>
                  <th style={{ textAlign: "left", padding: "12px 8px", width: "15%" }}>Total</th>
                  <th style={{ textAlign: "left", padding: "12px 8px", width: "12%" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => renderCustomerRow(item, severity))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Render Financial Totals Grid - matching VhcSharedComponents design
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

  // Render Summary Tab - matching VhcDetailsPanel customer view
  const renderSummaryTab = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {renderFinancialTotalsGrid()}

      {/* Red Items section */}
      {severityLists.red && severityLists.red.length > 0 &&
        renderCustomerSection("Red Items", severityLists.red, "red")}

      {/* Amber Items section */}
      {severityLists.amber && severityLists.amber.length > 0 &&
        renderCustomerSection("Amber Items", severityLists.amber, "amber")}

      {/* Authorised section */}
      {severityLists.authorized && severityLists.authorized.length > 0 &&
        renderCustomerSection("Authorised", severityLists.authorized, "authorized")}

      {/* Declined section */}
      {severityLists.declined && severityLists.declined.length > 0 &&
        renderCustomerSection("Declined", severityLists.declined, "declined")}

      {/* Green Items section stays at the bottom */}
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
          <div style={{ fontSize: "16px", color: "var(--info)" }}>Loading job details...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-light)" }}>
        <div style={{ textAlign: "center", padding: "24px" }}>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "8px" }}>Error Loading Job</div>
          <div style={{ fontSize: "14px", color: "var(--info)", marginBottom: "24px" }}>{error}</div>
          <button
            onClick={handleBack}
            style={{
              padding: "12px 24px",
              background: "var(--primary)",
              color: "var(--surface)",
              border: "none",
              borderRadius: "10px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const vehicleInfo = job?.vehicle;
  const customerInfo = job?.customer;

  return (
    <>
      <Head>
        <title>Vehicle Health Check - Job #{jobNumber}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
          <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px" }}>
            {/* Logo on the left */}
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

            {/* Vehicle and Customer Details in the middle */}
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

            {/* Back button on the right */}
            <button
              onClick={handleBack}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                background: "var(--surface)",
                color: "var(--accent-purple)",
                border: "1px solid var(--accent-purple-surface)",
                borderRadius: "10px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "14px",
                flexShrink: 0,
              }}
            >
              ← Back
            </button>
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
