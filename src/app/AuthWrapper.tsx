"use client";

import { ReactNode, useState } from "react";

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(true); // mock as always authenticated

  if (!isAuthenticated) {
    return <div style={{ padding: 40, textAlign: "center" }}>Loading authentication...</div>;
  }

  return <>{children}</>;
}
