// file location: src/pages/profile/index.js
import React, { useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { useUser } from "../../context/UserContext";
import { useHrMockData } from "../../hooks/useHrData";
import { SectionCard, StatusTag, MetricCard } from "../../components/HR/MetricCard";
import OvertimeEntriesEditor from "../../components/HR/OvertimeEntriesEditor";
import { confirmationUsers, getConfirmationUser } from "../../config/users";

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function formatCurrency(value) {
  return `£${Number(value ?? 0).toFixed(2)}`;
}

export default function MyProfile() {
  const router = useRouter();
  const { user } = useUser();
  const { data, isLoading, error } = useHrMockData();

  const previewUserParam = typeof router.query.user === "string" ? router.query.user : null;
  const isEmbedded = router.query.embedded === "1";
  const isAdminPreview = router.query.adminPreview === "1";

  const employeeDirectory = data?.employeeDirectory ?? [];
  const attendanceLogs = data?.attendanceLogs ?? [];
  const overtimeSummaries = data?.overtimeSummaries ?? [];
  const leaveBalances = data?.leaveBalances ?? [];
  const activeUserName = previewUserParam || user?.username || null;

  const hrProfile = useMemo(() => {
    if (!activeUserName || employeeDirectory.length === 0) return null;
    const username = activeUserName.toLowerCase();

    return (
      employeeDirectory.find(
        (employee) =>
          employee.keycloakId?.toLowerCase() === username ||
          employee.email?.toLowerCase() === username ||
          employee.name?.toLowerCase() === username
      ) ?? null
    );
  }, [activeUserName, employeeDirectory]);

  const fallbackProfile = useMemo(() => {
    if (hrProfile || !activeUserName) return null;
    return buildPlaceholderProfile(activeUserName);
  }, [activeUserName, hrProfile]);

  const profile = hrProfile || fallbackProfile;

  const aggregatedStats = useMemo(() => {
    if (!profile) return null;

    const attendanceSource = hrProfile
      ? attendanceLogs.filter((entry) => entry.employeeId === profile.id)
      : fallbackProfile?.attendanceRecords || [];

    const overtimeSource = hrProfile
      ? overtimeSummaries.find((entry) => entry.employee === profile.name) ?? null
      : fallbackProfile?.overtimeSummary ?? null;

    const leaveSource = hrProfile
      ? leaveBalances.find((entry) => entry.employee === profile.name) ?? null
      : fallbackProfile?.leaveSummary ?? null;

    const totalHours = attendanceSource.reduce(
      (sum, entry) => sum + Number(entry.totalHours ?? 0),
      0
    );

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
    };
  }, [attendanceLogs, leaveBalances, overtimeSummaries, profile, hrProfile, fallbackProfile]);

  const initialOvertimeEntries = useMemo(() => {
    if (!aggregatedStats?.overtimeSummary) return [];
    const summary = aggregatedStats.overtimeSummary;
    return [
      {
        id: summary.id,
        date: summary.periodEnd,
        start: "18:00",
        end: "20:00",
        totalHours: Number(summary.overtimeHours ?? 0),
      },
    ];
  }, [aggregatedStats]);

  if (!user && !previewUserParam) {
    const fallback = (
      <div style={{ padding: "24px", color: "#6B7280" }}>
        You need to be signed in to view your profile.
      </div>
    );
    return isEmbedded ? fallback : <Layout>{fallback}</Layout>;
  }

  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: isEmbedded ? "0" : "8px 8px 32px" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111827" }}>
          {profile ? profile.name : activeUserName || "My Profile"}
        </h1>
          <p style={{ color: "#6B7280" }}>
            Personal dashboard with employment details, attendance, overtime, and leave summary.
          </p>
          {isAdminPreview && profile && (
            <div
              style={{
                background: "rgba(31, 41, 55, 0.08)",
                color: "#111827",
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
          <SectionCard title="Loading profile" subtitle="Fetching HR records for this account.">
            <span style={{ color: "#6B7280" }}>
              Retrieving placeholder data from the mock HR service…
            </span>
          </SectionCard>
        )}

        {error && (
          <SectionCard title="Failed to load profile data" subtitle="Mock API returned an error.">
            <span style={{ color: "#B91C1C" }}>{error.message}</span>
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
                accentColor="#6366F1"
              />
              <MetricCard
                icon="💷"
                label="Hourly Rate"
                primary={formatCurrency(profile.hourlyRate ?? 0)}
                accentColor="#22C55E"
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
                accentColor="#F97316"
              />
              <MetricCard
                icon="🏖️"
                label="Leave Remaining"
                primary={
                  aggregatedStats?.leaveRemaining !== null
                    ? `${aggregatedStats.leaveRemaining} days`
                    : "N/A"
                }
                secondary={
                  aggregatedStats?.leaveEntitlement !== null
                    ? `${aggregatedStats.leaveTaken} taken / ${aggregatedStats.leaveEntitlement} total`
                    : undefined
                }
                accentColor="#0EA5E9"
              />
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px" }}>
              <SectionCard
                title="Employment Information"
                subtitle={`${profile.jobTitle} • ${profile.department}`}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <ProfileItem label="Role" value={profile.role} />
                  <ProfileItem label="Employment Type" value={profile.employmentType} />
                  <ProfileItem label="Start Date" value={formatDate(profile.startDate)} />
                  <ProfileItem label="Probation End" value={formatDate(profile.probationEnd)} />
                  <ProfileItem label="Contracted Hours" value={`${profile.contractedHours} hrs`} />
                  <ProfileItem label="Hourly Rate" value={formatCurrency(profile.hourlyRate)} />
                  <ProfileItem label="Keycloak Login" value={profile.keycloakId} />
                  <ProfileItem label="Status" value={<StatusTag tone="success" label={profile.status} />} />
                </div>
              </SectionCard>

              <SectionCard title="Contact & Emergency">
                <div style={{ display: "grid", gap: "12px" }}>
                  <ProfileItem label="Email" value={profile.email} />
                  <ProfileItem label="Phone" value={profile.phone} />
                  <ProfileItem label="Emergency Contact" value={profile.emergencyContact} />
                  <ProfileItem label="Address" value={profile.address} />
                </div>
              </SectionCard>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <SectionCard
                title="Recent Attendance"
                subtitle="Clock-in and clock-out history"
                action={
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2563EB" }}>
                    Source: Workshop clocking system
                  </span>
                }
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#6B7280", fontSize: "0.8rem" }}>
                      <th style={{ textAlign: "left", paddingBottom: "10px" }}>Date</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                      <th>Hours</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedStats?.attendanceRecords.slice(0, 7).map((entry) => (
                      <tr key={entry.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                        <td style={{ padding: "12px 0", fontWeight: 600 }}>{formatDate(entry.date)}</td>
                        <td>{entry.clockIn}</td>
                        <td>{entry.clockOut ?? "—"}</td>
                        <td>{Number(entry.totalHours ?? 0).toFixed(1)} hrs</td>
                        <td>
                          <StatusTag
                            label={entry.status}
                            tone={
                              entry.status === "On Time"
                                ? "success"
                                : entry.status === "Overtime"
                                ? "warning"
                                : "default"
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionCard>

              <OvertimeEntriesEditor initialEntries={initialOvertimeEntries} />
            </section>

            <SectionCard title="Documents & Requests" subtitle="Contracts, licences, leave management">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr",
                  gap: "20px",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {profile.documents?.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: "12px",
                        padding: "12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontWeight: 600, color: "#111827" }}>{doc.name}</span>
                        <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                          {doc.type} • Uploaded {formatDate(doc.uploadedOn)}
                        </span>
                      </div>
                      <button
                        type="button"
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid #D1D5DB",
                          background: "white",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                        }}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: "12px",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
                        Leave Request
                      </h3>
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6B7280" }}>
                        Submit annual, parental, or unpaid leave.
                      </p>
                    </div>
                    <label style={labelStyle}>
                      <span>Type</span>
                      <select style={inputStyle} defaultValue="Annual">
                        <option>Annual</option>
                        <option>Sick</option>
                        <option>Unpaid</option>
                        <option>Parental</option>
                      </select>
                    </label>
                    <label style={labelStyle}>
                      <span>Start date</span>
                      <input type="date" style={inputStyle} />
                    </label>
                    <label style={labelStyle}>
                      <span>End date</span>
                      <input type="date" style={inputStyle} />
                    </label>
                    <label style={labelStyle}>
                      <span>Notes</span>
                      <textarea style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} />
                    </label>
                    <button type="button" style={buttonStylePrimary}>
                      Submit request
                    </button>
                  </div>

                  <div
                    style={{
                      border: "1px solid #FECACA",
                      borderRadius: "12px",
                      padding: "12px",
                      background: "#FEF2F2",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#B91C1C" }}>
                        Calling in Sick
                      </h3>
                      <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#991B1B" }}>
                        Notify HR if you’re unable to attend work today.
                      </p>
                    </div>
                    <label style={labelStyle}>
                      <span>Absent on</span>
                      <input type="date" style={inputStyle} defaultValue={new Date().toISOString().slice(0, 10)} />
                    </label>
                    <label style={labelStyle}>
                      <span>Reason / symptoms</span>
                      <textarea style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }} />
                    </label>
                    <button
                      type="button"
                      style={{
                        ...buttonStylePrimary,
                        background: "#DC2626",
                      }}
                    >
                      Report sickness
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          </>
        ) : null}

        {!isLoading && !error && !profile && (
          <SectionCard title="Profile Pending">
            <p style={{ color: "#4B5563", margin: 0 }}>
              We couldn&apos;t find a detailed profile for your account yet. Once HR connects your
              employee record, your stats and documents will appear here automatically.
            </p>
          </SectionCard>
        )}
    </div>
  );
  return isEmbedded ? content : <Layout>{content}</Layout>;
}

function ProfileItem({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#1F2937", fontWeight: 600 }}>{value || "—"}</span>
    </div>
  );
}

function buildPlaceholderProfile(name) {
  const confirmation =
    getConfirmationUser(name) ||
    getConfirmationUser(name?.split(" ")[0]) ||
    confirmationUsers[name] ||
    null;

  if (!confirmation) return null;

  const displayName = confirmation.displayName || confirmation.firstName;
  const primaryRole = confirmation.roles?.[0] || "Team Member";
  const primaryDepartment = confirmation.departments?.[0] || "General";
  const seed = Math.abs(hashCode(displayName));

  return {
    id: `CONF-${displayName}`,
    name: displayName,
    jobTitle: primaryRole,
    department: primaryDepartment,
    role: primaryRole,
    employmentType: "Full-time",
    startDate: "2021-01-04",
    probationEnd: "2021-07-04",
    status: "Active",
    email: `${displayName.replace(/\s+/g, ".").toLowerCase()}@hp.dev`,
    phone: `+44 77${String(seed).padStart(6, "0").slice(0, 6)}`,
    emergencyContact: `${displayName} Contact (+44 77${String(seed + 111111).padStart(6, "0").slice(0, 6)})`,
    address: `${(seed % 50) + 1} Placeholder Way, Leeds, LS1 1AA`,
    contractedHours: 40,
    hourlyRate: 22,
    keycloakId: displayName.toLowerCase(),
    documents: createPlaceholderDocuments(displayName, primaryRole),
    attendanceRecords: createPlaceholderAttendance(displayName),
    overtimeSummary: createPlaceholderOvertime(displayName),
    leaveSummary: createPlaceholderLeave(displayName),
  };
}

function createPlaceholderDocuments(name, role) {
  return [
    { id: `DOC-${name}-1`, name: `${role} Contract`, type: "contract", uploadedOn: "2021-01-04" },
    { id: `DOC-${name}-2`, name: "Driving Licence", type: "licence", uploadedOn: "2023-02-12" },
    { id: `DOC-${name}-3`, name: "Training Certificate", type: "training", uploadedOn: "2023-11-20" },
  ];
}

function createPlaceholderAttendance(name) {
  const baseDate = new Date();
  return Array.from({ length: 5 }).map((_, idx) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() - idx);
    return {
      id: `ATT-${name}-${idx}`,
      employeeId: `CONF-${name}`,
      date: date.toISOString(),
      clockIn: "08:00",
      clockOut: "17:00",
      totalHours: idx === 0 ? 9 : 8,
      status: idx === 0 ? "Overtime" : "On Time",
    };
  });
}

function createPlaceholderOvertime(name) {
  return {
    id: `OT-${name}`,
    employee: name,
    periodStart: "2024-02-26",
    periodEnd: "2024-03-26",
    overtimeHours: 5,
    overtimeRate: 28,
    bonus: 35,
    status: "Ready",
  };
}

function createPlaceholderLeave(name) {
  return {
    employee: name,
    entitlement: 25,
    taken: 4,
    remaining: 21,
  };
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "0.8rem",
  color: "#374151",
  fontWeight: 600,
};

const inputStyle = {
  borderRadius: "10px",
  border: "1px solid #E5E7EB",
  padding: "8px 10px",
  fontWeight: 500,
  color: "#111827",
  background: "#FFFFFF",
};

const buttonStylePrimary = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};
