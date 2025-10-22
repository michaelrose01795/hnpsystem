// ✅ File location: src/pages/api/jobcards/[jobNumber]/upload-dealer-file.js
import nextConnect from "next-connect";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getJobByNumberOrReg } from "@/lib/database/jobs";

// ✅ Configure multer to save files with original names
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'dealer-files');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename: jobNumber_timestamp_originalname
    const jobNumber = req.body.jobNumber || 'unknown';
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${jobNumber}_${timestamp}_${safeName}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common document formats
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, images, and Word documents allowed.'));
    }
  }
});

const handler = nextConnect({
  onError: (err, req, res) => {
    console.error('❌ Upload error:', err);
    res.status(500).json({ 
      error: 'Upload failed',
      message: err.message 
    });
  },
  onNoMatch: (req, res) => {
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
});

// Apply multer middleware
handler.use(upload.single("file"));

// POST handler
handler.post(async (req, res) => {
  try {
    const { jobNumber } = req.query;
    const file = req.file;

    console.log('📎 File upload for job:', jobNumber);
    console.log('📄 File details:', {
      originalName: file?.originalname,
      size: file?.size,
      mimetype: file?.mimetype,
      path: file?.path
    });

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // ✅ Verify job exists
    const job = await getJobByNumberOrReg(jobNumber);
    if (!job) {
      // Delete uploaded file since job doesn't exist
      fs.unlinkSync(file.path);
      return res.status(404).json({ 
        error: 'Job not found',
        jobNumber 
      });
    }

    // ✅ Store file metadata in database
    // You might want to create a job_files table to track these
    // For now, we'll just add a note to the job
    const { createJobNote } = await import("@/lib/database/notes");
    await createJobNote({
      job_id: job.id,
      note_text: `Dealer file uploaded: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`,
      created_by: req.body.userId || 'system'
    });

    console.log('✅ File uploaded successfully');

    return res.status(200).json({ 
      message: 'File uploaded successfully',
      file: {
        originalName: file.originalname,
        filename: file.filename,
        path: `/uploads/dealer-files/${file.filename}`,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date().toISOString()
      },
      jobNumber
    });

  } catch (error) {
    console.error('❌ Upload handler error:', error);
    return res.status(500).json({ 
      error: 'Failed to process upload',
      message: error.message 
    });
  }
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handler;