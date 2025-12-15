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
  const [selectedPart, setSelectedPart] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [labourHours, setLabourHours] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [searchFeedback, setSearchFeedback] = useState({
    type: "info",
    text: "Enter a part number or name and click Search to query the stock catalogue",
  });
  const [activeTab, setActiveTab] = useState("search"); // "search" or "bulk"
  const [bulkData, setBulkData] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState(null);
  const [bulkResults, setBulkResults] = useState([]);

  const vhcItem = vhcItemData?.vhcItem;
  const linkedParts = vhcItemData?.linkedParts || [];

  const defaultFilter = useMemo(() => deriveCategoryFilter(vhcItem), [vhcItem]);

  useEffect(() => {
    if (!isOpen) return;
    setCategoryFilter(withFilterMode(defaultFilter));
  }, [defaultFilter, isOpen]);

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

      const response = await fetch(`/api/vhc/parts-search?${params.toString()}`);
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

  // Handle part selection
  const handleSelectPart = useCallback((part) => {
    setSelectedPart(part);
  }, []);

  // Handle adding part to VHC item
  const handleAddPart = useCallback(async () => {
    if (!selectedPart || !vhcItemData || !jobNumber) return;

    try {
      // Get job ID from job number
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id")
        .eq("job_number", jobNumber)
        .single();

      if (jobError) {
        console.error("Error finding job:", jobError);
        alert("Error finding job. Please try again.");
        return;
      }

      // Create parts_job_items entry
      const { data, error } = await supabase
        .from("parts_job_items")
        .insert({
          job_id: jobData.id,
          part_id: selectedPart.id,
          quantity_requested: quantity,
          status: "pending",
          origin: "vhc",
          vhc_item_id: vhcItemData.vhcId,
          unit_price: selectedPart.unit_price,
          labour_hours: labourHours,
          request_notes: `Linked from VHC: ${vhcItemData.vhcItem?.label || "VHC Item"}`,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding part:", error);
        alert("Error adding part. Please try again.");
        return;
      }

      // Notify parent component
      if (onPartSelected) {
        onPartSelected(data);
      }

      setSearchFeedback({
        type: "success",
        text: `${selectedPart.part_number || selectedPart.name} linked to the VHC item`,
      });

      // Reset and close
      setSelectedPart(null);
      setQuantity(1);
      setLabourHours(0);
      setSearchQuery("");
      setCategoryFilter(withFilterMode(defaultFilter));
      onClose();
    } catch (err) {
      console.error("Unexpected error adding part:", err);
      alert("Unexpected error. Please try again.");
    }
  }, [selectedPart, vhcItemData, jobNumber, quantity, labourHours, onPartSelected, onClose, defaultFilter]);

  // Parse bulk import data
  const parseBulkData = useCallback((text) => {
    const lines = text.trim().split("\n").filter(line => line.trim());
    const rows = [];
    let currentRow = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Check if this might be a new row (starts with order ref pattern like ORD001)
      if (currentRow.length >= 8 && /^[A-Z]{3}\d{3}/.test(trimmedLine)) {
        rows.push(currentRow);
        currentRow = [trimmedLine];
      } else {
        currentRow.push(trimmedLine);
      }
    }

    // Add the last row
    if (currentRow.length >= 8) {
      rows.push(currentRow);
    }

    // Parse each row into structured data
    return rows.map((row, idx) => ({
      index: idx,
      orderRef: row[0] || "",
      partNumber: row[1] || "",
      name: row[2] || "",
      supplier: row[3] || "",
      location: row[4] || "",
      costPrice: row[5]?.replace(/[£$]/g, "") || "0",
      sellPrice: row[6]?.replace(/[£$]/g, "") || "0",
      quantity: parseInt(row[7]) || 1,
    }));
  }, []);

  // Handle bulk import
  const handleBulkImport = useCallback(async () => {
    if (!bulkData.trim()) {
      setBulkFeedback({
        type: "warning",
        text: "Please paste bulk data to import",
      });
      return;
    }

    setLoading(true);
    setBulkFeedback({ type: "info", text: "Processing bulk import..." });

    try {
      const parsedRows = parseBulkData(bulkData);

      if (parsedRows.length === 0) {
        setBulkFeedback({
          type: "warning",
          text: "No valid data found. Please ensure data is in the correct format.",
        });
        setLoading(false);
        return;
      }

      // Get job ID
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id")
        .eq("job_number", jobNumber)
        .single();

      if (jobError) {
        setBulkFeedback({
          type: "error",
          text: "Error finding job. Please try again.",
        });
        setLoading(false);
        return;
      }

      const results = [];

      for (const row of parsedRows) {
        try {
          // Check if part exists in catalog
          const { data: existingPart, error: searchError } = await supabase
            .from("parts_catalog")
            .select("*")
            .eq("part_number", row.partNumber)
            .maybeSingle();

          let partId;

          if (existingPart) {
            partId = existingPart.id;
            results.push({
              ...row,
              status: "found",
              message: `Part ${row.partNumber} found in catalog`,
              partId,
            });
          } else {
            // Create new part in catalog
            const { data: newPart, error: createError } = await supabase
              .from("parts_catalog")
              .insert({
                part_number: row.partNumber,
                name: row.name,
                supplier: row.supplier,
                storage_location: row.location,
                unit_cost: parseFloat(row.costPrice) || 0,
                unit_price: parseFloat(row.sellPrice) || 0,
                qty_in_stock: 0,
                is_active: true,
              })
              .select()
              .single();

            if (createError) {
              results.push({
                ...row,
                status: "error",
                message: `Failed to create part: ${createError.message}`,
              });
              continue;
            }

            partId = newPart.id;
            results.push({
              ...row,
              status: "created",
              message: `Part ${row.partNumber} created in catalog`,
              partId,
            });
          }

          // Add part to job
          const { error: insertError } = await supabase
            .from("parts_job_items")
            .insert({
              job_id: jobData.id,
              part_id: partId,
              quantity_requested: row.quantity,
              status: "pending",
              origin: "vhc",
              vhc_item_id: vhcItemData.vhcId,
              unit_cost: parseFloat(row.costPrice) || 0,
              unit_price: parseFloat(row.sellPrice) || 0,
              storage_location: row.location,
              request_notes: `Bulk import - Order: ${row.orderRef}`,
            });

          if (insertError) {
            results.push({
              ...row,
              status: "error",
              message: `Failed to add to job: ${insertError.message}`,
            });
          }
        } catch (err) {
          results.push({
            ...row,
            status: "error",
            message: `Unexpected error: ${err.message}`,
          });
        }
      }

      setBulkResults(results);

      const successCount = results.filter(r => r.status === "found" || r.status === "created").length;
      const errorCount = results.filter(r => r.status === "error").length;

      setBulkFeedback({
        type: successCount > 0 ? "success" : "error",
        text: `Import complete: ${successCount} parts added, ${errorCount} errors`,
      });

      if (successCount > 0 && onPartSelected) {
        onPartSelected({ bulkImport: true, count: successCount });
      }
    } catch (err) {
      console.error("Unexpected error during bulk import:", err);
      setBulkFeedback({
        type: "error",
        text: `Unexpected error: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  }, [bulkData, jobNumber, vhcItemData, parseBulkData, onPartSelected]);

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

          {/* Tab Navigation */}
          <div style={{ display: "flex", gap: "8px", borderBottom: "2px solid var(--accent-purple-surface)" }}>
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              style={{
                padding: "10px 20px",
                border: "none",
                background: activeTab === "search" ? "var(--accent-purple-surface)" : "transparent",
                color: activeTab === "search" ? "var(--accent-purple)" : "var(--info)",
                fontWeight: 600,
                cursor: "pointer",
                borderBottom: activeTab === "search" ? "2px solid var(--primary)" : "none",
                marginBottom: "-2px",
                borderRadius: "8px 8px 0 0",
              }}
            >
              Search Parts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bulk")}
              style={{
                padding: "10px 20px",
                border: "none",
                background: activeTab === "bulk" ? "var(--accent-purple-surface)" : "transparent",
                color: activeTab === "bulk" ? "var(--accent-purple)" : "var(--info)",
                fontWeight: 600,
                cursor: "pointer",
                borderBottom: activeTab === "bulk" ? "2px solid var(--primary)" : "none",
                marginBottom: "-2px",
                borderRadius: "8px 8px 0 0",
              }}
            >
              Bulk Import
            </button>
          </div>

          {/* Search Tab Content */}
          {activeTab === "search" && (
            <>
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
                {searchResults.map((part) => (
                  <div
                    key={part.id}
                    onClick={() => handleSelectPart(part)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      background: selectedPart?.id === part.id ? "var(--accent-purple-surface)" : "var(--surface)",
                      border: `1px solid ${selectedPart?.id === part.id ? "var(--primary)" : "var(--accent-purple-surface)"}`,
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
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Part Details */}
          {selectedPart && (
            <div
              style={{
                padding: "16px",
                borderRadius: "12px",
                background: "var(--accent-purple-surface)",
                border: "2px solid var(--primary)",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "12px" }}>
                Selected Part
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent-purple)" }}>
                {selectedPart.name}
              </div>
              <div style={{ fontSize: "13px", color: "var(--info-dark)", marginTop: "4px" }}>
                Part #: {selectedPart.part_number} | £{Number(selectedPart.unit_price || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: "12px", color: "var(--info-dark)", marginTop: "4px" }}>
                Stock on hand: {selectedPart.qty_in_stock ?? 0}
              </div>
              <div style={{ fontSize: "12px", color: "var(--info-dark)", marginTop: "2px" }}>
                Reserved: {selectedPart.qty_reserved ?? 0} · On order: {selectedPart.qty_on_order ?? 0}
              </div>
              {selectedPart.storage_location && (
                <div style={{ fontSize: "12px", color: "var(--info-dark)", marginTop: "2px" }}>
                  Location: {selectedPart.storage_location}
                </div>
              )}

              <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--info-dark)", marginBottom: "4px" }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid var(--accent-purple-surface)",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--info-dark)", marginBottom: "4px" }}>
                    Labour Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={labourHours}
                    onChange={(e) => setLabourHours(parseFloat(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "8px",
                      border: "1px solid var(--accent-purple-surface)",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>
            </div>
          )}
            </>
          )}

          {/* Bulk Import Tab Content */}
          {activeTab === "bulk" && (
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "8px" }}>
                Paste Bulk Data
              </div>
              <div style={{ fontSize: "12px", color: "var(--info)", marginBottom: "12px" }}>
                Paste data in the following format (one field per line, 8 lines per part):
                <br />
                Order Ref, Part Number, Name, Supplier, Location, Cost Price, Sell Price, Quantity
              </div>
              <textarea
                value={bulkData}
                onChange={(e) => setBulkData(e.target.value)}
                placeholder={`Example:\nORD001\nOILF1\nOil Filter\nEuro Car Parts\nA1\n£4.00\n£9.99\n10\nORD002\nBRAKE1\nBrake Pad\nHalford\nB2\n£15.00\n£29.99\n5`}
                style={{
                  width: "100%",
                  minHeight: "200px",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--accent-purple-surface)",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  resize: "vertical",
                }}
              />

              {bulkFeedback?.text && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    color: FEEDBACK_THEME[bulkFeedback.type]?.color || "var(--info-dark)",
                    background: FEEDBACK_THEME[bulkFeedback.type]?.background || "var(--info-surface)",
                  }}
                >
                  {bulkFeedback.text}
                </div>
              )}

              {bulkResults.length > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "12px" }}>
                    Import Results
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
                    {bulkResults.map((result, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          background: result.status === "error" ? "var(--danger-surface)" : "var(--success-surface)",
                          border: `1px solid ${result.status === "error" ? "var(--danger)" : "var(--success)"}`,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: result.status === "error" ? "var(--danger)" : "var(--success)" }}>
                          {result.partNumber} - {result.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--info-dark)", marginTop: "2px" }}>
                          {result.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleBulkImport}
                disabled={loading || !bulkData.trim()}
                style={{
                  marginTop: "16px",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "1px solid var(--primary)",
                  background: loading || !bulkData.trim() ? "var(--surface-light)" : "var(--primary)",
                  color: loading || !bulkData.trim() ? "var(--info)" : "var(--surface)",
                  fontWeight: 600,
                  cursor: loading || !bulkData.trim() ? "not-allowed" : "pointer",
                  width: "100%",
                }}
              >
                {loading ? "Processing..." : "Import Parts"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === "search" && (
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
              disabled={!selectedPart}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid var(--primary)",
                background: selectedPart ? "var(--primary)" : "var(--surface-light)",
                color: selectedPart ? "var(--surface)" : "var(--info)",
                fontWeight: 600,
                cursor: selectedPart ? "pointer" : "not-allowed",
              }}
            >
              Add New Part
            </button>
          </div>
        )}
        {activeTab === "bulk" && (
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
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
