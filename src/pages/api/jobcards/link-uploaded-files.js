// file location: src/pages/api/jobcards/link-uploaded-files.js
// Links files that were uploaded during temp-job creation to the finalised job.
// Before: renamed local-disk temp files.
// After:  moves Supabase Storage objects from temp-{id}/ to {jobId}/ paths
//         and inserts job_files rows.  Also handles legacy local files for
//         backward compatibility.
import fs from "fs";
import path from "path";
import { saveFileRecord, sanitiseFileName } from "@/lib/storage/storageService";
import { supabaseService, supabase as supabaseFallback } from "@/lib/supabaseClient";
import { withRoleGuard } from "@/lib/auth/roleGuard";

const BUCKET = "job-files";

function getClient() {
  return supabaseService || supabaseFallback;
}

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { jobId, files } = req.body;

    if (!jobId || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    console.log(`📎 Linking ${files.length} uploaded files to job ${jobId}`);

    const linkedFiles = [];
    const client = getClient();

    for (const meta of files) {
      try {
        // --- Supabase Storage path (new flow) ---
        if (meta.storage_path) {
          // Move the object from temp path to a permanent path under the real jobId
          const folder = meta.storage_path.split("/")[0] || "documents"; // e.g. "documents" or "vhc-media"
          const safeName = sanitiseFileName(meta.fileName || meta.file_name || "file");
          const newPath = `${folder}/${jobId}/${Date.now()}-${safeName}`;

          // Copy then delete (Supabase Storage has no rename/move)
          const { data: fileData } = await client.storage.from(BUCKET).download(meta.storage_path);
          if (fileData) {
            const arrayBuffer = await fileData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            await client.storage.from(BUCKET).upload(newPath, buffer, {
              contentType: meta.contentType || meta.mimetype || "application/octet-stream",
              upsert: false,
            });

            // Remove old temp object
            await client.storage.from(BUCKET).remove([meta.storage_path]);

            const publicUrl = client.storage.from(BUCKET).getPublicUrl(newPath)?.data?.publicUrl || "";

            const result = await saveFileRecord({
              jobId,
              fileName: meta.fileName || meta.file_name || safeName,
              fileUrl: publicUrl,
              fileType: meta.contentType || meta.mimetype || "application/octet-stream",
              folder,
              uploadedBy: meta.uploadedBy || "system",
              visibleToCustomer: meta.visible_to_customer ?? true,
              fileSize: meta.size || meta.file_size || buffer.length,
              storageType: "supabase",
              storagePath: newPath,
            });

            if (result.success) {
              linkedFiles.push({ fileName: meta.fileName, path: publicUrl });
            }
          }
          continue;
        }

        // --- Legacy local-disk path (backward compat) ---
        const uploadsDir = path.join(process.cwd(), "public", "uploads", "job-documents");
        const tempFiles = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
        const tempFile = tempFiles.find((f) => f.includes(meta.fileName));

        if (tempFile) {
          const oldPath = path.join(uploadsDir, tempFile);
          const timestamp = Date.now();
          const sanitizedName = (meta.fileName || "").replace(/[^a-zA-Z0-9._-]/g, "_");
          const newFilename = `${jobId}_${timestamp}_${sanitizedName}`;
          const newPath = path.join(uploadsDir, newFilename);

          fs.renameSync(oldPath, newPath);

          const publicUrl = `/uploads/job-documents/${newFilename}`;

          await saveFileRecord({
            jobId,
            fileName: meta.fileName,
            fileUrl: publicUrl,
            fileType: meta.contentType || "application/octet-stream",
            folder: "documents",
            uploadedBy: meta.uploadedBy || "system",
            fileSize: meta.size || null,
            storageType: "local",
            storagePath: null,
          });

          linkedFiles.push({ fileName: meta.fileName, path: publicUrl });
        }
      } catch (fileError) {
        console.error(`Failed to link file ${meta.fileName}:`, fileError);
        // Continue with other files
      }
    }

    console.log(`✅ Linked ${linkedFiles.length} files to job ${jobId}`);

    return res.status(200).json({
      message: "Files linked successfully",
      linkedFiles,
      jobId,
    });
  } catch (error) {
    console.error("❌ Link files error:", error);
    return res.status(500).json({
      error: "Failed to link files",
      message: error.message,
    });
  }
}

export default withRoleGuard(handler);
