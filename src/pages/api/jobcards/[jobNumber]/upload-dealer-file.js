// file location: src/pages/api/jobcards/[jobNumber]/upload-dealer-file.js
export const runtime = "nodejs"; // Force Node.js runtime on Vercel so file system APIs are available

import fs from "fs"; // File system utilities for managing uploaded files
import path from "path"; // Resolve directories for storing uploads
import { getJobByNumberOrReg } from "@/lib/database/jobs"; // Database helper to fetch job metadata

export const config = {
  api: {
    bodyParser: false, // Disable automatic parsing to handle multipart form data manually
  },
};

// Helper that reads multipart form data using the Web Fetch API available in Node 18+
async function parseMultipartForm(req) {
  const contentType = req.headers["content-type"] || ""; // Capture content type for parsing boundaries

  if (!contentType.startsWith("multipart/form-data")) {
    throw new Error("Invalid content type. Expected multipart/form-data"); // Enforce multipart uploads only
  }

  const chunks = []; // Collect streamed chunks from the request body
  for await (const chunk of req) {
    chunks.push(chunk); // Append each incoming chunk
  }

  const buffer = Buffer.concat(chunks); // Combine chunks into a single Buffer instance
  const response = new Response(buffer, {
    headers: { "Content-Type": contentType }, // Provide headers so Response.formData can parse correctly
  });

  const formData = await response.formData(); // Parse the multipart payload
  const fields = {}; // Store non-file fields
  let fileRecord = null; // Store the uploaded file metadata

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const arrayBuffer = await value.arrayBuffer(); // Convert File into raw bytes
      const fileBuffer = Buffer.from(arrayBuffer); // Convert the ArrayBuffer to a Buffer for Node APIs
      const uploadsDir = path.join(process.cwd(), "tmp", "uploads"); // Temporary storage directory
      fs.mkdirSync(uploadsDir, { recursive: true }); // Ensure directory exists
      const tempFilePath = path.join(
        uploadsDir,
        `${Date.now()}-${value.name.replace(/[^a-zA-Z0-9._-]/g, "_")}` // Sanitize filenames to prevent traversal attacks
      );
      fs.writeFileSync(tempFilePath, fileBuffer); // Write uploaded file to disk
      fileRecord = {
        fieldName: key, // Track the original form field name
        filepath: tempFilePath, // Temporary file path on disk
        originalFilename: value.name, // Original filename supplied by the user agent
        mimetype: value.type || "application/octet-stream", // MIME type metadata
        size: fileBuffer.length, // File size in bytes
      };
    } else {
      fields[key] = value; // Store text field values
    }
  }

  return { fields, file: fileRecord }; // Return both the parsed fields and file metadata
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]); // Advertise supported methods to clients
    return res.status(405).json({ error: `Method ${req.method} not allowed` }); // Reject unsupported HTTP verbs
  }

  const { jobNumber } = req.query; // Extract job number from the route parameter
  let parsedFile = null; // Placeholder for uploaded file metadata
  let tempFilePath = null; // Track temporary file path for cleanup

  try {
    const { fields, file } = await parseMultipartForm(req); // Parse incoming multipart form data
    parsedFile = file; // Store parsed file metadata
    tempFilePath = file?.filepath || null; // Keep temp file path handy for cleanup

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" }); // Require a file to be provided
    }

    console.log("📎 File upload for job:", jobNumber); // Log job number for observability
    console.log("📄 File details:", {
      originalName: file.originalFilename,
      size: file.size,
      mimetype: file.mimetype,
      path: file.filepath,
    }); // Log metadata to aid debugging

    const job = await getJobByNumberOrReg(jobNumber); // Fetch job details to ensure the job exists
    if (!job) {
      if (file.filepath && fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath); // Remove temporary file if job is invalid
      }
      return res.status(404).json({
        error: "Job not found",
        jobNumber,
      }); // Notify caller that the job does not exist
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "dealer-files"); // Final destination for uploaded files
    fs.mkdirSync(uploadDir, { recursive: true }); // Ensure destination directory exists

    const safeOriginalName = file.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_"); // Sanitize filename to avoid filesystem issues
    const timestamp = Date.now(); // Timestamp to keep filenames unique
    const finalFilename = `${jobNumber}_${timestamp}_${safeOriginalName}`; // Compose final filename pattern
    const finalPath = path.join(uploadDir, finalFilename); // Compute final absolute path

    fs.renameSync(file.filepath, finalPath); // Move temporary file to the final location
    tempFilePath = finalPath; // Update pointer for cleanup in case of downstream failures

    // ✅ Store file metadata in database via job notes for traceability
    const { createJobNote } = await import("@/lib/database/notes"); // Lazy-load notes helper to avoid circular imports
    await createJobNote({
      job_id: job.id, // Link note to the job record
      note_text: `Dealer file uploaded: ${file.originalFilename} (${(file.size / 1024).toFixed(2)} KB)`, // Describe uploaded file for technicians
      created_by: fields.userId || "system", // Record user ID when available
    });

    console.log("✅ File uploaded successfully"); // Confirm success in logs

    return res.status(200).json({
      message: "File uploaded successfully",
      file: {
        originalName: file.originalFilename,
        filename: finalFilename,
        path: `/uploads/dealer-files/${finalFilename}`,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date().toISOString(),
      },
      jobNumber,
    }); // Respond with metadata so the frontend can display the upload information
  } catch (error) {
    console.error("❌ Upload handler error:", error); // Log unexpected errors
    return res.status(500).json({
      error: "Failed to process upload",
      message: error.message,
    }); // Return a descriptive error to the client
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath); // Remove any lingering temporary files
      } catch (cleanupErr) {
        console.warn("⚠️ Failed to cleanup temp file:", cleanupErr); // Warn about cleanup failures without breaking the response
      }
    }
  }
}
