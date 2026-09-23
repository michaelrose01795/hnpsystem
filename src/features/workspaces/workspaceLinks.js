// file location: src/features/workspaces/workspaceLinks.js
//
// Declarative "open in another workspace" links. Any staff page can opt a link
// in without importing anything:
//
//   <Link href={`/job-cards/${n}`} data-workspace-target="other">Open job</Link>
//
// A plain left-click then opens the page in another workspace when the
// workspace system is live, and navigates normally when it is not (single
// screen, tablet, phone) — so the attribute is always safe to add. Modified
// clicks (Ctrl/Cmd/Shift/Alt, middle button) keep their browser meaning.
//
// Programmatic equivalent: openInOtherWorkspace(href) from ./workspaceBridge.

export const WORKSPACE_LINK_ATTRIBUTE = "data-workspace-target";

/**
 * Install the document-level click handler. `open(href)` returns true when it
 * took the link; the click is then cancelled. Returns an unbind function.
 */
export function bindWorkspaceLinkTargets(open) {
  if (typeof document === "undefined") return () => {};
  const onClick = (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target?.closest?.(`a[${WORKSPACE_LINK_ATTRIBUTE}="other"][href]`);
    if (!anchor) return;
    if (!open(anchor.getAttribute("href"))) return;
    // preventDefault (not stopPropagation): next/link skips its navigation for
    // an already-prevented click, while the link's own onClick still runs.
    event.preventDefault();
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
