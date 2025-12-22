// file location: src/pages/api/jobcards/files/[fileId].js
import { deleteJobFile } from "@/lib/database/jobs";

export default async function handler(req, res) {
  const { fileId } = req.query;

  if (!fileId) {
    return res.status(400).json({ message: "File id is required" });
  }

  if (req.method !== "DELETE") {
    res.setHeader("Allow", ["DELETE"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} not allowed` });
  }

  try {
    const result = await deleteJobFile(fileId);
    if (!result?.success) {
      return res.status(400).json({
        message: result?.error?.message || "Failed to delete job file",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Job file deleted successfully",
    });
  } catch (error) {
    console.error("❌ Job file delete API error:", error);
    return res.status(500).json({
      success: false,
      message: "Unexpected error deleting job file",
    });
  }
}
