import { runAuditMaintenance } from "@/lib/database/auditActivity";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: "Invalid cron credentials." });
  }
  if (!secret && process.env.NODE_ENV === "production") {
    return res.status(503).json({ success: false, message: "CRON_SECRET is not configured." });
  }
  try {
    const result = await runAuditMaintenance({ archive: true });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("/api/cron/audit-maintenance error", error);
    return res.status(500).json({ success: false, message: "Audit maintenance failed." });
  }
}
