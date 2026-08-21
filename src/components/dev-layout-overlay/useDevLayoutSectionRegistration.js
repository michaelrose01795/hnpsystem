import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { useDevLayoutRegistry } from "@/context/DevLayoutRegistryContext";
import { isDeveloperOnlyEnvironment } from "@/lib/dev-tools/config";

// <DevLayoutSection> is rendered 331 times across 101 files on real product
// pages. Each instance used to register itself into DevLayoutRegistryContext on
// mount AND on every navigation (router.asPath is a dependency), and each
// registration spread the whole growing registry object and re-rendered every
// consumer of that context.
//
// The registry exists solely to feed the dev-layout overlay, which is already
// gated by isDeveloperOnlyEnvironment() (false on the production deployment and
// on the `main` branch). Outside that environment the registration is pure cost
// with no reader, so it is skipped. The `data-dev-section-*` DOM attributes that
// DevLayoutSection renders are NOT affected — Help & Diagnostics and Staff Style
// Review resolve section keys from the DOM and must keep working in production.
const REGISTRATION_ENABLED = isDeveloperOnlyEnvironment();

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
    if (!REGISTRATION_ENABLED) return undefined;
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
    if (!REGISTRATION_ENABLED) return;
    if (!normalizedKey) return;
    updateSectionElement(normalizedKey, elementRef.current);
  }, [normalizedKey, updateSectionElement]);

  return {
    elementRef,
    normalizedKey,
    normalizedParentKey,
  };
}
