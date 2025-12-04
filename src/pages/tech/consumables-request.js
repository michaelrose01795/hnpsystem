// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/tech/consumables-request.js

"use client"; // Enable client-side interactivity for the form experience

import React, { useCallback, useEffect, useMemo, useState } from "react"; // Import React hooks for stateful UI
import Layout from "@/components/Layout"; // Import global layout wrapper
import { useUser } from "@/context/UserContext"; // Import user context for role-based permissions
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
  backgroundColor: "var(--surface)", // White card background for clarity
  borderRadius: "16px", // Rounded corners for modern design
  padding: "20px", // Interior spacing for content
  boxShadow: "0 18px 36px rgba(var(--primary-rgb),0.14)", // Soft red shadow to match brand
  border: "1px solid var(--surface-light)", // Subtle red border accent
};

const inputStyle = {
  width: "100%", // Inputs fill available width
  padding: "10px 12px", // Comfortable padding for data entry
  borderRadius: "10px", // Rounded inputs consistent with cards
  border: "1px solid var(--danger)", // Light red border accent
  fontSize: "0.95rem", // Legible input text size
};

const tableHeaderStyle = {
  textAlign: "left", // Left align headers for readability
  color: "var(--primary-dark)", // On-brand header colour
  fontSize: "0.8rem", // Smaller uppercase header text
  textTransform: "uppercase", // Uppercase for header emphasis
  letterSpacing: "0.08em", // Add tracking to uppercase text
  padding: "8px", // Space around header labels
};

const statusBadgeStyles = {
  pending: {
    backgroundColor: "rgba(var(--primary-rgb),0.12)", // Pale red for pending requests
    color: "var(--primary-dark)", // Deep red text colour
    border: "1px solid rgba(var(--primary-rgb),0.3)", // Border to define badge
  },
  urgent: {
    backgroundColor: "rgba(var(--warning-rgb), 0.18)", // Amber background for urgent requests
    color: "var(--warning-dark)", // Brown/orange text tone
    border: "1px solid rgba(var(--warning-rgb), 0.38)", // Amber border accent
  },
  fulfilled: {
    backgroundColor: "rgba(var(--success-rgb), 0.15)", // Green background for completed requests
    color: "var(--success-dark)", // Deep green text tone
    border: "1px solid rgba(var(--success-rgb), 0.32)", // Green border accent
  },
  ordered: {
    backgroundColor: "rgba(var(--success-rgb), 0.15)",
    color: "var(--success-dark)",
    border: "1px solid rgba(var(--success-rgb), 0.32)",
  },
};

const TechConsumableRequestPage = () => {
  const { user, dbUserId } = useUser(); // Access current user information
  const userRoles = user?.roles?.map((role) => role.toLowerCase()) || []; // Normalise roles to lower case for checks
  const isTechRole = userRoles.includes("techs") || userRoles.includes("mot tester"); // Determine if page access should be granted

  const [requestForm, setRequestForm] = useState({
    partName: "", // Requested item name
    quantity: 1, // Requested quantity
  });

  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState(""); // Track request search input

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    setRequestError("");

    try {
      const response = await fetch("/api/workshop/consumables/requests");
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Unable to load requests." }));
        throw new Error(body.message || "Unable to load requests.");
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to load requests.");
      }
      setRequests(payload.data || []);
    } catch (error) {
      console.error("❌ Failed to load consumable requests", error);
      setRequestError(error?.message || "Unable to load requests.");
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase(); // Normalise search term
    if (!needle) return requests; // Return all requests when search is empty
    return requests.filter((request) =>
      [request.itemName, request.status, request.requestedByName]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    ); // Perform case-insensitive search across key fields
  }, [requests, searchTerm]);

  const handleInputChange = (event) => {
    const { name, value } = event.target; // Extract the input field
    setRequestForm((previous) => ({ ...previous, [name]: value })); // Update the relevant form field
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!requestForm.partName.trim()) {
      alert("Please provide the name of the consumable you need.");
      return;
    }

    setSuccessMessage("");
    fetch("/api/workshop/consumables/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemName: requestForm.partName.trim(),
        quantity: Number(requestForm.quantity) || 1,
        requestedById: dbUserId,
        requestedByName: user?.username || null,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response
            .json()
            .catch(() => ({ message: "Unable to submit request." }));
          throw new Error(body.message || "Unable to submit request.");
        }
        return response.json();
      })
      .then((payload) => {
        if (!payload.success) {
          throw new Error(payload.message || "Unable to submit request.");
        }
        setRequestForm({ partName: "", quantity: 1 });
        setSuccessMessage("Request submitted.");
        fetchRequests();
      })
      .catch((error) => {
        console.error("❌ Failed to submit consumable request", error);
        alert(error?.message || "Unable to submit request.");
      });
  };

  if (!isTechRole) {
    return (
      <Layout>
        <div style={{ padding: "40px", maxWidth: "720px", margin: "0 auto" }}>
          <div style={{ ...cardStyle, textAlign: "center" }}>
            <h1 style={{ color: "var(--primary-dark)", marginBottom: "16px" }}>
              Technician Access Only
            </h1>
            <p style={{ marginBottom: "16px", color: "var(--grey-accent-dark)" }}>
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
                background: "var(--primary)",
                color: "var(--surface)",
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
              <h1 style={{ margin: 0, fontSize: "1.6rem", color: "var(--primary-dark)" }}>
                Request Workshop Consumables
              </h1>
              <p style={{ marginTop: "6px", color: "var(--grey-accent)" }}>
                Submit consumable requirements to the workshop management team for
                purchasing and replenishment.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", alignItems: "end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="partName" style={{ fontWeight: 600, color: "var(--primary-dark)" }}>
                Part Name
              </label>
              <input
                id="partName"
                name="partName"
                type="text"
                value={requestForm.partName}
                onChange={handleInputChange}
                placeholder="e.g. Nitrile gloves"
                style={inputStyle}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="quantity" style={{ fontWeight: 600, color: "var(--primary-dark)" }}>
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

            <div style={{ gridColumn: "span 1", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                style={{
                  padding: "12px 24px",
                  borderRadius: "12px",
                  border: "none",
                  background: "var(--primary)",
                  color: "var(--surface)",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 16px 28px rgba(var(--primary-rgb),0.24)",
                  width: "100%",
                }}
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>

        <div style={{ ...cardStyle }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary-dark)" }}>My Requests</h2>
            <input
              type="search"
              placeholder="Search requests"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              style={{
                ...inputStyle,
                maxWidth: "240px",
                backgroundColor: "var(--search-surface)",
                border: "1px solid var(--search-surface-muted)",
                color: "var(--search-text)",
              }}
            />
          </div>
          {successMessage && (
            <p style={{ margin: "0 0 12px", color: "var(--success-dark)" }}>{successMessage}</p>
          )}
          {requestError && (
            <p style={{ margin: "0 0 12px", color: "var(--primary-dark)" }}>{requestError}</p>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px" }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Part Name</th>
                  <th style={tableHeaderStyle}>Quantity</th>
                  <th style={tableHeaderStyle}>Requested</th>
                  <th style={tableHeaderStyle}>Requested By</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id} style={{ background: "var(--danger-surface)", borderRadius: "12px" }}>
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
                    <td style={{ padding: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>{request.itemName}</td>
                    <td style={{ padding: "12px", color: "var(--grey-accent-dark)" }}>{request.quantity}</td>
                    <td style={{ padding: "12px", color: "var(--grey-accent-dark)" }}>
                      {request.requestedAt
                        ? new Date(request.requestedAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td style={{ padding: "12px", color: "var(--grey-accent-dark)" }}>{request.requestedByName || "—"}</td>
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
