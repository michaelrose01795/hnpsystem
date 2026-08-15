import { withRoleGuard } from "@/lib/auth/roleGuard";
import { EFFICIENCY_VIEW_ROLES } from "@/lib/auth/roles";
import { getOvertimeAsEfficiency } from "@/lib/database/efficiency";

const parseUserIds = (value) => {
  const tokens = String(value || "").split(",");
  if (tokens.some((item) => !/^\d+$/.test(item.trim()))) return [];
  return Array.from(new Set(tokens.map((item) => Number(item.trim()))))
    .filter((item) => Number.isSafeInteger(item) && item > 0);
};

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const userIds = parseUserIds(req.query.userIds);
  const year = Number.parseInt(req.query.year, 10);
  const month = Number.parseInt(req.query.month, 10);
  if (
    userIds.length === 0 || userIds.length > 100 ||
    !Number.isInteger(year) || year < 2000 || year > 2200 ||
    !Number.isInteger(month) || month < 1 || month > 12
  ) {
    return res.status(400).json({ success: false, message: "Valid userIds, year and month are required." });
  }

  try {
    const data = await getOvertimeAsEfficiency(userIds, year, month);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("/api/efficiency/overtime-sessions error", error);
    return res.status(500).json({ success: false, message: "Unable to load overtime efficiency data." });
  }
}

export default withRoleGuard(handler, { allow: EFFICIENCY_VIEW_ROLES });
