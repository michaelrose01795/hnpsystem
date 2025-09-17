// src/pages/login.js
import { useState } from "react";

export default function LoginPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");

  const handleLogin = () => {
    // Mock login: you can change the username for testing
    setUsername("TestUser");
    setAuthenticated(true);
  };

  const handleLogout = () => {
    setUsername("");
    setAuthenticated(false);
  };

  if (!authenticated) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Login</h1>
        <p>You must log in to access the system.</p>
        <button
          onClick={handleLogin}
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
          Mock Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>Welcome, {username}</h1>
      <p>You are logged in.</p>
      <button
        onClick={handleLogout}
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
