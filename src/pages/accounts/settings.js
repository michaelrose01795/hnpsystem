// file location: src/pages/accounts/settings.js // header comment referencing file path
import React, { useEffect, useState } from "react"; // import React with state/effect hooks
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
const SETTINGS_ROLES = ["ADMIN", "OWNER", "ADMIN MANAGER", "ACCOUNTS", "ACCOUNTS MANAGER"];
const initialSettings = {
  requireManagerApproval: true,
  allowManagersToFreeze: true,
  showSalesAccountsInInvoices: true,
  enableOverdueNotifications: true,
  defaultInvoiceExportFormat: "csv",
  defaultPageSize: 20,
};
export default function AccountsSettingsPage() {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch("/api/accounts/settings");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load settings");
        }
        setSettings({ ...initialSettings, ...(payload.data || {}) });
      } catch (error) {
        console.error("Failed to load account settings", error);
        setMessage(error.message || "Unable to load settings");
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);
  const handleToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const handleSave = async () => {
    setMessage("");
    try {
      const response = await fetch("/api/accounts/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to save settings");
      }
      setMessage("Settings saved successfully.");
    } catch (error) {
      console.error("Failed to save account settings", error);
      setMessage(error.message || "Unable to save settings");
    }
  };
  const settingRow = (label, description, control) => (
    <div style={{ border: "1px solid var(--surface-light)", borderRadius: "14px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
      <div style={{ flex: "1 1 280px" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)" }}>{label}</h3>
        <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>{description}</p>
      </div>
      <div style={{ flex: "0 0 auto" }}>{control}</div>
    </div>
  );
  const toggleControl = (key) => (
    <button type="button" onClick={() => handleToggle(key)} style={{ padding: "8px 16px", borderRadius: "999px", border: settings[key] ? "none" : "1px solid var(--surface-light)", background: settings[key] ? "var(--primary)" : "var(--surface-light)", color: settings[key] ? "white" : "var(--text-secondary)", fontWeight: 600 }}>{settings[key] ? "Enabled" : "Disabled"}</button>
  );
  return (
    <ProtectedRoute allowedRoles={SETTINGS_ROLES}>
      <Layout>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <h1 style={{ margin: 0, color: "var(--primary)", fontSize: "2rem" }}>Account Settings</h1>
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Control access, overdue notifications, and default account behaviors.</p>
          </div>
          {message && (
            <div style={{ padding: "12px 16px", borderRadius: "12px", background: message.includes("successfully") ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)", color: message.includes("successfully") ? "#065f46" : "#b91c1c", fontWeight: 600 }}>{message}</div>
          )}
          {loading && <p style={{ color: "var(--text-secondary)" }}>Loading settings…</p>}
          {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {settingRow("Manager Approval", "Require accounts manager approval before increasing credit limits over £5k.", toggleControl("requireManagerApproval"))}
              {settingRow("Manager Freeze Access", "Allow service and workshop managers to freeze/unfreeze accounts directly.", toggleControl("allowManagersToFreeze"))}
              {settingRow("Show Sales Accounts", "Display sales-ledger accounts in the invoices workspace for salespeople.", toggleControl("showSalesAccountsInInvoices"))}
              {settingRow("Overdue Notifications", "Send alerts to account owners when invoices exceed their due dates.", toggleControl("enableOverdueNotifications"))}
              {settingRow("Export Format", "Default export option for invoice and transaction downloads.", (
                <select value={settings.defaultInvoiceExportFormat} onChange={(event) => setSettings((prev) => ({ ...prev, defaultInvoiceExportFormat: event.target.value }))} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--surface-light)", background: "var(--surface-light)", fontWeight: 600 }}>
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
              ))}
              {settingRow("Default Page Size", "Rows displayed per page on accounts and invoices tables.", (
                <input type="number" min="10" max="100" step="10" value={settings.defaultPageSize} onChange={(event) => setSettings((prev) => ({ ...prev, defaultPageSize: Number(event.target.value) }))} style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", width: "100px" }} />
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={handleSave} style={{ padding: "12px 20px", borderRadius: "10px", border: "none", background: "var(--primary)", color: "white", fontWeight: 700 }}>Save Settings</button>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
