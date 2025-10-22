// ✅ File location: src/pages/api/jobcards/[jobNumber]/parse-checksheet.js
import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";
import { getJobByNumberOrReg } from "@/lib/database/jobs";
import { createVHCCheck } from "@/lib/database/vhc";

// Disable Next.js default bodyParser
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to parse form-data requests
const parseForm = (req) =>
  new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

/**
 * Parse checksheet PDF and extract vehicle health check data
 * POST /api/jobcards/[jobNumber]/parse-checksheet
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { jobNumber } = req.query;

  try {
    console.log('📄 Parsing checksheet for job:', jobNumber);

    // ✅ Verify job exists
    const job = await getJobByNumberOrReg(jobNumber);
    if (!job) {
      return res.status(404).json({ 
        error: "Job not found",
        jobNumber 
      });
    }

    // Parse uploaded file
    const { files, fields } = await parseForm(req);
    const file = files?.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("📎 File received:", file.originalFilename, file.mimetype, file.size);

    // Read PDF file
    const dataBuffer = fs.readFileSync(file.filepath);

    let pdfData;
    try {
      pdfData = await pdfParse(dataBuffer);
    } catch (parseErr) {
      console.error("❌ pdf-parse error:", parseErr);
      return res.status(500).json({ error: "Error parsing PDF file" });
    }

    const text = pdfData.text || "";
    console.log("📝 Extracted text length:", text.length);

    // ✅ Parse checksheet sections from text
    // This is a basic example - customize based on your actual PDF format
    const sections = [
      {
        key: "brakes",
        title: "Brakes",
        fields: [
          { 
            key: "front", 
            label: "Front Brakes OK", 
            type: "checkbox",
            value: text.toLowerCase().includes("front brakes ok") || 
                   text.toLowerCase().includes("front: ok")
          },
          { 
            key: "rear", 
            label: "Rear Brakes OK", 
            type: "checkbox",
            value: text.toLowerCase().includes("rear brakes ok") ||
                   text.toLowerCase().includes("rear: ok")
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
            value: extractValue(text, "tread depth", "mm")
          },
          { 
            key: "pressure", 
            label: "Tyre Pressure", 
            type: "text",
            value: extractValue(text, "tyre pressure", "psi")
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
            value: extractValue(text, "oil level")
          },
          { 
            key: "coolant", 
            label: "Coolant Level", 
            type: "text",
            value: extractValue(text, "coolant")
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
            value: extractValue(text, "technician") || 
                   extractValue(text, "signed by")
          }
        ],
      },
    ];

    // ✅ Optionally save VHC checks to database
    if (fields.saveToDatabase === 'true') {
      console.log('💾 Saving VHC checks to database...');
      
      for (const section of sections) {
        for (const field of section.fields) {
          if (field.value) {
            await createVHCCheck({
              job_id: job.id,
              section: section.title,
              issue_title: field.label,
              issue_description: String(field.value),
              status: field.type === 'checkbox' && field.value ? 'OK' : 'Noted'
            });
          }
        }
      }
      
      console.log('✅ VHC checks saved');
    }

    console.log("✅ PDF parsed successfully for job:", jobNumber);

    return res.status(200).json({
      message: "PDF parsed successfully",
      jobNumber,
      extractedText: text.substring(0, 500), // First 500 chars for preview
      textLength: text.length,
      sections,
      saved: fields.saveToDatabase === 'true'
    });

  } catch (err) {
    console.error("❌ PDF parse handler error:", err);
    return res.status(500).json({ 
      error: "Failed to parse PDF",
      message: err.message 
    });
  } finally {
    // Clean up uploaded file
    try {
      const { files } = await parseForm(req);
      if (files?.file?.filepath) {
        fs.unlinkSync(files.file.filepath);
      }
    } catch (cleanupErr) {
      console.warn("⚠️ Failed to cleanup temp file:", cleanupErr);
    }
  }
}

/**
 * Helper function to extract values from PDF text
 * Looks for patterns like "Label: Value" or "Label Value"
 */
function extractValue(text, label, unit = '') {
  const patterns = [
    new RegExp(`${label}[:\\s]+([^\\n]+)`, 'i'),
    new RegExp(`${label}.*?([0-9\\.]+)\\s*${unit}`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}