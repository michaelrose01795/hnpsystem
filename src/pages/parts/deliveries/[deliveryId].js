// file location: src/pages/parts/deliveries/[deliveryId].js
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useConfirmation } from "@/context/ConfirmationContext";
import { supabase } from "@/lib/database/supabaseClient";
import ModalPortal from "@/components/popups/ModalPortal";
import { InlineLoading, SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import DeliveryRoutePageUi from "@/components/page-ui/parts/deliveries/parts-deliveries-delivery-id-ui"; // Extracted presentation layer.

const STATUS_META = {
  planned: { label: "Planned", background: "rgba(var(--warning-rgb), 0.15)", color: "var(--danger-dark)" },
  en_route: { label: "En Route", background: "rgba(var(--info-rgb), 0.15)", color: "var(--accent-purple)" },
  delivered: { label: "Delivered", background: "rgba(var(--info-rgb), 0.25)", color: "var(--info-dark)" }
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value));
};

const stopCardStyle = {
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--surface)",
  padding: "18px"
};

const buttonStyle = {
  borderRadius: "var(--radius-sm)",
  padding: "10px 16px",
  border: "none",
  fontWeight: 600,
  cursor: "pointer"
};

const getStopLocationValue = (stop = {}) =>
`${stop.address || stop.customer?.address || ""} ${stop.postcode || stop.customer?.postcode || ""}`.trim();

const estimateDistance = (fromStop, toStop) => {
  if (!fromStop || !toStop) {
    return 0;
  }
  const fromValue = getStopLocationValue(fromStop);
  const toValue = getStopLocationValue(toStop);
  if (!fromValue || !toValue) {
    return 5;
  }
  const charDiff = Math.abs(fromValue.length - toValue.length);
  const sharedChars = Array.from(fromValue).
  map((char, index) => toValue[index] === char ? 1 : 0).
  reduce((acc, val) => acc + val, 0);
  return Math.max(1, Math.floor(charDiff + sharedChars * 0.2) + 4);
};

const sortStopsByNumber = (stops = []) =>
[...stops].sort((a, b) => (a.stop_number || 0) - (b.stop_number || 0));

const calculateFuelCost = (mileage, mpg = 1, pricePerLitre = 1.75) => {
  if (!mileage || Number.isNaN(Number(mileage))) return 0;
  const safeMpg = mpg && mpg > 0 ? mpg : 1;
  const safePrice = pricePerLitre && pricePerLitre > 0 ? pricePerLitre : 0;
  const fuelCost = Number(mileage) * (safePrice / safeMpg);
  return Number(fuelCost.toFixed(2));
};

export default function DeliveryRoutePage() {
  const router = useRouter();
  const { deliveryId } = router.query;
  const isReady = router.isReady;
  const { user, dbUserId } = useUser();
  const { confirm } = useConfirmation();
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = roles.includes("parts") || roles.includes("parts manager");

  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [jobNumberInput, setJobNumberInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [postcodeInput, setPostcodeInput] = useState("");
  const [modalError, setModalError] = useState("");
  const [savingStop, setSavingStop] = useState(false);
  const [draggedStopId, setDraggedStopId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [dieselPricePerLitre, setDieselPricePerLitre] = useState(1.75);
  const [mpgDraft, setMpgDraft] = useState("");
  const [fuelSyncedKey, setFuelSyncedKey] = useState(null);
  const [noteEditingId, setNoteEditingId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const loadDelivery = useCallback(async () => {
    if (!isReady || !deliveryId) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase.
      from("deliveries").
      select(
        `*, stops:delivery_stops(
            *,
            customer:customers(firstname, lastname, name, address, postcode),
            job:jobs(id, job_number)
          )`
      ).
      eq("id", deliveryId).
      maybeSingle();

      if (fetchError) throw fetchError;
      const payload = data || null;
      setDelivery(payload);
      setFuelSyncedKey(null);
      return payload;
    } catch (fetchErr) {
      console.error("Failed to load delivery:", fetchErr);
      setError(fetchErr?.message || "Unable to load delivery route");
    } finally {
      setLoading(false);
    }
    return null;
  }, [deliveryId, isReady]);

  useEffect(() => {
    loadDelivery();
  }, [loadDelivery]);

  useEffect(() => {
    if (customerQuery.trim().length < 2) {
      setCustomerResults([]);
      setCustomerSearchLoading(false);
      return;
    }
    let isActive = true;
    setCustomerSearchLoading(true);
    const searchCustomers = async () => {
      try {
        const term = customerQuery.trim();
        const wildcard = `%${term}%`;
        const { data, error: searchError } = await supabase.
        from("customers").
        select("id, firstname, lastname, name, address, postcode").
        or(
          `firstname.ilike.${wildcard},lastname.ilike.${wildcard},name.ilike.${wildcard}`
        ).
        limit(6);
        if (searchError) throw searchError;
        if (isActive) {
          setCustomerResults(data || []);
        }
      } catch (searchErr) {
        console.error("Customer search failed:", searchErr);
      } finally {
        if (isActive) {
          setCustomerSearchLoading(false);
        }
      }
    };
    searchCustomers();
    return () => {
      isActive = false;
    };
  }, [customerQuery]);

  const loadFuelSettings = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase.
      from("delivery_settings").
      select("diesel_price_per_litre").
      order("updated_at", { ascending: false }).
      limit(1).
      maybeSingle();
      if (fetchError) throw fetchError;
      if (data?.diesel_price_per_litre) {
        setDieselPricePerLitre(data.diesel_price_per_litre);
      }
    } catch (settingsError) {
      console.error("Failed to load diesel price:", settingsError);
    }
  }, []);

  useEffect(() => {
    loadFuelSettings();
  }, [loadFuelSettings]);

  useEffect(() => {
    setMpgDraft(delivery?.vehicle_mpg ? String(delivery.vehicle_mpg) : "");
  }, [delivery?.vehicle_mpg]);


  const orderedStops = useMemo(() => {
    if (!delivery?.stops) return [];
    return sortStopsByNumber(delivery.stops || []);
  }, [delivery]);

  const progressNextStop = useCallback(
    async (latestDelivery) => {
      const nextStop = sortStopsByNumber(latestDelivery?.stops || []).find(
        (stop) => stop.status === "planned"
      );
      if (!nextStop) return;
      const { error: updateError } = await supabase.
      from("delivery_stops").
      update({ status: "en_route" }).
      eq("id", nextStop.id);
      if (updateError) throw updateError;
      await loadDelivery();
    },
    [loadDelivery]
  );

  const persistStopNumbers = useCallback(async (ordered = []) => {
    if (!ordered.length) return;
    const promises = ordered.map((stop, index) =>
    supabase.
    from("delivery_stops").
    update({ stop_number: index + 1 }).
    eq("id", stop.id)
    );
    const results = await Promise.all(promises);
    const failure = results.find((result) => result.error);
    if (failure) throw failure.error;
  }, []);

  const syncLegMileage = useCallback(
    async (ordered = [], mpgValue = delivery?.vehicle_mpg || 0) => {
      if (!ordered.length) return;
      const updates = [];
      for (let index = 0; index < ordered.length; index += 1) {
        const previousStop = ordered[index - 1];
        const currentStop = ordered[index];
        const targetMileage = index === 0 ? 0 : estimateDistance(previousStop, currentStop);
        const currentMileage = Number(currentStop.mileage_for_leg || 0);
        const targetFuelCost = calculateFuelCost(
          targetMileage,
          mpgValue,
          dieselPricePerLitre
        );
        const currentFuelCost = Number(currentStop.estimated_fuel_cost || 0);
        if (currentMileage !== targetMileage || currentFuelCost !== targetFuelCost) {
          updates.push({
            id: currentStop.id,
            mileage_for_leg: targetMileage,
            estimated_fuel_cost: targetFuelCost
          });
        }
      }
      if (!updates.length) return;
      const results = await Promise.all(
        updates.map((update) =>
        supabase.
        from("delivery_stops").
        update({
          mileage_for_leg: update.mileage_for_leg,
          estimated_fuel_cost: update.estimated_fuel_cost
        }).
        eq("id", update.id)
        )
      );
      const failure = results.find((result) => result.error);
      if (failure) throw failure.error;
    },
    [dieselPricePerLitre]
  );

  useEffect(() => {
    if (!delivery?.id || !orderedStops.length) return undefined;
    const syncKey = `${delivery.id}-${dieselPricePerLitre}`;
    if (fuelSyncedKey === syncKey) return undefined;
    let isMounted = true;
    const runSync = async () => {
      try {
        await syncLegMileage(orderedStops, delivery?.vehicle_mpg);
        await loadDelivery();
        if (isMounted) {
          setFuelSyncedKey(syncKey);
        }
      } catch (syncErr) {
        console.error("Failed to sync mileage after fuel settings change:", syncErr);
      }
    };
    runSync();
    return () => {
      isMounted = false;
    };
  }, [delivery?.id, dieselPricePerLitre, orderedStops, syncLegMileage, loadDelivery, fuelSyncedKey]);

  useEffect(() => {
    if (!deliveryId) return undefined;
    const channel = supabase.
    channel(`delivery_stops_updates_${deliveryId}`).
    on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "delivery_stops",
        filter: `delivery_id=eq.${deliveryId}`
      },
      () => {
        loadDelivery();
      }
    ).
    subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliveryId, loadDelivery]);

  const activeStop = orderedStops.find((stop) => stop.status === "en_route");
  const nextPlannedStop = orderedStops.find((stop) => stop.status === "planned");

  const notifySystemEvent = useCallback(async (payload) => {
    try {
      await fetch("/api/messages/system-notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (notifyError) {
      console.error("Unable to send delivery notification:", notifyError);
    }
  }, []);

  const buildDriverLabel = (delivery) =>
  delivery?.driver_id ? `Driver ${delivery.driver_id.slice(0, 8)}` : "Driver unassigned";

  const handleStatusUpdate = useCallback(
    async (stopIds, status) => {
      if (!stopIds.length) return;
      setActionLoading(true);
      setError("");
      try {
        const { error: updateError } = await supabase.
        from("delivery_stops").
        update({ status }).
        in("id", stopIds);
        if (updateError) throw updateError;
        const latestDelivery = await loadDelivery();
        if (status === "delivered" && latestDelivery) {
          await progressNextStop(latestDelivery);
        }

        if (!latestDelivery) {
          return;
        }
        const stopsData = latestDelivery.stops || [];
        const driverLabel = buildDriverLabel(latestDelivery);
        if (status === "en_route") {
          const stopInfo = stopsData.find((stop) => stopIds.includes(stop.id));
          await notifySystemEvent({
            message: `Delivery route ${latestDelivery.id} started by ${driverLabel}`,
            metadata: {
              event: "delivery_started",
              deliveryId: latestDelivery.id,
              vehicle: latestDelivery.vehicle_reg || null,
              stopId: stopInfo?.id || null,
              stopNumber: stopInfo?.stop_number || null
            }
          });
        }
        if (status === "delivered") {
          const stopInfo = stopsData.find((stop) => stopIds.includes(stop.id));
          await notifySystemEvent({
            message: `Stop ${stopInfo?.stop_number || ""} delivered for Job ${stopInfo?.job?.job_number || stopInfo?.job_id || "—"}`,
            metadata: {
              event: "stop_delivered",
              deliveryId: latestDelivery.id,
              stopId: stopInfo?.id || null,
              jobId: stopInfo?.job?.id || stopInfo?.job_id || null
            }
          });
          const allDelivered = stopsData.length > 0 && stopsData.every((stop) => stop.status === "delivered");
          if (allDelivered) {
            await notifySystemEvent({
              message: `Delivery route ${latestDelivery.id} completed by ${driverLabel}`,
              metadata: {
                event: "delivery_completed",
                deliveryId: latestDelivery.id
              }
            });
          }
        }
      } catch (actionErr) {
        console.error("Status update failed:", actionErr);
        setError(actionErr?.message || "Unable to update stop status");
      } finally {
        setActionLoading(false);
      }
    },
    [loadDelivery, progressNextStop]
  );

  const handleStartRoute = () => {
    if (!nextPlannedStop) {
      return;
    }
    handleStatusUpdate([nextPlannedStop.id], "en_route");
  };

  const handleMarkDelivered = () => {
    const target = activeStop || nextPlannedStop;
    if (!target) {
      return;
    }
    handleStatusUpdate([target.id], "delivered");
  };

  const handleCompleteRoute = () => {
    const pendingIds = orderedStops.
    filter((stop) => stop.status !== "delivered").
    map((stop) => stop.id);
    if (!pendingIds.length) {
      return;
    }
    handleStatusUpdate(pendingIds, "delivered");
  };

  const handleSaveMpg = useCallback(async () => {
    if (!delivery?.id) return;
    const parsedMpg = parseFloat(mpgDraft);
    if (Number.isNaN(parsedMpg) || parsedMpg <= 0) {
      setError("Enter a valid MPG value.");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      const { error: updateError } = await supabase.
      from("deliveries").
      update({ vehicle_mpg: parsedMpg }).
      eq("id", delivery.id);
      if (updateError) throw updateError;
      await syncLegMileage(orderedStops, parsedMpg);
      await loadDelivery();
    } catch (mpgErr) {
      console.error("Failed to save MPG:", mpgErr);
      setError(mpgErr?.message || "Unable to save MPG");
    } finally {
      setActionLoading(false);
    }
  }, [delivery?.id, mpgDraft, orderedStops, syncLegMileage, loadDelivery]);

  const startNoteEditing = useCallback((stop) => {
    setNoteEditingId(stop.id);
    setNoteDraft(stop.notes || "");
  }, []);

  const cancelNoteEditing = useCallback(() => {
    setNoteEditingId(null);
    setNoteDraft("");
  }, []);

  const handleSaveNote = useCallback(async () => {
    if (!noteEditingId) return;
    setNoteSaving(true);
    setError("");
    try {
      const { error: noteError } = await supabase.
      from("delivery_stops").
      update({ notes: noteDraft }).
      eq("id", noteEditingId);
      if (noteError) throw noteError;
      await loadDelivery();
      cancelNoteEditing();
    } catch (saveErr) {
      console.error("Failed to save note:", saveErr);
      setError(saveErr?.message || "Unable to save note");
    } finally {
      setNoteSaving(false);
    }
  }, [noteEditingId, noteDraft, loadDelivery, cancelNoteEditing]);

  const handleConfirmDelivery = useCallback(
    async (stop) => {
      if (!stop?.job?.id || !dbUserId) return;
      try {
        setError("");
        await handleStatusUpdate([stop.id], "delivered");
        const customerName =
        stop?.customer?.name ||
        [stop?.customer?.firstname, stop?.customer?.lastname].filter(Boolean).join(" ").trim() ||
        "Customer";
        const response = await fetch("/api/parts/deliveries/confirm-job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: stop.job.id,
            stopNumber: stop.stop_number,
            customerName,
            userId: dbUserId,
            deliveryId
          })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || "Unable to confirm job delivery.");
        }
      } catch (confirmError) {
        console.error("Failed to confirm job delivery:", confirmError);
        setError(confirmError?.message || "Unable to confirm job delivery.");
      }
    },
    [handleStatusUpdate, dbUserId, deliveryId]
  );

  const resetModal = () => {
    setCustomerQuery("");
    setCustomerResults([]);
    setSelectedCustomer(null);
    setJobNumberInput("");
    setAddressInput("");
    setPostcodeInput("");
    setModalError("");
  };

  const handleSelectCustomer = (customer) => {
    const displayName =
    customer.name ||
    [customer.firstname, customer.lastname].filter(Boolean).join(" ").trim();
    setSelectedCustomer(customer);
    setAddressInput(customer.address || "");
    setPostcodeInput(customer.postcode || "");
    setCustomerQuery(displayName || "");
    setCustomerResults([]);
  };

  const handleAddStopClick = () => {
    resetModal();
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    resetModal();
  };

  const handleSaveStop = useCallback(async () => {
    if (!delivery?.id) return;
    if (!selectedCustomer) {
      setModalError("Select a customer before adding a stop.");
      return;
    }
    setSavingStop(true);
    setModalError("");
    try {
      let jobId = null;
      const jobNumberTrimmed = jobNumberInput.trim();
      if (jobNumberTrimmed) {
        const { data: jobRecord, error: jobError } = await supabase.
        from("jobs").
        select("id").
        eq("job_number", jobNumberTrimmed).
        maybeSingle();
        if (jobError) throw jobError;
        if (!jobRecord) {
          throw new Error("Job number not found.");
        }
        jobId = jobRecord.id;
      }
      const payload = {
        delivery_id: delivery.id,
        stop_number: orderedStops.length + 1,
        job_id: jobId,
        customer_id: selectedCustomer.id,
        address: addressInput || selectedCustomer.address || null,
        postcode: postcodeInput || selectedCustomer.postcode || null,
        mileage_for_leg: 0,
        estimated_fuel_cost: 0,
        status: "planned"
      };
      const { error: insertError } = await supabase.from("delivery_stops").insert([payload]);
      if (insertError) throw insertError;
      const latestDelivery = await loadDelivery();
      if (latestDelivery?.stops?.length) {
        const sortedStops = sortStopsByNumber(latestDelivery.stops);
        await syncLegMileage(sortedStops, latestDelivery.vehicle_mpg);
        await loadDelivery();
      }
      setModalOpen(false);
      resetModal();
    } catch (saveErr) {
      console.error("Failed to add stop:", saveErr);
      setModalError(saveErr?.message || "Unable to add stop.");
    } finally {
      setSavingStop(false);
    }
  }, [
  delivery?.id,
  orderedStops.length,
  selectedCustomer,
  jobNumberInput,
  addressInput,
  postcodeInput,
  loadDelivery]
  );

  const reorderStops = useCallback(
    async (fromId, toId) => {
      if (!delivery || fromId === toId) return;
      setActionLoading(true);
      setError("");
      try {
        const nextOrder = [...orderedStops];
        const fromIndex = nextOrder.findIndex((stop) => stop.id === fromId);
        const toIndex = nextOrder.findIndex((stop) => stop.id === toId);
        if (fromIndex === -1 || toIndex === -1) {
          return;
        }
        const [moved] = nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, moved);
        await persistStopNumbers(nextOrder);
        await syncLegMileage(nextOrder, delivery?.vehicle_mpg);
        await loadDelivery();
      } catch (reorderErr) {
        console.error("Failed to reorder stops:", reorderErr);
        setError(reorderErr?.message || "Unable to reorder stops");
      } finally {
        setActionLoading(false);
        setDraggedStopId(null);
        setDropTargetId(null);
      }
    },
    [delivery, orderedStops, persistStopNumbers, loadDelivery]
  );

  const handleDragStart = (stopId) => () => {
    setDraggedStopId(stopId);
  };

  const handleDragOver = (stopId) => (event) => {
    event.preventDefault();
    setDropTargetId(stopId);
  };

  const handleDrop = (stopId) => async (event) => {
    event.preventDefault();
    if (!draggedStopId || draggedStopId === stopId) {
      return;
    }
    await reorderStops(draggedStopId, stopId);
  };

  const handleDragEnd = () => {
    setDraggedStopId(null);
    setDropTargetId(null);
  };

  const handleDeleteStop = useCallback(
    async (stopId) => {
      if (!stopId) return;
      const confirmed = await confirm("Remove this stop from the route?");
      if (!confirmed) return;
      setActionLoading(true);
      setError("");
      try {
        const { error: deleteError } = await supabase.
        from("delivery_stops").
        delete().
        eq("id", stopId);
        if (deleteError) throw deleteError;
        const remainingStops = orderedStops.filter((stop) => stop.id !== stopId);
        await persistStopNumbers(remainingStops);
        await syncLegMileage(remainingStops, delivery?.vehicle_mpg);
        await loadDelivery();
      } catch (deleteErr) {
        console.error("Failed to delete stop:", deleteErr);
        setError(deleteErr?.message || "Unable to delete stop");
      } finally {
        setActionLoading(false);
      }
    },
    [orderedStops, persistStopNumbers, loadDelivery, confirm]
  );

  if (!hasAccess) {
    return <DeliveryRoutePageUi view="section1" />;






  }

  const driverLabel = delivery?.driver_id ? `Driver ${delivery.driver_id.slice(0, 8)}` : "Driver unassigned";
  const vehicleLabel = delivery?.vehicle_reg || "Vehicle TBC";
  const stopsCount = orderedStops.length;
  const totalMileage = orderedStops.reduce(
    (acc, stop) => acc + Number(stop.mileage_for_leg || 0),
    0
  );
  const totalFuelCost = orderedStops.reduce(
    (acc, stop) => acc + Number(stop.estimated_fuel_cost || 0),
    0
  );

  return <DeliveryRoutePageUi view="section2" actionLoading={actionLoading} activeStop={activeStop} addressInput={addressInput} buttonStyle={buttonStyle} cancelNoteEditing={cancelNoteEditing} customerQuery={customerQuery} customerResults={customerResults} customerSearchLoading={customerSearchLoading} delivery={delivery} deliveryId={deliveryId} dieselPricePerLitre={dieselPricePerLitre} draggedStopId={draggedStopId} driverLabel={driverLabel} dropTargetId={dropTargetId} error={error} formatCurrency={formatCurrency} handleAddStopClick={handleAddStopClick} handleCloseModal={handleCloseModal} handleCompleteRoute={handleCompleteRoute} handleConfirmDelivery={handleConfirmDelivery} handleDeleteStop={handleDeleteStop} handleDragEnd={handleDragEnd} handleDragOver={handleDragOver} handleDragStart={handleDragStart} handleDrop={handleDrop} handleMarkDelivered={handleMarkDelivered} handleSaveMpg={handleSaveMpg} handleSaveNote={handleSaveNote} handleSaveStop={handleSaveStop} handleSelectCustomer={handleSelectCustomer} handleStartRoute={handleStartRoute} handleStatusUpdate={handleStatusUpdate} InlineLoading={InlineLoading} jobNumberInput={jobNumberInput} Link={Link} loading={loading} modalError={modalError} modalOpen={modalOpen} ModalPortal={ModalPortal} mpgDraft={mpgDraft} nextPlannedStop={nextPlannedStop} noteDraft={noteDraft} noteEditingId={noteEditingId} noteSaving={noteSaving} orderedStops={orderedStops} postcodeInput={postcodeInput} savingStop={savingStop} setAddressInput={setAddressInput} setCustomerQuery={setCustomerQuery} setJobNumberInput={setJobNumberInput} setMpgDraft={setMpgDraft} setNoteDraft={setNoteDraft} setPostcodeInput={setPostcodeInput} SkeletonBlock={SkeletonBlock} SkeletonKeyframes={SkeletonKeyframes} startNoteEditing={startNoteEditing} STATUS_META={STATUS_META} stopCardStyle={stopCardStyle} stopsCount={stopsCount} totalFuelCost={totalFuelCost} totalMileage={totalMileage} vehicleLabel={vehicleLabel} />;



















































































































































































































































































































































































































































































































































































































































}
