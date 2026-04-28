// file location: src/pages/dev/user-diagnostic.js
// Dev-only diagnostic page to verify the unified users table, soft-delete, and name consistency
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { canShowDevPages } from "@/lib/dev-tools/config";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";
import { useDevLayoutRegistry } from "@/context/DevLayoutRegistryContext";
import { Button, InputField, StatusMessage } from "@/components/ui";
import { DropdownField, MultiSelectDropdown } from "@/components/ui/dropdownAPI";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { SearchBar } from "@/components/ui/searchBarAPI";
import ScrollArea from "@/components/ui/scrollAPI/ScrollArea";
import { SkeletonBlock, SkeletonMetricCard } from "@/components/ui/LoadingSkeleton";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

// ── Section: Core Data ──────────────────────────────────────────
import UserDiagnosticDevPageUi from "@/components/page-ui/dev/dev-user-diagnostic-ui"; // Extracted presentation layer.
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
  activeHr !== null ?
  `Admin: ${totalAdmin} users (all). Employees: ${activeHr} active. Difference: ${totalAdmin - activeHr} inactive.` :
  `Admin: ${totalAdmin} users. HR endpoint unavailable for comparison.`;

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
  const detail = isClockedIn ?
  `User is currently clocked in (record: ${clockData.data.activeRecord?.clockIn || "unknown"})` :
  "User is currently clocked out";
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
    section: "Cross-System Integration"
  };
}

// ── Global UI Showcase (right column) ───────────────────────────
// Renders a live sample of every primitive that consumes the global theme,
// plus colour swatches sourced from src/styles/theme.css, so a Service
// Manager can visually verify the global design at a glance.

const COLOUR_GROUPS = [
{
  title: "Brand & Surfaces",
  swatches: [
  "background", "surface", "surface-light", "surface-muted",
  "primary", "primary-light", "primary-dark",
  "accentMain", "accentHover", "accentPressed",
  "accentSurface", "accentSurfaceHover", "accentSurfaceSubtle"]

},
{
  title: "Text & Borders",
  swatches: [
  "text-primary", "text-secondary", "text-inverse",
  "border", "control-border-color", "accentBorder", "accentBorderStrong"]

},
{
  title: "Status Colours",
  swatches: [
  "success", "success-surface", "success-text", "success-border",
  "authorised", "authorised-surface", "authorised-text", "authorised-border",
  "complete", "complete-surface", "complete-text", "complete-border",
  "warning", "warning-surface", "warning-text", "warning-border",
  "danger", "danger-surface", "danger-text", "danger-border",
  "info", "info-surface"]

}];


// Registry of where each showcased item is used in the codebase.
// Each entry: { label, file, route? }. A route opens via router.push.
const USAGE_REGISTRY = {
  "buttons-app-btn": [
  { label: "Button primitive", file: "src/components/ui/Button.js" },
  { label: "Job cards page", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
  { label: "Accounts page", file: "src/pages/accounts/index.js", route: "/accounts" },
  { label: "Admin users", file: "src/pages/admin/users/index.js", route: "/admin/users" },
  { label: "HR employees tab", file: "src/components/HR/tabs/EmployeesTab.js" },
  { label: "Profile page", file: "src/pages/profile/index.js", route: "/profile" }],

  "input-app-input": [
  { label: "InputField primitive", file: "src/components/ui/InputField.js" },
  { label: "Interactive Showcase Control", file: "src/pages/dev/user-diagnostic.js", route: "/dev/user-diagnostic" },
  { label: "Account form", file: "src/components/accounts/AccountForm.js" },
  { label: "Stock check popup", file: "src/components/Consumables/StockCheckPopup.js" },
  { label: "Personal settings popup", file: "src/components/profile/personal/PersonalSettingsPopup.js" },
  { label: "Login page", file: "src/pages/login.js", route: "/login" }],

  "dropdown-api": [
  { label: "DropdownField primitive", file: "src/components/ui/dropdownAPI/DropdownField.js" },
  { label: "Interactive Showcase Control", file: "src/pages/dev/user-diagnostic.js", route: "/dev/user-diagnostic" },
  { label: "Job card view", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
  { label: "HR manager", file: "src/pages/hr/manager/index.js", route: "/hr/manager" },
  { label: "Accounts settings", file: "src/components/accounts/AccountsSettingsPanel.js" }],

  "calendar-api": [
  { label: "CalendarField primitive", file: "src/components/ui/calendarAPI/CalendarField.js" },
  { label: "Interactive Showcase Control", file: "src/pages/dev/user-diagnostic.js", route: "/dev/user-diagnostic" },
  { label: "Job cards myjobs", file: "src/pages/job-cards/myjobs/index.js", route: "/job-cards/myjobs" },
  { label: "Tracking page", file: "src/pages/tracking/index.js", route: "/tracking" }],

  "timepicker-api": [
  { label: "TimePickerField primitive", file: "src/components/ui/timePickerAPI/TimePickerField.js" },
  { label: "Interactive Showcase Control", file: "src/pages/dev/user-diagnostic.js", route: "/dev/user-diagnostic" },
  { label: "Personal widgets", file: "src/components/profile/personal/widgets/PersonalWidgets.js" }],

  "app-badge": [
  { label: "Tab badges in job-cards", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
  { label: "HR employees pills", file: "src/components/HR/tabs/EmployeesTab.js" },
  { label: "Customer portal", file: "src/features/customerPortal/components/VHCSummaryList.js" }],

  "tooltips-native": [
  { label: "Sidebar nav titles", file: "src/components/Sidebar.js" },
  { label: "Dev layout overlay", file: "src/components/dev-layout-overlay/DevLayoutOverlay.js" },
  { label: "VHC modals", file: "src/components/VHC/BrakesHubsDetailsModal.js" }],

  "tab-api": [
  { label: "TabGroup primitive", file: "src/components/ui/tabAPI/TabGroup.js" },
  { label: "Interactive Showcase Control", file: "src/pages/dev/user-diagnostic.js", route: "/dev/user-diagnostic" },
  { label: "Profile tab switcher", file: "src/components/profile/TabSwitcher.js", route: "/profile" },
  { label: "HR tabs bar", file: "src/components/HR/HrTabsBar.js" },
  { label: "Job card write-up form", file: "src/components/JobCards/WriteUpForm.js" }],

  "searchbar-api": [
  { label: "SearchBar primitive", file: "src/components/ui/searchBarAPI/SearchBar.js" },
  { label: "Interactive Showcase Control", file: "src/pages/dev/user-diagnostic.js", route: "/dev/user-diagnostic" },
  { label: "Global search", file: "src/components/GlobalSearch.js" },
  { label: "Messages page", file: "src/pages/messages/index.js", route: "/messages" }],

  "multiselect-dropdown": [
  { label: "MultiSelectDropdown primitive", file: "src/components/ui/dropdownAPI/MultiSelectDropdown.js" },
  { label: "Interactive Showcase Control", file: "src/pages/dev/user-diagnostic.js", route: "/dev/user-diagnostic" },
  { label: "HR manager filters", file: "src/pages/hr/manager/index.js", route: "/hr/manager" },
  { label: "Widget settings modal", file: "src/components/profile/personal/WidgetSettingsModal.js" }],

  "status-message": [
  { label: "StatusMessage primitive", file: "src/components/ui/StatusMessage.js" },
  { label: "Account form", file: "src/components/accounts/AccountForm.js" },
  { label: "Customer portal cards", file: "src/features/customerPortal/components/OutstandingInvoicesCard.js" }],

  "loading-skeleton": [
  { label: "LoadingSkeleton primitive", file: "src/components/ui/LoadingSkeleton.js" },
  { label: "Profile work tab", file: "src/components/profile/ProfileWorkTab.js", route: "/profile" },
  { label: "Profile personal tab", file: "src/components/profile/ProfilePersonalTab.js", route: "/profile" }],

  "scroll-area": [
  { label: "ScrollArea primitive", file: "src/components/ui/scrollAPI/ScrollArea.js" },
  { label: "Clocking list", file: "src/components/Clocking/ClockingList.js" },
  { label: "Job card details", file: "src/pages/job-cards/[jobNumber].js" }],

  "table-app-data": [
  { label: "Transaction table", file: "src/components/accounts/TransactionTable.js" },
  { label: "Invoice table", file: "src/components/accounts/InvoiceTable.js" },
  { label: "Account table", file: "src/components/accounts/AccountTable.js" },
  { label: "Accounts page", file: "src/pages/accounts/index.js", route: "/accounts" }],

  "section-layers": [
  { label: "Job cards myjob page", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
  { label: "Customer portal layout", file: "src/features/customerPortal/components/CustomerLayout.js" },
  { label: "Profile page", file: "src/pages/profile/index.js", route: "/profile" }],

  "non-global-banners": [
  { label: "EmptyStateMessage (VHC)", file: "src/components/VHC/VhcSharedComponents.js" },
  { label: ".login-error", file: "src/pages/login.js", route: "/login" },
  { label: ".releasePromptBox", file: "src/features/invoices/styles/invoice.module.css" }],

  "global-cards": [
  { label: ".app-page-shell / .app-page-card / .app-page-stack / .app-section-card", file: "src/styles/globals.css" },
  { label: "Section component", file: "src/components/Section.js" },
  { label: "Card / SectionCard component", file: "src/components/ui/Card.js" },
  { label: "--page-card-bg / --section-card-bg tokens", file: "src/styles/theme.css" }],

  "non-global-cards": [
  { label: ".vhc-card — VHC inspection", file: "src/components/VHC/VhcDetailsPanel.js" },
  { label: ".customer-portal-card", file: "src/features/customerPortal/components/CustomerLayout.js" },
  { label: "vhcModal.summaryCard / baseCard", file: "src/styles/appTheme.js" }],

  "non-global-modals": [
  { label: "VHC modal shells (1080×640)", file: "src/components/VHC/WheelsTyresDetailsModal.js" },
  { label: ".paymentModal", file: "src/features/invoices/styles/invoice.module.css" },
  { label: "popupCardStyles", file: "src/styles/appTheme.js" },
  { label: "popupStyleApi", file: "src/components/popups/popupStyleApi.js" }],

  "non-global-tables": [
  { label: ".myjobs-row (flex grid)", file: "src/pages/job-cards/myjobs/index.js", route: "/job-cards/myjobs" },
  { label: ".partsTable (invoice)", file: "src/features/invoices/styles/invoice.module.css" },
  { label: "VHC item cell", file: "src/components/VHC/VhcSharedComponents.js" }],

  "domain-class-families": [
  { label: ".vhc-* — globals.css", file: "src/styles/globals.css" },
  { label: ".hr-employees-* — globals.css", file: "src/styles/globals.css" },
  { label: ".myjobs-* — globals.css", file: "src/styles/globals.css" },
  { label: ".login-* — globals.css", file: "src/styles/globals.css" },
  { label: ".customer-portal-* — globals.css", file: "src/styles/globals.css" }],

  "colour-tokens": [
  { label: "Source: theme.css", file: "src/styles/theme.css" },
  { label: "JS tokens: appTheme.js", file: "src/styles/appTheme.js" },
  { label: "Theme provider", file: "src/styles/themeProvider.js" }],

  "radius-scale": [
  { label: "theme.css --radius-*", file: "src/styles/theme.css" }],

  "spacing-global": [
  { label: "Source: theme.css --space-*", file: "src/styles/theme.css" },
  { label: "Page gutter / stack tokens", file: "src/styles/theme.css" },
  { label: "Layout primitives (PageShell/SectionShell)", file: "src/components/ui/layout-system/PageShell.js" },
  { label: "ContentWidth wrapper", file: "src/components/ui/layout-system/ContentWidth.js" },
  { label: "FilterToolbarRow", file: "src/components/ui/layout-system/FilterToolbarRow.js" }],

  "spacing-non-global": [
  { label: "VHC modal padding (var(--space-md) var(--space-6))", file: "src/styles/appTheme.js" },
  { label: "Job-card inline 24px padding", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
  { label: "Login page paddings", file: "src/pages/login.js", route: "/login" },
  { label: "Customer portal layout gaps", file: "src/features/customerPortal/components/CustomerLayout.js" },
  { label: "VHC EmptyStateMessage 18px", file: "src/components/VHC/VhcSharedComponents.js" },
  { label: "Payment modal 24px pad", file: "src/features/invoices/styles/invoice.module.css" },
  { label: "Documents preview 24px overlay pad", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" }],

  "popup-global": [
  { label: "popupStyleApi (backdrop + card)", file: "src/components/popups/popupStyleApi.js" },
  { label: "popupOverlayStyles", file: "src/styles/appTheme.js" },
  { label: "popupCardStyles", file: "src/styles/appTheme.js" },
  { label: "ModalPortal", file: "src/components/popups/ModalPortal.js" },
  { label: "Stock check popup", file: "src/components/Consumables/StockCheckPopup.js" },
  { label: "Personal settings popup", file: "src/components/profile/personal/PersonalSettingsPopup.js" },
  { label: "Widget settings modal", file: "src/components/profile/personal/WidgetSettingsModal.js" }],

  "interaction-states-buttons": [
  { label: "Button primitive (hover/active via CSS)", file: "src/components/ui/Button.js" },
  { label: ".app-btn hover / :disabled rules", file: "src/styles/globals.css" },
  { label: "Proposed Global Standard — document in theme.css", file: "src/styles/theme.css" }],

  "interaction-states-inputs": [
  { label: "InputField primitive", file: "src/components/ui/InputField.js" },
  { label: ".app-input :focus rules", file: "src/styles/globals.css" },
  { label: "Proposed: add .app-input--error / --success modifiers", file: "src/styles/globals.css" }],

  "checkboxes-states": [
  { label: "Native checkbox styling", file: "src/styles/globals.css" },
  { label: "Tech consumables request", file: "src/pages/tech/consumables-request.js" },
  { label: "Widget settings modal", file: "src/components/profile/personal/WidgetSettingsModal.js" },
  { label: "Stock check popup", file: "src/components/Consumables/StockCheckPopup.js" },
  { label: "Proposed Global Standard — src/components/ui/Checkbox.js (not yet created)", file: "src/components/ui/" }],

  "focus-ring": [
  { label: "Token: --control-ring", file: "src/styles/theme.css" },
  { label: "Applied in .app-input, .dropdown-api, .searchbar-api", file: "src/styles/globals.css" },
  { label: "Proposed: enforce :focus-visible across every interactive element", file: "src/styles/globals.css" }],

  "form-validation": [
  { label: "Account form", file: "src/components/accounts/AccountForm.js" },
  { label: "Login form", file: "src/pages/login.js", route: "/login" },
  { label: "Proposed Global Standard — add FieldError/FieldHelper primitives", file: "src/components/ui/InputField.js" },
  { label: "To be adopted in refactor", file: "src/components/ui/" }],

  "field-group": [
  { label: "InputField label+input layout", file: "src/components/ui/InputField.js" },
  { label: "ControlGroup primitive", file: "src/components/ui/ControlGroup.js" },
  { label: "Proposed: FormField wrapper standardising label+input+message", file: "src/components/ui/" }],

  "icon-system": [
  { label: "Proposed Global Standard — src/components/ui/Icon.js (not yet created)", file: "src/components/ui/" },
  { label: "Current: inline emoji / unicode in VHC, sidebar, login", file: "src/components/VHC/VhcSharedComponents.js" },
  { label: "To be adopted in refactor (wrap lucide-react or similar)", file: "src/components/ui/" }],

  "empty-state-standard": [
  { label: "VHC EmptyStateMessage (per-module, non-standard)", file: "src/components/VHC/VhcSharedComponents.js" },
  { label: "Proposed Global Standard — src/components/ui/EmptyState.js", file: "src/components/ui/" },
  { label: "To be adopted in refactor (accounts, parts, HR lists)", file: "src/pages/accounts/index.js", route: "/accounts" }],

  "confirm-dialogs": [
  { label: "popupStyleApi (backdrop + card foundation)", file: "src/components/popups/popupStyleApi.js" },
  { label: "Proposed: <ConfirmDialog tone='destructive|info|success' />", file: "src/components/popups/" },
  { label: "Current ad-hoc confirm in StockCheckPopup", file: "src/components/Consumables/StockCheckPopup.js" },
  { label: "To be adopted in refactor", file: "src/components/ui/" }],

  "toast-notifications": [
  { label: "Proposed Global Standard — src/components/ui/Toast.js (not yet created)", file: "src/components/ui/" },
  { label: "Current: alertBus emits to TopbarAlerts", file: "src/lib/notifications/alertBus.js" },
  { label: "To be adopted in refactor (z-toast = 2000, top-right stack)", file: "src/styles/theme.css" }],

  "loading-states-expanded": [
  { label: "LoadingSkeleton primitive (current)", file: "src/components/ui/LoadingSkeleton.js" },
  { label: "Proposed: <Spinner size /> + <ButtonLoading />", file: "src/components/ui/" },
  { label: "Canonical page skeleton — PageSkeleton export", file: "src/components/ui/LoadingSkeleton.js" }],

  "navigation-states": [
  { label: "Navigation colours inherit from --accentSurface / --accentSurfaceHover / --accentMain", file: "src/styles/theme.css" },
  { label: "Sidebar consumer", file: "src/components/Sidebar.js" },
  { label: "Proposed: <Breadcrumbs /> + <Pagination /> primitives", file: "src/components/ui/" }],

  "table-states": [
  { label: "Transaction table", file: "src/components/accounts/TransactionTable.js" },
  { label: "Invoice table", file: "src/components/accounts/InvoiceTable.js" },
  { label: "Proposed: <DataTable /> primitive with empty/loading/selected states", file: "src/components/ui/" }],

  "popup-unified-proposal": [
  { label: "Merge popupStyleApi.js", file: "src/components/popups/popupStyleApi.js" },
  { label: "Merge appTheme.popupOverlayStyles / popupCardStyles", file: "src/styles/appTheme.js" },
  { label: "Proposed Global Standard — src/components/ui/Popup.js", file: "src/components/ui/" }],

  "spacing-comparison": [
  { label: "Source: theme.css --space-* scale", file: "src/styles/theme.css" },
  { label: "Audit: appTheme.js inline px values", file: "src/styles/appTheme.js" },
  { label: "Audit: inline padding in job-cards", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
  { label: "Audit: VHC components", file: "src/components/VHC/VhcSharedComponents.js" }],

  "motion-transitions": [
  { label: "Tokens: --duration-* / --ease-* / --control-transition", file: "src/styles/theme.css" },
  { label: "skeleton-pulse keyframes", file: "src/components/ui/LoadingSkeleton.js" },
  { label: "Proposed: document motion standard + fade-in / modal-slide animations", file: "src/styles/theme.css" }]

};

function UsagePopup({ itemKey, title, onClose }) {
  const router = useRouter();
  const [copiedIndex, setCopiedIndex] = useState(null);
  if (typeof document === "undefined") return null;
  const usages = USAGE_REGISTRY[itemKey] || [];
  const migratedCount = usages.filter((u) => u.migrated).length;
  const hasSuggestions = usages.some((u) => u.suggestion);
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2500,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px"
      }}>
      
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-xl)",
          padding: "20px 22px",
          width: "min(620px, 100%)",
          maxHeight: "80vh",
          overflowY: "auto",
          border: "1px solid var(--accentBorder)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)"
        }}>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)" }}>
            Where is &ldquo;{title}&rdquo; used?
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-secondary)" }}
            aria-label="Close">
            
            ×
          </button>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
          {usages.length} known location{usages.length === 1 ? "" : "s"}.
          {migratedCount > 0 && <span style={{ color: "var(--success-text)", fontWeight: 600 }}> {migratedCount} migrated to global.</span>}
          {hasSuggestions && " Click Copy for the fix suggestion."}
        </p>
        {usages.length === 0 &&
        <div style={{ padding: "12px", background: "var(--surface-light)", borderRadius: "var(--radius-xs)", fontSize: "13px", color: "var(--text-secondary)" }}>
            No usages registered for this item yet.
          </div>
        }
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {usages.map((u, i) =>
          <div
            key={i}
            style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              padding: "10px 12px",
              background: u.migrated ? "rgba(var(--success-rgb, 34,197,94), 0.06)" : "var(--surface-light)",
              borderRadius: "var(--radius-sm)",
              border: "none"
            }}>
            
              {u.migrated &&
            <span style={{ fontSize: "14px", color: "var(--success)", flexShrink: 0, marginTop: "1px" }}>{"\u2713"}</span>
            }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: u.migrated ? "var(--success-text)" : "var(--text-primary)" }}>{u.label}</div>
                <code style={{ fontSize: "11px", color: "var(--text-secondary)", wordBreak: "break-all" }}>{u.file}</code>
                {u.suggestion &&
              <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--text-secondary)", fontStyle: "italic" }}>{u.suggestion}</div>
              }
              </div>
              <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                {u.suggestion &&
              <button
                type="button"
                onClick={() => {
                  const text = `File: ${u.file}\n${u.suggestion}`;
                  navigator.clipboard.writeText(text).then(() => {
                    setCopiedIndex(i);
                    setTimeout(() => setCopiedIndex(null), 1500);
                  });
                }}
                style={{
                  padding: "5px 10px",
                  borderRadius: "var(--radius-xs)",
                  background: copiedIndex === i ? "var(--success)" : "var(--surface)",
                  color: copiedIndex === i ? "var(--text-inverse)" : "var(--text-secondary)",
                  border: "1px solid var(--accentBorder)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.15s, color 0.15s"
                }}>
                
                    {copiedIndex === i ? "Copied" : "Copy"}
                  </button>
              }
                {u.route &&
              <button
                type="button"
                onClick={() => {onClose();router.push(u.route);}}
                style={{
                  padding: "5px 10px",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--primary)",
                  color: "var(--text-inverse)",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0
                }}>
                
                    Go to page
                  </button>
              }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ShowcaseSection({ title, itemKey, onOpenUsage, noteText: noteTextProp, onNoteChange, noteSaving, children }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const noteText = typeof noteTextProp === "object" && noteTextProp !== null ? noteTextProp[itemKey] || "" : noteTextProp || "";
  const hasNote = typeof noteText === "string" && noteText.length > 0;
  return (
    <section
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        padding: "16px",
        border: "1px solid var(--accentBorder)",
        marginBottom: "16px"
      }}>
      
      <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "0 0 12px" }}>
        <button
          type="button"
          onClick={() => itemKey && onOpenUsage?.(itemKey, title)}
          disabled={!itemKey}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            padding: 0,
            background: "none",
            border: "none",
            cursor: itemKey ? "pointer" : "default",
            textAlign: "left"
          }}
          title={itemKey ? "Click to see where this is used" : undefined}>
          
          <h4
            style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-secondary)"
            }}>
            
            {title}
          </h4>
          {itemKey &&
          <span style={{ fontSize: "10px", color: "var(--primary)", fontWeight: 700 }}>
              Where used →
            </span>
          }
        </button>
        {itemKey && onNoteChange &&
        <button
          type="button"
          onClick={() => setNoteOpen((prev) => !prev)}
          title={noteOpen ? "Close note" : "Add a note"}
          style={{
            flexShrink: 0,
            width: "26px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--accentBorder)",
            background: hasNote ? "var(--accent-surface, var(--surface-light))" : "var(--surface-light)",
            color: hasNote ? "var(--accent-base, var(--primary))" : "var(--text-secondary)",
            fontSize: "14px",
            cursor: "pointer",
            lineHeight: 1,
            padding: 0
          }}>
          
            {hasNote ? "\u270E" : "\u002B"}
          </button>
        }
      </div>
      {noteOpen && itemKey && onNoteChange &&
      <div
        style={{
          marginBottom: "12px",
          padding: "10px",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-light)",
          border: "1px solid var(--accentBorder)"
        }}>
        
          <label
          style={{
            display: "block",
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-secondary)",
            marginBottom: "6px"
          }}>
          
            Note {noteSaving ? "(saving…)" : ""}
          </label>
          <textarea
          value={noteText || ""}
          onChange={(e) => onNoteChange(itemKey, e.target.value)}
          placeholder="Add a note about this showcase section…"
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            padding: "8px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--accentBorder)",
            background: "var(--surface)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontFamily: "inherit",
            lineHeight: 1.5,
            boxSizing: "border-box"
          }} />
        
        </div>
      }
      {children}
    </section>);

}

function ColourSwatch({ token }) {
  return (
    <div
      title={`--${token}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: 0
      }}>
      
      <div
        style={{
          height: "36px",
          borderRadius: "var(--radius-xs)",
          background: `var(--${token})`,
          border: "1px solid var(--accentBorder)"
        }} />
      
      <code
        style={{
          fontSize: "10px",
          color: "var(--text-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}>
        
        --{token}
      </code>
    </div>);

}

const SHOWCASE_PRESET_OPTIONS = [
{ value: "default", label: "Default" },
{ value: "disabled", label: "Disabled" },
{ value: "error", label: "Error" },
{ value: "filled", label: "Filled" },
{ value: "edge", label: "Edge Case" }];


const SHOWCASE_COUNT_OPTIONS = [3, 5, 10].map((count) => ({ value: String(count), label: `${count}` }));
const SHOWCASE_TIME_STEP_OPTIONS = [5, 10, 15, 30].map((step) => ({ value: String(step), label: `${step} mins` }));
const SHOWCASE_MAX_SELECTION_OPTIONS = [1, 2, 3, 5].map((count) => ({ value: String(count), label: `${count}` }));
const SHOWCASE_TAB_LAYOUT_OPTIONS = [
{ value: "wrap", label: "Wrap" },
{ value: "stretch", label: "Stretch" },
{ value: "grid", label: "Grid" }];

const SHOWCASE_CALENDAR_TONE_OPTIONS = [
{ value: "both", label: "Amber + Red" },
{ value: "amber", label: "Amber" },
{ value: "red", label: "Red" }];

const SHOWCASE_MULTI_PRESET_OPTIONS = [
{ value: "none", label: "None" },
{ value: "first-2", label: "First 2" },
{ value: "last-2", label: "Last 2" },
{ value: "max", label: "Up to max" }];


function ShowcaseControlRow({ label, children }) {
  return (
    <div className="showcase-control-row">
      <div className="showcase-control-row__label">{label}</div>
      <div className="showcase-control-row__control">{children}</div>
    </div>);

}

function ShowcaseToggleButton({ active = false, children, ...props }) {
  return (
    <Button type="button" size="xs" variant={active ? "primary" : "secondary"} {...props}>
      {children}
    </Button>);

}

function buildShowcaseOptions(count, prefix = "Option") {
  return Array.from({ length: count }, (_, index) => ({
    value: `opt-${index + 1}`,
    label: `${prefix} ${index + 1}`
  }));
}

function buildTabItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    value: `tab-${index + 1}`,
    label: `Tab ${index + 1}`
  }));
}

function buildDepartmentOptions(count) {
  return Array.from({ length: count }, (_, index) => `Department ${index + 1}`);
}

function getMultiPresetValues(mode, options, maxSelections) {
  if (mode === "none") return [];
  if (mode === "last-2") return options.slice(Math.max(0, options.length - 2));
  if (mode === "max") return options.slice(0, maxSelections);
  return options.slice(0, Math.min(2, options.length));
}

function getDropdownShowcaseState(preset = "default") {
  if (preset === "disabled") {
    return {
      preset,
      optionCount: 5,
      placeholder: "Dropdown disabled",
      disabled: true,
      error: false,
      selectedValue: ""
    };
  }
  if (preset === "error") {
    return {
      preset,
      optionCount: 5,
      placeholder: "Pick a required option",
      disabled: false,
      error: true,
      selectedValue: ""
    };
  }
  if (preset === "filled") {
    return {
      preset,
      optionCount: 5,
      placeholder: "Select one...",
      disabled: false,
      error: false,
      selectedValue: "opt-3"
    };
  }
  if (preset === "edge") {
    return {
      preset,
      optionCount: 10,
      placeholder: "A very long placeholder used to pressure-test truncation and menu spacing",
      disabled: false,
      error: false,
      selectedValue: "opt-10"
    };
  }
  return {
    preset,
    optionCount: 5,
    placeholder: "Select one...",
    disabled: false,
    error: false,
    selectedValue: "opt-2"
  };
}

function getMultiSelectShowcaseState(preset = "default") {
  if (preset === "disabled") {
    return {
      preset,
      optionCount: 5,
      preselectedMode: "first-2",
      selectedValues: ["Department 1", "Department 2"],
      maxSelections: 2,
      disabled: true
    };
  }
  if (preset === "error") {
    return {
      preset,
      optionCount: 5,
      preselectedMode: "none",
      selectedValues: [],
      maxSelections: 1,
      disabled: false
    };
  }
  if (preset === "filled") {
    return {
      preset,
      optionCount: 5,
      preselectedMode: "first-2",
      selectedValues: ["Department 1", "Department 2"],
      maxSelections: 3,
      disabled: false
    };
  }
  if (preset === "edge") {
    return {
      preset,
      optionCount: 10,
      preselectedMode: "max",
      selectedValues: ["Department 1", "Department 2", "Department 3", "Department 4", "Department 5"],
      maxSelections: 5,
      disabled: false
    };
  }
  return {
    preset,
    optionCount: 5,
    preselectedMode: "first-2",
    selectedValues: ["Department 1"],
    maxSelections: 3,
    disabled: false
  };
}

function getCalendarShowcaseState(preset = "default") {
  if (preset === "disabled") {
    return {
      preset,
      selectedDate: "",
      rangeSelection: false,
      highlightToday: false,
      showDisabledDates: true,
      disabled: true,
      tonePreview: "both"
    };
  }
  if (preset === "error") {
    return {
      preset,
      selectedDate: "",
      rangeSelection: false,
      highlightToday: true,
      showDisabledDates: true,
      disabled: false,
      tonePreview: "red"
    };
  }
  if (preset === "filled") {
    return {
      preset,
      selectedDate: new Date().toISOString().slice(0, 10),
      rangeSelection: false,
      highlightToday: true,
      showDisabledDates: false,
      disabled: false,
      tonePreview: "amber"
    };
  }
  if (preset === "edge") {
    return {
      preset,
      selectedDate: "2026-12-31",
      rangeSelection: true,
      highlightToday: true,
      showDisabledDates: true,
      disabled: false,
      tonePreview: "both"
    };
  }
  return {
    preset,
    selectedDate: "",
    rangeSelection: false,
    highlightToday: true,
    showDisabledDates: false,
    disabled: false,
    tonePreview: "both"
  };
}

function getTimePickerShowcaseState(preset = "default") {
  if (preset === "disabled") {
    return { preset, selectedTime: "", minuteStep: 15, disabled: true };
  }
  if (preset === "error") {
    return { preset, selectedTime: "", minuteStep: 5, disabled: false };
  }
  if (preset === "filled") {
    return { preset, selectedTime: "14:30", minuteStep: 15, disabled: false };
  }
  if (preset === "edge") {
    return { preset, selectedTime: "23:55", minuteStep: 5, disabled: false };
  }
  return { preset, selectedTime: "09:00", minuteStep: 15, disabled: false };
}

function getInputShowcaseState(preset = "default") {
  if (preset === "disabled") {
    return {
      preset,
      value: "",
      placeholder: "Input disabled",
      disabled: true,
      error: false,
      success: false
    };
  }
  if (preset === "error") {
    return {
      preset,
      value: "bad@",
      placeholder: "Enter your email",
      disabled: false,
      error: true,
      success: false
    };
  }
  if (preset === "filled") {
    return {
      preset,
      value: "Alice Johnson",
      placeholder: "Type something...",
      disabled: false,
      error: false,
      success: true
    };
  }
  if (preset === "edge") {
    return {
      preset,
      value: "A deliberately long sample value to validate overflow and focus behaviour inside the global input shell.",
      placeholder: "Long value test",
      disabled: false,
      error: false,
      success: false
    };
  }
  return {
    preset,
    value: "",
    placeholder: "Type something...",
    disabled: false,
    error: false,
    success: false
  };
}

function getTabsShowcaseState(preset = "default") {
  if (preset === "disabled") {
    return {
      preset,
      tabCount: 3,
      activeTab: "tab-1",
      layout: "stretch"
    };
  }
  if (preset === "error") {
    return {
      preset,
      tabCount: 5,
      activeTab: "tab-5",
      layout: "grid"
    };
  }
  if (preset === "filled") {
    return {
      preset,
      tabCount: 5,
      activeTab: "tab-3",
      layout: "wrap"
    };
  }
  if (preset === "edge") {
    return {
      preset,
      tabCount: 10,
      activeTab: "tab-10",
      layout: "grid"
    };
  }
  return {
    preset,
    tabCount: 3,
    activeTab: "tab-1",
    layout: "wrap"
  };
}

function getSearchShowcaseState(preset = "default") {
  if (preset === "disabled") {
    return {
      preset,
      value: "",
      placeholder: "Searching disabled",
      loading: false,
      showClear: true,
      disabled: true
    };
  }
  if (preset === "error") {
    return {
      preset,
      value: "broken query",
      placeholder: "Search anything...",
      loading: true,
      showClear: false,
      disabled: false
    };
  }
  if (preset === "filled") {
    return {
      preset,
      value: "Brake pads",
      placeholder: "Search anything...",
      loading: false,
      showClear: true,
      disabled: false
    };
  }
  if (preset === "edge") {
    return {
      preset,
      value: "Very long edge-case query to validate truncation and spacing in the global search bar",
      placeholder: "Search by reg, customer, VIN, note, part, or keyword",
      loading: true,
      showClear: true,
      disabled: false
    };
  }
  return {
    preset,
    value: "",
    placeholder: "Search anything...",
    loading: false,
    showClear: true,
    disabled: false
  };
}

// ── Showcase catalog: maps each section key → category, scope, search terms ──
const SHOWCASE_CATALOG = {
  // ── Buttons ──
  "buttons-app-btn": { category: "Buttons", scope: "global", terms: "button btn primary secondary ghost danger pill click action" },
  "interaction-states-buttons": { category: "Buttons", scope: "global", terms: "button hover active focus pressed disabled interaction state" },
  // ── Inputs & Fields ──
  "input-app-input": { category: "Inputs & Fields", scope: "global", terms: "input text field form app-input textfield" },
  "interaction-states-inputs": { category: "Inputs & Fields", scope: "global", terms: "input hover focus active disabled interaction state" },
  "checkboxes-states": { category: "Inputs & Fields", scope: "global", terms: "checkbox checked unchecked indeterminate disabled state toggle" },
  "focus-ring": { category: "Inputs & Fields", scope: "global", terms: "focus ring outline control-ring accessibility keyboard" },
  "form-validation": { category: "Inputs & Fields", scope: "global", terms: "validation error success helper text form field" },
  "field-group": { category: "Inputs & Fields", scope: "global", terms: "field group stacked form layout pattern" },
  // ── Dropdowns & Selects ──
  "dropdown-api": { category: "Dropdowns & Selects", scope: "global", terms: "dropdown select option menu picker choice" },
  "multiselect-dropdown": { category: "Dropdowns & Selects", scope: "global", terms: "multiselect multi select dropdown tag chip department" },
  // ── Calendar & Time ──
  "calendar-api": { category: "Calendar & Time", scope: "global", terms: "calendar date picker datepicker range highlight disabled" },
  "timepicker-api": { category: "Calendar & Time", scope: "global", terms: "time picker timepicker clock hour minute step" },
  // ── Search ──
  "searchbar-api": { category: "Search", scope: "global", terms: "search bar searchbar query filter clear loading" },
  // ── Tabs ──
  "tab-api": { category: "Tabs", scope: "global", terms: "tab tabs tabgroup navigation switch panel wrap stretch grid" },
  // ── Badges & Labels ──
  "app-badge": { category: "Badges & Labels", scope: "global", terms: "badge label bubble pill tag status indicator app-badge tone modifier" },
  // ── Colours & Tokens ──
  "colour-tokens": { category: "Colours & Tokens", scope: "global", terms: "colour color token swatch palette theme accent surface primary danger success warning" },
  "section-layers": { category: "Colours & Tokens", scope: "global", terms: "section layer level background surface theme card nesting depth alternation token surfaceMain accentSurfaceSubtle" },
  // ── Spacing & Layout ──
  "spacing-global": { category: "Spacing & Layout", scope: "global", terms: "spacing space gap gutter padding margin layout global" },
  "spacing-non-global": { category: "Spacing & Layout", scope: "non-global", terms: "spacing hardcoded padding margin gap per-module custom" },
  "spacing-comparison": { category: "Spacing & Layout", scope: "global", terms: "spacing comparison hardcoded nearest space token audit" },
  "radius-scale": { category: "Spacing & Layout", scope: "global", terms: "radius border-radius scale xs sm md lg xl pill round" },
  // ── Tables ──
  "table-app-data": { category: "Tables", scope: "global", terms: "table data grid row column cell header app-data-table" },
  "non-global-tables": { category: "Tables", scope: "non-global", terms: "table grid per-module custom data" },
  "table-states": { category: "Tables", scope: "global", terms: "table state empty loading hover selected actions row" },
  // ── Popups & Modals ──
  "popup-global": { category: "Popups & Modals", scope: "global", terms: "popup modal overlay popupStyleApi popupCardStyles dialog" },
  "non-global-modals": { category: "Popups & Modals", scope: "non-global", terms: "modal dialog popup shell per-module custom" },
  "popup-unified-proposal": { category: "Popups & Modals", scope: "global", terms: "popup unified proposal replace consolidate modal dialog" },
  "confirm-dialogs": { category: "Popups & Modals", scope: "global", terms: "confirmation dialog confirm cancel action destructive preview" },
  // ── Cards & Sections ──
  "global-cards": { category: "Cards & Sections", scope: "global", terms: "card section panel app-page-card app-section-card app-page-stack app-page-shell Section global canonical hierarchy" },
  "non-global-cards": { category: "Cards & Sections", scope: "non-global", terms: "card section panel container box per-module custom" },
  // ── Feedback & Status ──
  "status-message": { category: "Feedback & Status", scope: "global", terms: "status message alert info warning error success notification" },
  "non-global-banners": { category: "Feedback & Status", scope: "non-global", terms: "banner alert notification message per-module custom" },
  "toast-notifications": { category: "Feedback & Status", scope: "global", terms: "toast notification snackbar alert proposed transient" },
  "empty-state-standard": { category: "Feedback & Status", scope: "global", terms: "empty state no data placeholder illustration pattern" },
  // ── Loading & Skeletons ──
  "loading-skeleton": { category: "Loading & Skeletons", scope: "global", terms: "loading skeleton placeholder shimmer pulse block metric card" },
  "loading-states-expanded": { category: "Loading & Skeletons", scope: "global", terms: "loading state spinner progress expanded pattern" },
  // ── Navigation ──
  "navigation-states": { category: "Navigation", scope: "global", terms: "navigation sidebar breadcrumb pagination active link menu state" },
  // ── Scroll ──
  "scroll-area": { category: "Scroll", scope: "global", terms: "scroll area scrollbar overflow container scrollAPI" },
  // ── Tooltips ──
  "tooltips-native": { category: "Tooltips", scope: "global", terms: "tooltip title hover hint help native accessibility" },
  // ── Icons ──
  "icon-system": { category: "Icons", scope: "global", terms: "icon system wrapper svg symbol proposed" },
  // ── Motion ──
  "motion-transitions": { category: "Motion & Transitions", scope: "global", terms: "motion transition animation hover transform opacity pulse skeleton" },
  // ── Domain / Reference ──
  "domain-class-families": { category: "Reference", scope: "global", terms: "domain class family index reference audit" },
  // ── Dev Overlay ──
  "dev-layout-overlay": { category: "Dev Tools", scope: "global", terms: "dev layout overlay section tree registry debug inspect" }
};

const SHOWCASE_CATEGORY_ORDER = [
"Buttons", "Inputs & Fields", "Dropdowns & Selects", "Calendar & Time", "Search", "Tabs",
"Badges & Labels", "Typography", "Colours & Tokens", "Spacing & Layout", "Tables",
"Popups & Modals", "Cards & Sections", "Feedback & Status", "Loading & Skeletons",
"Navigation", "Scroll", "Tooltips", "Icons", "Motion & Transitions", "Reference", "Dev Tools"];


function DevOverlayShowcase({ overlay, registry, computedSections, onOpenUsage }) {
  const [treeExpanded, setTreeExpanded] = useState(false);
  const computed = Object.values(computedSections || {});
  const registered = Object.values(registry || {});
  const totalComputed = computed.length;
  const totalRegistered = registered.length;
  const flaggedCount = computed.filter((s) => (s.issueTags || []).length > 0).length;
  const shellCount = computed.filter((s) => s.isShell).length;
  const fallbackCount = computed.filter((s) => s.source === "fallback").length;
  const explicitCount = computed.filter((s) => s.source === "explicit").length;
  const typeBreakdown = {};
  computed.forEach((s) => {typeBreakdown[s.type || "unknown"] = (typeBreakdown[s.type || "unknown"] || 0) + 1;});
  const issueBreakdown = {};
  computed.forEach((s) => {(s.issueTags || []).forEach((tag) => {issueBreakdown[tag] = (issueBreakdown[tag] || 0) + 1;});});
  const sorted = [...computed].sort((a, b) => {
    const ap = (a.number || "0").split(".").map(Number);
    const bp = (b.number || "0").split(".").map(Number);
    for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
      const d = (ap[i] || 0) - (bp[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  });
  const modeLabel = { labels: "Labels", details: "Details", inspect: "Inspect" };
  return (
    <ShowcaseSection title="Dev Layout Overlay" itemKey="dev-layout-overlay" onOpenUsage={onOpenUsage}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px", marginBottom: "10px" }}>
        {[
        { label: "Status", value: overlay.enabled ? "Active" : "Inactive", color: overlay.enabled ? "var(--success-text)" : "var(--text-secondary)" },
        { label: "Mode", value: modeLabel[overlay.mode] || overlay.mode },
        { label: "Scope", value: overlay.fullScreen ? "Full Screen" : "Page Shell" },
        { label: "Dotted Lines", value: overlay.legacyMarkers ? "On" : "Off" }].
        map((c) =>
        <div key={c.label} style={{ padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--accentBorder)", background: "var(--surface-light)" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "2px" }}>{c.label}</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: c.color || "var(--text-primary)" }}>{c.value}</div>
          </div>
        )}
      </div>
      <div className="showcase-controls">
        <ShowcaseControlRow label="Toggle">
          <div className="showcase-toggle-group">
            <ShowcaseToggleButton active={overlay.enabled} onClick={overlay.toggleEnabled}>{overlay.enabled ? "On" : "Off"}</ShowcaseToggleButton>
          </div>
        </ShowcaseControlRow>
        <ShowcaseControlRow label="Mode">
          <div className="showcase-toggle-group">
            <ShowcaseToggleButton active={overlay.mode === "labels"} onClick={() => overlay.setMode("labels")}>Labels</ShowcaseToggleButton>
            <ShowcaseToggleButton active={overlay.mode === "details"} onClick={() => overlay.setMode("details")}>Details</ShowcaseToggleButton>
            <ShowcaseToggleButton active={overlay.mode === "inspect"} onClick={() => overlay.setMode("inspect")}>Inspect</ShowcaseToggleButton>
          </div>
        </ShowcaseControlRow>
        <ShowcaseControlRow label="Scope">
          <div className="showcase-toggle-group">
            <ShowcaseToggleButton active={!overlay.fullScreen} onClick={() => {if (overlay.fullScreen) overlay.toggleFullScreen();}}>Page Shell</ShowcaseToggleButton>
            <ShowcaseToggleButton active={overlay.fullScreen} onClick={() => {if (!overlay.fullScreen) overlay.toggleFullScreen();}}>Full Screen</ShowcaseToggleButton>
          </div>
        </ShowcaseControlRow>
        <ShowcaseControlRow label="Dotted Lines">
          <div className="showcase-toggle-group">
            <ShowcaseToggleButton active={overlay.legacyMarkers} onClick={overlay.toggleLegacyMarkers}>{overlay.legacyMarkers ? "On" : "Off"}</ShowcaseToggleButton>
          </div>
        </ShowcaseControlRow>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px", marginBottom: "8px" }}>
        {[
        { label: "Computed", value: totalComputed },
        { label: "Registered", value: totalRegistered },
        { label: "Flagged", value: flaggedCount, tone: flaggedCount > 0 ? "var(--warning-text)" : undefined },
        { label: "Shells", value: shellCount },
        { label: "Explicit", value: explicitCount },
        { label: "Fallback", value: fallbackCount, tone: fallbackCount > 0 ? "var(--text-secondary)" : undefined }].
        map((stat) =>
        <div key={stat.label} style={{ padding: "6px 8px", borderRadius: "var(--radius-xs)", border: "1px solid var(--accentBorder)", background: "var(--surface-light)", textAlign: "center" }}>
            <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>{stat.label}</div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: stat.tone || "var(--text-primary)" }}>{stat.value}</div>
          </div>
        )}
      </div>
      {Object.keys(typeBreakdown).length > 0 &&
      <div style={{ marginBottom: "8px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "4px" }}>Section Types</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1]).map(([type, count]) =>
          <span key={type} className="showcase-state-chip" style={{ fontSize: "10px", padding: "2px 8px" }}>{type} ({count})</span>
          )}
          </div>
        </div>
      }
      {Object.keys(issueBreakdown).length > 0 &&
      <div style={{ marginBottom: "8px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "4px" }}>Detected Issues</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {Object.entries(issueBreakdown).sort((a, b) => b[1] - a[1]).map(([tag, count]) => {
            const danger = ["rogue-wrapper", "extra-wrapper", "nested-shell", "duplicate-surface"].includes(tag);
            return (
              <span key={tag} style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "var(--radius-pill)", fontSize: "10px", fontWeight: 700, background: danger ? "rgba(var(--danger-rgb), 0.14)" : "rgba(var(--warning-rgb), 0.14)", color: danger ? "var(--danger-text)" : "var(--warning-text)", border: "none" }}>
                  {tag} ({count})
                </span>);

          })}
          </div>
        </div>
      }
      {totalComputed > 0 &&
      <div>
          <button type="button" onClick={() => setTreeExpanded((v) => !v)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 0", background: "none", border: "none", cursor: "pointer", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
            <span style={{ transform: treeExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>&#9654;</span>
            Section Tree ({totalComputed})
          </button>
          {treeExpanded &&
        <div style={{ maxHeight: "280px", overflowY: "auto", padding: "6px 0", fontSize: "11px", fontFamily: "var(--font-family-mono)", lineHeight: 1.6 }}>
              {sorted.map((s) => {
            const depth = (s.number || "").split(".").length - 1;
            const hasIssues = (s.issueTags || []).length > 0;
            return (
              <div key={s.key} style={{ paddingLeft: `${depth * 14}px`, display: "flex", gap: "6px", alignItems: "baseline", color: hasIssues ? "var(--warning-text)" : "var(--text-primary)" }}>
                    <span style={{ fontWeight: 700, minWidth: "40px", color: "var(--text-secondary)" }}>{s.number}</span>
                    <span style={{ fontWeight: 600 }}>{s.key}</span>
                    <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{s.type}</span>
                    {s.isShell && <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "var(--radius-pill)", background: "var(--accent-surface)", border: "1px solid var(--accentBorder)", fontWeight: 700, color: "var(--text-secondary)" }}>shell</span>}
                    {hasIssues && <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "var(--radius-pill)", background: "rgba(var(--warning-rgb), 0.14)", border: "none", fontWeight: 700, color: "var(--warning-text)" }}>{s.issueTags.length}</span>}
                  </div>);

          })}
            </div>
        }
        </div>
      }
      <div style={{ marginTop: "6px", padding: "8px 10px", borderRadius: "var(--radius-sm)", background: "var(--surface-light)", border: "1px solid var(--accentBorder)" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "4px" }}>Keyboard Shortcuts</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px", fontSize: "11px" }}>
          <kbd style={{ padding: "1px 5px", borderRadius: "3px", border: "1px solid var(--accentBorder)", background: "var(--control-bg)", fontFamily: "inherit", fontSize: "10px", fontWeight: 600 }}>Ctrl+Shift+D</kbd>
          <span style={{ color: "var(--text-secondary)" }}>Toggle overlay on/off</span>
          <kbd style={{ padding: "1px 5px", borderRadius: "3px", border: "1px solid var(--accentBorder)", background: "var(--control-bg)", fontFamily: "inherit", fontSize: "10px", fontWeight: 600 }}>Ctrl+Shift+M</kbd>
          <span style={{ color: "var(--text-secondary)" }}>Cycle mode (labels / details / inspect)</span>
        </div>
      </div>
      {!overlay.canAccess &&
      <p className="showcase-card-note" style={{ marginTop: "6px", color: "var(--warning-text)" }}>
          Overlay access requires an authorised dev role. Current user does not have access.
        </p>
      }
    </ShowcaseSection>);

}

function ShowcaseCategoryHeader({ category, visible }) {
  if (!visible) return null;
  return (
    <div
      style={{
        padding: "6px 0 4px",
        marginBottom: "8px",
        borderBottom: "2px solid var(--accentBorder)"
      }}>
      
      <h3
        style={{
          margin: 0,
          fontSize: "11px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "var(--accent-base, var(--primary))"
        }}>
        
        {category}
      </h3>
    </div>);

}

function GlobalUiShowcase() {
  const overlay = useDevLayoutOverlay();
  const { registry, computedSections } = useDevLayoutRegistry();
  const [dropdownState, setDropdownState] = useState(() => getDropdownShowcaseState());
  const [multiSelectState, setMultiSelectState] = useState(() => getMultiSelectShowcaseState());
  const [calendarState, setCalendarState] = useState(() => getCalendarShowcaseState());
  const [timePickerState, setTimePickerState] = useState(() => getTimePickerShowcaseState());
  const [inputState, setInputState] = useState(() => getInputShowcaseState());
  const [tabsState, setTabsState] = useState(() => getTabsShowcaseState());
  const [searchState, setSearchState] = useState(() => getSearchShowcaseState());

  // ── Showcase notes (persisted to database) ──
  const [showcaseNotes, setShowcaseNotes] = useState({});
  const [noteSaving, setNoteSaving] = useState(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    fetch("/api/dev/showcase-notes").
    then((r) => r.json()).
    then((json) => {
      if (json.success && json.data) {
        const loaded = {};
        for (const [key, val] of Object.entries(json.data)) {
          loaded[key] = val.text || "";
        }
        setShowcaseNotes(loaded);
      }
    }).
    catch(() => {});
  }, []);

  const handleNoteChange = useCallback((sectionKey, value) => {
    setShowcaseNotes((prev) => ({ ...prev, [sectionKey]: value }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setNoteSaving(true);
      fetch("/api/dev/showcase-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionKey, noteText: value })
      }).
      catch(() => {}).
      finally(() => setNoteSaving(false));
    }, 600);
  }, []);

  // ── Showcase filter & search ──
  const [showcaseScope, setShowcaseScope] = useState("all");
  const [showcaseSearch, setShowcaseSearch] = useState("");
  const searchLower = showcaseSearch.toLowerCase().trim();

  const isSectionVisible = useCallback((itemKey) => {
    const entry = SHOWCASE_CATALOG[itemKey];
    if (!entry) return true;
    if (showcaseScope !== "all" && entry.scope !== showcaseScope) return false;
    if (searchLower) {
      const haystack = `${entry.category} ${entry.terms} ${itemKey}`.toLowerCase();
      const words = searchLower.split(/\s+/);
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  }, [showcaseScope, searchLower]);

  const visibleCategorySet = new Set();
  for (const [key, entry] of Object.entries(SHOWCASE_CATALOG)) {
    if (isSectionVisible(key)) visibleCategorySet.add(entry.category);
  }
  const [usagePopup, setUsagePopup] = useState(null);
  const openUsage = (itemKey, title) => setUsagePopup({ itemKey, title });
  const closeUsage = () => setUsagePopup(null);
  const dropdownOptions = buildShowcaseOptions(dropdownState.optionCount);
  const multiSelectOptions = buildDepartmentOptions(multiSelectState.optionCount);
  const multiSelectValue = multiSelectState.selectedValues.filter((value) => multiSelectOptions.includes(value));
  const tabItems = buildTabItems(tabsState.tabCount);
  const tabIndexOptions = tabItems.map((item, index) => ({
    value: item.value,
    label: `${index + 1}`
  }));
  const calendarDisabledDates = calendarState.showDisabledDates ? ["2026-04-18", "2026-04-21", "2026-04-26"] : [];
  const calendarHighlightedDates = calendarState.highlightToday ? [new Date()] : [];
  const dropdownSelectedValueIsValid = dropdownOptions.some((option) => option.value === dropdownState.selectedValue);
  const dropdownSelectedValue = dropdownSelectedValueIsValid ? dropdownState.selectedValue : "";
  const inputToneClass = inputState.error ? "showcase-input--error" : inputState.success ? "showcase-input--success" : "";
  const dropdownToneClass = dropdownState.error ? "showcase-field--error" : "";
  const calendarToneClass = calendarState.preset === "error" ? "showcase-field--error" : "";
  const timePickerToneClass = timePickerState.preset === "error" ? "showcase-field--error" : "";
  const searchBarClassName = [
  !searchState.showClear && "showcase-searchbar--hide-clear",
  searchState.loading && "showcase-searchbar--loading"].

  filter(Boolean).
  join(" ");

  return (
    <DevLayoutSection as="aside" sectionKey="user-diagnostic/showcase" sectionType="section-shell" parentKey="user-diagnostic" backgroundToken="" style={{
      width: "440px",
      flexShrink: 0,
      height: "100%",
      overflowY: "auto",
      paddingRight: "4px"
    }}>
      
      <style jsx global>{`
        .showcase-controls {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
          margin-bottom: var(--space-md);
          padding: var(--space-md);
          border-radius: var(--radius-sm);
          background: var(--surface-light);
          border: 1px solid var(--accentBorder);
        }
        .showcase-control-row {
          display: grid;
          grid-template-columns: minmax(110px, 140px) minmax(0, 1fr);
          gap: var(--space-sm);
          align-items: center;
        }
        .showcase-control-row__label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
        }
        .showcase-control-row__control {
          min-width: 0;
        }
        .showcase-toggle-group {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-xs);
        }
        .showcase-preview-stack {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }
        .showcase-inline-meta {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-xs);
          align-items: center;
        }
        .showcase-state-chip {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          border: 1px solid var(--accentBorder);
          background: var(--accentSurface);
          color: var(--text-primary);
          font-size: 11px;
          font-weight: 600;
        }
        .showcase-card-note {
          margin: 0;
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .showcase-field--error .dropdown-api__control,
        .showcase-field--error .calendar-api__control,
        .showcase-field--error .timepicker-api__control,
        .showcase-field--error .searchbar-api {
          border: none;
        }
        .showcase-input--error {
          border: none;
        }
        .showcase-input--success {
          border: none;
        }
        .showcase-searchbar--hide-clear .searchbar-api__clear {
          opacity: 0;
          pointer-events: none;
        }
        .showcase-status-tones {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--space-sm);
        }
        .showcase-status-tone {
          padding: var(--space-sm);
          border-radius: var(--radius-sm);
          border: 1px solid var(--accentBorder);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .showcase-status-tone--amber {
          background: var(--calendar-amber-selected-bg);
        }
        .showcase-status-tone--red {
          background: var(--calendar-red-selected-bg);
        }
        @media (max-width: 640px) {
          .showcase-control-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ── Showcase Filters ──────────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--surfaceMain, var(--surface))",
          paddingBottom: "12px",
          marginBottom: "4px",
          borderBottom: "1px solid var(--accentBorder)"
        }}>
        
        <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
          {[
          { value: "all", label: "All" },
          { value: "global", label: "Global" },
          { value: "non-global", label: "Non-Global" }].
          map((opt) =>
          <button
            key={opt.value}
            type="button"
            onClick={() => setShowcaseScope(opt.value)}
            style={{
              flex: 1,
              padding: "6px 0",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--accentBorder)",
              background: showcaseScope === opt.value ? "var(--accent-base, var(--primary))" : "var(--surface-light)",
              color: showcaseScope === opt.value ? "var(--text-inverse)" : "var(--text-secondary)",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              transition: "background 0.15s, color 0.15s"
            }}>
            
              {opt.label}
            </button>
          )}
        </div>
        <input
          type="text"
          value={showcaseSearch}
          onChange={(e) => setShowcaseSearch(e.target.value)}
          placeholder="Search components, colours, styles…"
          className="app-input"
          style={{
            width: "100%",
            padding: "7px 10px",
            fontSize: "12px",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--accentBorder)",
            background: "var(--surface)",
            color: "var(--text-primary)",
            boxSizing: "border-box"
          }} />
        
        {(showcaseScope !== "all" || searchLower) &&
        <div style={{ marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
              {visibleCategorySet.size} categor{visibleCategorySet.size === 1 ? "y" : "ies"} visible
            </span>
            <button
            type="button"
            onClick={() => {setShowcaseScope("all");setShowcaseSearch("");}}
            style={{
              padding: "2px 8px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--accentBorder)",
              background: "var(--surface-light)",
              color: "var(--text-secondary)",
              fontSize: "10px",
              fontWeight: 600,
              cursor: "pointer"
            }}>
            
              Clear filters
            </button>
          </div>
        }
      </div>

      {/* ── Dev Layout Overlay ────────────────────────────────── */}
      {isSectionVisible("dev-layout-overlay") &&
      <>
        <ShowcaseCategoryHeader category="Dev Tools" visible={visibleCategorySet.has("Dev Tools")} />
        <DevOverlayShowcase overlay={overlay} registry={registry} computedSections={computedSections} onOpenUsage={openUsage} />
        </>
      }

      <ShowcaseCategoryHeader category="Buttons" visible={visibleCategorySet.has("Buttons")} />
      {isSectionVisible("buttons-app-btn") &&
      <ShowcaseSection title="Buttons (.app-btn)" itemKey="buttons-app-btn" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
          <Button variant="primary" pill>Pill</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("interaction-states-buttons") &&
      <ShowcaseSection title="Interaction States — Buttons" itemKey="interaction-states-buttons" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        {/* Simulated state previews use the data-demo-state hooks defined in
             families/buttons.css. Variant rules carry !important, so inline style
             overrides from React cannot paint through — the data-attribute
             selectors in the family file are the one supported way to mock a
             static pseudo-state. Not for production use. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
          <Button variant="primary">Default</Button>
          <button type="button" className="app-btn app-btn--primary" data-demo-state="hover">Hover</button>
          <button type="button" className="app-btn app-btn--primary" data-demo-state="active">Active</button>
          <button type="button" className="app-btn app-btn--primary" data-demo-state="focus">Focus</button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
          hover → --accentHover · active → --accentPressed · focus → --control-ring · disabled → opacity 0.55
        </div>
      </ShowcaseSection>
      }
      <ShowcaseCategoryHeader category="Inputs & Fields" visible={visibleCategorySet.has("Inputs & Fields")} />
      {isSectionVisible("input-app-input") &&
      <ShowcaseSection title="Text Field (.app-input + InputField)" itemKey="input-app-input" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div className="showcase-controls">
          <ShowcaseControlRow label="State preset">
            <DropdownField
              value={inputState.preset}
              onValueChange={(value) => setInputState(getInputShowcaseState(value))}
              options={SHOWCASE_PRESET_OPTIONS}
              placeholder="Choose preset" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Value">
            <InputField value={inputState.value} onChange={(event) => setInputState((current) => ({ ...current, value: event.target.value }))} placeholder="Field value" />
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Placeholder">
            <InputField value={inputState.placeholder} onChange={(event) => setInputState((current) => ({ ...current, placeholder: event.target.value }))} placeholder="Placeholder text" />
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Field states">
            <div className="showcase-toggle-group">
              <ShowcaseToggleButton active={inputState.disabled} onClick={() => setInputState((current) => ({ ...current, disabled: !current.disabled }))}>Disabled</ShowcaseToggleButton>
              <ShowcaseToggleButton active={inputState.error} onClick={() => setInputState((current) => ({ ...current, error: !current.error, success: current.error ? current.success : false }))}>Error</ShowcaseToggleButton>
              <ShowcaseToggleButton active={inputState.success} onClick={() => setInputState((current) => ({ ...current, success: !current.success, error: current.success ? current.error : false }))}>Success</ShowcaseToggleButton>
            </div>
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Reset">
            <Button type="button" size="xs" variant="ghost" onClick={() => setInputState(getInputShowcaseState())}>Reset</Button>
          </ShowcaseControlRow>
        </div>
        <div className="showcase-preview-stack">
          <InputField
            label="Sample input"
            placeholder={inputState.placeholder}
            value={inputState.value}
            disabled={inputState.disabled}
            className={inputToneClass}
            onChange={(event) => setInputState((current) => ({ ...current, value: event.target.value }))} />
          
          {(inputState.error || inputState.success) &&
          <p className="showcase-card-note" style={{ color: inputState.error ? "var(--danger-text)" : "var(--success-text)" }}>
              {inputState.error ? "Error preview: field needs attention." : "Success preview: field looks valid."}
            </p>
          }
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("interaction-states-inputs") &&
      <ShowcaseSection title="Interaction States — Inputs" itemKey="interaction-states-inputs" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input className="app-input" placeholder="Default" />
          <input className="app-input" placeholder="Focus (simulated)" style={{ borderColor: "var(--accentBorderStrong)", boxShadow: "var(--control-ring)" }} />
          <input className="app-input" placeholder="Error" style={{ border: "none" }} />
          <input className="app-input" placeholder="Success" style={{ border: "none" }} />
          <input className="app-input" placeholder="Disabled" disabled />
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("checkboxes-states") &&
      <ShowcaseSection title="Checkboxes — States" itemKey="checkboxes-states" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" /> Unchecked
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" defaultChecked /> Checked
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              ref={(el) => {if (el) el.indeterminate = true;}}
              defaultChecked />
             Indeterminate
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", opacity: 0.55 }}>
            <input type="checkbox" disabled /> Disabled — unchecked
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", opacity: 0.55 }}>
            <input type="checkbox" disabled defaultChecked /> Disabled — checked
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" style={{ boxShadow: "var(--control-ring)", outline: "none" }} /> Focus ring
          </label>
          <div style={{ borderTop: "1px solid var(--accentBorder)", paddingTop: "8px", marginTop: "4px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "6px" }}>Checkbox Group</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "4px" }}>
              {["Sales", "Service", "Parts", "Admin"].map((dept) =>
              <label key={dept} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" defaultChecked={dept === "Sales"} /> {dept}
                </label>
              )}
            </div>
          </div>
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "8px", fontStyle: "italic" }}>
          Currently native. Proposal: &lt;Checkbox&gt; primitive using --control-ring + --primary fill.
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("focus-ring") &&
      <ShowcaseSection title="Focus Ring Standard (--control-ring)" itemKey="focus-ring" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-xs)", boxShadow: "var(--control-ring)", fontWeight: 600, cursor: "pointer" }}>
            
            button :focus-visible ring
          </button>
          <input className="app-input" placeholder="input :focus-visible ring" style={{ boxShadow: "var(--control-ring)", borderColor: "var(--accentBorderStrong)" }} />
          <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
            standard: box-shadow: var(--control-ring) = 0 0 0 3px rgba(accent, 0.12)
          </div>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("form-validation") &&
      <ShowcaseSection title="Form Validation (error / success / helper)" itemKey="form-validation" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--danger-text)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)" }}>Email *</label>
          <input className="app-input" defaultValue="bad@" style={{ border: "none" }} />
          <div style={{ fontSize: "11px", color: "var(--danger-text)" }}>⚠ Enter a valid email address</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
          <label style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--success-text)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)" }}>Username</label>
          <input className="app-input" defaultValue="alice" style={{ border: "none" }} />
          <div style={{ fontSize: "11px", color: "var(--success-text)" }}>✓ Username available</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
          <label style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)" }}>Title</label>
          <input className="app-input" placeholder="Max 40 chars" />
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Helper text describes the field</div>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("field-group") &&
      <ShowcaseSection title="Field Group Pattern (stacked)" itemKey="field-group" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <InputField label="Phone" placeholder="+44 ..." />
      </ShowcaseSection>
      }
      <ShowcaseCategoryHeader category="Dropdowns & Selects" visible={visibleCategorySet.has("Dropdowns & Selects")} />
      {isSectionVisible("dropdown-api") &&
      <ShowcaseSection title="Dropdown (.dropdown-api)" itemKey="dropdown-api" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div className="showcase-controls">
          <ShowcaseControlRow label="State preset">
            <DropdownField
              value={dropdownState.preset}
              onValueChange={(value) => setDropdownState(getDropdownShowcaseState(value))}
              options={SHOWCASE_PRESET_OPTIONS}
              placeholder="Choose preset" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Option count">
            <DropdownField
              value={String(dropdownState.optionCount)}
              onValueChange={(value) =>
              setDropdownState((current) => {
                const optionCount = Number(value);
                const nextOptions = buildShowcaseOptions(optionCount);
                const selectedValue = nextOptions.some((option) => option.value === current.selectedValue) ? current.selectedValue : "";
                return { ...current, optionCount, selectedValue };
              })
              }
              options={SHOWCASE_COUNT_OPTIONS}
              placeholder="Count" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Placeholder">
            <InputField
              value={dropdownState.placeholder}
              onChange={(event) => setDropdownState((current) => ({ ...current, placeholder: event.target.value }))}
              placeholder="Placeholder text" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Selected value">
            <DropdownField
              value={dropdownSelectedValue || "__none__"}
              onValueChange={(value) => setDropdownState((current) => ({ ...current, selectedValue: value === "__none__" ? "" : value }))}
              options={[{ value: "__none__", label: "No selection" }, ...dropdownOptions]}
              placeholder="Select value" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Field states">
            <div className="showcase-toggle-group">
              <ShowcaseToggleButton active={dropdownState.disabled} onClick={() => setDropdownState((current) => ({ ...current, disabled: !current.disabled }))}>Disabled</ShowcaseToggleButton>
              <ShowcaseToggleButton active={dropdownState.error} onClick={() => setDropdownState((current) => ({ ...current, error: !current.error }))}>Error</ShowcaseToggleButton>
            </div>
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Reset">
            <Button type="button" size="xs" variant="ghost" onClick={() => setDropdownState(getDropdownShowcaseState())}>Reset</Button>
          </ShowcaseControlRow>
        </div>
        <div className={`showcase-preview-stack ${dropdownToneClass}`.trim()}>
          <DropdownField
            label="Sample dropdown"
            value={dropdownSelectedValue}
            onValueChange={(value) => setDropdownState((current) => ({ ...current, selectedValue: value }))}
            options={dropdownOptions}
            placeholder={dropdownState.placeholder}
            disabled={dropdownState.disabled}
            helperText={dropdownState.error ? "Error preview: selection is required." : `${dropdownState.optionCount} options loaded.`} />
          
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("multiselect-dropdown") &&
      <ShowcaseSection title="Multi-Select Dropdown (.multiselect-dropdown-api)" itemKey="multiselect-dropdown" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div className="showcase-controls">
          <ShowcaseControlRow label="State preset">
            <DropdownField
              value={multiSelectState.preset}
              onValueChange={(value) => setMultiSelectState(getMultiSelectShowcaseState(value))}
              options={SHOWCASE_PRESET_OPTIONS}
              placeholder="Choose preset" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Option count">
            <DropdownField
              value={String(multiSelectState.optionCount)}
              onValueChange={(value) =>
              setMultiSelectState((current) => {
                const optionCount = Number(value);
                const nextOptions = buildDepartmentOptions(optionCount);
                const selectedValues = current.selectedValues.filter((item) => nextOptions.includes(item)).slice(0, current.maxSelections);
                return { ...current, optionCount, selectedValues };
              })
              }
              options={SHOWCASE_COUNT_OPTIONS}
              placeholder="Count" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Pre-selected">
            <DropdownField
              value={multiSelectState.preselectedMode}
              onValueChange={(value) =>
              setMultiSelectState((current) => {
                const selectedValues = getMultiPresetValues(value, multiSelectOptions, current.maxSelections);
                return { ...current, preselectedMode: value, selectedValues };
              })
              }
              options={SHOWCASE_MULTI_PRESET_OPTIONS}
              placeholder="Choose set" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Max selections">
            <DropdownField
              value={String(multiSelectState.maxSelections)}
              onValueChange={(value) =>
              setMultiSelectState((current) => {
                const maxSelections = Number(value);
                return {
                  ...current,
                  maxSelections,
                  selectedValues: current.selectedValues.slice(0, maxSelections)
                };
              })
              }
              options={SHOWCASE_MAX_SELECTION_OPTIONS}
              placeholder="Max" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Actions">
            <div className="showcase-toggle-group">
              <ShowcaseToggleButton active={multiSelectState.disabled} onClick={() => setMultiSelectState((current) => ({ ...current, disabled: !current.disabled }))}>Disabled</ShowcaseToggleButton>
              <Button type="button" size="xs" variant="ghost" onClick={() => setMultiSelectState((current) => ({ ...current, selectedValues: [], preselectedMode: "none" }))}>Clear all</Button>
            </div>
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Reset">
            <Button type="button" size="xs" variant="ghost" onClick={() => setMultiSelectState(getMultiSelectShowcaseState())}>Reset</Button>
          </ShowcaseControlRow>
        </div>
        <div className="showcase-preview-stack">
          <MultiSelectDropdown
            label="Departments"
            placeholder="Pick departments"
            value={multiSelectValue}
            onChange={(values) =>
            setMultiSelectState((current) => ({
              ...current,
              selectedValues: values.slice(0, current.maxSelections)
            }))
            }
            options={multiSelectOptions}
            disabled={multiSelectState.disabled}
            helperText={
            multiSelectValue.length >= multiSelectState.maxSelections ?
            `Max of ${multiSelectState.maxSelections} selections reached.` :
            `${multiSelectValue.length}/${multiSelectState.maxSelections} selected.`
            } />
          
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Calendar & Time" visible={visibleCategorySet.has("Calendar & Time")} />
      {isSectionVisible("calendar-api") &&
      <ShowcaseSection title="Calendar (.calendar-api)" itemKey="calendar-api" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div className="showcase-controls">
          <ShowcaseControlRow label="State preset">
            <DropdownField
              value={calendarState.preset}
              onValueChange={(value) => setCalendarState(getCalendarShowcaseState(value))}
              options={SHOWCASE_PRESET_OPTIONS}
              placeholder="Choose preset" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Selected date">
            <InputField
              type="date"
              value={calendarState.selectedDate}
              onChange={(event) => setCalendarState((current) => ({ ...current, selectedDate: event.target.value }))} />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Range selection">
            <div className="showcase-toggle-group">
              <ShowcaseToggleButton active={calendarState.rangeSelection} onClick={() => setCalendarState((current) => ({ ...current, rangeSelection: !current.rangeSelection }))}>Toggle</ShowcaseToggleButton>
            </div>
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Today / disabled">
            <div className="showcase-toggle-group">
              <ShowcaseToggleButton active={calendarState.highlightToday} onClick={() => setCalendarState((current) => ({ ...current, highlightToday: !current.highlightToday }))}>Highlight today</ShowcaseToggleButton>
              <ShowcaseToggleButton active={calendarState.showDisabledDates} onClick={() => setCalendarState((current) => ({ ...current, showDisabledDates: !current.showDisabledDates }))}>Disabled dates</ShowcaseToggleButton>
            </div>
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Status tones">
            <DropdownField
              value={calendarState.tonePreview}
              onValueChange={(value) => setCalendarState((current) => ({ ...current, tonePreview: value }))}
              options={SHOWCASE_CALENDAR_TONE_OPTIONS}
              placeholder="Tone preview" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Reset">
            <Button type="button" size="xs" variant="ghost" onClick={() => setCalendarState(getCalendarShowcaseState())}>Reset</Button>
          </ShowcaseControlRow>
        </div>
        <div className={`showcase-preview-stack ${calendarToneClass}`.trim()}>
          <CalendarField
            label="Sample date"
            value={calendarState.selectedDate}
            onValueChange={(value) => setCalendarState((current) => ({ ...current, selectedDate: value }))}
            disabled={calendarState.disabled}
            helperText={calendarState.rangeSelection ? "Range mode is not supported by CalendarField yet. This toggle helps surface the gap." : "CalendarField is running in single-date mode."}
            highlightedDates={calendarHighlightedDates}
            disabledDates={calendarDisabledDates} />
          
          <div className="showcase-status-tones">
            {(calendarState.tonePreview === "both" || calendarState.tonePreview === "amber") &&
            <div className="showcase-status-tone showcase-status-tone--amber">Amber selection token</div>
            }
            {(calendarState.tonePreview === "both" || calendarState.tonePreview === "red") &&
            <div className="showcase-status-tone showcase-status-tone--red">Red selection token</div>
            }
          </div>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("timepicker-api") &&
      <ShowcaseSection title="Time Picker (.timepicker-api)" itemKey="timepicker-api" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div className="showcase-controls">
          <ShowcaseControlRow label="State preset">
            <DropdownField
              value={timePickerState.preset}
              onValueChange={(value) => setTimePickerState(getTimePickerShowcaseState(value))}
              options={SHOWCASE_PRESET_OPTIONS}
              placeholder="Choose preset" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Selected time">
            <InputField
              type="time"
              step={timePickerState.minuteStep * 60}
              value={timePickerState.selectedTime}
              onChange={(event) => setTimePickerState((current) => ({ ...current, selectedTime: event.target.value }))} />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Step interval">
            <DropdownField
              value={String(timePickerState.minuteStep)}
              onValueChange={(value) => setTimePickerState((current) => ({ ...current, minuteStep: Number(value) }))}
              options={SHOWCASE_TIME_STEP_OPTIONS}
              placeholder="Minute step" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Reset">
            <Button type="button" size="xs" variant="ghost" onClick={() => setTimePickerState(getTimePickerShowcaseState())}>Reset</Button>
          </ShowcaseControlRow>
        </div>
        <div className={`showcase-preview-stack ${timePickerToneClass}`.trim()}>
          <TimePickerField
            label="Sample time"
            value={timePickerState.selectedTime}
            onValueChange={(value) => setTimePickerState((current) => ({ ...current, selectedTime: value }))}
            minuteStep={timePickerState.minuteStep}
            disabled={timePickerState.disabled}
            helperText={`12-hour format · ${timePickerState.minuteStep}-minute interval`} />
          
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Search" visible={visibleCategorySet.has("Search")} />
      {isSectionVisible("searchbar-api") &&
      <ShowcaseSection title="Search Bar (.searchbar-api)" itemKey="searchbar-api" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div className="showcase-controls">
          <ShowcaseControlRow label="State preset">
            <DropdownField
              value={searchState.preset}
              onValueChange={(value) => setSearchState(getSearchShowcaseState(value))}
              options={SHOWCASE_PRESET_OPTIONS}
              placeholder="Choose preset" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Input value">
            <InputField
              value={searchState.value}
              onChange={(event) => setSearchState((current) => ({ ...current, value: event.target.value }))}
              placeholder="Search text" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Placeholder">
            <InputField
              value={searchState.placeholder}
              onChange={(event) => setSearchState((current) => ({ ...current, placeholder: event.target.value }))}
              placeholder="Placeholder text" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="UI states">
            <div className="showcase-toggle-group">
              <ShowcaseToggleButton active={searchState.loading} onClick={() => setSearchState((current) => ({ ...current, loading: !current.loading }))}>Loading</ShowcaseToggleButton>
              <ShowcaseToggleButton active={searchState.showClear} onClick={() => setSearchState((current) => ({ ...current, showClear: !current.showClear }))}>Clear button</ShowcaseToggleButton>
            </div>
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Reset">
            <Button type="button" size="xs" variant="ghost" onClick={() => setSearchState(getSearchShowcaseState())}>Reset</Button>
          </ShowcaseControlRow>
        </div>
        <div className="showcase-preview-stack">
          <div className="showcase-inline-meta">
            {searchState.loading && <span className="showcase-state-chip">Loading state</span>}
            {!searchState.showClear && <span className="showcase-state-chip">Clear hidden</span>}
          </div>
          <SearchBar
            className={searchBarClassName}
            value={searchState.value}
            onChange={(event) => setSearchState((current) => ({ ...current, value: event.target.value }))}
            placeholder={searchState.placeholder}
            onClear={searchState.showClear ? () => setSearchState((current) => ({ ...current, value: "" })) : undefined}
            disabled={searchState.disabled} />
          
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Tabs" visible={visibleCategorySet.has("Tabs")} />
      {isSectionVisible("tab-api") &&
      <ShowcaseSection title="Tabs (.tab-api / TabGroup)" itemKey="tab-api" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div className="showcase-controls">
          <ShowcaseControlRow label="State preset">
            <DropdownField
              value={tabsState.preset}
              onValueChange={(value) => setTabsState(getTabsShowcaseState(value))}
              options={SHOWCASE_PRESET_OPTIONS}
              placeholder="Choose preset" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Tab count">
            <DropdownField
              value={String(tabsState.tabCount)}
              onValueChange={(value) =>
              setTabsState((current) => {
                const tabCount = Number(value);
                const nextItems = buildTabItems(tabCount);
                const activeTab = nextItems.some((item) => item.value === current.activeTab) ? current.activeTab : nextItems[0]?.value || "";
                return { ...current, tabCount, activeTab };
              })
              }
              options={SHOWCASE_COUNT_OPTIONS}
              placeholder="Tab count" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Active tab">
            <DropdownField
              value={tabsState.activeTab}
              onValueChange={(value) => setTabsState((current) => ({ ...current, activeTab: value }))}
              options={tabIndexOptions}
              placeholder="Choose tab" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Layout">
            <DropdownField
              value={tabsState.layout}
              onValueChange={(value) => setTabsState((current) => ({ ...current, layout: value }))}
              options={SHOWCASE_TAB_LAYOUT_OPTIONS}
              placeholder="Layout" />
            
          </ShowcaseControlRow>
          <ShowcaseControlRow label="Reset">
            <Button type="button" size="xs" variant="ghost" onClick={() => setTabsState(getTabsShowcaseState())}>Reset</Button>
          </ShowcaseControlRow>
        </div>
        <TabGroup
          ariaLabel="Showcase tabs"
          value={tabsState.activeTab}
          onChange={(value) => setTabsState((current) => ({ ...current, activeTab: value }))}
          items={tabItems}
          layout={tabsState.layout === "grid" ? "grid" : "wrap"}
          stretch={tabsState.layout === "stretch"} />
        
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Badges & Labels" visible={visibleCategorySet.has("Badges & Labels")} />
      {isSectionVisible("app-badge") &&
      <ShowcaseSection title="Labels & Bubbles (.app-badge)" itemKey="app-badge" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <span className="app-badge app-badge--control app-badge--neutral">neutral</span>
          <span className="app-badge app-badge--control app-badge--accent-strong">accent-strong</span>
          <span className="app-badge app-badge--control app-badge--accent-soft">accent-soft</span>
          <span className="app-badge app-badge--control app-badge--accent-hover">accent-hover</span>
          <span className="app-badge app-badge--control app-badge--success">success</span>
          <span className="app-badge app-badge--control app-badge--success-strong">success-strong</span>
          <span className="app-badge app-badge--control app-badge--warning">warning</span>
          <span className="app-badge app-badge--control app-badge--warning-strong">warning-strong</span>
          <span className="app-badge app-badge--control app-badge--danger">danger</span>
          <span className="app-badge app-badge--control app-badge--danger-strong">danger-strong</span>
          <span className="app-badge app-badge--control app-badge--uppercase app-badge--success">uppercase</span>
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary)", fontStyle: "italic", marginTop: "10px" }}>
          Shape comes from .app-badge + .app-badge--control; colour from one tone modifier. Replaces the per-module rules that previously lived in vhc-badge, hr-employees-row-pill, jobcard-tab-badge, multiselect-dropdown-api__tag, SeverityBadge inline styles, and vhcModalContentStyles.badge.
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Colours & Tokens" visible={visibleCategorySet.has("Colours & Tokens")} />
      {isSectionVisible("section-layers") &&
      <ShowcaseSection title="Section Layers (surface / theme alternation)" itemKey="section-layers" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ background: "var(--surfaceMain)", padding: "10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "6px" }}>level 1 — surface colour (--surfaceMain)</div>
          <div style={{ background: "var(--accentSurfaceSubtle)", padding: "10px", borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "6px" }}>level 2 — card background theme colour (--accentSurfaceSubtle)</div>
            <div style={{ background: "var(--surfaceMain)", padding: "10px", borderRadius: "var(--radius-xs)" }}>
              <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "6px" }}>level 3 — surface colour (--surfaceMain)</div>
              <div style={{ background: "var(--accentSurfaceSubtle)", padding: "10px", borderRadius: "var(--radius-xs)" }}>
                <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>level 4 — card background theme colour (--accentSurfaceSubtle)</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary)", fontStyle: "italic", marginTop: "10px" }}>
          Odd levels use surface colour (--surfaceMain); even levels use card background theme colour (--accentSurfaceSubtle). Only two colours — alternating — across all nesting depths.
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("colour-tokens") &&
      <ShowcaseSection title="Colour Tokens" itemKey="colour-tokens" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        {COLOUR_GROUPS.map((group) =>
        <div key={group.title} style={{ marginBottom: "14px" }}>
            <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-secondary)",
              marginBottom: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
            
              {group.title}
            </div>
            <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "8px"
            }}>
            
              {group.swatches.map((token) =>
            <ColourSwatch key={token} token={token} />
            )}
            </div>
          </div>
        )}
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Spacing & Layout" visible={visibleCategorySet.has("Spacing & Layout")} />
      {isSectionVisible("spacing-global") &&
      <ShowcaseSection title="Spacing — Global (--space-* / gutters / layout)" itemKey="spacing-global" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
          {[
          ["space-xs", "4px"], ["space-1", "6px"], ["space-sm", "8px"], ["space-2", "10px"],
          ["space-3", "12px"], ["space-4", "14px"], ["space-md", "16px"], ["space-5", "18px"],
          ["space-6", "20px"], ["space-lg", "24px"], ["space-7", "28px"], ["space-xl", "32px"], ["space-2xl", "48px"]].
          map(([token, px]) =>
          <div key={token} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11px" }}>
              <div style={{ width: `var(--${token})`, height: "10px", background: "var(--accent-strong)", borderRadius: "2px" }} />
              <code style={{ color: "var(--text-secondary)", minWidth: "90px" }}>--{token}</code>
              <span style={{ color: "var(--text-secondary)" }}>{px}</span>
            </div>
          )}
        </div>
        <div style={{ borderTop: "1px solid var(--accentBorder)", paddingTop: "10px", marginTop: "6px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "6px" }}>Layout / Page Tokens</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "11px", color: "var(--text-secondary)" }}>
            <code>--page-gutter-x: 20px</code>
            <code>--page-gutter-y: 18px</code>
            <code>--page-stack-gap: 20px</code>
            <code>--control-gap: 10px</code>
            <code>--layout-card-padding: 24px</code>
            <code>--layout-card-gap: 20px</code>
            <code>--layout-stack-gap: 20px</code>
            <code>--page-card-padding: 24px</code>
            <code>--section-card-padding: 20px</code>
            <code>--section-card-padding-sm: 16px</code>
          </div>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("spacing-comparison") &&
      <ShowcaseSection title="Spacing Comparison (hardcoded ↔ nearest --space-*)" itemKey="spacing-comparison" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px" }}>
          {[
          ["12px", "--space-3 (12px)"],
          ["14px", "--space-4 (14px)"],
          ["16px", "--space-md (16px)"],
          ["18px", "--space-5 (18px)"],
          ["20px", "--space-6 (20px)"],
          ["24px", "--space-lg (24px)"],
          ["28px", "--space-7 (28px)"],
          ["32px", "--space-xl (32px)"],
          ["48px", "--space-2xl (48px)"]].
          map(([raw, tok]) =>
          <div key={raw} style={{ display: "grid", gridTemplateColumns: "80px 1fr 60px", gap: "8px", padding: "6px 8px", background: "var(--surface-light)", borderRadius: "var(--radius-xs)", alignItems: "center" }}>
              <code style={{ color: "var(--danger)", fontWeight: 700 }}>{raw}</code>
              <code style={{ color: "var(--success-text)" }}>{tok}</code>
              <span style={{ color: "var(--success-text)", fontWeight: 700, fontSize: "10px", textAlign: "right" }}>match</span>
            </div>
          )}
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("radius-scale") &&
      <ShowcaseSection title="Radius & Spacing Scale" itemKey="radius-scale" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
          {["xs", "sm", "md", "lg", "xl", "pill"].map((r) =>
          <div key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              <div
              style={{
                width: "44px",
                height: "44px",
                background: "var(--accent-base)",
                borderRadius: `var(--radius-${r})`,
                border: "1px solid var(--accentBorder)"
              }} />
            
              <code style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{r}</code>
            </div>
          )}
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("spacing-non-global") &&
      <ShowcaseSection title="Spacing — Non-Global (per-module hardcoded)" itemKey="spacing-non-global" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px" }}>
          {[
          ["12px", "Job-card row gap, table cell padding"],
          ["14px", "VHC field row gap"],
          ["16px", "VHC EmptyStateMessage padding (alt to --space-md)"],
          ["18px", "VHC EmptyStateMessage padding (login error pad)"],
          ["24px", "Document preview overlay pad, paymentModal pad, job-card section pad"],
          ["30px / 80px", "paymentModal box-shadow offsets"],
          ["1080×640", "VHC modal fixed dimensions"],
          ["min(1180px,100%)", "paymentModal width"],
          ["min(640px,100%)", "popupCardStyles width"],
          ["min(960px,100%)", "popupStyleApi card width"]].
          map(([val, where]) =>
          <div key={val} style={{ display: "flex", gap: "10px", padding: "6px 8px", background: "var(--surface-light)", borderRadius: "var(--radius-xs)" }}>
              <code style={{ color: "var(--primary)", fontWeight: 700, minWidth: "120px" }}>{val}</code>
              <span style={{ color: "var(--text-secondary)" }}>{where}</span>
            </div>
          )}
        </div>
        <p style={{ marginTop: "10px", marginBottom: 0, fontSize: "10px", color: "var(--text-secondary)", fontStyle: "italic" }}>
          These bypass the --space-* scale. Consider replacing with the closest token.
        </p>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Tables" visible={visibleCategorySet.has("Tables")} />
      {isSectionVisible("table-app-data") &&
      <ShowcaseSection title="Table (.app-data-table / .app-table-shell)" itemKey="table-app-data" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div className="app-table-shell app-table-shell--with-headings">
          <table className="app-data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td>Alice</td><td>Tech</td><td><span className="app-badge app-badge--control app-badge--success">Active</span></td></tr>
              <tr><td>Bob</td><td>Service</td><td><span className="app-badge app-badge--control app-badge--neutral">Idle</span></td></tr>
              <tr><td>Carol</td><td>Parts</td><td><span className="app-badge app-badge--control app-badge--neutral">Off</span></td></tr>
            </tbody>
          </table>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("table-states") &&
      <ShowcaseSection title="Table States (empty / loading / hover / selected / actions)" itemKey="table-states" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ padding: "20px", background: "var(--surface-light)", borderRadius: "var(--radius-sm)", textAlign: "center", border: "1px dashed var(--accentBorder)" }}>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 700 }}>Empty table</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>No data yet</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <SkeletonBlock width="100%" height="28px" />
            <SkeletonBlock width="100%" height="28px" />
            <SkeletonBlock width="100%" height="28px" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
            <div style={{ padding: "8px 10px", background: "var(--surface)" }}>Row (default)</div>
            <div style={{ padding: "8px 10px", background: "var(--surface-light)" }}>Row (hover)</div>
            <div style={{ padding: "8px 10px", background: "var(--accent-surface)", borderLeft: "3px solid var(--primary)" }}>Row (selected)</div>
            <div style={{ padding: "8px 10px", background: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Row w/ actions</span>
              <span style={{ display: "flex", gap: "4px" }}>
                <button type="button" style={{ padding: "2px 8px", fontSize: "11px", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-xs)", background: "var(--surface)", cursor: "pointer", fontWeight: 600 }}>Edit</button>
                <button type="button" style={{ padding: "2px 8px", fontSize: "11px", border: "none", color: "var(--danger)", borderRadius: "var(--radius-xs)", background: "var(--surface)", cursor: "pointer", fontWeight: 600 }}>Delete</button>
              </span>
            </div>
          </div>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("non-global-tables") &&
      <ShowcaseSection title="Non-Global Tables" itemKey="non-global-tables" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>myjobs-row (flex grid)</div>
            <div style={{ display: "flex", gap: "8px", padding: "10px", background: "var(--surface)", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-sm)", fontSize: "12px" }}>
              <span style={{ flex: 1 }}>00076</span>
              <span style={{ flex: 1 }}>BMW 320d</span>
              <span style={{ flex: 1 }}><span style={{ padding: "2px 8px", background: "var(--success-surface)", color: "var(--success-text)", borderRadius: "var(--radius-pill)", fontSize: "10px", fontWeight: 700 }}>active</span></span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>partsTable (fixed-layout invoice)</div>
            <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "var(--surface-light)", borderBottom: "2px solid var(--accentBorder)" }}>
                  <th style={{ padding: "6px", textAlign: "left" }}>Part</th>
                  <th style={{ padding: "6px", textAlign: "right" }}>Qty</th>
                  <th style={{ padding: "6px", textAlign: "right" }}>Net</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: "6px" }}>Brake pads</td><td style={{ padding: "6px", textAlign: "right" }}>1</td><td style={{ padding: "6px", textAlign: "right" }}>£42.00</td></tr>
                <tr><td style={{ padding: "6px" }}>Disc</td><td style={{ padding: "6px", textAlign: "right" }}>2</td><td style={{ padding: "6px", textAlign: "right" }}>£88.00</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>VHC item cell</div>
            <div style={{ padding: "12px 16px", background: "var(--control-bg)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 700 }}>BRAKES</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>Front pads — 4mm</div>
            </div>
          </div>
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Popups & Modals" visible={visibleCategorySet.has("Popups & Modals")} />
      {isSectionVisible("popup-global") &&
      <ShowcaseSection title="Popup Styles — Global (popupStyleApi / popupCardStyles)" itemKey="popup-global" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 700, textTransform: "uppercase" }}>popupStyleApi.backdrop</div>
            <div style={{ height: "44px", background: "var(--overlay)", borderRadius: "var(--radius-xs)", border: "1px solid var(--accentBorder)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-inverse)", fontSize: "11px" }}>
              fixed inset 0 · z-index 9999 · padding --space-6
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 700, textTransform: "uppercase" }}>popupStyleApi.card</div>
            <div style={{ background: "var(--surfaceMain)", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-lg)", padding: "12px", fontSize: "11px", color: "var(--text-secondary)" }}>
              min(100%, 960px) · radius-lg · border accentBorder · scrollable
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 700, textTransform: "uppercase" }}>appTheme.popupOverlayStyles</div>
            <div style={{ height: "32px", background: "var(--overlay)", borderRadius: "var(--radius-xs)", border: "1px solid var(--accentBorder)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-inverse)", fontSize: "11px" }}>
              clamp(10px, 2.5vw, 20px) padding · z-index 9999
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 700, textTransform: "uppercase" }}>appTheme.popupCardStyles</div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "12px", fontSize: "11px", color: "var(--text-secondary)" }}>
              min(640px, 100%) · radius-xl · border var(--border) · no shadow
            </div>
          </div>
        </div>
        <p style={{ marginTop: "10px", marginBottom: 0, fontSize: "10px", color: "var(--text-secondary)", fontStyle: "italic" }}>
          Two parallel global popup systems: popupStyleApi.js (newer, --space-* aware) and appTheme.js (legacy clamp-based). Consolidation pending.
        </p>
      </ShowcaseSection>
      }
      {isSectionVisible("confirm-dialogs") &&
      <ShowcaseSection title="Confirmation Dialogs (preview)" itemKey="confirm-dialogs" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ padding: "14px", background: "var(--surface)", border: "none", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--danger-text)", marginBottom: "4px" }}>Delete record?</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px" }}>This action cannot be undone.</div>
            <div style={{ display: "flex", gap: "6px" }}><Button variant="danger" size="sm">Delete</Button><Button variant="ghost" size="sm">Cancel</Button></div>
          </div>
          <div style={{ padding: "14px", background: "var(--surface)", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--info)", marginBottom: "4px" }}>Heads up</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px" }}>Non-destructive confirmation body.</div>
            <div style={{ display: "flex", gap: "6px" }}><Button variant="primary" size="sm">OK</Button></div>
          </div>
          <div style={{ padding: "14px", background: "var(--success-surface)", border: "none", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--success-text)", marginBottom: "4px" }}>✓ Saved successfully</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Success confirmation modal body.</div>
          </div>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("popup-unified-proposal") &&
      <ShowcaseSection title="Popup — Unified Proposal (replaces popupStyleApi + popupCardStyles)" itemKey="popup-unified-proposal" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ background: "var(--overlay)", padding: "20px", borderRadius: "var(--radius-md)" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-xl)", padding: "18px", maxWidth: "320px", margin: "0 auto" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>Unified popup card</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "10px" }}>
              width: min(100%, 960px) · radius-xl · padding --space-6 · --overlay backdrop · z-index var(--z-popover)
            </div>
            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
              <Button variant="ghost" size="sm">Cancel</Button>
              <Button variant="primary" size="sm">Confirm</Button>
            </div>
          </div>
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "8px", fontStyle: "italic" }}>
          Target: merge popupStyleApi.js + appTheme.popupOverlayStyles + popupCardStyles into a single &lt;Popup /&gt; primitive in src/components/ui/.
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("non-global-modals") &&
      <ShowcaseSection title="Non-Global Modal Shells" itemKey="non-global-modals" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ width: "100%", height: "80px", background: "var(--surface)", borderRadius: "var(--section-card-radius)", border: "1px solid var(--accentBorder)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--text-secondary)" }}>
            VHC modal shell — 1080×640, --section-card-radius
          </div>
          <div style={{ width: "100%", height: "80px", background: "var(--surface)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border)", boxShadow: "0 30px 80px rgba(15,23,42,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--text-secondary)" }}>
            paymentModal — min(1180px,100%), shadow + 24px pad
          </div>
          <div style={{ width: "100%", height: "60px", background: "var(--surface)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--text-secondary)" }}>
            popupCardStyles — min(640px,100%)
          </div>
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Cards & Sections" visible={visibleCategorySet.has("Cards & Sections")} />
      {isSectionVisible("global-cards") &&
      <ShowcaseSection title="Global Cards / Sections" itemKey="global-cards" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "10px", lineHeight: 1.5 }}>
          Canonical card hierarchy from globals.css. Every page should nest these in order: <strong>.app-page-shell</strong> → <strong>.app-page-card</strong> → <strong>.app-page-stack</strong> → <strong>.app-section-card</strong>. Use <strong>Section</strong> for titled cards and <strong>Card / SectionCard</strong> for bare wrappers. Do not flatten or invent new wrappers.
        </div>
        <div className="app-page-shell" style={{ padding: "8px" }}>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>.app-page-shell</div>
          <div className="app-page-card">
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>.app-page-card</div>
            <div className="app-page-stack">
              <div className="app-section-card">
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--accentText)", marginBottom: "4px" }}>.app-section-card</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Inner section — equivalent to the Section / Card component.</div>
              </div>
              <div className="app-section-card">
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--accentText)", marginBottom: "4px" }}>.app-section-card</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Stacked siblings use var(--page-stack-gap).</div>
              </div>
            </div>
          </div>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("non-global-cards") &&
      <ShowcaseSection title="Non-Global Cards / Sections" itemKey="non-global-cards" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ background: "var(--control-bg)", padding: "16px", borderRadius: "var(--section-card-radius)", border: "1px solid var(--accentBorder)" }}>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--primary)" }}>vhc-card</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>hover: translateY(-2px) + shadow</div>
          </div>
          <div style={{ background: "var(--page-card-bg)", padding: "var(--section-card-padding)", borderRadius: "var(--section-card-radius)", border: "1px solid var(--accentBorder)" }}>
            <div style={{ fontSize: "13px", fontWeight: 600 }}>customer-portal-card</div>
          </div>
          <div style={{ background: "var(--surface-light)", padding: "var(--section-card-padding)", borderRadius: "var(--section-card-radius)", border: "1px solid var(--accentBorder)", opacity: 0.85 }}>
            <div style={{ fontSize: "13px", fontWeight: 600 }}>customer-portal-card--muted</div>
          </div>
          <div style={{ padding: "var(--space-md) var(--space-6)", background: "var(--control-bg)", borderRadius: "var(--section-card-radius)" }}>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>vhcModal.summaryCard</div>
          </div>
          <div style={{ display: "grid", padding: "var(--space-6)", background: "var(--surface)", borderRadius: "var(--section-card-radius)", border: "1px solid var(--accentBorder)" }}>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>vhcModal.baseCard (hover lifts -3px)</div>
          </div>
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Feedback & Status" visible={visibleCategorySet.has("Feedback & Status")} />
      {isSectionVisible("status-message") &&
      <ShowcaseSection title="Status Messages (.app-status-message)" itemKey="status-message" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <StatusMessage tone="info">Info-tone status message.</StatusMessage>
          <StatusMessage tone="success">Success-tone status message.</StatusMessage>
          <StatusMessage tone="danger">Danger-tone status message.</StatusMessage>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("empty-state-standard") &&
      <ShowcaseSection title="Empty State (standard pattern)" itemKey="empty-state-standard" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ padding: "24px", textAlign: "center", background: "var(--surface-light)", borderRadius: "var(--radius-md)", border: "1px dashed var(--accentBorder)" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📭</div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>No results yet</div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px" }}>Try adjusting your filters or adding a record.</div>
          <Button variant="primary" size="sm">Add record</Button>
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "8px", fontStyle: "italic" }}>
          Replaces ad-hoc empty states (VHC EmptyStateMessage, etc.) with one primitive.
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("toast-notifications") &&
      <ShowcaseSection title="Toast Notifications (proposed)" itemKey="toast-notifications" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
          { tone: "success", bg: "var(--success-surface)", fg: "var(--success-text)", border: "none", msg: "✓ Record saved" },
          { tone: "error", bg: "var(--danger-surface)", fg: "var(--danger-text)", border: "none", msg: "✕ Something went wrong" },
          { tone: "info", bg: "var(--info-surface)", fg: "var(--info)", border: "var(--accentBorder)", msg: "ℹ New message" },
          { tone: "warning", bg: "var(--warning-surface)", fg: "var(--warning-text)", border: "none", msg: "⚠ Action required" }].
          map((t) =>
          <div key={t.tone} style={{ padding: "10px 12px", background: t.bg, color: t.fg, border: `1px solid ${t.border}`, borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 600, boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}>
              {t.msg}
            </div>
          )}
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", fontStyle: "italic" }}>
            Proposal: top-right stack · 320px max-width · 4s auto-dismiss · z-index var(--z-toast) = 2000.
          </div>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("non-global-banners") &&
      <ShowcaseSection title="Non-Global Banners / Alerts" itemKey="non-global-banners" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ padding: "18px", border: "none", background: "var(--info-surface)", color: "var(--info)", borderRadius: "var(--radius-md)", fontSize: "13px" }}>
            VHC EmptyStateMessage (info banner)
          </div>
          <div style={{ background: "rgba(var(--danger-rgb), 0.12)", padding: "10px 14px", borderRadius: "var(--radius-lg)", color: "var(--danger-dark)", fontSize: "13px", fontWeight: 600 }}>
            login-error banner
          </div>
          <div style={{ border: "none", background: "var(--warning-surface)", padding: "16px", borderRadius: "var(--radius-md)", color: "var(--warning-text)", fontSize: "13px" }}>
            releasePromptBox (payment warning)
          </div>
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Loading & Skeletons" visible={visibleCategorySet.has("Loading & Skeletons")} />
      {isSectionVisible("loading-skeleton") &&
      <ShowcaseSection title="Loading Skeletons" itemKey="loading-skeleton" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <SkeletonBlock width="60%" height="14px" />
          <SkeletonBlock width="80%" height="14px" />
          <SkeletonBlock width="40%" height="14px" />
          <div style={{ marginTop: "6px" }}>
            <SkeletonMetricCard />
          </div>
        </div>
      </ShowcaseSection>
      }
      {isSectionVisible("loading-states-expanded") &&
      <ShowcaseSection title="Loading States (expanded)" itemKey="loading-states-expanded" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Button variant="primary" disabled>
            <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", marginRight: "8px", animation: "skeleton-pulse 1s linear infinite", verticalAlign: "middle" }} />
            Saving…
          </Button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
            <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: "2px solid var(--primary)", borderTopColor: "transparent", animation: "skeleton-pulse 1s linear infinite" }} />
            Inline spinner
          </div>
          <div style={{ padding: "18px", background: "var(--surface-light)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "8px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: "3px solid var(--accentBorder)", borderTopColor: "var(--primary)", animation: "skeleton-pulse 1s linear infinite" }} />
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Full-page loader</div>
          </div>
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Navigation" visible={visibleCategorySet.has("Navigation")} />
      {isSectionVisible("navigation-states") &&
      <ShowcaseSection title="Navigation States (sidebar / breadcrumb / pagination)" itemKey="navigation-states" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
          {[
          { state: "default", bg: "var(--nav-link-bg)", color: "var(--text-primary)" },
          { state: "hover", bg: "var(--nav-link-bg-hover)", color: "var(--text-primary)" },
          { state: "active", bg: "var(--nav-link-bg-active)", color: "var(--text-inverse)" }].
          map((n) =>
          <div key={n.state} style={{ padding: "8px 12px", background: n.bg, color: n.color, borderRadius: "var(--radius-xs)", fontSize: "13px", fontWeight: 600 }}>
              Sidebar item ({n.state})
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", marginBottom: "10px", color: "var(--text-secondary)" }}>
          <span>Home</span><span>/</span><span>Accounts</span><span>/</span><span style={{ color: "var(--primary)", fontWeight: 700 }}>Invoices</span>
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
          {["‹", "1", "2", "3", "…", "10", "›"].map((p, i) =>
          <button key={i} type="button" style={{ minWidth: "28px", height: "28px", padding: "0 8px", borderRadius: "var(--radius-xs)", border: "1px solid var(--accentBorder)", background: p === "2" ? "var(--primary)" : "var(--surface)", color: p === "2" ? "var(--text-inverse)" : "var(--text-primary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{p}</button>
          )}
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Scroll" visible={visibleCategorySet.has("Scroll")} />
      {isSectionVisible("scroll-area") &&
      <ShowcaseSection title="Scroll Area (scrollAPI)" itemKey="scroll-area" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <ScrollArea maxHeight="120px" style={{ border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-xs)", padding: "8px" }}>
          {Array.from({ length: 12 }).map((_, i) =>
          <div key={i} style={{ padding: "6px 0", fontSize: "13px", borderBottom: "1px solid var(--surface-light)" }}>
              Scrollable row {i + 1}
            </div>
          )}
        </ScrollArea>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Tooltips" visible={visibleCategorySet.has("Tooltips")} />
      {isSectionVisible("tooltips-native") &&
      <ShowcaseSection title="Tooltips (native title=)" itemKey="tooltips-native" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span
            title="This is the description shown on hover. The app currently relies on the native browser tooltip — there is no centralised styled tooltip component."
            style={{
              display: "inline-block",
              padding: "8px 12px",
              borderRadius: "var(--radius-xs)",
              background: "var(--accentSurface)",
              border: "1px dashed var(--accentBorderStrong)",
              fontSize: "13px",
              color: "var(--text-primary)",
              cursor: "help",
              width: "fit-content"
            }}>
            
            Hover me for a description
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            No global styled tooltip exists. <code>title=</code> uses browser default styling only.
          </span>
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Icons" visible={visibleCategorySet.has("Icons")} />
      {isSectionVisible("icon-system") &&
      <ShowcaseSection title="Icon System (proposed wrapper)" itemKey="icon-system" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="primary"><span style={{ marginRight: "6px" }}>+</span>Icon left</Button>
            <Button variant="secondary">Icon right<span style={{ marginLeft: "6px" }}>→</span></Button>
            <button type="button" aria-label="Menu" style={{ width: "40px", height: "40px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--control-bg)", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-xs)", cursor: "pointer", fontSize: "18px" }}>≡</button>
          </div>
          <div style={{ display: "flex", gap: "14px", alignItems: "center", fontSize: "18px" }}>
            <span style={{ color: "var(--success)" }}>✓</span>
            <span style={{ color: "var(--warning)" }}>!</span>
            <span style={{ color: "var(--danger)" }}>✕</span>
            <span style={{ color: "var(--info)" }}>ℹ</span>
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
            Proposal: wrap an SVG library (e.g. lucide-react) in src/components/ui/Icon.js with size + tone props.
          </div>
        </div>
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Motion & Transitions" visible={visibleCategorySet.has("Motion & Transitions")} />
      {isSectionVisible("motion-transitions") &&
      <ShowcaseSection title="Motion / Transitions" itemKey="motion-transitions" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", marginBottom: "10px" }}>
          {[
          ["--duration-fast: 0.12s", "micro interactions"],
          ["--duration-normal: 0.18s", "hover / focus"],
          ["--duration-slow: 0.3s", "modal open / close"],
          ["--ease-default: ease", "default curve"],
          ["--ease-out: cubic-bezier(0.16, 1, 0.3, 1)", "entrances"],
          ["--control-transition", "bg/border/color/shadow 0.18s ease"]].
          map(([tok, desc]) =>
          <div key={tok} style={{ padding: "6px 8px", background: "var(--surface-light)", borderRadius: "var(--radius-xs)" }}>
              <code style={{ color: "var(--primary)", fontWeight: 700 }}>{tok}</code>
              <span style={{ color: "var(--text-secondary)", marginLeft: "6px" }}>— {desc}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          style={{ padding: "10px 14px", background: "var(--primary)", color: "var(--text-inverse)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 600, transition: "transform var(--duration-normal) var(--ease-out), background-color var(--duration-normal) var(--ease-default)" }}
          onMouseEnter={(e) => {e.currentTarget.style.transform = "translateY(-2px)";}}
          onMouseLeave={(e) => {e.currentTarget.style.transform = "translateY(0)";}}>
          
          Hover me (translateY -2px)
        </button>
        <div style={{ height: "14px", background: "var(--surface-light)", borderRadius: "4px", animation: "skeleton-pulse 1.5s ease-in-out infinite", marginTop: "8px" }} />
      </ShowcaseSection>
      }

      <ShowcaseCategoryHeader category="Reference" visible={visibleCategorySet.has("Reference")} />
      {isSectionVisible("domain-class-families") &&
      <ShowcaseSection title="Domain Class Family Index" itemKey="domain-class-families" onOpenUsage={openUsage} noteText={showcaseNotes} onNoteChange={handleNoteChange} noteSaving={noteSaving}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
          {[
          [".vhc-*", "VHC inspection cards/sections"],
          [".hr-employees-*", "HR directory rows + pills"],
          [".hr-manager-*", "HR manager tab layout"],
          [".myjobs-*", "Job cards table grid"],
          [".jobcard-*", "Job card tab badges"],
          [".login-*", "Login form + buttons"],
          [".customer-portal-*", "Customer portal layout"],
          [".redirect-*", "Redirect page shell"],
          [".paymentModal", "Invoice payment modal"],
          [".partsTable", "Invoice line items table"],
          [".releasePromptBox", "Payment warning banner"],
          [".paymentMethodCard", "Selectable payment option"]].
          map(([name, desc]) =>
          <div key={name} style={{ padding: "6px 8px", background: "var(--surface-light)", borderRadius: "var(--radius-xs)" }}>
              <code style={{ color: "var(--primary)", fontWeight: 700 }}>{name}</code>
              <div style={{ color: "var(--text-secondary)", marginTop: "2px" }}>{desc}</div>
            </div>
          )}
        </div>
      </ShowcaseSection>
      }

      {usagePopup &&
      <UsagePopup
        itemKey={usagePopup.itemKey}
        title={usagePopup.title}
        onClose={closeUsage} />

      }
    </DevLayoutSection>);

}

// ── Deep Diagnostic: API coverage, performance, feature modules, runtime ──

const DEEP_ENDPOINTS = [
{ url: "/api/admin/users", name: "admin/users", section: "API Health" },
{ url: "/api/hr/employees", name: "hr/employees", section: "API Health" },
{ url: "/api/hr/dashboard", name: "hr/dashboard", section: "API Health" },
{ url: "/api/hr/operations", name: "hr/operations", section: "API Health" },
{ url: "/api/hr/attendance", name: "hr/attendance", section: "API Health" },
{ url: "/api/users/roster", name: "users/roster", section: "API Health" },
{ url: "/api/messages/users?q=&limit=10", name: "messages/users", section: "API Health" },
{ url: "/api/messages/threads", name: "messages/threads", section: "API Health" },
{ url: "/api/accounts", name: "accounts", section: "API Health" },
{ url: "/api/invoices", name: "invoices", section: "API Health" },
{ url: "/api/status/snapshot", name: "status/snapshot", section: "API Health" },
{ url: "/api/search/global?q=test", name: "search/global", section: "API Health" },
{ url: "/api/tracking/snapshot", name: "tracking/snapshot", section: "API Health" },
{ url: "/api/settings/company", name: "settings/company", section: "API Health" },
{ url: "/api/parts/summary", name: "parts/summary", section: "API Health" },
{ url: "/api/parts/suppliers", name: "parts/suppliers", section: "API Health" },
{ url: "/api/parts/on-order", name: "parts/on-order", section: "API Health" },
{ url: "/api/company-accounts", name: "company-accounts", section: "API Health" }];


async function pingDeepEndpoints() {
  return Promise.all(
    DEEP_ENDPOINTS.map(async (ep) => {
      const start = typeof performance !== "undefined" ? performance.now() : Date.now();
      try {
        const res = await fetch(ep.url);
        const ms = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - start);
        let body = null;
        try {body = await res.json();} catch {}
        return { ...ep, status: res.status, ok: res.ok, ms, body };
      } catch (e) {
        return { ...ep, status: 0, ok: false, ms: 0, error: String(e) };
      }
    })
  );
}

function testApiCoverage(results) {
  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    return { pass: false, label: "API Coverage", detail: `${failures.length}/${results.length} endpoints failed`, data: failures.map((f) => ({ name: f.name, status: f.status, error: f.error })), section: "API Health" };
  }
  return { pass: true, label: "API Coverage", detail: `All ${results.length} endpoints returned 2xx`, data: results.map((r) => ({ name: r.name, status: r.status, ms: r.ms })), section: "API Health" };
}

function testApiPerformance(results) {
  const successful = results.filter((r) => r.ok);
  if (successful.length === 0) {
    return { pass: false, label: "API Performance", detail: "No successful endpoints to measure", data: null, section: "API Health" };
  }
  const slow = successful.filter((r) => r.ms > 2000);
  const avg = Math.round(successful.reduce((a, r) => a + r.ms, 0) / successful.length);
  const max = Math.max(...successful.map((r) => r.ms));
  const maxEp = successful.find((r) => r.ms === max);
  if (slow.length > 0) {
    return { pass: false, label: "API Performance", detail: `${slow.length} endpoint(s) > 2s · avg ${avg}ms · max ${max}ms (${maxEp?.name})`, data: slow.map((s) => ({ name: s.name, ms: s.ms })), section: "API Health" };
  }
  return { pass: true, label: "API Performance", detail: `All endpoints < 2s · avg ${avg}ms · max ${max}ms (${maxEp?.name})`, data: successful.map((r) => ({ name: r.name, ms: r.ms })).sort((a, b) => b.ms - a.ms), section: "API Health" };
}

function testApiShape(results) {
  const problems = [];
  for (const r of results) {
    if (!r.ok || !r.body) continue;
    const b = r.body;
    const isObject = typeof b === "object" && b !== null;
    const hasSuccessOrData = isObject && ("success" in b || "data" in b || Array.isArray(b));
    if (!hasSuccessOrData) {
      problems.push({ name: r.name, keys: isObject ? Object.keys(b).slice(0, 5) : typeof b });
    }
  }
  if (problems.length > 0) {
    return { pass: false, label: "API Response Shape", detail: `${problems.length} endpoint(s) missing success/data envelope`, data: problems, section: "API Health" };
  }
  return { pass: true, label: "API Response Shape", detail: `All ${results.filter((r) => r.ok).length} successful responses follow { success, data } or array envelope`, data: null, section: "API Health" };
}

function testJobCardsModule(results) {
  const jobCardsEp = results.find((r) => r.name === "status/snapshot");
  if (!jobCardsEp?.ok) {
    return { pass: false, label: "Job Cards Module", detail: "status/snapshot unavailable", data: jobCardsEp, section: "Feature Modules" };
  }
  return { pass: true, label: "Job Cards Module", detail: `Status snapshot reachable (${jobCardsEp.ms}ms)`, data: { status: jobCardsEp.status, hasData: !!jobCardsEp.body }, section: "Feature Modules" };
}

function testPartsModule(results) {
  const summary = results.find((r) => r.name === "parts/summary");
  const suppliers = results.find((r) => r.name === "parts/suppliers");
  const onOrder = results.find((r) => r.name === "parts/on-order");
  const endpoints = [summary, suppliers, onOrder].filter(Boolean);
  const failed = endpoints.filter((e) => !e.ok);
  if (failed.length > 0) {
    return { pass: false, label: "Parts Module", detail: `${failed.length}/${endpoints.length} parts endpoints failed`, data: failed.map((f) => f.name), section: "Feature Modules" };
  }
  return { pass: true, label: "Parts Module", detail: `All ${endpoints.length} parts endpoints healthy (summary, suppliers, on-order)`, data: null, section: "Feature Modules" };
}

function testAccountsModule(results) {
  const accounts = results.find((r) => r.name === "accounts");
  const invoices = results.find((r) => r.name === "invoices");
  const company = results.find((r) => r.name === "company-accounts");
  const endpoints = [accounts, invoices, company].filter(Boolean);
  const failed = endpoints.filter((e) => !e.ok);
  if (failed.length > 0) {
    return { pass: false, label: "Accounts Module", detail: `${failed.length}/${endpoints.length} accounts endpoints failed`, data: failed.map((f) => f.name), section: "Feature Modules" };
  }
  return { pass: true, label: "Accounts Module", detail: "Accounts, invoices, and company-accounts reachable", data: null, section: "Feature Modules" };
}

function testSearchModule(results) {
  const search = results.find((r) => r.name === "search/global");
  if (!search?.ok) {
    return { pass: false, label: "Global Search", detail: "search/global unavailable", data: search, section: "Feature Modules" };
  }
  return { pass: true, label: "Global Search", detail: `Search reachable (${search.ms}ms)`, data: { status: search.status }, section: "Feature Modules" };
}

function testHrDeepModule(results) {
  const ops = results.find((r) => r.name === "hr/operations");
  const att = results.find((r) => r.name === "hr/attendance");
  const failed = [ops, att].filter((e) => e && !e.ok);
  if (failed.length > 0) {
    return { pass: false, label: "HR Deep Endpoints", detail: `${failed.length} HR endpoints failing`, data: failed.map((f) => f.name), section: "Feature Modules" };
  }
  return { pass: true, label: "HR Deep Endpoints", detail: "hr/operations and hr/attendance healthy", data: null, section: "Feature Modules" };
}

function testMessagingDeepModule(results) {
  const threads = results.find((r) => r.name === "messages/threads");
  if (!threads?.ok) {
    return { pass: false, label: "Messaging Threads", detail: "messages/threads unavailable", data: threads, section: "Feature Modules" };
  }
  return { pass: true, label: "Messaging Threads", detail: `Threads endpoint reachable (${threads.ms}ms)`, data: { status: threads.status }, section: "Feature Modules" };
}

function testClientRuntime() {
  if (typeof window === "undefined") {
    return { pass: false, label: "Client Runtime", detail: "Running server-side", data: null, section: "Client Runtime" };
  }
  const checks = {
    fetch: typeof fetch === "function",
    localStorage: (() => {try {window.localStorage.setItem("_hnp_t", "1");window.localStorage.removeItem("_hnp_t");return true;} catch {return false;}})(),
    sessionStorage: (() => {try {window.sessionStorage.setItem("_hnp_t", "1");window.sessionStorage.removeItem("_hnp_t");return true;} catch {return false;}})(),
    documentReady: document.readyState === "complete" || document.readyState === "interactive",
    performance: typeof performance !== "undefined" && typeof performance.now === "function",
    nextData: !!document.getElementById("__NEXT_DATA__")
  };
  const failures = Object.entries(checks).filter(([, v]) => !v);
  if (failures.length > 0) {
    return { pass: false, label: "Client Runtime", detail: `${failures.length} runtime feature(s) missing: ${failures.map(([k]) => k).join(", ")}`, data: checks, section: "Client Runtime" };
  }
  return { pass: true, label: "Client Runtime", detail: "fetch, localStorage, sessionStorage, performance, Next data all available", data: checks, section: "Client Runtime" };
}

function testThemeTokens() {
  if (typeof window === "undefined") {
    return { pass: false, label: "Theme Tokens", detail: "Running server-side", data: null, section: "Client Runtime" };
  }
  const tokens = ["--primary", "--surface", "--text-primary", "--accentBorder", "--radius-md", "--space-md", "--control-ring", "--success", "--danger", "--warning"];
  const styles = getComputedStyle(document.documentElement);
  const values = Object.fromEntries(tokens.map((t) => [t, styles.getPropertyValue(t).trim()]));
  const missing = Object.entries(values).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    return { pass: false, label: "Theme Tokens", detail: `${missing.length} token(s) unresolved: ${missing.join(", ")}`, data: values, section: "Client Runtime" };
  }
  return { pass: true, label: "Theme Tokens", detail: `All ${tokens.length} core theme tokens resolve correctly`, data: values, section: "Client Runtime" };
}

function testActiveTheme() {
  if (typeof window === "undefined") {
    return { pass: false, label: "Active Theme", detail: "Running server-side", data: null, section: "Client Runtime" };
  }
  const dataTheme = document.documentElement.getAttribute("data-theme") || "light";
  const colorScheme = getComputedStyle(document.documentElement).colorScheme || "unknown";
  return { pass: true, label: "Active Theme", detail: `data-theme="${dataTheme}" · color-scheme=${colorScheme}`, data: { dataTheme, colorScheme }, section: "Client Runtime" };
}

function testViewportBreakpoint() {
  if (typeof window === "undefined") {
    return { pass: false, label: "Viewport", detail: "Running server-side", data: null, section: "Client Runtime" };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const bp = w < 640 ? "mobile" : w < 1024 ? "tablet" : w < 1440 ? "desktop" : "wide";
  return { pass: true, label: "Viewport", detail: `${w}×${h}px · ${bp} breakpoint · dpr ${window.devicePixelRatio}`, data: { width: w, height: h, breakpoint: bp, dpr: window.devicePixelRatio }, section: "Client Runtime" };
}

function testTotalDiagnosticTime(startMs, endMs) {
  const total = Math.round(endMs - startMs);
  const pass = total < 10000;
  return {
    pass,
    label: "Diagnostic Total Time",
    detail: `Full deep diagnostic ran in ${total}ms${pass ? "" : " (> 10s, consider batching)"}`,
    data: { totalMs: total, threshold: 10000 },
    section: "Client Runtime"
  };
}

// ── Page Component ──────────────────────────────────────────────

const SECTION_ORDER = ["Core Data", "Profile & Employment", "Cross-System Integration", "Feature Modules", "API Health", "Client Runtime"];

export default function UserDiagnosticDevPage() {
  const router = useRouter();
  const { dbUserId, loading: userLoading } = useUser();
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [promptCopied, setPromptCopied] = useState(false);
  const [developingOpen, setDevelopingOpen] = useState(false);

  const runAllTests = useCallback(async () => {
    setRunning(true);
    setResults(null);
    setExpanded({});

    const startMs = typeof performance !== "undefined" ? performance.now() : Date.now();

    const [
    adminRes, hrRes, rosterRes, profileRes, clockRes, messagesRes, dashboardRes, deepResults] =
    await Promise.all([
    fetch("/api/admin/users").then((r) => r.json()).catch(() => null),
    fetch("/api/hr/employees").then((r) => r.json()).catch(() => null),
    fetch("/api/users/roster").then((r) => r.json()).catch(() => null),
    dbUserId ? fetch(`/api/profile/me?userId=${dbUserId}`).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
    dbUserId ? fetch(`/api/profile/clock?userId=${dbUserId}`).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
    fetch("/api/messages/users?q=&limit=50").then((r) => r.json()).catch(() => null),
    fetch("/api/hr/dashboard").then((r) => r.json()).catch(() => null),
    pingDeepEndpoints()]
    );

    const adminData = adminRes;
    const hrData = hrRes;
    const rosterData = rosterRes;
    const profileData = profileRes;
    const clockData = clockRes;
    const messagesData = messagesRes;
    const dashboardData = dashboardRes;

    const endMs = typeof performance !== "undefined" ? performance.now() : Date.now();

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
    // Feature Modules (from deep ping results)
    testJobCardsModule(deepResults),
    testPartsModule(deepResults),
    testAccountsModule(deepResults),
    testSearchModule(deepResults),
    testHrDeepModule(deepResults),
    testMessagingDeepModule(deepResults),
    // API Health
    testApiCoverage(deepResults),
    testApiPerformance(deepResults),
    testApiShape(deepResults),
    // Client Runtime
    testClientRuntime(),
    testThemeTokens(),
    testActiveTheme(),
    testViewportBreakpoint(),
    testTotalDiagnosticTime(startMs, endMs)]
    );

    setRunning(false);
  }, [dbUserId]);

  if (!canShowDevPages()) {
    return <UserDiagnosticDevPageUi view="section1" />;





  }

  const passCount = results ? results.filter((r) => r.pass).length : 0;
  const totalCount = results ? results.length : 0;

  // Group results by section
  const groupedResults = results ?
  SECTION_ORDER.map((section) => ({
    section,
    items: results.
    map((r, i) => ({ ...r, _index: i })).
    filter((r) => r.section === section)
  })).filter((g) => g.items.length > 0) :
  [];

  return <UserDiagnosticDevPageUi view="section2" DevLayoutSection={DevLayoutSection} developingOpen={developingOpen} expanded={expanded} GlobalUiShowcase={GlobalUiShowcase} groupedResults={groupedResults} onCloseDeveloping={() => setDevelopingOpen(false)} onOpenDeveloping={() => setDevelopingOpen(true)} passCount={passCount} promptCopied={promptCopied} results={results} router={router} runAllTests={runAllTests} running={running} SECTION_ORDER={SECTION_ORDER} setExpanded={setExpanded} setPromptCopied={setPromptCopied} setTimeout={setTimeout} totalCount={totalCount} userLoading={userLoading} />;












































































































































































































}
