// file location: src/pages/accounts/settings.js // header comment referencing file path
import React, { useEffect, useState } from "react"; // import React with state/effect hooks
import Layout from "@/components/Layout"; // import shared layout for consistent chrome
import ProtectedRoute from "@/components/ProtectedRoute"; // import route guard for Keycloak roles
const SETTINGS_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"]; // restrict settings page to accounts leadership
const initialSettings = { // local default values for settings toggles
  requireManagerApproval: true, // default to requiring manager approval for large credits
  allowManagersToFreeze: true, // allow managers to freeze/unfreeze accounts by default
  showSalesAccountsInInvoices: true, // show sales accounts alongside service accounts
  enableOverdueNotifications: true, // send overdue alerts by default
  defaultInvoiceExportFormat: "csv", // default export format
  defaultPageSize: 20, // default pagination size for accounts tables
}; // close initialSettings object
export default function AccountsSettingsPage() { // component definition for settings page
  const [settings, setSettings] = useState(initialSettings); // store settings state for toggles
  const [loading, setLoading] = useState(true); // track loading state while fetching settings from API
  const [message, setMessage] = useState(""); // message string for success/error toasts
  useEffect(() => { // effect to fetch settings from API when component mounts
    const loadSettings = async () => { // async loader function
      setLoading(true); // indicate loading state
      setMessage(""); // clear any stale message
      try { // wrap fetch in try/catch to handle errors
        const response = await fetch("/api/accounts/settings"); // call settings API endpoint
        const payload = await response.json(); // parse JSON response
        if (!response.ok) { // check HTTP status code
          throw new Error(payload?.message || "Failed to load settings"); // throw error for catch block when status not OK
        } // close guard
        setSettings({ ...initialSettings, ...(payload.data || {}) }); // merge server payload with defaults to fill missing keys
      } catch (error) { // handle fetch errors
        console.error("Failed to load account settings", error); // log error for debugging
        setMessage(error.message || "Unable to load settings"); // show error message in UI
      } finally { // cleanup block executed after try/catch
        setLoading(false); // hide loading indicator
      } // close finally block
    }; // close loadSettings definition
    loadSettings(); // trigger load on mount
  }, []); // run effect only once since dependency array empty
  const handleToggle = (key) => { // helper to toggle boolean settings
    setSettings((prev) => ({ ...prev, [key]: !prev[key] })); // invert targeted boolean key in settings state
  }; // close handleToggle helper
  const handleSave = async () => { // persist settings back to API endpoint
    setMessage(""); // clear old messages before attempt
    try { // wrap API call in try/catch
      const response = await fetch("/api/accounts/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }); // send updated settings to API
      const payload = await response.json(); // parse JSON response
      if (!response.ok) { // check HTTP status
        throw new Error(payload?.message || "Failed to save settings"); // throw error to be caught below
      } // close guard
      setMessage("Settings saved successfully."); // show success message when request completes
    } catch (error) { // handle fetch errors
      console.error("Failed to save account settings", error); // log error for debugging
      setMessage(error.message || "Unable to save settings"); // surface error to UI
    } // close catch block
  }; // close handleSave
  const settingRow = (label, description, control) => ( // helper rendering settings row with label/description/control
    <div style={{ border: "1px solid var(--surface-light)", borderRadius: "14px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}> // row container styled as card
      <div style={{ flex: "1 1 280px" }}> // container for label/description text
        <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)" }}>{label}</h3> // setting label text
        <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>{description}</p> // description explaining what toggle does
      </div>
      <div style={{ flex: "0 0 auto" }}>{control}</div> // container for control element (toggle/select)
    </div>
  ); // close helper function
  const toggleControl = (key) => ( // helper returning toggle switch for boolean setting keys
    <button type="button" onClick={() => handleToggle(key)} style={{ padding: "8px 16px", borderRadius: "999px", border: settings[key] ? "none" : "1px solid var(--surface-light)", background: settings[key] ? "var(--primary)" : "var(--surface-light)", color: settings[key] ? "white" : "var(--text-secondary)", fontWeight: 600 }}>{settings[key] ? "Enabled" : "Disabled"}</button> // pill toggle button reflecting state
  ); // close toggleControl helper
  return ( // render settings page tree
    <ProtectedRoute allowedRoles={SETTINGS_ROLES}> // restrict to finance leadership roles
      <Layout> // wrap with layout chrome
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}> // center settings card column
          <div> // heading container above settings
            <h1 style={{ margin: 0, color: "var(--primary)", fontSize: "2rem" }}>Account Settings</h1> // page title text
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Control access, overdue notifications, and default account behaviors.</p> // subtitle text
          </div>
          {message && ( // show status message when string present
            <div style={{ padding: "12px 16px", borderRadius: "12px", background: message.includes("successfully") ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)", color: message.includes("successfully") ? "#065f46" : "#b91c1c", fontWeight: 600 }}>{message}</div> // message alert styled based on success/error
          )}
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading settings…</p>} // show loading message while fetching settings
          {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}> // container stacking settings cards
              {settingRow("Manager Approval", "Require accounts manager approval before increasing credit limits over £5k.", toggleControl("requireManagerApproval"))} // row for approval toggle
              {settingRow("Manager Freeze Access", "Allow service and workshop managers to freeze/unfreeze accounts directly.", toggleControl("allowManagersToFreeze"))} // row for freeze toggle
              {settingRow("Show Sales Accounts", "Display sales-ledger accounts in the invoices workspace for salespeople.", toggleControl("showSalesAccountsInInvoices"))} // row for sales visibility toggle
              {settingRow("Overdue Notifications", "Send alerts to account owners when invoices exceed their due dates.", toggleControl("enableOverdueNotifications"))} // row for overdue notification toggle
              {settingRow("Export Format", "Default export option for invoice and transaction downloads.", (
                <select value={settings.defaultInvoiceExportFormat} onChange={(event) => setSettings((prev) => ({ ...prev, defaultInvoiceExportFormat: event.target.value }))} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}> // select control for export format
                  <option value="csv">CSV</option> // option for CSV export
                  <option value="xlsx">Excel</option> // option for Excel export
                  <option value="pdf">PDF</option> // option for PDF export
                </select>
              ))} // row for export format selection
              {settingRow("Default Page Size", "Rows displayed per page on accounts and invoices tables.", (
                <input type="number" min="10" max="100" step="10" value={settings.defaultPageSize} onChange={(event) => setSettings((prev) => ({ ...prev, defaultPageSize: Number(event.target.value) }))} style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", width: "100px" }} /> // number input controlling default page size
              ))} // row for page size input
              <div style={{ display: "flex", justifyContent: "flex-end" }}> // footer row containing save button
                <button type="button" onClick={handleSave} style={{ padding: "12px 20px", borderRadius: "10px", border: "none", background: "var(--primary)", color: "white", fontWeight: 700 }}>Save Settings</button> // save button to persist settings via API
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  ); // close component render tree
} // close AccountsSettingsPage definition
