// file location: src/components/dev-layout-overlay/DevLayoutSection.js
import React, { useCallback } from "react";
import useDevLayoutSectionRegistration from "@/components/dev-layout-overlay/useDevLayoutSectionRegistration";

const DevLayoutSection = React.forwardRef(function DevLayoutSection({
  as: Component = "div",
  sectionKey,
  sectionType = "section-shell",
  parentKey = "",
  backgroundToken = "",
  widthMode = "",
  shell = false,
  disableFallback = false,
  className,
  style,
  children,
  ...rest
}, forwardedRef) {
  const { elementRef, normalizedKey, normalizedParentKey } = useDevLayoutSectionRegistration({
    sectionKey,
    sectionType,
    parentKey,
    backgroundToken,
    widthMode,
    shell,
  });

  const assignRefs = useCallback(
    (node) => {
      elementRef.current = node;
      if (!forwardedRef) return;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else {
        forwardedRef.current = node;
      }
    },
    [elementRef, forwardedRef]
  );

  return (
    <Component
      ref={assignRefs}
      data-dev-section="1"
      data-dev-section-key={normalizedKey || undefined}
      data-dev-section-type={sectionType}
      data-dev-section-parent={normalizedParentKey}
      data-dev-background-token={backgroundToken}
      data-dev-width-mode={widthMode}
      data-dev-shell={shell ? "1" : "0"}
      data-dev-disable-fallback={disableFallback ? "1" : undefined}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </Component>
  );
});

DevLayoutSection.displayName = "DevLayoutSection";

export default DevLayoutSection;
