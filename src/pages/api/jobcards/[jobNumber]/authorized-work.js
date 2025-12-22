// file location: src/pages/api/jobcards/[jobNumber]/authorized-work.js
import {
  getAuthorizedAdditionalWorkByJob,
  getJobByNumberOrReg,
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

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  }

  try {
    const jobCard = await getJobByNumberOrReg(jobNumber);
    if (!jobCard) {
      return res
        .status(404)
        .json({ message: `Job card ${jobNumber} not found` });
    }

    const items = await getAuthorizedAdditionalWorkByJob(jobCard.id);

    return res.status(200).json({
      success: true,
      jobId: jobCard.id,
      items: Array.isArray(items) ? items : [],
    });
  } catch (error) {
    console.error("❌ Authorized work API error:", error);
    return res.status(500).json({
      message: "Unable to load authorized additional work",
    });
  }
}
