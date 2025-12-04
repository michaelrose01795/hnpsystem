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
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingHistory, setSavingHistory] = useState({});
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
    } catch (err) {
      setError(err.message || "Unable to add vehicle.");
    } finally {
      setSavingVehicle(false);
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
    } catch (err) {
      setError(err.message || "Unable to save history entry.");
    } finally {
      setSavingHistory((prev) => ({ ...prev, [vehicleId]: false }));
    }
  };

  return (
    <SectionCard
      title="Staff Vehicles"
      subtitle="Register your personal vehicles. Workshop repairs automatically deduct from payroll when enabled."
    >
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {localVehicles.map((vehicle) => {
          const historyForm = historyForms[vehicle.id] || initialHistoryForm;
          return (
            <div
              key={vehicle.id}
              className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {vehicle.make} {vehicle.model}
                  </p>
                  <p className="text-xs text-slate-500">
                    Reg: {vehicle.registration} · VIN: {vehicle.vin || "N/A"}
                  </p>
                </div>
                {vehicle.payrollDeductionEnabled ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                    Payroll deductions enabled
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                    Payroll deductions off
                  </span>
                )}
              </div>
              {vehicle.payrollDeductionReference && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Payroll reference: {vehicle.payrollDeductionReference}
                </p>
              )}

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Repair history
                </p>
                {vehicle.history?.length ? (
                  <ul className="mt-2 space-y-2 text-sm">
                    {vehicle.history.map((entry) => (
                      <li
                        key={entry.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                      >
                        <div className="flex justify-between">
                          <span>{entry.description || "Workshop visit"}</span>
                          <span className="font-semibold text-slate-900">
                            £{entry.cost.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {entry.recordedAt
                            ? new Date(entry.recordedAt).toLocaleDateString()
                            : "Date pending"}{" "}
                          · {entry.deductFromPayroll ? "Deduct payroll" : "Manual payment"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                    No workshop history for this vehicle yet.
                  </p>
                )}
              </div>

              <form
                onSubmit={(event) => submitHistory(vehicle.id, event)}
                className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-3 text-xs"
              >
                <p className="font-semibold text-slate-600">Log new repair</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <label className="text-slate-500">
                    Description
                    <input
                      type="text"
                      value={historyForm.description}
                      onChange={(event) =>
                        handleHistoryFieldChange(vehicle.id, "description", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-[var(--primary)] focus:outline-none"
                      placeholder="E.g. brake pads"
                    />
                  </label>
                  <label className="text-slate-500">
                    Cost (£)
                    <input
                      type="number"
                      step="0.01"
                      value={historyForm.cost}
                      onChange={(event) =>
                        handleHistoryFieldChange(vehicle.id, "cost", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-[var(--primary)] focus:outline-none"
                      placeholder="0.00"
                    />
                  </label>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <label className="text-slate-500">
                    Workshop job #
                    <input
                      type="text"
                      value={historyForm.jobId}
                      onChange={(event) =>
                        handleHistoryFieldChange(vehicle.id, "jobId", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-[var(--primary)] focus:outline-none"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="mt-4 flex items-center gap-2 text-slate-500">
                    <input
                      type="checkbox"
                      checked={historyForm.deductFromPayroll}
                      onChange={(event) =>
                        handleHistoryFieldChange(
                          vehicle.id,
                          "deductFromPayroll",
                          event.target.checked
                        )
                      }
                      className="h-4 w-4 rounded text-[var(--primary)]"
                    />
                    Deduct this repair from payroll
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingHistory[vehicle.id]}
                    className="rounded-full border border-[var(--surface-light)] bg-[var(--primary)] px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--danger)]"
                  >
                    {savingHistory[vehicle.id] ? "Saving…" : "Add to history"}
                  </button>
                </div>
              </form>
            </div>
          );
        })}
        {localVehicles.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            No staff vehicles registered yet. Use the form below to add your first vehicle.
          </p>
        )}
      </div>

      <form onSubmit={submitVehicle} className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add staff vehicle</p>
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
            Registration
            <input
              type="text"
              value={vehicleForm.registration}
              onChange={(event) => handleVehicleFieldChange("registration", event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
              placeholder="AB12 CDE"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            VIN
            <input
              type="text"
              value={vehicleForm.vin}
              onChange={(event) => handleVehicleFieldChange("vin", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Colour
            <input
              type="text"
              value={vehicleForm.colour}
              onChange={(event) => handleVehicleFieldChange("colour", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
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
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={vehicleForm.payrollDeductionEnabled}
            onChange={(event) => handleVehicleFieldChange("payrollDeductionEnabled", event.target.checked)}
            className="h-4 w-4 rounded text-[var(--primary)]"
          />
          Deduct repairs from payroll automatically
        </label>
        <p className="text-[11px] text-slate-500">
          Enabling this means workshop-approved repairs for this vehicle will be forwarded directly to payroll for
          deduction from your next payslip.
        </p>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={savingVehicle}
            className="rounded-full border border-[var(--surface-light)] bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white shadow hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--danger)]"
          >
            {savingVehicle ? "Saving…" : "Add vehicle"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
