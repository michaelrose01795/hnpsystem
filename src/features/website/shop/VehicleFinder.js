// file location: src/features/website/shop/VehicleFinder.js
//
// "Find parts for my vehicle": by registration, or by choosing the car.
//
// Registration goes through useVehicleLookup (the public DVLA route). DVLA
// knows the make but not the model, so a successful lookup pre-selects the
// make and asks for the model; a make we do not carry parts for says so
// rather than showing an empty catalogue. The manual tab is the same make /
// model choice without the lookup, and is where a failed lookup sends people.
//
// The component only collects a vehicle. `onApply({ make, model })` decides
// what that means: the catalogue writes it into the URL, the #shop teaser hands
// it over to the catalogue. The make / model lists and the matching rules live
// in src/lib/parts/vehicleFitment.js.
//
// Styling: reuses .ws-segmented, .ws-quick-form, .ws-stock-field, .ws-val-plate and
// .ws-form-error; .ws-finder-* in custglobal.css (@family shop) for the rest.

import { useEffect, useState } from "react";
import WebsiteNativeSelect from "../components/WebsiteNativeSelect";
import useVehicleLookup from "../hooks/useVehicleLookup";
import { PARTS_MAKES, modelsForMake, makeFromDvla } from "@/lib/parts/vehicleFitment";
import { formatReg, isPlausibleReg } from "@/lib/valuation/vehicleValuation";

const MODES = [
  { id: "reg", label: "By registration" },
  { id: "manual", label: "Choose my car" },
];

const MAKE_OPTIONS = [
  { value: "", label: "Choose manufacturer" },
  ...PARTS_MAKES.map((m) => ({ value: m.make, label: m.make })),
];

const modelOptions = (make) => [
  { value: "", label: make ? `All ${make} models` : "Choose manufacturer first" },
  ...modelsForMake(make).map((m) => ({ value: m, label: m })),
];

const titleCase = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());

const dvlaSummary = (vehicle) =>
  [
    vehicle?.year,
    titleCase(vehicle?.make),
    vehicle?.engineCapacity ? `${vehicle.engineCapacity}cc` : null,
    vehicle?.fuelType ? titleCase(vehicle.fuelType) : null,
  ]
    .filter(Boolean)
    .join(" · ");

export default function VehicleFinder({ vehicle = {}, onApply, onClear, idPrefix = "ws-finder" }) {
  const [mode, setMode] = useState("reg");
  const [reg, setReg] = useState("");
  const [regError, setRegError] = useState("");
  const [make, setMake] = useState(vehicle.make || "");
  const [model, setModel] = useState(vehicle.model || "");
  const lookup = useVehicleLookup();

  // Follow the applied vehicle when it changes outside (Back button, Clear).
  useEffect(() => {
    setMake(vehicle.make || "");
    setModel(vehicle.model || "");
  }, [vehicle.make, vehicle.model]);

  // A found registration pre-selects its make; the model is the customer's.
  useEffect(() => {
    if (lookup.status !== "found") return;
    setMake(makeFromDvla(lookup.vehicle?.make) || "");
    setModel("");
  }, [lookup.status, lookup.vehicle]);

  const submitReg = (event) => {
    event.preventDefault();
    if (!isPlausibleReg(reg)) {
      setRegError("That does not look like a UK registration. Try again, for example AB12 CDE.");
      return;
    }
    setRegError("");
    lookup.lookup(reg);
  };

  const apply = (event) => {
    event.preventDefault();
    if (!make) return;
    onApply?.({ make, model });
  };

  const applied = vehicle.make ? [vehicle.make, vehicle.model].filter(Boolean).join(" ") : "";
  const foundMake = lookup.status === "found" ? makeFromDvla(lookup.vehicle?.make) : null;
  const showSelection = mode === "manual" || Boolean(foundMake);

  return (
    <div className="ws-card ws-panel ws-finder">
      <div className="ws-finder-head">
        <h3 className="ws-card-title">Find parts for my vehicle</h3>
        <div className="ws-segmented ws-segmented--auto ws-finder-tabs" role="tablist" aria-label="How to find your vehicle">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={mode === m.id ? "ws-segmented-tab ws-segmented-tab--active" : "ws-segmented-tab"}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {applied ? (
          <p className="ws-finder-current">
            <span>
              Showing parts for <strong>{applied}</strong>
            </span>
            {onClear ? (
              <button type="button" className="ws-catalog-clear" onClick={onClear}>
                Clear vehicle
              </button>
            ) : null}
          </p>
        ) : (
          <p className="ws-muted ws-finder-lead">
            Enter your registration or choose your car to see parts that fit it.
          </p>
        )}
      </div>

      {mode === "reg" ? (
        <form className="ws-quick-form" onSubmit={submitReg}>
          <label className="ws-stock-field ws-finder-reg" htmlFor={`${idPrefix}-reg`}>
            <span className="ws-stock-label">Registration</span>
            <input
              id={`${idPrefix}-reg`}
              type="text"
              className="ws-reg-input"
              value={reg}
              onChange={(e) => setReg(e.target.value)}
              placeholder="AB12 CDE"
              autoComplete="off"
              maxLength={10}
            />
          </label>
          <button type="submit" className="ws-btn ws-btn--primary" disabled={lookup.status === "loading"}>
            {lookup.status === "loading" ? "Looking up…" : "Find my car"}
          </button>
        </form>
      ) : null}

      {mode === "reg" && (regError || lookup.status === "error") ? (
        <p className="ws-form-error" role="alert">
          {regError || lookup.message}
        </p>
      ) : null}

      {mode === "reg" && lookup.status === "found" ? (
        <div className="ws-finder-result">
          <span className="ws-val-plate">{formatReg(lookup.vehicle?.registration)}</span>
          <span className="ws-finder-result-text">{dvlaSummary(lookup.vehicle)}</span>
          {!foundMake ? (
            <p className="ws-muted ws-finder-lead">
              We specialise in Suzuki and Mitsubishi parts. Call the parts team and we will do our best to
              source it.
            </p>
          ) : null}
        </div>
      ) : null}

      {showSelection ? (
        <form className="ws-quick-form" onSubmit={apply}>
          <div className="ws-quick-fields">
            <div className="ws-stock-field">
              <label className="ws-stock-label" htmlFor={`${idPrefix}-make`}>
                Manufacturer
              </label>
              <WebsiteNativeSelect
                id={`${idPrefix}-make`}
                value={make}
                onChange={(value) => {
                  setMake(value);
                  setModel("");
                }}
                options={MAKE_OPTIONS}
                placeholder=""
              />
            </div>
            <div className="ws-stock-field">
              <label className="ws-stock-label" htmlFor={`${idPrefix}-model`}>
                Model
              </label>
              <WebsiteNativeSelect
                id={`${idPrefix}-model`}
                value={model}
                onChange={setModel}
                options={modelOptions(make)}
                placeholder=""
                disabled={!make}
              />
            </div>
          </div>
          <button type="submit" className="ws-btn ws-btn--primary" disabled={!make}>
            Show parts
          </button>
        </form>
      ) : null}
    </div>
  );
}
