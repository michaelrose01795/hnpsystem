// file location: src/components/LoanCars/LoanCarBookingDrawer.js
//
// The popup a booking opens into (TrackingPopup). One popup, four modes:
//
//   view      customer, loan, related job, mileage / fuel, notes, external
//             reference, status and activity, with the actions the role allows
//   edit      the shared booking form
//   handover  mark the car out (mileage / fuel out)
//   return    quick return: actual return time, mileage, fuel, damage / issues
//
// It also hosts New loan booking and Quick add (mode "create"), so every
// booking interaction shares one surface, one set of actions and one form.

import { useCallback, useEffect, useMemo, useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import { SkeletonBlock, SkeletonKeyframes } from "@/components/ui/LoadingSkeleton";
import { Button, InputField } from "@/components/ui";
import TrackingPopup from "@/features/tracking/TrackingPopup";
import StatusMessage from "@/components/ui/StatusMessage";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import FuelGauge from "@/components/LoanCars/FuelGauge";
import LoanCarBookingForm from "@/components/LoanCars/LoanCarBookingForm";
import {
  BOOKING_STATE,
  BOOKING_STATE_META,
  BOOKING_STATUS,
  addDays,
  bookingCopyText,
  bookingDurationDays,
  customerSurname,
  formatBookingWindow,
  formatDayLabel,
  fuelLevelDisplayLabel,
  resolveBookingState,
  toDateKey,
  toTimeKey,
} from "@/features/loanCars/loanCarModel";
import { loanCarApi } from "@/hooks/useLoanCarSchedule";

const FORM_ID = "loan-car-booking-form";

const STATE_BADGE = {
  warning: "app-badge app-badge--warning",
  accent: "app-badge app-badge--accent-strong",
  "warning-strong": "app-badge app-badge--warning-strong",
  danger: "app-badge app-badge--danger-strong",
  neutral: "app-badge app-badge--neutral",
};

const ACTIVITY_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const formatActivityTime = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? ACTIVITY_TIME.format(parsed) : "";
};

const reading = (mileage, fuel) =>
  [mileage !== "" && mileage != null ? `${Number(mileage).toLocaleString("en-GB")} mi` : "", fuel !== "" && fuel != null ? fuelLevelDisplayLabel(fuel) : ""]
    .filter(Boolean)
    .join(" · ") || "Not recorded";

function RecordField({ label, value, muted = false, copyValue, onCopy, copied, wide = false }) {
  return (
    <div className={`app-record-field${wide ? " loan-car-field--wide" : ""}`}>
      <span className="app-record-field__label">{label}</span>
      <span className={`app-record-field__value${muted || !value ? " app-record-field__value--muted" : ""}`}>
        {value || "—"}
        {copyValue && onCopy ? (
          <Button type="button" size="xxs" variant="secondary" className="loan-car-copy" onClick={() => onCopy(label, copyValue)} aria-label={`Copy ${label}`} symbol={false}>
            {copied === label ? "Copied" : "Copy"}
          </Button>
        ) : null}
      </span>
    </div>
  );
}

function Section({ title, children, actions }) {
  return (
    <LayerTheme as="section" radius="var(--radius-sm)" padding="var(--section-card-padding)" gap="var(--layout-card-gap)">
      <div className="loan-car-section-head">
        <h3 className="app-record-heading">{title}</h3>
        {actions}
      </div>
      {children}
    </LayerTheme>
  );
}

function ActivityList({ events, loading }) {
  if (loading) {
    return (
      <ol className="loan-car-activity" role="status" aria-live="polite" aria-busy="true" aria-label="Loading activity">
        <SkeletonKeyframes />
        {["72%", "58%", "66%"].map((width) => (
          <li key={width} className="loan-car-activity__item">
            <SkeletonBlock width={width} height="14px" />
            <SkeletonBlock width="38%" height="11px" />
          </li>
        ))}
      </ol>
    );
  }
  if (!events.length) return <p className="app-record-note">No activity recorded yet.</p>;
  return (
    <ol className="loan-car-activity">
      {events.map((event) => (
        <li key={event.id} className="loan-car-activity__item">
          <span className="loan-car-activity__summary">{event.summary}</span>
          <span className="loan-car-activity__meta">
            {[event.actorName, formatActivityTime(event.createdAt)].filter(Boolean).join(" · ")}
          </span>
        </li>
      ))}
    </ol>
  );
}

function HandoverForm({ car, onSubmit, busy }) {
  const [mileage, setMileage] = useState(car?.mileage ?? "");
  const [fuel, setFuel] = useState(car?.fuelLevel ?? 0);
  return (
    <form
      id={FORM_ID}
      className="loan-car-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ loanMileageOut: mileage, loanFuelOut: fuel });
      }}>
      <Section title="Hand over">
        <p className="app-record-note">Confirm the loan car's readings as it leaves. They also become the vehicle's latest readings.</p>
        <InputField id="loan-car-handover-mileage" label="Mileage out" type="number" value={mileage} onChange={(event) => setMileage(event.target.value)} disabled={busy} />
        <div className="app-record-field">
          <span className="app-record-field__label">Fuel out</span>
          <FuelGauge value={fuel} onChange={setFuel} disabled={busy} />
        </div>
      </Section>
    </form>
  );
}

function ReturnForm({ booking, car, onSubmit, busy, canMarkUnavailable }) {
  const now = new Date();
  const [returnedDate, setReturnedDate] = useState(toDateKey(now));
  const [returnedTime, setReturnedTime] = useState(toTimeKey(now));
  const [mileage, setMileage] = useState(car?.mileage ?? "");
  const [fuel, setFuel] = useState(car?.fuelLevel ?? 0);
  const [hasDamage, setHasDamage] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");
  const [markUnavailable, setMarkUnavailable] = useState(false);
  const mileageOut = Number(booking.loanMileageOut);
  const distance = Number.isFinite(mileageOut) && mileageOut > 0 && Number(mileage) >= mileageOut ? Number(mileage) - mileageOut : null;

  return (
    <form
      id={FORM_ID}
      className="loan-car-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ returnedDate, returnedTime, loanMileageIn: mileage, loanFuelIn: fuel, hasDamage, returnNotes, markUnavailable });
      }}>
      <Section title="Quick return">
        <div className="loan-car-form-grid loan-car-form-grid--pair">
          <CalendarField label="Returned on" value={returnedDate} onValueChange={setReturnedDate} />
          <TimePickerField label="Returned at" value={returnedTime} onValueChange={(value) => setReturnedTime(value || "")} minuteStep={5} />
        </div>
        <InputField id="loan-car-return-mileage" label="Mileage in" type="number" value={mileage} onChange={(event) => setMileage(event.target.value)} disabled={busy} />
        {distance !== null ? <p className="app-record-note">{distance.toLocaleString("en-GB")} miles on this loan.</p> : null}
        <div className="app-record-field">
          <span className="app-record-field__label">Fuel in</span>
          <FuelGauge value={fuel} onChange={setFuel} disabled={busy} />
          {booking.loanFuelOut !== "" && booking.loanFuelOut != null ? (
            <span className="app-record-note">Went out at {fuelLevelDisplayLabel(booking.loanFuelOut)}</span>
          ) : null}
        </div>
        <label className="loan-car-check">
          <input type="checkbox" className="app-toggle app-toggle--checkbox" checked={hasDamage} onChange={(event) => setHasDamage(event.target.checked)} disabled={busy} />
          <span>Damage or issues found</span>
        </label>
        {hasDamage ? (
          <>
            <label className="loan-car-textarea">
              <span className="app-record-field__label">Describe the damage / issue</span>
              <textarea className="app-input app-input--textarea" rows={3} value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} required />
            </label>
            {canMarkUnavailable ? (
              <label className="loan-car-check">
                <input type="checkbox" className="app-toggle app-toggle--checkbox" checked={markUnavailable} onChange={(event) => setMarkUnavailable(event.target.checked)} disabled={busy} />
                <span>Take {car?.reg || "the car"} off the road (mark unavailable: damage)</span>
              </label>
            ) : null}
          </>
        ) : (
          <label className="loan-car-textarea">
            <span className="app-record-field__label">Return notes (optional)</span>
            <textarea className="app-input app-input--textarea" rows={2} value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} />
          </label>
        )}
      </Section>
    </form>
  );
}

export default function LoanCarBookingDrawer({
  open,
  mode: requestedMode = "view",
  booking: initialBooking = null,
  initialDraft = null,
  variant = "quick",
  cars,
  allCars,
  bookings,
  periods,
  now,
  capabilities,
  migrationPending,
  onClose,
  onChanged,
}) {
  const [mode, setMode] = useState(requestedMode);
  const [booking, setBooking] = useState(initialBooking);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [copied, setCopied] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const bookingId = initialBooking?.bookingId || null;

  useEffect(() => {
    setMode(requestedMode);
    setBooking(initialBooking);
    setMessage(null);
  }, [requestedMode, initialBooking]);

  useEffect(() => {
    if (!open || !bookingId) {
      setEvents([]);
      return undefined;
    }
    let active = true;
    setLoadingEvents(true);
    loanCarApi
      .getBooking(bookingId)
      .then((data) => {
        if (!active || !data) return;
        setBooking(data.booking);
        setEvents(data.events || []);
      })
      .catch((error) => active && setMessage({ tone: "danger", text: error.message }))
      .finally(() => active && setLoadingEvents(false));
    return () => {
      active = false;
    };
  }, [open, bookingId]);

  // Escape closes, unless a save is in flight.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !busy && !confirmDelete) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, confirmDelete, onClose]);

  const car = useMemo(
    () => (allCars || cars).find((item) => item.loanCarId === booking?.loanCarId) || null,
    [allCars, cars, booking?.loanCarId]
  );
  const state = booking ? resolveBookingState(booking, now) : null;
  const stateMeta = state ? BOOKING_STATE_META[state] : null;
  const isReturned = booking?.status === BOOKING_STATUS.RETURNED;

  const runAction = useCallback(
    async (action, successText) => {
      setBusy(true);
      setMessage(null);
      try {
        const data = await action();
        if (data?.booking) setBooking(data.booking);
        if (data?.events) setEvents(data.events);
        setMode("view");
        setMessage(successText ? { tone: "success", text: successText } : null);
        onChanged?.();
      } catch (error) {
        const alternatives = error.payload?.alternatives || [];
        setMessage({
          tone: "danger",
          text: alternatives.length
            ? `${error.message}. Free instead: ${alternatives.map((item) => item.reg).join(", ")}.`
            : error.message,
        });
      } finally {
        setBusy(false);
      }
    },
    [onChanged]
  );

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1400);
    } catch {
      setMessage({ tone: "warning", text: "Copying is blocked in this browser. Select the text instead." });
    }
  };

  const shiftEnd = (days) => {
    const endDate = addDays(booking.endDate, days);
    if (endDate < booking.startDate) return;
    runAction(() => loanCarApi.adjustBooking(booking.bookingId, { endDate }), `Now due back ${formatDayLabel(endDate)}.`);
  };

  if (!open) return null;

  // ----- create / edit -------------------------------------------------------
  if (mode === "create" || mode === "edit") {
    const isCreate = mode === "create";
    return (
      <TrackingPopup
        title={isCreate ? (variant === "quick" ? "Quick add" : "New loan booking") : `Edit booking · ${car?.reg || ""}`}
        description={
          isCreate
            ? variant === "quick"
              ? "Copy a booking across from the main loan car system. Pick the job or customer to fill the details."
              : "Book a loan car against a customer and job."
            : formatBookingWindow(booking)
        }
        onClose={busy ? undefined : isCreate ? onClose : () => setMode("view")}
        headerActions={
          <>
            {isCreate && variant === "quick" ? (
              <Button type="submit" form={FORM_ID} value="another" size="sm" variant="secondary" busy={busy} symbol={false}>
                Save &amp; add another
              </Button>
            ) : null}
            <Button type="submit" form={FORM_ID} value="save" size="sm" variant="primary" busy={busy} symbol={false}>
              {isCreate ? "Save booking" : "Save changes"}
            </Button>
          </>
        }>
        <LoanCarBookingForm
          key={`${mode}-${booking?.bookingId || "new"}-${initialDraft?.loanCarId || ""}-${initialDraft?.startDate || ""}`}
          formId={FORM_ID}
          variant={isCreate ? variant : "full"}
          booking={isCreate ? null : booking}
          initialDraft={isCreate ? initialDraft : null}
          cars={cars}
          bookings={bookings}
          periods={periods}
          onBusyChange={setBusy}
          onSaved={(saved, { keepOpen }) => {
            onChanged?.();
            if (keepOpen) return;
            if (isCreate) {
              onClose();
              return;
            }
            setBooking(saved);
            setMode("view");
            setMessage({ tone: "success", text: "Booking updated." });
            loanCarApi.getBooking(saved.bookingId).then((data) => data && setEvents(data.events || [])).catch(() => {});
          }}
        />
      </TrackingPopup>
    );
  }

  if (!booking) return null;

  // ----- handover / return ---------------------------------------------------
  if (mode === "handover" || mode === "return") {
    const isReturn = mode === "return";
    return (
      <TrackingPopup
        title={`${isReturn ? "Return" : "Hand over"} · ${car?.reg || "Loan car"}`}
        description={`${booking.customerName || "Customer"} · ${formatBookingWindow(booking)}`}
        onClose={busy ? undefined : () => setMode("view")}
        headerActions={
          <Button type="submit" form={FORM_ID} size="sm" variant="primary" busy={busy} symbol={false}>
            {isReturn ? "Record return" : "Confirm hand over"}
          </Button>
        }>
        {isReturn ? (
          <ReturnForm
            booking={booking}
            car={car}
            busy={busy}
            canMarkUnavailable={Boolean(capabilities?.handover)}
            onSubmit={(payload) => runAction(() => loanCarApi.returnBooking(booking.bookingId, payload), "Return recorded.")}
          />
        ) : (
          <HandoverForm
            car={car}
            busy={busy}
            onSubmit={(payload) => runAction(() => loanCarApi.handOver(booking.bookingId, payload), "Marked as out.")}
          />
        )}
        {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}
      </TrackingPopup>
    );
  }

  // ----- view ----------------------------------------------------------------
  const canBook = capabilities?.book === true;
  const canHandover = capabilities?.handover === true && !migrationPending;
  const canAdjust = capabilities?.adjust === true && !isReturned;
  const canRemove = capabilities?.remove === true;
  const surname = customerSurname(booking.customerName);

  return (
    <>
      <TrackingPopup
        title={`${car?.reg || "Loan car"}${surname ? ` · ${surname}` : ""}`}
        description={`${formatBookingWindow(booking)} · ${bookingDurationDays(booking)} day${bookingDurationDays(booking) === 1 ? "" : "s"}`}
        onClose={busy ? undefined : onClose}
        headerActions={
          <>
            {canBook ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => setMode("edit")} disabled={busy} symbol={false}>
                Edit
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="secondary" onClick={() => copy("Booking", bookingCopyText(booking, car))} symbol={false}>
              {copied === "Booking" ? "Copied" : "Copy details"}
            </Button>
            {canRemove ? (
              <Button type="button" size="sm" variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy} symbol={false}>
                Delete booking
              </Button>
            ) : null}
          </>
        }>
        <LayerTheme as="section" radius="var(--radius-sm)" padding="var(--section-card-padding)" gap="var(--layout-card-gap)">
          <div className="loan-car-section-head">
            {stateMeta ? <span className={STATE_BADGE[stateMeta.tone] || STATE_BADGE.neutral}>{stateMeta.label}</span> : null}
            <div className="app-record-actions app-record-actions--end">
              {canHandover && !isReturned && booking.status !== BOOKING_STATUS.OUT ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => setMode("handover")} disabled={busy} symbol={false}>
                  Mark out
                </Button>
              ) : null}
              {canHandover && !isReturned && state !== BOOKING_STATE.UPCOMING ? (
                <Button type="button" size="sm" variant="primary" onClick={() => setMode("return")} disabled={busy} symbol={false}>
                  Quick return
                </Button>
              ) : null}
              {canHandover && isReturned ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  busy={busy}
                  onClick={() => runAction(() => loanCarApi.reopenBooking(booking.bookingId), "Return undone.")}
                  symbol={false}>
                  Undo return
                </Button>
              ) : null}
            </div>
          </div>
          {canAdjust ? (
            <div className="loan-car-section-head">
              <span className="app-record-note">Due back {formatDayLabel(booking.endDate)}{booking.endTime ? ` ${booking.endTime}` : ""}</span>
              <div className="app-record-actions">
                <Button type="button" size="xs" variant="secondary" onClick={() => shiftEnd(-1)} disabled={busy || booking.endDate <= booking.startDate} symbol={false}>
                  − 1 day
                </Button>
                <Button type="button" size="xs" variant="secondary" onClick={() => shiftEnd(1)} disabled={busy} symbol={false}>
                  + 1 day
                </Button>
              </div>
            </div>
          ) : null}
          {migrationPending ? (
            <p className="app-record-note">Hand-over, returns and activity history switch on once the loan car database update is applied.</p>
          ) : null}
        </LayerTheme>

        {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}

        <Section title="Customer">
          <div className="app-record-grid">
            <RecordField label="Name" value={booking.customerName} copyValue={booking.customerName} onCopy={copy} copied={copied} />
            <RecordField label="Phone" value={booking.customerPhone} copyValue={booking.customerPhone} onCopy={copy} copied={copied} />
            <RecordField label="Email" value={booking.customerEmail} copyValue={booking.customerEmail} onCopy={copy} copied={copied} wide />
            <RecordField
              label="Address"
              value={[booking.customerAddress, booking.customerPostcode].filter(Boolean).join(", ")}
              wide
            />
            {booking.licenceNumber ? <RecordField label="Licence" value={booking.licenceNumber} /> : null}
            {booking.insuranceProvider ? (
              <RecordField label="Insurance" value={[booking.insuranceProvider, booking.insurancePolicyNumber].filter(Boolean).join(" · ")} />
            ) : null}
          </div>
        </Section>

        <Section title="Loan">
          <div className="app-record-grid">
            <RecordField label="Loan car" value={[car?.reg, car?.makeModel].filter(Boolean).join(" · ")} />
            <RecordField label="Status" value={stateMeta?.label} />
            <RecordField label="From" value={[formatDayLabel(booking.startDate), booking.startTime].filter(Boolean).join(" ")} />
            <RecordField label="To" value={[formatDayLabel(booking.endDate), booking.endTime].filter(Boolean).join(" ")} />
            <RecordField
              label="External reference"
              value={booking.externalReference}
              copyValue={booking.externalReference}
              onCopy={copy}
              copied={copied}
              wide
            />
          </div>
        </Section>

        <Section title="Related job">
          <div className="app-record-grid">
            <RecordField
              label="Job"
              value={
                booking.jobNumber ? (
                  <a className="loan-car-link" href={`/job-cards/${encodeURIComponent(booking.jobNumber)}`}>
                    #{booking.jobNumber}
                  </a>
                ) : (
                  ""
                )
              }
              copyValue={booking.jobNumber}
              onCopy={copy}
              copied={copied}
            />
            <RecordField label="Customer vehicle" value={[booking.vehicleReg, booking.vehicleMakeModel].filter(Boolean).join(" · ")} />
            {booking.mileage !== "" && booking.mileage != null ? (
              <RecordField label="Vehicle mileage" value={`${Number(booking.mileage).toLocaleString("en-GB")} mi`} />
            ) : null}
          </div>
        </Section>

        <Section title="Mileage & fuel">
          <div className="app-record-grid">
            <RecordField label="Out" value={reading(booking.loanMileageOut, booking.loanFuelOut)} />
            <RecordField
              label="In"
              value={
                isReturned
                  ? `${reading(booking.loanMileageIn, booking.loanFuelIn)} · ${formatDayLabel(booking.returnedDate)} ${booking.returnedTime || ""}`.trim()
                  : "Not returned"
              }
            />
            {isReturned && booking.hasDamage ? <RecordField label="Damage / issues" value={booking.returnNotes} wide /> : null}
            {isReturned && !booking.hasDamage && booking.returnNotes ? <RecordField label="Return notes" value={booking.returnNotes} wide /> : null}
          </div>
        </Section>

        {booking.notes ? (
          <Section title="Notes">
            <p className="app-record-note app-record-note--strong">{booking.notes}</p>
          </Section>
        ) : null}

        <Section title="Activity">
          <ActivityList events={events} loading={loadingEvents} />
        </Section>
      </TrackingPopup>

      <ConfirmationDialog
        isOpen={confirmDelete}
        title="Delete this loan booking?"
        message={`${car?.reg || "Loan car"} for ${booking.customerName || "this customer"}, ${formatBookingWindow(booking)}. The activity history is kept.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          setBusy(true);
          try {
            await loanCarApi.deleteBooking(booking.bookingId);
            onChanged?.();
            onClose();
          } catch (error) {
            setMessage({ tone: "danger", text: error.message });
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
