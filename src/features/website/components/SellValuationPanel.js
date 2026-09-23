// file location: src/features/website/components/SellValuationPanel.js
//
// The lead form at the top of the Sell Your Car block: registration, mileage
// and postcode, then one strong valuation CTA.
//
// It does not value the car itself. It checks the three answers and hands
// them to the valuation wizard as ?reg=&mileage=&postcode=, where the reg is
// looked up with DVLA straight away and the mileage is already filled in — so
// the customer lands on the next question rather than re-typing anything.
//
// Styling: custglobal.css @family marketing (.ws-valuation-*), with the
// shared field label (.ws-stock-field) and number-plate input (.ws-reg-input).

import { useId, useState } from "react";
import { useRouter } from "next/router";

import { isPlausibleReg, normaliseReg } from "@/lib/valuation/vehicleValuation";

// Full UK postcode, space optional: "ME19 5AN", "me195an".
const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const formatPostcode = (value) => {
  const compact = String(value || "").replace(/\s+/g, "").toUpperCase();
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
};
const digitsOnly = (value) => String(value || "").replace(/[^\d]/g, "");

export default function SellValuationPanel({
  title = "Value your car",
  ctaLabel = "Get your free valuation",
  href = "/website/valuation",
  note = "Free and no obligation. We only use your details to value your car.",
}) {
  const router = useRouter();
  const uid = useId();
  const ids = {
    reg: `${uid}-reg`,
    mileage: `${uid}-mileage`,
    postcode: `${uid}-postcode`,
    error: `${uid}-error`,
  };

  const [reg, setReg] = useState("");
  const [mileage, setMileage] = useState("");
  const [postcode, setPostcode] = useState("");
  const [errors, setErrors] = useState({});

  const onSubmit = (event) => {
    event.preventDefault();
    const next = {};
    if (!isPlausibleReg(normaliseReg(reg))) next.reg = "Enter your registration, for example AB12 CDE.";
    if (!digitsOnly(mileage)) next.mileage = "Enter your approximate mileage.";
    if (!POSTCODE_RE.test(postcode.trim())) next.postcode = "Enter your postcode, for example ME19 5AN.";
    setErrors(next);
    if (Object.keys(next).length) return;
    router.push({
      pathname: href,
      query: {
        reg: normaliseReg(reg),
        mileage: digitsOnly(mileage),
        postcode: formatPostcode(postcode),
      },
    });
  };

  const messages = Object.values(errors);
  const fieldProps = (key) => ({
    "aria-invalid": errors[key] ? "true" : undefined,
    "aria-describedby": errors[key] ? ids.error : undefined,
  });

  return (
    <div className="ws-card ws-panel ws-valuation-panel">
      {title ? <h3 className="ws-h3">{title}</h3> : null}
      <form className="ws-valuation-form" onSubmit={onSubmit} noValidate>
        <div className="ws-valuation-fields">
          <label className="ws-stock-field ws-valuation-field--reg" htmlFor={ids.reg}>
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
              onChange={(e) => setReg(e.target.value.toUpperCase())}
              {...fieldProps("reg")}
            />
          </label>
          <label className="ws-stock-field" htmlFor={ids.mileage}>
            <span className="ws-stock-label">Mileage</span>
            <input
              id={ids.mileage}
              type="text"
              inputMode="numeric"
              placeholder="e.g. 45,000"
              autoComplete="off"
              maxLength={9}
              value={mileage}
              onChange={(e) => setMileage(e.target.value.replace(/[^\d,]/g, ""))}
              {...fieldProps("mileage")}
            />
          </label>
          <label className="ws-stock-field" htmlFor={ids.postcode}>
            <span className="ws-stock-label">Postcode</span>
            <input
              id={ids.postcode}
              type="text"
              placeholder="ME19 5AN"
              autoComplete="postal-code"
              autoCapitalize="characters"
              spellCheck="false"
              maxLength={8}
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              {...fieldProps("postcode")}
            />
          </label>
        </div>
        {messages.length ? (
          <div id={ids.error} className="ws-val-notice" role="alert">
            {messages.map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
        ) : null}
        <button type="submit" className="ws-btn ws-btn--primary ws-valuation-cta">
          {ctaLabel}
        </button>
        {note ? <p className="ws-valuation-note">{note}</p> : null}
      </form>
    </div>
  );
}
