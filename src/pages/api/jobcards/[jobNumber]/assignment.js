// file location: src/pages/api/jobcards/[jobNumber]/assignment.js
import {
  assignTechnicianToJob,
  getJobByNumberOrReg,
  unassignTechnicianFromJob,
} from "@/lib/database/jobs";

const normalizeJobNumber = (value) => {
  if (!value) return "";
  return String(value).trim().toUpperCase();
};

const ensureJobRecord = async (jobNumber) => {
  if (!jobNumber) {
    return null;
  }
  return getJobByNumberOrReg(jobNumber);
};

const buildSuccessResponse = (jobPayload) => ({
  success: true,
  job: jobPayload || null,
});

export default async function handler(req, res) {
  const jobNumber = normalizeJobNumber(req.query.jobNumber);

  if (!jobNumber) {
    return res.status(400).json({ message: "Job number is required" });
  }

  try {
    const job = await ensureJobRecord(jobNumber);
    if (!job) {
      return res
        .status(404)
        .json({ message: `Job card ${jobNumber} not found` });
    }

    if (req.method === "POST") {
      const { technicianIdentifier, technicianName } = req.body || {};

      if (
        (technicianIdentifier === undefined ||
          technicianIdentifier === null ||
          technicianIdentifier === "") &&
        !technicianName
      ) {
        return res.status(400).json({
          message: "Technician identifier or name is required",
        });
      }

      const result = await assignTechnicianToJob(
        job.id,
        technicianIdentifier ?? technicianName,
        technicianName
      );

      if (!result?.success) {
        return res.status(400).json({
          message:
            result?.error?.message || "Failed to assign technician to job",
        });
      }

      return res.status(200).json(
        buildSuccessResponse(result.data || null)
      );
    }

    if (req.method === "DELETE") {
      const result = await unassignTechnicianFromJob(job.id);
      if (!result?.success) {
        return res.status(400).json({
          message:
            result?.error?.message || "Failed to unassign technician from job",
        });
      }

      return res.status(200).json(buildSuccessResponse(result.data || null));
    }

    res.setHeader("Allow", ["POST", "DELETE"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed for assignment` });
  } catch (error) {
    console.error("❌ Jobcard assignment API error:", error);
    return res.status(500).json({
      message: "Unexpected error while updating job assignment",
    });
  }
}
