import {
  getJobByNumberOrReg,
  updateJob,
} from "@/lib/database/jobs";

const normalizeJobNumber = (value) => {
  if (!value) return "";
  return String(value).trim().toUpperCase();
};

const resolveJobNumber = (job) =>
  job?.job_number || job?.jobNumber || null;

export default async function handler(req, res) {
  const jobNumber = normalizeJobNumber(req.query.jobNumber);

  if (!jobNumber) {
    return res.status(400).json({ message: "Job number is required" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  }

  try {
    const primaryJob = await getJobByNumberOrReg(jobNumber);
    if (!primaryJob) {
      return res
        .status(404)
        .json({ message: `Job card ${jobNumber} not found` });
    }

    const { targetJobNumber } = req.body || {};
    if (!targetJobNumber) {
      return res
        .status(400)
        .json({ message: "Target job number is required" });
    }

    const targetJob = await getJobByNumberOrReg(targetJobNumber);
    if (!targetJob) {
      return res.status(404).json({
        message: `Target job card ${targetJobNumber} not found`,
      });
    }

    if (targetJob.id === primaryJob.id) {
      return res
        .status(400)
        .json({ message: "Cannot link a job to itself" });
    }

    const targetIsWarranty =
      (targetJob.job_source || "").toLowerCase() === "warranty";
    const currentIsWarranty =
      (primaryJob.job_source || "").toLowerCase() === "warranty";

    const masterJobId =
      !currentIsWarranty && targetIsWarranty
        ? primaryJob.id
        : currentIsWarranty && !targetIsWarranty
        ? targetJob.id
        : primaryJob.id;

    try {
      await updateJob(primaryJob.id, {
        warranty_linked_job_id: targetJob.id,
        warranty_vhc_master_job_id: masterJobId,
      });

      await updateJob(targetJob.id, {
        warranty_linked_job_id: primaryJob.id,
        warranty_vhc_master_job_id: masterJobId,
        status: primaryJob.status,
      });
    } catch (linkError) {
      console.error("❌ Warranty link update failed:", linkError);
      try {
        await updateJob(primaryJob.id, {
          warranty_linked_job_id: null,
          warranty_vhc_master_job_id: null,
        });
      } catch (rollbackError) {
        console.warn("⚠️ Failed to rollback warranty link:", rollbackError);
      }
      return res.status(400).json({
        message: linkError?.message || "Failed to link warranty job",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        jobNumber: resolveJobNumber(primaryJob),
        targetJobNumber: resolveJobNumber(targetJob),
      },
    });
  } catch (error) {
    console.error("❌ Warranty link API error:", error);
    return res.status(500).json({
      message: "Unexpected error linking warranty job",
    });
  }
}
