// file location: src/pages/api/job-cards/[jobNumber]/save-checksheet.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { formFields, signatureData } = req.body;

  const saveDir = path.join(process.cwd(), "uploads", req.query.jobNumber);
  if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

  fs.writeFileSync(path.join(saveDir, "completed.json"), JSON.stringify({ formFields, signatureData }, null, 2));
  res.status(200).json({ message: "Check sheet saved" });
}
