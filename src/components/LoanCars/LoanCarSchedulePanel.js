import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { Button } from "@/components/ui";
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

const COPY_FIELDS = [
  ["Customer", "customerName"],
  ["Email", "customerEmail"],
  ["Phone", "customerPhone"],
  ["Address", "customerAddress"],
  ["Postcode", "customerPostcode"],
  ["Job number", "jobNumber"],
  ["Customer vehicle reg", "vehicleReg"],
  ["Vehicle", "vehicleMakeModel"],
  ["Mileage", "mileage"],
  ["Insurance provider", "insuranceProvider"],
  ["Policy number", "insurancePolicyNumber"],
  ["Licence number", "licenceNumber"],
  ["Date of birth", "dateOfBirth"],
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

const inputStyle = {
  width: "100%",
  minHeight: "44px",
  border: 0,
  borderRadius: "var(--control-radius)",
  boxShadow: "inset 0 0 0 1px var(--input-ring)",
  backgroundColor: "var(--surface)",
  color: "var(--text-1)",
  padding: "10px 12px",
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

function Field({ label, value, onChange, type = "text", children }) {
  return (
    <label style={labelStyle}>
      {label}
      {children || <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} style={inputStyle} />}
    </label>
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

function CopyField({ label, value, onCopy, copied }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: "8px",
        alignItems: "center",
      }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "var(--grey-accent)", fontSize: "11px", fontWeight: 700 }}>{label}</div>
        <div style={{ color: "var(--text-1)", fontSize: "13px", overflowWrap: "anywhere" }}>{value || "Not set"}</div>
      </div>
      <Button type="button" variant="ghost" size="xs" onClick={() => onCopy(value)} disabled={!value} aria-label={`Copy ${label}`} title={copied ? "Copied" : `Copy ${label}`}>
        {copied ? "Copied" : <ClipboardIcon />}
      </Button>
    </div>
  );
}

function BookingCell({ booking, onClick, highlightedJob, highlightedVehicle }) {
  const isHighlighted =
    booking &&
    ((highlightedJob && String(booking.jobNumber || "").toLowerCase() === highlightedJob) ||
      (highlightedVehicle && String(booking.vehicleReg || booking.reg || "").toLowerCase() === highlightedVehicle));

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: "44px",
        border: 0,
        borderRadius: "var(--radius-sm)",
        backgroundColor: booking ? (isHighlighted ? "rgba(var(--primary-rgb), 0.18)" : "var(--warning-surface)") : "transparent",
        color: booking ? "var(--text-1)" : "var(--success-dark)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "2px",
        padding: "4px 8px",
        textAlign: "left",
        lineHeight: 1.1,
        fontWeight: booking ? 600 : 700,
      }}>
      {booking ? (
        <>
          <strong style={{ fontSize: "12px" }}>
            #{booking.jobNumber || "Job"} {booking.vehicleReg ? `- ${booking.vehicleReg}` : ""}
          </strong>
          <span style={{ fontSize: "12px" }}>{booking.customerName || booking.customer || "Customer"}</span>
          {booking.startDate !== booking.endDate ? (
            <span style={{ fontSize: "11px", color: "var(--grey-accent)" }}>
              {booking.startDate} to {booking.endDate}
            </span>
          ) : null}
        </>
      ) : (
        "Available"
      )}
    </button>
  );
}

function FleetManager({ cars, onSave, onDelete }) {
  const [draft, setDraft] = useState({ reg: "", name: "", sortOrder: 0, notes: "" });
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState(null);
  const activeDraft = editDraft || draft;

  const updateDraft = (field, value) => {
    if (editDraft) {
      setEditDraft((prev) => ({ ...prev, [field]: value }));
      return;
    }
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const startEditing = (car) => {
    setEditingId(car.loanCarId || car.id);
    setEditDraft(car);
  };

  const stopEditing = () => {
    setEditingId("");
    setEditDraft(null);
  };

  const handleAdd = async () => {
    if (!draft.reg.trim()) return;
    await onSave(draft);
    setDraft({ reg: "", name: "", sortOrder: cars.length + 1, notes: "" });
  };

  const handleSaveEdit = async () => {
    if (!editDraft?.reg?.trim()) return;
    await onSave(editDraft);
    stopEditing();
  };

  return (
    <LayerTheme
      as="section"
      sectionKey="tracking-loan-car-fleet-manager"
      sectionType="section-shell"
      radius="var(--radius-sm)"
      padding="var(--section-card-padding)"
      gap="var(--layout-card-gap)">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
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
      </div>

      <div style={fieldGridStyle}>
        <Field label="Loan vehicle reg" value={activeDraft.reg} onChange={(value) => updateDraft("reg", value)} />
        <Field label="Display name" value={activeDraft.name} onChange={(value) => updateDraft("name", value)} />
        <Field label="Order" type="number" value={activeDraft.sortOrder} onChange={(value) => updateDraft("sortOrder", value)} />
        <Field label="Notes" value={activeDraft.notes} onChange={(value) => updateDraft("notes", value)} />
      </div>
      {!editDraft ? (
        <Button type="button" variant="primary" size="sm" onClick={handleAdd} disabled={!draft.reg.trim()}>
          Add loan vehicle
        </Button>
      ) : (
        <Button type="button" variant="primary" size="sm" onClick={handleSaveEdit} disabled={!editDraft.reg.trim()}>
          Save loan vehicle
        </Button>
      )}

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
              <span style={{ color: "var(--grey-accent)" }}> - {car.name || "Loan vehicle"}</span>
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

  const copyValue = async (value) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(String(value));
    setCopiedKey(String(value));
    window.setTimeout(() => setCopiedKey(""), 1200);
  };

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
        zIndex: 240,
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
          width: "min(960px, 100%)",
          maxHeight: "90dvh",
          overflowY: "auto",
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

        <div style={fieldGridStyle}>
          <Field label="Loan car" value={form.loanCarId} onChange={(value) => update("loanCarId", value)}>
            <select value={form.loanCarId || ""} onChange={(event) => update("loanCarId", event.target.value)} style={inputStyle}>
              {cars.map((car) => (
                <option key={car.loanCarId || car.id} value={car.loanCarId || car.id}>
                  {car.reg} - {car.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From" type="date" value={form.startDate} onChange={(value) => update("startDate", value)} />
          <Field label="To" type="date" value={form.endDate} onChange={(value) => update("endDate", value)} />
          <Field label="Job number" value={form.jobNumber} onChange={(value) => update("jobNumber", value)} />
          <Field label="Customer name" value={form.customerName} onChange={(value) => update("customerName", value)} />
          <Field label="Customer email" type="email" value={form.customerEmail} onChange={(value) => update("customerEmail", value)} />
          <Field label="Customer phone" value={form.customerPhone} onChange={(value) => update("customerPhone", value)} />
          <Field label="Address" value={form.customerAddress} onChange={(value) => update("customerAddress", value)} />
          <Field label="Postcode" value={form.customerPostcode} onChange={(value) => update("customerPostcode", value)} />
          <Field label="Customer vehicle reg" value={form.vehicleReg} onChange={(value) => update("vehicleReg", value)} />
          <Field label="Vehicle" value={form.vehicleMakeModel} onChange={(value) => update("vehicleMakeModel", value)} />
          <Field label="Mileage" type="number" value={form.mileage} onChange={(value) => update("mileage", value)} />
          <Field label="Insurance provider" value={form.insuranceProvider} onChange={(value) => update("insuranceProvider", value)} />
          <Field label="Policy number" value={form.insurancePolicyNumber} onChange={(value) => update("insurancePolicyNumber", value)} />
          <Field label="Licence number" value={form.licenceNumber} onChange={(value) => update("licenceNumber", value)} />
          <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={(value) => update("dateOfBirth", value)} />
        </div>

        <label style={labelStyle}>
          Notes
          <textarea value={form.notes || ""} onChange={(event) => update("notes", event.target.value)} rows={3} style={inputStyle} />
        </label>

        <LayerTheme
          as="section"
          sectionKey="loan-car-booking-copy-fields"
          sectionType="section-shell"
          radius="var(--radius-sm)"
          padding="var(--section-card-padding)"
          gap="var(--layout-card-gap)">
          <h3 style={{ margin: 0, color: "var(--text-1)", fontSize: "16px" }}>Insurance copy fields</h3>
          <div style={fieldGridStyle}>
            {COPY_FIELDS.map(([label, key]) => (
              <CopyField key={key} label={label} value={form[key]} onCopy={copyValue} copied={copiedKey === String(form[key] || "")} />
            ))}
          </div>
        </LayerTheme>

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
}) {
  const scrollRef = useRef(null);
  const todayRowRef = useRef(null);
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [loading, setLoading] = useState(true);
  const dateRows = useMemo(() => buildDateRows(), []);
  const jobDraft = buildJobBookingDraft({ jobData, highlightedJobNumber, highlightedReg });
  const highlightedJob = String(highlightedJobNumber || jobData?.jobNumber || "").trim().toLowerCase();
  const highlightedVehicle = String(highlightedReg || jobData?.reg || "").trim().toLowerCase();
  const tableMinWidth = Math.max(680, 180 + cars.length * 200);

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
  }, [loadData]);

  useEffect(() => {
    if (!todayRowRef.current || !scrollRef.current) return;
    todayRowRef.current.scrollIntoView({ block: "start" });
  }, []);

  const handleSaveCar = async (car) => {
    const result = await saveLoanCar(car);
    if (result.success) loadData();
  };

  const handleDeleteCar = async (loanCarId) => {
    const result = await deleteLoanCar(loanCarId);
    if (result.success) loadData();
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

      {mode === "tracking" ? <FleetManager cars={cars} onSave={handleSaveCar} onDelete={handleDeleteCar} /> : null}

      <div
        ref={scrollRef}
        className="app-table-shell-scroll"
        data-dev-section="1"
        data-dev-section-key={`${mode}-loan-car-appointments-table-scroll`}
        data-dev-section-type="data-table"
        style={{
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: mode === "tracking" ? "calc(100dvh - 380px)" : "560px",
        }}>
        <table
          className="app-data-table app-table-shell app-table-shell--with-headings"
          data-dev-section="1"
          data-dev-section-key={`${mode}-loan-car-appointments-table`}
          data-dev-section-type="data-table"
          style={{ minWidth: "100%", width: `${tableMinWidth}px`, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "180px" }} />
            {cars.map((car) => (
              <col key={car.loanCarId || car.id} style={{ width: "200px" }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ left: 0, position: "sticky", zIndex: 3, backgroundColor: "var(--surface)" }}>
                Appointment Day
              </th>
              {cars.map((car) => (
                <th key={car.loanCarId || car.id}>
                  {car.reg}
                  <span style={{ display: "block", marginTop: "2px", fontSize: "11px", color: "var(--grey-accent)" }}>
                    {car.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dateRows.map((day) => (
              <tr
                key={day.key}
                ref={day.isToday ? todayRowRef : null}
                style={{ height: "44px", backgroundColor: day.isToday ? "var(--theme)" : undefined }}>
                <td
                  style={{
                    height: "44px",
                    padding: "0 12px",
                    verticalAlign: "middle",
                    left: 0,
                    position: "sticky",
                    zIndex: 2,
                    backgroundColor: day.isToday ? "var(--theme)" : "var(--surface)",
                  }}>
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      color: day.isToday ? "var(--primary-selected)" : "var(--text-1)",
                      fontWeight: day.isToday ? 800 : 700,
                      lineHeight: 1.15,
                    }}>
                    <span>{day.label}</span>
                    <span style={{ fontSize: "12px", color: day.isToday ? "var(--primary-selected)" : "var(--grey-accent)" }}>
                      {day.isToday ? "Today" : day.dateLabel}
                    </span>
                  </span>
                </td>
                {cars.map((car) => {
                  const booking = getBookingForCell(bookings, car.loanCarId || car.id, day.key);
                  return (
                    <td
                      key={`${day.key}-${car.loanCarId || car.id}`}
                      style={{
                        height: "44px",
                        padding: "0 12px",
                        verticalAlign: "middle",
                        backgroundColor: day.isToday ? "var(--theme)" : undefined,
                      }}>
                      <BookingCell
                        booking={booking}
                        highlightedJob={highlightedJob}
                        highlightedVehicle={highlightedVehicle}
                        onClick={() => setSelectedCell({ day, car, booking })}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
