// file location: src/pages/api/job-cards/[jobNumber]/get-checksheet.js
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const dir = path.join(process.cwd(), "uploads", req.query.jobNumber);
  if (!fs.existsSync(dir)) return res.status(404).json({ error: "No PDF found" });

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".pdf"));
  if (files.length === 0) return res.status(404).json({ error: "No PDF found" });

  const filePath = path.join(dir, files[0]);
  const fileBuffer = fs.readFileSync(filePath);
  res.setHeader("Content-Type", "application/pdf");
  res.send(fileBuffer);
}
