// src/pages/login.js
import { useState } from "react"; // import React hook for state management

export default function LoginPage() {
  const [authenticated, setAuthenticated] = useState(false); // track if user is logged in
  const [username, setUsername] = useState(""); // store logged-in username

  // function to mock login
  const handleLogin = () => {
    setUsername("TestUser"); // set a test username
    setAuthenticated(true); // mark as authenticated
  };

  // function to log out
  const handleLogout = () => {
    setUsername(""); // clear username
    setAuthenticated(false); // mark as not authenticated
  };

  // if user is not authenticated, show login screen
  if (!authenticated) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Login</h1>
        <p>You must log in to access the system.</p>
        <button
          onClick={handleLogin} // click triggers mock login
          style={{
            backgroundColor: "#c00", // H&P red
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

  // if authenticated, show welcome and logout button
  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>Welcome, {username}</h1> {/* display username */}
      <p>You are logged in.</p>
      <button
        onClick={handleLogout} // click logs out
        style={{
          backgroundColor: "gray", // gray for logout
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
