// file location: src/pages/api/jobcards/[jobNumber]/index.js
import { getJobByNumber } from "@/lib/database/jobs";
import { getNotesByJob } from "@/lib/database/notes";
import { getCustomerJobs } from "@/lib/database/customers";
import { mapCustomerJobsToHistory, normalizeRequests } from "@/lib/jobcards/utils";

export default async function handler(req, res) {
  const { jobNumber } = req.query;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  }

  if (!jobNumber || typeof jobNumber !== "string") {
    return res.status(400).json({ message: "Job number is required" });
  }

  try {
    const { data, error } = await getJobByNumber(jobNumber);

    if (error || !data?.jobCard) {
      return res
        .status(404)
        .json({ message: `Job card ${jobNumber} not found` });
    }

    const jobCard = data.jobCard;
    const notes = jobCard.id ? await getNotesByJob(jobCard.id) : [];
    const sharedNote = notes[0] || null;
    let vehicleJobHistory = [];
    if (jobCard.customerId) {
      const customerJobs = await getCustomerJobs(jobCard.customerId);
      vehicleJobHistory = mapCustomerJobsToHistory(customerJobs, jobCard.reg);
    }

    return res.status(200).json({
      job: jobCard,
      sharedNote,
      vehicleJobHistory
    });
  } catch (error) {
    console.error("❌ Unexpected error fetching job card:", error);
    return res
      .status(500)
      .json({ message: "Unexpected error fetching job card" });
  }
}
