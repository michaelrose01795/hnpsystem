// file location: src/components/dev-layout-overlay/DevLayoutSection.js
import React, { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { useDevLayoutRegistry } from "@/context/DevLayoutRegistryContext";

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
  const router = useRouter();
  const elementRef = useRef(null);
  const { registerSection, unregisterSection, updateSectionElement } = useDevLayoutRegistry();
  const normalizedKey = useMemo(
    () =>
      String(sectionKey || "")
        .trim()
        .toLowerCase(),
    [sectionKey]
  );

  useEffect(() => {
    if (!normalizedKey) return undefined;

    registerSection(normalizedKey, {
      key: normalizedKey,
      route: router.asPath || router.pathname || "/",
      parentKey: parentKey || "",
      type: sectionType || "section-shell",
      widthMode: widthMode || "",
      backgroundToken: backgroundToken || "",
      isShell: Boolean(shell),
      element: elementRef.current,
    });

    return () => unregisterSection(normalizedKey);
  }, [
    normalizedKey,
    parentKey,
    sectionType,
    widthMode,
    backgroundToken,
    shell,
    registerSection,
    unregisterSection,
    router.asPath,
    router.pathname,
  ]);

  useEffect(() => {
    if (!normalizedKey) return;
    updateSectionElement(normalizedKey, elementRef.current);
  });

  return (
    <Component
      ref={elementRef}
      data-dev-section="1"
      data-dev-section-key={normalizedKey || undefined}
      data-dev-section-type={sectionType}
      data-dev-section-parent={parentKey}
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

