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
import { MonthPickerField } from "@/components/ui/monthPickerAPI";
import { TrackingRouteSkeleton } from "@/components/ui/RouteSkeletons";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { Button, InputField, StatusMessage } from "@/components/ui";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import { addMonths } from "date-fns";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import LayerSurface from "@/components/ui/LayerSurface"; // canonical --surface inner-section primitive
import LayerTheme from "@/components/ui/LayerTheme"; // canonical --theme summary-tile primitive
import TrackingDashboardUi from "@/components/page-ui/tracking/tracking-ui"; // Extracted presentation layer.
import LoanCarSchedulePanel from "@/components/LoanCars/LoanCarSchedulePanel";
import TrackingMapModal from "@/features/tracking/map/TrackingMapModal"; // CSS-only dealership site map overlay
import { WORKSHOP_CONTROLLER_ROLES, hasAnyRole } from "@/lib/auth/roles";

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

const EQUIPMENT_DUE_SOON_DAYS = 14;

const EQUIPMENT_TYPE_FILTERS = [
{ key: "all", value: "all", label: "All equipment" },
{ key: "lifts", value: "lifts", label: "Lifts" },
{ key: "mot", value: "mot", label: "MOT" },
{ key: "diagnostic", value: "diagnostic", label: "Diagnostic" },
{ key: "air-con", value: "air-con", label: "Air Con" },
{ key: "workshop-tools", value: "workshop-tools", label: "Workshop Tools" }];


const OIL_STOCK_CATEGORY_FILTERS = [
{ key: "all", value: "all", label: "All categories" },
{ key: "engine-oil", value: "engine-oil", label: "Engine Oil" },
{ key: "hybrid-oil", value: "hybrid-oil", label: "Hybrid Oil" },
{ key: "adblue", value: "adblue", label: "AdBlue" },
{ key: "screenwash", value: "screenwash", label: "Screenwash" },
{ key: "brake-cleaner", value: "brake-cleaner", label: "Brake Cleaner" },
{ key: "consumables", value: "consumables", label: "Consumables" },
{ key: "fluids", value: "fluids", label: "Fluids" },
{ key: "workshop-supplies", value: "workshop-supplies", label: "Workshop Supplies" }];


const EQUIPMENT_API_ENDPOINT = "/api/tracking/equipment";
const OIL_STOCK_API_ENDPOINT = "/api/tracking/oil-stock";

const renderTrackingSummaryItem = (item) => (
  <LayerTheme
    key={item.label}
    className="app-summary-item"
    radius="var(--radius-sm)"
    padding="8px 10px"
    gap="2px var(--space-sm)"
    style={{
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: "44px",
      minWidth: 0
    }}>
    <span className="app-summary-label">{item.label}</span>
    <strong className="app-summary-value">{item.value}</strong>
  </LayerTheme>
);

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

const isSameDate = (left, right) => {
  if (!left || !right) return false;
  const leftDate = left instanceof Date ? left : new Date(left);
  const rightDate = right instanceof Date ? right : new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return false;
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const getEquipmentDueState = (item = {}) => {
  if (!item.nextDue) {
    return {
      id: "due-soon",
      groupId: "due-soon",
      groupLabel: "Due Soon",
      label: "Schedule pending",
      color: "var(--warning)",
      sortTime: 0
    };
  }

  const parsed = new Date(item.nextDue);
  if (Number.isNaN(parsed.getTime())) {
    return {
      id: "due-soon",
      groupId: "due-soon",
      groupLabel: "Due Soon",
      label: "Schedule pending",
      color: "var(--warning)",
      sortTime: 0
    };
  }

  const diff = parsed.getTime() - Date.now();
  if (diff <= 0) {
    return {
      id: "overdue",
      groupId: "overdue",
      groupLabel: "Overdue",
      label: "Overdue",
      color: "var(--danger)",
      sortTime: parsed.getTime()
    };
  }

  const days = Math.ceil(diff / MS_PER_DAY);
  if (days <= EQUIPMENT_DUE_SOON_DAYS) {
    return {
      id: "due-soon",
      groupId: "due-soon",
      groupLabel: "Due Soon",
      label: `Due in ${days} day${days === 1 ? "" : "s"}`,
      color: "var(--warning)",
      sortTime: parsed.getTime()
    };
  }

  return {
    id: "up-to-date",
    groupId: "up-to-date",
    groupLabel: "Up To Date",
    label: "Up to date",
    color: "var(--success-dark)",
    sortTime: parsed.getTime()
  };
};

const getEquipmentType = (item = {}) => {
  const name = String(item.name || "").toLowerCase();
  if (/\blift|ramp|hoist/.test(name)) return "lifts";
  if (/\bmot\b|brake tester|emissions|roller/.test(name)) return "mot";
  if (/diagnostic|diag|scanner|scan tool|odis|vcds/.test(name)) return "diagnostic";
  if (/air\s*con|aircon|a\/c|refrigerant/.test(name)) return "air-con";
  return "workshop-tools";
};

const getEquipmentAuditName = (item = {}) => {
  return item.lastCheckedByName || item.checkedByName || item.createdByName || (item.createdBy ? `User #${item.createdBy}` : "Not recorded");
};

const getOilStockCategory = (item = {}) => {
  const text = `${item.title || ""} ${item.stock || ""}`.toLowerCase();
  if (/hybrid|0w-20|0w20|phev|ev oil/.test(text)) return "hybrid-oil";
  if (/engine oil|\boil\b|5w|0w|10w|15w/.test(text)) return "engine-oil";
  if (/adblue|ad blue|urea/.test(text)) return "adblue";
  if (/screen\s*wash|screenwash|washer fluid/.test(text)) return "screenwash";
  if (/brake cleaner|brake clean/.test(text)) return "brake-cleaner";
  if (/coolant|antifreeze|fluid|atf|gearbox|brake fluid|power steering/.test(text)) return "fluids";
  if (/glove|wipe|rag|paper|mask|consumable/.test(text)) return "consumables";
  return "workshop-supplies";
};

const getOilStockStatus = (item = {}) => {
  const stockText = String(item.stock || "").trim().toLowerCase();
  const titleText = String(item.title || "").trim().toLowerCase();
  const combined = `${titleText} ${stockText}`;
  const nextCheck = item.nextCheck ? new Date(item.nextCheck) : null;
  const nextCheckTime = nextCheck && !Number.isNaN(nextCheck.getTime()) ? nextCheck.getTime() : Number.MAX_SAFE_INTEGER;
  const dueNow = nextCheckTime <= Date.now();
  const ordered = /ordered|on order|awaiting|delivery|due in|eta|back\s*order/.test(combined);
  const numericStockMatch = stockText.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|x|l|litre|ltr|bottle|can|unit|$)/);
  const numericStock = numericStockMatch ? Number(numericStockMatch[1]) : null;
  const lowStock =
  /low|empty|none|out of stock|no stock|reorder|order stock|refill|required|urgent/.test(combined) ||
  (Number.isFinite(numericStock) && numericStock <= 1);

  if (lowStock) {
    return {
      id: "low-stock",
      groupId: "low-stock",
      groupLabel: "Low Stock",
      label: "Low Stock",
      color: "var(--danger)",
      recommendedAction: ordered ? "Awaiting Delivery" : "Order Stock",
      primaryAction: "Mark Received",
      sortPriority: 0,
      sortTime: nextCheckTime
    };
  }

  if (dueNow) {
    return {
      id: "due-now",
      groupId: "low-stock",
      groupLabel: "Low Stock",
      label: "Due Now",
      color: "var(--warning)",
      recommendedAction: "Check Level",
      primaryAction: "Mark Checked",
      sortPriority: 1,
      sortTime: nextCheckTime
    };
  }

  if (ordered) {
    return {
      id: "ordered",
      groupId: "ordered",
      groupLabel: "Ordered",
      label: "Ordered",
      color: "var(--warning)",
      recommendedAction: "Awaiting Delivery",
      primaryAction: "Mark Received",
      sortPriority: 2,
      sortTime: nextCheckTime
    };
  }

  return {
    id: "up-to-date",
    groupId: "up-to-date",
    groupLabel: "Up To Date",
    label: "Up to date",
    color: "var(--success-dark)",
    recommendedAction: "",
    primaryAction: "Mark Checked",
    sortPriority: 3,
    sortTime: nextCheckTime
  };
};

const nextDueFrom = (reference, intervalDays = 7) => {
  const baseTime =
  reference instanceof Date ? reference.getTime() : Number(reference || Date.now());
  const days = Number.isFinite(Number(intervalDays)) ? Number(intervalDays) : 7;
  return new Date(baseTime + days * MS_PER_DAY).toISOString();
};

const cloneList = (list) => list.map((entry) => ({ ...entry }));

const emptyForm = {
  id: null,
  jobNumber: "",
  reg: "",
  customer: "",
  serviceType: "",
  makeModel: "",
  colour: "",
  vehicleDisplay: "",
  updatedAt: null,
  vehicleLocation: "N/A",
  keyLocation: "N/A",
  keyTip: "",
  status: "Waiting For Collection",
  notes: ""
};

const getVehicleSummaryLabel = (entry = {}) => {
  if (entry.vehicleDisplay) return entry.vehicleDisplay;
  return [entry.makeModel, entry.colour].filter(Boolean).join(" • ");
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

const TRACKER_OVERDUE_HOURS = 4;

const TRACKER_QUICK_FILTERS = [
{ id: "all", label: "All" },
{ id: "overdue", label: "Overdue" },
{ id: "unknown", label: "Unknown Location" },
{ id: "workshop", label: "Workshop" },
{ id: "collection", label: "Collection" },
{ id: "customer-waiting", label: "Customer Waiting" }];


const TRACKER_LOCATION_FILTERS = [
{ key: "all", value: "all", label: "All locations" },
{ key: "service-desk", value: "service-desk", label: "Service Desk" },
{ key: "workshop-board", value: "workshop-board", label: "Workshop Board" },
{ key: "collection", value: "collection", label: "Collection" },
{ key: "workshop-bays", value: "workshop-bays", label: "Workshop Bays" },
{ key: "other", value: "other", label: "Other locations" },
{ key: "unknown", value: "unknown", label: "Unknown location" }];


const normalizeTrackerText = (value = "") => String(value || "").trim().toLowerCase();

const getMovementAgeHours = (entry) => {
  const updated = new Date(entry?.updatedAt || 0).getTime();
  if (!updated) return 0;
  return Math.max(0, (Date.now() - updated) / (1000 * 60 * 60));
};

const getTrackerLocationFlags = (entry = {}) => {
  const keyLocation = normalizeTrackerText(normalizeKeyLocationLabel(entry.keyLocation));
  const vehicleLocation = normalizeTrackerText(entry.vehicleLocation);
  const status = normalizeTrackerText(entry.status || entry.jobStatus || entry.serviceType);
  const combined = [keyLocation, vehicleLocation, status].filter(Boolean).join(" ");
  const missingKey = !keyLocation || keyLocation === "n/a" || keyLocation === "na" || keyLocation === "pending";
  const missingVehicle = !vehicleLocation || vehicleLocation === "n/a" || vehicleLocation === "na" || vehicleLocation === "unallocated";
  const isUnknown = missingKey || missingVehicle || combined.includes("unknown");
  const isWorkshop =
  combined.includes("workshop") ||
  combined.includes("red board") ||
  combined.includes("valet") ||
  combined.includes("paint") ||
  combined.includes("prep");
  const isCollection =
  combined.includes("collection") ||
  combined.includes("complete") ||
  combined.includes("ready for release") ||
  combined.includes("ready for collection");
  const isCustomerWaiting =
  combined.includes("waiting") ||
  combined.includes("customer waiting") ||
  combined.includes("waiter");
  const keysMoved =
  Boolean(keyLocation) &&
  keyLocation !== "n/a" &&
  keyLocation !== "na" &&
  !keyLocation.includes("service showroom") &&
  !keyLocation.includes("sales show room");
  const isOverdue = getMovementAgeHours(entry) >= TRACKER_OVERDUE_HOURS;

  return {
    isUnknown,
    isWorkshop,
    isCollection,
    isCustomerWaiting,
    keysMoved,
    isOverdue,
    missingKey,
    missingVehicle
  };
};

const getTrackerGroup = (entry = {}) => {
  const flags = getTrackerLocationFlags(entry);
  const keyLocation = normalizeTrackerText(normalizeKeyLocationLabel(entry.keyLocation));
  const vehicleLocation = normalizeTrackerText(entry.vehicleLocation);
  const combined = [keyLocation, vehicleLocation].filter(Boolean).join(" ");

  if (flags.isUnknown) return { id: "unknown", label: "Unknown Location" };
  if (flags.isCollection) return { id: "collection", label: "Collection" };
  if (combined.includes("red board") || combined.includes("cupboard") || keyLocation.includes("workshop")) {
    return { id: "workshop-board", label: "Workshop Board" };
  }
  if (flags.isWorkshop) return { id: "workshop-bays", label: "Workshop Bays" };
  if (combined.includes("service")) return { id: "service-desk", label: "Service Desk" };
  return { id: "other", label: "Other Locations" };
};

const getTrackerRiskScore = (entry = {}) => {
  const flags = getTrackerLocationFlags(entry);
  const ageHours = getMovementAgeHours(entry);
  return (
    (flags.isUnknown ? 100000 : 0) +
    (flags.keysMoved ? 50000 : 0) +
    (flags.isOverdue ? 20000 : 0) +
    Math.min(19999, Math.round(ageHours * 100))
  );
};

const CombinedTrackerCard = ({ entry, isHighlighted, onClick, isMobileView = false }) => {
  const vehicleMeta = getVehicleSummaryLabel(entry);
  void isMobileView;

  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px 18px",
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
        minHeight: "214px",
        height: "100%"
      }}>

      <LayerSurface
        radius="var(--radius-sm)"
        padding="10px 12px"
        gap="4px"
        style={{ minWidth: 0 }}>

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

          Job {entry.jobNumber || "Unknown job"}
        </strong>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: isMobileView ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gap: "4px 12px",
            margin: "4px 0 0",
            minWidth: 0,
            fontSize: "var(--text-caption)",
            color: "var(--text-1)"
          }}>

          {[
          ["Registration", entry.reg || "Unknown reg"],
          ["Customer", entry.customer || "Customer pending"],
          ["Vehicle", vehicleMeta || "Make/Model/Colour pending"],
          ["Last moved", formatRelativeTime(entry.updatedAt)]].map(([label, value]) =>
          <div key={label} style={{ minWidth: 0 }}>
              <dt style={{ fontWeight: 700, textTransform: "uppercase", opacity: 0.72 }}>{label}</dt>
              <dd
              style={{
                margin: "2px 0 0",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>

                {value}
              </dd>
            </div>
          )}
        </dl>
      </LayerSurface>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobileView ? "1fr" : "1fr 1fr",
          gap: "8px",
          minWidth: 0
        }}>

        <LayerSurface
          radius="var(--radius-sm)"
          padding="10px 12px"
          gap="2px"
          style={{ minWidth: 0 }}>

          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--text-1)" }}>Key location</p>
          <strong
            style={{
              fontSize: "clamp(0.72rem, 1.1vw, var(--text-body))",
              color: "var(--text-accent)",
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>

            {normalizeKeyLocationLabel(entry.keyLocation) || "Pending"}
          </strong>
        </LayerSurface>
        <LayerSurface
          radius="var(--radius-sm)"
          padding="10px 12px"
          gap="2px"
          style={{ minWidth: 0 }}>

          <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--text-1)" }}>Car location</p>
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
        </LayerSurface>
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
        zIndex: "var(--z-modal)"
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

const EquipmentHistoryModal = ({ item, onClose }) => {
  useBodyModalLock(Boolean(item));

  if (!item) return null;

  const rows = [
  ["Status", getEquipmentDueState(item).label],
  ["Last checked", formatDateOnlyLabel(item.lastChecked)],
  ["Next due", formatDateOnlyLabel(item.nextDue)],
  ["Check interval", getDurationDisplay(item)],
  ["Last Checked By", getEquipmentAuditName(item)],
  ["Last updated", formatDateOnlyLabel(item.updatedAt)]];

  return (
    <div className="popup-backdrop" role="dialog" aria-modal="true" style={{ ...popupOverlayStyles, zIndex: 220 }}>
      <div
        style={{
          ...popupCardStyles,
          width: "min(520px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px"
        }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-sm)" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--info)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Equipment history
            </p>
            <h2 style={{ margin: "4px 0 0", color: "var(--accentText)" }}>{item.name}</h2>
          </div>
          <Button variant="ghost" size="sm" pill onClick={onClose} aria-label="Close">
            ×
          </Button>
        </div>

        <LayerSurface radius="var(--radius-sm)" padding="12px" gap="8px">
          {rows.map(([label, value]) =>
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "var(--space-sm)",
              color: "var(--text-1)",
              fontSize: "var(--text-body-sm)"
            }}>

              <span>{label}</span>
              <strong style={{ textAlign: "right" }}>{value}</strong>
            </div>
          )}
        </LayerSurface>
      </div>
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

const OilStockHistoryModal = ({ item, onClose }) => {
  useBodyModalLock(Boolean(item));

  if (!item) return null;

  const status = getOilStockStatus(item);
  const rows = [
  ["Status", status.label],
  ["Stock amount", item.stock || "—"],
  ["Last check", formatDateOnlyLabel(item.lastCheck)],
  ["Next check", formatDateOnlyLabel(item.nextCheck)],
  ["Last topped up", formatDateOnlyLabel(item.lastToppedUp)],
  ["Check interval", getDurationDisplay(item)],
  ...(status.recommendedAction ? [["Recommended Action", status.recommendedAction]] : []),
  ["Last updated", formatDateOnlyLabel(item.updatedAt)]];

  return (
    <div className="popup-backdrop" role="dialog" aria-modal="true" style={{ ...popupOverlayStyles, zIndex: 220 }}>
      <div
        style={{
          ...popupCardStyles,
          width: "min(520px, 100%)",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px"
        }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-sm)" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--info)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Oil / stock history
            </p>
            <h2 style={{ margin: "4px 0 0", color: "var(--accentText)" }}>{item.title}</h2>
          </div>
          <Button variant="ghost" size="sm" pill onClick={onClose} aria-label="Close">
            ×
          </Button>
        </div>

        <LayerSurface radius="var(--radius-sm)" padding="12px" gap="8px">
          {rows.map(([label, value]) =>
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "var(--space-sm)",
              color: "var(--text-1)",
              fontSize: "var(--text-body-sm)"
            }}>

              <span>{label}</span>
              <strong style={{ textAlign: "right" }}>{value}</strong>
            </div>
          )}
        </LayerSurface>
      </div>
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
            borderRadius: "var(--radius-sm)"
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
    vehicleDisplay: entry?.vehicleDisplay || getVehicleSummaryLabel(entry || {}),
    vehicleLocation: entry?.vehicleLocation || CAR_LOCATIONS[0].label,
    keyLocation: normalizeKeyLocationLabel(entry?.keyLocation) || KEY_LOCATIONS[0].label,
    status: entry?.status || "Waiting For Collection"
  }));
  const [matchedExisting, setMatchedExisting] = useState(Boolean(entry)); // tracks whether form auto-filled from existing entry
  const vehicleDisplay = form.vehicleDisplay || getVehicleSummaryLabel(form) || "";
  const lastMovedLabel = form.updatedAt ? formatRelativeTime(form.updatedAt) : "Pending";
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
          makeModel: match.makeModel || prev.makeModel,
          vehicleDisplay: getVehicleSummaryLabel(match) || prev.vehicleDisplay,
          updatedAt: match.updatedAt || prev.updatedAt,
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

        <LayerTheme
          radius="var(--radius-sm)"
          padding="12px"
          gap="10px"
          style={{ minWidth: 0 }}>
          <strong style={{ color: "var(--text-1)", fontSize: "var(--text-h4)", lineHeight: 1.2 }}>
            Job {form.jobNumber || "Unknown job"}
          </strong>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "8px 12px",
              margin: 0,
              minWidth: 0
            }}>
            {[
              ["Registration", form.reg || "Unknown reg"],
              ["Customer", form.customer || "Customer pending"],
              ["Vehicle", vehicleDisplay || "Make/Model/Colour pending"],
              ["Last moved", lastMovedLabel]
            ].map(([label, value]) =>
            <div key={label} style={{ minWidth: 0 }}>
              <dt style={{ color: "var(--text-1)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {label}
              </dt>
              <dd
                style={{
                  margin: "2px 0 0",
                  color: "var(--text-1)",
                  fontSize: "var(--text-caption)",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}>
                {value}
              </dd>
            </div>
            )}
          </dl>
        </LayerTheme>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "10px"
          }}>

          {[
          { label: "Job Number", field: "jobNumber", placeholder: "00040" },
          { label: "Registration", field: "reg", placeholder: "GY21 HNP" },
          { label: "Customer", field: "customer", placeholder: "Customer name" },
          { label: "Vehicle", field: "vehicleDisplay", placeholder: "MERCEDES-BENZ • BLACK" }].
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
            label="Car location"
            options={vehicleLocationOptions}
            value={form.vehicleLocation}
            onValueChange={(value) => handleChange("vehicleLocation", value)}
            placeholder="Select location"
            size="md" />

          <DropdownField
            label="Key location"
            required
            options={keyLocationOptions}
            value={form.keyLocation}
            onValueChange={(value) => handleChange("keyLocation", value)}
            placeholder="Select key location"
            size="md" />

          <LayerSurface
            radius="var(--radius-sm)"
            padding="10px 12px"
            gap="2px"
            style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--text-1)" }}>Last moved</p>
            <strong style={{ color: "var(--text-1)", fontSize: "var(--text-body)", lineHeight: 1.2 }}>
              {lastMovedLabel}
            </strong>
          </LayerSurface>

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchModal, setSearchModal] = useState({ open: false, type: null });
  const [entryModal, setEntryModal] = useState({ open: false, type: null, entry: null });
  const [simplifiedModal, setSimplifiedModal] = useState({ open: false, initialData: null });
  const [highlightedJobNumber, setHighlightedJobNumber] = useState(null);
  const [equipmentModal, setEquipmentModal] = useState({ open: false, item: null });
  const [equipmentHistoryModal, setEquipmentHistoryModal] = useState({ open: false, item: null });
  const [oilStockModal, setOilStockModal] = useState({ open: false, item: null });
  const [oilStockHistoryModal, setOilStockHistoryModal] = useState({ open: false, item: null });
  const [trackingMapOpen, setTrackingMapOpen] = useState(false); // Key/Parking site-map overlay
  const { dbUserId, user } = useUser();
  const userRoles = useMemo(() => user?.roles || [], [user]);
  const isWorkshopManager = hasAnyRole(userRoles, WORKSHOP_CONTROLLER_ROLES);
  const tabs = useMemo(() => {
    const base = [{ id: "tracker", label: "Key/Parking" }];
    if (isWorkshopManager) {
      base.push(
        { id: "loan-cars", label: "Loan Cars" },
        { id: "equipment", label: "Equipment/Tools" },
        { id: "oil-stock", label: "Oil/Stock" }
      );
    }
    return base;
  }, [isWorkshopManager]);
  const [activeTab, setActiveTab] = useState("tracker");
  const [equipmentChecks, setEquipmentChecks] = useState(() => cloneList(DEFAULT_EQUIPMENT_CHECKS));
  const [oilChecks, setOilChecks] = useState(() => cloneList(DEFAULT_OIL_CHECKS));
  const [activeTopUpId, setActiveTopUpId] = useState(null);
  const [topUpValue, setTopUpValue] = useState("");
  const [isMobileView, setIsMobileView] = useState(false); // portrait phone layout toggle
  const [isWideTrackerView, setIsWideTrackerView] = useState(false);
  const [trackerSearchTerm, setTrackerSearchTerm] = useState("");
  const [loanCarSearchTerm, setLoanCarSearchTerm] = useState("");
  const [loanCarMonth, setLoanCarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loanCarFleetManagerOpen, setLoanCarFleetManagerOpen] = useState(false);
  const loanCarRefreshKey = 0;
  const [equipmentSearchTerm, setEquipmentSearchTerm] = useState("");
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState("all");
  const [oilSearchTerm, setOilSearchTerm] = useState("");
  const [oilCategoryFilter, setOilCategoryFilter] = useState("all");
  const [trackerQuickFilter, setTrackerQuickFilter] = useState("all");
  const [trackerLocationFilter, setTrackerLocationFilter] = useState("all");

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
    }
  }, [isWorkshopManager]);

  const loadOilChecks = useCallback(async () => {
    if (!isWorkshopManager) return;
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
    }
  }, [isWorkshopManager]);

  useEffect(() => {
    if (!isWorkshopManager) return;
    loadEquipmentChecks();
    loadOilChecks();
  }, [isWorkshopManager, loadEquipmentChecks, loadOilChecks]);

  const sharedSearchValue = useMemo(() => {
    if (activeTab === "equipment") return equipmentSearchTerm;
    if (activeTab === "oil-stock") return oilSearchTerm;
    if (activeTab === "loan-cars") return loanCarSearchTerm;
    return trackerSearchTerm;
  }, [activeTab, equipmentSearchTerm, loanCarSearchTerm, oilSearchTerm, trackerSearchTerm]);

  const setSharedSearchValue = useCallback(
    (value) => {
      if (activeTab === "equipment") {
        setEquipmentSearchTerm(value);
        return;
      }
      if (activeTab === "oil-stock") {
        setOilSearchTerm(value);
        return;
      }
      if (activeTab === "loan-cars") {
        setLoanCarSearchTerm(value);
        return;
      }
      setTrackerSearchTerm(value);
    },
    [activeTab]
  );

  const sharedSearchPlaceholder = useMemo(() => {
    if (activeTab === "equipment") return "Search equipment";
    if (activeTab === "oil-stock") return "Search oil / stock";
    if (activeTab === "loan-cars") return "Search loan cars";
    return "Search active jobs";
  }, [activeTab]);

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

  // Priority audit: this page previously sorted assigned-to-me jobs first, then
  // newest movement. Keep that useful personal tie-breaker, but put location
  // risk ahead of it so unknown/stale/key-moved records cannot be buried.
  const activeEntries = useMemo(() => {
    const isMine = (entry) => {
      if (!dbUserId) return false;
      const assigned = Number(entry?.assignedTo);
      return Number.isInteger(assigned) && assigned === Number(dbUserId);
    };
    return entries.
    filter((entry) => entry.jobId).
    sort((a, b) => {
      const riskDiff = getTrackerRiskScore(b) - getTrackerRiskScore(a);
      if (riskDiff !== 0) return riskDiff;
      const mineA = isMine(a) ? 1 : 0;
      const mineB = isMine(b) ? 1 : 0;
      if (mineA !== mineB) return mineB - mineA; // user's own jobs first
      return (
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    });
  }, [entries, dbUserId]);

  const filteredActiveEntries = useMemo(() => {
    const query = trackerSearchTerm.trim().toLowerCase();

    return activeEntries.filter((entry) => {
      const flags = getTrackerLocationFlags(entry);
      const group = getTrackerGroup(entry);
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

      if (trackerLocationFilter !== "all" && group.id !== trackerLocationFilter) {
        return false;
      }

      if (trackerQuickFilter === "overdue") return flags.isOverdue;
      if (trackerQuickFilter === "unknown") return flags.isUnknown;
      if (trackerQuickFilter === "workshop") return flags.isWorkshop;
      if (trackerQuickFilter === "collection") return flags.isCollection;
      if (trackerQuickFilter === "customer-waiting") return flags.isCustomerWaiting;

      return true;
    });
  }, [activeEntries, trackerLocationFilter, trackerQuickFilter, trackerSearchTerm]);

  const trackerSummaryItems = useMemo(() => {
    const totalActiveJobs = activeEntries.length;
    const keysMissing = activeEntries.filter((entry) => getTrackerLocationFlags(entry).missingKey).length;
    const carsOffSite = activeEntries.filter((entry) => {
      const location = normalizeTrackerText(entry.vehicleLocation);
      return Boolean(location) && !["n/a", "na", "service", "workshop", "in workshop", "ready for release"].includes(location);
    }).length;
    const overdueMovements = activeEntries.filter((entry) => getTrackerLocationFlags(entry).isOverdue).length;
    const unknownLocations = activeEntries.filter((entry) => getTrackerLocationFlags(entry).isUnknown).length;
    const customerWaiting = activeEntries.filter((entry) => getTrackerLocationFlags(entry).isCustomerWaiting).length;

    return [
    { label: "Total Active Jobs", value: totalActiveJobs },
    { label: "Keys Missing", value: keysMissing },
    { label: "Cars Off-site", value: carsOffSite },
    { label: "Overdue Movements", value: overdueMovements },
    { label: "Unknown Location", value: unknownLocations },
    { label: "Customer Waiting", value: customerWaiting }];

  }, [activeEntries]);

  const groupedTrackerEntries = useMemo(() => {
    const groups = new Map();
    filteredActiveEntries.forEach((entry) => {
      const group = getTrackerGroup(entry);
      if (!groups.has(group.id)) {
        groups.set(group.id, { ...group, entries: [] });
      }
      groups.get(group.id).entries.push(entry);
    });
    return Array.from(groups.values());
  }, [filteredActiveEntries]);

  const filteredEquipmentChecks = useMemo(() => {
    const term = equipmentSearchTerm.trim().toLowerCase();
    return equipmentChecks.
    filter((check) => {
      if (equipmentTypeFilter !== "all" && getEquipmentType(check) !== equipmentTypeFilter) {
        return false;
      }
      if (term && ![check.name, check.status, getEquipmentDueState(check).label, getEquipmentAuditName(check)].filter(Boolean).some((value) => String(value).toLowerCase().includes(term))) {
        return false;
      }
      return true;
    }).
    sort((a, b) => {
      const stateOrder = { overdue: 0, "due-soon": 1, "up-to-date": 2 };
      const stateA = getEquipmentDueState(a);
      const stateB = getEquipmentDueState(b);
      if (stateOrder[stateA.groupId] !== stateOrder[stateB.groupId]) {
        return stateOrder[stateA.groupId] - stateOrder[stateB.groupId];
      }
      if (stateA.sortTime !== stateB.sortTime) {
        return stateA.sortTime - stateB.sortTime;
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [equipmentChecks, equipmentSearchTerm, equipmentTypeFilter]);

  const equipmentSummaryItems = useMemo(() => {
    const dueStates = equipmentChecks.map((check) => getEquipmentDueState(check));
    return [
    { label: "Due Soon", value: dueStates.filter((state) => state.groupId === "due-soon").length },
    { label: "Overdue", value: dueStates.filter((state) => state.groupId === "overdue").length },
    { label: "Checked Today", value: equipmentChecks.filter((check) => isSameDate(check.lastChecked, new Date())).length },
    { label: "Total Equipment/Tools", value: equipmentChecks.length }];

  }, [equipmentChecks]);

  const groupedEquipmentChecks = useMemo(() => {
    const groupOrder = ["overdue", "due-soon", "up-to-date"];
    const groups = new Map(groupOrder.map((id) => {
      const label = id === "overdue" ? "Overdue" : id === "due-soon" ? "Due Soon" : "Up To Date";
      return [id, { id, label, entries: [] }];
    }));

    filteredEquipmentChecks.forEach((check) => {
      const state = getEquipmentDueState(check);
      groups.get(state.groupId)?.entries.push(check);
    });

    return Array.from(groups.values()).filter((group) => group.entries.length > 0);
  }, [filteredEquipmentChecks]);

  const filteredOilChecks = useMemo(() => {
    const term = oilSearchTerm.trim().toLowerCase();
    return oilChecks.
    filter((item) => {
      if (oilCategoryFilter !== "all" && getOilStockCategory(item) !== oilCategoryFilter) {
        return false;
      }
      if (term && ![item.title, item.stock, getOilStockStatus(item).label, getOilStockStatus(item).recommendedAction].filter(Boolean).some((value) => String(value).toLowerCase().includes(term))) {
        return false;
      }
      return true;
    }).
    sort((a, b) => {
      const statusA = getOilStockStatus(a);
      const statusB = getOilStockStatus(b);
      if (statusA.sortPriority !== statusB.sortPriority) {
        return statusA.sortPriority - statusB.sortPriority;
      }
      if (statusA.sortTime !== statusB.sortTime) {
        return statusA.sortTime - statusB.sortTime;
      }
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }, [oilChecks, oilCategoryFilter, oilSearchTerm]);

  const oilSummaryItems = useMemo(() => {
    const statuses = oilChecks.map((item) => getOilStockStatus(item));
    return [
    { label: "Low Stock", value: statuses.filter((status) => status.groupId === "low-stock").length },
    { label: "Ordered", value: statuses.filter((status) => status.groupId === "ordered").length },
    { label: "Checked Today", value: oilChecks.filter((item) => isSameDate(item.lastCheck, new Date())).length },
    { label: "Total Oil/Stock Items", value: oilChecks.length }];

  }, [oilChecks]);

  const groupedOilChecks = useMemo(() => {
    const groupOrder = [
    ["low-stock", "Low Stock"],
    ["ordered", "Ordered"],
    ["up-to-date", "Up To Date"]];
    const groups = new Map(groupOrder.map(([id, label]) => [id, { id, label, entries: [] }]));

    filteredOilChecks.forEach((item) => {
      const status = getOilStockStatus(item);
      groups.get(status.groupId)?.entries.push(item);
    });

    return Array.from(groups.values()).filter((group) => group.entries.length > 0);
  }, [filteredOilChecks]);

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
      sectionKey="tracking-active-jobs-summary"
      parentKey="tracking-page-body"
      sectionType="stat-card"
      className="app-summary-section"
      style={{ width: "100%" }}>

        <div className="app-summary-grid">
          {trackerSummaryItems.map(renderTrackingSummaryItem)}
        </div>
      </DevLayoutSection>

      {entries.length === 0 &&
    <DevLayoutSection
      sectionKey="tracking-active-jobs-empty-state"
      parentKey="tracking-page-body"
      sectionType="empty-state"
      style={{
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        textAlign: "center",
        color: "var(--text-1)"
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
        textAlign: "center",
        color: "var(--text-1)"
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
        textAlign: "center",
        color: "var(--text-1)"
      }}>

          No active jobs match your search or filters.
        </DevLayoutSection>
    }
      {groupedTrackerEntries.map((group) =>
    <DevLayoutSection
      key={group.id}
      sectionKey={`tracking-active-jobs-group-${group.id}`}
      parentKey="tracking-page-body"
      sectionType="section-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0
      }}>

        <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "var(--space-sm)",
          minWidth: 0
        }}>

          <h2 style={{ margin: 0, color: "var(--accentText)", fontSize: "var(--text-h3)", lineHeight: 1.2 }}>
            {group.label}
          </h2>
          <span style={{ color: "var(--text-1)", fontSize: "var(--text-caption)", fontWeight: 700 }}>
            {group.entries.length}
          </span>
        </div>

        <DevLayoutSection
        sectionKey={`tracking-active-jobs-list-${group.id}`}
        parentKey={`tracking-active-jobs-group-${group.id}`}
        sectionType="list"
        style={{
          display: "grid",
          gridTemplateColumns:
          !isMobileView && isWideTrackerView ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
          gap: "20px",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0
        }}>

          {group.entries.map((entry, index) => {
        const isHighlighted = highlightedJobNumber && entry.jobNumber?.toLowerCase() === highlightedJobNumber.toLowerCase();
        return (
          <DevLayoutSection
            key={entry.jobId || entry.id || `${entry.jobNumber}-${entry.updatedAt}`}
            sectionKey={`tracking-active-jobs-card-${group.id}-${index + 1}`}
            parentKey={`tracking-active-jobs-list-${group.id}`}
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
                makeModel: entry.makeModel,
                colour: entry.colour,
                vehicleDisplay: getVehicleSummaryLabel(entry),
                serviceType: entry.serviceType,
                vehicleLocation: entry.vehicleLocation,
                keyLocation: entry.keyLocation,
                status: entry.status,
                keyTip: entry.keyTip,
                notes: entry.notes,
                updatedAt: entry.updatedAt
              })} />

            </DevLayoutSection>);

      })}
        </DevLayoutSection>
      </DevLayoutSection>
    )}
    </>;


  const renderEquipmentContent = () =>
  <>
      <DevLayoutSection
      sectionKey="tracking-equipment-summary"
      parentKey="tracking-page-body"
      sectionType="stat-card"
      className="app-summary-section"
      style={{ width: "100%" }}>

        <div className="app-summary-grid">
          {equipmentSummaryItems.map(renderTrackingSummaryItem)}
        </div>
      </DevLayoutSection>

      {equipmentChecks.length === 0 &&
      <DevLayoutSection
      sectionKey="tracking-equipment-empty-state"
      parentKey="tracking-page-body"
      sectionType="empty-state"
      style={{
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        textAlign: "center",
        color: "var(--text-1)"
      }}>

          Equipment service list is empty.
        </DevLayoutSection>
      }

      {equipmentChecks.length > 0 && filteredEquipmentChecks.length === 0 &&
      <DevLayoutSection
      sectionKey="tracking-equipment-filter-empty-state"
      parentKey="tracking-page-body"
      sectionType="empty-state"
      style={{
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        textAlign: "center",
        color: "var(--text-1)"
      }}>

          No equipment/tools match your search or filters.
        </DevLayoutSection>
      }

      {groupedEquipmentChecks.map((group) =>
    <DevLayoutSection
      key={group.id}
      sectionKey={`tracking-equipment-group-${group.id}`}
      parentKey="tracking-page-body"
      sectionType="section-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0
      }}>

        <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "var(--space-sm)",
          minWidth: 0
        }}>

          <h2 style={{ margin: 0, color: "var(--accentText)", fontSize: "var(--text-h3)", lineHeight: 1.2 }}>
            {group.label}
          </h2>
          <span style={{ color: "var(--text-1)", fontSize: "var(--text-caption)", fontWeight: 700 }}>
            {group.entries.length}
          </span>
        </div>

        <DevLayoutSection
        sectionKey={`tracking-equipment-grid-${group.id}`}
        parentKey={`tracking-equipment-group-${group.id}`}
        sectionType="grid"
        style={{
          display: "grid",
          gridTemplateColumns: isMobileView ? "minmax(0, min(100%, 260px))" : "repeat(auto-fill, 260px)",
          justifyContent: "start",
          alignItems: "stretch",
          gap: "16px",
          minWidth: 0
        }}>

          {group.entries.map((check, index) => {
        const dueState = getEquipmentDueState(check);
        const durationLabel = getDurationDisplay(check);
        return (
          <DevLayoutSection
            key={check.id}
            sectionKey={`tracking-equipment-card-${group.id}-${index + 1}`}
            parentKey={`tracking-equipment-grid-${group.id}`}
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
              border: "none",
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
              minHeight: "250px",
              height: "100%",
              overflow: "hidden"
            }}>

              <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                alignItems: "start",
                gap: "10px",
                minHeight: "42px",
                minWidth: 0
              }}>

                <div style={{ minWidth: 0 }}>
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
                  <span style={{ display: "block", marginTop: "2px", fontSize: "var(--text-caption)", color: "var(--text-1)", fontWeight: 700, textTransform: "uppercase" }}>
                    {EQUIPMENT_TYPE_FILTERS.find((option) => option.value === getEquipmentType(check))?.label || "Workshop Tools"}
                  </span>
                </div>
                <span
                style={{
                  minWidth: "104px",
                  textAlign: "right",
                  fontSize: "var(--text-caption)",
                  fontWeight: 700,
                  color: dueState.color,
                  flexShrink: 0
                }}>

                  {dueState.label}
                </span>
              </div>
              <div style={{ display: "grid", gap: "6px", flex: 1 }}>
                {[
                ["Last checked", formatDateOnlyLabel(check.lastChecked)],
                ["Next due", formatDateOnlyLabel(check.nextDue)],
                ["Check interval", durationLabel],
                ["Last Checked By", getEquipmentAuditName(check)]].map(([label, value]) =>
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--space-sm)",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--text-1)",
                    minWidth: 0
                  }}>

                    <span style={{ flexShrink: 0 }}>{label}</span>
                    <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
                      {value}
                    </strong>
                  </div>
                )}
              </div>
              <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobileView ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "var(--space-sm)",
                marginTop: "auto"
              }}>

                <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setEquipmentHistoryModal({ open: true, item: check });
                }}
                style={{ width: "100%" }}>

                  View History
                </Button>
                <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  handleEquipmentCheck(check.id);
                }}
                style={{ width: "100%" }}>

                  Log check
                </Button>
              </div>
            </DevLayoutSection>);

      })}
        </DevLayoutSection>
      </DevLayoutSection>
    )}
    </>;


  const renderOilContent = () =>
  <>
      <DevLayoutSection
      sectionKey="tracking-oil-summary"
      parentKey="tracking-page-body"
      sectionType="stat-card"
      className="app-summary-section"
      style={{ width: "100%" }}>

        <div className="app-summary-grid">
          {oilSummaryItems.map(renderTrackingSummaryItem)}
        </div>
      </DevLayoutSection>

      {oilChecks.length === 0 &&
      <DevLayoutSection
      sectionKey="tracking-oil-empty-state"
      parentKey="tracking-page-body"
      sectionType="empty-state"
      style={{
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        textAlign: "center",
        color: "var(--text-1)"
      }}>

          Oil stock checklist is empty.
        </DevLayoutSection>
      }

      {oilChecks.length > 0 && filteredOilChecks.length === 0 &&
      <DevLayoutSection
      sectionKey="tracking-oil-filter-empty-state"
      parentKey="tracking-page-body"
      sectionType="empty-state"
      style={{
        padding: "12px",
        borderRadius: "var(--radius-sm)",
        textAlign: "center",
        color: "var(--text-1)"
      }}>

          No oil/stock items match your search or filters.
        </DevLayoutSection>
      }

      {groupedOilChecks.map((group) =>
    <DevLayoutSection
      key={group.id}
      sectionKey={`tracking-oil-group-${group.id}`}
      parentKey="tracking-page-body"
      sectionType="section-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0
      }}>

        <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "var(--space-sm)",
          minWidth: 0
        }}>

          <h2 style={{ margin: 0, color: "var(--accentText)", fontSize: "var(--text-h3)", lineHeight: 1.2 }}>
            {group.label}
          </h2>
          <span style={{ color: "var(--text-1)", fontSize: "var(--text-caption)", fontWeight: 700 }}>
            {group.entries.length}
          </span>
        </div>

        <DevLayoutSection
        sectionKey={`tracking-oil-grid-${group.id}`}
        parentKey={`tracking-oil-group-${group.id}`}
        sectionType="grid"
        style={{
          display: "grid",
          gridTemplateColumns: isMobileView ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
          minWidth: 0
        }}>

          {group.entries.map((item, index) => {
        const stockStatus = getOilStockStatus(item);
        const durationLabel = getDurationDisplay(item);
        const isTopUpActive = activeTopUpId === item.id;
        return (
          <DevLayoutSection
            key={item.id}
            sectionKey={`tracking-oil-card-${group.id}-${index + 1}`}
            parentKey={`tracking-oil-grid-${group.id}`}
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
              border: "none",
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
              minHeight: isTopUpActive ? "320px" : "286px",
              height: "100%",
              overflow: "hidden"
            }}>

              <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                alignItems: "start",
                gap: "10px",
                minHeight: "42px",
                minWidth: 0
              }}>

                <div style={{ minWidth: 0 }}>
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
                  <span style={{ display: "block", marginTop: "2px", fontSize: "var(--text-caption)", color: "var(--text-1)", fontWeight: 700, textTransform: "uppercase" }}>
                    {OIL_STOCK_CATEGORY_FILTERS.find((option) => option.value === getOilStockCategory(item))?.label || "Workshop Supplies"}
                  </span>
                </div>
                <span
                style={{
                  minWidth: "104px",
                  textAlign: "right",
                  fontSize: "var(--text-caption)",
                  fontWeight: 700,
                  color: stockStatus.color,
                  flexShrink: 0
                }}>

                  {stockStatus.label}
                </span>
              </div>
              <div style={{ display: "grid", gap: "6px", flex: 1 }}>
                {[
                ["Stock amount", item.stock || "—"],
                ["Last check", formatDateOnlyLabel(item.lastCheck)],
                ["Next check", formatDateOnlyLabel(item.nextCheck)],
                ["Check interval", durationLabel],
                ...(stockStatus.recommendedAction ? [["Recommended Action", stockStatus.recommendedAction]] : [])].map(([label, value]) =>
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--space-sm)",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--text-1)",
                    minWidth: 0
                  }}>

                    <span style={{ flexShrink: 0 }}>{label}</span>
                    <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
                      {value}
                    </strong>
                  </div>
                )}
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobileView ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "var(--space-sm)",
                marginTop: "auto"
              }}>

                <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setOilStockHistoryModal({ open: true, item });
                }}
                style={{ width: "100%" }}>

                  View History
                </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setActiveTopUpId(item.id);
                setTopUpValue(item.stock || "");
              }}
              style={{ width: "100%" }}>

                  {stockStatus.primaryAction}
                </Button>
              </div>
            }
            </DevLayoutSection>);

      })}
        </DevLayoutSection>
      </DevLayoutSection>
    )}
    </>;


  const renderActiveTabContent = () => {
    if (activeTab === "loan-cars") {
      return (
        <LoanCarSchedulePanel
          mode="tracking"
          month={loanCarMonth}
          searchTerm={loanCarSearchTerm}
          showFleetManager={loanCarFleetManagerOpen}
          refreshKey={loanCarRefreshKey}
        />
      );
    }
    if (activeTab === "equipment") {
      return renderEquipmentContent();
    }
    if (activeTab === "oil-stock") {
      return renderOilContent();
    }
    return renderTrackerContent();
  };

  return (
    <TrackingDashboardUi
      view="section1"
      activeTab={activeTab}
      Button={Button}
      CAR_LOCATIONS={CAR_LOCATIONS}
      closeEntryModal={closeEntryModal}
      closeSearchModal={closeSearchModal}
      DevLayoutSection={DevLayoutSection}
      DropdownField={DropdownField}
      equipmentHistoryModal={equipmentHistoryModal}
      EquipmentHistoryModal={EquipmentHistoryModal}
      entries={entries}
      entryModal={entryModal}
      equipmentModal={equipmentModal}
      EquipmentToolsModal={EquipmentToolsModal}
      error={error}
      equipmentTypeFilter={equipmentTypeFilter}
      equipmentTypeFilters={EQUIPMENT_TYPE_FILTERS}
      handleDeleteEquipment={handleDeleteEquipment}
      handleDeleteOilStock={handleDeleteOilStock}
      handleLocationSelect={handleLocationSelect}
      handleSave={handleSave}
      handleSaveEquipment={handleSaveEquipment}
      handleSaveOilStock={handleSaveOilStock}
      isMobileView={isMobileView}
      KEY_LOCATIONS={KEY_LOCATIONS}
      loading={loading}
      loanCarFleetManagerOpen={loanCarFleetManagerOpen}
      loanCarMonth={loanCarMonth}
      setLoanCarMonth={setLoanCarMonth}
      MonthPickerField={MonthPickerField}
      LocationEntryModal={LocationEntryModal}
      LocationSearchModal={LocationSearchModal}
      oilCategoryFilter={oilCategoryFilter}
      oilCategoryFilters={OIL_STOCK_CATEGORY_FILTERS}
      oilStockModal={oilStockModal}
      oilStockHistoryModal={oilStockHistoryModal}
      OilStockModal={OilStockModal}
      OilStockHistoryModal={OilStockHistoryModal}
      openEntryModal={openEntryModal}
      renderActiveTabContent={renderActiveTabContent}
      SearchBar={SearchBar}
      searchModal={searchModal}
      setActiveTab={setActiveTab}
      setEquipmentModal={setEquipmentModal}
      setEquipmentHistoryModal={setEquipmentHistoryModal}
      setEquipmentTypeFilter={setEquipmentTypeFilter}
      setLoanCarFleetManagerOpen={setLoanCarFleetManagerOpen}
      setOilCategoryFilter={setOilCategoryFilter}
      setOilStockModal={setOilStockModal}
      setOilStockHistoryModal={setOilStockHistoryModal}
      setSimplifiedModal={setSimplifiedModal}
      setSharedSearchValue={setSharedSearchValue}
      setTrackerLocationFilter={setTrackerLocationFilter}
      setTrackerQuickFilter={setTrackerQuickFilter}
      sharedSearchPlaceholder={sharedSearchPlaceholder}
      sharedSearchValue={sharedSearchValue}
      simplifiedModal={simplifiedModal}
      SimplifiedTrackingModal={SimplifiedTrackingModal}
      StatusMessage={StatusMessage}
      TabGroup={TabGroup}
      tabs={tabs}
      trackerLocationFilter={trackerLocationFilter}
      trackerLocationFilters={TRACKER_LOCATION_FILTERS}
      trackerQuickFilter={trackerQuickFilter}
      trackerQuickFilters={TRACKER_QUICK_FILTERS}
      trackingMapOpen={trackingMapOpen}
      setTrackingMapOpen={setTrackingMapOpen}
      TrackingMapModal={TrackingMapModal}
      handleTrackingMapRefresh={loadEntries}
      TrackingRouteSkeleton={TrackingRouteSkeleton}
    />
  );















































































































































































}

TrackingDashboard.getLayout = (page) => <Layout disableContentCardHover>{page}</Layout>;
