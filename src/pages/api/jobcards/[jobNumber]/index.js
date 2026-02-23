// file location: src/pages/api/jobcards/[jobNumber]/index.js
import { getJobByNumber } from "@/lib/database/jobs";
import { getNotesByJob } from "@/lib/database/notes";
import { getCustomerJobs } from "@/lib/database/customers";
import { mapCustomerJobsToHistory, normalizeRequests } from "@/lib/jobcards/utils";
import { supabaseService } from "@/lib/supabaseClient";

const loadArchivedJob = async (jobNumber) => {
  if (!supabaseService) {
    return { error: { message: "Service role key not configured" } };
  }

  const { data, error } = await supabaseService
    .from("job_archive")
    .select("snapshot")
    .eq("job_number", jobNumber)
    .single();

  if (error || !data?.snapshot) {
    return { error: { message: "Archived job not found" } };
  }

  const snapshot = data.snapshot || {};
  const jobCard = snapshot.jobCard || snapshot.job || null;
  return {
    data: {
      jobCard,
      customer: snapshot.customer || null,
      vehicle: snapshot.vehicle || null,
      sharedNote: snapshot.sharedNote || null,
      vehicleJobHistory: snapshot.vehicleJobHistory || [],
    },
    error: null,
  };
};

export default async function handler(req, res) {
  const { jobNumber, archive, force } = req.query;

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
    const requestArchive = String(archive || "") === "1";

    if (requestArchive) {
      const { data, error } = await loadArchivedJob(jobNumber);
      if (error || !data?.jobCard) {
        return res
          .status(404)
          .json({ message: `Archived job card ${jobNumber} not found` });
      }

      res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
      return res.status(200).json({
        job: data.jobCard,
        customer: data.customer || null,
        vehicle: data.vehicle || null,
        sharedNote: data.sharedNote || null,
        vehicleJobHistory: data.vehicleJobHistory || [],
      });
    }

    const requestForce = String(force || "") === "1";
    const { data, error } = await getJobByNumber(jobNumber, { noCache: requestForce });

    if (error || !data?.jobCard) {
      const archived = await loadArchivedJob(jobNumber);
      if (archived?.data?.jobCard) {
        res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
        return res.status(200).json({
          job: archived.data.jobCard,
          customer: archived.data.customer || null,
          vehicle: archived.data.vehicle || null,
          sharedNote: archived.data.sharedNote || null,
          vehicleJobHistory: archived.data.vehicleJobHistory || [],
        });
      }
      return res
        .status(404)
        .json({ message: `Job card ${jobNumber} not found` });
    }

    const { jobCard, customer, vehicle } = data;
    const notes = jobCard.id ? await getNotesByJob(jobCard.id) : [];
    const sharedNote = notes[0] || null;
    let vehicleJobHistory = [];
    if (jobCard.customerId) {
      const customerJobs = await getCustomerJobs(jobCard.customerId);
      vehicleJobHistory = mapCustomerJobsToHistory(customerJobs, jobCard.reg);
    }

    // Prevent caching to ensure fresh data after mutations (parts allocation, etc.)
    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");

    return res.status(200).json({
      job: jobCard,
      customer,
      vehicle,
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
