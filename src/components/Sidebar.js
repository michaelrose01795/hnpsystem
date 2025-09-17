import React, { useState } from "react";
import "./Layout.css"; // or Sidebar.css if you have separate styling

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
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
  );
};

export default Sidebar;
