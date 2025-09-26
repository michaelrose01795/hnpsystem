// file location: src/pages/api/job-cards/[jobNumber]/upload-checksheet.js
import fs from "fs";
import path from "path";
import formidable from "formidable";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const form = formidable({ multiples: false });
  form.parse(req, (err, fields, files) => {
    if (err) return res.status(500).json({ error: err.message });

    const file = files.file;
    const uploadDir = path.join(process.cwd(), "uploads", req.query.jobNumber);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, file.originalFilename);
    fs.renameSync(file.filepath, filePath);
    res.status(200).json({ message: "PDF uploaded" });
  });
}
