import { useEffect } from "react";
import { PresentationProvider } from "@/features/presentation/PresentationProvider";
import PresentationRunner from "@/features/presentation/PresentationRunner";
import PresentationPageUi from "@/components/page-ui/presentation/presentation-ui";
import Layout from "@/components/Layout";
import { useTheme } from "@/styles/themeProvider";

export default function PresentationPage() {
  const { setTemporaryOverride } = useTheme();

  // Force the presentation runner into the brand red accent so demos always
  // look the same regardless of the presenting user's saved preference.
  useEffect(() => {
    setTemporaryOverride({ mode: "system", accent: "red" });
    return () => {
      setTemporaryOverride(null);
    };
  }, [setTemporaryOverride]);

  return (
    <PresentationPageUi
      PresentationProvider={PresentationProvider}
      PresentationRunner={PresentationRunner}
    />
  );
}

PresentationPage.getLayout = (page) => (
  <Layout presentationShell disableContentCardHover>
    {page}
  </Layout>
);
