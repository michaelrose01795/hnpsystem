import { useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { canShowDevPages } from "@/lib/dev-tools/config";
import { DemoDataProvider } from "@/features/presentation/demoData/DemoDataProvider";
import { UiPreviewShell } from "@/components/page-ui/dev/ui-preview-ui";
import {
  getMockComponent,
  getUiLabel,
  getUiKeys,
} from "@/features/presentation/uiRegistry";
import { useTheme } from "@/styles/themeProvider";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

// Renders a single page-ui standalone with demo data.
// URL: /dev/ui/<uiKey>
//
// No PresentationProvider is mounted here — this is the live page-ui rendered
// by its registered mock, inside the same Layout shell the real app uses.
// It's the safe way to visually verify a page-ui without launching the full
// presentation runner.
export default function DevUiPreviewPage() {
  const router = useRouter();
  const { setTemporaryOverride } = useTheme();

  useEffect(() => {
    setTemporaryOverride({ mode: "system", accent: "red" });
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride]);

  const uiKey = typeof router.query.uiKey === "string" ? router.query.uiKey : "";

  if (!canShowDevPages()) {
    return (
      <div className="app-page-shell">
        <LayerSurface>
          <LayerTheme>
            <h1 style={{ marginTop: 0 }}>Dev pages disabled</h1>
            <p>Set <code>devToolsConfig.showPages = true</code> to enable.</p>
          </LayerTheme>
        </LayerSurface>
      </div>
    );
  }

  if (!router.isReady || !uiKey) return null;

  const Mock = getMockComponent(uiKey);

  if (!Mock) {
    const knownKeys = getUiKeys();
    return (
      <div className="app-page-shell">
        <LayerSurface>
          <LayerTheme>
            <h1 style={{ marginTop: 0 }}>Unknown UI key: {uiKey}</h1>
            <p>
              No mock is registered for <code>{uiKey}</code>. Register one in
              <code> src/features/presentation/mocks/index.js</code>.
            </p>
            <details>
              <summary>Available UI keys ({knownKeys.length})</summary>
              <ul>
                {knownKeys.map((k) => (
                  <li key={k}>
                    <a href={`/dev/ui/${encodeURIComponent(k)}`}>{k}</a>
                  </li>
                ))}
              </ul>
            </details>
          </LayerTheme>
        </LayerSurface>
      </div>
    );
  }

  return (
    <UiPreviewShell uiKey={uiKey} label={getUiLabel(uiKey)}>
      <DemoDataProvider>
        <Mock />
      </DemoDataProvider>
    </UiPreviewShell>
  );
}

DevUiPreviewPage.getLayout = (page) => (
  <Layout presentationShell disableContentCardHover>
    {page}
  </Layout>
);
