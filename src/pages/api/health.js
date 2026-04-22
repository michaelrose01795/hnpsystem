// file location: src/pages/api/health.js

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", ["GET", "HEAD"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  return res.status(200).json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
