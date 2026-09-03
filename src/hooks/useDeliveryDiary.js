// file location: src/hooks/useDeliveryDiary.js
//
// The data layer for /deliveries.
//
// One SWR key per day (`/api/parts/delivery-diary?date=…`) carries the route,
// the history, the summary, the drivers, the vehicles and the week strip. The
// previous implementation issued a fresh Supabase query on every state change
// and refetched the whole list after each row action; here a mutation patches
// the cache optimistically and revalidates once, so moving five stops costs one
// request rather than five round trips plus five full reloads.
//
// Route-map geocoding is a second, deliberately separate key: it is only
// fetched while the map view is open, and it is allowed to fail without
// affecting the list.

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { swrConfig } from "@/lib/swr/config";

const jsonFetcher = async (url) => {
  const response = await fetch(url, { credentials: "include" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || "Unable to load the delivery diary");
    error.status = response.status;
    throw error;
  }
  return payload?.data ?? null;
};

const EMPTY_SUMMARY = { counts: {}, totalValue: 0, unpaidValue: 0, urgentCount: 0, total: 0 };

export const deliveryDiaryKey = (date, driverId) => {
  if (!date) return null;
  const params = new URLSearchParams({ date });
  if (driverId) params.set("driverId", String(driverId));
  return `/api/parts/delivery-diary?${params.toString()}`;
};

/**
 * @param {{date:string, driverId?:number|null, enabled?:boolean}} params
 */
export function useDeliveryDiary({ date, driverId = null, enabled = true } = {}) {
  const key = enabled ? deliveryDiaryKey(date, driverId) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, jsonFetcher, {
    ...swrConfig,
    keepPreviousData: true,
    // The diary is a shared board — a stop marked delivered on the van should
    // appear on the desk without a manual refresh — but a van run is measured
    // in minutes, not seconds. A minute-long interval is enough to keep the
    // board honest without polling a page a driver leaves open all day.
    refreshInterval: 60_000,
  });

  const deliveries = useMemo(() => data?.deliveries ?? [], [data]);
  const events = useMemo(() => data?.events ?? {}, [data]);

  /**
   * Replace one delivery in the cache without a refetch, then revalidate in the
   * background. Used by every row action so the button feels immediate.
   */
  const applyDeliveryToCache = useCallback(
    (delivery, deliveryEvents) => {
      if (!delivery) return;
      mutate(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            deliveries: current.deliveries.map((row) =>
              row.id === delivery.id ? delivery : row
            ),
            events: deliveryEvents
              ? { ...current.events, [delivery.id]: deliveryEvents }
              : current.events,
          };
        },
        { revalidate: true }
      );
    },
    [mutate]
  );

  /** Replace the whole ordered list (used after a drag-and-drop save). */
  const applyRouteToCache = useCallback(
    (orderedDeliveries, { revalidate = true } = {}) => {
      if (!Array.isArray(orderedDeliveries)) return;
      mutate(
        (current) => (current ? { ...current, deliveries: orderedDeliveries } : current),
        { revalidate }
      );
    },
    [mutate]
  );

  return {
    date: data?.date ?? date,
    deliveries,
    events,
    summary: data?.summary ?? EMPTY_SUMMARY,
    drivers: data?.drivers ?? [],
    vehicles: data?.vehicles ?? [],
    week: data?.week ?? null,
    capabilities: data?.capabilities ?? null,
    migrationPending: Boolean(data?.migrationPending),
    // `isLoading` stays false while SWR serves the previous day's data, so the
    // page shows the skeleton only on a genuinely cold load.
    loading: isLoading && !data,
    refreshing: isValidating,
    error: error?.message || "",
    mutate,
    applyDeliveryToCache,
    applyRouteToCache,
  };
}

/**
 * Geocoded stops for the route panel. Only fetched while the panel is open.
 * @param {{date:string, enabled?:boolean}} params
 */
export function useDeliveryRouteMap({ date, enabled = false } = {}) {
  const key = enabled && date ? `/api/parts/delivery-diary/route-map?date=${date}` : null;
  const { data, error, isLoading, mutate } = useSWR(key, jsonFetcher, {
    ...swrConfig,
    // Geocoding a route is an outbound call per day. Once resolved it does not
    // change while the page is open, so nothing here revalidates on focus.
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 300_000,
  });

  return {
    map: data ?? null,
    loading: isLoading,
    error: error?.message || "",
    refresh: mutate,
  };
}

export default useDeliveryDiary;
