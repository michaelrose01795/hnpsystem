// ✅ Imports converted to use absolute alias "@/"
// file location: /pages/api/job-cards/[jobNumber]/upload-dealer-file.js
import nextConnect from "next-connect";
import multer from "multer";
import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabaseClient";

// Temporary file upload destination
const upload = multer({ dest: "/tmp/uploads" });
const handler = nextConnect();

handler.use(upload.single("file"));

handler.post(async (req, res) => {
  const { jobNumber } = req.query;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // 1️⃣ Get the job record
    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("job_number", jobNumber)
      .single();

    if (jobError || !jobData) {
      return res.status(404).json({ error: "Job not found" });
    }

    const jobId = jobData.id;
    const fileExt = path.extname(file.originalname);
    const fileName = `${jobNumber}_${Date.now()}${fileExt}`;
    const filePath = `dealer-files/${fileName}`;

    // 2️⃣ Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("job-files") // ⚠️ Make sure this storage bucket exists in Supabase
      .upload(filePath, fs.createReadStream(file.path), {
        contentType: file.mimetype,
        duplex: "half",
      });

    // Delete temp file
    fs.unlinkSync(file.path);

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res.status(500).json({ error: "File upload failed" });
    }

    // 3️⃣ Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("job-files")
      .getPublicUrl(filePath);

    // 4️⃣ Insert file record into job_files table
    const { error: dbError } = await supabase.from("job_files").insert([
      {
        job_id: jobId,
        file_name: file.originalname,
        file_url: publicUrlData.publicUrl,
        uploaded_at: new Date(),
      },
    ]);

    if (dbError) {
      console.error("Database insert error:", dbError);
      return res.status(500).json({ error: "Failed to record file in database" });
    }

    res.status(200).json({
      message: "File uploaded successfully",
      url: publicUrlData.publicUrl,
    });
  } catch (err) {
    console.error("Upload handler error:", err);
    res.status(500).json({ error: "Server error during upload" });
  }
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handler;