// file location: src/pages/api/jobcards/[jobNumber]/write-up.js
import {
  getJobByNumberOrReg,
  getWriteUpByJobNumber,
  saveWriteUpToDatabase,
} from "@/lib/database/jobs";

const normalizeJobNumber = (value) => {
  if (!value) return "";
  return String(value).trim().toUpperCase();
};

export default async function handler(req, res) {
  const jobNumber = normalizeJobNumber(req.query.jobNumber);

  if (!jobNumber) {
    return res.status(400).json({ message: "Job number is required" });
  }

  try {
    if (req.method === "GET") {
      const writeUp = await getWriteUpByJobNumber(jobNumber);
      return res.status(200).json({
        success: true,
        data: writeUp,
      });
    }

    if (req.method === "PUT") {
      const { writeUp } = req.body || {};
      if (!writeUp || typeof writeUp !== "object") {
        return res
          .status(400)
          .json({ message: "Write-up payload is required" });
      }

      const jobCard = await getJobByNumberOrReg(jobNumber);
      if (!jobCard) {
        return res
          .status(404)
          .json({ message: `Job card ${jobNumber} not found` });
      }

      const result = await saveWriteUpToDatabase(jobNumber, writeUp);
      if (!result?.success) {
        return res.status(400).json({
          message: result?.error || "Failed to save write-up",
        });
      }

      return res.status(200).json(result);
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  } catch (error) {
    console.error("❌ Write-up API error:", error);
    return res.status(500).json({
      message: "Unexpected error handling write-up",
    });
  }
}
