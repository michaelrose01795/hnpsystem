// file location: src/features/website/components/QuickActions.js
// The "quick actions" panel that shares the brand strip row on /website.
//
// Three tabs, each a shortcut into a full customer journey:
//
//   Find a car       make / model / price -> /website/available-stock with those
//                    filters in the query (make travels as the free-text `q`,
//                    which the stock search already matches against make).
//   Book workshop    what needs doing + reg -> /website/request-appointment,
//                    prefilled, where the contact details are collected.
//   Value my car     reg -> a rough DVLA-based estimate right here, then
//                    "Improve my estimate" hands the reg to /website/valuation.
//
// The rough estimate uses the same engine as the wizard with middle-of-the-road
// assumptions (hatchback, average mileage, good condition). It is labelled as
// rough on purpose — the wizard is where it gets accurate.
//
// Styling is custglobal.css only (.ws-quick-* plus shared .ws-* / .ws-val-*).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import WebsiteNativeSelect from "./WebsiteNativeSelect";
import { listStock, PRICE_BANDS } from "@/lib/stock/vehicleStock";
import {
  estimateValuation,
  formatReg,
  isPlausibleReg,
  normaliseReg,
} from "@/lib/valuation/vehicleValuation";

const TABS = [
  { id: "find", label: "Find a car" },
  { id: "workshop", label: "Book workshop" },
  { id: "value", label: "Value my car" },
];

const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean))).sort();
const withAny = (values, label) => [{ value: "", label }, ...values.map((v) => ({ value: v, label: v }))];

export default function QuickActions() {
  const router = useRouter();
  const [tab, setTab] = useState("find");

  /* ---------------------------------------------------------- find a car -- */
  const stock = useMemo(() => listStock(), []);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const makes = useMemo(() => uniqueSorted(stock.map((v) => v.make)), [stock]);
  // Models follow the chosen make so the visitor cannot pick a combination
  // that is guaranteed to return nothing.
  const models = useMemo(
    () => uniqueSorted(stock.filter((v) => !make || v.make === make).map((v) => v.model)),
    [stock, make],
  );

  const searchStock = (event) => {
    event.preventDefault();
    const query = {};
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
  const [valuation, setValuation] = useState({ status: "idle", message: "", estimate: null, vehicle: null });

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
      const estimate = estimateValuation({
        make: v.make,
        year: v.year,
        fuelType: v.fuelType,
        engineCapacity: v.engineCapacity,
        bodyType: "hatch",
        // Average mileage for its age, so mileage neither helps nor hurts.
        mileage: Math.max(3000, 9000 * age),
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
      setValuation({ status: "done", message: "", estimate, vehicle: { ...v, registration: reg } });
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

  return (
    <div className="ws-card ws-panel ws-quick-panel">
      <div className="ws-tabs ws-quick-tabs" role="tablist" aria-label="Quick actions">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "ws-tab ws-tab--active" : "ws-tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "find" ? (
        <form className="ws-quick-form" onSubmit={searchStock}>
          <div className="ws-quick-fields">
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
            Search
          </button>
        </form>
      ) : null}

      {tab === "workshop" ? (
        <form className="ws-quick-form" onSubmit={requestAppointment}>
          <label className="ws-stock-field" htmlFor="quick-request">
            <span className="ws-stock-label">What do you need?</span>
            <textarea
              id="quick-request"
              rows={3}
              placeholder="Service, MOT, a warning light, a noise from the front…"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
            />
          </label>
          <label className="ws-stock-field" htmlFor="quick-workshop-reg">
            <span className="ws-stock-label">Registration</span>
            <input
              id="quick-workshop-reg"
              type="text"
              className="ws-val-reg"
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
      ) : null}

      {tab === "value" ? (
        <form className="ws-quick-form" onSubmit={roughValuation}>
          <label className="ws-stock-field" htmlFor="quick-value-reg">
            <span className="ws-stock-label">Registration</span>
            <div className="ws-val-reg-row">
              <input
                id="quick-value-reg"
                type="text"
                className="ws-val-reg"
                placeholder="AB12 CDE"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck="false"
                maxLength={10}
                value={valueReg}
                onChange={(e) => {
                  setValueReg(e.target.value.toUpperCase());
                  setValuation({ status: "idle", message: "", estimate: null, vehicle: null });
                }}
              />
              <button
                type="submit"
                className="ws-btn ws-btn--primary"
                disabled={valuation.status === "loading"}
              >
                {valuation.status === "loading" ? "Checking…" : "Get estimate"}
              </button>
            </div>
          </label>

          {valuation.status === "error" ? (
            <p className="ws-muted" role="status">
              {valuation.message}
            </p>
          ) : null}

          {valuation.status === "done" ? (
            <div className="ws-quick-result" role="status">
              <span className="ws-val-plate">{formatReg(valuation.vehicle.registration)}</span>
              <p className="ws-quick-result-range">
                {valuation.estimate.lowLabel} – {valuation.estimate.highLabel}
              </p>
              <p className="ws-muted">
                A rough guide for a {valuation.vehicle.year} {valuation.vehicle.make} in good condition with
                average mileage. Answer a few more questions for a better figure.
              </p>
            </div>
          ) : null}

          {valuation.status === "done" || valuation.status === "error" ? (
            <Link href={improveHref} className="ws-btn ws-btn--ghost">
              {valuation.status === "done" ? "Improve my estimate" : "Start the full valuation"}
            </Link>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
