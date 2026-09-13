// file location: src/features/website/showcase/sections/SelectShowcase.js
//
// /website/dev — @family select (WebsiteNativeSelect) and @family dropdown (the
// shared Dropdown API as custglobal.css restyles it under the customer scope).
// The live control is the real component; the open states are rendered static
// so every row state is visible at once.

import { useState } from "react";
import WebsiteNativeSelect from "@/features/website/components/WebsiteNativeSelect";
import { Row, ShowcaseSection } from "../ShowcasePrimitives";

const OPTIONS = [
  { value: "service", label: "Service booking", hint: "Annual and interim" },
  { value: "mot", label: "MOT test", hint: "Class 4" },
  { value: "valuation", label: "Vehicle valuation" },
  { value: "callback", label: "Call-back request" },
];

export default function SelectShowcase({ section }) {
  const [value, setValue] = useState("service");
  const [empty, setEmpty] = useState("");

  return (
    <ShowcaseSection id="select" section={section}>
      <Row label="Select" hint="WebsiteNativeSelect">
        <div className="website-dev-field">
          <WebsiteNativeSelect value={value} onChange={setValue} options={OPTIONS} />
          <WebsiteNativeSelect value={empty} onChange={setEmpty} options={OPTIONS} placeholder="Choose a booking type" />
          <WebsiteNativeSelect disabled value="service" onChange={() => {}} options={OPTIONS} />
        </div>
      </Row>

      <Row label="Open menu" hint="selected · active · empty">
        <div className="website-dev-stack">
          <div className="website-dev-menu-frame">
            <div className="website-native-select" data-open="true">
              <button type="button" className="website-native-select__trigger" aria-expanded="true">
                <span className="website-native-select__value">MOT test</span>
                <span className="website-native-select__caret" aria-hidden="true" />
              </button>
              <ul role="listbox" aria-label="Booking type" className="website-native-select__menu website-dev-select-static">
                <li role="option" aria-selected="false" className="website-native-select__option">
                  <span className="website-native-select__option-label">Service booking</span>
                  <span className="website-native-select__option-hint">Annual and interim</span>
                </li>
                <li
                  role="option"
                  aria-selected="true"
                  className="website-native-select__option website-native-select__option--selected"
                >
                  <span className="website-native-select__option-label">MOT test</span>
                  <span className="website-native-select__option-hint">Class 4</span>
                </li>
                <li role="option" aria-selected="false" className="website-native-select__option website-native-select__option--active">
                  <span className="website-native-select__option-label">Vehicle valuation</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="website-dev-menu-frame">
            <ul role="listbox" aria-label="No options" className="website-native-select__menu website-dev-select-static">
              <li className="website-native-select__empty">No options</li>
            </ul>
          </div>
        </div>
      </Row>

      <Row label="Dropdown API" hint=".dropdown-api · open">
        <div className="website-dev-menu-frame">
          <div className="dropdown-api is-open">
            <span className="dropdown-api__label">Booking type</span>
            <button type="button" className="dropdown-api__control" aria-expanded="true">
              <span className="dropdown-api__value">MOT test</span>
              <span className="dropdown-api__chevron" aria-hidden="true">
                ▾
              </span>
            </button>
            <div role="listbox" aria-label="Booking type" className="dropdown-api__menu app-dropdown-menu website-dev-select-static">
              <button type="button" role="option" aria-selected="false" className="dropdown-api__option">
                <span className="dropdown-api__option-label">Service booking</span>
                <span className="dropdown-api__option-description">Annual and interim</span>
              </button>
              <button type="button" role="option" aria-selected="true" className="dropdown-api__option is-selected">
                <span className="dropdown-api__option-label">MOT test</span>
                <span className="dropdown-api__option-description">Class 4</span>
              </button>
            </div>
            <span className="dropdown-api__helper">Helper text</span>
          </div>
        </div>
      </Row>

      <Row label="Dropdown API" hint="placeholder · empty">
        <div className="website-dev-menu-frame">
          <div className="dropdown-api">
            <span className="dropdown-api__label">Model</span>
            <button type="button" className="dropdown-api__control">
              <span className="dropdown-api__value is-placeholder">Choose an option</span>
              <span className="dropdown-api__chevron" aria-hidden="true">
                ▾
              </span>
            </button>
            <div className="dropdown-api__menu app-dropdown-menu website-dev-select-static">
              <div className="dropdown-api__empty">No matching options</div>
            </div>
          </div>
        </div>
      </Row>
    </ShowcaseSection>
  );
}
