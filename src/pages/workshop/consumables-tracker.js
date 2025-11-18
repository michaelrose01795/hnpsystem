"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import Link from "next/link";
import { addConsumableOrder, listConsumablesForTracker } from "@/lib/database/consumables";

const containerStyle = {
  flex: 1,
  height: "100%",
  display: "flex",
  flexDirection: "column",
  padding: "8px 16px",
  overflow: "hidden",
};

const workspaceShellStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  borderRadius: "24px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  border: "1px solid #ffe5e5",
  background: "linear-gradient(to bottom right, #ffffff, #fff9f9, #ffecec)",
  padding: "24px",
  minHeight: 0,
  overflow: "hidden",
};

const mainColumnStyle = {
  flex: 3,
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  minHeight: 0,
  minWidth: 0,
  overflowY: "auto",
  paddingRight: "8px",
};

const cardStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 18px 30px rgba(209,0,0,0.12)",
  border: "1px solid #ffe3e3",
};

const sectionTitleStyle = {
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "#b10000",
  marginBottom: "12px",
};

const badgeBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "0.75rem",
  fontWeight: 600,
};

const budgetInputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #ffb3b3",
  fontSize: "0.95rem",
};

const orderHistoryGridTemplate = "minmax(150px, 2fr) repeat(5, minmax(90px, 1fr))";

const orderHistoryContainerStyle = {
  marginTop: "12px",
  borderRadius: "12px",
  border: "1px solid #ffe0e0",
  background: "#fff",
  padding: "12px",
  maxHeight: "190px",
  overflowY: "auto",
};

const scheduledTableBodyStyle = {
  maxHeight: "calc(5 * 62px)",
  overflowY: "auto",
};

const orderHistoryHeaderStyle = {
  display: "grid",
  gridTemplateColumns: orderHistoryGridTemplate,
  gap: "12px",
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#a00000",
  marginBottom: "8px",
};

const orderHistoryRowBorder = "1px solid rgba(209,0,0,0.1)";

const orderHistoryRowStyle = {
  display: "grid",
  gridTemplateColumns: orderHistoryGridTemplate,
  gap: "12px",
  alignItems: "center",
  fontSize: "0.9rem",
  color: "#444",
  padding: "8px 0",
  borderBottom: orderHistoryRowBorder,
};

const orderModalOverlayStyle = {
  position: "fixed",
  inset: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "16px",
  backgroundColor: "rgba(0,0,0,0.55)",
  zIndex: 20,
};

const orderModalStyle = {
  background: "#ffffff",
  borderRadius: "18px",
  padding: "24px",
  width: "100%",
  maxWidth: "520px",
  boxShadow: "0 20px 45px rgba(0,0,0,0.25)",
  border: "1px solid #ffdede",
  position: "relative",
};

const orderModalCloseButtonStyle = {
  position: "absolute",
  top: "12px",
  right: "12px",
  background: "transparent",
  border: "none",
  fontSize: "1rem",
  color: "#a00000",
  cursor: "pointer",
};

const orderModalButtonStyle = {
  padding: "10px 20px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  boxShadow: "0 10px 20px rgba(209,0,0,0.15)",
};

const orderModalSecondaryButtonStyle = {
  ...orderModalButtonStyle,
  background: "#ffffff",
  border: "1px solid #ffdede",
  color: "#a00000",
  boxShadow: "none",
};

const orderModalFormGroupStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  marginBottom: "12px",
};

const orderModalInputStyle = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid #ffdede",
};

const orderButtonStyle = {
  padding: "8px 16px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #d10000, #940000)",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 10px 18px rgba(209,0,0,0.18)",
};
function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return "—";
  }

  return `£${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getConsumableStatus({ nextEstimatedOrderDate, isRequired }) {
  if (isRequired === false) {
    return { label: "Not Required", tone: "safe" };
  }

  if (!nextEstimatedOrderDate) {
    return { label: "Not Required", tone: "safe" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextDate = new Date(nextEstimatedOrderDate);
  nextDate.setHours(0, 0, 0, 0);

  if (Number.isNaN(nextDate.getTime())) {
    return { label: "Not Required", tone: "safe" };
  }

  if (nextDate < today) {
    return { label: "Overdue", tone: "danger" };
  }

  const diffDays = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
  if (diffDays <= 14) {
    return { label: "Coming Up", tone: "warning" };
  }

  return { label: "Not Required", tone: "safe" };
}

function toneToStyles(tone) {
  if (tone === "danger") {
    return {
      ...badgeBaseStyle,
      backgroundColor: "rgba(209,0,0,0.12)",
      color: "#a00000",
      border: "1px solid rgba(209,0,0,0.35)",
    };
  }
  if (tone === "warning") {
    return {
      ...badgeBaseStyle,
      backgroundColor: "rgba(255,172,0,0.16)",
      color: "#b06000",
      border: "1px solid rgba(255,172,0,0.35)",
    };
  }

  return {
    ...badgeBaseStyle,
    backgroundColor: "rgba(0,176,112,0.12)",
    color: "#007a4e",
    border: "1px solid rgba(0,176,112,0.35)",
  };
}

const duplicateOverlayStyle = {
  position: "fixed",
  inset: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "rgba(0,0,0,0.45)",
  zIndex: 10,
  padding: "16px",
};

const duplicateModalStyle = {
  background: "#ffffff",
  borderRadius: "18px",
  padding: "24px",
  maxWidth: "540px",
  width: "100%",
  boxShadow: "0 20px 45px rgba(0,0,0,0.25)",
  border: "1px solid #ffdede",
};

function ConsumablesTrackerPage() {
  const { user, dbUserId } = useUser();
  const userRoles = user?.roles?.map((role) => role.toLowerCase()) || [];
  const isWorkshopManager = userRoles.includes("workshop manager");
  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(
    () => new Date().getMonth() + 1
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [financialSummary, setFinancialSummary] = useState({
    monthSpend: 0,
    projectedSpend: 0,
    monthlyBudget: 0,
    budgetUpdatedAt: null,
  });
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialError, setFinancialError] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetSaveError, setBudgetSaveError] = useState("");
  const [budgetSaveMessage, setBudgetSaveMessage] = useState("");
  const [newItemForm, setNewItemForm] = useState({
    name: "",
    supplier: "",
    unitCost: "",
  });
  const [newItemLoading, setNewItemLoading] = useState(false);
  const [newItemError, setNewItemError] = useState("");
  const [newItemSuccess, setNewItemSuccess] = useState("");
  const [consumables, setConsumables] = useState([]);
  const [potentialDuplicates, setPotentialDuplicates] = useState([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [loadingConsumables, setLoadingConsumables] = useState(false);
  const [consumablesError, setConsumablesError] = useState("");
  const [techRequests, setTechRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  const [orderingRequestId, setOrderingRequestId] = useState(null);
  const isMountedRef = useRef(true);
  const [orderModalConsumable, setOrderModalConsumable] = useState(null);
  const [orderModalError, setOrderModalError] = useState("");
  const [orderModalLoading, setOrderModalLoading] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [orderForm, setOrderForm] = useState({
    quantity: "",
    unitCost: "",
    supplier: "",
    orderDate: todayIso,
  });
  const statusNotificationCacheRef = useRef(new Map());
  const statusNotificationPendingRef = useRef(new Map());

  const refreshConsumables = useCallback(async () => {
    if (!isWorkshopManager) {
      setConsumables([]);
      setPotentialDuplicates([]);
      setShowDuplicateModal(false);
      return;
    }

    setLoadingConsumables(true);

    try {
      const { items, potentialDuplicates: duplicates } = await listConsumablesForTracker();
      if (!isMountedRef.current) {
        return;
      }

      setConsumables(items);
      setPotentialDuplicates(duplicates);
      setShowDuplicateModal(duplicates.length > 0);
      setConsumablesError("");
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      console.error("❌ Failed to load consumables", error);
      setConsumables([]);
      setPotentialDuplicates([]);
      setShowDuplicateModal(false);
      setConsumablesError(error?.message || "Unable to load consumables.");
    } finally {
      if (isMountedRef.current) {
        setLoadingConsumables(false);
  }
}

function normalizeConsumableName(value) {
  return (value || "").trim().toLowerCase();
}

function compactConsumableKey(value) {
  return normalizeConsumableName(value).replace(/\s+/g, "");
}
  }, [isWorkshopManager]);

  useEffect(() => {
    isMountedRef.current = true;
    refreshConsumables();
    return () => {
      isMountedRef.current = false;
    };
  }, [isWorkshopManager, refreshConsumables]);

  const fetchTechRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError("");

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

      setTechRequests(payload.data || []);
    } catch (error) {
      console.error("❌ Failed to load consumable requests", error);
      setRequestsError(error?.message || "Unable to load requests.");
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTechRequests();
  }, [fetchTechRequests]);

  const handleRequestOrdered = useCallback(
    async (requestId) => {
      if (!requestId) {
        return;
      }

      setOrderingRequestId(requestId);
      try {
        const response = await fetch("/api/workshop/consumables/requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: requestId, status: "ordered" }),
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

        setTechRequests(payload.data || []);
      } catch (error) {
        console.error("❌ Failed to update consumable request", error);
        setRequestsError(error?.message || "Unable to update request.");
      } finally {
        setOrderingRequestId(null);
      }
    },
    []
  );

  const currentMonthNumber = useMemo(() => new Date().getMonth() + 1, []);
  const currentYearNumber = useMemo(() => new Date().getFullYear(), []);
  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth - 1).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      }),
    [viewMonth, viewYear]
  );
  const canAdvanceToNextMonth = useMemo(
    () =>
      viewYear < currentYearNumber ||
      (viewYear === currentYearNumber && viewMonth < currentMonthNumber),
    [viewYear, viewMonth, currentMonthNumber, currentYearNumber]
  );
  const formattedBudgetUpdatedAt = useMemo(() => {
    if (!financialSummary.budgetUpdatedAt) {
      return null;
    }
    const parsed = new Date(financialSummary.budgetUpdatedAt);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [financialSummary.budgetUpdatedAt]);

  const fetchFinancialSummary = useCallback(async () => {
    setFinancialLoading(true);
    setFinancialError("");

    try {
      const response = await fetch(
        `/api/workshop/consumables/financials?year=${viewYear}&month=${viewMonth}`
      );
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Unable to load financial summary." }));
        throw new Error(body.message || "Unable to load financial summary.");
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to load financial summary.");
      }

      const { monthSpend, projectedSpend, monthlyBudget, budgetUpdatedAt } =
        payload.data || {};
      setFinancialSummary({
        monthSpend: Number(monthSpend) || 0,
        projectedSpend: Number(projectedSpend) || 0,
        monthlyBudget: Number(monthlyBudget) || 0,
        budgetUpdatedAt: budgetUpdatedAt || null,
      });
    } catch (error) {
      console.error("❌ Failed to load financial summary", error);
      setFinancialError(error?.message || "Unable to load consumable finances.");
    } finally {
      setFinancialLoading(false);
    }
  }, [viewMonth, viewYear]);

  useEffect(() => {
    fetchFinancialSummary();
  }, [fetchFinancialSummary]);

  useEffect(() => {
    if (
      financialSummary.monthlyBudget !== undefined &&
      financialSummary.monthlyBudget !== null
    ) {
      setBudgetInput(String(financialSummary.monthlyBudget));
    } else {
      setBudgetInput("");
    }
  }, [financialSummary.monthlyBudget]);

  const handleBudgetInputChange = useCallback((event) => {
    setBudgetInput(event.target.value);
    setBudgetSaveError("");
    setBudgetSaveMessage("");
  }, []);

  const handleMonthChange = useCallback(
    (offset) => {
      const candidate = new Date(viewYear, viewMonth - 1 + offset, 1);
      setViewYear(candidate.getFullYear());
      setViewMonth(candidate.getMonth() + 1);
    },
    [viewMonth, viewYear]
  );

  const handleBudgetSave = useCallback(async () => {
    setBudgetSaving(true);
    setBudgetSaveError("");
    setBudgetSaveMessage("");
    const parsed = Number(budgetInput);
    if (Number.isNaN(parsed) || parsed < 0) {
      setBudgetSaveError("Enter a valid budget amount.");
      setBudgetSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/workshop/consumables/financials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: viewYear,
          month: viewMonth,
          budget: parsed,
          updatedBy: dbUserId,
        }),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Unable to save budget." }));
        throw new Error(body.message || "Unable to save budget.");
      }

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to save budget.");
      }

      const { monthSpend, projectedSpend, monthlyBudget, budgetUpdatedAt } =
        payload.data || {};
      setFinancialSummary({
        monthSpend: Number(monthSpend) || 0,
        projectedSpend: Number(projectedSpend) || 0,
        monthlyBudget: Number(monthlyBudget) || 0,
        budgetUpdatedAt: budgetUpdatedAt || null,
      });
      setBudgetSaveMessage("Budget saved.");
    } catch (error) {
      console.error("❌ Failed to save monthly budget", error);
      setBudgetSaveError(error?.message || "Unable to save budget.");
    } finally {
      setBudgetSaving(false);
    }
  }, [budgetInput, viewMonth, viewYear, dbUserId]);

  const similarConsumableNames = useMemo(() => {
    const rawName = newItemForm.name || "";
    const normalizedCandidate = normalizeConsumableName(rawName);
    if (!normalizedCandidate) {
      return [];
    }
    const candidateKey = compactConsumableKey(normalizedCandidate);
    if (!candidateKey) {
      return [];
    }

    return consumables
      .map((item) => item.name)
      .filter((existing) => {
        if (!existing) {
          return false;
        }
        const existingKey = compactConsumableKey(existing);
        if (!existingKey) {
          return false;
        }
        if (existingKey === candidateKey) {
          return true;
        }
        if (candidateKey.length >= 3 && existingKey.includes(candidateKey)) {
          return true;
        }
        if (existingKey.length >= 3 && candidateKey.includes(existingKey)) {
          return true;
        }
        return false;
      });
  }, [newItemForm.name, consumables]);

  const hasSimilarConsumables = similarConsumableNames.length > 0;

  const handleNewItemChange = useCallback((field) => (event) => {
    setNewItemForm((previous) => ({ ...previous, [field]: event.target.value }));
    setNewItemError("");
    setNewItemSuccess("");
  }, []);

  const handleNewItemSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      const itemName = (newItemForm.name || "").trim();
      if (!itemName) {
        setNewItemError("Item name is required.");
        return;
      }
      const unitCost = Number(newItemForm.unitCost) || 0;
      setNewItemLoading(true);
      setNewItemError("");
      setNewItemSuccess("");

      try {
        const response = await fetch("/api/workshop/consumables/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: itemName,
            supplier: (newItemForm.supplier || "").trim() || null,
            unitCost,
          }),
        });

        if (!response.ok) {
          const body = await response
            .json()
            .catch(() => ({ message: "Unable to add consumable." }));
          throw new Error(body.message || "Unable to add consumable.");
        }

        setNewItemForm({ name: "", supplier: "", unitCost: "" });
        setNewItemSuccess("Consumable added.");
        await refreshConsumables();
      } catch (error) {
        console.error("❌ Failed to add consumable", error);
        setNewItemError(error?.message || "Unable to add consumable.");
      } finally {
        setNewItemLoading(false);
      }
    },
    [newItemForm, refreshConsumables]
  );

  const sendConsumableStatusNotification = useCallback(
    async (item, statusLabel) => {
      try {
        const response = await fetch("/api/messages/system-notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consumableId: item.id,
            name: item.name,
            status: statusLabel,
            nextEstimatedOrderDate: item.nextEstimatedOrderDate,
            estimatedQuantity: item.estimatedQuantity,
          }),
        });

        if (!response.ok) {
          const errorBody = await response
            .json()
            .catch(() => ({ message: "Unable to report status." }));
          throw new Error(errorBody.message || "Failed to notify the Message Centre.");
        }
      } catch (error) {
        console.error("❌ Unable to send consumable status notification:", error);
      }
    },
    []
  );

  useEffect(() => {
    if (loadingConsumables) {
      return;
    }
    consumables.forEach((item) => {
      const status = getConsumableStatus(item);
      const currentStatus = statusNotificationCacheRef.current.get(item.id);
      const pendingStatus = statusNotificationPendingRef.current.get(item.id);

      if (status.label === "Overdue" || status.label === "Coming Up") {
        if (currentStatus === status.label || pendingStatus === status.label) {
          return;
        }

        statusNotificationPendingRef.current.set(item.id, status.label);
        sendConsumableStatusNotification(item, status.label)
          .then(() => {
            statusNotificationCacheRef.current.set(item.id, status.label);
          })
          .finally(() => {
            statusNotificationPendingRef.current.delete(item.id);
          });
        return;
      }

      statusNotificationCacheRef.current.delete(item.id);
    });
  }, [consumables, loadingConsumables, sendConsumableStatusNotification]);

  const totals = useMemo(() => {
    const monthSpend = Number(financialSummary.monthSpend) || 0;
    const projectedSpend = Number(financialSummary.projectedSpend) || 0;
    const monthlyBudget = Number(financialSummary.monthlyBudget) || 0;
    return {
      monthSpend,
      projectedSpend,
      monthlyBudget,
      budgetRemaining: monthlyBudget - monthSpend,
    };
  }, [financialSummary]);

  const filteredConsumables = useMemo(() => {
    const term = (searchQuery || "").trim().toLowerCase();
    if (!term) {
      return consumables;
    }
    return consumables.filter((item) => {
      const candidateValues = [
        item.name,
        formatDate(item.lastOrderDate),
        formatDate(item.nextEstimatedOrderDate),
        item.supplier,
        item.unitCost,
        item.lastOrderTotalValue,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return candidateValues.some((value) => value.includes(term));
    });
  }, [consumables, searchQuery]);

  const closeOrderModal = useCallback(() => {
    setOrderModalConsumable(null);
    setShowEditForm(false);
    setOrderModalError("");
  }, []);

  const openOrderModal = useCallback(
    (item) => {
      if (!item) {
        return;
      }
      const lastLog = item.orderHistory?.[0];
      const baseQuantity =
        lastLog?.quantity ?? item.lastOrderQuantity ?? item.estimatedQuantity ?? "";
      const baseUnitCost =
        lastLog?.unitCost ??
        (item.unitCost !== undefined && item.unitCost !== null
          ? item.unitCost
          : "");

      setOrderModalConsumable(item);
      setOrderForm({
        quantity: baseQuantity !== "" ? String(baseQuantity) : "",
        unitCost:
          baseUnitCost !== "" && baseUnitCost !== null && baseUnitCost !== undefined
            ? Number(baseUnitCost).toFixed(2)
            : "",
        supplier: lastLog?.supplier ?? item.supplier ?? "",
        orderDate: todayIso,
      });
      setShowEditForm(false);
      setOrderModalError("");
    },
    [todayIso]
  );

  const handleOrderFormChange = useCallback((field) => (event) => {
    setOrderForm((previous) => ({ ...previous, [field]: event.target.value }));
  }, []);

  const handleSameDetails = useCallback(async () => {
    if (!orderModalConsumable) {
      return;
    }

    setOrderModalLoading(true);
    setOrderModalError("");

    const lastLog = orderModalConsumable.orderHistory?.[0];
    const payload = {
      quantity:
        lastLog?.quantity ??
        orderModalConsumable.lastOrderQuantity ??
        orderModalConsumable.estimatedQuantity ??
        0,
      unitCost: lastLog?.unitCost ?? orderModalConsumable.unitCost ?? 0,
      supplier: lastLog?.supplier ?? orderModalConsumable.supplier ?? "",
      orderDate: todayIso,
    };

    try {
      await addConsumableOrder(orderModalConsumable.id, payload);
      await refreshConsumables();
      closeOrderModal();
    } catch (error) {
      setOrderModalError(error?.message || "Failed to place order.");
    } finally {
      setOrderModalLoading(false);
    }
  }, [closeOrderModal, orderModalConsumable, refreshConsumables, todayIso]);

  const handleEditedOrder = useCallback(
    async (event) => {
      event.preventDefault();
      if (!orderModalConsumable) {
        return;
      }

      setOrderModalLoading(true);
      setOrderModalError("");

      const payload = {
        quantity: Number(orderForm.quantity) || 0,
        unitCost: Number(orderForm.unitCost) || 0,
        supplier: orderForm.supplier?.trim() || "",
        orderDate: orderForm.orderDate || todayIso,
      };

      try {
        await addConsumableOrder(orderModalConsumable.id, {
          ...payload,
          estimatedQuantityOverride: payload.quantity,
        });
        await refreshConsumables();
        closeOrderModal();
      } catch (error) {
        setOrderModalError(error?.message || "Failed to place order.");
      } finally {
        setOrderModalLoading(false);
      }
    },
    [
      closeOrderModal,
      orderForm,
      orderModalConsumable,
      refreshConsumables,
      todayIso,
    ]
  );

  const previewLogs = orderModalConsumable?.orderHistory?.slice(0, 3) ?? [];

  if (!isWorkshopManager) {
    return (
      <Layout>
        <div style={{ padding: "40px", maxWidth: "720px", margin: "0 auto" }}>
          <div style={{ ...cardStyle, textAlign: "center" }}>
            <h1 style={{ color: "#a00000", marginBottom: "16px" }}>
              Workshop Manager Access Only
            </h1>
            <p style={{ marginBottom: "16px", color: "#444" }}>
              This consumables tracker is limited to workshop management roles. If
              you believe you should have access please contact the systems
              administrator.
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
      <div style={containerStyle}>
        <div style={workspaceShellStyle}>
          {!orderModalConsumable && showDuplicateModal && potentialDuplicates.length > 0 && (
            <div style={duplicateOverlayStyle}>
              <div style={duplicateModalStyle}>
                <h3 style={{ margin: 0, color: "#b10000" }}>
                  Potential Duplicate Consumables
                </h3>
                <p style={{ color: "#444", marginTop: "8px" }}>
                  We detected items that resolve to the same name when
                  normalised. They have been grouped into a single record for
                  this view; please tidy the source data if these should remain
                  separate.
                </p>
                <ul style={{ paddingLeft: "20px", color: "#4a4a4a" }}>
                  {potentialDuplicates.map((entry) => (
                    <li key={entry.normalized} style={{ marginBottom: "6px" }}>
                      {entry.names.join(" / ")}
                    </li>
                  ))}
                </ul>
                <div style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => setShowDuplicateModal(false)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #d10000, #940000)",
                      color: "#ffffff",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 12px 22px rgba(209,0,0,0.2)",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
          {orderModalConsumable && (
            <div style={orderModalOverlayStyle}>
              <div style={orderModalStyle} role="dialog" aria-modal="true">
                <button
                  type="button"
                  onClick={closeOrderModal}
                  style={orderModalCloseButtonStyle}
                  aria-label="Close order modal"
                >
                  ✕
                </button>
                <h3 style={{ margin: "0 0 6px", color: "#b10000" }}>
                  Order {orderModalConsumable.name}
                </h3>
                <p style={{ margin: "0 8px 16px", color: "#444" }}>
                  Previous orders (latest three). "Same Details" will reuse the
                  most recent order, while "Edit Details" lets you adjust the
                  quantity, unit cost, supplier, or date before logging a new entry.
                </p>
                <div style={orderHistoryContainerStyle}>
                  <div style={orderHistoryHeaderStyle}>
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Unit</span>
                    <span>Total</span>
                    <span>Supplier</span>
                    <span>Date</span>
                  </div>
                  {previewLogs.length === 0 ? (
                    <p style={{ margin: 0, color: "#6b7280" }}>
                      No previous orders logged.
                    </p>
                  ) : (
                    previewLogs.map((log, index) => {
                      const isLastLog = index === previewLogs.length - 1;
                      return (
                        <div
                          key={`modal-log-${index}`}
                          style={{
                            ...orderHistoryRowStyle,
                            borderBottom: isLastLog
                              ? "none"
                              : orderHistoryRowBorder,
                          }}
                        >
                          <span>{log.itemName || orderModalConsumable.name}</span>
                          <span>
                            {log.quantity ? log.quantity.toLocaleString() : "—"}
                          </span>
                          <span>{formatCurrency(log.unitCost)}</span>
                          <span>{formatCurrency(log.totalCost)}</span>
                          <span>{log.supplier || "—"}</span>
                          <span>{formatDate(log.date)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginTop: "20px",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleSameDetails}
                    disabled={orderModalLoading}
                    style={{
                      ...orderModalButtonStyle,
                      background: orderModalLoading
                        ? "rgba(209,0,0,0.4)"
                        : "linear-gradient(135deg, #d10000, #940000)",
                      color: "#ffffff",
                    }}
                  >
                    {orderModalLoading ? "Ordering…" : "Same Details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditForm((previous) => !previous)}
                    style={orderModalSecondaryButtonStyle}
                  >
                    {showEditForm ? "Hide Form" : "Edit Details"}
                  </button>
                </div>
                {orderModalError && (
                  <p style={{ color: "#a00000", marginTop: "12px" }}>
                    {orderModalError}
                  </p>
                )}
                {showEditForm && (
                  <form onSubmit={handleEditedOrder} style={{ marginTop: "16px" }}>
                    <div style={orderModalFormGroupStyle}>
                      <label style={{ fontWeight: 600, color: "#b10000" }}>
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={orderForm.quantity}
                        onChange={handleOrderFormChange("quantity")}
                        style={orderModalInputStyle}
                        required
                      />
                    </div>
                    <div style={orderModalFormGroupStyle}>
                      <label style={{ fontWeight: 600, color: "#b10000" }}>
                        Unit Cost (£)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={orderForm.unitCost}
                        onChange={handleOrderFormChange("unitCost")}
                        style={orderModalInputStyle}
                        required
                      />
                    </div>
                    <div style={orderModalFormGroupStyle}>
                      <label style={{ fontWeight: 600, color: "#b10000" }}>
                        Supplier
                      </label>
                      <input
                        type="text"
                        value={orderForm.supplier}
                        onChange={handleOrderFormChange("supplier")}
                        style={orderModalInputStyle}
                      />
                    </div>
                    <div style={orderModalFormGroupStyle}>
                      <label style={{ fontWeight: 600, color: "#b10000" }}>
                        Order Date
                      </label>
                      <input
                        type="date"
                        value={orderForm.orderDate}
                        onChange={handleOrderFormChange("orderDate")}
                        style={orderModalInputStyle}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={orderModalLoading}
                      style={{
                        ...orderModalButtonStyle,
                        width: "100%",
                        background: orderModalLoading
                          ? "rgba(209,0,0,0.4)"
                          : "linear-gradient(135deg, #d10000, #940000)",
                        color: "#ffffff",
                      }}
                    >
                      {orderModalLoading ? "Submitting…" : "Save Details"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
          <div style={mainColumnStyle}>
            <div style={{ ...cardStyle }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#b10000" }}>
                    Workshop Consumables Tracker
                  </h1>
                  <p style={{ marginTop: "6px", color: "#666" }}>
                    Monitor consumable spend, reorder schedules, and supplier summaries.
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#888" }}>
                    Budget for {monthLabel}
                  </p>
                  <strong style={{ fontSize: "1.4rem", color: "#b10000" }}>
                    {financialLoading
                      ? "Loading…"
                      : formatCurrency(totals.monthlyBudget)}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  marginTop: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleMonthChange(-1)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "10px",
                      border: "1px solid #d10000",
                      background: "#fff",
                      color: "#b10000",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ← Previous
                  </button>
                  <span
                    style={{
                      fontWeight: 600,
                      color: "#a00000",
                    }}
                  >
                    {monthLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleMonthChange(1)}
                    disabled={!canAdvanceToNextMonth}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "10px",
                      border: "1px solid #d10000",
                      background: canAdvanceToNextMonth
                        ? "#fff"
                        : "rgba(209,0,0,0.2)",
                      color: canAdvanceToNextMonth ? "#b10000" : "#a00000",
                      fontWeight: 600,
                      cursor: canAdvanceToNextMonth ? "pointer" : "not-allowed",
                    }}
                  >
                    Next →
                  </button>
                </div>
                {financialError && (
                  <p style={{ margin: 0, color: "#a00000" }}>{financialError}</p>
                )}
              </div>
            </div>

            <div style={{ ...cardStyle, marginTop: "20px" }}>
              <h2 style={sectionTitleStyle}>Add New Consumable</h2>
              <p style={{ marginTop: "0", color: "#666" }}>
                Add a consumable to the tracker so you can schedule future orders.
              </p>
              <form
                onSubmit={handleNewItemSubmit}
                style={{
                  marginTop: "12px",
                  display: "grid",
                  gap: "12px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <label style={{ fontWeight: 600, color: "#b10000" }}>
                  Item Name
                  <input
                    type="text"
                    value={newItemForm.name}
                    onChange={handleNewItemChange("name")}
                    style={{
                      ...budgetInputStyle,
                      marginTop: "6px",
                      padding: "8px 10px",
                    }}
                    required
                  />
                </label>
                <label style={{ fontWeight: 600, color: "#b10000" }}>
                  Default Supplier
                  <input
                    type="text"
                    value={newItemForm.supplier}
                    onChange={handleNewItemChange("supplier")}
                    style={{
                      ...budgetInputStyle,
                      marginTop: "6px",
                      padding: "8px 10px",
                    }}
                  />
                </label>
                <label style={{ fontWeight: 600, color: "#b10000" }}>
                  Default Unit Cost (£)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItemForm.unitCost}
                    onChange={handleNewItemChange("unitCost")}
                    style={{
                      ...budgetInputStyle,
                      marginTop: "6px",
                      padding: "8px 10px",
                    }}
                  />
                </label>
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <button
                    type="submit"
                    disabled={newItemLoading}
                    style={{
                      ...orderModalButtonStyle,
                      width: "auto",
                      background: newItemLoading
                        ? "rgba(209,0,0,0.4)"
                        : "linear-gradient(135deg, #d10000, #940000)",
                      color: "#ffffff",
                    }}
                  >
                    {newItemLoading ? "Adding…" : "Add Consumable"}
                  </button>
                  {hasSimilarConsumables && (
                    <p
                      style={{
                        margin: 0,
                        color: "#a00000",
                        fontSize: "0.85rem",
                      }}
                    >
                      Similar item(s) already exist:{" "}
                      {similarConsumableNames.join(", ")}.
                    </p>
                  )}
                </div>
              </form>
              {newItemError && (
                <p style={{ margin: "8px 0 0", color: "#a00000" }}>
                  {newItemError}
                </p>
              )}
              {newItemSuccess && (
                <p style={{ margin: "8px 0 0", color: "#007a4e" }}>
                  {newItemSuccess}
                </p>
              )}
            </div>

              <div
                style={{
                  marginTop: "20px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    ...cardStyle,
                    padding: "16px",
                    boxShadow: "none",
                    border: "1px dashed #ffd0d0",
                  }}
                >
                  <p
                    style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}
                  >
                    This Month's Spend
                  </p>
                  <h2
                    style={{
                      margin: "6px 0 0",
                      fontSize: "1.4rem",
                      color: "#b10000",
                    }}
                  >
                    {financialLoading
                      ? "Loading…"
                      : formatCurrency(totals.monthSpend)}
                  </h2>
                </div>
                <div
                  style={{
                    ...cardStyle,
                    padding: "16px",
                    boxShadow: "none",
                    border: "1px dashed #ffd0d0",
                  }}
                >
                  <p
                    style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}
                  >
                    Projected Spend (All Scheduled Orders)
                  </p>
                  <h2
                    style={{
                      margin: "6px 0 0",
                      fontSize: "1.4rem",
                      color: "#b10000",
                    }}
                  >
                    {financialLoading
                      ? "Loading…"
                      : formatCurrency(totals.projectedSpend)}
                  </h2>
                </div>
                <div
                  style={{
                    ...cardStyle,
                    padding: "16px",
                    boxShadow: "none",
                    border: "1px dashed #ffd0d0",
                  }}
                >
                  <p
                    style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}
                  >
                    Budget Remaining
                  </p>
                  <h2
                    style={{
                      margin: "6px 0 0",
                      fontSize: "1.4rem",
                      color:
                        totals.monthSpend > totals.monthlyBudget
                          ? "#a00000"
                          : "#007a4e",
                    }}
                  >
                    {financialLoading
                      ? "Loading…"
                      : formatCurrency(
                          Math.max(totals.budgetRemaining, -999999)
                        )}
                  </h2>
                </div>
              </div>

              <div style={{ marginTop: "20px" }}>
                <label
                  htmlFor="monthlyBudget"
                  style={{
                    fontWeight: 600,
                    color: "#b10000",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Adjust Consumables Budget for {monthLabel}
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <input
                    id="monthlyBudget"
                    type="number"
                    min="0"
                    step="50"
                    value={budgetInput}
                    onChange={handleBudgetInputChange}
                    style={budgetInputStyle}
                  />
                  <button
                    type="button"
                    onClick={handleBudgetSave}
                    disabled={budgetSaving || financialLoading}
                    style={{
                      ...orderModalButtonStyle,
                      background: budgetSaving
                        ? "rgba(209,0,0,0.4)"
                        : "linear-gradient(135deg, #d10000, #940000)",
                      color: "#ffffff",
                      width: "auto",
                    }}
                  >
                    {budgetSaving ? "Saving…" : "Save Budget"}
                  </button>
                </div>
                {budgetSaveMessage && (
                  <p style={{ margin: "6px 0 0", color: "#007a4e" }}>
                    {budgetSaveMessage}
                  </p>
                )}
                {budgetSaveError && (
                  <p style={{ margin: "6px 0 0", color: "#a00000" }}>
                    {budgetSaveError}
                  </p>
                )}
                {formattedBudgetUpdatedAt && (
                  <p style={{ margin: "6px 0 0", color: "#555", fontSize: "0.85rem" }}>
                    Last updated {formattedBudgetUpdatedAt}
                  </p>
                )}
              </div>
            </div>

            <div style={{ ...cardStyle }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <h2 style={sectionTitleStyle}>Scheduled Consumables</h2>
                <div
                  style={{
                    minWidth: "220px",
                    flex: "1 1 auto",
                    maxWidth: "360px",
                  }}
                >
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by item, date, cost, supplier…"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #ffdede",
                      background: "#fff",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div style={scheduledTableBodyStyle}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "separate",
                      borderSpacing: "0 12px",
                    }}
                  >
                    <thead>
                    <tr
                      style={{
                        textAlign: "left",
                        color: "#a00000",
                        fontSize: "0.8rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      <th style={{ padding: "8px" }}>Status</th>
                      <th style={{ padding: "8px" }}>Item</th>
                      <th style={{ padding: "8px" }}>Last Ordered</th>
                      <th style={{ padding: "8px" }}>Next Estimated</th>
                      <th style={{ padding: "8px" }}>Estimated Qty</th>
                      <th style={{ padding: "8px" }}>Supplier</th>
                      <th style={{ padding: "8px" }}>Unit Cost</th>
                      <th style={{ padding: "8px" }}>Last Order Value</th>
                      <th style={{ padding: "8px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingConsumables ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "14px", color: "#6b7280" }}>
                          Loading consumable data…
                        </td>
                      </tr>
                    ) : consumablesError ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "14px", color: "#a00000" }}>
                          {consumablesError}
                        </td>
                      </tr>
                    ) : consumables.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{ padding: "14px", color: "#6b7280" }}
                        >
                          No consumable records found.
                        </td>
                      </tr>
                    ) : (
                      filteredConsumables.map((item) => {
                        const status = getConsumableStatus(item);
                        const icon =
                          status.label === "Overdue"
                            ? "⚠️"
                            : status.label === "Not Required"
                            ? "ℹ️"
                            : "⏰";

                        const logEntries = item.orderHistory || [];

                        return (
                          <React.Fragment key={`consumable-${item.id}`}>
                            <tr
                              key={`${item.id}-row`}
                              style={{
                                background: "#fff7f7",
                                borderRadius: "12px",
                              }}
                            >
                              <td style={{ padding: "12px" }}>
                                <span style={toneToStyles(status.tone)}>
                                  {icon}
                                  {status.label}
                                </span>
                              </td>
                              <td style={{ padding: "12px" }}>
                                <strong
                                  style={{ display: "block", color: "#b10000" }}
                                >
                                  {item.name}
                                </strong>
                              </td>
                              <td style={{ padding: "12px", color: "#555" }}>
                                {formatDate(item.lastOrderDate)}
                              </td>
                              <td style={{ padding: "12px", color: "#555" }}>
                                {formatDate(item.nextEstimatedOrderDate)}
                              </td>
                              <td style={{ padding: "12px", color: "#555" }}>
                                {item.estimatedQuantity
                                  ? item.estimatedQuantity.toLocaleString()
                                  : "—"}
                              </td>
                              <td style={{ padding: "12px", color: "#555" }}>
                                {item.supplier || "—"}
                              </td>
                              <td style={{ padding: "12px", color: "#555" }}>
                                {formatCurrency(item.unitCost)}
                              </td>
                            <td style={{ padding: "12px", color: "#555" }}>
                              {formatCurrency(item.lastOrderTotalValue)}
                            </td>
                            <td style={{ padding: "12px", color: "#555" }}>
                              <button
                                type="button"
                                onClick={() => openOrderModal(item)}
                                style={orderButtonStyle}
                              >
                                Order
                              </button>
                            </td>
                            </tr>
                            <tr>
                              <td
                                colSpan={9}
                                style={{ padding: "0 12px 12px" }}
                              >
                                <div style={orderHistoryContainerStyle}>
                                  <div style={orderHistoryHeaderStyle}>
                                    <span>Item</span>
                                    <span>Qty</span>
                                    <span>Unit</span>
                                    <span>Total</span>
                                    <span>Supplier</span>
                                    <span>Date</span>
                                  </div>
                                  {logEntries.length === 0 ? (
                                    <p
                                      style={{
                                        margin: 0,
                                        color: "#6b7280",
                                        fontSize: "0.9rem",
                                      }}
                                    >
                                      No order logs recorded yet.
                                    </p>
                                  ) : (
                                    logEntries.map((log, logIndex) => {
                                      const isLastLog =
                                        logIndex === logEntries.length - 1;
                                      return (
                                        <div
                                          key={`${item.id}-log-${logIndex}`}
                                          style={{
                                            ...orderHistoryRowStyle,
                                            borderBottom: isLastLog
                                              ? "none"
                                              : orderHistoryRowBorder,
                                          }}
                                        >
                                          <span>
                                            {log.itemName || item.name}
                                          </span>
                                          <span>
                                            {log.quantity
                                              ? log.quantity.toLocaleString()
                                              : "—"}
                                          </span>
                                          <span>
                                            {formatCurrency(log.unitCost)}
                                          </span>
                                          <span>
                                            {formatCurrency(log.totalCost)}
                                          </span>
                                          <span>
                                            {log.supplier || "—"}
                                          </span>
                                          <span>
                                            {formatDate(log.date)}
                                          </span>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, marginTop: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#b10000" }}>
                Technician Requests
              </h2>
              <span style={{ color: "#666", fontSize: "0.9rem" }}>
                {requestsLoading ? "Loading…" : `${techRequests.length} requests`}
              </span>
            </div>
            {requestsError && (
              <p style={{ margin: "0 0 12px", color: "#a00000" }}>
                {requestsError}
              </p>
            )}
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: "0 12px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      color: "#a00000",
                      fontSize: "0.8rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    <th style={{ padding: "8px" }}>Item</th>
                    <th style={{ padding: "8px" }}>Quantity</th>
                    <th style={{ padding: "8px" }}>Technician</th>
                    <th style={{ padding: "8px" }}>Requested</th>
                    <th style={{ padding: "8px" }}>Status</th>
                    <th style={{ padding: "8px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {techRequests.map((request) => (
                    <tr
                      key={`request-${request.id}`}
                      style={{
                        background: "#fff7f7",
                        borderRadius: "12px",
                      }}
                    >
                      <td style={{ padding: "12px", color: "#555" }}>
                        {request.itemName}
                      </td>
                      <td style={{ padding: "12px", color: "#555" }}>
                        {request.quantity.toLocaleString()}
                      </td>
                      <td style={{ padding: "12px", color: "#555" }}>
                        {request.requestedByName || "—"}
                      </td>
                      <td style={{ padding: "12px", color: "#555" }}>
                        {request.requestedAt
                          ? new Date(request.requestedAt).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )
                          : "—"}
                      </td>
                      <td style={{ padding: "12px", color: "#555" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            borderRadius: "999px",
                            fontWeight: 600,
                            fontSize: "0.75rem",
                            ...(statusBadgeStyles[
                              request.status === "ordered"
                                ? "ordered"
                                : request.status
                            ] || statusBadgeStyles.pending),
                          }}
                        >
                          {request.status === "ordered"
                            ? "✅"
                            : request.status === "urgent"
                            ? "⏰"
                            : "📦"}
                          {request.status.charAt(0).toUpperCase() +
                            request.status.slice(1)}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        {request.status === "pending" ? (
                          <button
                            type="button"
                            disabled={orderingRequestId === request.id}
                            onClick={() => handleRequestOrdered(request.id)}
                            style={{
                              ...orderModalButtonStyle,
                              padding: "6px 14px",
                              fontSize: "0.9rem",
                              width: "auto",
                            }}
                          >
                            {orderingRequestId === request.id
                              ? "Ordering…"
                              : "Order"}
                          </button>
                        ) : (
                          <span style={{ color: "#007a4e", fontWeight: 600 }}>
                            Ordered
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default ConsumablesTrackerPage;
