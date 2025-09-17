// src/app/AuthWrapper.tsx
"use client"; // marks this component as a client-side React component

import { ReactNode, useState } from "react"; // import types and React hooks

// AuthWrapper component wraps child components and handles authentication state
export default function AuthWrapper({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(true); 
  // mock authentication state, currently always true for testing

  // If user is not authenticated, show a loading / waiting message
  if (!isAuthenticated) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        Loading authentication...
      </div>
    );
  }

  // If authenticated, render children (wrapped components)
  return <>{children}</>; // React fragment to return children without extra DOM element
}
