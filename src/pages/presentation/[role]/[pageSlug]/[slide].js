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
import { loadRealPage, hasRealPage, preloadRealPages } from "@/features/presentation/runtime/realPageLoader";
import RouterParamsOverride from "@/features/presentation/runtime/RouterParamsOverride";
import { setPresentationMode } from "@/features/presentation/runtime/presentationMode";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

function PresentationContent() {
  const router = useRouter();
  const role = typeof router.query.role === "string" ? router.query.role : null;
  const slideParam = router.query.slide;
  const slideIndex = Number.parseInt(Array.isArray(slideParam) ? slideParam[0] : slideParam, 10);

  // Set the runtime flag synchronously the moment this component evaluates so
  // any module-scope code that reads it (e.g. supabase queries inside the
  // dynamically-imported real page) sees `true` from the very first call.
  setPresentationMode(true);

  const resolved = useMemo(() => resolvePresentationRoute(role, slideIndex), [role, slideIndex]);
  const [Page, setPage] = useState(null);

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

  const resolvedTemplate = resolved?.template || null;
  useEffect(() => {
    let cancelled = false;
    setPage(null);
    if (!resolvedTemplate) return;
    if (!hasRealPage(resolvedTemplate)) return;
    loadRealPage(resolvedTemplate).then((mod) => {
      if (!cancelled && mod?.Page) setPage(() => mod.Page);
    });
    return () => { cancelled = true; };
  }, [resolvedTemplate]);

  useKeyboardNav();

  if (!router.isReady) return null;

  if (!resolved) {
    return (
      <div style={{ padding: 40 }}>
        <LayerSurface>
          <LayerTheme>
            <h2 style={{ marginTop: 0 }}>Unknown presentation role</h2>
            <p style={{ color: "var(--text-1)" }}>
              No PRESENTATION_ROLES entry for <code>{String(role)}</code>. Pick a tile on /loginPresentation.
            </p>
          </LayerTheme>
        </LayerSurface>
      </div>
    );
  }

  return (
    <>
      {Page ? (
        <RouterParamsOverride params={resolved.params} pathname={resolved.template}>
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
  const { setTemporaryOverride } = useTheme();

  // Lock the demo to the brand red accent regardless of the presenter's
  // own theme preference, matching the behaviour of /presentation/index.js.
  useEffect(() => {
    setTemporaryOverride({ mode: "system", accent: "red" });
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride]);

  return (
    <PresentationProvider>
      <PresentationContent />
    </PresentationProvider>
  );
}

PresentationDeepLinkPage.getLayout = (page) => (
  <Layout presentationShell disableContentCardHover>
    {page}
  </Layout>
);
