// file location: src/components/VHC/PartSearchModal.js
"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";

const CATEGORY_FILTERS = {
  wheels_tyres: {
    id: "wheels_tyres",
    label: "Tyres & Wheels",
    value: "tyre",
    matchers: ["wheel", "tyre", "tire"],
  },
  brakes_hubs: {
    id: "brakes_hubs",
    label: "Brakes & Hubs",
    value: "brake",
    matchers: ["brake", "pad", "disc", "hub"],
  },
};

const deriveCategoryFilter = (vhcItem = null) => {
  if (!vhcItem) return null;
  const categoryId = vhcItem?.category?.id || vhcItem?.categoryId || vhcItem?.category_id;
  if (categoryId && CATEGORY_FILTERS[categoryId]) {
    return CATEGORY_FILTERS[categoryId];
  }

  const categoryLabel = (vhcItem?.categoryLabel || vhcItem?.category?.label || "")
    .toString()
    .toLowerCase();
  if (categoryLabel) {
    const matched = Object.values(CATEGORY_FILTERS).find((entry) =>
      entry.matchers.some((token) => categoryLabel.includes(token))
    );
    if (matched) {
      return matched;
    }
  }

  const label = (vhcItem?.label || "").toString().toLowerCase();
  if (label) {
    const matched = Object.values(CATEGORY_FILTERS).find((entry) =>
      entry.matchers.some((token) => label.includes(token))
    );
    if (matched) {
      return matched;
    }
  }

  return null;
};

const withFilterMode = (filter, mode = "auto") => (filter ? { ...filter, mode } : null);
const FEEDBACK_THEME = {
  info: { color: "var(--info-dark)", background: "var(--info-surface)" },
  success: { color: "var(--success-dark)", background: "var(--success-surface)" },
  warning: { color: "var(--danger)", background: "var(--warning-surface)" },
  error: { color: "var(--danger)", background: "var(--danger-surface)" },
};

export default function PartSearchModal({ isOpen, onClose, vhcItemData, jobNumber, onPartSelected }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedParts, setSelectedParts] = useState([]);
  const [addingSelectedParts, setAddingSelectedParts] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [searchFeedback, setSearchFeedback] = useState({
    type: "info",
    text: "Enter a part number or name and click Search to query the stock catalogue",
  });

  const vhcItem = vhcItemData?.vhcItem;
  const linkedParts = vhcItemData?.linkedParts || [];

  const defaultFilter = useMemo(() => deriveCategoryFilter(vhcItem), [vhcItem]);

useEffect(() => {
  if (!isOpen) return;
  setCategoryFilter(withFilterMode(defaultFilter));
}, [defaultFilter, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedParts([]);
      setAddingSelectedParts(false);
    }
  }, [isOpen]);

  // Search parts function
  const searchParts = useCallback(async (query, category) => {
    const trimmedQuery = String(query || "").trim();
    const hasSearchTerm = trimmedQuery.length >= 2;
    const hasCategoryFilter = Boolean(category?.value);
    const isManualFilter = category?.mode === "manual";
    const shouldFilterByCategory = hasCategoryFilter && (isManualFilter || !hasSearchTerm);

    if (!hasSearchTerm && !hasCategoryFilter) {
      setSearchResults([]);
      setSearchFeedback({
        type: "warning",
        text: "Enter at least 2 characters or apply a filter before searching.",
      });
      return;
    }

    setLoading(true);
    setSearchFeedback({
      type: "info",
      text: trimmedQuery
        ? `Searching for "${trimmedQuery}"...`
        : `Searching catalogue${category?.label ? ` for ${category.label}` : ""}...`,
    });
    try {
      const params = new URLSearchParams();
      params.set("limit", "30");
      if (hasSearchTerm) {
        params.set("search", trimmedQuery);
      }
      if (shouldFilterByCategory) {
        params.set("category", category.value);
      }

      const response = await fetch(`/api/parts/catalog?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        console.error("Error searching parts:", payload?.message);
        setSearchResults([]);
        setSearchFeedback({
          type: "error",
          text: payload?.message || "Unable to search parts catalogue. Please try again.",
        });
      } else {
        const results = Array.isArray(payload.parts) ? payload.parts : [];
        setSearchResults(results);
        if (results.length > 0) {
          if (trimmedQuery) {
            setSearchFeedback({
              type: "success",
              text: `${results.length} part${results.length === 1 ? "" : "s"} found for "${trimmedQuery}"`,
            });
          } else if (hasCategoryFilter) {
            setSearchFeedback({
              type: "success",
              text: `${results.length} part${results.length === 1 ? "" : "s"} match ${category?.label || "the selected filter"}`,
            });
          } else {
            setSearchFeedback({ type: "success", text: `${results.length} parts found.` });
          }
        } else {
          if (trimmedQuery) {
            setSearchFeedback({
              type: "warning",
              text: `No parts found for "${trimmedQuery}"`,
            });
          } else if (hasCategoryFilter) {
            setSearchFeedback({
              type: "warning",
              text: `No parts found for ${category?.label || "the current filter"}`,
            });
          } else {
            setSearchFeedback({ type: "warning", text: "No parts match the current search." });
          }
        }
      }
    } catch (err) {
      console.error("Unexpected error searching parts:", err);
      setSearchResults([]);
      setSearchFeedback({
        type: "error",
        text: "Unexpected error searching parts. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Automatically fetch suggested parts when a default filter is available
  useEffect(() => {
    if (!isOpen) return;
    if (!categoryFilter || categoryFilter.mode !== "auto") return;
    searchParts("", categoryFilter);
  }, [categoryFilter, isOpen, searchParts]);

  const handleManualSearch = useCallback(() => {
    searchParts(searchQuery, categoryFilter);
  }, [searchQuery, categoryFilter, searchParts]);

  const handleApplyDefaultFilter = useCallback(() => {
    if (!defaultFilter) return;
    const manualFilter = withFilterMode(defaultFilter, "manual");
    setCategoryFilter(manualFilter);
    searchParts(searchQuery, manualFilter);
  }, [defaultFilter, searchQuery, searchParts]);

  const handleTogglePartSelection = useCallback(async (part) => {
    let addedPart = false;
    setSelectedParts((prev) => {
      const exists = prev.some((entry) => entry.part.id === part.id);
      if (exists) {
        return prev.filter((entry) => entry.part.id !== part.id);
      }
      addedPart = true;
      return [...prev, { part, quantity: 1 }];
    });

    if (!addedPart) return;

    try {
      const response = await fetch(`/api/parts/delivery-logs/${part.id}`);
      const data = await response.json();

      if (response.ok && data.success && data.deliveryLog) {
        setSelectedParts((prev) =>
          prev.map((entry) =>
            entry.part.id === part.id
              ? {
                  ...entry,
                  part: {
                    ...entry.part,
                    lastDelivery: data.deliveryLog,
                  },
                }
              : entry
          )
        );
      }
    } catch (err) {
      console.error("Error fetching delivery history:", err);
    }
  }, []);

  const handleSelectedPartQuantityChange = useCallback((partId, value) => {
    setSelectedParts((prev) =>
      prev.map((entry) =>
        entry.part.id === partId
          ? {
              ...entry,
              quantity: value,
            }
          : entry
      )
    );
  }, []);

  const handleSelectedPartQuantityBlur = useCallback((partId) => {
    setSelectedParts((prev) =>
      prev.map((entry) => {
        if (entry.part.id !== partId) return entry;
        const parsed = Number(entry.quantity);
        const resolved = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
        return {
          ...entry,
          quantity: resolved,
        };
      })
    );
  }, []);

  const handleRemoveSelectedPart = useCallback((partId) => {
    setSelectedParts((prev) => prev.filter((entry) => entry.part.id !== partId));
  }, []);

  // Handle adding part to VHC item
  const handleAddPart = useCallback(async () => {
    if (!vhcItemData || !jobNumber || selectedParts.length === 0) return;

    setAddingSelectedParts(true);

    try {
      // Get job ID from job number
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id")
        .eq("job_number", jobNumber)
        .single();

      if (jobError) {
        console.error("Error finding job:", jobError);
        alert(`Error finding job: ${jobError.message || "Job not found. Please verify the job number."}`);
        return;
      }

      const parseVhcItemId = (vhcId) => {
        if (!vhcId) return null;
        const parsed = Number(vhcId);
        return Number.isInteger(parsed) && Number.isSafeInteger(parsed) ? parsed : null;
      };

      let validVhcItemId = parseVhcItemId(vhcItemData.vhcId);

      if (!validVhcItemId && vhcItemData.vhcId && vhcItemData.vhcItem) {
        console.log("Creating vhc_checks record for VHC item with string ID:", vhcItemData.vhcId);

        const { data: vhcCheckData, error: vhcCheckError } = await supabase
          .from("vhc_checks")
          .insert({
            job_id: jobData.id,
            section: vhcItemData.vhcItem.sectionName || "General",
            issue_title: vhcItemData.vhcItem.label || "VHC Item",
            issue_description: vhcItemData.vhcItem.notes || vhcItemData.vhcItem.concernText || "",
            measurement: vhcItemData.vhcItem.measurement || null,
          })
          .select("vhc_id")
          .single();

        if (vhcCheckError) {
          console.error("Error creating vhc_checks record:", vhcCheckError);
          alert(`Error creating VHC item in database: ${vhcCheckError.message || "Failed to create VHC item"}`);
          return;
        }

        if (vhcCheckData && vhcCheckData.vhc_id) {
          validVhcItemId = vhcCheckData.vhc_id;
          console.log("Created vhc_checks record with ID:", validVhcItemId);
        }
      }

      let successCount = 0;
      const errors = [];

      for (const selection of selectedParts) {
        const selectedPart = selection.part;
        const rawQuantity = selection.quantity;
        const parsedQuantity = Number(rawQuantity);
        const validQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;

        try {
          const response = await fetch("/api/parts/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId: jobData.id,
              partId: selectedPart.id,
              quantityRequested: validQuantity,
              allocateFromStock: false,
              status: "pending",
              origin: "vhc",
              vhcItemId: validVhcItemId,
              unitPrice: selectedPart.unit_price,
              unitCost: selectedPart.unit_cost || 0,
              requestNotes: `Linked from VHC: ${vhcItemData.vhcItem?.label || "VHC Item"}`,
            }),
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Failed to add part to job");
          }

          successCount += 1;

          if (onPartSelected) {
            onPartSelected({
              jobPart: result.jobPart,
              sourceVhcId: vhcItemData?.vhcId || null,
            });
          }
        } catch (error) {
          console.error("Error adding part:", error);
          errors.push(`${selectedPart.part_number || selectedPart.name}: ${error.message || "Failed to add part"}`);
        }
      }

      if (successCount > 0) {
        setSearchFeedback({
          type: "success",
          text: `${successCount} part${successCount === 1 ? "" : "s"} linked to the VHC item`,
        });
        setSelectedParts([]);
      }

      if (errors.length > 0) {
        alert(`Some parts could not be added:\n${errors.join("\n")}`);
      }

    } catch (err) {
      console.error("Unexpected error adding part:", err);
      alert(`Unexpected error: ${err.message || "An unknown error occurred. Please try again."}`);
    } finally {
      setAddingSelectedParts(false);
      if (typeof onClose === "function") {
        onClose();
      }
    }
  }, [selectedParts, vhcItemData, jobNumber, onPartSelected, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1200,
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "900px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          background: "var(--surface)",
          borderRadius: "18px",
          border: "1px solid var(--accent-purple-surface)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--accent-purple-surface)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--accent-purple)" }}>
              Add Parts to VHC Item
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--info)" }}>
              {vhcItem?.label || "VHC Item"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--accent-purple-surface)",
              background: "var(--surface)",
              color: "var(--info-dark)",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: "24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* VHC Item Details */}
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              background: "var(--info-surface)",
              border: "1px solid var(--accent-purple-surface)",
            }}
          >
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--info)", marginBottom: "8px" }}>
              VHC Item Details
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)" }}>
              {vhcItem?.label || "VHC Item"}
            </div>
            {vhcItem?.notes && (
              <div style={{ fontSize: "13px", color: "var(--info-dark)", marginTop: "4px" }}>
                {vhcItem.notes}
              </div>
            )}
            {vhcItem?.concernText && (
              <div style={{ fontSize: "13px", color: "var(--info-dark)", marginTop: "4px" }}>
                Concern: {vhcItem.concernText}
              </div>
            )}
          </div>

          {/* Selected Parts */}
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              background: "var(--surface)",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "12px" }}>
              Selected Parts ({selectedParts.length})
            </div>
            {selectedParts.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--info)" }}>Select parts from the search results to add them to this VHC item.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {selectedParts.map(({ part, quantity }) => (
                  <div
                    key={part.id}
                    style={{
                      border: "1px solid var(--accent-purple-surface)",
                      borderRadius: "10px",
                      padding: "12px",
                      background: "var(--info-surface)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--accent-purple)" }}>{part.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--info-dark)", marginTop: "2px" }}>
                          Part #: {part.part_number} | £{Number(part.unit_price || 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--info-dark)", marginTop: "2px" }}>
                          Stock on hand: {part.qty_in_stock ?? 0} · Reserved: {part.qty_reserved ?? 0} · On order: {part.qty_on_order ?? 0}
                        </div>
                        {part.storage_location && (
                          <div style={{ fontSize: "12px", color: "var(--info-dark)", marginTop: "2px" }}>
                            Location: {part.storage_location}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedPart(part.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--danger)",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <div style={{ marginTop: "12px", display: "flex", gap: "16px", alignItems: "center" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--info-dark)", marginBottom: "4px" }}>
                          Quantity
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={quantity === "" ? "" : quantity}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "" || /^\d+$/.test(value)) {
                              handleSelectedPartQuantityChange(part.id, value === "" ? "" : Number(value));
                            }
                          }}
                          onBlur={() => handleSelectedPartQuantityBlur(part.id)}
                          placeholder="1"
                          style={{
                            width: "70px",
                            padding: "8px",
                            borderRadius: "8px",
                            border: "1px solid var(--accent-purple-surface)",
                            fontSize: "14px",
                            textAlign: "center",
                          }}
                        />
                      </div>
                      {part.lastDelivery && (
                        <div
                          style={{
                            flex: 1,
                            padding: "12px",
                            borderRadius: "8px",
                            background: "var(--surface)",
                            border: "1px solid var(--accent-purple-surface)",
                          }}
                        >
                          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--info)", marginBottom: "4px" }}>
                            Last Delivery
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--info-dark)" }}>
                            {part.lastDelivery.supplier && <div>Supplier: {part.lastDelivery.supplier}</div>}
                            {part.lastDelivery.order_reference && <div>Order Ref: {part.lastDelivery.order_reference}</div>}
                            <div>
                              Qty Ordered: {part.lastDelivery.qty_ordered} · Received: {part.lastDelivery.qty_received}
                            </div>
                            {part.lastDelivery.unit_cost && <div>Unit Cost: £{Number(part.lastDelivery.unit_cost).toFixed(2)}</div>}
                            {part.lastDelivery.delivery_date && (
                              <div>Date: {new Date(part.lastDelivery.delivery_date).toLocaleDateString()}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Currently Linked Parts */}
          {linkedParts.length > 0 && (
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "12px" }}>
                Currently Linked Parts
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {linkedParts.map((part) => (
                  <div
                    key={part.id}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      background: "var(--success-surface)",
                      border: "1px solid var(--success)",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--success)" }}>
                      {part.part?.name || "Part"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--info-dark)", marginTop: "2px" }}>
                      {part.part?.part_number || "—"} × {part.quantity_requested || 1} | £
                      {Number(part.unit_price || part.part?.unit_price || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
              {/* Part Search */}
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "8px" }}>
              Search for Parts
            </label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleManualSearch();
                  }
                }}
                placeholder="Search by part number, name, supplier, or price..."
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--accent-purple-surface)",
                  fontSize: "14px",
                }}
              />
              <button
                type="button"
                onClick={handleManualSearch}
                disabled={loading}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--primary)",
                  background: loading ? "var(--surface-light)" : "var(--primary)",
                  color: loading ? "var(--info)" : "var(--surface)",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  minWidth: "90px",
                }}
              >
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
            {categoryFilter && (
              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--accent-purple-surface)",
                  border: "1px solid var(--accent-purple-surface)",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  color: "var(--info-dark)",
                }}
              >
                <div>
                  {categoryFilter.mode === "manual" || searchQuery.trim().length === 0
                    ? "Filter applied:"
                    : "Suggested filter:"}{" "}
                  <strong style={{ color: "var(--accent-purple)" }}>{categoryFilter.label}</strong>
                  {categoryFilter.mode !== "manual" && searchQuery.trim().length > 0 && (
                    <span style={{ marginLeft: "6px", color: "var(--info)" }}>
                      (auto filter paused while searching)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCategoryFilter(null)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--accent-purple)",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Clear
                </button>
              </div>
            )}
            {!categoryFilter && defaultFilter && (
              <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--info)" }}>
                <button
                  type="button"
                  onClick={handleApplyDefaultFilter}
                  style={{
                    border: "1px solid var(--accent-purple-surface)",
                    background: "var(--surface)",
                    color: "var(--accent-purple)",
                    borderRadius: "999px",
                    padding: "4px 12px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  Filter for {defaultFilter.label}
                </button>
              </div>
            )}
            {searchFeedback?.text && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: FEEDBACK_THEME[searchFeedback.type]?.color || "var(--info-dark)",
                  background: FEEDBACK_THEME[searchFeedback.type]?.background || "var(--info-surface)",
                }}
              >
                {searchFeedback.text}
              </div>
            )}
          </div>

          {/* Search Results */}
          {loading && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--info)" }}>
              Searching...
            </div>
          )}

          {!loading && searchResults.length > 0 && (
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "12px" }}>
                Search Results ({searchResults.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
                {searchResults.map((part) => {
                  const isSelected = selectedParts.some((entry) => entry.part.id === part.id);
                  return (
                  <div
                    key={part.id}
                    onClick={() => handleTogglePartSelection(part)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      background: isSelected ? "var(--accent-purple-surface)" : "var(--surface)",
                      border: `1px solid ${isSelected ? "var(--primary)" : "var(--accent-purple-surface)"}`,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--accent-purple)" }}>
                      {part.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--info-dark)", marginTop: "4px" }}>
                      Part #: {part.part_number} | Price: £{Number(part.unit_price || 0).toFixed(2)} | Stock: {part.qty_in_stock || 0}
                    </div>
                    {part.supplier && (
                      <div style={{ fontSize: "11px", color: "var(--info)", marginTop: "2px" }}>
                        Supplier: {part.supplier}
                      </div>
                    )}
                    <div style={{ fontSize: "11px", color: "var(--info)", marginTop: "2px" }}>
                      Reserved: {part.qty_reserved ?? 0} · On order: {part.qty_on_order ?? 0}
                    </div>
                    {part.category && (
                      <div style={{ fontSize: "11px", color: "var(--info)", marginTop: "2px" }}>
                        Category: {part.category}
                      </div>
                    )}
                    {part.storage_location && (
                      <div style={{ fontSize: "11px", color: "var(--info)", marginTop: "2px" }}>
                        Location: {part.storage_location}
                      </div>
                    )}
                    <div style={{ marginTop: "8px", fontSize: "11px", fontWeight: 600, color: isSelected ? "var(--primary)" : "var(--info)" }}>
                      {isSelected ? "✓ Selected" : "Click to Select"}
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--accent-purple-surface)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid var(--accent-purple-surface)",
              background: "var(--surface)",
              color: "var(--info-dark)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAddPart}
            disabled={selectedParts.length === 0 || addingSelectedParts}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid var(--primary)",
              background:
                selectedParts.length === 0 || addingSelectedParts ? "var(--surface-light)" : "var(--primary)",
              color: selectedParts.length === 0 || addingSelectedParts ? "var(--info)" : "var(--surface)",
              fontWeight: 600,
              cursor:
                selectedParts.length === 0 || addingSelectedParts ? "not-allowed" : "pointer",
              minWidth: "160px",
            }}
          >
            {addingSelectedParts
              ? "Adding Parts..."
              : selectedParts.length > 0
              ? `Add ${selectedParts.length} Part${selectedParts.length === 1 ? "" : "s"}`
              : "Add Parts"}
          </button>
        </div>
      </div>
    </div>
  );
}
