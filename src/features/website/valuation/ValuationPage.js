// file location: src/features/website/valuation/ValuationPage.js
//
// /website/valuation - the "Get your free valuation" journey the Sell Your Car
// block links to.
//
// SHAPE
// -----
// Four short question steps and a result. Registration first, because DVLA can
// answer make, year, fuel and engine size from it and every question we do not
// have to ask is a question that does not lose us the customer. Everything
// after that is tick boxes with Back and Next, one idea per step.
//
//   1. Your vehicle      reg lookup (or manual entry) + mileage
//   2. About it          body type, gearbox, model name (optional)
//   3. Condition         condition, service history, MOT, owners, keys
//   4. Anything to tell us  faults, write-off history, outstanding finance
//   5. Your estimate     a range, the working behind it, and how to book in
//
// HONESTY
// -------
// The number is an estimate produced by src/lib/valuation/vehicleValuation.js
// from segment, age, mileage and the answers - there is no trade book feed
// behind it. The result step says so plainly and pushes the customer towards
// the in-person appraisal, which is the only way to give a firm figure. Do not
// remove the disclaimer or narrow the range to make the page look cleverer.
//
// Styling is entirely custglobal.css (.ws-val-*). No inline visual styling.

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";

import StockShell from "../stock/StockShell";
import useWebsiteContent from "../hooks/useWebsiteContent";
import { ChoiceGroup, TickList } from "./ValuationChoices";
import {
  BODY_TYPES,
  CONDITIONS,
  FINANCE_OPTIONS,
  ISSUES,
  KEY_OPTIONS,
  MOT_OPTIONS,
  OWNER_BANDS,
  SERVICE_HISTORY,
  TRANSMISSIONS,
  WRITE_OFF_OPTIONS,
  estimateValuation,
  formatEffect,
  formatReg,
  isPlausibleReg,
  normaliseReg,
} from "@/lib/valuation/vehicleValuation";

// Answers that are safe to assume so the customer only has to touch the ones
// that actually matter. Everything required is left empty and gated in
// STEPS[n].complete below.
const INITIAL_ANSWERS = {
  registration: "",
  make: "",
  year: "",
  fuelType: "",
  engineCapacity: "",
  colour: "",
  model: "",
  mileage: "",
  bodyType: "",
  transmission: "unsure",
  condition: "",
  serviceHistory: "",
  mot: "",
  owners: "unsure",
  keys: "two",
  issues: [],
  writeOff: "",
  finance: "no",
  dvlaConfirmed: false,
};

const FUEL_OPTIONS = [
  { value: "PETROL", label: "Petrol" },
  { value: "DIESEL", label: "Diesel" },
  { value: "HYBRID ELECTRIC", label: "Hybrid" },
  { value: "PLUG-IN HYBRID", label: "Plug-in hybrid" },
  { value: "ELECTRICITY", label: "Electric" },
  { value: "OTHER", label: "Something else" },
];

// Mileage is the single biggest lever after age, so it is worth catching a
// typo here rather than quoting on 1,000,000 miles.
const MAX_MILEAGE = 500000;

const digitsOnly = (value) => String(value || "").replace(/[^0-9]/g, "");

const hasVehicle = (a) => a.dvlaConfirmed || (Boolean(a.make) && Boolean(a.year));

// DVLA returns the make in block capitals ("VAUXHALL", "MERCEDES-BENZ").
// Shouting it back at the customer reads like an error message, so soften it
// for display only - the estimate engine still matches on the raw value.
const titleCase = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/(^|[\s\-/])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());

const STEPS = [
  { id: "vehicle", title: "Your vehicle", complete: (a) => hasVehicle(a) && a.mileage !== "" },
  { id: "about", title: "About it", complete: (a) => Boolean(a.bodyType) },
  {
    id: "condition",
    title: "Condition",
    complete: (a) => Boolean(a.condition) && Boolean(a.serviceHistory) && Boolean(a.mot),
  },
  { id: "declare", title: "Anything to tell us", complete: (a) => Boolean(a.writeOff) },
];

export default function ValuationPage() {
  const { content } = useWebsiteContent();
  const { contact } = content.siteContent;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [lookup, setLookup] = useState({ status: "idle", message: "" });
  const [manual, setManual] = useState(false);
  // Set when Next is pressed on an incomplete step, so the page explains the
  // block instead of the button silently doing nothing.
  const [blocked, setBlocked] = useState(false);

  const topRef = useRef(null);

  const set = useCallback((patch) => {
    setAnswers((prev) => ({ ...prev, ...patch }));
    setBlocked(false);
  }, []);

  const goTo = useCallback((next) => {
    setStep(next);
    setBlocked(false);
    // The steps differ in height; without this, a long step followed by a short
    // one leaves the customer looking at the footer.
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ---------------------------------------------------------------- lookup --
  const runLookup = useCallback(async () => {
    const reg = normaliseReg(answers.registration);
    if (!isPlausibleReg(reg)) {
      setLookup({ status: "error", message: "Enter a registration, for example AB12 CDE." });
      return;
    }

    setLookup({ status: "loading", message: "" });
    try {
      const res = await fetch("/api/website/valuation/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: reg }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setLookup({
          status: "error",
          message: data.message || "We could not look that up. You can enter the details yourself.",
        });
        return;
      }

      const v = data.vehicle;
      set({
        registration: reg,
        make: v.make || "",
        year: v.year || "",
        fuelType: v.fuelType || "",
        engineCapacity: v.engineCapacity || "",
        colour: v.colour || "",
        dvlaConfirmed: true,
      });
      setManual(false);
      setLookup({ status: "found", message: "" });
    } catch {
      setLookup({
        status: "error",
        message: "We could not reach our lookup service. You can enter the details yourself.",
      });
    }
  }, [answers.registration, set]);

  const startAgain = useCallback(() => {
    setAnswers(INITIAL_ANSWERS);
    setLookup({ status: "idle", message: "" });
    setManual(false);
    goTo(0);
  }, [goTo]);

  // ------------------------------------------------------------- estimate --
  const isResult = step === STEPS.length;
  const estimate = useMemo(
    () => (isResult ? estimateValuation(answers) : null),
    [isResult, answers],
  );

  const vehicleTitle =
    [titleCase(answers.make), answers.model].filter(Boolean).join(" ") || "vehicle";

  const addressLine = (contact?.address || []).filter(Boolean).join(", ");
  const directionsHref = addressLine
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressLine)}`
    : "https://www.google.com/maps/search/?api=1&query=Humphries+and+Parks+West+Malling";

  const next = () => {
    if (!STEPS[step].complete(answers)) {
      setBlocked(true);
      return;
    }
    goTo(step + 1);
  };

  return (
    <StockShell
      backToSite
      title="Free car valuation - Humphries & Parks"
      description="Value your car in under two minutes. Enter your registration, answer a few quick questions and get an instant estimate, then book a free in-person appraisal at Humphries & Parks in West Malling, Kent."
    >
      <section className="ws-section ws-val-hero" ref={topRef}>
        {/* Same narrow container as the panel below, so the heading and the
            first question share a left edge rather than stepping in. */}
        <div className="ws-container ws-val-container">
          <span className="ws-eyebrow">Sell your car</span>
          <h1 className="ws-h1">What is your car worth?</h1>
          <p className="ws-lead">
            Start with your registration and answer a few quick questions. It takes about two
            minutes, there is no obligation, and we buy any make, any age and any mileage.
          </p>
        </div>
      </section>

      <section className="ws-section ws-val-body">
        <div className="ws-container ws-val-container">
          {/* ---------------------------------------------- progress ------ */}
          {!isResult ? (
            <div className="ws-val-progress">
              <ol className="ws-val-steps">
                {STEPS.map((s, i) => (
                  <li
                    key={s.id}
                    className="ws-val-step"
                    data-state={i === step ? "current" : i < step ? "done" : "todo"}
                  >
                    <span className="ws-val-step-n" aria-hidden="true">
                      {i < step ? "✓" : i + 1}
                    </span>
                    <span className="ws-val-step-label">{s.title}</span>
                  </li>
                ))}
              </ol>
              <p className="ws-val-progress-text">
                Step {step + 1} of {STEPS.length}
              </p>
            </div>
          ) : null}

          <div className="ws-card ws-panel ws-val-panel">
            {/* ============================ 1. Your vehicle ============== */}
            {step === 0 ? (
              <>
                <h2 className="ws-h3">Your vehicle</h2>
                <p className="ws-val-hint">
                  We will look up the make, year, fuel and engine size from DVLA so you do not have
                  to type them.
                </p>

                <div className="ws-val-field">
                  <label className="ws-val-label" htmlFor="val-reg">
                    Registration
                  </label>
                  <div className="ws-val-reg-row">
                    <input
                      id="val-reg"
                      type="text"
                      className="ws-val-reg"
                      placeholder="AB12 CDE"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck="false"
                      maxLength={10}
                      value={answers.registration}
                      onChange={(e) => {
                        set({ registration: e.target.value.toUpperCase(), dvlaConfirmed: false });
                        setLookup({ status: "idle", message: "" });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          runLookup();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="ws-btn ws-btn--primary"
                      onClick={runLookup}
                      disabled={lookup.status === "loading"}
                    >
                      {lookup.status === "loading" ? "Looking up…" : "Find my car"}
                    </button>
                  </div>
                </div>

                {lookup.status === "error" ? (
                  <div className="ws-val-notice" role="status">
                    <p>{lookup.message}</p>
                    {!manual ? (
                      <button
                        type="button"
                        className="ws-btn ws-btn--ghost"
                        onClick={() => setManual(true)}
                      >
                        Enter the details myself
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {answers.dvlaConfirmed ? (
                  <div className="ws-val-found" role="status">
                    <span className="ws-val-plate">{formatReg(answers.registration)}</span>
                    <div className="ws-val-found-body">
                      <p className="ws-val-found-title">
                        {[titleCase(answers.make), answers.year].filter(Boolean).join(" · ")}
                      </p>
                      <p className="ws-muted">
                        {[
                          titleCase(answers.colour),
                          titleCase(answers.fuelType),
                          answers.engineCapacity ? `${answers.engineCapacity}cc` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ws-val-link"
                      onClick={() => {
                        set({ dvlaConfirmed: false });
                        setManual(true);
                      }}
                    >
                      Not your car?
                    </button>
                  </div>
                ) : null}

                {manual && !answers.dvlaConfirmed ? (
                  <div className="ws-val-manual">
                    <div className="ws-val-grid-2">
                      <div className="ws-val-field">
                        <label className="ws-val-label" htmlFor="val-make">
                          Make
                        </label>
                        <input
                          id="val-make"
                          type="text"
                          placeholder="Suzuki"
                          value={answers.make}
                          onChange={(e) => set({ make: e.target.value })}
                        />
                      </div>
                      <div className="ws-val-field">
                        <label className="ws-val-label" htmlFor="val-year">
                          Year first registered
                        </label>
                        <input
                          id="val-year"
                          type="number"
                          inputMode="numeric"
                          min="1900"
                          max={new Date().getFullYear()}
                          placeholder="2019"
                          value={answers.year}
                          onChange={(e) => set({ year: e.target.value })}
                        />
                      </div>
                    </div>
                    <ChoiceGroup
                      legend="Fuel"
                      options={FUEL_OPTIONS}
                      value={answers.fuelType}
                      onChange={(value) => set({ fuelType: value })}
                      columns="two"
                    />
                  </div>
                ) : null}

                <div className="ws-val-field">
                  <label className="ws-val-label" htmlFor="val-mileage">
                    Current mileage
                  </label>
                  <input
                    id="val-mileage"
                    type="text"
                    inputMode="numeric"
                    placeholder="48,000"
                    value={answers.mileage === "" ? "" : Number(answers.mileage).toLocaleString("en-GB")}
                    onChange={(e) => {
                      const raw = digitsOnly(e.target.value);
                      if (raw === "") {
                        set({ mileage: "" });
                        return;
                      }
                      set({ mileage: String(Math.min(MAX_MILEAGE, Number(raw))) });
                    }}
                  />
                  <p className="ws-val-hint">Roughly is fine. We check it properly when you visit.</p>
                </div>
              </>
            ) : null}

            {/* ============================ 2. About it =================== */}
            {step === 1 ? (
              <>
                <h2 className="ws-h3">About it</h2>
                <p className="ws-val-hint">
                  DVLA does not tell us the model, so this is the one bit we have to ask.
                </p>

                <ChoiceGroup
                  legend="Which of these is closest?"
                  options={BODY_TYPES}
                  value={answers.bodyType}
                  onChange={(value) => set({ bodyType: value })}
                  columns="two"
                />

                <ChoiceGroup
                  legend="Gearbox"
                  options={TRANSMISSIONS}
                  value={answers.transmission}
                  onChange={(value) => set({ transmission: value })}
                  columns="two"
                />

                <div className="ws-val-field">
                  <label className="ws-val-label" htmlFor="val-model">
                    Model and trim <span className="ws-val-optional">optional</span>
                  </label>
                  <input
                    id="val-model"
                    type="text"
                    placeholder="Vitara SZ5 Allgrip"
                    value={answers.model}
                    onChange={(e) => set({ model: e.target.value })}
                  />
                  <p className="ws-val-hint">
                    Helps us sharpen the figure when we come back to you, but you can skip it.
                  </p>
                </div>
              </>
            ) : null}

            {/* ============================ 3. Condition ================== */}
            {step === 2 ? (
              <>
                <h2 className="ws-h3">Condition and history</h2>
                <p className="ws-val-hint">
                  Be straight with us here. An honest answer now means the figure we give you in
                  person matches the one on this page.
                </p>

                <ChoiceGroup
                  legend="Overall condition"
                  options={CONDITIONS}
                  value={answers.condition}
                  onChange={(value) => set({ condition: value })}
                />

                <ChoiceGroup
                  legend="Service history"
                  options={SERVICE_HISTORY}
                  value={answers.serviceHistory}
                  onChange={(value) => set({ serviceHistory: value })}
                  columns="two"
                />

                <ChoiceGroup
                  legend="MOT"
                  options={MOT_OPTIONS}
                  value={answers.mot}
                  onChange={(value) => set({ mot: value })}
                  columns="two"
                />

                <ChoiceGroup
                  legend="How many owners has it had?"
                  options={OWNER_BANDS}
                  value={answers.owners}
                  onChange={(value) => set({ owners: value })}
                  columns="two"
                />

                <ChoiceGroup
                  legend="Keys"
                  options={KEY_OPTIONS}
                  value={answers.keys}
                  onChange={(value) => set({ keys: value })}
                  columns="two"
                />
              </>
            ) : null}

            {/* ============================ 4. Declare ==================== */}
            {step === 3 ? (
              <>
                <h2 className="ws-h3">Anything we should know?</h2>
                <p className="ws-val-hint">
                  Tick anything that applies. Nothing here stops us buying your car, it just keeps
                  the estimate realistic.
                </p>

                <TickList
                  legend="Tick anything that applies"
                  options={ISSUES}
                  value={answers.issues}
                  onChange={(value) => set({ issues: value })}
                />

                <ChoiceGroup
                  legend="Has it ever been written off by an insurer?"
                  options={WRITE_OFF_OPTIONS}
                  value={answers.writeOff}
                  onChange={(value) => set({ writeOff: value })}
                  columns="two"
                />

                <ChoiceGroup
                  legend="Is there finance outstanding on it?"
                  hint="We settle finance directly with the lender, so this does not stop a sale."
                  options={FINANCE_OPTIONS}
                  value={answers.finance}
                  onChange={(value) => set({ finance: value })}
                  columns="two"
                />
              </>
            ) : null}

            {/* ============================ 5. Result ===================== */}
            {isResult ? (
              <>
                {estimate?.ok ? (
                  <>
                    <span className="ws-eyebrow">Your estimate</span>
                    <h2 className="ws-h2 ws-val-figure">
                      {estimate.lowLabel} <span aria-hidden="true">&ndash;</span>
                      <span className="ws-sr-only">to</span> {estimate.highLabel}
                    </h2>
                    <p className="ws-val-figure-sub">
                      Estimated for your{" "}
                      {answers.year ? `${answers.year} ` : ""}
                      {vehicleTitle}
                      {answers.registration ? ` (${formatReg(answers.registration)})` : ""} at{" "}
                      {Number(answers.mileage || 0).toLocaleString("en-GB")} miles.
                    </p>

                    <div className="ws-val-disclaimer">
                      <p>
                        <strong>This is an estimate, not an offer.</strong> It is worked out from
                        your answers and typical market values for a vehicle of this type, age and
                        mileage. We can only give you a firm, 100% accurate figure once we have seen
                        the car in person, which takes about twenty minutes and costs you nothing.
                      </p>
                    </div>

                    <div className="ws-val-cta">
                      <a
                        className="ws-btn ws-btn--primary"
                        href={directionsHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Get directions to us
                      </a>
                      <a className="ws-btn ws-btn--ghost" href={contact?.phoneHref || "tel:01732870711"}>
                        Call {contact?.phone || "01732 870711"}
                      </a>
                    </div>
                    <p className="ws-val-cta-note">
                      No appointment needed. Pop in during opening hours, or call if you would rather
                      run through a few more questions first.
                    </p>

                    {estimate.factors.length ? (
                      <div className="ws-val-working">
                        <h3 className="ws-val-working-title">What moved your estimate</h3>
                        <ul className="ws-val-working-list">
                          {estimate.factors.map((factor) => (
                            <li key={factor.label} data-direction={factor.effect > 0 ? "up" : "down"}>
                              <span className="ws-val-working-label">
                                {factor.label}
                                {factor.detail ? (
                                  <span className="ws-val-working-detail">{factor.detail}</span>
                                ) : null}
                              </span>
                              <span className="ws-val-working-effect">{formatEffect(factor.effect)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {estimate.notes.length ? (
                      <ul className="ws-ticks ws-val-notes">
                        {estimate.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="ws-val-visit">
                      <h3 className="ws-val-working-title">Where to find us</h3>
                      <p className="ws-muted">{addressLine}</p>
                      {contact?.salesHours?.length ? (
                        <ul className="ws-val-hours">
                          {contact.salesHours.map((row) => (
                            <li key={row.days}>
                              <span>{row.days}</span>
                              <span>{row.time}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="ws-h3">We need a little more</h2>
                    <p className="ws-muted">
                      {estimate?.reason || "Go back and finish the questions and we will work it out."}
                    </p>
                  </>
                )}

                <div className="ws-val-nav">
                  <button type="button" className="ws-btn ws-btn--ghost" onClick={() => goTo(STEPS.length - 1)}>
                    Change my answers
                  </button>
                  <button type="button" className="ws-val-link" onClick={startAgain}>
                    Value another vehicle
                  </button>
                </div>

                <p className="ws-val-foot">
                  Not selling yet?{" "}
                  <Link href="/website/available-stock">Browse our available stock</Link> or{" "}
                  <Link href="/website#contact">get in touch</Link>.
                </p>
              </>
            ) : null}

            {/* ---------------------------------------------- step nav ---- */}
            {!isResult ? (
              <>
                {blocked ? (
                  <p className="ws-val-blocked" role="alert">
                    {step === 0
                      ? "Look up your registration (or enter the details yourself) and add your mileage to carry on."
                      : "Pick an answer for each question above to carry on."}
                  </p>
                ) : null}

                <div className="ws-val-nav">
                  {step > 0 ? (
                    <button type="button" className="ws-btn ws-btn--ghost" onClick={() => goTo(step - 1)}>
                      Back
                    </button>
                  ) : (
                    <Link href="/website#sell" className="ws-btn ws-btn--ghost">
                      Back to the site
                    </Link>
                  )}
                  <button type="button" className="ws-btn ws-btn--primary" onClick={next}>
                    {step === STEPS.length - 1 ? "See my estimate" : "Next"}
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <p className="ws-val-smallprint">
            Estimates are indicative only and are not an offer to purchase. A firm figure is given
            after a physical appraisal and a history check. Proof of identity, address and ownership
            is required before we can buy any vehicle.
          </p>
        </div>
      </section>
    </StockShell>
  );
}
