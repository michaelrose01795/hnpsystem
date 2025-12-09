// file location: src/components/VHC/PartSearchModal.js
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PartSearchModal({ isOpen, onClose, vhcItemData, jobNumber, onPartSelected }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [labourHours, setLabourHours] = useState(0);

  // Search parts function
  const searchParts = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("parts")
        .select("id, part_number, name, unit_price, stock_quantity, supplier")
        .or(`name.ilike.%${query}%,part_number.ilike.%${query}%`)
        .limit(20);

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
      searchParts(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchParts]);

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
      onClose();
    } catch (err) {
      console.error("Unexpected error adding part:", err);
      alert("Unexpected error. Please try again.");
    }
  }, [selectedPart, vhcItemData, jobNumber, quantity, labourHours, onPartSelected, onClose]);

  if (!isOpen) return null;

  const vhcItem = vhcItemData?.vhcItem;
  const linkedParts = vhcItemData?.linkedParts || [];

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
              placeholder="Search by part name or part number..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid var(--accent-purple-surface)",
                fontSize: "14px",
              }}
            />
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
                      Part #: {part.part_number} | Price: £{Number(part.unit_price || 0).toFixed(2)} | Stock: {part.stock_quantity || 0}
                    </div>
                    {part.supplier && (
                      <div style={{ fontSize: "11px", color: "var(--info)", marginTop: "2px" }}>
                        Supplier: {part.supplier}
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
