// file location: src/pages/workshop/consumables-tracker.js
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import Link from "next/link";
import { supabase } from "@/lib/database/supabaseClient";
import { addConsumableOrder, listConsumablesForTracker } from "@/lib/database/consumables";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import StockCheckPopup from "@/components/Consumables/StockCheckPopup";
import { MonthPickerField } from "@/components/ui/monthPickerAPI";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import { PageShell, ContentWidth } from "@/components/ui";
import ConsumablesTrackerPageUi from "@/components/page-ui/workshop/workshop-consumables-tracker-ui"; // Extracted presentation layer.
import { hasAnyRole, WORKSHOP_MANAGER_ROLES } from "@/lib/auth/roles";
import {
  findConsumableForRequest,
  groupConsumableRequests,
  normalizeConsumableRequestStatus,
} from "@/lib/consumableRequests";
import { logFailure } from "@/lib/utils/logFailure";

// Page layout follows the canonical page shell and layer surface structure.
// hierarchy from staffglobal.css (via @/components/ui), so no local layout shells.

// Cards use the active theme surface unless a nested card explicitly opts into
// --surface.
const cardStyle = {
  padding: "var(--section-card-padding)"
};

const orderModalOverlayStyle = {
  ...popupOverlayStyles,
  zIndex: "var(--z-modal)",
  padding: "16px"
};

const orderModalStyle = {
  ...popupCardStyles,
  width: "100%",
  maxWidth: "520px",
  padding: "28px",
  position: "relative"
};

const historyModalStyle = {
  ...popupCardStyles,
  width: "100%",
  maxWidth: "860px",
  padding: "24px",
  position: "relative"
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
    maximumFractionDigits: 2
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
    year: "numeric"
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

const DAY_MS = 1000 * 60 * 60 * 24;

function getStockInsight(item) {
  const stock = Math.max(0, Number(item?.stockQuantity) || 0);
  const usageWindowDays = 90;
  const usageCutoff = Date.now() - usageWindowDays * DAY_MS;
  const recentUsageQuantity = (item?.usageHistory || []).reduce((total, usage) => {
    const usedAt = new Date(usage.usedAt).getTime();
    if (!Number.isFinite(usedAt) || usedAt < usageCutoff) return total;
    return total + Math.max(0, Number(usage.quantity) || 0);
  }, 0);
  const dailyUsage = recentUsageQuantity > 0 ? recentUsageQuantity / usageWindowDays : null;
  const daysRemaining = dailyUsage && dailyUsage > 0 ? Math.max(0, Math.round(stock / dailyUsage)) : null;
  const preferredStock = Number(item?.estimatedQuantity) > 0 ? Number(item.estimatedQuantity) : null;
  const suggestedOrderQuantity = preferredStock === null ? null : Math.max(0, Math.ceil(preferredStock - stock));
  let stockStatus = "Available";
  let stockTone = "safe";

  if (stock <= 0) {
    stockStatus = "Out";
    stockTone = "danger";
  } else if ((daysRemaining !== null && daysRemaining <= 14) || (preferredStock && stock <= preferredStock * 0.25)) {
    stockStatus = "Low";
    stockTone = "warning";
  }

  return {
    dailyUsage,
    daysRemaining,
    minimumStock: null,
    preferredStock,
    suggestedOrderQuantity,
    stockStatus,
    stockTone,
  };
}

function getPriceChange(item) {
  const history = item?.orderHistory || [];
  if (history.length < 2) return null;
  const latest = Number(history[0]?.unitCost);
  const previous = Number(history[1]?.unitCost);
  if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((latest - previous) / previous) * 100;
}

const duplicateOverlayStyle = {
  ...popupOverlayStyles,
  zIndex: "var(--z-modal)",
  padding: "16px"
};

const duplicateModalStyle = {
  ...popupCardStyles,
  padding: "24px",
  maxWidth: "540px",
  width: "100%"
};

function ConsumablesTrackerPage() {
  const { user, dbUserId } = useUser();
  const isWorkshopManager = hasAnyRole(user?.roles || [], WORKSHOP_MANAGER_ROLES);
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
    trend: []
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
  const [pendingRequestCreatesNewLine, setPendingRequestCreatesNewLine] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [logsSummary, setLogsSummary] = useState({
    spend: 0,
    quantity: 0,
    orders: 0,
    suppliers: 0
  });
  const [monthlyLogs, setMonthlyLogs] = useState([]);
  const [showStockCheck, setShowStockCheck] = useState(false);
  const isMountedRef = useRef(true);
  const [historyModalConsumable, setHistoryModalConsumable] = useState(null);
  const [orderModalConsumable, setOrderModalConsumable] = useState(null);
  const [orderModalError, setOrderModalError] = useState("");
  const [orderModalLoading, setOrderModalLoading] = useState(false);
  const [, setShowEditForm] = useState(false);
  const [orderForm, setOrderForm] = useState({
    quantity: "",
    unitCost: "",
    supplier: "",
    orderDate: todayIso
  });
  const [selectedConsumableIds, setSelectedConsumableIds] = useState(() => new Set());
  const [bulkOrderItems, setBulkOrderItems] = useState([]);
  const [bulkOrderLoading, setBulkOrderLoading] = useState(false);
  const [bulkOrderError, setBulkOrderError] = useState("");
  const statusNotificationCacheRef = useRef(new Map());

  const statusNotificationPendingRef = useRef(new Map());

  const closeOrderModal = useCallback(() => {
    setOrderModalConsumable(null);
    setShowEditForm(false);
    setOrderModalError("");
    setPendingRequestOrderId(null);
    setPendingRequestCreatesNewLine(false);
  }, []);

  const openOrderModal = useCallback(
    (item, { requestId, createNewRequest = false } = {}) => {
      if (!item) {
        return;
      }
      const lastLog = item.orderHistory?.[0];
      const baseQuantity =
      item.suggestedOrderQuantity || (lastLog?.quantity ?? item.lastOrderQuantity ?? item.estimatedQuantity ?? "");
      const baseUnitCost =
      lastLog?.unitCost ?? (
      item.unitCost !== undefined && item.unitCost !== null ? item.unitCost : "");

      setOrderModalConsumable(item);
      setOrderForm({
        quantity: baseQuantity !== "" ? String(baseQuantity) : "",
        unitCost:
        baseUnitCost !== "" && baseUnitCost !== null && baseUnitCost !== undefined ?
        Number(baseUnitCost).toFixed(2) :
        "",
        supplier: lastLog?.supplier ?? item.supplier ?? "",
        orderDate: todayIso
      });
      setShowEditForm(false);
      setOrderModalError("");
      setPendingRequestOrderId(requestId ?? null);
      setPendingRequestCreatesNewLine(Boolean(createNewRequest));
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

      logFailure("❌ Failed to load consumables", error);
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
        const body = await response.
        json().
        catch(() => ({ message: "Unable to load requests." }));
        throw new Error(body.message || "Unable to load requests.");
      }

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to load requests.");
      }

      setTechRequests(payload.data || []);
    } catch (error) {
      logFailure("❌ Failed to load consumable requests", error);
      setRequestsError(error?.message || "Unable to load requests.");
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTechRequests();
  }, [fetchTechRequests]);

  const findRequestConsumable = useCallback(
    (request) => findConsumableForRequest(request, consumables),
    [consumables]
  );

  const handleRequestOrder = useCallback(
    (request) => {
      if (!request) {
        return;
      }
      const consumable = findRequestConsumable(request);
      if (!consumable) {
        setRequestsError(
          `Consumable "${request.itemName}" isn't in the tracker yet. Add it via Stock Check before ordering.`
        );
        return;
      }
      openOrderModal(consumable, {
        requestId: request.id,
        createNewRequest: request.status === "arrived",
      });
    },
    [findRequestConsumable, openOrderModal]
  );

  const handleRequestOrdered = useCallback(
    async (requestId, consumableId, quantity, createNewRequest = false) => {
      if (!requestId) {
        return;
      }

      setOrderingRequestId(requestId);
      setRequestsError("");
      try {
        const response = await fetch("/api/workshop/consumables/requests", {
          method: createNewRequest ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createNewRequest
            ? { action: "reorder", sourceRequestId: requestId, consumableId, quantity }
            : { id: requestId, status: "ordered", consumableId, quantity })
        });

        if (!response.ok) {
          const body = await response.
          json().
          catch(() => ({ message: "Unable to update request." }));
          throw new Error(body.message || "Unable to update request.");
        }

        const payload = await response.json();
        if (!payload.success) {
          throw new Error(payload.message || "Unable to update request.");
        }

        if (createNewRequest) {
          await fetchTechRequests();
        } else {
          setTechRequests(payload.data || []);
        }
      } catch (error) {
        logFailure("❌ Failed to update consumable request", error);
        setRequestsError(error?.message || "Unable to update request.");
        throw error;
      } finally {
        setOrderingRequestId(null);
      }
    },
    [fetchTechRequests]
  );

  const handleRequestArrived = useCallback(
    async (request) => {
      if (!request) return;
      const consumable = findRequestConsumable(request);
      if (!consumable) {
        setRequestsError(
          `Consumable "${request.itemName}" isn't in the tracker, so its stock cannot be updated.`
        );
        return;
      }

      setOrderingRequestId(request.id);
      setRequestsError("");
      try {
        const response = await fetch("/api/workshop/consumables/requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: request.id,
            status: "arrived",
            consumableId: consumable.id,
          }),
        });
        const payload = await response.json().catch(() => ({ message: "Unable to mark the order as arrived." }));
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || "Unable to mark the order as arrived.");
        }

        setTechRequests(payload.data || []);
        await refreshConsumables();
      } catch (error) {
        logFailure("Failed to receive consumable request", error);
        setRequestsError(error?.message || "Unable to mark the order as arrived.");
      } finally {
        setOrderingRequestId(null);
      }
    },
    [findRequestConsumable, refreshConsumables]
  );

  const currentMonthNumber = useMemo(() => new Date().getMonth() + 1, []);
  const currentYearNumber = useMemo(() => new Date().getFullYear(), []);
  const monthLabel = useMemo(
    () =>
    new Date(viewYear, viewMonth - 1).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric"
    }),
    [viewMonth, viewYear]
  );
  const selectedMonthValue = useMemo(
    () => `${viewYear}-${String(viewMonth).padStart(2, "0")}`,
    [viewMonth, viewYear]
  );
  const maxMonthValue = useMemo(
    () => `${currentYearNumber}-${String(currentMonthNumber).padStart(2, "0")}`,
    [currentMonthNumber, currentYearNumber]
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
      minute: "2-digit"
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
        const body = await response.
        json().
        catch(() => ({ message: "Unable to load financial summary." }));
        throw new Error(body.message || "Unable to load financial summary.");
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to load financial summary.");
      }

      const { monthSpend, projectedSpend, monthlyBudget, budgetUpdatedAt, trend } =
      payload.data || {};
      setFinancialSummary({
        monthSpend: Number(monthSpend) || 0,
        projectedSpend: Number(projectedSpend) || 0,
        monthlyBudget: Number(monthlyBudget) || 0,
        budgetUpdatedAt: budgetUpdatedAt || null,
        trend: Array.isArray(trend) ? trend : []
      });
    } catch (error) {
      logFailure("❌ Failed to load financial summary", error);
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
        const body = await response.
        json().
        catch(() => ({ message: "Unable to load logs." }));
        throw new Error(body.message || "Unable to load logs.");
      }

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to load logs.");
      }

      setMonthlyLogs(payload.data.orders || []);
      setLogsSummary(payload.data.summary || { spend: 0, quantity: 0, orders: 0, suppliers: 0 });
    } catch (error) {
      logFailure("❌ Failed to load monthly logs", error);
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
    "workshop_consumable_usage"];

    const handleRealtime = (payload) => {
      if (payload.table === "workshop_consumable_requests") {
        fetchTechRequests();
        return;
      }
      if (payload.table === "workshop_consumable_budgets") {
        fetchFinancialSummary();
        return;
      }
      refreshConsumables();
      fetchFinancialSummary();
      if (payload.table === "workshop_consumable_orders") fetchMonthlyLogs();
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
  refreshConsumables]
  );

  useEffect(() => {
    if (
    financialSummary.monthlyBudget !== undefined &&
    financialSummary.monthlyBudget !== null)
    {
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

  const handleMonthValueChange = useCallback((value) => {
    const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})$/) : null;
    if (!match) return;
    setViewYear(Number(match[1]));
    setViewMonth(Number(match[2]));
  }, []);

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
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          year: viewYear,
          month: viewMonth,
          budget: parsed,
          updatedBy: dbUserId
        })
      });

      if (!response.ok) {
        const body = await response.
        json().
        catch(() => ({ message: "Unable to save budget." }));
        throw new Error(body.message || "Unable to save budget.");
      }

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Unable to save budget.");
      }

      const { monthSpend, projectedSpend, monthlyBudget, budgetUpdatedAt, trend } =
      payload.data || {};
      setFinancialSummary({
        monthSpend: Number(monthSpend) || 0,
        projectedSpend: Number(projectedSpend) || 0,
        monthlyBudget: Number(monthlyBudget) || 0,
        budgetUpdatedAt: budgetUpdatedAt || null,
        trend: Array.isArray(trend) ? trend : []
      });
      setBudgetSaveMessage("Budget saved.");
    } catch (error) {
      logFailure("❌ Failed to save monthly budget", error);
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
            estimatedQuantity: item.estimatedQuantity
          })
        });

        if (!response.ok) {
          const errorBody = await response.
          json().
          catch(() => ({ message: "Unable to report status." }));
          throw new Error(errorBody.message || "Failed to notify the Message Centre.");
        }
      } catch (error) {
        logFailure("❌ Unable to send consumable status notification:", error);
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
        sendConsumableStatusNotification(item, status.label).
        then(() => {
          statusNotificationCacheRef.current.set(item.id, status.label);
        }).
        finally(() => {
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
      expectedRemaining: monthlyBudget - projectedSpend,
      percentageUsed: monthlyBudget > 0 ? monthSpend / monthlyBudget * 100 : 0
    };
  }, [financialSummary]);

  const consumablesWithInsights = useMemo(
    () => consumables.map((item) => ({
      ...item,
      ...getStockInsight(item),
      priceChange: getPriceChange(item),
      scheduleStatus: getConsumableStatus(item),
    })),
    [consumables]
  );

  const filteredConsumables = useMemo(() => {
    const term = (searchQuery || "").trim().toLowerCase();
    if (!term) {
      return consumablesWithInsights;
    }
    return consumablesWithInsights.filter((item) => {
      const candidateValues = [
      item.name,
      item.stockQuantity,
      formatDate(item.lastOrderDate),
      formatDate(item.nextEstimatedOrderDate),
      item.supplier,
      item.unitCost,
      item.lastOrderTotalValue].

      filter(Boolean).
      map((value) => String(value).toLowerCase());

      return candidateValues.some((value) => value.includes(term));
    });
  }, [consumablesWithInsights, searchQuery]);

  const groupedRequests = useMemo(
    () => groupConsumableRequests(techRequests, consumables),
    [consumables, techRequests]
  );

  const supplierSpend = useMemo(() => {
    const grouped = new Map();
    monthlyLogs.forEach((order) => {
      const supplier = (order.supplier || "Unassigned").trim() || "Unassigned";
      const spend = Number(order.totalValue) || Number(order.quantity) * Number(order.unitCost) || 0;
      grouped.set(supplier, (grouped.get(supplier) || 0) + spend);
    });
    return Array.from(grouped, ([supplier, spend]) => ({ supplier, spend }))
      .sort((a, b) => b.spend - a.spend);
  }, [monthlyLogs]);

  const dashboardSummary = useMemo(() => {
    const active = consumablesWithInsights.filter((item) => item.isRequired !== false);
    const scheduled = active.filter((item) => item.scheduleStatus.label !== "Not Required");
    return {
      active: active.length,
      low: active.filter((item) => item.stockStatus === "Low").length,
      out: active.filter((item) => item.stockStatus === "Out").length,
      requestsNeedingAttention: techRequests.filter((request) => ["pending", "urgent"].includes(normalizeConsumableRequestStatus(request.status))).length,
      scheduledValue: scheduled.reduce((sum, item) => {
        const quantity = item.suggestedOrderQuantity ?? item.estimatedQuantity ?? 0;
        return sum + quantity * (Number(item.unitCost) || 0);
      }, 0),
    };
  }, [consumablesWithInsights, techRequests]);

  const criticalItems = useMemo(() => consumablesWithInsights
    .filter((item) => item.isRequired !== false && (item.stockStatus !== "Available" || item.scheduleStatus.label !== "Not Required"))
    .sort((a, b) => {
      const stockRank = { Out: 0, Low: 1, Available: 2 };
      const scheduleRank = { Overdue: 0, "Coming Up": 1, "Not Required": 2 };
      return (stockRank[a.stockStatus] - stockRank[b.stockStatus]) ||
        (scheduleRank[a.scheduleStatus.label] - scheduleRank[b.scheduleStatus.label]) ||
        ((a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity));
    })
    .slice(0, 6), [consumablesWithInsights]);

  const alerts = useMemo(() => {
    const items = [];
    if (dashboardSummary.out) items.push({ tone: "danger", label: `${dashboardSummary.out} item${dashboardSummary.out === 1 ? " is" : "s are"} out of stock` });
    if (dashboardSummary.low) items.push({ tone: "warning", label: `${dashboardSummary.low} item${dashboardSummary.low === 1 ? " is" : "s are"} running low` });
    const overdue = consumablesWithInsights.filter((item) => item.scheduleStatus.label === "Overdue").length;
    if (overdue) items.push({ tone: "danger", label: `${overdue} scheduled order${overdue === 1 ? " is" : "s are"} overdue` });
    const comingUp = consumablesWithInsights.filter((item) => item.scheduleStatus.label === "Coming Up").length;
    if (comingUp) items.push({ tone: "warning", label: `${comingUp} scheduled order${comingUp === 1 ? " is" : "s are"} coming up` });
    if (dashboardSummary.requestsNeedingAttention) items.push({ tone: "warning", label: `${dashboardSummary.requestsNeedingAttention} request${dashboardSummary.requestsNeedingAttention === 1 ? " needs" : "s need"} attention` });
    if (totals.monthlyBudget > 0 && totals.percentageUsed >= 100) items.push({ tone: "danger", label: `Budget exceeded by ${formatCurrency(Math.abs(totals.budgetRemaining))}` });
    else if (totals.monthlyBudget > 0 && totals.percentageUsed >= 80) items.push({ tone: "warning", label: `${Math.round(totals.percentageUsed)}% of the monthly budget has been used` });
    return items;
  }, [consumablesWithInsights, dashboardSummary, totals]);

  const recentActivity = useMemo(() => [
    ...monthlyLogs.map((order) => ({
      id: `order-${order.id}`,
      date: order.date,
      label: `Order placed · ${order.itemName || "Consumable"}`,
      detail: `${Number(order.quantity) || 0} units · ${formatCurrency(order.totalValue || Number(order.quantity) * Number(order.unitCost))}`,
    })),
    ...techRequests.map((request) => ({
      id: `request-${request.id}`,
      date: request.updatedAt || request.requestedAt,
      label: `Request ${request.status || "pending"} · ${request.itemName || "Consumable"}`,
      detail: `${Number(request.quantity) || 0} units · ${request.requestedByName || "Technician"}`,
    })),
  ].filter((activity) => activity.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8), [monthlyLogs, techRequests]);

  const handleOrderFormChange = useCallback((field) => (event) => {
    setOrderForm((previous) => ({ ...previous, [field]: event.target.value }));
  }, []);

  const toggleConsumableSelection = useCallback((itemId) => {
    setSelectedConsumableIds((previous) => {
      const next = new Set(previous);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const openBulkOrder = useCallback(() => {
    const selected = consumablesWithInsights.filter((item) => selectedConsumableIds.has(item.id));
    if (!selected.length) return;
    setBulkOrderItems(selected.map((item) => ({
      id: item.id,
      name: item.name,
      supplier: item.orderHistory?.[0]?.supplier || item.supplier || "",
      quantity: String(item.suggestedOrderQuantity || item.estimatedQuantity || item.lastOrderQuantity || 1),
      unitCost: String(item.orderHistory?.[0]?.unitCost ?? item.unitCost ?? 0),
      orderDate: todayIso,
      priceChange: item.priceChange,
    })));
    setBulkOrderError("");
  }, [consumablesWithInsights, selectedConsumableIds, todayIso]);

  const closeBulkOrder = useCallback(() => {
    setBulkOrderItems([]);
    setBulkOrderError("");
  }, []);

  const handleBulkOrderChange = useCallback((itemId, field, value) => {
    setBulkOrderItems((previous) => previous.map((item) =>
      item.id === itemId ? { ...item, [field]: value } : item
    ));
    setBulkOrderError("");
  }, []);

  const handleBulkOrderSubmit = useCallback(async (event) => {
    event.preventDefault();
    const suppliers = new Set(bulkOrderItems.map((item) => item.supplier.trim().toLowerCase()).filter(Boolean));
    if (suppliers.size !== 1 || bulkOrderItems.some((item) => !item.supplier.trim())) {
      setBulkOrderError("Grouped orders must use one shared supplier for every line.");
      return;
    }
    if (bulkOrderItems.some((item) => Number(item.quantity) <= 0 || Number(item.unitCost) < 0)) {
      setBulkOrderError("Enter a valid quantity and unit cost for every line.");
      return;
    }

    setBulkOrderLoading(true);
    setBulkOrderError("");
    try {
      for (const item of bulkOrderItems) {
        await addConsumableOrder(item.id, {
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
          supplier: item.supplier.trim(),
          orderDate: item.orderDate || todayIso,
          estimatedQuantityOverride: Number(item.quantity),
        });
      }
      setSelectedConsumableIds(new Set());
      closeBulkOrder();
      await Promise.all([refreshConsumables(), fetchMonthlyLogs(), fetchFinancialSummary()]);
    } catch (error) {
      setBulkOrderError(error?.message || "Unable to place the grouped order.");
    } finally {
      setBulkOrderLoading(false);
    }
  }, [bulkOrderItems, closeBulkOrder, fetchFinancialSummary, fetchMonthlyLogs, refreshConsumables, todayIso]);

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
        orderDate: orderForm.orderDate || todayIso
      };

      try {
        await addConsumableOrder(orderModalConsumable.id, {
          ...payload,
          estimatedQuantityOverride: payload.quantity
        });
        if (pendingRequestOrderId) {
          await handleRequestOrdered(
            pendingRequestOrderId,
            orderModalConsumable.id,
            payload.quantity,
            pendingRequestCreatesNewLine
          );
          setPendingRequestOrderId(null);
          setPendingRequestCreatesNewLine(false);
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
    pendingRequestCreatesNewLine,
    pendingRequestOrderId,
    refreshConsumables,
    todayIso]

  );

  const previewLogs = orderModalConsumable?.orderHistory?.slice(0, 3) ?? [];

  if (!isWorkshopManager) {
    return <ConsumablesTrackerPageUi view="section1" cardStyle={cardStyle} Link={Link} />;





























  }

  return <ConsumablesTrackerPageUi
    view="section2"
    PageShell={PageShell}
    ContentWidth={ContentWidth}
    InlineLoading={InlineLoading}
    Link={Link}
    SearchBar={SearchBar}
    StockCheckPopup={StockCheckPopup}
    alerts={alerts}
    budgetInput={budgetInput}
    budgetSaveError={budgetSaveError}
    budgetSaveMessage={budgetSaveMessage}
    budgetSaving={budgetSaving}
    bulkOrderError={bulkOrderError}
    bulkOrderItems={bulkOrderItems}
    bulkOrderLoading={bulkOrderLoading}
    cardStyle={cardStyle}
    closeBulkOrder={closeBulkOrder}
    closeHistoryModal={closeHistoryModal}
    closeOrderModal={closeOrderModal}
    consumablesError={consumablesError}
    criticalItems={criticalItems}
    dashboardSummary={dashboardSummary}
    dbUserId={dbUserId}
    duplicateModalStyle={duplicateModalStyle}
    duplicateOverlayStyle={duplicateOverlayStyle}
    fetchTechRequests={fetchTechRequests}
    filteredConsumables={filteredConsumables}
    financialError={financialError}
    financialLoading={financialLoading}
    financialSummary={financialSummary}
    formatCurrency={formatCurrency}
    formatDate={formatDate}
    formattedBudgetUpdatedAt={formattedBudgetUpdatedAt}
    groupedRequests={groupedRequests}
    handleBudgetInputChange={handleBudgetInputChange}
    handleBudgetSave={handleBudgetSave}
    handleBulkOrderChange={handleBulkOrderChange}
    handleBulkOrderSubmit={handleBulkOrderSubmit}
    handleEditedOrder={handleEditedOrder}
    handleMonthValueChange={handleMonthValueChange}
    handleOrderFormChange={handleOrderFormChange}
    handleRequestArrived={handleRequestArrived}
    handleRequestOrder={handleRequestOrder}
    historyModalConsumable={historyModalConsumable}
    historyModalStyle={historyModalStyle}
    isWorkshopManager={isWorkshopManager}
    loadingConsumables={loadingConsumables}
    logsError={logsError}
    logsLoading={logsLoading}
    logsSummary={logsSummary}
    maxMonthValue={maxMonthValue}
    monthLabel={monthLabel}
    monthlyLogs={monthlyLogs}
    MonthPickerField={MonthPickerField}
    openBulkOrder={openBulkOrder}
    openHistoryModal={openHistoryModal}
    openOrderModal={openOrderModal}
    orderForm={orderForm}
    orderModalConsumable={orderModalConsumable}
    orderModalError={orderModalError}
    orderModalLoading={orderModalLoading}
    orderModalOverlayStyle={orderModalOverlayStyle}
    orderModalStyle={orderModalStyle}
    orderingRequestId={orderingRequestId}
    potentialDuplicates={potentialDuplicates}
    previewLogs={previewLogs}
    recentActivity={recentActivity}
    requestsError={requestsError}
    requestsLoading={requestsLoading}
    searchQuery={searchQuery}
    selectedConsumableIds={selectedConsumableIds}
    selectedMonthValue={selectedMonthValue}
    setSearchQuery={setSearchQuery}
    setShowDuplicateModal={setShowDuplicateModal}
    setShowStockCheck={setShowStockCheck}
    showDuplicateModal={showDuplicateModal}
    showStockCheck={showStockCheck}
    supplierSpend={supplierSpend}
    techRequests={techRequests}
    toggleConsumableSelection={toggleConsumableSelection}
    totals={totals}
  />;


























































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































}

export default ConsumablesTrackerPage;
