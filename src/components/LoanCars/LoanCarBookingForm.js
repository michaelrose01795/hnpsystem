// file location: src/components/LoanCars/LoanCarBookingForm.js
//
// One booking form for New loan booking, Quick add and Edit.
//
//   variant "quick"  the copy-from-the-external-system workflow: find the job
//                    or customer in the DMS, pick the car and times, paste the
//                    external reference, save (or save and add another). The
//                    rest of the fields sit behind "More details".
//   variant "full"   every field visible.
//
// Overlaps are caught twice: instantly against the bookings already on screen,
// and authoritatively by the API (409), which also returns the cars that are
// free for the same window. Either way the form offers those alternatives as
// one-tap switches.

import { useEffect, useMemo, useRef, useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import { Button, InputField } from "@/components/ui";
import StatusMessage from "@/components/ui/StatusMessage";
import { CalendarField } from "@/components/ui/calendarAPI";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import {
  describeConflict,
  findAlternativeCars,
  findBookingConflicts,
  formatDayLabel,
  validateBookingWindow,
} from "@/features/loanCars/loanCarModel";
import { loanCarApi } from "@/hooks/useLoanCarSchedule";

export const EMPTY_BOOKING_DRAFT = Object.freeze({
  loanCarId: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  externalReference: "",
  jobId: null,
  jobNumber: "",
  customerId: null,
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerAddress: "",
  customerPostcode: "",
  vehicleReg: "",
  vehicleMakeModel: "",
  mileage: "",
  insuranceProvider: "",
  insurancePolicyNumber: "",
  licenceNumber: "",
  dateOfBirth: "",
  notes: "",
});

const LOOKUP_FIELDS = [
  "jobId",
  "jobNumber",
  "customerId",
  "customerName",
  "customerEmail",
  "customerPhone",
  "customerAddress",
  "customerPostcode",
  "vehicleReg",
  "vehicleMakeModel",
  "mileage",
  "insuranceProvider",
  "insurancePolicyNumber",
];

const CUSTOMER_FIELDS = [
  { key: "customerName", label: "Customer name" },
  { key: "customerPhone", label: "Phone", type: "tel" },
  { key: "jobNumber", label: "Job number" },
  { key: "vehicleReg", label: "Customer vehicle reg", upper: true },
];

const MORE_FIELDS = [
  { key: "customerEmail", label: "Email", type: "email" },
  { key: "vehicleMakeModel", label: "Customer vehicle" },
  { key: "customerAddress", label: "Address" },
  { key: "customerPostcode", label: "Postcode", upper: true },
  { key: "mileage", label: "Customer vehicle mileage", type: "number" },
  { key: "insuranceProvider", label: "Insurance provider" },
  { key: "insurancePolicyNumber", label: "Policy number" },
  { key: "licenceNumber", label: "Licence number", upper: true },
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
];

const toEditable = (booking) =>
  Object.keys(EMPTY_BOOKING_DRAFT).reduce((draft, key) => {
    draft[key] = booking?.[key] ?? EMPTY_BOOKING_DRAFT[key];
    return draft;
  }, {});

function Field({ field, value, onChange }) {
  if (field.type === "date") {
    return <CalendarField label={field.label} value={value || ""} onValueChange={onChange} placeholder="Choose date" />;
  }
  return (
    <InputField
      label={field.label}
      type={field.type || "text"}
      value={value ?? ""}
      onChange={(event) => onChange(field.upper ? event.target.value.toUpperCase() : event.target.value)}
    />
  );
}

function LookupResults({ results, onPick }) {
  if (results.length === 0) return null;
  return (
    <div className="loan-car-lookup" role="listbox" aria-label="Matching DMS records">
      {results.map((result) => (
        <button key={result.key} type="button" role="option" aria-selected="false" className="loan-car-lookup__result" onClick={() => onPick(result)}>
          <span className="loan-car-lookup__primary">
            {result.jobNumber ? `#${result.jobNumber} · ` : ""}
            {result.customerName || "Customer"}
          </span>
          <span className="loan-car-lookup__secondary">
            {[result.vehicleReg, result.vehicleMakeModel, result.customerPhone].filter(Boolean).join(" · ") || "No vehicle on record"}
            {result.appointmentDate ? ` · booked in ${formatDayLabel(result.appointmentDate)} ${result.appointmentTime}` : ""}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function LoanCarBookingForm({
  formId,
  variant = "quick",
  booking = null,
  initialDraft = null,
  cars,
  bookings,
  periods,
  onSaved,
  onBusyChange,
}) {
  const isEdit = Boolean(booking?.bookingId);
  const [draft, setDraft] = useState(() => ({ ...EMPTY_BOOKING_DRAFT, ...toEditable(booking || initialDraft || {}) }));
  const [showMore, setShowMore] = useState(variant === "full");
  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupState, setLookupState] = useState("idle");
  const [serverConflict, setServerConflict] = useState(null);
  const [message, setMessage] = useState(null);
  const lookupRequestRef = useRef(0);
  const firstFieldRef = useRef(null);

  // Start in the DMS search — the first thing anyone copying a booking does.
  // Deferred a frame so the drawer's portal has attached before focusing.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => firstFieldRef.current?.querySelector("input")?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Debounced DMS lookup.
  useEffect(() => {
    const term = lookupTerm.trim();
    if (term.length < 2) {
      setLookupResults([]);
      setLookupState("idle");
      return undefined;
    }
    const requestId = ++lookupRequestRef.current;
    setLookupState("loading");
    const timer = window.setTimeout(async () => {
      try {
        const data = await loanCarApi.lookup(term);
        if (requestId !== lookupRequestRef.current) return;
        setLookupResults(data?.results || []);
        setLookupState((data?.results || []).length ? "done" : "empty");
      } catch {
        if (requestId === lookupRequestRef.current) setLookupState("error");
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [lookupTerm]);

  const update = (key, value) => {
    setServerConflict(null);
    setMessage(null);
    setDraft((current) => {
      const next = { ...current, [key]: value };
      // Keep the end on or after the start when the start moves past it.
      if (key === "startDate" && value && (!current.endDate || current.endDate < value)) next.endDate = value;
      return next;
    });
  };

  const applyLookup = (result) => {
    setDraft((current) => {
      const next = { ...current };
      for (const key of LOOKUP_FIELDS) {
        if (result[key] !== undefined && result[key] !== null && result[key] !== "") next[key] = result[key];
      }
      // The job's appointment is the natural start of the loan.
      if (!current.startDate && result.appointmentDate) {
        next.startDate = result.appointmentDate;
        next.endDate = current.endDate && current.endDate >= result.appointmentDate ? current.endDate : result.appointmentDate;
        if (!current.startTime && result.appointmentTime) next.startTime = result.appointmentTime;
      }
      return next;
    });
    setLookupTerm("");
    setLookupResults([]);
    setMessage({ tone: "success", text: `Filled from ${result.jobNumber ? `job #${result.jobNumber}` : "the customer record"}.` });
  };

  const carOptions = useMemo(
    () => cars.map((car) => ({ value: car.loanCarId, label: car.makeModel ? `${car.reg} · ${car.makeModel}` : car.reg })),
    [cars]
  );

  const candidate = { ...draft, endDate: draft.endDate || draft.startDate, bookingId: booking?.bookingId };
  const windowError = draft.loanCarId && draft.startDate ? validateBookingWindow(candidate) : "";
  const localConflicts = useMemo(
    () => (windowError || !draft.loanCarId || !draft.startDate ? [] : findBookingConflicts(candidate, { bookings, periods })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.loanCarId, draft.startDate, draft.endDate, draft.startTime, draft.endTime, windowError, bookings, periods]
  );
  const localAlternatives = useMemo(
    () => (localConflicts.length ? findAlternativeCars(candidate, { cars, bookings, periods }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localConflicts, cars, bookings, periods]
  );

  const conflictLines = serverConflict
    ? serverConflict.conflicts.map((conflict) => conflict.description)
    : localConflicts.map(describeConflict);
  const alternatives = serverConflict
    ? serverConflict.alternatives
    : localAlternatives.map((car) => ({ loanCarId: car.loanCarId, reg: car.reg, makeModel: car.makeModel }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const intent = event.nativeEvent?.submitter?.value || "save";
    const invalid = validateBookingWindow(candidate);
    if (invalid) {
      setMessage({ tone: "danger", text: invalid });
      return;
    }
    if (localConflicts.length > 0) {
      setMessage({ tone: "danger", text: "That loan car is already booked for part of this period. Choose another car or change the dates." });
      return;
    }
    onBusyChange?.(true);
    setMessage(null);
    try {
      const payload = { ...draft, endDate: draft.endDate || draft.startDate };
      const data = isEdit
        ? await loanCarApi.updateBooking(booking.bookingId, payload)
        : await loanCarApi.createBooking(payload, { source: variant === "quick" ? "quick_add" : "form" });
      if (intent === "another" && !isEdit) {
        // Keep the car and dates (bookings are usually copied in batches for
        // the same day); clear who it is for.
        setDraft((current) => ({
          ...EMPTY_BOOKING_DRAFT,
          startDate: current.startDate,
          endDate: current.endDate,
          startTime: current.startTime,
          endTime: current.endTime,
        }));
        setMessage({ tone: "success", text: "Booking saved. Ready for the next one." });
        onSaved?.(data?.booking, { keepOpen: true });
      } else {
        onSaved?.(data?.booking, { keepOpen: false });
      }
    } catch (error) {
      if (error.status === 409 && error.payload?.conflicts) {
        setServerConflict({ conflicts: error.payload.conflicts, alternatives: error.payload.alternatives || [] });
        setMessage({ tone: "danger", text: error.message });
      } else {
        setMessage({ tone: "danger", text: error.message || "Unable to save the booking." });
      }
    } finally {
      onBusyChange?.(false);
    }
  };

  return (
    <form id={formId} className="loan-car-form" onSubmit={handleSubmit} noValidate>
      <LayerTheme as="section" radius="var(--radius-sm)" padding="var(--section-card-padding)" gap="var(--layout-card-gap)">
        <h3 className="app-record-heading">Find in DMS</h3>
        <div ref={firstFieldRef}>
          <InputField
            label="Job number, reg, customer, phone or email"
            value={lookupTerm}
            onChange={(event) => setLookupTerm(event.target.value)}
            placeholder="Start typing to search existing records"
            autoComplete="off"
          />
        </div>
        {lookupState === "loading" ? <p className="app-record-note">Searching…</p> : null}
        {lookupState === "empty" ? <p className="app-record-note">No matching jobs or customers. Enter the details below.</p> : null}
        {lookupState === "error" ? <p className="app-record-note">Search is unavailable right now. Enter the details below.</p> : null}
        <LookupResults results={lookupResults} onPick={applyLookup} />
      </LayerTheme>

      <LayerTheme as="section" radius="var(--radius-sm)" padding="var(--section-card-padding)" gap="var(--layout-card-gap)">
        <h3 className="app-record-heading">Loan</h3>
        <DropdownField
          label="Loan car"
          value={draft.loanCarId}
          onValueChange={(value) => update("loanCarId", value)}
          options={carOptions}
          placeholder="Choose loan car"
        />
        <div className="loan-car-form-grid loan-car-form-grid--pair">
          <CalendarField label="From" value={draft.startDate} onValueChange={(value) => update("startDate", value)} placeholder="Start date" />
          <TimePickerField label="Collection time" value={draft.startTime} onValueChange={(value) => update("startTime", value || "")} placeholder="Any time" />
          <CalendarField label="To" value={draft.endDate} onValueChange={(value) => update("endDate", value)} placeholder="End date" />
          <TimePickerField label="Return time" value={draft.endTime} onValueChange={(value) => update("endTime", value || "")} placeholder="Any time" />
        </div>
        <InputField
          label="External reference"
          value={draft.externalReference}
          onChange={(event) => update("externalReference", event.target.value)}
          placeholder="Booking number in the main loan car system"
        />
        {windowError ? <StatusMessage tone="warning">{windowError}</StatusMessage> : null}
        {conflictLines.length > 0 ? (
          <div className="loan-car-conflict" role="alert">
            <strong className="loan-car-conflict__title">Not available</strong>
            {conflictLines.map((line) => (
              <span key={line} className="loan-car-conflict__line">
                {line}
              </span>
            ))}
            {alternatives.length > 0 ? (
              <>
                <span className="loan-car-conflict__line">Free for the same period:</span>
                <div className="app-record-actions">
                  {alternatives.slice(0, 6).map((car) => (
                    <Button key={car.loanCarId} type="button" size="xs" variant="secondary" onClick={() => update("loanCarId", car.loanCarId)}>
                      {car.reg}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <span className="loan-car-conflict__line">No other loan car is free for the whole period.</span>
            )}
          </div>
        ) : null}
      </LayerTheme>

      <LayerTheme as="section" radius="var(--radius-sm)" padding="var(--section-card-padding)" gap="var(--layout-card-gap)">
        <div className="loan-car-section-head">
          <h3 className="app-record-heading">Customer</h3>
          {variant === "quick" ? (
            <Button type="button" size="xs" variant="secondary" onClick={() => setShowMore((open) => !open)} aria-expanded={showMore}>
              {showMore ? "Fewer details" : "More details"}
            </Button>
          ) : null}
        </div>
        <div className="loan-car-form-grid">
          {CUSTOMER_FIELDS.map((field) => (
            <Field key={field.key} field={field} value={draft[field.key]} onChange={(value) => update(field.key, value)} />
          ))}
          {showMore
            ? MORE_FIELDS.map((field) => (
                <Field key={field.key} field={field} value={draft[field.key]} onChange={(value) => update(field.key, value)} />
              ))
            : null}
        </div>
        <label className="loan-car-textarea">
          <span className="app-record-field__label">Notes</span>
          <textarea className="app-input app-input--textarea" rows={3} value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
        </label>
      </LayerTheme>

      {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}
    </form>
  );
}
