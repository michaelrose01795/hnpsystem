import { useSlideshow } from "./SlideshowProvider";
import SlideshowCallout from "./SlideshowCallout";
import SlideshowHighlight from "./SlideshowHighlight";

// Renders the dim layer, the highlight ring around the active anchor (if any),
// and all revealed callouts — the active one at full opacity, previous ones dimmed.
export default function SlideshowOverlay() {
  const { currentStep, stepIndex } = useSlideshow();

  if (!currentStep) return null;

  return (
    <>
      {/* Only the active callout is shown — no accumulation. When a step has an
          anchor, SlideshowHighlight applies a cut-out dim around the target. */}
      <SlideshowHighlight anchor={currentStep.anchor} />
      <SlideshowCallout key={stepIndex} step={currentStep} />
    </>
  );
}
