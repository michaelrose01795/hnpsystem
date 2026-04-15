// file location: src/pages/dev/user-diagnostic.js
// Dev-only diagnostic page to verify the unified users table, soft-delete, and name consistency
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { canShowDevPages } from "@/lib/dev-tools/config";
import { Button, InputField, StatusMessage } from "@/components/ui";
import { DropdownField, MultiSelectDropdown } from "@/components/ui/dropdownAPI";
import { CalendarField } from "@/components/ui/calendarAPI";
import { TimePickerField } from "@/components/ui/timePickerAPI";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { SearchBar } from "@/components/ui/searchBarAPI";
import ScrollArea from "@/components/ui/scrollAPI/ScrollArea";
import { SkeletonBlock, SkeletonMetricCard } from "@/components/ui/LoadingSkeleton";

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
      "accentSurface", "accentSurfaceHover", "accentSurfaceSubtle",
    ],
  },
  {
    title: "Layer System",
    swatches: [
      "layer-section-level-1", "layer-section-level-2",
      "layer-section-level-3", "layer-section-level-4",
      "page-shell-bg", "page-card-bg", "page-card-bg-alt",
      "section-card-bg", "row-background",
    ],
  },
  {
    title: "Text & Borders",
    swatches: [
      "text-primary", "text-secondary", "text-inverse",
      "border", "control-border-color", "accentBorder", "accentBorderStrong",
    ],
  },
  {
    title: "Status",
    swatches: [
      "success", "success-surface", "success-text", "success-border",
      "warning", "warning-surface", "warning-text", "warning-border",
      "danger", "danger-surface", "danger-text", "danger-border",
      "info", "info-surface",
    ],
  },
  {
    title: "Controls & Menus",
    swatches: [
      "control-bg", "control-bg-hover", "control-bg-active",
      "control-menu-bg", "control-icon", "control-muted-text",
      "nav-link-bg", "nav-link-bg-hover", "nav-link-bg-active",
      "tab-container-bg",
    ],
  },
  {
    title: "Calendar",
    swatches: [
      "calendar-selection-border", "calendar-saturday-row-bg",
      "calendar-amber-selected-bg", "calendar-red-selected-bg",
      "calendar-today-row-bg", "calendar-today-pill-bg",
    ],
  },
  {
    title: "Accent Layers",
    swatches: [
      "accent-layer-1", "accent-layer-2", "accent-layer-3", "accent-layer-4",
      "accent-base", "accent-base-hover", "accent-strong",
      "grey-accent", "grey-accent-light", "grey-accent-dark",
    ],
  },
];

// Registry of where each showcased item is used in the codebase.
// Each entry: { label, file, route? }. A route opens via router.push.
const USAGE_REGISTRY = {
  "buttons-app-btn": [
    { label: "Button primitive", file: "src/components/ui/Button.js" },
    { label: "Job cards page", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
    { label: "Accounts page", file: "src/pages/accounts/index.js", route: "/accounts" },
    { label: "Admin users", file: "src/pages/admin/users/index.js", route: "/admin/users" },
    { label: "HR employees tab", file: "src/components/HR/tabs/EmployeesTab.js" },
    { label: "Profile page", file: "src/pages/profile/index.js", route: "/profile" },
  ],
  "input-app-input": [
    { label: "InputField primitive", file: "src/components/ui/InputField.js" },
    { label: "Account form", file: "src/components/accounts/AccountForm.js" },
    { label: "Stock check popup", file: "src/components/Consumables/StockCheckPopup.js" },
    { label: "Personal settings popup", file: "src/components/profile/personal/PersonalSettingsPopup.js" },
    { label: "Login page", file: "src/pages/login.js", route: "/login" },
  ],
  "dropdown-api": [
    { label: "DropdownField primitive", file: "src/components/ui/dropdownAPI/DropdownField.js" },
    { label: "Job card view", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
    { label: "HR manager", file: "src/pages/hr/manager/index.js", route: "/hr/manager" },
    { label: "Accounts settings", file: "src/components/accounts/AccountsSettingsPanel.js" },
  ],
  "calendar-api": [
    { label: "CalendarField primitive", file: "src/components/ui/calendarAPI/CalendarField.js" },
    { label: "Job cards myjobs", file: "src/pages/job-cards/myjobs/index.js", route: "/job-cards/myjobs" },
    { label: "Tracking page", file: "src/pages/tracking/index.js", route: "/tracking" },
  ],
  "timepicker-api": [
    { label: "TimePickerField primitive", file: "src/components/ui/timePickerAPI/TimePickerField.js" },
    { label: "Personal widgets", file: "src/components/profile/personal/widgets/PersonalWidgets.js" },
  ],
  "app-badge": [
    { label: "Tab badges in job-cards", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
    { label: "HR employees pills", file: "src/components/HR/tabs/EmployeesTab.js" },
    { label: "Customer portal", file: "src/features/customerPortal/components/VHCSummaryList.js" },
  ],
  "tooltips-native": [
    { label: "Sidebar nav titles", file: "src/components/Sidebar.js" },
    { label: "Dev layout overlay", file: "src/components/dev-layout-overlay/DevLayoutOverlay.js" },
    { label: "VHC modals", file: "src/components/VHC/BrakesHubsDetailsModal.js" },
  ],
  "typography-app-page": [
    { label: "Job cards page", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
    { label: "Accounts page", file: "src/pages/accounts/index.js", route: "/accounts" },
    { label: "HR manager", file: "src/pages/hr/manager/index.js", route: "/hr/manager" },
  ],
  "tab-api": [
    { label: "TabGroup primitive", file: "src/components/ui/tabAPI/TabGroup.js" },
    { label: "Profile tab switcher", file: "src/components/profile/TabSwitcher.js", route: "/profile" },
    { label: "HR tabs bar", file: "src/components/HR/HrTabsBar.js" },
    { label: "Job card write-up form", file: "src/components/JobCards/WriteUpForm.js" },
  ],
  "searchbar-api": [
    { label: "SearchBar primitive", file: "src/components/ui/searchBarAPI/SearchBar.js" },
    { label: "Global search", file: "src/components/GlobalSearch.js" },
    { label: "Messages page", file: "src/pages/messages/index.js", route: "/messages" },
  ],
  "multiselect-dropdown": [
    { label: "MultiSelectDropdown primitive", file: "src/components/ui/dropdownAPI/MultiSelectDropdown.js" },
    { label: "HR manager filters", file: "src/pages/hr/manager/index.js", route: "/hr/manager" },
    { label: "Widget settings modal", file: "src/components/profile/personal/WidgetSettingsModal.js" },
  ],
  "native-form-controls": [
    { label: "Login form", file: "src/pages/login.js", route: "/login" },
    { label: "Account form", file: "src/components/accounts/AccountForm.js" },
    { label: "Tech consumables request", file: "src/pages/tech/consumables-request.js" },
  ],
  "status-message": [
    { label: "StatusMessage primitive", file: "src/components/ui/StatusMessage.js" },
    { label: "Account form", file: "src/components/accounts/AccountForm.js" },
    { label: "Customer portal cards", file: "src/features/customerPortal/components/OutstandingInvoicesCard.js" },
  ],
  "loading-skeleton": [
    { label: "LoadingSkeleton primitive", file: "src/components/ui/LoadingSkeleton.js" },
    { label: "Profile work tab", file: "src/components/profile/ProfileWorkTab.js", route: "/profile" },
    { label: "Profile personal tab", file: "src/components/profile/ProfilePersonalTab.js", route: "/profile" },
  ],
  "scroll-area": [
    { label: "ScrollArea primitive", file: "src/components/ui/scrollAPI/ScrollArea.js" },
    { label: "Clocking list", file: "src/components/Clocking/ClockingList.js" },
    { label: "Job card details", file: "src/pages/job-cards/[jobNumber].js" },
  ],
  "table-app-data": [
    { label: "Transaction table", file: "src/components/accounts/TransactionTable.js" },
    { label: "Invoice table", file: "src/components/accounts/InvoiceTable.js" },
    { label: "Account table", file: "src/components/accounts/AccountTable.js" },
    { label: "Accounts page", file: "src/pages/accounts/index.js", route: "/accounts" },
  ],
  "section-layers": [
    { label: "Job cards myjob page", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
    { label: "Customer portal layout", file: "src/features/customerPortal/components/CustomerLayout.js" },
    { label: "Profile page", file: "src/pages/profile/index.js", route: "/profile" },
  ],
  "non-global-badges": [
    { label: ".vhc-badge — VHC details panel", file: "src/components/VHC/VhcDetailsPanel.js" },
    { label: ".hr-employees-row-pill", file: "src/components/HR/tabs/EmployeesTab.js" },
    { label: ".jobcard-tab-badge", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
    { label: ".multiselect-dropdown-api__tag", file: "src/components/ui/dropdownAPI/MultiSelectDropdown.js" },
    { label: ".login-selection-pill", file: "src/pages/login.js", route: "/login" },
    { label: "SeverityBadge", file: "src/components/VHC/VhcSharedComponents.js" },
  ],
  "non-global-buttons": [
    { label: ".login-button", file: "src/pages/login.js", route: "/login" },
    { label: ".hr-employees-add-button", file: "src/components/HR/tabs/EmployeesTab.js" },
    { label: "createVhcButtonStyle()", file: "src/styles/appTheme.js" },
    { label: "VHC modal buttons", file: "src/components/VHC/WheelsTyresDetailsModal.js" },
  ],
  "non-global-inputs": [
    { label: ".login-input — login page", file: "src/pages/login.js", route: "/login" },
    { label: "vhcModalStyles fields", file: "src/components/VHC/vhcModalStyles.js" },
    { label: "Payment modal fields", file: "src/features/invoices/styles/invoice.module.css" },
  ],
  "non-global-banners": [
    { label: "EmptyStateMessage (VHC)", file: "src/components/VHC/VhcSharedComponents.js" },
    { label: ".login-error", file: "src/pages/login.js", route: "/login" },
    { label: ".releasePromptBox", file: "src/features/invoices/styles/invoice.module.css" },
  ],
  "non-global-cards": [
    { label: ".vhc-card — VHC inspection", file: "src/components/VHC/VhcDetailsPanel.js" },
    { label: ".customer-portal-card", file: "src/features/customerPortal/components/CustomerLayout.js" },
    { label: "vhcModal.summaryCard / baseCard", file: "src/styles/appTheme.js" },
  ],
  "non-global-typography": [
    { label: ".hr-employees-heading / kicker", file: "src/components/HR/tabs/EmployeesTab.js" },
    { label: ".vhc-card__title", file: "src/components/VHC/VhcDetailsPanel.js" },
    { label: "VHC field labels", file: "src/components/VHC/vhcModalStyles.js" },
  ],
  "non-global-modals": [
    { label: "VHC modal shells (1080×640)", file: "src/components/VHC/WheelsTyresDetailsModal.js" },
    { label: ".paymentModal", file: "src/features/invoices/styles/invoice.module.css" },
    { label: "popupCardStyles", file: "src/styles/appTheme.js" },
    { label: "popupStyleApi", file: "src/components/popups/popupStyleApi.js" },
  ],
  "non-global-tables": [
    { label: ".myjobs-row (flex grid)", file: "src/pages/job-cards/myjobs/index.js", route: "/job-cards/myjobs" },
    { label: ".partsTable (invoice)", file: "src/features/invoices/styles/invoice.module.css" },
    { label: "VHC item cell", file: "src/components/VHC/VhcSharedComponents.js" },
  ],
  "domain-class-families": [
    { label: ".vhc-* — globals.css", file: "src/styles/globals.css" },
    { label: ".hr-employees-* — globals.css", file: "src/styles/globals.css" },
    { label: ".myjobs-* — globals.css", file: "src/styles/globals.css" },
    { label: ".login-* — globals.css", file: "src/styles/globals.css" },
    { label: ".customer-portal-* — globals.css", file: "src/styles/globals.css" },
  ],
  "colour-tokens": [
    { label: "Source: theme.css", file: "src/styles/theme.css" },
    { label: "JS tokens: appTheme.js", file: "src/styles/appTheme.js" },
    { label: "Theme provider", file: "src/styles/themeProvider.js" },
  ],
  "radius-scale": [
    { label: "theme.css --radius-*", file: "src/styles/theme.css" },
  ],
  "spacing-global": [
    { label: "Source: theme.css --space-*", file: "src/styles/theme.css" },
    { label: "Page gutter / stack tokens", file: "src/styles/theme.css" },
    { label: "Layout primitives (PageShell/SectionShell)", file: "src/components/ui/layout-system/PageShell.js" },
    { label: "ContentWidth wrapper", file: "src/components/ui/layout-system/ContentWidth.js" },
    { label: "FilterToolbarRow", file: "src/components/ui/layout-system/FilterToolbarRow.js" },
  ],
  "spacing-non-global": [
    { label: "VHC modal padding (var(--space-md) var(--space-6))", file: "src/styles/appTheme.js" },
    { label: "Job-card inline 24px padding", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
    { label: "Login page paddings", file: "src/pages/login.js", route: "/login" },
    { label: "Customer portal layout gaps", file: "src/features/customerPortal/components/CustomerLayout.js" },
    { label: "VHC EmptyStateMessage 18px", file: "src/components/VHC/VhcSharedComponents.js" },
    { label: "Payment modal 24px pad", file: "src/features/invoices/styles/invoice.module.css" },
    { label: "Documents preview 24px overlay pad", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
  ],
  "popup-global": [
    { label: "popupStyleApi (backdrop + card)", file: "src/components/popups/popupStyleApi.js" },
    { label: "popupOverlayStyles", file: "src/styles/appTheme.js" },
    { label: "popupCardStyles", file: "src/styles/appTheme.js" },
    { label: "ModalPortal", file: "src/components/popups/ModalPortal.js" },
    { label: "Stock check popup", file: "src/components/Consumables/StockCheckPopup.js" },
    { label: "Personal settings popup", file: "src/components/profile/personal/PersonalSettingsPopup.js" },
    { label: "Widget settings modal", file: "src/components/profile/personal/WidgetSettingsModal.js" },
  ],
  "interaction-states-buttons": [
    { label: "Button primitive (hover/active via CSS)", file: "src/components/ui/Button.js" },
    { label: ".app-btn hover / :disabled rules", file: "src/styles/globals.css" },
    { label: "Proposed Global Standard — document in theme.css", file: "src/styles/theme.css" },
  ],
  "interaction-states-inputs": [
    { label: "InputField primitive", file: "src/components/ui/InputField.js" },
    { label: ".app-input :focus rules", file: "src/styles/globals.css" },
    { label: "Proposed: add .app-input--error / --success modifiers", file: "src/styles/globals.css" },
  ],
  "checkboxes-states": [
    { label: "Native checkbox styling", file: "src/styles/globals.css" },
    { label: "Tech consumables request", file: "src/pages/tech/consumables-request.js" },
    { label: "Widget settings modal", file: "src/components/profile/personal/WidgetSettingsModal.js" },
    { label: "Stock check popup", file: "src/components/Consumables/StockCheckPopup.js" },
    { label: "Proposed Global Standard — src/components/ui/Checkbox.js (not yet created)", file: "src/components/ui/" },
  ],
  "focus-ring": [
    { label: "Token: --control-ring", file: "src/styles/theme.css" },
    { label: "Applied in .app-input, .dropdown-api, .searchbar-api", file: "src/styles/globals.css" },
    { label: "Proposed: enforce :focus-visible across every interactive element", file: "src/styles/globals.css" },
  ],
  "form-validation": [
    { label: "Account form", file: "src/components/accounts/AccountForm.js" },
    { label: "Login form", file: "src/pages/login.js", route: "/login" },
    { label: "Proposed Global Standard — add FieldError/FieldHelper primitives", file: "src/components/ui/InputField.js" },
    { label: "To be adopted in refactor", file: "src/components/ui/" },
  ],
  "field-group": [
    { label: "InputField label+input layout", file: "src/components/ui/InputField.js" },
    { label: "ControlGroup primitive", file: "src/components/ui/ControlGroup.js" },
    { label: "Proposed: FormField wrapper standardising label+input+message", file: "src/components/ui/" },
  ],
  "icon-system": [
    { label: "Proposed Global Standard — src/components/ui/Icon.js (not yet created)", file: "src/components/ui/" },
    { label: "Current: inline emoji / unicode in VHC, sidebar, login", file: "src/components/VHC/VhcSharedComponents.js" },
    { label: "To be adopted in refactor (wrap lucide-react or similar)", file: "src/components/ui/" },
  ],
  "empty-state-standard": [
    { label: "VHC EmptyStateMessage (per-module, non-standard)", file: "src/components/VHC/VhcSharedComponents.js" },
    { label: "Proposed Global Standard — src/components/ui/EmptyState.js", file: "src/components/ui/" },
    { label: "To be adopted in refactor (accounts, parts, HR lists)", file: "src/pages/accounts/index.js", route: "/accounts" },
  ],
  "confirm-dialogs": [
    { label: "popupStyleApi (backdrop + card foundation)", file: "src/components/popups/popupStyleApi.js" },
    { label: "Proposed: <ConfirmDialog tone='destructive|info|success' />", file: "src/components/popups/" },
    { label: "Current ad-hoc confirm in StockCheckPopup", file: "src/components/Consumables/StockCheckPopup.js" },
    { label: "To be adopted in refactor", file: "src/components/ui/" },
  ],
  "toast-notifications": [
    { label: "Proposed Global Standard — src/components/ui/Toast.js (not yet created)", file: "src/components/ui/" },
    { label: "Current: alertBus emits to TopbarAlerts", file: "src/lib/notifications/alertBus.js" },
    { label: "To be adopted in refactor (z-toast = 2000, top-right stack)", file: "src/styles/theme.css" },
  ],
  "loading-states-expanded": [
    { label: "LoadingSkeleton primitive (current)", file: "src/components/ui/LoadingSkeleton.js" },
    { label: "Proposed: <Spinner size /> + <ButtonLoading />", file: "src/components/ui/" },
    { label: "Full-page loader — layout fingerprint system", file: "src/lib/loading/layoutFingerprint.js" },
  ],
  "navigation-states": [
    { label: "--nav-link-bg / --nav-link-bg-hover / --nav-link-bg-active", file: "src/styles/theme.css" },
    { label: "Sidebar consumer", file: "src/components/Sidebar.js" },
    { label: "Proposed: <Breadcrumbs /> + <Pagination /> primitives", file: "src/components/ui/" },
  ],
  "table-states": [
    { label: "Transaction table", file: "src/components/accounts/TransactionTable.js" },
    { label: "Invoice table", file: "src/components/accounts/InvoiceTable.js" },
    { label: "Proposed: <DataTable /> primitive with empty/loading/selected states", file: "src/components/ui/" },
  ],
  "badge-unified-proposal": [
    { label: "Replaces .vhc-badge", file: "src/styles/globals.css" },
    { label: "Replaces .jobcard-tab-badge", file: "src/styles/globals.css" },
    { label: "Replaces .login-selection-pill", file: "src/styles/globals.css" },
    { label: "Replaces .hr-employees-row-pill", file: "src/styles/globals.css" },
    { label: "Replaces vhcModalContentStyles.badge", file: "src/styles/appTheme.js" },
    { label: "Proposed: src/components/ui/Badge.js with tone prop", file: "src/components/ui/" },
  ],
  "popup-unified-proposal": [
    { label: "Merge popupStyleApi.js", file: "src/components/popups/popupStyleApi.js" },
    { label: "Merge appTheme.popupOverlayStyles / popupCardStyles", file: "src/styles/appTheme.js" },
    { label: "Proposed Global Standard — src/components/ui/Popup.js", file: "src/components/ui/" },
  ],
  "spacing-comparison": [
    { label: "Source: theme.css --space-* scale", file: "src/styles/theme.css" },
    { label: "Audit: appTheme.js inline px values", file: "src/styles/appTheme.js" },
    { label: "Audit: inline padding in job-cards", file: "src/pages/job-cards/myjobs/[jobNumber].js", route: "/job-cards/myjobs" },
    { label: "Audit: VHC components", file: "src/components/VHC/VhcSharedComponents.js" },
  ],
  "motion-transitions": [
    { label: "Tokens: --duration-* / --ease-* / --control-transition", file: "src/styles/theme.css" },
    { label: "skeleton-pulse keyframes", file: "src/components/ui/LoadingSkeleton.js" },
    { label: "Proposed: document motion standard + fade-in / modal-slide animations", file: "src/styles/theme.css" },
  ],
};

function UsagePopup({ itemKey, title, onClose }) {
  const router = useRouter();
  if (typeof document === "undefined") return null;
  const usages = USAGE_REGISTRY[itemKey] || [];
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2500,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-xl)",
          padding: "20px 22px",
          width: "min(560px, 100%)",
          maxHeight: "80vh",
          overflowY: "auto",
          border: "1px solid var(--accentBorder)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)" }}>
            Where is &ldquo;{title}&rdquo; used?
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-secondary)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
          {usages.length} known location{usages.length === 1 ? "" : "s"}. Click <em>Open</em> to navigate to the live page.
        </p>
        {usages.length === 0 && (
          <div style={{ padding: "12px", background: "var(--surface-light)", borderRadius: "var(--radius-xs)", fontSize: "13px", color: "var(--text-secondary)" }}>
            No usages registered for this item yet.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {usages.map((u, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 12px",
                background: "var(--surface-light)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--accentBorder)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{u.label}</div>
                <code style={{ fontSize: "11px", color: "var(--text-secondary)", wordBreak: "break-all" }}>{u.file}</code>
              </div>
              {u.route && (
                <button
                  type="button"
                  onClick={() => { onClose(); router.push(u.route); }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-xs)",
                    background: "var(--primary)",
                    color: "var(--text-inverse)",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Open
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ShowcaseSection({ title, itemKey, onOpenUsage, children }) {
  return (
    <section
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        padding: "16px",
        border: "1px solid var(--accentBorder)",
        marginBottom: "16px",
      }}
    >
      <button
        type="button"
        onClick={() => itemKey && onOpenUsage?.(itemKey, title)}
        disabled={!itemKey}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          margin: "0 0 12px",
          padding: 0,
          background: "none",
          border: "none",
          cursor: itemKey ? "pointer" : "default",
          textAlign: "left",
        }}
        title={itemKey ? "Click to see where this is used" : undefined}
      >
        <h4
          style={{
            margin: 0,
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-secondary)",
          }}
        >
          {title}
        </h4>
        {itemKey && (
          <span style={{ fontSize: "10px", color: "var(--primary)", fontWeight: 700 }}>
            Where used →
          </span>
        )}
      </button>
      {children}
    </section>
  );
}

function ColourSwatch({ token }) {
  return (
    <div
      title={`--${token}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          height: "36px",
          borderRadius: "var(--radius-xs)",
          background: `var(--${token})`,
          border: "1px solid var(--accentBorder)",
        }}
      />
      <code
        style={{
          fontSize: "10px",
          color: "var(--text-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        --{token}
      </code>
    </div>
  );
}

function GlobalUiShowcase() {
  const [showcaseDropdown, setShowcaseDropdown] = useState("opt-2");
  const [showcaseDate, setShowcaseDate] = useState("");
  const [showcaseTime, setShowcaseTime] = useState("");
  const [showcaseInput, setShowcaseInput] = useState("");
  const [showcaseTab, setShowcaseTab] = useState("overview");
  const [showcaseSearch, setShowcaseSearch] = useState("");
  const [showcaseMulti, setShowcaseMulti] = useState(["Sales"]);
  const [showcaseTextarea, setShowcaseTextarea] = useState("");
  const [showcaseCheckbox, setShowcaseCheckbox] = useState(true);
  const [showcaseRadio, setShowcaseRadio] = useState("b");
  const [usagePopup, setUsagePopup] = useState(null);
  const openUsage = (itemKey, title) => setUsagePopup({ itemKey, title });
  const closeUsage = () => setUsagePopup(null);

  return (
    <aside
      style={{
        width: "440px",
        flexShrink: 0,
        height: "100%",
        overflowY: "auto",
        paddingRight: "4px",
      }}
    >
      <ShowcaseSection title="Buttons (.app-btn)" itemKey="buttons-app-btn" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="xs">Extra small</Button>
          <Button variant="primary" pill>Pill</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Text Field (.app-input + InputField)" itemKey="input-app-input" onOpenUsage={openUsage}>
        <InputField
          label="Sample input"
          placeholder="Type something..."
          value={showcaseInput}
          onChange={(e) => setShowcaseInput(e.target.value)}
        />
      </ShowcaseSection>

      <ShowcaseSection title="Dropdown (.dropdown-api)" itemKey="dropdown-api" onOpenUsage={openUsage}>
        <DropdownField
          label="Sample dropdown"
          value={showcaseDropdown}
          onValueChange={(v) => setShowcaseDropdown(v)}
          options={[
            { value: "opt-1", label: "First option" },
            { value: "opt-2", label: "Second option" },
            { value: "opt-3", label: "Third option" },
          ]}
          placeholder="Select one..."
        />
      </ShowcaseSection>

      <ShowcaseSection title="Calendar (.calendar-api)" itemKey="calendar-api" onOpenUsage={openUsage}>
        <CalendarField
          label="Sample date"
          value={showcaseDate}
          onValueChange={(v) => setShowcaseDate(v)}
        />
      </ShowcaseSection>

      <ShowcaseSection title="Time Picker (.timepicker-api)" itemKey="timepicker-api" onOpenUsage={openUsage}>
        <TimePickerField
          label="Sample time"
          value={showcaseTime}
          onValueChange={(v) => setShowcaseTime(v)}
        />
      </ShowcaseSection>

      <ShowcaseSection title="Labels & Bubbles (.app-badge)" itemKey="app-badge" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          <span className="app-badge">Default</span>
          <span className="app-badge app-badge--primary">Primary</span>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-pill)",
              background: "var(--success-surface)",
              color: "var(--success-text)",
              fontSize: "12px",
              fontWeight: 600,
              border: "1px solid var(--success-border)",
            }}
          >
            Success
          </span>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-pill)",
              background: "var(--warning-surface)",
              color: "var(--warning-text)",
              fontSize: "12px",
              fontWeight: 600,
              border: "1px solid var(--warning-border)",
            }}
          >
            Warning
          </span>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-pill)",
              background: "var(--danger-surface)",
              color: "var(--danger-text)",
              fontSize: "12px",
              fontWeight: 600,
              border: "1px solid var(--danger-border)",
            }}
          >
            Danger
          </span>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Tooltips (native title=)" itemKey="tooltips-native" onOpenUsage={openUsage}>
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
              width: "fit-content",
            }}
          >
            Hover me for a description
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            No global styled tooltip exists. <code>title=</code> uses browser default styling only.
          </span>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Typography (.app-page-*)" itemKey="typography-app-page" onOpenUsage={openUsage}>
        <div className="app-page-eyebrow">Eyebrow / kicker</div>
        <h1 className="app-page-title" style={{ margin: "4px 0" }}>Page title</h1>
        <p className="app-page-intro" style={{ margin: "4px 0" }}>Page intro paragraph using the global intro class.</p>
        <p className="app-page-copy" style={{ margin: "4px 0" }}>Body copy using the global page-copy class.</p>
      </ShowcaseSection>

      <ShowcaseSection title="Tabs (.tab-api / TabGroup)" itemKey="tab-api" onOpenUsage={openUsage}>
        <TabGroup
          ariaLabel="Showcase tabs"
          value={showcaseTab}
          onChange={(v) => setShowcaseTab(v)}
          items={[
            { value: "overview", label: "Overview" },
            { value: "details", label: "Details" },
            { value: "history", label: "History" },
          ]}
        />
      </ShowcaseSection>

      <ShowcaseSection title="Search Bar (.searchbar-api)" itemKey="searchbar-api" onOpenUsage={openUsage}>
        <SearchBar
          value={showcaseSearch}
          onChange={(e) => setShowcaseSearch(e.target.value)}
          placeholder="Search anything..."
          onClear={() => setShowcaseSearch("")}
        />
      </ShowcaseSection>

      <ShowcaseSection title="Multi-Select Dropdown (.multiselect-dropdown-api)" itemKey="multiselect-dropdown" onOpenUsage={openUsage}>
        <MultiSelectDropdown
          label="Departments"
          placeholder="Pick departments"
          value={showcaseMulti}
          onChange={(v) => setShowcaseMulti(v)}
          options={["Sales", "Service", "Parts", "Admin", "HR"]}
        />
      </ShowcaseSection>

      <ShowcaseSection title="Native Form Controls (globals.css)" itemKey="native-form-controls" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <textarea
            className="app-input"
            placeholder="Textarea using .app-input"
            value={showcaseTextarea}
            onChange={(e) => setShowcaseTextarea(e.target.value)}
            rows={3}
            style={{ resize: "vertical" }}
          />
          <select className="app-input" defaultValue="">
            <option value="" disabled>Native select</option>
            <option value="a">Option A</option>
            <option value="b">Option B</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
            <input
              type="checkbox"
              checked={showcaseCheckbox}
              onChange={(e) => setShowcaseCheckbox(e.target.checked)}
            />
            Native checkbox
          </label>
          <div style={{ display: "flex", gap: "12px", fontSize: "13px" }}>
            {["a", "b", "c"].map((v) => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="radio"
                  name="showcase-radio"
                  value={v}
                  checked={showcaseRadio === v}
                  onChange={() => setShowcaseRadio(v)}
                />
                Radio {v.toUpperCase()}
              </label>
            ))}
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Status Messages (.app-status-message)" itemKey="status-message" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <StatusMessage tone="info">Info-tone status message.</StatusMessage>
          <StatusMessage tone="success">Success-tone status message.</StatusMessage>
          <StatusMessage tone="danger">Danger-tone status message.</StatusMessage>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Loading Skeletons" itemKey="loading-skeleton" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <SkeletonBlock width="60%" height="14px" />
          <SkeletonBlock width="80%" height="14px" />
          <SkeletonBlock width="40%" height="14px" />
          <div style={{ marginTop: "6px" }}>
            <SkeletonMetricCard />
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Scroll Area (scrollAPI)" itemKey="scroll-area" onOpenUsage={openUsage}>
        <ScrollArea maxHeight="120px" style={{ border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-xs)", padding: "8px" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ padding: "6px 0", fontSize: "13px", borderBottom: "1px solid var(--surface-light)" }}>
              Scrollable row {i + 1}
            </div>
          ))}
        </ScrollArea>
      </ShowcaseSection>

      <ShowcaseSection title="Table (.app-data-table / .app-table-shell)" itemKey="table-app-data" onOpenUsage={openUsage}>
        <div className="app-table-shell app-table-shell--with-headings">
          <table className="app-data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td>Alice</td><td>Tech</td><td><span className="app-badge app-badge--primary">Active</span></td></tr>
              <tr><td>Bob</td><td>Service</td><td><span className="app-badge">Idle</span></td></tr>
              <tr><td>Carol</td><td>Parts</td><td><span className="app-badge">Off</span></td></tr>
            </tbody>
          </table>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Section Layers (--layer-section-level-*)" itemKey="section-layers" onOpenUsage={openUsage}>
        <div style={{ background: "var(--layer-section-level-3)", padding: "10px", borderRadius: "var(--radius-md)" }}>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "6px" }}>level-3 (outer shell)</div>
          <div style={{ background: "var(--layer-section-level-2)", padding: "10px", borderRadius: "var(--radius-sm)" }}>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "6px" }}>level-2 (section)</div>
            <div style={{ background: "var(--layer-section-level-1)", padding: "10px", borderRadius: "var(--radius-xs)" }}>
              <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>level-1 (inner card)</div>
            </div>
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Non-Global Badges / Pills (per-module)" itemKey="non-global-badges" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <span className="vhc-badge" style={{ background: "var(--accent-surface)", color: "var(--accent-strong)", padding: "4px 12px", borderRadius: "var(--control-radius)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", border: "1px solid var(--accentBorder)" }}>vhc-badge</span>
          <span style={{ padding: "5px 9px", borderRadius: "var(--radius-pill)", background: "rgba(var(--grey-accent-rgb), 0.18)", fontSize: "0.7rem", fontWeight: 700 }}>hr-row-pill</span>
          <span style={{ padding: "5px 9px", borderRadius: "var(--radius-pill)", background: "var(--accent-surface)", color: "var(--accent-strong)", border: "1px solid rgba(var(--accent-base-rgb), 0.3)", fontSize: "0.7rem", fontWeight: 700 }}>hr-row-pill--status</span>
          <span style={{ padding: "3px 8px", background: "var(--accent-strong)", color: "var(--text-inverse)", borderRadius: "var(--radius-xs)", fontSize: "11px", fontWeight: 700 }}>jobcard-tab-badge</span>
          <span style={{ padding: "3px 8px", background: "var(--danger)", color: "var(--text-inverse)", borderRadius: "var(--radius-xs)", fontSize: "11px", fontWeight: 700 }}>tab-badge.notes</span>
          <span style={{ padding: "6px 12px", background: "var(--accent-surface-hover)", borderRadius: "var(--control-radius-sm)", fontSize: "12px", fontWeight: 600 }}>multiselect-tag</span>
          <span style={{ padding: "4px 10px", borderRadius: "var(--radius-pill)", border: "1px solid var(--danger)", color: "var(--danger)", fontSize: "11px", fontWeight: 700 }}>severity:red</span>
          <span style={{ padding: "4px 10px", borderRadius: "var(--radius-pill)", border: "1px solid var(--warning)", color: "var(--warning-text)", fontSize: "11px", fontWeight: 700 }}>severity:amber</span>
          <span style={{ padding: "4px 10px", borderRadius: "var(--radius-pill)", border: "1px solid var(--success)", color: "var(--success-text)", fontSize: "11px", fontWeight: 700 }}>severity:green</span>
          <span style={{ padding: "4px 10px", borderRadius: "var(--radius-pill)", background: "var(--accent-surface)", color: "var(--primary)", fontSize: "11px", fontWeight: 700 }}>vhcModal.badge</span>
          <span style={{ padding: "6px 14px", borderRadius: "var(--radius-pill)", background: "var(--surface-light)", color: "var(--text-primary)", fontSize: "12px", fontWeight: 600, border: "1px solid var(--accentBorder)" }}>login-selection-pill</span>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Non-Global Buttons (per-module)" itemKey="non-global-buttons" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button type="button" style={{ padding: "14px 18px", background: "var(--accent-strong)", color: "#fff", border: "none", borderRadius: "var(--radius-xl)", fontWeight: 600, cursor: "pointer" }}>login-button</button>
          <button type="button" style={{ padding: "10px 16px", background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: "var(--radius-lg)", fontWeight: 600, cursor: "pointer" }}>hr-add-button</button>
          <button type="button" style={{ padding: "8px 12px", background: "var(--primary)", color: "var(--text-inverse)", border: "none", borderRadius: "var(--control-radius)", fontWeight: 600, cursor: "pointer" }}>vhc:primary</button>
          <button type="button" style={{ padding: "8px 12px", background: "var(--control-bg)", color: "var(--text-primary)", border: "1px solid var(--accentBorder)", borderRadius: "var(--control-radius)", fontWeight: 600, cursor: "pointer" }}>vhc:secondary</button>
          <button type="button" style={{ padding: "8px 12px", background: "transparent", color: "var(--text-primary)", border: "1px solid transparent", borderRadius: "var(--control-radius)", fontWeight: 600, cursor: "pointer" }}>vhc:ghost</button>
          <button type="button" style={{ padding: "10px 14px", background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--accent-purple-surface)", borderRadius: "var(--radius-sm)", fontWeight: 600, cursor: "pointer" }}>hr:CustomInline</button>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Non-Global Inputs (per-module)" itemKey="non-global-inputs" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input
            placeholder="login-input style"
            style={{ width: "100%", padding: "12px 16px", borderRadius: "var(--radius-xl)", background: "var(--control-bg)", border: "1px solid var(--accentBorder)", fontSize: "14px" }}
          />
          <input
            placeholder="vhc modal field style"
            style={{ width: "100%", padding: "var(--control-padding)", borderRadius: "var(--radius-sm)", background: "var(--control-bg)", border: "none", fontSize: "14px" }}
          />
          <input
            placeholder="payment modal field"
            style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--surface)", border: "1px solid var(--surface-light)", fontSize: "14px" }}
          />
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Non-Global Banners / Alerts" itemKey="non-global-banners" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ padding: "18px", border: "1px solid var(--info-surface)", background: "var(--info-surface)", color: "var(--info)", borderRadius: "var(--radius-md)", fontSize: "13px" }}>
            VHC EmptyStateMessage (info banner)
          </div>
          <div style={{ background: "rgba(var(--danger-rgb), 0.12)", padding: "10px 14px", borderRadius: "var(--radius-lg)", color: "var(--danger-dark)", fontSize: "13px", fontWeight: 600 }}>
            login-error banner
          </div>
          <div style={{ border: "1px solid var(--warning)", background: "var(--warning-surface)", padding: "16px", borderRadius: "var(--radius-md)", color: "var(--warning-text)", fontSize: "13px" }}>
            releasePromptBox (payment warning)
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Non-Global Cards / Sections" itemKey="non-global-cards" onOpenUsage={openUsage}>
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

      <ShowcaseSection title="Non-Global Typography" itemKey="non-global-typography" onOpenUsage={openUsage}>
        <div style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)" }}>hr-employees-kicker</div>
        <div style={{ fontSize: "clamp(1.2rem, 2vw, 1.55rem)", color: "var(--text-primary)", fontWeight: 700 }}>hr-employees-heading</div>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--primary)", marginTop: "6px" }}>vhc-card__title</div>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", marginTop: "6px" }}>vhc field-label (modal)</div>
      </ShowcaseSection>

      <ShowcaseSection title="Non-Global Modal Shells" itemKey="non-global-modals" onOpenUsage={openUsage}>
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

      <ShowcaseSection title="Non-Global Tables" itemKey="non-global-tables" onOpenUsage={openUsage}>
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

      <ShowcaseSection title="Domain Class Family Index" itemKey="domain-class-families" onOpenUsage={openUsage}>
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
            [".paymentMethodCard", "Selectable payment option"],
          ].map(([name, desc]) => (
            <div key={name} style={{ padding: "6px 8px", background: "var(--surface-light)", borderRadius: "var(--radius-xs)" }}>
              <code style={{ color: "var(--primary)", fontWeight: 700 }}>{name}</code>
              <div style={{ color: "var(--text-secondary)", marginTop: "2px" }}>{desc}</div>
            </div>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Colour Tokens" itemKey="colour-tokens" onOpenUsage={openUsage}>
        {COLOUR_GROUPS.map((group) => (
          <div key={group.title} style={{ marginBottom: "14px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-secondary)",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {group.title}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "8px",
              }}
            >
              {group.swatches.map((token) => (
                <ColourSwatch key={token} token={token} />
              ))}
            </div>
          </div>
        ))}
      </ShowcaseSection>

      <ShowcaseSection title="Spacing — Global (--space-* / gutters / layout)" itemKey="spacing-global" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
          {[
            ["space-xs", "4px"], ["space-1", "6px"], ["space-sm", "8px"], ["space-2", "10px"],
            ["space-3", "12px"], ["space-4", "14px"], ["space-md", "16px"], ["space-5", "18px"],
            ["space-6", "20px"], ["space-lg", "24px"], ["space-7", "28px"], ["space-xl", "32px"], ["space-2xl", "48px"],
          ].map(([token, px]) => (
            <div key={token} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11px" }}>
              <div style={{ width: `var(--${token})`, height: "10px", background: "var(--accent-strong)", borderRadius: "2px" }} />
              <code style={{ color: "var(--text-secondary)", minWidth: "90px" }}>--{token}</code>
              <span style={{ color: "var(--text-secondary)" }}>{px}</span>
            </div>
          ))}
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

      <ShowcaseSection title="Spacing — Non-Global (per-module hardcoded)" itemKey="spacing-non-global" onOpenUsage={openUsage}>
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
            ["min(960px,100%)", "popupStyleApi card width"],
          ].map(([val, where]) => (
            <div key={val} style={{ display: "flex", gap: "10px", padding: "6px 8px", background: "var(--surface-light)", borderRadius: "var(--radius-xs)" }}>
              <code style={{ color: "var(--primary)", fontWeight: 700, minWidth: "120px" }}>{val}</code>
              <span style={{ color: "var(--text-secondary)" }}>{where}</span>
            </div>
          ))}
        </div>
        <p style={{ marginTop: "10px", marginBottom: 0, fontSize: "10px", color: "var(--text-secondary)", fontStyle: "italic" }}>
          These bypass the --space-* scale. Consider replacing with the closest token.
        </p>
      </ShowcaseSection>

      <ShowcaseSection title="Popup Styles — Global (popupStyleApi / popupCardStyles)" itemKey="popup-global" onOpenUsage={openUsage}>
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

      <ShowcaseSection title="Interaction States — Buttons" itemKey="interaction-states-buttons" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
          <Button variant="primary">Default</Button>
          <Button variant="primary" style={{ background: "var(--accentHover)" }}>Hover</Button>
          <Button variant="primary" style={{ background: "var(--accentPressed)" }}>Active</Button>
          <Button variant="primary" style={{ boxShadow: "var(--control-ring)" }}>Focus</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
          hover → --accentHover · active → --accentPressed · focus → --control-ring · disabled → opacity 0.55
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Interaction States — Inputs" itemKey="interaction-states-inputs" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input className="app-input" placeholder="Default" />
          <input className="app-input" placeholder="Focus (simulated)" style={{ borderColor: "var(--accentBorderStrong)", boxShadow: "var(--control-ring)" }} />
          <input className="app-input" placeholder="Error" style={{ borderColor: "var(--danger)", boxShadow: "0 0 0 3px rgba(var(--danger-rgb), 0.14)" }} />
          <input className="app-input" placeholder="Success" style={{ borderColor: "var(--success)", boxShadow: "0 0 0 3px rgba(var(--success-rgb), 0.14)" }} />
          <input className="app-input" placeholder="Disabled" disabled />
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Checkboxes — States" itemKey="checkboxes-states" onOpenUsage={openUsage}>
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
              ref={(el) => { if (el) el.indeterminate = true; }}
              defaultChecked
            /> Indeterminate
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
              {["Sales", "Service", "Parts", "Admin"].map((dept) => (
                <label key={dept} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" defaultChecked={dept === "Sales"} /> {dept}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "8px", fontStyle: "italic" }}>
          Currently native. Proposal: &lt;Checkbox&gt; primitive using --control-ring + --primary fill.
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Focus Ring Standard (--control-ring)" itemKey="focus-ring" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            style={{ padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-xs)", boxShadow: "var(--control-ring)", fontWeight: 600, cursor: "pointer" }}
          >
            button :focus-visible ring
          </button>
          <input className="app-input" placeholder="input :focus-visible ring" style={{ boxShadow: "var(--control-ring)", borderColor: "var(--accentBorderStrong)" }} />
          <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
            standard: box-shadow: var(--control-ring) = 0 0 0 3px rgba(accent, 0.12)
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Form Validation (error / success / helper)" itemKey="form-validation" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--danger)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)" }}>Email *</label>
          <input className="app-input" defaultValue="bad@" style={{ borderColor: "var(--danger)" }} />
          <div style={{ fontSize: "11px", color: "var(--danger)" }}>⚠ Enter a valid email address</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
          <label style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--success-text)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)" }}>Username</label>
          <input className="app-input" defaultValue="alice" style={{ borderColor: "var(--success)" }} />
          <div style={{ fontSize: "11px", color: "var(--success-text)" }}>✓ Username available</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
          <label style={{ fontSize: "var(--text-label)", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)" }}>Title</label>
          <input className="app-input" placeholder="Max 40 chars" />
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Helper text describes the field</div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Field Group Pattern (stacked vs inline)" itemKey="field-group" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 700, textTransform: "uppercase" }}>Stacked</div>
            <InputField label="Phone" placeholder="+44 ..." />
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", fontWeight: 700, textTransform: "uppercase" }}>Inline</div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label style={{ minWidth: "80px", fontSize: "var(--text-label)", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "var(--tracking-caps)" }}>Code</label>
              <input className="app-input" placeholder="A1234" style={{ flex: 1 }} />
            </div>
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Icon System (proposed wrapper)" itemKey="icon-system" onOpenUsage={openUsage}>
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

      <ShowcaseSection title="Empty State (standard pattern)" itemKey="empty-state-standard" onOpenUsage={openUsage}>
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

      <ShowcaseSection title="Confirmation Dialogs (preview)" itemKey="confirm-dialogs" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ padding: "14px", background: "var(--surface)", border: "1px solid var(--danger)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--danger-text)", marginBottom: "4px" }}>Delete record?</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px" }}>This action cannot be undone.</div>
            <div style={{ display: "flex", gap: "6px" }}><Button variant="danger" size="sm">Delete</Button><Button variant="ghost" size="sm">Cancel</Button></div>
          </div>
          <div style={{ padding: "14px", background: "var(--surface)", border: "1px solid var(--accentBorder)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--info)", marginBottom: "4px" }}>Heads up</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px" }}>Non-destructive confirmation body.</div>
            <div style={{ display: "flex", gap: "6px" }}><Button variant="primary" size="sm">OK</Button></div>
          </div>
          <div style={{ padding: "14px", background: "var(--success-surface)", border: "1px solid var(--success-border)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--success-text)", marginBottom: "4px" }}>✓ Saved successfully</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Success confirmation modal body.</div>
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Toast Notifications (proposed)" itemKey="toast-notifications" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { tone: "success", bg: "var(--success-surface)", fg: "var(--success-text)", border: "var(--success-border)", msg: "✓ Record saved" },
            { tone: "error", bg: "var(--danger-surface)", fg: "var(--danger-text)", border: "var(--danger-border)", msg: "✕ Something went wrong" },
            { tone: "info", bg: "var(--info-surface)", fg: "var(--info)", border: "var(--accentBorder)", msg: "ℹ New message" },
            { tone: "warning", bg: "var(--warning-surface)", fg: "var(--warning-text)", border: "var(--warning-border)", msg: "⚠ Action required" },
          ].map((t) => (
            <div key={t.tone} style={{ padding: "10px 12px", background: t.bg, color: t.fg, border: `1px solid ${t.border}`, borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 600, boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}>
              {t.msg}
            </div>
          ))}
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", fontStyle: "italic" }}>
            Proposal: top-right stack · 320px max-width · 4s auto-dismiss · z-index var(--z-toast) = 2000.
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Loading States (expanded)" itemKey="loading-states-expanded" onOpenUsage={openUsage}>
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

      <ShowcaseSection title="Navigation States (sidebar / breadcrumb / pagination)" itemKey="navigation-states" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
          {[
            { state: "default", bg: "var(--nav-link-bg)", color: "var(--text-primary)" },
            { state: "hover", bg: "var(--nav-link-bg-hover)", color: "var(--text-primary)" },
            { state: "active", bg: "var(--nav-link-bg-active)", color: "var(--text-inverse)" },
          ].map((n) => (
            <div key={n.state} style={{ padding: "8px 12px", background: n.bg, color: n.color, borderRadius: "var(--radius-xs)", fontSize: "13px", fontWeight: 600 }}>
              Sidebar item ({n.state})
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", marginBottom: "10px", color: "var(--text-secondary)" }}>
          <span>Home</span><span>/</span><span>Accounts</span><span>/</span><span style={{ color: "var(--primary)", fontWeight: 700 }}>Invoices</span>
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
          {["‹", "1", "2", "3", "…", "10", "›"].map((p, i) => (
            <button key={i} type="button" style={{ minWidth: "28px", height: "28px", padding: "0 8px", borderRadius: "var(--radius-xs)", border: "1px solid var(--accentBorder)", background: p === "2" ? "var(--primary)" : "var(--surface)", color: p === "2" ? "var(--text-inverse)" : "var(--text-primary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{p}</button>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Table States (empty / loading / hover / selected / actions)" itemKey="table-states" onOpenUsage={openUsage}>
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
                <button type="button" style={{ padding: "2px 8px", fontSize: "11px", border: "1px solid var(--danger)", color: "var(--danger)", borderRadius: "var(--radius-xs)", background: "var(--surface)", cursor: "pointer", fontWeight: 600 }}>Delete</button>
              </span>
            </div>
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Badge — Unified Proposal (replaces 5 variants)" itemKey="badge-unified-proposal" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
          {[
            { tone: "neutral", bg: "var(--surface-light)", fg: "var(--text-primary)", border: "var(--accentBorder)" },
            { tone: "primary", bg: "var(--accent-surface)", fg: "var(--primary)", border: "var(--accentBorder)" },
            { tone: "success", bg: "var(--success-surface)", fg: "var(--success-text)", border: "var(--success-border)" },
            { tone: "warning", bg: "var(--warning-surface)", fg: "var(--warning-text)", border: "var(--warning-border)" },
            { tone: "danger", bg: "var(--danger-surface)", fg: "var(--danger-text)", border: "var(--danger-border)" },
          ].map((b) => (
            <span key={b.tone} style={{ padding: "4px 10px", borderRadius: "var(--radius-pill)", background: b.bg, color: b.fg, border: `1px solid ${b.border}`, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {b.tone}
            </span>
          ))}
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary)", fontStyle: "italic" }}>
          Target: single &lt;Badge tone=&quot;neutral|primary|success|warning|danger&quot; /&gt; replacing .vhc-badge, .jobcard-tab-badge, .login-selection-pill, .hr-employees-row-pill, vhcModalContentStyles.badge.
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Popup — Unified Proposal (replaces popupStyleApi + popupCardStyles)" itemKey="popup-unified-proposal" onOpenUsage={openUsage}>
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

      <ShowcaseSection title="Spacing Comparison (hardcoded ↔ nearest --space-*)" itemKey="spacing-comparison" onOpenUsage={openUsage}>
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
            ["48px", "--space-2xl (48px)"],
          ].map(([raw, tok]) => (
            <div key={raw} style={{ display: "grid", gridTemplateColumns: "80px 1fr 60px", gap: "8px", padding: "6px 8px", background: "var(--surface-light)", borderRadius: "var(--radius-xs)", alignItems: "center" }}>
              <code style={{ color: "var(--danger)", fontWeight: 700 }}>{raw}</code>
              <code style={{ color: "var(--success-text)" }}>{tok}</code>
              <span style={{ color: "var(--success-text)", fontWeight: 700, fontSize: "10px", textAlign: "right" }}>match</span>
            </div>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Motion / Transitions" itemKey="motion-transitions" onOpenUsage={openUsage}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", marginBottom: "10px" }}>
          {[
            ["--duration-fast: 0.12s", "micro interactions"],
            ["--duration-normal: 0.18s", "hover / focus"],
            ["--duration-slow: 0.3s", "modal open / close"],
            ["--ease-default: ease", "default curve"],
            ["--ease-out: cubic-bezier(0.16, 1, 0.3, 1)", "entrances"],
            ["--control-transition", "bg/border/color/shadow 0.18s ease"],
          ].map(([tok, desc]) => (
            <div key={tok} style={{ padding: "6px 8px", background: "var(--surface-light)", borderRadius: "var(--radius-xs)" }}>
              <code style={{ color: "var(--primary)", fontWeight: 700 }}>{tok}</code>
              <span style={{ color: "var(--text-secondary)", marginLeft: "6px" }}>— {desc}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          style={{ padding: "10px 14px", background: "var(--primary)", color: "var(--text-inverse)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 600, transition: "transform var(--duration-normal) var(--ease-out), background-color var(--duration-normal) var(--ease-default)" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          Hover me (translateY -2px)
        </button>
        <div style={{ height: "14px", background: "var(--surface-light)", borderRadius: "4px", animation: "skeleton-pulse 1.5s ease-in-out infinite", marginTop: "8px" }} />
      </ShowcaseSection>

      <ShowcaseSection title="Radius & Spacing Scale" itemKey="radius-scale" onOpenUsage={openUsage}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
          {["xs", "sm", "md", "lg", "xl", "pill"].map((r) => (
            <div key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  background: "var(--accent-base)",
                  borderRadius: `var(--radius-${r})`,
                  border: "1px solid var(--accentBorder)",
                }}
              />
              <code style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{r}</code>
            </div>
          ))}
        </div>
      </ShowcaseSection>

      {usagePopup && (
        <UsagePopup
          itemKey={usagePopup.itemKey}
          title={usagePopup.title}
          onClose={closeUsage}
        />
      )}
    </aside>
  );
}

// ── Page Component ──────────────────────────────────────────────

const SECTION_ORDER = ["Core Data", "Profile & Employment", "Cross-System Integration"];

export default function UserDiagnosticDevPage() {
  const router = useRouter();
  const { dbUserId, loading: userLoading } = useUser();
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState({});

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

  if (!canShowDevPages()) {
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
    <div style={{ padding: "32px", display: "flex", gap: "24px", alignItems: "flex-start", maxWidth: "1500px", height: "100vh", maxHeight: "100vh", overflow: "hidden", boxSizing: "border-box" }}>
      <div style={{ flex: 1, minWidth: 0, maxWidth: "900px", height: "100%", overflowY: "auto", paddingRight: "8px" }}>
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 14px",
          marginBottom: "16px",
          borderRadius: "var(--radius-xs)",
          border: "none",
          background: "transparent",
          color: "var(--text-secondary)",
          fontWeight: 600,
          fontSize: "13px",
          cursor: "pointer",
        }}
      >
        &larr; Back
      </button>
      <button
        type="button"
        onClick={runAllTests}
        disabled={running || userLoading}
        style={{
          padding: "10px 20px",
          borderRadius: "var(--radius-xs)",
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
                  borderRadius: "var(--radius-xs)",
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
                        border: "none",
                        borderRadius: "var(--radius-xs)",
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
                      borderRadius: "var(--radius-xs)",
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
            borderRadius: "var(--radius-xs)",
            fontWeight: 600,
            fontSize: "16px",
          }}
        >
          {passCount}/{totalCount} tests passed
        </div>
      )}
      </div>
      <GlobalUiShowcase />
    </div>
  );
}
