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
  const cleanTemplate = String(template).split("?")[0].split("#")[0];
  if (!template.includes("[")) {
    return (candidate) => {
      const cleanCandidate = String(candidate || "").split("?")[0].split("#")[0];
      return cleanCandidate === cleanTemplate;
    };
  }
  const pattern = new RegExp(
    "^" + cleanTemplate.replace(/\//g, "\\/").replace(/\[[^\]]+\]/g, "[^/]+") + "$"
  );
  return (candidate) => {
    const cleanCandidate = String(candidate || "").split("?")[0].split("#")[0];
    return pattern.test(cleanCandidate);
  };
}

// True if the given concrete route belongs to this role's allowed list.
export function routeAllowedForRole(role, route) {
  if (!role || !route) return false;
  const stripped = String(route).split("?")[0].split("#")[0];
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
