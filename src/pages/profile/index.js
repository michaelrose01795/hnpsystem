//  Imports converted to use absolute alias "@/"
// file location: src/pages/profile/index.js
import React, { useMemo, useState, useEffect, useCallback } from "react"; // React for UI and memoization
import { createPortal } from "react-dom";
import { useRouter } from "next/router"; // Next.js router for query params
import { useSession } from "next-auth/react"; // NextAuth session for authentication
import Layout from "@/components/Layout"; // shared layout wrapper
import { useUser } from "@/context/UserContext"; // Keycloak user context
import { useHrOperationsData } from "@/hooks/useHrData"; // Supabase-backed HR aggregation hook (admin only)
import { StatusTag } from "@/components/HR/MetricCard"; // HR UI components
import { CalendarField } from "@/components/calendarAPI";
import { TimePickerField } from "@/components/timePickerAPI";
import { DropdownField } from "@/components/dropdownAPI";
import StaffVehiclesCard from "@/components/HR/StaffVehiclesCard";
import { useTheme } from "@/styles/themeProvider";
import { isHrCoreRole, isManagerScopedRole } from "@/lib/auth/roles"; // Role checking utilities

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
  return `Â£${Number(value ?? 0).toFixed(2)}`; // currency helper used across metrics
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

// Skeleton loading placeholder component
function SkeletonBlock({ width = "100%", height = "20px", borderRadius = "8px" }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background:
          "linear-gradient(90deg, var(--surface-light, #e0e0e0) 25%, var(--surface, #f0f0f0) 50%, var(--surface-light, #e0e0e0) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s ease-in-out infinite",
      }}
    />
  );
}

function SkeletonMetricCard() {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "16px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        minWidth: "200px",
        flex: 1,
        border: "1px solid var(--accent-purple-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <SkeletonBlock width="28px" height="28px" borderRadius="8px" />
        <SkeletonBlock width="120px" height="14px" />
      </div>
      <SkeletonBlock width="80px" height="30px" borderRadius="6px" />
      <SkeletonBlock width="140px" height="12px" />
    </div>
  );
}

function SkeletonTableRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "10px 0" }}>
          <SkeletonBlock width={i === 0 ? "100px" : "70px"} height="14px" />
        </td>
      ))}
    </tr>
  );
}

function ProfileCard({ title, action, children, style, headerStyle }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "18px",
        border: "1px solid rgba(var(--accent-purple-rgb), 0.28)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        boxShadow: "0 0 0 1px rgba(124,58,237,0.04), 0 10px 24px rgba(15,23,42,0.08)",
        ...style,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            ...headerStyle,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
            {title}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}

function KpiCard({ icon, label, primary, secondary, accentColor }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "16px",
        border: "1px solid rgba(var(--accent-purple-rgb), 0.28)",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        minHeight: "112px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          style={{
            fontSize: "1rem",
            width: "28px",
            height: "28px",
            display: "grid",
            placeItems: "center",
            borderRadius: "9px",
            background: "rgba(var(--accent-purple-rgb), 0.14)",
            color: "var(--accent-purple)",
          }}
        >
          {icon}
        </span>
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
    </div>
  );
}

// Leave Request Modal
function LeaveRequestModal({ isOpen, onClose, onSubmit, isSubmitting }) {
  const [form, setForm] = useState({
    type: "Holiday",
    startDate: "",
    endDate: "",
    notes: "",
  });
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate) {
      setError("Start date and end date are required.");
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setError("End date must be on or after start date.");
      return;
    }
    onSubmit(form);
  };

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "16px",
          padding: "28px",
          width: "100%",
          maxWidth: "460px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Request Leave
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
          <DropdownField
            label="Leave Type"
            name="type"
            value={form.type}
            onChange={handleChange}
            options={[
              { label: "Holiday", value: "Holiday" },
              { label: "Sickness", value: "Sickness" },
              { label: "Unpaid Leave", value: "Unpaid Leave" },
            ]}
          />

          <CalendarField
            label="Start Date"
            name="startDate"
            id="leave-start-date"
            value={form.startDate}
            onChange={handleChange}
            required
          />

          <CalendarField
            label="End Date"
            name="endDate"
            id="leave-end-date"
            value={form.endDate}
            onChange={handleChange}
            required
          />

          <label style={modalLabelStyle}>
            Notes (optional)
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Reason for leave request..."
              style={{ ...modalInputStyle, resize: "vertical" }}
            />
          </label>

          {error && <div style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</div>}

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
            <button type="button" onClick={onClose} style={modalCancelBtnStyle}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ ...modalSubmitBtnStyle, opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
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
  borderRadius: "10px",
  border: "1px solid var(--border, #ccc)",
  background: "var(--background)",
  color: "var(--text-primary)",
  fontSize: "0.9rem",
  fontWeight: 500,
};

const modalCancelBtnStyle = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px solid var(--border, #ccc)",
  background: "transparent",
  color: "var(--text-secondary)",
  fontWeight: 600,
  cursor: "pointer",
};

const modalSubmitBtnStyle = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: "var(--accent-purple)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

// Simple overtime log form - just date, start, end, and add button
function OvertimeLogForm({ onSessionSaved = () => {}, userId = null }) {
  const [form, setForm] = useState({ date: "", start: "", end: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.start || !form.end) return;

    const startDate = new Date(`${form.date}T${form.start}`);
    const endDate = new Date(`${form.date}T${form.end}`);
    if (endDate <= startDate) {
      setError("End time must be after start time.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const payload = { ...form, userId };

    try {
      const response = await fetch("/api/profile/overtime-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || "Failed to save overtime session.");
      }

      const result = await response.json();
      setForm({ date: "", start: "", end: "" });
      setSuccess("Overtime session logged.");
      onSessionSaved(result?.data || null);
    } catch (err) {
      setError(err.message || "Failed to save overtime session.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "end",
      }}
    >
      <div style={{ flex: "1 1 180px", minWidth: "180px" }}>
        <CalendarField label="Date" name="date" id="ot-date" value={form.date} onChange={handleChange} />
      </div>
      <div style={{ flex: "1 1 160px", minWidth: "160px" }}>
        <TimePickerField label="Start time" name="start" value={form.start} onChange={handleChange} />
      </div>
      <div style={{ flex: "1 1 160px", minWidth: "160px" }}>
        <TimePickerField label="End time" name="end" value={form.end} onChange={handleChange} />
      </div>
      <div style={{ flex: "0 0 150px", minWidth: "150px" }}>
        <button
          type="submit"
          disabled={isSaving}
          style={{
            padding: "10px 12px",
            borderRadius: "10px",
            border: "none",
            background: "var(--accent-purple)",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            height: "44px",
            width: "100%",
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? "Saving..." : "Add session"}
        </button>
      </div>
      {error && (
        <div style={{ flex: "1 1 100%", color: "var(--danger)", fontSize: "0.85rem" }}>{error}</div>
      )}
      {success && (
        <div style={{ flex: "1 1 100%", color: "var(--success)", fontSize: "0.85rem" }}>{success}</div>
      )}
    </form>
  );
}

export function ProfilePage({
  forcedUserName = null,
  embeddedOverride = null,
  adminPreviewOverride = null,
} = {}) {
  const router = useRouter(); // access query params
  const { user, dbUserId } = useUser(); // Keycloak session details + Supabase id for dev mode
  const { data: session } = useSession(); // NextAuth session for role checking
  const { mode: themeMode, resolvedMode, isDark, toggleTheme } = useTheme();

  // State for user's own profile data (non-admin users)
  const [userProfileData, setUserProfileData] = useState(null);
  const [userProfileLoading, setUserProfileLoading] = useState(true);
  const [userProfileError, setUserProfileError] = useState(null);
  const [profileReloadKey, setProfileReloadKey] = useState(0);

  // Determine if user has HR/Manager roles for admin preview
  const userRoles = session?.user?.roles || user?.roles || [];
  const isAdminOrManager = isHrCoreRole(userRoles) || isManagerScopedRole(userRoles);

  // Only fetch HR operations data if user is admin/manager AND viewing another user's profile
  const shouldUseHrData = isAdminOrManager && (forcedUserName || adminPreviewOverride);
  const { data: hrData, isLoading: hrLoading, error: hrError } = useHrOperationsData();

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
        setUserProfileLoading(true);
        setUserProfileError(null);

        const shouldUseDevQuery = !session?.user && dbUserId;
        const profileUrl = shouldUseDevQuery ? `/api/profile/me?userId=${dbUserId}` : "/api/profile/me";

        const response = await fetch(profileUrl, {
          signal: controller.signal,
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Profile not found. Please contact HR to create your employee profile.");
          }
          throw new Error(`Failed to load profile data (status ${response.status})`);
        }

        const payload = await response.json();

        if (!payload?.success || !payload?.data) {
          throw new Error(payload?.message || "Profile data payload malformed");
        }

        if (!isMounted) return;

        console.log("Profile data loaded:", payload.data);
        console.log("Attendance logs count:", payload.data?.attendanceLogs?.length || 0);
        console.log("Sample attendance log:", payload.data?.attendanceLogs?.[0]);

        setUserProfileData(payload.data);
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

  // Choose data source based on whether viewing as admin or own profile
  const data = shouldUseHrData ? hrData : null;
  const employeeDirectory = data?.employeeDirectory ?? []; // employees with job data (admin only)
  const attendanceLogs = shouldUseHrData ? (data?.attendanceLogs ?? []) : (userProfileData?.attendanceLogs ?? []); // clocking records
  const overtimeSummaries = shouldUseHrData ? (data?.overtimeSummaries ?? []) : (userProfileData?.overtimeSummary ? [userProfileData.overtimeSummary] : []); // overtime totals
  const leaveBalances = data?.leaveBalances ?? []; // leave usage (admin only)
  const staffVehicles = shouldUseHrData ? (data?.staffVehicles ?? []) : (userProfileData?.staffVehicles ?? []);
  const activeUserName = previewUserParam || user?.username || session?.user?.name || null; // active username resolution

  const hrProfile = useMemo(() => {
    // For admin viewing another user's profile
    if (!activeUserName || employeeDirectory.length === 0) return null; // ensure data loaded
    const username = activeUserName.toLowerCase(); // normalise for comparisons

    return (
      employeeDirectory.find(
        (employee) =>
          employee.keycloakId?.toLowerCase() === username ||
          employee.email?.toLowerCase() === username ||
          employee.name?.toLowerCase() === username
      ) ?? null
    ); // locate HR profile by keycloak/email/name
  }, [activeUserName, employeeDirectory]);

  // Use appropriate data source based on user role and context
  const profile = shouldUseHrData ? hrProfile : userProfileData?.profile;
  const emergencyParts = useMemo(() => splitEmergencyContact(profile?.emergencyContact), [profile?.emergencyContact]);

  const themeLabel = useMemo(() => {
    if (themeMode === "system") {
      return `System (${resolvedMode === "dark" ? "dark" : "light"})`;
    }
    return themeMode === "dark" ? "Dark mode" : "Light mode";
  }, [resolvedMode, themeMode]);

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

    return {
      totalHours: todayHours,
      overtimeHours: Number(overtimeTotal.toFixed(2)),
      overtimeBalance: overtimeTotal && overtimeRate ? overtimeTotal * overtimeRate + overtimeBonus : 0,
      leaveRemaining: leaveSource?.remaining ?? null,
      leaveEntitlement: leaveSource?.entitlement ?? null,
      leaveTaken: leaveSource?.taken ?? null,
      attendanceRecords: attendanceSource,
      overtimeSummary: overtimeSource,
    };
  }, [attendanceLogs, leaveBalances, overtimeSummaries, profile, shouldUseHrData, userProfileData]);

  const handleOvertimeSessionSaved = useCallback(
    (savedEntry) => {
      if (!savedEntry) {
        setProfileReloadKey((prev) => prev + 1);
        return;
      }

      if (!shouldUseHrData) {
        setUserProfileData((prev) => {
          if (!prev) return prev;

          const clockInTime = savedEntry.start ? `${savedEntry.date}T${savedEntry.start}:00` : `${savedEntry.date}T00:00:00`;
          const clockOutTime = savedEntry.end ? `${savedEntry.date}T${savedEntry.end}:00` : `${savedEntry.date}T23:59:00`;

          const newLog = {
            id: savedEntry.id,
            employeeId: savedEntry.userId,
            date: savedEntry.date,
            clockIn: clockInTime,
            clockOut: clockOutTime,
            totalHours: Number(savedEntry.totalHours || 0),
            status: "Overtime",
            type: "Overtime",
          };

          return {
            ...prev,
            attendanceLogs: [newLog, ...(prev.attendanceLogs || [])],
          };
        });
      }
      setProfileReloadKey((prev) => prev + 1);
    },
    [shouldUseHrData]
  );

  // Leave request modal state
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  // Emergency contact edit state
  const [ecEditing, setEcEditing] = useState(false);
  const [ecValue, setEcValue] = useState("");
  const [ecSaving, setEcSaving] = useState(false);
  const [ecError, setEcError] = useState(null);

  const handleLeaveSubmit = useCallback(async (formData) => {
    setLeaveSubmitting(true);
    try {
      const response = await fetch("/api/profile/leave-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to submit leave request.");
      }
      setLeaveModalOpen(false);
      setProfileReloadKey((prev) => prev + 1);
    } catch (err) {
      console.error("Leave request error:", err);
      alert(err.message || "Failed to submit leave request.");
    } finally {
      setLeaveSubmitting(false);
    }
  }, []);

  const handleStartEcEdit = useCallback(() => {
    setEcValue(profile?.emergencyContact || "");
    setEcError(null);
    setEcEditing(true);
  }, [profile?.emergencyContact]);

  const handleSaveEc = useCallback(async () => {
    setEcSaving(true);
    setEcError(null);
    try {
      const response = await fetch("/api/profile/emergency-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emergencyContact: ecValue.trim() }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to update emergency contact.");
      }
      setUserProfileData((prev) => {
        if (!prev?.profile) return prev;
        return {
          ...prev,
          profile: { ...prev.profile, emergencyContact: ecValue.trim() || "Not provided" },
        };
      });
      setEcEditing(false);
    } catch (err) {
      setEcError(err.message || "Failed to update.");
    } finally {
      setEcSaving(false);
    }
  }, [ecValue]);

  const profileStaffVehicles = useMemo(() => {
    if (!profile?.userId) return [];
    return staffVehicles.filter((vehicle) => vehicle.userId === profile.userId);
  }, [profile?.userId, staffVehicles]);

  const isLoading = shouldUseHrData ? hrLoading : userProfileLoading;
  const error = shouldUseHrData ? hrError : userProfileError;

  if (!user && !session?.user && !previewUserParam) {
    const fallback = (
      <div style={{ padding: "24px", color: "var(--text-secondary)" }}>
        You need to be signed in to view your profile.
      </div>
    );
    return isEmbedded ? fallback : <Layout>{fallback}</Layout>;
  }

  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: isEmbedded ? "0" : "16px 14px 32px",
        background: "var(--background)",
        color: "var(--text-primary)",
        minHeight: "100%",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "18px" }}>
        <header style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                {profile ? profile.name : activeUserName || "My Profile"}
              </h1>
              <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.95rem" }}>
                Personal dashboard with employment details, attendance, overtime, and leave summary.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                border: `1px solid ${isDark ? "var(--border)" : "var(--primary)"}`,
                background: isDark ? "var(--surface-light)" : "var(--primary)",
                color: isDark ? "var(--text-primary)" : "var(--text-inverse)",
                fontWeight: 600,
                fontSize: "0.82rem",
                transition: "background 0.2s ease, color 0.2s ease",
              }}
              aria-label="Cycle theme"
            >
              {themeLabel}
            </button>
          </div>
          {isAdminPreview && profile && (
            <div
              style={{
                background: "rgba(var(--info-rgb), 0.08)",
                color: "var(--text-primary)",
                padding: "10px 14px",
                borderRadius: "12px",
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
            <section
              style={{
                display: "grid",
                gap: "12px",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              }}
            >
              <KpiCard
                icon="ðŸ•’"
                label="Total Hours (logged)"
                primary={`${aggregatedStats?.totalHours?.toFixed(1) ?? "0.0"}`}
                accentColor="var(--accent-purple)"
              />
              {isAdminOrManager && (
                <KpiCard
                  icon="ðŸ’·"
                  label="Hourly Rate"
                  primary={formatCurrency(profile.hourlyRate ?? 0)}
                  accentColor="var(--success)"
                />
              )}
              <KpiCard
                icon="â±ï¸"
                label="Overtime Hours"
                primary={`${aggregatedStats?.overtimeHours ?? 0}`}
                secondary={
                  aggregatedStats?.overtimeHours
                    ? `Balance ${formatCurrency(aggregatedStats.overtimeBalance)}`
                    : "Balance Â£0.00"
                }
                accentColor="var(--danger)"
              />
              <KpiCard
                icon="ðŸ–ï¸"
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
            </section>

            <section
              style={{
                display: "grid",
                gap: "16px",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              }}
            >
              <ProfileCard
                title="Leave Summary"
                action={
                  <button
                    type="button"
                    onClick={() => setLeaveModalOpen(true)}
                    style={buttonStyleLeaveRequest}
                  >
                    Request leave
                  </button>
                }
                style={{
                  background: "var(--surface)",
                }}
              >
                <div style={{ display: "grid", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                      Entitlement
                    </span>
                    <span style={{ fontWeight: 700 }}>{aggregatedStats?.leaveEntitlement ?? "-"} days</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>Taken</span>
                    <span style={{ fontWeight: 600 }}>{aggregatedStats?.leaveTaken ?? "-"} days</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                      Remaining
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--success)" }}>
                      {aggregatedStats?.leaveRemaining ?? "-"} days
                    </span>
                  </div>
                </div>
              </ProfileCard>
              <LeaveRequestModal
                isOpen={leaveModalOpen}
                onClose={() => setLeaveModalOpen(false)}
                onSubmit={handleLeaveSubmit}
                isSubmitting={leaveSubmitting}
              />

              <ProfileCard
                title="Emergency Contact"
                action={
                  <div style={{ display: "flex", gap: "8px" }}>
                    {!ecEditing && (
                      <button
                        type="button"
                        onClick={handleStartEcEdit}
                        style={secondaryButtonStyle}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                }
                style={{
                  background: "var(--surface)",
                }}
              >
                {ecEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                        Emergency Contact
                      </label>
                      <input
                        type="text"
                        value={ecValue}
                        onChange={(e) => {
                          setEcValue(e.target.value);
                          setEcError(null);
                        }}
                        placeholder="Name, phone, relationship"
                        style={inputStyle}
                      />
                    </div>
                    {ecError && <div style={{ color: "var(--danger)", fontSize: "0.82rem" }}>{ecError}</div>}
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => setEcEditing(false)} style={ghostButtonStyle}>
                        Cancel
                      </button>
                      <button type="button" onClick={handleSaveEc} disabled={ecSaving} style={primaryButtonStyle}>
                        {ecSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    <div style={labelValueRowStyle}>
                      <span style={labelStyle}>Name</span>
                      <span style={valueStyle}>{emergencyParts.name}</span>
                    </div>
                    <div style={labelValueRowStyle}>
                      <span style={labelStyle}>Phone</span>
                      <span style={valueStyle}>{emergencyParts.phone}</span>
                    </div>
                    <div style={labelValueRowStyle}>
                      <span style={labelStyle}>Relationship</span>
                      <span style={valueStyle}>{emergencyParts.relationship}</span>
                    </div>
                    <div style={labelValueRowStyle}>
                      <span style={labelStyle}>Address</span>
                      <span style={valueStyle}>{profile?.address || "No address on file"}</span>
                    </div>
                  </div>
                )}
              </ProfileCard>
            </section>

            <ProfileCard
              title="Attendance History"
              style={{
                background: "var(--surface)",
              }}
              action={
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--accent-purple)",
                    background: "rgba(var(--accent-purple-rgb), 0.12)",
                    padding: "6px 10px",
                    borderRadius: "999px",
                  }}
                >
                  Log Overtime
                </span>
              }
            >
              <div
                style={{
                  background: "rgba(var(--accent-purple-rgb), 0.08)",
                  borderRadius: "14px",
                  padding: "14px",
                  border: "1px solid rgba(var(--accent-purple-rgb), 0.2)",
                }}
              >
                <OvertimeLogForm onSessionSaved={handleOvertimeSessionSaved} userId={dbUserId} />
              </div>

              <div style={{ maxHeight: "490px", overflowY: "auto", marginTop: "10px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.72rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        position: "sticky",
                        top: 0,
                        background: "var(--surface)",
                        zIndex: 1,
                      }}
                    >
                      <th style={{ textAlign: "left", padding: "10px 0" }}>Date</th>
                      <th style={{ textAlign: "center", padding: "10px 0" }}>Start</th>
                      <th style={{ textAlign: "center", padding: "10px 0" }}>End</th>
                      <th style={{ textAlign: "center", padding: "10px 0" }}>Total Hours</th>
                      <th style={{ textAlign: "center", padding: "10px 0" }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(aggregatedStats?.attendanceRecords ?? []).map((entry) => {
                      const nextDay = isNextDayClocking(entry.clockIn, entry.clockOut);
                      return (
                        <tr key={entry.id} style={{ borderTop: "1px solid rgba(var(--accent-purple-rgb), 0.18)" }}>
                          <td style={{ padding: "12px 0", fontWeight: 600 }}>{formatDate(entry.date)}</td>
                          <td style={{ textAlign: "center", padding: "12px 0" }}>{formatTime(entry.clockIn)}</td>
                          <td style={{ textAlign: "center", padding: "12px 0" }}>
                            {entry.clockOut ? formatTime(entry.clockOut) : "-"}
                            {nextDay && (
                              <span style={{ fontSize: "0.7rem", color: "var(--warning)", marginLeft: "4px" }}>+1d</span>
                            )}
                          </td>
                          <td style={{ textAlign: "center", padding: "12px 0" }}>
                            {nextDay ? (
                              <span style={{ color: "var(--warning)", fontWeight: 600 }}>Next Day</span>
                            ) : (
                              `${Number(entry.totalHours ?? 0).toFixed(2)} hrs`
                            )}
                          </td>
                          <td style={{ textAlign: "center", padding: "12px 0" }}>
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
                    {(aggregatedStats?.attendanceRecords ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: "16px 0", color: "var(--text-secondary)", textAlign: "center" }}>
                          No records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </ProfileCard>

            {profile && <StaffVehiclesCard userId={profile.userId} vehicles={profileStaffVehicles} />}
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

  return isEmbedded ? content : <Layout contentBackground="var(--background)">{content}</Layout>;
}

export default function ProfilePageWrapper(props) {
  return <ProfilePage {...props} />;
}

const buttonStyleLeaveRequest = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--accent-purple)",
  background: "var(--accent-purple)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.85rem",
};

const secondaryButtonStyle = {
  padding: "6px 14px",
  borderRadius: "10px",
  border: "1px solid var(--accent-purple)",
  background: "transparent",
  color: "var(--accent-purple)",
  fontWeight: 600,
  fontSize: "0.82rem",
  cursor: "pointer",
};

const primaryButtonStyle = {
  padding: "8px 16px",
  borderRadius: "10px",
  border: "none",
  background: "var(--accent-purple)",
  color: "white",
  fontWeight: 600,
  fontSize: "0.82rem",
  cursor: "pointer",
};

const ghostButtonStyle = {
  padding: "8px 16px",
  borderRadius: "10px",
  border: "1px solid var(--border, #ccc)",
  background: "transparent",
  color: "var(--text-secondary)",
  fontWeight: 600,
  fontSize: "0.82rem",
  cursor: "pointer",
};

const inputStyle = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--border, #ccc)",
  background: "var(--background)",
  color: "var(--text-primary)",
  fontSize: "0.9rem",
};

const labelValueRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  fontSize: "0.9rem",
  alignItems: "center",
};

const labelStyle = {
  color: "var(--text-secondary)",
  fontWeight: 600,
};

const valueStyle = {
  color: "var(--text-primary)",
  fontWeight: 600,
};


