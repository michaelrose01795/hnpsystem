// file location: src/features/customers/hub/CustomerVehiclesSection.js
//
// The customer's vehicles, with everything the front desk asks for on the
// phone — model, VIN, mileage, fuel, transmission, MOT, tax, service history,
// service plan and warranty — plus the actions that follow from looking at one.
//
// "Open vehicle" filters this record's history to that registration rather than
// navigating away: there is no standalone vehicle route in the app, and the
// customer's own history is what staff actually want to see next.

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import StatusMessage from "@/components/ui/StatusMessage";
import InputField from "@/components/ui/InputField";
import { createOrUpdateVehicle } from "@/lib/database/vehicles";
import {
  RecordFieldGrid,
  RecordHeading,
  RegistrationPlate,
  StatusBadge,
  LinkButton,
} from "./RecordPrimitives";
import {
  buildVehicleWarnings,
  describeVehicle,
  formatDate,
  formatMileage,
} from "@/lib/customers/customerHubModel";

function AddVehicleForm({ customerId, onDone, onCancel }) {
  const [registration, setRegistration] = useState("");
  const [lookup, setLookup] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const handleLookup = async () => {
    const reg = registration.trim().toUpperCase();
    if (!reg) return;
    setBusy("lookup");
    setMessage("");
    setLookup(null);
    try {
      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: reg }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setMessage(error.message || error.error || "Vehicle not found. You can still save the registration.");
      } else {
        setLookup(await response.json());
      }
    } catch (_err) {
      setMessage("DVLA lookup failed. You can still save the registration.");
    }
    setBusy("");
  };

  const handleSave = async () => {
    const reg = registration.trim().toUpperCase();
    if (!reg) return;
    setBusy("save");
    setMessage("");

    const payload = { registration: reg, reg_number: reg, customer_id: customerId };
    if (lookup) {
      Object.assign(payload, {
        make: lookup.make || undefined,
        model: lookup.model || undefined,
        make_model: lookup.make && lookup.model ? `${lookup.make} ${lookup.model}` : undefined,
        year: lookup.yearOfManufacture || undefined,
        colour: lookup.colour || undefined,
        fuel_type: lookup.fuelType || undefined,
        mot_due: lookup.motExpiryDate || undefined,
        engine_capacity: lookup.engineCapacity || undefined,
        co2_emissions: lookup.co2Emissions || undefined,
        tax_status: lookup.taxStatus || undefined,
        tax_due_date: lookup.taxDueDate || undefined,
        marked_for_export: lookup.markedForExport || false,
        wheelplan: lookup.wheelplan || undefined,
        month_of_first_registration: lookup.monthOfFirstRegistration || undefined,
      });
    }

    const result = await createOrUpdateVehicle(payload);
    if (result.success) onDone?.();
    else setMessage(result.error?.message || "Failed to add vehicle.");
    setBusy("");
  };

  return (
    <LayerSurface as="div" sectionKey="customer-profile-vehicle-add" parentKey="customer-profile-vehicles">
      <h3 className="app-record-heading">Add a vehicle</h3>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "10px" }}>
        <div style={{ flex: "0 1 200px", minWidth: 0 }}>
          <InputField
            label="Registration"
            id="customer-add-vehicle-reg"
            value={registration}
            autoFocus
            disabled={Boolean(busy)}
            onChange={(event) => {
              setRegistration(event.target.value);
              setLookup(null);
              setMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleLookup();
              }
            }}
            placeholder="AB12 CDE"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={handleLookup} disabled={Boolean(busy) || !registration.trim()}>
          {busy === "lookup" ? "Looking up…" : "DVLA lookup"}
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={Boolean(busy) || !registration.trim()}>
          {busy === "save" ? "Saving…" : lookup ? "Save vehicle" : "Save without lookup"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={Boolean(busy)}>
          Cancel
        </Button>
      </div>

      {message && <StatusMessage tone="warning">{message}</StatusMessage>}

      {lookup && (
        <LayerTheme as="div" sectionKey="customer-profile-vehicle-dvla" parentKey="customer-profile-vehicle-add">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
            <RegistrationPlate registration={registration.trim().toUpperCase()} onTheme />
            <span className="app-record-note app-record-note--strong">
              {[lookup.make, lookup.model].filter(Boolean).join(" ") || "Unknown vehicle"}
            </span>
          </div>
          <RecordFieldGrid
            fields={[
              { label: "Year", value: lookup.yearOfManufacture },
              { label: "Colour", value: lookup.colour },
              { label: "Fuel", value: lookup.fuelType },
              { label: "MOT due", value: lookup.motExpiryDate ? formatDate(lookup.motExpiryDate) : null },
              { label: "Tax status", value: lookup.taxStatus },
              { label: "Engine", value: lookup.engineCapacity ? `${lookup.engineCapacity} cc` : null },
            ]}
          />
        </LayerTheme>
      )}
    </LayerSurface>
  );
}

function VehicleCard({ vehicle, customerId, access, onOpenHistory }) {
  const details = describeVehicle(vehicle);
  const warnings = buildVehicleWarnings(vehicle);
  const encodedReg = encodeURIComponent(details.registration);

  return (
    <LayerSurface
      as="article"
      sectionKey={`customer-profile-vehicle-${details.id}`}
      parentKey="customer-profile-vehicles"
    >
      <div className="app-page-header">
        <div
          className="app-page-header__text"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}
        >
          <RegistrationPlate registration={details.registration} onTheme />
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <span className="app-record-note app-record-note--strong">{details.makeModel}</span>
            <span className="app-record-note">
              {[details.year ? `Year ${details.year}` : null, details.colour, details.bodyStyle]
                .filter(Boolean)
                .join(" · ") || "No further details on file"}
            </span>
          </div>
        </div>
        <div className="app-page-header__actions">
          {warnings.map((warning) => (
            <StatusBadge key={warning.label} tone={warning.tone}>
              {warning.label}
            </StatusBadge>
          ))}
        </div>
      </div>

      <div className="app-record-rule" aria-hidden="true" />

      <RecordFieldGrid
        keepEmpty
        fields={[
          { label: "VIN / chassis", value: details.vin },
          { label: "Mileage", value: formatMileage(details.mileage) },
          { label: "Fuel", value: details.fuel },
          { label: "Transmission", value: details.transmission },
          { label: "Engine", value: details.engine },
          { label: "MOT due", value: details.motDue ? formatDate(details.motDue) : null },
          { label: "Tax", value: details.taxStatus },
          { label: "Tax due", value: details.taxDue ? formatDate(details.taxDue) : null },
        ]}
      />

      <RecordFieldGrid
        wide
        fields={[
          { label: "Service history", value: details.serviceHistory },
          {
            label: "Service plan",
            value: details.servicePlan
              ? `${details.servicePlan}${details.servicePlanExpiry ? ` · to ${formatDate(details.servicePlanExpiry)}` : ""}`
              : null,
          },
          {
            label: "Warranty",
            value: details.warrantyType
              ? `${details.warrantyType}${details.warrantyExpiry ? ` · to ${formatDate(details.warrantyExpiry)}` : ""}`
              : null,
          },
          { label: "Lease company", value: details.leaseCo },
        ]}
      />

      <div className="app-record-actions">
        <Button variant="secondary" size="sm" onClick={() => onOpenHistory?.(details.registration)}>
          Open vehicle history
        </Button>
        {access?.canCreateJob && (
          <LinkButton
            href={`/new-job?customerId=${encodeURIComponent(customerId || "")}&reg=${encodedReg}`}
            variant="primary"
          >
            Create job
          </LinkButton>
        )}
        {access?.canBookAppointment && (
          <LinkButton href={`/appointments?customerId=${encodeURIComponent(customerId || "")}`}>
            Book appointment
          </LinkButton>
        )}
      </div>
    </LayerSurface>
  );
}

export default function CustomerVehiclesSection({
  vehicles = [],
  customerId,
  access,
  onVehicleAdded,
  onOpenHistory,
}) {
  const [adding, setAdding] = useState(false);

  return (
    <LayerTheme as="section" sectionKey="customer-profile-vehicles" parentKey="customer-profile-tab-overview">
      <RecordHeading
        actions={
          access?.canManageVehicles && !adding ? (
            <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
              Add vehicle
            </Button>
          ) : null
        }
      >
        {`Linked vehicles (${vehicles.length})`}
      </RecordHeading>

      {adding && (
        <AddVehicleForm
          customerId={customerId}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            onVehicleAdded?.();
          }}
        />
      )}

      {vehicles.length === 0 ? (
        <EmptyState
          variant="bare"
          icon="🚗"
          title="No vehicles on this record"
          description="Add the customer's vehicle so jobs, MOT reminders and history attach to the right car."
          action={
            access?.canManageVehicles && !adding ? (
              <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
                Add vehicle
              </Button>
            ) : null
          }
        />
      ) : (
        vehicles.map((vehicle) => (
          <VehicleCard
            key={vehicle.vehicle_id}
            vehicle={vehicle}
            customerId={customerId}
            access={access}
            onOpenHistory={onOpenHistory}
          />
        ))
      )}
    </LayerTheme>
  );
}
