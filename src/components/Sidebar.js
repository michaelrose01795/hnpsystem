import React, { useState } from "react";
import "./Layout.css";

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
            <li>Dashboard</li>
            <li>Accounts</li>
            <li>Workshop</li>
            <li>Parts</li>
            <li>Settings</li>
          </ul>
        )}
      </div>
    </>
  );
};

export default Sidebar;
