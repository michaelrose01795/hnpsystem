// file location: src/features/website/components/PreviewClickTarget.js
//
// Wraps an editable region of WebsitePage when the page is rendered inside
// the staff Live Preview editor iframe. Adds a hover outline + a click
// handler that announces the selection to the parent staff app.
//
// When not in preview mode this component renders its children with no
// extra markup, so production /website is untouched.

import { sendSectionSelected } from "../hooks/useWebsitePreviewMode";

export default function PreviewClickTarget({
  isPreview,
  isHighlighted,
  sectionKey,
  sectionLabel,
  rowId,
  children,
  // Render-as override - defaults to a transparent div. Pass "span" /
  // "article" etc. if a section's outer element needs a different tag.
  as: As = "div",
}) {
  if (!isPreview) return children;

  const onClick = (e) => {
    // Suppress nav anchor clicks inside an editable section so the iframe
    // does not navigate away while the user is editing.
    if (e.target?.closest?.("a")) e.preventDefault();
    e.stopPropagation();
    sendSectionSelected(sectionKey, rowId);
  };

  const className =
    "ws-preview-target" +
    (isHighlighted ? " ws-preview-target--selected" : "");

  return (
    <As
      className={className}
      data-preview-section={sectionKey}
      data-preview-row={rowId || undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          sendSectionSelected(sectionKey, rowId);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <span className="ws-preview-target-label" aria-hidden="true">
        {sectionLabel || sectionKey}
        {rowId ? ` · ${rowId}` : ""}
      </span>
      {children}
    </As>
  );
}
