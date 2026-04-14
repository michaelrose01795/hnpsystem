import React, { useState, useEffect } from "react";
import Calendar from "./Calendar";

/**
 * CalendarField - A wrapper around Calendar component that mimics the <input type="date"> API
 * for easier migration from native date inputs.
 *
 * This component provides:
 * - Compatible API with <input type="date">
 * - onChange events similar to native inputs
 * - Support for both controlled and uncontrolled components
 * - Direct value change callback (onValueChange)
 */
export default function CalendarField({
  value,
  defaultValue,
  placeholder,
  label,
  disabled = false,
  helperText = "",
  className = "",
  size = "md",
  name,
  id,
  required = false,
  min, // Maps to minDate
  max, // Maps to maxDate
  onChange, // Synthetic event: (event) => void
  onValueChange, // Direct value: (dateString, dateObject) => void
  ...rest
}) {
  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState(defaultValue || "");

  // Determine if component is controlled
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  // Update internal value when defaultValue changes (uncontrolled mode)
  useEffect(() => {
    if (!isControlled && defaultValue !== undefined) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue, isControlled]);

  // Convert string value to Date object for Calendar component
  const dateValue = currentValue ? new Date(currentValue) : null;

  // Handle date changes from Calendar component
  const handleCalendarChange = (rawDate, normalizedDate) => {
    const dateString = normalizedDate.formatted; // YYYY-MM-DD format
    const dateObject = rawDate;

    // Update internal state in uncontrolled mode
    if (!isControlled) {
      setInternalValue(dateString);
    }

    // Call onValueChange if provided
    if (onValueChange) {
      onValueChange(dateString, dateObject);
    }

    // Call onChange with synthetic event if provided
    if (onChange) {
      // Create a synthetic event similar to <input type="date"> onChange
      const syntheticEvent = {
        target: {
          name: name,
          value: dateString,
          type: "date",
          id: id,
        },
        currentTarget: {
          name: name,
          value: dateString,
          type: "date",
          id: id,
        },
        preventDefault: () => {},
        stopPropagation: () => {},
        nativeEvent: null,
      };

      onChange(syntheticEvent);
    }
  };

  return (
    <Calendar
      id={id}
      label={label}
      placeholder={placeholder}
      value={dateValue}
      onChange={handleCalendarChange}
      disabled={disabled}
      helperText={helperText}
      className={className}
      size={size}
      minDate={min}
      maxDate={max}
      name={name}
      required={required}
      {...rest}
    />
  );
}
