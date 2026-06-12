// file location: src/components/page-ui/job-cards/contact/CustomerContactSection.js
// "Customer Contact" section of the redesigned job-card Contact tab. Friendly
// display of name / phones / emails / preference / primary + work address with
// "View on map" links, plus a bottom action bar (Call / Text / Email / WhatsApp)
// that opens ContactActionPopup to launch the device's native app.
import React, { useEffect, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";
import ContactActionPopup from "./ContactActionPopup";
import { CONTACT_ACTIONS, toMapsUrl } from "./contactConstants";

const CONTACT_PREFERENCES = ["Email", "Phone", "SMS", "WhatsApp", "No Preference"];

const labelStyle = {
  fontSize: "0.65rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-1)",
  opacity: 0.7,
  fontWeight: 700,
  marginBottom: "4px",
  display: "block",
};

const valueStyle = {
  fontSize: "var(--control-font-size)",
  color: "var(--text-1)",
  fontWeight: 600,
  overflowWrap: "anywhere",
};

function buildInitialForm(jobData) {
  return {
    firstName: jobData.customerFirstName || "",
    lastName: jobData.customerLastName || "",
    email: jobData.customerEmail || "",
    mobile: jobData.customerMobile || jobData.customerPhone || "",
    telephone: jobData.customerTelephone || "",
    contactPreference: jobData.customerContactPreference || "Email",
    address: jobData.customerAddress || "",
    postcode: jobData.customerPostcode || "",
    workAddress: jobData.customerWorkAddress || "",
    workPostcode: jobData.customerWorkPostcode || "",
  };
}

function DisplayField({ label, value }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div style={valueStyle}>{value || "—"}</div>
    </div>
  );
}

function EditField({ label, children }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

export default function CustomerContactSection({
  jobData,
  canEdit,
  onSaveCustomerDetails,
  customerSaving,
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => buildInitialForm(jobData));
  const [activeAction, setActiveAction] = useState(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!editing) {
      setForm(buildInitialForm(jobData));
      setSaveError("");
    }
  }, [jobData, editing]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaveError("");
    const result = await onSaveCustomerDetails?.({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      mobile: form.mobile,
      telephone: form.telephone,
      contactPreference: form.contactPreference,
      address: form.address,
      postcode: form.postcode,
      workAddress: form.workAddress,
      workPostcode: form.workPostcode,
    });
    if (result?.success) {
      setEditing(false);
    } else if (result?.error?.message) {
      setSaveError(result.error.message);
    }
  };

  const name = jobData.customer || `${jobData.customerFirstName || ""} ${jobData.customerLastName || ""}`.trim();
  const mobile = jobData.customerMobile || jobData.customerPhone || "";
  const contact = {
    name,
    mobile,
    telephone: jobData.customerTelephone || "",
    email: jobData.customerEmail || "",
  };

  const hasPrimaryAddress = Boolean(jobData.customerAddress || jobData.customerPostcode);
  const hasWorkAddress = Boolean(jobData.customerWorkAddress || jobData.customerWorkPostcode);

  return (
    <LayerSurface
      sectionKey="jobcard-contact-customer"
      sectionType="section-shell"
      parentKey="jobcard-tab-contact"
      shell
      gap="var(--space-4)"
    >
      <div className="app-layout-header-row">
        <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-1)" }}>Customer Contact</h3>
        {canEdit && !editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit Details
          </Button>
        )}
        {canEdit && editing && (
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={customerSaving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={customerSaving}>
              {customerSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      {saveError && <StatusMessage tone="danger">{saveError}</StatusMessage>}

      {editing ? (
        <div
          style={{
            display: "grid",
            gap: "16px",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <EditField label="First name">
            <input className="app-input" value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} disabled={customerSaving} />
          </EditField>
          <EditField label="Last name">
            <input className="app-input" value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} disabled={customerSaving} />
          </EditField>
          <EditField label="Mobile phone">
            <input className="app-input" type="tel" value={form.mobile} onChange={(e) => setField("mobile", e.target.value)} disabled={customerSaving} />
          </EditField>
          <EditField label="Landline phone">
            <input className="app-input" type="tel" value={form.telephone} onChange={(e) => setField("telephone", e.target.value)} disabled={customerSaving} />
          </EditField>
          <EditField label="Email address">
            <input className="app-input" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} disabled={customerSaving} />
          </EditField>
          <EditField label="Contact preference">
            <select className="app-input" value={form.contactPreference} onChange={(e) => setField("contactPreference", e.target.value)} disabled={customerSaving}>
              {CONTACT_PREFERENCES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </EditField>
          <EditField label="Primary address">
            <input className="app-input" value={form.address} onChange={(e) => setField("address", e.target.value)} disabled={customerSaving} />
          </EditField>
          <EditField label="Primary postcode">
            <input className="app-input" value={form.postcode} onChange={(e) => setField("postcode", e.target.value)} disabled={customerSaving} />
          </EditField>
          <EditField label="Work address">
            <input className="app-input" value={form.workAddress} onChange={(e) => setField("workAddress", e.target.value)} disabled={customerSaving} />
          </EditField>
          <EditField label="Work postcode">
            <input className="app-input" value={form.workPostcode} onChange={(e) => setField("workPostcode", e.target.value)} disabled={customerSaving} />
          </EditField>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gap: "16px",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            <DisplayField label="Customer name" value={name} />
            <DisplayField label="Mobile phone" value={mobile} />
            <DisplayField label="Landline phone" value={jobData.customerTelephone} />
            <DisplayField label="Email address" value={jobData.customerEmail} />
            <DisplayField label="Contact preference" value={jobData.customerContactPreference} />
          </div>

          <div
            style={{
              display: "grid",
              gap: "12px",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            <LayerTheme
              sectionKey="jobcard-contact-address-primary"
              parentKey="jobcard-contact-customer"
              radius="var(--radius-sm)"
              padding="var(--space-4)"
              gap="var(--space-3)"
            >
              <div>
                <span style={labelStyle}>Primary address</span>
                <div style={valueStyle}>
                  {[jobData.customerAddress, jobData.customerPostcode].filter(Boolean).join(", ") || "—"}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasPrimaryAddress}
                onClick={() => window.open(toMapsUrl(jobData.customerAddress, jobData.customerPostcode), "_blank", "noopener,noreferrer")}
              >
                📍 View on map
              </Button>
            </LayerTheme>

            <LayerTheme
              sectionKey="jobcard-contact-address-work"
              parentKey="jobcard-contact-customer"
              radius="var(--radius-sm)"
              padding="var(--space-4)"
              gap="var(--space-3)"
            >
              <div>
                <span style={labelStyle}>Work address</span>
                <div style={valueStyle}>
                  {[jobData.customerWorkAddress, jobData.customerWorkPostcode].filter(Boolean).join(", ") || "Not on file"}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasWorkAddress}
                onClick={() => window.open(toMapsUrl(jobData.customerWorkAddress, jobData.customerWorkPostcode), "_blank", "noopener,noreferrer")}
              >
                📍 View on map
              </Button>
            </LayerTheme>
          </div>

          {/* Action bar — launches the device's native app for each channel. */}
          <div
            style={{
              display: "grid",
              gap: "10px",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            }}
          >
            {CONTACT_ACTIONS.map((action) => (
              <Button
                key={action.id}
                variant="primary"
                onClick={() => setActiveAction(action.id)}
              >
                <span style={{ marginRight: "6px" }}>{action.icon}</span>
                {action.label}
              </Button>
            ))}
          </div>
        </>
      )}

      <ContactActionPopup
        action={activeAction}
        contact={contact}
        onClose={() => setActiveAction(null)}
      />
    </LayerSurface>
  );
}
