// file location: src/pages/tracking/index.js
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { buildApiUrl } from "@/utils/apiClient";
import { fetchTrackingSnapshot } from "@/lib/database/tracking";
import { supabaseClient } from "@/lib/supabaseClient";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { CalendarField } from "@/components/calendarAPI";
import { DropdownField } from "@/components/dropdownAPI";
import { addMonths } from "date-fns";

const CAR_LOCATIONS = [
  { id: "na", label: "N/A" },
  { id: "service", label: "Service" },
  { id: "sales-1", label: "Sales 1" },
  { id: "sales-2", label: "Sales 2" },
  { id: "sales-3", label: "Sales 3" },
  { id: "sales-4", label: "Sales 4" },
  { id: "sales-5", label: "Sales 5" },
  { id: "sales-6", label: "Sales 6" },
  { id: "sales-7", label: "Sales 7" },
  { id: "sales-8", label: "Sales 8" },
  { id: "sales-9", label: "Sales 9" },
  { id: "sales-10", label: "Sales 10" },
  { id: "staff", label: "Staff" },
  { id: "trade", label: "Trade" },
];

const KEY_LOCATION_GROUPS = [
  {
    title: "General",
    options: [{ id: "na", label: "N/A" }],
  },
  {
    title: "Key Locations",
    options: [
      { id: "service-showroom", label: "Service showroom" },
      { id: "sales-show-room", label: "Sales show room" },
      { id: "red-board", label: "Red board" },
      { id: "workshop", label: "Workshop" },
      { id: "valet", label: "Valet" },
      { id: "paint", label: "Paint" },
      { id: "sales", label: "Sales" },
      { id: "prep", label: "Prep" },
    ],
  },
];

const KEY_LOCATIONS = KEY_LOCATION_GROUPS.flatMap((group) =>
  group.options.map((option) => ({
    id: option.id,
    label: option.label,
    group: group.title,
  }))
);

const CAR_LOCATION_OPTIONS = CAR_LOCATIONS.map((location) => ({
  key: location.id,
  value: location.label,
  label: location.label,
}));

const KEY_LOCATION_OPTIONS = KEY_LOCATIONS.map((location) => ({
  key: location.id,
  value: location.label,
  label: location.label,
  description: location.group,
}));

const normalizeKeyLocationLabel = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text
    .replace(/^Keys (received|hung|updated)\s*[-–]\s*/i, "")
    .replace(/^Key location\s*[-:–]\s*/i, "")
    .replace(/^Key locations?\s*[-:–]\s*/i, "");
};

const ensureDropdownOption = (options = [], value = "") => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return options;
  const match = options.some((option) => {
    const optionValue = option?.value ?? option?.label ?? option;
    return String(optionValue || "").trim().toLowerCase() === normalizedValue.toLowerCase();
  });
  if (match) return options;
  return [
    { key: `current-${normalizedValue}`, value: normalizedValue, label: normalizedValue },
    ...options,
  ];
};

const AUTO_MOVEMENT_RULES = {
  "workshop in progress": {
    keyLocation: "Workshop Cupboard – Jobs in Progress",
    vehicleLocation: "In Workshop",
    vehicleStatus: "In Workshop",
  },
  wash: {
    keyLocation: "Workshop Cupboard – Wash",
    vehicleStatus: "Wash",
  },
  complete: {
    keyLocation: "Workshop Cupboard – Complete",
    vehicleLocation: "Ready for Release",
    vehicleStatus: "Ready for Release",
  },
};

const getAutoMovementRule = (status) => {
  if (!status) return null;
  return AUTO_MOVEMENT_RULES[status.trim().toLowerCase()] || null;
};

const STATUS_COLORS = {
  "Awaiting Authorization": "var(--danger)",
  "Waiting For Collection": "var(--info)",
  "Ready For Collection": "var(--info)",
  "Complete": "var(--info)",
  "Valet Hold": "var(--accent-orange)",
  "In Transit": "var(--accent-purple)",
};

const STATUS_OPTIONS = Object.keys(STATUS_COLORS).map((status) => ({
  key: `status-${status.toLowerCase().replace(/\s+/g, "-")}`,
  value: status,
  label: status,
}));

const NEXT_ACTION_ENDPOINT = "/api/tracking/next-action";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DEFAULT_EQUIPMENT_CHECKS = [];

const DEFAULT_OIL_CHECKS = [];

const EQUIPMENT_API_ENDPOINT = "/api/tracking/equipment";
const OIL_STOCK_API_ENDPOINT = "/api/tracking/oil-stock";

const CHECK_DURATION_OPTIONS = [
  ...Array.from({ length: 11 }, (_, index) => {
    const months = index + 1;
    return {
      key: `m-${months}`,
      value: months,
      label: `${months} month${months === 1 ? "" : "s"}`,
    };
  }),
  ...Array.from({ length: 3 }, (_, index) => {
    const years = index + 1;
    const months = years * 12;
    return {
      key: `y-${years}`,
      value: months,
      label: `${years} year${years === 1 ? "" : "s"}`,
    };
  }),
];

const parseDateOnly = (value) => {
  if (!value || typeof value !== "string") return null;
  const parts = value.split("-").map((part) => Number(part));
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatDateOnly = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatDateOnly(parsed);
};

const calculateNextDateByDuration = (lastDateString, durationMonths) => {
  if (!lastDateString || !durationMonths) return "";
  const parsed = parseDateOnly(lastDateString);
  if (!parsed) return "";
  const months = Number(durationMonths);
  if (!Number.isFinite(months) || months <= 0) return "";
  const nextDate = addMonths(parsed, months);
  return formatDateOnly(nextDate);
};

const calculateIntervalDaysFromIso = (startISO, endISO) => {
  if (!startISO || !endISO) return null;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return null;
  return Math.max(1, Math.round(diff / MS_PER_DAY));
};

const getDurationLabel = (months) => {
  if (!months) return "";
  const matched = CHECK_DURATION_OPTIONS.find(
    (option) => Number(option.value) === Number(months)
  );
  return matched?.label || "";
};

const convertMonthsToDays = (months) => {
  if (!months) return null;
  const numericMonths = Number(months);
  if (!Number.isFinite(numericMonths) || numericMonths <= 0) return null;
  return Math.max(1, Math.round(numericMonths * 30.4375));
};

const getIntervalDays = (item, startKey, endKey, fallbackDays = 7) => {
  if (!item) return fallbackDays;
  const { intervalDays, frequencyDays } = item;
  if (Number.isFinite(Number(intervalDays)) && Number(intervalDays) > 0) {
    return Number(intervalDays);
  }
  if (Number.isFinite(Number(frequencyDays)) && Number(frequencyDays) > 0) {
    return Number(frequencyDays);
  }
  const start = item[startKey];
  const end = item[endKey];
  const derived = calculateIntervalDaysFromIso(start, end);
  if (derived) return derived;
  return fallbackDays;
};

const deriveIntervalMonthsFromItem = (item) => {
  if (!item) return "";
  if (item.intervalMonths) {
    return Number(item.intervalMonths);
  }
  const days = Number(item.intervalDays);
  if (Number.isFinite(days) && days > 0) {
    const approxMonths = Math.round(days / 30.4375);
    const match = CHECK_DURATION_OPTIONS.find(
      (option) => Number(option.value) === approxMonths
    );
    return match ? match.value : approxMonths;
  }
  const derived = calculateIntervalDaysFromIso(item.lastChecked, item.nextDue || item.nextCheck);
  if (derived) {
    const approxMonths = Math.round(derived / 30.4375);
    const match = CHECK_DURATION_OPTIONS.find(
      (option) => Number(option.value) === approxMonths
    );
    return match ? match.value : approxMonths;
  }
  return "";
};

const getDurationDisplay = (item) => {
  if (!item) return "—";
  if (item.intervalLabel) return item.intervalLabel;
  const months =
    item.intervalMonths || deriveIntervalMonthsFromItem(item) || null;
  if (months) {
    return getDurationLabel(months);
  }
  const days = item.intervalDays;
  if (Number.isFinite(Number(days)) && Number(days) > 0) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return "—";
};

const formatDateLabel = (value) => {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateOnlyLabel = (value) => {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getDueLabel = (value) => {
  if (!value) return "Schedule pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Schedule pending";
  const diff = parsed.getTime() - Date.now();
  if (diff <= 0) return "Due now";
  const days = Math.ceil(diff / MS_PER_DAY);
  return `Due in ${days} day${days === 1 ? "" : "s"}`;
};

const nextDueFrom = (reference, intervalDays = 7) => {
  const baseTime =
    reference instanceof Date ? reference.getTime() : Number(reference || Date.now());
  const days = Number.isFinite(Number(intervalDays)) ? Number(intervalDays) : 7;
  return new Date(baseTime + days * MS_PER_DAY).toISOString();
};

const cloneList = (list) => list.map((entry) => ({ ...entry }));

const SECTION_STYLE = {
  padding: "24px",
  borderRadius: "24px",
  background: "var(--surface)",
  border: "1px solid rgba(var(--grey-accent-rgb), 0.35)",
  boxShadow: "none",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const emptyForm = {
  id: null,
  jobNumber: "",
  reg: "",
  customer: "",
  serviceType: "",
  vehicleLocation: "N/A",
  keyLocation: "N/A",
  keyTip: "",
  status: "Waiting For Collection",
  notes: "",
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "now";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(1, Math.round(diff / (1000 * 60)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const CombinedTrackerCard = ({ entry, isHighlighted, onClick }) => {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px 18px",
        borderRadius: "16px",
        border: isHighlighted ? "2px solid var(--danger)" : "1px solid rgba(var(--grey-accent-rgb), 0.3)",
        background: isHighlighted ? "rgba(var(--danger-rgb), 0.05)" : "var(--surface)",
        boxShadow: isHighlighted ? "0 4px 12px rgba(var(--danger-rgb), 0.2)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = isHighlighted ? "0 6px 16px rgba(var(--danger-rgb), 0.3)" : "0 4px 12px rgba(var(--grey-accent-rgb), 0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = isHighlighted ? "0 4px 12px rgba(var(--danger-rgb), 0.2)" : "none";
      }}
    >
      <div>
        <strong style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>
          {entry.jobNumber || "Unknown job"} • {entry.reg || "Unknown reg"}
        </strong>
        <p style={{ margin: "4px 0 0", fontSize: "0.9rem", color: "var(--info-dark)" }}>
          {entry.customer || "Customer pending"} • {entry.makeModel || "Make/Model pending"}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginTop: "8px",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Key location</p>
          <strong style={{ fontSize: "0.95rem", color: "var(--accent-purple)" }}>{entry.keyLocation || "Pending"}</strong>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Car location</p>
          <strong style={{ fontSize: "0.95rem", color: "var(--success-dark)" }}>{entry.vehicleLocation || "Unallocated"}</strong>
        </div>
      </div>

      <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--info)" }}>Last moved {formatRelativeTime(entry.updatedAt)}</p>
    </div>
  );
};

const LocationSearchModal = ({ type, options, onClose, onSelect }) => {
  const [query, setQuery] = useState("");
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div
      style={{
        ...popupOverlayStyles,
        zIndex: 200,
      }}
    >
      <div
        style={{
          ...popupCardStyles,
          width: "min(600px, 100%)",
          background: "var(--search-surface)",
          padding: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          border: "1px solid var(--search-surface-muted)",
          color: "var(--search-text)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--info)", letterSpacing: "0.08em" }}>
              {type === "car" ? "Parking library" : "Key hook library"}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>Search location</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "var(--search-surface)",
              color: "var(--search-text)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={type === "car" ? "Search bays or overflow" : "Search key safes, drawers"}
          style={{
            padding: "10px 14px",
            borderRadius: "12px",
            border: "1px solid var(--search-surface-muted)",
            backgroundColor: "var(--search-surface)",
            color: "var(--search-text)",
          }}
        />

        <div style={{ maxHeight: "320px", overflow: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((option) => (
            <div
              key={option.id}
              style={{
                padding: "14px",
                borderRadius: "16px",
                border: "1px solid var(--search-surface-muted)",
                background: "var(--search-surface)",
                color: "var(--search-text)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <strong style={{ color: "var(--accent-purple)" }}>{option.label}</strong>
              <button
                type="button"
                onClick={() => onSelect(option)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(var(--primary-rgb),0.3)",
                  backgroundColor: "var(--surface)",
                  color: "var(--primary-dark)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Use location
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <div
              style={{
                padding: "18px",
                borderRadius: "16px",
                border: "1px dashed var(--search-surface-muted)",
                textAlign: "center",
                color: "var(--search-text)",
              }}
            >
              No locations found.
            </div>
          )}
        </div>

        {/* TODO: Replace static location lists with DB-driven results */}
      </div>
    </div>
  );
};

const buildEquipmentFormState = (data = null) => {
  const intervalMonths = data ? deriveIntervalMonthsFromItem(data) : "";
  return {
    id: data?.id || null,
    name: data?.name || "",
    lastCheckedDate: data?.lastChecked ? toDateInputValue(data.lastChecked) : "",
    nextDueDate: data?.nextDue ? toDateInputValue(data.nextDue) : "",
    intervalMonths: intervalMonths ? Number(intervalMonths) : "",
  };
};

const buildOilFormState = (data = null) => {
  const intervalMonths = data ? deriveIntervalMonthsFromItem(data) : "";
  return {
    id: data?.id || null,
    stock: data?.stock || "",
    title: data?.title || "",
    lastCheckDate: data?.lastCheck ? toDateInputValue(data.lastCheck) : "",
    nextCheckDate: data?.nextCheck ? toDateInputValue(data.nextCheck) : "",
    lastToppedUpDate: data?.lastToppedUp ? toDateInputValue(data.lastToppedUp) : "",
    intervalMonths: intervalMonths ? Number(intervalMonths) : "",
  };
};

const EquipmentToolsModal = ({ initialData = null, onClose, onSave, onDelete }) => {
  const [form, setForm] = useState(() => buildEquipmentFormState(initialData));

  useEffect(() => {
    setForm(buildEquipmentFormState(initialData));
  }, [initialData]);

  const { lastCheckedDate, intervalMonths } = form;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    setForm((prev) => {
      const computedNext = calculateNextDateByDuration(lastCheckedDate, intervalMonths);
      const normalizedPrev = prev.nextDueDate || "";
      if (computedNext === normalizedPrev) {
        return prev;
      }
      return { ...prev, nextDueDate: computedNext };
    });
  }, [lastCheckedDate, intervalMonths]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name) {
      alert("Please enter equipment name");
      return;
    }
    if (!form.intervalMonths) {
      alert("Please select a duration until the next check");
      return;
    }

    // Convert dates to ISO strings
    const lastChecked = form.lastCheckedDate
      ? new Date(`${form.lastCheckedDate}T00:00:00`).toISOString()
      : null;
    const nextDue = form.nextDueDate
      ? new Date(`${form.nextDueDate}T00:00:00`).toISOString()
      : null;
    const intervalMonthsValue = form.intervalMonths ? Number(form.intervalMonths) : null;
    const intervalDays =
      calculateIntervalDaysFromIso(lastChecked, nextDue) ||
      convertMonthsToDays(intervalMonthsValue);

    onSave({
      id: form.id || initialData?.id || null,
      name: form.name,
      lastChecked,
      nextDue,
      intervalMonths: intervalMonthsValue,
      intervalLabel: getDurationLabel(intervalMonthsValue),
      intervalDays,
    });
  };

  return (
    <div style={{ ...popupOverlayStyles, zIndex: 220 }}>
      <form
        onSubmit={handleSubmit}
        style={{
          ...popupCardStyles,
          width: "min(600px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{initialData ? "Edit Equipment/Tools" : "Add Equipment/Tools"}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "var(--surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Name *
          </label>
          <input
            required
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
            placeholder="Equipment name"
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              fontSize: "0.95rem",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Last Checked
          </label>
          <CalendarField
            value={form.lastCheckedDate}
            onChange={(e) => handleChange("lastCheckedDate", e.target.value)}
            placeholder="Select date"
            size="md"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Duration until next check *
          </label>
          <DropdownField
            required
            options={CHECK_DURATION_OPTIONS}
            value={form.intervalMonths}
            onValueChange={(value) =>
              handleChange("intervalMonths", value ? Number(value) : "")
            }
            placeholder="Select duration"
            size="md"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Next Due
          </label>
          <CalendarField
            value={form.nextDueDate}
            placeholder="Select date"
            size="md"
            disabled
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            {initialData?.id && (
              <button
                type="button"
                onClick={() => {
                  if (!initialData?.id) return;
                  const shouldDelete = window.confirm("Delete this equipment entry?");
                  if (shouldDelete) {
                    onDelete?.(initialData.id);
                  }
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(var(--danger-rgb), 0.4)",
                  backgroundColor: "transparent",
                  color: "var(--danger)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "1px solid var(--accent-purple-surface)",
                backgroundColor: "transparent",
                color: "var(--text)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "none",
                background: "var(--primary)",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {initialData ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const OilStockModal = ({ initialData = null, onClose, onSave, onDelete }) => {
  const [form, setForm] = useState(() => buildOilFormState(initialData));

  useEffect(() => {
    setForm(buildOilFormState(initialData));
  }, [initialData]);

  const { lastCheckDate, intervalMonths } = form;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    setForm((prev) => {
      const computedNext = calculateNextDateByDuration(lastCheckDate, intervalMonths);
      const normalizedPrev = prev.nextCheckDate || "";
      if (computedNext === normalizedPrev) {
        return prev;
      }
      return { ...prev, nextCheckDate: computedNext };
    });
  }, [lastCheckDate, intervalMonths]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title) {
      alert("Please enter title");
      return;
    }
    if (!form.intervalMonths) {
      alert("Please select a duration until the next check");
      return;
    }

    // Convert dates to ISO strings
    const lastCheck = form.lastCheckDate
      ? new Date(`${form.lastCheckDate}T00:00:00`).toISOString()
      : null;
    const nextCheck = form.nextCheckDate
      ? new Date(`${form.nextCheckDate}T00:00:00`).toISOString()
      : null;
    const lastToppedUp = form.lastToppedUpDate
      ? new Date(`${form.lastToppedUpDate}T00:00:00`).toISOString()
      : null;
    const intervalMonthsValue = form.intervalMonths ? Number(form.intervalMonths) : null;
    const intervalDays =
      calculateIntervalDaysFromIso(lastCheck, nextCheck) ||
      convertMonthsToDays(intervalMonthsValue);

    onSave({
      id: form.id || initialData?.id || null,
      title: form.title,
      stock: form.stock,
      lastCheck,
      nextCheck,
      lastToppedUp,
      intervalMonths: intervalMonthsValue,
      intervalLabel: getDurationLabel(intervalMonthsValue),
      intervalDays,
    });
  };

  return (
    <div style={{ ...popupOverlayStyles, zIndex: 220 }}>
      <form
        onSubmit={handleSubmit}
        style={{
          ...popupCardStyles,
          width: "min(650px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{initialData ? "Edit Oil / Stock" : "Add Oil / Stock"}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "var(--surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Title *
          </label>
          <input
            required
            value={form.title}
            onChange={(event) => handleChange("title", event.target.value)}
            placeholder="Oil/Stock title"
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              fontSize: "0.95rem",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Stock
          </label>
          <input
            value={form.stock}
            onChange={(event) => handleChange("stock", event.target.value)}
            placeholder="e.g., 18 × 5L cans"
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              fontSize: "0.95rem",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Last Check
          </label>
          <CalendarField
            value={form.lastCheckDate}
            onChange={(e) => handleChange("lastCheckDate", e.target.value)}
            placeholder="Select date"
            size="md"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Duration until next check *
          </label>
          <DropdownField
            required
            options={CHECK_DURATION_OPTIONS}
            value={form.intervalMonths}
            onValueChange={(value) =>
              handleChange("intervalMonths", value ? Number(value) : "")
            }
            placeholder="Select duration"
            size="md"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
            Next Check
          </label>
          <CalendarField
            value={form.nextCheckDate}
            placeholder="Select date"
            size="md"
            disabled
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
          {initialData?.id && (
            <button
              type="button"
              onClick={() => {
                if (!initialData?.id) return;
                const shouldDelete = window.confirm("Delete this oil/stock entry?");
                if (shouldDelete) {
                  onDelete?.(initialData.id);
                }
              }}
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "1px solid rgba(var(--danger-rgb), 0.4)",
                backgroundColor: "transparent",
                color: "var(--danger)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Delete
            </button>
          )}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "1px solid var(--accent-purple-surface)",
                backgroundColor: "transparent",
                color: "var(--text)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "10px 16px",
                borderRadius: "12px",
                border: "none",
                background: "var(--primary)",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {initialData ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

const SimplifiedTrackingModal = ({ initialData, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({
    jobNumber: initialData?.jobNumber || "",
    reg: initialData?.reg || "",
    customer: initialData?.customer || "",
    makeModel: initialData?.makeModel || "",
    colour: initialData?.colour || "",
    vehicleLocation: initialData?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: initialData?.keyLocation || KEY_LOCATIONS[0].label,
  }));
  const [showUpdate, setShowUpdate] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-fill functionality when job number, reg, or customer is entered
  const handleAutoFill = async (searchField, searchValue) => {
    if (!searchValue || searchValue.trim().length < 2) return;

    setIsSearching(true);
    try {
      // Try to fetch job details from the database
      const { data, error } = await supabaseClient
        .from("jobs")
        .select(`
          job_number,
          vehicle:vehicle_id(registration, reg, make, model, make_model, colour),
          customer:customer_id(name, firstname, lastname)
        `)
        .or(
          searchField === "jobNumber" ? `job_number.ilike.%${searchValue}%` :
          searchField === "reg" ? `vehicle_id.registration.ilike.%${searchValue}%,vehicle_id.reg.ilike.%${searchValue}%` :
          `customer_id.name.ilike.%${searchValue}%,customer_id.firstname.ilike.%${searchValue}%,customer_id.lastname.ilike.%${searchValue}%`
        )
        .limit(1)
        .single();

      if (!error && data) {
        setForm((prev) => ({
          ...prev,
          jobNumber: data.job_number || prev.jobNumber,
          reg: data.vehicle?.registration || data.vehicle?.reg || prev.reg,
          customer: data.customer?.name || `${data.customer?.firstname || ""} ${data.customer?.lastname || ""}`.trim() || prev.customer,
          makeModel: data.vehicle?.make_model || `${data.vehicle?.make || ""} ${data.vehicle?.model || ""}`.trim() || prev.makeModel,
          colour: data.vehicle?.colour || prev.colour,
        }));
      }
    } catch (err) {
      console.error("Auto-fill error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddLocation = (event) => {
    event.preventDefault();

    if (!form.jobNumber && !form.reg && !form.customer) {
      alert("Please fill in at least one of: Job Number, Registration, or Customer name");
      return;
    }

    const actionType = "job_checked_in";
    onSave({ ...form, actionType, context: "car" });
  };

  const handleUpdateLocation = (event) => {
    event.preventDefault();

    if (!form.jobNumber && !form.reg && !form.customer) {
      alert("Please fill in at least one of: Job Number, Registration, or Customer name");
      return;
    }

    const actionType = "location_update";
    onSave({ ...form, actionType, context: "update" });
  };

  return (
    <div
      style={{
        ...popupOverlayStyles,
        zIndex: 220,
      }}
    >
      <div
        style={{
          ...popupCardStyles,
          width: "min(800px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: "0 0 4px 0" }}>Vehicle & Key Tracking</h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--info)" }}>
              Track vehicle and key locations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "var(--surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {/* Top Row: Job Details */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
            padding: "16px",
            backgroundColor: "var(--surface-light)",
            borderRadius: "12px",
            border: "1px solid var(--accent-purple-surface)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--info)", marginBottom: "4px" }}>Job Number</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{form.jobNumber || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--info)", marginBottom: "4px" }}>Registration</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{form.reg || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--info)", marginBottom: "4px" }}>Make & Model</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{form.makeModel || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--info)", marginBottom: "4px" }}>Colour</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{form.colour || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--info)", marginBottom: "4px" }}>Customer</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{form.customer || "—"}</div>
          </div>
        </div>

        {/* Add Location Section */}
        <form onSubmit={handleAddLocation} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <h3 style={{ margin: "0", fontSize: "1rem", fontWeight: 600 }}>Add Location</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>
                Job Number / Reg / Customer
              </span>
              <input
                value={form.jobNumber || form.reg || form.customer}
                onChange={(e) => {
                  const value = e.target.value;
                  // Try to determine which field it is
                  if (value.match(/^\d+$/)) {
                    handleChange("jobNumber", value);
                    handleAutoFill("jobNumber", value);
                  } else if (value.match(/^[A-Z0-9\s]+$/i) && value.length <= 10) {
                    handleChange("reg", value);
                    handleAutoFill("reg", value);
                  } else {
                    handleChange("customer", value);
                    handleAutoFill("customer", value);
                  }
                }}
                placeholder="Enter job number, reg, or customer name"
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: "1px solid var(--accent-purple-surface)",
                  fontSize: "0.95rem",
                }}
                disabled={isSearching}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>
                Vehicle Location
              </label>
              <DropdownField
                options={CAR_LOCATION_OPTIONS}
                value={form.vehicleLocation}
                onValueChange={(value) => handleChange("vehicleLocation", value)}
                placeholder="Select location"
                size="md"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>
                Key Location
              </label>
              <DropdownField
                options={KEY_LOCATION_OPTIONS}
                value={form.keyLocation}
                onValueChange={(value) => handleChange("keyLocation", value)}
                placeholder="Select key location"
                size="md"
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              padding: "12px 20px",
              borderRadius: "12px",
              border: "none",
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.95rem",
            }}
          >
            Add Location
          </button>
        </form>

        {/* Divider */}
        <div style={{ height: "1px", backgroundColor: "var(--accent-purple-surface)" }} />

        {/* Update Section Toggle */}
        <button
          type="button"
          onClick={() => setShowUpdate(!showUpdate)}
          style={{
            padding: "12px 20px",
            borderRadius: "12px",
            border: "1px solid var(--info)",
            background: showUpdate ? "var(--info)" : "transparent",
            color: showUpdate ? "white" : "var(--info)",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.95rem",
          }}
        >
          {showUpdate ? "Hide Update Section" : "Update Existing Location"}
        </button>

        {/* Update Location Section */}
        {showUpdate && (
          <form onSubmit={handleUpdateLocation} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h3 style={{ margin: "0", fontSize: "1rem", fontWeight: 600 }}>Update Location</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>
                  Vehicle Location
                </label>
                <DropdownField
                  options={CAR_LOCATION_OPTIONS}
                  value={form.vehicleLocation}
                  onValueChange={(value) => handleChange("vehicleLocation", value)}
                  placeholder="Select location"
                  size="md"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--info)" }}>
                  Key Location
                </label>
                <DropdownField
                  options={KEY_LOCATION_OPTIONS}
                  value={form.keyLocation}
                  onValueChange={(value) => handleChange("keyLocation", value)}
                  placeholder="Select key location"
                  size="md"
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                padding: "12px 20px",
                borderRadius: "12px",
                border: "none",
                background: "var(--success)",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              Update
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const LocationEntryModal = ({ context, entry, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...entry,
    vehicleLocation: entry?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: normalizeKeyLocationLabel(entry?.keyLocation) || KEY_LOCATIONS[0].label,
    status: entry?.status || "Waiting For Collection",
  }));
  const vehicleLocationOptions = useMemo(
    () => ensureDropdownOption(CAR_LOCATION_OPTIONS, form.vehicleLocation),
    [form.vehicleLocation]
  );
  const keyLocationOptions = useMemo(
    () => ensureDropdownOption(KEY_LOCATION_OPTIONS, form.keyLocation),
    [form.keyLocation]
  );

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    // Validate that at least one of the key fields is filled
    const hasJobNumber = form.jobNumber && form.jobNumber.trim();
    const hasReg = form.reg && form.reg.trim();
    const hasCustomer = form.customer && form.customer.trim();

    if (!hasJobNumber && !hasReg && !hasCustomer) {
      alert("Please fill in at least one of: Job Number, Registration, or Customer name");
      return;
    }

    const actionType = context === "car" ? "job_checked_in" : "job_complete";
    onSave({ ...form, actionType, context });
  };

  return (
    <div
      style={{
        ...popupOverlayStyles,
        zIndex: 220,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          ...popupCardStyles,
          width: "min(640px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>{entry ? "Edit existing" : "Log new"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "var(--surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px",
          }}
        >
          {[
            { label: "Job Number", field: "jobNumber", placeholder: "HNP-4821", required: false },
            { label: "Registration", field: "reg", placeholder: "GY21 HNP", required: false },
            { label: "Customer", field: "customer", placeholder: "Customer name", required: false },
            { label: "Service Type", field: "serviceType", placeholder: "MOT, Service...", required: false },
          ].map((input) => (
            <div key={input.field} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
                {input.label}
                {["jobNumber", "reg", "customer"].includes(input.field) && (
                  <span style={{ fontSize: "0.75rem", color: "var(--info)", fontWeight: 400 }}> (at least one required)</span>
                )}
              </label>
              <input
                value={form[input.field]}
                onChange={(event) => handleChange(input.field, event.target.value)}
                placeholder={input.placeholder}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: "1px solid var(--accent-purple-surface)",
                  fontSize: "0.95rem",
                }}
              />
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
              Vehicle Location
            </label>
            <DropdownField
              options={vehicleLocationOptions}
              value={form.vehicleLocation}
              onValueChange={(value) => handleChange("vehicleLocation", value)}
              placeholder="Select location"
              size="md"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
              Key Location
            </label>
            <DropdownField
              required
              options={keyLocationOptions}
              value={form.keyLocation}
              onValueChange={(value) => handleChange("keyLocation", value)}
              placeholder="Select key location"
              size="md"
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid var(--accent-purple-surface)",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "none",
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save update
          </button>
        </div>

        {/* TODO: Persist vehicle/key updates via API endpoint */}
      </form>
    </div>
  );
};

export default function TrackingDashboard() {
  const router = useRouter();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchModal, setSearchModal] = useState({ open: false, type: null });
  const [entryModal, setEntryModal] = useState({ open: false, type: null, entry: null });
  const [simplifiedModal, setSimplifiedModal] = useState({ open: false, initialData: null });
  const [highlightedJobNumber, setHighlightedJobNumber] = useState(null);
  const [equipmentModal, setEquipmentModal] = useState({ open: false, item: null });
  const [oilStockModal, setOilStockModal] = useState({ open: false, item: null });
  const { dbUserId, user } = useUser();
  const userRoles = useMemo(() => (user?.roles || []).map((role) => role.toLowerCase()), [user]);
  const isWorkshopManager = userRoles.includes("workshop manager");
  const tabs = useMemo(() => {
    const base = [{ id: "tracker", label: "Key/Parking" }];
    if (isWorkshopManager) {
      base.push({ id: "equipment", label: "Equipment/Tools" }, { id: "oil-stock", label: "Oil/Stock" });
    }
    return base;
  }, [isWorkshopManager]);
  const [activeTab, setActiveTab] = useState("tracker");
  const [equipmentChecks, setEquipmentChecks] = useState(() => cloneList(DEFAULT_EQUIPMENT_CHECKS));
  const [oilChecks, setOilChecks] = useState(() => cloneList(DEFAULT_OIL_CHECKS));
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [oilLoading, setOilLoading] = useState(false);
  const [activeTopUpId, setActiveTopUpId] = useState(null);
  const [topUpValue, setTopUpValue] = useState("");

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchTrackingSnapshot();
      if (!snapshot.success) {
        throw new Error(snapshot.error?.message || "Failed to load tracking data");
      }
      const normalized = Array.isArray(snapshot.data) ? snapshot.data : [];
      setEntries(normalized);
      setLastUpdated(new Date().toISOString());
    } catch (fetchError) {
      console.error("Failed to fetch tracking snapshot", fetchError);
      setEntries([]);
      setError(fetchError?.message || "Unable to load tracking data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Handle URL parameters from job card redirect
  useEffect(() => {
    if (!router.isReady) return;

    const { jobNumber, reg, customer, makeModel, colour, openPopup } = router.query;

    // If we have URL params, check if an entry exists for this job
    if (jobNumber || reg || customer) {
      setHighlightedJobNumber(jobNumber);

      // If openPopup=true, use the simplified modal with pre-filled data
      if (openPopup === "true") {
        setSimplifiedModal({
          open: true,
          initialData: {
            jobNumber: jobNumber || "",
            reg: reg || "",
            customer: customer || "",
            makeModel: makeModel || "",
            colour: colour || "",
          },
        });
        return;
      }

      // Check if an existing entry matches the job
      const existingEntry = entries.find(
        (entry) =>
          (jobNumber && entry.jobNumber?.toLowerCase() === jobNumber.toLowerCase()) ||
          (reg && entry.reg?.toLowerCase() === reg.toLowerCase())
      );

      // If no existing entry found, auto-open the Log New popup with pre-filled data
      if (!existingEntry && entries.length > 0) {
        openEntryModal("car", {
          ...emptyForm,
          jobNumber: jobNumber || "",
          reg: reg || "",
          customer: customer || "",
        });
      }
    }
  }, [router.isReady, router.query, entries]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id || "tracker");
    }
  }, [tabs, activeTab]);

  const loadEquipmentChecks = useCallback(async () => {
    if (!isWorkshopManager) return;
    setEquipmentLoading(true);
    try {
      const response = await fetch(EQUIPMENT_API_ENDPOINT);
      if (!response.ok) {
        throw new Error("Failed to load equipment data");
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Failed to load equipment data");
      }
      setEquipmentChecks(Array.isArray(payload.data) ? payload.data : []);
    } catch (loadError) {
      console.error("Equipment data load error", loadError);
      setEquipmentChecks([]);
    } finally {
      setEquipmentLoading(false);
    }
  }, [isWorkshopManager]);

  const loadOilChecks = useCallback(async () => {
    if (!isWorkshopManager) return;
    setOilLoading(true);
    try {
      const response = await fetch(OIL_STOCK_API_ENDPOINT);
      if (!response.ok) {
        throw new Error("Failed to load oil/stock data");
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "Failed to load oil/stock data");
      }
      setOilChecks(Array.isArray(payload.data) ? payload.data : []);
    } catch (loadError) {
      console.error("Oil/stock data load error", loadError);
      setOilChecks([]);
    } finally {
      setOilLoading(false);
    }
  }, [isWorkshopManager]);

  useEffect(() => {
    if (!isWorkshopManager) return;
    loadEquipmentChecks();
    loadOilChecks();
  }, [isWorkshopManager, loadEquipmentChecks, loadOilChecks]);

  const handleEquipmentCheck = useCallback(
    async (id) => {
      const target = equipmentChecks.find((item) => item.id === id);
      if (!target) return;
      const intervalDays = getIntervalDays(target, "lastChecked", "nextDue");
      const now = new Date();
      const payload = {
        id,
        lastChecked: now.toISOString(),
        nextDue: nextDueFrom(now, intervalDays),
        intervalDays,
      };

      try {
        const response = await fetch(EQUIPMENT_API_ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to log equipment check");
        }
        const updated = result.data;
        setEquipmentChecks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } catch (error) {
        console.error("Equipment check update failed", error);
        alert(error.message || "Failed to log equipment check");
      }
    },
    [equipmentChecks]
  );

  const handleOilCheck = useCallback(
    async (id, stockAmount) => {
      const target = oilChecks.find((item) => item.id === id);
      if (!target) return;
      const intervalDays = getIntervalDays(target, "lastCheck", "nextCheck");
      const now = new Date();
      const payload = {
        id,
        lastCheck: now.toISOString(),
        nextCheck: nextDueFrom(now, intervalDays),
        lastToppedUp: now.toISOString(),
        stock: stockAmount || target.stock,
        intervalDays,
      };

      try {
        const response = await fetch(OIL_STOCK_API_ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to mark check");
        }
        const updated = result.data;
        setOilChecks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setActiveTopUpId(null);
        setTopUpValue("");
      } catch (error) {
        console.error("Oil/stock check update failed", error);
        alert(error.message || "Failed to mark oil/stock check");
      }
    },
    [oilChecks]
  );

  const handleSaveEquipment = useCallback(
    async (form) => {
      const now = new Date();
      const resolvedLastChecked = form.lastChecked || now.toISOString();
      const resolvedIntervalDays =
        (Number(form.intervalDays) > 0 && Number(form.intervalDays)) ||
        convertMonthsToDays(form.intervalMonths) ||
        365;
      const baseDate = form.lastChecked ? new Date(form.lastChecked) : now;
      const resolvedNextDue = form.nextDue || nextDueFrom(baseDate, resolvedIntervalDays);
      const resolvedIntervalLabel = form.intervalLabel || getDurationLabel(form.intervalMonths);

      const payload = {
        id: form.id || null,
        name: form.name,
        lastChecked: resolvedLastChecked,
        nextDue: resolvedNextDue,
        intervalDays: resolvedIntervalDays,
        intervalMonths: form.intervalMonths,
        intervalLabel: resolvedIntervalLabel,
        createdBy: dbUserId || null,
      };

      const method = payload.id ? "PUT" : "POST";

      try {
        const response = await fetch(EQUIPMENT_API_ENDPOINT, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to save equipment entry");
        }
        const saved = result.data;
        setEquipmentChecks((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          if (exists) {
            return prev.map((item) => (item.id === saved.id ? saved : item));
          }
          return [...prev, saved];
        });
        setEquipmentModal({ open: false, item: null });
      } catch (error) {
        console.error("Save equipment entry failed", error);
        alert(error.message || "Failed to save equipment entry");
      }
    },
    [dbUserId]
  );

  const handleSaveOilStock = useCallback(
    async (form) => {
      const now = new Date();
      const resolvedLastCheck = form.lastCheck || now.toISOString();
      const resolvedIntervalDays =
        (Number(form.intervalDays) > 0 && Number(form.intervalDays)) ||
        convertMonthsToDays(form.intervalMonths) ||
        30;
      const baseDate = form.lastCheck ? new Date(form.lastCheck) : now;
      const resolvedNextCheck = form.nextCheck || nextDueFrom(baseDate, resolvedIntervalDays);
      const resolvedIntervalLabel = form.intervalLabel || getDurationLabel(form.intervalMonths);

      const payload = {
        id: form.id || null,
        title: form.title,
        stock: form.stock,
        lastCheck: resolvedLastCheck,
        nextCheck: resolvedNextCheck,
        lastToppedUp: form.lastToppedUp,
        intervalDays: resolvedIntervalDays,
        intervalMonths: form.intervalMonths,
        intervalLabel: resolvedIntervalLabel,
        createdBy: dbUserId || null,
      };

      const method = payload.id ? "PUT" : "POST";

      try {
        const response = await fetch(OIL_STOCK_API_ENDPOINT, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to save oil/stock entry");
        }
        const saved = result.data;
        setOilChecks((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          if (exists) {
            return prev.map((item) => (item.id === saved.id ? saved : item));
          }
          return [...prev, saved];
        });
        setOilStockModal({ open: false, item: null });
      } catch (error) {
        console.error("Save oil/stock entry failed", error);
        alert(error.message || "Failed to save oil/stock entry");
      }
    },
    [dbUserId]
  );

  const handleDeleteEquipment = useCallback(async (id) => {
    if (!id) return;
    try {
      const response = await fetch(`${EQUIPMENT_API_ENDPOINT}?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({ success: response.ok }));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || "Failed to delete equipment entry");
      }
      setEquipmentChecks((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Delete equipment entry failed", error);
      alert(error.message || "Failed to delete equipment entry");
    } finally {
      setEquipmentModal({ open: false, item: null });
    }
  }, []);

  const handleDeleteOilStock = useCallback(async (id) => {
    if (!id) return;
    try {
      const response = await fetch(`${OIL_STOCK_API_ENDPOINT}?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({ success: response.ok }));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || "Failed to delete oil/stock entry");
      }
      setOilChecks((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Delete oil/stock entry failed", error);
      alert(error.message || "Failed to delete oil/stock entry");
    } finally {
      setOilStockModal({ open: false, item: null });
    }
  }, []);

  const handleAutoMovement = useCallback(
    async (job, rule, newStatus) => {
      try {
        const payload = {
          actionType: "job_status_change",
          jobId: job.id || job.job_id || null,
          jobNumber: (job.job_number || job.jobNumber || "").toString().trim().toUpperCase(),
          vehicleId: job.vehicle_id || job.vehicleId || null,
          vehicleReg: (job.vehicle_reg || job.reg || "").toString().trim().toUpperCase(),
          keyLocation: rule.keyLocation,
          vehicleLocation: rule.vehicleLocation,
          vehicleStatus: rule.vehicleStatus,
          notes: `Auto-sync from status "${newStatus}"`,
          performedBy: dbUserId || null,
        };

        const response = await fetch(buildApiUrl(NEXT_ACTION_ENDPOINT), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorPayload = await response
            .json()
            .catch(() => ({ message: "Failed to auto-sync locations" }));
          console.error("Auto movement failed", errorPayload?.message || response.statusText);
          return;
        }

        await loadEntries();
      } catch (autoError) {
        console.error("Auto movement error", autoError);
      }
    },
    [dbUserId, loadEntries]
  );

  useEffect(() => {
    const channel = supabaseClient
      .channel("tracking-job-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs" },
        (payload) => {
          const newJob = payload?.new;
          const oldJob = payload?.old;
          if (!newJob?.status || newJob.status === oldJob?.status) {
            return;
          }
          const rule = getAutoMovementRule(newJob.status);
          if (!rule) return;
          handleAutoMovement(newJob, rule, newJob.status);
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [handleAutoMovement]);

  const activeEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.jobId)
        .sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        ),
    [entries]
  );

  const openSearchModal = (type) => setSearchModal({ open: true, type });
  const closeSearchModal = () => setSearchModal({ open: false, type: null });

  const openEntryModal = (type, entry = null) => setEntryModal({ open: true, type, entry });
  const closeEntryModal = () => setEntryModal({ open: false, type: null, entry: null });

  const handleLocationSelect = (option) => {
    closeSearchModal();
    openEntryModal(searchModal.type, {
      ...emptyForm,
      vehicleLocation: searchModal.type === "car" ? option.label : CAR_LOCATIONS[0].label,
      keyLocation: searchModal.type === "key" ? option.label : KEY_LOCATIONS[0].label,
    });
  };

  const handleSave = async (form) => {
    try {
      setError(null);
      const jobNumberQuery = form.jobNumber ? form.jobNumber.trim() : "";
      const regQuery = form.reg ? form.reg.trim() : "";
      let resolvedJob = null;

      if (!form.jobId && jobNumberQuery) {
        const { data: jobMatches, error: jobLookupError } = await supabaseClient
          .from("jobs")
          .select("id, vehicle_id")
          .ilike("job_number", jobNumberQuery)
          .limit(1);

        if (jobLookupError) {
          console.warn("Job lookup failed", jobLookupError);
        } else {
          resolvedJob = jobMatches?.[0] || null;
        }
      }

      if (!resolvedJob && !form.vehicleId && regQuery) {
        const { data: regMatches, error: regLookupError } = await supabaseClient
          .from("jobs")
          .select("id, vehicle_id")
          .ilike("vehicle_reg", regQuery)
          .limit(1);

        if (regLookupError) {
          console.warn("Vehicle lookup failed", regLookupError);
        } else {
          resolvedJob = regMatches?.[0] || null;
        }
      }

      const payload = {
        actionType: form.actionType || "job_complete",
        jobId: form.jobId || resolvedJob?.id || null,
        jobNumber: jobNumberQuery ? jobNumberQuery.toUpperCase() : "",
        vehicleId: form.vehicleId || resolvedJob?.vehicle_id || null,
        vehicleReg: regQuery ? regQuery.toUpperCase() : "",
        keyLocation: form.keyLocation,
        vehicleLocation: form.vehicleLocation,
        notes: form.notes,
        performedBy: dbUserId || null,
      };

      const response = await fetch(buildApiUrl(NEXT_ACTION_ENDPOINT), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ message: "Failed to save entry" }));
        throw new Error(errorPayload?.message || "Failed to save entry");
      }

      await loadEntries();
      closeEntryModal();
      setSimplifiedModal({ open: false, initialData: null });
    } catch (saveError) {
      console.error("Failed to log tracking entry", saveError);
      setError(saveError.message || "Unable to save tracking entry");
    }
  };

  const renderTrackerContent = () => (
    <section style={SECTION_STYLE}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ margin: "6px 0 0", fontSize: "1.5rem", color: "var(--accent-purple)" }}>Active jobs</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={loadEntries}
            style={{
              padding: "8px 16px",
              borderRadius: "12px",
              border: "none",
              background: "var(--accent-purple)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            Refresh
          </button>
          {loading && (
            <span style={{ color: "var(--accent-purple)", fontWeight: 600 }}>Refreshing…</span>
          )}
          <button
            type="button"
            onClick={() => openEntryModal("car")}
            style={{
              padding: "8px 12px",
              borderRadius: "10px",
              border: "none",
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Add location
          </button>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "12px",
          maxHeight: "calc(4 * 180px + 3 * 12px)",
          overflowY: "auto",
          paddingRight: "4px",
        }}
      >
        {entries.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "12px",
              borderRadius: "12px",
              border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
              textAlign: "center",
              color: "var(--info-dark)",
            }}
          >
            No active job tracking data yet.
          </div>
        )}
        {activeEntries.length === 0 && entries.length > 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "12px",
              borderRadius: "12px",
              border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
              textAlign: "center",
              color: "var(--info-dark)",
            }}
          >
            Waiting for job-mapped tracking entries.
          </div>
        )}
        {activeEntries.map((entry) => {
          const isHighlighted = highlightedJobNumber && entry.jobNumber?.toLowerCase() === highlightedJobNumber.toLowerCase();
          return (
            <CombinedTrackerCard
              key={entry.jobId || entry.id || `${entry.jobNumber}-${entry.updatedAt}`}
              entry={entry}
              isHighlighted={isHighlighted}
              onClick={() => openEntryModal("car", {
                id: entry.id,
                jobId: entry.jobId,
                jobNumber: entry.jobNumber,
                reg: entry.reg,
                customer: entry.customer,
                serviceType: entry.serviceType,
                vehicleLocation: entry.vehicleLocation,
                keyLocation: entry.keyLocation,
                status: entry.status,
                keyTip: entry.keyTip,
                notes: entry.notes,
              })}
            />
          );
        })}
      </div>
    </section>
  );

  const renderEquipmentContent = () => (
    <section style={{ ...SECTION_STYLE, gap: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ margin: "6px 0 0", fontSize: "1.5rem", color: "var(--accent-purple)" }}>
            Equipment &amp; tools
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setEquipmentModal({ open: true, item: null })}
          style={{
            padding: "10px 18px",
            borderRadius: "12px",
            border: "none",
            background: "var(--primary)",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add Equipment/tools
        </button>
        {equipmentLoading && (
          <span style={{ alignSelf: "center", color: "var(--info)", fontWeight: 600 }}>Loading…</span>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "16px",
        }}
      >
        {equipmentChecks.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "12px",
              borderRadius: "12px",
              border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
              textAlign: "center",
              color: "var(--info-dark)",
            }}
          >
            Equipment service list is empty.
          </div>
        )}
        {equipmentChecks.map((check) => {
          const dueLabel = getDueLabel(check.nextDue);
          const isDue = dueLabel === "Due now";
          const statusLabel = (check.status || "").toLowerCase();
          const badgeColor = statusLabel.includes("due") || isDue ? "var(--danger)" : "var(--success-dark)";
          const durationLabel = getDurationDisplay(check);
          return (
            <div
              key={check.id}
              role="button"
              tabIndex={0}
              onClick={() => setEquipmentModal({ open: true, item: check })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setEquipmentModal({ open: true, item: check });
                }
              }}
              style={{
                padding: "18px",
                borderRadius: "16px",
                border: "1px solid rgba(var(--grey-accent-rgb), 0.3)",
                background: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "10px",
                  minHeight: "28px",
                }}
              >
                <div style={{ flex: 1 }}>
                  <strong style={{ display: "block", fontSize: "1.05rem" }}>{check.name}</strong>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: badgeColor, flexShrink: 0 }}>
                  {check.status || dueLabel}
                </span>
              </div>
              <div style={{ display: "grid", gap: "6px", flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "var(--info-dark)",
                  }}
                >
                  <span>Last checked</span>
                  <strong>{formatDateOnlyLabel(check.lastChecked)}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "var(--info-dark)",
                  }}
                >
                  <span>Next due</span>
                  <strong>{formatDateOnlyLabel(check.nextDue)}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "var(--info-dark)",
                  }}
                >
                  <span>Check interval</span>
                  <strong>{durationLabel}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleEquipmentCheck(check.id);
                }}
                style={{
                  marginTop: "auto",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "none",
                  background: "var(--primary)",
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Log check
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderOilContent = () => (
    <section style={{ ...SECTION_STYLE, gap: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ margin: "6px 0 0", fontSize: "1.5rem", color: "var(--accent-purple)" }}>
            Oil / Stock
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setOilStockModal({ open: true, item: null })}
          style={{
            padding: "10px 18px",
            borderRadius: "12px",
            border: "none",
            background: "var(--primary)",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add Oil / Stock
        </button>
        {oilLoading && (
          <span style={{ alignSelf: "center", color: "var(--info)", fontWeight: 600 }}>Loading…</span>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "16px",
        }}
      >
        {oilChecks.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "12px",
              borderRadius: "12px",
              border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
              textAlign: "center",
              color: "var(--info-dark)",
            }}
          >
            Oil stock checklist is empty.
          </div>
        )}
        {oilChecks.map((item) => {
          const dueLabel = getDueLabel(item.nextCheck);
          const isDue = dueLabel === "Due now";
          const durationLabel = getDurationDisplay(item);
          const isTopUpActive = activeTopUpId === item.id;
          const badgeColor = isDue ? "var(--danger)" : "var(--success-dark)";
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => !isTopUpActive && setOilStockModal({ open: true, item })}
              onKeyDown={(event) => {
                if (!isTopUpActive && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  setOilStockModal({ open: true, item });
                }
              }}
              style={{
                padding: "18px",
                borderRadius: "16px",
                border: "1px solid rgba(var(--grey-accent-rgb), 0.3)",
                background: "var(--surface)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                cursor: isTopUpActive ? "default" : "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "10px",
                  minHeight: "28px",
                }}
              >
                <div style={{ flex: 1 }}>
                  <strong style={{ display: "block", fontSize: "1.05rem" }}>{item.title}</strong>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: badgeColor, flexShrink: 0 }}>
                  {dueLabel}
                </span>
              </div>
              <div style={{ display: "grid", gap: "6px", flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "var(--info-dark)",
                  }}
                >
                  <span>Stock amount</span>
                  <strong>{item.stock || "—"}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "var(--info-dark)",
                  }}
                >
                  <span>Last check</span>
                  <strong>{formatDateOnlyLabel(item.lastCheck)}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "var(--info-dark)",
                  }}
                >
                  <span>Next check</span>
                  <strong>{formatDateOnlyLabel(item.nextCheck)}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "var(--info-dark)",
                  }}
                >
                  <span>Check interval</span>
                  <strong>{durationLabel}</strong>
                </div>
              </div>
              {isTopUpActive && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--info)", fontWeight: 600 }}>
                    Top up stock amount
                  </label>
                  <input
                    type="text"
                    value={topUpValue}
                    onChange={(e) => setTopUpValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="e.g., 18 × 5L cans"
                    style={{
                      padding: "8px 10px",
                      borderRadius: "10px",
                      border: "1px solid var(--accent-purple-surface)",
                      fontSize: "0.9rem",
                    }}
                  />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOilCheck(item.id, topUpValue);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: "var(--success)",
                      color: "white",
                      fontWeight: 600,
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    Save
                  </button>
                </div>
              )}
              {!isTopUpActive && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveTopUpId(item.id);
                    setTopUpValue(item.stock || "");
                  }}
                  style={{
                    marginTop: "auto",
                    padding: "8px 14px",
                    borderRadius: "10px",
                    border: "none",
                    background: "var(--primary)",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Mark checked
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderActiveTabContent = () => {
    if (activeTab === "equipment") {
      return renderEquipmentContent();
    }
    if (activeTab === "oil-stock") {
      return renderOilContent();
    }
    return renderTrackerContent();
  };

  return (
    <Layout>
      <div
        style={{
          padding: "32px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "24px",
        }}
      >
        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div
            style={{
              borderRadius: "999px",
              border: "1px solid var(--surface-light)",
              background: "var(--surface)",
              padding: "6px",
              display: "flex",
              gap: "6px",
              width: "100%",
              overflowX: "auto",
              flexShrink: 0,
              scrollbarWidth: "thin",
              scrollbarColor: "var(--scrollbar-thumb) transparent",
              scrollBehavior: "smooth",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: "0 0 auto",
                    borderRadius: "999px",
                    border: "1px solid transparent",
                    padding: "10px 20px",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: isActive ? "var(--primary)" : "transparent",
                    color: isActive ? "var(--text-inverse)" : "var(--text-primary)",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "16px",
                border: "1px solid rgba(var(--danger-rgb), 0.25)",
                background: "rgba(var(--danger-rgb), 0.8)",
                color: "var(--danger)",
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}
          {renderActiveTabContent()}
        </div>
      </div>

      {searchModal.open && (
        <LocationSearchModal
          type={searchModal.type}
          options={searchModal.type === "car" ? CAR_LOCATIONS : KEY_LOCATIONS}
          onClose={closeSearchModal}
          onSelect={handleLocationSelect}
        />
      )}

      {entryModal.open && (
        <LocationEntryModal
          context={entryModal.type}
          entry={entryModal.entry}
          onClose={closeEntryModal}
          onSave={handleSave}
        />
      )}

      {simplifiedModal.open && (
        <SimplifiedTrackingModal
          initialData={simplifiedModal.initialData}
          onClose={() => setSimplifiedModal({ open: false, initialData: null })}
          onSave={handleSave}
        />
      )}

      {equipmentModal.open && (
        <EquipmentToolsModal
          initialData={equipmentModal.item}
          onClose={() => setEquipmentModal({ open: false, item: null })}
          onSave={handleSaveEquipment}
          onDelete={handleDeleteEquipment}
        />
      )}

      {oilStockModal.open && (
        <OilStockModal
          initialData={oilStockModal.item}
          onClose={() => setOilStockModal({ open: false, item: null })}
          onSave={handleSaveOilStock}
          onDelete={handleDeleteOilStock}
        />
      )}
    </Layout>
  );
}
