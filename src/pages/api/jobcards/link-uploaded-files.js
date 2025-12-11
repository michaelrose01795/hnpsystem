// file location: src/pages/api/jobcards/link-uploaded-files.js
import fs from "fs";
import path from "path";
import { addJobFile } from "@/lib/database/jobs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { jobId, files } = req.body;

    if (!jobId || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    console.log(`📎 Linking ${files.length} uploaded files to job ${jobId}`);

    // Update filenames from temp-* to actual job ID and link to database
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "job-documents");
    const linkedFiles = [];

    for (const fileMetadata of files) {
      try {
        // Find the temp file in the uploads directory
        const tempFiles = fs.readdirSync(uploadsDir);
        const tempFile = tempFiles.find(f => f.includes(fileMetadata.fileName));

        if (tempFile) {
          // Rename file to use actual job ID
          const oldPath = path.join(uploadsDir, tempFile);
          const timestamp = Date.now();
          const sanitizedName = fileMetadata.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
          const newFilename = `${jobId}_${timestamp}_${sanitizedName}`;
          const newPath = path.join(uploadsDir, newFilename);

          fs.renameSync(oldPath, newPath);

          const publicUrl = `/uploads/job-documents/${newFilename}`;

          // Add to database
          await addJobFile(
            jobId,
            fileMetadata.fileName,
            publicUrl,
            fileMetadata.contentType,
            "documents",
            fileMetadata.uploadedBy || "system"
          );

          linkedFiles.push({
            fileName: fileMetadata.fileName,
            path: publicUrl,
          });
        }
      } catch (fileError) {
        console.error(`Failed to link file ${fileMetadata.fileName}:`, fileError);
        // Continue with other files
      }
    }

    console.log(`✅ Linked ${linkedFiles.length} files to job ${jobId}`);

    return res.status(200).json({
      message: "Files linked successfully",
      linkedFiles,
      jobId,
    });
  } catch (error) {
    console.error("❌ Link files error:", error);
    return res.status(500).json({
      error: "Failed to link files",
      message: error.message,
    });
  }
}
