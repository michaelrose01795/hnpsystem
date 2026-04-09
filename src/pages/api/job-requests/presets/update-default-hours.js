// file location: src/pages/api/job-requests/presets/update-default-hours.js

import getUserFromRequest from "@/lib/auth/getUserFromRequest";
import { updateJobRequestPresetDefaultHours } from "@/lib/database/jobRequestPresets";
import { isDiagnosticRequestText } from "@/lib/jobRequestPresets/constants";
import { withRoleGuard } from "@/lib/auth/roleGuard";

const MANAGER_ROLE_KEYWORDS = ["admin", "manager", "workshop manager", "service manager"];

const hasPresetWritePermission = (role = "") => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (!normalizedRole) return false;
  return MANAGER_ROLE_KEYWORDS.some((keyword) => normalizedRole.includes(keyword));
};

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const user = await getUserFromRequest(req);
    const role = String(user?.role || "").trim();

    if (!hasPresetWritePermission(role)) {
      res.status(403).json({
        success: false,
        canUsePresets: true,
        canUpdatePresetDefaults: false,
        message: "Preset default updates require Admin/Manager permissions",
      });
      return;
    }

    const presetId = req.body?.presetId ?? null;
    const requestText = String(req.body?.requestText || req.body?.label || "").trim();
    const hours = Number(req.body?.hours);

    if (!Number.isFinite(hours) || hours < 0) {
      res.status(400).json({ success: false, message: "hours must be a non-negative number" });
      return;
    }

    const result = await updateJobRequestPresetDefaultHours({
      presetId,
      requestText,
      defaultHours: hours,
      forceDiagnosticHours: isDiagnosticRequestText(requestText),
    });

    if (!result?.success) {
      res.status(200).json({
        success: true,
        updated: false,
        matched: false,
        message: result?.reason || "No matching preset found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      updated: true,
      matched: result.matched,
      diagnosticApplied: result.diagnosticApplied,
      preset: result.preset,
    });
  } catch (error) {
    console.error("Failed to update request preset default hours", error);
    res.status(500).json({ success: false, message: "Failed to update preset default hours" });
  }
}

export default withRoleGuard(handler);
