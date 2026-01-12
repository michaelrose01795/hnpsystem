import React, { useState, useRef, useEffect, useId, useMemo } from "react";

export default function Calendar({
  label,
  placeholder = "Select a date",
  value, // Date object, string (YYYY-MM-DD), or timestamp
  onChange, // (rawValue, normalizedDate) => void
  disabled = false,
  helperText = "",
  className = "",
  size = "md", // "sm" or "md"
  minDate, // Date object, string, or timestamp
  maxDate, // Date object, string, or timestamp
  disabledDates = [], // Array of dates to disable
  highlightedDates = [], // Array of dates to highlight (e.g., today)
  showWeekNumbers = false,
  firstDayOfWeek = 0, // 0 = Sunday, 1 = Monday, etc.
  id,
  required = false,
  name,
  style,
  ...rest
}) {
  const wrapperStyle = style
    ? {
        ...style,
        border: undefined,
        borderColor: undefined,
        borderWidth: undefined,
        borderStyle: undefined,
        borderRadius: undefined,
        background: undefined,
        backgroundColor: undefined,
        boxShadow: undefined,
        padding: undefined,
      }
    : undefined;
  const generatedId = useId();
  const controlId = id || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const calendarRef = useRef(null);
  const menuRef = useRef(null);
  const controlRef = useRef(null);

  // Normalize date value to Date object
  const normalizedValue = useMemo(() => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string") return new Date(value);
    if (typeof value === "number") return new Date(value);
    return null;
  }, [value]);

  // Normalize min/max dates
  const normalizedMinDate = useMemo(() => {
    if (!minDate) return null;
    if (minDate instanceof Date) return minDate;
    if (typeof minDate === "string") return new Date(minDate);
    if (typeof minDate === "number") return new Date(minDate);
    return null;
  }, [minDate]);

  const normalizedMaxDate = useMemo(() => {
    if (!maxDate) return null;
    if (maxDate instanceof Date) return maxDate;
    if (typeof maxDate === "string") return new Date(maxDate);
    if (typeof maxDate === "number") return new Date(maxDate);
    return null;
  }, [maxDate]);

  // Close calendar when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
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

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Calculate offset based on first day of week preference
    const offset = (startingDayOfWeek - firstDayOfWeek + 7) % 7;

    // Add empty cells for days before month starts
    for (let i = 0; i < offset; i++) {
      days.push(null);
    }

    // Add all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  }, [currentMonth, firstDayOfWeek]);

  // Check if a date is disabled
  const isDateDisabled = (date) => {
    if (!date) return true;

    if (normalizedMinDate && date < normalizedMinDate) return true;
    if (normalizedMaxDate && date > normalizedMaxDate) return true;

    return disabledDates.some((disabledDate) => {
      const normalized = new Date(disabledDate);
      return date.toDateString() === normalized.toDateString();
    });
  };

  // Check if a date is highlighted
  const isDateHighlighted = (date) => {
    if (!date) return false;
    return highlightedDates.some((highlightedDate) => {
      const normalized = new Date(highlightedDate);
      return date.toDateString() === normalized.toDateString();
    });
  };

  // Check if a date is selected
  const isDateSelected = (date) => {
    if (!date || !normalizedValue) return false;
    return date.toDateString() === normalizedValue.toDateString();
  };

  // Check if a date is today
  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Handle date selection
  const handleDateSelect = (date) => {
    if (isDateDisabled(date)) return;

    const normalizedDate = {
      date: date,
      formatted: formatDate(date),
      iso: date.toISOString(),
      timestamp: date.getTime(),
    };

    onChange?.(date, normalizedDate);
    setIsOpen(false);
    controlRef.current?.focus();
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Format date for display in dd/mm/yy format
  const formatDateDisplay = (date) => {
    if (!date) return "";
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${day}/${month}/${year}`;
  };

  // Navigate months
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Navigate to today
  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  // Format month/year display
  const monthYearDisplay = useMemo(() => {
    return currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentMonth]);

  // Get weekday names
  const weekDays = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const rotated = [...days.slice(firstDayOfWeek), ...days.slice(0, firstDayOfWeek)];
    return rotated;
  }, [firstDayOfWeek]);

  // Compute display value
  const displayValue = normalizedValue ? formatDateDisplay(normalizedValue) : "";

  const containerClassName = [
    "calendar-api",
    size === "sm" && "calendar-api--sm",
    isOpen && "is-open",
    disabled && "is-disabled",
    normalizedValue && "has-value",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={calendarRef} className={containerClassName} style={wrapperStyle} {...rest}>
      {label && (
        <label htmlFor={controlId} className="calendar-api__label">
          {label}
          {required && <span className="calendar-api__required"> *</span>}
        </label>
      )}

      <button
        ref={controlRef}
        id={controlId}
        type="button"
        className="calendar-api__control"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label || "Select date"}
      >
        <span className={`calendar-api__value ${!displayValue ? "is-placeholder" : ""}`}>
          {displayValue || placeholder}
        </span>
        <svg
          className="calendar-api__icon"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 2V4M14 2V4M3 8H17M5 4H15C16.1046 4 17 4.89543 17 6V16C17 17.1046 16.1046 18 15 18H5C3.89543 18 3 17.1046 3 16V6C3 4.89543 3.89543 4 5 4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div ref={menuRef} className="calendar-api__menu" role="dialog" aria-modal="false">
          <div className="calendar-api__header">
            <button
              type="button"
              className="calendar-api__nav-button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 12L6 8L10 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div className="calendar-api__month-year">
              {monthYearDisplay}
            </div>

            <button
              type="button"
              className="calendar-api__nav-button"
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 4L10 8L6 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <button
            type="button"
            className="calendar-api__today-button"
            onClick={handleToday}
          >
            Today
          </button>

          <div className="calendar-api__weekdays">
            {weekDays.map((day, index) => (
              <div key={index} className="calendar-api__weekday">
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-api__days">
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="calendar-api__day calendar-api__day--empty" />;
              }

              const disabled = isDateDisabled(date);
              const selected = isDateSelected(date);
              const highlighted = isDateHighlighted(date);
              const today = isToday(date);

              const dayClassName = [
                "calendar-api__day",
                disabled && "is-disabled",
                selected && "is-selected",
                highlighted && "is-highlighted",
                today && "is-today",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={index}
                  type="button"
                  className={dayClassName}
                  onClick={() => handleDateSelect(date)}
                  disabled={disabled}
                  aria-label={formatDate(date)}
                  aria-selected={selected}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {helperText && <div className="calendar-api__helper">{helperText}</div>}

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
