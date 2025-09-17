"use client";

import { ReactNode, useEffect, useState } from "react";
import keycloak from "../auth/keycloak"; // your Keycloak module

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    keycloak
      .init({ onLoad: "login-required", checkLoginIframe: false })
      .then((auth) => setIsAuthenticated(auth))
      .catch((err) => console.error("Keycloak init error:", err));
  }, []);

  if (!isAuthenticated) {
    return <div style={{ padding: 40, textAlign: "center" }}>Loading authentication...</div>;
  }

  return <>{children}</>;
}
