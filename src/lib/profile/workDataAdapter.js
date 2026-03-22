function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

export function adaptWorkProfileData(profilePayload = {}) {
  const profile = profilePayload?.profile || null;
  const attendanceLogs = Array.isArray(profilePayload?.attendanceLogs) ? profilePayload.attendanceLogs : [];
  const leaveBalance = profilePayload?.leaveBalance || null;
  const { start, end } = getCurrentCycleBounds();

  let hoursWorked = 0;
  let overtimeHours = 0;

  attendanceLogs.forEach((entry) => {
    if (!entry?.date) return;
    const entryDate = new Date(entry.date);
    if (Number.isNaN(entryDate.getTime()) || entryDate < start || entryDate > end) {
      return;
    }

    const hours = toNumber(entry.totalHours, 0);
    const type = String(entry.type || entry.status || "").toLowerCase();
    hoursWorked += hours;
    if (type === "overtime") {
      overtimeHours += hours;
    }
  });

  const hourlyRate = toNumber(profile?.hourlyRate, 0);
  const overtimeRate = toNumber(profile?.overtimeRate, 0);
  const overtimeValue = overtimeHours * overtimeRate;
  const estimatedIncome = hoursWorked * hourlyRate + overtimeValue;

  return {
    hoursWorked: Number(hoursWorked.toFixed(2)),
    overtimeHours: Number(overtimeHours.toFixed(2)),
    overtimeValue: Number(overtimeValue.toFixed(2)),
    estimatedIncome: Number(estimatedIncome.toFixed(2)),
    leaveRemaining: leaveBalance?.remaining ?? null,
  };
}

export default adaptWorkProfileData;
