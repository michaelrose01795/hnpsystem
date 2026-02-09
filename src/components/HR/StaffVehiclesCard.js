// file location: src/components/HR/StaffVehiclesCard.js
import React, { useEffect, useState } from "react";
import { SectionCard } from "@/components/HR/MetricCard";

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
  jobId: "",
};

export default function StaffVehiclesCard({ userId, vehicles = [] }) {
  const [localVehicles, setLocalVehicles] = useState(vehicles);
  const [vehicleForm, setVehicleForm] = useState(initialVehicleForm);
  const [historyForms, setHistoryForms] = useState({});
  const [historyVisibility, setHistoryVisibility] = useState({});
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingHistory, setSavingHistory] = useState({});
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalVehicles(vehicles);
  }, [vehicles]);

  const handleVehicleFieldChange = (field, value) => {
    setVehicleForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleHistoryFieldChange = (vehicleId, field, value) => {
    setHistoryForms((prev) => ({
      ...prev,
      [vehicleId]: {
        ...(prev[vehicleId] || initialHistoryForm),
        [field]: value,
      },
    }));
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
          jobId: formState.jobId,
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
      setHistoryVisibility((prev) => ({ ...prev, [vehicleId]: false }));
    } catch (err) {
      setError(err.message || "Unable to save history entry.");
    } finally {
      setSavingHistory((prev) => ({ ...prev, [vehicleId]: false }));
    }
  };

  return (
    <SectionCard title="Staff Vehicles">
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
            No staff vehicles registered yet. Use the button below to add your first vehicle.
          </div>
        )}

        {localVehicles.map((vehicle) => {
          const historyForm = historyForms[vehicle.id] || initialHistoryForm;
          return (
            <article
              key={vehicle.id}
              style={{
                border: "1px solid var(--accent-purple-surface)",
                borderRadius: "20px",
                padding: "20px",
                background: "var(--surface)",
                width: "100%",
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
                  <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)" }}>
                    {vehicle.make || "Vehicle"} {vehicle.model}
                  </h3>
                  <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    Reg {vehicle.registration} • VIN {vehicle.vin || "N/A"}
                  </p>
                </div>
                <span
                  style={{
                    alignSelf: "flex-start",
                    padding: "6px 12px",
                    borderRadius: "999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: vehicle.payrollDeductionEnabled ? "var(--success)" : "var(--text-secondary)",
                    background: vehicle.payrollDeductionEnabled
                      ? "rgba(16, 185, 129, 0.12)"
                      : "rgba(148, 163, 184, 0.2)",
                  }}
                >
                  {vehicle.payrollDeductionEnabled ? "Payroll deductions on" : "Payroll deductions off"}
                </span>
              </div>

              {vehicle.payrollDeductionReference && (
                <p style={{ margin: "12px 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Payroll reference: <strong>{vehicle.payrollDeductionReference}</strong>
                </p>
              )}

              <div
                style={{
                  marginTop: "16px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "12px",
                }}
              >
                <VehicleInfo label="Make" value={vehicle.make || "—"} />
                <VehicleInfo label="Model" value={vehicle.model || "—"} />
                <VehicleInfo label="Colour" value={vehicle.colour || "—"} />
                <VehicleInfo label="VIN" value={vehicle.vin || "—"} />
              </div>

              <div style={{ marginTop: "20px" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px" }}>
                  Repair history
                </p>
                {vehicle.history?.length ? (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        <th style={{ textAlign: "left", padding: "6px 0" }}>Description</th>
                        <th style={{ textAlign: "left", padding: "6px 0" }}>Date</th>
                        <th style={{ textAlign: "left", padding: "6px 0" }}>Payroll</th>
                        <th style={{ textAlign: "right", padding: "6px 0" }}>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicle.history.map((entry) => (
                        <tr key={entry.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
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
                            £{entry.cost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div
                    style={{
                      border: "1px dashed var(--accent-purple-surface)",
                      borderRadius: "12px",
                      padding: "16px",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      fontSize: "0.85rem",
                    }}
                  >
                    No workshop history for this vehicle yet.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setHistoryVisibility((prev) => ({
                    ...prev,
                    [vehicle.id]: !prev[vehicle.id],
                  }))
                }
                style={{
                  marginTop: "16px",
                  border: "1px solid var(--accent-purple-surface)",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  background: "transparent",
                  fontWeight: 600,
                  color: "var(--primary)",
                  cursor: "pointer",
                }}
              >
                {historyVisibility[vehicle.id] ? "Hide repair form" : "Add to history"}
              </button>

              {historyVisibility[vehicle.id] && (
                <form
                  onSubmit={(event) => submitHistory(vehicle.id, event)}
                  style={{
                    marginTop: "12px",
                    border: "1px solid var(--accent-purple-surface)",
                    borderRadius: "16px",
                    padding: "16px",
                    background: "var(--surface-light)",
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
                    Description
                    <input
                      type="text"
                      value={historyForm.description}
                      onChange={(event) =>
                        handleHistoryFieldChange(vehicle.id, "description", event.target.value)
                      }
                      style={historyInputStyle}
                      placeholder="E.g. brake pads"
                    />
                  </label>
                  <label style={historyLabelStyle}>
                    Cost (£)
                    <input
                      type="number"
                      step="0.01"
                      value={historyForm.cost}
                      onChange={(event) => handleHistoryFieldChange(vehicle.id, "cost", event.target.value)}
                      style={historyInputStyle}
                      placeholder="0.00"
                    />
                  </label>
                  <label style={historyLabelStyle}>
                    Workshop job #
                    <input
                      type="text"
                      value={historyForm.jobId}
                      onChange={(event) => handleHistoryFieldChange(vehicle.id, "jobId", event.target.value)}
                      style={historyInputStyle}
                      placeholder="Optional"
                    />
                  </label>
                  <label style={{ ...historyLabelStyle, display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      checked={historyForm.deductFromPayroll}
                      onChange={(event) =>
                        handleHistoryFieldChange(vehicle.id, "deductFromPayroll", event.target.checked)
                      }
                      className="h-4 w-4 rounded text-[var(--primary)]"
                    />
                    Deduct from payroll
                  </label>
                  </div>
                  <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={savingHistory[vehicle.id]}
                      className="rounded-full border border-[var(--surface-light)] bg-[var(--primary)] px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--danger)]"
                    >
                      {savingHistory[vehicle.id] ? "Saving…" : "Add entry"}
                    </button>
                  </div>
                </form>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add staff vehicle</p>
          <button
            type="button"
            onClick={() => setShowVehicleForm((prev) => !prev)}
            className="rounded-full border border-[var(--primary)] px-4 py-1 text-xs font-semibold text-[var(--primary)]"
          >
            {showVehicleForm ? "Hide form" : "Add vehicle"}
          </button>
        </div>

        {showVehicleForm && (
          <form onSubmit={submitVehicle}>
            <div className="mt-3">
              <label className="text-xs font-semibold text-slate-600">
                Registration
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={vehicleForm.registration}
                    onChange={(event) =>
                      handleVehicleFieldChange("registration", event.target.value.toUpperCase())
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                    placeholder="AB12 CDE"
                  />
                  <button
                    type="button"
                    onClick={lookupVehicleDetails}
                    disabled={isLookupLoading}
                    className="rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[var(--danger)]"
                  >
                    {isLookupLoading ? "Searching…" : "Search"}
                  </button>
                </div>
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">
                Make
                <input
                  type="text"
                  value={vehicleForm.make}
                  onChange={(event) => handleVehicleFieldChange("make", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Model
                <input
                  type="text"
                  value={vehicleForm.model}
                  onChange={(event) => handleVehicleFieldChange("model", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">
                VIN
                <input
                  type="text"
                  value={vehicleForm.vin}
                  onChange={(event) => handleVehicleFieldChange("vin", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Colour
                <input
                  type="text"
                  value={vehicleForm.colour}
                  onChange={(event) => handleVehicleFieldChange("colour", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">
                Payroll reference
                <input
                  type="text"
                  value={vehicleForm.payrollDeductionReference}
                  onChange={(event) =>
                    handleVehicleFieldChange("payrollDeductionReference", event.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                  placeholder="Optional reference"
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
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
            </div>
            <p className="text-[11px] text-slate-500">
              Enabling this means workshop-approved repairs for this vehicle will be forwarded directly to payroll for
              deduction from your next payslip.
            </p>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingVehicle}
                className="rounded-full border border-[var(--surface-light)] bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--danger)]"
              >
                {savingVehicle ? "Saving…" : "Add vehicle"}
              </button>
            </div>
          </form>
        )}
      </div>
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
