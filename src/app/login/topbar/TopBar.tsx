"use client"; // must be first line for client-side hooks

import React from "react";
import { useAuth } from "../../AuthContext"; // fixed relative path
import "./TopBar.css";

const TopBar = () => {
  const { user, logout } = useAuth();

  return (
    <div className="topbar">
      <h1>H&P System</h1>
      {user ? (
        <button className="logout-btn" onClick={logout}>
          Logout ({user.username})
        </button>
      ) : null}
    </div>
  );
};

export default TopBar;
