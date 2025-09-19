// src/pages/admin/settings.js
import React, { useState } from "react";

export default function SystemSettings() {
  // Placeholder settings state
  const [settings, setSettings] = useState({
    companyName: "Humphries & Parks",
    timezone: "GMT",
    emailNotifications: true,
    smsNotifications: false,
  });

  // Handle toggles/updates
  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setSettings({
      ...settings,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSave = () => {
    alert("TODO: Save settings to backend");
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>System Settings</h1>
      <p>Manage global system configurations. (Placeholder form shown)</p>

      <form style={{ marginTop: "1.5rem", maxWidth: "600px" }}>
        {/* Company Name */}
        <div style={formGroup}>
          <label style={labelStyle}>Company Name</label>
          <input
            type="text"
            name="companyName"
            value={settings.companyName}
            onChange={handleChange}
            style={inputStyle}
          />
        </div>

        {/* Timezone */}
        <div style={formGroup}>
          <label style={labelStyle}>Timezone</label>
          <select
            name="timezone"
            value={settings.timezone}
            onChange={handleChange}
            style={inputStyle}
          >
            <option value="GMT">GMT</option>
            <option value="CET">CET</option>
            <option value="EST">EST</option>
            <option value="PST">PST</option>
          </select>
        </div>

        {/* Notifications */}
        <div style={formGroup}>
          <label style={labelStyle}>
            <input
              type="checkbox"
              name="emailNotifications"
              checked={settings.emailNotifications}
              onChange={handleChange}
            />{" "}
            Enable Email Notifications
          </label>
        </div>

        <div style={formGroup}>
          <label style={labelStyle}>
            <input
              type="checkbox"
              name="smsNotifications"
              checked={settings.smsNotifications}
              onChange={handleChange}
            />{" "}
            Enable SMS Notifications
          </label>
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            backgroundColor: "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          💾 Save Settings
        </button>
      </form>
    </div>
  );
}

// Styles
const formGroup = {
  marginBottom: "1rem",
};

const labelStyle = {
  display: "block",
  marginBottom: "0.5rem",
  fontWeight: "bold",
};

const inputStyle = {
  width: "100%",
  padding: "0.5rem",
  borderRadius: "4px",
  border: "1px solid #ddd",
};