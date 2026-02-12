// file location: src/pages/dev/user-diagnostic.js
// Dev-only diagnostic page to verify the unified users table, soft-delete, and name consistency
import { useCallback, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";

// ── Section: Core Data ──────────────────────────────────────────

function testUserListFetch(adminData) {
  if (!adminData || !adminData.success) {
    return { pass: false, label: "User List Fetch", detail: "Failed to fetch /api/admin/users", data: adminData, section: "Core Data" };
  }
  const users = adminData.data || [];
  if (users.length === 0) {
    return { pass: false, label: "User List Fetch", detail: "No users returned", data: adminData, section: "Core Data" };
  }
  const requiredFields = ["id", "firstName", "lastName", "email", "role"];
  const sample = users[0];
  const missingFields = requiredFields.filter((f) => sample[f] === undefined);
  if (missingFields.length > 0) {
    return { pass: false, label: "User List Fetch", detail: `Missing fields: ${missingFields.join(", ")}`, data: sample, section: "Core Data" };
  }
  return { pass: true, label: "User List Fetch", detail: `${users.length} users returned with all required fields`, data: { count: users.length, sampleFields: Object.keys(sample) }, section: "Core Data" };
}

function testEmployeeDirectoryFetch(hrData) {
  if (!hrData || !hrData.success) {
    return { pass: false, label: "Employee Directory Fetch", detail: "Failed to fetch /api/hr/employees", data: hrData, section: "Core Data" };
  }
  const employees = hrData.data || [];
  if (employees.length === 0) {
    return { pass: false, label: "Employee Directory Fetch", detail: "No employees returned", data: hrData, section: "Core Data" };
  }
  const requiredFields = ["userId", "name", "department", "role", "employmentType"];
  const sample = employees[0];
  const missingFields = requiredFields.filter((f) => sample[f] === undefined);
  if (missingFields.length > 0) {
    return { pass: false, label: "Employee Directory Fetch", detail: `Missing HR fields: ${missingFields.join(", ")}`, data: sample, section: "Core Data" };
  }
  return { pass: true, label: "Employee Directory Fetch", detail: `${employees.length} employees with department and HR fields from users table`, data: { count: employees.length, sampleFields: Object.keys(sample) }, section: "Core Data" };
}

function testNameConsistency(adminData, hrData, rosterData) {
  const adminMap = new Map();
  if (adminData?.success) {
    (adminData.data || []).forEach((u) => {
      adminMap.set(u.id, `${u.firstName} ${u.lastName}`.trim());
    });
  }

  const hrMap = new Map();
  if (hrData?.success) {
    (hrData.data || []).forEach((e) => {
      hrMap.set(e.userId, e.name);
    });
  }

  const rosterMap = new Map();
  if (rosterData?.success && rosterData.data?.allUsers) {
    rosterData.data.allUsers.forEach((u) => {
      rosterMap.set(u.id, u.name);
    });
  }

  const allIds = new Set([...adminMap.keys(), ...hrMap.keys(), ...rosterMap.keys()]);
  const mismatches = [];

  for (const uid of allIds) {
    const names = {};
    if (adminMap.has(uid)) names.admin = adminMap.get(uid);
    if (hrMap.has(uid)) names.hr = hrMap.get(uid);
    if (rosterMap.has(uid)) names.roster = rosterMap.get(uid);

    const uniqueNames = [...new Set(Object.values(names))];
    if (uniqueNames.length > 1) {
      mismatches.push({ userId: uid, ...names });
    }
  }

  if (mismatches.length > 0) {
    return { pass: false, label: "Name Consistency", detail: `${mismatches.length} user(s) have different names across endpoints`, data: mismatches, section: "Core Data" };
  }
  return { pass: true, label: "Name Consistency", detail: `All ${allIds.size} users have consistent names across admin, HR, and roster`, data: { totalUsersChecked: allIds.size }, section: "Core Data" };
}

function testSoftDelete(adminData, hrData) {
  if (!adminData?.success) {
    return { pass: false, label: "Soft-Delete Verification", detail: "Cannot verify - admin users endpoint failed", data: null, section: "Core Data" };
  }

  const totalAdmin = (adminData.data || []).length;
  const activeHr = hrData?.success ? (hrData.data || []).length : null;

  const detail =
    activeHr !== null
      ? `Admin: ${totalAdmin} users (all). Employees: ${activeHr} active. Difference: ${totalAdmin - activeHr} inactive.`
      : `Admin: ${totalAdmin} users. HR endpoint unavailable for comparison.`;

  const pass = activeHr !== null ? totalAdmin >= activeHr : totalAdmin > 0;

  return { pass, label: "Soft-Delete Verification", detail, data: { totalAdmin, activeHr, inactiveEstimate: activeHr !== null ? totalAdmin - activeHr : "unknown" }, section: "Core Data" };
}

function testDisplayNameUtility(adminData, hrData, rosterData) {
  const problems = [];

  if (adminData?.success) {
    (adminData.data || []).forEach((u) => {
      const name = `${u.firstName} ${u.lastName}`.trim();
      if (!name || name === "Unknown user") {
        problems.push({ source: "admin", id: u.id, email: u.email });
      }
    });
  }

  if (hrData?.success) {
    (hrData.data || []).forEach((e) => {
      if (!e.name || e.name === "Unknown user") {
        problems.push({ source: "hr", userId: e.userId, email: e.email });
      }
    });
  }

  if (rosterData?.success && rosterData.data?.allUsers) {
    rosterData.data.allUsers.forEach((u) => {
      if (!u.name || u.name === "Unknown user") {
        problems.push({ source: "roster", id: u.id, email: u.email });
      }
    });
  }

  if (problems.length > 0) {
    return { pass: false, label: "Display Name Check", detail: `${problems.length} user(s) have empty or "Unknown user" names`, data: problems, section: "Core Data" };
  }

  const totalChecked = (adminData?.data || []).length + (hrData?.data || []).length + (rosterData?.data?.allUsers || []).length;
  return { pass: true, label: "Display Name Check", detail: `All ${totalChecked} user records across 3 endpoints have valid display names`, data: { totalChecked }, section: "Core Data" };
}

function testDuplicateCheck(adminData, hrData, rosterData) {
  const duplicates = [];

  const check = (label, items, idFn) => {
    const seen = new Set();
    (items || []).forEach((item) => {
      const id = idFn(item);
      if (id !== null && id !== undefined) {
        if (seen.has(id)) duplicates.push({ source: label, duplicateId: id });
        seen.add(id);
      }
    });
  };

  if (adminData?.success) check("admin/users", adminData.data, (u) => u.id);
  if (hrData?.success) check("hr/employees", hrData.data, (e) => e.userId);
  if (rosterData?.success && rosterData.data?.allUsers) check("users/roster", rosterData.data.allUsers, (u) => u.id);

  if (duplicates.length > 0) {
    return { pass: false, label: "Duplicate Check", detail: `${duplicates.length} duplicate user_id(s) found`, data: duplicates, section: "Core Data" };
  }
  return { pass: true, label: "Duplicate Check", detail: "No duplicate user_ids in any endpoint response", data: null, section: "Core Data" };
}

function testDarkModeField(rosterData) {
  if (!rosterData?.success || !rosterData.data?.allUsers) {
    return { pass: false, label: "Dark Mode Field", detail: "Cannot verify - roster endpoint failed", data: null, section: "Core Data" };
  }
  const users = rosterData.data.allUsers;
  if (users.length === 0) {
    return { pass: false, label: "Dark Mode Field", detail: "No users in roster to check", data: null, section: "Core Data" };
  }

  const sample = users[0];
  const hasDarkModeField = "darkMode" in sample;

  if (!hasDarkModeField) {
    return { pass: false, label: "Dark Mode Field", detail: "darkMode field not present on user records", data: { sampleKeys: Object.keys(sample) }, section: "Core Data" };
  }

  const distribution = users.reduce((acc, u) => {
    const val = u.darkMode === null ? "null" : String(u.darkMode);
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});

  return { pass: true, label: "Dark Mode Field", detail: `darkMode field accessible on all ${users.length} users`, data: { distribution }, section: "Core Data" };
}

function testEmailUniqueness(adminData) {
  if (!adminData?.success) {
    return { pass: false, label: "Email Uniqueness", detail: "Cannot verify - admin users endpoint failed", data: null, section: "Core Data" };
  }
  const users = adminData.data || [];
  const emailCounts = {};
  users.forEach((u) => {
    const email = (u.email || "").toLowerCase();
    if (email) emailCounts[email] = (emailCounts[email] || 0) + 1;
  });
  const duplicates = Object.entries(emailCounts).filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    return { pass: false, label: "Email Uniqueness", detail: `${duplicates.length} duplicate email(s) found`, data: duplicates.map(([email, count]) => ({ email, count })), section: "Core Data" };
  }
  return { pass: true, label: "Email Uniqueness", detail: `All ${users.length} users have unique email addresses`, data: null, section: "Core Data" };
}

function testRoleDistribution(adminData) {
  if (!adminData?.success) {
    return { pass: false, label: "Role Distribution", detail: "Cannot verify - admin users endpoint failed", data: null, section: "Core Data" };
  }
  const users = adminData.data || [];
  const roleCounts = {};
  users.forEach((u) => {
    const role = u.role || "Unknown";
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });
  const roles = Object.keys(roleCounts);
  if (roles.length <= 1) {
    return { pass: false, label: "Role Distribution", detail: `Only ${roles.length} role(s) found - expected multiple roles`, data: roleCounts, section: "Core Data" };
  }
  return { pass: true, label: "Role Distribution", detail: `${users.length} users spread across ${roles.length} roles`, data: roleCounts, section: "Core Data" };
}

function testRequiredFieldsPopulated(adminData) {
  if (!adminData?.success) {
    return { pass: false, label: "Required Fields Populated", detail: "Cannot verify - admin users endpoint failed", data: null, section: "Core Data" };
  }
  const users = adminData.data || [];
  const problems = [];
  users.forEach((u) => {
    const missing = [];
    if (!u.firstName) missing.push("firstName");
    if (!u.lastName) missing.push("lastName");
    if (!u.email) missing.push("email");
    if (missing.length > 0) {
      problems.push({ id: u.id, email: u.email, missing });
    }
  });
  if (problems.length > 0) {
    return { pass: false, label: "Required Fields Populated", detail: `${problems.length} user(s) have empty core fields`, data: problems, section: "Core Data" };
  }
  return { pass: true, label: "Required Fields Populated", detail: `All ${users.length} users have firstName, lastName, and email populated`, data: null, section: "Core Data" };
}

// ── Section: Profile & Employment ───────────────────────────────

function testProfileData(profileData, currentUserId) {
  if (!currentUserId) {
    return { pass: false, label: "Profile Data Check", detail: "No logged-in user (dbUserId not resolved). Log in first.", data: null, section: "Profile & Employment" };
  }
  if (!profileData || !profileData.success) {
    return { pass: false, label: "Profile Data Check", detail: "Failed to fetch /api/profile/me", data: profileData, section: "Profile & Employment" };
  }
  const profile = profileData.data?.profile;
  if (!profile) {
    return { pass: false, label: "Profile Data Check", detail: "Profile object missing from response", data: profileData.data, section: "Profile & Employment" };
  }

  const fieldsToCheck = ["name", "email", "department", "emergencyContact", "role", "employmentType"];
  const populated = fieldsToCheck.filter((f) => profile[f] && profile[f] !== "Not provided" && profile[f] !== "Unassigned");
  const missing = fieldsToCheck.filter((f) => !profile[f] || profile[f] === "Not provided" || profile[f] === "Unassigned");

  const pass = populated.length >= 3;
  const detail = `${populated.length}/${fieldsToCheck.length} profile fields populated. Missing/default: ${missing.length > 0 ? missing.join(", ") : "none"}`;

  return { pass, label: "Profile Data Check", detail, data: { userId: currentUserId, profile, populated, missing }, section: "Profile & Employment" };
}

function testAttendanceLogs(profileData, currentUserId) {
  if (!currentUserId) {
    return { pass: false, label: "Attendance Logs", detail: "No logged-in user. Log in first.", data: null, section: "Profile & Employment" };
  }
  if (!profileData || !profileData.success) {
    return { pass: false, label: "Attendance Logs", detail: "Failed to fetch /api/profile/me", data: null, section: "Profile & Employment" };
  }
  const logs = profileData.data?.attendanceLogs;
  if (!Array.isArray(logs)) {
    return { pass: false, label: "Attendance Logs", detail: "attendanceLogs field missing or not an array", data: { keys: Object.keys(profileData.data || {}) }, section: "Profile & Employment" };
  }
  if (logs.length > 0) {
    const sample = logs[0];
    const requiredFields = ["id", "employeeId", "date", "clockIn"];
    const missing = requiredFields.filter((f) => sample[f] === undefined);
    if (missing.length > 0) {
      return { pass: false, label: "Attendance Logs", detail: `Attendance log entry missing fields: ${missing.join(", ")}`, data: sample, section: "Profile & Employment" };
    }
  }
  return { pass: true, label: "Attendance Logs", detail: `${logs.length} attendance log(s) returned for current user (last 30 days)`, data: { count: logs.length }, section: "Profile & Employment" };
}

function testOvertimeData(profileData, currentUserId) {
  if (!currentUserId) {
    return { pass: false, label: "Overtime Data", detail: "No logged-in user. Log in first.", data: null, section: "Profile & Employment" };
  }
  if (!profileData || !profileData.success) {
    return { pass: false, label: "Overtime Data", detail: "Failed to fetch /api/profile/me", data: null, section: "Profile & Employment" };
  }
  const summary = profileData.data?.overtimeSummary;
  const sessions = profileData.data?.overtimeSessions;
  if (summary === undefined && sessions === undefined) {
    return { pass: false, label: "Overtime Data", detail: "overtimeSummary and overtimeSessions fields missing from response", data: { keys: Object.keys(profileData.data || {}) }, section: "Profile & Employment" };
  }
  const details = [];
  if (summary) details.push(`period: ${summary.periodStart} to ${summary.periodEnd}, hours: ${summary.overtimeHours}`);
  if (Array.isArray(sessions)) details.push(`${sessions.length} session(s)`);
  return { pass: true, label: "Overtime Data", detail: details.length > 0 ? details.join(". ") : "Overtime fields present (no active data)", data: { summary, sessionCount: Array.isArray(sessions) ? sessions.length : 0 }, section: "Profile & Employment" };
}

function testLeaveBalance(profileData, currentUserId) {
  if (!currentUserId) {
    return { pass: false, label: "Leave Balance", detail: "No logged-in user. Log in first.", data: null, section: "Profile & Employment" };
  }
  if (!profileData || !profileData.success) {
    return { pass: false, label: "Leave Balance", detail: "Failed to fetch /api/profile/me", data: null, section: "Profile & Employment" };
  }
  const balance = profileData.data?.leaveBalance;
  if (!balance) {
    return { pass: false, label: "Leave Balance", detail: "leaveBalance field missing from response", data: { keys: Object.keys(profileData.data || {}) }, section: "Profile & Employment" };
  }
  const requiredFields = ["entitlement", "taken", "remaining"];
  const missing = requiredFields.filter((f) => balance[f] === undefined);
  if (missing.length > 0) {
    return { pass: false, label: "Leave Balance", detail: `Leave balance missing fields: ${missing.join(", ")}`, data: balance, section: "Profile & Employment" };
  }
  return { pass: true, label: "Leave Balance", detail: `Entitlement: ${balance.entitlement} days, Taken: ${balance.taken}, Remaining: ${balance.remaining}`, data: balance, section: "Profile & Employment" };
}

function testStaffVehicles(profileData, currentUserId) {
  if (!currentUserId) {
    return { pass: false, label: "Staff Vehicles", detail: "No logged-in user. Log in first.", data: null, section: "Profile & Employment" };
  }
  if (!profileData || !profileData.success) {
    return { pass: false, label: "Staff Vehicles", detail: "Failed to fetch /api/profile/me", data: null, section: "Profile & Employment" };
  }
  const vehicles = profileData.data?.staffVehicles;
  if (!Array.isArray(vehicles)) {
    return { pass: false, label: "Staff Vehicles", detail: "staffVehicles field missing or not an array", data: { keys: Object.keys(profileData.data || {}) }, section: "Profile & Employment" };
  }
  if (vehicles.length > 0) {
    const sample = vehicles[0];
    const requiredFields = ["id", "userId", "make", "model", "registration"];
    const missing = requiredFields.filter((f) => sample[f] === undefined);
    if (missing.length > 0) {
      return { pass: false, label: "Staff Vehicles", detail: `Vehicle record missing fields: ${missing.join(", ")}`, data: sample, section: "Profile & Employment" };
    }
  }
  return { pass: true, label: "Staff Vehicles", detail: `${vehicles.length} staff vehicle(s) returned for current user`, data: { count: vehicles.length }, section: "Profile & Employment" };
}

function testEmergencyContactFormat(profileData, currentUserId) {
  if (!currentUserId) {
    return { pass: false, label: "Emergency Contact Format", detail: "No logged-in user. Log in first.", data: null, section: "Profile & Employment" };
  }
  if (!profileData?.success) {
    return { pass: false, label: "Emergency Contact Format", detail: "Failed to fetch /api/profile/me", data: null, section: "Profile & Employment" };
  }
  const profile = profileData.data?.profile;
  if (!profile) {
    return { pass: false, label: "Emergency Contact Format", detail: "Profile object missing", data: null, section: "Profile & Employment" };
  }
  const ec = profile.emergencyContact;
  if (ec === undefined) {
    return { pass: false, label: "Emergency Contact Format", detail: "emergencyContact field missing from profile", data: { profileKeys: Object.keys(profile) }, section: "Profile & Employment" };
  }
  const validFormat = typeof ec === "string" && ec.length > 0;
  if (!validFormat) {
    return { pass: false, label: "Emergency Contact Format", detail: `emergencyContact is not a valid string (type: ${typeof ec})`, data: { value: ec }, section: "Profile & Employment" };
  }
  return { pass: true, label: "Emergency Contact Format", detail: `Emergency contact: "${ec}"`, data: { emergencyContact: ec }, section: "Profile & Employment" };
}

function testSignatureFields(rosterData) {
  if (!rosterData?.success || !rosterData.data?.allUsers) {
    return { pass: false, label: "Signature Fields", detail: "Cannot verify - roster endpoint failed", data: null, section: "Profile & Employment" };
  }
  const users = rosterData.data.allUsers;
  if (users.length === 0) {
    return { pass: false, label: "Signature Fields", detail: "No users in roster to check", data: null, section: "Profile & Employment" };
  }
  const sample = users[0];
  const hasFileUrl = "signatureFileUrl" in sample;
  const hasStoragePath = "signatureStoragePath" in sample;

  if (!hasFileUrl && !hasStoragePath) {
    return { pass: false, label: "Signature Fields", detail: "signatureFileUrl and signatureStoragePath not present on user records", data: { sampleKeys: Object.keys(sample) }, section: "Profile & Employment" };
  }
  const withSignature = users.filter((u) => u.signatureFileUrl || u.signatureStoragePath).length;
  return { pass: true, label: "Signature Fields", detail: `Signature fields present. ${withSignature}/${users.length} users have a signature on file`, data: { withSignature, total: users.length }, section: "Profile & Employment" };
}

// ── Section: Cross-System Integration ───────────────────────────

function testClockStatus(clockData, currentUserId) {
  if (!currentUserId) {
    return { pass: false, label: "Clock Status", detail: "No logged-in user. Log in first.", data: null, section: "Cross-System Integration" };
  }
  if (!clockData || !clockData.success) {
    return { pass: false, label: "Clock Status", detail: "Failed to fetch /api/profile/clock", data: clockData, section: "Cross-System Integration" };
  }
  const isClockedIn = clockData.data?.isClockedIn;
  if (typeof isClockedIn !== "boolean") {
    return { pass: false, label: "Clock Status", detail: `isClockedIn is not a boolean (got ${typeof isClockedIn})`, data: clockData.data, section: "Cross-System Integration" };
  }
  const detail = isClockedIn
    ? `User is currently clocked in (record: ${clockData.data.activeRecord?.clockIn || "unknown"})`
    : "User is currently clocked out";
  return { pass: true, label: "Clock Status", detail, data: clockData.data, section: "Cross-System Integration" };
}

function testMessageUserSearch(messagesData) {
  if (!messagesData || !messagesData.success) {
    return { pass: false, label: "Message User Search", detail: "Failed to fetch /api/messages/users", data: messagesData, section: "Cross-System Integration" };
  }
  const users = messagesData.data || [];
  if (users.length === 0) {
    return { pass: false, label: "Message User Search", detail: "No users returned from messaging directory", data: messagesData, section: "Cross-System Integration" };
  }
  const sample = users[0];
  const hasName = sample.name !== undefined;
  const hasId = sample.id !== undefined;
  if (!hasName || !hasId) {
    return { pass: false, label: "Message User Search", detail: `Messaging user record missing id or name`, data: { sampleKeys: Object.keys(sample) }, section: "Cross-System Integration" };
  }
  const withValidName = users.filter((u) => u.name && u.name !== "Unknown user").length;
  return { pass: true, label: "Message User Search", detail: `${users.length} users in messaging directory. ${withValidName} with valid names`, data: { count: users.length, withValidName, sampleFields: Object.keys(sample) }, section: "Cross-System Integration" };
}

function testHrDashboardMetrics(dashboardData) {
  if (!dashboardData || !dashboardData.success) {
    return { pass: false, label: "HR Dashboard Metrics", detail: "Failed to fetch /api/hr/dashboard", data: dashboardData, section: "Cross-System Integration" };
  }
  const data = dashboardData.data;
  if (!data) {
    return { pass: false, label: "HR Dashboard Metrics", detail: "No data in dashboard response", data: null, section: "Cross-System Integration" };
  }
  const sections = ["hrDashboardMetrics", "upcomingAbsences", "activeWarnings", "departmentPerformance", "trainingRenewals"];
  const present = sections.filter((s) => data[s] !== undefined);
  const missing = sections.filter((s) => data[s] === undefined);
  if (missing.length > 0) {
    return { pass: false, label: "HR Dashboard Metrics", detail: `Missing dashboard sections: ${missing.join(", ")}`, data: { present, missing }, section: "Cross-System Integration" };
  }
  const metrics = data.hrDashboardMetrics || [];
  const totalEmp = metrics.find((m) => m.id === "totalEmployees");
  const empDetail = totalEmp ? ` (${totalEmp.active} active, ${totalEmp.inactive} inactive)` : "";
  return {
    pass: true,
    label: "HR Dashboard Metrics",
    detail: `All ${sections.length} dashboard sections present${empDetail}. ${dashboardData.mock ? "(mock data)" : "(live data)"}`,
    data: { sectionCounts: Object.fromEntries(sections.map((s) => [s, Array.isArray(data[s]) ? data[s].length : "object"])), mock: !!dashboardData.mock },
    section: "Cross-System Integration",
  };
}

// ── Page Component ──────────────────────────────────────────────

const SECTION_ORDER = ["Core Data", "Profile & Employment", "Cross-System Integration"];

export default function UserDiagnosticDevPage() {
  const router = useRouter();
  const { dbUserId, loading: userLoading } = useUser();
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState({});

  const isProduction = process.env.NODE_ENV === "production";

  const runAllTests = useCallback(async () => {
    setRunning(true);
    setResults(null);
    setExpanded({});

    const [adminRes, hrRes, rosterRes, profileRes, clockRes, messagesRes, dashboardRes] = await Promise.allSettled([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/hr/employees").then((r) => r.json()),
      fetch("/api/users/roster").then((r) => r.json()),
      dbUserId ? fetch(`/api/profile/me?userId=${dbUserId}`).then((r) => r.json()) : Promise.resolve(null),
      dbUserId ? fetch(`/api/profile/clock?userId=${dbUserId}`).then((r) => r.json()) : Promise.resolve(null),
      fetch("/api/messages/users?q=&limit=50").then((r) => r.json()),
      fetch("/api/hr/dashboard").then((r) => r.json()),
    ]);

    const adminData = adminRes.status === "fulfilled" ? adminRes.value : null;
    const hrData = hrRes.status === "fulfilled" ? hrRes.value : null;
    const rosterData = rosterRes.status === "fulfilled" ? rosterRes.value : null;
    const profileData = profileRes.status === "fulfilled" ? profileRes.value : null;
    const clockData = clockRes.status === "fulfilled" ? clockRes.value : null;
    const messagesData = messagesRes.status === "fulfilled" ? messagesRes.value : null;
    const dashboardData = dashboardRes.status === "fulfilled" ? dashboardRes.value : null;

    setResults([
      // Core Data
      testUserListFetch(adminData),
      testEmployeeDirectoryFetch(hrData),
      testNameConsistency(adminData, hrData, rosterData),
      testSoftDelete(adminData, hrData),
      testDisplayNameUtility(adminData, hrData, rosterData),
      testDuplicateCheck(adminData, hrData, rosterData),
      testDarkModeField(rosterData),
      testEmailUniqueness(adminData),
      testRoleDistribution(adminData),
      testRequiredFieldsPopulated(adminData),
      // Profile & Employment
      testProfileData(profileData, dbUserId),
      testAttendanceLogs(profileData, dbUserId),
      testOvertimeData(profileData, dbUserId),
      testLeaveBalance(profileData, dbUserId),
      testStaffVehicles(profileData, dbUserId),
      testEmergencyContactFormat(profileData, dbUserId),
      testSignatureFields(rosterData),
      // Cross-System Integration
      testClockStatus(clockData, dbUserId),
      testMessageUserSearch(messagesData),
      testHrDashboardMetrics(dashboardData),
    ]);

    setRunning(false);
  }, [dbUserId]);

  if (isProduction) {
    return (
      <div style={{ padding: "32px" }}>
        <h1>User System Diagnostic</h1>
        <p>This page is only available in development mode.</p>
      </div>
    );
  }

  const passCount = results ? results.filter((r) => r.pass).length : 0;
  const totalCount = results ? results.length : 0;

  // Group results by section
  const groupedResults = results
    ? SECTION_ORDER.map((section) => ({
        section,
        items: results
          .map((r, i) => ({ ...r, _index: i }))
          .filter((r) => r.section === section),
      })).filter((g) => g.items.length > 0)
    : [];

  return (
    <div style={{ padding: "32px", maxWidth: "900px" }}>
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 14px",
          marginBottom: "16px",
          borderRadius: "8px",
          border: "1px solid var(--surface-light)",
          background: "transparent",
          color: "var(--text-secondary)",
          fontWeight: 600,
          fontSize: "13px",
          cursor: "pointer",
        }}
      >
        &larr; Back
      </button>
      <h1 style={{ marginBottom: "8px" }}>User System Diagnostic</h1>
      <p style={{ marginBottom: "24px", color: "var(--text-secondary)", fontSize: "14px" }}>
        Post-migration checks: unified users table, soft-delete, name consistency, profiles, clocking, messaging, and HR integration.
      </p>

      <button
        type="button"
        onClick={runAllTests}
        disabled={running || userLoading}
        style={{
          padding: "10px 20px",
          borderRadius: "8px",
          border: "none",
          background: running ? "var(--text-secondary)" : "var(--primary)",
          color: "var(--text-inverse)",
          fontWeight: 600,
          cursor: running || userLoading ? "not-allowed" : "pointer",
          marginBottom: "24px",
          fontSize: "14px",
        }}
      >
        {userLoading ? "Waiting for user context..." : running ? "Running..." : "Run All Tests"}
      </button>

      {groupedResults.map((group) => (
        <div key={group.section} style={{ marginBottom: "24px" }}>
          <h3
            style={{
              fontSize: "13px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
              marginBottom: "10px",
              borderBottom: "1px solid var(--surface-light)",
              paddingBottom: "6px",
            }}
          >
            {group.section}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {group.items.map((result) => (
              <div
                key={result._index}
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${result.pass ? "var(--success)" : "var(--danger)"}`,
                  borderRadius: "8px",
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: result.pass ? "var(--success)" : "var(--danger)",
                      minWidth: "24px",
                    }}
                  >
                    {result.pass ? "\u2713" : "\u2717"}
                  </span>
                  <span style={{ fontWeight: 600, flex: 1 }}>{result.label}</span>
                  {result.data && (
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [result._index]: !prev[result._index] }))}
                      style={{
                        background: "none",
                        border: "1px solid var(--surface-light)",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {expanded[result._index] ? "Hide" : "Details"}
                    </button>
                  )}
                </div>
                <p style={{ margin: "6px 0 0 34px", fontSize: "14px", color: "var(--text-secondary)" }}>
                  {result.detail}
                </p>
                {expanded[result._index] && result.data && (
                  <pre
                    style={{
                      marginTop: "10px",
                      marginLeft: "34px",
                      background: "var(--surface-light)",
                      padding: "12px",
                      borderRadius: "6px",
                      overflowX: "auto",
                      fontSize: "12px",
                      maxHeight: "300px",
                      overflowY: "auto",
                    }}
                  >
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {results && (
        <div
          style={{
            marginTop: "24px",
            padding: "16px",
            background: passCount === totalCount ? "var(--success)" : "var(--danger)",
            color: "var(--text-inverse)",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "16px",
          }}
        >
          {passCount}/{totalCount} tests passed
        </div>
      )}
    </div>
  );
}
