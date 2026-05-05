import React, { useEffect, useId, useMemo, useRef, useState } from "react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const padMonth = (monthIndex) => String(monthIndex + 1).padStart(2, "0");

const parseMonthValue = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { year: value.getFullYear(), month: value.getMonth() };
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const month = Number(match[2]) - 1;
      if (month >= 0 && month <= 11) return { year: Number(match[1]), month };
    }
  }

  return null;
};

const formatMonthValue = ({ year, month }) => `${year}-${padMonth(month)}`;

const normalizeMonth = (year, month) => {
  const normalized = new Date(year, month, 1);
  return { year: normalized.getFullYear(), month: normalized.getMonth() };
};

const monthToIndex = (month) => month.year * 12 + month.month;

export default function MonthPicker({
  label,
  value,
  defaultValue,
  onChange,
  onValueChange,
  disabled = false,
  helperText = "",
  className = "",
  name,
  id,
  required = false,
  min,
  max,
  minYear = 2000,
  maxYear = 3000,
  ...rest
}) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const isControlled = value !== undefined;
  const initialValue = parseMonthValue(defaultValue) || parseMonthValue(value) || {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  };
  const [internalValue, setInternalValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const monthPickerRef = useRef(null);
  const yearScrollRef = useRef(null);
  const selectedYearRef = useRef(null);

  const selected = parseMonthValue(isControlled ? value : null) || internalValue;
  const selectedValue = formatMonthValue(selected);
  const displayValue = `${MONTH_NAMES[selected.month]} ${selected.year}`;
  const minMonth = parseMonthValue(min);
  const maxMonth = parseMonthValue(max);
  const isMonthDisabled = (month) =>
    Boolean(
      (minMonth && monthToIndex(month) < monthToIndex(minMonth)) ||
      (maxMonth && monthToIndex(month) > monthToIndex(maxMonth))
    );
  const previousMonth = normalizeMonth(selected.year, selected.month - 1);
  const nextMonth = normalizeMonth(selected.year, selected.month + 1);
  const previousDisabled = disabled || isMonthDisabled(previousMonth);
  const nextDisabled = disabled || isMonthDisabled(nextMonth);

  const years = useMemo(() => {
    const start = Math.min(minYear, maxYear);
    const end = Math.max(minYear, maxYear);
    const out = [];
    for (let year = start; year <= end; year += 1) out.push(year);
    return out;
  }, [maxYear, minYear]);

  useEffect(() => {
    if (!isControlled && defaultValue !== undefined) {
      const parsed = parseMonthValue(defaultValue);
      if (parsed) setInternalValue(parsed);
    }
  }, [defaultValue, isControlled]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedYearRef.current && yearScrollRef.current) {
      selectedYearRef.current.scrollIntoView({ block: "center" });
    }
  }, [isOpen, selected.year]);

  const emitChange = (nextMonth) => {
    if (isMonthDisabled(nextMonth)) return;

    const nextValue = formatMonthValue(nextMonth);
    const normalized = {
      value: nextValue,
      year: nextMonth.year,
      month: nextMonth.month + 1,
      monthIndex: nextMonth.month,
      label: `${MONTH_NAMES[nextMonth.month]} ${nextMonth.year}`,
      date: new Date(nextMonth.year, nextMonth.month, 1),
    };

    if (!isControlled) setInternalValue(nextMonth);
    onValueChange?.(nextValue, normalized);
    onChange?.({
      target: { name, value: nextValue, type: "month", id },
      currentTarget: { name, value: nextValue, type: "month", id },
      preventDefault: () => {},
      stopPropagation: () => {},
      nativeEvent: null,
    });
  };

  const handleOffset = (offset) => {
    emitChange(normalizeMonth(selected.year, selected.month + offset));
  };

  const handlePickMonth = (month) => {
    emitChange({ year: selected.year, month });
  };

  const handlePickYear = (year) => {
    emitChange({ year, month: selected.month });
  };

  const containerClassName = [
    "monthpicker-api",
    isOpen && "is-open",
    disabled && "is-disabled",
    selectedValue && "has-value",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={monthPickerRef} className={containerClassName} {...rest}>
      {label && (
        <label htmlFor={controlId} className="monthpicker-api__label">
          <span>{label}{required && <span className="monthpicker-api__required"> *</span>}</span>
        </label>
      )}

      <div className="monthpicker-api__control" aria-disabled={disabled}>
        <button
          type="button"
          className="monthpicker-api__nav-button"
          onClick={() => handleOffset(-1)}
          disabled={previousDisabled}
        >
          Prev
        </button>

        <button
          id={controlId}
          type="button"
          className="monthpicker-api__month-year"
          onClick={() => !disabled && setIsOpen((open) => !open)}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label="Select month and year"
        >
          {displayValue}
        </button>

        <button
          type="button"
          className="monthpicker-api__nav-button"
          onClick={() => handleOffset(1)}
          disabled={nextDisabled}
        >
          Next
        </button>
      </div>

      {isOpen && (
        <div className="monthpicker-api__menu" role="dialog" aria-modal="false">
          <div className="monthpicker-api__month-grid" role="listbox" aria-label="Month">
            {MONTH_NAMES.map((month, monthIndex) => {
              const isSelected = selected.month === monthIndex;
              const cellDisabled = isMonthDisabled({ year: selected.year, month: monthIndex });
              return (
                <button
                  key={month}
                  type="button"
                  className={`monthpicker-api__picker-cell${isSelected ? " is-selected" : ""}`}
                  onClick={() => handlePickMonth(monthIndex)}
                  disabled={cellDisabled}
                  role="option"
                  aria-selected={isSelected}
                >
                  {month.slice(0, 3)}
                </button>
              );
            })}
          </div>

          <div className="monthpicker-api__year-scroll" ref={yearScrollRef} role="listbox" aria-label="Year">
            {years.map((year) => {
              const isSelected = selected.year === year;
              const cellDisabled = isMonthDisabled({ year, month: selected.month });
              return (
                <button
                  key={year}
                  type="button"
                  ref={isSelected ? selectedYearRef : null}
                  className={`monthpicker-api__picker-cell${isSelected ? " is-selected" : ""}`}
                  onClick={() => handlePickYear(year)}
                  disabled={cellDisabled}
                  role="option"
                  aria-selected={isSelected}
                >
                  {year}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {helperText && <div className="monthpicker-api__helper">{helperText}</div>}

      {name && <input type="hidden" name={name} value={selectedValue} />}
    </div>
  );
}
