// file location: src/pages/api/jobcards/create-vhc-item.js
import { upsertVhcIssueRow } from "@/lib/vhc/upsertVhcIssueRow";
import { normalizeSeverity } from "@/lib/vhc/shared";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const {
      jobId,
      jobNumber,
      section,
      subAreaKey,
      sourceKey,
      sourceBucket,
      issueTitle,
      issueDescription,
      issueText,
      measurement,
      labourHours,
      partsCost,
      severity,
      approvalStatus,
      authorizationState,
    } = req.body || {};

    if (!jobId && !jobNumber) {
      return res.status(400).json({ success: false, message: "jobId or jobNumber is required" });
    }

    if (!section || !issueTitle) {
      return res.status(400).json({ success: false, message: "section and issueTitle are required" });
    }

    const { row, identity } = await upsertVhcIssueRow({
      jobId,
      jobNumber,
      section,
      subAreaKey: subAreaKey || issueTitle,
      sourceKey: sourceKey || subAreaKey || issueTitle,
      issue_title: issueTitle,
      issue_description: issueDescription || measurement || "",
      issueText: issueText || issueDescription || measurement || issueTitle,
      sourceBucket: sourceBucket || sourceKey || subAreaKey || "",
      parts_cost: Number(partsCost) || 0,
      labour_hours: labourHours === "" || labourHours === null || labourHours === undefined ? 0 : Number(labourHours) || 0,
      labour_rate_gbp: 85,
      display_status: null,
      approval_status: approvalStatus || (normalizeSeverity(severity) === "green" ? "n/a" : "pending"),
      authorization_state: authorizationState || (normalizeSeverity(severity) === "green" ? "n/a" : null),
      severity: severity || "amber",
    });

    return res.status(200).json({
      success: true,
      vhcId: row?.vhc_id,
      data: row,
      identity,
      message: "VHC check item upserted successfully",
    });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
