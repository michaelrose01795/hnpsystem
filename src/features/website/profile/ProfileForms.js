// file location: src/features/website/profile/ProfileForms.js
//
// The request forms a customer can submit from the portal: booking, service
// requests, valuation, showroom callback, mileage and adding a vehicle, plus
// the message composer and the small field primitives they share.
//
// Every form is presentation + local draft state only. Submission is handed
// back to src/pages/website/profile.js, which owns the single
// /api/website/actions call and the refresh of the bundled payload — the same
// contract these forms had before the portal was split into views. The two
// that talk to their own endpoints (DVLA lookup, mileage) keep doing so.

import { useState } from "react";
import WebsiteNativeSelect from "@/features/website/components/WebsiteNativeSelect";
import WebsiteNativeDateTimeInput from "@/features/website/components/WebsiteNativeDateTimeInput";
import { formatCurrency, formatDate } from "./profileUtils";

// ── Field primitives ────────────────────────────────────────────────────

export function FieldInput({ label, value, onChange, type = "text" }) {
  return (
    <div className="ws-portal-field">
      <label className="ws-portal-label">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// Custom switch — custglobal.css deliberately avoids checkbox styling on
// /website, so this is a role=switch element rather than a native checkbox.
export function Toggle({ label, checked, onChange }) {
  const toggle = () => onChange(!checked);
  return (
    <div
      className="ws-portal-toggle"
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <span className="ws-portal-toggle__label">{label}</span>
      <span className="ws-portal-toggle__track">
        <span className="ws-portal-toggle__knob" />
      </span>
    </div>
  );
}

// One vehicle picker for every form that needs one.
export function VehicleField({ label, vehicles, value, onChange, placeholder = "Select..." }) {
  return (
    <div className="ws-portal-field">
      <label className="ws-portal-label">{label}</label>
      <WebsiteNativeSelect
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        options={vehicles.map((v) => ({
          value: String(v.vehicle_id),
          label: `${v.reg_number || "—"} · ${[v.make, v.model].filter(Boolean).join(" ")}`,
        }))}
      />
    </div>
  );
}

// ── Messages ────────────────────────────────────────────────────────────

export function MessageComposer({ onSend, flash }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <>
      <div className="ws-portal-compose">
        <textarea
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="ws-portal-grow"
          aria-label="Message"
        />
        <button
          type="button"
          className="app-btn"
          disabled={sending || !body.trim()}
          onClick={async () => {
            setSending(true);
            await onSend(body.trim());
            setBody("");
            setSending(false);
          }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </>
  );
}

// ── Workshop booking ────────────────────────────────────────────────────

export function BookServiceForm({ vehicles, onSubmit, flash, submitLabel = "Request booking", prefill = "" }) {
  const [vehicleId, setVehicleId] = useState("");
  const [description, setDescription] = useState(prefill);
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="ws-portal-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!description.trim()) return;
        setSubmitting(true);
        await onSubmit({
          vehicle_id: vehicleId || null,
          description: description.trim(),
          preferred_date: preferredDate || null,
        });
        setDescription("");
        setPreferredDate("");
        setSubmitting(false);
      }}
    >
      <div className="ws-portal-form-row">
        <VehicleField label="Vehicle" vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
        <div className="ws-portal-field">
          <label className="ws-portal-label">Preferred date</label>
          <WebsiteNativeDateTimeInput
            type="date"
            value={preferredDate}
            onChange={setPreferredDate}
            placeholder="Pick a date"
          />
        </div>
      </div>
      <div className="ws-portal-field">
        <label className="ws-portal-label">What do you need?</label>
        <textarea
          placeholder="e.g. annual service + brake check"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <button type="submit" className="app-btn" disabled={submitting || !description.trim()}>
        {submitting ? "Sending…" : submitLabel}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </form>
  );
}

// ── Service requests ────────────────────────────────────────────────────

// The request panel the Services launcher reveals once a customer picks a
// service. `service` is one entry from SERVICES in ProfileServices.js; its
// `action` is the /api/website/actions verb the page submits.
export function ServiceRequestForm({ service, vehicles, onSubmit, flash }) {
  const [vehicleId, setVehicleId] = useState("");
  const [details, setDetails] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="ws-portal-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!details.trim()) return;
        setSubmitting(true);
        await onSubmit(
          service.action,
          {
            service_type: service.id,
            vehicle_id: vehicleId || null,
            description: details.trim(),
            preferred_date: preferredDate || null,
          },
          service.title,
        );
        setDetails("");
        setPreferredDate("");
        setSubmitting(false);
      }}
    >
      <div className="ws-portal-form-row">
        <VehicleField
          label="Vehicle (optional)"
          vehicles={vehicles}
          value={vehicleId}
          onChange={setVehicleId}
          placeholder="Not specific to a vehicle"
        />
        <div className="ws-portal-field">
          <label className="ws-portal-label">Preferred date</label>
          <WebsiteNativeDateTimeInput type="date" value={preferredDate} onChange={setPreferredDate} />
        </div>
      </div>
      <div className="ws-portal-field">
        <label className="ws-portal-label">Tell us a bit more</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={`e.g. ${service.hint.toLowerCase()}`}
        />
      </div>
      <button type="submit" className="app-btn" disabled={submitting || !details.trim()}>
        {submitting ? "Sending…" : `Request ${service.title.toLowerCase()}`}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </form>
  );
}

export function SellCarForm({ onSubmit, flash }) {
  const [reg, setReg] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [condition, setCondition] = useState("Excellent");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="ws-portal-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reg.trim()) return;
        setSubmitting(true);
        await onSubmit({
          reg: reg.trim(),
          make_model: makeModel.trim(),
          mileage: mileage ? Number(mileage) : null,
          condition,
          notes: notes.trim(),
        });
        setReg("");
        setMakeModel("");
        setMileage("");
        setNotes("");
        setSubmitting(false);
      }}
    >
      <div className="ws-portal-form-row">
        <FieldInput label="Registration" value={reg} onChange={setReg} />
        <FieldInput label="Make & model" value={makeModel} onChange={setMakeModel} />
      </div>
      <div className="ws-portal-form-row">
        <FieldInput label="Mileage" value={mileage} onChange={setMileage} type="number" />
        <div className="ws-portal-field">
          <label className="ws-portal-label">Condition</label>
          <WebsiteNativeSelect
            value={condition}
            onChange={setCondition}
            options={[
              { value: "Excellent", label: "Excellent" },
              { value: "Good", label: "Good" },
              { value: "Average", label: "Average" },
              { value: "Below average", label: "Below average" },
            ]}
          />
        </div>
      </div>
      <div className="ws-portal-field">
        <label className="ws-portal-label">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Service history, modifications, anything else we should know."
        />
      </div>
      <button type="submit" className="app-btn" disabled={submitting || !reg.trim()}>
        {submitting ? "Sending…" : "Get free valuation"}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </form>
  );
}

export function ShowroomCallbackForm({ onSubmit, flash }) {
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="ws-portal-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!interest.trim()) return;
        setSubmitting(true);
        await onSubmit({
          vehicle_interest: interest.trim(),
          notes: notes.trim(),
          callback_date: callbackDate || null,
        });
        setInterest("");
        setNotes("");
        setCallbackDate("");
        setSubmitting(false);
      }}
    >
      <FieldInput label="Which vehicle?" value={interest} onChange={setInterest} />
      <div className="ws-portal-form-row">
        <div className="ws-portal-field">
          <label className="ws-portal-label">Preferred callback</label>
          <WebsiteNativeDateTimeInput type="date" value={callbackDate} onChange={setCallbackDate} />
        </div>
        <FieldInput label="Notes" value={notes} onChange={setNotes} />
      </div>
      <button type="submit" className="app-btn" disabled={submitting || !interest.trim()}>
        {submitting ? "Sending…" : "Request callback"}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </form>
  );
}

// ── Garage tools ────────────────────────────────────────────────────────

// Posts straight to /api/website/actions/update-mileage (not the shared
// actions verb), so it owns its own request and error state.
export function UpdateMileageRow({ vehicles, onSaved, flash }) {
  const [vehicleId, setVehicleId] = useState("");
  const [mileage, setMileage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Update mileage</div>
          <p className="ws-portal-hint">Help us flag the next service at the right time.</p>
        </div>
      </div>
      {error ? <p className="ws-portal-error">{error}</p> : null}
      <div className="ws-portal-form-row">
        <VehicleField label="Vehicle" vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
        <div className="ws-portal-field">
          <label className="ws-portal-label">Current mileage</label>
          <input
            type="number"
            inputMode="numeric"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="e.g. 48250"
          />
        </div>
      </div>
      <button
        type="button"
        className="app-btn"
        disabled={saving || !vehicleId || !mileage}
        onClick={async () => {
          setError("");
          setSaving(true);
          try {
            const res = await fetch("/api/website/actions/update-mileage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ vehicle_id: Number(vehicleId), mileage: Number(mileage) }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.message || "Could not update mileage.");
            }
            setMileage("");
            onSaved();
          } catch (err) {
            setError(err.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Save mileage"}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

// Registration lookup fills make and model from /api/vehicles/dvla before the
// vehicle is added through the page's own add-vehicle call.
export function AddVehicleRow({ onSubmit, flash }) {
  const [reg, setReg] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const handleFetchVehicleData = async () => {
    if (!reg.trim()) {
      setLookupError("Please enter a registration number");
      return;
    }
    setIsLoadingVehicle(true);
    setLookupError("");
    try {
      const regUpper = reg.trim().toUpperCase();
      const response = await fetch("/api/vehicles/dvla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: regUpper }),
      });
      const responseText = await response.text();
      if (!response.ok) {
        let parsed;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          parsed = null;
        }
        throw new Error(parsed?.message || parsed?.error || "We could not look that registration up.");
      }
      let data = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error("We could not read the vehicle details for that registration.");
        }
      }
      if (!data || Object.keys(data).length === 0) {
        throw new Error("No vehicle details found for that registration.");
      }
      const normalizedReg = (data.registrationNumber || data.registration || regUpper || "")
        .toString()
        .toUpperCase();
      const detectedMake = data.make || data.vehicleMake || "";
      const detectedModel = data.model || data.vehicleModel || "";
      const combined = `${detectedMake} ${detectedModel}`.trim();
      setReg(normalizedReg);
      setMakeModel(combined || detectedMake || "");
    } catch (err) {
      setLookupError(err.message || "Could not look up vehicle");
    } finally {
      setIsLoadingVehicle(false);
    }
  };

  return (
    <div className="ws-portal-settings-row">
      <div className="ws-portal-card__header">
        <div>
          <div className="ws-portal-item-title">Add a vehicle</div>
          <p className="ws-portal-hint">We&apos;ll add this to your account straight away.</p>
        </div>
      </div>
      <div className="ws-portal-form-row">
        <div className="ws-portal-field">
          <label className="ws-portal-label">Registration</label>
          <div className="ws-portal-action-row">
            <input
              type="text"
              value={reg}
              onChange={(e) => setReg(e.target.value)}
              placeholder="e.g. AB12 CDE"
              className="ws-reg-input"
            />
            <button
              type="button"
              className="app-btn"
              onClick={handleFetchVehicleData}
              disabled={isLoadingVehicle || !reg.trim()}
            >
              {isLoadingVehicle ? "Loading…" : "Search"}
            </button>
          </div>
        </div>
        <FieldInput label="Make & model" value={makeModel} onChange={setMakeModel} />
      </div>
      {lookupError ? <p className="ws-portal-error">{lookupError}</p> : null}
      <div className="ws-portal-form-row">
        <FieldInput label="Mileage (optional)" value={mileage} onChange={setMileage} type="number" />
        <FieldInput label="Notes (optional)" value={notes} onChange={setNotes} />
      </div>
      <button
        type="button"
        className="app-btn"
        disabled={submitting || !reg.trim()}
        onClick={async () => {
          setSubmitting(true);
          await onSubmit({
            reg: reg.trim(),
            make_model: makeModel.trim(),
            mileage: mileage ? Number(mileage) : null,
            notes: notes.trim(),
          });
          setReg("");
          setMakeModel("");
          setMileage("");
          setNotes("");
          setSubmitting(false);
        }}
      >
        {submitting ? "Adding…" : "Add"}
      </button>
      {flash ? <p className="ws-portal-flash">{flash}</p> : null}
    </div>
  );
}

// ── Live job detail tags ────────────────────────────────────────────────

// The extra facts about a live visit that only apply sometimes: a mobile
// visit, an ETA, a courtesy car, and what was authorised or declined on the
// vehicle health check.
export function ActiveJobTags({ job, bookingRequest, vhcSent }) {
  if (!job) return null;
  const tags = [];
  if ((job.service_mode || "").toLowerCase() === "mobile") {
    tags.push({
      key: "mobile",
      label: `Mobile visit${job.service_postcode ? ` · ${job.service_postcode}` : ""}`,
      tone: "accent",
    });
  }
  if (bookingRequest?.estimated_completion) {
    tags.push({ key: "eta", label: `Ready by ${formatDate(bookingRequest.estimated_completion)}`, tone: "default" });
  }
  if (bookingRequest?.loan_car_details) {
    tags.push({ key: "loan", label: `Courtesy car · ${bookingRequest.loan_car_details}`, tone: "ok" });
  }
  if (Number(job.vhc_authorized_total) > 0) {
    tags.push({ key: "vhc-auth", label: `Approved ${formatCurrency(job.vhc_authorized_total)}`, tone: "ok" });
  }
  if (Number(job.vhc_declined_total) > 0) {
    tags.push({ key: "vhc-dec", label: `Declined ${formatCurrency(job.vhc_declined_total)}`, tone: "default" });
  }
  if (vhcSent?.sent_at) {
    tags.push({ key: "vhc-sent", label: `Health check sent ${formatDate(vhcSent.sent_at)}`, tone: "default" });
  }
  if (tags.length === 0) return null;
  return (
    <div className="ws-portal-action-row">
      {tags.map((t) => (
        <span key={t.key} className="ws-portal-tag" data-tone={t.tone}>
          {t.label}
        </span>
      ))}
    </div>
  );
}
