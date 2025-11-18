// file location: src/pages/api/jobcards/[jobNumber]/parse-checksheet.js
export const runtime = "nodejs"; // Ensure Vercel uses the Node.js runtime for file system access

import fs from "fs"; // Node.js file system utilities to manage uploaded files
import path from "path"; // Path helper to build cross-platform temporary paths
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js"; // PDF.js utilities for extracting structured text with ESM support
import "pdfjs-dist/legacy/build/pdf.worker.js"; // Ensure the PDF.js worker is registered in Node.js
import { getJobByNumberOrReg } from "@/lib/database/jobs"; // Database helper to find jobs by number or registration
import { createVHCCheck } from "@/lib/database/vhc"; // Database helper to store Vehicle Health Check details

export const config = {
  api: {
    bodyParser: false, // Disable the default body parser so we can handle multipart form data manually
  },
};

const { getDocument, GlobalWorkerOptions } = pdfjs; // Destructure helpers from the PDF.js module

GlobalWorkerOptions.workerSrc = undefined; // Disable worker loading in the Node.js environment


// Helper to persist uploaded browser File objects onto disk so PDF.js can process them
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
    console.log("📄 Parsing checksheet for job:", jobNumber); // Helpful debug logging for tracing requests

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

    const dataBuffer = fs.readFileSync(parsedFile.filepath); // Read the uploaded PDF contents into memory

    let text = "";
    try {
      text = await extractPdfText(dataBuffer); // Use PDF.js to extract text content from each page
    } catch (parseErr) {
      console.error("❌ PDF text extraction error:", parseErr); // Capture parsing failures for debugging
      return res.status(500).json({ error: "Error parsing PDF file" }); // Inform client of parsing issues
    }

    console.log("📝 Extracted text length:", text.length); // Log snippet length for debugging

    // ✅ Parse checksheet sections from text
    const sections = [
      {
        key: "brakes",
        title: "Brakes",
        fields: [
          {
            key: "front",
            label: "Front Brakes OK",
            type: "checkbox",
            value:
              text.toLowerCase().includes("front brakes ok") ||
              text.toLowerCase().includes("front: ok"),
          },
          {
            key: "rear",
            label: "Rear Brakes OK",
            type: "checkbox",
            value:
              text.toLowerCase().includes("rear brakes ok") ||
              text.toLowerCase().includes("rear: ok"),
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
            value: extractValue(text, "tread depth", "mm"),
          },
          {
            key: "pressure",
            label: "Tyre Pressure",
            type: "text",
            value: extractValue(text, "tyre pressure", "psi"),
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
            value: extractValue(text, "oil level"),
          },
          {
            key: "coolant",
            label: "Coolant Level",
            type: "text",
            value: extractValue(text, "coolant"),
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
            value:
              extractValue(text, "technician") ||
              extractValue(text, "signed by"),
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

    console.log("✅ PDF parsed successfully for job:", jobNumber); // Confirm completion for logs

    return res.status(200).json({
      message: "PDF parsed successfully",
      jobNumber,
      extractedText: text.substring(0, 500), // First 500 chars for preview
      textLength: text.length,
      sections,
      saved: parsedFields.saveToDatabase === "true",
    });
  } catch (err) {
    console.error("❌ PDF parse handler error:", err); // Log unexpected failures
    return res.status(500).json({
      error: "Failed to parse PDF",
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

/**
 * Extracts text content from every page in a PDF buffer using PDF.js
 */
async function extractPdfText(buffer) {
  const loadingTask = getDocument({ data: buffer }); // Load the PDF document from raw bytes
  const pdf = await loadingTask.promise; // Wait for the PDF to be ready
  let combinedText = ""; // Accumulate text from all pages

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber); // Load the requested page
      const textContent = await page.getTextContent(); // Extract text items from the page
      const pageText = textContent.items
        .map((item) => (typeof item.str === "string" ? item.str : "")) // Pull the visible text from each item
        .join(" "); // Join with spaces to preserve readability
      combinedText += `${pageText}\n`; // Append page text with a newline separator
    }
  } finally {
    pdf.cleanup(); // Release resources held by PDF.js once processing is complete
  }

  return combinedText; // Return the aggregated text string for downstream parsing
}

/**
 * Helper function to extract values from PDF text
 * Looks for patterns like "Label: Value" or "Label Value"
 */
function extractValue(text, label, unit = "") {
  const patterns = [
    new RegExp(`${label}[:\\s]+([^\\n]+)`, "i"), // Match "Label: Value"
    new RegExp(`${label}.*?([0-9\\.]+)\\s*${unit}`, "i"), // Match "Label Value unit"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern); // Attempt to find a match in the extracted PDF text
    if (match && match[1]) {
      return match[1].trim(); // Return the matched value with whitespace trimmed
    }
  }

  return null; // Default to null when no value can be extracted
}
