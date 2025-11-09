// file location: src/components/VHC/WheelsHubsModal.js
import React, { useMemo, useState } from "react"; // Import React for modal composition
import themeConfig from "@/styles/appTheme"; // Use shared theme tokens for consistent styling
import TyresSection from "@/components/VHC/TyresSection"; // Reuse tyre search component for managers and technicians
import { getTyreDetails } from "@/lib/tyre/tyreAPI"; // Access placeholder tyre lookup helper

// 🔧 Temporary placeholder connection to tyreAPI.js
// TODO: Replace placeholder modal data with API call to process.env.TYRE_API_URL (.env.local)

const palette = themeConfig.palette; // Cache theme palette

export default function WheelsHubsModal({
  isOpen = false, // Control modal visibility
  job = null, // Current job data for context
  onClose = () => {}, // Close handler
  onTyreAssigned = () => {}, // Callback after ordering tyre
}) {
  const [selectedTyre, setSelectedTyre] = useState(null); // Track the tyre chosen inside the modal
  const [technician, setTechnician] = useState(job?.technician || ""); // Allow managers to note a technician

  const modalTitle = useMemo(() => {
    if (!job) {
      return "Order Tyre"; // Default title when no job is supplied
    }
    return `Order Tyre • Job ${job.jobNumber || job.id || "N/A"}`; // Build modal title with job reference
  }, [job]); // Recompute when job changes

  if (!isOpen) {
    return null; // Do not render the modal when it is not open
  }

  const handleTyreSelect = (tyre) => {
    const details = getTyreDetails(tyre.make, tyre.size, tyre.load, tyre.speed) || tyre; // Retrieve full tyre record from placeholder API
    setSelectedTyre(details); // Store the tyre so it can be displayed and ordered
  };

  const handleOrderTyre = () => {
    if (!selectedTyre) {
      window.alert("Please select a tyre before ordering (placeholder)."); // Inform the user that a tyre must be selected
      return;
    }

    console.log("Tyre ordered (placeholder)", {
      jobNumber: job?.jobNumber || job?.id,
      technician,
      tyre: selectedTyre,
    }); // Log placeholder payload for developers
    window.alert("Tyre ordered (placeholder)"); // Provide placeholder confirmation for the manager
    onTyreAssigned(job, selectedTyre); // Allow parent component to capture the ordered tyre with context
    onClose(); // Close the modal after ordering
  };

  return (
    <div
      style={{
        position: "fixed", // Overlay over the whole viewport
        inset: 0, // Stretch across the viewport
        backgroundColor: "rgba(15,23,42,0.45)", // Dim background behind modal
        display: "flex", // Use flexbox for centring
        alignItems: "center", // Vertically centre modal
        justifyContent: "center", // Horizontally centre modal
        zIndex: 1000, // Ensure modal sits on top of other UI
        padding: "24px", // Add padding around modal for smaller screens
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(780px, 100%)", // Limit modal width for readability
          maxHeight: "90vh", // Prevent overflow from exceeding viewport height
          overflowY: "auto", // Allow scrolling when content is tall
          backgroundColor: "#ffffff", // Use white modal background
          borderRadius: "20px", // Rounded modal corners
          boxShadow: "0 24px 60px rgba(15,23,42,0.25)", // Strong elevation shadow
          padding: "28px", // Internal padding for modal content
          display: "flex", // Use flex layout for vertical stacking
          flexDirection: "column", // Stack children vertically
          gap: "20px", // Space out content blocks
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: palette.textPrimary }}>{modalTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: palette.textMuted,
              fontSize: "14px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            backgroundColor: "#fff5f5",
            borderRadius: "14px",
            border: "1px solid #ffd6d6",
            padding: "16px",
          }}
        >
          <Detail label="Job Number" value={job?.jobNumber || job?.id || "N/A"} />
          <Detail label="Vehicle" value={job?.makeModel || job?.reg || "Unknown"} />
          <Detail label="Selected Technician" value={technician || "Not assigned"} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: palette.textMuted, marginBottom: "6px" }}>
            Selected Technician (optional)
          </label>
          <input
            type="text"
            value={technician}
            placeholder="Type technician name"
            onChange={(event) => setTechnician(event.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "12px",
              border: `1px solid ${palette.border}`,
              backgroundColor: "#fff",
              fontSize: "14px",
              color: palette.textPrimary,
            }}
          />
        </div>

        <TyresSection
          contextLabel="Tyre Lookup"
          selectedTyre={selectedTyre}
          onTyreSelected={handleTyreSelect}
          jobNumber={job?.jobNumber || job?.id || ""}
          technicianName={technician}
        />

        {selectedTyre && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "16px",
              border: `1px solid ${palette.border}`,
              borderRadius: "14px",
              padding: "16px",
              background: "#f9fafb",
            }}
          >
            <Detail label="Make" value={selectedTyre.make} />
            <Detail label="Size" value={selectedTyre.size} />
            <Detail label="Load" value={selectedTyre.load} />
            <Detail label="Speed" value={selectedTyre.speed} />
            <Detail label="Cost to Company (£)" value={selectedTyre.cost_company?.toFixed(2) ?? "-"} />
            <Detail label="Cost to Customer (£)" value={selectedTyre.cost_customer?.toFixed(2) ?? "-"} />
            <Detail label="Availability" value={selectedTyre.availability || "Unknown"} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              border: `1px solid ${palette.border}`,
              backgroundColor: "#fff",
              color: palette.textPrimary,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOrderTyre}
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: palette.accent,
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 18px 28px rgba(209,0,0,0.25)",
            }}
          >
            Order Tyre
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#b91c1c", fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>{value || "-"}</span>
    </div>
  );
}
