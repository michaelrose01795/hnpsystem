import { useEffect } from "react";
import LoginPresentationPageUi from "@/components/page-ui/login-presentation/login-presentation-ui";
import { useTheme } from "@/styles/themeProvider";

export default function LoginPresentationPage() {
  const { setTemporaryOverride } = useTheme();

  // Lock the role-picker into the brand red accent regardless of the visitor's
  // saved theme preference — Presentation Mode is a controlled demo surface.
  useEffect(() => {
    setTemporaryOverride({ mode: "system", accent: "red" });
    return () => {
      setTemporaryOverride(null);
    };
  }, [setTemporaryOverride]);

  return <LoginPresentationPageUi />;
}
