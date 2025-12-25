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
const defaultCompanyProfile = {
  company_name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postcode: "",
  phone_service: "",
  phone_parts: "",
  website: "",
  bank_name: "",
  sort_code: "",
  account_number: "",
  account_name: "",
  payment_reference_hint: "",
};
export default function AccountsSettingsPage() {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [companyProfile, setCompanyProfile] = useState(defaultCompanyProfile);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companyMessage, setCompanyMessage] = useState("");
  const [companySaving, setCompanySaving] = useState(false);
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
    const loadCompanyProfile = async () => {
      setCompanyLoading(true);
      setCompanyMessage("");
      try {
        const response = await fetch("/api/settings/company-profile");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load company profile");
        }
        setCompanyProfile({ ...defaultCompanyProfile, ...(payload.data || {}) });
      } catch (error) {
        console.error("Failed to load company profile", error);
        setCompanyMessage(error.message || "Unable to load company profile");
      } finally {
        setCompanyLoading(false);
      }
    };
    loadSettings();
    loadCompanyProfile();
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
  const handleCompanyInputChange = (field, value) => {
    setCompanyProfile((prev) => ({ ...prev, [field]: value }));
  };
  const handleCompanySave = async () => {
    setCompanyMessage("");
    setCompanySaving(true);
    try {
      const response = await fetch("/api/settings/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyProfile),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to save company profile");
      }
      setCompanyProfile(payload.data || defaultCompanyProfile);
      setCompanyMessage("Company & bank details saved.");
    } catch (error) {
      console.error("Failed to save company profile", error);
      setCompanyMessage(error.message || "Unable to save company profile.");
    } finally {
      setCompanySaving(false);
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
          <div style={{ paddingTop: "32px" }}>
            <h2 style={{ margin: "0 0 8px", color: "var(--primary)" }}>Company & Bank Details</h2>
            <p style={{ margin: "0 0 16px", color: "var(--text-secondary)" }}>Update the invoice header and payment details used across the system.</p>
            {companyMessage && (
              <div style={{ padding: "12px 16px", borderRadius: "12px", background: companyMessage.includes("saved") ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)", color: companyMessage.includes("saved") ? "#065f46" : "#b91c1c", fontWeight: 600 }}>{companyMessage}</div>
            )}
            {companyLoading ? (
              <p style={{ color: "var(--text-secondary)" }}>Loading company profile…</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                <input value={companyProfile.company_name} onChange={(event) => handleCompanyInputChange("company_name", event.target.value)} placeholder="Company name" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <input value={companyProfile.address_line1} onChange={(event) => handleCompanyInputChange("address_line1", event.target.value)} placeholder="Address line 1" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <input value={companyProfile.address_line2} onChange={(event) => handleCompanyInputChange("address_line2", event.target.value)} placeholder="Address line 2" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <input value={companyProfile.city} onChange={(event) => handleCompanyInputChange("city", event.target.value)} placeholder="City" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <input value={companyProfile.postcode} onChange={(event) => handleCompanyInputChange("postcode", event.target.value)} placeholder="Postcode" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <input value={companyProfile.phone_service} onChange={(event) => handleCompanyInputChange("phone_service", event.target.value)} placeholder="Service phone" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <input value={companyProfile.phone_parts} onChange={(event) => handleCompanyInputChange("phone_parts", event.target.value)} placeholder="Parts phone" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <input value={companyProfile.website} onChange={(event) => handleCompanyInputChange("website", event.target.value)} placeholder="Website" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <input value={companyProfile.bank_name} onChange={(event) => handleCompanyInputChange("bank_name", event.target.value)} placeholder="Bank name" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <input value={companyProfile.sort_code} onChange={(event) => handleCompanyInputChange("sort_code", event.target.value)} placeholder="Sort code" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <input value={companyProfile.account_number} onChange={(event) => handleCompanyInputChange("account_number", event.target.value)} placeholder="Account number" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <input value={companyProfile.account_name} onChange={(event) => handleCompanyInputChange("account_name", event.target.value)} placeholder="Account name" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)" }} />
                <textarea value={companyProfile.payment_reference_hint} onChange={(event) => handleCompanyInputChange("payment_reference_hint", event.target.value)} placeholder="Payment reference hint" rows={3} style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--surface-light)", gridColumn: "1 / -1" }} />
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button type="button" onClick={handleCompanySave} disabled={companySaving} style={{ padding: "12px 20px", borderRadius: "10px", border: "none", background: "var(--primary-dark)", color: "white", fontWeight: 700, opacity: companySaving ? 0.6 : 1 }}>
                {companySaving ? "Saving…" : "Save Company Details"}
              </button>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
