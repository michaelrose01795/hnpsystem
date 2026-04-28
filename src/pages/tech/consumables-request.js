// file location: src/pages/tech/consumables-request.js
// ✅ Imports converted to use absolute alias "@/"

"use client"; // Enable client-side interactivity for the form experience

import React, { useCallback, useEffect, useMemo, useState } from "react"; // Import React hooks for stateful UI
import { useUser } from "@/context/UserContext"; // Import user context for role-based permissions
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import Link from "next/link"; // Import Next.js Link for navigation buttons
import StockCheckPopup from "@/components/Consumables/StockCheckPopup";
import { SearchBar } from "@/components/ui/searchBarAPI";
import useIsMobile from "@/hooks/useIsMobile";
import TechConsumableRequestPageUi from "@/components/page-ui/tech/tech-consumables-request-ui"; // Extracted presentation layer.

const pageWrapperStyle = {
  width: "100%", // Fill the available content area like the news feed page
  maxWidth: "100%",
  minWidth: 0,
  padding: "8px 0",
  display: "flex",
  flexDirection: "column",
  gap: "20px"
};

const cardStyle = {
  backgroundColor: "var(--section-card-bg)",
  borderRadius: "var(--section-card-radius)",
  padding: "var(--section-card-padding)",
  border: "var(--section-card-border)"
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "var(--control-radius)",
  border: "none",
  fontSize: "0.95rem"
};

const tableHeaderStyle = {
  textAlign: "left", // Left align headers for readability
  color: "var(--text-primary)", // High-contrast header colour for readability
  fontSize: "0.8rem", // Smaller uppercase header text
  textTransform: "uppercase", // Uppercase for header emphasis
  letterSpacing: "0.08em", // Add tracking to uppercase text
  padding: "8px" // Space around header labels
};

const fieldLabelStyle = {
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-secondary)"
};

const requestCardStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-subtle, rgba(15, 23, 42, 0.08))",
  background: "var(--surface)"
};

const requestCardMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
};

const statusBadgeStyles = {
  pending: {
    backgroundColor: "rgba(var(--primary-rgb),0.12)", // Pale red for pending requests
    color: "var(--primary-dark)", // Deep red text colour
    border: "none" // Border to define badge
  },
  urgent: {
    backgroundColor: "rgba(var(--warning-rgb), 0.18)", // Amber background for urgent requests
    color: "var(--warning-dark)", // Brown/orange text tone
    border: "none" // Amber border accent
  },
  fulfilled: {
    backgroundColor: "rgba(var(--success-rgb), 0.15)", // Green background for completed requests
    color: "var(--success-dark)", // Deep green text tone
    border: "none" // Green border accent
  },
  ordered: {
    backgroundColor: "rgba(var(--success-rgb), 0.15)",
    color: "var(--success-dark)",
    border: "none"
  },
  rejected: {
    backgroundColor: "rgba(var(--danger-rgb), 0.15)",
    color: "var(--danger)",
    border: "none"
  }
};

const TechConsumableRequestPage = () => {
  const { user, dbUserId } = useUser(); // Access current user information
  const isMobile = useIsMobile();
  const userRoles = user?.roles?.map((role) => role.toLowerCase()) || []; // Normalise roles to lower case for checks
  const isTechRole = userRoles.includes("techs") || userRoles.includes("mot tester"); // Determine if page access should be granted
  const isWorkshopManager = userRoles.includes("workshop manager") || userRoles.includes("workshop_manager");

  const [requestForm, setRequestForm] = useState({
    partName: "", // Requested item name
    quantity: 1 // Requested quantity
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
        const body = await response.
        json().
        catch(() => ({ message: "Unable to load requests." }));
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
    [request.itemName, request.status, request.requestedByName].
    filter(Boolean).
    some((field) => field.toLowerCase().includes(needle))
    ); // Perform case-insensitive search across key fields
  }, [requests, searchTerm]);

  const requestPanelStyle = useMemo(
    () => ({
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      flexWrap: "wrap",
      alignItems: isMobile ? "stretch" : "end",
      gap: isMobile ? "14px" : "16px",
      padding: isMobile ? "16px" : undefined
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
      width: isMobile ? "100%" : "auto"
    }),
    [isMobile]
  );

  const requestFormStyle = useMemo(
    () => ({
      flex: "1 1 720px",
      marginTop: 0,
      display: "grid",
      gridTemplateColumns: isMobile ?
      "minmax(0, 1fr)" :
      "minmax(280px, 1fr) minmax(140px, 180px) minmax(180px, 220px)",
      gap: isMobile ? "12px" : "16px",
      alignItems: "end",
      width: "100%"
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
      marginBottom: "16px"
    }),
    [isMobile]
  );

  const stockMatches = useMemo(() => {
    const query = normalizeName(requestForm.partName);
    if (!query) {
      return [];
    }
    return stockItems.
    filter((item) => normalizeName(item.name).includes(query)).
    slice(0, 5);
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
          body: JSON.stringify({ action: "addTemporary", items: [trimmed] })
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
          requestedByName: user?.username || null
        })
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
    return <TechConsumableRequestPageUi view="section1" cardStyle={cardStyle} DevLayoutSection={DevLayoutSection} Link={Link} />;


















































  }

  return <TechConsumableRequestPageUi view="section2" addingTemporaryItem={addingTemporaryItem} createTemporaryStockItem={createTemporaryStockItem} dbUserId={dbUserId} DevLayoutSection={DevLayoutSection} fetchRequests={fetchRequests} fieldLabelStyle={fieldLabelStyle} filteredRequests={filteredRequests} findStockItemByName={findStockItemByName} handleInputChange={handleInputChange} handleSubmit={handleSubmit} inputStyle={inputStyle} isMobile={isMobile} isWorkshopManager={isWorkshopManager} loadingRequests={loadingRequests} pageWrapperStyle={pageWrapperStyle} requestCardMetaGridStyle={requestCardMetaGridStyle} requestCardStyle={requestCardStyle} requestError={requestError} requestForm={requestForm} requestFormStyle={requestFormStyle} requestHeaderStyle={requestHeaderStyle} requestPanelStyle={requestPanelStyle} requestsToolbarStyle={requestsToolbarStyle} SearchBar={SearchBar} searchTerm={searchTerm} setRequestForm={setRequestForm} setSearchTerm={setSearchTerm} setShowStockCheck={setShowStockCheck} showStockCheck={showStockCheck} statusBadgeStyles={statusBadgeStyles} StockCheckPopup={StockCheckPopup} stockError={stockError} stockLoading={stockLoading} stockMatches={stockMatches} successMessage={successMessage} tableHeaderStyle={tableHeaderStyle} />;



































































































































































































































































































































































































































































































};

export default TechConsumableRequestPage; // Export component for Next.js routing
