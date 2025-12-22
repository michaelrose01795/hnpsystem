//file: src/pages/api/jobcards/[jobNumber]/notes/[noteId].js
import { getJobByNumberOrReg } from "@/lib/database/jobs";
import { deleteJobNote, updateJobNote } from "@/lib/database/notes";

const normaliseJobNumber = (value) => {
  if (!value) {
    return "";
  }
  return String(value).trim().toUpperCase();
};

export default async function handler(req, res) {
  const jobNumber = normaliseJobNumber(req.query.jobNumber);
  const { noteId } = req.query;

  if (!jobNumber || !noteId) {
    return res
      .status(400)
      .json({ message: "Job number and note id are required" });
  }

  try {
    const jobCard = await getJobByNumberOrReg(jobNumber);
    if (!jobCard) {
      return res
        .status(404)
        .json({ message: `Job card ${jobNumber} not found` });
    }

    if (req.method === "PUT") {
      const { noteText, hiddenFromCustomer, userId = null } = req.body || {};
      if (noteText !== undefined && !noteText.trim()) {
        return res.status(400).json({ message: "Note text cannot be empty" });
      }

      const updatePayload = {};
      if (noteText !== undefined) {
        updatePayload.noteText = noteText;
      }
      if (hiddenFromCustomer !== undefined) {
        updatePayload.hiddenFromCustomer = hiddenFromCustomer;
      }

      const result = await updateJobNote(noteId, updatePayload, userId);
      if (!result?.success) {
        return res.status(400).json({
          message:
            result?.error?.message || "Failed to update job note",
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
      });
    }

    if (req.method === "DELETE") {
      const result = await deleteJobNote(noteId);
      if (!result?.success) {
        return res.status(400).json({
          message:
            result?.error?.message || "Failed to delete job note",
        });
      }
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  } catch (error) {
    console.error("❌ Jobcard note id API error:", error);
    return res.status(500).json({
      message: "Unexpected error handling job note",
    });
  }
}
