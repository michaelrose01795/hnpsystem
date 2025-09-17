// src/pages/_app.js
import { useEffect, useState } from "react";
import keycloak from "../auth/Keycloak";
import "../styles/global.css";  // relative path from _app.js to global.css

export default function App({ Component, pageProps }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    keycloak
      .init({ onLoad: "login-required", checkLoginIframe: false })
      .then(authenticated => {
        setIsAuthenticated(authenticated);
      })
      .catch(err => {
        console.error("Keycloak init error:", err);
      });
  }, []);

  if (!isAuthenticated) {
    return <div>Loading authentication...</div>;
  }

  return <Component {...pageProps} />;
}
