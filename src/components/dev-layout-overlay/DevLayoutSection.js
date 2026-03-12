// file location: src/components/dev-layout-overlay/DevLayoutSection.js
import React from "react";
import useDevLayoutSectionRegistration from "@/components/dev-layout-overlay/useDevLayoutSectionRegistration";

export default function DevLayoutSection({
  as: Component = "div",
  sectionKey,
  sectionType = "section-shell",
  parentKey = "",
  backgroundToken = "",
  widthMode = "",
  shell = false,
  className,
  style,
  children,
  ...rest
}) {
  const { elementRef, normalizedKey, normalizedParentKey } = useDevLayoutSectionRegistration({
    sectionKey,
    sectionType,
    parentKey,
    backgroundToken,
    widthMode,
    shell,
  });

  return (
    <Component
      ref={elementRef}
      data-dev-section="1"
      data-dev-section-key={normalizedKey || undefined}
      data-dev-section-type={sectionType}
      data-dev-section-parent={normalizedParentKey}
      data-dev-background-token={backgroundToken}
      data-dev-width-mode={widthMode}
      data-dev-shell={shell ? "1" : "0"}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </Component>
  );
}
