// file location: src/components/Consumables/StockCheckPopup.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";

const modalStyle = {
  ...popupCardStyles,
  maxWidth: "960px",
  width: "100%",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const sectionCardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--surface-light)",
  borderRadius: "16px",
  padding: "16px",
  boxShadow: "none",
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
  borderRadius: "12px",
  border: "none",
  background: "var(--primary)",
  color: "var(--surface)",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "none",
};

const buttonSecondaryStyle = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--surface-light)",
  background: "var(--surface)",
  color: "var(--primary-dark)",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "none",
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

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "2px 8px",
  borderRadius: "999px",
  fontSize: "0.75rem",
  background: "rgba(var(--warning-rgb),0.16)",
  color: "var(--warning-dark)",
  border: "1px solid rgba(var(--warning-rgb),0.35)",
};

function StockCheckPopup({ open, onClose, isManager = false, technicianId = null }) {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [temporaryInput, setTemporaryInput] = useState("");
  const [temporarySubmitting, setTemporarySubmitting] = useState(false);
  const [selectedItems, setSelectedItems] = useState(() => new Set());
  const [submitLoading, setSubmitLoading] = useState(false);
  const [locationRenameState, setLocationRenameState] = useState({ id: null, value: "" });
  const [renameItemState, setRenameItemState] = useState({ id: null, value: "" });
  const [moveItemState, setMoveItemState] = useState({ id: null, locationId: "" });
  const [managerActionLoading, setManagerActionLoading] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [addingLocation, setAddingLocation] = useState(false);
  const [requestUpdateId, setRequestUpdateId] = useState(null);

  const sections = useMemo(() => {
    const next = (data.locations || []).map((location) => ({
      ...location,
      key: location.id,
      title: location.name || "Unnamed Location",
    }));
    if (data.unassigned && data.unassigned.length) {
      next.push({
        id: null,
        key: "unassigned",
        title: "Unassigned",
        consumables: data.unassigned,
      });
    }
    return next;
  }, [data.locations, data.unassigned]);

  const allConsumables = useMemo(
    () => sections.flatMap((section) => section.consumables || []),
    [sections]
  );

  const locationOptions = useMemo(() => {
    const opts = (data.locations || []).map((location) => ({
      label: location.name,
      value: location.id,
    }));
    opts.push({ label: "Unassigned", value: "" });
    return opts;
  }, [data.locations]);

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
      setTemporaryInput("");
      setSelectedItems(new Set());
      setStatusMessage("");
      setError("");
      setLocationRenameState({ id: null, value: "" });
      setRenameItemState({ id: null, value: "" });
      setMoveItemState({ id: null, locationId: "" });
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

  const toggleSection = (section) => {
    const sectionIds = (section.consumables || []).map((item) => item.id);
    setSelectedItems((previous) => {
      const next = new Set(previous);
      const allSelected = sectionIds.every((id) => next.has(id));
      sectionIds.forEach((id) => {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  const parseTemporaryItems = () => {
    return (temporaryInput || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("-"))
      .map((line) => line.replace(/^-\s*/, "").trim())
      .filter(Boolean);
  };

  const handleTemporarySubmit = async () => {
    const items = parseTemporaryItems();
    if (!items.length) {
      setError("Use '-' at the start of each line to bulk add consumables.");
      return;
    }
    setTemporarySubmitting(true);
    setStatusMessage("");
    setError("");
    try {
      const response = await fetch("/api/workshop/consumables/stock-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addTemporary", items }),
      });
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Unable to add consumables." }));
        throw new Error(body.message || "Unable to add consumables.");
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to add consumables.");
      }
      setData(payload.data || defaultData);
      setTemporaryInput("");
      setStatusMessage(
        `${items.length} consumable${items.length > 1 ? "s" : ""} added to stock.`
      );
    } catch (tempError) {
      console.error("❌ Failed to bulk add consumables", tempError);
      setError(tempError.message || "Unable to add consumables.");
    } finally {
      setTemporarySubmitting(false);
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
      setData(payload.data || defaultData);
      setSelectedItems(new Set());
      setStatusMessage("Stock check request submitted to Workshop Management.");
    } catch (submitError) {
      console.error("❌ Failed to submit stock check", submitError);
      setError(submitError.message || "Unable to submit stock check.");
    } finally {
      setSubmitLoading(false);
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
      setMoveItemState({ id: null, locationId: "" });
      setLocationRenameState({ id: null, value: "" });
      return true;
    } catch (managerError) {
      console.error("❌ Manager action failed", managerError);
      setError(managerError.message || "Unable to update consumables.");
      return false;
    } finally {
      setManagerActionLoading(false);
    }
  };

  const handleAddLocation = async () => {
    const trimmed = (newLocationName || "").trim();
    if (!trimmed) {
      setError("Location name is required.");
      return;
    }
    setAddingLocation(true);
    const success = await handleManagerAction({ action: "createLocation", name: trimmed });
    if (success) {
      setNewLocationName("");
      setStatusMessage(`Location "${trimmed}" created.`);
    }
    setAddingLocation(false);
  };

  const handleRenameLocation = async () => {
    const trimmed = (locationRenameState.value || "").trim();
    if (!locationRenameState.id || !trimmed) {
      setError("Provide a new name for the location.");
      return;
    }
    const success = await handleManagerAction({
      action: "renameLocation",
      locationId: locationRenameState.id,
      name: trimmed,
    });
    if (success) {
      setStatusMessage("Location renamed.");
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

  const handleMoveItem = async () => {
    if (!moveItemState.id) {
      setError("Select an item to move.");
      return;
    }
    const success = await handleManagerAction({
      action: "moveConsumable",
      consumableId: moveItemState.id,
      locationId: moveItemState.locationId || null,
    });
    if (success) {
      setStatusMessage("Consumable moved.");
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

  const renderLocationHeader = (section) => {
    const consumables = section.consumables || [];
    const allSelected = consumables.every((item) => selectedItems.has(item.id));
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={allSelected && consumables.length > 0}
            onChange={() => toggleSection(section)}
          />
          {section.title}
          {section.id && isManager && (
            <button
              type="button"
              onClick={() =>
                setLocationRenameState({ id: section.id, value: section.title })
              }
              style={{ ...buttonSecondaryStyle, padding: "4px 10px" }}
            >
              Rename
            </button>
          )}
        </label>
        {section.id && locationRenameState.id === section.id && isManager && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="text"
              value={locationRenameState.value}
              onChange={(event) =>
                setLocationRenameState((previous) => ({
                  ...previous,
                  value: event.target.value,
                }))
              }
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--surface-light)",
              }}
            />
            <button
              type="button"
              onClick={handleRenameLocation}
              style={{ ...buttonPrimaryStyle, padding: "8px 14px" }}
              disabled={managerActionLoading}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setLocationRenameState({ id: null, value: "" })}
              style={{ ...buttonSecondaryStyle, padding: "8px 14px" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderConsumableRow = (item) => {
    const checked = selectedItems.has(item.id);
    const isRenaming = renameItemState.id === item.id;
    const isMoving = moveItemState.id === item.id;
    return (
      <div
        key={item.id}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "12px",
          border: "1px solid var(--surface-light)",
          borderRadius: "12px",
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
            <span>
              {item.name}
              {item.temporary && <span style={{ ...badgeStyle, marginLeft: "8px" }}>Temp</span>}
            </span>
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
                style={{ ...buttonSecondaryStyle, padding: "4px 10px" }}
                onClick={() =>
                  setMoveItemState({
                    id: item.id,
                    locationId: item.locationId || "",
                  })
                }
              >
                Move
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
                borderRadius: "8px",
                border: "1px solid var(--surface-light)",
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
        {isMoving && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              value={moveItemState.locationId}
              onChange={(event) =>
                setMoveItemState((previous) => ({
                  ...previous,
                  locationId: event.target.value,
                }))
              }
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--surface-light)",
                minWidth: "180px",
              }}
            >
              {locationOptions.map((option) => (
                <option key={option.value || "unassigned"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleMoveItem}
              style={{ ...buttonPrimaryStyle, padding: "8px 14px" }}
              disabled={managerActionLoading}
            >
              Move
            </button>
            <button
              type="button"
              onClick={() => setMoveItemState({ id: null, locationId: "" })}
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
    <div style={{ ...popupOverlayStyles, zIndex: 1400 }}>
      <div style={modalStyle} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--primary-dark)" }}>Stock Check</h2>
            <p style={{ margin: "4px 0 0", color: "var(--grey-accent-dark)" }}>
              Select consumables to request and submit them to the workshop manager.
            </p>
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

        <div style={sectionCardStyle}>
          <h3 style={{ margin: "0 0 8px", color: "var(--primary-dark)" }}>Bulk add consumables</h3>
          <p style={{ margin: "0 0 12px", color: "var(--grey-accent-dark)", fontSize: "0.9rem" }}>
            Paste each consumable on its own line starting with <strong>-</strong>. This temporary form lets you add many items at once and they remain in stock until edited or deleted.
          </p>
          <textarea
            value={temporaryInput}
            onChange={(event) => setTemporaryInput(event.target.value)}
            rows={3}
            placeholder="- blue roll\n- cable ties"
            style={{
              width: "100%",
              borderRadius: "12px",
              border: "1px solid var(--surface-light)",
              padding: "10px 12px",
              resize: "vertical",
            }}
          />
          <div style={{ marginTop: "12px", textAlign: "right" }}>
            <button
              type="button"
              onClick={handleTemporarySubmit}
              style={{ ...buttonSecondaryStyle, padding: "10px 18px" }}
              disabled={temporarySubmitting}
            >
              {temporarySubmitting ? "Adding…" : "Add Items"}
            </button>
          </div>
        </div>

        <div style={{ ...sectionCardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <h3 style={{ margin: 0, color: "var(--primary-dark)" }}>Consumable stock</h3>
            <span style={{ color: "var(--grey-accent-dark)", fontSize: "0.9rem" }}>
              {loading ? "Loading…" : `${allConsumables.length} items`}
            </span>
          </div>
          {sections.length === 0 && !loading && (
            <p style={{ margin: 0, color: "var(--info)" }}>No consumables recorded yet.</p>
          )}
          {loading && <p style={{ margin: 0, color: "var(--info)" }}>Loading stock…</p>}
          {!loading &&
            sections.map((section) => (
              <div key={section.key} style={{ display: "flex", flexDirection: "column", gap: "8px", border: "1px solid var(--surface-light)", borderRadius: "16px", padding: "12px" }}>
                {renderLocationHeader(section)}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
                  {(section.consumables || []).map((item) => renderConsumableRow(item))}
                </div>
                {(section.consumables || []).length === 0 && (
                  <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>No consumables in this location.</p>
                )}
              </div>
            ))}
        </div>

        {isManager && (
          <div style={{ ...sectionCardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ margin: 0, color: "var(--primary-dark)" }}>Manage locations</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              <input
                type="text"
                value={newLocationName}
                onChange={(event) => setNewLocationName(event.target.value)}
                placeholder="Add new location"
                style={{
                  padding: "8px 10px",
                  borderRadius: "10px",
                  border: "1px solid var(--surface-light)",
                  flex: "1 1 240px",
                }}
              />
              <button
                type="button"
                onClick={handleAddLocation}
                style={{ ...buttonPrimaryStyle, padding: "10px 16px" }}
                disabled={addingLocation}
              >
                {addingLocation ? "Adding…" : "Add Location"}
              </button>
            </div>
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
                      <th style={{ padding: "8px" }}>Location</th>
                      <th style={{ padding: "8px" }}>Submitted</th>
                      <th style={{ padding: "8px" }}>Status</th>
                      <th style={{ padding: "8px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stockChecks.map((request) => {
                      const tone = requestStatusTone[request.status] || requestStatusTone.pending;
                      return (
                        <tr key={request.id} style={{ background: "var(--surface-light)", borderRadius: "12px" }}>
                          <td style={{ padding: "8px", fontWeight: 600 }}>{request.consumableName || "—"}</td>
                          <td style={{ padding: "8px", color: "var(--grey-accent-dark)" }}>{request.technicianName || "—"}</td>
                          <td style={{ padding: "8px", color: "var(--grey-accent-dark)" }}>{request.consumableLocation || "—"}</td>
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
                                borderRadius: "999px",
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

        <div style={{ ...sectionCardStyle, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div>
            <strong style={{ color: "var(--primary-dark)", fontSize: "1rem" }}>
              {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
            </strong>
            <p style={{ margin: "4px 0 0", color: "var(--grey-accent-dark)", fontSize: "0.9rem" }}>
              Only checked consumables are included in the submission.
            </p>
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
  );
}

export default StockCheckPopup;
