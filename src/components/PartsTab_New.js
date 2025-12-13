// ✅ New Parts Tab with Drag & Drop Allocation
// file location: src/components/PartsTab_New.js
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";

// Helper functions (keep existing)
const normalizePartStatus = (status = "") => {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  if (["pending"].includes(normalized)) return "pending";
  if (["priced"].includes(normalized)) return "priced";
  if (["pre_pick", "pre-pick", "picked"].includes(normalized)) return "pre_pick";
  if (["on_order", "on-order", "awaiting_stock"].includes(normalized)) return "on_order";
  if (["stock", "allocated", "fitted"].includes(normalized)) return "stock";
  return "pending";
};

const PART_STATUS_META = {
  pending: { label: "Pending", color: "var(--danger-dark)", background: "var(--warning-surface)" },
  priced: { label: "Priced", color: "var(--accent-purple)", background: "var(--accent-purple-surface)" },
  pre_pick: { label: "Pre Pick", color: "var(--success-dark)", background: "var(--success-surface)" },
  on_order: { label: "On Order", color: "var(--warning)", background: "var(--warning-surface)" },
  stock: { label: "Stock", color: "var(--accent-purple)", background: "var(--info-surface)" },
};

const getPartStatusMeta = (status) => {
  const normalized = normalizePartStatus(status || "pending");
  return PART_STATUS_META[normalized] || PART_STATUS_META.pending;
};

const formatDateTime = (value) => {
  if (!value) return "Not recorded";
  try {
    return new Date(value).toLocaleString();
  } catch (_err) {
    return value;
  }
};

export default function PartsTabNew({ jobData, canEdit, onRefreshJob, actingUserId, actingUserNumericId }) {
  const jobId = jobData?.id;
  const jobNumber = jobData?.jobNumber;

  // State for part search
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [selectedCatalogPart, setSelectedCatalogPart] = useState(null);
  const [catalogQuantity, setCatalogQuantity] = useState(1);
  const [catalogSubmitError, setCatalogSubmitError] = useState("");
  const [catalogSuccessMessage, setCatalogSuccessMessage] = useState("");
  const [allocatingPart, setAllocatingPart] = useState(false);

  // State for drag and drop
  const [draggingPart, setDraggingPart] = useState(null);
  const [dragOverRequest, setDragOverRequest] = useState(null);
  const [partAllocations, setPartAllocations] = useState({});

  const canAllocateParts = Boolean(canEdit && jobId);
  const allocationDisabledReason = !canEdit
    ? "You don't have permission to add parts."
    : !jobId
    ? "Job must be loaded before allocating parts."
    : "";

  // Get all parts added to the job
  const jobParts = useMemo(() => {
    return (Array.isArray(jobData.partsAllocations) ? jobData.partsAllocations : []).map((item) => ({
      id: item.id,
      partId: item.part?.id || item.partId,
      partNumber: item.part?.partNumber || item.part?.part_number || "N/A",
      name: item.part?.name || "Part",
      description: item.part?.description || "",
      quantity: item.quantityRequested ?? item.quantityAllocated ?? 0,
      unitPrice: item.part?.unit_price ?? item.part?.unitPrice ?? 0,
      unitCost: item.part?.unit_cost ?? item.part?.unitCost ?? 0,
      qtyInStock: item.part?.qty_in_stock ?? item.part?.qtyInStock ?? 0,
      storageLocation: item.storageLocation || item.part?.storage_location || "Not assigned",
      status: item.status || "pending",
      allocatedToRequestId: item.allocatedToRequestId || null,
      createdAt: item.createdAt,
    }));
  }, [jobData.partsAllocations]);

  // Get customer requests and authorized work
  const allRequests = useMemo(() => {
    const customerReqs = (Array.isArray(jobData.requests) ? jobData.requests : []).map((req, idx) => ({
      id: req.request_id || req.requestId || `customer-${idx}`,
      type: "customer",
      description: typeof req === "string" ? req : req.text || req.description || "",
      jobType: req.job_type || req.jobType || "Customer",
      hours: req.hours || null,
    }));

    const vhcReqs = (Array.isArray(jobData.vhcChecks) ? jobData.vhcChecks : [])
      .filter((check) => check.authorized || check.status === "authorized")
      .map((check, idx) => ({
        id: check.vhc_id || check.vhcId || `vhc-${idx}`,
        type: "vhc",
        description: check.issue_title || check.issueTitle || check.issue_description || "VHC Item",
        section: check.section || "",
        severity: check.severity || check.traffic_light || "grey",
      }));

    return [...customerReqs, ...vhcReqs];
  }, [jobData.requests, jobData.vhcChecks]);

  // Group parts by allocated request
  useEffect(() => {
    const allocations = {};
    jobParts.forEach((part) => {
      if (part.allocatedToRequestId) {
        if (!allocations[part.allocatedToRequestId]) {
          allocations[part.allocatedToRequestId] = [];
        }
        allocations[part.allocatedToRequestId].push(part);
      }
    });
    setPartAllocations(allocations);
  }, [jobParts]);

  // Search stock catalog
  const searchStockCatalog = useCallback(async (term) => {
    const rawTerm = (term || "").trim();
    if (!rawTerm) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }

    setCatalogLoading(true);
    try {
      let query = supabase
        .from("parts_catalog")
        .select(
          "id, part_number, name, description, supplier, category, storage_location, qty_in_stock, qty_reserved, qty_on_order, unit_cost, unit_price"
        )
        .order("name", { ascending: true })
        .limit(25);

      const sanitised = rawTerm.replace(/[%]/g, "").replace(/,/g, "");
      const pattern = `%${sanitised}%`;
      const clauses = [
        `name.ilike.${pattern}`,
        `part_number.ilike.${pattern}`,
        `supplier.ilike.${pattern}`,
        `category.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `oem_reference.ilike.${pattern}`,
        `storage_location.ilike.${pattern}`,
      ];
      if (/^\d+(?:\.\d+)?$/.test(sanitised)) {
        const numericValue = Number.parseFloat(sanitised);
        if (!Number.isNaN(numericValue)) {
          clauses.push(`unit_price.eq.${numericValue}`);
          clauses.push(`unit_cost.eq.${numericValue}`);
        }
      }
      query = query.or(clauses.join(","));

      const { data, error } = await query;
      if (error) throw error;
      setCatalogResults(data || []);
      if (!data || data.length === 0) {
        setCatalogError("No parts found in stock catalogue.");
      } else {
        setCatalogError("");
      }
    } catch (error) {
      console.error("Stock search failed", error);
      setCatalogResults([]);
      setCatalogError(error.message || "Unable to search stock catalogue");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canAllocateParts) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }
    const trimmed = (catalogSearch || "").trim();
    if (!trimmed) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }
    if (trimmed.length < 2) {
      setCatalogResults([]);
      setCatalogError("Enter at least 2 characters to search stock.");
      return;
    }
    const timer = setTimeout(() => searchStockCatalog(trimmed), 300);
    return () => clearTimeout(timer);
  }, [catalogSearch, canAllocateParts, searchStockCatalog]);

  const handleCatalogSelect = useCallback((part) => {
    if (!part) return;
    setSelectedCatalogPart(part);
    setCatalogQuantity(1);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
  }, []);

  const clearSelectedCatalogPart = useCallback(() => {
    setSelectedCatalogPart(null);
    setCatalogQuantity(1);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
  }, []);

  useEffect(() => {
    if (!canAllocateParts) {
      setCatalogSearch("");
      clearSelectedCatalogPart();
      setCatalogSuccessMessage("");
      setCatalogSubmitError("");
    }
  }, [canAllocateParts, clearSelectedCatalogPart]);

  const handleAddPartFromStock = useCallback(async () => {
    if (!canAllocateParts || !selectedCatalogPart || !jobId) {
      setCatalogSubmitError("Select a part to allocate from stock.");
      return;
    }
    if (catalogQuantity <= 0) {
      setCatalogSubmitError("Quantity must be at least 1.");
      return;
    }
    const availableStock = Number(selectedCatalogPart.qty_in_stock || 0);
    if (catalogQuantity > availableStock) {
      setCatalogSubmitError(`Only ${availableStock} in stock for this part.`);
      return;
    }

    setAllocatingPart(true);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
    try {
      const response = await fetch("/api/parts/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          partId: selectedCatalogPart.id,
          quantityRequested: catalogQuantity,
          allocateFromStock: true,
          storageLocation: selectedCatalogPart.storage_location || null,
          requestNotes: jobNumber ? `Added via job card ${jobNumber}` : "Added via job card",
          origin: "job_card",
          userId: actingUserId,
          userNumericId: actingUserNumericId,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to allocate part from stock");
      }

      setCatalogSuccessMessage(`${selectedCatalogPart.part_number || selectedCatalogPart.name} added to job.`);
      clearSelectedCatalogPart();
      if (typeof onRefreshJob === "function") {
        onRefreshJob();
      }
      if ((catalogSearch || "").trim().length >= 2) {
        searchStockCatalog(catalogSearch.trim());
      }
    } catch (error) {
      console.error("Unable to add part from stock", error);
      setCatalogSubmitError(error.message || "Unable to add part to job");
    } finally {
      setAllocatingPart(false);
    }
  }, [
    actingUserId,
    actingUserNumericId,
    canAllocateParts,
    catalogQuantity,
    catalogSearch,
    clearSelectedCatalogPart,
    jobId,
    jobNumber,
    onRefreshJob,
    searchStockCatalog,
    selectedCatalogPart,
  ]);

  // Drag and drop handlers
  const handleDragStart = (part, e) => {
    if (!canEdit) return;
    setDraggingPart(part);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    if (!canEdit || !draggingPart) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnterRequest = (requestId, e) => {
    if (!canEdit || !draggingPart) return;
    e.stopPropagation();
    setDragOverRequest(requestId);
  };

  const handleDragLeave = (e) => {
    if (!canEdit || !draggingPart) return;
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverRequest(null);
    }
  };

  const handleDrop = async (requestId, e) => {
    e.preventDefault();
    if (!canEdit || !draggingPart) return;

    try {
      const response = await fetch("/api/parts/allocate-to-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partAllocationId: draggingPart.id,
          requestId: requestId,
          jobId: jobId,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to allocate part to request");
      }

      if (typeof onRefreshJob === "function") {
        onRefreshJob();
      }
    } catch (error) {
      console.error("Failed to allocate part to request:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setDraggingPart(null);
      setDragOverRequest(null);
    }
  };

  const handleAssignViaDropdown = async (partId, requestId) => {
    if (!canEdit) return;

    try {
      const response = await fetch("/api/parts/allocate-to-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partAllocationId: partId,
          requestId: requestId,
          jobId: jobId,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to allocate part to request");
      }

      if (typeof onRefreshJob === "function") {
        onRefreshJob();
      }
    } catch (error) {
      console.error("Failed to allocate part to request:", error);
      alert(`Error: ${error.message}`);
    }
  };

  // Get unallocated parts
  const unallocatedParts = jobParts.filter((part) => !part.allocatedToRequestId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Search Section */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--surface-light)",
          borderRadius: "12px",
          padding: "16px",
        }}
      >
        <div style={{ marginBottom: "12px" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Search Parts Stock
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--info-dark)" }}>
            Search and add parts to this job
          </p>
        </div>
        <input
          type="search"
          value={catalogSearch}
          disabled={!canAllocateParts}
          onChange={(e) => {
            setCatalogSearch(e.target.value);
            setCatalogSuccessMessage("");
            setCatalogSubmitError("");
          }}
          placeholder={canAllocateParts ? "Search by part number, name, supplier..." : "Search disabled"}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid var(--surface-light)",
            fontSize: "14px",
            backgroundColor: canAllocateParts ? "var(--surface)" : "var(--info-surface)",
            color: "var(--info-dark)",
          }}
        />
        {catalogLoading && <div style={{ fontSize: "13px", color: "var(--info)", marginTop: "8px" }}>Searching...</div>}
        {!catalogLoading && catalogError && (
          <div style={{ fontSize: "12px", color: "var(--danger)", marginTop: "8px" }}>{catalogError}</div>
        )}
        {canAllocateParts && !catalogLoading && catalogResults.length > 0 && (
          <div
            style={{
              maxHeight: "200px",
              overflowY: "auto",
              border: "1px solid var(--surface-light)",
              borderRadius: "10px",
              marginTop: "12px",
            }}
          >
            {catalogResults.map((part) => {
              const isSelected = selectedCatalogPart?.id === part.id;
              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => handleCatalogSelect(part)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "none",
                    borderBottom: "1px solid var(--surface-light)",
                    textAlign: "left",
                    background: isSelected ? "var(--accent-purple-surface)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--accent-purple)", fontSize: "14px" }}>{part.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--info-dark)" }}>
                    Part #: {part.part_number} · Supplier: {part.supplier || "Unknown"}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--info)" }}>
                    Stock: {part.qty_in_stock ?? 0} · £{Number(part.unit_price || 0).toFixed(2)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {selectedCatalogPart && (
          <div
            style={{
              border: "1px solid var(--accent-purple)",
              borderRadius: "10px",
              padding: "12px",
              background: "var(--accent-purple-surface)",
              marginTop: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--accent-purple)", fontSize: "14px" }}>{selectedCatalogPart.name}</div>
                <div style={{ fontSize: "12px", color: "var(--info-dark)" }}>
                  Part #: {selectedCatalogPart.part_number} · Location: {selectedCatalogPart.storage_location || "Unassigned"}
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelectedCatalogPart}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--info)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "var(--info-dark)", display: "block", marginBottom: "4px" }}>
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedCatalogPart.qty_in_stock || undefined}
                  value={catalogQuantity}
                  onChange={(e) => setCatalogQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: "6px",
                    border: "1px solid var(--surface-light)",
                    fontSize: "13px",
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--info-dark)", marginBottom: "4px" }}>Available</div>
                <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--accent-purple)" }}>
                  {selectedCatalogPart.qty_in_stock ?? 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--info-dark)", marginBottom: "4px" }}>Sell Price</div>
                <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--accent-purple)" }}>
                  £{Number(selectedCatalogPart.unit_price || 0).toFixed(2)}
                </div>
              </div>
            </div>
            {catalogSubmitError && (
              <div style={{ padding: "8px", borderRadius: "6px", background: "var(--warning-surface)", color: "var(--danger)", fontSize: "12px", marginBottom: "8px" }}>
                {catalogSubmitError}
              </div>
            )}
            {catalogSuccessMessage && (
              <div style={{ padding: "8px", borderRadius: "6px", background: "var(--success-surface)", color: "var(--success-dark)", fontSize: "12px", marginBottom: "8px" }}>
                {catalogSuccessMessage}
              </div>
            )}
            <button
              type="button"
              onClick={handleAddPartFromStock}
              disabled={!canAllocateParts || allocatingPart}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                background: !canAllocateParts ? "var(--surface-light)" : "var(--accent-purple)",
                color: "white",
                fontWeight: 600,
                cursor: !canAllocateParts ? "not-allowed" : "pointer",
                fontSize: "14px",
              }}
            >
              {allocatingPart ? "Adding..." : "Add to Job"}
            </button>
          </div>
        )}
      </div>

      {/* 50/50 Layout: Parts List (Left) and Requests (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Left Side - Parts Added to Job */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--surface-light)",
            borderRadius: "12px",
            padding: "16px",
            minHeight: "400px",
          }}
        >
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--primary)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Parts Added to Job
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--info)" }}>
              {unallocatedParts.length} unallocated · {jobParts.length} total
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {unallocatedParts.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--info)",
                  fontSize: "13px",
                  border: "1px dashed var(--surface-light)",
                  borderRadius: "8px",
                }}
              >
                No unallocated parts. Add parts using the search above.
              </div>
            ) : (
              unallocatedParts.map((part) => (
                <div
                  key={part.id}
                  draggable={canEdit}
                  onDragStart={(e) => handleDragStart(part, e)}
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    border: `1px solid ${draggingPart?.id === part.id ? "var(--primary)" : "var(--surface-light)"}`,
                    backgroundColor: draggingPart?.id === part.id ? "var(--info-surface)" : "var(--surface)",
                    cursor: canEdit ? "grab" : "default",
                    opacity: draggingPart?.id === part.id ? 0.5 : 1,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: "var(--accent-purple)", fontSize: "13px" }}>{part.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--info)" }}>
                      Part #: {part.partNumber} · Qty: {part.quantity} · £{Number(part.unitPrice || 0).toFixed(2)}
                    </div>
                  </div>
                  {canEdit && (
                    <select
                      value={part.allocatedToRequestId || ""}
                      onChange={(e) => {
                        const requestId = e.target.value;
                        if (requestId) {
                          handleAssignViaDropdown(part.id, requestId);
                        }
                      }}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--surface-light)",
                        fontSize: "11px",
                        backgroundColor: "var(--surface)",
                        color: "var(--info-dark)",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">Assign to...</option>
                      {allRequests.map((req) => (
                        <option key={req.id} value={req.id}>
                          {req.description.substring(0, 40)}...
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side - Allocated Requests */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--surface-light)",
            borderRadius: "12px",
            padding: "16px",
            minHeight: "400px",
          }}
        >
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--primary)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Customer Requests & Authorized Work
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--info)" }}>
              Drop parts here to allocate
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {allRequests.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--info)",
                  fontSize: "13px",
                  border: "1px dashed var(--surface-light)",
                  borderRadius: "8px",
                }}
              >
                No requests or authorized work found for this job.
              </div>
            ) : (
              allRequests.map((request) => {
                const allocatedParts = partAllocations[request.id] || [];
                const isDropTarget = dragOverRequest === request.id;

                return (
                  <div
                    key={request.id}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnterRequest(request.id, e)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(request.id, e)}
                    style={{
                      padding: "10px",
                      borderRadius: "8px",
                      border: `2px solid ${isDropTarget ? "var(--primary)" : "var(--surface-light)"}`,
                      backgroundColor: isDropTarget ? "var(--info-surface)" : "var(--surface)",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-purple)" }}>
                          {request.type === "customer" ? "Customer Request" : "VHC Authorized"}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--info-dark)", marginTop: "2px" }}>
                          {request.description}
                        </div>
                      </div>
                      {allocatedParts.length > 0 && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "999px",
                            backgroundColor: "var(--accent-purple-surface)",
                            color: "var(--accent-purple)",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          {allocatedParts.length}
                        </span>
                      )}
                    </div>
                    {/* Show drag indicator line when dragging over */}
                    {isDropTarget && draggingPart && (
                      <div
                        style={{
                          height: "3px",
                          backgroundColor: "var(--primary)",
                          borderRadius: "2px",
                          marginBottom: "8px",
                          animation: "pulse 1s infinite",
                        }}
                      />
                    )}
                    {/* Allocated Parts */}
                    {allocatedParts.length > 0 && (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {allocatedParts.map((part) => (
                          <div
                            key={part.id}
                            style={{
                              padding: "8px",
                              borderRadius: "6px",
                              backgroundColor: "var(--accent-purple-surface)",
                              fontSize: "12px",
                            }}
                          >
                            <div style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{part.name}</div>
                            <div style={{ color: "var(--info-dark)", marginTop: "2px" }}>
                              Qty: {part.quantity} × £{Number(part.unitPrice || 0).toFixed(2)} = £
                              {(part.quantity * Number(part.unitPrice || 0)).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
