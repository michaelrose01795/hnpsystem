// file location: src/pages/api/jobcards/[jobNumber]/parse-checksheet.js
import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { files } = await parseForm(req);
    const file = files?.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("File received:", file.originalFilename, file.mimetype, file.size);

    const dataBuffer = fs.readFileSync(file.filepath);

    let pdfData;
    try {
      pdfData = await pdfParse(dataBuffer);
    } catch (parseErr) {
      console.error("pdf-parse error:", parseErr);
      return res.status(500).json({ error: "Error parsing PDF file" });
    }

    const text = pdfData.text || "";

    const sections = [
      {
        key: "brakes",
        title: "Brakes",
        fields: [
          { key: "front", label: "Front Brakes OK", type: "checkbox" },
          { key: "rear", label: "Rear Brakes OK", type: "checkbox" },
        ],
      },
      {
        key: "tyres",
        title: "Tyres",
        fields: [
          { key: "tread", label: "Tread Depth", type: "text" },
          { key: "pressure", label: "Tyre Pressure", type: "text" },
        ],
      },
      {
        key: "signature",
        title: "Technician Signature",
        fields: [{ key: "sign", label: "Signature", type: "text" }],
      },
    ];

    console.log("Returning parsed sections for job:", req.query.jobNumber);

    return res.status(200).json({
      message: "PDF parsed successfully",
      extractedText: text,
      sections,
    });
  } catch (err) {
    console.error("PDF parse handler error:", err);
    return res.status(500).json({ error: "Failed to parse PDF" });
  }
}
