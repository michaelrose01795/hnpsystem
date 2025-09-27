// file location: src/pages/api/job-cards/[jobNumber]/get-checksheet.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const { jobNumber } = req.query;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ✅ Assume uploads are stored under /public/checksheets/[jobNumber].pdf
    const filePath = path.join(process.cwd(), "public", "checksheets", `${jobNumber}.pdf`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Check sheet not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("Error fetching check sheet:", error);
    res.status(500).json({ error: "Server error" });
  }
}