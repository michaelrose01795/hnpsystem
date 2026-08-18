// file location: src/pages/tech/consumables-request.js
// ✅ Imports converted to use absolute alias "@/"

"use client"; // Enable client-side interactivity for the form experience

import React, { useCallback, useEffect, useMemo, useState } from "react"; // Import React hooks for stateful UI
import { useUser } from "@/context/UserContext"; // Import user context for role-based permissions
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import Link from "next/link"; // Import Next.js Link for navigation buttons
import { SearchBar } from "@/components/ui/searchBarAPI";
import useIsMobile from "@/hooks/useIsMobile";
import TechConsumableRequestPageUi from "@/components/page-ui/tech/tech-consumables-request-ui"; // Extracted presentation layer.

const flattenStockData = (payloadData = {}) => {
  const locatedItems = (payloadData.locations || []).flatMap((location) =>
    (location.consumables || []).map((item) => ({
      id: item.id,
      name: item.name || "Unnamed item"
    }))
  );
  const unassignedItems = (payloadData.unassigned || []).map((item) => ({
    id: item.id,
    name: item.name || "Unnamed item"
  }));
  return locatedItems.concat(unassignedItems);
};

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
  textAlign: "center"
};

const tableHeaderStyle = {
  textAlign: "left", // Left align headers for readability
  color: "var(--text-1)", // High-contrast header colour for readability
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
  color: "var(--text-1)"
};

const requestCardStyle = {
  color: "var(--text-1)"
};

const requestCardMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
};

const statusBadgeStyles = {
  pending: {
    backgroundColor: "rgba(var(--primary-rgb),0.12)", // Pale red for pending requests
    color: "var(--primary-selected)", // Deep red text colour
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
  arrived: {
    backgroundColor: "var(--success-surface)",
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
    partName: "" // Stock search input
  });
  const [selectedStockItems, setSelectedStockItems] = useState([]);
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [showStockList, setShowStockList] = useState(false);
  const [showSendPopup, setShowSendPopup] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState("");

  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState(""); // Track request search input
  const [stockItems, setStockItems] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState("");
  const [addingTemporaryItem, setAddingTemporaryItem] = useState(false);
  const [requestMonth, setRequestMonth] = useState("");

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
      const flattened = flattenStockData(payload.data);
      setStockItems(flattened);
      return flattened;
    } catch (error) {
      console.error("❌ Failed to load stock items", error);
      setStockItems([]);
      setStockError(error?.message || "Unable to load stock items.");
      return [];
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

  const addStockItemToSelection = useCallback((item) => {
    if (!item?.id) return;
    setSelectedStockItems((previous) => {
      if (previous.some((selectedItem) => selectedItem.id === item.id)) {
        return previous;
      }
      return previous.concat({
        id: item.id,
        name: item.name || "Unnamed item",
        quantity: 1
      });
    });
  }, []);

  const removeSelectedStockItem = useCallback((itemId) => {
    setSelectedStockItems((previous) => previous.filter((item) => item.id !== itemId));
  }, []);

  const updateSelectedStockQuantity = useCallback((itemId, value) => {
    const parsedQuantity = Number.parseInt(value, 10);
    const quantity = Math.min(999, Math.max(1, Number.isFinite(parsedQuantity) ? parsedQuantity : 1));
    setSelectedStockItems((previous) => previous.map((item) =>
      item.id === itemId ? { ...item, quantity } : item
    ));
  }, []);

  const filteredRequests = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase(); // Normalise search term
    return requests.filter((request) =>
    (!requestMonth || (request.requestedAt && request.requestedAt.slice(0, 7) === requestMonth)) &&
    (!needle || [request.itemName, request.status, request.requestedByName].
      filter(Boolean).
      some((field) => field.toLowerCase().includes(needle)))
    ); // Perform case-insensitive search across key fields
  }, [requestMonth, requests, searchTerm]);

  const requestPanelStyle = useMemo(
    () => ({
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: isMobile ? "14px" : "16px",
      width: "100%",
      padding: isMobile ? "16px" : undefined
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
    slice(0, 8);
  }, [requestForm.partName, stockItems, normalizeName]);

  const visibleStockItems = useMemo(() => {
    const query = normalizeName(stockSearchQuery);
    if (!showStockList) return [];
    if (!query) return stockItems;
    return stockItems.filter((item) => normalizeName(item.name).includes(query));
  }, [normalizeName, showStockList, stockItems, stockSearchQuery]);

  const applyStockSearch = useCallback(() => {
    setStockSearchQuery(requestForm.partName.trim());
    setShowStockList(true);
  }, [requestForm.partName]);

  const clearStockSearch = useCallback(() => {
    setRequestForm({ partName: "" });
    setStockSearchQuery("");
  }, []);

  const handleStockSearchKeyDown = useCallback((event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyStockSearch();
    }
  }, [applyStockSearch]);

  const createTemporaryStockItem = useCallback(
    async (name) => {
      const trimmed = (name || "").trim();
      if (!trimmed || findStockItemByName(trimmed)) {
        const existingItem = findStockItemByName(trimmed);
        if (existingItem) addStockItemToSelection(existingItem);
        return existingItem || null;
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
        const nextItems = flattenStockData(payload.data);
        setStockItems(nextItems);
        setSuccessMessage(`"${trimmed}" added to consumable stock for review.`);
        const createdItem = nextItems.find((item) => normalizeName(item.name) === normalizeName(trimmed));
        if (createdItem) addStockItemToSelection(createdItem);
        return createdItem || null;
      } catch (error) {
        console.error("❌ Failed to add temporary consumable", error);
        setRequestError(error?.message || "Unable to add consumable to stock.");
        return null;
      } finally {
        setAddingTemporaryItem(false);
      }
    },
    [addStockItemToSelection, findStockItemByName, normalizeName]
  );

  const openSendPopup = useCallback(() => {
    if (!selectedStockItems.length) return;
    setSendError("");
    setShowSendPopup(true);
  }, [selectedStockItems.length]);

  const sendSelectedByEmail = useCallback(() => {
    if (!selectedStockItems.length || typeof window === "undefined") return;
    const itemLines = selectedStockItems.map(
      (item, index) => `${index + 1}. ${item.name} (quantity: ${item.quantity})`
    );
    const body = [
      "Hi,",
      "",
      "Please stock take the following consumables:",
      "",
      ...itemLines,
      "",
      "Thanks,",
    ].join("\n");
    window.location.href =
      `mailto:darrell@humphriesandpark.co.uk` +
      `?subject=${encodeURIComponent("Stock Take")}` +
      `&body=${encodeURIComponent(body)}`;
    setShowSendPopup(false);
  }, [selectedStockItems]);

  const sendSelectedToRequests = useCallback(async () => {
    if (!selectedStockItems.length) return;
    setSendLoading(true);
    setSendError("");
    try {
      const response = await fetch("/api/workshop/consumables/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedStockItems.map((item) => ({
            itemName: item.name,
            quantity: item.quantity,
            catalogConsumableId: item.id,
          })),
          requestedById: dbUserId,
          requestedByName: user?.username || null,
        }),
      });
      const payload = await response.json().catch(() => ({ message: "Unable to send the request." }));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Unable to send the request.");
      }
      setSelectedStockItems([]);
      setShowSendPopup(false);
      setSuccessMessage(`${selectedStockItems.length} consumable request${selectedStockItems.length === 1 ? "" : "s"} sent.`);
      await fetchRequests();
    } catch (error) {
      console.error("❌ Failed to send consumable requests", error);
      setSendError(error?.message || "Unable to send the request.");
    } finally {
      setSendLoading(false);
    }
  }, [dbUserId, fetchRequests, selectedStockItems, user?.username]);

  if (!isTechRole && !isWorkshopManager) {
    return <TechConsumableRequestPageUi view="section1" cardStyle={cardStyle} DevLayoutSection={DevLayoutSection} Link={Link} />;


















































  }

  return <TechConsumableRequestPageUi view="section2" addStockItemToSelection={addStockItemToSelection} addingTemporaryItem={addingTemporaryItem} applyStockSearch={applyStockSearch} clearStockSearch={clearStockSearch} createTemporaryStockItem={createTemporaryStockItem} DevLayoutSection={DevLayoutSection} fieldLabelStyle={fieldLabelStyle} filteredRequests={filteredRequests} findStockItemByName={findStockItemByName} handleStockSearchKeyDown={handleStockSearchKeyDown} isMobile={isMobile} loadingRequests={loadingRequests} openSendPopup={openSendPopup} pageWrapperStyle={pageWrapperStyle} removeSelectedStockItem={removeSelectedStockItem} requestCardMetaGridStyle={requestCardMetaGridStyle} requestCardStyle={requestCardStyle} requestError={requestError} requestForm={requestForm} requestMonth={requestMonth} requestPanelStyle={requestPanelStyle} requestsToolbarStyle={requestsToolbarStyle} SearchBar={SearchBar} searchTerm={searchTerm} selectedStockItems={selectedStockItems} sendError={sendError} sendLoading={sendLoading} sendSelectedByEmail={sendSelectedByEmail} sendSelectedToRequests={sendSelectedToRequests} setRequestForm={setRequestForm} setRequestMonth={setRequestMonth} setSearchTerm={setSearchTerm} setShowSendPopup={setShowSendPopup} setShowStockList={setShowStockList} showSendPopup={showSendPopup} showStockList={showStockList} statusBadgeStyles={statusBadgeStyles} stockError={stockError} stockItems={stockItems} stockLoading={stockLoading} stockMatches={stockMatches} successMessage={successMessage} tableHeaderStyle={tableHeaderStyle} updateSelectedStockQuantity={updateSelectedStockQuantity} visibleStockItems={visibleStockItems} />;



































































































































































































































































































































































































































































































};

export default TechConsumableRequestPage; // Export component for Next.js routing
