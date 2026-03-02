// API route for updating the authenticated user's emergency contact
// file location: src/pages/api/profile/emergency-contact.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  return res.status(403).json({
    success: false,
    message:
      "Users table changes are restricted to HR Manager > Employees. Emergency contact updates are disabled here.",
  });
}
