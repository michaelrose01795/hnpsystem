// file location: src/pages/api/hr/training-courses/index.js
import { listTrainingCourses, createTrainingCourse } from "@/lib/database/hr"; // Import HR training course data helpers.
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"; // Resolve the caller's role for access control.

const MANAGER_KEYWORDS = ["admin", "manager"]; // Normalised substrings that grant elevated privileges.

const normaliseRole = (role) => (typeof role === "string" ? role.trim().toLowerCase() : ""); // Lowercase helper for comparisons.

const hasManagerPrivileges = (role) => { // Determine if the caller has administrative authority.
  const normalised = normaliseRole(role); // Normalise the role string for keyword checks.
  return MANAGER_KEYWORDS.some((keyword) => normalised.includes(keyword)); // Grant if any keyword is present.
};

export default async function handler(req, res) { // Main API handler for listing and creating training courses.
  try { // Wrap logic to surface consistent JSON errors.
    if (req.method === "GET") { // Handle listing of courses.
      const courses = await listTrainingCourses(); // Fetch all course definitions.
      res.status(200).json({ ok: true, data: courses }); // Return success payload.
      return; // Exit handler after responding.
    }

    if (req.method === "POST") { // Handle creation of a new course.
      const user = await getUserFromRequest(req); // Resolve the caller's role.
      if (!hasManagerPrivileges(user?.role)) { // Enforce Admin/Manager access.
        res.status(403).json({ ok: false, error: "Insufficient permissions" }); // Return forbidden status.
        return; // Exit early when not authorised.
      }

      const { title, description, category, renewalIntervalMonths, renewal_interval_months } = req.body || {}; // Destructure input.

      if (!title || typeof title !== "string" || !title.trim()) { // Validate required title.
        res.status(400).json({ ok: false, error: "title is required" }); // Return validation error.
        return; // Stop execution on invalid payload.
      }

      const payload = { // Build payload object forwarded to the data layer.
        title: title.trim(), // Trim whitespace for consistency.
        description: typeof description === "string" ? description.trim() : description ?? null, // Normalise description.
        category: typeof category === "string" ? category.trim() : category ?? null, // Normalise category.
        renewal_interval_months: renewal_interval_months ?? renewalIntervalMonths ?? null, // Preserve whichever casing the caller used.
      }; // Close payload construction.

      const created = await createTrainingCourse(payload); // Insert the new course.
      res.status(201).json({ ok: true, data: created }); // Return the created resource.
      return; // Exit handler after responding.
    }

    res.setHeader("Allow", ["GET", "POST"]); // Communicate supported HTTP verbs.
    res.status(405).json({ ok: false, error: `Method ${req.method} not allowed` }); // Return method-not-allowed.
  } catch (error) { // Catch unexpected failures.
    console.error("/api/hr/training-courses error", error); // Emit server-side log for debugging.
    res.status(500).json({ ok: false, error: error?.message || "Unexpected error" }); // Return generic failure response.
  }
}
