// file location: src/features/stockAccess/AccessBits.js
//
// Small shared pieces for Stock Access: the status badge (badges family) and
// the quantity stepper — big − / + buttons around the number, plus one-tap
// quantity chips, so most movements need no typing at all.

import React from "react";
import { Button, InputField } from "@/components/ui";
import { allowsFractions, formatQuantity, quickQuantities, roundQuantity, toNumber, unitLabel } from "@/features/stockAccess/stockAccessModel";
import styles from "@/features/stockAccess/stockAccess.module.css";

// Model tones -> badges family variants (there is no info badge; the soft
// accent chip is the family's neutral-positive).
const BADGE_FOR_TONE = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "accent-soft",
  neutral: "neutral",
};

export function StatusBadge({ tone = "neutral", children, title }) {
  return (
    <span className={`app-badge app-badge--${BADGE_FOR_TONE[tone] || "neutral"}`} title={title}>
      {children}
    </span>
  );
}

/**
 * @param {object} props
 * @param {object} props.item       Drives the unit, step and whether fractions are allowed.
 * @param {string|number} props.value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.label]
 * @param {number} [props.max]      Upper bound for + (e.g. what is still out on a checkout).
 */
export function QuantityStepper({ item, value, onChange, label = "Quantity", max = null, id = "stock-access-quantity" }) {
  const step = toNumber(item?.quantityStep) || 1;
  const current = toNumber(value) || 0;
  const fractional = allowsFractions(item);
  const set = (next) => {
    let bounded = Math.max(0, roundQuantity(next));
    if (max !== null && max !== undefined) bounded = Math.min(bounded, max);
    onChange(String(bounded));
  };

  return (
    <div className={styles.sheet}>
      <div className={styles.stepper}>
        <Button type="button" variant="secondary" symbol={false} aria-label="Decrease quantity" onClick={() => set(current - step)} disabled={current <= 0}>
          −
        </Button>
        <InputField
          id={id}
          label={`${label} (${unitLabel(item)})`}
          className={styles.stepperValue}
          type="number"
          inputMode={fractional ? "decimal" : "numeric"}
          min="0"
          step={fractional ? "any" : "1"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button type="button" variant="secondary" symbol={false} aria-label="Increase quantity" onClick={() => set(current + step)} disabled={max !== null && max !== undefined && current >= max}>
          +
        </Button>
      </div>
      <div className={styles.chips} role="group" aria-label="Quick quantities">
        {quickQuantities(item)
          .filter((amount) => max === null || max === undefined || amount <= max)
          .map((amount) => (
            <Button
              key={amount}
              type="button"
              size="sm"
              pill
              symbol={false}
              variant={toNumber(value) === amount ? "primary" : "secondary"}
              aria-pressed={toNumber(value) === amount}
              onClick={() => set(amount)}
            >
              {formatQuantity(amount, item)}
            </Button>
          ))}
      </div>
    </div>
  );
}
