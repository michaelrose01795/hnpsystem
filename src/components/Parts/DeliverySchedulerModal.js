import React, { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

const todayIso = () => new Date().toISOString().slice(0, 10);

const cardStyle = {
  borderRadius: "18px",
  border: "1px solid #ffe0e0",
  background: "#ffffff",
  padding: "20px",
  boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
  width: "min(520px, 100%)",
};

const buttonStyle = {
  borderRadius: "10px",
  padding: "8px 14px",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
};

export default function DeliverySchedulerModal({
  open,
  onClose,
  job,
  deliveries = [],
  onScheduled,
}) {
  const [scheduleMode, setScheduleMode] = useState("existing");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [newDeliveryDate, setNewDeliveryDate] = useState(todayIso());
  const [newVehicleReg, setNewVehicleReg] = useState("");
  const [newFuelType, setNewFuelType] = useState("Diesel");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [stopNotes, setStopNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    if (!open) return;
    setScheduleMode("existing");
    setSelectedDeliveryId("");
    setNewDeliveryDate(todayIso());
    setNewVehicleReg("");
    setNewFuelType("Diesel");
    setStopNotes("");
    setError("");

    const loadJobCustomer = async () => {
      if (!job?.id) return;
      const { data, error: fetchError } = await supabaseClient
        .from("jobs")
        .select("id, customer_id, customer:customers(firstname, lastname, name, address, postcode)")
        .eq("id", job.id)
        .maybeSingle();
      if (fetchError) {
        console.error("Unable to fetch job customer", fetchError);
        return;
      }
      if (data?.customer) {
        setAddress(data.customer.address || "");
        setPostcode(data.customer.postcode || "");
        const label = data.customer.name ||
          [data.customer.firstname, data.customer.lastname].filter(Boolean).join(" ").trim();
        setCustomerName(label || "");
      }
    };

    loadJobCustomer();
  }, [job, open]);

  const canUseExisting = Boolean(selectedDeliveryId);

  const chosenDelivery = useMemo(
    () => deliveries.find((delivery) => delivery.id === selectedDeliveryId),
    [deliveries, selectedDeliveryId]
  );

  const handleSave = async () => {
    if (!job?.id) {
      setError("Job must be selected.");
      return;
    }
    if (scheduleMode === "existing" && !selectedDeliveryId) {
      setError("Choose a delivery route or switch to new route.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        jobId: job.id,
        deliveryId: scheduleMode === "existing" ? selectedDeliveryId : null,
        createDelivery:
          scheduleMode === "new"
            ? {
                deliveryDate: newDeliveryDate,
                vehicleReg: newVehicleReg || null,
                notes: newFuelType ? `Fuel: ${newFuelType}` : null,
                fuelType: newFuelType || null,
              }
            : null,
        address: address || null,
        postcode: postcode || null,
        notes: stopNotes || null,
      };
      const response = await fetch("/api/parts/deliveries/add-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const payloadErr = await response.json().catch(() => null);
        throw new Error(payloadErr?.message || "Unable to schedule delivery.");
      }
      onScheduled?.();
      onClose?.();
    } catch (scheduleError) {
      console.error("Unable to schedule delivery", scheduleError);
      setError(scheduleError?.message || "Unable to schedule delivery.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 200,
      }}
    >
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <div>
            <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a00000" }}>
              Schedule delivery
            </p>
            <h3 style={{ margin: "6px 0 0", fontSize: "1.25rem", color: "#d10000" }}>
              Job {job?.job_number || job?.jobNumber || "—"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "1.2rem",
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ fontWeight: 600, color: "#555" }}>Route</label>
            <div style={{ marginTop: "6px", display: "flex", gap: "10px" }}>
              <label>
                <input
                  type="radio"
                  name="scheduleMode"
                  value="existing"
                  checked={scheduleMode === "existing"}
                  onChange={() => setScheduleMode("existing")}
                />{" "}
                Use existing route
              </label>
              <label>
                <input
                  type="radio"
                  name="scheduleMode"
                  value="new"
                  checked={scheduleMode === "new"}
                  onChange={() => setScheduleMode("new")}
                />{" "}
                Create new route
              </label>
            </div>
          </div>
          {scheduleMode === "existing" && (
            <select
              value={selectedDeliveryId}
              onChange={(event) => setSelectedDeliveryId(event.target.value)}
              style={{
                width: "100%",
                borderRadius: "10px",
                border: "1px solid #ffd1d1",
                padding: "10px 12px",
                fontWeight: 600,
                color: "#a00000",
              }}
            >
              <option value="">Select a delivery</option>
              {deliveries.map((delivery) => (
                <option key={delivery.id} value={delivery.id}>
                  {delivery.delivery_date || "Unscheduled"} · {delivery.vehicle_reg || "Vehicle"}
                </option>
              ))}
            </select>
          )}
          {scheduleMode === "new" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
                <label style={{ fontWeight: 600, color: "#555" }}>
                  Delivery date
                  <input
                    type="date"
                    value={newDeliveryDate}
                    onChange={(event) => setNewDeliveryDate(event.target.value)}
                    style={{
                      width: "100%",
                      marginTop: "4px",
                      borderRadius: "10px",
                      border: "1px solid #ffd1d1",
                      padding: "8px 10px",
                    }}
                  />
                </label>
                <label style={{ fontWeight: 600, color: "#555" }}>
                  Vehicle reg
                  <input
                    type="text"
                    value={newVehicleReg}
                    onChange={(event) => setNewVehicleReg(event.target.value)}
                    placeholder="e.g. AB12CDE"
                    style={{
                      width: "100%",
                      marginTop: "4px",
                      borderRadius: "10px",
                      border: "1px solid #ffd1d1",
                      padding: "8px 10px",
                    }}
                  />
                </label>
                <label style={{ fontWeight: 600, color: "#555" }}>
                  Fuel type
                  <input
                    type="text"
                    value={newFuelType}
                    onChange={(event) => setNewFuelType(event.target.value)}
                    placeholder="Diesel"
                    style={{
                      width: "100%",
                      marginTop: "4px",
                      borderRadius: "10px",
                      border: "1px solid #ffd1d1",
                      padding: "8px 10px",
                    }}
                  />
                </label>
              </div>
            </>
          )}
          <div>
            <label style={{ fontWeight: 600, color: "#555" }}>Address</label>
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              rows={2}
              placeholder="Customer address"
              style={{
                width: "100%",
                marginTop: "4px",
                borderRadius: "12px",
                border: "1px solid #ffd1d1",
                padding: "10px",
                resize: "vertical",
              }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 600, color: "#555" }}>Postcode</label>
            <input
              type="text"
              value={postcode}
              onChange={(event) => setPostcode(event.target.value)}
              placeholder="Postcode"
              style={{
                width: "100%",
                marginTop: "4px",
                borderRadius: "10px",
                border: "1px solid #ffd1d1",
                padding: "8px 10px",
              }}
            />
          </div>
          <div>
            <label style={{ fontWeight: 600, color: "#555" }}>Delivery notes</label>
            <textarea
              value={stopNotes}
              onChange={(event) => setStopNotes(event.target.value)}
              rows={2}
              placeholder="Add context for the driver"
              style={{
                width: "100%",
                marginTop: "4px",
                borderRadius: "12px",
                border: "1px solid #ffd1d1",
                padding: "10px",
                resize: "vertical",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{
                ...buttonStyle,
                background: "#0f766e",
                color: "#fff",
                flex: "1 1 140px",
                minWidth: "140px",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Scheduling…" : "Add to route"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...buttonStyle,
                border: "1px solid #ffd1d1",
                background: "#fff",
                color: "#a00000",
                flex: "1 1 140px",
                minWidth: "140px",
              }}
            >
              Cancel
            </button>
          </div>
          {error && <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p>}
          {customerName && (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>
              Customer: {customerName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
