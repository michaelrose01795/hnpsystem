// file location: src/pages/api/job-cards/[jobNumber]/save-checksheet.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Accept JSON
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { formFields, signatureData } = body;

    if (!formFields) return res.status(400).json({ error: "No form fields provided" });

    // Create folder for jobNumber
    const dir = path.join(process.cwd(), "uploads", req.query.jobNumber);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Save JSON to completed.json
    fs.writeFileSync(
      path.join(dir, "completed.json"),
      JSON.stringify({ formFields, signatureData }, null, 2)
    );

    console.log("Saved check sheet for job", req.query.jobNumber);

    res.status(200).json({ message: "Check sheet saved successfully (JSON)" });
  } catch (err) {
    console.error("Error saving check sheet:", err);
    res.status(500).json({ error: "Failed to save check sheet" });
  }
}
