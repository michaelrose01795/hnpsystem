import { withRoleGuard } from "@/lib/auth/roleGuard";
import { getApprovedStaffAbsences } from "@/lib/database/hr";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

const parseDateKey = (value) => {
  if (!DATE_KEY_PATTERN.test(value || "")) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
};

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const startDate = parseDateKey(req.query.start);
  const endDate = parseDateKey(req.query.end);
  const type = String(req.query.type || "").trim();
  const rangeDays = startDate && endDate
    ? Math.floor((endDate.getTime() - startDate.getTime()) / 86400000)
    : -1;

  if (!startDate || !endDate || rangeDays < 0 || rangeDays > MAX_RANGE_DAYS) {
    return res.status(400).json({ success: false, message: "A valid date range of 366 days or fewer is required." });
  }
  if (type.length > 80) {
    return res.status(400).json({ success: false, message: "The absence type is invalid." });
  }

  try {
    const data = await getApprovedStaffAbsences({
      startDate: req.query.start,
      endDate: req.query.end,
      type: type || null,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("/api/staff/absences error", error);
    return res.status(500).json({ success: false, message: "Unable to load staff absences." });
  }
}

export default withRoleGuard(handler);
