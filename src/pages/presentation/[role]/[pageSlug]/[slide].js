// Deep-link entry point: /presentation/<role>/<pageSlug>/<slide>
// Mounts the EXACT real Next.js page that lives at the role's slide route
// (e.g. /accounts/invoices), wrapped in:
//   - PresentationProvider (slide/step/hash state, sets active role)
//   - Layout `presentationShell` (mocks user identity, brand-red accent)
//   - RouterParamsOverride (so useRouter().query.<param> resolves to demo ids)
//   - PresentationOverlay (highlight + callout driven by slide steps)
// The actual data the page fetches is intercepted by the supabase Proxy and
// the /api fetch interceptor — see src/features/presentation/dataLayer/*.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useTheme } from "@/styles/themeProvider";
import { PresentationProvider } from "@/features/presentation/PresentationProvider";
import PresentationOverlay from "@/features/presentation/PresentationOverlay";
import PresentationDevOverlay from "@/features/presentation/PresentationDevOverlay";
import useKeyboardNav from "@/features/presentation/useKeyboardNav";
import { resolvePresentationRoute } from "@/features/presentation/runtime/routeResolver";
import { loadRealPage, hasRealPage, preloadRealPages, getLoadedPage } from "@/features/presentation/runtime/realPageLoader";
import RouterParamsOverride from "@/features/presentation/runtime/RouterParamsOverride";
import { setPresentationMode } from "@/features/presentation/runtime/presentationMode";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

function isCustomerFacingTemplate(template) {
  return (
    template === "/website" ||
    String(template || "").startsWith("/website/") ||
    String(template || "").startsWith("/vhc/customer") ||
    String(template || "").startsWith("/vhc/share")
  );
}

function isStandaloneTemplate(template) {
  return isCustomerFacingTemplate(template) || template === "/login";
}

function resolveFromQuery(query = {}) {
  const role = typeof query.role === "string" ? query.role : null;
  const pageSlug = typeof query.pageSlug === "string" ? query.pageSlug : null;
  const slideParam = query.slide;
  const slideIndex = Number.parseInt(Array.isArray(slideParam) ? slideParam[0] : slideParam, 10);
  return resolvePresentationRoute(role, slideIndex, pageSlug);
}

function PresentationContent() {
  const router = useRouter();
  const { role: roleQuery, pageSlug: pageSlugQuery, slide: slideQuery } = router.query;

  // Set the runtime flag synchronously the moment this component evaluates so
  // any module-scope code that reads it (e.g. supabase queries inside the
  // dynamically-imported real page) sees `true` from the very first call.
  setPresentationMode(true);

  const resolved = useMemo(
    () => resolveFromQuery({ role: roleQuery, pageSlug: pageSlugQuery, slide: slideQuery }),
    [roleQuery, pageSlugQuery, slideQuery]
  );
  const resolvedTemplate = resolved?.template || null;
  // Seed lazily from the synchronous cache so a slide change to a module that
  // was already preloaded by the deck-wide warm-up renders without a one-frame
  // "Loading real page…" flash from the async import() microtask.
  const [Page, setPage] = useState(() => getLoadedPage(resolvedTemplate)?.Page || null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (resolved?.role?.key) {
      window.sessionStorage.setItem("presentation:activeRoleKey", resolved.role.key);
    }
  }, [resolved?.role?.key]);

  useEffect(() => {
    if (!resolved?.role?.routes?.length) return;
    preloadRealPages(resolved.role.routes);
  }, [resolved?.role?.routes]);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedTemplate) {
      setPage(null);
      return;
    }
    if (!hasRealPage(resolvedTemplate)) {
      setPage(null);
      return;
    }
    // Cache hit → swap synchronously, no loading flash between slides.
    const cached = getLoadedPage(resolvedTemplate);
    if (cached?.Page) {
      setPage(() => cached.Page);
      return;
    }
    // Cache miss → only clear the previous Page if the new module really has
    // to be fetched (first visit before the deck-wide preload completes).
    setPage(null);
    loadRealPage(resolvedTemplate).then((mod) => {
      if (!cancelled && mod?.Page) setPage(() => mod.Page);
    });
    return () => { cancelled = true; };
  }, [resolvedTemplate]);

  useEffect(() => {
    if (!Page || !resolved?.realRoute?.includes("#")) return undefined;
    const targetId = resolved.realRoute.split("#")[1]?.split("?")[0];
    if (!targetId) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [Page, resolved?.realRoute]);

  useKeyboardNav();

  if (!router.isReady) return null;

  if (!resolved) {
    return (
      <div style={{ padding: 40 }}>
        <LayerSurface>
          <LayerTheme>
            <h2 style={{ marginTop: 0 }}>Presentation page not available</h2>
            <p style={{ color: "var(--text-1)" }}>
              This URL is not part of the selected presentation deck. Pick a tile on /loginPresentation.
            </p>
          </LayerTheme>
        </LayerSurface>
      </div>
    );
  }

  return (
    <>
      {Page ? (
        <RouterParamsOverride params={resolved.params} pathname={resolved.template} asPath={resolved.realRoute}>
          <Page />
        </RouterParamsOverride>
      ) : (
        <div style={{ padding: 40 }}>
          <LayerSurface>
            <LayerTheme>
              <h2 style={{ marginTop: 0 }}>{resolved.template}</h2>
              <p style={{ color: "var(--text-1)" }}>
                {hasRealPage(resolved.template)
                  ? "Loading real page…"
                  : "No real page is registered in realPageLoader.ROUTE_TO_MODULE for this route yet."}
              </p>
            </LayerTheme>
          </LayerSurface>
        </div>
      )}
      <PresentationOverlay />
      <PresentationDevOverlay />
    </>
  );
}

export default function PresentationDeepLinkPage() {
  const router = useRouter();
  const { role: roleQuery, pageSlug: pageSlugQuery, slide: slideQuery } = router.query;
  const { setTemporaryOverride } = useTheme();
  const resolved = useMemo(
    () => resolveFromQuery({ role: roleQuery, pageSlug: pageSlugQuery, slide: slideQuery }),
    [roleQuery, pageSlugQuery, slideQuery]
  );
  const standalonePage = isStandaloneTemplate(resolved?.template);

  // Lock the demo to the brand red accent regardless of the presenter's
  // own theme preference, matching the behaviour of /presentation/index.js.
  useEffect(() => {
    setTemporaryOverride({ mode: "system", accent: "red" });
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride]);

  const content = (
    <PresentationProvider>
      <PresentationContent />
    </PresentationProvider>
  );

  if (standalonePage) return content;

  return (
    <Layout presentationShell disableContentCardHover>
      {content}
    </Layout>
  );
}

PresentationDeepLinkPage.getLayout = (page) => page;
