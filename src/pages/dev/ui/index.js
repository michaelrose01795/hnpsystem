import { useEffect } from "react";
import Layout from "@/components/Layout";
import { canShowDevPages } from "@/lib/dev-tools/config";
import { UiPreviewIndex } from "@/components/page-ui/dev/ui-preview-ui";
import { getGroupedUiKeys } from "@/features/presentation/uiRegistry";
import { useTheme } from "@/styles/themeProvider";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";

// Dev-only index of every page-ui file available for standalone preview.
// Each entry links to /dev/ui/[uiKey] which renders that page-ui with mock
// data and no presentation overlay.
export default function DevUiIndexPage() {
  const { setTemporaryOverride } = useTheme();

  useEffect(() => {
    setTemporaryOverride({ mode: "system", accent: "red" });
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride]);

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

  const groups = getGroupedUiKeys();
  return <UiPreviewIndex groups={groups} />;
}

DevUiIndexPage.getLayout = (page) => (
  <Layout presentationShell disableContentCardHover>
    {page}
  </Layout>
);
