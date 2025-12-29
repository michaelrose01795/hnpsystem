import React, { useState, useEffect } from "react";
import TimePicker from "./TimePicker";

/**
 * TimePickerField - A wrapper around TimePicker component that mimics the <input type="time"> API
 * for easier migration from native time inputs.
 *
 * This component provides:
 * - Compatible API with <input type="time">
 * - onChange events similar to native inputs
 * - Support for both controlled and uncontrolled components
 * - Direct value change callback (onValueChange)
 */
export default function TimePickerField({
  value,
  defaultValue,
  placeholder,
  label,
  disabled = false,
  helperText = "",
  className = "",
  size = "md",
  format = "24", // "12" or "24" hour format
  minuteStep = 15,
  name,
  id,
  required = false,
  onChange, // Synthetic event: (event) => void
  onValueChange, // Direct value: (timeString, timeObject) => void
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

  // Handle time changes from TimePicker component
  const handleTimeChange = (timeString, normalizedTime) => {
    // Update internal state in uncontrolled mode
    if (!isControlled) {
      setInternalValue(timeString);
    }

    // Call onValueChange if provided
    if (onValueChange) {
      onValueChange(timeString, normalizedTime);
    }

    // Call onChange with synthetic event if provided
    if (onChange) {
      // Create a synthetic event similar to <input type="time"> onChange
      const syntheticEvent = {
        target: {
          name: name,
          value: timeString,
          type: "time",
          id: id,
        },
        currentTarget: {
          name: name,
          value: timeString,
          type: "time",
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
    <TimePicker
      id={id}
      label={label}
      placeholder={placeholder}
      value={currentValue}
      onChange={handleTimeChange}
      disabled={disabled}
      helperText={helperText}
      className={className}
      size={size}
      format={format}
      minuteStep={minuteStep}
      name={name}
      required={required}
      {...rest}
    />
  );
}
