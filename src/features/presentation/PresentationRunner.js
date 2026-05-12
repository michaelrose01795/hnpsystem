// Legacy runner. The current deep-link flow is
// /presentation/<role>/<pageSlug>/<slide> which mounts the real page directly
// (see src/pages/presentation/[role]/[pageSlug]/[slide].js). The bare
// /presentation route now redirects to /loginPresentation, so this runner is
// only kept as a stub for any external callers that imported it. It renders
// nothing.

export default function PresentationRunner() {
  return null;
}
