// ✅ New Parts Tab with Drag & Drop Allocation
// file location: src/components/PartsTab_New.js
import React, { useState, useCallback, useEffect, useMemo, forwardRef } from "react";

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

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "—";
  return moneyFormatter.format(amount);
};

const PartsTabNew = forwardRef(function PartsTabNew(
  { jobData, canEdit, onRefreshJob, actingUserId, actingUserNumericId, invoiceReady },
  _ref
) {
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

  const [partAllocations, setPartAllocations] = useState({});
  const [selectedPartIds, setSelectedPartIds] = useState([]);
  const [allocatingSelection, setAllocatingSelection] = useState(false);


  const canAllocateParts = Boolean(canEdit && jobId);
  const allocationDisabledReason = !canEdit
    ? "You don't have permission to add parts."
    : !jobId
    ? "Job must be loaded before allocating parts."
    : "";

  // Get all parts added to the job (from allocations)
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
      source: "allocation",
    }));
  }, [jobData.partsAllocations]);

  const goodsInParts = useMemo(() => {
    return (Array.isArray(jobData.goodsInParts) ? jobData.goodsInParts : [])
      .filter((item) => item.addedToJob !== false)
      .map((item) => ({
        id: `goods-in-${item.id}`,
        partId: null,
        partNumber: item.partNumber || item.part_number || "N/A",
        name: item.partNumber || item.description || "Part",
        description: item.description || "",
        quantity: item.quantity ?? 0,
        unitPrice: item.retailPrice ?? item.retail_price ?? 0,
        unitCost: item.costPrice ?? item.cost_price ?? 0,
        qtyInStock: null,
        storageLocation: item.binLocation || item.bin_location || "Not assigned",
        status: "stock",
        allocatedToRequestId: null,
        createdAt: item.createdAt,
        source: "goods-in",
      }));
  }, [jobData.goodsInParts]);

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

  const partsOnOrder = useMemo(
    () => jobParts.filter((part) => normalizePartStatus(part.status) === "on_order"),
    [jobParts]
  );

  const togglePartSelection = useCallback((partId) => {
    setSelectedPartIds((prev) => {
      if (prev.includes(partId)) {
        return prev.filter((entry) => entry !== partId);
      }
      return [...prev, partId];
    });
  }, []);

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
      const params = new URLSearchParams({
        search: rawTerm,
        limit: "25",
      });
      const response = await fetch(`/api/parts/catalog?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to search stock catalogue");
      }

      const results = Array.isArray(payload.parts) ? payload.parts : [];
      setCatalogResults(results);
      setCatalogError(results.length === 0 ? "No parts found in stock catalogue." : "");
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

  // Get unallocated parts
  const unallocatedParts = jobParts.filter((part) => !part.allocatedToRequestId);
  const leftPanelParts = [...unallocatedParts, ...goodsInParts];

  const handleAssignSelectedToRequest = useCallback(
    async (requestId) => {
      if (!canEdit || !invoiceReady || !requestId) return;
      if (selectedPartIds.length === 0) return;

      const selectedParts = leftPanelParts.filter((part) => selectedPartIds.includes(part.id));
      const allocatableParts = selectedParts.filter((part) => part.source !== "goods-in");

      if (allocatableParts.length === 0) {
        alert("Select parts from the job list to allocate.");
        return;
      }

      setAllocatingSelection(true);
      try {
        await Promise.all(
          allocatableParts.map(async (part) => {
            const response = await fetch("/api/parts/allocate-to-request", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                partAllocationId: part.id,
                requestId,
                jobId,
              }),
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
              throw new Error(data.message || "Failed to allocate part to request");
            }
          })
        );

        setSelectedPartIds([]);
        if (typeof onRefreshJob === "function") {
          onRefreshJob();
        }
      } catch (error) {
        console.error("Failed to allocate parts to request:", error);
        alert(`Error: ${error.message}`);
      } finally {
        setAllocatingSelection(false);
      }
    },
    [canEdit, invoiceReady, jobId, leftPanelParts, onRefreshJob, selectedPartIds]
  );

  useEffect(() => {
    if (!invoiceReady) {
      setSelectedPartIds([]);
    }
  }, [invoiceReady]);

  useEffect(() => {
    setSelectedPartIds((prev) => prev.filter((id) => leftPanelParts.some((part) => part.id === id)));
  }, [leftPanelParts]);

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
          <div
            style={{
              marginBottom: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div>
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
                {leftPanelParts.length} unallocated · {jobParts.length + goodsInParts.length} total
              </p>
            </div>
            {invoiceReady && (
              <button
                type="button"
                disabled={!canEdit || leftPanelParts.length === 0}
                title={
                  !canEdit
                    ? "You do not have permission to allocate parts."
                    : leftPanelParts.length === 0
                    ? "No parts have been added to this job yet."
                    : "Select parts and choose a request to allocate"
                }
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--accent-purple)",
                  background: !canEdit || leftPanelParts.length === 0 ? "var(--surface-light)" : "var(--accent-purple)",
                  color: !canEdit || leftPanelParts.length === 0 ? "var(--text-secondary)" : "white",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: !canEdit || leftPanelParts.length === 0 ? "not-allowed" : "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Allocate to Request
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {leftPanelParts.length === 0 ? (
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
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ textTransform: "uppercase", color: "var(--info)" }}>
                      <th style={{ textAlign: "left", padding: "8px" }}>Part number</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Description</th>
                      <th style={{ textAlign: "right", padding: "8px" }}>Qty</th>
                      <th style={{ textAlign: "right", padding: "8px" }}>Retail</th>
                      <th style={{ textAlign: "right", padding: "8px" }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leftPanelParts.map((part) => {
                      const isAllocatable = part.source !== "goods-in" && invoiceReady;
                      const isSelected = selectedPartIds.includes(part.id);
                      return (
                        <tr
                          key={part.id}
                          onClick={() => {
                            if (isAllocatable) {
                              togglePartSelection(part.id);
                            }
                          }}
                          style={{
                            background: isSelected ? "var(--info-surface)" : "transparent",
                            cursor: isAllocatable ? "pointer" : "default",
                            borderTop: "1px solid var(--surface-light)",
                          }}
                          title={part.source === "goods-in" ? "Goods-in parts are view-only here." : ""}
                        >
                          <td style={{ padding: "8px", fontWeight: 600, color: "var(--accent-purple)" }}>
                            {part.partNumber}
                          </td>
                          <td style={{ padding: "8px", color: "var(--info-dark)" }}>
                            {part.description || part.name}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right" }}>{part.quantity}</td>
                          <td style={{ padding: "8px", textAlign: "right" }}>{formatMoney(part.unitPrice)}</td>
                          <td style={{ padding: "8px", textAlign: "right" }}>{formatMoney(part.unitCost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Parts On Order / Allocate Parts */}
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
              {invoiceReady ? "Allocate parts" : "Parts On Order"}
            </div>
            {invoiceReady && (
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--info)" }}>
                Select parts on the left, then choose a request to allocate them.
              </p>
            )}
          </div>
          {invoiceReady ? (
            allRequests.length === 0 ? (
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
                No customer requests or authorised work found for this job.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {allRequests.map((request) => {
                  const allocatedParts = partAllocations[request.id] || [];
                  return (
                    <div
                      key={request.id}
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px solid var(--surface-light)",
                        background: "var(--surface)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-purple)" }}>
                            {request.type === "customer" ? "Customer Request" : "VHC Authorised"}
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--info-dark)", marginTop: "2px" }}>
                            {request.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!canEdit || selectedPartIds.length === 0 || allocatingSelection}
                          onClick={() => handleAssignSelectedToRequest(request.id)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid var(--accent-purple)",
                            background: !canEdit || selectedPartIds.length === 0 || allocatingSelection
                              ? "var(--surface-light)"
                              : "var(--accent-purple)",
                            color: !canEdit || selectedPartIds.length === 0 || allocatingSelection
                              ? "var(--text-secondary)"
                              : "white",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor:
                              !canEdit || selectedPartIds.length === 0 || allocatingSelection ? "not-allowed" : "pointer",
                          }}
                        >
                          {allocatingSelection ? "Allocating..." : "Assign selected"}
                        </button>
                      </div>
                      {allocatedParts.length > 0 && (
                        <div
                          style={{
                            marginTop: "10px",
                            marginLeft: "14px",
                            paddingLeft: "12px",
                            borderLeft: "2px solid var(--surface-light)",
                          }}
                        >
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead>
                              <tr style={{ textTransform: "uppercase", color: "var(--info)" }}>
                                <th style={{ textAlign: "left", padding: "6px" }}>Part number</th>
                                <th style={{ textAlign: "left", padding: "6px" }}>Description</th>
                                <th style={{ textAlign: "right", padding: "6px" }}>Qty</th>
                                <th style={{ textAlign: "right", padding: "6px" }}>Retail</th>
                                <th style={{ textAlign: "right", padding: "6px" }}>Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allocatedParts.map((part) => (
                                <tr key={part.id} style={{ borderTop: "1px solid var(--surface-light)" }}>
                                  <td style={{ padding: "6px", fontWeight: 600, color: "var(--accent-purple)" }}>
                                    {part.partNumber}
                                  </td>
                                  <td style={{ padding: "6px", color: "var(--info-dark)" }}>{part.description || part.name}</td>
                                  <td style={{ padding: "6px", textAlign: "right" }}>{part.quantity}</td>
                                  <td style={{ padding: "6px", textAlign: "right" }}>{formatMoney(part.unitPrice)}</td>
                                  <td style={{ padding: "6px", textAlign: "right" }}>{formatMoney(part.unitCost)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : partsOnOrder.length === 0 ? (
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
              No parts currently on order for this job.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ textTransform: "uppercase", color: "var(--info)" }}>
                    <th style={{ textAlign: "left", padding: "8px" }}>Part number</th>
                    <th style={{ textAlign: "left", padding: "8px" }}>Description</th>
                    <th style={{ textAlign: "right", padding: "8px" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "8px" }}>Retail</th>
                    <th style={{ textAlign: "right", padding: "8px" }}>Cost</th>
                    <th style={{ textAlign: "left", padding: "8px" }}>ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {partsOnOrder.map((part) => (
                    <tr key={part.id} style={{ borderTop: "1px solid var(--surface-light)" }}>
                      <td style={{ padding: "8px", fontWeight: 600, color: "var(--accent-purple)" }}>
                        {part.partNumber}
                      </td>
                      <td style={{ padding: "8px", color: "var(--info-dark)" }}>{part.description || part.name}</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>{part.quantity}</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>{formatMoney(part.unitPrice)}</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>{formatMoney(part.unitCost)}</td>
                      <td style={{ padding: "8px", color: "var(--info-dark)" }}>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
});

export default PartsTabNew;
