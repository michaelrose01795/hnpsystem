// file location: src/components/Consumables/StockCheckPopup.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ModalPortal from "@/components/popups/ModalPortal";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import { SearchBar } from "@/components/ui/searchBarAPI";

const consumableNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const modalStyle = {
  borderRadius: "var(--radius-xl)",
  width: "min(1120px, calc(100vw - 32px))",
  maxWidth: "1120px",
  maxHeight: "calc(100vh - 32px)",
  overflow: "hidden",
  border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
  background: "var(--page-card-bg)",
  boxShadow: "var(--shadow-xl)",
  padding: "clamp(16px, 2.4vw, 24px)",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  minHeight: 0,
};

const sectionCardStyle = {
  background: "var(--surface)",
  border: "1px solid rgba(var(--accent-base-rgb), 0.14)",
  borderRadius: "var(--radius-md)",
  padding: "16px",
  boxShadow: "none",
};

const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 600,
  color: "var(--text-1)",
};

const buttonPrimaryStyle = {
  padding: "10px 18px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid rgba(var(--accent-base-rgb), 0.28)",
  background: "var(--primary)",
  color: "var(--surface)",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "none",
};

const buttonSecondaryStyle = {
  padding: "8px 14px",
  borderRadius: "var(--input-radius)",
  border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
  background: "var(--surface)",
  color: "var(--text-1)",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "none",
};

const inputFieldStyle = {
  padding: "10px 12px",
  borderRadius: "var(--input-radius)",
  border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
  background: "var(--surface)",
  color: "var(--text-1)",
};

const subtleSectionStyle = {
  ...sectionCardStyle,
  background: "var(--theme)",
};

const sectionHeadingStyle = {
  margin: 0,
  color: "var(--text-1)",
};

const mutedTextStyle = {
  color: "var(--text-1)",
};

const requestStatusTone = {
  pending: {
    background: "rgba(var(--warning-rgb), 0.16)",
    color: "var(--warning-dark)",
    label: "Pending",
  },
  approved: {
    background: "rgba(var(--success-rgb), 0.15)",
    color: "var(--success-dark)",
    label: "Approved",
  },
  rejected: {
    background: "rgba(var(--primary-rgb), 0.12)",
    color: "var(--primary-selected)",
    label: "Rejected",
  },
};

const defaultData = { locations: [], unassigned: [], stockChecks: [] };
const MAX_SEARCH_SUGGESTIONS = 8;

function StockCheckPopup({
  open,
  onClose,
  isManager = false,
  technicianId = null,
  onRequestsSubmitted = null,
}) {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedItems, setSelectedItems] = useState(() => new Set());
  const [submitLoading, setSubmitLoading] = useState(false);
  const [renameItemState, setRenameItemState] = useState({ id: null, value: "" });
  const [managerActionLoading, setManagerActionLoading] = useState(false);
  const [requestUpdateId, setRequestUpdateId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [stockSearchInput, setStockSearchInput] = useState("");
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [showStockList, setShowStockList] = useState(false);
  const [newConsumableForm, setNewConsumableForm] = useState({
    name: "",
    supplier: "",
    unitCost: "",
  });
  const [newConsumableLoading, setNewConsumableLoading] = useState(false);

  const allConsumables = useMemo(() => {
    const locatedItems = (data.locations || []).flatMap((location) => location.consumables || []);
    return locatedItems.concat(data.unassigned || []);
  }, [data.locations, data.unassigned]);

  const sortedConsumables = useMemo(() => {
    return [...allConsumables].sort((a, b) =>
      consumableNameCollator.compare(
        (a?.name || "").toString(),
        (b?.name || "").toString()
      )
    );
  }, [allConsumables]);

  const filteredConsumables = useMemo(() => {
    const query = stockSearchQuery.trim().toLowerCase();
    if (!query) {
      return sortedConsumables;
    }
    return sortedConsumables.filter((item) =>
      (item.name || "").toLowerCase().includes(query)
    );
  }, [sortedConsumables, stockSearchQuery]);

  const totalItems = allConsumables.length;
  const visibleItems = filteredConsumables.length;
  const hasSearchQuery = stockSearchInput.trim().length > 0;
  const hasAppliedSearch = stockSearchQuery.trim().length > 0;
  const shouldShowStockList = showStockList || hasAppliedSearch;

  const searchSuggestions = useMemo(() => {
    const query = stockSearchInput.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return sortedConsumables
      .filter((item) => (item.name || "").toLowerCase().includes(query))
      .slice(0, MAX_SEARCH_SUGGESTIONS);
  }, [sortedConsumables, stockSearchInput]);

  const displayConsumables = useMemo(() => {
    if (!showStockList) {
      return filteredConsumables;
    }

    const selected = [];
    const unselected = [];
    filteredConsumables.forEach((item) => {
      if (selectedItems.has(item.id)) {
        selected.push(item);
      } else {
        unselected.push(item);
      }
    });
    return [...selected, ...unselected];
  }, [filteredConsumables, selectedItems, showStockList]);

  const selectedCount = selectedItems.size;
  const requestCount = (data.stockChecks || []).length;
  const pendingRequestCount = (data.stockChecks || []).filter(
    (request) => request.status === "pending"
  ).length;

  const closePopup = useCallback(() => {
    if (typeof onClose === "function") {
      onClose();
    }
  }, [onClose]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workshop/consumables/stock-check");
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Unable to load stock data." }));
        throw new Error(body.message || "Unable to load stock data.");
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to load stock data.");
      }
      const nextData = payload.data || defaultData;
      setData(nextData);
      setSelectedItems((previous) => {
        if (!previous.size) {
          return previous;
        }
        const validIds = new Set(
          (nextData.locations || [])
            .flatMap((location) => location.consumables || [])
            .concat(nextData.unassigned || [])
            .map((item) => item.id)
        );
        if (!validIds.size) {
          return new Set();
        }
        const filtered = new Set();
        previous.forEach((id) => {
          if (validIds.has(id)) {
            filtered.add(id);
          }
        });
        return filtered;
      });
    } catch (fetchError) {
      console.error("❌ Failed to load stock data", fetchError);
      setError(fetchError.message || "Unable to load stock data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  useEffect(() => {
    if (!open) {
      setSelectedItems(new Set());
      setStatusMessage("");
      setError("");
      setRenameItemState({ id: null, value: "" });
      setStockSearchInput("");
      setStockSearchQuery("");
      setShowStockList(false);
      setNewConsumableForm({ name: "", supplier: "", unitCost: "" });
      setNewConsumableLoading(false);
      return () => {};
    }

    const handleKey = (event) => {
      if (event.key === "Escape") {
        closePopup();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, closePopup]);

  const toggleItem = (itemId) => {
    setSelectedItems((previous) => {
      const next = new Set(previous);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleNewConsumableChange = (field) => (event) => {
    const value = event.target.value;
    setNewConsumableForm((previous) => ({ ...previous, [field]: value }));
  };

  const applyStockSearch = useCallback((nextQuery = stockSearchInput) => {
    const trimmedQuery = (nextQuery || "").trim();
    setStockSearchInput(trimmedQuery ? nextQuery : "");
    setStockSearchQuery(trimmedQuery);
    if (trimmedQuery) {
      setShowStockList(true);
    }
  }, [stockSearchInput]);

  const clearStockSearch = useCallback(() => {
    setStockSearchInput("");
    setStockSearchQuery("");
  }, []);

  const handleStockSearchKeyDown = useCallback((event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyStockSearch();
    }
  }, [applyStockSearch]);

  if (!open) {
    return null;
  }

  const handleNewConsumableSubmit = async (event) => {
    event.preventDefault();
    const itemName = (newConsumableForm.name || "").trim();
    if (!itemName) {
      setError("Consumable name is required.");
      return;
    }
    const supplier = (newConsumableForm.supplier || "").trim();
    const unitCost = Number(newConsumableForm.unitCost) || 0;
    setNewConsumableLoading(true);
    setStatusMessage("");
    setError("");
    try {
      const response = await fetch("/api/workshop/consumables/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: itemName,
          supplier: supplier || null,
          unitCost,
        }),
      });
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Unable to add consumable." }));
        throw new Error(body.message || "Unable to add consumable.");
      }
      setNewConsumableForm({ name: "", supplier: "", unitCost: "" });
      setStatusMessage(`"${itemName}" added to consumable stock.`);
      await fetchData();
    } catch (newItemError) {
      console.error("❌ Failed to add consumable", newItemError);
      setError(newItemError.message || "Unable to add consumable.");
    } finally {
      setNewConsumableLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedCount) {
      setError("Select at least one consumable to submit a request.");
      return;
    }
    setSubmitLoading(true);
    setStatusMessage("");
    setError("");
    try {
      const response = await fetch("/api/workshop/consumables/stock-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          consumableIds: Array.from(selectedItems),
          technicianId,
        }),
      });
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Unable to submit stock check." }));
        throw new Error(body.message || "Unable to submit stock check.");
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to submit stock check.");
      }
      const nextState = payload.data || defaultData;
      setData(nextState);
      setSelectedItems(new Set());
      setStatusMessage("Stock check request submitted to Workshop Management.");
      if (typeof onRequestsSubmitted === "function") {
        onRequestsSubmitted(nextState.stockChecks || []);
      }
    } catch (submitError) {
      console.error("❌ Failed to submit stock check", submitError);
      setError(submitError.message || "Unable to submit stock check.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEmailSelectedItems = () => {
    if (!selectedCount) {
      setError("Select at least one consumable to email.");
      return;
    }

    const selectedList = allConsumables.filter((item) => selectedItems.has(item.id));
    const itemLines = selectedList.map((item, index) => {
      const itemName = (item?.name || "Unnamed consumable").toString().trim();
      return `${index + 1}. ${itemName}`;
    });

    const body = [
      "Hi,",
      "",
      "Please stock take the following consumables:",
      "",
      ...itemLines,
      "",
      "Thanks,",
    ].join("\n");

    const mailtoUrl =
      `mailto:darrell@humphriesandpark.co.uk` +
      `?subject=${encodeURIComponent("Stock Take")}` +
      `&body=${encodeURIComponent(body)}`;

    if (typeof window !== "undefined") {
      window.location.href = mailtoUrl;
    }
  };

  const handleManagerAction = async (payload) => {
    setManagerActionLoading(true);
    setStatusMessage("");
    setError("");
    try {
      const response = await fetch("/api/workshop/consumables/stock-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Unable to update consumables." }));
        throw new Error(body.message || "Unable to update consumables.");
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Unable to update consumables.");
      }
      setData(result.data || defaultData);
      setRenameItemState({ id: null, value: "" });
      return true;
    } catch (managerError) {
      console.error("❌ Manager action failed", managerError);
      setError(managerError.message || "Unable to update consumables.");
      return false;
    } finally {
      setManagerActionLoading(false);
    }
  };

  const handleRenameItem = async () => {
    const trimmed = (renameItemState.value || "").trim();
    if (!renameItemState.id || !trimmed) {
      setError("Consumable name cannot be empty.");
      return;
    }
    const success = await handleManagerAction({
      action: "renameConsumable",
      consumableId: renameItemState.id,
      name: trimmed,
    });
    if (success) {
      setStatusMessage("Consumable renamed.");
    }
  };

  const doDeleteItem = async (consumableId) => {
    const success = await handleManagerAction({
      action: "deleteConsumable",
      consumableId,
    });
    if (success) {
      setStatusMessage("Consumable removed.");
    }
  };

  const handleDeleteItem = (consumableId, itemName) => {
    if (!consumableId) return;
    setConfirmDialog({
      message: `Delete ${itemName || "this consumable"}? This cannot be undone.`,
      onConfirm: () => {
        setConfirmDialog(null);
        doDeleteItem(consumableId);
      },
    });
  };

  const handleRequestStatusUpdate = async (requestId, status) => {
    setRequestUpdateId(requestId);
    setStatusMessage("");
    setError("");
    try {
      const response = await fetch("/api/workshop/consumables/stock-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateRequestStatus", requestId, status }),
      });
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Unable to update request." }));
        throw new Error(body.message || "Unable to update request.");
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to update request.");
      }
      setData(payload.data || defaultData);
      setStatusMessage(`Request ${status}.`);
    } catch (requestError) {
      console.error("❌ Failed to update request", requestError);
      setError(requestError.message || "Unable to update request.");
    } finally {
      setRequestUpdateId(null);
    }
  };

  const renderConsumableRow = (item) => {
    const checked = selectedItems.has(item.id);
    const isRenaming = renameItemState.id === item.id;
    return (
      <div
        key={item.id}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "12px",
          border: checked
            ? "1px solid rgba(var(--accent-base-rgb), 0.26)"
            : "1px solid rgba(var(--accent-base-rgb), 0.12)",
          borderRadius: "var(--radius-sm)",
          background: checked ? "var(--theme)" : "var(--surface)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <label style={{ ...checkboxLabelStyle, margin: 0 }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleItem(item.id)}
            />
            <span>{item.name}</span>
          </label>
          {isManager && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{ ...buttonSecondaryStyle, padding: "4px 10px" }}
                onClick={() =>
                  setRenameItemState({ id: item.id, value: item.name || "" })
                }
              >
                Rename
              </button>
              <button
                type="button"
                style={{
                  ...buttonSecondaryStyle,
                  padding: "4px 10px",
                  color: "var(--danger)",
                  borderColor: "transparent",
                }}
                onClick={() => handleDeleteItem(item.id, item.name)}
              >
                Delete
              </button>
            </div>
          )}
        </div>
        {isRenaming && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="text"
              value={renameItemState.value}
              onChange={(event) =>
                setRenameItemState((previous) => ({
                  ...previous,
                  value: event.target.value,
                }))
              }
              style={{ ...inputFieldStyle, flex: "1 1 220px" }}
            />
            <button
              type="button"
              onClick={handleRenameItem}
              style={{ ...buttonPrimaryStyle, padding: "8px 14px" }}
              disabled={managerActionLoading}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setRenameItemState({ id: null, value: "" })}
              style={{ ...buttonSecondaryStyle, padding: "8px 14px" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
    <ModalPortal>
      <div
        className="popup-backdrop"
        style={{
          zIndex: 1400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          overflowY: "auto",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="popup-card" style={modalStyle}>
        <div
          style={{
            ...subtleSectionStyle,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            padding: "20px 22px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h2 style={{ margin: 0, color: "var(--text-1)" }}>Stock Check</h2>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-pill)",
                background: "rgba(var(--accent-base-rgb), 0.14)",
                color: "var(--text-1)",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {totalItems} stock items
            </span>
            <span
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-pill)",
                background: pendingRequestCount
                  ? "rgba(var(--warning-rgb), 0.18)"
                  : "rgba(var(--success-rgb), 0.16)",
                color: pendingRequestCount ? "var(--warning-dark)" : "var(--success-dark)",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {pendingRequestCount} pending
            </span>
            <button
              type="button"
              onClick={closePopup}
              style={{
                ...buttonSecondaryStyle,
                width: "44px",
                height: "44px",
                padding: 0,
                fontSize: "1.1rem",
                lineHeight: 1,
              }}
              aria-label="Close stock check"
            >
              ✕
            </button>
          </div>
        </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              overflowY: "auto",
              overscrollBehavior: "contain",
              minHeight: 0,
              paddingRight: "4px",
            }}
          >
            {error && (
              <div
                style={{
                  ...sectionCardStyle,
                  borderColor: "transparent",
                  background: "var(--danger-surface)",
                }}
              >
                <strong style={{ color: "var(--danger)" }}>{error}</strong>
              </div>
            )}
            {statusMessage && (
              <div
                style={{
                  ...sectionCardStyle,
                  borderColor: "transparent",
                  background: "var(--success-surface)",
                }}
              >
                <strong style={{ color: "var(--success-dark)" }}>{statusMessage}</strong>
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-start",
                gap: "16px",
              }}
            >
            {isManager && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  flex: "0.95 1 320px",
                  minWidth: "300px",
                }}
              >
              <div style={{ ...subtleSectionStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={sectionHeadingStyle}>Add new consumable</h3>
                <form
                  onSubmit={handleNewConsumableSubmit}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "12px",
                    width: "100%",
                  }}
                >
                  <label style={{ fontWeight: 600, color: "var(--text-1)", display: "flex", flexDirection: "column", gap: "6px" }}>
                    Item name
                    <input
                      type="text"
                      value={newConsumableForm.name}
                      onChange={handleNewConsumableChange("name")}
                      placeholder="e.g. nitrile gloves"
                      style={inputFieldStyle}
                      required
                    />
                  </label>
                  <label style={{ fontWeight: 600, color: "var(--text-1)", display: "flex", flexDirection: "column", gap: "6px" }}>
                    Default supplier
                    <input
                      type="text"
                      value={newConsumableForm.supplier}
                      onChange={handleNewConsumableChange("supplier")}
                      placeholder="Optional supplier"
                      style={inputFieldStyle}
                    />
                  </label>
                  <label style={{ fontWeight: 600, color: "var(--text-1)", display: "flex", flexDirection: "column", gap: "6px" }}>
                    Default unit cost (£)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newConsumableForm.unitCost}
                      onChange={handleNewConsumableChange("unitCost")}
                      placeholder="0.00"
                      style={inputFieldStyle}
                    />
                  </label>
                  <div style={{ gridColumn: "1 / -1", textAlign: "right" }}>
                    <button
                      type="submit"
                      disabled={newConsumableLoading}
                      style={{
                        ...buttonPrimaryStyle,
                        padding: "10px 20px",
                        background: newConsumableLoading ? "rgba(var(--primary-rgb),0.45)" : buttonPrimaryStyle.background,
                      }}
                    >
                      {newConsumableLoading ? "Adding…" : "Add Consumable"}
                    </button>
                  </div>
                </form>
              </div>

              <div style={{ ...sectionCardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <h3 style={sectionHeadingStyle}>Recent stock check requests</h3>
                  <span style={{ ...mutedTextStyle, fontSize: "0.9rem" }}>{requestCount} total</span>
                </div>
                {data.stockChecks && data.stockChecks.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table className="app-data-table" style={{ width: "100%", minWidth: "680px" }}>
                      <thead>
                        <tr>
                          <th>Consumable</th>
                          <th>Technician</th>
                          <th>Submitted</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.stockChecks.map((request) => {
                          const tone = requestStatusTone[request.status] || requestStatusTone.pending;
                          return (
                            <tr key={request.id}>
                              <td style={{ fontWeight: 600 }}>{request.consumableName || "—"}</td>
                              <td style={mutedTextStyle}>{request.technicianName || "—"}</td>
                              <td style={mutedTextStyle}>
                                {request.createdAt
                                  ? new Date(request.createdAt).toLocaleString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "2px 10px",
                                    borderRadius: "var(--radius-pill)",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    background: tone.background,
                                    color: tone.color,
                                  }}
                                >
                                  {tone.label}
                                </span>
                              </td>
                              <td>
                                {request.status === "pending" ? (
                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    <button
                                      type="button"
                                      onClick={() => handleRequestStatusUpdate(request.id, "approved")}
                                      style={{ ...buttonPrimaryStyle, padding: "6px 12px" }}
                                      disabled={requestUpdateId === request.id}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRequestStatusUpdate(request.id, "rejected")}
                                      style={{
                                        ...buttonSecondaryStyle,
                                        padding: "6px 12px",
                                        color: "var(--danger)",
                                        borderColor: "transparent",
                                      }}
                                      disabled={requestUpdateId === request.id}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span style={mutedTextStyle}>No actions</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ margin: 0, ...mutedTextStyle }}>No stock check submissions yet.</p>
                )}
              </div>
              </div>
            )}

            <div style={{ ...subtleSectionStyle, display: "flex", flexDirection: "column", gap: "12px", flex: "1.35 1 420px", minWidth: "320px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                <div>
                  <h3 style={sectionHeadingStyle}>Consumable stock</h3>
                </div>
                <span style={{ ...mutedTextStyle, fontSize: "0.9rem" }}>
                  {loading ? "Loading…" : `${visibleItems} of ${totalItems} items`}
                </span>
              </div>
              <div
                style={{
                  ...sectionCardStyle,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  padding: "14px",
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <SearchBar
                    value={stockSearchInput}
                    onChange={(event) => setStockSearchInput(event.target.value)}
                    onClear={clearStockSearch}
                    onKeyDown={handleStockSearchKeyDown}
                    placeholder="Search consumables"
                    inputMode="search"
                    enterKeyHint="search"
                    style={{
                      flex: "1 1 260px",
                      minWidth: "240px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => applyStockSearch()}
                    style={{ ...buttonPrimaryStyle, padding: "10px 14px" }}
                    disabled={loading || totalItems === 0}
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStockList((previous) => !previous)}
                    className="app-btn app-btn--control"
                    disabled={totalItems === 0}
                  >
                    {showStockList && !hasAppliedSearch ? "Hide list" : "Show list"}
                  </button>
                </div>
              </div>
              {hasSearchQuery && !loading && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    padding: "12px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--surface)",
                    border: "1px solid rgba(var(--accent-base-rgb), 0.12)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ color: "var(--text-1)", fontSize: "0.95rem" }}>
                      Possible items
                    </strong>
                    {hasAppliedSearch && (
                      <span style={{ ...mutedTextStyle, fontSize: "0.85rem" }}>
                        Active search: "{stockSearchQuery}"
                      </span>
                    )}
                  </div>
                  {searchSuggestions.length === 0 ? (
                    <p style={{ margin: 0, ...mutedTextStyle }}>
                      No matching consumables found.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {searchSuggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => applyStockSearch(item.name || "")}
                          style={{
                            ...buttonSecondaryStyle,
                            padding: "8px 12px",
                            background: "rgba(var(--accent-base-rgb), 0.08)",
                          }}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!shouldShowStockList ? null : loading ? (
                <p style={{ margin: 0, color: "var(--info)" }}>Loading stock...</p>
              ) : visibleItems === 0 ? (
                <p style={{ margin: 0, ...mutedTextStyle }}>
                  {totalItems === 0 ? "No consumables recorded yet." : "No consumables match your search."}
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", maxHeight: "420px", overflowY: "auto", paddingRight: "4px" }}>
                  {displayConsumables.map((item) => renderConsumableRow(item))}
                </div>
              )}
            </div>
            </div>
          </div>

        <div
          style={{
            ...subtleSectionStyle,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            padding: "16px 18px",
          }}
        >
          <div>
            <strong style={{ color: "var(--text-1)", fontSize: "1rem" }}>
              {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
            </strong>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setSelectedItems(new Set())}
              style={{ ...buttonSecondaryStyle, padding: "10px 16px" }}
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={handleEmailSelectedItems}
              style={{ ...buttonSecondaryStyle, padding: "12px 18px", opacity: selectedCount ? 1 : 0.7 }}
              disabled={!selectedCount}
            >
              Email
            </button>
            <button
              type="button"
              onClick={handleSubmitRequest}
              style={{ ...buttonPrimaryStyle, padding: "12px 22px", opacity: selectedCount ? 1 : 0.7 }}
              disabled={submitLoading || !selectedCount}
            >
              {submitLoading ? "Submitting…" : "Submit Stock Check Request"}
            </button>
          </div>
        </div>
        </div>
      </div>
    </ModalPortal>
    <ConfirmationDialog
      isOpen={!!confirmDialog}
      message={confirmDialog?.message}
      cancelLabel="Cancel"
      confirmLabel="Delete"
      onCancel={() => setConfirmDialog(null)}
      onConfirm={confirmDialog?.onConfirm}
    />
    </>
  );
}

export default StockCheckPopup;
