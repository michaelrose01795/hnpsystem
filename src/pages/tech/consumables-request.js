// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/tech/consumables-request.js

"use client"; // Enable client-side interactivity for the form experience

import React, { useCallback, useEffect, useMemo, useState } from "react"; // Import React hooks for stateful UI
import { useUser } from "@/context/UserContext"; // Import user context for role-based permissions
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import Link from "next/link"; // Import Next.js Link for navigation buttons
import StockCheckPopup from "@/components/Consumables/StockCheckPopup";
import { SearchBar } from "@/components/ui/searchBarAPI";
import useIsMobile from "@/hooks/useIsMobile";

const pageWrapperStyle = {
  width: "100%", // Fill the available content area like the news feed page
  maxWidth: "100%",
  minWidth: 0,
  padding: "8px 0",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const cardStyle = {
  backgroundColor: "var(--section-card-bg)",
  borderRadius: "var(--section-card-radius)",
  padding: "var(--section-card-padding)",
  border: "var(--section-card-border)",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "var(--control-radius)",
  border: "none",
  fontSize: "0.95rem",
};

const tableHeaderStyle = {
  textAlign: "left", // Left align headers for readability
  color: "var(--text-primary)", // High-contrast header colour for readability
  fontSize: "0.8rem", // Smaller uppercase header text
  textTransform: "uppercase", // Uppercase for header emphasis
  letterSpacing: "0.08em", // Add tracking to uppercase text
  padding: "8px", // Space around header labels
};

const fieldLabelStyle = {
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
};

const requestCardStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-subtle, rgba(15, 23, 42, 0.08))",
  background: "var(--surface)",
};

const requestCardMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
};

const statusBadgeStyles = {
  pending: {
    backgroundColor: "rgba(var(--primary-rgb),0.12)", // Pale red for pending requests
    color: "var(--primary-dark)", // Deep red text colour
    border: "none", // Border to define badge
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
  rejected: {
    backgroundColor: "rgba(var(--danger-rgb), 0.15)",
    color: "var(--danger)",
    border: "1px solid rgba(var(--danger-rgb), 0.32)",
  },
};

const TechConsumableRequestPage = () => {
  const { user, dbUserId } = useUser(); // Access current user information
  const isMobile = useIsMobile();
  const userRoles = user?.roles?.map((role) => role.toLowerCase()) || []; // Normalise roles to lower case for checks
  const isTechRole = userRoles.includes("techs") || userRoles.includes("mot tester"); // Determine if page access should be granted
  const isWorkshopManager = userRoles.includes("workshop manager") || userRoles.includes("workshop_manager");

  const [requestForm, setRequestForm] = useState({
    partName: "", // Requested item name
    quantity: 1, // Requested quantity
  });

  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState(""); // Track request search input
  const [showStockCheck, setShowStockCheck] = useState(false);
  const [stockItems, setStockItems] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState("");
  const [addingTemporaryItem, setAddingTemporaryItem] = useState(false);

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

  const fetchStockItems = useCallback(async () => {
    setStockLoading(true);
    setStockError("");
    try {
      const response = await fetch("/api/workshop/consumables/stock-check");
      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: "Unable to load stock items." }));
        throw new Error(body.message || "Unable to load stock items.");
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to load stock items.");
      }
      const locations = payload.data?.locations || [];
      const unassigned = payload.data?.unassigned || [];
      const flattened = [];
      locations.forEach((location) => {
        (location.consumables || []).forEach((item) => {
          flattened.push({ id: item.id, name: item.name || "Unnamed item" });
        });
      });
      (unassigned || []).forEach((item) => {
        flattened.push({ id: item.id, name: item.name || "Unnamed item" });
      });
      setStockItems(flattened);
    } catch (error) {
      console.error("❌ Failed to load stock items", error);
      setStockItems([]);
      setStockError(error?.message || "Unable to load stock items.");
    } finally {
      setStockLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockItems();
  }, [fetchStockItems]);

  const normalizeName = useCallback((value = "") => value.trim().toLowerCase(), []);

  const findStockItemByName = useCallback(
    (name) => {
      const target = normalizeName(name);
      if (!target) {
        return null;
      }
      return stockItems.find((item) => normalizeName(item.name) === target) || null;
    },
    [stockItems, normalizeName]
  );

  const filteredRequests = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase(); // Normalise search term
    if (!needle) return requests; // Return all requests when search is empty
    return requests.filter((request) =>
      [request.itemName, request.status, request.requestedByName]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    ); // Perform case-insensitive search across key fields
  }, [requests, searchTerm]);

  const requestPanelStyle = useMemo(
    () => ({
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      flexWrap: "wrap",
      alignItems: isMobile ? "stretch" : "end",
      gap: isMobile ? "14px" : "16px",
      padding: isMobile ? "16px" : undefined,
    }),
    [isMobile]
  );

  const requestHeaderStyle = useMemo(
    () => ({
      display: "flex",
      justifyContent: "space-between",
      alignItems: isMobile ? "stretch" : "center",
      flexDirection: isMobile ? "column" : "row",
      gap: isMobile ? "12px" : "16px",
      flex: isMobile ? "1 1 auto" : "0 0 auto",
      minWidth: isMobile ? 0 : "140px",
      width: isMobile ? "100%" : "auto",
    }),
    [isMobile]
  );

  const requestFormStyle = useMemo(
    () => ({
      flex: "1 1 720px",
      marginTop: 0,
      display: "grid",
      gridTemplateColumns: isMobile
        ? "minmax(0, 1fr)"
        : "minmax(280px, 1fr) minmax(140px, 180px) minmax(180px, 220px)",
      gap: isMobile ? "12px" : "16px",
      alignItems: "end",
      width: "100%",
    }),
    [isMobile]
  );

  const requestsToolbarStyle = useMemo(
    () => ({
      display: "flex",
      justifyContent: "space-between",
      alignItems: isMobile ? "stretch" : "center",
      flexDirection: isMobile ? "column" : "row",
      gap: isMobile ? "12px" : "16px",
      marginBottom: "16px",
    }),
    [isMobile]
  );

  const stockMatches = useMemo(() => {
    const query = normalizeName(requestForm.partName);
    if (!query) {
      return [];
    }
    return stockItems
      .filter((item) => normalizeName(item.name).includes(query))
      .slice(0, 5);
  }, [requestForm.partName, stockItems, normalizeName]);

  const createTemporaryStockItem = useCallback(
    async (name) => {
      const trimmed = (name || "").trim();
      if (!trimmed || findStockItemByName(trimmed)) {
        return;
      }
      setAddingTemporaryItem(true);
      setRequestError("");
      try {
        const response = await fetch("/api/workshop/consumables/stock-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "addTemporary", items: [trimmed] }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({ message: "Unable to add consumable." }));
          throw new Error(body.message || "Unable to add consumable.");
        }
        const payload = await response.json();
        if (!payload.success) {
          throw new Error(payload.message || "Unable to add consumable.");
        }
        await fetchStockItems();
        setSuccessMessage(`"${trimmed}" added to consumable stock for review.`);
      } catch (error) {
        console.error("❌ Failed to add temporary consumable", error);
        setRequestError(error?.message || "Unable to add consumable to stock.");
        throw error;
      } finally {
        setAddingTemporaryItem(false);
      }
    },
    [findStockItemByName, fetchStockItems]
  );

  const handleInputChange = (event) => {
    const { name, value } = event.target; // Extract the input field
    setRequestForm((previous) => ({ ...previous, [name]: value })); // Update the relevant form field
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedName = requestForm.partName.trim();
    if (!trimmedName) {
      alert("Please provide the name of the consumable you need.");
      return;
    }

    try {
      if (!findStockItemByName(trimmedName)) {
        await createTemporaryStockItem(trimmedName);
      }
    } catch {
      return;
    }

    setSuccessMessage("");
    try {
      const response = await fetch("/api/workshop/consumables/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: trimmedName,
          quantity: Number(requestForm.quantity) || 1,
          requestedById: dbUserId,
          requestedByName: user?.username || null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: "Unable to submit request." }));
        throw new Error(body.message || "Unable to submit request.");
      }

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to submit request.");
      }
      setRequestForm({ partName: "", quantity: 1 });
      setSuccessMessage("Request submitted.");
      fetchRequests();
    } catch (error) {
      console.error("❌ Failed to submit consumable request", error);
      alert(error?.message || "Unable to submit request.");
    }
  };

  if (!isTechRole && !isWorkshopManager) {
    return (
      <>
        <DevLayoutSection
          sectionKey="tech-consumables-access-shell"
          sectionType="page-shell"
          shell
          widthMode="page"
          style={{ padding: "40px", maxWidth: "720px", margin: "0 auto" }}
        >
          <DevLayoutSection
            as="section"
            sectionKey="tech-consumables-access-card"
            parentKey="tech-consumables-access-shell"
            sectionType="content-card"
            backgroundToken="surface"
            style={{ ...cardStyle, textAlign: "center" }}
          >
            <h1 style={{ color: "var(--primary-dark)", marginBottom: "16px" }}>
              Technician Access Only
            </h1>
            <p style={{ marginBottom: "16px", color: "var(--grey-accent-dark)" }}>
              This page is reserved for workshop technicians to request
              consumables. Please navigate back to your dashboard if this was in
              error.
            </p>
            <DevLayoutSection
              as="div"
              sectionKey="tech-consumables-access-action"
              parentKey="tech-consumables-access-card"
              sectionType="floating-action"
              backgroundToken="transparent"
            >
              <Link
                href="/dashboard"
                style={{
                  display: "inline-block",
                  padding: "var(--control-padding)",
                  borderRadius: "var(--control-radius)",
                  background: "var(--primary)",
                  color: "var(--surface)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Return to dashboard
              </Link>
            </DevLayoutSection>
          </DevLayoutSection>
        </DevLayoutSection>
      </>
    );
  }

  return (
    <>
      <div style={pageWrapperStyle}>
        <DevLayoutSection
          as="section"
          sectionKey="tech-consumables-request-panel"
          sectionType="content-card"
          backgroundToken="accent"
          className="app-layout-surface-accent"
          style={requestPanelStyle}
        >
          <DevLayoutSection
            as="div"
            sectionKey="tech-consumables-request-header"
            parentKey="tech-consumables-request-panel"
            sectionType="section-header-row"
            backgroundToken="transparent"
            style={requestHeaderStyle}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: "1.6rem", color: "var(--primary-dark)" }}></h1>
            </div>
            <DevLayoutSection
              as="div"
              sectionKey="tech-consumables-stock-check-action"
              parentKey="tech-consumables-request-header"
              sectionType="floating-action"
              backgroundToken="transparent"
            >
              <button
                type="button"
                onClick={() => setShowStockCheck(true)}
                style={{
                  padding: "var(--control-padding)",
                  borderRadius: "var(--control-radius)",
                  border: "1px solid var(--primary)",
                  background: "var(--surface)",
                  color: "var(--primary-dark)",
                  fontWeight: 600,
                  cursor: "pointer",
                  width: isMobile ? "100%" : "auto",
                }}
              >
                Stock Check
              </button>
            </DevLayoutSection>
          </DevLayoutSection>

          <DevLayoutSection
            as="form"
            sectionKey="tech-consumables-request-form"
            parentKey="tech-consumables-request-panel"
            sectionType="form-grid"
            backgroundToken="transparent"
            onSubmit={handleSubmit}
            style={requestFormStyle}
          >
            <DevLayoutSection
              as="div"
              sectionKey="tech-consumables-item-field"
              parentKey="tech-consumables-request-form"
              sectionType="form-block"
              backgroundToken="surface"
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label htmlFor="partName" style={fieldLabelStyle}>
                Consumable
              </label>
              <input
                id="partName"
                name="partName"
                type="text"
                aria-label="Part Name"
                value={requestForm.partName}
                onChange={handleInputChange}
                placeholder="e.g. Nitrile gloves"
                style={inputStyle}
                required
              />
              {requestForm.partName.trim() && (
                <DevLayoutSection
                  as="div"
                  sectionKey="tech-consumables-stock-suggestions"
                  parentKey="tech-consumables-item-field"
                  sectionType="content-card"
                  backgroundToken="surface-light"
                  style={{ marginTop: "4px", border: "none", borderRadius: "var(--control-radius)", padding: "8px", background: "var(--surface-lightest)", display: "flex", flexDirection: "column", gap: "6px" }}
                >
                  {stockLoading ? (
                    <span style={{ color: "var(--grey-accent-dark)", fontSize: "0.85rem" }}>Searching stock…</span>
                  ) : stockMatches.length > 0 ? (
                    <>
                      <span style={{ color: "var(--grey-accent-dark)", fontSize: "0.8rem" }}>Matching stock items:</span>
                      <div
                        data-dev-section="1"
                        data-dev-section-key="tech-consumables-stock-suggestion-list"
                        data-dev-section-type="list"
                        data-dev-section-parent="tech-consumables-stock-suggestions"
                        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
                      >
                        {stockMatches.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setRequestForm((previous) => ({ ...previous, partName: item.name }))}
                            style={{
                              textAlign: "left",
                              border: "none",
                              borderRadius: "var(--control-radius)",
                              padding: "6px 10px",
                              background: "var(--surface)",
                              cursor: "pointer",
                              fontSize: "0.9rem",
                              color: "var(--primary-dark)",
                            }}
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: "var(--grey-accent-dark)", fontSize: "0.85rem" }}>
                      No matching stock items. Create a temporary entry below.
                    </span>
                  )}
                  {requestForm.partName.trim() && !stockLoading && !findStockItemByName(requestForm.partName) && (
                    <button
                      type="button"
                      onClick={() => createTemporaryStockItem(requestForm.partName.trim())}
                      disabled={addingTemporaryItem}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "var(--control-radius)",
                        border: "1px solid var(--primary)",
                        background: addingTemporaryItem ? "rgba(var(--primary-rgb),0.35)" : "var(--surface)",
                        color: "var(--primary-dark)",
                        fontWeight: 600,
                        cursor: addingTemporaryItem ? "not-allowed" : "pointer",
                        alignSelf: "flex-start",
                      }}
                    >
                      {addingTemporaryItem ? "Adding…" : `Add "${requestForm.partName.trim()}" to stock`}
                    </button>
                  )}
                  {stockError && (
                    <span style={{ color: "var(--primary-dark)", fontSize: "0.8rem" }}>{stockError}</span>
                  )}
                </DevLayoutSection>
              )}
            </DevLayoutSection>

            <DevLayoutSection
              as="div"
              sectionKey="tech-consumables-quantity-field"
              parentKey="tech-consumables-request-form"
              sectionType="form-block"
              backgroundToken="surface"
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <label htmlFor="quantity" style={fieldLabelStyle}>
                Quantity
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                aria-label="Quantity Needed"
                min="1"
                step="1"
                value={requestForm.quantity}
                onChange={handleInputChange}
                style={inputStyle}
              />
            </DevLayoutSection>

            <DevLayoutSection
              as="div"
              sectionKey="tech-consumables-submit-action"
              parentKey="tech-consumables-request-form"
              sectionType="toolbar"
              backgroundToken="transparent"
              style={{ gridColumn: "span 1", display: "flex", justifyContent: "flex-end" }}
            >
              <button
                type="submit"
                style={{
                  padding: "var(--control-padding)",
                  borderRadius: "var(--control-radius)",
                  border: "none",
                  background: "var(--primary)",
                  color: "var(--surface)",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "none",
                  width: "100%",
                }}
              >
                Submit Request
              </button>
            </DevLayoutSection>
          </DevLayoutSection>
        </DevLayoutSection>

        <DevLayoutSection
          as="section"
          sectionKey="tech-consumables-requests-panel"
          sectionType="section-shell"
          shell
          backgroundToken="accent"
          className="app-layout-surface-accent"
        >
          <DevLayoutSection
            as="div"
            sectionKey="tech-consumables-requests-toolbar"
            parentKey="tech-consumables-requests-panel"
            sectionType="toolbar"
            backgroundToken="transparent"
            style={requestsToolbarStyle}
          >
            <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary-dark)" }}>Requests</h2>
            <DevLayoutSection
              as="div"
              sectionKey="tech-consumables-requests-search"
              parentKey="tech-consumables-requests-toolbar"
              sectionType="filter-row"
              backgroundToken="search-surface"
              style={{ maxWidth: isMobile ? "100%" : "240px", width: "100%" }}
            >
              <SearchBar
                placeholder="Search requests"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onClear={() => setSearchTerm("")}
                style={{
                  maxWidth: isMobile ? "100%" : "240px",
                }}
              />
            </DevLayoutSection>
          </DevLayoutSection>
          {successMessage && (
            <DevLayoutSection
              as="p"
              sectionKey="tech-consumables-success-banner"
              parentKey="tech-consumables-requests-panel"
              sectionType="state-banner"
              backgroundToken="success-surface"
              style={{ margin: "0 0 12px", color: "var(--success-dark)" }}
            >
              {successMessage}
            </DevLayoutSection>
          )}
          {requestError && (
            <DevLayoutSection
              as="p"
              sectionKey="tech-consumables-error-banner"
              parentKey="tech-consumables-requests-panel"
              sectionType="state-banner"
              backgroundToken="danger-surface"
              style={{ margin: "0 0 12px", color: "var(--primary-dark)" }}
            >
              {requestError}
            </DevLayoutSection>
          )}

          {isMobile ? (
            <DevLayoutSection
              as="div"
              sectionKey="tech-consumables-request-mobile-list"
              parentKey="tech-consumables-requests-panel"
              sectionType="list"
              backgroundToken="surface"
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {loadingRequests ? (
                <div style={{ ...requestCardStyle, textAlign: "center", color: "var(--text-secondary)" }}>
                  Loading requests…
                </div>
              ) : filteredRequests.length > 0 ? (
                filteredRequests.map((request) => (
                  <article
                    key={request.id}
                    data-dev-section="1"
                    data-dev-section-key={`tech-consumables-request-mobile-card-${request.id}`}
                    data-dev-section-type="content-card"
                    data-dev-section-parent="tech-consumables-request-mobile-list"
                    style={requestCardStyle}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-word" }}>
                          {request.itemName}
                        </div>
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          borderRadius: "var(--radius-pill)",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          whiteSpace: "nowrap",
                          ...(statusBadgeStyles[request.status] || statusBadgeStyles.pending),
                        }}
                      >
                        {request.status === "fulfilled"
                          ? "✅"
                          : request.status === "urgent"
                          ? "⏰"
                          : request.status === "rejected"
                          ? "✖️"
                          : request.status === "ordered"
                          ? "📦"
                          : "📦"}
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </div>
                    <div style={requestCardMetaGridStyle}>
                      <div style={{ minWidth: 0 }}>
                        <div style={fieldLabelStyle}>Quantity</div>
                        <div style={{ marginTop: "4px", color: "var(--text-primary)", fontWeight: 600 }}>
                          {request.quantity}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={fieldLabelStyle}>Requested</div>
                        <div style={{ marginTop: "4px", color: "var(--text-secondary)" }}>
                          {request.requestedAt
                            ? new Date(request.requestedAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </div>
                      </div>
                      <div style={{ gridColumn: "1 / -1", minWidth: 0 }}>
                        <div style={fieldLabelStyle}>Requested By</div>
                        <div style={{ marginTop: "4px", color: "var(--text-secondary)", wordBreak: "break-word" }}>
                          {request.requestedByName || "—"}
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div style={{ ...requestCardStyle, textAlign: "center", color: "var(--text-secondary)" }}>
                  No consumable requests match the current filter.
                </div>
              )}
            </DevLayoutSection>
          ) : (
            <DevLayoutSection
              as="div"
              sectionKey="tech-consumables-request-auto-data-table-1-shell"
              parentKey="tech-consumables-requests-panel"
              sectionType="data-table-shell"
              backgroundToken="surface"
              className="app-section-card"
              style={{ overflowX: "auto", maxHeight: "420px", overflowY: "auto", padding: 0, background: "var(--surface)" }}
            >
              <DevLayoutSection
                as="table"
                sectionKey="tech-consumables-request-auto-data-table-1"
                parentKey="tech-consumables-request-auto-data-table-1-shell"
                sectionType="data-table"
                backgroundToken="surface"
                className="app-data-table"
                style={{ minWidth: "640px", background: "var(--surface)" }}
              >
                <thead
                  data-dev-section="1"
                  data-dev-section-key="tech-consumables-request-auto-data-table-1-headings"
                  data-dev-section-type="table-headings"
                  data-dev-section-parent="tech-consumables-request-auto-data-table-1"
                  style={{ background: "var(--accent-surface-hover)" }}
                >
                  <tr>
                    <th style={tableHeaderStyle}>Status</th>
                    <th style={tableHeaderStyle}>Part Name</th>
                    <th style={tableHeaderStyle}>Quantity</th>
                    <th style={tableHeaderStyle}>Requested</th>
                    <th style={tableHeaderStyle}>Requested By</th>
                  </tr>
                </thead>
                <tbody
                  data-dev-section="1"
                  data-dev-section-key="tech-consumables-request-auto-data-table-1-rows"
                  data-dev-section-type="table-rows"
                  data-dev-section-parent="tech-consumables-request-auto-data-table-1"
                >
                  {loadingRequests ? (
                    <tr
                      data-dev-section="1"
                      data-dev-section-key="tech-consumables-requests-loading-row"
                      data-dev-section-type="state-banner"
                      data-dev-section-parent="tech-consumables-request-auto-data-table-1-rows"
                      style={{ background: "var(--surface)" }}
                    >
                      <td colSpan={5} style={{ padding: "18px 12px", color: "var(--text-secondary)", textAlign: "center" }}>
                        Loading requests…
                      </td>
                    </tr>
                  ) : filteredRequests.length > 0 ? (
                    filteredRequests.map((request) => (
                      <tr
                        key={request.id}
                        data-dev-section="1"
                        data-dev-section-key={`tech-consumables-request-auto-data-table-1-row-${request.id}`}
                        data-dev-section-type="table-row"
                        data-dev-section-parent="tech-consumables-request-auto-data-table-1-rows"
                        style={{ background: "var(--surface)" }}
                      >
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 10px",
                              borderRadius: "var(--radius-pill)",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              ...(statusBadgeStyles[request.status] || statusBadgeStyles.pending),
                            }}
                          >
                            {request.status === "fulfilled"
                              ? "✅"
                              : request.status === "urgent"
                              ? "⏰"
                              : request.status === "rejected"
                              ? "✖️"
                              : request.status === "ordered"
                              ? "📦"
                              : "📦"}
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td style={{ padding: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{request.itemName}</td>
                        <td style={{ padding: "12px", color: "var(--text-secondary)" }}>{request.quantity}</td>
                        <td style={{ padding: "12px", color: "var(--text-secondary)" }}>
                          {request.requestedAt
                            ? new Date(request.requestedAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td style={{ padding: "12px", color: "var(--text-secondary)" }}>{request.requestedByName || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr
                      data-dev-section="1"
                      data-dev-section-key="tech-consumables-requests-empty-row"
                      data-dev-section-type="empty-state"
                      data-dev-section-parent="tech-consumables-request-auto-data-table-1-rows"
                      style={{ background: "var(--surface)" }}
                    >
                      <td colSpan={5} style={{ padding: "18px 12px", color: "var(--text-secondary)", textAlign: "center" }}>
                        No consumable requests match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </DevLayoutSection>
            </DevLayoutSection>
          )}
        </DevLayoutSection>
      </div>
      {showStockCheck && (
        <StockCheckPopup
          open={showStockCheck}
          onClose={() => setShowStockCheck(false)}
          isManager={isWorkshopManager}
          technicianId={dbUserId}
          onRequestsSubmitted={fetchRequests}
        />
      )}
    </>
  );
}

export default TechConsumableRequestPage; // Export component for Next.js routing
