import React, { useEffect, useState } from "react";
import MonthPicker from "./MonthPicker";

export default function MonthPickerField({
  value,
  defaultValue,
  onChange,
  onValueChange,
  ...rest
}) {
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  useEffect(() => {
    if (!isControlled && defaultValue !== undefined) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue, isControlled]);

  const handleChange = (event) => {
    if (!isControlled) setInternalValue(event.target.value);
    onChange?.(event);
  };

  const handleValueChange = (nextValue, normalized) => {
    if (!isControlled) setInternalValue(nextValue);
    onValueChange?.(nextValue, normalized);
  };

  return (
    <MonthPicker
      value={currentValue}
      onChange={handleChange}
      onValueChange={handleValueChange}
      {...rest}
    />
  );
}
