import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

const STATUS_META = {
  planned: { label: "Planned", background: "rgba(var(--warning-rgb), 0.15)", color: "var(--danger-dark)" },
  en_route: { label: "En Route", background: "rgba(var(--info-rgb), 0.15)", color: "var(--accent-purple)" },
  delivered: { label: "Delivered", background: "rgba(var(--info-rgb), 0.25)", color: "var(--info-dark)" },
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

const stopCardStyle = {
  borderRadius: "18px",
  border: "1px solid var(--surface-light)",
  background: "var(--surface)",
  padding: "18px",
  boxShadow: "0 12px 30px rgba(var(--shadow-rgb), 0.08)",
};

const buttonStyle = {
  borderRadius: "12px",
  padding: "10px 16px",
  border: "none",
  fontWeight: 600,
  cursor: "pointer",
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
  const sharedChars = Array.from(fromValue)
    .map((char, index) => (toValue[index] === char ? 1 : 0))
    .reduce((acc, val) => acc + val, 0);
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
      const { data, error: fetchError } = await supabase
        .from("deliveries")
        .select(
          `*, stops:delivery_stops(
            *,
            customer:customers(firstname, lastname, name, address, postcode),
            job:jobs(id, job_number)
          )`
        )
        .eq("id", deliveryId)
        .maybeSingle();

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
        const { data, error: searchError } = await supabase
          .from("customers")
          .select("id, firstname, lastname, name, address, postcode")
          .or(
            `firstname.ilike.${wildcard},lastname.ilike.${wildcard},name.ilike.${wildcard}`
          )
          .limit(6);
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
      const { data, error: fetchError } = await supabase
        .from("delivery_settings")
        .select("diesel_price_per_litre")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
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
      const { error: updateError } = await supabase
        .from("delivery_stops")
        .update({ status: "en_route" })
        .eq("id", nextStop.id);
      if (updateError) throw updateError;
      await loadDelivery();
    },
    [loadDelivery]
  );

  const persistStopNumbers = useCallback(async (ordered = []) => {
    if (!ordered.length) return;
    const promises = ordered.map((stop, index) =>
      supabase
        .from("delivery_stops")
        .update({ stop_number: index + 1 })
        .eq("id", stop.id)
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
            estimated_fuel_cost: targetFuelCost,
          });
        }
      }
      if (!updates.length) return;
      const results = await Promise.all(
        updates.map((update) =>
          supabase
            .from("delivery_stops")
            .update({
              mileage_for_leg: update.mileage_for_leg,
              estimated_fuel_cost: update.estimated_fuel_cost,
            })
            .eq("id", update.id)
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
    const channel = supabase
      .channel(`delivery_stops_updates_${deliveryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_stops",
          filter: `delivery_id=eq.${deliveryId}`,
        },
        () => {
          loadDelivery();
        }
      )
      .subscribe();

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
        body: JSON.stringify(payload),
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
        const { error: updateError } = await supabase
          .from("delivery_stops")
          .update({ status })
          .in("id", stopIds);
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
              stopNumber: stopInfo?.stop_number || null,
            },
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
              jobId: stopInfo?.job?.id || stopInfo?.job_id || null,
            },
          });
          const allDelivered = stopsData.length > 0 && stopsData.every((stop) => stop.status === "delivered");
          if (allDelivered) {
            await notifySystemEvent({
              message: `Delivery route ${latestDelivery.id} completed by ${driverLabel}`,
              metadata: {
                event: "delivery_completed",
                deliveryId: latestDelivery.id,
              },
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
    const pendingIds = orderedStops
      .filter((stop) => stop.status !== "delivered")
      .map((stop) => stop.id);
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
      const { error: updateError } = await supabase
        .from("deliveries")
        .update({ vehicle_mpg: parsedMpg })
        .eq("id", delivery.id);
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
      const { error: noteError } = await supabase
        .from("delivery_stops")
        .update({ notes: noteDraft })
        .eq("id", noteEditingId);
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
            deliveryId,
          }),
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
        const { data: jobRecord, error: jobError } = await supabase
          .from("jobs")
          .select("id")
          .eq("job_number", jobNumberTrimmed)
          .maybeSingle();
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
        status: "planned",
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
    loadDelivery,
  ]);

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
      if (typeof window !== "undefined" && !window.confirm("Remove this stop from the route?")) {
        return;
      }
      setActionLoading(true);
      setError("");
      try {
        const { error: deleteError } = await supabase
          .from("delivery_stops")
          .delete()
          .eq("id", stopId);
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
    [orderedStops, persistStopNumbers, loadDelivery]
  );

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          You do not have access to delivery planning.
        </div>
      </Layout>
    );
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

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <Link href="/parts/deliveries" style={{ color: "var(--primary-dark)", fontWeight: 600 }}>
            ← Back to deliveries
          </Link>
          <p style={{ margin: 0, color: "var(--info)" }}>
            Delivery ID: {delivery?.id || deliveryId || "—"}
          </p>
        </div>

        <section
          style={{
            borderRadius: "20px",
            border: "1px solid var(--surface-light)",
            background: "var(--surface)",
            padding: "22px",
            boxShadow: "0 12px 30px rgba(var(--shadow-rgb), 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary-dark)" }}>
            Route overview
          </p>
          <h1 style={{ margin: "4px 0 0", color: "var(--primary)" }}>Stops & delivery details</h1>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--info)" }}>Driver</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{driverLabel}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--info)" }}>Vehicle</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{vehicleLabel}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--info)" }}>Fuel type</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                {delivery?.fuel_type || "Not specified"}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--info)" }}>Diesel price</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                {formatCurrency(dieselPricePerLitre)} / L
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--info)" }}>Vehicle MPG</p>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={mpgDraft}
                  onChange={(event) => setMpgDraft(event.target.value)}
                  placeholder="e.g. 28"
                  style={{
                    borderRadius: "10px",
                    border: "1px solid var(--surface-light)",
                    padding: "8px 10px",
                    width: "100px",
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveMpg}
                  disabled={actionLoading}
                  style={{
                    ...buttonStyle,
                    background: "var(--info-dark)",
                    color: "var(--surface)",
                    padding: "8px 12px",
                    minWidth: "80px",
                    opacity: actionLoading ? 0.6 : 1,
                  }}
                >
                  Save
                </button>
              </div>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--info)" }}>Stops planned</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{stopsCount}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--info)" }}>Total mileage</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                {totalMileage.toLocaleString()} km
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--info)" }}>Fuel estimate</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                {formatCurrency(totalFuelCost)}
              </p>
            </div>
          </div>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={handleAddStopClick}
            style={{
              ...buttonStyle,
              background: "var(--primary)",
              color: "var(--surface)",
              border: "1px solid var(--primary)",
            }}
          >
            Add Stop
          </button>
          <span style={{ color: "var(--info)", fontSize: "0.85rem" }}>
            Drag stops to reorder and keep mileage accurate.
          </span>
        </div>

        {modalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(var(--accent-purple-rgb), 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 40,
              padding: "24px",
            }}
          >
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "18px",
                width: "min(540px, 100%)",
                maxHeight: "90vh",
                overflowY: "auto",
                padding: "24px",
                boxShadow: "0 20px 40px rgba(var(--shadow-rgb), 0.25)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
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
                <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.3rem" }}>Add stop</h2>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--info)",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Close
                </button>
              </div>
              <label style={{ fontWeight: 600, color: "var(--info)" }}>Search customer</label>
              <input
                type="text"
                placeholder="Type name or company"
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--surface-light)",
                  padding: "10px 12px",
                }}
              />
              {customerSearchLoading && <p style={{ margin: 0, color: "var(--info)" }}>Searching…</p>}
              {customerResults.length > 0 && (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                  {customerResults.map((customer) => {
                    const label =
                      customer.name ||
                      [customer.firstname, customer.lastname].filter(Boolean).join(" ").trim() ||
                      "Customer";
                    return (
                      <li key={customer.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectCustomer(customer)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            background: "var(--danger-surface)",
                            border: "1px solid var(--surface-light)",
                            borderRadius: "10px",
                            padding: "10px 12px",
                            cursor: "pointer",
                            fontWeight: 600,
                            color: "var(--primary-dark)",
                          }}
                        >
                          {label}
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.8rem",
                              fontWeight: 400,
                              color: "var(--info)",
                            }}
                          >
                            {customer.address || "Address not stored"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <label style={{ fontWeight: 600, color: "var(--info)" }}>Job number (optional)</label>
              <input
                type="text"
                value={jobNumberInput}
                onChange={(event) => setJobNumberInput(event.target.value)}
                placeholder="e.g. JOB-12345"
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--surface-light)",
                  padding: "10px 12px",
                }}
              />
              <label style={{ fontWeight: 600, color: "var(--info)" }}>Address</label>
              <textarea
                rows={3}
                value={addressInput}
                onChange={(event) => setAddressInput(event.target.value)}
                placeholder="Customer address…"
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--surface-light)",
                  padding: "10px 12px",
                  resize: "vertical",
                }}
              />
              <label style={{ fontWeight: 600, color: "var(--info)" }}>Postcode</label>
              <input
                type="text"
                value={postcodeInput}
                onChange={(event) => setPostcodeInput(event.target.value)}
                placeholder="Postcode"
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--surface-light)",
                  padding: "10px 12px",
                }}
              />
              {modalError && <p style={{ color: "var(--danger)", margin: 0 }}>{modalError}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    ...buttonStyle,
                    background: "var(--surface)",
                    border: "1px solid var(--surface-light)",
                    color: "var(--primary-dark)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveStop}
                  disabled={savingStop}
                  style={{
                    ...buttonStyle,
                    background: "var(--info-dark)",
                    color: "var(--surface)",
                    opacity: savingStop ? 0.6 : 1,
                  }}
                >
                  {savingStop ? "Saving…" : "Save stop"}
                </button>
              </div>
            </div>
          </div>
        )}

        <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleStartRoute}
              disabled={actionLoading || !nextPlannedStop}
              style={{
                ...buttonStyle,
                background: "var(--surface)",
                border: "1px solid var(--surface-light)",
                color: "var(--primary-dark)",
                opacity: actionLoading || !nextPlannedStop ? 0.6 : 1,
              }}
            >
              Start Route
            </button>
            <button
              type="button"
              onClick={handleMarkDelivered}
              disabled={actionLoading || (!activeStop && !nextPlannedStop)}
              style={{
                ...buttonStyle,
                background: "var(--primary)",
                color: "var(--surface)",
                opacity: actionLoading || (!activeStop && !nextPlannedStop) ? 0.6 : 1,
              }}
            >
              Mark Stop as Delivered
            </button>
            <button
              type="button"
              onClick={handleCompleteRoute}
              disabled={actionLoading || orderedStops.every((stop) => stop.status === "delivered")}
              style={{
                ...buttonStyle,
                background: "var(--info-dark)",
                color: "var(--surface)",
                opacity: actionLoading || orderedStops.every((stop) => stop.status === "delivered") ? 0.6 : 1,
              }}
            >
              Complete Route
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>}
        </section>

        {loading && <p style={{ color: "var(--info)" }}>Loading route stops…</p>}

        {!loading && !orderedStops.length && (
          <p style={{ color: "var(--info)" }}>No stops have been planned for this route yet.</p>
        )}

        {!loading && orderedStops.length > 0 && (
          <ol style={{ display: "flex", flexDirection: "column", gap: "16px", padding: 0 }}>
            {orderedStops.map((stop) => {
              const customerName =
                stop?.customer?.name ||
                [stop?.customer?.firstname, stop?.customer?.lastname].filter(Boolean).join(" ") ||
                "Customer";
              const statusMeta = STATUS_META[stop.status] || STATUS_META.planned;
              const isDropTarget = dropTargetId === stop.id;
              const isDragging = draggedStopId === stop.id;
              return (
                <li
                  key={stop.id}
                  style={{ listStyle: "none", cursor: "grab" }}
                  draggable
                  onDragStart={handleDragStart(stop.id)}
                  onDragOver={handleDragOver(stop.id)}
                  onDrop={handleDrop(stop.id)}
                  onDragEnd={handleDragEnd}
                >
                  <div
                    style={{
                      ...stopCardStyle,
                      borderColor: isDropTarget ? "var(--primary)" : "var(--surface-light)",
                      opacity: isDragging ? 0.7 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem" }}>
                          {stop.stop_number}. {customerName}
                        </p>
                        <p style={{ margin: "4px 0 0", color: "var(--info)" }}>
                          {stop.customer?.address || stop.address || "Address TBC"}
                        </p>
                        <p style={{ margin: "2px 0 0", color: "var(--info)" }}>
                          {stop.customer?.postcode || stop.postcode || "Postcode TBC"}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                        <span
                          style={{
                            padding: "6px 14px",
                            borderRadius: "999px",
                            background: statusMeta.background,
                            color: statusMeta.color,
                            fontWeight: 600,
                            fontSize: "0.85rem",
                          }}
                        >
                          {statusMeta.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteStop(stop.id)}
                          style={{
                            borderRadius: "8px",
                            border: "1px solid var(--surface-light)",
                            padding: "6px 10px",
                            background: "var(--surface)",
                            color: "var(--primary)",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <label style={{ margin: 0, fontSize: "0.8rem", color: "var(--info)", fontWeight: 600 }}>
                        Update status
                      </label>
                      <select
                        value={stop.status || "planned"}
                        onChange={(event) => handleStatusUpdate([stop.id], event.target.value)}
                        style={{
                          borderRadius: "10px",
                          border: "1px solid var(--surface-light)",
                          padding: "8px 12px",
                          fontWeight: 600,
                          color: "var(--primary-dark)",
                          minWidth: "160px",
                          background: "var(--surface)",
                        }}
                      >
                        <option value="planned">Planned</option>
                        <option value="en_route">En Route</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </div>
                    <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate([stop.id], "delivered")}
                        style={{
                          borderRadius: "8px",
                          border: "1px solid var(--surface-light)",
                          background: "var(--primary)",
                          color: "var(--surface)",
                          padding: "6px 12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Mark stop as delivered
                      </button>
                      <button
                        type="button"
                        onClick={() => startNoteEditing(stop)}
                        style={{
                          borderRadius: "8px",
                          border: "1px solid var(--surface-light)",
                          background: "var(--surface)",
                          color: "var(--primary-dark)",
                          padding: "6px 12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Add delivery notes
                      </button>
                      {stop.job?.job_number && (
                        <button
                          type="button"
                          onClick={() => handleConfirmDelivery(stop)}
                          disabled={stop.status === "delivered" || actionLoading}
                          style={{
                            borderRadius: "8px",
                            border: "1px solid var(--accent-purple)",
                            background: "var(--accent-purple)",
                            color: "var(--surface)",
                            padding: "6px 12px",
                            fontWeight: 600,
                            cursor: stop.status === "delivered" ? "default" : "pointer",
                            opacity: stop.status === "delivered" || actionLoading ? 0.6 : 1,
                          }}
                        >
                          Confirm Delivery
                        </button>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: "12px",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "10px",
                        color: "var(--info-dark)",
                      }}
                    >
                      {stop.job?.job_number && (
                        <div>
                          <p style={{ margin: 0, fontSize: "0.75rem" }}>Job number</p>
                          <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{stop.job.job_number}</p>
                        </div>
                      )}
                      <div>
                        <p style={{ margin: 0, fontSize: "0.75rem" }}>Mileage for leg</p>
                        <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                          {Number(stop.mileage_for_leg || 0).toLocaleString()} km
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: "0.75rem" }}>Estimated fuel</p>
                        <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                          {formatCurrency(stop.estimated_fuel_cost)}
                        </p>
                      </div>
                    </div>
                    {stop.notes && noteEditingId !== stop.id && (
                      <p style={{ marginTop: "12px", color: "var(--info-dark)", fontSize: "0.9rem" }}>
                        <strong>Note:</strong> {stop.notes}
                      </p>
                    )}
                    {noteEditingId === stop.id && (
                      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <textarea
                          value={noteDraft}
                          onChange={(event) => setNoteDraft(event.target.value)}
                          rows={3}
                          placeholder="Capture delivery notes…"
                          style={{
                            borderRadius: "12px",
                            border: "1px solid var(--surface-light)",
                            padding: "10px",
                            resize: "vertical",
                            width: "100%",
                          }}
                        />
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={handleSaveNote}
                            disabled={noteSaving}
                            style={{
                              ...buttonStyle,
                              background: "var(--info-dark)",
                              color: "var(--surface)",
                              padding: "6px 12px",
                              opacity: noteSaving ? 0.6 : 1,
                            }}
                          >
                            {noteSaving ? "Saving…" : "Save note"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelNoteEditing}
                            style={{
                              ...buttonStyle,
                              background: "var(--surface)",
                              border: "1px solid var(--surface-light)",
                              color: "var(--primary-dark)",
                              padding: "6px 12px",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Layout>
  );
}
