// file location: src/pages/tracking/index.js
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { buildApiUrl } from "@/utils/apiClient";
import { fetchTrackingSnapshot } from "@/lib/database/tracking";
import { supabaseClient } from "@/lib/database/supabaseClient";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { CalendarField } from "@/components/ui/calendarAPI";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { Button, InputField, StatusMessage } from "@/components/ui";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import { addMonths } from "date-fns";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import TrackingDashboardUi from "@/components/page-ui/tracking/tracking-ui"; // Extracted presentation layer.

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
{ id: "trade", label: "Trade" }];


const KEY_LOCATION_GROUPS = [
{
  title: "General",
  options: [{ id: "na", label: "N/A" }]
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
  { id: "prep", label: "Prep" }]

}];


const KEY_LOCATIONS = KEY_LOCATION_GROUPS.flatMap((group) =>
group.options.map((option) => ({
  id: option.id,
  label: option.label,
  group: group.title
}))
);

const CAR_LOCATION_OPTIONS = CAR_LOCATIONS.map((location) => ({
  key: location.id,
  value: location.label,
  label: location.label
}));

const KEY_LOCATION_OPTIONS = KEY_LOCATIONS.map((location) => ({
  key: location.id,
  value: location.label,
  label: location.label,
  description: location.group
}));

const normalizeKeyLocationLabel = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.
  replace(/^Keys (received|hung|updated)\s*[-–]\s*/i, "").
  replace(/^Key location\s*[-:–]\s*/i, "").
  replace(/^Key locations?\s*[-:–]\s*/i, "");
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
  ...options];

};

const AUTO_MOVEMENT_RULES = {
  "workshop in progress": {
    keyLocation: "Workshop Cupboard – Jobs in Progress",
    vehicleLocation: "In Workshop",
    vehicleStatus: "In Workshop"
  },
  wash: {
    keyLocation: "Workshop Cupboard – Wash",
    vehicleStatus: "Wash"
  },
  complete: {
    keyLocation: "Workshop Cupboard – Complete",
    vehicleLocation: "Ready for Release",
    vehicleStatus: "Ready for Release"
  }
};

const getAutoMovementRule = (status) => {
  if (!status) return null;
  return AUTO_MOVEMENT_RULES[status.trim().toLowerCase()] || null;
};

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
    label: `${months} month${months === 1 ? "" : "s"}`
  };
}),
...Array.from({ length: 3 }, (_, index) => {
  const years = index + 1;
  const months = years * 12;
  return {
    key: `y-${years}`,
    value: months,
    label: `${years} year${years === 1 ? "" : "s"}`
  };
})];


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

const formatDateOnlyLabel = (value) => {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending";
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
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

const TRACKING_FILTER_ALL = "__all__";
const TRACKING_FILTER_EMPTY = "__empty__";

const getSectionStyle = (isMobileView) => ({
  padding: isMobileView ?
  "var(--section-card-padding-sm, 16px)" :
  "var(--page-card-padding)",
  borderRadius: "var(--radius-xl)",
  background: "var(--section-card-bg)",
  border: "var(--section-card-border)",
  display: "flex",
  flexDirection: "column",
  gap: isMobileView ? "16px" : "18px",
  minWidth: 0
});

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
  notes: ""
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

const CombinedTrackerCard = ({ entry, isHighlighted, onClick, isMobileView = false }) => {
  const vehicleMeta = [entry.makeModel, entry.colour].filter(Boolean).join(" • ");
  void isMobileView;

  return (
    <div
      onClick={onClick}
      style={{
        padding: "20px 24px",
        borderRadius: "var(--radius-sm)",
        border: "none",
        background: isHighlighted ? "rgba(var(--danger-rgb), 0.08)" : "var(--theme)",
        boxShadow: "none",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        height: "160px",
        overflow: "hidden"
      }}>
      
      <div style={{ minWidth: 0 }}>
        <strong
          style={{
            fontSize: "clamp(0.78rem, 1.4vw, var(--text-h3))",
            fontWeight: 700,
            color: "var(--text-1)",
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}>
          
          {entry.jobNumber || "Unknown job"} • {entry.reg || "Unknown reg"} • {entry.customer || "Customer pending"}
        </strong>
        <div
          style={{
            marginTop: "4px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            minWidth: 0
          }}>
          
          <p
            style={{
              margin: 0,
              fontSize: "clamp(0.66rem, 1vw, 0.78rem)",
              color: "var(--info-dark)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              flex: 1
            }}>
            
            {vehicleMeta || "Make/Model/Colour pending"}
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--info)", whiteSpace: "nowrap", flexShrink: 0 }}>
            Last moved {formatRelativeTime(entry.updatedAt)}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobileView ? "1fr" : "1fr 1fr",
          gap: "8px",
          marginTop: "8px",
          minWidth: 0
        }}>
        
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Key location</p>
          <strong
            style={{
              fontSize: "clamp(0.72rem, 1.1vw, var(--text-body))",
              color: "var(--accent-purple)",
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>
            
            {normalizeKeyLocationLabel(entry.keyLocation) || "Pending"}
          </strong>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--info)" }}>Car location</p>
          <strong
            style={{
              fontSize: "clamp(0.72rem, 1.1vw, var(--text-body))",
              color: "var(--success-dark)",
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>
            
            {entry.vehicleLocation || "Unallocated"}
          </strong>
        </div>
      </div>
    </div>);

};
const LocationSearchModal = ({ type, options, onClose, onSelect }) => {
  useBodyModalLock(true);

  const [query, setQuery] = useState("");
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div
      className="popup-backdrop"
      role="dialog"
      aria-modal="true"
      style={{
        ...popupOverlayStyles,
        zIndex: 200
      }}>
      
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
          color: "var(--search-text)"
        }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--info)", letterSpacing: "0.08em" }}>
              {type === "car" ? "Parking library" : "Key hook library"}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>Search location</h2>
          </div>
          <Button variant="ghost" size="sm" pill onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <SearchBar
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          placeholder={type === "car" ? "Search bays or overflow" : "Search key safes, drawers"} />
        

        <div
          style={{
            maxHeight: "320px",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)"
          }}>
          
          {filtered.map((option) =>
          <div
            key={option.id}
            style={{
              padding: "var(--space-4)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--search-surface-muted)",
              background: "var(--search-surface)",
              color: "var(--search-text)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap"
            }}>
            
              <strong style={{ color: "var(--text-1)" }}>{option.label}</strong>
              <Button variant="secondary" size="sm" onClick={() => onSelect(option)}>
                Use location
              </Button>
            </div>
          )}

          {filtered.length === 0 &&
          <div
            style={{
              padding: "18px",
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--search-surface-muted)",
              textAlign: "center",
              color: "var(--search-text)"
            }}>
            
              No locations found.
            </div>
          }
        </div>

        {/* TODO: Replace static location lists with DB-driven results */}
      </div>
    </div>);

};

const buildEquipmentFormState = (data = null) => {
  const intervalMonths = data ? deriveIntervalMonthsFromItem(data) : "";
  return {
    id: data?.id || null,
    name: data?.name || "",
    lastCheckedDate: data?.lastChecked ? toDateInputValue(data.lastChecked) : "",
    nextDueDate: data?.nextDue ? toDateInputValue(data.nextDue) : "",
    intervalMonths: intervalMonths ? Number(intervalMonths) : ""
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
    intervalMonths: intervalMonths ? Number(intervalMonths) : ""
  };
};

const EquipmentToolsModal = ({ initialData = null, onClose, onSave, onDelete }) => {
  useBodyModalLock(true);

  const [form, setForm] = useState(() => buildEquipmentFormState(initialData));
  const [confirmDialog, setConfirmDialog] = useState(null);

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
    const lastChecked = form.lastCheckedDate ?
    new Date(`${form.lastCheckedDate}T00:00:00`).toISOString() :
    null;
    const nextDue = form.nextDueDate ?
    new Date(`${form.nextDueDate}T00:00:00`).toISOString() :
    null;
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
      intervalDays
    });
  };

  return (
    <div className="popup-backdrop" role="dialog" aria-modal="true" style={{ ...popupOverlayStyles, zIndex: 220 }}>
      <form
        onSubmit={handleSubmit}
        style={{
          ...popupCardStyles,
          width: "min(600px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px"
        }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{initialData ? "Edit Equipment/Tools" : "Add Equipment/Tools"}</h2>
          <Button variant="ghost" size="sm" pill onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <InputField
          label="Name *"
          required
          value={form.name}
          onChange={(event) => handleChange("name", event.target.value)}
          placeholder="Equipment name" />
        

        <CalendarField
          label="Last Checked"
          value={form.lastCheckedDate}
          onChange={(e) => handleChange("lastCheckedDate", e.target.value)}
          placeholder="Select date"
          size="md" />
        

        <DropdownField
          label="Duration until next check *"
          required
          options={CHECK_DURATION_OPTIONS}
          value={form.intervalMonths}
          onValueChange={(value) =>
          handleChange("intervalMonths", value ? Number(value) : "")
          }
          placeholder="Select duration"
          size="md" />
        

        <CalendarField
          label="Next Due"
          value={form.nextDueDate}
          placeholder="Select date"
          size="md"
          disabled />
        

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--space-2)",
            marginTop: "var(--space-2)"
          }}>
          
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {initialData?.id &&
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (!initialData?.id) return;
                setConfirmDialog({
                  message: "Delete this equipment entry?",
                  onConfirm: () => {
                    setConfirmDialog(null);
                    onDelete?.(initialData.id);
                  }
                });
              }}>
              
                Delete
              </Button>
            }
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {initialData ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      </form>
      <ConfirmationDialog
        isOpen={!!confirmDialog}
        message={confirmDialog?.message}
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onCancel={() => setConfirmDialog(null)}
        onConfirm={confirmDialog?.onConfirm} />
      
    </div>);

};

const OilStockModal = ({ initialData = null, onClose, onSave, onDelete }) => {
  useBodyModalLock(true);

  const [form, setForm] = useState(() => buildOilFormState(initialData));
  const [confirmDialog, setConfirmDialog] = useState(null);

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
    const lastCheck = form.lastCheckDate ?
    new Date(`${form.lastCheckDate}T00:00:00`).toISOString() :
    null;
    const nextCheck = form.nextCheckDate ?
    new Date(`${form.nextCheckDate}T00:00:00`).toISOString() :
    null;
    const lastToppedUp = form.lastToppedUpDate ?
    new Date(`${form.lastToppedUpDate}T00:00:00`).toISOString() :
    null;
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
      intervalDays
    });
  };

  return (
    <div className="popup-backdrop" role="dialog" aria-modal="true" style={{ ...popupOverlayStyles, zIndex: 220 }}>
      <form
        onSubmit={handleSubmit}
        style={{
          ...popupCardStyles,
          width: "min(650px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px"
        }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{initialData ? "Edit Oil / Stock" : "Add Oil / Stock"}</h2>
          <Button variant="ghost" size="sm" pill onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <InputField
          label="Title *"
          required
          value={form.title}
          onChange={(event) => handleChange("title", event.target.value)}
          placeholder="Oil/Stock title" />
        

        <InputField
          label="Stock"
          value={form.stock}
          onChange={(event) => handleChange("stock", event.target.value)}
          placeholder="e.g., 18 × 5L cans" />
        

        <CalendarField
          label="Last Check"
          value={form.lastCheckDate}
          onChange={(e) => handleChange("lastCheckDate", e.target.value)}
          placeholder="Select date"
          size="md" />
        

        <DropdownField
          label="Duration until next check *"
          required
          options={CHECK_DURATION_OPTIONS}
          value={form.intervalMonths}
          onValueChange={(value) =>
          handleChange("intervalMonths", value ? Number(value) : "")
          }
          placeholder="Select duration"
          size="md" />
        

        <CalendarField
          label="Next Check"
          value={form.nextCheckDate}
          placeholder="Select date"
          size="md"
          disabled />
        

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "var(--space-2)",
            marginTop: "var(--space-2)",
            flexWrap: "wrap"
          }}>
          
          {initialData?.id &&
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (!initialData?.id) return;
              setConfirmDialog({
                message: "Delete this oil/stock entry?",
                onConfirm: () => {
                  setConfirmDialog(null);
                  onDelete?.(initialData.id);
                }
              });
            }}>
            
              Delete
            </Button>
          }
          <div style={{ display: "flex", gap: "var(--space-2)", marginLeft: "auto" }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {initialData ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      </form>
      <ConfirmationDialog
        isOpen={!!confirmDialog}
        message={confirmDialog?.message}
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onCancel={() => setConfirmDialog(null)}
        onConfirm={confirmDialog?.onConfirm} />
      
    </div>);

};

const SimplifiedTrackingModal = ({ initialData, onClose, onSave }) => {
  useBodyModalLock(true);

  const [form, setForm] = useState(() => ({
    jobNumber: initialData?.jobNumber || "",
    reg: initialData?.reg || "",
    customer: initialData?.customer || "",
    makeModel: initialData?.makeModel || "",
    colour: initialData?.colour || "",
    vehicleLocation: initialData?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: initialData?.keyLocation || KEY_LOCATIONS[0].label
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
      const { data, error } = await supabaseClient.
      from("jobs").
      select(`
          job_number,
          vehicle:vehicle_id(registration, reg, make, model, make_model, colour),
          customer:customer_id(name, firstname, lastname)
        `).
      or(
        searchField === "jobNumber" ? `job_number.ilike.%${searchValue}%` :
        searchField === "reg" ? `vehicle_id.registration.ilike.%${searchValue}%,vehicle_id.reg.ilike.%${searchValue}%` :
        `customer_id.name.ilike.%${searchValue}%,customer_id.firstname.ilike.%${searchValue}%,customer_id.lastname.ilike.%${searchValue}%`
      ).
      limit(1).
      single();

      if (!error && data) {
        setForm((prev) => ({
          ...prev,
          jobNumber: data.job_number || prev.jobNumber,
          reg: data.vehicle?.registration || data.vehicle?.reg || prev.reg,
          customer: data.customer?.name || `${data.customer?.firstname || ""} ${data.customer?.lastname || ""}`.trim() || prev.customer,
          makeModel: data.vehicle?.make_model || `${data.vehicle?.make || ""} ${data.vehicle?.model || ""}`.trim() || prev.makeModel,
          colour: data.vehicle?.colour || prev.colour
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
    <div className="popup-backdrop" role="dialog" aria-modal="true">
      <div
        style={{
          ...popupCardStyles,
          width: "min(800px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: "0 0 var(--space-xs) 0" }}>Vehicle & Key Tracking</h2>
            <p style={{ margin: 0, fontSize: "var(--text-body-sm)", color: "var(--text-1)" }}>
              Track vehicle and key locations
            </p>
          </div>
          <Button variant="ghost" size="sm" pill onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "var(--space-3)",
            padding: "var(--space-md)",
            backgroundColor: "var(--surface)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--primary-border)"
          }}>
          
          <div>
            <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", marginBottom: "var(--space-xs)" }}>Job Number</div>
            <div style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>{form.jobNumber || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", marginBottom: "var(--space-xs)" }}>Registration</div>
            <div style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>{form.reg || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", marginBottom: "var(--space-xs)" }}>Make & Model</div>
            <div style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>{form.makeModel || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", marginBottom: "var(--space-xs)" }}>Colour</div>
            <div style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>{form.colour || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", marginBottom: "var(--space-xs)" }}>Customer</div>
            <div style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>{form.customer || "—"}</div>
          </div>
        </div>

        <form onSubmit={handleAddLocation} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <h3 style={{ margin: "0", fontSize: "var(--text-h4)", fontWeight: 600 }}>Add Location</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-3)"
            }}>
            
            <InputField
              label="Job Number / Reg / Customer"
              value={form.jobNumber || form.reg || form.customer}
              onChange={(e) => {
                const value = e.target.value;
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
              disabled={isSearching} />
            
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <DropdownField
              label="Vehicle Location"
              options={CAR_LOCATION_OPTIONS}
              value={form.vehicleLocation}
              onValueChange={(value) => handleChange("vehicleLocation", value)}
              placeholder="Select location"
              size="md" />
            
            <DropdownField
              label="Key Location"
              options={KEY_LOCATION_OPTIONS}
              value={form.keyLocation}
              onValueChange={(value) => handleChange("keyLocation", value)}
              placeholder="Select key location"
              size="md" />
            
          </div>

          <Button type="submit" variant="primary">
            Add Location
          </Button>
        </form>

        <div style={{ height: "1px", backgroundColor: "var(--primary-border)" }} />

        <Button
          type="button"
          variant={showUpdate ? "primary" : "secondary"}
          onClick={() => setShowUpdate(!showUpdate)}>
          
          {showUpdate ? "Hide Update Section" : "Update Existing Location"}
        </Button>

        {showUpdate &&
        <form
          onSubmit={handleUpdateLocation}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          
            <h3 style={{ margin: "0", fontSize: "var(--text-h4)", fontWeight: 600 }}>Update Location</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <DropdownField
              label="Vehicle Location"
              options={CAR_LOCATION_OPTIONS}
              value={form.vehicleLocation}
              onValueChange={(value) => handleChange("vehicleLocation", value)}
              placeholder="Select location"
              size="md" />
            
              <DropdownField
              label="Key Location"
              options={KEY_LOCATION_OPTIONS}
              value={form.keyLocation}
              onValueChange={(value) => handleChange("keyLocation", value)}
              placeholder="Select key location"
              size="md" />
            
            </div>

            <Button type="submit" variant="primary">
              Update
            </Button>
          </form>
        }
      </div>
    </div>);

};

const LocationEntryModal = ({ context, entry, onClose, onSave, existingEntries = [] }) => {
  useBodyModalLock(true);

  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...entry,
    vehicleLocation: entry?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: normalizeKeyLocationLabel(entry?.keyLocation) || KEY_LOCATIONS[0].label,
    status: entry?.status || "Waiting For Collection"
  }));
  const [matchedExisting, setMatchedExisting] = useState(Boolean(entry)); // tracks whether form auto-filled from existing entry
  const vehicleLocationOptions = useMemo(
    () => ensureDropdownOption(CAR_LOCATION_OPTIONS, form.vehicleLocation),
    [form.vehicleLocation]
  );
  const keyLocationOptions = useMemo(
    () => ensureDropdownOption(KEY_LOCATION_OPTIONS, form.keyLocation),
    [form.keyLocation]
  );

  // Auto-fill from existing entries when job number, reg, or customer matches
  const tryAutoFill = useCallback(
    (field, value) => {
      if (!value || !value.trim() || entry) return null; // skip if already editing an entry
      const trimmed = value.trim().toLowerCase();
      const match = existingEntries.find((e) => {
        if (field === "jobNumber") return e.jobNumber && e.jobNumber.trim().toLowerCase() === trimmed;
        if (field === "reg") return e.reg && e.reg.trim().toLowerCase() === trimmed;
        if (field === "customer") return e.customer && e.customer.trim().toLowerCase() === trimmed;
        return false;
      });
      return match || null;
    },
    [existingEntries, entry]
  );

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    // Auto-fill when typing in jobNumber, reg, or customer and a match is found
    if (["jobNumber", "reg", "customer"].includes(field)) {
      const match = tryAutoFill(field, value);
      if (match) {
        setForm((prev) => ({
          ...prev,
          [field]: value, // keep what user typed for this field
          id: match.id || prev.id,
          jobId: match.jobId || prev.jobId,
          jobNumber: field === "jobNumber" ? value : match.jobNumber || prev.jobNumber,
          reg: field === "reg" ? value : match.reg || prev.reg,
          customer: field === "customer" ? value : match.customer || prev.customer,
          serviceType: match.serviceType || prev.serviceType,
          colour: match.colour || prev.colour,
          vehicleLocation: match.vehicleLocation || prev.vehicleLocation,
          keyLocation: normalizeKeyLocationLabel(match.keyLocation) || prev.keyLocation,
          status: match.status || prev.status,
          notes: match.notes || prev.notes
        }));
        setMatchedExisting(true); // switch heading to "Edit existing"
      } else {
        setMatchedExisting(false); // revert to "Log new" if no match
      }
    }
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
    <div className="popup-backdrop" role="dialog" aria-modal="true">
      <form
        onSubmit={handleSubmit}
        className="popup-card"
        style={{
          borderRadius: "var(--radius-xl)",
          width: "100%",
          maxWidth: "640px",
          maxHeight: "90vh",
          overflowY: "auto",
          border: "none",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "18px"
        }}>
        
        <div>
          <h2 style={{ margin: 0 }}>{entry || matchedExisting ? "Edit existing" : "Log new"}</h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px"
          }}>
          
          {[
          { label: "Job Number", field: "jobNumber", placeholder: "HNP-4821" },
          { label: "Registration", field: "reg", placeholder: "GY21 HNP" },
          { label: "Customer", field: "customer", placeholder: "Customer name" },
          { label: "Service Type", field: "serviceType", placeholder: "MOT, Service..." }].
          map((input) =>
          <InputField
            key={input.field}
            label={input.label}
            value={form[input.field]}
            onChange={(event) => handleChange(input.field, event.target.value)}
            placeholder={input.placeholder} />

          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--space-2)"
          }}>
          
          <DropdownField
            label="Vehicle Location"
            options={vehicleLocationOptions}
            value={form.vehicleLocation}
            onValueChange={(value) => handleChange("vehicleLocation", value)}
            placeholder="Select location"
            size="md" />
          
          <DropdownField
            label="Key Location"
            required
            options={keyLocationOptions}
            value={form.keyLocation}
            onValueChange={(value) => handleChange("keyLocation", value)}
            placeholder="Select key location"
            size="md" />
          
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save update
          </Button>
        </div>

        {/* TODO: Persist vehicle/key updates via API endpoint */}
      </form>
    </div>);

};

export default function TrackingDashboard() {
  const router = useRouter();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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
  const [isMobileView, setIsMobileView] = useState(false); // portrait phone layout toggle
  const [isWideTrackerView, setIsWideTrackerView] = useState(false);
  const [trackerSearchTerm, setTrackerSearchTerm] = useState("");
  const [trackerStatusFilter, setTrackerStatusFilter] = useState(TRACKING_FILTER_ALL);
  const [trackerVehicleLocationFilter, setTrackerVehicleLocationFilter] = useState(TRACKING_FILTER_ALL);
  const [equipmentSearchTerm, setEquipmentSearchTerm] = useState("");
  const [equipmentDueFilter, setEquipmentDueFilter] = useState(TRACKING_FILTER_ALL);
  const [oilSearchTerm, setOilSearchTerm] = useState("");
  const [oilDueFilter, setOilDueFilter] = useState(TRACKING_FILTER_ALL);

  // Match the portrait-phone behaviour used across the app shell.
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px) and (orientation: portrait)");
    setIsMobileView(mediaQuery.matches);
    const handler = (event) => setIsMobileView(event.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    setIsWideTrackerView(mediaQuery.matches);
    const handler = (event) => setIsWideTrackerView(event.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

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
            colour: colour || ""
          }
        });
        return;
      }

      // Check if an existing entry matches the job
      const existingEntry = entries.find(
        (entry) =>
        jobNumber && entry.jobNumber?.toLowerCase() === jobNumber.toLowerCase() ||
        reg && entry.reg?.toLowerCase() === reg.toLowerCase()
      );

      // If no existing entry found, auto-open the Log New popup with pre-filled data
      if (!existingEntry && entries.length > 0) {
        openEntryModal("car", {
          ...emptyForm,
          jobNumber: jobNumber || "",
          reg: reg || "",
          customer: customer || ""
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
        intervalDays
      };

      try {
        const response = await fetch(EQUIPMENT_API_ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to log equipment check");
        }
        const updated = result.data;
        setEquipmentChecks((prev) => prev.map((item) => item.id === updated.id ? updated : item));
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
        intervalDays
      };

      try {
        const response = await fetch(OIL_STOCK_API_ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to mark check");
        }
        const updated = result.data;
        setOilChecks((prev) => prev.map((item) => item.id === updated.id ? updated : item));
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
      Number(form.intervalDays) > 0 && Number(form.intervalDays) ||
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
        createdBy: dbUserId || null
      };

      const method = payload.id ? "PUT" : "POST";

      try {
        const response = await fetch(EQUIPMENT_API_ENDPOINT, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to save equipment entry");
        }
        const saved = result.data;
        setEquipmentChecks((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          if (exists) {
            return prev.map((item) => item.id === saved.id ? saved : item);
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
      Number(form.intervalDays) > 0 && Number(form.intervalDays) ||
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
        createdBy: dbUserId || null
      };

      const method = payload.id ? "PUT" : "POST";

      try {
        const response = await fetch(OIL_STOCK_API_ENDPOINT, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to save oil/stock entry");
        }
        const saved = result.data;
        setOilChecks((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          if (exists) {
            return prev.map((item) => item.id === saved.id ? saved : item);
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
        method: "DELETE"
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
        method: "DELETE"
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
          performedBy: dbUserId || null
        };

        const response = await fetch(buildApiUrl(NEXT_ACTION_ENDPOINT), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorPayload = await response.
          json().
          catch(() => ({ message: "Failed to auto-sync locations" }));
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
    const channel = supabaseClient.
    channel("tracking-job-status").
    on(
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
    ).
    subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [handleAutoMovement]);

  const activeEntries = useMemo(
    () =>
    entries.
    filter((entry) => entry.jobId).
    sort(
      (a, b) =>
      new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    ),
    [entries]
  );

  const trackerStatusFilterOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        activeEntries.
        map((entry) => String(entry.status || "").trim()).
        filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return [
    { key: TRACKING_FILTER_ALL, value: TRACKING_FILTER_ALL, label: "All statuses" },
    ...values.map((value) => ({
      key: `status-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      value,
      label: value
    }))];

  }, [activeEntries]);

  const trackerVehicleLocationFilterOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        activeEntries.map((entry) => {
          const location = String(entry.vehicleLocation || "").trim();
          return location || TRACKING_FILTER_EMPTY;
        })
      )
    ).sort((a, b) => {
      if (a === TRACKING_FILTER_EMPTY) return 1;
      if (b === TRACKING_FILTER_EMPTY) return -1;
      return a.localeCompare(b);
    });

    return [
    { key: TRACKING_FILTER_ALL, value: TRACKING_FILTER_ALL, label: "All car locations" },
    ...values.map((value) => ({
      key: `vehicle-location-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      value,
      label: value === TRACKING_FILTER_EMPTY ? "No car location" : value
    }))];

  }, [activeEntries]);

  const filteredActiveEntries = useMemo(() => {
    const query = trackerSearchTerm.trim().toLowerCase();

    return activeEntries.filter((entry) => {
      const matchesSearch =
      !query ||
      [
      entry.jobNumber,
      entry.reg,
      entry.customer,
      entry.makeModel,
      entry.colour,
      entry.serviceType,
      entry.status,
      entry.vehicleLocation,
      normalizeKeyLocationLabel(entry.keyLocation)].

      filter(Boolean).
      some((value) => String(value).toLowerCase().includes(query));

      if (!matchesSearch) {
        return false;
      }

      const entryStatus = String(entry.status || "").trim();
      if (trackerStatusFilter !== TRACKING_FILTER_ALL && entryStatus !== trackerStatusFilter) {
        return false;
      }

      const entryVehicleLocation = String(entry.vehicleLocation || "").trim() || TRACKING_FILTER_EMPTY;
      if (
      trackerVehicleLocationFilter !== TRACKING_FILTER_ALL &&
      entryVehicleLocation !== trackerVehicleLocationFilter)
      {
        return false;
      }

      return true;
    });
  }, [activeEntries, trackerSearchTerm, trackerStatusFilter, trackerVehicleLocationFilter]);

  const closeSearchModal = () => setSearchModal({ open: false, type: null });

  const openEntryModal = (type, entry = null) => setEntryModal({ open: true, type, entry });
  const closeEntryModal = () => setEntryModal({ open: false, type: null, entry: null });

  const handleLocationSelect = (option) => {
    closeSearchModal();
    openEntryModal(searchModal.type, {
      ...emptyForm,
      vehicleLocation: searchModal.type === "car" ? option.label : CAR_LOCATIONS[0].label,
      keyLocation: searchModal.type === "key" ? option.label : KEY_LOCATIONS[0].label
    });
  };

  const handleSave = async (form) => {
    try {
      setError(null);
      const jobNumberQuery = form.jobNumber ? form.jobNumber.trim() : "";
      const regQuery = form.reg ? form.reg.trim() : "";
      let resolvedJob = null;

      if (!form.jobId && jobNumberQuery) {
        const { data: jobMatches, error: jobLookupError } = await supabaseClient.
        from("jobs").
        select("id, vehicle_id").
        ilike("job_number", jobNumberQuery).
        limit(1);

        if (jobLookupError) {
          console.warn("Job lookup failed", jobLookupError);
        } else {
          resolvedJob = jobMatches?.[0] || null;
        }
      }

      if (!resolvedJob && !form.vehicleId && regQuery) {
        const { data: regMatches, error: regLookupError } = await supabaseClient.
        from("jobs").
        select("id, vehicle_id").
        ilike("vehicle_reg", regQuery).
        limit(1);

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
        performedBy: dbUserId || null
      };

      const response = await fetch(buildApiUrl(NEXT_ACTION_ENDPOINT), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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

  const renderTrackerContent = () =>
  <>
      <DevLayoutSection
      sectionKey="tracking-active-jobs-header"
      parentKey="tracking-page-body"
      sectionType="toolbar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "center"
      }}>
      
        <SearchBar
        value={trackerSearchTerm}
        onChange={(event) => setTrackerSearchTerm(event.target.value)}
        onClear={() => setTrackerSearchTerm("")}
        placeholder="Search active jobs"
        ariaLabel="Search active jobs"
        style={{
          flex: "1 1 320px",
          minWidth: "240px"
        }} />
      
        <DropdownField
        options={trackerStatusFilterOptions}
        value={trackerStatusFilter}
        onValueChange={(value) => setTrackerStatusFilter(value || TRACKING_FILTER_ALL)}
        size="md"
        style={{
          flex: "0 1 220px",
          minWidth: "180px"
        }} />
      
        <DropdownField
        options={trackerVehicleLocationFilterOptions}
        value={trackerVehicleLocationFilter}
        onValueChange={(value) => setTrackerVehicleLocationFilter(value || TRACKING_FILTER_ALL)}
        size="md"
        style={{
          flex: "0 1 220px",
          minWidth: "190px"
        }} />
      
      </DevLayoutSection>
      {entries.length === 0 &&
    <DevLayoutSection
      sectionKey="tracking-active-jobs-empty-state"
      parentKey="tracking-page-body"
      sectionType="empty-state"
      style={{
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
        textAlign: "center",
        color: "var(--info-dark)"
      }}>
      
          No active job tracking data yet.
        </DevLayoutSection>
    }
      {activeEntries.length === 0 && entries.length > 0 &&
    <DevLayoutSection
      sectionKey="tracking-active-jobs-unmapped-state"
      parentKey="tracking-page-body"
      sectionType="empty-state"
      style={{
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
        textAlign: "center",
        color: "var(--info-dark)"
      }}>
      
          Waiting for job-mapped tracking entries.
        </DevLayoutSection>
    }
      {activeEntries.length > 0 && filteredActiveEntries.length === 0 &&
    <DevLayoutSection
      sectionKey="tracking-active-jobs-filter-empty-state"
      parentKey="tracking-page-body"
      sectionType="empty-state"
      style={{
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
        textAlign: "center",
        color: "var(--info-dark)"
      }}>
      
          No active jobs match your search or filters.
        </DevLayoutSection>
    }
      <DevLayoutSection
      sectionKey="tracking-active-jobs-list"
      parentKey="tracking-page-body"
      sectionType="list"
      style={{
        display: "grid",
        gridTemplateColumns:
        !isMobileView && isWideTrackerView ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
        gap: "20px",
        maxHeight: isMobileView ? "none" : "calc(4 * 180px + 3 * 12px)",
        overflowY: "auto",
        paddingRight: "4px",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0
      }}>
      
        {filteredActiveEntries.map((entry, index) => {
        const isHighlighted = highlightedJobNumber && entry.jobNumber?.toLowerCase() === highlightedJobNumber.toLowerCase();
        return (
          <DevLayoutSection
            key={entry.jobId || entry.id || `${entry.jobNumber}-${entry.updatedAt}`}
            sectionKey={`tracking-active-jobs-card-${index + 1}`}
            parentKey="tracking-active-jobs-list"
            sectionType="content-card">
            
              <CombinedTrackerCard
              entry={entry}
              isHighlighted={isHighlighted}
              isMobileView={isMobileView}
              onClick={() => openEntryModal("car", {
                id: entry.id,
                jobId: entry.jobId,
                jobNumber: entry.jobNumber,
                reg: entry.reg,
                customer: entry.customer,
                colour: entry.colour,
                serviceType: entry.serviceType,
                vehicleLocation: entry.vehicleLocation,
                keyLocation: entry.keyLocation,
                status: entry.status,
                keyTip: entry.keyTip,
                notes: entry.notes
              })} />
            
            </DevLayoutSection>);

      })}
      </DevLayoutSection>
    </>;


  const renderEquipmentContent = () =>
  <>
      <DevLayoutSection
      sectionKey="tracking-equipment-header"
      parentKey="tracking-page-body"
      sectionType="toolbar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "center"
      }}>
      
        <SearchBar
        value={equipmentSearchTerm}
        onChange={(event) => setEquipmentSearchTerm(event.target.value)}
        onClear={() => setEquipmentSearchTerm("")}
        placeholder="Search equipment"
        ariaLabel="Search equipment"
        style={{
          flex: "1 1 320px",
          minWidth: "240px"
        }} />
      
        <DropdownField
        options={[
        { key: TRACKING_FILTER_ALL, value: TRACKING_FILTER_ALL, label: "All items" },
        { key: "due", value: "due", label: "Due now" },
        { key: "ok", value: "ok", label: "Not due" }]
        }
        value={equipmentDueFilter}
        onValueChange={(value) => setEquipmentDueFilter(value || TRACKING_FILTER_ALL)}
        size="md"
        style={{
          flex: "0 1 220px",
          minWidth: "180px"
        }} />
      
      </DevLayoutSection>
      <DevLayoutSection
      sectionKey="tracking-equipment-grid"
      parentKey="tracking-page-body"
      sectionType="grid"
      style={{
        display: "grid",
        gridTemplateColumns: isMobileView ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "16px",
        minWidth: 0
      }}>
      
        {equipmentChecks.length === 0 &&
      <DevLayoutSection
        sectionKey="tracking-equipment-empty-state"
        parentKey="tracking-equipment-grid"
        sectionType="empty-state"
        style={{
          gridColumn: "1 / -1",
          padding: "12px",
          borderRadius: "var(--radius-sm)",
          border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
          textAlign: "center",
          color: "var(--info-dark)"
        }}>
        
            Equipment service list is empty.
          </DevLayoutSection>
      }
        {equipmentChecks.
      filter((check) => {
        const term = equipmentSearchTerm.trim().toLowerCase();
        if (term && ![check.name, check.status].filter(Boolean).some((value) => value.toLowerCase().includes(term))) {
          return false;
        }
        if (equipmentDueFilter !== TRACKING_FILTER_ALL) {
          const isDue = getDueLabel(check.nextDue) === "Due now" || (check.status || "").toLowerCase().includes("due");
          if (equipmentDueFilter === "due" && !isDue) return false;
          if (equipmentDueFilter === "ok" && isDue) return false;
        }
        return true;
      }).
      map((check, index) => {
        const dueLabel = getDueLabel(check.nextDue);
        const isDue = dueLabel === "Due now";
        const statusLabel = (check.status || "").toLowerCase();
        const badgeColor = statusLabel.includes("due") || isDue ? "var(--danger)" : "var(--success-dark)";
        const durationLabel = getDurationDisplay(check);
        return (
          <DevLayoutSection
            key={check.id}
            sectionKey={`tracking-equipment-card-${index + 1}`}
            parentKey="tracking-equipment-grid"
            sectionType="content-card"
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
              padding: "20px 24px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
              background: "var(--theme)",
              boxShadow: "none",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              height: "220px",
              overflow: "hidden"
            }}>
            
              <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "10px",
                minHeight: "28px",
                minWidth: 0
              }}>
              
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong
                  style={{
                    display: "block",
                    fontSize: "clamp(0.85rem, 1.3vw, var(--text-h3))",
                    fontWeight: 700,
                    color: "var(--text-1)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                  
                    {check.name}
                  </strong>
                </div>
                <span style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: badgeColor, flexShrink: 0 }}>
                  {check.status || dueLabel}
                </span>
              </div>
              <div style={{ display: "grid", gap: "6px", flex: 1 }}>
                <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--info-dark)"
                }}>
                
                  <span>Last checked</span>
                  <strong>{formatDateOnlyLabel(check.lastChecked)}</strong>
                </div>
                <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--info-dark)"
                }}>
                
                  <span>Next due</span>
                  <strong>{formatDateOnlyLabel(check.nextDue)}</strong>
                </div>
                <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--info-dark)"
                }}>
                
                  <span>Check interval</span>
                  <strong>{durationLabel}</strong>
                </div>
              </div>
              <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                handleEquipmentCheck(check.id);
              }}
              style={{ marginTop: "auto", width: "100%" }}>
              
                Log check
              </Button>
            </DevLayoutSection>);

      })}
      </DevLayoutSection>
    </>;


  const renderOilContent = () =>
  <>
      <DevLayoutSection
      sectionKey="tracking-oil-header"
      parentKey="tracking-page-body"
      sectionType="toolbar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "center"
      }}>
      
        <SearchBar
        value={oilSearchTerm}
        onChange={(event) => setOilSearchTerm(event.target.value)}
        onClear={() => setOilSearchTerm("")}
        placeholder="Search oil / stock"
        ariaLabel="Search oil / stock"
        style={{
          flex: "1 1 320px",
          minWidth: "240px"
        }} />
      
        <DropdownField
        options={[
        { key: TRACKING_FILTER_ALL, value: TRACKING_FILTER_ALL, label: "All items" },
        { key: "due", value: "due", label: "Due now" },
        { key: "ok", value: "ok", label: "Not due" }]
        }
        value={oilDueFilter}
        onValueChange={(value) => setOilDueFilter(value || TRACKING_FILTER_ALL)}
        size="md"
        style={{
          flex: "0 1 220px",
          minWidth: "180px"
        }} />
      
      </DevLayoutSection>
      <DevLayoutSection
      sectionKey="tracking-oil-grid"
      parentKey="tracking-page-body"
      sectionType="grid"
      style={{
        display: "grid",
        gridTemplateColumns: isMobileView ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "16px",
        minWidth: 0
      }}>
      
        {oilChecks.length === 0 &&
      <DevLayoutSection
        sectionKey="tracking-oil-empty-state"
        parentKey="tracking-oil-grid"
        sectionType="empty-state"
        style={{
          gridColumn: "1 / -1",
          padding: "12px",
          borderRadius: "var(--radius-sm)",
          border: "1px dashed rgba(var(--grey-accent-rgb), 0.6)",
          textAlign: "center",
          color: "var(--info-dark)"
        }}>
        
            Oil stock checklist is empty.
          </DevLayoutSection>
      }
        {oilChecks.
      filter((item) => {
        const term = oilSearchTerm.trim().toLowerCase();
        if (term && ![item.title, item.stock].filter(Boolean).some((value) => String(value).toLowerCase().includes(term))) {
          return false;
        }
        if (oilDueFilter !== TRACKING_FILTER_ALL) {
          const isDue = getDueLabel(item.nextCheck) === "Due now";
          if (oilDueFilter === "due" && !isDue) return false;
          if (oilDueFilter === "ok" && isDue) return false;
        }
        return true;
      }).
      map((item, index) => {
        const dueLabel = getDueLabel(item.nextCheck);
        const isDue = dueLabel === "Due now";
        const durationLabel = getDurationDisplay(item);
        const isTopUpActive = activeTopUpId === item.id;
        const badgeColor = isDue ? "var(--danger)" : "var(--success-dark)";
        return (
          <DevLayoutSection
            key={item.id}
            sectionKey={`tracking-oil-card-${index + 1}`}
            parentKey="tracking-oil-grid"
            sectionType="content-card"
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
              padding: "20px 24px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(var(--accent-base-rgb), 0.18)",
              background: "var(--theme)",
              boxShadow: "none",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              cursor: isTopUpActive ? "default" : "pointer",
              transition: "all 0.2s ease",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              height: isTopUpActive ? "auto" : "260px",
              overflow: "hidden"
            }}>
            
              <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "10px",
                minHeight: "28px",
                minWidth: 0
              }}>
              
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong
                  style={{
                    display: "block",
                    fontSize: "clamp(0.85rem, 1.3vw, var(--text-h3))",
                    fontWeight: 700,
                    color: "var(--text-1)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                  
                    {item.title}
                  </strong>
                </div>
                <span style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: badgeColor, flexShrink: 0 }}>
                  {dueLabel}
                </span>
              </div>
              <div style={{ display: "grid", gap: "6px", flex: 1 }}>
                <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--info-dark)"
                }}>
                
                  <span>Stock amount</span>
                  <strong>{item.stock || "—"}</strong>
                </div>
                <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--info-dark)"
                }}>
                
                  <span>Last check</span>
                  <strong>{formatDateOnlyLabel(item.lastCheck)}</strong>
                </div>
                <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--info-dark)"
                }}>
                
                  <span>Next check</span>
                  <strong>{formatDateOnlyLabel(item.nextCheck)}</strong>
                </div>
                <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--info-dark)"
                }}>
                
                  <span>Check interval</span>
                  <strong>{durationLabel}</strong>
                </div>
              </div>
              {isTopUpActive &&
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                  <InputField
                label="Top up stock amount"
                type="text"
                value={topUpValue}
                onChange={(e) => setTopUpValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="e.g., 18 × 5L cans" />
              
                  <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  handleOilCheck(item.id, topUpValue);
                }}
                style={{ width: "100%" }}>
                
                    Save
                  </Button>
                </div>
            }
              {!isTopUpActive &&
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setActiveTopUpId(item.id);
                setTopUpValue(item.stock || "");
              }}
              style={{ marginTop: "auto", width: "100%" }}>
              
                  Mark checked
                </Button>
            }
            </DevLayoutSection>);

      })}
      </DevLayoutSection>
    </>;


  const renderActiveTabContent = () => {
    if (activeTab === "equipment") {
      return renderEquipmentContent();
    }
    if (activeTab === "oil-stock") {
      return renderOilContent();
    }
    return renderTrackerContent();
  };

  return <TrackingDashboardUi view="section1" activeTab={activeTab} Button={Button} CAR_LOCATIONS={CAR_LOCATIONS} closeEntryModal={closeEntryModal} closeSearchModal={closeSearchModal} DevLayoutSection={DevLayoutSection} entries={entries} entryModal={entryModal} equipmentLoading={equipmentLoading} equipmentModal={equipmentModal} EquipmentToolsModal={EquipmentToolsModal} error={error} handleDeleteEquipment={handleDeleteEquipment} handleDeleteOilStock={handleDeleteOilStock} handleLocationSelect={handleLocationSelect} handleSave={handleSave} handleSaveEquipment={handleSaveEquipment} handleSaveOilStock={handleSaveOilStock} InlineLoading={InlineLoading} isMobileView={isMobileView} KEY_LOCATIONS={KEY_LOCATIONS} loadEntries={loadEntries} loading={loading} LocationEntryModal={LocationEntryModal} LocationSearchModal={LocationSearchModal} oilLoading={oilLoading} oilStockModal={oilStockModal} OilStockModal={OilStockModal} openEntryModal={openEntryModal} renderActiveTabContent={renderActiveTabContent} searchModal={searchModal} setActiveTab={setActiveTab} setEquipmentModal={setEquipmentModal} setOilStockModal={setOilStockModal} setSimplifiedModal={setSimplifiedModal} simplifiedModal={simplifiedModal} SimplifiedTrackingModal={SimplifiedTrackingModal} StatusMessage={StatusMessage} TabGroup={TabGroup} tabs={tabs} />;















































































































































































}

TrackingDashboard.getLayout = (page) => <Layout disableContentCardHover>{page}</Layout>;
