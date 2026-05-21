// Compatibility redirect for older presentation links where a real page hash
// was accidentally placed before the slide index, e.g.
// /presentation/customer/website#shop/3#slide=3&step=0.
import { useEffect } from "react";
import { useRouter } from "next/router";
import { routeToSlug } from "@/features/presentation/runtime/routeResolver";
import { getPresentationRoleByKey } from "@/config/presentationRoleAccess";

function parseLegacyHash(hash) {
  const clean = String(hash || "").replace(/^#/, "");
  if (!clean) return null;
  const [legacyTarget, overlayState = ""] = clean.split("#");
  const parts = legacyTarget.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const slideIndex = Number.parseInt(parts[parts.length - 1], 10);
  if (!Number.isInteger(slideIndex) || slideIndex < 0) return null;
  const routeHash = parts.slice(0, -1).join("/");
  return { routeHash, slideIndex, overlayState };
}

export default function PresentationLegacyHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || typeof window === "undefined") return;
    const roleKey = typeof router.query.role === "string" ? router.query.role : "";
    const pageSlug = typeof router.query.pageSlug === "string" ? router.query.pageSlug : "";
    const role = getPresentationRoleByKey(roleKey);
    const parsed = parseLegacyHash(window.location.hash);

    if (!role || !pageSlug || !parsed) {
      router.replace("/loginPresentation");
      return;
    }

    const route = role.routes?.[parsed.slideIndex];
    if (!route) {
      router.replace("/loginPresentation");
      return;
    }

    const targetSlug = routeToSlug(route);
    const fallbackSlug = `${pageSlug}-${parsed.routeHash.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
    const slideHash = parsed.overlayState || `slide=${parsed.slideIndex}&step=0`;
    router.replace(
      `/presentation/${roleKey}/${targetSlug || fallbackSlug}/${parsed.slideIndex}#${slideHash}`,
    );
  }, [router]);

  return null;
}

PresentationLegacyHashRedirect.getLayout = (page) => page;
