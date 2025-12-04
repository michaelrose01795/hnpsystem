// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/profile/index.js
import React, { useMemo } from "react"; // React for UI and memoization
import { useRouter } from "next/router"; // Next.js router for query params
import Layout from "@/components/Layout"; // shared layout wrapper
import { useUser } from "@/context/UserContext"; // Keycloak user context
import { useHrOperationsData } from "@/hooks/useHrData"; // Supabase-backed HR aggregation hook
import { SectionCard, StatusTag, MetricCard } from "@/components/HR/MetricCard"; // HR UI components
import OvertimeEntriesEditor from "@/components/HR/OvertimeEntriesEditor"; // overtime editor widget
import StaffVehiclesCard from "@/components/HR/StaffVehiclesCard";
import { useTheme } from "@/styles/themeProvider";

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
  const { user } = useUser(); // Keycloak session details
  const { data, isLoading, error } = useHrOperationsData(); // hydrate profile widgets with HR data
  const { isDark, toggleTheme } = useTheme();

  const previewUserParam =
    forcedUserName || (typeof router.query.user === "string" ? router.query.user : null); // preview override
  const isEmbeddedQuery = router.query.embedded === "1"; // check embed flag
  const isEmbedded = embeddedOverride ?? isEmbeddedQuery; // final embed state
  const isAdminPreviewQuery = router.query.adminPreview === "1"; // admin preview flag
  const isAdminPreview = adminPreviewOverride ?? isAdminPreviewQuery; // final admin preview state

  const employeeDirectory = data?.employeeDirectory ?? []; // employees with job data
  const attendanceLogs = data?.attendanceLogs ?? []; // clocking records
  const overtimeSummaries = data?.overtimeSummaries ?? []; // overtime totals
  const leaveBalances = data?.leaveBalances ?? []; // leave usage
  const staffVehicles = data?.staffVehicles ?? [];
  const activeUserName = previewUserParam || user?.username || null; // active username resolution

  const hrProfile = useMemo(() => {
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

  // ⚠️ Mock data found — replacing with Supabase query
  // ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)
  const profile = hrProfile;

  const aggregatedStats = useMemo(() => {
    if (!profile) return null; // bail if profile missing

    const attendanceSource = attendanceLogs.filter((entry) => entry.employeeId === profile.id);
    const overtimeSource = overtimeSummaries.find((entry) => entry.employee === profile.name) ?? null;
    const leaveSource = leaveBalances.find((entry) => entry.employee === profile.name) ?? null;

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
  }, [attendanceLogs, leaveBalances, overtimeSummaries, profile]);

  const initialOvertimeEntries = useMemo(() => {
    if (!aggregatedStats?.overtimeSummary) return []; // default empty array
    const summary = aggregatedStats.overtimeSummary; // shorthand
    return [
      {
        id: summary.id,
        date: summary.periodEnd,
        start: "18:00",
        end: "20:00",
        totalHours: Number(summary.overtimeHours ?? 0),
      },
    ]; // placeholder entry for editor
  }, [aggregatedStats]);

  const profileStaffVehicles = useMemo(() => {
    if (!profile?.userId) return [];
    return staffVehicles.filter((vehicle) => vehicle.userId === profile.userId);
  }, [profile?.userId, staffVehicles]);

  if (!user && !previewUserParam) {
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
          >
            {isDark ? "Light mode" : "Dark mode"}
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
        <SectionCard title="Loading profile" subtitle="Fetching HR records for this account.">
          <span style={{ color: "var(--info)" }}>
            Retrieving the latest profile data from Supabase…
          </span>
        </SectionCard>
      )}

      {error && (
        <SectionCard title="Failed to load profile data" subtitle="Mock API returned an error.">
          <span style={{ color: "var(--danger)" }}>{error.message}</span>
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
            <MetricCard
              icon="💷"
              label="Hourly Rate"
              primary={formatCurrency(profile.hourlyRate ?? 0)}
              accentColor="var(--success)"
            />
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
                entries={initialOvertimeEntries}
                employeeName={profile.name}
                hourlyRate={profile.hourlyRate}
                overtimeSummary={aggregatedStats?.overtimeSummary}
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
