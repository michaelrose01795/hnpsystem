function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function getCurrentCycleBounds(referenceDate = new Date()) {
  const day = referenceDate.getDate();
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();

  if (day >= 26) {
    return {
      start: new Date(year, month, 26),
      end: new Date(year, month + 1, 25, 23, 59, 59, 999),
    };
  }

  return {
    start: new Date(year, month - 1, 26),
    end: new Date(year, month, 25, 23, 59, 59, 999),
  };
}

function countLeaveDays(leaveRequests = []) {
  return (leaveRequests || []).reduce(
    (sum, request) => sum + toNumber(request?.totalDays, 0),
    0
  );
}

export function adaptWorkProfileData(profilePayload = {}) {
  const profile = profilePayload?.profile || null;
  const attendanceLogs = Array.isArray(profilePayload?.attendanceLogs) ? profilePayload.attendanceLogs : [];
  const overtimeSessions = Array.isArray(profilePayload?.overtimeSessions) ? profilePayload.overtimeSessions : [];
  const leaveBalance = profilePayload?.leaveBalance || null;
  const leaveRequests = Array.isArray(profilePayload?.leaveRequests) ? profilePayload.leaveRequests : [];
  const { start, end } = getCurrentCycleBounds();

  let hoursWorked = 0;

  attendanceLogs.forEach((entry) => {
    if (!entry?.date) return;
    const entryDate = new Date(entry.date);
    if (Number.isNaN(entryDate.getTime()) || entryDate < start || entryDate > end) {
      return;
    }

    hoursWorked += toNumber(entry.totalHours, 0);
  });

  const overtimeHours = overtimeSessions.reduce((sum, session) => sum + toNumber(session?.totalHours, 0), 0);
  const hourlyRate = toNumber(profile?.hourlyRate, 0);
  const overtimeRate = toNumber(profile?.overtimeRate, 0);
  const annualSalary = toNumber(firstDefined(profile?.annualSalary, profile?.annual_salary), 0);
  const contractedWeeklyHours = toNumber(
    firstDefined(
      profile?.contractedWeeklyHours,
      profile?.contracted_hours_per_week,
      profile?.weeklyHours,
      profile?.hoursPerWeek
    ),
    0
  );
  const baseMonthlyFromSalary = annualSalary > 0 ? annualSalary / 12 : 0;
  const overtimeValue = overtimeHours * (overtimeRate || hourlyRate);
  const estimatedIncome = baseMonthlyFromSalary > 0
    ? baseMonthlyFromSalary + overtimeValue
    : (hoursWorked * hourlyRate) + overtimeValue;

  return {
    hoursWorked: Number(hoursWorked.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2)),
    overtimeValue: Number(overtimeValue.toFixed(2)),
    estimatedIncome: Number(estimatedIncome.toFixed(2)),
    contractedWeeklyHours: Number(contractedWeeklyHours.toFixed(2)),
    hourlyRate: Number(hourlyRate.toFixed(2)),
    overtimeRate: Number(overtimeRate.toFixed(2)),
    annualSalary: Number(annualSalary.toFixed(2)),
    leaveRemaining: leaveBalance?.remaining ?? null,
    leaveTaken: leaveBalance?.taken ?? countLeaveDays(leaveRequests),
    leaveAllowance: leaveBalance?.entitlement ?? null,
    leaveRequests,
    overtimeSessions,
  };
}

export default adaptWorkProfileData;
