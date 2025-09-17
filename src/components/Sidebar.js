// src/components/Sidebar.js
import React, { useState } from "react"; // import React and useState hook for state management
import "./Layout.css"; // import CSS for styling the sidebar
import Link from "next/link"; // Next.js Link component for client-side navigation

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true); // state to track if sidebar is open or closed

  const toggleSidebar = () => { 
    setIsOpen(!isOpen); // toggle the sidebar open/closed
  };

  return (
    <>
      {/* Hamburger button, only shows when sidebar is closed */}
      <button
        className="hamburger-btn"
        onClick={toggleSidebar} // clicking it opens the sidebar
        style={{ display: isOpen ? "none" : "block" }} // hide button if sidebar is open
      >
        ☰ {/* Hamburger icon */}
      </button>

      {/* Sidebar container */}
      <div className={`sidebar ${isOpen ? "open" : "closed"}`}> {/* apply open/closed classes for styling */}
        <button className="close-btn" onClick={toggleSidebar}> {/* close button at top-right */}
          X {/* Close icon */}
        </button>

        {isOpen && ( // only render menu items if sidebar is open
          <ul> {/* list of navigation links */}
            <li>
              <Link href="/dashboard">Dashboard</Link> {/* link to Dashboard page */}
            </li>
            <li>
              <Link href="/accounts">Accounts</Link> {/* link to Accounts page */}
            </li>
            <li>
              <Link href="/workshop">Workshop</Link> {/* link to Workshop page */}
            </li>
            <li>
              <Link href="/parts">Parts</Link> {/* link to Parts page */}
            </li>
            <li>
              <Link href="/settings">Settings</Link> {/* link to Settings page */}
            </li>
          </ul>
        )}
      </div>
    </>
  );
};

export default Sidebar; // export Sidebar component for use in Layout or other pages
