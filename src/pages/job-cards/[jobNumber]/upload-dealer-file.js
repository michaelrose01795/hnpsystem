// /pages/api/job-cards/[jobNumber]/upload-dealer-file.js
import nextConnect from "next-connect";
import multer from "multer";

const upload = multer({ dest: "/tmp/uploads" });

const handler = nextConnect();

handler.use(upload.single("file"));

handler.post((req, res) => {
  // req.file has uploaded file info
  // req.body.jobNumber has the job number
  console.log(req.body.jobNumber, req.file);
  res.status(200).json({ message: "File uploaded" });
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handler;
