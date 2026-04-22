import ProtectedRoute from "@/components/ProtectedRoute";
import { PresentationProvider } from "@/features/presentation/PresentationProvider";
import PresentationRunner from "@/features/presentation/PresentationRunner";
import PresentationPageUi from "@/components/page-ui/presentation/presentation-ui";

export default function PresentationPage() {
  return (
    <PresentationPageUi
      ProtectedRoute={ProtectedRoute}
      PresentationProvider={PresentationProvider}
      PresentationRunner={PresentationRunner}
    />
  );
}
