// file location: src/components/accounts/AccountsSettingsPanel.js
import React, { useEffect, useState } from "react";
import { Button, StatusMessage } from "@/components/ui";
import DropdownField from "@/components/ui/dropdownAPI/DropdownField";

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

export default function AccountsSettingsPanel({ embedded = false, onClose }) {
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
      const response = await fetch("/api/accounts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
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
    <div style={{ border: "none", borderRadius: "var(--radius-md)", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: embedded ? "var(--surface)" : "transparent" }}>
      <div style={{ flex: "1 1 280px" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)" }}>{label}</h3>
        <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>{description}</p>
      </div>
      <div style={{ flex: "0 0 auto" }}>{control}</div>
    </div>
  );

  const toggleControl = (key) => (
    <Button type="button" onClick={() => handleToggle(key)} variant={settings[key] ? "primary" : "secondary"} size="sm" pill>
      {settings[key] ? "Enabled" : "Disabled"}
    </Button>
  );

  const sectionCardStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "20px",
    borderRadius: "var(--radius-lg)",
    background: "var(--surface)",
    border: "1px solid rgba(var(--primary-rgb), 0.1)",
  };

  return (
    <div style={{ maxWidth: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px", padding: embedded ? "24px" : 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, color: "var(--primary)", fontSize: "1.75rem" }}>Account Settings</h1>
        {embedded && onClose ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
      {message && <StatusMessage tone={message.includes("successfully") ? "success" : "danger"}>{message}</StatusMessage>}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "16px" }}>
        <section style={sectionCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.1rem" }}>Account Controls</h2>
            {!loading ? (
              <Button type="button" onClick={handleSave}>
                Save Settings
              </Button>
            ) : null}
          </div>
          {loading ? <p style={{ color: "var(--text-secondary)", margin: 0 }}>Loading settings…</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {settingRow("Manager Approval", "Require accounts manager approval before increasing credit limits over £5k.", toggleControl("requireManagerApproval"))}
              {settingRow("Manager Freeze Access", "Allow service and workshop managers to freeze/unfreeze accounts directly.", toggleControl("allowManagersToFreeze"))}
              {settingRow("Show Sales Accounts", "Display sales-ledger accounts in the invoices workspace for salespeople.", toggleControl("showSalesAccountsInInvoices"))}
              {settingRow("Overdue Notifications", "Send alerts to account owners when invoices exceed their due dates.", toggleControl("enableOverdueNotifications"))}
              {settingRow(
                "Export Format",
                "Default export option for invoice and transaction downloads.",
                <DropdownField
                  value={settings.defaultInvoiceExportFormat}
                  onChange={(event) => setSettings((prev) => ({ ...prev, defaultInvoiceExportFormat: event.target.value }))}
                  options={[
                    { label: "CSV", value: "csv" },
                    { label: "Excel", value: "xlsx" },
                    { label: "PDF", value: "pdf" },
                  ]}
                  style={{ minWidth: "160px" }}
                />
              )}
            </div>
          )}
        </section>

        <section style={sectionCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, color: "var(--primary)", fontSize: "1.1rem" }}>Company & Bank Details</h2>
            {!companyLoading ? (
              <Button type="button" onClick={handleCompanySave} disabled={companySaving}>
                {companySaving ? "Saving…" : "Save Company Details"}
              </Button>
            ) : null}
          </div>
          {companyMessage && <StatusMessage tone={companyMessage.includes("saved") ? "success" : "danger"}>{companyMessage}</StatusMessage>}
          {companyLoading ? (
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>Loading company profile…</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              <input className="app-input" value={companyProfile.company_name} onChange={(event) => handleCompanyInputChange("company_name", event.target.value)} placeholder="Company name" />
              <input className="app-input" value={companyProfile.address_line1} onChange={(event) => handleCompanyInputChange("address_line1", event.target.value)} placeholder="Address line 1" />
              <input className="app-input" value={companyProfile.address_line2} onChange={(event) => handleCompanyInputChange("address_line2", event.target.value)} placeholder="Address line 2" />
              <input className="app-input" value={companyProfile.city} onChange={(event) => handleCompanyInputChange("city", event.target.value)} placeholder="City" />
              <input className="app-input" value={companyProfile.postcode} onChange={(event) => handleCompanyInputChange("postcode", event.target.value)} placeholder="Postcode" />
              <input className="app-input" value={companyProfile.phone_service} onChange={(event) => handleCompanyInputChange("phone_service", event.target.value)} placeholder="Service phone" />
              <input className="app-input" value={companyProfile.phone_parts} onChange={(event) => handleCompanyInputChange("phone_parts", event.target.value)} placeholder="Parts phone" />
              <input className="app-input" value={companyProfile.website} onChange={(event) => handleCompanyInputChange("website", event.target.value)} placeholder="Website" />
              <input className="app-input" value={companyProfile.bank_name} onChange={(event) => handleCompanyInputChange("bank_name", event.target.value)} placeholder="Bank name" />
              <input className="app-input" value={companyProfile.sort_code} onChange={(event) => handleCompanyInputChange("sort_code", event.target.value)} placeholder="Sort code" />
              <input className="app-input" value={companyProfile.account_number} onChange={(event) => handleCompanyInputChange("account_number", event.target.value)} placeholder="Account number" />
              <input className="app-input" value={companyProfile.account_name} onChange={(event) => handleCompanyInputChange("account_name", event.target.value)} placeholder="Account name" />
              <textarea className="app-input" value={companyProfile.payment_reference_hint} onChange={(event) => handleCompanyInputChange("payment_reference_hint", event.target.value)} placeholder="Payment reference hint" rows={3} style={{ gridColumn: "1 / -1" }} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
