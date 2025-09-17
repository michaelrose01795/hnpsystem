// src/pages/login.js
import { useEffect, useState } from "react";
import keycloak from "../auth/keycloak";

export default function LoginPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    keycloak
      .init({ onLoad: "check-sso", checkLoginIframe: false })
      .then(auth => {
        setAuthenticated(auth);
        if (auth) {
          setUsername(keycloak.tokenParsed?.preferred_username || "");
        }
      })
      .catch(err => console.error("Keycloak init error:", err));
  }, []);

  if (!authenticated) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Login</h1>
        <p>You must log in to access the system.</p>
        <button
          onClick={() => keycloak.login()}
          style={{
            backgroundColor: "#c00",
            color: "white",
            padding: "10px 20px",
            borderRadius: "6px",
            cursor: "pointer",
            border: "none",
            marginTop: "15px",
          }}
        >
          Login with Keycloak
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>Welcome, {username}</h1>
      <p>You are logged in.</p>
      <button
        onClick={() => keycloak.logout()}
        style={{
          backgroundColor: "gray",
          color: "white",
          padding: "10px 20px",
          borderRadius: "6px",
          cursor: "pointer",
          border: "none",
          marginTop: "15px",
        }}
      >
        Logout
      </button>
    </div>
  );
}
