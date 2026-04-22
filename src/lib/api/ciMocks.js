// file location: src/lib/api/ciMocks.js
// Deterministic API payloads used by Playwright CI when no real database is available.

export const isPlaywrightCi = () => process.env.PLAYWRIGHT_TEST_AUTH === "1";

export const getCiUserId = (value = null) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

export const buildCiUser = (userId = 1) => ({
  id: userId,
  name: "CI Test User",
  firstName: "CI",
  lastName: "Test User",
  email: "ci-test@example.com",
  role: "Admin",
  department: "Workshop",
});

export const buildCiRoster = () => {
  const user = buildCiUser(1);
  const usersByRoleDetailed = {
    Admin: [user],
    Workshop: [
      {
        ...user,
        role: "Workshop",
      },
    ],
  };

  return {
    usersByRole: {
      Admin: [user.name],
      Workshop: [user.name],
    },
    usersByRoleDetailed,
    allUsers: [user],
  };
};

export const buildCiProfilePayload = (rawUserId = 1) => {
  const userId = getCiUserId(rawUserId);
  const user = buildCiUser(userId);

  return {
    profile: {
      id: `EMP-${userId}`,
      userId,
      name: user.name,
      jobTitle: "CI Smoke Tester",
      department: user.department,
      role: user.role,
      employmentType: "Full-time",
      startDate: "2026-01-01",
      hourlyRate: 0,
      overtimeRate: 0,
      contractedWeeklyHours: 40,
      annualSalary: 0,
      keycloakId: `ci-${userId}`,
      email: user.email,
      phone: "N/A",
      emergencyContact: "Not provided",
      address: "Not provided",
      managerId: null,
      themeMode: "system",
      accentColor: "red",
      dark_mode: "system",
      accent_color: "red",
    },
    attendanceLogs: [],
    overtimeSummary: {
      id: userId,
      periodId: "ci-period",
      status: "In Progress",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      overtimeHours: 0,
      overtimeRate: 1.5,
      bonus: 0,
    },
    overtimeSessions: [],
    leaveBalance: {
      entitlement: 25,
      taken: 0,
      remaining: 25,
    },
    leaveRequests: [],
    staffVehicles: [],
    staffVehiclePayrollDeductions: [],
  };
};

export const buildCiClockStatus = () => ({
  isClockedIn: false,
  activeRecord: null,
});

export const buildCiClockRows = () => [];
