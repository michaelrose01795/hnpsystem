import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { Button, InputField } from "@/components/ui";
import { CalendarField } from "@/components/ui/calendarAPI";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import {
  deleteLoanCar,
  deleteLoanCarBooking,
  getLoanCarScheduleBookings,
  getLoanCars,
  saveLoanCar,
  saveLoanCarBooking,
  searchLoanCarBookingTargets,
} from "@/lib/database/tracking";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOOK_BACK_DAYS = 14;
const LOOK_AHEAD_DAYS = 35;
const LOAN_CAR_MODAL_Z_INDEX = 4000;

const EMPTY_BOOKING = {
  bookingId: "",
  loanCarId: "",
  startDate: "",
  endDate: "",
  jobId: null,
  jobNumber: "",
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
};

const BOOKING_FORM_FIELDS = [
  { label: "Job number", key: "jobNumber" },
  { label: "Customer name", key: "customerName" },
  { label: "Customer email", key: "customerEmail", type: "email" },
  { label: "Customer phone", key: "customerPhone" },
  { label: "Address", key: "customerAddress" },
  { label: "Postcode", key: "customerPostcode" },
  { label: "Customer vehicle reg", key: "vehicleReg", transform: (value) => value.toUpperCase() },
  { label: "Vehicle", key: "vehicleMakeModel" },
  { label: "Mileage", key: "mileage", type: "number" },
  { label: "Insurance provider", key: "insuranceProvider" },
  { label: "Policy number", key: "insurancePolicyNumber" },
  { label: "Licence number", key: "licenceNumber" },
  { label: "Date of birth", key: "dateOfBirth", type: "date" },
];

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildDateRows = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: LOOK_BACK_DAYS + LOOK_AHEAD_DAYS + 1 }, (_, index) => {
    const offset = index - LOOK_BACK_DAYS;
    const date = new Date(today.getTime() + offset * MS_PER_DAY);
    return {
      key: toDateKey(date),
      label: date.toLocaleDateString("en-GB", { weekday: "short" }),
      dateLabel: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      compactDateLabel: date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }),
      isToday: offset === 0,
    };
  });
};

const bookingCoversDate = (booking, dayKey) =>
  booking.loanCarId && booking.startDate <= dayKey && booking.endDate >= dayKey;

const getBookingForCell = (bookings, carId, dayKey) =>
  bookings.find((booking) => booking.loanCarId === carId && bookingCoversDate(booking, dayKey));

const buildJobBookingDraft = ({ jobData, highlightedJobNumber, highlightedReg }) => {
  if (!jobData?.appointment?.date) return null;
  return {
    ...EMPTY_BOOKING,
    startDate: jobData.appointment.date,
    endDate: jobData.appointment.date,
    jobId: jobData.id || null,
    jobNumber: jobData.jobNumber || highlightedJobNumber || "",
    customerName: jobData.customer || "",
    customerEmail: jobData.customerEmail || "",
    customerPhone: jobData.customerPhone || "",
    customerAddress: jobData.customerAddress || "",
    customerPostcode: jobData.customerPostcode || "",
    vehicleReg: jobData.reg || highlightedReg || "",
    vehicleMakeModel: jobData.makeModel || [jobData.make, jobData.model].filter(Boolean).join(" "),
    mileage: jobData.mileage || jobData.milage || "",
    insuranceProvider: jobData.insuranceProvider || "",
    insurancePolicyNumber: jobData.insurancePolicyNumber || "",
  };
};

// `--secondary-pressed` and `--theme` are semi-transparent rgba tokens. On
// sticky cells they let scrolling body rows bleed through. Layer the tint on
// an opaque `--surface` base so the sticky surface fully masks content below.
const stickyHeadingBg = {
  backgroundColor: "var(--surface)",
  backgroundImage: "linear-gradient(var(--secondary-pressed), var(--secondary-pressed))",
};

const stickyFirstColBg = {
  backgroundColor: "var(--surface)",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  color: "var(--text-1)",
  fontSize: "13px",
  fontWeight: 700,
};

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "var(--layout-card-gap)",
};

const compactBookingFieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "var(--space-2)",
};

const todayDateKey = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return toDateKey(today);
};

function Field({ label, value, onChange, type = "text", children }) {
  if (children) {
    return <div style={labelStyle}>{children}</div>;
  }

  if (type === "date") {
    return (
      <CalendarField
        label={label}
        value={value ?? ""}
        onValueChange={onChange}
        placeholder="Choose date"
      />
    );
  }

  return (
    <InputField
      label={label}
      type={type}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ClipboardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function CopyButton({ label, value, onCopy, copied }) {
  return (
    <Button type="button" variant="ghost" size="xs" onClick={() => onCopy(value)} disabled={!value} aria-label={`Copy ${label}`} title={copied ? "Copied" : `Copy ${label}`}>
      {copied ? "Copied" : <ClipboardIcon />}
    </Button>
  );
}

function CopyableField({ label, valueToCopy, copied, onCopy, children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: "var(--space-2)",
        alignItems: "end",
      }}>
      <div style={{ minWidth: 0 }}>{children}</div>
      <CopyButton label={label} value={valueToCopy} onCopy={onCopy} copied={copied} />
    </div>
  );
}

function BookingCell({ booking, onClick, highlightedJob, highlightedVehicle, fixedHeight = false }) {
  const isHighlighted =
    booking &&
    ((highlightedJob && String(booking.jobNumber || "").toLowerCase() === highlightedJob) ||
      (highlightedVehicle && String(booking.vehicleReg || booking.reg || "").toLowerCase() === highlightedVehicle));
  const actionLabel = booking
    ? `Open booking for ${booking.vehicleReg || booking.jobNumber || "loan car"}`
    : "Book available loan car slot";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={actionLabel}
      style={{
        width: "100%",
        height: fixedHeight ? "44px" : "100%",
        minHeight: fixedHeight ? 0 : "44px",
        maxHeight: fixedHeight ? "44px" : undefined,
        boxSizing: "border-box",
        border: 0,
        borderRadius: 0,
        backgroundColor: "transparent",
        color: booking ? "var(--warning-dark)" : "var(--success-dark)",
        cursor: "pointer",
        display: fixedHeight ? "block" : "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "2px",
        padding: fixedHeight ? 0 : "6px 8px",
        textAlign: "left",
        lineHeight: fixedHeight ? 0 : 1.1,
        fontWeight: booking ? 600 : 700,
        overflow: fixedHeight ? "hidden" : undefined,
        boxShadow: !fixedHeight && isHighlighted ? "inset 0 0 0 2px var(--primary-selected)" : "none",
      }}>
      {fixedHeight ? null : (
        booking ? (
          <>
            <strong style={{ fontSize: "12px" }}>
              #{booking.jobNumber || "Job"} {booking.vehicleReg ? `- ${booking.vehicleReg}` : ""}
            </strong>
            <span style={{ fontSize: "12px" }}>
              {booking.customerName || booking.customer || "Customer"}
            </span>
            {booking.startDate !== booking.endDate ? (
              <span style={{ fontSize: "11px", color: "var(--grey-accent)" }}>
                {booking.startDate} to {booking.endDate}
              </span>
            ) : null}
          </>
        ) : (
          "Available"
        )
      )}
    </button>
  );
}

const scrollTodayIntoView = (todayRowRef) => {
  const row = todayRowRef.current;
  if (!row) return;
  const scroller = row.closest("[data-loan-car-table-scroll], .app-table-shell-scroll");
  const thead = scroller?.querySelector("thead");
  if (!scroller || !thead) {
    row.scrollIntoView({ block: "start", inline: "nearest" });
    return;
  }
  // Align the today row's top flush with the bottom of the sticky heading so
  // the row above it can't peek through. Measuring the live thead height keeps
  // this exact even though the heading is two lines tall (reg + name).
  const headingHeight = thead.getBoundingClientRect().height;
  const delta =
    row.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top -
    headingHeight;
  scroller.scrollTop += delta;
};

function LoanCarDetailsModal({ car, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    ...car,
    reg: car?.reg || "",
    name: car?.name || car?.reg || "",
    sortOrder: car?.sortOrder ?? 0,
    notes: car?.notes || "",
  }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({
      ...car,
      reg: car?.reg || "",
      name: car?.name || car?.reg || "",
      sortOrder: car?.sortOrder ?? 0,
      notes: car?.notes || "",
    });
    setMessage("");
  }, [car]);

  if (!car) return null;

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.reg.trim()) {
      setMessage("Enter a registration before saving.");
      return;
    }
    setSaving(true);
    setMessage("");
    const reg = form.reg.trim().toUpperCase();
    const result = await onSave({
      ...form,
      reg,
      name: reg,
      loanCarId: car.loanCarId || car.id,
      id: car.id || car.loanCarId,
    });
    setSaving(false);
    if (!result?.success) {
      setMessage(result?.error?.message || "Unable to save loan car.");
      return;
    }
    onClose();
  };

  const handleDelete = async () => {
    setSaving(true);
    setMessage("");
    const result = await onDelete(car.loanCarId || car.id);
    setSaving(false);
    if (result?.success === false) {
      setMessage(result?.error?.message || "Unable to remove loan car.");
      return;
    }
    onClose();
  };

  return (
    <div
      className="popup-backdrop"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: LOAN_CAR_MODAL_Z_INDEX,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(0, 0, 0, 0.48)",
      }}>
      <LayerSurface
        as="form"
        onSubmit={handleSave}
        sectionKey="loan-car-details-popup"
        sectionType="modal"
        radius="var(--radius-sm)"
        padding="var(--section-card-padding)"
        gap="var(--layout-card-gap)"
        style={{ width: "min(560px, 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-1)", fontSize: "20px" }}>{car.reg || "Loan car"}</h2>
            <p style={{ margin: "4px 0 0", color: "var(--grey-accent)", fontSize: "13px" }}>
              Edit this loan car or remove it from the fleet list.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" pill onClick={onClose} aria-label="Close loan car details">
            X
          </Button>
        </div>

        <div style={fieldGridStyle}>
          <Field label="Loan car reg" value={form.reg} onChange={(value) => update("reg", value.toUpperCase())} />
          <Field label="Order" type="number" value={form.sortOrder} onChange={(value) => update("sortOrder", value)} />
        </div>

        <label style={labelStyle}>
          Notes
          <textarea className="app-input app-input--textarea" value={form.notes || ""} onChange={(event) => update("notes", event.target.value)} rows={3} />
        </label>

        {message ? <p style={{ margin: 0, color: "var(--danger)", fontSize: "13px" }}>{message}</p> : null}

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button type="button" variant="danger" onClick={handleDelete} disabled={saving}>
            Remove loan car
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !form.reg.trim()}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </LayerSurface>
    </div>
  );
}

function FleetManager({ cars, onSave, onDelete, onBook }) {
  const [activeTab, setActiveTab] = useState("book");
  const [draft, setDraft] = useState({ reg: "", name: "", sortOrder: 0, notes: "" });
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState(null);
  const [vehicleLookup, setVehicleLookup] = useState(null);
  const [vehicleLookupLoading, setVehicleLookupLoading] = useState(false);
  const [vehicleMessage, setVehicleMessage] = useState("");
  const [bookingSearchTerm, setBookingSearchTerm] = useState("");
  const [bookingMatches, setBookingMatches] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingDraft, setBookingDraft] = useState(() => ({
    ...EMPTY_BOOKING,
    loanCarId: cars[0]?.loanCarId || cars[0]?.id || "",
    startDate: todayDateKey(),
    endDate: todayDateKey(),
  }));
  const activeDraft = editDraft || draft;
  const loanCarOptions = useMemo(
    () => [
      { value: "", label: "Choose loan car" },
      ...cars.map((car) => ({
        value: car.loanCarId || car.id,
        label: car.reg,
      })),
    ],
    [cars]
  );

  useEffect(() => {
    if (bookingDraft.loanCarId || cars.length === 0) return;
    setBookingDraft((prev) => ({ ...prev, loanCarId: cars[0]?.loanCarId || cars[0]?.id || "" }));
  }, [bookingDraft.loanCarId, cars]);

  const updateDraft = (field, value) => {
    if (editDraft) {
      setEditDraft((prev) => ({ ...prev, [field]: value }));
      return;
    }
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateBookingDraft = (field, value) => {
    setBookingDraft((prev) => ({ ...prev, [field]: value }));
  };

  const startEditing = (car) => {
    setActiveTab("add-vehicle");
    setEditingId(car.loanCarId || car.id);
    setEditDraft(car);
    setVehicleLookup(null);
    setVehicleMessage("");
  };

  const stopEditing = () => {
    setEditingId("");
    setEditDraft(null);
  };

  const lookupVehicle = async () => {
    const reg = String(activeDraft.reg || "").trim().toUpperCase();
    if (!reg) {
      setVehicleMessage("Enter a registration before searching.");
      return;
    }

    updateDraft("reg", reg);
    setVehicleLookupLoading(true);
    setVehicleMessage("");

    try {
      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: reg }),
      });
      const rawText = await response.text();
      if (!response.ok) {
        let payload = null;
        try {
          payload = JSON.parse(rawText);
        } catch {
          payload = null;
        }
        throw new Error(payload?.message || payload?.error || rawText || "Unable to fetch vehicle data.");
      }
      const data = rawText ? JSON.parse(rawText) : {};
      if (!data || Object.keys(data).length === 0) {
        throw new Error("No vehicle data returned for that registration.");
      }
      setVehicleLookup(data);
      setVehicleMessage("Vehicle found. Add it to the loan car fleet when ready.");
    } catch (error) {
      setVehicleLookup(null);
      setVehicleMessage(error.message || "Unable to fetch vehicle data.");
    } finally {
      setVehicleLookupLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!draft.reg.trim()) return;
    const topSortOrder = Math.min(0, ...cars.map((car) => Number(car.sortOrder ?? 0))) - 1;
    const reg = draft.reg.trim().toUpperCase();
    const result = await onSave({ ...draft, reg, name: reg, sortOrder: topSortOrder });
    // Only treat it as added once the DB write actually succeeds — otherwise
    // surface the real error instead of a misleading success message.
    if (!result?.success) {
      setVehicleMessage(result?.error?.message || "Unable to add loan vehicle.");
      return;
    }
    setDraft({ reg: "", name: "", sortOrder: topSortOrder - 1, notes: "" });
    setVehicleLookup(null);
    setVehicleMessage("Loan vehicle added to the table.");
  };

  const handleSaveEdit = async () => {
    if (!editDraft?.reg?.trim()) return;
    const reg = editDraft.reg.trim().toUpperCase();
    const result = await onSave({ ...editDraft, reg, name: reg });
    if (!result?.success) {
      setVehicleMessage(result?.error?.message || "Unable to update loan vehicle.");
      return;
    }
    stopEditing();
  };

  const runBookingSearch = async () => {
    const term = bookingSearchTerm.trim();
    if (term.length < 2) {
      setBookingMessage("Enter at least 2 characters to search.");
      return;
    }
    setBookingLoading(true);
    setBookingMessage("");
    const rows = await searchLoanCarBookingTargets(term);
    setBookingMatches(rows);
    setBookingLoading(false);
    if (rows.length === 0) {
      setBookingMessage("No jobs found for that search.");
    }
  };

  const applyBookingMatch = (match) => {
    setBookingDraft((prev) => ({
      ...prev,
      ...match,
      loanCarId: prev.loanCarId,
      startDate: prev.startDate || todayDateKey(),
      endDate: prev.endDate || prev.startDate || todayDateKey(),
    }));
    setBookingMatches([]);
    setBookingSearchTerm(`${match.jobNumber || ""}${match.vehicleReg ? ` - ${match.vehicleReg}` : ""}`.trim());
    setBookingMessage("Job loaded into the booking form.");
  };

  const handleBook = async () => {
    if (!bookingDraft.loanCarId || !bookingDraft.startDate || !bookingDraft.endDate) {
      setBookingMessage("Choose a loan car and booking dates first.");
      return;
    }
    setBookingLoading(true);
    setBookingMessage("");
    const result = await onBook(bookingDraft);
    setBookingLoading(false);
    if (!result?.success) {
      setBookingMessage(result?.error?.message || "Unable to save loan car booking.");
      return;
    }
    setBookingMessage("Booking added to the table.");
    setBookingDraft((prev) => ({
      ...EMPTY_BOOKING,
      loanCarId: prev.loanCarId,
      startDate: todayDateKey(),
      endDate: todayDateKey(),
    }));
    setBookingSearchTerm("");
  };

  const renderVehicleLookupSummary = () => {
    if (!vehicleLookup) return null;
    const rows = [
      ["Make", vehicleLookup.make || vehicleLookup.vehicleMake],
      ["Model", vehicleLookup.model || vehicleLookup.vehicleModel],
      ["Colour", vehicleLookup.colour || vehicleLookup.vehicleColour || vehicleLookup.bodyColour],
      ["Tax status", vehicleLookup.taxStatus],
      ["MOT status", vehicleLookup.motStatus],
    ].filter(([, value]) => value);
    if (rows.length === 0) return null;
    return (
      <LayerSurface radius="var(--radius-sm)" padding="12px" gap="8px">
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "12px", color: "var(--text-1)" }}>
            <span style={{ color: "var(--grey-accent)" }}>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </LayerSurface>
    );
  };

  return (
    <LayerTheme
      as="section"
      sectionKey="tracking-loan-car-fleet-manager"
      sectionType="section-shell"
      radius="var(--radius-sm)"
      padding="var(--section-card-padding)"
      gap="var(--layout-card-gap)">
      <TabGroup
        items={[
          { value: "book", label: "Book" },
          { value: "add-vehicle", label: "Add vehicle" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Loan car manager tabs"
        className="tab-api--wrap"
      />

      {activeTab === "add-vehicle" ? <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, color: "var(--text-1)", fontSize: "16px" }}>Loan vehicles</h3>
          <p style={{ margin: "4px 0 0", color: "var(--grey-accent)", fontSize: "13px" }}>
            Add or edit the vehicle columns used by the booking table.
          </p>
        </div>
        {editDraft ? (
          <Button type="button" variant="secondary" size="sm" onClick={stopEditing}>
            Done editing
          </Button>
        ) : null}
      </div> : null}

      {activeTab === "add-vehicle" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 240px) auto auto", gap: "8px", alignItems: "end", maxWidth: "520px" }}>
            <Field label="Reg search" value={activeDraft.reg} onChange={(value) => updateDraft("reg", value.toUpperCase())} />
            <Button type="button" variant="secondary" onClick={lookupVehicle} disabled={vehicleLookupLoading || !activeDraft.reg.trim()}>
              {vehicleLookupLoading ? "Searching..." : "Search"}
            </Button>
            {!editDraft ? (
              <Button type="button" variant="primary" size="sm" onClick={handleAdd} disabled={!draft.reg.trim()}>
                Add loan vehicle
              </Button>
            ) : (
              <Button type="button" variant="primary" size="sm" onClick={handleSaveEdit} disabled={!editDraft.reg.trim()}>
                Save loan vehicle
              </Button>
            )}
          </div>
          {renderVehicleLookupSummary()}
          {vehicleMessage ? <p style={{ margin: 0, color: "var(--grey-accent)", fontSize: "13px" }}>{vehicleMessage}</p> : null}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {cars.map((car) => (
              <div
                key={car.loanCarId || car.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto auto",
                  gap: "8px",
                  alignItems: "center",
                  minHeight: "44px",
                }}>
                <div style={{ minWidth: 0, color: "var(--text-1)" }}>
                  <strong>{car.reg}</strong>
                  <span style={{ color: "var(--grey-accent)" }}> - {car.name || car.reg || "Loan vehicle"}</span>
                </div>
                <Button type="button" variant={editingId === (car.loanCarId || car.id) ? "primary" : "secondary"} size="xs" onClick={() => startEditing(car)}>
                  {editingId === (car.loanCarId || car.id) ? "Editing" : "Edit"}
                </Button>
                <Button type="button" variant="danger" size="xs" onClick={() => onDelete(car.loanCarId || car.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={fieldGridStyle}>
            <DropdownField
              label="Loan car"
              value={bookingDraft.loanCarId || ""}
              onValueChange={(value) => updateBookingDraft("loanCarId", value)}
              options={loanCarOptions}
              placeholder="Choose loan car"
            />
            <Field label="From" type="date" value={bookingDraft.startDate} onChange={(value) => updateBookingDraft("startDate", value)} />
            <Field label="To" type="date" value={bookingDraft.endDate} onChange={(value) => updateBookingDraft("endDate", value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "8px", alignItems: "end" }}>
            <Field label="Search customer reg, name, or job number" value={bookingSearchTerm} onChange={setBookingSearchTerm} />
            <Button type="button" variant="secondary" onClick={runBookingSearch} disabled={bookingLoading || bookingSearchTerm.trim().length < 2}>
              {bookingLoading ? "Searching..." : "Search"}
            </Button>
          </div>

          {bookingMatches.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {bookingMatches.map((match) => (
                <button
                  key={`${match.jobId}-${match.vehicleReg}`}
                  type="button"
                  onClick={() => applyBookingMatch(match)}
                  style={{
                    minHeight: "44px",
                    border: 0,
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--surface)",
                    color: "var(--text-1)",
                    padding: "10px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}>
                  <strong>#{match.jobNumber || "Job"} - {match.vehicleReg || "No reg"}</strong>
                  <span style={{ display: "block", color: "var(--grey-accent)", fontSize: "12px" }}>
                    {match.customerName || "Customer"} {match.vehicleMakeModel ? `- ${match.vehicleMakeModel}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div style={fieldGridStyle}>
            <Field label="Job number" value={bookingDraft.jobNumber} onChange={(value) => updateBookingDraft("jobNumber", value)} />
            <Field label="Customer name" value={bookingDraft.customerName} onChange={(value) => updateBookingDraft("customerName", value)} />
            <Field label="Customer vehicle reg" value={bookingDraft.vehicleReg} onChange={(value) => updateBookingDraft("vehicleReg", value.toUpperCase())} />
            <Field label="Vehicle" value={bookingDraft.vehicleMakeModel} onChange={(value) => updateBookingDraft("vehicleMakeModel", value)} />
          </div>

          <Button type="button" variant="primary" size="sm" onClick={handleBook} disabled={bookingLoading || !bookingDraft.loanCarId || !bookingDraft.startDate || !bookingDraft.endDate}>
            Save booking
          </Button>
          {bookingMessage ? <p style={{ margin: 0, color: "var(--grey-accent)", fontSize: "13px" }}>{bookingMessage}</p> : null}
        </>
      )}
    </LayerTheme>
  );
}

function BookingModal({ cars, selected, onClose, onSaved, jobDraft }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_BOOKING,
    ...jobDraft,
    ...selected.booking,
    loanCarId: selected.car?.loanCarId || selected.car?.id || selected.booking?.loanCarId || jobDraft?.loanCarId || "",
    startDate: selected.booking?.startDate || selected.day?.key || jobDraft?.startDate || "",
    endDate: selected.booking?.endDate || selected.day?.key || jobDraft?.endDate || "",
  }));
  const [searchTerm, setSearchTerm] = useState("");
  const [matches, setMatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const loanCarOptions = useMemo(
    () =>
      cars.map((car) => ({
        value: car.loanCarId || car.id,
        label: `${car.reg} - ${car.name}`,
      })),
    [cars]
  );
  const selectedLoanCarLabel =
    loanCarOptions.find((option) => option.value === form.loanCarId)?.label ||
    selected.car?.reg ||
    "";

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const runSearch = async () => {
    const rows = await searchLoanCarBookingTargets(searchTerm);
    setMatches(rows);
  };

  const applyMatch = (match) => {
    setForm((prev) => ({
      ...prev,
      ...match,
      startDate: prev.startDate,
      endDate: prev.endDate,
      loanCarId: prev.loanCarId,
      bookingId: prev.bookingId,
    }));
    setMatches([]);
    setSearchTerm("");
  };

  const copyValue = async (value, key) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(String(value));
    setCopiedKey(key || String(value));
    window.setTimeout(() => setCopiedKey(""), 1200);
  };

  const copyFormValue = (key, value) => copyValue(value, key);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    const result = await saveLoanCarBooking(form);
    setSaving(false);
    if (result.success) {
      onSaved();
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!form.bookingId && !form.id) return;
    setSaving(true);
    const result = await deleteLoanCarBooking(form.bookingId || form.id);
    setSaving(false);
    if (result.success) {
      onSaved();
      onClose();
    }
  };

  return (
    <div
      className="popup-backdrop"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: LOAN_CAR_MODAL_Z_INDEX,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(0, 0, 0, 0.48)",
      }}>
      <LayerSurface
        as="form"
        onSubmit={handleSave}
        sectionKey="loan-car-booking-details-popup"
        sectionType="modal"
        radius="var(--radius-sm)"
        padding="var(--section-card-padding)"
        gap="var(--layout-card-gap)"
        style={{
          width: "min(1180px, 100%)",
          maxHeight: "calc(100dvh - 32px)",
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-1)", fontSize: "20px" }}>
              {selected.car?.reg || "Loan car"} booking
            </h2>
            <p style={{ margin: "4px 0 0", color: "var(--grey-accent)", fontSize: "13px" }}>
              {selected.day?.dateLabel || form.startDate}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" pill onClick={onClose} aria-label="Close loan car booking">
            X
          </Button>
        </div>

        <LayerTheme
          as="section"
          sectionKey="loan-car-booking-search"
          sectionType="section-shell"
          radius="var(--radius-sm)"
          padding="var(--section-card-padding)"
          gap="var(--layout-card-gap)">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "8px", alignItems: "end" }}>
            <Field label="Find by reg, job number, or customer name" value={searchTerm} onChange={setSearchTerm} />
            <Button type="button" variant="secondary" onClick={runSearch} disabled={searchTerm.trim().length < 2}>
              Search
            </Button>
          </div>
          {matches.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {matches.map((match) => (
                <button
                  key={`${match.jobId}-${match.vehicleReg}`}
                  type="button"
                  onClick={() => applyMatch(match)}
                  style={{
                    minHeight: "44px",
                    border: 0,
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--surface)",
                    color: "var(--text-1)",
                    padding: "10px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}>
                  <strong>#{match.jobNumber || "Job"} - {match.vehicleReg || "No reg"}</strong>
                  <span style={{ display: "block", color: "var(--grey-accent)", fontSize: "12px" }}>
                    {match.customerName || "Customer"} {match.vehicleMakeModel ? `- ${match.vehicleMakeModel}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </LayerTheme>

        <div style={compactBookingFieldGridStyle}>
          <CopyableField label="Loan car" valueToCopy={selectedLoanCarLabel} copied={copiedKey === "loanCarId"} onCopy={(value) => copyFormValue("loanCarId", value)}>
            <DropdownField
              label="Loan car"
              value={form.loanCarId || ""}
              onValueChange={(value) => update("loanCarId", value)}
              options={loanCarOptions}
              placeholder="Choose loan car"
            />
          </CopyableField>
          <CopyableField label="From" valueToCopy={form.startDate} copied={copiedKey === "startDate"} onCopy={(value) => copyFormValue("startDate", value)}>
            <Field label="From" type="date" value={form.startDate} onChange={(value) => update("startDate", value)} />
          </CopyableField>
          <CopyableField label="To" valueToCopy={form.endDate} copied={copiedKey === "endDate"} onCopy={(value) => copyFormValue("endDate", value)}>
            <Field label="To" type="date" value={form.endDate} onChange={(value) => update("endDate", value)} />
          </CopyableField>
          {BOOKING_FORM_FIELDS.map((field) => (
            <CopyableField
              key={field.key}
              label={field.label}
              valueToCopy={form[field.key]}
              copied={copiedKey === field.key}
              onCopy={(value) => copyFormValue(field.key, value)}
            >
              <Field
                label={field.label}
                type={field.type || "text"}
                value={form[field.key]}
                onChange={(value) => update(field.key, field.transform ? field.transform(value) : value)}
              />
            </CopyableField>
          ))}
        </div>

        <label style={labelStyle}>
          Notes
          <textarea className="app-input app-input--textarea" value={form.notes || ""} onChange={(event) => update("notes", event.target.value)} rows={3} />
        </label>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          {form.bookingId || form.id ? (
            <Button type="button" variant="danger" onClick={handleDelete} disabled={saving}>
              Delete booking
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !form.loanCarId || !form.startDate || !form.endDate}>
            {saving ? "Saving..." : "Save booking"}
          </Button>
        </div>
      </LayerSurface>
    </div>
  );
}

export default function LoanCarSchedulePanel({
  jobData = null,
  highlightedJobNumber = "",
  highlightedReg = "",
  mode = "job-card",
  refreshKey = 0,
  searchTerm = "",
  showFleetManager = false,
}) {
  const scrollRef = useRef(null);
  const todayRowRef = useRef(null);
  const hasAutoScrolledTodayRef = useRef(false);
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedLoanCar, setSelectedLoanCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const dateRows = useMemo(() => buildDateRows(), []);
  const jobDraft = buildJobBookingDraft({ jobData, highlightedJobNumber, highlightedReg });
  const highlightedJob = String(highlightedJobNumber || jobData?.jobNumber || "").trim().toLowerCase();
  const highlightedVehicle = String(highlightedReg || jobData?.reg || "").trim().toLowerCase();
  const normalizedSearchTerm = String(searchTerm || "").trim().toLowerCase();
  const visibleCars = useMemo(() => {
    if (!normalizedSearchTerm) return cars;
    const bookingMatches = new Set(
      bookings
        .filter((booking) =>
          [
            booking.jobNumber,
            booking.customerName,
            booking.customer,
            booking.vehicleReg,
            booking.reg,
            booking.vehicleMakeModel,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedSearchTerm))
        )
        .map((booking) => booking.loanCarId)
    );
    return cars.filter((car) => {
      const carMatches = [car.reg, car.name, car.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearchTerm));
      return carMatches || bookingMatches.has(car.loanCarId || car.id);
    });
  }, [bookings, cars, normalizedSearchTerm]);
  const visibleBookings = useMemo(() => {
    if (!normalizedSearchTerm) return bookings;
    const visibleCarIds = new Set(visibleCars.map((car) => car.loanCarId || car.id));
    return bookings.filter((booking) => visibleCarIds.has(booking.loanCarId));
  }, [bookings, normalizedSearchTerm, visibleCars]);
  const isTrackingMode = mode === "tracking";
  const dayColumnWidth = isTrackingMode ? 160 : 180;
  const trackingCarColumnWidth = "10ch";
  const trackingTableWidth = `calc(${dayColumnWidth}px + ${visibleCars.length * 10}ch)`;
  const tableMinWidth = isTrackingMode
    ? trackingTableWidth
    : `${Math.max(680, dayColumnWidth + visibleCars.length * 200)}px`;
  const tableWidth = "100%";

  const loadData = useCallback(async () => {
    setLoading(true);
    const firstDay = dateRows[0]?.key;
    const lastDay = dateRows[dateRows.length - 1]?.key;
    const [nextCars, nextBookings] = await Promise.all([
      getLoanCars(),
      getLoanCarScheduleBookings({ startDate: firstDay, endDate: lastDay }),
    ]);
    setCars(nextCars);
    setBookings(nextBookings);
    setLoading(false);
  }, [dateRows]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  useEffect(() => {
    if (mode !== "tracking" || loading || hasAutoScrolledTodayRef.current) return;
    if (!todayRowRef.current || !scrollRef.current) return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        scrollTodayIntoView(todayRowRef);
        hasAutoScrolledTodayRef.current = true;
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [loading, mode, visibleCars.length]);

  const handleSaveCar = async (car) => {
    const isNewCar = !(car.loanCarId || car.id);
    const result = await saveLoanCar(car);
    if (result.success) {
      await loadData();
      if (isNewCar && scrollRef.current) {
        scrollRef.current.scrollLeft = 0;
      }
    }
    return result;
  };

  const handleDeleteCar = async (loanCarId) => {
    const result = await deleteLoanCar(loanCarId);
    if (result.success) loadData();
    return result;
  };

  const handleSaveBooking = async (booking) => {
    const result = await saveLoanCarBooking(booking);
    if (result.success) {
      await loadData();
    }
    return result;
  };

  const content = (
    <>
      {mode !== "tracking" ? (
        <div>
          <h3 style={{ margin: 0, color: "var(--text-1)", fontSize: "18px", fontWeight: 700 }}>
            Loan Car Booking
          </h3>
          <p style={{ margin: "4px 0 0", color: "var(--grey-accent)", fontSize: "13px" }}>
            Click a day and loan vehicle to view or book the loan period.
          </p>
        </div>
      ) : null}

      {mode === "tracking" && showFleetManager ? <FleetManager cars={cars} onSave={handleSaveCar} onDelete={handleDeleteCar} onBook={handleSaveBooking} /> : null}

      <LayerTheme
        as="section"
        sectionKey={`${mode}-loan-car-appointments-table-scroll`}
        sectionType="data-table"
        radius="var(--radius-sm)"
        padding="var(--section-card-padding)"
        gap="0">
        <div
          ref={scrollRef}
          className={[
            "tabs-scroll-container-visible",
            isTrackingMode ? "" : "app-table-shell-scroll",
            isTrackingMode ? "tracking-loan-car-appointments-table-scroll" : "loan-car-appointments-table-scroll",
          ].filter(Boolean).join(" ")}
          data-loan-car-table-scroll={isTrackingMode ? "true" : undefined}
          data-app-table-shell={isTrackingMode ? "off" : undefined}
          style={{
            overflowX: "auto",
            overflowY: "auto",
            backgroundColor: "var(--theme)",
            maxHeight: isTrackingMode ? "calc(100dvh - 380px)" : "560px",
            borderRadius: "var(--radius-md)",
            "--app-table-heading-mask-height": "0px", // thead is already opaque; suppress the shared sticky mask band
          }}>
          <table
            className={isTrackingMode ? undefined : "app-data-table app-table-shell app-table-shell--with-headings"}
            id={`${mode}-loan-car-appointments-table`}
            data-dev-section="1"
            data-dev-section-key={`${mode}-loan-car-appointments-table`}
            data-dev-section-type="data-table"
            data-app-table-shell={isTrackingMode ? "off" : undefined}
            style={{
              minWidth: tableMinWidth,
              width: tableWidth,
              tableLayout: "fixed",
              borderCollapse: "separate",
              borderSpacing: isTrackingMode ? "1px 0" : 0,
              backgroundColor: "var(--theme)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}>
            <colgroup>
              <col style={{ width: `${dayColumnWidth}px` }} />
              {visibleCars.map((car) => (
                <col key={car.loanCarId || car.id} style={{ width: isTrackingMode ? trackingCarColumnWidth : "200px" }} />
              ))}
              {isTrackingMode ? <col style={{ width: "auto" }} /> : null}
            </colgroup>
            <thead
              data-dev-section="1"
              data-dev-section-key={`${mode}-loan-car-appointments-table-headings`}
              data-dev-section-type="table-headings"
              data-dev-section-parent={`${mode}-loan-car-appointments-table`}
              style={{ position: "sticky", top: 0, zIndex: 120, height: "44px", maxHeight: "44px", lineHeight: 0, overflow: "hidden", ...stickyHeadingBg }}>
              <tr style={{ height: "44px", maxHeight: "44px", lineHeight: 0 }}>
                <th
                  style={{
                    left: 0,
                    position: "sticky",
                    top: 0,
                    zIndex: 122,
                    height: "44px",
                    minHeight: "44px",
                    maxHeight: "44px",
                    boxSizing: "border-box",
                    padding: isTrackingMode ? "0 12px" : undefined,
                    textAlign: "left",
                    lineHeight: 0,
                    overflow: "hidden",
                    ...stickyHeadingBg,
                  }}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => scrollTodayIntoView(todayRowRef)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        scrollTodayIntoView(todayRowRef);
                      }
                    }}
                    style={{
                      color: "inherit",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "block",
                      height: "44px",
                      lineHeight: "44px",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}>
                    data
                  </span>
                </th>
                {visibleCars.map((car) => (
                  <th
                    key={car.loanCarId || car.id}
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 121,
                      height: "44px",
                      minHeight: "44px",
                      maxHeight: "44px",
                      boxSizing: "border-box",
                      padding: isTrackingMode ? 0 : undefined,
                      textAlign: "center",
                      lineHeight: 0,
                      overflow: "hidden",
                      ...stickyHeadingBg,
                    }}>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedLoanCar(car)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedLoanCar(car);
                        }
                      }}
                      style={{
                        color: "inherit",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "block",
                        height: "44px",
                        lineHeight: "44px",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}>
                      {car.reg}
                    </span>
                  </th>
                ))}
                {isTrackingMode ? (
                  <th
                    aria-hidden="true"
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 120,
                      height: "44px",
                      minHeight: "44px",
                      maxHeight: "44px",
                      boxSizing: "border-box",
                      padding: 0,
                      lineHeight: 0,
                      overflow: "hidden",
                      ...stickyHeadingBg,
                    }}
                  />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {dateRows.map((day) => {
                const todayRowOverlay = day.isToday ? "linear-gradient(var(--theme), var(--theme))" : undefined;
                const rowBackground = "var(--surface)";
                return (
                <tr
                  key={day.key}
                  ref={day.isToday ? todayRowRef : null}
                  className={day.isToday ? "loan-car-today-row" : undefined}
                  style={{ height: "44px", maxHeight: "44px", lineHeight: 0, backgroundColor: rowBackground, backgroundImage: todayRowOverlay }}>
                  <td
                    className={day.isToday ? "loan-car-today-cell" : undefined}
                    style={{
                      height: "44px",
                      minHeight: "44px",
                      maxHeight: "44px",
                      boxSizing: "border-box",
                      padding: "0 12px",
                      verticalAlign: "middle",
                      left: 0,
                      position: "sticky",
                      zIndex: 2,
                      lineHeight: 0,
                      overflow: "hidden",
                      ...stickyFirstColBg,
                      backgroundImage: todayRowOverlay,
                    }}>
                    <span
                      style={{
                        display: "block",
                        height: "44px",
                        maxHeight: "44px",
                        color: day.isToday ? "var(--primary-selected)" : "var(--text-1)",
                        fontWeight: day.isToday ? 800 : 700,
                        lineHeight: "44px",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}>
                      {day.compactDateLabel}
                    </span>
                  </td>
                  {visibleCars.map((car) => {
                    const booking = getBookingForCell(visibleBookings, car.loanCarId || car.id, day.key);
                    const cellBackground = booking ? "var(--warning-strong)" : rowBackground;
                    return (
                    <td
                      key={`${day.key}-${car.loanCarId || car.id}`}
                      className={[
                        day.isToday ? "loan-car-today-cell" : "",
                        booking ? "loan-car-booked-cell" : "",
                      ].filter(Boolean).join(" ") || undefined}
                      style={{
                        height: "44px",
                        minHeight: "44px",
                        maxHeight: "44px",
                        boxSizing: "border-box",
                        padding: 0,
                        verticalAlign: "middle",
                        lineHeight: 0,
                        overflow: "hidden",
                        backgroundColor: isTrackingMode ? cellBackground : booking ? "var(--warning-surface)" : day.isToday ? "var(--theme)" : undefined,
                        backgroundImage: isTrackingMode ? todayRowOverlay : undefined,
                      }}>
                        <BookingCell
                          booking={booking}
                          highlightedJob={highlightedJob}
                          highlightedVehicle={highlightedVehicle}
                          fixedHeight={isTrackingMode}
                          onClick={() => setSelectedCell({ day, car, booking })}
                        />
                      </td>
                    );
                  })}
                  {isTrackingMode ? (
                    <td
                      aria-hidden="true"
                      style={{
                        height: "44px",
                        minHeight: "44px",
                        maxHeight: "44px",
                        boxSizing: "border-box",
                        padding: 0,
                        verticalAlign: "middle",
                        lineHeight: 0,
                        overflow: "hidden",
                        backgroundColor: rowBackground,
                        backgroundImage: todayRowOverlay,
                      }}
                    />
                  ) : null}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </LayerTheme>

      {!loading && cars.length === 0 ? (
        <p style={{ margin: 0, color: "var(--grey-accent)", fontSize: "13px" }}>
          Add a loan vehicle in the tracking loan-car section to start booking.
        </p>
      ) : null}

      {selectedCell ? (
        <BookingModal
          cars={cars}
          selected={selectedCell}
          jobDraft={jobDraft}
          onClose={() => setSelectedCell(null)}
          onSaved={loadData}
        />
      ) : null}

      {selectedLoanCar ? (
        <LoanCarDetailsModal
          car={selectedLoanCar}
          onClose={() => setSelectedLoanCar(null)}
          onSave={handleSaveCar}
          onDelete={handleDeleteCar}
        />
      ) : null}
    </>
  );

  if (mode === "tracking") {
    return content;
  }

  return (
    <LayerSurface
      as="section"
      sectionKey="job-card-loan-car-schedule-panel"
      sectionType="section-shell"
      parentKey="jobcard-tab-loan-car"
      radius="var(--radius-sm)"
      padding="var(--section-card-padding)"
      gap="var(--layout-card-gap)">
      {content}
    </LayerSurface>
  );
}
