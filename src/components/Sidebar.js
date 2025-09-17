import React, { useState } from "react";
import "./Layout.css"; // make sure Layout.css has the styles I gave you

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Hamburger button to open sidebar when closed */}
      {!isOpen && (
        <button className="hamburger-btn" onClick={toggleSidebar}>
          ☰
        </button>
      )}

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
