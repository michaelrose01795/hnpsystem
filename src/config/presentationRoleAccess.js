// Presentation roles are generated from docs/ui/ui-presentation so the readable
// document controls /loginPresentation tiles and /presentation role decks.
export { PRESENTATION_ROLES } from "./presentationRoleAccess.generated";
import { PRESENTATION_ROLES } from "./presentationRoleAccess.generated";

export function getPresentationRoleByKey(key) {
  if (!key) return null;
  return PRESENTATION_ROLES.find((r) => r.key === key) || null;
}

// Convert a route template like "/job-cards/[jobNumber]" into a regex matcher.
function buildRouteMatcher(template) {
  if (!template) return null;
  const [templatePath, templateQuery = ""] = String(template).split("#")[0].split("?");
  if (!templatePath.includes("[")) {
    return (candidate) => {
      const [candidatePath, candidateQuery = ""] = String(candidate || "").split("#")[0].split("?");
      return candidatePath === templatePath && candidateQuery === templateQuery;
    };
  }
  const pattern = new RegExp(
    "^" + templatePath.replace(/\//g, "\\/").replace(/\[[^\]]+\]/g, "[^/]+") + "$"
  );
  return (candidate) => {
    const [candidatePath, candidateQuery = ""] = String(candidate || "").split("#")[0].split("?");
    return pattern.test(candidatePath) && candidateQuery === templateQuery;
  };
}

// True if the given concrete route belongs to this role's allowed list.
export function routeAllowedForRole(role, route) {
  if (!role || !route) return false;
  const stripped = String(route).split("#")[0];
  return role.routes.some((template) => {
    const match = buildRouteMatcher(template);
    return match ? match(stripped) : false;
  });
}

// Given the role's ordered route list, return slides that match (in that order).
export function orderSlidesForRole(role, allSlides) {
  if (!role) return [];
  const used = new Set();
  const ordered = [];
  for (const template of role.routes) {
    const match = buildRouteMatcher(template);
    if (!match) continue;
    for (const slide of allSlides) {
      if (used.has(slide.id)) continue;
      if (match(slide.route)) {
        ordered.push(slide);
        used.add(slide.id);
      }
    }
  }
  return ordered;
}
