import { withRoleGuard } from "@/lib/auth/roleGuard";
import { canAccessPath } from "@/lib/auth/pageAccess";
import { loadTechnicalInfoContext } from "@/lib/database/technicalInfo";
import { getTechnicalInformation } from "@/lib/technicalInfo/service";
import { TECHNICAL_CATEGORIES } from "@/lib/technicalInfo/catalogue";

export async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const { jobNumber } = req.query;
  const { requestId = "", requestText = "", query = "", category = "", browse = false } = req.body || {};
  if (typeof jobNumber !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(jobNumber) ||
      [requestId, requestText, query, category].some((value) => typeof value !== "string") ||
      requestId.length > 80 || requestText.length > 2000 || query.length > 200 || typeof browse !== "boolean" ||
      (category && !TECHNICAL_CATEGORIES.some(({ id }) => id === category))) {
    return res.status(400).json({ error: "Invalid technical information request." });
  }
  try {
    const context = await loadTechnicalInfoContext(jobNumber);
    if (!context) return res.status(404).json({ error: "Job not found." });
    return res.status(200).json(await getTechnicalInformation(context, { requestId, requestText, query, category, browse }));
  } catch (error) {
    return res.status(error.status === 404 ? 404 : 503).json({ error: error.status === 404 ? error.message : "Technical information is temporarily unavailable. Please try again." });
  }
}

// Use the same manifest-derived access as the job detail page, rather than inventing role strings.
export default withRoleGuard(handler, {
  authorize: (roles, session) => canAccessPath("/job-cards/[jobNumber]", roles, session.user?.sidebarAccess),
});
