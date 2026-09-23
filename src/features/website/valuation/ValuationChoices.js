// file location: src/features/website/valuation/ValuationChoices.js
//
// The two answer controls the valuation wizard is built from: a single-choice
// group and a multi-choice tick list. Both render REAL radio / checkbox inputs
// inside the label rather than a div with aria-checked, so keyboard support,
// arrow-key roving within a radio group, form semantics and screen-reader
// announcements come from the browser instead of from code that has to be kept
// right by hand.
//
// Styling is entirely custglobal.css (.ws-val-*). The whole label is the target
// so every option clears the 44px touch floor on a phone.

import { useId } from "react";

/**
 * Single-choice group. One of `options` may be selected at a time.
 *
 * @param {string} legend    Question text, rendered as the fieldset legend.
 * @param {string} [hint]    Optional supporting line under the legend.
 * @param {Array}  options   [{ value, label, hint? }]
 * @param {string} value     Currently selected value.
 * @param {Function} onChange  (value) => void
 * @param {string} [columns] "two" lays the options out in a responsive 2-up grid.
 */
export function ChoiceGroup({ legend, hint, options = [], value, onChange, columns = "one" }) {
  const name = useId();

  return (
    <fieldset className="ws-val-fieldset">
      <legend className="ws-val-legend">{legend}</legend>
      {hint ? <p className="ws-val-hint">{hint}</p> : null}
      <div className="ws-val-options" data-columns={columns}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className="ws-val-option"
              data-selected={selected ? "true" : "false"}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
              />
              <span className="ws-val-option-body">
                <span className="ws-val-option-label">{option.label}</span>
                {option.hint ? <span className="ws-val-option-hint">{option.hint}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Multi-choice tick list. `value` is an array; toggling adds or removes.
 *
 * @param {string} legend
 * @param {string} [hint]
 * @param {Array}  options  [{ value, label, hint? }]
 * @param {string[]} value
 * @param {Function} onChange  (nextValues) => void
 */
export function TickList({ legend, hint, options = [], value = [], onChange }) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (optionValue) => {
    onChange(
      selected.includes(optionValue)
        ? selected.filter((v) => v !== optionValue)
        : [...selected, optionValue],
    );
  };

  return (
    <fieldset className="ws-val-fieldset">
      <legend className="ws-val-legend">{legend}</legend>
      {hint ? <p className="ws-val-hint">{hint}</p> : null}
      <div className="ws-val-options" data-columns="two">
        {options.map((option) => {
          const isOn = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className="ws-val-option"
              data-selected={isOn ? "true" : "false"}
            >
              <input
                type="checkbox"
                value={option.value}
                checked={isOn}
                onChange={() => toggle(option.value)}
              />
              <span className="ws-val-option-body">
                <span className="ws-val-option-label">{option.label}</span>
                {option.hint ? <span className="ws-val-option-hint">{option.hint}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
