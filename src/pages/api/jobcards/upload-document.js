// file location: src/pages/api/jobcards/upload-document.js
export const runtime = "nodejs"; // Force Node.js runtime for file system APIs

import fs from "fs";
import path from "path";
import { addJobFile } from "@/lib/database/jobs";

export const config = {
  api: {
    bodyParser: false, // Disable automatic parsing for multipart form data
  },
};

// Helper to parse multipart form data
async function parseMultipartForm(req) {
  const contentType = req.headers["content-type"] || "";

  if (!contentType.startsWith("multipart/form-data")) {
    throw new Error("Invalid content type. Expected multipart/form-data");
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  const response = new Response(buffer, {
    headers: { "Content-Type": contentType },
  });

  const formData = await response.formData();
  const fields = {};
  let fileRecord = null;

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const arrayBuffer = await value.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "job-documents");
      fs.mkdirSync(uploadsDir, { recursive: true });

      const sanitizedName = value.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const timestamp = Date.now();
      const tempFilePath = path.join(uploadsDir, `${timestamp}-${sanitizedName}`);

      fs.writeFileSync(tempFilePath, fileBuffer);

      fileRecord = {
        fieldName: key,
        filepath: tempFilePath,
        originalFilename: value.name,
        mimetype: value.type || "application/octet-stream",
        size: fileBuffer.length,
      };
    } else {
      fields[key] = value;
    }
  }

  return { fields, file: fileRecord };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  let tempFilePath = null;

  try {
    const { fields, file } = await parseMultipartForm(req);
    tempFilePath = file?.filepath || null;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const jobId = fields.jobId;
    const userId = fields.userId || "system";

    console.log("📎 Document upload:", {
      jobId,
      fileName: file.originalFilename,
      size: file.size,
    });

    // Generate final filename
    const sanitizedName = file.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const finalFilename = `${jobId}_${timestamp}_${sanitizedName}`;
    const finalPath = path.join(process.cwd(), "public", "uploads", "job-documents", finalFilename);

    // Move file to final location
    fs.renameSync(file.filepath, finalPath);
    tempFilePath = finalPath;

    // Generate public URL
    const publicUrl = `/uploads/job-documents/${finalFilename}`;

    // Only add to database if this is not a temp job
    if (!jobId.startsWith('temp-')) {
      try {
        await addJobFile(
          jobId,
          file.originalFilename,
          publicUrl,
          file.mimetype,
          "documents",
          userId
        );
      } catch (dbError) {
        console.warn("Failed to add file to database:", dbError);
        // Continue - file is uploaded even if DB insert fails
      }
    }

    console.log("✅ Document uploaded successfully");

    return res.status(200).json({
      message: "File uploaded successfully",
      file: {
        originalName: file.originalFilename,
        filename: finalFilename,
        path: publicUrl,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date().toISOString(),
      },
      jobId,
    });
  } catch (error) {
    console.error("❌ Upload handler error:", error);

    // Cleanup temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.warn("⚠️ Failed to cleanup temp file:", cleanupErr);
      }
    }

    return res.status(500).json({
      error: "Failed to process upload",
      message: error.message,
    });
  }
}
