// file location: src/pages/api/jobcards/[jobNumber]/write-up/live.js
import { getJobByNumberOrReg } from "@/lib/database/jobs";
import { supabaseService } from "@/lib/supabaseClient";

const normalizeJobNumber = (value) => {
  if (!value) return "";
  return String(value).trim().toUpperCase();
};

const sanitizeText = (value) =>
  typeof value === "string" ? value : value ? String(value) : "";

const normaliseCauseEntriesForSave = (
  entries = [],
  jobNumber,
  defaultUser = ""
) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry, index) => {
      const requestKey =
        entry?.requestKey ||
        entry?.request_id ||
        entry?.requestId ||
        `req-${index + 1}`;
      if (!requestKey) {
        return null;
      }
      return {
        id: entry?.id || null,
        job_number:
          entry?.jobNumber || entry?.job_number || jobNumber || null,
        request_id: requestKey,
        cause_text: sanitizeText(entry?.text || entry?.cause_text || ""),
        created_by: entry?.createdBy || entry?.created_by || defaultUser || "",
        updated_at:
          entry?.updatedAt ||
          entry?.updated_at ||
          new Date().toISOString(),
      };
    })
    .filter(Boolean);

export default async function handler(req, res) {
  const jobNumber = normalizeJobNumber(req.query.jobNumber);

  if (!jobNumber) {
    return res.status(400).json({ message: "Job number is required" });
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  }

  if (!supabaseService) {
    return res.status(500).json({
      message:
        "Supabase service role key missing; live write-up sync unavailable.",
    });
  }

  try {
    const jobCard = await getJobByNumberOrReg(jobNumber);
    if (!jobCard) {
      return res
        .status(404)
        .json({ message: `Job card ${jobNumber} not found` });
    }

    const {
      fault = "",
      caused = "",
      rectification = "",
      causeEntries = [],
      userId = null,
    } = req.body || {};

    const normalizedFields = {
      work_performed: sanitizeText(fault) || null,
      recommendations: sanitizeText(caused) || null,
      ratification: sanitizeText(rectification) || null,
      cause_entries: normaliseCauseEntriesForSave(
        causeEntries,
        jobNumber,
        userId || ""
      ),
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: lookupError } = await supabaseService
      .from("job_writeups")
      .select("writeup_id")
      .eq("job_id", jobCard.id)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (existing) {
      const { error: updateError } = await supabaseService
        .from("job_writeups")
        .update(normalizedFields)
        .eq("writeup_id", existing.writeup_id);

      if (updateError) {
        throw updateError;
      }

      return res.status(200).json({
        success: true,
        writeupId: existing.writeup_id,
      });
    }

    const { data: inserted, error: insertError } = await supabaseService
      .from("job_writeups")
      .insert([
        {
          ...normalizedFields,
          job_id: jobCard.id,
          created_at: new Date().toISOString(),
        },
      ])
      .select("writeup_id")
      .maybeSingle();

    if (insertError) {
      throw insertError;
    }

    return res.status(200).json({
      success: true,
      writeupId: inserted?.writeup_id || null,
    });
  } catch (error) {
    console.error("❌ Live write-up sync API error:", error);
    return res.status(500).json({
      message: "Failed to persist live write-up fields",
    });
  }
}
