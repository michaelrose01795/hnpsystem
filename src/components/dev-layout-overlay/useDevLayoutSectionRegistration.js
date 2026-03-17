import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { useDevLayoutRegistry } from "@/context/DevLayoutRegistryContext";

const sanitizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

export default function useDevLayoutSectionRegistration({
  sectionKey,
  sectionType = "section-shell",
  parentKey = "",
  backgroundToken = "",
  widthMode = "",
  shell = false,
}) {
  const router = useRouter();
  const elementRef = useRef(null);
  const { registerSection, unregisterSection, updateSectionElement } = useDevLayoutRegistry();

  const normalizedKey = useMemo(() => sanitizeKey(sectionKey), [sectionKey]);
  const normalizedParentKey = useMemo(() => sanitizeKey(parentKey), [parentKey]);

  useEffect(() => {
    if (!normalizedKey) return undefined;

    registerSection(normalizedKey, {
      key: normalizedKey,
      route: router.asPath || router.pathname || "/",
      parentKey: normalizedParentKey,
      type: sectionType || "section-shell",
      widthMode: widthMode || "",
      backgroundToken: backgroundToken || "",
      isShell: Boolean(shell),
      element: elementRef.current,
    });

    return () => unregisterSection(normalizedKey);
  }, [
    normalizedKey,
    normalizedParentKey,
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
  }, [normalizedKey, updateSectionElement]);

  return {
    elementRef,
    normalizedKey,
    normalizedParentKey,
  };
}
