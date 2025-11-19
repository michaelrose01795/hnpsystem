// file location: src/pages/api/jobcards/[jobNumber]/parse-checksheet.js
export const runtime = "nodejs"; // Ensure Vercel uses the Node.js runtime for file system access

import fs from "fs"; // Node.js file system utilities to manage uploaded files
import path from "path"; // Path helper to build cross-platform temporary paths

export const config = {
  api: {
    bodyParser: false, // Disable the default body parser so we can handle multipart form data manually
  },
};

// Helper to persist uploaded browser File objects onto disk
async function parseMultipartForm(req) {
  const contentType = req.headers["content-type"] || ""; // Pull the incoming request content type

  if (!contentType.startsWith("multipart/form-data")) {
    throw new Error("Invalid content type. Expected multipart/form-data"); // Guard against unsupported payloads
  }

  const chunks = []; // Accumulate streamed request chunks
  for await (const chunk of req) {
    chunks.push(chunk); // Store each chunk for later concatenation
  }

  const buffer = Buffer.concat(chunks); // Combine chunks into a single buffer for parsing
  const response = new Response(buffer, {
    headers: { "Content-Type": contentType }, // Provide the correct header so the Web API parser can work
  });

  const formData = await response.formData(); // Parse the multipart payload into a FormData object
  const fields = {}; // Collect non-file fields for later use
  let fileRecord = null; // Track the uploaded file metadata

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const arrayBuffer = await value.arrayBuffer(); // Convert browser File into raw bytes
      const fileBuffer = Buffer.from(arrayBuffer); // Convert the ArrayBuffer to a Node.js Buffer
      const uploadsDir = path.join(process.cwd(), "tmp", "uploads"); // Temporary storage directory inside the repo
      fs.mkdirSync(uploadsDir, { recursive: true }); // Ensure the directory exists before writing
      const tempFilePath = path.join(
        uploadsDir,
        `${Date.now()}-${value.name.replace(/[^a-zA-Z0-9._-]/g, "_")}` // Sanitize filename for safety
      );
      fs.writeFileSync(tempFilePath, fileBuffer); // Persist the uploaded file to disk
      fileRecord = {
        fieldName: key, // Original form field name
        filepath: tempFilePath, // Temporary file path on disk
        originalFilename: value.name, // Original filename from the browser
        mimetype: value.type || "application/octet-stream", // MIME type information
        size: fileBuffer.length, // File size in bytes
      };
    } else {
      fields[key] = value; // Store regular form field values
    }
  }

  return { fields, file: fileRecord }; // Provide both fields and file metadata to the caller
}

/**
 * Parse checksheet PDF and extract vehicle health check data
 * POST /api/jobcards/[jobNumber]/parse-checksheet
 * 
 * NOTE: PDF parsing temporarily disabled due to Turbopack compatibility issues
 * This endpoint now accepts the file upload and stores metadata only
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" }); // Block unsupported HTTP verbs
  }

  const { jobNumber } = req.query; // Pull job identifier from route parameters

  let uploadedFilePath = null; // Track the temporary file so we can clean it up later
  let parsedFields = {}; // Container for parsed multipart fields
  let parsedFile = null; // Container for parsed file metadata

  try {
    console.log("📄 Receiving checksheet for job:", jobNumber); // Helpful debug logging for tracing requests

    // ✅ Import database helpers dynamically
    const { getJobByNumberOrReg } = await import("@/lib/database/jobs"); // Database helper to find jobs by number or registration
    const { createVHCCheck } = await import("@/lib/database/vhc"); // Database helper to store Vehicle Health Check details

    // ✅ Verify job exists
    const job = await getJobByNumberOrReg(jobNumber); // Fetch job details from Supabase
    if (!job) {
      return res.status(404).json({
        error: "Job not found",
        jobNumber,
      }); // Exit early if the job number is invalid
    }

    const parsed = await parseMultipartForm(req); // Parse the incoming multipart form data
    parsedFields = parsed.fields; // Capture form fields for later logic
    parsedFile = parsed.file; // Capture file metadata for PDF processing
    uploadedFilePath = parsedFile?.filepath || null; // Save file path for cleanup

    if (!parsedFile) {
      return res.status(400).json({ error: "No file uploaded" }); // Enforce presence of the PDF
    }

    console.log(
      "📎 File received:",
      parsedFile.originalFilename,
      parsedFile.mimetype,
      parsedFile.size
    ); // Log file details for observability

    // ✅ Mock parsed data (PDF text extraction temporarily disabled)
    const sections = [
      {
        key: "brakes",
        title: "Brakes",
        fields: [
          {
            key: "front",
            label: "Front Brakes OK",
            type: "checkbox",
            value: true, // Mock value - would be parsed from PDF
          },
          {
            key: "rear",
            label: "Rear Brakes OK",
            type: "checkbox",
            value: true, // Mock value - would be parsed from PDF
          },
        ],
      },
      {
        key: "tyres",
        title: "Tyres",
        fields: [
          {
            key: "tread",
            label: "Tread Depth",
            type: "text",
            value: "4.5mm", // Mock value - would be parsed from PDF
          },
          {
            key: "pressure",
            label: "Tyre Pressure",
            type: "text",
            value: "32psi", // Mock value - would be parsed from PDF
          },
        ],
      },
      {
        key: "fluids",
        title: "Fluids",
        fields: [
          {
            key: "oil",
            label: "Oil Level",
            type: "text",
            value: "OK", // Mock value - would be parsed from PDF
          },
          {
            key: "coolant",
            label: "Coolant Level",
            type: "text",
            value: "OK", // Mock value - would be parsed from PDF
          },
        ],
      },
      {
        key: "signature",
        title: "Technician Signature",
        fields: [
          {
            key: "sign",
            label: "Signature",
            type: "text",
            value: "Technician Name", // Mock value - would be parsed from PDF
          },
        ],
      },
    ];

    // ✅ Optionally save VHC checks to database
    if (parsedFields.saveToDatabase === "true") {
      console.log("💾 Saving VHC checks to database..."); // Provide feedback when persisting data

      for (const section of sections) {
        for (const field of section.fields) {
          if (field.value) {
            await createVHCCheck({
              job_id: job.id, // Link the VHC entry back to the job record
              section: section.title, // Store the high-level section name
              issue_title: field.label, // Store the individual field label
              issue_description: String(field.value), // Persist the recorded value as text
              status:
                field.type === "checkbox" && field.value ? "OK" : "Noted", // Interpret checkboxes as OK/Noted
            });
          }
        }
      }

      console.log("✅ VHC checks saved"); // Confirm persistence succeeded
    }

    console.log("✅ Checksheet received for job:", jobNumber); // Confirm completion for logs

    return res.status(200).json({
      message: "Checksheet file received (PDF parsing temporarily disabled)",
      jobNumber,
      fileName: parsedFile.originalFilename,
      fileSize: parsedFile.size,
      sections,
      saved: parsedFields.saveToDatabase === "true",
      note: "PDF text extraction will be enabled once Turbopack compatibility is resolved"
    });
  } catch (err) {
    console.error("❌ Checksheet handler error:", err); // Log unexpected failures
    return res.status(500).json({
      error: "Failed to process checksheet",
      message: err.message,
    });
  } finally {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath); // Ensure temporary files are removed regardless of outcome
      } catch (cleanupErr) {
        console.warn("⚠️ Failed to cleanup temp file:", cleanupErr); // Warn if cleanup fails but do not crash the request
      }
    }
  }
}