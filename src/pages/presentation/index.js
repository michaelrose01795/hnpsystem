import { PresentationProvider } from "@/features/presentation/PresentationProvider";
import PresentationRunner from "@/features/presentation/PresentationRunner";
import PresentationPageUi from "@/components/page-ui/presentation/presentation-ui";
import Layout from "@/components/Layout";

export default function PresentationPage() {
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
