// src/app/login/topbar/TopBar.tsx
"use client"; // must be first line to allow React hooks and client-side code

import React from "react";
import { useUser } from "../../../context/UserContext"; // ✅ correct hook
import "./TopBar.css";

const TopBar = () => {
  const { user, setUser } = useUser(); // ✅ useUser instead of useAuth

  const handleLogout = () => {
    setUser(null); // clears user when logging out
  };

  return (
    <div className="topbar">
      <h1>H&P System</h1>

      {user ? (
        <button className="logout-btn" onClick={handleLogout}>
          Logout ({user.name}) {/* show logged-in username */}
        </button>
      ) : null}
    </div>
  );
};

export default TopBar;