//file: src/pages/api/jobcards/[jobNumber]/notes/index.js
import {
  getJobByNumberOrReg,
} from "@/lib/database/jobs";
import {
  createJobNote,
  getNotesByJob,
} from "@/lib/database/notes";

const normaliseJobNumber = (value) => {
  if (!value) {
    return "";
  }
  return String(value).trim().toUpperCase();
};

export default async function handler(req, res) {
  const jobNumber = normaliseJobNumber(req.query.jobNumber);

  if (!jobNumber) {
    return res.status(400).json({ message: "Job number is required" });
  }

  try {
    const jobCard = await getJobByNumberOrReg(jobNumber);
    if (!jobCard) {
      return res
        .status(404)
        .json({ message: `Job card ${jobNumber} not found` });
    }

    if (req.method === "GET") {
      const notes = await getNotesByJob(jobCard.id);
      return res.status(200).json({
        success: true,
        data: notes,
      });
    }

    if (req.method === "POST") {
      const { noteText, hiddenFromCustomer = true, userId = null } =
        req.body || {};

      if (!noteText || !noteText.trim()) {
        return res
          .status(400)
          .json({ message: "Note text is required" });
      }

      const result = await createJobNote({
        job_id: jobCard.id,
        user_id: userId,
        note_text: noteText,
        hidden_from_customer: hiddenFromCustomer,
      });

      if (!result?.success) {
        return res.status(400).json({
          message:
            result?.error?.message || "Failed to create job note",
        });
      }

      return res.status(201).json({
        success: true,
        data: result.data,
      });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  } catch (error) {
    console.error("❌ Jobcard notes API error:", error);
    return res.status(500).json({
      message: "Unexpected error while handling job notes",
    });
  }
}
