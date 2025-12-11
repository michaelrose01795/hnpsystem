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
import OvertimeEntriesEditor from "@/components/HR/OvertimeEntriesEditor"; // overtime editor widget
import StaffVehiclesCard from "@/components/HR/StaffVehiclesCard";
import { useTheme } from "@/styles/themeProvider";
import { isHrCoreRole, isManagerScopedRole } from "@/lib/auth/roles"; // Role checking utilities

function formatDate(value) {
  if (!value) return "—"; // guard empty values
  const parsed = new Date(value); // parse raw string
  if (Number.isNaN(parsed.getTime())) return value; // return raw if parsing fails
  return parsed.toLocaleDateString(); // formatted string
}

function formatCurrency(value) {
  return `£${Number(value ?? 0).toFixed(2)}`; // currency helper used across metrics
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
  const overtimeSessions = shouldUseHrData ? [] : (userProfileData?.overtimeSessions ?? []);
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

    const totalHours = attendanceSource.reduce(
      (sum, entry) => sum + Number(entry.totalHours ?? 0),
      0
    ); // accumulate total hours worked

    return {
      totalHours,
      overtimeHours: overtimeSource?.overtimeHours ?? 0,
      overtimeBalance:
        overtimeSource?.overtimeHours && overtimeSource?.overtimeRate
          ? overtimeSource.overtimeHours * overtimeSource.overtimeRate + (overtimeSource.bonus ?? 0)
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
        <SectionCard title="Loading profile" subtitle="Fetching your profile data.">
          <span style={{ color: "var(--info)" }}>
            Retrieving the latest profile data from Supabase…
          </span>
        </SectionCard>
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

          <section
            style={{
              display: "grid",
              gap: "20px",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
            }}
          >
            <SectionCard
              title="Attendance History"
              subtitle="Recent clock-ins and clock-outs"
              action={
                <button type="button" style={buttonStyleSecondary}>
                  Download CSV
                </button>
              }
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                    <th style={{ textAlign: "left", paddingBottom: "10px" }}>Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Total Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedStats?.attendanceRecords.map((entry) => (
                    <tr key={entry.id} style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                      <td style={{ padding: "12px 0", fontWeight: 600 }}>{formatDate(entry.date)}</td>
                      <td>{formatDate(entry.clockIn)}</td>
                      <td>{formatDate(entry.clockOut)}</td>
                      <td>{Number(entry.totalHours ?? 0).toFixed(2)} hrs</td>
                      <td>
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
                  ))}
                </tbody>
              </table>
            </SectionCard>

            <SectionCard
              title="Overtime Summary"
              subtitle="Editable record for adjustments"
            >
              <OvertimeEntriesEditor
                entries={overtimeSessions}
                employeeName={profile.name}
                hourlyRate={profile.hourlyRate}
                overtimeSummary={aggregatedStats?.overtimeSummary}
                canEdit={!shouldUseHrData}
                onSessionSaved={handleOvertimeSessionSaved}
              />
            </SectionCard>
          </section>

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
                <button type="button" style={buttonStyleGhost}>
                  Request leave
                </button>
              }
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--info)", fontSize: "0.8rem" }}>
                    <th style={{ textAlign: "left", paddingBottom: "10px" }}>Entitlement</th>
                    <th>Taken</th>
                    <th>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid var(--accent-purple-surface)" }}>
                    <td style={{ padding: "12px 0", fontWeight: 600 }}>
                      {aggregatedStats?.leaveEntitlement ?? "—"} days
                    </td>
                    <td>{aggregatedStats?.leaveTaken ?? "—"} days</td>
                    <td>{aggregatedStats?.leaveRemaining ?? "—"} days</td>
                  </tr>
                </tbody>
              </table>
            </SectionCard>

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

const linkStyleButton = {
  padding: "6px 12px",
  borderRadius: "999px",
  border: "1px solid var(--accent-purple)",
  color: "var(--accent-purple)",
  fontWeight: 600,
  fontSize: "0.8rem",
  textDecoration: "none",
};
