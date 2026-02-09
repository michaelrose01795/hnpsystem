// file location: src/components/HR/StaffVehiclesCard.js
import React, { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/HR/MetricCard";
import { DropdownField } from "@/components/dropdownAPI";

const initialVehicleForm = {
  make: "",
  model: "",
  registration: "",
  vin: "",
  colour: "",
  payrollDeductionEnabled: true,
  payrollDeductionReference: "",
};

const initialHistoryForm = {
  description: "",
  cost: "",
  deductFromPayroll: true,
  jobNumber: "",
};

export default function StaffVehiclesCard({ userId, userName, vehicles = [] }) {
  const [localVehicles, setLocalVehicles] = useState(vehicles);
  const [vehicleForm, setVehicleForm] = useState(initialVehicleForm);
  const [historyForms, setHistoryForms] = useState({});
  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [selectedHistoryVehicleId, setSelectedHistoryVehicleId] = useState(null);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingHistory, setSavingHistory] = useState({});
  const [savingEdit, setSavingEdit] = useState({});
  const [deletingVehicle, setDeletingVehicle] = useState({});
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editForms, setEditForms] = useState({});
  const [editVisibility, setEditVisibility] = useState({});
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalVehicles(vehicles);
    if (!selectedHistoryVehicleId && vehicles.length) {
      setSelectedHistoryVehicleId(vehicles[0].id);
    }
  }, [selectedHistoryVehicleId, vehicles]);

  const handleVehicleFieldChange = (field, value) => {
    setVehicleForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleHistoryFieldChange = (vehicleId, field, value) => {
    if (!vehicleId) return;
    setHistoryForms((prev) => ({
      ...prev,
      [vehicleId]: {
        ...(prev[vehicleId] || initialHistoryForm),
        [field]: value,
      },
    }));
  };

  const fetchJobSummary = async (vehicleId, jobNumber) => {
    if (!vehicleId || !jobNumber) return;
    try {
      const response = await fetch(`/api/staff/job-summary?jobNumber=${encodeURIComponent(jobNumber)}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load job summary.");
      }
      const summary = payload?.data || {};
      if (!summary) return;
      setHistoryForms((prev) => {
        const current = prev[vehicleId] || initialHistoryForm;
        const next = { ...current };
        if (summary.requestDescription) {
          next.description = summary.requestDescription;
        }
        if (summary.invoiceTotal !== null && summary.invoiceTotal !== undefined) {
          next.cost = Number(summary.invoiceTotal).toFixed(2);
        }
        return { ...prev, [vehicleId]: next };
      });
    } catch (err) {
      setError(err.message || "Unable to load job summary.");
    }
  };

  const handleEditFieldChange = (vehicleId, field, value) => {
    setEditForms((prev) => ({
      ...prev,
      [vehicleId]: {
        ...(prev[vehicleId] || {}),
        [field]: value,
      },
    }));
  };

  const startEdit = (vehicle) => {
    setEditForms((prev) => ({
      ...prev,
      [vehicle.id]: {
        make: vehicle.make || "",
        model: vehicle.model || "",
        registration: vehicle.registration || "",
        vin: vehicle.vin || "",
        colour: vehicle.colour || "",
        payrollDeductionEnabled: vehicle.payrollDeductionEnabled !== false,
        payrollDeductionReference: vehicle.payrollDeductionReference || "",
      },
    }));
    setEditVisibility((prev) => ({ ...prev, [vehicle.id]: true }));
    setError("");
  };

  const cancelEdit = (vehicleId) => {
    setEditVisibility((prev) => ({ ...prev, [vehicleId]: false }));
  };

  const submitVehicle = async (event) => {
    event.preventDefault();
    if (!userId) {
      setError("Unable to resolve staff profile. Please reload.");
      return;
    }
    if (!vehicleForm.registration.trim()) {
      setError("Registration is required.");
      return;
    }
    setSavingVehicle(true);
    setError("");
    try {
      const response = await fetch("/api/staff/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          make: vehicleForm.make,
          model: vehicleForm.model,
          registration: vehicleForm.registration,
          vin: vehicleForm.vin,
          colour: vehicleForm.colour,
          payrollDeductionEnabled: vehicleForm.payrollDeductionEnabled,
          payrollDeductionReference: vehicleForm.payrollDeductionReference,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to add vehicle");
      }
      setLocalVehicles((prev) => [payload.vehicle, ...prev]);
      setVehicleForm(initialVehicleForm);
      setShowVehicleForm(false);
    } catch (err) {
      setError(err.message || "Unable to add vehicle.");
    } finally {
      setSavingVehicle(false);
    }
  };

  const lookupVehicleDetails = async () => {
    if (!vehicleForm.registration.trim()) {
      setError("Enter a registration before searching.");
      return;
    }

    const regUpper = vehicleForm.registration.trim().toUpperCase();
    setVehicleForm((prev) => ({ ...prev, registration: regUpper }));
    setIsLookupLoading(true);
    setError("");

    try {
      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: regUpper }),
      });

      const rawText = await response.text();
      if (!response.ok) {
        let payload;
        try {
          payload = JSON.parse(rawText);
        } catch {
          payload = null;
        }
        const message =
          payload?.message || payload?.error || rawText || `Lookup failed with status ${response.status}`;
        throw new Error(message);
      }

      let data = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error("Vehicle API returned malformed data.");
        }
      }

      if (!data || Object.keys(data).length === 0) {
        throw new Error("No vehicle data returned for that registration.");
      }

      const detectedMake = data.make || data.vehicleMake || "";
      const detectedModel = data.model || data.vehicleModel || "";
      const detectedColour = data.colour || data.vehicleColour || data.bodyColour || "";
      const detectedVin = data.vin || data.chassisNumber || data.vehicleIdentificationNumber || "";

      setVehicleForm((prev) => ({
        ...prev,
        make: detectedMake || prev.make,
        model: detectedModel || prev.model,
        colour: detectedColour || prev.colour,
        vin: detectedVin || prev.vin,
      }));
    } catch (lookupError) {
      setError(lookupError.message || "Unable to fetch vehicle data.");
    } finally {
      setIsLookupLoading(false);
    }
  };

  const submitHistory = async (vehicleId, event) => {
    event.preventDefault();
    if (!vehicleId) {
      setError("Select a vehicle to log the repair.");
      return;
    }
    const formState = historyForms[vehicleId] || initialHistoryForm;
    if (!formState.description.trim()) {
      setError("Please provide a repair description.");
      return;
    }
    setSavingHistory((prev) => ({ ...prev, [vehicleId]: true }));
    setError("");
    try {
      const response = await fetch("/api/staff/vehicle-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          description: formState.description,
          cost: formState.cost,
          jobNumber: formState.jobNumber,
          deductFromPayroll: formState.deductFromPayroll,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to add history");
      }
      setLocalVehicles((prev) =>
        prev.map((vehicle) =>
          vehicle.id === vehicleId
            ? { ...vehicle, history: [payload.history, ...(vehicle.history || [])] }
            : vehicle
        )
      );
      setHistoryForms((prev) => ({ ...prev, [vehicleId]: initialHistoryForm }));
    } catch (err) {
      setError(err.message || "Unable to save history entry.");
    } finally {
      setSavingHistory((prev) => ({ ...prev, [vehicleId]: false }));
    }
  };

  const submitEdit = async (vehicleId, event) => {
    event.preventDefault();
    const formState = editForms[vehicleId];
    if (!formState?.registration?.trim()) {
      setError("Registration is required.");
      return;
    }
    setSavingEdit((prev) => ({ ...prev, [vehicleId]: true }));
    setError("");
    try {
      const response = await fetch("/api/staff/vehicles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          make: formState.make,
          model: formState.model,
          registration: formState.registration,
          vin: formState.vin,
          colour: formState.colour,
          payrollDeductionEnabled: formState.payrollDeductionEnabled,
          payrollDeductionReference: formState.payrollDeductionReference,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update vehicle");
      }
      setLocalVehicles((prev) =>
        prev.map((vehicle) =>
          vehicle.id === vehicleId
            ? { ...vehicle, ...payload.vehicle, history: vehicle.history || [] }
            : vehicle
        )
      );
      setEditVisibility((prev) => ({ ...prev, [vehicleId]: false }));
    } catch (err) {
      setError(err.message || "Unable to update vehicle.");
    } finally {
      setSavingEdit((prev) => ({ ...prev, [vehicleId]: false }));
    }
  };

  const removeVehicle = async (vehicleId) => {
    setDeletingVehicle((prev) => ({ ...prev, [vehicleId]: true }));
    setError("");
    try {
      const response = await fetch("/api/staff/vehicles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to remove vehicle");
      }
      setLocalVehicles((prev) => prev.filter((vehicle) => vehicle.id !== vehicleId));
      setEditVisibility((prev) => {
        const next = { ...prev };
        delete next[vehicleId];
        return next;
      });
      setConfirmRemoveId(null);
    } catch (err) {
      setError(err.message || "Unable to remove vehicle.");
    } finally {
      setDeletingVehicle((prev) => ({ ...prev, [vehicleId]: false }));
    }
  };

  const historyEntries = useMemo(() => {
    const rows = localVehicles.flatMap((vehicle) =>
      (vehicle.history || []).map((entry) => ({
        ...entry,
        vehicle,
      }))
    );
    return rows.sort((a, b) => new Date(b.recordedAt || 0) - new Date(a.recordedAt || 0));
  }, [localVehicles]);

  useEffect(() => {
    if (!userId || !userName || localVehicles.length === 0) return;
    let cancelled = false;

    const syncHistory = async () => {
      try {
        const updates = await Promise.all(
          localVehicles.map(async (vehicle) => {
            if (!vehicle?.registration) return [];
            const response = await fetch("/api/staff/vehicle-history/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                vehicleId: vehicle.id,
                registration: vehicle.registration,
                userName,
              }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(payload?.error || "Failed to sync vehicle history");
            }
            return payload?.added || [];
          })
        );

        if (cancelled) return;

        const flat = updates.flat();
        if (flat.length === 0) return;

        setLocalVehicles((prev) =>
          prev.map((vehicle) => ({
            ...vehicle,
            history: [
              ...(flat.filter((entry) => entry.vehicleId === vehicle.id) || []),
              ...(vehicle.history || []),
            ],
          }))
        );
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to sync vehicle history.");
        }
      }
    };

    syncHistory();
    return () => {
      cancelled = true;
    };
  }, [localVehicles, userId, userName]);

  return (
    <SectionCard
      title="Staff Vehicles"
      action={
        <button
          type="button"
          onClick={() => setShowVehicleForm((prev) => !prev)}
          style={showVehicleForm ? secondaryActionButton : primaryActionButton}
        >
          {showVehicleForm ? "Hide form" : "Add vehicle"}
        </button>
      }
    >
      {confirmRemoveId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmRemoveId(null);
            }
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "16px",
              padding: "20px",
              width: "100%",
              maxWidth: "360px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              Remove vehicle?
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              This will remove the vehicle and its repair history from your profile.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setConfirmRemoveId(null)}
                style={{
                  border: "1px solid var(--accent-purple-surface)",
                  borderRadius: "10px",
                  padding: "8px 14px",
                  background: "transparent",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeVehicle(confirmRemoveId)}
                disabled={deletingVehicle[confirmRemoveId]}
                style={{
                  border: "none",
                  borderRadius: "10px",
                  padding: "8px 14px",
                  background: "var(--danger)",
                  color: "white",
                  fontWeight: 600,
                  cursor: deletingVehicle[confirmRemoveId] ? "not-allowed" : "pointer",
                  opacity: deletingVehicle[confirmRemoveId] ? 0.7 : 1,
                }}
              >
                {deletingVehicle[confirmRemoveId] ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        .history-reg-dropdown .dropdown-api__control {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--accent-purple-surface);
          background: var(--surface);
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-primary);
          min-height: 42px;
        }
        .history-reg-dropdown .dropdown-api__value {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-primary);
        }
        .history-reg-dropdown .dropdown-api__value.is-placeholder {
          color: var(--text-secondary);
        }
        .history-reg-dropdown.dropdown-api.is-open .dropdown-api__control,
        .history-reg-dropdown .dropdown-api__control:focus-visible {
          border-color: var(--accent-purple);
          box-shadow: 0 0 0 2px rgba(var(--accent-purple-rgb), 0.15);
        }
      `}</style>
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
        {localVehicles.length === 0 && (
          <div
            style={{
              border: "1px dashed var(--accent-purple-surface)",
              borderRadius: "16px",
              padding: "24px",
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: "0.95rem",
            }}
          >
            No staff vehicles registered yet. Use the Add vehicle button to add your first vehicle.
          </div>
        )}

        {localVehicles.map((vehicle) => {
          const editForm = editForms[vehicle.id] || {
            make: vehicle.make || "",
            model: vehicle.model || "",
            registration: vehicle.registration || "",
            vin: vehicle.vin || "",
            colour: vehicle.colour || "",
            payrollDeductionEnabled: vehicle.payrollDeductionEnabled !== false,
            payrollDeductionReference: vehicle.payrollDeductionReference || "",
          };
          return (
            <article
              key={vehicle.id}
              style={{
                padding: "14px 16px",
                borderRadius: "14px",
                border: "1px solid rgba(var(--accent-purple-rgb), 0.2)",
                background: "rgba(var(--accent-purple-rgb), 0.06)",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: "1 1 240px", minWidth: "220px" }}>
                  <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)" }}>
                    {vehicle.make || "Vehicle"} {vehicle.model}
                  </h3>
                  <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    Reg {vehicle.registration} - VIN {vehicle.vin || "N/A"}
                  </p>
                </div>
                <div
                  style={{
                    flex: "1 1 220px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: "10px",
                  }}
                >
                  <VehicleInfo label="Colour" value={vehicle.colour || "-"} />
                  <VehicleInfo label="Payroll ref" value={vehicle.payrollDeductionReference || "-"} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "6px 12px",
                      borderRadius: "999px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: vehicle.payrollDeductionEnabled ? "var(--success)" : "var(--text-secondary)",
                      background: vehicle.payrollDeductionEnabled
                        ? "rgba(16, 185, 129, 0.12)"
                        : "rgba(148, 163, 184, 0.2)",
                    }}
                  >
                    {vehicle.payrollDeductionEnabled ? "Payroll deductions on" : "Payroll deductions off"}
                  </span>
                  <button
                    type="button"
                    onClick={() => (editVisibility[vehicle.id] ? cancelEdit(vehicle.id) : startEdit(vehicle))}
                    style={secondaryActionButton}
                  >
                    {editVisibility[vehicle.id] ? "Cancel edit" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveId(vehicle.id)}
                    disabled={deletingVehicle[vehicle.id]}
                    style={{
                      ...dangerActionButton,
                      cursor: deletingVehicle[vehicle.id] ? "not-allowed" : "pointer",
                      opacity: deletingVehicle[vehicle.id] ? 0.7 : 1,
                    }}
                  >
                    {deletingVehicle[vehicle.id] ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "10px",
                }}
              >
                <VehicleInfo label="Make" value={vehicle.make || "-"} />
                <VehicleInfo label="Model" value={vehicle.model || "-"} />
                <VehicleInfo label="VIN" value={vehicle.vin || "-"} />
              </div>

              {editVisibility[vehicle.id] && (
                <form
                  onSubmit={(event) => submitEdit(vehicle.id, event)}
                  style={{
                    marginTop: "18px",
                  }}
                >
                  <p style={{ fontWeight: 700, fontSize: "0.9rem", margin: 0, color: "var(--text-primary)" }}>
                    Edit vehicle details
                  </p>
                  <div
                    style={{
                      marginTop: "12px",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <label style={historyLabelStyle}>
                      Registration
                      <input
                        type="text"
                        value={editForm.registration}
                        onChange={(event) =>
                          handleEditFieldChange(vehicle.id, "registration", event.target.value.toUpperCase())
                        }
                        style={historyInputStyle}
                        placeholder="AB12 CDE"
                      />
                    </label>
                    <label style={historyLabelStyle}>
                      Make
                      <input
                        type="text"
                        value={editForm.make}
                        onChange={(event) => handleEditFieldChange(vehicle.id, "make", event.target.value)}
                        style={historyInputStyle}
                      />
                    </label>
                    <label style={historyLabelStyle}>
                      Model
                      <input
                        type="text"
                        value={editForm.model}
                        onChange={(event) => handleEditFieldChange(vehicle.id, "model", event.target.value)}
                        style={historyInputStyle}
                      />
                    </label>
                    <label style={historyLabelStyle}>
                      VIN
                      <input
                        type="text"
                        value={editForm.vin}
                        onChange={(event) => handleEditFieldChange(vehicle.id, "vin", event.target.value)}
                        style={historyInputStyle}
                      />
                    </label>
                    <label style={historyLabelStyle}>
                      Colour
                      <input
                        type="text"
                        value={editForm.colour}
                        onChange={(event) => handleEditFieldChange(vehicle.id, "colour", event.target.value)}
                        style={historyInputStyle}
                      />
                    </label>
                    <label style={historyLabelStyle}>
                      Payroll reference
                      <input
                        type="text"
                        value={editForm.payrollDeductionReference}
                        onChange={(event) =>
                          handleEditFieldChange(vehicle.id, "payrollDeductionReference", event.target.value)
                        }
                        style={historyInputStyle}
                      />
                    </label>
                  </div>
                  <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "12px", alignItems: "center" }}>
                    <label style={{ ...historyLabelStyle, flexDirection: "row", alignItems: "center", gap: "8px", margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(editForm.payrollDeductionEnabled)}
                        onChange={(event) =>
                          handleEditFieldChange(vehicle.id, "payrollDeductionEnabled", event.target.checked)
                        }
                        className="h-4 w-4 rounded text-[var(--primary)]"
                      />
                      Deduct repairs from payroll automatically
                    </label>
                    <button
                      type="button"
                      onClick={() => cancelEdit(vehicle.id)}
                      style={secondaryActionButton}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit[vehicle.id]}
                      style={primaryActionButton}
                    >
                      {savingEdit[vehicle.id] ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </form>
              )}

            </article>
          );
        })}
      </div>

      <div style={{ marginTop: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>History</div>
          <button
            type="button"
            onClick={() => setShowHistoryForm((prev) => !prev)}
            style={showHistoryForm ? secondaryActionButton : primaryActionButton}
          >
            {showHistoryForm ? "Hide repair form" : "Log new repair"}
          </button>
        </div>

        {showHistoryForm && (
          <form
            onSubmit={(event) => submitHistory(selectedHistoryVehicleId, event)}
            style={{
              padding: "8px 0",
            }}
          >
            <p style={{ fontWeight: 700, fontSize: "0.9rem", margin: 0, color: "var(--text-primary)" }}>
              Log new repair
            </p>
            <div
              style={{
                marginTop: "12px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
              }}
            >
              <label style={historyLabelStyle}>
                Reg
                <DropdownField
                  className="history-reg-dropdown"
                  placeholder="Select vehicle"
                  value={selectedHistoryVehicleId || ""}
                  onChange={(event) => setSelectedHistoryVehicleId(event.target.value)}
                  options={localVehicles.map((vehicle) => ({
                    key: vehicle.id,
                    value: vehicle.id,
                    label: `${vehicle.registration}${vehicle.make || vehicle.model ? ` - ${vehicle.make} ${vehicle.model}` : ""}`,
                  }))}
                />
              </label>
              <label style={historyLabelStyle}>
                Job Number
                <div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
                  <input
                    type="search"
                    value={historyForms[selectedHistoryVehicleId]?.jobNumber ?? ""}
                    onChange={(event) =>
                      handleHistoryFieldChange(selectedHistoryVehicleId, "jobNumber", event.target.value)
                    }
                    onBlur={(event) =>
                      fetchJobSummary(selectedHistoryVehicleId, event.target.value.trim())
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        fetchJobSummary(selectedHistoryVehicleId, event.currentTarget.value.trim());
                      }
                    }}
                    style={historyInputStyle}
                    placeholder="Search job number"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      fetchJobSummary(selectedHistoryVehicleId, (historyForms[selectedHistoryVehicleId]?.jobNumber || "").trim())
                    }
                    style={primaryActionButton}
                  >
                    Search
                  </button>
                </div>
              </label>
              <label style={historyLabelStyle}>
                Description
                <input
                  type="text"
                  value={historyForms[selectedHistoryVehicleId]?.description ?? ""}
                  onChange={(event) =>
                    handleHistoryFieldChange(selectedHistoryVehicleId, "description", event.target.value)
                  }
                  style={historyInputStyle}
                  placeholder="E.g. brake pads"
                  readOnly={Boolean(historyForms[selectedHistoryVehicleId]?.jobNumber)}
                />
              </label>
              <label style={historyLabelStyle}>
                Cost (Â£)
                <input
                  type="number"
                  step="0.01"
                  value={historyForms[selectedHistoryVehicleId]?.cost ?? ""}
                  onChange={(event) => handleHistoryFieldChange(selectedHistoryVehicleId, "cost", event.target.value)}
                  style={historyInputStyle}
                  placeholder="0.00"
                  readOnly={Boolean(historyForms[selectedHistoryVehicleId]?.jobNumber)}
                />
              </label>
            </div>
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "12px", alignItems: "center" }}>
              <label style={{ ...historyLabelStyle, flexDirection: "row", alignItems: "center", gap: "8px", margin: 0 }}>
                <input
                  type="checkbox"
                  checked={Boolean(historyForms[selectedHistoryVehicleId]?.deductFromPayroll)}
                  onChange={(event) =>
                    handleHistoryFieldChange(selectedHistoryVehicleId, "deductFromPayroll", event.target.checked)
                  }
                  className="h-4 w-4 rounded text-[var(--primary)]"
                />
                Deduct from payroll
              </label>
              <button
                type="submit"
                disabled={!selectedHistoryVehicleId || savingHistory[selectedHistoryVehicleId]}
                style={primaryActionButton}
              >
                {savingHistory[selectedHistoryVehicleId] ? "Saving..." : "Add entry"}
              </button>
            </div>
          </form>
        )}

        <div style={{ maxHeight: "360px", overflowY: "auto" }}>
          {historyEntries.length === 0 ? (
            <div
              style={{
                border: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
                borderRadius: "12px",
                padding: "18px",
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
                background: "rgba(var(--accent-purple-rgb), 0.04)",
              }}
            >
              No repair history yet.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <th style={{ textAlign: "left", padding: "6px 0" }}>Reg</th>
                  <th style={{ textAlign: "left", padding: "6px 0" }}>Description</th>
                  <th style={{ textAlign: "left", padding: "6px 0" }}>Date</th>
                  <th style={{ textAlign: "left", padding: "6px 0" }}>Payroll</th>
                  <th style={{ textAlign: "right", padding: "6px 0" }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {historyEntries.map((entry) => (
                  <tr key={`${entry.id}-${entry.vehicle?.id}`} style={{ borderTop: "1px solid rgba(var(--accent-purple-rgb), 0.2)" }}>
                    <td style={{ padding: "10px 0", fontWeight: 600, color: "var(--text-primary)" }}>
                      {entry.vehicle?.registration || "â€”"}
                    </td>
                    <td style={{ padding: "10px 0", fontWeight: 600, color: "var(--text-primary)" }}>
                      {entry.description || "Workshop visit"}
                    </td>
                    <td style={{ padding: "10px 0", color: "var(--text-secondary)" }}>
                      {entry.recordedAt ? new Date(entry.recordedAt).toLocaleDateString() : "Pending"}
                    </td>
                    <td style={{ padding: "10px 0", color: "var(--text-secondary)" }}>
                      {entry.deductFromPayroll ? "Deduct" : "Manual"}
                    </td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600 }}>
                      Â£{Number(entry.cost ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showVehicleForm && (
        <div
          style={{
            marginTop: "22px",
            padding: "16px",
            borderRadius: "14px",
            border: "1px solid rgba(var(--accent-purple-rgb), 0.2)",
            background: "rgba(var(--accent-purple-rgb), 0.06)",
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
            Add vehicle
          </div>
          <form onSubmit={submitVehicle}>
            <div
              style={{
                display: "grid",
                gap: "12px",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              }}
            >
              <label style={historyLabelStyle}>
                Registration
                <div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value={vehicleForm.registration}
                    onChange={(event) =>
                      handleVehicleFieldChange("registration", event.target.value.toUpperCase())
                    }
                    style={historyInputStyle}
                    placeholder="AB12 CDE"
                  />
                  <button
                    type="button"
                    onClick={lookupVehicleDetails}
                    disabled={isLookupLoading}
                    style={primaryActionButton}
                  >
                    {isLookupLoading ? "Searching..." : "Search"}
                  </button>
                </div>
              </label>
              <label style={historyLabelStyle}>
                Make
                <input
                  type="text"
                  value={vehicleForm.make}
                  onChange={(event) => handleVehicleFieldChange("make", event.target.value)}
                  style={historyInputStyle}
                />
              </label>
              <label style={historyLabelStyle}>
                Model
                <input
                  type="text"
                  value={vehicleForm.model}
                  onChange={(event) => handleVehicleFieldChange("model", event.target.value)}
                  style={historyInputStyle}
                />
              </label>
              <label style={historyLabelStyle}>
                VIN
                <input
                  type="text"
                  value={vehicleForm.vin}
                  onChange={(event) => handleVehicleFieldChange("vin", event.target.value)}
                  style={historyInputStyle}
                />
              </label>
              <label style={historyLabelStyle}>
                Colour
                <input
                  type="text"
                  value={vehicleForm.colour}
                  onChange={(event) => handleVehicleFieldChange("colour", event.target.value)}
                  style={historyInputStyle}
                />
              </label>
              <label style={historyLabelStyle}>
                Payroll reference
                <input
                  type="text"
                  value={vehicleForm.payrollDeductionReference}
                  onChange={(event) =>
                    handleVehicleFieldChange("payrollDeductionReference", event.target.value)
                  }
                  style={historyInputStyle}
                  placeholder="Optional reference"
                />
              </label>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "10px" }}>
              Enabling this means workshop-approved repairs for this vehicle will be forwarded directly to payroll for
              deduction from your next payslip.
            </p>

            <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end", gap: "12px", alignItems: "center" }}>
              <label style={{ ...historyLabelStyle, flexDirection: "row", alignItems: "center", gap: "8px", margin: 0 }}>
                <input
                  type="checkbox"
                  checked={vehicleForm.payrollDeductionEnabled}
                  onChange={(event) =>
                    handleVehicleFieldChange("payrollDeductionEnabled", event.target.checked)
                  }
                  className="h-4 w-4 rounded text-[var(--primary)]"
                />
                Deduct repairs from payroll automatically
              </label>
              <button
                type="submit"
                disabled={savingVehicle}
                style={primaryActionButton}
              >
                {savingVehicle ? "Saving..." : "Add vehicle"}
              </button>
            </div>
          </form>
        </div>
      )}
    </SectionCard>
  );
}

const historyLabelStyle = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text-secondary)",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const historyInputStyle = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--accent-purple-surface)",
  fontSize: "0.9rem",
  fontWeight: 500,
  background: "var(--surface)",
  color: "var(--text-primary)",
};

const primaryActionButton = {
  border: "1px solid var(--accent-purple)",
  borderRadius: "10px",
  padding: "8px 14px",
  background: "var(--accent-purple)",
  color: "white",
  fontWeight: 600,
  fontSize: "0.8rem",
  cursor: "pointer",
};

const secondaryActionButton = {
  border: "1px solid rgba(var(--accent-purple-rgb), 0.4)",
  borderRadius: "10px",
  padding: "8px 14px",
  background: "transparent",
  color: "var(--accent-purple)",
  fontWeight: 600,
  fontSize: "0.8rem",
  cursor: "pointer",
};

const dangerActionButton = {
  border: "1px solid rgba(239, 68, 68, 0.5)",
  borderRadius: "10px",
  padding: "8px 14px",
  background: "rgba(239, 68, 68, 0.12)",
  color: "var(--danger)",
  fontWeight: 600,
  fontSize: "0.8rem",
  cursor: "pointer",
};

function VehicleInfo({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.02em" }}>
        {label}
      </span>
      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

