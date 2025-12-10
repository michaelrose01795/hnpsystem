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

export default function PartSearchModal({ isOpen, onClose, vhcItemData, jobNumber, onPartSelected }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [labourHours, setLabourHours] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState(null);

  const vhcItem = vhcItemData?.vhcItem;
  const linkedParts = vhcItemData?.linkedParts || [];

  const defaultFilter = useMemo(() => deriveCategoryFilter(vhcItem), [vhcItem]);

  useEffect(() => {
    if (!isOpen) return;
    setCategoryFilter(defaultFilter);
  }, [defaultFilter, isOpen]);

  // Search parts function
  const searchParts = useCallback(async (query, category) => {
    const trimmedQuery = String(query || "").trim();
    const hasSearchTerm = trimmedQuery.length >= 2;
    const hasCategoryFilter = Boolean(category?.value);

    if (!hasSearchTerm && !hasCategoryFilter) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      let queryBuilder = supabase
        .from("parts_catalog")
        .select("id, part_number, name, unit_price, unit_cost, qty_in_stock, supplier, category, storage_location")
        .order("name", { ascending: true })
        .limit(30);

      if (hasSearchTerm) {
        const sanitisedQuery = trimmedQuery.replace(/[%]/g, "").replace(/,/g, "");
        const pattern = `%${sanitisedQuery}%`;
        const orClauses = [
          `name.ilike.${pattern}`,
          `part_number.ilike.${pattern}`,
          `supplier.ilike.${pattern}`,
          `category.ilike.${pattern}`,
          `description.ilike.${pattern}`,
          `oem_reference.ilike.${pattern}`,
          `storage_location.ilike.${pattern}`,
        ];
        const numericOnly = /^\d+(?:\.\d+)?$/.test(sanitisedQuery);
        if (numericOnly) {
          const numericValue = Number.parseFloat(sanitisedQuery);
          if (!Number.isNaN(numericValue)) {
            orClauses.push(`unit_price.eq.${numericValue}`);
            orClauses.push(`unit_cost.eq.${numericValue}`);
          }
        }
        queryBuilder = queryBuilder.or(orClauses.join(","));
      }

      if (hasCategoryFilter) {
        queryBuilder = queryBuilder.ilike("category", `%${category.value}%`);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error("Error searching parts:", error);
        setSearchResults([]);
      } else {
        setSearchResults(data || []);
      }
    } catch (err) {
      console.error("Unexpected error searching parts:", err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchParts(searchQuery, categoryFilter);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, categoryFilter, searchParts]);

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

      // Reset and close
      setSelectedPart(null);
      setQuantity(1);
      setLabourHours(0);
      setSearchQuery("");
      setCategoryFilter(defaultFilter);
      onClose();
    } catch (err) {
      console.error("Unexpected error adding part:", err);
      alert("Unexpected error. Please try again.");
    }
  }, [selectedPart, vhcItemData, jobNumber, quantity, labourHours, onPartSelected, onClose, defaultFilter]);

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

          {/* Part Search */}
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--accent-purple)", marginBottom: "8px" }}>
              Search for Parts
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by part number, name, supplier, or price..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid var(--accent-purple-surface)",
                fontSize: "14px",
              }}
            />
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
                  Auto filter applied: <strong style={{ color: "var(--accent-purple)" }}>{categoryFilter.label}</strong>
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
                  onClick={() => setCategoryFilter(defaultFilter)}
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
            Add Part
          </button>
        </div>
      </div>
    </div>
  );
}
