// file location: src/features/website/components/WorkshopBookingPanel.js
//
// A compact workshop booking panel: registration, required work, preferred
// date, then the booking CTA. Reusable anywhere on the customer site.
//
// It feeds the existing booking flow rather than inventing one: submitting
// opens /website/request-appointment with ?reg=&request=&date= prefilled, and
// that page collects the contact details and confirms the request.
//
//   services  [{ id, title, request? }] — the "Required work" choices. Only
//             entries with a `request` book through the workshop.
//
// Styling: custglobal.css @family marketing (.ws-booking-*), with the shared
// field label (.ws-stock-field), number-plate input (.ws-reg-input), and the
// customer select / date wrappers.

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/router";

import WebsiteNativeSelect from "./WebsiteNativeSelect";
import WebsiteNativeDateTimeInput from "./WebsiteNativeDateTimeInput";
import { isPlausibleReg, normaliseReg } from "@/lib/valuation/vehicleValuation";

const todayIso = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function WorkshopBookingPanel({
  services,
  title = "Book your workshop visit",
  body,
  ctaLabel = "Book workshop",
  href = "/website/request-appointment",
  children,
}) {
  const router = useRouter();
  const uid = useId();
  const ids = { reg: `${uid}-reg`, date: `${uid}-date`, error: `${uid}-error` };

  const options = useMemo(
    () => [
      { value: "", label: "Choose the work needed" },
      ...(Array.isArray(services) ? services : [])
        .filter((s) => s?.request)
        .map((s) => ({ value: s.request, label: s.title })),
      { value: "Something else", label: "Something else" },
    ],
    [services],
  );

  const [reg, setReg] = useState("");
  const [work, setWork] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  // The date wrapper only reads `min` on the client; computing it once on
  // mount keeps the server and client markup identical.
  const [minDate] = useState(todayIso);

  const onSubmit = (event) => {
    event.preventDefault();
    const plate = normaliseReg(reg);
    if (plate && !isPlausibleReg(plate)) {
      setError("That registration does not look right — for example AB12 CDE.");
      return;
    }
    setError("");
    const query = {};
    if (plate) query.reg = plate;
    if (work) query.request = work;
    if (date) query.date = date;
    router.push({ pathname: href, query });
  };

  return (
    <div className="ws-card ws-panel ws-booking-panel">
      <div className="ws-booking-head">
        {title ? <h3 className="ws-h3">{title}</h3> : null}
        {body ? <p className="ws-muted">{body}</p> : null}
      </div>
      <form className="ws-booking-form" onSubmit={onSubmit} noValidate>
        <label className="ws-stock-field" htmlFor={ids.reg}>
          <span className="ws-stock-label">Registration</span>
          <input
            id={ids.reg}
            type="text"
            className="ws-reg-input"
            placeholder="AB12 CDE"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck="false"
            maxLength={10}
            value={reg}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? ids.error : undefined}
            onChange={(e) => {
              setReg(e.target.value.toUpperCase());
              setError("");
            }}
          />
        </label>
        <div className="ws-stock-field">
          <span className="ws-stock-label" aria-hidden="true">
            Required work
          </span>
          <WebsiteNativeSelect
            value={work}
            onChange={setWork}
            options={options}
            placeholder=""
            aria-label="Required work"
          />
        </div>
        <div className="ws-stock-field">
          <label className="ws-stock-label" htmlFor={ids.date}>
            Preferred date
          </label>
          <WebsiteNativeDateTimeInput id={ids.date} type="date" min={minDate} value={date} onChange={setDate} />
        </div>
        {error ? (
          <div id={ids.error} className="ws-val-notice" role="alert">
            <p>{error}</p>
          </div>
        ) : null}
        <button type="submit" className="ws-btn ws-btn--primary ws-booking-cta">
          {ctaLabel}
        </button>
      </form>
      {children}
    </div>
  );
}
