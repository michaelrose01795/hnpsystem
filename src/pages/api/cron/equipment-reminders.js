// file location: src/pages/api/cron/equipment-reminders.js
//
//   GET|POST /api/cron/equipment-reminders
//
// Writes Equipment/Tools reminders into the DMS notifications table (the
// "Latest notices" feed on the manager dashboards): overdue and due-soon
// checks, calibration expiry, service due, certificates expiring and faults
// left unresolved for a week or more.
//
// Idempotent — each reminder is keyed in tracking_equipment_reminders, so
// running this hourly or replaying it never sends the same reminder twice.
// Once each morning is enough:
//
//   0 7 * * *   /api/cron/equipment-reminders
//
// Guarded by CRON_SECRET, matching the other cron routes in this folder.

import { runEquipmentReminderSweep } from "@/lib/database/equipment";

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
    const data = await runEquipmentReminderSweep(new Date());
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("/api/cron/equipment-reminders error", error);
    return res.status(500).json({ success: false, message: "The equipment reminder sweep failed." });
  }
}
