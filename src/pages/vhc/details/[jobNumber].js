// file location: src/pages/vhc/details/[jobNumber].js
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import {
  getVHCChecksByJob,
  createVHCCheck,
  updateVHCCheck,
  deleteVHCCheck
} from "../../../lib/database/vhc";
import { getJobByNumber } from "../../../lib/database/jobs";
import { getJobParts } from "../../../lib/database/parts";
import { useUser } from "../../../context/UserContext";
import {
  authorizeAdditionalWork,
  declineAdditionalWork
} from "../../../lib/services/vhcStatusService";

// ✅ Status color mapping
const STATUS_COLORS = {
  "Outstanding": "#9ca3af",
  "Accepted": "#d10000",
  "In Progress": "#3b82f6",
  "Awaiting Authorization": "#fbbf24",
  "Authorized": "#9333ea",
  "Ready": "#10b981",
  "Carry Over": "#f97316",
  "Complete": "#06b6d4",
  "Sent": "#8b5cf6",
  "Viewed": "#06b6d4",
};

const PRE_PICK_OPTIONS = [
  { value: "", label: "Not assigned" },
  { value: "service_rack_1", label: "Service Rack 1" },
  { value: "service_rack_2", label: "Service Rack 2" },
  { value: "service_rack_3", label: "Service Rack 3" },
  { value: "service_rack_4", label: "Service Rack 4" },
  { value: "sales_rack_1", label: "Sales Rack 1" },
  { value: "sales_rack_2", label: "Sales Rack 2" },
  { value: "sales_rack_3", label: "Sales Rack 3" },
  { value: "sales_rack_4", label: "Sales Rack 4" },
  { value: "stairs_pre_pick", label: "Stairs (Sales Pre-pick)" },
];

const PART_STATUS_COLORS = {
  pending: { bg: "#f3f4f6", text: "#4b5563" },
  awaiting_stock: { bg: "#fff7ed", text: "#c2410c" },
  allocated: { bg: "#e0f2fe", text: "#0369a1" },
  picked: { bg: "#ede9fe", text: "#5b21b6" },
  fitted: { bg: "#ecfdf5", text: "#047857" },
  cancelled: { bg: "#f3f4f6", text: "#6b7280" },
};

// ✅ Options for decline reasons presented to the user
const DECLINE_REASON_OPTIONS = [
  { value: "cost", label: "Cost too high" },
  { value: "time", label: "Customer lacks time" },
  { value: "defer", label: "Customer wants to defer" },
  { value: "warranty", label: "Covered elsewhere / warranty" },
  { value: "sold", label: "Vehicle being sold or part-ex" },
  { value: "other", label: "Other" }
];

// ✅ Options for reminder periods in months (1-12)
const REMINDER_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const monthValue = (index + 1).toString();
  return {
    value: monthValue,
    label: `${index + 1} month${index + 1 === 1 ? "" : "s"}`
  };
});

// ✅ Helper function to get customer name
const getCustomerName = (customer) => {
  if (!customer) return "N/A";
  if (typeof customer === "string") return customer;
  if (typeof customer === "object") {
    return `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.email || "N/A";
  }
  return "N/A";
};

export default function VHCDetails() {
  const router = useRouter();
  const { jobNumber } = router.query;
  const { user, dbUserId } = useUser();
  const userRoles = (user?.roles || []).map((role) => role.toLowerCase());
  const isPartsRole = userRoles.some(
    (role) => role === "parts" || role === "parts manager"
  );
  const workshopEditorRoles = [
    "service",
    "service manager",
    "workshop manager",
    "after sales director",
    "general manager",
    "admin",
  ];
  const hasWorkshopEditorRole = userRoles.some((role) =>
    workshopEditorRoles.includes(role)
  );
  const partsOnlyView = isPartsRole && !hasWorkshopEditorRole;
  const canEditVhcChecks = hasWorkshopEditorRole || !isPartsRole;
  
  const [jobData, setJobData] = useState(null);
  const [vhcChecks, setVhcChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const [selectedItems, setSelectedItems] = useState({}); // Stores currently selected VHC items for authorization/decline actions
  const [vhcStatus, setVhcStatus] = useState("Outstanding");
  const [jobParts, setJobParts] = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsError, setPartsError] = useState("");
  const [partLookup, setPartLookup] = useState("");
  const [inventoryResults, setInventoryResults] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [partForm, setPartForm] = useState({
    quantity: 1,
    allocateFromStock: true,
    prePickLocation: "",
    requestNotes: "",
    storageLocation: "",
    unitCost: "",
    unitPrice: "",
  });
  const [partFormError, setPartFormError] = useState("");
  const [partSaving, setPartSaving] = useState(false);
  const [customerNotes, setCustomerNotes] = useState(""); // Captures optional notes entered by the service team
  const [declineReason, setDeclineReason] = useState(DECLINE_REASON_OPTIONS[0]?.value || "cost"); // Default decline reason selection
  const [reminderMonths, setReminderMonths] = useState(REMINDER_OPTIONS[0]?.value || "1"); // Default reminder period selection
  const [authorizing, setAuthorizing] = useState(false); // Tracks when an authorization request is running
  const [declining, setDeclining] = useState(false); // Tracks when a decline request is running
  const [actionMessage, setActionMessage] = useState(""); // Stores success feedback for VHC actions
  const [actionError, setActionError] = useState(""); // Stores error feedback for VHC actions

  // ✅ Fetch job and VHC data
  useEffect(() => {
    if (!jobNumber) return;

    const fetchData = async () => {
      setLoading(true);
      console.log("🔍 Fetching VHC data for job:", jobNumber);

      try {
        // ✅ Fetch job details
        const { data: job, error: jobError } = await getJobByNumber(jobNumber);
        
        if (jobError || !job) {
          console.error("❌ Job not found:", jobError);
          setLoading(false);
          return;
        }

        console.log("✅ Job found:", job);
        setJobData(job);

        // ✅ Fetch VHC checks
        const checks = await getVHCChecksByJob(job.id);
        console.log("✅ VHC checks found:", checks.length);
        setVhcChecks(checks);

        // ✅ Determine VHC status based on checks
        if (checks.length === 0) {
          setVhcStatus("Outstanding");
        } else if (checks.some(c => c.section === "Brakes" || c.section === "Red")) {
          setVhcStatus("In Progress");
        } else {
          setVhcStatus("Complete");
        }

      } catch (error) {
        console.error("❌ Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jobNumber]);

  const fetchJobParts = useCallback(async () => {
    if (!jobData?.id) return;
    setPartsLoading(true);
    setPartsError("");
    try {
      const result = await getJobParts(jobData.id);
      if (!result.success) {
        throw new Error(result.error?.message || "Unable to load parts");
      }
      setJobParts(result.data || []);
    } catch (error) {
      setPartsError(error.message || "Unable to load parts");
    } finally {
      setPartsLoading(false);
    }
  }, [jobData?.id]);

  useEffect(() => {
    fetchJobParts();
  }, [fetchJobParts]);

  useEffect(() => {
    if (partsOnlyView) {
      setActiveTab("parts");
    }
  }, [partsOnlyView]);

  // ✅ Calculate totals from VHC checks
  const calculateTotals = () => {
    const redItems = vhcChecks.filter(c => c.section === "Brakes" && c.measurement);
    const amberItems = vhcChecks.filter(c => c.section === "Tyres" && c.measurement);
    
    const redTotal = redItems.reduce((sum, item) => {
      const price = parseFloat(item.measurement) || 0;
      return sum + price;
    }, 0);

    const amberTotal = amberItems.reduce((sum, item) => {
      const price = parseFloat(item.measurement) || 0;
      return sum + price;
    }, 0);

    return {
      redWork: redTotal.toFixed(2),
      amberWork: amberTotal.toFixed(2),
      authorized: "0.00",
      declined: "0.00"
    };
  };

  const partsSummary = useMemo(() => {
    if (!jobParts || jobParts.length === 0) {
      return { total: 0, awaiting: 0, allocated: 0, value: "0.00" };
    }

    const awaiting = jobParts.filter((item) =>
      ["pending", "awaiting_stock"].includes(item.status)
    ).length;
    const allocated = jobParts.filter((item) =>
      ["allocated", "picked", "fitted"].includes(item.status)
    ).length;
    const value = jobParts.reduce((sum, item) => {
      const qty =
        item.quantity_requested ||
        item.quantity_allocated ||
        0;
      const price =
        Number.parseFloat(item.unit_price) ||
        Number.parseFloat(item.part?.unit_price) ||
        0;
      return sum + qty * price;
    }, 0);

    return {
      total: jobParts.length,
      awaiting,
      allocated,
      value: value.toFixed(2),
    };
  }, [jobParts]);

  const totals = calculateTotals();

  const selectedItemsArray = useMemo(() => Object.values(selectedItems), [selectedItems]); // Converts selected items map into an array for processing
  const selectedItemCount = selectedItemsArray.length; // Provides a quick count of selected items
  const selectionIsFull = selectedItemCount === vhcChecks.length && vhcChecks.length > 0; // Checks whether all items are currently selected
  const sectionNames = useMemo(
    () => Array.from(new Set(vhcChecks.map((check) => check.section || "General"))),
    [vhcChecks]
  ); // Builds a list of unique sections to drive quick-select buttons

  useEffect(() => {
    setSelectedItems((previousSelection) => {
      const nextSelection = {}; // Prepares a new selection map
      vhcChecks.forEach((check) => {
        if (previousSelection[check.vhc_id]) {
          nextSelection[check.vhc_id] = previousSelection[check.vhc_id]; // Carries over selections that still exist
        }
      });
      return nextSelection;
    });
  }, [vhcChecks]);

  const handleToggleItemSelection = useCallback((check) => {
    setSelectedItems((previousSelection) => {
      const nextSelection = { ...previousSelection }; // Copies the previous selection state
      if (nextSelection[check.vhc_id]) {
        delete nextSelection[check.vhc_id]; // Deselects the item if it was already selected
      } else {
        nextSelection[check.vhc_id] = {
          id: check.vhc_id,
          section: check.section || "General",
          title: check.issue_title,
          description: check.issue_description || "",
          amount: parseFloat(check.measurement) || 0
        }; // Adds a structured entry for the selected item
      }
      return nextSelection;
    });
  }, []);

  const handleSectionToggleAll = useCallback((sectionName) => {
    setSelectedItems((previousSelection) => {
      const nextSelection = { ...previousSelection }; // Copies the previous selection state
      const sectionChecks = vhcChecks.filter(
        (check) => (check.section || "General") === sectionName
      ); // Collects all checks that belong to the requested section
      const everySelected = sectionChecks.every((check) => nextSelection[check.vhc_id]); // Verifies if every check is already selected
      if (everySelected) {
        sectionChecks.forEach((check) => {
          delete nextSelection[check.vhc_id]; // Clears the section when everything was selected
        });
      } else {
        sectionChecks.forEach((check) => {
          nextSelection[check.vhc_id] = {
            id: check.vhc_id,
            section: check.section || "General",
            title: check.issue_title,
            description: check.issue_description || "",
            amount: parseFloat(check.measurement) || 0
          }; // Adds any unselected check from the section
        });
      }
      return nextSelection;
    });
  }, [vhcChecks]);

  const handleSelectAllChecks = useCallback(() => {
    setSelectedItems((previousSelection) => {
      if (Object.keys(previousSelection).length === vhcChecks.length) {
        return {}; // Clears all selections when everything was already selected
      }
      const nextSelection = {}; // Builds a new selection map containing every check
      vhcChecks.forEach((check) => {
        nextSelection[check.vhc_id] = {
          id: check.vhc_id,
          section: check.section || "General",
          title: check.issue_title,
          description: check.issue_description || "",
          amount: parseFloat(check.measurement) || 0
        };
      });
      return nextSelection;
    });
  }, [vhcChecks]);

  const handleAuthorizeSelected = useCallback(async () => {
    if (!jobData?.id) {
      setActionError("Job details are unavailable."); // Warns the user when job data has not loaded
      return;
    }
    if (selectedItemsArray.length === 0) {
      setActionError("Select at least one check to authorize."); // Prompts the user to choose items before continuing
      return;
    }
    const authorizedBy = dbUserId || user?.id || user?.email || user?.username || "unknown"; // Determines the identifier recorded in the audit trail
    setAuthorizing(true); // Marks the start of the async authorization flow
    setActionError(""); // Clears any previous errors
    setActionMessage(""); // Clears any previous success banner
    try {
      const payload = selectedItemsArray.map((item) => ({
        check_id: item.id,
        section: item.section,
        title: item.title,
        amount: item.amount
      })); // Structures the payload expected by the authorization service
      const notes = customerNotes.trim(); // Captures optional notes for storage
      const result = await authorizeAdditionalWork(jobData.id, authorizedBy, payload, notes); // Calls Supabase RPC to log authorization
      if (!result?.success) {
        throw new Error(result?.error || "Unable to authorize the selected checks right now."); // Surfaces backend errors
      }
      setActionMessage("Selected checks authorized successfully."); // Confirms success to the user
      setSelectedItems({}); // Clears selection to avoid double submissions
      setCustomerNotes(""); // Resets notes after a successful submission
    } catch (error) {
      setActionError(error.message || "Unable to authorize the selected checks."); // Displays errors received from the service
    } finally {
      setAuthorizing(false); // Marks the end of the async flow
    }
  }, [jobData, selectedItemsArray, dbUserId, user, customerNotes]);

  const handleDeclineSelected = useCallback(async () => {
    if (!jobData?.id) {
      setActionError("Job details are unavailable."); // Warns when job data is missing
      return;
    }
    if (selectedItemsArray.length === 0) {
      setActionError("Select at least one check to decline."); // Prompts for a selection before declining
      return;
    }
    const declinedBy = dbUserId || user?.id || user?.email || user?.username || "unknown"; // Determines who recorded the decline
    setDeclining(true); // Marks the async decline flow as running
    setActionError(""); // Clears previous errors
    setActionMessage(""); // Clears previous success banner
    try {
      const summaryLine = selectedItemsArray
        .map((item) => `${item.section}: ${item.title}`)
        .join("; "); // Builds a readable summary of declined items
      const notesParts = [
        `Reason: ${DECLINE_REASON_OPTIONS.find((option) => option.value === declineReason)?.label || declineReason}`,
        `Reminder: Follow up in ${reminderMonths} month${reminderMonths === "1" ? "" : "s"}`,
        summaryLine ? `Items: ${summaryLine}` : null,
        customerNotes.trim() ? `Notes: ${customerNotes.trim()}` : null
      ].filter(Boolean); // Collects reason, reminder, items, and optional notes into one message
      const result = await declineAdditionalWork(jobData.id, declinedBy, notesParts.join(" | "));
      if (!result?.success) {
        throw new Error(result?.error || "Unable to record the decline right now."); // Surfaces backend errors
      }
      setActionMessage("Decline recorded successfully."); // Confirms success to the user
      setSelectedItems({}); // Clears the selection after storing the decision
      setCustomerNotes(""); // Clears the notes to prevent reuse
    } catch (error) {
      setActionError(error.message || "Unable to record the decline for the selected checks."); // Displays error feedback
    } finally {
      setDeclining(false); // Marks the end of the async flow
    }
  }, [jobData, selectedItemsArray, dbUserId, user, declineReason, reminderMonths, customerNotes]);

  // ✅ Handle send VHC
  const handleSendVHC = async () => {
    const incompleteItems = vhcChecks.filter(c => 
      (c.section === "Brakes" || c.section === "Tyres") && !c.measurement
    );

    if (incompleteItems.length > 0) {
      alert("⚠️ Please add measurements to all items before sending VHC");
      return;
    }

    const confirmed = confirm(
      `Send VHC to customer?\n\n` +
      `Job: ${jobNumber}\n` +
      `Customer: ${getCustomerName(jobData?.customer)}\n` +
      `Red Work: £${totals.redWork}\n` +
      `Amber Work: £${totals.amberWork}`
    );

    if (confirmed) {
      setVhcStatus("Sent");
      alert("✅ VHC sent to customer!");
    }
  };

  const resetPartFormState = () => {
    setPartLookup("");
    setInventoryResults([]);
    setSelectedPart(null);
    setPartForm({
      quantity: 1,
      allocateFromStock: true,
      prePickLocation: "",
      requestNotes: "",
      storageLocation: "",
      unitCost: "",
      unitPrice: "",
    });
    setPartFormError("");
  };

  const handleSelectPart = (part) => {
    if (!part) return;
    setSelectedPart(part);
    setPartLookup(part.part_number || partLookup);
    setInventoryResults([]);
    const defaultZone =
      part.service_default_zone ||
      part.sales_default_zone ||
      part.stairs_default_zone ||
      "";

    setPartForm((prev) => ({
      ...prev,
      quantity: 1,
      allocateFromStock: (part.qty_in_stock || 0) > 0,
      prePickLocation: defaultZone,
      storageLocation: part.storage_location || "",
      unitCost:
        part.unit_cost !== undefined && part.unit_cost !== null
          ? Number(part.unit_cost).toFixed(2)
          : prev.unitCost,
      unitPrice:
        part.unit_price !== undefined && part.unit_price !== null
          ? Number(part.unit_price).toFixed(2)
          : prev.unitPrice,
    }));
  };

  const handlePartLookup = async () => {
    if (!partLookup.trim()) {
      setPartFormError("Enter a part number to search");
      return;
    }
    setInventoryLoading(true);
    setPartFormError("");
    try {
      const query = new URLSearchParams({
        search: partLookup.trim(),
        limit: "5",
      });
      const response = await fetch(`/api/parts/inventory?${query.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to find that part number");
      }

      setInventoryResults(data.parts || []);
      if (Array.isArray(data.parts) && data.parts.length > 0) {
        const exactMatch = data.parts.find(
          (part) =>
            part.part_number?.toLowerCase() === partLookup.trim().toLowerCase()
        );
        if (exactMatch) {
          handleSelectPart(exactMatch);
        }
      } else {
        setSelectedPart(null);
      }
    } catch (error) {
      setPartFormError(error.message || "Unable to search inventory");
      setInventoryResults([]);
      setSelectedPart(null);
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleQuantityChange = (value) => {
    const qty = Math.max(1, Number(value) || 1);
    setPartForm((prev) => {
      const hasStock =
        selectedPart && (selectedPart.qty_in_stock || 0) >= qty;
      return {
        ...prev,
        quantity: qty,
        allocateFromStock: hasStock ? prev.allocateFromStock : false,
      };
    });
  };

  const handlePartFieldChange = (field, value) => {
    setPartForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAllocateToggle = (nextValue) => {
    if (
      nextValue &&
      selectedPart &&
      (selectedPart.qty_in_stock || 0) < partForm.quantity
    ) {
      setPartFormError("Not enough stock to allocate that quantity right now.");
      return;
    }
    setPartFormError("");
    setPartForm((prev) => ({ ...prev, allocateFromStock: nextValue }));
  };

  const handleAddPart = async () => {
    if (!jobData?.id) {
      setPartFormError("Job not ready yet. Please wait a moment.");
      return;
    }
    if (!selectedPart) {
      setPartFormError("Select a part from stock first.");
      return;
    }

    setPartSaving(true);
    setPartFormError("");
    try {
      const quantity = partForm.quantity || 1;
      const payload = {
        jobId: jobData.id,
        partId: selectedPart.id,
        quantityRequested: quantity,
        allocateFromStock: partForm.allocateFromStock,
        prePickLocation: partForm.prePickLocation || null,
        storageLocation:
          partForm.storageLocation || selectedPart.storage_location || null,
        unitCost:
          Number.parseFloat(partForm.unitCost) ||
          Number.parseFloat(selectedPart.unit_cost) ||
          0,
        unitPrice:
          Number.parseFloat(partForm.unitPrice) ||
          Number.parseFloat(selectedPart.unit_price) ||
          0,
        requestNotes: partForm.requestNotes || "",
        userId: dbUserId || null,
      };

      const response = await fetch("/api/parts/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save part allocation");
      }

      await fetchJobParts();
      resetPartFormState();
    } catch (error) {
      setPartFormError(error.message || "Unable to add this part right now");
    } finally {
      setPartSaving(false);
    }
  };

  // ✅ Loading state
  if (loading) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "100%",
          flexDirection: "column",
          gap: "16px"
        }}>
          <div style={{
            width: "60px",
            height: "60px",
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #d10000",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <p style={{ color: "#666", fontSize: "16px" }}>Loading VHC details...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </Layout>
    );
  }

  // ✅ No data found
  if (!jobData) {
    return (
      <Layout>
        <div style={{ 
          display: "flex", 
          flexDirection: "column",
          alignItems: "center", 
          justifyContent: "center", 
          height: "100%",
          gap: "16px"
        }}>
          <div style={{ fontSize: "60px" }}>⚠️</div>
          <p style={{ color: "#666", fontSize: "18px", fontWeight: "600" }}>
            Job not found
          </p>
          <p style={{ color: "#999", fontSize: "14px" }}>
            Job #{jobNumber} could not be loaded
          </p>
          <button
            onClick={() => router.push("/vhc/dashboard")}
            style={{
              padding: "12px 24px",
              backgroundColor: "#d10000",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
          >
            Back to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  const statusColor = STATUS_COLORS[vhcStatus] || "#9ca3af";

  // ✅ Group checks by section
  const checksBySection = vhcChecks.reduce((acc, check) => {
    const sectionKey = check.section || "General"; // Normalizes section names for consistent grouping
    if (!acc[sectionKey]) {
      acc[sectionKey] = [];
    }
    acc[sectionKey].push(check);
    return acc;
  }, {});

  return (
    <Layout>
      <div style={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column", 
        padding: "16px",
        overflow: "hidden" 
      }}>
        {/* Header */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          <button
            onClick={() => router.push("/vhc/dashboard")}
            style={{
              padding: "10px 20px",
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#f5f5f5";
              e.target.style.borderColor = "#d0d0d0";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#fff";
              e.target.style.borderColor = "#e0e0e0";
            }}
          >
            ← Back
          </button>
          
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
            VHC Details - {jobNumber}
          </h1>
          
          {!partsOnlyView && (
            <button
              onClick={handleSendVHC}
              style={{
                padding: "12px 24px",
                backgroundColor: "#d10000",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                transition: "background-color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#b00000"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#d10000"}
            >
              📤 Send VHC
            </button>
          )}
        </div>

        {/* Vehicle Info Card */}
        <div style={{
          background: "linear-gradient(to bottom right, white, #fff9f9, #ffecec)",
          border: "1px solid #ffe5e5",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            {/* Left side */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{
                  backgroundColor: statusColor,
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  {vhcStatus}
                </div>
                <h2 style={{ fontSize: "32px", fontWeight: "700", color: "#1a1a1a", margin: 0 }}>
                  {jobData.reg || "N/A"}
                </h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
                  <strong>Vehicle:</strong> {jobData.makeModel || "N/A"}
                </p>
                <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
                  <strong>Customer:</strong> {getCustomerName(jobData.customer)}
                </p>
                {jobData.mileage && (
                  <p style={{ fontSize: "16px", color: "#666", margin: 0 }}>
                    <strong>Mileage:</strong> {jobData.mileage.toLocaleString()} miles
                  </p>
                )}
              </div>
            </div>

            {/* Right side - Summary */}
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "14px", color: "#666", margin: "0 0 8px 0" }}>
                <strong>VHC Checks:</strong> {vhcChecks.length}
              </p>
              <p style={{ fontSize: "14px", color: "#666", margin: "0 0 8px 0" }}>
                <strong>Job Status:</strong> {jobData.status}
              </p>
              {jobData.appointment && (
                <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>
                  <strong>Appointment:</strong> {jobData.appointment.date} {jobData.appointment.time}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Cost Summary Bar */}
        <div style={{
          background: "white",
          border: "1px solid #e0e0e0",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexShrink: 0
        }}>
          <div style={{
            backgroundColor: statusColor,
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: "600"
          }}>
            VHC Status: {vhcStatus}
          </div>

          <div style={{ display: "flex", gap: "48px" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px", margin: 0 }}>Red Work</p>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#ef4444", margin: "4px 0 0 0" }}>
                £{totals.redWork}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px", margin: 0 }}>Amber Work</p>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#fbbf24", margin: "4px 0 0 0" }}>
                £{totals.amberWork}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px", margin: 0 }}>Authorized</p>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#10b981", margin: "4px 0 0 0" }}>
                £{totals.authorized}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "4px", margin: 0 }}>Parts</p>
              <p style={{ fontSize: "24px", fontWeight: "700", color: "#b45309", margin: "4px 0 0 0" }}>
                £{partsSummary.value}
              </p>
              <p style={{ fontSize: "12px", color: "#b45309", margin: "4px 0 0 0" }}>
                {partsSummary.total} item{partsSummary.total === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          borderBottom: "2px solid #e0e0e0",
          flexShrink: 0
        }}>
          {["summary", "health-check", "parts", "photos", "videos"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "12px 20px",
                backgroundColor: activeTab === tab ? "#d10000" : "transparent",
                color: activeTab === tab ? "white" : "#666",
                border: "none",
                borderBottom: activeTab === tab ? "3px solid #d10000" : "3px solid transparent",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeTab === tab ? "600" : "500",
                textTransform: "capitalize",
                transition: "all 0.2s"
              }}
            >
              {tab.replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ 
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          
          {activeTab === "summary" && (
            <>
              {vhcChecks.length === 0 ? (
                <div style={{
                  background: "white",
                  border: "1px solid #e0e0e0",
                  borderRadius: "16px",
                  padding: "40px",
                  textAlign: "center",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
                  <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>
                    No VHC Checks Yet
                  </h3>
                  <p style={{ fontSize: "14px", color: "#666", marginBottom: "24px" }}>
                    Start adding checks to build the vehicle health report
                  </p>
                  {canEditVhcChecks && (
                    <button
                      onClick={() => router.push(`/vhc?job=${jobNumber}`)}
                      style={{
                        padding: "12px 24px",
                        backgroundColor: "#d10000",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "600"
                      }}
                    >
                      Add VHC Checks
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {hasWorkshopEditorRole && (
                    <div style={{
                      background: "white",
                      border: "1px solid #ffe0e0",
                      borderRadius: "16px",
                      padding: "20px",
                      boxShadow: "0 2px 8px rgba(209,0,0,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px"
                    }}>
                      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "12px" }}>
                        <div>
                          <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", color: "#1f2937", fontWeight: "700" }}>
                            Authorization Controls
                          </h3>
                          <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
                            {selectedItemCount} item{selectedItemCount === 1 ? "" : "s"} selected
                          </p>
                        </div>
                        <button
                          onClick={handleSelectAllChecks}
                          style={{
                            padding: "10px 18px",
                            backgroundColor: selectionIsFull ? "#991b1b" : "#d10000",
                            color: "white",
                            border: "none",
                            borderRadius: "999px",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: "600",
                            transition: "background-color 0.2s"
                          }}
                        >
                          {selectionIsFull ? "Clear All Checks" : "Check All Checks"}
                        </button>
                      </div>

                      <div>
                        <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#6b7280", fontWeight: "600" }}>
                          Quick check-all by section
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {sectionNames.map((sectionName) => {
                            const sectionChecks = vhcChecks.filter(
                              (check) => (check.section || "General") === sectionName
                            ); // Collects checks per section for button states
                            const sectionSelected = sectionChecks.length > 0 && sectionChecks.every(
                              (check) => selectedItems[check.vhc_id]
                            ); // Determines if the entire section is already selected
                            return (
                              <button
                                key={sectionName}
                                onClick={() => handleSectionToggleAll(sectionName)}
                                style={{
                                  padding: "8px 14px",
                                  borderRadius: "999px",
                                  border: sectionSelected ? "2px solid #d10000" : "1px solid #fecaca",
                                  backgroundColor: sectionSelected ? "#fee2e2" : "#fff5f5",
                                  color: "#991b1b",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                  transition: "all 0.2s"
                                }}
                              >
                                {sectionSelected ? "Uncheck" : "Check"} {sectionName}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "16px",
                        alignItems: "flex-end"
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <label style={{ fontSize: "12px", fontWeight: "700", color: "#991b1b" }}>
                            Customer Notes (optional)
                          </label>
                          <textarea
                            value={customerNotes}
                            onChange={(event) => setCustomerNotes(event.target.value)}
                            rows={3}
                            placeholder="Include any customer conversation points"
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              borderRadius: "10px",
                              border: "1px solid #fca5a5",
                              backgroundColor: "#fff",
                              fontSize: "13px",
                              color: "#1f2937",
                              resize: "vertical"
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "12px", fontWeight: "700", color: "#991b1b" }}>
                              Decline Reason
                            </label>
                            <select
                              value={declineReason}
                              onChange={(event) => setDeclineReason(event.target.value)}
                              style={{
                                padding: "10px 12px",
                                borderRadius: "10px",
                                border: "1px solid #fca5a5",
                                fontSize: "13px",
                                color: "#1f2937",
                                backgroundColor: "white"
                              }}
                            >
                              {DECLINE_REASON_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "12px", fontWeight: "700", color: "#991b1b" }}>
                              Reminder Period
                            </label>
                            <select
                              value={reminderMonths}
                              onChange={(event) => setReminderMonths(event.target.value)}
                              style={{
                                padding: "10px 12px",
                                borderRadius: "10px",
                                border: "1px solid #fca5a5",
                                fontSize: "13px",
                                color: "#1f2937",
                                backgroundColor: "white"
                              }}
                            >
                              {REMINDER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <button
                            onClick={handleAuthorizeSelected}
                            disabled={authorizing || selectedItemCount === 0}
                            style={{
                              padding: "12px 18px",
                              backgroundColor: selectedItemCount === 0 ? "#fca5a5" : "#d10000",
                              color: "white",
                              border: "none",
                              borderRadius: "10px",
                              fontSize: "14px",
                              fontWeight: "700",
                              cursor: selectedItemCount === 0 ? "not-allowed" : "pointer",
                              opacity: authorizing ? 0.8 : 1,
                              transition: "background-color 0.2s"
                            }}
                          >
                            {authorizing ? "Authorising..." : "Authorise Selected"}
                          </button>
                          <button
                            onClick={handleDeclineSelected}
                            disabled={declining || selectedItemCount === 0}
                            style={{
                              padding: "12px 18px",
                              backgroundColor: selectedItemCount === 0 ? "#fbcfe8" : "#be123c",
                              color: "white",
                              border: "none",
                              borderRadius: "10px",
                              fontSize: "14px",
                              fontWeight: "700",
                              cursor: selectedItemCount === 0 ? "not-allowed" : "pointer",
                              opacity: declining ? 0.8 : 1,
                              transition: "background-color 0.2s"
                            }}
                          >
                            {declining ? "Recording Decline..." : "Decline Selected"}
                          </button>
                        </div>
                      </div>

                      {actionMessage && (
                        <div style={{
                          backgroundColor: "#ecfdf5",
                          border: "1px solid #bbf7d0",
                          color: "#047857",
                          padding: "12px",
                          borderRadius: "12px",
                          fontSize: "13px",
                          fontWeight: "600"
                        }}>
                          {actionMessage}
                        </div>
                      )}

                      {actionError && (
                        <div style={{
                          backgroundColor: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#b91c1c",
                          padding: "12px",
                          borderRadius: "12px",
                          fontSize: "13px",
                          fontWeight: "600"
                        }}>
                          {actionError}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{
                    background: "white",
                    border: "1px solid #e0e0e0",
                    borderRadius: "16px",
                    padding: "24px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                  }}>
                    <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>
                      VHC Check Results
                    </h3>

                    {Object.entries(checksBySection).map(([section, checks]) => {
                      const sectionSelected = checks.length > 0 && checks.every(
                        (check) => selectedItems[check.vhc_id]
                      ); // Determines if all checks in this section are selected
                      return (
                        <div key={section} style={{ marginBottom: "24px" }}>
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "12px",
                            paddingBottom: "8px",
                            borderBottom: "2px solid #f0f0f0"
                          }}>
                            <h4 style={{
                              fontSize: "16px",
                              fontWeight: "600",
                              color: "#333",
                              margin: 0
                            }}>
                              {section} ({checks.length})
                            </h4>
                            {hasWorkshopEditorRole && (
                              <button
                                onClick={() => handleSectionToggleAll(section)}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "999px",
                                  border: "1px solid #fecaca",
                                  backgroundColor: sectionSelected ? "#fee2e2" : "#fff",
                                  color: "#991b1b",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  cursor: "pointer"
                                }}
                              >
                                {sectionSelected ? "Uncheck Section" : "Check Section"}
                              </button>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {checks.map(check => {
                              const itemSelected = Boolean(selectedItems[check.vhc_id]); // Checks if this individual item is selected
                              return (
                                <div key={check.vhc_id} style={{
                                  padding: "12px",
                                  border: itemSelected ? "1px solid #fca5a5" : "1px solid #e0e0e0",
                                  borderRadius: "8px",
                                  backgroundColor: itemSelected ? "#fff1f2" : "#fafafa"
                                }}>
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", justifyContent: "space-between" }}>
                                    {hasWorkshopEditorRole && (
                                      <input
                                        type="checkbox"
                                        checked={itemSelected}
                                        onChange={() => handleToggleItemSelection(check)}
                                        style={{ marginTop: "4px" }}
                                      />
                                    )}
                                    <div style={{ flex: 1 }}>
                                      <p style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", margin: "0 0 4px 0" }}>
                                        {check.issue_title}
                                      </p>
                                      <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>
                                        {check.issue_description}
                                      </p>
                                    </div>
                                    {check.measurement && (
                                      <div style={{
                                        padding: "6px 12px",
                                        backgroundColor: itemSelected ? "#fee2e2" : "#e0e0e0",
                                        borderRadius: "6px",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                        color: itemSelected ? "#991b1b" : "#1f2937"
                                      }}>
                                        £{parseFloat(check.measurement).toFixed(2)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === "health-check" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>
                Add/Edit VHC Checks
              </h3>
              {canEditVhcChecks ? (
                <button
                  onClick={() => router.push(`/vhc?job=${jobNumber}`)}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#d10000",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}
                >
                  Go to VHC Builder
                </button>
              ) : (
                <p style={{ color: "#a16207", margin: 0 }}>
                  Parts-only access: the service team controls VHC checks. Use the Parts tab to update customer-facing parts notes.
                </p>
              )}
            </div>
          )}

          {activeTab === "parts" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
                marginBottom: "20px"
              }}>
                <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#1a1a1a", margin: 0 }}>
                  Parts Requirements
                </h3>
                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Total</p>
                    <strong style={{ fontSize: "20px", color: "#111827" }}>
                      {partsSummary.total}
                    </strong>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Awaiting Stock</p>
                    <strong style={{ fontSize: "20px", color: "#b45309" }}>
                      {partsSummary.awaiting}
                    </strong>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Allocated / Fitted</p>
                    <strong style={{ fontSize: "20px", color: "#047857" }}>
                      {partsSummary.allocated}
                    </strong>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Value</p>
                    <strong style={{ fontSize: "20px", color: "#b45309" }}>
                      £{partsSummary.value}
                    </strong>
                  </div>
                </div>
              </div>

              {partsError && (
                <div style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  padding: "12px",
                  borderRadius: "12px",
                  marginBottom: "16px"
                }}>
                  {partsError}
                </div>
              )}

              {isPartsRole ? (
                <div style={{
                  border: "1px dashed #ffd6d6",
                  padding: "16px",
                  borderRadius: "12px",
                  marginBottom: "24px",
                  backgroundColor: "#fff8f8"
                }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#991b1b" }}>Auto-fill from stock</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ flex: "1 1 240px", minWidth: "200px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>
                        Part Number
                      </label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="text"
                          value={partLookup}
                          onChange={(e) => setPartLookup(e.target.value)}
                          placeholder="e.g. 5Q0615301"
                          style={{
                            flex: 1,
                            padding: "10px 12px",
                            borderRadius: "10px",
                            border: "1px solid #e5e7eb",
                            fontSize: "14px"
                          }}
                          disabled={partSaving}
                        />
                        <button
                          type="button"
                          onClick={handlePartLookup}
                          disabled={inventoryLoading || partSaving}
                          style={{
                            padding: "10px 16px",
                            borderRadius: "10px",
                            border: "none",
                            backgroundColor: "#d10000",
                            color: "white",
                            fontWeight: 600,
                            cursor: "pointer",
                            opacity: inventoryLoading ? 0.8 : 1
                          }}
                        >
                          {inventoryLoading ? "Searching..." : "Search"}
                        </button>
                      </div>
                    </div>

                    <div style={{ flex: "1 1 120px", minWidth: "120px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={partForm.quantity}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: "1px solid #e5e7eb",
                          fontSize: "14px"
                        }}
                      />
                    </div>

                    <div style={{ flex: "1 1 200px", minWidth: "180px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>
                        Allocate From Stock
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          type="checkbox"
                          checked={partForm.allocateFromStock}
                          onChange={(e) => handleAllocateToggle(e.target.checked)}
                          disabled={
                            !selectedPart ||
                            (selectedPart.qty_in_stock || 0) < partForm.quantity
                          }
                        />
                        <span style={{ fontSize: "13px", color: "#4b5563" }}>
                          {selectedPart
                            ? (selectedPart.qty_in_stock || 0) > 0
                              ? `${selectedPart.qty_in_stock} in stock`
                              : "Out of stock"
                            : "Search to view stock"}
                        </span>
                      </div>
                    </div>

                    <div style={{ flex: "1 1 200px", minWidth: "200px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>
                        Pre-pick Location
                      </label>
                      <select
                        value={partForm.prePickLocation}
                        onChange={(e) => handlePartFieldChange("prePickLocation", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: "1px solid #e5e7eb",
                          fontSize: "14px"
                        }}
                      >
                        {PRE_PICK_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ flex: "1 1 200px", minWidth: "200px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>
                        Storage Reference
                      </label>
                      <input
                        type="text"
                        value={partForm.storageLocation}
                        onChange={(e) => handlePartFieldChange("storageLocation", e.target.value)}
                        placeholder="Rack / bay reference"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: "1px solid #e5e7eb",
                          fontSize: "14px"
                        }}
                      />
                    </div>

                    <div style={{ flex: "1 1 160px", minWidth: "140px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>
                        Unit Price (£)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={partForm.unitPrice}
                        onChange={(e) => handlePartFieldChange("unitPrice", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: "1px solid #e5e7eb",
                          fontSize: "14px"
                        }}
                      />
                    </div>

                    <div style={{ flex: "1 1 160px", minWidth: "140px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>
                        Unit Cost (£)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={partForm.unitCost}
                        onChange={(e) => handlePartFieldChange("unitCost", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: "1px solid #e5e7eb",
                          fontSize: "14px"
                        }}
                      />
                    </div>

                    <div style={{ flex: "1 1 100%" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>
                        Customer Notes
                      </label>
                      <textarea
                        value={partForm.requestNotes}
                        onChange={(e) => handlePartFieldChange("requestNotes", e.target.value)}
                        rows={3}
                        placeholder="Notes for service team / customer authorization"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: "1px solid #e5e7eb",
                          fontSize: "14px",
                          resize: "vertical"
                        }}
                      />
                    </div>
                  </div>

                  {inventoryResults.length > 0 && (
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      marginTop: "12px"
                    }}>
                      {inventoryResults.slice(0, 5).map((part) => (
                        <button
                          type="button"
                          key={part.id}
                          onClick={() => handleSelectPart(part)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "999px",
                            border: part.part_number === selectedPart?.part_number ? "2px solid #d10000" : "1px solid #fca5a5",
                            backgroundColor: part.part_number === selectedPart?.part_number ? "#fee2e2" : "#fff",
                            color: "#991b1b",
                            fontSize: "12px",
                            cursor: "pointer"
                          }}
                        >
                          {part.part_number} · {part.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedPart && (
                    <div style={{
                      marginTop: "16px",
                      border: "1px solid #fde68a",
                      borderRadius: "12px",
                      padding: "16px",
                      backgroundColor: "#fffbeb"
                    }}>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "12px"
                      }}>
                        <div>
                          <p style={{ margin: 0, fontSize: "12px", color: "#92400e" }}>Part</p>
                          <strong style={{ color: "#78350f" }}>
                            {selectedPart.part_number} · {selectedPart.name}
                          </strong>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: "12px", color: "#92400e" }}>Stock</p>
                          <strong style={{ color: "#78350f" }}>
                            {(selectedPart.qty_in_stock ?? 0)} in stock / {(selectedPart.qty_reserved ?? 0)} reserved
                          </strong>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: "12px", color: "#92400e" }}>Selling Price</p>
                          <strong style={{ color: "#78350f" }}>
                            £{Number(selectedPart.unit_price || 0).toFixed(2)}
                          </strong>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: "12px", color: "#92400e" }}>Default Zone</p>
                          <strong style={{ color: "#78350f" }}>
                            {selectedPart.service_default_zone || selectedPart.storage_location || "Not set"}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {partFormError && (
                    <p style={{ color: "#b91c1c", marginTop: "12px" }}>{partFormError}</p>
                  )}

                  <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
                    <button
                      type="button"
                      onClick={handleAddPart}
                      disabled={partSaving || !selectedPart}
                      style={{
                        padding: "12px 18px",
                        borderRadius: "10px",
                        border: "none",
                        backgroundColor: "#d10000",
                        color: "white",
                        fontWeight: 600,
                        cursor: partSaving || !selectedPart ? "not-allowed" : "pointer",
                        opacity: partSaving || !selectedPart ? 0.7 : 1
                      }}
                    >
                      {partSaving ? "Saving..." : "Add part to job"}
                    </button>
                    {selectedPart && (
                      <button
                        type="button"
                        onClick={resetPartFormState}
                        style={{
                          padding: "12px 18px",
                          borderRadius: "10px",
                          border: "1px solid #d10000",
                          backgroundColor: "white",
                          color: "#d10000",
                          fontWeight: 600,
                          cursor: partSaving ? "not-allowed" : "pointer",
                          opacity: partSaving ? 0.7 : 1
                        }}
                        disabled={partSaving}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{
                  marginBottom: "24px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  padding: "16px"
                }}>
                  <p style={{ margin: 0, color: "#4b5563", fontSize: "14px" }}>
                    Parts allocations are managed by the Parts department. Any updates they make will appear here automatically.
                  </p>
                </div>
              )}

              <div>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#111827" }}>Current requests</h4>
                {partsLoading ? (
                  <div style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "#6b7280"
                  }}>
                    Loading parts allocations...
                  </div>
                ) : jobParts.length === 0 ? (
                  <div style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "#6b7280",
                    border: "1px dashed #e5e7eb",
                    borderRadius: "12px"
                  }}>
                    No parts have been requested for this job yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {jobParts.map((item) => {
                      const statusColors =
                        PART_STATUS_COLORS[item.status] || PART_STATUS_COLORS.pending;
                      const qty = item.quantity_requested || 0;
                      const allocatedQty = item.quantity_allocated || 0;
                      const unitPrice =
                        Number.parseFloat(item.unit_price) ||
                        Number.parseFloat(item.part?.unit_price) ||
                        0;
                      const lineTotal = (unitPrice * qty).toFixed(2);
                      return (
                        <div
                          key={item.id}
                          style={{
                            border: "1px solid #f3f4f6",
                            borderRadius: "12px",
                            padding: "16px",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "16px",
                            alignItems: "center",
                            backgroundColor: "#fafafa"
                          }}
                        >
                          <div style={{ flex: "2 1 220px" }}>
                            <strong style={{ color: "#111827" }}>
                              {item.part?.part_number || "Manual entry"}
                            </strong>
                            <p style={{ margin: "4px 0 0", color: "#4b5563", fontSize: "14px" }}>
                              {item.part?.name || "Custom part request"}
                            </p>
                            {item.request_notes && (
                              <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "13px" }}>
                                {item.request_notes}
                              </p>
                            )}
                          </div>
                          <div style={{ flex: "1 1 160px" }}>
                            <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Quantity</p>
                            <strong style={{ color: "#111827" }}>
                              {qty} requested · {allocatedQty} allocated
                            </strong>
                          </div>
                          <div style={{ flex: "1 1 140px" }}>
                            <span
                              style={{
                                padding: "6px 12px",
                                borderRadius: "999px",
                                backgroundColor: statusColors.bg,
                                color: statusColors.text,
                                fontWeight: 600,
                                fontSize: "12px"
                              }}
                            >
                              {item.status.replace("_", " ")}
                            </span>
                          </div>
                          <div style={{ flex: "1 1 140px", textAlign: "right" }}>
                            <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Line Value</p>
                            <strong style={{ color: "#111827" }}>£{lineTotal}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "photos" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>
                Photos
              </h3>
              <div style={{
                padding: "40px",
                textAlign: "center",
                backgroundColor: "#fafafa",
                borderRadius: "8px"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📷</div>
                <p style={{ fontSize: "14px", color: "#666" }}>
                  No photos uploaded yet
                </p>
              </div>
            </div>
          )}

          {activeTab === "videos" && (
            <div style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>
                Videos
              </h3>
              <div style={{
                padding: "40px",
                textAlign: "center",
                backgroundColor: "#fafafa",
                borderRadius: "8px"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎥</div>
                <p style={{ fontSize: "14px", color: "#666" }}>
                  No videos uploaded yet
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
