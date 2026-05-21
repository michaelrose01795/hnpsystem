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
  const [templatePathWithHash, templateQuery = ""] = String(template).split("?");
  const [templatePath, templateHash = ""] = templatePathWithHash.split("#");
  if (!templatePath.includes("[")) {
    return (candidate) => {
      const [candidatePathWithHash, candidateQuery = ""] = String(candidate || "").split("?");
      const [candidatePath, candidateHash = ""] = candidatePathWithHash.split("#");
      return candidatePath === templatePath && candidateHash === templateHash && candidateQuery === templateQuery;
    };
  }
  const pattern = new RegExp(
    "^" + templatePath.replace(/\//g, "\\/").replace(/\[[^\]]+\]/g, "[^/]+") + "$"
  );
  return (candidate) => {
    const [candidatePathWithHash, candidateQuery = ""] = String(candidate || "").split("?");
    const [candidatePath, candidateHash = ""] = candidatePathWithHash.split("#");
    return pattern.test(candidatePath) && candidateHash === templateHash && candidateQuery === templateQuery;
  };
}

// True if the given concrete route belongs to this role's allowed list.
export function routeAllowedForRole(role, route) {
  if (!role || !route) return false;
  return role.routes.some((template) => {
    const match = buildRouteMatcher(template);
    return match ? match(route) : false;
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
