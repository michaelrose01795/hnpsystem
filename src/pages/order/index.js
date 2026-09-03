// file location: src/pages/order/index.js
// Standalone parts orders list. Previously the "Orders" tab inside /jobs -
// the data flow and presentation are unchanged, only the route.
"use client";

import React, { useCallback, useEffect, useMemo, useState, useDeferredValue } from "react";
import { useRouter } from "next/router";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { useUser } from "@/context/UserContext";
import { hasAllAccessRole } from "@/lib/auth/roles";
import { logFailure } from "@/lib/utils/logFailure";
import OrdersViewUi from "@/components/page-ui/parts/orders/orders-view-ui";

const matchesSearchTerm = (order, value) => {
  if (!value) return true;
  const haystack = [
  order.orderNumber,
  order.reg,
  order.customer,
  order.makeModel,
  order.status,
  order.delivery_status,
  order.delivery_type].
  filter(Boolean).
  join(" ").
  toLowerCase();
  return haystack.includes(value);
};

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useUser();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [fulfilmentFilter, setFulfilmentFilter] = useState("all");

  const userRoles = useMemo(() => {
    if (!user?.roles) return [];
    return user.roles.
    map((role) => typeof role === "string" ? role.trim().toLowerCase() : "").
    filter(Boolean);
  }, [user]);

  const canViewOrders = useMemo(
    () =>
    hasAllAccessRole(userRoles) ||
    userRoles.some((role) => role === "parts" || role === "parts manager"),
    [userRoles]
  );

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const response = await fetch("/api/parts/orders");
      if (!response.ok) {
        throw new Error("Failed to load orders");
      }
      const payload = await response.json();
      setOrders(payload?.orders || []);
    } catch (orderError) {
      logFailure("Failed to fetch parts orders", orderError);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canViewOrders) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }
    fetchOrders();
  }, [canViewOrders, fetchOrders]);

  const normalizedOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.
    map((order) => {
      const makeModel = [order.vehicle_make, order.vehicle_model].
      filter(Boolean).
      join(" ").
      trim();
      const appointment = order.delivery_eta ?
      {
        date: order.delivery_eta,
        time: order.delivery_window || ""
      } :
      null;
      const fallbackCustomer =
      order.customer_name ||
      order.delivery_contact ||
      order.customer_email ||
      "Parts order customer";
      const normalizedNumber = (order.order_number || "").trim().toUpperCase();

      return {
        ...order,
        orderNumber: normalizedNumber,
        reg: order.vehicle_reg || "",
        customer: fallbackCustomer,
        makeModel: makeModel || order.vehicle_make || order.vehicle_model || "",
        waitingStatus:
        order.delivery_status || order.delivery_type || order.status || "Order",
        appointment,
        createdAt: order.created_at,
        requests: order.items || []
      };
    }).
    filter((order) => Boolean(order.orderNumber) && order.orderNumber.startsWith("P"));
  }, [orders]);

  const deferredSearchValue = useDeferredValue(searchValue.trim().toLowerCase());

  const sortedOrders = useMemo(() => {
    const filtered = normalizedOrders.filter((order) => {
      if (fulfilmentFilter !== "all" && order.delivery_type !== fulfilmentFilter) {
        return false;
      }
      return matchesSearchTerm(order, deferredSearchValue);
    });
    const getSortValue = (order) => {
      if (order?.appointment?.date && order?.appointment?.time) {
        return new Date(`${order.appointment.date}T${order.appointment.time}`);
      }
      if (order?.appointment?.date) return new Date(`${order.appointment.date}T00:00:00`);
      if (order?.createdAt) return new Date(order.createdAt);
      return new Date(0);
    };
    return filtered.slice().sort((a, b) => getSortValue(a) - getSortValue(b));
  }, [deferredSearchValue, fulfilmentFilter, normalizedOrders]);

  const emptyStateMessage = !canViewOrders ?
  "You do not have access to parts orders." :
  deferredSearchValue || fulfilmentFilter !== "all" ?
  "No orders match your search." :
  "No orders available.";

  const handleNavigateToOrder = useCallback(
    (orderNumber) => {
      router.push(`/new-order/${orderNumber}`);
    },
    [router]
  );

  if (ordersLoading && orders.length === 0 && canViewOrders) {
    return <OrdersViewUi view="section1" PageSkeleton={PageSkeleton} />;
  }

  return <OrdersViewUi view="section2" emptyStateMessage={emptyStateMessage} fulfilmentFilter={fulfilmentFilter} onFulfilmentFilterChange={setFulfilmentFilter} onNavigateToOrder={handleNavigateToOrder} onSearchValueChange={setSearchValue} ordersLoading={ordersLoading && canViewOrders} searchPlaceholder="Search orders..." searchValue={searchValue} sortedOrders={sortedOrders} />;
}
