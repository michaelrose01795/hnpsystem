// file location: src/pages/api/jobcards/[jobNumber]/position.js
import {
  getJobByNumberOrReg,
  updateJobPosition,
} from "@/lib/database/jobs";

const normalizeJobNumber = (value) => {
  if (!value) return "";
  return String(value).trim().toUpperCase();
};

const normalisePositionPayload = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default async function handler(req, res) {
  const jobNumber = normalizeJobNumber(req.query.jobNumber);

  if (!jobNumber) {
    return res.status(400).json({ message: "Job number is required" });
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed for position` });
  }

  try {
    const job = await getJobByNumberOrReg(jobNumber);
    if (!job) {
      return res
        .status(404)
        .json({ message: `Job card ${jobNumber} not found` });
    }

    const { position } = req.body || {};
    const normalisedPosition = normalisePositionPayload(position);

    if (normalisedPosition === null) {
      return res
        .status(400)
        .json({ message: "A valid position value is required" });
    }

    const result = await updateJobPosition(job.id, normalisedPosition);
    return res.status(200).json({
      success: true,
      job: Array.isArray(result) ? result[0] ?? null : result ?? null,
    });
  } catch (error) {
    console.error("❌ Jobcard position API error:", error);
    return res.status(500).json({
      message: "Unexpected error while updating job position",
    });
  }
}
