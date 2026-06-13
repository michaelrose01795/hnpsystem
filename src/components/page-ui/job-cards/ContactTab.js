// file location: src/components/page-ui/job-cards/ContactTab.js
// Redesigned job-card Contact tab — consolidated into one file per CLAUDE.md §4.3
// (one file per tab). Previously split across contact/*; behaviour and markup are
// unchanged. A customer-relationship hub with four sections:
//   1. Customer Contact  (details + map links + call/text/email/WhatsApp actions)
//   2. Notes & Preferences (quick toggles + multiselect + customer notes)
//   3. Communication History (in-app thread messages as a tracking tree)
//   4. Quick Message Templates (send templated messages into the in-app thread)
//
// The default export (ContactTab) is consumed by the job-card presentation layer
// (src/components/page-ui/job-cards/job-cards-job-number-ui.js). It owns the
// in-app messaging thread state and the templates list; the contact/preferences
// persistence flows through the shared onSaveCustomerDetails handler.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ensureJobCustomerThread,
  fetchThreadMessages,
  sendThreadMessage,
  fetchMessageTemplates,
  saveMessageTemplate,
} from "@/lib/api/messages";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";
import MultiSelectDropdown from "@/components/ui/dropdownAPI/MultiSelectDropdown";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import PopupModal from "@/components/popups/popupStyleApi";

/* ════════════════════════════════════════════════════════════════════════
   Shared constants + small pure helpers (formerly contactConstants.js).
   ════════════════════════════════════════════════════════════════════════ */

// Full customer-preference list shown in the multiselect dropdown. Stored as a
// text[] on the customers table (Contact-tab redesign migration). The first four
// also appear as quick-toggle buttons (see QUICK_PREFERENCES).
const PREFERENCE_OPTIONS = [
  "VIP Customer",
  "Do Not Wash",
  "Waiting Customer",
  "Courtesy Car",
  "Prefers Email",
  "Prefers Phone",
  "Reminder Call",
  "Disabled Access",
  "No Marketing",
  "Collection Only",
  "Trade Account",
  "Loyal Customer",
];

// Quick-toggle buttons rendered at the top of the Notes & Preferences section.
// `tone` maps to an .app-tone-* / .app-badge--* family so styling stays tokenised.
const QUICK_PREFERENCES = [
  { value: "VIP Customer", label: "VIP Customer", tone: "warning" },
  { value: "Do Not Wash", label: "Do Not Wash", tone: "danger" },
  { value: "Waiting Customer", label: "Waiting Customer", tone: "info" },
  { value: "Courtesy Car", label: "Courtesy Car", tone: "success" },
];

// Channels for the contact action bar (Call / Text / Email / WhatsApp).
const CONTACT_ACTIONS = [
  { id: "call", label: "Call", icon: "📞" },
  { id: "text", label: "Text", icon: "💬" },
  { id: "email", label: "Email", icon: "✉️" },
  { id: "whatsapp", label: "WhatsApp", icon: "🟢" },
];

const digitsOnly = (value) => String(value || "").replace(/[^\d+]/g, "");

const toTelHref = (phone) => `tel:${digitsOnly(phone)}`;

const toSmsHref = (phone) => `sms:${digitsOnly(phone)}`;

const toMailtoHref = (email) => `mailto:${String(email || "").trim()}`;

// Normalise a (mostly UK) number to international digits for wa.me. Strips
// spaces/symbols, swaps a leading 0 for the UK country code, and drops a leading +.
const toWhatsAppUrl = (phone) => {
  let n = String(phone || "").replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  else if (n.startsWith("0")) n = `44${n.slice(1)}`;
  return `https://wa.me/${n}`;
};

const toMapsUrl = (address, postcode) => {
  const query = [address, postcode].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

// Replace {customerName} / {jobNumber} / {reg} placeholders in a template body.
const interpolateTemplate = (body, vars = {}) =>
  String(body || "").replace(/\{(\w+)\}/g, (match, key) =>
    vars[key] != null && vars[key] !== "" ? vars[key] : match
  );

/* ════════════════════════════════════════════════════════════════════════
   ContactActionPopup — Call / Text / Email / WhatsApp launcher.
   Popup shown when an action button is pressed in the Customer Contact section.
   It surfaces the relevant contact detail and an "Open" button that launches the
   device's native app via tel:/sms:/mailto:/wa.me.
   ════════════════════════════════════════════════════════════════════════ */

// Build the per-action config: the detail to show, the launch URL, and whether to
// open in a new tab (WhatsApp web) vs navigate the current document (tel/sms/mailto).
function resolveAction(action, contact) {
  switch (action) {
    case "call":
      return {
        title: "Call customer",
        detailLabel: "Phone",
        detail: contact.mobile || contact.telephone,
        href: toTelHref(contact.mobile || contact.telephone),
        openLabel: "Open dialler",
        newTab: false,
      };
    case "text":
      return {
        title: "Text customer",
        detailLabel: "Mobile",
        detail: contact.mobile || contact.telephone,
        href: toSmsHref(contact.mobile || contact.telephone),
        openLabel: "Open messages",
        newTab: false,
      };
    case "email":
      return {
        title: "Email customer",
        detailLabel: "Email",
        detail: contact.email,
        href: toMailtoHref(contact.email),
        openLabel: "Open email app",
        newTab: false,
      };
    case "whatsapp":
      return {
        title: "WhatsApp customer",
        detailLabel: "Mobile",
        detail: contact.mobile || contact.telephone,
        href: toWhatsAppUrl(contact.mobile || contact.telephone),
        openLabel: "Open WhatsApp",
        newTab: true,
      };
    default:
      return null;
  }
}

function ContactActionPopup({ action, contact = {}, onClose }) {
  const config = action ? resolveAction(action, contact) : null;
  if (!config) return null;

  const hasDetail = Boolean(config.detail);

  const handleOpen = () => {
    if (!hasDetail) return;
    if (config.newTab) {
      window.open(config.href, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = config.href;
    }
    onClose?.();
  };

  return (
    <PopupModal
      isOpen={Boolean(action)}
      onClose={onClose}
      ariaLabel={config.title}
      cardStyle={{
        width: "min(420px, 100%)",
        padding: "var(--space-7)",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.72rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--accentText)",
            fontWeight: 700,
          }}
        >
          {config.title}
        </p>
        <p style={{ margin: 0, color: "var(--text-1)", fontSize: "1.05rem", fontWeight: 600 }}>
          {contact.name || "Customer"}
        </p>
      </div>

      <div
        className="app-layout-surface-subtle"
        style={{ gap: "4px" }}
      >
        <span
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-1)",
            opacity: 0.7,
            fontWeight: 700,
          }}
        >
          {config.detailLabel}
        </span>
        <span style={{ fontSize: "1.05rem", color: "var(--text-1)", fontWeight: 600, wordBreak: "break-word" }}>
          {config.detail || "Not on file"}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleOpen} disabled={!hasDetail}>
          {config.openLabel}
        </Button>
      </div>
    </PopupModal>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ManageTemplatesPopup — edit default customer-facing template wording.
   Lets staff edit the default wording of each template and save it for all
   future messages (persisted via POST /api/messages/templates).
   ════════════════════════════════════════════════════════════════════════ */
const manageLabelStyle = {
  fontSize: "0.65rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-1)", opacity: 0.7,
  fontWeight: 700,
  marginBottom: "4px",
  display: "block",
};

function ManageTemplatesPopup({ isOpen, templates = [], updatedBy = null, onClose, onSaved }) {
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const seeded = {};
    templates.forEach((tpl) => {
      seeded[tpl.templateKey] = { title: tpl.title, body: tpl.body };
    });
    setDrafts(seeded);
    setError("");
  }, [isOpen, templates]);

  const setDraft = (key, field, value) =>
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const handleSave = async (templateKey) => {
    const draft = drafts[templateKey];
    if (!draft) return;
    setSavingKey(templateKey);
    setError("");
    try {
      await saveMessageTemplate({
        templateKey,
        title: draft.title,
        body: draft.body,
        updatedBy,
      });
      await onSaved?.();
    } catch (err) {
      setError(err?.message || "Failed to save template");
    } finally {
      setSavingKey(null);
    }
  };

  if (!isOpen) return null;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Manage message templates"
      cardStyle={{ width: "min(720px, 100%)", padding: "var(--space-7)", display: "flex", flexDirection: "column", gap: "20px" }}
    >
      <div className="app-layout-header-row">
        <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-1)" }}>Manage Templates</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.7, fontSize: "0.85rem" }}>
        Edit the default customer-facing wording. Use <code>{"{customerName}"}</code>, <code>{"{jobNumber}"}</code> and <code>{"{reg}"}</code> as placeholders.
      </p>

      {error && <StatusMessage tone="danger">{error}</StatusMessage>}

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {templates.map((tpl) => {
          const draft = drafts[tpl.templateKey] || { title: tpl.title, body: tpl.body };
          return (
            <div
              key={tpl.templateKey}
              className="app-layout-surface-subtle"
              style={{ gap: "10px" }}
            >
              <div>
                <span style={manageLabelStyle}>Title</span>
                <input
                  className="app-input"
                  value={draft.title}
                  onChange={(e) => setDraft(tpl.templateKey, "title", e.target.value)}
                />
              </div>
              <div>
                <span style={manageLabelStyle}>Message</span>
                <textarea
                  className="app-input"
                  rows={3}
                  value={draft.body}
                  onChange={(e) => setDraft(tpl.templateKey, "body", e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSave(tpl.templateKey)}
                  disabled={savingKey === tpl.templateKey}
                >
                  {savingKey === tpl.templateKey ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </PopupModal>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   CustomerContactSection — details + map links + action bar.
   Friendly display of name / phones / emails / preference / primary + work
   address with "View on map" links, plus a bottom action bar (Call / Text /
   Email / WhatsApp) that opens ContactActionPopup to launch the native app.
   ════════════════════════════════════════════════════════════════════════ */
const CONTACT_PREFERENCES = ["Email", "Phone", "SMS", "WhatsApp", "No Preference"];

const contactLabelStyle = {
  fontSize: "0.65rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-1)",
  opacity: 0.7,
  fontWeight: 700,
  marginBottom: "4px",
  display: "block",
};

const contactValueStyle = {
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
      <span style={contactLabelStyle}>{label}</span>
      <div style={contactValueStyle}>{value || "—"}</div>
    </div>
  );
}

function EditField({ label, children }) {
  return (
    <div>
      <span style={contactLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

function CustomerContactSection({
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
                <span style={contactLabelStyle}>Primary address</span>
                <div style={contactValueStyle}>
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
                <span style={contactLabelStyle}>Work address</span>
                <div style={contactValueStyle}>
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

/* ════════════════════════════════════════════════════════════════════════
   CustomerPreferencesSection — quick toggles + multiselect + customer notes.
   All persist to the customer profile via the shared onSaveCustomerDetails handler.
   ════════════════════════════════════════════════════════════════════════ */
const prefsLabelStyle = {
  fontSize: "0.65rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-1)",
  opacity: 0.7,
  fontWeight: 700,
  marginBottom: "6px",
  display: "block",
};

const sameSet = (a, b) => {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
};

function CustomerPreferencesSection({
  jobData,
  canEdit,
  onSaveCustomerDetails,
  customerSaving,
}) {
  const initialPrefs = useMemo(
    () => (Array.isArray(jobData.customerPreferences) ? jobData.customerPreferences : []),
    [jobData.customerPreferences]
  );
  const initialNotes = jobData.customerNotes || "";

  const [prefs, setPrefs] = useState(initialPrefs);
  const [notes, setNotes] = useState(initialNotes);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setPrefs(initialPrefs);
    setNotes(initialNotes);
    setSaveError("");
  }, [initialPrefs, initialNotes]);

  const isDirty = !sameSet(prefs, initialPrefs) || notes !== initialNotes;

  const togglePref = (value) => {
    if (!canEdit) return;
    setPrefs((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  };

  const handleSave = async () => {
    setSaveError("");
    const result = await onSaveCustomerDetails?.({ preferences: prefs, notes });
    if (result?.success) {
      setSaveError("");
    } else if (result?.error?.message) {
      setSaveError(result.error.message);
    }
  };

  return (
    <LayerSurface
      sectionKey="jobcard-contact-preferences"
      sectionType="section-shell"
      parentKey="jobcard-tab-contact"
      shell
      gap="var(--space-4)"
    >
      <div className="app-layout-header-row">
        <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-1)" }}>Notes &amp; Preferences</h3>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!isDirty || customerSaving}>
            {customerSaving ? "Saving…" : "Save Preferences"}
          </Button>
        )}
      </div>

      {saveError && <StatusMessage tone="danger">{saveError}</StatusMessage>}

      {/* Quick toggles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {QUICK_PREFERENCES.map((pref) => {
          const active = prefs.includes(pref.value);
          return (
            <Button
              key={pref.value}
              variant={active ? "primary" : "secondary"}
              size="sm"
              disabled={!canEdit}
              onClick={() => togglePref(pref.value)}
            >
              <span style={{ marginRight: "6px" }}>{active ? "✓" : "＋"}</span>
              {pref.label}
            </Button>
          );
        })}
      </div>

      {/* Full preference multiselect */}
      <div>
        <span style={prefsLabelStyle}>All preferences</span>
        <MultiSelectDropdown
          options={PREFERENCE_OPTIONS}
          value={prefs}
          onChange={setPrefs}
          disabled={!canEdit}
          placeholder="Select preferences"
          searchPlaceholder="Search preferences"
        />
      </div>

      {/* Customer notes */}
      <div>
        <span style={prefsLabelStyle}>Customer notes</span>
        <textarea
          className="app-input"
          rows={4}
          value={notes}
          disabled={!canEdit}
          placeholder="Notes that follow this customer across all their jobs…"
          onChange={(e) => setNotes(e.target.value)}
          style={{ resize: "vertical" }}
        />
      </div>
    </LayerSurface>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   CommunicationHistorySection — in-app thread messages as a tracking tree.
   Each entry shows what was sent, the channel, the date/time and who sent it.
   Newest first.
   ════════════════════════════════════════════════════════════════════════ */
const formatTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function TimelineEntry({ entry, isLast }) {
  const meta = entry.metadata || {};
  const channel = meta.channel || "In-app";
  const title = meta.templateTitle || "Message";
  const sender = entry.sender?.name || "—";

  return (
    <div style={{ display: "flex", gap: "12px" }}>
      {/* Marker rail */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "16px" }}>
        <span
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "var(--radius-pill)",
            background: "var(--accent-strong)",
            flexShrink: 0,
            marginTop: "4px",
          }}
        />
        {!isLast && (
          <span
            style={{
              width: "2px",
              flex: 1,
              minHeight: "16px",
              background: "rgba(var(--accent-base-rgb), 0.25)",
              marginTop: "4px",
            }}
          />
        )}
      </div>

      {/* Entry body */}
      <LayerTheme
        sectionKey={`jobcard-contact-history-${entry.id}`}
        parentKey="jobcard-contact-history-list"
        radius="var(--radius-sm)"
        padding="var(--space-4)"
        gap="var(--space-2)"
        style={{ flex: 1, marginBottom: "12px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: "var(--text-1)" }}>{title}</span>
          <span className="app-badge app-badge--accent-soft app-badge--uppercase">{channel}</span>
        </div>
        <p style={{ margin: 0, color: "var(--text-1)", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
          {entry.content}
        </p>
        <span style={{ fontSize: "0.75rem", color: "var(--text-1)", opacity: 0.7 }}>
          {formatTimestamp(entry.createdAt)} · by {sender}
        </span>
      </LayerTheme>
    </div>
  );
}

function CommunicationHistorySection({ messages = [], loading = false }) {
  const ordered = useMemo(() => {
    return [...messages].sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [messages]);

  return (
    <LayerSurface
      sectionKey="jobcard-contact-history"
      sectionType="section-shell"
      parentKey="jobcard-tab-contact"
      shell
      gap="var(--space-4)"
    >
      <div className="app-layout-header-row">
        <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-1)" }}>Communication History</h3>
        <span className="app-badge app-badge--neutral">{ordered.length}</span>
      </div>

      {loading && <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.7 }}>Loading history…</p>}

      {!loading && ordered.length === 0 && (
        <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.7 }}>
          No messages have been sent to this customer yet.
        </p>
      )}

      {!loading && ordered.length > 0 && (
        <div data-section="jobcard-contact-history-list" style={{ display: "flex", flexDirection: "column" }}>
          {ordered.map((entry, index) => (
            <TimelineEntry key={entry.id} entry={entry} isLast={index === ordered.length - 1} />
          ))}
        </div>
      )}
    </LayerSurface>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   QuickMessageTemplatesSection — tappable template tiles + Manage Templates.
   Tapping a tile posts a customer-friendly message into the in-app thread after a
   Send/Cancel confirmation showing exactly what will be sent.
   ════════════════════════════════════════════════════════════════════════ */
function QuickMessageTemplatesSection({
  templates = [],
  loading = false,
  vars = {},
  customerName = "the customer",
  canSend = true,
  sending = false,
  onSend,
  onReloadTemplates,
  updatedBy = null,
}) {
  const [pending, setPending] = useState(null); // { templateKey, title, content }
  const [manageOpen, setManageOpen] = useState(false);

  const openConfirm = (tpl) => {
    setPending({
      templateKey: tpl.templateKey,
      title: tpl.title,
      content: interpolateTemplate(tpl.body, vars),
    });
  };

  const handleConfirm = async () => {
    if (!pending) return;
    await onSend?.({
      content: pending.content,
      templateKey: pending.templateKey,
      templateTitle: pending.title,
    });
    setPending(null);
  };

  return (
    <LayerSurface
      sectionKey="jobcard-contact-templates"
      sectionType="section-shell"
      parentKey="jobcard-tab-contact"
      shell
      gap="var(--space-4)"
    >
      <div className="app-layout-header-row">
        <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-1)" }}>Quick Message Templates</h3>
        <Button variant="secondary" size="sm" onClick={() => setManageOpen(true)}>
          Manage Templates
        </Button>
      </div>

      {loading && <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.7 }}>Loading templates…</p>}

      {!loading && templates.length === 0 && (
        <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.7 }}>No templates available.</p>
      )}

      {!loading && templates.length > 0 && (
        <div
          style={{
            display: "grid",
            gap: "12px",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          {templates.map((tpl) => (
            <LayerTheme
              key={tpl.templateKey}
              sectionKey={`jobcard-contact-template-${tpl.templateKey}`}
              parentKey="jobcard-contact-templates"
              radius="var(--radius-sm)"
              padding="var(--space-4)"
              gap="var(--space-3)"
            >
              <span style={{ fontWeight: 700, color: "var(--text-1)" }}>{tpl.title}</span>
              <p
                style={{
                  margin: 0,
                  color: "var(--text-1)", opacity: 0.7,
                  fontSize: "0.82rem",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {interpolateTemplate(tpl.body, vars)}
              </p>
              <Button
                variant="primary"
                size="sm"
                disabled={!canSend || sending}
                onClick={() => openConfirm(tpl)}
              >
                Send
              </Button>
            </LayerTheme>
          ))}
        </div>
      )}

      <ConfirmationDialog
        isOpen={Boolean(pending)}
        title="Send message"
        message={pending ? `Send "${pending.title}" to ${customerName} now?` : ""}
        description={pending?.content || ""}
        cancelLabel="Cancel"
        confirmLabel={sending ? "Sending…" : "Send"}
        onCancel={() => setPending(null)}
        onConfirm={handleConfirm}
      />

      <ManageTemplatesPopup
        isOpen={manageOpen}
        templates={templates}
        updatedBy={updatedBy}
        onClose={() => setManageOpen(false)}
        onSaved={onReloadTemplates}
      />
    </LayerSurface>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ContactTab — default export, the tab orchestrator.
   ════════════════════════════════════════════════════════════════════════ */
export default function ContactTab({
  jobData,
  canEdit,
  onSaveCustomerDetails,
  customerSaving,
  dbUserId,
}) {
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sending, setSending] = useState(false);

  const jobNumber = jobData?.jobNumber || "";
  const jobId = jobData?.id || null;
  const customerEmail = jobData?.customerEmail || "";
  const customerName = jobData?.customer || "";
  const canMessage = Boolean(customerEmail && dbUserId);

  // ---- communication history (in-app thread) ----
  const loadHistory = useCallback(async () => {
    if (!canMessage || !jobNumber) return;
    setLoadingHistory(true);
    try {
      const threadPayload = await ensureJobCustomerThread({
        jobId,
        jobNumber,
        actorId: dbUserId,
        customerEmail,
        customerName,
      });
      const nextThread = threadPayload?.thread || threadPayload?.data || null;
      setThread(nextThread);
      if (nextThread?.id) {
        const messagesPayload = await fetchThreadMessages(nextThread.id, {
          userId: dbUserId,
          limit: 80,
        });
        setMessages(messagesPayload?.data || messagesPayload?.messages || []);
      }
    } catch (error) {
      console.error("ContactTab: failed to load communication history:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, [canMessage, jobNumber, jobId, dbUserId, customerEmail, customerName]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ---- templates ----
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const payload = await fetchMessageTemplates();
      setTemplates(payload?.templates || []);
    } catch (error) {
      console.error("ContactTab: failed to load templates:", error);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ---- send a templated message into the in-app thread ----
  const handleSend = useCallback(
    async ({ content, templateKey, templateTitle }) => {
      if (!canMessage || !content) return;
      setSending(true);
      try {
        let activeThread = thread;
        if (!activeThread?.id) {
          const threadPayload = await ensureJobCustomerThread({
            jobId,
            jobNumber,
            actorId: dbUserId,
            customerEmail,
            customerName,
          });
          activeThread = threadPayload?.thread || threadPayload?.data || null;
          setThread(activeThread);
        }
        if (!activeThread?.id) throw new Error("No conversation thread available.");

        await sendThreadMessage(activeThread.id, {
          senderId: dbUserId,
          content,
          metadata: {
            audience: "customer",
            customerVisible: true,
            jobNumber,
            channel: "in-app",
            templateKey,
            templateTitle,
          },
        });
        await loadHistory();
      } catch (error) {
        console.error("ContactTab: failed to send message:", error);
        // Surface minimally — the confirm dialog already closed; a failed send
        // simply won't appear in the history (which reloads on success).
        alert(error?.message || "Failed to send message.");
      } finally {
        setSending(false);
      }
    },
    [canMessage, thread, jobId, jobNumber, dbUserId, customerEmail, customerName, loadHistory]
  );

  const templateVars = {
    customerName: jobData?.customerFirstName || customerName || "there",
    jobNumber,
    reg: jobData?.reg || "",
  };

  return (
    <>
      <CustomerContactSection
        jobData={jobData}
        canEdit={canEdit}
        onSaveCustomerDetails={onSaveCustomerDetails}
        customerSaving={customerSaving}
      />
      <CustomerPreferencesSection
        jobData={jobData}
        canEdit={canEdit}
        onSaveCustomerDetails={onSaveCustomerDetails}
        customerSaving={customerSaving}
      />
      <CommunicationHistorySection messages={messages} loading={loadingHistory} />
      <QuickMessageTemplatesSection
        templates={templates}
        loading={loadingTemplates}
        vars={templateVars}
        customerName={customerName || "the customer"}
        canSend={canEdit && canMessage}
        sending={sending}
        onSend={handleSend}
        onReloadTemplates={loadTemplates}
        updatedBy={dbUserId}
      />
    </>
  );
}
