// file location: src/components/LoanCars/LoanCarFleetDrawer.js
//
// Manage fleet: the lightweight vehicle administration behind the calendar.
//
//   list  every loan vehicle (active and retired) with its availability
//   edit  registration (with DVLA lookup), make / model, colour, transmission,
//         fuel type, mileage and fuel, MOT / service due, active state, notes,
//         unavailable periods, recent readings and activity
//
// Roles without `manageFleet` see the same popup read-only, so the workshop
// can check a car's MOT or why it is off the road without being able to edit.

import { useCallback, useEffect, useMemo, useState } from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import { Button, InputField } from "@/components/ui";
import TrackingPopup from "@/features/tracking/TrackingPopup";
import StatusMessage from "@/components/ui/StatusMessage";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import { CalendarField } from "@/components/ui/calendarAPI";
import { DropdownField } from "@/components/ui/dropdownAPI";
import FuelGauge from "@/components/LoanCars/FuelGauge";
import {
  AVAILABILITY_META,
  FUEL_TYPES,
  TRANSMISSIONS,
  UNAVAILABLE_REASONS,
  diffDays,
  formatShortDate,
  fuelLevelDisplayLabel,
  fuelTypeLabel,
  transmissionLabel,
  unavailableReasonLabel,
} from "@/features/loanCars/loanCarModel";
import { loanCarApi } from "@/hooks/useLoanCarSchedule";

const FORM_ID = "loan-car-fleet-form";

const EMPTY_CAR = {
  reg: "",
  makeModel: "",
  colour: "",
  transmission: "",
  fuelType: "",
  mileage: "",
  fuelLevel: 8,
  motDue: "",
  serviceDue: "",
  serviceDueMileage: "",
  status: "active",
  notes: "",
};

const STATUS_CLASS = {
  success: "loan-car-status--available",
  warning: "loan-car-status--reserved",
  accent: "loan-car-status--out",
  "warning-strong": "loan-car-status--due-today",
  danger: "loan-car-status--overdue",
  neutral: "loan-car-status--unavailable",
};

const DVLA_FUEL = { PETROL: "petrol", DIESEL: "diesel", ELECTRICITY: "electric", "HYBRID ELECTRIC": "hybrid" };

const EVENT_TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const formatTime = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? EVENT_TIME.format(parsed) : "";
};

/** "MOT due in 12 days" / "MOT overdue by 3 days", or "" when comfortably far off. */
function dueWarning(label, dateKey, todayKey) {
  if (!dateKey) return "";
  const days = diffDays(todayKey, dateKey);
  if (days < 0) return `${label} overdue by ${-days} day${days === -1 ? "" : "s"}`;
  if (days <= 30) return `${label} due in ${days} day${days === 1 ? "" : "s"}`;
  return "";
}

function Section({ title, actions, children }) {
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

function FleetList({ cars, availabilityByCar, todayKey, onOpen }) {
  if (cars.length === 0) {
    return <p className="app-record-note">No loan vehicles yet. Add the first one to start booking.</p>;
  }
  return (
    <div className="loan-car-fleet-list">
      {cars.map((car) => {
        const inactive = car.status === "inactive";
        const meta = AVAILABILITY_META[availabilityByCar[car.loanCarId]?.state] || AVAILABILITY_META.available;
        const warning = dueWarning("MOT", car.motDue, todayKey) || dueWarning("Service", car.serviceDue, todayKey);
        return (
          <button key={car.loanCarId} type="button" className="loan-car-fleet-list__row" onClick={() => onOpen(car.loanCarId)}>
            <span className="loan-car-fleet-list__identity">
              <span className="loan-car-fleet-list__reg">{car.reg}</span>
              <span className="loan-car-fleet-list__meta">
                {[car.makeModel, transmissionLabel(car.transmission), fuelTypeLabel(car.fuelType)].filter(Boolean).join(" · ") || "No details yet"}
              </span>
              <span className="loan-car-fleet-list__meta">
                {[car.mileage !== "" ? `${Number(car.mileage).toLocaleString("en-GB")} mi` : "", fuelLevelDisplayLabel(car.fuelLevel), warning]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className={`loan-car-status ${inactive ? STATUS_CLASS.neutral : STATUS_CLASS[meta.tone]}`}>
              {inactive ? "Inactive" : meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PeriodEditor({ car, periods, canEdit, onChanged }) {
  const [draft, setDraft] = useState({ reason: "service", startDate: "", endDate: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [clash, setClash] = useState(null);

  const save = async (allowBookingClash = false) => {
    setBusy(true);
    setMessage(null);
    try {
      await loanCarApi.savePeriod({ ...draft, loanCarId: car.loanCarId }, { allowBookingClash });
      setDraft({ reason: "service", startDate: "", endDate: "", notes: "" });
      setClash(null);
      setMessage({ tone: "success", text: "Unavailable period saved." });
      onChanged();
    } catch (error) {
      if (error.status === 409 && error.payload?.conflicts) {
        setClash({ message: error.message, conflicts: error.payload.conflicts });
      } else {
        setMessage({ tone: "danger", text: error.message });
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (periodId) => {
    setBusy(true);
    try {
      await loanCarApi.deletePeriod(periodId);
      onChanged();
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {periods.length === 0 ? <p className="app-record-note">No unavailable periods recorded.</p> : null}
      {periods.length > 0 ? (
        <ol className="loan-car-activity">
          {periods.map((period) => (
            <li key={period.periodId} className="loan-car-activity__item loan-car-activity__item--action">
              <span className="loan-car-activity__summary">
                {unavailableReasonLabel(period.reason)} · {formatShortDate(period.startDate)} – {formatShortDate(period.endDate)}
                {period.notes ? <span className="loan-car-activity__meta">{period.notes}</span> : null}
              </span>
              {canEdit ? (
                <Button type="button" size="xs" variant="secondary" onClick={() => remove(period.periodId)} disabled={busy} symbol={false}>
                  Clear
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {canEdit ? (
        <div className="loan-car-form-grid">
          <DropdownField
            label="Reason"
            value={draft.reason}
            onValueChange={(value) => setDraft((current) => ({ ...current, reason: value }))}
            options={UNAVAILABLE_REASONS}
          />
          <CalendarField
            label="From"
            value={draft.startDate}
            onValueChange={(value) =>
              setDraft((current) => ({ ...current, startDate: value, endDate: current.endDate && current.endDate >= value ? current.endDate : value }))
            }
          />
          <CalendarField label="To" value={draft.endDate} onValueChange={(value) => setDraft((current) => ({ ...current, endDate: value }))} />
          <InputField id="loan-car-period-notes" label="Notes" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
        </div>
      ) : null}
      {clash ? (
        <div className="loan-car-conflict" role="alert">
          <strong className="loan-car-conflict__title">{clash.message}</strong>
          {clash.conflicts.map((item) => (
            <span key={item.id} className="loan-car-conflict__line">
              {item.description}
            </span>
          ))}
          <div className="app-record-actions">
            <Button type="button" size="xs" variant="primary" onClick={() => save(true)} busy={busy} symbol={false}>
              Save anyway
            </Button>
            <Button type="button" size="xs" variant="secondary" onClick={() => setClash(null)} symbol={false}>
              Change dates
            </Button>
          </div>
        </div>
      ) : null}
      {canEdit && !clash ? (
        <div className="app-record-actions app-record-actions--end">
          <Button type="button" size="sm" variant="secondary" onClick={() => save(false)} disabled={!draft.startDate} busy={busy} symbol={false}>
            Add unavailable period
          </Button>
        </div>
      ) : null}
      {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}
    </>
  );
}

function CarEditor({ car, todayKey, canEdit, migrationPending, onSaved, onBusyChange, onChanged }) {
  const isNew = !car?.loanCarId;
  const [form, setForm] = useState(() => ({ ...EMPTY_CAR, ...(car || {}) }));
  const [detail, setDetail] = useState({ periods: [], fuelHistory: [], events: [] });
  const [lookupBusy, setLookupBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const loadDetail = useCallback(() => {
    if (isNew) return;
    loanCarApi
      .getCar(car.loanCarId)
      .then((data) => data && setDetail({ periods: data.periods || [], fuelHistory: data.fuelHistory || [], events: data.events || [] }))
      .catch(() => {});
  }, [car?.loanCarId, isNew]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const lookup = async () => {
    const registration = form.reg.replace(/\s+/g, "").toUpperCase();
    if (!registration) return;
    setLookupBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.message || "No DVLA record found for that registration.");
      setForm((current) => ({
        ...current,
        makeModel: current.makeModel || [data.make, data.model].filter(Boolean).join(" "),
        colour: current.colour || data.colour || "",
        fuelType: current.fuelType || DVLA_FUEL[String(data.fuelType || "").toUpperCase()] || "",
        motDue: current.motDue || String(data.motExpiryDate || "").slice(0, 10),
      }));
      setMessage({ tone: "success", text: "Filled from the DVLA record. Check the details before saving." });
    } catch (error) {
      setMessage({ tone: "warning", text: error.message });
    } finally {
      setLookupBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.reg.trim()) {
      setMessage({ tone: "danger", text: "Enter the loan car registration." });
      return;
    }
    onBusyChange(true);
    setMessage(null);
    try {
      const payload = { ...form };
      delete payload.loanCarId;
      delete payload.id;
      const data = isNew ? await loanCarApi.createCar(payload) : await loanCarApi.updateCar(car.loanCarId, payload);
      onSaved(data?.car, isNew);
      if (!isNew) {
        setMessage({ tone: "success", text: "Vehicle saved." });
        loadDetail();
      }
    } catch (error) {
      setMessage({ tone: "danger", text: error.message });
    } finally {
      onBusyChange(false);
    }
  };

  const motWarning = dueWarning("MOT", form.motDue, todayKey);
  const serviceWarning = dueWarning("Service", form.serviceDue, todayKey);

  return (
    <form id={FORM_ID} className="loan-car-form" onSubmit={submit} noValidate>
      <Section title="Vehicle">
        <div className="loan-car-lookup-row">
          <InputField
            id="loan-car-fleet-reg"
            label="Registration"
            value={form.reg}
            onChange={(event) => update("reg", event.target.value.toUpperCase())}
            disabled={!canEdit}
          />
          {canEdit ? (
            <Button type="button" size="sm" variant="secondary" onClick={lookup} busy={lookupBusy} disabled={!form.reg.trim()} symbol={false}>
              DVLA lookup
            </Button>
          ) : null}
        </div>
        <div className="loan-car-form-grid">
          <InputField id="loan-car-fleet-model" label="Make / model" value={form.makeModel} onChange={(event) => update("makeModel", event.target.value)} disabled={!canEdit} />
          <InputField id="loan-car-fleet-colour" label="Colour" value={form.colour} onChange={(event) => update("colour", event.target.value)} disabled={!canEdit} />
          <DropdownField
            label="Transmission"
            value={form.transmission}
            onValueChange={(value) => update("transmission", value)}
            options={TRANSMISSIONS}
            placeholder="Not set"
            disabled={!canEdit || migrationPending}
          />
          <DropdownField
            label="Fuel type"
            value={form.fuelType}
            onValueChange={(value) => update("fuelType", value)}
            options={FUEL_TYPES}
            placeholder="Not set"
            disabled={!canEdit || migrationPending}
          />
        </div>
        <label className="loan-car-check">
          <input
            type="checkbox"
            className="app-toggle app-toggle--checkbox"
            checked={form.status !== "inactive"}
            onChange={(event) => update("status", event.target.checked ? "active" : "inactive")}
            disabled={!canEdit}
          />
          <span>Active — shown on the calendar and offered for bookings</span>
        </label>
      </Section>

      <Section title="Mileage & fuel">
        <InputField id="loan-car-fleet-mileage" label="Mileage" type="number" value={form.mileage} onChange={(event) => update("mileage", event.target.value)} disabled={!canEdit} />
        <div className="app-record-field">
          <span className="app-record-field__label">Fuel</span>
          <FuelGauge value={form.fuelLevel} onChange={(value) => update("fuelLevel", value)} disabled={!canEdit} />
        </div>
        {detail.fuelHistory.length > 0 ? (
          <ol className="loan-car-activity">
            {detail.fuelHistory.slice(0, 6).map((entry) => (
              <li key={entry.id} className="loan-car-activity__item">
                <span className="loan-car-activity__summary">
                  {[entry.mileage !== "" ? `${Number(entry.mileage).toLocaleString("en-GB")} mi` : "", fuelLevelDisplayLabel(entry.fuelLevel)].filter(Boolean).join(" · ")}
                </span>
                <span className="loan-car-activity__meta">{formatTime(entry.recordedAt)}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </Section>

      <Section title="MOT & service">
        <div className="loan-car-form-grid">
          <CalendarField label="MOT due" value={form.motDue} onValueChange={(value) => update("motDue", value)} disabled={!canEdit || migrationPending} />
          <CalendarField label="Service due" value={form.serviceDue} onValueChange={(value) => update("serviceDue", value)} disabled={!canEdit || migrationPending} />
          <InputField
            id="loan-car-fleet-service-mileage"
            label="Service due at (miles)"
            type="number"
            value={form.serviceDueMileage}
            onChange={(event) => update("serviceDueMileage", event.target.value)}
            disabled={!canEdit || migrationPending}
          />
        </div>
        {motWarning || serviceWarning ? <StatusMessage tone="warning">{[motWarning, serviceWarning].filter(Boolean).join(" · ")}</StatusMessage> : null}
      </Section>

      <Section title="Notes">
        <label className="loan-car-textarea">
          <span className="app-record-field__label">Vehicle notes</span>
          <textarea className="app-input app-input--textarea" rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} disabled={!canEdit} />
        </label>
      </Section>

      {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}

      {!isNew ? (
        <>
          <Section title="Unavailable periods">
            {migrationPending ? (
              <p className="app-record-note">Unavailable periods switch on once the loan car database update is applied.</p>
            ) : (
              <PeriodEditor
                car={car}
                periods={detail.periods}
                canEdit={canEdit}
                onChanged={() => {
                  loadDetail();
                  onChanged();
                }}
              />
            )}
          </Section>
          <Section title="Activity">
            {detail.events.length === 0 ? (
              <p className="app-record-note">No activity recorded yet.</p>
            ) : (
              <ol className="loan-car-activity">
                {detail.events.map((event) => (
                  <li key={event.id} className="loan-car-activity__item">
                    <span className="loan-car-activity__summary">{event.summary}</span>
                    <span className="loan-car-activity__meta">{[event.actorName, formatTime(event.createdAt)].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </>
      ) : null}
    </form>
  );
}

export default function LoanCarFleetDrawer({
  open,
  initialCarId = null,
  allCars,
  availabilityByCar,
  todayKey,
  capabilities,
  migrationPending,
  onClose,
  onChanged,
}) {
  const [view, setView] = useState(initialCarId ? { carId: initialCarId } : { list: true });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [message, setMessage] = useState(null);
  const canEdit = capabilities?.manageFleet === true;

  useEffect(() => {
    setView(initialCarId ? { carId: initialCarId } : { list: true });
    setMessage(null);
  }, [initialCarId, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !busy && !confirm) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, confirm, onClose]);

  const sortedCars = useMemo(
    () =>
      [...allCars].sort(
        (a, b) => (a.status === "inactive") - (b.status === "inactive") || a.reg.localeCompare(b.reg, "en-GB")
      ),
    [allCars]
  );

  if (!open) return null;

  const car = view.carId ? allCars.find((item) => item.loanCarId === view.carId) : null;
  const isNew = Boolean(view.isNew);

  if (view.list) {
    return (
      <TrackingPopup
        title="Manage fleet"
        description={`${allCars.filter((item) => item.status !== "inactive").length} active loan vehicle${allCars.length === 1 ? "" : "s"}`}
        onClose={onClose}
        headerActions={
          canEdit ? (
            <Button type="button" size="sm" variant="primary" onClick={() => setView({ isNew: true })} symbol={false}>
              Add vehicle
            </Button>
          ) : null
        }>
        {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}
        <LayerTheme as="section" radius="var(--radius-sm)" padding="var(--section-card-padding)" gap="var(--layout-card-gap)">
          <FleetList cars={sortedCars} availabilityByCar={availabilityByCar} todayKey={todayKey} onOpen={(carId) => setView({ carId })} />
        </LayerTheme>
      </TrackingPopup>
    );
  }

  const title = isNew ? "Add loan vehicle" : car?.reg || "Loan vehicle";
  const retire = car?.status === "inactive" ? "Reactivate" : "Set inactive";

  return (
    <>
      <TrackingPopup
        title={title}
        description={isNew ? "Look the registration up to fill the details." : [car?.makeModel, car?.colour].filter(Boolean).join(" · ")}
        onClose={busy ? undefined : onClose}
        headerActions={
          canEdit ? (
            <>
              <Button type="submit" form={FORM_ID} size="sm" variant="primary" busy={busy} symbol={false}>
                {isNew ? "Add vehicle" : "Save vehicle"}
              </Button>
              {car ? (
                <>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setConfirm("status")} disabled={busy} symbol={false}>
                    {retire}
                  </Button>
                  <Button type="button" size="sm" variant="danger" onClick={() => setConfirm("delete")} disabled={busy} symbol={false}>
                    Delete vehicle
                  </Button>
                </>
              ) : null}
            </>
          ) : null
        }>
        <CarEditor
          key={view.carId || "new"}
          car={isNew ? null : car}
          todayKey={todayKey}
          canEdit={canEdit}
          migrationPending={migrationPending}
          onBusyChange={setBusy}
          onChanged={onChanged}
          onSaved={(saved, created) => {
            onChanged();
            if (created && saved) setView({ carId: saved.loanCarId });
          }}
        />
      </TrackingPopup>

      <ConfirmationDialog
        isOpen={Boolean(confirm)}
        title={confirm === "delete" ? `Delete ${car?.reg}?` : `${retire} ${car?.reg}?`}
        message={
          confirm === "delete"
            ? "Only a vehicle that has never been booked can be deleted. Vehicles with history should be set inactive instead."
            : car?.status === "inactive"
              ? "The vehicle returns to the calendar and can be booked again."
              : "The vehicle leaves the calendar and cannot be booked. Its booking history is kept."
        }
        confirmLabel={confirm === "delete" ? "Delete" : retire}
        cancelLabel="Cancel"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const action = confirm;
          setConfirm(null);
          setBusy(true);
          try {
            if (action === "delete") {
              await loanCarApi.deleteCar(car.loanCarId);
              setView({ list: true });
              setMessage({ tone: "success", text: `${car.reg} removed from the fleet.` });
            } else {
              await loanCarApi.updateCar(car.loanCarId, { status: car.status === "inactive" ? "active" : "inactive" });
            }
            onChanged();
          } catch (error) {
            setView({ list: true });
            setMessage({ tone: "danger", text: error.message });
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
