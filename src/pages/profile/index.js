// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/profile/index.js
import React, { useMemo, useState, useEffect, useCallback } from "react"; // React for UI and memoization
import Link from "next/link";
import { useRouter } from "next/router"; // Next.js router for query params
import { useSession } from "next-auth/react"; // NextAuth session for authentication
import Layout from "@/components/Layout"; // shared layout wrapper
import { useUser } from "@/context/UserContext"; // Keycloak user context
import { useHrOperationsData } from "@/hooks/useHrData"; // Supabase-backed HR aggregation hook (admin only)
import { SectionCard, StatusTag, MetricCard } from "@/components/HR/MetricCard"; // HR UI components
import { CalendarField } from "@/components/calendarAPI";
import { TimePickerField } from "@/components/timePickerAPI";
import StaffVehiclesCard from "@/components/HR/StaffVehiclesCard";
import { useTheme } from "@/styles/themeProvider";
import { isHrCoreRole, isManagerScopedRole } from "@/lib/auth/roles"; // Role checking utilities

function formatDate(value) {
  if (!value) return "—"; // guard empty values
  const parsed = new Date(value); // parse raw string
  if (Number.isNaN(parsed.getTime())) return value; // return raw if parsing fails
  return parsed.toLocaleDateString(); // formatted string
}

function formatTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(value) {
  return `£${Number(value ?? 0).toFixed(2)}`; // currency helper used across metrics
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
        background: "linear-gradient(90deg, var(--surface-light, #e0e0e0) 25%, var(--surface, #f0f0f0) 50%, var(--surface-light, #e0e0e0) 75%)",
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
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        minWidth: "200px",
        flex: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <SkeletonBlock width="32px" height="32px" borderRadius="8px" />
        <SkeletonBlock width="120px" height="16px" />
      </div>
      <SkeletonBlock width="80px" height="32px" borderRadius="6px" />
      <SkeletonBlock width="140px" height="14px" />
    </div>
  );
}

function SkeletonTableRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "12px 0" }}>
          <SkeletonBlock width={i === 0 ? "100px" : "70px"} height="16px" />
        </td>
      ))}
    </tr>
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

  return (
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
          <label style={modalLabelStyle}>
            Leave Type
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              style={modalInputStyle}
            >
              <option value="Holiday">Holiday</option>
              <option value="Sickness">Sickness</option>
              <option value="Unpaid Leave">Unpaid Leave</option>
            </select>
          </label>

          <label style={modalLabelStyle}>
            Start Date
            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              required
              style={modalInputStyle}
            />
          </label>

          <label style={modalLabelStyle}>
            End Date
            <input
              type="date"
              name="endDate"
              value={form.endDate}
              onChange={handleChange}
              required
              style={modalInputStyle}
            />
          </label>

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

          {error && (
            <div style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
            <button type="button" onClick={onClose} style={modalCancelBtnStyle}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} style={{ ...modalSubmitBtnStyle, opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
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

// Simple overtime log form — just date, start, end, and add button
function OvertimeLogForm({ onSessionSaved = () => {} }) {
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

    try {
      const response = await fetch("/api/profile/overtime-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to save overtime session.");
      }

      setForm({ date: "", start: "", end: "" });
      setSuccess("Overtime session logged.");
      onSessionSaved();
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
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "12px",
        alignItems: "end",
      }}
    >
      <CalendarField label="Date" name="date" id="ot-date" value={form.date} onChange={handleChange} />
      <TimePickerField label="Start time" name="start" value={form.start} onChange={handleChange} />
      <TimePickerField label="End time" name="end" value={form.end} onChange={handleChange} />
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
          height: "42px",
          opacity: isSaving ? 0.7 : 1,
        }}
      >
        {isSaving ? "Saving…" : "Add session"}
      </button>
      {error && <div style={{ gridColumn: "1 / -1", color: "var(--danger)", fontSize: "0.85rem" }}>{error}</div>}
      {success && <div style={{ gridColumn: "1 / -1", color: "var(--success)", fontSize: "0.85rem" }}>{success}</div>}
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

        setUserProfileData(payload.data);
        setUserProfileLoading(false);
      } catch (error) {
        if (error.name === "AbortError") return;
        if (!isMounted) return;

        console.error("❌ Failed to fetch user profile:", error);
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

  // ✅ Use appropriate data source based on user role and context
  // If admin viewing another user's profile, use HR data
  // Otherwise, use user's own profile data from /api/profile/me
  const profile = shouldUseHrData ? hrProfile : userProfileData?.profile;

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
      // Admin viewing another user's profile - use HR data
      attendanceSource = attendanceLogs.filter((entry) => entry.employeeId === profile.id || entry.employeeId === profile.name);
      overtimeSource = overtimeSummaries.find((entry) => entry.employee === profile.name || entry.id === profile.userId) ?? null;
      leaveSource = leaveBalances.find((entry) => entry.employee === profile.name) ?? null;
    } else {
      // User viewing own profile - use direct profile data
      attendanceSource = attendanceLogs;
      overtimeSource = userProfileData?.overtimeSummary ?? null;
      leaveSource = userProfileData?.leaveBalance ?? null;
    }

    // Total Hours = today's clock in/out hours only
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format
    const todayRecords = attendanceSource.filter((entry) => {
      if (!entry.date) return false;
      const entryDate = new Date(entry.date).toLocaleDateString("en-CA");
      return entryDate === today;
    });
    const todayHours = todayRecords.reduce(
      (sum, entry) => sum + Number(entry.totalHours ?? 0),
      0
    );

    // Overtime Hours = sum of all records tagged as Overtime in attendance
    const overtimeRecords = attendanceSource.filter((entry) => entry.status === "Overtime");
    const overtimeTotal = overtimeRecords.reduce(
      (sum, entry) => sum + Number(entry.totalHours ?? 0),
      0
    );

    const overtimeRate = overtimeSource?.overtimeRate ?? 0;
    const overtimeBonus = overtimeSource?.bonus ?? 0;

    return {
      totalHours: todayHours,
      overtimeHours: Number(overtimeTotal.toFixed(2)),
      overtimeBalance:
        overtimeTotal && overtimeRate
          ? overtimeTotal * overtimeRate + overtimeBonus
          : 0,
      leaveRemaining: leaveSource?.remaining ?? null,
      leaveEntitlement: leaveSource?.entitlement ?? null,
      leaveTaken: leaveSource?.taken ?? null,
      attendanceRecords: attendanceSource,
      overtimeSummary: overtimeSource,
    }; // data feeding metric tiles and tables
  }, [attendanceLogs, leaveBalances, overtimeSummaries, profile, shouldUseHrData, userProfileData]);

  const handleOvertimeSessionSaved = useCallback(() => {
    if (!shouldUseHrData) {
      setProfileReloadKey((prev) => prev + 1);
    }
  }, [shouldUseHrData]);

  // Leave request modal state
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

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
      // Reload profile to get updated leave balance
      setProfileReloadKey((prev) => prev + 1);
    } catch (err) {
      console.error("❌ Leave request error:", err);
      alert(err.message || "Failed to submit leave request.");
    } finally {
      setLeaveSubmitting(false);
    }
  }, []);

  const profileStaffVehicles = useMemo(() => {
    if (!profile?.userId) return [];
    return staffVehicles.filter((vehicle) => vehicle.userId === profile.userId);
  }, [profile?.userId, staffVehicles]);

  // Determine loading and error states based on data source
  const isLoading = shouldUseHrData ? hrLoading : userProfileLoading;
  const error = shouldUseHrData ? hrError : userProfileError;

  // Authentication check
  if (!user && !session?.user && !previewUserParam) {
    const fallback = (
      <div style={{ padding: "24px", color: "var(--text-secondary)" }}>
        You need to be signed in to view your profile.
      </div>
    ); // simple sign-in prompt
    return isEmbedded ? fallback : <Layout>{fallback}</Layout>; // embed aware fallback
  }

  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        padding: isEmbedded ? "0" : "8px 8px 32px",
        background: "var(--background)",
        color: "var(--text-primary)",
        minHeight: "100%",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            {profile ? profile.name : activeUserName || "My Profile"}
          </h1>
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
              fontSize: "0.9rem",
              transition: "background 0.2s ease, color 0.2s ease",
            }}
            aria-label="Cycle theme"
          >
            {themeLabel}
          </button>
        </div>
        <p style={{ color: "var(--text-secondary)" }}>
          Personal dashboard with employment details, attendance, overtime, and leave summary.
        </p>
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
            Admin previewing {profile.name}&#39;s profile
          </div>
        )}
      </header>

      {isLoading && (
        <>
          <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
          <section
            style={{
              display: "grid",
              gap: "18px",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
          </section>
          <SectionCard title="Attendance History" subtitle="Loading...">
            <SkeletonBlock width="100%" height="48px" borderRadius="10px" />
            <div style={{ marginTop: "12px" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} cols={5} />
              ))}
            </div>
          </SectionCard>
        </>
      )}

      {error && (
        <SectionCard title="Failed to load profile data" subtitle="An error occurred while loading your profile.">
          <span style={{ color: "var(--danger)" }}>{error.message}</span>
          {!shouldUseHrData && (
            <div style={{ marginTop: "12px", color: "var(--text-secondary)" }}>
              If you continue to see this error, please contact HR to ensure your employee profile has been created.
            </div>
          )}
        </SectionCard>
      )}

      {!isLoading && !error && profile ? (
        <>
          <section
            style={{
              display: "grid",
              gap: "18px",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <MetricCard
              icon="🕒"
              label="Total Hours (logged)"
              primary={`${aggregatedStats?.totalHours?.toFixed(1) ?? "0.0"}`}
              accentColor="var(--accent-purple)"
            />
            {/* Only show hourly rate to admin/manager users */}
            {isAdminOrManager && (
              <MetricCard
                icon="💷"
                label="Hourly Rate"
                primary={formatCurrency(profile.hourlyRate ?? 0)}
                accentColor="var(--success)"
              />
            )}
            <MetricCard
              icon="⏱️"
              label="Overtime Hours"
              primary={`${aggregatedStats?.overtimeHours ?? 0}`}
              secondary={
                aggregatedStats?.overtimeHours
                  ? `Balance ${formatCurrency(aggregatedStats.overtimeBalance)}`
                  : "Balance £0.00"
              }
              accentColor="var(--danger)"
            />
            <MetricCard
              icon="🏖️"
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

          <div
            style={{
              background: "var(--surface-light)",
              borderRadius: "16px",
              padding: "20px",
              border: "1px solid var(--border, rgba(0,0,0,0.08))",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--accent-purple)" }}>
                  Attendance History
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--info)", marginTop: "4px" }}>
                  Clock-ins, clock-outs and overtime logs
                </div>
              </div>
              <button type="button" style={buttonStyleSecondary}>
                Download CSV
              </button>
            </div>

            <div style={{ marginBottom: "4px" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "10px" }}>
                Log Overtime
              </div>
              <OvertimeLogForm onSessionSaved={handleOvertimeSessionSaved} />
            </div>

            {/* 10 rows visible then scroll */}
            <div style={{ maxHeight: "490px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--info)", fontSize: "0.8rem", position: "sticky", top: 0, background: "var(--surface-light)", zIndex: 1 }}>
                    <th style={{ textAlign: "left", paddingBottom: "10px" }}>Date</th>
                    <th style={{ textAlign: "center", paddingBottom: "10px" }}>Start</th>
                    <th style={{ textAlign: "center", paddingBottom: "10px" }}>End</th>
                    <th style={{ textAlign: "center", paddingBottom: "10px" }}>Total Hours</th>
                    <th style={{ textAlign: "center", paddingBottom: "10px" }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {(aggregatedStats?.attendanceRecords ?? []).map((entry) => {
                    const nextDay = isNextDayClocking(entry.clockIn, entry.clockOut);
                    return (
                      <tr key={entry.id} style={{ borderTop: "1px solid var(--border, rgba(0,0,0,0.06))" }}>
                        <td style={{ padding: "12px 0", fontWeight: 600 }}>{formatDate(entry.date)}</td>
                        <td style={{ textAlign: "center" }}>{formatTime(entry.clockIn)}</td>
                        <td style={{ textAlign: "center" }}>
                          {entry.clockOut ? formatTime(entry.clockOut) : "—"}
                          {nextDay && (
                            <span style={{ fontSize: "0.7rem", color: "var(--warning)", marginLeft: "4px" }}>+1d</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {nextDay
                            ? <span style={{ color: "var(--warning)", fontWeight: 600 }}>Next Day</span>
                            : `${Number(entry.totalHours ?? 0).toFixed(2)} hrs`
                          }
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <StatusTag
                            label={entry.status}
                            tone={
                              entry.status === "Overtime"
                                ? "warning"
                                : entry.status === "Clocked In"
                                ? "info"
                                : "success"
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
          </div>

          <section
            style={{
              display: "grid",
              gap: "20px",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            }}
          >
            <SectionCard
              title="Leave Summary"
              subtitle="Entitlement vs. taken leave"
              action={
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(true)}
                  style={buttonStyleLeaveRequest}
                >
                  Request leave
                </button>
              }
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                    <th style={{ textAlign: "left", paddingBottom: "10px" }}>Entitlement</th>
                    <th style={{ textAlign: "center", paddingBottom: "10px" }}>Taken</th>
                    <th style={{ textAlign: "center", paddingBottom: "10px" }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                    <td style={{ padding: "12px 0", fontWeight: 600 }}>
                      {aggregatedStats?.leaveEntitlement ?? "—"} days
                    </td>
                    <td style={{ textAlign: "center" }}>{aggregatedStats?.leaveTaken ?? "—"} days</td>
                    <td style={{ textAlign: "center", fontWeight: 600, color: "var(--success)" }}>
                      {aggregatedStats?.leaveRemaining ?? "—"} days
                    </td>
                  </tr>
                </tbody>
              </table>
            </SectionCard>
            <LeaveRequestModal
              isOpen={leaveModalOpen}
              onClose={() => setLeaveModalOpen(false)}
              onSubmit={handleLeaveSubmit}
              isSubmitting={leaveSubmitting}
            />

            <SectionCard
              title="Emergency Contact"
              subtitle="Pulled from HR employee profile"
              action={
                isAdminOrManager ? (
                  <Link href="/hr/manager?tab=employees" style={linkStyleButton}>
                    Manage in HR Manager
                  </Link>
                ) : null
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", color: "var(--info-dark)" }}>
                <span style={{ fontWeight: 600 }}>{profile?.emergencyContact || "Not provided"}</span>
                <span>{profile?.address || "No address on file"}</span>
              </div>
            </SectionCard>
          </section>

          {profile && (
            <StaffVehiclesCard userId={profile.userId} vehicles={profileStaffVehicles} />
          )}
        </>
      ) : null}

      {!isLoading && !error && !profile && (
        <SectionCard title="Profile not found" subtitle="No HR record matches this account.">
          <span style={{ color: "var(--info)" }}>
            Ask HR to create an employee profile or verify your email address is correct.
          </span>
        </SectionCard>
      )}
    </div>
  );

  return isEmbedded ? content : <Layout>{content}</Layout>; // embed aware rendering
}

export default function ProfilePageWrapper(props) {
  return <ProfilePage {...props} />; // default export wrapper for Next.js routing
}
const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--warning)",
  background: "var(--surface)",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleGhost = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--danger)",
  fontWeight: 600,
  cursor: "pointer",
};

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

const linkStyleButton = {
  padding: "6px 12px",
  borderRadius: "999px",
  border: "1px solid var(--accent-purple)",
  color: "var(--accent-purple)",
  fontWeight: 600,
  fontSize: "0.8rem",
  textDecoration: "none",
};
