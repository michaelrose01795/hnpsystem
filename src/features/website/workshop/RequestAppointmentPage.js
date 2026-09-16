// file location: src/features/website/workshop/RequestAppointmentPage.js
//
// /website/request-appointment — the "Book workshop" quick action and the Service
// & Parts booking panel land here with the customer's request, registration and
// preferred day already filled in (?request=, ?reg=, ?date=).
// The page collects the rest: name, how to reach them and a preferred day.
//
// SUBMISSION
// ----------
// There is no public intake endpoint for workshop requests yet (appointments in
// the DMS hang off a job and are created by staff). Until one exists, confirming
// the request shows the customer a summary and the workshop phone number to
// lock the booking in, rather than pretending it has been sent.
//
// Full width (.ws-page-split): the form on the left with its fields side by side,
// and the workshop hours, phone and next steps in a side column. Styling reuses
// the valuation wizard's form classes (.ws-val-*) and the shared .ws-* controls.
// No inline visual styling.

import { useMemo, useState } from "react";

import StockShell from "../stock/StockShell";
import useWebsiteContent from "../hooks/useWebsiteContent";
import InfoList from "../components/InfoList";
import WebsiteNativeSelect from "../components/WebsiteNativeSelect";
import WebsiteNativeDateTimeInput from "../components/WebsiteNativeDateTimeInput";
import { formatReg, normaliseReg } from "@/lib/valuation/vehicleValuation";

const first = (value) => (Array.isArray(value) ? value[0] : value) || "";

const TIME_OPTIONS = [
  { value: "morning", label: "Morning drop-off" },
  { value: "afternoon", label: "Afternoon" },
  { value: "wait", label: "I would like to wait" },
  { value: "any", label: "Any time" },
];

// Mirrors SUBMISSION above: the request is confirmed by phone.
const NEXT_STEPS = [
  "Tell us what your car needs and when suits you",
  "Call our service team to confirm your time",
  "Bring your car in on the day",
];

export default function RequestAppointmentPage({ initialQuery = {} }) {
  const { content } = useWebsiteContent();
  const { contact } = content.siteContent;
  const serviceHours = Array.isArray(contact?.serviceHours) ? contact.serviceHours : [];
  const addressLine = (Array.isArray(contact?.address) ? contact.address : []).filter(Boolean).join(", ");

  const [form, setForm] = useState(() => ({
    request: first(initialQuery.request),
    registration: normaliseReg(first(initialQuery.reg)),
    name: "",
    phone: "",
    email: "",
    // ?date= from the home page booking panel; anything that is not an ISO day
    // is ignored rather than shown as a broken value.
    date: /^\d{4}-\d{2}-\d{2}$/.test(first(initialQuery.date)) ? first(initialQuery.date) : "",
    time: "any",
  }));
  const [submitted, setSubmitted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const set = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setBlocked(false);
  };

  const complete = Boolean(form.request.trim() && form.registration && form.name.trim() && (form.phone.trim() || form.email.trim()));
  const timeLabel = useMemo(() => TIME_OPTIONS.find((o) => o.value === form.time)?.label, [form.time]);

  const onSubmit = (event) => {
    event.preventDefault();
    if (!complete) {
      setBlocked(true);
      return;
    }
    setSubmitted(true);
  };

  return (
    <StockShell
      backToSite
      title="Request a workshop appointment - Humphries & Parks"
      description="Tell us what your car needs - a service, MOT or repair - and request a workshop appointment at Humphries & Parks in West Malling, Kent."
    >
      <section className="ws-section ws-val-hero">
        <div className="ws-container ws-val-container">
          <span className="ws-eyebrow">Service &amp; MOT</span>
          <h1 className="ws-h1">Request a workshop appointment</h1>
          <p className="ws-lead">
            Tell us what needs doing and when suits you. Our service team will confirm a time.
          </p>
        </div>
      </section>

      <section className="ws-section ws-val-body">
        <div className="ws-container">
          <div className="ws-page-split">
            <div className="ws-page-main">
              <div className="ws-card ws-panel ws-val-panel">
                {!submitted ? (
                  <form onSubmit={onSubmit}>
                    <h2 className="ws-h3">Your request</h2>

                    <div className="ws-val-field">
                      <label className="ws-val-label" htmlFor="appt-request">
                        What do you need?
                      </label>
                      <textarea
                        id="appt-request"
                        rows={4}
                        placeholder="Service, MOT, a warning light, a noise from the front…"
                        value={form.request}
                        onChange={(e) => set({ request: e.target.value })}
                      />
                    </div>

                    <div className="ws-val-grid-2">
                      <div className="ws-val-field">
                        <label className="ws-val-label" htmlFor="appt-reg">
                          Registration
                        </label>
                        <input
                          id="appt-reg"
                          type="text"
                          className="ws-reg-input"
                          placeholder="AB12 CDE"
                          autoComplete="off"
                          autoCapitalize="characters"
                          spellCheck="false"
                          maxLength={10}
                          value={form.registration}
                          onChange={(e) => set({ registration: e.target.value.toUpperCase() })}
                        />
                      </div>

                      <div className="ws-val-field">
                        <label className="ws-val-label" htmlFor="appt-date">
                          Preferred day
                        </label>
                        <WebsiteNativeDateTimeInput
                          id="appt-date"
                          type="date"
                          value={form.date}
                          onChange={(value) => set({ date: value })}
                        />
                      </div>

                      <div className="ws-val-field">
                        <span className="ws-val-label">Preferred time</span>
                        <WebsiteNativeSelect
                          value={form.time}
                          onChange={(value) => set({ time: value })}
                          options={TIME_OPTIONS}
                          placeholder=""
                          aria-label="Preferred time"
                        />
                      </div>
                    </div>

                    <h2 className="ws-h3">Your details</h2>

                    <div className="ws-val-grid-2">
                      <div className="ws-val-field">
                        <label className="ws-val-label" htmlFor="appt-name">
                          Name
                        </label>
                        <input
                          id="appt-name"
                          type="text"
                          autoComplete="name"
                          value={form.name}
                          onChange={(e) => set({ name: e.target.value })}
                        />
                      </div>

                      <div className="ws-val-field">
                        <label className="ws-val-label" htmlFor="appt-phone">
                          Phone
                        </label>
                        <input
                          id="appt-phone"
                          type="tel"
                          autoComplete="tel"
                          value={form.phone}
                          onChange={(e) => set({ phone: e.target.value })}
                        />
                      </div>

                      <div className="ws-val-field">
                        <label className="ws-val-label" htmlFor="appt-email">
                          Email
                        </label>
                        <input
                          id="appt-email"
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={(e) => set({ email: e.target.value })}
                        />
                      </div>
                    </div>
                    <p className="ws-val-hint">A phone number or an email address is fine.</p>

                    {blocked ? (
                      <div className="ws-val-notice" role="status">
                        <p>Please tell us what you need, your registration, your name and a phone number or email.</p>
                      </div>
                    ) : null}

                    <div className="ws-val-nav">
                      <button type="submit" className="ws-btn ws-btn--primary">
                        Request appointment
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h2 className="ws-h3">Nearly done, {form.name.trim()}</h2>
                    <p className="ws-muted">
                      Here is your request. Give our service team a call to confirm a time.
                    </p>
                    <div className="ws-val-found">
                      <span className="ws-val-plate">{formatReg(form.registration)}</span>
                      <div className="ws-val-found-body">
                        <p className="ws-val-found-title">{form.date || "Any day"} · {timeLabel}</p>
                        <p className="ws-muted">{form.request}</p>
                      </div>
                    </div>
                    <div className="ws-val-nav">
                      <button type="button" onClick={() => setSubmitted(false)}>
                        Change my request
                      </button>
                      {contact?.phone ? (
                        <a href={contact.phoneHref || `tel:${contact.phone}`} className="ws-btn ws-btn--primary">
                          Call {contact.phone}
                        </a>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>

            <aside className="ws-page-aside" aria-label="About workshop appointments">
              <div className="ws-card ws-panel ws-info-card">
                <h2 className="ws-card-title">What happens next</h2>
                <ul className="ws-ticks">
                  {NEXT_STEPS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              {contact?.phone || addressLine || serviceHours.length ? (
                <div className="ws-card ws-panel ws-info-card">
                  <h2 className="ws-card-title">Our workshop</h2>
                  <InfoList
                    items={[
                      contact?.phone ? ["Phone", contact.phone, contact.phoneHref] : null,
                      addressLine ? ["Address", addressLine] : null,
                    ]}
                  />
                  {serviceHours.length ? (
                    <ul className="ws-val-hours">
                      {serviceHours.map((row) => (
                        <li key={row.days}>
                          <span>{row.days}</span>
                          <span>{row.time}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </section>
    </StockShell>
  );
}
