const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function fetchApprovedStaffAbsences({ startDate, endDate, type } = {}) {
  if (!DATE_KEY_PATTERN.test(startDate || "") || !DATE_KEY_PATTERN.test(endDate || "")) {
    throw new Error("A valid absence date range is required.");
  }

  const params = new URLSearchParams({ start: startDate, end: endDate });
  if (type) params.set("type", type);

  const response = await fetch(`/api/staff/absences?${params.toString()}`, {
    credentials: "include",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || "Unable to load staff absences.");
  }
  return Array.isArray(payload.data) ? payload.data : [];
}
