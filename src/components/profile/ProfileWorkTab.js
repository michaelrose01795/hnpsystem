//  Imports converted to use absolute alias "@/"
// file location: src/pages/profile/index.js
import React, { useMemo, useState, useEffect, useCallback, useRef } from "react"; // React for UI and memoization
import { usePolling } from "@/hooks/usePolling"; // visibility-gated polling
import useIsMobile from "@/hooks/useIsMobile"; // viewport detection for phone layout
import { useRouter } from "next/router"; // Next.js router for query params
import { useSession } from "next-auth/react"; // NextAuth session for authentication
import Layout from "@/components/Layout"; // shared layout wrapper
import { useUser } from "@/context/UserContext"; // shared authenticated user context
import { useHrOperationsData } from "@/hooks/useHrData"; // Supabase-backed HR aggregation hook (admin only)
import { StatusTag } from "@/components/HR/MetricCard"; // HR UI components
import { CalendarField } from "@/components/calendarAPI";
import { DropdownField } from "@/components/dropdownAPI";
import StaffVehiclesCard from "@/components/HR/StaffVehiclesCard";
import { isHrCoreRole, isManagerScopedRole } from "@/lib/auth/roles"; // Role checking utilities
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import { SkeletonBlock, SkeletonMetricCard, SkeletonTableRow } from "@/components/ui/LoadingSkeleton";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { calculateLeaveRequestDayTotals, normaliseLeaveDayType } from "@/lib/hr/leaveRequests";
import {
  adaptWorkProfileData,
  buildFinanceDashboardModel,
  ensureFinanceState,
} from "@/lib/profile/personalFinance";

function formatDate(value) {
  if (!value) return "-"; // guard empty values
  const parsed = new Date(value); // parse raw string
  if (Number.isNaN(parsed.getTime())) return value; // return raw if parsing fails
  return parsed.toLocaleDateString(); // formatted string
}

function formatTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(value) {
  return `£${Number(value ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toRoundedHours(value) {
  return Number(Number(value || 0).toFixed(2));
}

function calculateHoursBetween(date, start, end) {
  if (!date || !start || !end) return null;
  const startMs = new Date(`${date}T${start}:00`).getTime();
  const endMs = new Date(`${date}T${end}:00`).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;
  return toRoundedHours((endMs - startMs) / (1000 * 60 * 60));
}

function addHoursToTime(date, start, hours) {
  if (!date || !start || !(Number(hours) > 0)) return "";
  const startMs = new Date(`${date}T${start}:00`).getTime();
  if (Number.isNaN(startMs)) return "";
  return new Date(startMs + Number(hours) * 60 * 60 * 1000).toTimeString().slice(0, 5);
}

function splitEmergencyContact(value) {
  if (!value || typeof value !== "string") {
    return { name: "Not provided", phone: "Not provided", relationship: "Not provided" };
  }
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    name: parts[0] || value,
    phone: parts[1] || "Not provided",
    relationship: parts[2] || "Not provided",
  };
}

// Check if clock-out is on a different day than clock-in
function isNextDayClocking(clockIn, clockOut) {
  if (!clockIn || !clockOut) return false;
  const inDate = new Date(clockIn);
  const outDate = new Date(clockOut);
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) return false;
  return (
    inDate.getFullYear() !== outDate.getFullYear() ||
    inDate.getMonth() !== outDate.getMonth() ||
    inDate.getDate() !== outDate.getDate()
  );
}

function ProfileCard({
  title,
  action,
  children,
  style,
  headerStyle,
  className = "",
  sectionKey,
  parentKey = "",
  sectionType = "content-card",
  backgroundToken = "",
  widthMode = "",
  shell = false,
}) {
  const cardContent = (
    <>
      {(title || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            ...headerStyle,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
            {title}
          </div>
          {action ? <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>{action}</div> : null}
        </div>
      )}
      {children}
    </>
  );

  const cardStyle = {
    background: "var(--profile-card-bg, var(--surface))",
    borderRadius: "var(--radius-md)",
    border: "var(--profile-card-border, 1px solid rgba(var(--accent-purple-rgb), 0.28))",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: "none",
    ...style,
  };

  if (sectionKey) {
    return (
      <DevLayoutSection
        as="div"
        sectionKey={sectionKey}
        parentKey={parentKey}
        sectionType={sectionType}
        backgroundToken={backgroundToken}
        widthMode={widthMode}
        shell={shell}
        className={className || undefined}
        style={cardStyle}
      >
        {cardContent}
      </DevLayoutSection>
    );
  }

  return (
    <div className={className || undefined} style={cardStyle}>
      {cardContent}
    </div>
  );
}

function KpiCard(props) {
  const {
    label,
    primary,
    secondary,
    accentColor,
    style,
    className = "",
    sectionKey,
    parentKey = "",
    sectionType = "content-card",
    backgroundToken = "",
    widthMode = "",
    shell = false,
  } = props;

  const cardContent = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-secondary)" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: "1.55rem", fontWeight: 700, color: accentColor || "var(--text-primary)" }}>
        {primary}
      </div>
      {secondary ? (
        <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>{secondary}</div>
      ) : null}
    </>
  );

  const cardStyle = {
    background: "var(--profile-card-bg, var(--surface))",
    borderRadius: "var(--radius-md)",
    border: "var(--profile-card-border, 1px solid rgba(var(--accent-purple-rgb), 0.28))",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minHeight: "112px",
    ...style,
  };

  if (sectionKey) {
    return (
      <DevLayoutSection
        as="div"
        sectionKey={sectionKey}
        parentKey={parentKey}
        sectionType={sectionType}
        backgroundToken={backgroundToken}
        widthMode={widthMode}
        shell={shell}
        className={className || undefined}
        style={cardStyle}
      >
        {cardContent}
      </DevLayoutSection>
    );
  }

  return (
    <div className={className || undefined} style={cardStyle}>
      {cardContent}
    </div>
  );
}

// Leave Request Modal
function LeaveRequestModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  submitError = "",
  initialValues = null,
  mode = "create",
  onRemove = null,
  isRemoving = false,
}) {
  const [form, setForm] = useState({
    type: "Holiday",
    endDate: "",
    startDate: "",
    halfDay: "None",
    notes: "",
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      type: initialValues?.type || "Holiday",
      startDate: initialValues?.startDate || "",
      endDate: initialValues?.endDate || initialValues?.startDate || "",
      halfDay: initialValues?.halfDay || "None",
      notes: initialValues?.notes || "",
    });
    setError(null);
  }, [initialValues, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const leaveTotals = calculateLeaveRequestDayTotals({
    startDate: form.startDate,
    endDate: form.endDate,
    halfDay: form.halfDay,
  });
  const hasValidDateRange = Boolean(form.startDate && form.endDate && new Date(`${form.endDate}T00:00:00`) >= new Date(`${form.startDate}T00:00:00`));
  const selectedDayType = normaliseLeaveDayType(form.halfDay);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.startDate) {
      setError("Start date is required.");
      return;
    }
    if (!form.endDate) {
      setError("Finish date is required.");
      return;
    }
    if (!hasValidDateRange) {
      setError("Finish date must be on or after the start date.");
      return;
    }
    if (!(leaveTotals.workDays > 0)) {
      setError("Selected dates do not include any working days.");
      return;
    }
    onSubmit({
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      halfDay: form.halfDay,
      totalDays: leaveTotals.workDays,
      notes: form.notes,
    });
  };

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={mode === "edit" ? "Edit leave request" : "Request leave"}
      cardStyle={{
        width: "min(100%, 620px)",
        padding: "28px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {mode === "edit" ? "Edit Leave Request" : "Request Leave"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.4rem",
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: "4px 8px",
            }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <DropdownField
                label="Leave Type"
                name="type"
                value={form.type}
                onChange={handleChange}
                className="leave-modal-field"
                options={[
                  { label: "Holiday", value: "Holiday" },
                  { label: "Sickness", value: "Sickness" },
                  { label: "Unpaid Leave", value: "Unpaid Leave" },
                ]}
              />
            </div>
            <div>
              <DropdownField
                label="Day Type"
                name="halfDay"
                value={form.halfDay}
                onChange={handleChange}
                className="leave-modal-field"
                options={[
                  { label: "Full day", value: "None" },
                  { label: "Morning only", value: "AM" },
                  { label: "Afternoon only", value: "PM" },
                ]}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <CalendarField
                label="Start Date"
                name="startDate"
                id="leave-start-date"
                value={form.startDate}
                onChange={handleChange}
                className="leave-modal-field"
                required
              />
            </div>
            <div>
              <CalendarField
                label="Finish Date"
                name="endDate"
                id="leave-end-date"
                value={form.endDate}
                onChange={handleChange}
                className="leave-modal-field"
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div style={{ ...modalStatStyle }}>
              <span style={modalStatLabelStyle}>Total work days</span>
              <span style={modalStatValueStyle}>{hasValidDateRange ? `${leaveTotals.workDays.toFixed(1)}d` : "—"}</span>
              <span style={modalStatHintStyle}>Monday to Friday only</span>
            </div>
            <div style={{ ...modalStatStyle }}>
              <span style={modalStatLabelStyle}>Total days</span>
              <span style={modalStatValueStyle}>{hasValidDateRange ? `${leaveTotals.calendarDays}d` : "—"}</span>
              <span style={modalStatHintStyle}>Monday to Sunday</span>
            </div>
          </div>

          {hasValidDateRange && (
            <div style={{
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(var(--accent-purple-rgb), 0.08)",
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              fontWeight: 500,
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}>
              <div>
                Leave dates: <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                  {new Date(`${form.startDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                  {" - "}
                  {new Date(`${form.endDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </span>
                {selectedDayType !== "None" && (
                  <span style={{ marginLeft: "8px", fontSize: "0.8rem", color: "var(--accent-purple)" }}>
                    ({selectedDayType === "AM" ? "Morning only" : "Afternoon only"})
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.78rem" }}>
                {leaveTotals.workDays.toFixed(1)} work day{leaveTotals.workDays === 1 ? "" : "s"} selected
              </div>
            </div>
          )}

          <label style={modalLabelStyle}>
            Notes (optional)
            <textarea
              className="app-input"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Reason for leave request..."
              style={{ ...modalInputStyle, resize: "vertical" }}
            />
          </label>

          {error && <div style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</div>}
          {!error && submitError ? <div style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{submitError}</div> : null}

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
            {mode === "edit" && onRemove ? (
              <Button
                type="button"
                onClick={onRemove}
                disabled={isRemoving || isSubmitting}
                variant="secondary"
                size="sm"
                className="app-btn--control"
                style={{ color: "var(--danger)" }}
              >
                {isRemoving ? "Removing..." : "Remove request"}
              </Button>
            ) : null}
            <Button type="button" onClick={onClose} variant="ghost" size="sm">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              style={{ opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting
                ? mode === "edit"
                  ? "Saving..."
                  : "Submitting..."
                : mode === "edit"
                ? "Save changes"
                : "Submit Request"}
            </Button>
          </div>
        </form>
    </PopupModal>
  );
}

const modalLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "var(--text-secondary)",
};

const modalInputStyle = {
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border, #ccc)",
  background: "var(--background)",
  color: "var(--text-primary)",
  fontSize: "0.9rem",
  fontWeight: 500,
};

const modalStatStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "12px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid rgba(var(--accent-purple-rgb), 0.14)",
  background: "rgba(var(--accent-purple-rgb), 0.06)",
};

const modalStatLabelStyle = {
  fontSize: "0.74rem",
  fontWeight: 700,
  color: "var(--text-secondary)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const modalStatValueStyle = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--text-primary)",
};

const modalStatHintStyle = {
  fontSize: "0.76rem",
  color: "var(--text-secondary)",
};

// Day labels for recurring overtime rules — Mon-Sat only (no Sundays)
const RECURRING_DAY_MAP = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" };
const RECURRING_DAY_SHORT = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" }; // short labels for grouped row display
const RECURRING_DAY_OPTIONS = [1, 2, 3, 4, 5, 6]; // JS day-of-week values: Mon=1 … Sat=6
const PARITY_LABELS = { odd: "Odd weeks", even: "Even weeks" }; // human-readable parity labels

// Quick preset chips for the add form — prefill days/hours/pattern when clicked
const PRESET_CHIPS = [
  { label: "Weekdays 0.50h", days: { 1: true, 2: true, 3: true, 4: true, 5: true }, hours: "0.50", patternType: "weekly" },
  { label: "Mon–Thu 0.50h", days: { 1: true, 2: true, 3: true, 4: true }, hours: "0.50", patternType: "weekly" },
  { label: "Sat 4.25h", days: { 6: true }, hours: "4.25", patternType: "weekly" },
  { label: "Alt. Sat 4.25h", days: { 6: true }, hours: "4.25", patternType: "alternate" },
];

function createRecurringRuleLabel() {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Import shared recurring overtime utilities (cycle math, matching, grouping, summaries)
import { groupRulesSmartly, getGroupKey, generateSmartSummary, getUpcomingEntries, detectOverlaps } from "@/lib/overtime/recurringUtils";

function ManualOvertimeModal({ isOpen, onClose, onSaved, userId = null }) {
  const [mode, setMode] = useState("single"); // "single" or "bulk"
  const [form, setForm] = useState({
    date: "",
    login: "",
    logout: "",
    totalHours: "",
  });
  const [bulkHours, setBulkHours] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode("single");
    setForm({ date: "", login: "", logout: "", totalHours: "" });
    setBulkHours("");
    setBulkNote("");
    setError(null);
    setIsSaving(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "date" || field === "login" || field === "logout") {
        const computedHours = calculateHoursBetween(next.date, next.login, next.logout);
        if (computedHours !== null) {
          next.totalHours = String(computedHours);
        } else if (field !== "logout" && !next.logout && next.date && next.login && Number(next.totalHours) > 0) {
          next.logout = addHoursToTime(next.date, next.login, next.totalHours);
        }
      } else if (field === "totalHours" && next.date && next.login && Number(value) > 0) {
        next.logout = addHoursToTime(next.date, next.login, value);
      }
      return next;
    });
    setError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) return;

    if (mode === "bulk") {
      if (!(Number(bulkHours) > 0)) {
        setError("Enter total hours greater than 0.");
        return;
      }
      setIsSaving(true);
      setError(null);
      try {
        const response = await fetch("/api/profile/overtime-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            bulk: true,
            totalHours: Number(bulkHours),
            note: bulkNote || undefined,
            userId,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Failed to save bulk overtime.");
        }
        onSaved?.(payload.data);
        onClose();
      } catch (err) {
        setError(err.message || "Failed to save bulk overtime.");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!form.date || !form.login) {
      setError("Date and login time are required.");
      return;
    }
    if (!form.logout && !(Number(form.totalHours) > 0)) {
      setError("Provide logout time or total hours.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/profile/overtime-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: form.date,
          start: form.login,
          end: form.logout || undefined,
          totalHours: form.totalHours ? Number(form.totalHours) : undefined,
          userId,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to save overtime.");
      }

      onSaved?.(payload.data);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save overtime.");
    } finally {
      setIsSaving(false);
    }
  };

  const tabStyle = (active) => ({
    flex: 1,
    padding: "8px 12px",
    fontSize: "0.82rem",
    fontWeight: 600,
    border: "none",
    borderBottom: active ? "2px solid var(--accent-purple, #7c3aed)" : "2px solid transparent",
    background: "none",
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
  });

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Add overtime"
      cardStyle={{
        width: "min(100%, 520px)",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>Add overtime</h3>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {mode === "single"
                ? "Type is saved as overtime. Logout or total hours can be calculated from the other fields."
                : "Add a lump sum of overtime hours. Only total hours will appear in the attendance table."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--text-secondary)" }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
          <button type="button" style={tabStyle(mode === "single")} onClick={() => { setMode("single"); setError(null); }}>
            Single Entry
          </button>
          <button type="button" style={tabStyle(mode === "bulk")} onClick={() => { setMode("bulk"); setError(null); }}>
            Bulk Overtime
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
          {mode === "single" ? (
            <>
              <CalendarField
                label="Date"
                name="date"
                id="manual-overtime-date"
                value={form.date}
                onChange={(event) => handleChange("date", event.target.value)}
                className="manual-overtime-field"
                required
              />

              <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                <label style={modalLabelStyle}>
                  Login
                  <input
                    className="app-input"
                    type="time"
                    value={form.login}
                    onChange={(event) => handleChange("login", event.target.value)}
                    style={modalInputStyle}
                    required
                  />
                </label>
                <label style={modalLabelStyle}>
                  Logout
                  <input
                    className="app-input"
                    type="time"
                    value={form.logout}
                    onChange={(event) => handleChange("logout", event.target.value)}
                    style={modalInputStyle}
                  />
                </label>
                <label style={modalLabelStyle}>
                  Total Hours
                  <input
                    className="app-input"
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={form.totalHours}
                    onChange={(event) => handleChange("totalHours", event.target.value)}
                    style={modalInputStyle}
                    placeholder="0.50"
                  />
                </label>
              </div>

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(var(--accent-purple-rgb), 0.08)",
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                }}
              >
                <div>Type: <strong style={{ color: "var(--text-primary)" }}>Overtime</strong></div>
                <div>Login: <strong style={{ color: "var(--text-primary)" }}>{form.login || "-"}</strong></div>
                <div>Logout: <strong style={{ color: "var(--text-primary)" }}>{form.logout || "-"}</strong></div>
                <div>Total hours: <strong style={{ color: "var(--text-primary)" }}>{form.totalHours || "-"}</strong></div>
              </div>
            </>
          ) : (
            <>
              <label style={modalLabelStyle}>
                Total Hours
                <input
                  className="app-input"
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={bulkHours}
                  onChange={(e) => { setBulkHours(e.target.value); setError(null); }}
                  style={modalInputStyle}
                  placeholder="e.g. 500"
                  required
                />
              </label>

              <label style={modalLabelStyle}>
                Note (optional)
                <input
                  className="app-input"
                  type="text"
                  value={bulkNote}
                  onChange={(e) => setBulkNote(e.target.value)}
                  style={modalInputStyle}
                  placeholder="e.g. Carried over from previous period"
                />
              </label>

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(var(--accent-purple-rgb), 0.08)",
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                }}
              >
                <div>Type: <strong style={{ color: "var(--text-primary)" }}>Overtime (Bulk)</strong></div>
                <div>Total hours: <strong style={{ color: "var(--text-primary)" }}>{bulkHours || "-"}</strong></div>
                {bulkNote ? <div>Note: <strong style={{ color: "var(--text-primary)" }}>{bulkNote}</strong></div> : null}
              </div>
            </>
          )}

          {error ? <div style={{ color: "var(--danger)", fontSize: "0.84rem" }}>{error}</div> : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
              {isSaving ? "Saving..." : mode === "bulk" ? "Add bulk overtime" : "Add overtime"}
            </Button>
          </div>
        </form>
    </PopupModal>
  );
}

// Modal for managing recurring overtime rules — grouped list with smart summaries and add/edit form
function RecurringOvertimeModal({ isOpen, onClose, userId = null }) {
  const [rules, setRules] = useState([]); // saved rules list from DB
  const [isLoading, setIsLoading] = useState(false); // loading state for fetch
  const [isSaving, setIsSaving] = useState(false); // saving state
  const [isDeletingGroup, setIsDeletingGroup] = useState(null); // composite group key being deleted
  const [error, setError] = useState(null); // error message
  const [formMode, setFormMode] = useState(null); // null = hidden, "add" = new rule, "edit" = editing group
  const [editingGroupKey, setEditingGroupKey] = useState(null); // composite key of group being edited
  const [hoveredRow, setHoveredRow] = useState(null); // track hovered group key for visual feedback
  const [formData, setFormData] = useState({ days: {}, hours: "", patternType: "weekly", weekParity: null, groupLabel: null }); // form state

  // Fetch existing rules when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setFormMode(null);
    setFormData({ days: {}, hours: "", patternType: "weekly", weekParity: null, groupLabel: null });
    setEditingGroupKey(null);
    setIsLoading(true);
    const url = userId ? `/api/profile/overtime-recurring-rules?userId=${userId}` : "/api/profile/overtime-recurring-rules";
    fetch(url, { credentials: "include" })
      .then((r) => r.json())
      .then((result) => {
        if (result.success && Array.isArray(result.data)) {
          setRules(result.data.filter((r) => r.day_of_week !== 0)); // exclude Sundays
        }
      })
      .catch(() => setError("Failed to load rules."))
      .finally(() => setIsLoading(false));
  }, [isOpen, userId]);

  // Toggle a day in the form
  const toggleFormDay = (dow) => {
    setFormData((prev) => ({ ...prev, days: { ...prev.days, [dow]: !prev.days[dow] } }));
    setError(null);
  };

  // Open add form — empty state
  const openAddForm = () => {
    setFormMode("add");
    setEditingGroupKey(null);
    setFormData({ days: {}, hours: "", patternType: "weekly", weekParity: null, groupLabel: createRecurringRuleLabel() });
    setError(null);
  };

  // Open edit form — pre-fill with the group's days, hours, pattern, and parity
  const openEditForm = (group) => {
    const daysMap = {};
    group.rules.forEach((r) => { daysMap[r.day_of_week] = true; }); // pre-select group's days
    const key = getGroupKey(group); // composite key for tracking
    setFormMode("edit");
    setEditingGroupKey(key);
    setFormData({
      days: daysMap,
      hours: String(group.hours),
      patternType: group.patternType || "weekly",
      weekParity: group.weekParity || null,
      groupLabel: group.label || null,
    });
    setError(null);
  };

  // Close the form
  const closeForm = () => {
    setFormMode(null);
    setEditingGroupKey(null);
    setFormData({ days: {}, hours: "", patternType: "weekly", weekParity: null, groupLabel: null });
    setError(null);
  };

  // Save form — handles both add and edit modes
  const handleSaveForm = async () => {
    const selectedDays = RECURRING_DAY_OPTIONS.filter((d) => formData.days[d]); // get checked days
    const hoursNum = parseFloat(formData.hours);
    if (selectedDays.length === 0) { setError("Select at least one day."); return; }
    if (isNaN(hoursNum) || hoursNum <= 0) { setError("Enter valid hours."); return; }
    if (formData.patternType === "alternate" && !formData.weekParity) { setError("Select week parity for alternate rules."); return; }

    setIsSaving(true);
    setError(null);

    try {
      // When editing, delete days that were in the original group but are now unchecked
      const deleteRuleIds = [];
      if (formMode === "edit" && editingGroupKey) {
        const originalGroup = groupRulesSmartly(rules).find((g) => getGroupKey(g) === editingGroupKey);
        if (originalGroup) {
          originalGroup.rules.forEach((r) => {
            if (!formData.days[r.day_of_week]) {
              deleteRuleIds.push(r.rule_id); // mark for deletion
            }
          });
        }
      }

      // Delete removed days first (if editing)
      if (deleteRuleIds.length > 0) {
        await fetch("/api/profile/overtime-recurring-rules", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ruleIds: deleteRuleIds, userId }),
        });
      }

      // Upsert selected days with current form values
      const ruleGroupLabel =
        formMode === "edit"
          ? (formData.groupLabel ?? null)
          : (formData.groupLabel || createRecurringRuleLabel());
      const upsertRules = selectedDays.map((dow) => ({
        dayOfWeek: dow,
        hours: hoursNum,
        active: true,
        patternType: formData.patternType,
        weekParity: formData.patternType === "alternate" ? formData.weekParity : null,
        label: ruleGroupLabel,
      }));

      const response = await fetch("/api/profile/overtime-recurring-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rules: upsertRules, userId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || "Failed to save rule.");
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        // Merge saved rules into local state — match by composite key (day + pattern + parity)
        setRules((prev) => {
          let merged = prev.filter((r) => !deleteRuleIds.includes(r.rule_id)); // remove deleted
          result.data.forEach((saved) => {
            const idx = merged.findIndex((r) =>
              r.day_of_week === saved.day_of_week &&
              (r.pattern_type || "weekly") === (saved.pattern_type || "weekly") &&
              (r.week_parity || null) === (saved.week_parity || null) &&
              (r.label || null) === (saved.label || null)
            );
            if (idx >= 0) merged[idx] = saved; // update existing
            else merged.push(saved); // add new
          });
          return merged.filter((r) => r.day_of_week !== 0).sort((a, b) => a.day_of_week - b.day_of_week);
        });
      }
      closeForm(); // collapse form on success
    } catch (err) {
      setError(err.message || "Failed to save rule.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete an entire group — physically remove all rules in the group
  const handleDeleteGroup = async (group) => {
    const key = getGroupKey(group);
    setIsDeletingGroup(key);
    setError(null);

    try {
      const ruleIds = group.rules.map((r) => r.rule_id); // collect all rule_ids in the group
      const response = await fetch("/api/profile/overtime-recurring-rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ruleIds, userId }),
      });

      if (!response.ok) throw new Error("Failed to remove rule.");

      // Remove deleted rules from local state
      const deletedIds = new Set(ruleIds);
      setRules((prev) => prev.filter((r) => !deletedIds.has(r.rule_id)));
    } catch (err) {
      setError(err.message || "Failed to remove rule.");
    } finally {
      setIsDeletingGroup(null);
    }
  };

  if (!isOpen) return null; // do not render when closed

  const activeRules = rules.filter((r) => r.active); // active rules for display and summaries
  const grouped = groupRulesSmartly(rules); // group all rules (active first, inactive muted)
  const summary = generateSmartSummary(rules); // smart summary stats
  const upcoming = getUpcomingEntries(activeRules, 3); // next 3 auto-log dates

  // Build overlap warnings for current form state
  const overlapWarnings = formMode ? detectOverlaps(rules, formData, editingGroupKey) : [];

  // Build live preview from current form state
  const previewEntries = (() => {
    if (!formMode) return [];
    const selectedDays = RECURRING_DAY_OPTIONS.filter((d) => formData.days[d]);
    const hrs = parseFloat(formData.hours);
    if (selectedDays.length === 0 || isNaN(hrs) || hrs <= 0) return [];
    const tempRules = selectedDays.map((d) => ({
      day_of_week: d,
      hours: hrs,
      pattern_type: formData.patternType || "weekly",
      week_parity: formData.patternType === "alternate" ? formData.weekParity : null,
      active: true,
    }));
    return getUpcomingEntries(tempRules, 3);
  })();

  // Day toggle + hours input + recurrence selector form — shared between add and edit
  const ruleForm = (
    <div
      style={{
        padding: "14px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid rgba(var(--accent-purple-rgb), 0.2)",
        background: "rgba(var(--accent-purple-rgb), 0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Quick preset chips — only shown in add mode */}
      {formMode === "add" && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {PRESET_CHIPS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setFormData({ days: { ...preset.days }, hours: preset.hours, patternType: preset.patternType, weekParity: preset.patternType === "alternate" ? "odd" : null, groupLabel: createRecurringRuleLabel() })}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-xs)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px dashed var(--border, rgba(0,0,0,0.12))",
                background: "var(--surface)",
                color: "var(--text-secondary)",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Day selection — Mon to Sat as toggle buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {RECURRING_DAY_OPTIONS.map((dow) => (
          <button
            key={dow}
            type="button"
            onClick={() => toggleFormDay(dow)}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              border: formData.days[dow]
                ? "1px solid var(--accent-purple)"
                : "1px solid var(--border, rgba(0,0,0,0.12))",
              background: formData.days[dow] ? "var(--accent-purple)" : "var(--surface)",
              color: formData.days[dow] ? "white" : "var(--text-primary)",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: "pointer",
            }}
          >
            {RECURRING_DAY_MAP[dow]}
          </button>
        ))}
      </div>

      {/* Recurrence selector — Every week / Every other week */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setFormData((prev) => ({ ...prev, patternType: "weekly", weekParity: null }))}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            fontSize: "0.82rem",
            cursor: "pointer",
            border: formData.patternType === "weekly" ? "1px solid var(--accent-purple)" : "1px solid var(--border, rgba(0,0,0,0.12))",
            background: formData.patternType === "weekly" ? "var(--accent-purple)" : "var(--surface)",
            color: formData.patternType === "weekly" ? "white" : "var(--text-primary)",
          }}
        >
          Every week
        </button>
        <button
          type="button"
          onClick={() => setFormData((prev) => ({ ...prev, patternType: "alternate", weekParity: prev.weekParity || "odd" }))}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--radius-sm)",
            fontWeight: 600,
            fontSize: "0.82rem",
            cursor: "pointer",
            border: formData.patternType === "alternate" ? "1px solid var(--accent-purple)" : "1px solid var(--border, rgba(0,0,0,0.12))",
            background: formData.patternType === "alternate" ? "var(--accent-purple)" : "var(--surface)",
            color: formData.patternType === "alternate" ? "white" : "var(--text-primary)",
          }}
        >
          Every other week
        </button>

        {/* Week parity selector — only shown when alternate is selected */}
        {formData.patternType === "alternate" && (
          <>
            {["odd", "even"].map((parity) => (
              <button
                key={parity}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, weekParity: parity }))}
                style={{
                  padding: "5px 12px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "0.80rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: formData.weekParity === parity ? "1px solid var(--accent-purple)" : "1px solid var(--border, rgba(0,0,0,0.12))",
                  background: formData.weekParity === parity ? "var(--accent-purple)" : "var(--surface)",
                  color: formData.weekParity === parity ? "white" : "var(--text-primary)",
                }}
              >
                {PARITY_LABELS[parity]}
              </button>
            ))}
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>(within 26th–25th cycle)</span>
          </>
        )}
      </div>

      {/* Hours input */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <input
          type="number"
          value={formData.hours}
          onChange={(e) => { setFormData((prev) => ({ ...prev, hours: e.target.value })); setError(null); }}
          step="0.25"
          min="0.25"
          max="16"
          placeholder="e.g. 0.50"
          style={{
            flex: 1,
            padding: "var(--control-padding)",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--accent-purple-surface)",
            fontWeight: 500,
            height: "var(--control-height)",
            boxSizing: "border-box",
          }}
        />
        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>hours</span>
      </div>

      {/* Overlap detection warning — soft, non-blocking */}
      {overlapWarnings.length > 0 && (
        <div style={{
          padding: "8px 12px",
          borderRadius: "var(--radius-xs)",
          background: "rgba(249, 115, 22, 0.08)",
          border: "1px solid rgba(249, 115, 22, 0.25)",
          fontSize: "0.78rem",
          color: "var(--text-secondary)",
        }}>
          <strong style={{ color: "rgb(249, 115, 22)" }}>Overlap notice</strong>
          {overlapWarnings.map((w, i) => (
            <div key={i} style={{ marginTop: "2px" }}>{w}</div>
          ))}
          <div style={{ marginTop: "3px", fontStyle: "italic" }}>Hours will be combined on matching days.</div>
        </div>
      )}

      {/* Live preview — next 3 upcoming entries based on form state */}
      {previewEntries.length > 0 && (
        <div style={{
          padding: "8px 12px",
          borderRadius: "var(--radius-xs)",
          background: "rgba(var(--accent-purple-rgb), 0.03)",
          fontSize: "0.78rem",
          color: "var(--text-secondary)",
        }}>
          <strong style={{ color: "var(--text-primary)" }}>Preview</strong>
          {previewEntries.map((entry, i) => (
            <div key={i} style={{ marginTop: "2px" }}>
              {entry.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} — {entry.totalHours.toFixed(2)}h
            </div>
          ))}
        </div>
      )}

      {/* Form actions — Save / Cancel / Delete (when editing) */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={handleSaveForm}
          disabled={isSaving}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--accent-purple)",
            background: "var(--accent-purple)",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.85rem",
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? "Saving…" : "Save Rule"}
        </button>
        <button
          type="button"
          onClick={closeForm}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border, rgba(0,0,0,0.12))",
            background: "var(--surface)",
            color: "var(--text-primary)",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          Cancel
        </button>
        {/* Delete button — only when editing an existing group */}
        {formMode === "edit" && editingGroupKey && (
          <button
            type="button"
            onClick={() => {
              const group = grouped.find((g) => getGroupKey(g) === editingGroupKey);
              if (group) { handleDeleteGroup(group); closeForm(); }
            }}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--danger, #e53935)",
              background: "transparent",
              color: "var(--danger, #e53935)",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.85rem",
              marginLeft: "auto",
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Recurring overtime rules"
      cardStyle={{
        width: "min(100%, 560px)",
        padding: "28px 32px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
        {/* Modal header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Recurring Overtime Rules</h3>
            <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
              Set overtime rules that auto-log hours on matching days. Period runs from the 26th to the 25th.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--text-secondary)", padding: "4px", flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Smart summary strip — only shown when active rules exist */}
        {activeRules.length > 0 && !isLoading && (
          <div style={{
            display: "flex",
            gap: "16px",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(var(--accent-purple-rgb), 0.04)",
            border: "1px solid rgba(var(--accent-purple-rgb), 0.12)",
            fontSize: "0.80rem",
            color: "var(--text-secondary)",
            flexWrap: "wrap",
            alignItems: "center",
          }}>
            <span><strong style={{ color: "var(--text-primary)" }}>{summary.totalWeeklyHours.toFixed(2)}h</strong> avg/week</span>
            <span>{summary.activePatterns} pattern{summary.activePatterns !== 1 ? "s" : ""}</span>
            {upcoming.length > 0 && (
              <span>
                Next: <strong style={{ color: "var(--accent-purple)" }}>
                  {upcoming[0].date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </strong> ({upcoming[0].totalHours.toFixed(2)}h)
              </span>
            )}
          </div>
        )}

        {/* Grouped rules list — click-to-edit, no Edit button */}
        {isLoading ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-secondary)" }}>Loading rules…</div>
        ) : grouped.length === 0 && !formMode ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            <div style={{ marginBottom: "4px" }}>No recurring overtime rules set yet.</div>
            <div style={{ fontSize: "0.78rem" }}>Add a rule to auto-log regular overtime.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {grouped.map((group) => {
              const key = getGroupKey(group);
              const dayLabel = group.rules.map((r) => RECURRING_DAY_SHORT[r.day_of_week]).join(", "); // "Mon, Tue, Wed, Thu"
              const isBeingEdited = formMode === "edit" && editingGroupKey === key; // hide row while editing
              if (isBeingEdited) return null; // form replaces this row
              const isHovered = hoveredRow === key;
              const isInactive = !group.active;

              return (
                <div
                  key={key}
                  onClick={() => { if (!isInactive) openEditForm(group); }} // click-to-edit (active rows only)
                  onMouseEnter={() => setHoveredRow(key)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    background: isHovered && !isInactive
                      ? "rgba(var(--accent-purple-rgb), 0.12)" // hover highlight
                      : "rgba(var(--accent-purple-rgb), 0.06)",
                    border: "1px solid rgba(var(--accent-purple-rgb), 0.2)",
                    cursor: isInactive ? "default" : "pointer",
                    transition: "background 0.15s ease",
                    opacity: isInactive ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                      {dayLabel}
                    </span>
                    <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--accent-purple)" }}>
                      {Number(group.hours).toFixed(2)}h
                    </span>
                    {/* Pattern label */}
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
                      {group.patternType === "alternate"
                        ? `${PARITY_LABELS[group.weekParity] || "alternate"} only`
                        : "every week"}
                    </span>
                    {/* Active/Inactive badge */}
                    {isInactive && (
                      <span style={{
                        fontSize: "0.70rem",
                        padding: "1px 7px",
                        borderRadius: "var(--radius-pill)",
                        background: "rgba(0,0,0,0.08)",
                        color: "var(--text-secondary)",
                        fontWeight: 600,
                      }}>
                        Inactive
                      </span>
                    )}
                  </div>
                  {/* Remove button — stop propagation to prevent click-to-edit */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                    disabled={isDeletingGroup === key}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "var(--radius-xs)",
                      border: "1px solid transparent",
                      background: "transparent",
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      opacity: isDeletingGroup === key ? 0.5 : (isHovered ? 1 : 0.4),
                      transition: "opacity 0.15s ease",
                      flexShrink: 0,
                    }}
                  >
                    {isDeletingGroup === key ? "Removing…" : "Remove"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add/Edit rule form — only visible when formMode is set */}
        {formMode && ruleForm}

        {/* Error message */}
        {error && <div style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</div>}

        {/* Upcoming entries preview — shown when rules exist and form is closed */}
        {!formMode && upcoming.length > 0 && (
          <div style={{
            padding: "8px 12px",
            borderRadius: "var(--radius-xs)",
            background: "rgba(var(--accent-purple-rgb), 0.03)",
            fontSize: "0.78rem",
            color: "var(--text-secondary)",
          }}>
            <strong style={{ color: "var(--text-primary)", fontSize: "0.80rem" }}>Next 3 auto-log entries</strong>
            {upcoming.map((entry, i) => (
              <div key={i} style={{ marginTop: "3px", display: "flex", gap: "6px" }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", minWidth: "100px" }}>
                  {entry.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span>{entry.totalHours.toFixed(2)}h</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
          {!formMode ? (
            <button
              type="button"
              onClick={openAddForm}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--accent-purple)",
                background: "var(--accent-purple)",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Add Rule
            </button>
          ) : (
            <div /> /* spacer when form is open — actions are inside the form */
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border, rgba(0,0,0,0.12))",
              background: "var(--surface)",
              color: "var(--text-primary)",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Close
          </button>
        </div>
    </PopupModal>
  );
}

export function ProfileWorkTab({
  forcedUserName = null,
  embeddedOverride = null,
  adminPreviewOverride = null,
  onHeaderActionsChange = null,
} = {}) {
  const router = useRouter(); // access query params
  const { user, dbUserId } = useUser(); // session details + Supabase id for dev mode
  const { data: session } = useSession(); // NextAuth session for role checking
  const isMobile = useIsMobile(); // collapse grids / swap table for cards on phone vertical
  // State for user's own profile data (non-admin users)
  const [userProfileData, setUserProfileData] = useState(null);
  const [userProfileLoading, setUserProfileLoading] = useState(true);
  const [userProfileError, setUserProfileError] = useState(null);
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const hasProfileDataRef = useRef(false); // Track whether initial data has loaded (avoids stale closure)

  // Determine if user has HR/Manager roles for admin preview
  const userRoles = session?.user?.roles || user?.roles || [];
  const isAdminOrManager = isHrCoreRole(userRoles) || isManagerScopedRole(userRoles);

  // Only fetch HR operations data if user is admin/manager AND viewing another user's profile
  const shouldUseHrData = isAdminOrManager && (forcedUserName || adminPreviewOverride);
  const { data: hrData, isLoading: hrLoading, error: hrError } = useHrOperationsData(profileReloadKey, {
    enabled: shouldUseHrData,
  });

  const previewUserParam =
    forcedUserName || (typeof router.query.user === "string" ? router.query.user : null); // preview override
  const isEmbeddedQuery = router.query.embedded === "1"; // check embed flag
  const isEmbedded = embeddedOverride ?? isEmbeddedQuery; // final embed state
  const isAdminPreviewQuery = router.query.adminPreview === "1"; // admin preview flag
  const isAdminPreview = adminPreviewOverride ?? isAdminPreviewQuery; // final admin preview state

  const reloadUserProfile = useCallback(() => {
    // Skip if viewing another user's profile as admin
    if (shouldUseHrData) {
      setUserProfileLoading(false);
      return;
    }

    // Skip if no user session
    if (!user && !session?.user) {
      setUserProfileLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchProfile = async () => {
      try {
        // Only show loading skeleton on initial fetch — background reloads keep existing UI
        if (!hasProfileDataRef.current) {
          setUserProfileLoading(true);
        }
        setUserProfileError(null);

        const shouldUseDevQuery = !session?.user && dbUserId;
        const profileUrl = shouldUseDevQuery ? `/api/profile/me?userId=${dbUserId}` : "/api/profile/me";
        const personalStateUrl = shouldUseDevQuery ? `/api/personal/state?userId=${dbUserId}` : "/api/personal/state";

        const [response, personalStateResponse] = await Promise.all([
          fetch(profileUrl, {
            signal: controller.signal,
            credentials: "include",
          }),
          fetch(personalStateUrl, {
            signal: controller.signal,
            credentials: "include",
          }).catch(() => null),
        ]);

        if (!response.ok) {
          const errPayload = await response.json().catch(() => null);
          if (response.status === 404) {
            throw new Error(
              errPayload?.message || "Profile not found. Please contact HR to create your employee profile."
            );
          }
          throw new Error(
            errPayload?.message || `Failed to load profile data (status ${response.status})`
          );
        }

        const payload = await response.json();
        const personalStatePayload = personalStateResponse?.ok
          ? await personalStateResponse.json().catch(() => null)
          : null;

        if (!payload?.success || !payload?.data) {
          throw new Error(payload?.message || "Profile data payload malformed");
        }

        if (!isMounted) return;

        console.log("Profile data loaded:", payload.data);
        console.log("Attendance logs count:", payload.data?.attendanceLogs?.length || 0);
        console.log("Sample attendance log:", payload.data?.attendanceLogs?.[0]);

        setUserProfileData({
          ...payload.data,
          personalFinanceState: personalStatePayload?.success ? personalStatePayload.data?.financeState || null : null,
        });
        hasProfileDataRef.current = true; // Mark that initial data has loaded
        setUserProfileLoading(false);
      } catch (error) {
        if (error.name === "AbortError") return;
        if (!isMounted) return;

        console.error("Failed to fetch user profile:", error);
        setUserProfileError(error);
        setUserProfileLoading(false);
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [dbUserId, session?.user, shouldUseHrData, user]);

  useEffect(() => {
    const cleanup = reloadUserProfile();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [reloadUserProfile, profileReloadKey]);

  usePolling(() => setProfileReloadKey((prev) => prev + 1), 30000);

  // Choose data source based on whether viewing as admin or own profile
  const data = shouldUseHrData ? hrData : null;
  const employeeDirectory = useMemo(() => data?.employeeDirectory ?? [], [data?.employeeDirectory]); // employees with job data (admin only)
  const attendanceLogs = useMemo(
    () => (shouldUseHrData ? (data?.attendanceLogs ?? []) : (userProfileData?.attendanceLogs ?? [])),
    [data?.attendanceLogs, shouldUseHrData, userProfileData?.attendanceLogs]
  ); // clocking records
  const overtimeSummaries = useMemo(
    () => (shouldUseHrData ? (data?.overtimeSummaries ?? []) : (userProfileData?.overtimeSummary ? [userProfileData.overtimeSummary] : [])),
    [data?.overtimeSummaries, shouldUseHrData, userProfileData?.overtimeSummary]
  ); // overtime totals
  const leaveBalances = useMemo(() => data?.leaveBalances ?? [], [data?.leaveBalances]); // leave usage (admin only)
  const leaveRequests = useMemo(
    () => (shouldUseHrData ? [] : userProfileData?.leaveRequests ?? []),
    [shouldUseHrData, userProfileData?.leaveRequests]
  );
  const staffVehicles = useMemo(
    () => (shouldUseHrData ? (data?.staffVehicles ?? []) : (userProfileData?.staffVehicles ?? [])),
    [data?.staffVehicles, shouldUseHrData, userProfileData?.staffVehicles]
  );
  const activeUserName = previewUserParam || user?.username || session?.user?.name || null; // active username resolution

  const hrProfile = useMemo(() => {
    // For admin viewing another user's profile
    if (!activeUserName || employeeDirectory.length === 0) return null; // ensure data loaded
    const username = activeUserName.toLowerCase(); // normalise for comparisons

    return (
      employeeDirectory.find(
        (employee) =>
          employee.email?.toLowerCase() === username ||
          employee.name?.toLowerCase() === username
      ) ?? null
    ); // locate HR profile by email/name
  }, [activeUserName, employeeDirectory]);

  // Use appropriate data source based on user role and context
  const profile = shouldUseHrData ? hrProfile : userProfileData?.profile;
  const emergencyParts = useMemo(() => splitEmergencyContact(profile?.emergencyContact), [profile?.emergencyContact]);

  const aggregatedStats = useMemo(() => {
    if (!profile) return null; // bail if profile missing

    // Handle both admin HR data and user's own profile data
    let attendanceSource, overtimeSource, leaveSource;

    if (shouldUseHrData) {
      attendanceSource = attendanceLogs.filter((entry) => entry.employeeId === profile.id || entry.employeeId === profile.name);
      overtimeSource = overtimeSummaries.find((entry) => entry.employee === profile.name || entry.id === profile.userId) ?? null;
      leaveSource = leaveBalances.find((entry) => entry.employee === profile.name) ?? null;
    } else {
      attendanceSource = attendanceLogs;
      overtimeSource = userProfileData?.overtimeSummary ?? null;
      leaveSource = userProfileData?.leaveBalance ?? null;
    }

    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format
    const todayRecords = attendanceSource.filter((entry) => {
      if (!entry.date) return false;
      const entryDate = new Date(entry.date).toLocaleDateString("en-CA");
      return entryDate === today;
    });
    const todayHours = todayRecords.reduce((sum, entry) => sum + Number(entry.totalHours ?? 0), 0);

    const overtimeRecords = attendanceSource.filter((entry) => entry.type === "Overtime" || entry.status === "Overtime");
    const overtimeTotal = overtimeRecords.reduce((sum, entry) => sum + Number(entry.totalHours ?? 0), 0);

    const overtimeRate = overtimeSource?.overtimeRate ?? 0;
    const overtimeBonus = overtimeSource?.bonus ?? 0;

    // Period breakdowns (26th-to-25th cycle): weekday work hours, overtime hours, weekend hours
    const now = new Date();
    const nowDay = now.getDate();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    let periodStartDate, periodEndDate; // 26th-to-25th bounds for filtering attendance
    if (nowDay >= 26) {
      periodStartDate = new Date(nowYear, nowMonth, 26);
      periodEndDate = new Date(nowYear, nowMonth + 1, 25);
    } else {
      periodStartDate = new Date(nowYear, nowMonth - 1, 26);
      periodEndDate = new Date(nowYear, nowMonth, 25);
    }

    let monthlyWeekdayHours = 0;
    let monthlyOvertimeHours = 0;
    let monthlyWeekendHours = 0;

    attendanceSource.forEach((entry) => {
      if (!entry.date || entry.bulk) return; // skip bulk overtime — year-level only
      const entryDate = new Date(entry.date);
      if (entryDate < periodStartDate || entryDate > periodEndDate) return; // filter to 26th-to-25th cycle
      const hours = Number(entry.totalHours ?? 0);
      const entryType = entry.type || entry.status || "";
      if (entryType === "Overtime") {
        monthlyOvertimeHours += hours;
      } else if (entryType === "Weekend") {
        monthlyWeekendHours += hours;
      } else {
        monthlyWeekdayHours += hours;
      }
    });

    const monthlyTotalHours = monthlyWeekdayHours + monthlyOvertimeHours + monthlyWeekendHours;
    const estimatedPay =
      monthlyWeekdayHours * Number(profile?.hourlyRate ?? 0) +
      monthlyOvertimeHours * Number(profile?.overtimeRate ?? 0);
    const workData = adaptWorkProfileData(userProfileData || {});
    const financeState = ensureFinanceState(userProfileData?.personalFinanceState, {
      workData,
    });
    const financeModel = buildFinanceDashboardModel({
      financeState,
      workData,
      monthKey: financeState.selectedMonthKey,
    });
    const totalPayAfterTax = Number(financeModel?.currentMonth?.pay?.afterTaxIncome ?? 0);

    return {
      totalHours: todayHours,
      overtimeHours: Number(overtimeTotal.toFixed(2)),
      overtimeBalance: overtimeTotal && overtimeRate ? overtimeTotal * overtimeRate + overtimeBonus : 0,
      leaveRemaining: leaveSource?.remaining ?? null,
      leaveEntitlement: leaveSource?.entitlement ?? null,
      leaveTaken: leaveSource?.taken ?? null,
      attendanceRecords: attendanceSource,
      overtimeSummary: overtimeSource,
      monthlyWeekdayHours: Number(monthlyWeekdayHours.toFixed(2)),
      monthlyOvertimeHours: Number(monthlyOvertimeHours.toFixed(2)),
      monthlyWeekendHours: Number(monthlyWeekendHours.toFixed(2)),
      monthlyTotalHours: Number(monthlyTotalHours.toFixed(2)),
      estimatedPay: Number(estimatedPay.toFixed(2)),
      totalPayAfterTax: Number(totalPayAfterTax.toFixed(2)),
    };
  }, [attendanceLogs, leaveBalances, overtimeSummaries, profile, shouldUseHrData, userProfileData]);
  // Leave request modal state
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false); // recurring overtime rules modal
  const [manualOvertimeModalOpen, setManualOvertimeModalOpen] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveRemoving, setLeaveRemoving] = useState(false);
  const [editingLeaveRequest, setEditingLeaveRequest] = useState(null);
  const [leaveSubmitError, setLeaveSubmitError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Emergency contact edit state
  const [ecEditing, setEcEditing] = useState(false);
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelationship, setEcRelationship] = useState("");
  const [ecAddress, setEcAddress] = useState("");
  const [ecSaving, setEcSaving] = useState(false);
  const [ecError, setEcError] = useState(null);

  const handleLeaveSubmit = useCallback(async (formData) => {
    setLeaveSubmitting(true);
    setLeaveSubmitError("");
    try {
      const isEditMode = Boolean(editingLeaveRequest?.id);
      const response = await fetch(
        isEditMode
          ? `/api/profile/leave-request/${editingLeaveRequest.id}`
          : "/api/profile/leave-request",
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(formData),
        }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || `Failed to ${isEditMode ? "update" : "submit"} leave request.`);
      }
      setEditingLeaveRequest(null);
      setLeaveModalOpen(false);
      setProfileReloadKey((prev) => prev + 1);
      alert(`Leave request ${isEditMode ? "updated" : "submitted"} successfully.`);
    } catch (err) {
      console.error("Leave request error:", err);
      setLeaveSubmitError(err.message || `Failed to ${editingLeaveRequest?.id ? "update" : "submit"} leave request.`);
    } finally {
      setLeaveSubmitting(false);
    }
  }, [editingLeaveRequest?.id]);

  const handleEditLeaveRequest = useCallback((request) => {
    if (!request?.id) return;
    setLeaveSubmitError("");
    setEditingLeaveRequest({
      id: request.id,
      type: request.type,
      startDate: request.startDate,
      endDate: request.endDate || request.startDate,
      totalDays: request.totalDays || 1,
      halfDay: request.halfDay || "None",
      notes: request.requestNotes || "",
    });
    setLeaveModalOpen(true);
  }, []);

  const doRemoveLeaveRequest = useCallback(async () => {
    if (!editingLeaveRequest?.id) return;
    setLeaveRemoving(true);
    try {
      const response = await fetch(`/api/profile/leave-request/${editingLeaveRequest.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to remove leave request.");
      }
      setEditingLeaveRequest(null);
      setLeaveModalOpen(false);
      setProfileReloadKey((prev) => prev + 1);
      alert("Leave request removed successfully.");
    } catch (error) {
      console.error("Failed to remove leave request:", error);
      alert(`Failed to remove leave request. ${error.message || ""}`);
    } finally {
      setLeaveRemoving(false);
    }
  }, [editingLeaveRequest?.id]);

  const handleRemoveLeaveRequest = useCallback(() => {
    if (!editingLeaveRequest?.id) return;
    setConfirmDialog({
      message: "Remove this leave request?",
      onConfirm: () => {
        setConfirmDialog(null);
        doRemoveLeaveRequest();
      },
    });
  }, [editingLeaveRequest?.id, doRemoveLeaveRequest]);

  const handleStartEcEdit = useCallback(() => {
    setEcName(emergencyParts.name === "Not provided" ? "" : emergencyParts.name);
    setEcPhone(emergencyParts.phone === "Not provided" ? "" : emergencyParts.phone);
    setEcRelationship(emergencyParts.relationship === "Not provided" ? "" : emergencyParts.relationship);
    setEcAddress(profile?.address === "Not provided" ? "" : (profile?.address || ""));
    setEcError(null);
    setEcEditing(true);
  }, [emergencyParts, profile?.address]);

  const handleSaveEc = useCallback(async () => {
    setEcSaving(true);
    setEcError(null);
    try {
      const response = await fetch("/api/profile/emergency-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: ecName.trim(),
          phone: ecPhone.trim(),
          relationship: ecRelationship.trim(),
          address: ecAddress.trim(),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to update emergency contact.");
      }
      const ecParts = [ecName.trim(), ecPhone.trim(), ecRelationship.trim()].filter(Boolean);
      setUserProfileData((prev) => {
        if (!prev?.profile) return prev;
        return {
          ...prev,
          profile: {
            ...prev.profile,
            emergencyContact: ecParts.length > 0 ? ecParts.join(", ") : "Not provided",
            address: ecAddress.trim() || "No address on file",
          },
        };
      });
      setEcEditing(false);
    } catch (err) {
      setEcError(err.message || "Failed to update.");
    } finally {
      setEcSaving(false);
    }
  }, [ecName, ecPhone, ecRelationship, ecAddress]);

  const profileStaffVehicles = useMemo(() => {
    if (!profile?.userId) return [];
    return staffVehicles.filter((vehicle) => vehicle.userId === profile.userId);
  }, [profile?.userId, staffVehicles]);

  const isLoading = shouldUseHrData ? hrLoading : userProfileLoading;
  const error = shouldUseHrData ? hrError : userProfileError;
  const attendanceRecords = aggregatedStats?.attendanceRecords ?? [];
  const isOvertimeEntry = (entry) => (entry.type || entry.status) === "Overtime";
  const overtimeRecords = attendanceRecords.filter(isOvertimeEntry);
  const normalRecords = attendanceRecords.filter((entry) => !isOvertimeEntry(entry));
  const shouldScrollOvertimeHistory = overtimeRecords.length >= 5;
  const shouldScrollNormalHistory = normalRecords.length >= 5;

  useEffect(() => {
    onHeaderActionsChange?.(null);
    return () => onHeaderActionsChange?.(null);
  }, [onHeaderActionsChange]);

  if (!user && !session?.user && !previewUserParam) {
    const fallback = (
      <div style={{ padding: "24px", color: "var(--text-secondary)" }}>
        You need to be signed in to view your profile.
      </div>
    );
    return isEmbedded ? fallback : <Layout>{fallback}</Layout>;
  }

  const profileSectionShellStyle = {
    background: "var(--accent-purple-surface)",
    border: "var(--section-card-border)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--section-card-padding)",
  };

  const profileSurfaceCardStyle = {
    background: "var(--surface)",
    border: "var(--section-card-border)",
  };

  const renderAttendanceBody = ({ records, shouldScroll, keyPrefix, parentKey, emptyLabel }) => (
    isMobile ? (
      <DevLayoutSection
        as="div"
        sectionKey={`${keyPrefix}-shell`}
        parentKey={parentKey}
        sectionType="data-table-shell"
        backgroundToken="surface"
        style={{
          maxHeight: shouldScroll ? "420px" : "none",
          overflowY: shouldScroll ? "auto" : "visible",
          marginTop: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "4px",
          borderRadius: "var(--radius-md)",
          border: "1px solid rgba(var(--accent-purple-rgb), 0.12)",
          background: "var(--profile-table-surface)",
        }}
      >
        {records.map((entry) => {
          const nextDay = isNextDayClocking(entry.clockIn, entry.clockOut);
          const entryType = entry.type || entry.status;
          const tone =
            entryType === "Overtime"
              ? "warning"
              : entryType === "Weekend"
              ? "info"
              : entryType === "Weekday"
              ? "success"
              : "default";
          return (
            <div
              key={entry.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
                border: "1px solid rgba(var(--accent-purple-rgb), 0.12)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                  {formatDate(entry.date)}
                </span>
                <StatusTag label={entryType} tone={tone} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Login</span>
                  <span style={{ fontSize: "0.86rem", fontWeight: 600, color: "var(--text-primary)" }}>{formatTime(entry.clockIn)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Logout</span>
                  <span style={{ fontSize: "0.86rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {entry.clockOut ? (
                      <>
                        {formatTime(entry.clockOut)}
                        {nextDay && (
                          <span style={{ fontSize: "0.68rem", color: "var(--warning)", marginLeft: "4px" }}>+1d</span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--success)", background: "rgba(var(--success-rgb, 67,160,71), 0.12)", padding: "2px 8px", borderRadius: "var(--radius-pill)" }}>Active</span>
                    )}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-end" }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Hours</span>
                  <span style={{ fontSize: "0.86rem", fontWeight: 700, color: nextDay ? "var(--warning)" : "var(--text-primary)" }}>
                    {nextDay ? "Next Day" : `${Number(entry.totalHours ?? 0).toFixed(2)}h`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {records.length === 0 && (
          <div style={{ padding: "18px 14px", color: "var(--text-secondary)", textAlign: "center" }}>
            {emptyLabel}
          </div>
        )}
      </DevLayoutSection>
    ) : (
      <DevLayoutSection
        as="div"
        sectionKey={`${keyPrefix}-shell`}
        parentKey={parentKey}
        sectionType="data-table-shell"
        backgroundToken="surface"
        style={{
          maxHeight: shouldScroll ? "290px" : "none",
          overflowY: shouldScroll ? "auto" : "visible",
          marginTop: "10px",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          border: "1px solid rgba(var(--accent-purple-rgb), 0.12)",
          background: "var(--profile-table-surface)",
        }}
      >
        <DevLayoutSection
          as="table"
          sectionKey={keyPrefix}
          parentKey={parentKey}
          sectionType="data-table"
          backgroundToken="surface"
          style={{ width: "100%", borderCollapse: "collapse", background: "var(--profile-table-surface)", tableLayout: "fixed" }}
        >
          <colgroup>
            <col style={{ width: "112px" }} />
            <col style={{ width: "92px" }} />
            <col style={{ width: "104px" }} />
            <col style={{ width: "120px" }} />
            <col />
          </colgroup>
          <DevLayoutSection
            as="thead"
            sectionKey={`${keyPrefix}-headings`}
            parentKey={keyPrefix}
            sectionType="table-headings"
            backgroundToken="accent-dark"
          >
            <tr
              style={{
                color: "var(--text-inverse, #ffffff)",
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                position: "sticky",
                top: 0,
                background: "var(--accent-dark, var(--accent-purple))",
                zIndex: 1,
              }}
            >
              <th style={{ textAlign: "left", padding: "12px 10px 12px 14px", whiteSpace: "nowrap" }}>Date</th>
              <th style={{ textAlign: "center", padding: "12px 8px" }}>Login</th>
              <th style={{ textAlign: "center", padding: "12px 8px" }}>Logout</th>
              <th style={{ textAlign: "center", padding: "12px 8px" }}>Total Hours</th>
              <th style={{ textAlign: "center", padding: "12px 14px 12px 8px" }}>Type</th>
            </tr>
          </DevLayoutSection>
          <DevLayoutSection
            as="tbody"
            sectionKey={`${keyPrefix}-rows`}
            parentKey={keyPrefix}
            sectionType="table-rows"
            backgroundToken="accent-surface"
            style={{
              background: "var(--profile-table-surface)",
            }}
          >
            {records.map((entry, index) => {
              const nextDay = isNextDayClocking(entry.clockIn, entry.clockOut);
              return (
                <tr
                  key={entry.id}
                  style={{
                    borderTop: "1px solid rgba(var(--accent-purple-rgb), 0.18)",
                    background: index % 2 === 0
                      ? "var(--profile-table-surface)"
                      : "var(--profile-table-alt-surface)",
                  }}
                >
                  <td style={{ padding: "14px 10px 14px 14px", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "middle" }}>{formatDate(entry.date)}</td>
                  <td style={{ textAlign: "center", padding: "14px 8px", verticalAlign: "middle" }}>{formatTime(entry.clockIn)}</td>
                  <td style={{ textAlign: "center", padding: "14px 8px", verticalAlign: "middle" }}>
                    {entry.clockOut ? formatTime(entry.clockOut) : (
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--success)", background: "rgba(var(--success-rgb, 67,160,71), 0.12)", padding: "2px 8px", borderRadius: "var(--radius-pill)" }}>Active</span>
                    )}
                    {nextDay && (
                      <span style={{ fontSize: "0.7rem", color: "var(--warning)", marginLeft: "4px" }}>+1d</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center", padding: "14px 8px", verticalAlign: "middle" }}>
                    {nextDay ? (
                      <span style={{ color: "var(--warning)", fontWeight: 600 }}>Next Day</span>
                    ) : (
                      `${Number(entry.totalHours ?? 0).toFixed(2)}h`
                    )}
                  </td>
                  <td style={{ textAlign: "center", padding: "14px 14px 14px 8px", verticalAlign: "middle" }}>
                    <StatusTag
                      label={entry.type || entry.status}
                      tone={
                        (entry.type || entry.status) === "Overtime"
                          ? "warning"
                          : (entry.type || entry.status) === "Weekend"
                          ? "info"
                          : (entry.type || entry.status) === "Weekday"
                          ? "success"
                          : "default"
                      }
                    />
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "18px 14px", color: "var(--text-secondary)", textAlign: "center" }}>
                  {emptyLabel}
                </td>
              </tr>
            )}
          </DevLayoutSection>
        </DevLayoutSection>
      </DevLayoutSection>
    )
  );

  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "0",
        background: "transparent",
        color: "var(--text-primary)",
        minHeight: "100%",
      }}
    >
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "18px" }}>
        <header style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {isAdminPreview && profile && (
            <div
              style={{
                background: "rgba(var(--info-rgb), 0.08)",
                color: "var(--text-primary)",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                fontWeight: 600,
              }}
            >
              Admin previewing {profile.name}'s profile
            </div>
          )}
        </header>

        {isLoading && (
          <>
            <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
            <section
              style={{
                display: "grid",
                gap: "12px",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              }}
            >
              <SkeletonMetricCard />
              <SkeletonMetricCard />
              <SkeletonMetricCard />
              <SkeletonMetricCard />
            </section>

            <ProfileCard title="Attendance History">
              <SkeletonBlock width="100%" height="48px" borderRadius="10px" />
              <table style={{ width: "100%", marginTop: "12px" }}>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonTableRow key={i} cols={5} />
                  ))}
                </tbody>
              </table>
            </ProfileCard>
          </>
        )}

        {error && (
          <ProfileCard title="Failed to load profile data">
            <span style={{ color: "var(--danger)" }}>{error.message}</span>
            {!shouldUseHrData && (
              <div style={{ marginTop: "12px", color: "var(--text-secondary)" }}>
                If you continue to see this error, please contact HR to ensure your employee profile has been created.
              </div>
            )}
          </ProfileCard>
        )}

        {!isLoading && !error && profile ? (
          <>
            {/* KPI Row: Total Hours | Hourly Rate (admin) | Leave Remaining — side by side */}
            <DevLayoutSection
              as="section"
              sectionKey="profile-work-kpi-card-group"
              parentKey="profile-active-tab-panel"
              sectionType="section-shell"
              backgroundToken="accent-surface"
              shell
              style={{
                ...profileSectionShellStyle,
                padding: isMobile ? "12px" : "var(--section-card-padding)",
                display: "grid",
                gap: isMobile ? "10px" : "14px",
                gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              {/* Total Hours (logged) card with 3 sub-columns + grand total */}
              <ProfileCard
                sectionKey="profile-work-kpi-total-hours"
                parentKey="profile-active-tab-panel"
                backgroundToken="accent-surface"
                style={{
                  ...profileSurfaceCardStyle,
                  padding: 0,
                  gap: 0,
                  overflow: "hidden",
                  minHeight: "112px",
                }}
                headerStyle={{
                  padding: "10px 14px 6px",
                }}
                title={`Total Hours - ${new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`}
              >
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    flex: 1,
                  }}>
                    <div style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid rgba(var(--accent-purple-rgb), 0.12)" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-secondary)" }}>Work</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--accent-purple)" }}>
                        {aggregatedStats?.monthlyWeekdayHours?.toFixed(2) ?? "0.00"}h
                      </div>
                    </div>
                    <div style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid rgba(var(--accent-purple-rgb), 0.12)" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-secondary)" }}>Overtime</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--danger, #e53935)" }}>
                        {aggregatedStats?.monthlyOvertimeHours?.toFixed(2) ?? "0.00"}h
                      </div>
                    </div>
                    <div style={{ padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-secondary)" }}>Weekend</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--info, #1e88e5)" }}>
                        {aggregatedStats?.monthlyWeekendHours?.toFixed(2) ?? "0.00"}h
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 10px",
                    borderTop: "1px solid rgba(var(--accent-purple-rgb), 0.15)",
                    background: "var(--surface)",
                  }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)" }}>Total</span>
                    <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {aggregatedStats?.monthlyTotalHours?.toFixed(2) ?? "0.00"}h
                    </span>
                  </div>
              </ProfileCard>

              {/* Pay Rates card — 50/50 split matching Total Hours style */}
              {isAdminOrManager && (
                <ProfileCard
                  className="app-profile-accent-card"
                  sectionKey="profile-work-kpi-pay-rates"
                  parentKey="profile-active-tab-panel"
                  backgroundToken="accent-surface"
                  style={{
                    ...profileSurfaceCardStyle,
                    padding: 0,
                    gap: 0,
                    overflow: "hidden",
                    minHeight: "112px",
                  }}
                  headerStyle={{
                    padding: "10px 14px 6px",
                  }}
                  title="Pay Rates"
                >
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    flex: 1,
                  }}>
                    <div style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid rgba(var(--accent-purple-rgb), 0.12)" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-secondary)" }}>Hourly Rate</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--success, #43a047)" }}>
                        {formatCurrency(profile.hourlyRate ?? 0)}
                      </div>
                    </div>
                    <div style={{ padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-secondary)" }}>Overtime Rate</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--danger, #e53935)" }}>
                        {formatCurrency(profile.overtimeRate ?? 0)}
                      </div>
                    </div>
                  </div>
                </ProfileCard>
              )}
              <KpiCard
                sectionKey="profile-work-kpi-estimated-pay"
                parentKey="profile-active-tab-panel"
                backgroundToken="accent-surface"
                style={{
                  ...profileSurfaceCardStyle,
                }}
                label="Total Pay After Tax"
                primary={
                  Number(profile?.hourlyRate ?? 0) > 0 || Number(profile?.overtimeRate ?? 0) > 0
                    ? formatCurrency(
                        Number(aggregatedStats?.totalPayAfterTax ?? 0) > 0
                          ? aggregatedStats?.totalPayAfterTax
                          : aggregatedStats?.estimatedPay ?? 0
                      )
                    : formatCurrency(aggregatedStats?.totalPayAfterTax ?? 0)
                }
                secondary="Linked to the Personal tab income widget"
                accentColor="var(--success)"
              />
              <KpiCard
                sectionKey="profile-work-kpi-leave-remaining"
                parentKey="profile-active-tab-panel"
                backgroundToken="accent-surface"
                style={{
                  ...profileSurfaceCardStyle,
                }}
                label="Leave Remaining"
                primary={
                  aggregatedStats?.leaveRemaining !== null
                    ? `${aggregatedStats.leaveRemaining} days`
                    : "No data"
                }
                secondary={
                  aggregatedStats?.leaveEntitlement
                    ? `${aggregatedStats.leaveTaken ?? 0} taken of ${aggregatedStats.leaveEntitlement}`
                    : null
                }
                accentColor="var(--danger)"
              />
            </DevLayoutSection>

            <DevLayoutSection
              as="section"
              sectionKey="profile-work-summary-card-group"
              parentKey="profile-active-tab-panel"
              sectionType="section-shell"
              backgroundToken="accent-surface"
              shell
              style={{
                ...profileSectionShellStyle,
                padding: isMobile ? "12px" : "var(--section-card-padding)",
                display: "grid",
                gap: isMobile ? "12px" : "16px",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))",
              }}
            >
              <ProfileCard
                sectionKey="profile-work-leave-summary"
                parentKey="profile-active-tab-panel"
                backgroundToken="accent-surface"
                style={{
                  ...profileSurfaceCardStyle,
                }}
                title="Leave Summary"
                action={
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingLeaveRequest(null);
                      setLeaveSubmitError("");
                      setLeaveModalOpen(true);
                    }}
                  >
                    Request leave
                  </Button>
                }
              >
                  <div style={{ display: "grid", gap: "14px" }}>
                    <div
                      style={{
                        display: "grid",
                        gap: "12px",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      }}
                    >
                      <div style={emergencyInfoCardStyle}>
                        <span style={emergencyInfoLabelStyle}>Entitlement</span>
                        <span style={emergencyInfoValueStyle}>{aggregatedStats?.leaveEntitlement ?? "-"} days</span>
                      </div>
                      <div style={emergencyInfoCardStyle}>
                        <span style={emergencyInfoLabelStyle}>Taken</span>
                        <span style={emergencyInfoValueStyle}>{aggregatedStats?.leaveTaken ?? "-"} days</span>
                      </div>
                      <div
                        style={{
                          ...emergencyInfoCardStyle,
                          background: "var(--accent-purple-surface)",
                          border: "1px solid rgba(var(--accent-purple-rgb), 0.14)",
                        }}
                      >
                        <span style={emergencyInfoLabelStyle}>Remaining</span>
                        <span style={{ ...emergencyInfoValueStyle, color: "var(--success)" }}>
                          {aggregatedStats?.leaveRemaining ?? "-"} days
                        </span>
                      </div>
                    </div>
                    {leaveRequests.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          gap: "10px",
                          padding: "12px 14px",
                          borderRadius: "var(--radius-md)",
                          background: "var(--accent-purple-surface)",
                          border: "1px solid rgba(var(--accent-purple-rgb), 0.1)",
                        }}
                      >
                        <span style={{ fontSize: "0.78rem", color: "var(--text-primary)", fontWeight: 700 }}>
                          Recent requests
                        </span>
                        {leaveRequests.slice(0, 4).map((request) => {
                          const status = String(request.status || "Pending");
                          const isApproved = status.toLowerCase() === "approved";
                          const isDeclined = status.toLowerCase() === "declined" || status.toLowerCase() === "rejected";
                          const isEditable = true;
                          return (
                            <button
                              type="button"
                              key={request.id}
                              onClick={() => {
                                if (isEditable) {
                                  handleEditLeaveRequest(request);
                                }
                              }}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                padding: "10px 12px",
                                borderRadius: "var(--radius-sm)",
                                background: "var(--surface)",
                                border: "1px solid rgba(var(--accent-purple-rgb), 0.12)",
                                textAlign: "left",
                                cursor: isEditable ? "pointer" : "default",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                  {request.type} · {new Date(`${request.startDate}T00:00:00`).toLocaleDateString("en-GB")}
                                </span>
                                <span
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: "var(--radius-pill)",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    background: isApproved
                                      ? "var(--success-surface)"
                                      : isDeclined
                                      ? "var(--danger-surface)"
                                      : "var(--info-surface)",
                                    color: isApproved
                                      ? "var(--success)"
                                      : isDeclined
                                      ? "var(--danger)"
                                      : "var(--info-dark)",
                                  }}
                                >
                                  {status}
                                </span>
                              </div>
                              {request.requestNotes ? (
                                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                  {request.requestNotes}
                                </span>
                              ) : null}
                              {request.declineReason ? (
                                <span style={{ fontSize: "0.78rem", color: "var(--danger)", fontWeight: 600 }}>
                                  Decline reason: {request.declineReason}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
              </ProfileCard>
              <LeaveRequestModal
                isOpen={leaveModalOpen}
                onClose={() => {
                  setLeaveModalOpen(false);
                  setEditingLeaveRequest(null);
                  setLeaveSubmitError("");
                }}
                onSubmit={handleLeaveSubmit}
                isSubmitting={leaveSubmitting}
                submitError={leaveSubmitError}
                initialValues={editingLeaveRequest}
                mode={editingLeaveRequest ? "edit" : "create"}
                onRemove={editingLeaveRequest ? handleRemoveLeaveRequest : null}
                isRemoving={leaveRemoving}
              />

              <ProfileCard
                sectionKey="profile-work-emergency-contact"
                parentKey="profile-active-tab-panel"
                backgroundToken="accent-surface"
                style={{
                  background: "var(--surface)",
                  border: "var(--section-card-border)",
                }}
                title="Emergency Contact"
                action={
                  <div style={{ display: "flex", gap: "8px" }}>
                    {!ecEditing && (
                      <Button
                        type="button"
                        onClick={handleStartEcEdit}
                        variant="secondary"
                        size="sm"
                        className="app-btn--control"
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                }
              >
                  {ecEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "grid", gap: "10px" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)" }}>Name</span>
                          <input
                            className="app-input"
                            type="text"
                            value={ecName}
                            onChange={(e) => { setEcName(e.target.value); setEcError(null); }}
                            placeholder="Full name"
                            style={inputStyle}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)" }}>Phone</span>
                          <input
                            className="app-input"
                            type="tel"
                            value={ecPhone}
                            onChange={(e) => { setEcPhone(e.target.value); setEcError(null); }}
                            placeholder="Phone number"
                            style={inputStyle}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)" }}>Relationship</span>
                          <input
                            className="app-input"
                            type="text"
                            value={ecRelationship}
                            onChange={(e) => { setEcRelationship(e.target.value); setEcError(null); }}
                            placeholder="e.g. Partner, Parent, Sibling"
                            style={inputStyle}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)" }}>Address</span>
                          <input
                            className="app-input"
                            type="text"
                            value={ecAddress}
                            onChange={(e) => {
                              setEcAddress(e.target.value);
                              setEcError(null);
                            }}
                            placeholder="Home address"
                            style={inputStyle}
                          />
                        </label>
                      </div>
                      {ecError && <div style={{ color: "var(--danger)", fontSize: "0.82rem" }}>{ecError}</div>}
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEcEditing(false)}>
                          Cancel
                        </Button>
                        <Button type="button" variant="primary" size="sm" onClick={handleSaveEc} disabled={ecSaving}>
                          {ecSaving ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: "14px" }}>
                      <div
                        style={{
                          display: "grid",
                          gap: "12px",
                          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                        }}
                      >
                        <div style={emergencyInfoCardStyle}>
                          <span style={emergencyInfoLabelStyle}>Name</span>
                          <span style={emergencyInfoValueStyle}>{emergencyParts.name}</span>
                        </div>
                        <div style={emergencyInfoCardStyle}>
                          <span style={emergencyInfoLabelStyle}>Phone</span>
                          <span style={emergencyInfoValueStyle}>{emergencyParts.phone}</span>
                        </div>
                        <div style={emergencyInfoCardStyle}>
                          <span style={emergencyInfoLabelStyle}>Relationship</span>
                          <span style={emergencyInfoValueStyle}>{emergencyParts.relationship}</span>
                        </div>
                        <div style={emergencyInfoCardStyle}>
                          <span style={emergencyInfoLabelStyle}>Address</span>
                          <span style={emergencyInfoValueStyle}>{profile?.address || "No address on file"}</span>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "12px 14px",
                          borderRadius: "var(--radius-md)",
                          background: "var(--accent-purple-surface)",
                          border: "1px solid rgba(var(--accent-purple-rgb), 0.1)",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: "28px",
                            height: "28px",
                            borderRadius: "999px",
                            background: "rgba(var(--accent-purple-rgb), 0.12)",
                            color: "var(--accent-purple)",
                            fontWeight: 700,
                            fontSize: "0.78rem",
                          }}
                        >
                          EC
                        </span>
                        <div style={{ display: "grid", gap: "4px" }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            Keep these details up to date
                          </span>
                          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                            This contact may be used if HR or management need to reach someone in an emergency.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
              </ProfileCard>
            </DevLayoutSection>

            <DevLayoutSection
              as="section"
              sectionKey="profile-work-attendance-history-group"
              parentKey="profile-active-tab-panel"
              sectionType="section-shell"
              backgroundToken="accent-surface"
              shell
              style={{
                display: "grid",
                gap: "16px",
                gridTemplateColumns: "minmax(0, 1fr)",
              }}
            >
              <ProfileCard
                sectionKey="profile-work-attendance-history"
                parentKey="profile-work-attendance-history-group"
                backgroundToken="accent-surface"
                style={{
                  background: "var(--surface)",
                  border: "var(--section-card-border)",
                }}
                title={<span style={{ color: "var(--accent-dark, var(--accent-purple))" }}>Attendance History</span>}
                action={
                  <Button
                    type="button"
                    onClick={() => setRecurringModalOpen(true)}
                    variant="secondary"
                    size="sm"
                    className="app-btn--control"
                  >
                    Recurring Rules
                  </Button>
                }
              >
                {renderAttendanceBody({
                  records: normalRecords,
                  shouldScroll: shouldScrollNormalHistory,
                  keyPrefix: "profile-auto-data-table-2",
                  parentKey: "profile-work-attendance-history",
                  emptyLabel: "No records found.",
                })}
              </ProfileCard>

              <ProfileCard
                sectionKey="profile-work-attendance-overtime-history"
                parentKey="profile-work-attendance-history-group"
                backgroundToken="accent-surface"
                style={{
                  background: "var(--surface)",
                  border: "var(--section-card-border)",
                }}
                title={<span style={{ color: "var(--accent-dark, var(--accent-purple))" }}>Overtime History</span>}
                action={
                  !shouldUseHrData && (
                    <Button
                      type="button"
                      onClick={() => setManualOvertimeModalOpen(true)}
                      variant="primary"
                      size="sm"
                    >
                      Add overtime
                    </Button>
                  )
                }
              >
                {renderAttendanceBody({
                  records: overtimeRecords,
                  shouldScroll: shouldScrollOvertimeHistory,
                  keyPrefix: "profile-auto-data-table-overtime",
                  parentKey: "profile-work-attendance-overtime-history",
                  emptyLabel: "No overtime records found.",
                })}
              </ProfileCard>
            </DevLayoutSection>

            {profile && (
              <DevLayoutSection
                as="section"
                sectionKey="profile-work-staff-vehicles-group"
                parentKey="profile-active-tab-panel"
                sectionType="section-shell"
                backgroundToken="accent-surface"
                shell
                style={{
                  display: "grid",
                  gap: "16px",
                  gridTemplateColumns: "minmax(0, 1fr)",
                }}
              >
                <StaffVehiclesCard
                  userId={profile.userId}
                  vehicles={profileStaffVehicles}
                  sectionKey="profile-work-staff-vehicles"
                  parentKey="profile-work-staff-vehicles-group"
                  backgroundToken="accent-surface"
                />
              </DevLayoutSection>
            )}
          </>
        ) : null}

        {!isLoading && !error && !profile && (
          <ProfileCard title="Profile not found">
            <span style={{ color: "var(--info)" }}>
              Ask HR to create an employee profile or verify your email address is correct.
            </span>
          </ProfileCard>
        )}
      </div>
    </div>
  );

  const confirmDialogEl = (
    <ConfirmationDialog
      isOpen={!!confirmDialog}
      message={confirmDialog?.message}
      cancelLabel="Cancel"
      confirmLabel="Remove"
      onCancel={() => setConfirmDialog(null)}
      onConfirm={confirmDialog?.onConfirm}
    />
  );

  const recurringOvertimeModalEl = (
    <RecurringOvertimeModal
      isOpen={recurringModalOpen}
      onClose={() => setRecurringModalOpen(false)}
      userId={dbUserId}
    />
  );

  const manualOvertimeModalEl = (
    <ManualOvertimeModal
      isOpen={manualOvertimeModalOpen}
      onClose={() => setManualOvertimeModalOpen(false)}
      onSaved={() => setProfileReloadKey((prev) => prev + 1)}
      userId={dbUserId}
    />
  );

  return isEmbedded ? (
    <>{content}{confirmDialogEl}{recurringOvertimeModalEl}{manualOvertimeModalEl}</>
  ) : (
    <Layout>{content}{confirmDialogEl}{recurringOvertimeModalEl}{manualOvertimeModalEl}</Layout>
  );
}

export default function ProfileWorkTabWrapper(props) {
  return <ProfileWorkTab {...props} />;
}

const inputStyle = {
  width: "100%",
};

const emergencyInfoCardStyle = {
  display: "grid",
  gap: "6px",
  padding: "12px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid rgba(var(--accent-purple-rgb), 0.12)",
  background: "var(--accent-purple-surface)",
  alignContent: "start",
  minHeight: "78px",
};

const emergencyInfoLabelStyle = {
  fontSize: "0.74rem",
  color: "var(--text-secondary)",
  fontWeight: 700,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const emergencyInfoValueStyle = {
  color: "var(--text-primary)",
  fontWeight: 600,
  lineHeight: 1.45,
  wordBreak: "break-word",
};
