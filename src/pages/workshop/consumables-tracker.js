"use client";
// file location: src/pages/workshop/consumables-tracker.js

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import Link from "next/link";
import { supabase } from "@/lib/database/supabaseClient";
import { addConsumableOrder, listConsumablesForTracker } from "@/lib/database/consumables";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { useTheme } from "@/styles/themeProvider";
import StockCheckPopup from "@/components/Consumables/StockCheckPopup";
import { CalendarField } from "@/components/ui/calendarAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";

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
  backgroundColor: "var(--section-card-bg)",
  borderRadius: "var(--section-card-radius)",
  padding: "var(--section-card-padding)",
  border: "var(--section-card-border)",
};

const sectionTitleStyle = {
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "var(--text-primary)",
  marginBottom: "12px",
};

const badgeBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 10px",
  borderRadius: "var(--radius-pill)",
  fontSize: "var(--text-caption)",
  fontWeight: 600,
};

const budgetInputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  fontSize: "0.95rem",
};

const orderHistoryGridTemplate = "minmax(150px, 2fr) repeat(5, minmax(90px, 1fr))";

const orderHistoryContainerStyle = {
  marginTop: "12px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--surface-light)",
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
  color: "var(--text-primary)",
  marginBottom: "8px",
};

const orderHistoryRowBorder = "none";

const orderModalOverlayStyle = {
  ...popupOverlayStyles,
  zIndex: 1200,
  padding: "16px",
};

const orderModalStyle = {
  ...popupCardStyles,
  width: "100%",
  maxWidth: "520px",
  padding: "28px",
  position: "relative",
};

const historyModalStyle = {
  ...popupCardStyles,
  width: "100%",
  maxWidth: "860px",
  padding: "24px",
  position: "relative",
};

const orderModalCloseButtonStyle = {
  position: "absolute",
  top: "12px",
  right: "12px",
  background: "transparent",
  border: "none",
  fontSize: "1rem",
  color: "var(--text-primary)",
  cursor: "pointer",
};

const orderModalButtonStyle = {
  padding: "10px 20px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  boxShadow: "none",
};

const orderModalSecondaryButtonStyle = {
  ...orderModalButtonStyle,
  background: "var(--surface)",
  border: "none",
  color: "var(--text-primary)",
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
  borderRadius: "var(--radius-xs)",
  border: "none",
};

const orderButtonStyle = {
  padding: "8px 16px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--primary)",
  color: "var(--surface)",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "none",
};

const stockCheckButtonStyle = {
  padding: "10px 18px",
  borderRadius: "var(--radius-pill)",
  border: "1px solid var(--primary)",
  background: "var(--surface)",
  color: "var(--text-primary)",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "none",
};

function normalizeConsumableName(value) {
  return (value || "").trim().toLowerCase();
}

function compactConsumableKey(value) {
  return normalizeConsumableName(value).replace(/\s+/g, "");
}

function namesMatch(valueA, valueB) {
  const keyA = compactConsumableKey(valueA);
  const keyB = compactConsumableKey(valueB);
  if (!keyA || !keyB) {
    return false;
  }
  return keyA === keyB;
}
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
      backgroundColor: "rgba(var(--primary-rgb),0.12)",
      color: "var(--text-primary)",
      border: "none",
    };
  }
  if (tone === "warning") {
    return {
      ...badgeBaseStyle,
      backgroundColor: "rgba(var(--warning-rgb), 0.16)",
      color: "var(--warning-dark)",
      border: "1px solid rgba(var(--warning-rgb), 0.35)",
    };
  }

  return {
    ...badgeBaseStyle,
    backgroundColor: "rgba(var(--success-rgb), 0.12)",
    color: "var(--success-dark)",
    border: "1px solid rgba(var(--success-rgb), 0.35)",
  };
}

const duplicateOverlayStyle = {
  ...popupOverlayStyles,
  zIndex: 1300,
  padding: "16px",
};

const duplicateModalStyle = {
  ...popupCardStyles,
  padding: "24px",
  maxWidth: "540px",
  width: "100%",
};

const statusBadgeStyles = {
  pending: {
    backgroundColor: "rgba(var(--warning-rgb), 0.16)",
    color: "var(--warning-dark)",
    border: "1px solid rgba(var(--warning-rgb), 0.35)",
  },
  urgent: {
    backgroundColor: "rgba(var(--primary-rgb),0.12)",
    color: "var(--text-primary)",
    border: "none",
  },
  ordered: {
    backgroundColor: "rgba(var(--success-rgb), 0.12)",
    color: "var(--success-dark)",
    border: "1px solid rgba(var(--success-rgb), 0.35)",
  },
  rejected: {
    backgroundColor: "rgba(var(--danger-rgb), 0.12)",
    color: "var(--danger)",
    border: "1px solid rgba(var(--danger-rgb), 0.35)",
  },
};

function ConsumablesTrackerPage() {
  const { user, dbUserId } = useUser();
  const { isDark } = useTheme();
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
  const [consumables, setConsumables] = useState([]);
  const [potentialDuplicates, setPotentialDuplicates] = useState([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [loadingConsumables, setLoadingConsumables] = useState(false);
  const [consumablesError, setConsumablesError] = useState("");
  const [techRequests, setTechRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  const [orderingRequestId, setOrderingRequestId] = useState(null);
  const [pendingRequestOrderId, setPendingRequestOrderId] = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [logsSummary, setLogsSummary] = useState({
    spend: 0,
    quantity: 0,
    orders: 0,
    suppliers: 0,
  });
  const [monthlyLogs, setMonthlyLogs] = useState([]);
  const [showStockCheck, setShowStockCheck] = useState(false);
  const isMountedRef = useRef(true);
  const [historyModalConsumable, setHistoryModalConsumable] = useState(null);
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

  const mutedTextColor = "var(--text-secondary)";
  const quietLabelColor = "var(--text-secondary)";
  const highlightRowBackground = isDark ? "rgba(var(--accent-purple-rgb),0.22)" : "var(--danger-surface)";
  const tableHeaderColor = "var(--text-secondary)";
  const accentDashedBorder = isDark
    ? "1px dashed rgba(var(--accent-purple-rgb),0.35)"
    : "1px dashed var(--surface-light)";
  const themedBudgetInputStyle = useMemo(
    () => ({
      ...budgetInputStyle,
      border: isDark ? "1px solid rgba(var(--accent-purple-rgb),0.45)" : budgetInputStyle.border,
      background: isDark ? "var(--surface-light)" : "var(--surface)",
      color: "var(--text-primary)",
    }),
    [isDark]
  );
  const themedOrderHistoryContainerStyle = useMemo(
    () => ({
      ...orderHistoryContainerStyle,
      border: isDark
        ? "1px solid rgba(var(--accent-purple-rgb),0.25)"
        : orderHistoryContainerStyle.border,
      background: isDark ? "var(--surface-light)" : orderHistoryContainerStyle.background,
    }),
    [isDark]
  );
  const themedOrderHistoryRowStyle = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: orderHistoryGridTemplate,
      gap: "12px",
      alignItems: "center",
      fontSize: "0.9rem",
      color: mutedTextColor,
      padding: "8px 0",
      borderBottom: orderHistoryRowBorder,
    }),
    [mutedTextColor]
  );
  const themedOrderHistoryRowBorder = isDark
    ? "1px solid rgba(var(--accent-purple-rgb),0.2)"
    : orderHistoryRowBorder;
  const statusNotificationPendingRef = useRef(new Map());

  const closeOrderModal = useCallback(() => {
    setOrderModalConsumable(null);
    setShowEditForm(false);
    setOrderModalError("");
    setPendingRequestOrderId(null);
  }, []);

  const openOrderModal = useCallback(
    (item, { requestId } = {}) => {
      if (!item) {
        return;
      }
      const lastLog = item.orderHistory?.[0];
      const baseQuantity =
        lastLog?.quantity ?? item.lastOrderQuantity ?? item.estimatedQuantity ?? "";
      const baseUnitCost =
        lastLog?.unitCost ??
        (item.unitCost !== undefined && item.unitCost !== null ? item.unitCost : "");

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
      setPendingRequestOrderId(requestId ?? null);
    },
    [todayIso]
  );

  const openHistoryModal = useCallback((item) => {
    if (!item) return;
    setHistoryModalConsumable(item);
  }, []);

  const closeHistoryModal = useCallback(() => {
    setHistoryModalConsumable(null);
  }, []);

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

  const findConsumableByName = useCallback(
    (name) => {
      if (!name) {
        return null;
      }
      return consumables.find((item) => namesMatch(item.name, name));
    },
    [consumables]
  );

  const handleRequestOrder = useCallback(
    (request) => {
      if (!request) {
        return;
      }
      const consumable = findConsumableByName(request.itemName);
      if (!consumable) {
        setRequestsError(
          `Consumable "${request.itemName}" isn't in the tracker yet. Add it via Stock Check before ordering.`
        );
        return;
      }
      openOrderModal(consumable, { requestId: request.id });
    },
    [findConsumableByName, openOrderModal]
  );

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

  // CRITICAL FIX: Move fetchMonthlyLogs BEFORE the useEffect that uses it
  const fetchMonthlyLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError("");

    try {
      const response = await fetch(
        `/api/workshop/consumables/logs?year=${viewYear}&month=${viewMonth}`
      );
      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({ message: "Unable to load logs." }));
        throw new Error(body.message || "Unable to load logs.");
      }

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to load logs.");
      }

      setMonthlyLogs(payload.data.orders || []);
      setLogsSummary(payload.data.summary || { spend: 0, quantity: 0, orders: 0, suppliers: 0 });
    } catch (error) {
      console.error("❌ Failed to load monthly logs", error);
      setLogsError(error?.message || "Unable to load monthly logs.");
    } finally {
      setLogsLoading(false);
    }
  }, [viewMonth, viewYear]);

  useEffect(() => {
    fetchMonthlyLogs();
  }, [fetchMonthlyLogs]);

  useEffect(() => {
    if (!isWorkshopManager) {
      return () => {};
    }

    const channel = supabase.channel("consumables-tracker");
    const tables = [
      "workshop_consumables",
      "workshop_consumable_orders",
      "workshop_consumable_requests",
      "workshop_consumable_budgets",
    ];
    const handleRealtime = () => {
      refreshConsumables();
      fetchTechRequests();
      fetchFinancialSummary();
      fetchMonthlyLogs();
    };

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        handleRealtime
      );
    });

    void channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    fetchFinancialSummary,
    fetchMonthlyLogs,
    fetchTechRequests,
    isWorkshopManager,
    refreshConsumables,
  ]);

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
      if (pendingRequestOrderId) {
        await handleRequestOrdered(pendingRequestOrderId);
        setPendingRequestOrderId(null);
      }
      await refreshConsumables();
      await fetchMonthlyLogs();
      closeOrderModal();
    } catch (error) {
      setOrderModalError(error?.message || "Failed to place order.");
    } finally {
      setOrderModalLoading(false);
    }
  }, [
    closeOrderModal,
    fetchMonthlyLogs,
    handleRequestOrdered,
    orderModalConsumable,
    pendingRequestOrderId,
    refreshConsumables,
    todayIso,
  ]);

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
      if (pendingRequestOrderId) {
        await handleRequestOrdered(pendingRequestOrderId);
        setPendingRequestOrderId(null);
      }
      await refreshConsumables();
      await fetchMonthlyLogs();
      closeOrderModal();
      } catch (error) {
        setOrderModalError(error?.message || "Failed to place order.");
      } finally {
        setOrderModalLoading(false);
      }
    },
    [
      closeOrderModal,
      fetchMonthlyLogs,
      handleRequestOrdered,
      orderForm,
      orderModalConsumable,
      pendingRequestOrderId,
      refreshConsumables,
      todayIso,
    ]
  );

  const previewLogs = orderModalConsumable?.orderHistory?.slice(0, 3) ?? [];

  if (!isWorkshopManager) {
    return (
      <>
        <div style={{ padding: "40px", maxWidth: "720px", margin: "0 auto" }}>
          <div style={{ ...cardStyle, textAlign: "center" }}>
            <h1 style={{ color: "var(--text-primary)", marginBottom: "16px" }}>
              Workshop Manager Access Only
            </h1>
            <p style={{ marginBottom: "16px", color: mutedTextColor }}>
              This consumables tracker is limited to workshop management roles. If
              you believe you should have access please contact the systems
              administrator.
            </p>
            <Link
              href="/dashboard"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: "var(--radius-pill)",
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
      </>
    );
  }

  return (
    <>
      <div style={containerStyle}>
        <div style={workspaceShellStyle}>
          {!orderModalConsumable && showDuplicateModal && potentialDuplicates.length > 0 && (
            <div style={duplicateOverlayStyle}>
              <div style={duplicateModalStyle}>
                <h3 style={{ margin: 0, color: "var(--text-primary)" }}>
                  Potential Duplicate Consumables
                </h3>
                <p style={{ color: mutedTextColor, marginTop: "8px" }}>
                  We detected items that resolve to the same name when
                  normalised. They have been grouped into a single record for
                  this view; please tidy the source data if these should remain
                  separate.
                </p>
                <ul style={{ paddingLeft: "20px", color: mutedTextColor }}>
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
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      background: "var(--primary)",
                      color: "var(--surface)",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "none",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
          {showStockCheck && (
            <StockCheckPopup
              open={showStockCheck}
              onClose={() => setShowStockCheck(false)}
              isManager={isWorkshopManager}
              technicianId={dbUserId}
              onRequestsSubmitted={fetchTechRequests}
            />
          )}
          {historyModalConsumable && (
            <div style={orderModalOverlayStyle}>
              <div style={historyModalStyle} role="dialog" aria-modal="true">
                <button
                  type="button"
                  onClick={closeHistoryModal}
                  style={orderModalCloseButtonStyle}
                  aria-label="Close history modal"
                >
                  âœ•
                </button>
                <h3 style={{ margin: "0 0 6px", color: "var(--text-primary)" }}>
                  {historyModalConsumable.name} History
                </h3>
                <div style={themedOrderHistoryContainerStyle}>
                  <div style={orderHistoryHeaderStyle}>
                    <span>ITEM</span>
                    <span>QTY</span>
                    <span>UNIT</span>
                    <span>TOTAL</span>
                    <span>SUPPLIER</span>
                    <span>DATE</span>
                  </div>
                  {(historyModalConsumable.orderHistory || []).length === 0 ? (
                    <p style={{ margin: 0, color: "var(--info)" }}>
                      No order logs recorded yet.
                    </p>
                  ) : (
                    (historyModalConsumable.orderHistory || []).map((log, logIndex) => {
                      const isLastLog = logIndex === historyModalConsumable.orderHistory.length - 1;
                      return (
                        <div
                          key={`history-log-${historyModalConsumable.id}-${logIndex}`}
                          style={{
                            ...themedOrderHistoryRowStyle,
                            borderBottom: isLastLog ? "none" : themedOrderHistoryRowBorder,
                          }}
                        >
                          <span>{log.itemName || historyModalConsumable.name}</span>
                          <span>{log.quantity ? log.quantity.toLocaleString() : "â€”"}</span>
                          <span>{formatCurrency(log.unitCost)}</span>
                          <span>{formatCurrency(log.totalCost)}</span>
                          <span>{log.supplier || "â€”"}</span>
                          <span>{formatDate(log.date)}</span>
                        </div>
                      );
                    })
                  )}
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
                <h3 style={{ margin: "0 0 6px", color: "var(--text-primary)" }}>
                  Order {orderModalConsumable.name}
                </h3>
                <p style={{ margin: "0 8px 16px", color: mutedTextColor }}>
                Previous orders (latest three). &ldquo;Same Details&rdquo; will reuse the
                most recent order, while &ldquo;Edit Details&rdquo; lets you adjust the
                  quantity, unit cost, supplier, or date before logging a new entry.
                </p>
                <div style={themedOrderHistoryContainerStyle}>
                  <div style={orderHistoryHeaderStyle}>
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Unit</span>
                    <span>Total</span>
                    <span>Supplier</span>
                    <span>Date</span>
                  </div>
                  {previewLogs.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--info)" }}>
                      No previous orders logged.
                    </p>
                  ) : (
                    previewLogs.map((log, index) => {
                      const isLastLog = index === previewLogs.length - 1;
                      return (
                        <div
                          key={`modal-log-${index}`}
                          style={{
                            ...themedOrderHistoryRowStyle,
                            borderBottom: isLastLog ? "none" : themedOrderHistoryRowBorder,
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
                        ? "rgba(var(--primary-rgb),0.4)"
                        : "var(--primary)",
                      color: "var(--surface)",
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
                  <p style={{ color: "var(--text-primary)", marginTop: "12px" }}>
                    {orderModalError}
                  </p>
                )}
                {showEditForm && (
                  <form onSubmit={handleEditedOrder} style={{ marginTop: "16px" }}>
                    <div style={orderModalFormGroupStyle}>
                      <label style={{ fontWeight: 600, color: "var(--text-primary)" }}>
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
                      <label style={{ fontWeight: 600, color: "var(--text-primary)" }}>
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
                      <label style={{ fontWeight: 600, color: "var(--text-primary)" }}>
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
                      <CalendarField
                        label="Order Date"
                        value={orderForm.orderDate}
                        onChange={handleOrderFormChange("orderDate")}
                        name="orderDate"
                        id="orderDate"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={orderModalLoading}
                      style={{
                        ...orderModalButtonStyle,
                        width: "100%",
                        background: orderModalLoading
                          ? "rgba(var(--primary-rgb),0.4)"
                          : "var(--primary)",
                        color: "var(--surface)",
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
                  background: "var(--layer-section-level-1)",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  padding: "14px",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                    <h1 style={{ margin: 0, fontSize: "1.4rem", color: "var(--text-primary)" }}>
                      Workshop Consumables Tracker
                    </h1>
                    <div>
                      <p style={{ margin: 0, fontSize: "0.8rem", color: quietLabelColor }}>
                        Budget for {monthLabel}
                      </p>
                      <strong style={{ fontSize: "1.4rem", color: "var(--text-primary)" }}>
                        {financialLoading
                          ? "Loading…"
                          : formatCurrency(totals.monthlyBudget)}
                      </strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStockCheck(true)}
                    style={stockCheckButtonStyle}
                  >
                    Stock Check
                  </button>
                </div>

                <div
                  style={{
                    marginTop: "20px",
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    alignItems: "flex-start",
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
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--primary)",
                        background: "var(--surface)",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ← Previous
                    </button>
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--text-primary)",
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
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--primary)",
                        background: canAdvanceToNextMonth
                          ? "var(--surface)"
                          : "rgba(var(--primary-rgb),0.2)",
                        color: canAdvanceToNextMonth ? "var(--text-primary)" : "var(--text-primary)",
                        fontWeight: 600,
                        cursor: canAdvanceToNextMonth ? "pointer" : "not-allowed",
                      }}
                    >
                      Next →
                    </button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      minWidth: "280px",
                      flex: "1 1 320px",
                      maxWidth: "460px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "flex-end",
                      }}
                    >
                      <input
                        id="monthlyBudget"
                        type="number"
                        min="0"
                        step="50"
                        value={budgetInput}
                        onChange={handleBudgetInputChange}
                        style={{ ...themedBudgetInputStyle, flex: "1 1 180px", minWidth: "160px" }}
                      />
                      <button
                        type="button"
                        onClick={handleBudgetSave}
                        disabled={budgetSaving || financialLoading}
                        style={{
                          ...orderModalButtonStyle,
                          background: budgetSaving
                            ? "rgba(var(--primary-rgb),0.4)"
                            : "var(--primary)",
                          color: "var(--surface)",
                          width: "auto",
                        }}
                      >
                        {budgetSaving ? "Saving…" : "Save Budget"}
                      </button>
                    </div>
                    {budgetSaveMessage && (
                      <p style={{ margin: 0, color: "var(--success-dark)", textAlign: "right" }}>
                        {budgetSaveMessage}
                      </p>
                    )}
                    {budgetSaveError && (
                      <p style={{ margin: 0, color: "var(--text-primary)", textAlign: "right" }}>
                        {budgetSaveError}
                      </p>
                    )}
                    {formattedBudgetUpdatedAt && (
                      <p style={{ margin: 0, color: mutedTextColor, fontSize: "0.85rem", textAlign: "right" }}>
                        Last updated {formattedBudgetUpdatedAt}
                      </p>
                    )}
                  </div>
                  {financialError && (
                    <p style={{ margin: 0, color: "var(--text-primary)" }}>{financialError}</p>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <h2 style={{ margin: 0, fontSize: "1.3rem", color: "var(--text-primary)" }}>
                  Monthly Logs
                </h2>
              </div>
              <div
                style={{
                  marginTop: "12px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "12px",
                }}
              >
                <div style={{ ...cardStyle, padding: "12px", boxShadow: "none", border: accentDashedBorder }}>
                  <p style={{ margin: 0, color: quietLabelColor, fontSize: "0.8rem" }}>Spend</p>
                  <strong style={{ fontSize: "1.2rem" }}>
                    {logsLoading ? "Loading…" : formatCurrency(logsSummary.spend)}
                  </strong>
                </div>
                <div style={{ ...cardStyle, padding: "12px", boxShadow: "none", border: accentDashedBorder }}>
                  <p style={{ margin: 0, color: quietLabelColor, fontSize: "0.8rem" }}>Quantity</p>
                  <strong style={{ fontSize: "1.2rem" }}>
                    {logsLoading ? "Loading…" : logsSummary.quantity.toLocaleString()}
                  </strong>
                </div>
                <div style={{ ...cardStyle, padding: "12px", boxShadow: "none", border: accentDashedBorder }}>
                  <p style={{ margin: 0, color: quietLabelColor, fontSize: "0.8rem" }}>Orders</p>
                  <strong style={{ fontSize: "1.2rem" }}>
                    {logsLoading ? "Loading…" : logsSummary.orders}
                  </strong>
                </div>
                <div style={{ ...cardStyle, padding: "12px", boxShadow: "none", border: accentDashedBorder }}>
                  <p style={{ margin: 0, color: quietLabelColor, fontSize: "0.8rem" }}>Suppliers</p>
                  <strong style={{ fontSize: "1.2rem" }}>
                    {logsLoading ? "Loading…" : logsSummary.suppliers}
                  </strong>
                </div>
              </div>
              {logsError && (
                <p style={{ margin: "12px 0 0", color: "var(--text-primary)" }}>{logsError}</p>
              )}
              <div style={{ overflowX: "auto", marginTop: "16px" }}>
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
                        color: tableHeaderColor,
                        fontSize: "0.8rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      <th style={{ padding: "8px" }}>Date</th>
                      <th style={{ padding: "8px" }}>Item</th>
                      <th style={{ padding: "8px" }}>Quantity</th>
                      <th style={{ padding: "8px" }}>Supplier</th>
                      <th style={{ padding: "8px" }}>Total (£)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsLoading ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "12px", color: "var(--info)" }}>
                          Loading logs…
                        </td>
                      </tr>
                    ) : monthlyLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "12px", color: "var(--info)" }}>
                          No log entries recorded for {monthLabel}.
                        </td>
                      </tr>
                    ) : (
                      monthlyLogs.map((log) => (
                        <tr
                          key={`log-${log.id || log.date}-${log.itemName}`}
                          style={{
                            background: highlightRowBackground,
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          <td style={{ padding: "12px", color: mutedTextColor }}>
                            {log.date
                              ? new Date(log.date).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                          <td style={{ padding: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                            {log.itemName || "—"}
                          </td>
                          <td style={{ padding: "12px", color: mutedTextColor }}>
                            {Number(log.quantity || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: "12px", color: mutedTextColor }}>
                            {log.supplier || "—"}
                          </td>
                          <td style={{ padding: "12px", color: mutedTextColor }}>
                            {formatCurrency(log.totalValue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
                    border: accentDashedBorder,
                  }}
                >
                  <p
                    style={{ margin: 0, color: quietLabelColor, fontSize: "0.85rem" }}
                  >
                    This Month&apos;s Spend
                  </p>
                  <h2
                    style={{
                      margin: "6px 0 0",
                      fontSize: "1.4rem",
                      color: "var(--text-primary)",
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
                    border: accentDashedBorder,
                  }}
                >
                  <p
                    style={{ margin: 0, color: quietLabelColor, fontSize: "0.85rem" }}
                  >
                    Projected Spend (All Scheduled Orders)
                  </p>
                  <h2
                    style={{
                      margin: "6px 0 0",
                      fontSize: "1.4rem",
                      color: "var(--text-primary)",
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
                    border: accentDashedBorder,
                  }}
                >
                  <p
                    style={{ margin: 0, color: quietLabelColor, fontSize: "0.85rem" }}
                  >
                    Budget Remaining
                  </p>
                  <h2
                    style={{
                      margin: "6px 0 0",
                      fontSize: "1.4rem",
                      color:
                        totals.monthSpend > totals.monthlyBudget
                          ? "var(--text-primary)"
                          : "var(--success-dark)",
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
                  <SearchBar
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onClear={() => setSearchQuery("")}
                    placeholder="Search by item, date, cost, supplier…"
                    style={{
                      width: "100%",
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
                        color: tableHeaderColor,
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
                        <td colSpan={8} style={{ padding: "14px", color: "var(--info)" }}>
                          Loading consumable data…
                        </td>
                      </tr>
                    ) : consumablesError ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "14px", color: "var(--text-primary)" }}>
                          {consumablesError}
                        </td>
                      </tr>
                    ) : consumables.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{ padding: "14px", color: "var(--info)" }}
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

                        return (
                          <tr
                            key={`consumable-${item.id}`}
                            style={{
                              background: highlightRowBackground,
                              borderRadius: "var(--radius-sm)",
                              cursor: "pointer",
                            }}
                            onClick={() => openHistoryModal(item)}
                          >
                            <td style={{ padding: "12px" }}>
                              <span style={toneToStyles(status.tone)}>
                                {icon}
                                {status.label}
                              </span>
                            </td>
                            <td style={{ padding: "12px" }}>
                              <strong
                                style={{ display: "block", color: "var(--text-primary)" }}
                              >
                                {item.name}
                              </strong>
                            </td>
                            <td style={{ padding: "12px", color: mutedTextColor }}>
                              {formatDate(item.lastOrderDate)}
                            </td>
                            <td style={{ padding: "12px", color: mutedTextColor }}>
                              {formatDate(item.nextEstimatedOrderDate)}
                            </td>
                            <td style={{ padding: "12px", color: mutedTextColor }}>
                              {item.estimatedQuantity
                                ? item.estimatedQuantity.toLocaleString()
                                : "—"}
                            </td>
                            <td style={{ padding: "12px", color: mutedTextColor }}>
                              {item.supplier || "—"}
                            </td>
                            <td style={{ padding: "12px", color: mutedTextColor }}>
                              {formatCurrency(item.unitCost)}
                            </td>
                            <td style={{ padding: "12px", color: mutedTextColor }}>
                              {formatCurrency(item.lastOrderTotalValue)}
                            </td>
                            <td style={{ padding: "12px", color: mutedTextColor }}>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openOrderModal(item);
                                }}
                                style={orderButtonStyle}
                              >
                                Order
                              </button>
                            </td>
                          </tr>
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
              <h2 style={{ margin: 0, fontSize: "1.3rem", color: "var(--text-primary)" }}>
                Requests
              </h2>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                {requestsLoading ? "Loading…" : `${techRequests.length} requests`}
              </span>
            </div>
            {requestsError && (
              <p style={{ margin: "0 0 12px", color: "var(--text-primary)" }}>
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
                      color: tableHeaderColor,
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
                        background: highlightRowBackground,
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <td style={{ padding: "12px", color: mutedTextColor }}>
                        {request.itemName}
                      </td>
                      <td style={{ padding: "12px", color: mutedTextColor }}>
                        {request.quantity.toLocaleString()}
                      </td>
                      <td style={{ padding: "12px", color: mutedTextColor }}>
                        {request.requestedByName || "—"}
                      </td>
                      <td style={{ padding: "12px", color: mutedTextColor }}>
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
                      <td style={{ padding: "12px", color: mutedTextColor }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 10px",
                            borderRadius: "var(--radius-pill)",
                            fontWeight: 600,
                            fontSize: "var(--text-caption)",
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
                            : request.status === "rejected"
                            ? "✖️"
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
                            onClick={() => handleRequestOrder(request)}
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
                        ) : request.status === "ordered" ? (
                          <span style={{ color: "var(--success-dark)", fontWeight: 600 }}>
                            Ordered
                          </span>
                        ) : request.status === "rejected" ? (
                          <span style={{ color: "var(--danger)", fontWeight: 600 }}>
                            Rejected
                          </span>
                        ) : request.status === "ordered" ? (
                          <span style={{ color: "var(--success-dark)", fontWeight: 600 }}>
                            Ordered
                          </span>
                        ) : request.status === "rejected" ? (
                          <span style={{ color: "var(--danger)", fontWeight: 600 }}>
                            Rejected
                          </span>
                        ) : (
                          <span style={{ color: "var(--success-dark)", fontWeight: 600 }}>
                            Completed
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
    </>
  );
}

export default ConsumablesTrackerPage;
