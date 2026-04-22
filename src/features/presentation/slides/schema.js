// Slide + Step shape used by the Presentation engine.
// A Slide represents one real app page to walk through.
// A Step is one callout/highlight that appears inside that slide.

export const STEP_KINDS = ["main", "tooltip", "feature"];
export const POSITIONS = ["center", "top", "right", "bottom", "left", "top-left", "top-right", "bottom-left", "bottom-right"];

export function validateSlide(slide) {
  if (!slide || typeof slide !== "object") return "slide must be object";
  if (!slide.id) return "slide.id required";
  if (!slide.route) return "slide.route required";
  if (!Array.isArray(slide.steps) || slide.steps.length === 0) return "slide.steps required";
  if (typeof slide.workflowIndex !== "number") return "slide.workflowIndex required";
  return null;
}
