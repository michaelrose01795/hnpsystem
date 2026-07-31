// file location: src/components/Consumables/StockCheckPopup.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import Button from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/searchBarAPI";

const consumableNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const modalStyle = {
  width: "min(100%, 1120px)",
  overflow: "hidden",
  padding: "clamp(16px, 2.4vw, 24px)",
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
  boxShadow: "none",
};

const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 600,
  color: "var(--text-1)",
};

const inputFieldStyle = {
  padding: "10px 12px",
  borderRadius: "var(--input-radius)",
  border: "none",
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

const headerChipBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "44px",
  padding: "0 14px",
  borderRadius: "var(--radius-sm)",
  fontSize: "0.85rem",
  fontWeight: 700,
};

const tableControlBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "var(--table-action-btn-height)",
  minHeight: "var(--table-action-btn-height)",
  padding: "0 var(--space-3)",
  borderRadius: "var(--radius-pill)",
  fontSize: "var(--text-label)",
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const tableActionButtonStyle = {
  ...tableControlBaseStyle,
  background: "var(--surface)",
  color: "var(--text-1)",
  border: "none",
  cursor: "pointer",
};

const approveActionButtonStyle = {
  ...tableActionButtonStyle,
  background: "var(--success-surface)",
  color: "var(--success-dark)",
};

const rejectActionButtonStyle = {
  ...tableActionButtonStyle,
  background: "var(--danger-surface)",
  color: "var(--danger-dark)",
};

const defaultData = { locations: [], unassigned: [], stockChecks: [] };
const MAX_SEARCH_SUGGESTIONS = 8;
const MIN_REQUEST_QUANTITY = 1;
const MAX_REQUEST_QUANTITY = 999;

const normalizeRequestQuantity = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return MIN_REQUEST_QUANTITY;
  return Math.min(MAX_REQUEST_QUANTITY, Math.max(MIN_REQUEST_QUANTITY, parsed));
};

function StockCheckPopup({
  open,
  onClose,
  addOnly = false,
  initialName = "",
  onConsumableAdded = null,
  isManager = false,
  technicianId = null,
  onRequestsSubmitted = null,
}) {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedItems, setSelectedItems] = useState(() => new Set());
  const [selectedQuantities, setSelectedQuantities] = useState({});
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
  const [newConsumableError, setNewConsumableError] = useState("");
  const [isAddConsumableOpen, setIsAddConsumableOpen] = useState(false);

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
      setSelectedQuantities((previous) => {
        const validIds = new Set(
          (nextData.locations || [])
            .flatMap((location) => location.consumables || [])
            .concat(nextData.unassigned || [])
            .map((item) => item.id)
        );
        return Object.fromEntries(
          Object.entries(previous).filter(([id]) => validIds.has(id))
        );
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
    if (open && addOnly) {
      setNewConsumableForm({ name: initialName.trim(), supplier: "", unitCost: "" });
      setNewConsumableError("");
      setIsAddConsumableOpen(true);
    }
  }, [addOnly, initialName, open]);

  useEffect(() => {
    if (!open) {
      setSelectedItems(new Set());
      setSelectedQuantities({});
      setStatusMessage("");
      setError("");
      setRenameItemState({ id: null, value: "" });
      setStockSearchInput("");
      setStockSearchQuery("");
      setShowStockList(false);
      setNewConsumableForm({ name: "", supplier: "", unitCost: "" });
      setNewConsumableLoading(false);
      setNewConsumableError("");
      setIsAddConsumableOpen(false);
      return () => {};
    }

    const handleKey = (event) => {
      if (event.key === "Escape") {
        if (isAddConsumableOpen) {
          if (addOnly) {
            closePopup();
          } else {
            setIsAddConsumableOpen(false);
          }
        } else {
          closePopup();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [addOnly, open, closePopup, isAddConsumableOpen]);

  const toggleItem = (itemId) => {
    const isSelected = selectedItems.has(itemId);
    setSelectedItems((previous) => {
      const next = new Set(previous);
      if (isSelected) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
    setSelectedQuantities((quantities) => {
      const nextQuantities = { ...quantities };
      if (isSelected) {
        delete nextQuantities[itemId];
      } else {
        nextQuantities[itemId] = quantities[itemId] || MIN_REQUEST_QUANTITY;
      }
      return nextQuantities;
    });
  };

  const updateItemQuantity = (itemId, value) => {
    const quantity = normalizeRequestQuantity(value);
    setSelectedQuantities((previous) => ({ ...previous, [itemId]: quantity }));
  };

  const handleNewConsumableChange = (field) => (event) => {
    const value = event.target.value;
    setNewConsumableForm((previous) => ({ ...previous, [field]: value }));
  };

  const openAddConsumable = useCallback(() => {
    setNewConsumableForm({
      name: stockSearchInput.trim(),
      supplier: "",
      unitCost: "",
    });
    setNewConsumableError("");
    setIsAddConsumableOpen(true);
  }, [stockSearchInput]);

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
      setNewConsumableError("Consumable name is required.");
      return;
    }
    const duplicateItem = allConsumables.find(
      (item) => (item.name || "").trim().toLowerCase() === itemName.toLowerCase()
    );
    if (duplicateItem) {
      setNewConsumableError(`"${duplicateItem.name}" is already in consumable stock.`);
      return;
    }
    const supplier = (newConsumableForm.supplier || "").trim();
    const unitCost = Number(newConsumableForm.unitCost) || 0;
    setNewConsumableLoading(true);
    setStatusMessage("");
    setNewConsumableError("");
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
      setStockSearchInput(itemName);
      setStockSearchQuery(itemName);
      setShowStockList(true);
      setNewConsumableError("");
      if (typeof onConsumableAdded === "function") {
        await onConsumableAdded({ name: itemName });
      }
      if (addOnly) {
        closePopup();
      } else {
        setIsAddConsumableOpen(false);
      }
    } catch (newItemError) {
      console.error("❌ Failed to add consumable", newItemError);
      setNewConsumableError(newItemError.message || "Unable to add consumable.");
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
          consumableSelections: Array.from(selectedItems).map((consumableId) => ({
            consumableId,
            quantity: normalizeRequestQuantity(selectedQuantities[consumableId]),
          })),
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
      setSelectedQuantities({});
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
      const quantity = normalizeRequestQuantity(selectedQuantities[item.id]);
      return `${index + 1}. ${itemName} (quantity: ${quantity})`;
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
    const quantity = normalizeRequestQuantity(selectedQuantities[item.id]);
    return (
      <div
        key={item.id}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: isRenaming ? "8px" : 0,
          padding: "0 8px",
          borderRadius: "var(--radius-sm)",
          background: checked ? "var(--theme)" : "var(--surface)",
          minHeight: "44px",
        }}
      >
        <div
          className="app-popup-compact-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            height: "44px",
            minHeight: "44px",
          }}
        >
          <label style={{ ...checkboxLabelStyle, margin: 0, minWidth: 0, flex: "1 1 auto" }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleItem(item.id)}
            />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
          </label>
          {checked && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: "0 0 auto" }}>
              <button
                type="button"
                className="app-table-action-btn"
                onClick={() => updateItemQuantity(item.id, quantity - 1)}
                disabled={quantity <= MIN_REQUEST_QUANTITY}
                aria-label={`Decrease quantity for ${item.name}`}
                style={{ width: "var(--control-height)", minWidth: "var(--control-height)", height: "var(--control-height)", minHeight: "var(--control-height)", padding: 0, background: "transparent", borderRadius: "50%" }}
              >
                <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "var(--table-action-btn-height)", height: "var(--table-action-btn-height)", borderRadius: "50%", background: "var(--surface)" }}>-</span>
              </button>
              <input
                className="app-input"
                type="number"
                min={MIN_REQUEST_QUANTITY}
                max={MAX_REQUEST_QUANTITY}
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => updateItemQuantity(item.id, event.target.value)}
                aria-label={`Quantity for ${item.name}`}
                style={{ width: "64px", height: "var(--control-height)", minHeight: "var(--control-height)", padding: "0 8px", textAlign: "center" }}
              />
              <button
                type="button"
                className="app-table-action-btn"
                onClick={() => updateItemQuantity(item.id, quantity + 1)}
                disabled={quantity >= MAX_REQUEST_QUANTITY}
                aria-label={`Increase quantity for ${item.name}`}
                style={{ width: "var(--control-height)", minWidth: "var(--control-height)", height: "var(--control-height)", minHeight: "var(--control-height)", padding: 0, background: "transparent", borderRadius: "50%" }}
              >
                <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "var(--table-action-btn-height)", height: "var(--table-action-btn-height)", borderRadius: "50%", background: "var(--surface)" }}>+</span>
              </button>
            </div>
          )}
          {isManager && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() =>
                  setRenameItemState({ id: item.id, value: item.name || "" })
                }
              >
                Rename
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => handleDeleteItem(item.id, item.name)}
              >
                Delete
              </Button>
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
            <Button
              type="button"
              onClick={handleRenameItem}
              variant="primary"
              size="sm"
              disabled={managerActionLoading}
            >
              Save
            </Button>
            <Button
              type="button"
              onClick={() => setRenameItemState({ id: null, value: "" })}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
    <PopupModal
      isOpen={open && !addOnly}
      onClose={closePopup}
      closeOnBackdrop={false}
      ariaLabel="Stock Check"
      cardStyle={modalStyle}
    >
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
            className="app-popup-compact-header__actions"
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
                ...headerChipBaseStyle,
                background: "rgba(var(--accent-base-rgb), 0.14)",
                color: "var(--text-1)",
              }}
            >
              {totalItems} stock items
            </span>
            <span
              style={{
                ...headerChipBaseStyle,
                background: pendingRequestCount
                  ? "rgba(var(--warning-rgb), 0.18)"
                  : "rgba(var(--success-rgb), 0.16)",
                color: pendingRequestCount ? "var(--warning-dark)" : "var(--success-dark)",
              }}
            >
              {pendingRequestCount} pending
            </span>
            <span
              style={{
                ...headerChipBaseStyle,
                background: selectedCount ? "rgba(var(--accent-base-rgb), 0.16)" : "rgba(var(--text-1-rgb), 0.08)",
                color: "var(--text-1)",
              }}
            >
              {selectedCount} selected
            </span>
            <Button
              type="button"
              onClick={() => setSelectedItems(new Set())}
              variant="secondary"
              size="sm"
            >
              Clear Selection
            </Button>
            <Button
              type="button"
              onClick={handleEmailSelectedItems}
              variant="secondary"
              size="sm"
              disabled={!selectedCount}
            >
              Email
            </Button>
            <Button
              type="button"
              onClick={handleSubmitRequest}
              variant="primary"
              size="sm"
              disabled={submitLoading || !selectedCount}
            >
              {submitLoading ? "Submitting…" : "Submit Stock Check Request"}
            </Button>
            <Button
              type="button"
              onClick={closePopup}
              variant="ghost"
              size="sm"
              style={{ width: "44px" }}
              aria-label="Close stock check"
            >
              ✕
            </Button>
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
                  background: "var(--success-surface)",
                }}
              >
                <strong style={{ color: "var(--success-dark)" }}>{statusMessage}</strong>
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
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
                  width: "100%",
                  order: 2,
                }}
              >
              <div style={{ ...subtleSectionStyle, display: "flex", flexDirection: "column", gap: "12px", order: 1 }}>
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
                                  className="app-table-action-btn"
                                  style={{
                                    ...tableControlBaseStyle,
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
                                      className="app-table-action-btn"
                                      type="button"
                                      onClick={() => handleRequestStatusUpdate(request.id, "approved")}
                                      disabled={requestUpdateId === request.id}
                                      style={approveActionButtonStyle}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      className="app-table-action-btn"
                                      type="button"
                                      onClick={() => handleRequestStatusUpdate(request.id, "rejected")}
                                      disabled={requestUpdateId === request.id}
                                      style={rejectActionButtonStyle}
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

            <div style={{ ...subtleSectionStyle, display: "flex", flexDirection: "column", gap: "12px", flex: "1.35 1 420px", minWidth: "320px", width: "100%", order: 1 }}>
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
                      flex: "1 1 220px",
                      minWidth: "200px",
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => applyStockSearch()}
                    variant="primary"
                    disabled={loading || totalItems === 0}
                  >
                    Search
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowStockList((previous) => !previous)}
                    variant="secondary"
                    disabled={totalItems === 0}
                  >
                    {showStockList && !hasAppliedSearch ? "Hide list" : "Show list"}
                  </Button>
                  <Button type="button" onClick={openAddConsumable} variant="secondary">
                    Add New
                  </Button>
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                      <p style={{ margin: 0, ...mutedTextStyle }}>
                        No matching consumables found. Select Add to create this item.
                      </p>
                      <Button type="button" onClick={openAddConsumable} variant="secondary" size="sm">
                        Add &quot;{stockSearchInput.trim()}&quot;
                      </Button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {searchSuggestions.map((item) => (
                        <Button
                          key={item.id}
                          type="button"
                          onClick={() => applyStockSearch(item.name || "")}
                          variant="secondary"
                          size="sm"
                        >
                          {item.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!shouldShowStockList ? null : loading ? (
                <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.72 }}>Loading stock...</p>
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

    </PopupModal>
    <PopupModal
      isOpen={open && (addOnly || isAddConsumableOpen)}
      onClose={() => addOnly ? closePopup() : setIsAddConsumableOpen(false)}
      closeOnBackdrop={false}
      ariaLabel="Add new consumable"
      cardStyle={{ width: "min(100%, 680px)", padding: "var(--section-card-padding)" }}
    >
      <form onSubmit={handleNewConsumableSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}>
        <div className="app-popup-compact-header">
          <h2 style={sectionHeadingStyle}>Add new consumable</h2>
          <div className="app-popup-compact-header__actions">
            <Button type="submit" busy={newConsumableLoading} variant="primary" size="sm">
              Add Consumable
            </Button>
            <Button type="button" onClick={() => addOnly ? closePopup() : setIsAddConsumableOpen(false)} variant="secondary" size="sm">
              Close
            </Button>
          </div>
        </div>
        {newConsumableError && (
          <p style={{ margin: 0, color: "var(--danger)", fontWeight: 700 }} role="alert">
            {newConsumableError}
          </p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--layout-card-gap)" }}>
          <label style={{ fontWeight: 600, color: "var(--text-1)", display: "flex", flexDirection: "column", gap: "6px" }}>
            Item name
            <input className="app-input" type="text" value={newConsumableForm.name} onChange={handleNewConsumableChange("name")} placeholder="e.g. nitrile gloves" required autoFocus />
          </label>
          <label style={{ fontWeight: 600, color: "var(--text-1)", display: "flex", flexDirection: "column", gap: "6px" }}>
            Default supplier
            <input className="app-input" type="text" value={newConsumableForm.supplier} onChange={handleNewConsumableChange("supplier")} placeholder="Optional supplier" />
          </label>
          <label style={{ fontWeight: 600, color: "var(--text-1)", display: "flex", flexDirection: "column", gap: "6px" }}>
            Default unit cost (£)
            <input className="app-input" type="number" min="0" step="0.01" value={newConsumableForm.unitCost} onChange={handleNewConsumableChange("unitCost")} placeholder="0.00" />
          </label>
        </div>
      </form>
    </PopupModal>
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
