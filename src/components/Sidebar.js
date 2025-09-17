import React, { useState } from "react";
import "./Layout.css";
import Link from "next/link"; // Use this if using Next.js for navigation

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Hamburger button always visible, only clickable when sidebar closed */}
      <button
        className="hamburger-btn"
        onClick={toggleSidebar}
        style={{ display: isOpen ? "none" : "block" }}
      >
        ☰
      </button>

      <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
        <button className="close-btn" onClick={toggleSidebar}>
          X
        </button>

        {isOpen && (
          <ul>
            <li>
              <Link href="/dashboard">Dashboard</Link>
            </li>
            <li>
              <Link href="/accounts">Accounts</Link>
            </li>
            <li>
              <Link href="/workshop">Workshop</Link>
            </li>
            <li>
              <Link href="/parts">Parts</Link>
            </li>
            <li>
              <Link href="/settings">Settings</Link>
            </li>
          </ul>
        )}
      </div>
    </>
  );
};

export default Sidebar;
