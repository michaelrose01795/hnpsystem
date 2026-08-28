// file location: src/pages/deliveries/index.js
//
// The parts delivery diary — the daily control screen for the van run.
//
// This file is the logic layer only; every element it renders lives in
// src/components/page-ui/parts/parts-deliveries-ui.js (the house page-ui split)
// and in src/components/Deliveries/*.
//
// What changed from the previous version, and why:
//   * All Supabase access moved behind /api/parts/delivery-diary/* (CLAUDE.md
//     §5) — the page used to query and UPDATE `parts_delivery_jobs` straight
//     from the browser, so no role could be enforced on a write and nothing was
//     audited.
//   * One SWR key for the whole day instead of a refetch per interaction.
//   * The up/down reorder buttons became drag-and-drop with a keyboard
//     equivalent on the same handle, saving the full ordered list in one call.
//   * The three-value status chip became the real workflow in
//     src/features/deliveries/deliveryStatus.js.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import useIsMobile from "@/hooks/useIsMobile";
import { hasAllAccessRole } from "@/lib/auth/roles";
import { reportError, reportSuccess, reportWarning } from "@/lib/notifications/report";
import useDeliveryDiary, { useDeliveryRouteMap } from "@/hooks/useDeliveryDiary";
import {
  DELIVERY_STATUS,
  DELIVERY_STATUS_META,
  DELIVERY_STATUS_ORDER,
  normaliseDeliveryStatus,
  resolveDeliveryCapabilities,
} from "@/features/deliveries/deliveryStatus";
import { todayIso } from "@/features/deliveries/deliveryFormatting";
import PartsDeliveriesPageUi from "@/components/page-ui/parts/parts-deliveries-ui"; // Extracted presentation layer.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The five figures the parts desk reads first, in the order the workflow runs.
// Each one is also a filter: clicking a tile narrows the list to that state.
const SUMMARY_TILES = [
  { key: DELIVERY_STATUS.PLANNED, label: "Planned" },
  { key: DELIVERY_STATUS.READY, label: "Ready" },
  { key: DELIVERY_STATUS.OUT_FOR_DELIVERY, label: "Out for delivery" },
  { key: DELIVERY_STATUS.DELIVERED, label: "Delivered" },
  { key: DELIVERY_STATUS.FAILED, label: "Failed" },
];


const matchesSearch = (delivery, term) => {
  if (!term) return true;
  const haystack = [
    delivery.customerDisplayName,
    delivery.customer_name,
    delivery.invoice_number,
    delivery.order_reference,
    delivery.jobNumber,
    delivery.addressLine,
    delivery.postcodeValue,
    delivery.contactPhone,
    delivery.part_name,
    delivery.part_number,
    delivery.driver_name,
    delivery.vehicle_reg,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
};

export default function PartsDeliveriesPage() {
  const router = useRouter();
  const { user } = useUser();
  const isMobile = useIsMobile(900);

  const roles = useMemo(
    () => (user?.roles || []).map((role) => String(role).toLowerCase()),
    [user?.roles]
  );
  // The API is authoritative and returns its own capability set; this local
  // copy only decides what to render before the first response arrives.
  const localCapabilities = useMemo(
    () => resolveDeliveryCapabilities(roles, hasAllAccessRole(roles)),
    [roles]
  );

  const [selectedDate, setSelectedDate] = useState(todayIso);
  // The list is the only view. The route map moved into the detail panel
  // (always on screen next to the selected stop) and the week strip is a
  // toggle above the route rather than a mode that replaces it.
  const [weekOpen, setWeekOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(null); // { id, action }
  const [proofTarget, setProofTarget] = useState(null);
  const [failureTarget, setFailureTarget] = useState(null);
  const [modalError, setModalError] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [draggingId, setDraggingId] = useState("");
  const [dropTargetId, setDropTargetId] = useState("");
  const [routeAnnouncement, setRouteAnnouncement] = useState("");

  // A deep link (?date=2026-08-28) opens straight on that day, which is what
  // the topbar alerts and the dashboard tiles link to.
  useEffect(() => {
    if (!router.isReady) return;
    const queryDate = String(router.query.date || "");
    if (ISO_DATE_RE.test(queryDate)) setSelectedDate(queryDate);
  }, [router.isReady, router.query.date]);

  const {
    deliveries,
    events,
    summary,
    drivers,
    vehicles,
    week,
    capabilities: serverCapabilities,
    migrationPending,
    loading,
    refreshing,
    error,
    mutate,
    applyDeliveryToCache,
    applyRouteToCache,
  } = useDeliveryDiary({ date: selectedDate, enabled: localCapabilities.view });

  const capabilities = serverCapabilities || localCapabilities;

  const { map, loading: mapLoading, error: mapError } = useDeliveryRouteMap({
    date: selectedDate,
    enabled: localCapabilities.view,
  });

  // Route order is rendered from a local copy while a drag is being saved, so
  // the list does not snap back to the server order mid-gesture.
  const [orderOverride, setOrderOverride] = useState(null);
  const orderedDeliveries = useMemo(() => {
    if (!orderOverride) return deliveries;
    const byId = new Map(deliveries.map((row) => [row.id, row]));
    const ordered = orderOverride.map((id) => byId.get(id)).filter(Boolean);
    // Anything the override does not know about (a stop added by someone else
    // while the drag was in flight) keeps its place at the end.
    const missing = deliveries.filter((row) => !orderOverride.includes(row.id));
    return [...ordered, ...missing];
  }, [deliveries, orderOverride]);

  useEffect(() => {
    setOrderOverride(null);
  }, [selectedDate]);

  const driverOptions = useMemo(
    () => [
      { value: "all", label: "All drivers" },
      { value: "unassigned", label: "Unassigned" },
      ...drivers.map((driver) => ({ value: String(driver.userId), label: driver.name })),
    ],
    [drivers]
  );

  const vehicleOptions = useMemo(
    () => [
      { value: "all", label: "All vehicles" },
      { value: "none", label: "No vehicle" },
      ...vehicles.map((vehicle) => ({ value: vehicle.reg, label: vehicle.label })),
    ],
    [vehicles]
  );

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All statuses" },
      ...DELIVERY_STATUS_ORDER.map((status) => ({
        value: status,
        label: DELIVERY_STATUS_META[status].label,
      })),
    ],
    []
  );

  const filteredDeliveries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orderedDeliveries.filter((delivery) => {
      if (statusFilter !== "all" && normaliseDeliveryStatus(delivery.status) !== statusFilter) {
        return false;
      }
      if (driverFilter === "unassigned" && delivery.driver_id) return false;
      if (
        driverFilter !== "all" &&
        driverFilter !== "unassigned" &&
        String(delivery.driver_id || "") !== driverFilter
      ) {
        return false;
      }
      if (vehicleFilter === "none" && delivery.vehicle_reg) return false;
      if (vehicleFilter !== "all" && vehicleFilter !== "none" && delivery.vehicle_reg !== vehicleFilter) {
        return false;
      }
      return matchesSearch(delivery, term);
    });
  }, [orderedDeliveries, searchTerm, statusFilter, driverFilter, vehicleFilter]);

  const selectedDelivery = useMemo(
    () => orderedDeliveries.find((row) => row.id === selectedId) || null,
    [orderedDeliveries, selectedId]
  );

  const filtersActive =
    statusFilter !== "all" ||
    driverFilter !== "all" ||
    vehicleFilter !== "all" ||
    searchTerm.trim().length > 0;

  // Reordering while a filter hides part of the route would renumber stops the
  // user cannot see, so it is disabled until the filters are cleared.
  const reorderEnabled = capabilities.reorder && !filtersActive;

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setStatusFilter("all");
    setDriverFilter("all");
    setVehicleFilter("all");
  }, []);

  const changeDate = useCallback(
    (nextDate) => {
      if (!ISO_DATE_RE.test(nextDate || "")) return;
      setSelectedDate(nextDate);
      setSelectedId("");
      // Keep the URL in step so the day can be shared or reloaded, without
      // pushing a history entry for every arrow press.
      router.replace(
        { pathname: router.pathname, query: { ...router.query, date: nextDate } },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const sendPatch = useCallback(
    async (delivery, payload) => {
      const response = await fetch(`/api/parts/delivery-diary/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.success === false) {
        throw new Error(json?.message || "The delivery could not be updated.");
      }
      return json.data;
    },
    []
  );

  const runAction = useCallback(
    async (delivery, actionKey) => {
      // The two actions that need more than a click open their own dialogue
      // first, then come back through confirmProof / confirmFailure.
      if (actionKey === "mark_delivered") {
        setModalError("");
        setProofTarget(delivery);
        return;
      }
      if (actionKey === "mark_failed") {
        setModalError("");
        setFailureTarget(delivery);
        return;
      }

      setBusy({ id: delivery.id, action: actionKey });
      try {
        const data = await sendPatch(delivery, { action: actionKey });
        applyDeliveryToCache(data.delivery, data.events);
        (data.syncNotes || []).forEach((note) => reportSuccess(note));
      } catch (actionError) {
        reportError("The delivery could not be updated.", actionError, {
          source: "deliveries",
          deliveryId: delivery.id,
          action: actionKey,
        });
      } finally {
        setBusy(null);
      }
    },
    [applyDeliveryToCache, sendPatch]
  );

  const patchDelivery = useCallback(
    async (delivery, patch) => {
      setBusy({ id: delivery.id, action: "patch" });
      try {
        const data = await sendPatch(delivery, { patch });
        applyDeliveryToCache(data.delivery, data.events);
      } catch (patchError) {
        reportError("That change could not be saved.", patchError, {
          source: "deliveries",
          deliveryId: delivery.id,
          fields: Object.keys(patch),
        });
      } finally {
        setBusy(null);
      }
    },
    [applyDeliveryToCache, sendPatch]
  );

  const uploadProofFiles = useCallback(async (delivery, { photo, signature, recipientName }) => {
    if (!photo && !signature) return null;
    const form = new FormData();
    form.append("deliveryJobId", delivery.id);
    if (recipientName) form.append("recipientName", recipientName);
    if (photo) form.append("photo", photo);
    if (signature) form.append("signature", signature);
    const response = await fetch("/api/parts/delivery-diary/proof", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.success === false) {
      throw new Error(json?.message || "Proof of delivery could not be stored.");
    }
    return json.data;
  }, []);

  const confirmProof = useCallback(
    async (details) => {
      if (!proofTarget) return;
      setModalSaving(true);
      setModalError("");
      try {
        // The delivery is recorded first. The photo/signature upload is a
        // separate, best-effort step: a van on a weak connection must still be
        // able to complete the stop.
        const data = await sendPatch(proofTarget, {
          action: "mark_delivered",
          payload: {
            recipientName: details.recipientName,
            podNotes: details.podNotes,
            coreCollected: details.coreCollected,
          },
        });
        applyDeliveryToCache(data.delivery, data.events);
        (data.syncNotes || []).forEach((note) => reportSuccess(note));
        setProofTarget(null);

        try {
          const proof = await uploadProofFiles(proofTarget, details);
          if (proof?.delivery) applyDeliveryToCache(proof.delivery, proof.events);
        } catch (uploadError) {
          reportWarning(
            "Delivery recorded, but the photo or signature could not be stored. Add it again from the delivery panel."
          );
          console.warn("Proof upload failed:", uploadError);
        }
      } catch (proofError) {
        setModalError(proofError?.message || "The delivery could not be recorded.");
      } finally {
        setModalSaving(false);
      }
    },
    [applyDeliveryToCache, proofTarget, sendPatch, uploadProofFiles]
  );

  const confirmFailure = useCallback(
    async (details) => {
      if (!failureTarget) return;
      setModalSaving(true);
      setModalError("");
      try {
        const data = await sendPatch(failureTarget, {
          action: "mark_failed",
          payload: details,
        });
        applyDeliveryToCache(data.delivery, data.events);
        setFailureTarget(null);
      } catch (failError) {
        setModalError(failError?.message || "The failure could not be recorded.");
      } finally {
        setModalSaving(false);
      }
    },
    [applyDeliveryToCache, failureTarget, sendPatch]
  );

  // ---------------------------------------------------------------------------
  // Route ordering
  // ---------------------------------------------------------------------------
  const saveTimer = useRef(null);

  const persistOrder = useCallback(
    async (orderedIds, movedId) => {
      try {
        const response = await fetch("/api/parts/delivery-diary/route-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ date: selectedDate, orderedIds, movedId }),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || json?.success === false) {
          throw new Error(json?.message || "The route order could not be saved.");
        }
        applyRouteToCache(json.data.deliveries, { revalidate: false });
        setOrderOverride(null);
      } catch (orderError) {
        // Drop the optimistic order and re-read, so the list always shows what
        // is actually stored rather than a save that did not happen.
        setOrderOverride(null);
        mutate();
        reportError("The route order could not be saved.", orderError, {
          source: "deliveries",
          date: selectedDate,
        });
      }
    },
    [applyRouteToCache, mutate, selectedDate]
  );

  // The order saves itself; the short debounce coalesces a burst of keyboard
  // moves into one write rather than one per keystroke.
  const commitOrder = useCallback(
    (orderedIds, movedId) => {
      setOrderOverride(orderedIds);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persistOrder(orderedIds, movedId), 400);
    },
    [persistOrder]
  );

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const moveStop = useCallback(
    (deliveryId, targetIndex) => {
      const currentIds = orderedDeliveries.map((row) => row.id);
      const fromIndex = currentIds.indexOf(deliveryId);
      if (fromIndex === -1) return;
      const bounded = Math.max(0, Math.min(currentIds.length - 1, targetIndex));
      if (bounded === fromIndex) return;
      const next = [...currentIds];
      next.splice(fromIndex, 1);
      next.splice(bounded, 0, deliveryId);
      commitOrder(next, deliveryId);
      setRouteAnnouncement(`Moved to stop ${bounded + 1} of ${next.length}`);
    },
    [commitOrder, orderedDeliveries]
  );

  const handleKeyboardMove = useCallback(
    (deliveryId, delta) => {
      const currentIds = orderedDeliveries.map((row) => row.id);
      const fromIndex = currentIds.indexOf(deliveryId);
      if (fromIndex === -1) return;
      moveStop(deliveryId, fromIndex + delta);
    },
    [moveStop, orderedDeliveries]
  );

  const handleDragStart = useCallback((event, deliveryId) => {
    setDraggingId(deliveryId);
    event.dataTransfer.effectAllowed = "move";
    // Firefox will not start a drag unless some data is set.
    event.dataTransfer.setData("text/plain", deliveryId);
  }, []);

  const handleDragOver = useCallback(
    (event, deliveryId) => {
      if (!draggingId || deliveryId === draggingId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTargetId(deliveryId);
    },
    [draggingId]
  );

  const handleDrop = useCallback(
    (event, deliveryId) => {
      event.preventDefault();
      const sourceId = draggingId || event.dataTransfer.getData("text/plain");
      setDraggingId("");
      setDropTargetId("");
      if (!sourceId || sourceId === deliveryId) return;
      const currentIds = orderedDeliveries.map((row) => row.id);
      moveStop(sourceId, currentIds.indexOf(deliveryId));
    },
    [draggingId, moveStop, orderedDeliveries]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId("");
    setDropTargetId("");
  }, []);

  if (!localCapabilities.view) {
    return <PartsDeliveriesPageUi view="no-access" />;
  }

  return (
    <PartsDeliveriesPageUi
      view="diary"
      busy={busy}
      capabilities={capabilities}
      changeDate={changeDate}
      clearFilters={clearFilters}
      confirmFailure={confirmFailure}
      confirmProof={confirmProof}
      deliveries={filteredDeliveries}
      driverFilter={driverFilter}
      driverOptions={driverOptions}
      drivers={drivers}
      draggingId={draggingId}
      dropTargetId={dropTargetId}
      error={error}
      events={events}
      failureTarget={failureTarget}
      filtersActive={filtersActive}
      handleDragEnd={handleDragEnd}
      handleDragOver={handleDragOver}
      handleDragStart={handleDragStart}
      handleDrop={handleDrop}
      handleKeyboardMove={handleKeyboardMove}
      isMobile={isMobile}
      loading={loading}
      map={map}
      mapError={mapError}
      mapLoading={mapLoading}
      migrationPending={migrationPending}
      modalError={modalError}
      modalSaving={modalSaving}
      onCloseFailure={() => setFailureTarget(null)}
      onCloseProof={() => setProofTarget(null)}
      onOpenProof={(delivery) => {
        setModalError("");
        setProofTarget(delivery);
      }}
      patchDelivery={patchDelivery}
      proofTarget={proofTarget}
      refreshing={refreshing}
      reorderEnabled={reorderEnabled}
      routeAnnouncement={routeAnnouncement}
      runAction={runAction}
      searchTerm={searchTerm}
      selectDelivery={(delivery) =>
        setSelectedId((current) => (current === delivery.id ? "" : delivery.id))
      }
      selectedDate={selectedDate}
      selectedDelivery={selectedDelivery}
      selectedId={selectedId}
      setDriverFilter={setDriverFilter}
      setSearchTerm={setSearchTerm}
      setStatusFilter={setStatusFilter}
      setVehicleFilter={setVehicleFilter}
      toggleWeek={() => setWeekOpen((open) => !open)}
      statusFilter={statusFilter}
      statusOptions={statusOptions}
      summary={summary}
      summaryTiles={SUMMARY_TILES}
      todayIso={todayIso}
      totalStops={orderedDeliveries.length}
      vehicleFilter={vehicleFilter}
      vehicleOptions={vehicleOptions}
      vehicles={vehicles}
      weekOpen={weekOpen}
      week={week}
    />
  );
}
