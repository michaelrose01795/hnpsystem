// file location: src/features/stockControl/StockFields.js
//
// Small presentational pieces shared by the stock panel, its popups and the
// stocktake: the level gauge, a labelled textarea, a segmented choice row and
// the measurement inputs a check / stocktake count needs for each measurement
// mode (count, tank level, dipstick). Styling lives in stockControl.css.

import React from "react";
import { Button, InputField } from "@/components/ui";
import {
  LEVEL_BANDS,
  formatQuantity,
  getThresholds,
  resolveCheckReading,
  toNumber,
  unitShortLabel,
} from "@/features/stockControl/stockModel";

const clampPercent = (value) => Math.max(0, Math.min(100, value));

// Level strip segments, lowest first (Empty is "nothing filled").
const STRIP_BANDS = ["low", "quarter", "half", "three_quarters", "full"];

/**
 * The visual stock level. Counted / capacity-backed items get a bar with a
 * minimum-level marker; level-only items get the five-band strip.
 */
export function StockGauge({ row, compact = false }) {
  const { item, status, fraction } = row;
  const tone = status.levelState === "out_of_stock" || status.levelState === "critical"
    ? "danger"
    : status.levelState === "low"
      ? "warning"
      : status.levelState === "unmeasured"
        ? "neutral"
        : "success";
  const quantity = toNumber(item.currentQuantity);
  const { min, target, max } = getThresholds(item);
  const scaleTo = max || target || null;

  if (quantity === null || !scaleTo) {
    const filledTo = item.levelBand ? STRIP_BANDS.indexOf(item.levelBand) : -1;
    return (
      <div className={`stock-gauge${compact ? " stock-gauge--compact" : ""}`}>
        {!compact && (
          <div className="stock-gauge__head">
            <span className="stock-gauge__amount">
              {quantity !== null ? formatQuantity(quantity, item) : LEVEL_BANDS.find((band) => band.value === item.levelBand)?.label || "Not measured"}
            </span>
            {quantity !== null && item.levelBand && (
              <span className="stock-gauge__scale">{LEVEL_BANDS.find((band) => band.value === item.levelBand)?.label}</span>
            )}
          </div>
        )}
        <div className={`stock-bands stock-fill--${tone}`} role="img" aria-label={`Level ${item.levelBand || "unknown"}`}>
          {STRIP_BANDS.map((band, index) => (
            <span key={band} className={`stock-bands__seg${index <= filledTo ? " is-filled" : ""}`} />
          ))}
        </div>
      </div>
    );
  }

  const percent = clampPercent((fraction ?? 0) * 100);
  const minPercent = min !== null ? clampPercent((min / scaleTo) * 100) : null;
  return (
    <div className={`stock-gauge${compact ? " stock-gauge--compact" : ""}`}>
      {!compact && (
        <div className="stock-gauge__head">
          <span className="stock-gauge__amount">{formatQuantity(quantity, item)}</span>
          <span className="stock-gauge__scale">
            of {formatQuantity(scaleTo, item)} {max ? "capacity" : "target"}
          </span>
        </div>
      )}
      <div
        className="stock-gauge__track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={scaleTo}
        aria-valuenow={quantity}
        aria-label={`${formatQuantity(quantity, item)} of ${formatQuantity(scaleTo, item)}`}
      >
        <div className={`stock-gauge__fill stock-fill--${tone}`} style={{ width: `${percent}%` }} />
        {minPercent !== null && <span className="stock-gauge__marker" style={{ left: `${minPercent}%` }} title="Minimum level" />}
      </div>
    </div>
  );
}

export function TextAreaField({ label, value, onChange, placeholder, rows = 3, id }) {
  const fieldId = id || `stock-${String(label || "notes").toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="stock-field">
      {label && (
        <label className="stock-field__label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <textarea id={fieldId} className="app-input" rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

/** A row of toggle buttons for a small single choice (level bands, modes). */
export function ChoiceButtons({ label, options, value, onChange, ariaLabel }) {
  return (
    <div className="stock-field">
      {label && <span className="stock-field__label">{label}</span>}
      <div className="stock-segmented" role="group" aria-label={ariaLabel || label}>
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            symbol={false}
            variant={value === option.value ? "primary" : "secondary"}
            aria-pressed={value === option.value}
            onClick={() => onChange(value === option.value ? null : option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const emptyReading = () => ({ quantity: "", levelBand: null, dipstickReading: "" });

/**
 * The inputs for a physical check in the item's measurement mode, plus a live
 * callout of what will be recorded (e.g. "Dipstick 42 cm ≈ 610 L").
 */
export function MeasureInputs({ item, value, onChange, autoFocus = false }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  const unit = unitShortLabel(item);
  const preview = resolveCheckReading(item, {
    quantity: toNumber(value.quantity),
    levelBand: value.levelBand || null,
    dipstickReading: toNumber(value.dipstickReading),
  });
  const hasInput = value.quantity !== "" || value.levelBand || value.dipstickReading !== "";

  return (
    <div className="stock-form">
      {item.measurementMode === "tank" && (
        <InputField
          label={`Dipstick reading (${item.dipstickUnit === "percent" ? "%" : item.dipstickUnit || "cm"})`}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          autoFocus={autoFocus}
          value={value.dipstickReading}
          onChange={(event) => set("dipstickReading", event.target.value)}
        />
      )}
      {item.measurementMode !== "count" && (
        <ChoiceButtons
          label={item.measurementMode === "tank" ? "Or tank level" : "Tank level"}
          options={LEVEL_BANDS}
          value={value.levelBand}
          onChange={(band) => set("levelBand", band)}
        />
      )}
      <InputField
        label={item.measurementMode === "count" ? `Counted quantity (${unit})` : `Or exact quantity (${unit})`}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        autoFocus={autoFocus && item.measurementMode === "count"}
        value={value.quantity}
        onChange={(event) => set("quantity", event.target.value)}
      />
      {hasInput && (
        <div className="stock-callout" aria-live="polite">
          {preview.error ? (
            <span>{preview.error}</span>
          ) : (
            <>
              <span>Will record</span>
              <strong>
                {preview.quantity !== null && preview.quantity !== undefined
                  ? `${preview.detail?.conversion || preview.detail?.estimatedFromBand ? "≈ " : ""}${formatQuantity(preview.quantity, item)}`
                  : LEVEL_BANDS.find((band) => band.value === preview.levelBand)?.label || "Level only"}
              </strong>
              {preview.detail?.clamped && <span>Reading is outside this tank's calibration — clamped to the nearest point.</span>}
              {preview.detail?.estimatedFromBand && <span>Estimated from the tank level and capacity.</span>}
              {preview.quantity === null && preview.levelBand && <span>Set a capacity on the item to estimate a quantity from its level.</span>}
              {toNumber(item.currentQuantity) !== null && preview.quantity !== null && preview.quantity !== undefined && (
                <span>
                  Recorded {formatQuantity(item.currentQuantity, item)} ·{" "}
                  {preview.quantity === toNumber(item.currentQuantity)
                    ? "no difference"
                    : `${preview.quantity > toNumber(item.currentQuantity) ? "+" : "−"}${formatQuantity(Math.abs(preview.quantity - toNumber(item.currentQuantity)), item)}`}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Body for check / stocktake requests from the MeasureInputs value. */
export const readingPayload = (value) => ({
  quantity: value.quantity === "" ? null : value.quantity,
  levelBand: value.levelBand || null,
  dipstickReading: value.dipstickReading === "" ? null : value.dipstickReading,
});
