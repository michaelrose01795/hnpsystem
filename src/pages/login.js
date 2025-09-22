// file location: /src/pages/login.js
import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useUser } from "../context/UserContext";

export default function LoginPage() {
  const { devLogin } = useUser();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("WORKSHOP");

  const handleDevLogin = () => {
    devLogin(username, role);
    window.location.href = "/dashboard"; // redirect after login
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Login</h1>

      {/* Keycloak login */}
      <button onClick={() => signIn("keycloak")}>Login with SSO</button>

      <hr />

      {/* Dev login for testing */}
      <h2>Developer Login (Bypass SSO)</h2>
      <input
        type="text"
        placeholder="Enter username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="ADMIN">Admin</option>
        <option value="SALES">Sales</option>
        <option value="WORKSHOP">Workshop</option>
        <option value="PARTS">Parts</option>
        <option value="MANAGERS">Managers</option>
      </select>
      <button onClick={handleDevLogin}>Dev Login</button>
    </div>
  );
}
