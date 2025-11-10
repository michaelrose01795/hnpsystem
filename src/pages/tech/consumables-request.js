// file location: src/pages/tech/consumables-request.js

"use client"; // Enable client-side interactivity for the form experience

import React, { useMemo, useState } from "react"; // Import React hooks for stateful UI
import Layout from "../../components/Layout"; // Import global layout wrapper
import { useUser } from "../../context/UserContext"; // Import user context for role-based permissions
import Link from "next/link"; // Import Next.js Link for navigation buttons

const pageWrapperStyle = {
  padding: "24px", // Provide comfortable outer spacing
  maxWidth: "1200px", // Limit page width for readability
  margin: "0 auto", // Center the page content
  display: "flex", // Use flex layout for main content columns
  flexDirection: "column", // Stack sections vertically
  gap: "24px", // Space sections evenly
};

const cardStyle = {
  backgroundColor: "#ffffff", // White card background for clarity
  borderRadius: "16px", // Rounded corners for modern design
  padding: "20px", // Interior spacing for content
  boxShadow: "0 18px 36px rgba(209,0,0,0.14)", // Soft red shadow to match brand
  border: "1px solid #ffe1e1", // Subtle red border accent
};

const inputStyle = {
  width: "100%", // Inputs fill available width
  padding: "10px 12px", // Comfortable padding for data entry
  borderRadius: "10px", // Rounded inputs consistent with cards
  border: "1px solid #ffb3b3", // Light red border accent
  fontSize: "0.95rem", // Legible input text size
};

const tableHeaderStyle = {
  textAlign: "left", // Left align headers for readability
  color: "#a00000", // On-brand header colour
  fontSize: "0.8rem", // Smaller uppercase header text
  textTransform: "uppercase", // Uppercase for header emphasis
  letterSpacing: "0.08em", // Add tracking to uppercase text
  padding: "8px", // Space around header labels
};

const statusBadgeStyles = {
  pending: {
    backgroundColor: "rgba(209,0,0,0.12)", // Pale red for pending requests
    color: "#a00000", // Deep red text colour
    border: "1px solid rgba(209,0,0,0.3)", // Border to define badge
  },
  urgent: {
    backgroundColor: "rgba(255,172,0,0.18)", // Amber background for urgent requests
    color: "#9a4b00", // Brown/orange text tone
    border: "1px solid rgba(255,172,0,0.38)", // Amber border accent
  },
  fulfilled: {
    backgroundColor: "rgba(0,176,112,0.15)", // Green background for completed requests
    color: "#006b44", // Deep green text tone
    border: "1px solid rgba(0,176,112,0.32)", // Green border accent
  },
};

function formatCurrency(value) {
  const numeric = Number(value) || 0; // Safely convert incoming value to number
  return `£${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; // Return formatted currency string
}

function TechConsumableRequestPage() {
  const { user } = useUser(); // Access current user information
  const userRoles = user?.roles?.map((role) => role.toLowerCase()) || []; // Normalise roles to lower case for checks
  const isTechRole = userRoles.includes("techs") || userRoles.includes("mot tester"); // Determine if page access should be granted

  const [requestForm, setRequestForm] = useState({
    partNumber: "", // Requested part number
    description: "", // Consumable description
    quantity: 1, // Requested quantity
    urgency: "normal", // Urgency selection
    supplier: "", // Preferred supplier if known
    unitCostEstimate: "", // Estimated unit cost for awareness
    justification: "", // Reason for request
  });

  const [requests, setRequests] = useState([
    {
      id: "REQ-1001", // Unique identifier for tracking
      partNumber: "WIP-001", // Example part number
      description: "Nitrile gloves - medium", // Consumable description
      quantity: 50, // Requested quantity
      urgency: "urgent", // Flag as urgent for buyer visibility
      supplier: "SafetyFirst UK", // Preferred supplier
      unitCostEstimate: 0.48, // Estimated unit cost
      justification: "Current stock will last less than 3 days based on current job load.", // Request justification
      status: "pending", // Workflow status
      requestedBy: "Example Tech", // Placeholder requester name
      requestedOn: "2024-03-04", // Request date
    },
  ]); // Example data to populate table immediately

  const [searchTerm, setSearchTerm] = useState(""); // Track request search input

  const filteredRequests = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase(); // Normalise search term
    if (!needle) return requests; // Return all requests when search is empty
    return requests.filter((request) =>
      [
        request.partNumber,
        request.description,
        request.supplier,
        request.status,
        request.requestedBy,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    ); // Perform case-insensitive search across key fields
  }, [requests, searchTerm]);

  const handleInputChange = (event) => {
    const { name, value } = event.target; // Extract the input field
    setRequestForm((previous) => ({ ...previous, [name]: value })); // Update the relevant form field
  };

  const handleSubmit = (event) => {
    event.preventDefault(); // Prevent page reload

    if (!requestForm.partNumber.trim() || !requestForm.description.trim()) {
      alert("Please provide a part number and description for the consumable."); // Validate key fields
      return; // Abort submission on validation failure
    }

    const newRequest = {
      id: `REQ-${Date.now()}`, // Generate simple unique identifier
      partNumber: requestForm.partNumber.trim(), // Clean part number
      description: requestForm.description.trim(), // Clean description
      quantity: Number(requestForm.quantity) || 1, // Parse quantity to number
      urgency: requestForm.urgency, // Persist urgency selection
      supplier: requestForm.supplier.trim(), // Clean supplier field
      unitCostEstimate: Number(requestForm.unitCostEstimate) || 0, // Parse unit cost estimate
      justification: requestForm.justification.trim(), // Clean justification text
      status: requestForm.urgency === "urgent" ? "urgent" : "pending", // Derive initial status from urgency
      requestedBy: user?.username || "Technician", // Use logged-in username
      requestedOn: new Date().toISOString().split("T")[0], // Store request date as ISO string
    }; // Construct the request payload

    setRequests((previous) => [newRequest, ...previous]); // Prepend new request to list

    setRequestForm({
      partNumber: "", // Reset form fields for next entry
      description: "",
      quantity: 1,
      urgency: "normal",
      supplier: "",
      unitCostEstimate: "",
      justification: "",
    }); // Clear the form state
  };

  if (!isTechRole) {
    return (
      <Layout>
        <div style={{ padding: "40px", maxWidth: "720px", margin: "0 auto" }}>
          <div style={{ ...cardStyle, textAlign: "center" }}>
            <h1 style={{ color: "#a00000", marginBottom: "16px" }}>
              Technician Access Only
            </h1>
            <p style={{ marginBottom: "16px", color: "#444" }}>
              This page is reserved for workshop technicians to request
              consumables. Please navigate back to your dashboard if this was in
              error.
            </p>
            <Link
              href="/dashboard"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: "999px",
                background: "linear-gradient(135deg, #d10000, #940000)",
                color: "#ffffff",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Return to dashboard
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={pageWrapperStyle}>
        <div style={{ ...cardStyle }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#b10000" }}>
                Request Workshop Consumables
              </h1>
              <p style={{ marginTop: "6px", color: "#666" }}>
                Submit consumable requirements to the workshop management team for
                purchasing and replenishment.
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#888" }}>
                Need help?
              </p>
              <Link
                href="/workshop/consumables-tracker"
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #d10000, #940000)",
                  color: "#ffffff",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View Tracker
              </Link>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="partNumber" style={{ fontWeight: 600, color: "#b10000" }}>
                Part Number
              </label>
              <input
                id="partNumber"
                name="partNumber"
                type="text"
                value={requestForm.partNumber}
                onChange={handleInputChange}
                placeholder="e.g. WIP-010"
                style={inputStyle}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="description" style={{ fontWeight: 600, color: "#b10000" }}>
                Item Description
              </label>
              <input
                id="description"
                name="description"
                type="text"
                value={requestForm.description}
                onChange={handleInputChange}
                placeholder="Consumable name"
                style={inputStyle}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="quantity" style={{ fontWeight: 600, color: "#b10000" }}>
                Quantity Needed
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                value={requestForm.quantity}
                onChange={handleInputChange}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="urgency" style={{ fontWeight: 600, color: "#b10000" }}>
                Urgency
              </label>
              <select
                id="urgency"
                name="urgency"
                value={requestForm.urgency}
                onChange={handleInputChange}
                style={{ ...inputStyle, backgroundColor: "#fff" }}
              >
                <option value="normal">Normal - add to next order</option>
                <option value="urgent">Urgent - required within 48 hours</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="supplier" style={{ fontWeight: 600, color: "#b10000" }}>
                Preferred Supplier
              </label>
              <input
                id="supplier"
                name="supplier"
                type="text"
                value={requestForm.supplier}
                onChange={handleInputChange}
                placeholder="Optional"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="unitCostEstimate" style={{ fontWeight: 600, color: "#b10000" }}>
                Estimated Unit Cost (£)
              </label>
              <input
                id="unitCostEstimate"
                name="unitCostEstimate"
                type="number"
                min="0"
                step="0.01"
                value={requestForm.unitCostEstimate}
                onChange={handleInputChange}
                style={inputStyle}
              />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="justification" style={{ fontWeight: 600, color: "#b10000" }}>
                Justification
              </label>
              <textarea
                id="justification"
                name="justification"
                rows={3}
                value={requestForm.justification}
                onChange={handleInputChange}
                placeholder="Explain why this consumable is needed"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                style={{
                  padding: "12px 20px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #d10000, #940000)",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 16px 28px rgba(209,0,0,0.24)",
                }}
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>

        <div style={{ ...cardStyle }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#b10000" }}>My Requests</h2>
            <input
              type="text"
              placeholder="Search requests"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              style={{ ...inputStyle, maxWidth: "240px" }}
            />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px" }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Part Number</th>
                  <th style={tableHeaderStyle}>Description</th>
                  <th style={tableHeaderStyle}>Quantity</th>
                  <th style={tableHeaderStyle}>Est. Unit Cost</th>
                  <th style={tableHeaderStyle}>Requested</th>
                  <th style={tableHeaderStyle}>Supplier</th>
                  <th style={tableHeaderStyle}>Justification</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id} style={{ background: "#fff7f7", borderRadius: "12px" }}>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          ...(statusBadgeStyles[request.status] || statusBadgeStyles.pending),
                        }}
                      >
                        {request.status === "fulfilled" ? "✅" : request.status === "urgent" ? "⏰" : "📦"}
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: "12px", fontWeight: 600, color: "#333" }}>{request.partNumber}</td>
                    <td style={{ padding: "12px", color: "#555" }}>{request.description}</td>
                    <td style={{ padding: "12px", color: "#555" }}>{request.quantity}</td>
                    <td style={{ padding: "12px", color: "#555" }}>{formatCurrency(request.unitCostEstimate)}</td>
                    <td style={{ padding: "12px", color: "#555" }}>{request.requestedOn}</td>
                    <td style={{ padding: "12px", color: "#555" }}>{request.supplier || "—"}</td>
                    <td style={{ padding: "12px", color: "#777", fontSize: "0.85rem" }}>{request.justification || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default TechConsumableRequestPage; // Export component for Next.js routing
