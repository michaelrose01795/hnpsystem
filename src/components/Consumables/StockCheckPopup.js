// file location: src/components/Consumables/StockCheckPopup.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ModalPortal from "@/components/popups/ModalPortal";
import { SearchBar } from "@/components/searchBarAPI";

const consumableNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const modalStyle = {
  borderRadius: "var(--radius-xl)",
  width: "min(960px, calc(100vw - 32px))",
  maxWidth: "960px",
  maxHeight: "calc(100vh - 32px)",
  overflow: "hidden",
  border: "none",
  padding: "clamp(16px, 3vw, 32px)",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  minHeight: 0,
};

const sectionCardStyle = {
  background: "var(--surface)",
  border: "none",
  borderRadius: "var(--radius-md)",
  padding: "16px",

};

const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 600,
  color: "var(--primary-dark)",
};

const buttonPrimaryStyle = {
  padding: "10px 18px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--primary)",
  color: "var(--surface)",
  fontWeight: 600,
  cursor: "pointer",

};

const buttonSecondaryStyle = {
  padding: "8px 14px",
  borderRadius: "var(--input-radius)",
  border: "none",
  background: "var(--surface)",
  color: "var(--primary-dark)",
  fontWeight: 600,
  cursor: "pointer",

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
    color: "var(--primary-dark)",
    label: "Rejected",
  },
};

const defaultData = { locations: [], unassigned: [], stockChecks: [] };

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
  const [stockSearch, setStockSearch] = useState("");
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
    const query = stockSearch.trim().toLowerCase();
    if (!query) {
      return sortedConsumables;
    }
    return sortedConsumables.filter((item) =>
      (item.name || "").toLowerCase().includes(query)
    );
  }, [sortedConsumables, stockSearch]);

  const totalItems = allConsumables.length;
  const visibleItems = filteredConsumables.length;
  const hasSearchQuery = stockSearch.trim().length > 0;
  const shouldShowStockList = hasSearchQuery || showStockList;

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
      setStockSearch("");
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

  if (!open) {
    return null;
  }

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

  const handleDeleteItem = async (consumableId, itemName) => {
    if (!consumableId) {
      return;
    }
    const confirmed = window.confirm(
      `Delete ${itemName || "this consumable"}? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    const success = await handleManagerAction({
      action: "deleteConsumable",
      consumableId,
    });
    if (success) {
      setStatusMessage("Consumable removed.");
    }
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
          border: "none",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-light)",
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
                  borderColor: "rgba(var(--danger-rgb),0.4)",
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
              style={{
                padding: "8px 10px",
                borderRadius: "var(--radius-xs)",
                border: "none",
                flex: "1 1 220px",
              }}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--primary-dark)" }}>Stock Check</h2>
          </div>
          <button
            type="button"
            onClick={closePopup}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--primary-dark)",
              cursor: "pointer",
              fontSize: "1.2rem",
            }}
            aria-label="Close stock check"
          >
            ✕
          </button>
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
              <div style={{ ...sectionCardStyle, borderColor: "rgba(var(--primary-rgb),0.35)", background: "rgba(var(--primary-rgb),0.08)" }}>
                <strong style={{ color: "var(--primary-dark)" }}>{error}</strong>
              </div>
            )}
            {statusMessage && (
              <div style={{ ...sectionCardStyle, borderColor: "rgba(var(--success-rgb),0.4)", background: "rgba(var(--success-rgb),0.12)" }}>
                <strong style={{ color: "var(--success-dark)" }}>{statusMessage}</strong>
              </div>
            )}

            {isManager && (
              <div style={{ ...sectionCardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ margin: 0, color: "var(--primary-dark)" }}>Add new consumable</h3>
                <form
                  onSubmit={handleNewConsumableSubmit}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                    width: "100%",
                  }}
                >
                  <label style={{ fontWeight: 600, color: "var(--primary-dark)", display: "flex", flexDirection: "column", gap: "6px" }}>
                    Item name
                    <input
                      type="text"
                      value={newConsumableForm.name}
                      onChange={handleNewConsumableChange("name")}
                      placeholder="e.g. nitrile gloves"
                      style={{
                        padding: "8px 10px",
                        borderRadius: "var(--input-radius)",
                        border: "none",
                      }}
                      required
                    />
                  </label>
                  <label style={{ fontWeight: 600, color: "var(--primary-dark)", display: "flex", flexDirection: "column", gap: "6px" }}>
                    Default supplier
                    <input
                      type="text"
                      value={newConsumableForm.supplier}
                      onChange={handleNewConsumableChange("supplier")}
                      placeholder="Optional supplier"
                      style={{
                        padding: "8px 10px",
                        borderRadius: "var(--input-radius)",
                        border: "none",
                      }}
                    />
                  </label>
                  <label style={{ fontWeight: 600, color: "var(--primary-dark)", display: "flex", flexDirection: "column", gap: "6px" }}>
                    Default unit cost (£)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newConsumableForm.unitCost}
                      onChange={handleNewConsumableChange("unitCost")}
                      placeholder="0.00"
                      style={{
                        padding: "8px 10px",
                        borderRadius: "var(--input-radius)",
                        border: "none",
                      }}
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
            )}

            {isManager && (
              <div style={{ ...sectionCardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ margin: 0, color: "var(--primary-dark)" }}>Recent stock check requests</h3>
                {data.stockChecks && data.stockChecks.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--grey-accent-dark)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      <th style={{ padding: "8px" }}>Consumable</th>
                      <th style={{ padding: "8px" }}>Technician</th>
                      <th style={{ padding: "8px" }}>Submitted</th>
                      <th style={{ padding: "8px" }}>Status</th>
                      <th style={{ padding: "8px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stockChecks.map((request) => {
                      const tone = requestStatusTone[request.status] || requestStatusTone.pending;
                      return (
                        <tr key={request.id} style={{ background: "var(--surface-light)", borderRadius: "var(--radius-sm)" }}>
                          <td style={{ padding: "8px", fontWeight: 600 }}>{request.consumableName || "—"}</td>
                          <td style={{ padding: "8px", color: "var(--grey-accent-dark)" }}>{request.technicianName || "—"}</td>
                          <td style={{ padding: "8px", color: "var(--grey-accent-dark)" }}>
                            {request.createdAt
                              ? new Date(request.createdAt).toLocaleString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td style={{ padding: "8px" }}>
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
                          <td style={{ padding: "8px" }}>
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
                                    borderColor: "rgba(var(--danger-rgb),0.4)",
                                  }}
                                  disabled={requestUpdateId === request.id}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: "var(--grey-accent-dark)" }}>No actions</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>No stock check submissions yet.</p>
                )}
              </div>
            )}

            <div style={{ ...sectionCardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, color: "var(--primary-dark)" }}>Consumable stock</h3>
                </div>
                <span style={{ color: "var(--grey-accent-dark)", fontSize: "0.9rem" }}>
                  {loading ? "Loading…" : `${visibleItems} of ${totalItems} items`}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <SearchBar
                  value={stockSearch}
                  onChange={(event) => setStockSearch(event.target.value)}
                  onClear={() => setStockSearch("")}
                  placeholder="Search consumables"
                  style={{
                    flex: "1 1 260px",
                    minWidth: "240px",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowStockList((previous) => !previous)}
                  style={{ ...buttonSecondaryStyle, padding: "10px 14px" }}
                  disabled={totalItems === 0}
                >
                  {shouldShowStockList && !hasSearchQuery ? "Hide list" : "Show list"}
                </button>
              </div>
              {!shouldShowStockList ? (
                <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>
                  Search for a consumable or click Show list.
                </p>
              ) : loading ? (
                <p style={{ margin: 0, color: "var(--info)" }}>Loading stock...</p>
              ) : visibleItems === 0 ? (
                <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>
                  {totalItems === 0 ? "No consumables recorded yet." : "No consumables match your search."}
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", maxHeight: "420px", overflowY: "auto", paddingRight: "4px" }}>
                  {displayConsumables.map((item) => renderConsumableRow(item))}
                </div>
              )}
            </div>
          </div>

        <div style={{ ...sectionCardStyle, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div>
            <strong style={{ color: "var(--primary-dark)", fontSize: "1rem" }}>
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
  );
}

export default StockCheckPopup;
