// src/app/login/topbar/TopBar.tsx
"use client"; // must be first line to allow React hooks and client-side code

import React from "react"; // import React
import { useAuth } from "../../../context/UserContext"; // import authentication context for user info & logout
import "./TopBar.css"; // import styling for the topbar

const TopBar = () => {
  const { user, logout } = useAuth(); // destructure user info and logout function from context

  return (
    <div className="topbar"> {/* main topbar container */}
      <h1>H&P System</h1> {/* system title/logo */}
      
      {user ? (  // only show logout if user is logged in
        <button className="logout-btn" onClick={logout}>
          Logout ({user.username}) {/* show logged-in username */}
        </button>
      ) : null} 
    </div>
  );
};

export default TopBar; // export component to be used in RootLayout
