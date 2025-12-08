// file location: src/components/VHC/TyresSection.js
import React, { useEffect, useMemo, useState } from "react"; // Import React hooks for component logic
import themeConfig from "@/styles/appTheme"; // Import shared theme for consistent styling
import { searchTyres } from "@/lib/tyre/tyreAPI"; // Import placeholder tyre search helper

// 🔧 Temporary placeholder connection to tyreAPI.js
// TODO: Replace placeholder search with live API call to process.env.TYRE_API_URL (.env.local)

const palette = themeConfig.palette; // Cache palette reference for reuse

export default function TyresSection({
  contextLabel = "Tyre Selection", // Label describing the section context
  selectedTyre = null, // Currently selected tyre data
  onTyreSelected = () => {}, // Callback when a tyre is chosen
  jobNumber = "", // Optional job number for context
  technicianName = "", // Optional technician for context
}) {
  const [query, setQuery] = useState(""); // Track current search query
  const [isFocused, setIsFocused] = useState(false); // Track focus state for dropdown handling

  const results = useMemo(() => {
    if (!query.trim()) {
      return []; // Avoid returning matches when the query is empty
    }
    return searchTyres(query).slice(0, 10); // Use placeholder search to return up to ten matches
  }, [query]); // Recompute results when the query changes

  useEffect(() => {
    if (!selectedTyre) {
      return; // Skip updates when no tyre has been selected
    }
    const summary = `${selectedTyre.make} ${selectedTyre.size} ${selectedTyre.load}${selectedTyre.speed}`.trim(); // Build human readable summary for the selected tyre
    setQuery(summary); // Reflect the chosen tyre inside the input field
  }, [selectedTyre]); // Re-run when the selected tyre changes

  const handleSelect = (tyre) => {
    onTyreSelected(tyre); // Inform parent about the chosen tyre so it can be stored
    const summary = `${tyre.make} ${tyre.size} ${tyre.load}${tyre.speed}`.trim(); // Build the summary string for the chosen tyre
    setQuery(summary); // Update the input with the chosen tyre summary
    setIsFocused(false); // Close the dropdown after a selection
  };

  const selectedDetails = useMemo(() => {
    if (!selectedTyre) {
      return null; // Do not render details when there is no tyre selected
    }
    return {
      make: selectedTyre.make,
      size: selectedTyre.size,
      load: selectedTyre.load,
      speed: selectedTyre.speed,
      costCompany: selectedTyre.cost_company ?? selectedTyre.costCompany ?? null,
      costCustomer: selectedTyre.cost_customer ?? selectedTyre.costCustomer ?? null,
      availability: selectedTyre.availability ?? "Unknown",
    }; // Normalise key names from placeholder data for rendering
  }, [selectedTyre]); // Recompute when the selected tyre changes

  return (
    <div
      style={{
        display: "flex", // Use flex layout for vertical alignment
        flexDirection: "column", // Stack children vertically
        gap: "12px", // Provide spacing between sections
        backgroundColor: palette.surface, // Match dashboard surface colour
        border: `1px solid ${palette.border}`, // Provide subtle border
        borderRadius: "16px", // Match rounded card styling
        padding: "16px", // Add internal spacing
        boxShadow: "none", // Apply soft for elevation
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color: palette.textPrimary }}>
          {contextLabel}
        </span>
        {(jobNumber || technicianName) && (
          <span style={{ fontSize: "12px", color: palette.textMuted }}>
            {jobNumber ? `Job ${jobNumber}` : ""}{jobNumber && technicianName ? " • " : ""}{technicianName || ""}
          </span>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: palette.textMuted, marginBottom: "6px" }}>
          Search Tyre
        </label>
        <input
          type="search"
          value={query}
          placeholder="Search by make, size, load, or speed"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 150);
          }}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid var(--search-surface-muted)",
            backgroundColor: "var(--search-surface)",
            fontSize: "14px",
            color: "var(--search-text)",
            boxShadow: "none",
            transition: "border-color 0.2s ease",
          }}
        />
        {isFocused && results.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              right: 0,
              backgroundColor: "var(--search-surface)",
              borderRadius: "12px",
              border: "1px solid var(--search-surface-muted)",
              boxShadow: "none",
              maxHeight: "220px",
              overflowY: "auto",
              zIndex: 30,
              color: "var(--search-text)",
            }}
          >
            {results.map((tyre) => (
              <button
                key={`${tyre.make}-${tyre.size}-${tyre.load}-${tyre.speed}`}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(tyre);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  padding: "12px 16px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.backgroundColor = "var(--search-surface-muted)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--search-text)" }}>
                  {`${tyre.make} ${tyre.size} ${tyre.load}${tyre.speed}`}
                </span>
                <span style={{ fontSize: "12px", color: "var(--search-text)" }}>
                  £{tyre.cost_company.toFixed(2)} company • £{tyre.cost_customer.toFixed(2)} customer • {tyre.availability}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedDetails && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px",
            padding: "12px",
            borderRadius: "12px",
            backgroundColor: "var(--surface-light)",
            border: "1px solid var(--surface-light)",
          }}
        >
          <DetailTile label="Make" value={selectedDetails.make} />
          <DetailTile label="Size" value={selectedDetails.size} />
          <DetailTile label="Load" value={selectedDetails.load} />
          <DetailTile label="Speed" value={selectedDetails.speed} />
          {selectedDetails.costCompany != null && (
            <DetailTile label="Cost to Company (£)" value={selectedDetails.costCompany.toFixed(2)} />
          )}
          {selectedDetails.costCustomer != null && (
            <DetailTile label="Cost to Customer (£)" value={selectedDetails.costCustomer.toFixed(2)} />
          )}
          <DetailTile label="Availability" value={selectedDetails.availability} />
        </div>
      )}
    </div>
  );
}

function DetailTile({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--danger)", fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--info-dark)" }}>{value || "-"}</span>
    </div>
  );
}
