// file location: src/pages/api/hr/training-courses/[course_id].js
import { getTrainingCourse, updateTrainingCourse, deleteTrainingCourse } from "@/lib/database/hr"; // Import course helpers.
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"; // Resolve caller context for RBAC decisions.

const MANAGER_KEYWORDS = ["admin", "manager"]; // Substrings that signify elevated privileges.

const normaliseRole = (role) => (typeof role === "string" ? role.trim().toLowerCase() : ""); // Lowercase helper for comparisons.

const hasManagerPrivileges = (role) => MANAGER_KEYWORDS.some((keyword) => normaliseRole(role).includes(keyword)); // Evaluate RBAC.

export default async function handler(req, res) { // API handler for retrieving, updating, and deleting a training course.
  const { course_id: rawCourseId } = req.query || {}; // Extract course identifier from the route.
  const courseId = Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId; // Normalise array inputs from Next.js routing.

  if (!courseId) { // Validate presence of the identifier.
    res.status(400).json({ ok: false, error: "course_id is required" }); // Return validation error.
    return; // Exit early due to invalid request.
  }

  try { // Wrap logic for consistent error handling.
    if (req.method === "GET") { // Handle retrieval of a course.
      const course = await getTrainingCourse(courseId); // Fetch the requested course.
      if (!course) { // Handle missing records gracefully.
        res.status(404).json({ ok: false, error: "Training course not found" }); // Return 404 when absent.
        return; // Exit handler after responding.
      }
      res.status(200).json({ ok: true, data: course }); // Return the course when found.
      return; // Exit handler after responding.
    }

    if (req.method === "PATCH") { // Handle updates to a course definition.
      const user = await getUserFromRequest(req); // Resolve the caller's role.
      if (!hasManagerPrivileges(user?.role)) { // Enforce Admin/Manager privileges.
        res.status(403).json({ ok: false, error: "Insufficient permissions" }); // Return forbidden response.
        return; // Exit early when not authorised.
      }

      const updates = req.body || {}; // Capture partial updates from the request body.
      const updated = await updateTrainingCourse(courseId, updates); // Apply updates through the data layer.
      if (!updated) { // If no row returned, treat as missing.
        res.status(404).json({ ok: false, error: "Training course not found" }); // Return not-found response.
        return; // Exit handler.
      }
      res.status(200).json({ ok: true, data: updated }); // Return the updated record.
      return; // Exit handler after responding.
    }

    if (req.method === "DELETE") { // Handle deletion of a course.
      const user = await getUserFromRequest(req); // Resolve the caller's role.
      if (!hasManagerPrivileges(user?.role)) { // Enforce Admin/Manager privileges.
        res.status(403).json({ ok: false, error: "Insufficient permissions" }); // Return forbidden response.
        return; // Exit early.
      }

      const existing = await getTrainingCourse(courseId); // Verify the course exists before deleting.
      if (!existing) { // Handle already-missing records gracefully.
        res.status(404).json({ ok: false, error: "Training course not found" }); // Return not-found response.
        return; // Exit handler.
      }

      await deleteTrainingCourse(courseId); // Remove the course.
      res.status(200).json({ ok: true, data: { courseId } }); // Return acknowledgement payload.
      return; // Exit handler after responding.
    }

    res.setHeader("Allow", ["GET", "PATCH", "DELETE"]); // Advertise supported HTTP verbs.
    res.status(405).json({ ok: false, error: `Method ${req.method} not allowed` }); // Return method-not-allowed response.
  } catch (error) { // Catch unexpected exceptions.
    console.error(`/api/hr/training-courses/${courseId} error`, error); // Emit diagnostic log.
    res.status(500).json({ ok: false, error: error?.message || "Unexpected error" }); // Return generic failure payload.
  }
}
