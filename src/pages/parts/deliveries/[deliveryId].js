import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";

const STATUS_META = {
  planned: { label: "Planned", background: "rgba(251, 191, 36, 0.15)", color: "#92400e" },
  en_route: { label: "En Route", background: "rgba(59, 130, 246, 0.15)", color: "#1d4ed8" },
  delivered: { label: "Delivered", background: "rgba(16, 185, 129, 0.25)", color: "#047857" },
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
  border: "1px solid #ffe0e0",
  background: "#ffffff",
  padding: "18px",
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.08)",
};

const buttonStyle = {
  borderRadius: "12px",
  padding: "10px 16px",
  border: "none",
  fontWeight: 600,
  cursor: "pointer",
};

export default function DeliveryRoutePage() {
  const router = useRouter();
  const { deliveryId } = router.query;
  const isReady = router.isReady;
  const { user } = useUser();
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
      setDelivery(data || null);
    } catch (fetchErr) {
      console.error("Failed to load delivery:", fetchErr);
      setError(fetchErr?.message || "Unable to load delivery route");
    } finally {
      setLoading(false);
    }
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

  const orderedStops = useMemo(() => {
    if (!delivery?.stops) return [];
    return [...delivery.stops].sort((a, b) => a.stop_number - b.stop_number);
  }, [delivery]);

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

  const activeStop = orderedStops.find((stop) => stop.status === "en_route");
  const nextPlannedStop = orderedStops.find((stop) => stop.status === "planned");

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
        await loadDelivery();
      } catch (actionErr) {
        console.error("Status update failed:", actionErr);
        setError(actionErr?.message || "Unable to update stop status");
      } finally {
        setActionLoading(false);
      }
    },
    [loadDelivery]
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
      await loadDelivery();
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
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          You do not have access to delivery planning.
        </div>
      </Layout>
    );
  }

  const driverLabel = delivery?.driver_id ? `Driver ${delivery.driver_id.slice(0, 8)}` : "Driver unassigned";
  const vehicleLabel = delivery?.vehicle_reg || "Vehicle TBC";

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <Link href="/parts/deliveries" style={{ color: "#a00000", fontWeight: 600 }}>
            ← Back to deliveries
          </Link>
          <p style={{ margin: 0, color: "#6b7280" }}>
            Delivery ID: {delivery?.id || deliveryId || "—"}
          </p>
        </div>

        <section
          style={{
            borderRadius: "20px",
            border: "1px solid #ffe1e1",
            background: "#ffffff",
            padding: "22px",
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a00000" }}>
            Route overview
          </p>
          <h1 style={{ margin: "4px 0 0", color: "#d10000" }}>Stops & delivery details</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>Driver</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{driverLabel}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>Vehicle</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{vehicleLabel}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>Fuel type</p>
              <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
                {delivery?.fuel_type || "Not specified"}
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
              background: "#d10000",
              color: "#ffffff",
              border: "1px solid #d10000",
            }}
          >
            Add Stop
          </button>
          <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>
            Drag stops to reorder and keep mileage accurate.
          </span>
        </div>

        {modalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 40,
              padding: "24px",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "18px",
                width: "min(540px, 100%)",
                maxHeight: "90vh",
                overflowY: "auto",
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
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
                <h2 style={{ margin: 0, color: "#d10000", fontSize: "1.3rem" }}>Add stop</h2>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#6b7280",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Close
                </button>
              </div>
              <label style={{ fontWeight: 600, color: "#6b7280" }}>Search customer</label>
              <input
                type="text"
                placeholder="Type name or company"
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                style={{
                  borderRadius: "12px",
                  border: "1px solid #ffd1d1",
                  padding: "10px 12px",
                }}
              />
              {customerSearchLoading && <p style={{ margin: 0, color: "#6b7280" }}>Searching…</p>}
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
                            background: "#fff7f7",
                            border: "1px solid #ffd1d1",
                            borderRadius: "10px",
                            padding: "10px 12px",
                            cursor: "pointer",
                            fontWeight: 600,
                            color: "#a00000",
                          }}
                        >
                          {label}
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.8rem",
                              fontWeight: 400,
                              color: "#6b7280",
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
              <label style={{ fontWeight: 600, color: "#6b7280" }}>Job number (optional)</label>
              <input
                type="text"
                value={jobNumberInput}
                onChange={(event) => setJobNumberInput(event.target.value)}
                placeholder="e.g. JOB-12345"
                style={{
                  borderRadius: "12px",
                  border: "1px solid #ffd1d1",
                  padding: "10px 12px",
                }}
              />
              <label style={{ fontWeight: 600, color: "#6b7280" }}>Address</label>
              <textarea
                rows={3}
                value={addressInput}
                onChange={(event) => setAddressInput(event.target.value)}
                placeholder="Customer address…"
                style={{
                  borderRadius: "12px",
                  border: "1px solid #ffd1d1",
                  padding: "10px 12px",
                  resize: "vertical",
                }}
              />
              <label style={{ fontWeight: 600, color: "#6b7280" }}>Postcode</label>
              <input
                type="text"
                value={postcodeInput}
                onChange={(event) => setPostcodeInput(event.target.value)}
                placeholder="Postcode"
                style={{
                  borderRadius: "12px",
                  border: "1px solid #ffd1d1",
                  padding: "10px 12px",
                }}
              />
              {modalError && <p style={{ color: "#b91c1c", margin: 0 }}>{modalError}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    ...buttonStyle,
                    background: "#ffffff",
                    border: "1px solid #ffd1d1",
                    color: "#a00000",
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
                    background: "#0f766e",
                    color: "#ffffff",
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
                background: "#ffffff",
                border: "1px solid #ffd1d1",
                color: "#a00000",
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
                background: "#d10000",
                color: "#ffffff",
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
                background: "#0f766e",
                color: "#ffffff",
                opacity: actionLoading || orderedStops.every((stop) => stop.status === "delivered") ? 0.6 : 1,
              }}
            >
              Complete Route
            </button>
          </div>
          {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}
        </section>

        {loading && <p style={{ color: "#6b7280" }}>Loading route stops…</p>}

        {!loading && !orderedStops.length && (
          <p style={{ color: "#6b7280" }}>No stops have been planned for this route yet.</p>
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
                      borderColor: isDropTarget ? "#d10000" : "#ffe0e0",
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
                        <p style={{ margin: "4px 0 0", color: "#6b7280" }}>
                          {stop.customer?.address || stop.address || "Address TBC"}
                        </p>
                        <p style={{ margin: "2px 0 0", color: "#6b7280" }}>
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
                            border: "1px solid #ffe0e0",
                            padding: "6px 10px",
                            background: "#fff",
                            color: "#d10000",
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
                      <label style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280", fontWeight: 600 }}>
                        Update status
                      </label>
                      <select
                        value={stop.status || "planned"}
                        onChange={(event) => handleStatusUpdate([stop.id], event.target.value)}
                        style={{
                          borderRadius: "10px",
                          border: "1px solid #ffd1d1",
                          padding: "8px 12px",
                          fontWeight: 600,
                          color: "#a00000",
                          minWidth: "160px",
                          background: "#fff",
                        }}
                      >
                        <option value="planned">Planned</option>
                        <option value="en_route">En Route</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </div>
                    <div
                      style={{
                        marginTop: "12px",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "10px",
                        color: "#4b5563",
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
