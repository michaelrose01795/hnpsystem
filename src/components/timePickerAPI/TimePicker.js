import React, { useState, useRef, useEffect, useId, useMemo } from "react";

export default function TimePicker({
  label,
  placeholder = "Select time",
  value, // String in HH:MM format (24-hour) or HH:MM AM/PM (12-hour)
  onChange, // (rawValue, normalizedTime) => void
  disabled = false,
  helperText = "",
  className = "",
  size = "md", // "sm" or "md"
  format = "24", // "12" or "24" hour format
  minuteStep = 15, // Step for minute selection (1, 5, 15, 30)
  id,
  required = false,
  name,
  ...rest
}) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(null);
  const [selectedMinute, setSelectedMinute] = useState(null);
  const [period, setPeriod] = useState("AM"); // For 12-hour format
  const timePickerRef = useRef(null);
  const menuRef = useRef(null);
  const controlRef = useRef(null);

  // Parse the value prop to set initial state
  useEffect(() => {
    if (!value) {
      setSelectedHour(null);
      setSelectedMinute(null);
      setPeriod("AM");
      return;
    }

    const time24Match = value.match(/^(\d{1,2}):(\d{2})$/);
    const time12Match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    if (time24Match) {
      const hour = parseInt(time24Match[1], 10);
      const minute = parseInt(time24Match[2], 10);

      if (format === "12") {
        const isPM = hour >= 12;
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        setSelectedHour(displayHour);
        setPeriod(isPM ? "PM" : "AM");
      } else {
        setSelectedHour(hour);
      }
      setSelectedMinute(minute);
    } else if (time12Match) {
      const hour = parseInt(time12Match[1], 10);
      const minute = parseInt(time12Match[2], 10);
      const periodValue = time12Match[3].toUpperCase();

      if (format === "24") {
        let hour24 = hour;
        if (periodValue === "PM" && hour !== 12) hour24 = hour + 12;
        if (periodValue === "AM" && hour === 12) hour24 = 0;
        setSelectedHour(hour24);
      } else {
        setSelectedHour(hour);
        setPeriod(periodValue);
      }
      setSelectedMinute(minute);
    }
  }, [value, format]);

  // Close time picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (timePickerRef.current && !timePickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      controlRef.current?.focus();
    }
  };

  // Generate hours array
  const hours = useMemo(() => {
    if (format === "12") {
      return Array.from({ length: 12 }, (_, i) => i + 1);
    }
    return Array.from({ length: 24 }, (_, i) => i);
  }, [format]);

  // Generate minutes array based on step
  const minutes = useMemo(() => {
    const minuteArray = [];
    for (let i = 0; i < 60; i += minuteStep) {
      minuteArray.push(i);
    }
    return minuteArray;
  }, [minuteStep]);

  // Format time for display
  const formatTimeDisplay = () => {
    if (selectedHour === null || selectedMinute === null) return "";

    const hourStr = String(selectedHour).padStart(2, "0");
    const minuteStr = String(selectedMinute).padStart(2, "0");

    if (format === "12") {
      return `${hourStr}:${minuteStr} ${period}`;
    }
    return `${hourStr}:${minuteStr}`;
  };

  // Convert to 24-hour format for value
  const convertTo24Hour = (hour, minute, period) => {
    let hour24 = hour;

    if (format === "12") {
      if (period === "PM" && hour !== 12) {
        hour24 = hour + 12;
      } else if (period === "AM" && hour === 12) {
        hour24 = 0;
      }
    }

    return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  // Handle time selection
  const handleTimeSelect = (hour, minute, newPeriod = period) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    if (format === "12") {
      setPeriod(newPeriod);
    }

    const time24 = convertTo24Hour(hour, minute, newPeriod);

    const normalizedTime = {
      hour: format === "12" ? hour : hour,
      minute: minute,
      period: format === "12" ? newPeriod : null,
      formatted24: time24,
      formatted12: format === "12"
        ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${newPeriod}`
        : null,
    };

    onChange?.(time24, normalizedTime);
  };

  // Handle hour selection
  const handleHourClick = (hour) => {
    if (selectedMinute !== null) {
      handleTimeSelect(hour, selectedMinute);
      setIsOpen(false);
      controlRef.current?.focus();
    } else {
      setSelectedHour(hour);
    }
  };

  // Handle minute selection
  const handleMinuteClick = (minute) => {
    if (selectedHour !== null) {
      handleTimeSelect(selectedHour, minute);
      setIsOpen(false);
      controlRef.current?.focus();
    } else {
      setSelectedMinute(minute);
    }
  };

  // Handle period toggle (AM/PM)
  const handlePeriodToggle = () => {
    const newPeriod = period === "AM" ? "PM" : "AM";
    setPeriod(newPeriod);
    if (selectedHour !== null && selectedMinute !== null) {
      handleTimeSelect(selectedHour, selectedMinute, newPeriod);
    }
  };

  // Handle "Now" button
  const handleNow = () => {
    const now = new Date();
    let hour = now.getHours();
    const minute = Math.floor(now.getMinutes() / minuteStep) * minuteStep;

    let displayHour = hour;
    let currentPeriod = "AM";

    if (format === "12") {
      currentPeriod = hour >= 12 ? "PM" : "AM";
      displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    }

    handleTimeSelect(displayHour, minute, currentPeriod);
    setIsOpen(false);
    controlRef.current?.focus();
  };

  // Display value
  const displayValue = formatTimeDisplay();

  const containerClassName = [
    "timepicker-api",
    size === "sm" && "timepicker-api--sm",
    isOpen && "is-open",
    disabled && "is-disabled",
    displayValue && "has-value",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={timePickerRef} className={containerClassName} {...rest}>
      {label && (
        <label htmlFor={controlId} className="timepicker-api__label">
          {label}
          {required && <span className="timepicker-api__required"> *</span>}
        </label>
      )}

      <button
        ref={controlRef}
        id={controlId}
        type="button"
        className="timepicker-api__control"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label || "Select time"}
      >
        <span className={`timepicker-api__value ${!displayValue ? "is-placeholder" : ""}`}>
          {displayValue || placeholder}
        </span>
        <svg
          className="timepicker-api__icon"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 6V10L13 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div ref={menuRef} className="timepicker-api__menu" role="dialog" aria-modal="false">
          <div className="timepicker-api__header">
            <div className="timepicker-api__display">
              {displayValue || "Select time"}
            </div>
            <button
              type="button"
              className="timepicker-api__now-button"
              onClick={handleNow}
            >
              Now
            </button>
          </div>

          <div className="timepicker-api__selectors">
            <div className="timepicker-api__column">
              <div className="timepicker-api__column-label">Hour</div>
              <div className="timepicker-api__options">
                {hours.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    className={`timepicker-api__option ${selectedHour === hour ? "is-selected" : ""}`}
                    onClick={() => handleHourClick(hour)}
                  >
                    {String(hour).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            <div className="timepicker-api__column">
              <div className="timepicker-api__column-label">Minute</div>
              <div className="timepicker-api__options">
                {minutes.map((minute) => (
                  <button
                    key={minute}
                    type="button"
                    className={`timepicker-api__option ${selectedMinute === minute ? "is-selected" : ""}`}
                    onClick={() => handleMinuteClick(minute)}
                  >
                    {String(minute).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            {format === "12" && (
              <div className="timepicker-api__column timepicker-api__column--period">
                <div className="timepicker-api__column-label">Period</div>
                <div className="timepicker-api__options">
                  <button
                    type="button"
                    className={`timepicker-api__option ${period === "AM" ? "is-selected" : ""}`}
                    onClick={handlePeriodToggle}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    className={`timepicker-api__option ${period === "PM" ? "is-selected" : ""}`}
                    onClick={handlePeriodToggle}
                  >
                    PM
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {helperText && <div className="timepicker-api__helper">{helperText}</div>}

      {/* Hidden input for form submission */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={displayValue}
        />
      )}
    </div>
  );
}
