// file location: src/features/website/components/QuickActions.js
// The customer actions in the /website hero.
//
// Three large choices, each a shortcut into a full customer journey. The
// selected choice decides what the panel beneath shows:
//
//   Find a car       new / used, make, model, price -> /website/available-stock
//                    with those filters in the query (condition travels as
//                    `filter`, make as the free-text `q`, which the stock
//                    search already matches against make).
//   Book workshop    what needs doing + reg -> /website/request-appointment,
//                    prefilled, where the contact details are collected.
//   Value my car     reg + optional mileage -> a rough DVLA-based estimate right
//                    here, then "Improve my estimate" hands the reg to
//                    /website/valuation.
//
// The rough estimate uses the same engine as the wizard with middle-of-the-road
// assumptions (hatchback, good condition, and average mileage unless the
// visitor typed one). It is labelled as rough on purpose — the wizard is where
// it gets accurate.
//
// The choices are an ARIA tablist: one tab stop, arrow keys / Home / End move
// between them. Styling is custglobal.css only (.ws-quick-* plus the shared
// .ws-stock-field, .ws-reg-input and .ws-val-plate).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import WebsiteIcon from "./WebsiteIcon";
import WebsiteNativeSelect from "./WebsiteNativeSelect";
import { listStock, PRICE_BANDS } from "@/lib/stock/vehicleStock";
import {
  estimateValuation,
  formatReg,
  isPlausibleReg,
  normaliseReg,
} from "@/lib/valuation/vehicleValuation";

const CHOICES = [
  { id: "find", label: "Find a car", hint: "New & used stock", icon: "search" },
  { id: "workshop", label: "Book workshop", hint: "Service, MOT & repairs", icon: "wrench" },
  { id: "value", label: "Value my car", hint: "Free instant estimate", icon: "pound" },
];

const CONDITIONS = [
  { value: "", label: "New & used" },
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
];

// Arrow / Home / End -> index of the choice to move to, or undefined.
const nextChoiceIndex = (key, index, last) =>
  ({
    ArrowRight: index === last ? 0 : index + 1,
    ArrowDown: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    ArrowUp: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  })[key];

const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean))).sort();
const withAny = (values, label) => [{ value: "", label }, ...values.map((v) => ({ value: v, label: v }))];

// "45,000 miles" -> 45000. Empty or unreadable input -> null (use average).
const parseMileage = (value) => {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
};

function ViewHead({ title, lead }) {
  return (
    <div className="ws-quick-view-head">
      <h2 className="ws-quick-view-title">{title}</h2>
      {lead ? <p className="ws-quick-view-lead">{lead}</p> : null}
    </div>
  );
}

export default function QuickActions() {
  const router = useRouter();
  const [tab, setTab] = useState("find");

  const onChoiceKeyDown = (event) => {
    const index = CHOICES.findIndex((c) => c.id === tab);
    const next = nextChoiceIndex(event.key, index, CHOICES.length - 1);
    if (next === undefined) return;
    event.preventDefault();
    setTab(CHOICES[next].id);
    document.getElementById(`quick-choice-${CHOICES[next].id}`)?.focus();
  };

  /* ---------------------------------------------------------- find a car -- */
  const stock = useMemo(() => listStock(), []);
  const [condition, setCondition] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  // Makes follow the condition and models follow the make, so the visitor
  // cannot pick a combination that is guaranteed to return nothing.
  const inCondition = useMemo(
    () => stock.filter((v) => !condition || v.condition === condition),
    [stock, condition],
  );
  const makes = useMemo(() => uniqueSorted(inCondition.map((v) => v.make)), [inCondition]);
  const models = useMemo(
    () => uniqueSorted(inCondition.filter((v) => !make || v.make === make).map((v) => v.model)),
    [inCondition, make],
  );

  const searchStock = (event) => {
    event.preventDefault();
    const query = {};
    if (condition) query.filter = condition;
    if (make) query.q = make;
    if (model) query.model = model;
    if (price) query.price = price;
    router.push({ pathname: "/website/available-stock", query });
  };

  /* ------------------------------------------------------------ workshop -- */
  const [request, setRequest] = useState("");
  const [workshopReg, setWorkshopReg] = useState("");

  const requestAppointment = (event) => {
    event.preventDefault();
    const query = {};
    if (request.trim()) query.request = request.trim();
    if (normaliseReg(workshopReg)) query.reg = normaliseReg(workshopReg);
    router.push({ pathname: "/website/request-appointment", query });
  };

  /* ----------------------------------------------------------- valuation -- */
  const [valueReg, setValueReg] = useState("");
  const [valueMileage, setValueMileage] = useState("");
  const [valuation, setValuation] = useState({ status: "idle", message: "", estimate: null, vehicle: null });

  const resetValuation = () => setValuation({ status: "idle", message: "", estimate: null, vehicle: null });

  const roughValuation = async (event) => {
    event.preventDefault();
    const reg = normaliseReg(valueReg);
    if (!isPlausibleReg(reg)) {
      setValuation({ status: "error", message: "Enter a registration, for example AB12 CDE.", estimate: null, vehicle: null });
      return;
    }
    setValuation({ status: "loading", message: "", estimate: null, vehicle: null });
    try {
      const res = await fetch("/api/website/valuation/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: reg }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setValuation({
          status: "error",
          message: data.message || "We could not look that up. Try the full valuation instead.",
          estimate: null,
          vehicle: null,
        });
        return;
      }
      const v = data.vehicle;
      const age = Math.max(0, new Date().getFullYear() - Number(v.year));
      const mileage = parseMileage(valueMileage);
      const estimate = estimateValuation({
        make: v.make,
        year: v.year,
        fuelType: v.fuelType,
        engineCapacity: v.engineCapacity,
        bodyType: "hatch",
        // The visitor's mileage when given; otherwise average for its age, so
        // mileage neither helps nor hurts.
        mileage: mileage ?? Math.max(3000, 9000 * age),
        condition: "good",
        transmission: "unsure",
        owners: "unsure",
        writeOff: "none",
        dvlaConfirmed: true,
      });
      if (!estimate.ok) {
        setValuation({ status: "error", message: estimate.reason, estimate: null, vehicle: null });
        return;
      }
      setValuation({ status: "done", message: "", estimate, vehicle: { ...v, registration: reg, mileage } });
    } catch {
      setValuation({
        status: "error",
        message: "We could not reach our lookup service. Try the full valuation instead.",
        estimate: null,
        vehicle: null,
      });
    }
  };

  const improveHref = {
    pathname: "/website/valuation",
    query: normaliseReg(valueReg) ? { reg: normaliseReg(valueReg) } : {},
  };

  // Every view is always rendered, stacked in one grid cell; only the active
  // one is visible. The panel is therefore always the height of the tallest
  // view, so switching choices or getting an estimate never resizes it.
  const valueView = valuation.status === "done" || valuation.status === "error" ? "result" : "form";
  const viewProps = (choiceId, active) => ({
    className: "ws-quick-view",
    "data-active": active ? "true" : "false",
    inert: !active,
    ...(choiceId
      ? { id: `quick-panel-${choiceId}`, role: "tabpanel", "aria-labelledby": `quick-choice-${choiceId}` }
      : {}),
  });
  // When no estimate is showing, the result view is filled with deliberately
  // long sample content so it still reserves the space a real result needs.
  const shown = valuation.status === "done" ? valuation : null;
  const resultReg = shown ? formatReg(shown.vehicle.registration) : "AB12 CDE";
  const resultRange = shown ? `${shown.estimate.lowLabel} – ${shown.estimate.highLabel}` : "£00,000 – £00,000";
  const resultCar = shown ? `${shown.vehicle.year} ${shown.vehicle.make}` : "2020 Mitsubishi";
  const resultMiles =
    shown && shown.vehicle.mileage != null
      ? `${shown.vehicle.mileage.toLocaleString("en-GB")} miles`
      : shown
        ? "average mileage"
        : "123,456 miles";

  return (
    <div className="ws-quick">
      <div className="ws-quick-choices" role="tablist" aria-label="What would you like to do?">
        {CHOICES.map((c) => {
          const selected = tab === c.id;
          return (
            <button
              key={c.id}
              id={`quick-choice-${c.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`quick-panel-${c.id}`}
              tabIndex={selected ? 0 : -1}
              className={selected ? "ws-quick-choice ws-quick-choice--active" : "ws-quick-choice"}
              onClick={() => setTab(c.id)}
              onKeyDown={onChoiceKeyDown}
            >
              <span className="ws-icon-badge">
                <WebsiteIcon name={c.icon} />
              </span>
              <span className="ws-quick-choice-text">
                <span className="ws-quick-choice-label">{c.label}</span>
                <span className="ws-quick-choice-hint">{c.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="ws-card ws-panel ws-quick-panel">
        <div className="ws-quick-views">
          <div {...viewProps("find", tab === "find")}>
            <ViewHead
              title="Search our stock"
              lead={stock.length ? `${stock.length} new and used cars ready to view in West Malling.` : null}
            />
            <form className="ws-quick-form" onSubmit={searchStock}>
              <div className="ws-quick-fields">
                <div className="ws-stock-field">
                  <span className="ws-stock-label">Condition</span>
                  <WebsiteNativeSelect
                    value={condition}
                    onChange={(value) => {
                      setCondition(value);
                      setMake("");
                      setModel("");
                    }}
                    options={CONDITIONS}
                    placeholder=""
                    aria-label="Condition"
                  />
                </div>
                <div className="ws-stock-field">
                  <span className="ws-stock-label">Make</span>
                  <WebsiteNativeSelect
                    value={make}
                    onChange={(value) => {
                      setMake(value);
                      setModel("");
                    }}
                    options={withAny(makes, "Any make")}
                    placeholder=""
                    aria-label="Make"
                  />
                </div>
                <div className="ws-stock-field">
                  <span className="ws-stock-label">Model</span>
                  <WebsiteNativeSelect
                    value={model}
                    onChange={setModel}
                    options={withAny(models, "Any model")}
                    placeholder=""
                    aria-label="Model"
                  />
                </div>
                <div className="ws-stock-field">
                  <span className="ws-stock-label">Price</span>
                  <WebsiteNativeSelect
                    value={price}
                    onChange={setPrice}
                    options={[{ value: "", label: "Any price" }, ...PRICE_BANDS.map((b) => ({ value: b.value, label: b.label }))]}
                    placeholder=""
                    aria-label="Price"
                  />
                </div>
              </div>
              <button type="submit" className="ws-btn ws-btn--primary">
                Search cars
              </button>
            </form>
          </div>

          <div {...viewProps("workshop", tab === "workshop")}>
            <ViewHead title="Book the workshop" lead="Tell us what your car needs and we will confirm a time." />
            <form className="ws-quick-form" onSubmit={requestAppointment}>
              <label className="ws-stock-field" htmlFor="quick-request">
                <span className="ws-stock-label">What do you need?</span>
                <textarea
                  id="quick-request"
                  rows={1}
                  wrap="off"
                  placeholder="Service, MOT, a warning light…"
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                />
              </label>
              <label className="ws-stock-field" htmlFor="quick-workshop-reg">
                <span className="ws-stock-label">Registration</span>
                <input
                  id="quick-workshop-reg"
                  type="text"
                  className="ws-reg-input"
                  placeholder="AB12 CDE"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck="false"
                  maxLength={10}
                  value={workshopReg}
                  onChange={(e) => setWorkshopReg(e.target.value.toUpperCase())}
                />
              </label>
              <button type="submit" className="ws-btn ws-btn--primary">
                Request appointment
              </button>
            </form>
          </div>

          <div {...viewProps("value", tab === "value" && valueView === "form")}>
            <ViewHead title="What is my car worth?" lead="Enter your registration for a free rough estimate in seconds." />
            <form className="ws-quick-form" onSubmit={roughValuation}>
              <label className="ws-stock-field" htmlFor="quick-value-reg">
                <span className="ws-stock-label">Registration</span>
                <input
                  id="quick-value-reg"
                  type="text"
                  className="ws-reg-input"
                  placeholder="AB12 CDE"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck="false"
                  maxLength={10}
                  value={valueReg}
                  onChange={(e) => {
                    setValueReg(e.target.value.toUpperCase());
                    resetValuation();
                  }}
                />
              </label>
              <label className="ws-stock-field" htmlFor="quick-value-mileage">
                <span className="ws-stock-label">Mileage</span>
                <input
                  id="quick-value-mileage"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 45,000"
                  autoComplete="off"
                  maxLength={9}
                  value={valueMileage}
                  onChange={(e) => {
                    setValueMileage(e.target.value.replace(/[^\d,]/g, ""));
                    resetValuation();
                  }}
                />
              </label>
              <button
                type="submit"
                className="ws-btn ws-btn--primary"
                disabled={valuation.status === "loading"}
              >
                {valuation.status === "loading" ? "Checking…" : "Get estimate"}
              </button>
            </form>
          </div>

          <div {...viewProps(null, tab === "value" && valueView === "result")} role="status" aria-live="polite">
            <div className="ws-quick-result">
              {valuation.status === "error" ? (
                <p className="ws-muted">{valuation.message}</p>
              ) : (
                <>
                  <div className="ws-quick-result-head">
                    <span className="ws-val-plate">{resultReg}</span>
                    <p className="ws-quick-result-range">{resultRange}</p>
                  </div>
                  <p className="ws-muted">
                    A rough guide for a {resultCar} in good condition with {resultMiles}.
                  </p>
                </>
              )}
              <div className="ws-quick-actions">
                <Link href={improveHref} className="ws-btn ws-btn--ghost">
                  {valuation.status === "error" ? "Start the full valuation" : "Improve my estimate"}
                </Link>
                <button type="button" onClick={resetValuation}>
                  {valuation.status === "error" ? "Try again" : "Value another car"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
