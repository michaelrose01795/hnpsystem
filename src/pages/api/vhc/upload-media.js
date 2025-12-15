// file location: src/pages/api/vhc/upload-media.js
export const runtime = "nodejs"; // Force Node.js runtime for file system APIs

import fs from "fs";
import path from "path";
import { addJobFile } from "@/lib/database/jobs";

export const config = {
  api: {
    bodyParser: false, // Disable automatic parsing for multipart form data
  },
};

// Helper to parse multipart form data
async function parseMultipartForm(req) {
  const contentType = req.headers["content-type"] || "";

  if (!contentType.startsWith("multipart/form-data")) {
    throw new Error("Invalid content type. Expected multipart/form-data");
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  const response = new Response(buffer, {
    headers: { "Content-Type": contentType },
  });

  const formData = await response.formData();
  const fields = {};
  let fileRecord = null;

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const arrayBuffer = await value.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "vhc-media");
      fs.mkdirSync(uploadsDir, { recursive: true });

      const sanitizedName = value.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const timestamp = Date.now();
      const tempFilePath = path.join(uploadsDir, `${timestamp}-${sanitizedName}`);

      fs.writeFileSync(tempFilePath, fileBuffer);

      fileRecord = {
        fieldName: key,
        filepath: tempFilePath,
        originalFilename: value.name,
        mimetype: value.type || "application/octet-stream",
        size: fileBuffer.length,
      };
    } else {
      fields[key] = value;
    }
  }

  return { fields, file: fileRecord };
}

// Validate file is image or video
function validateMediaFile(mimetype, size) {
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

  const isImage = mimetype.startsWith("image/");
  const isVideo = mimetype.startsWith("video/");

  if (!isImage && !isVideo) {
    return { valid: false, error: "Only image and video files are allowed" };
  }

  if (isImage && size > MAX_IMAGE_SIZE) {
    return { valid: false, error: "Image file size exceeds 10MB limit" };
  }

  if (isVideo && size > MAX_VIDEO_SIZE) {
    return { valid: false, error: "Video file size exceeds 50MB limit" };
  }

  return { valid: true };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  let tempFilePath = null;

  try {
    const { fields, file } = await parseMultipartForm(req);
    tempFilePath = file?.filepath || null;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const jobId = fields.jobId;
    const userId = fields.userId || "system";
    const visibleToCustomer = fields.visibleToCustomer === "true" || fields.visibleToCustomer === true;
    const description = fields.description || "";

    // Validate file type and size
    const validation = validateMediaFile(file.mimetype, file.size);
    if (!validation.valid) {
      // Cleanup temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return res.status(400).json({ error: validation.error });
    }

    console.log("📷 VHC Media upload:", {
      jobId,
      fileName: file.originalFilename,
      size: file.size,
      type: file.mimetype,
      visibleToCustomer,
    });

    // Generate final filename
    const sanitizedName = file.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const finalFilename = `${jobId}_${timestamp}_${sanitizedName}`;
    const finalPath = path.join(process.cwd(), "public", "uploads", "vhc-media", finalFilename);

    // Move file to final location
    fs.renameSync(file.filepath, finalPath);
    tempFilePath = finalPath;

    // Generate public URL
    const publicUrl = `/uploads/vhc-media/${finalFilename}`;

    // Add to database if not a temp job
    let dbFile = null;
    if (!jobId.startsWith('temp-')) {
      try {
        const result = await addJobFile(
          jobId,
          file.originalFilename,
          publicUrl,
          file.mimetype,
          "vhc-media",
          userId,
          visibleToCustomer
        );

        if (result.success) {
          dbFile = result.data;
        } else {
          console.warn("Failed to add file to database:", result.error);
        }
      } catch (dbError) {
        console.warn("Failed to add file to database:", dbError);
        // Continue - file is uploaded even if DB insert fails
      }
    }

    console.log("✅ VHC media uploaded successfully");

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      file: dbFile || {
        file_name: file.originalFilename,
        file_url: publicUrl,
        file_type: file.mimetype,
        visible_to_customer: visibleToCustomer,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ VHC media upload error:", error);

    // Cleanup temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.warn("⚠️ Failed to cleanup temp file:", cleanupErr);
      }
    }

    return res.status(500).json({
      error: "Failed to process upload",
      message: error.message,
    });
  }
}
