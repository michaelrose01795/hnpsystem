// file location: src/components/page-ui/job-cards/contact/ManageTemplatesPopup.js
// "Manage Templates" popup for the Quick Message Templates section. Lets staff
// edit the default customer-facing wording of each template and save it for all
// future messages (persisted via POST /api/messages/templates).
import React, { useEffect, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";
import { saveMessageTemplate } from "@/lib/api/messages";

const labelStyle = {
  fontSize: "0.65rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-1)", opacity: 0.7,
  fontWeight: 700,
  marginBottom: "4px",
  display: "block",
};

export default function ManageTemplatesPopup({ isOpen, templates = [], updatedBy = null, onClose, onSaved }) {
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
                <span style={labelStyle}>Title</span>
                <input
                  className="app-input"
                  value={draft.title}
                  onChange={(e) => setDraft(tpl.templateKey, "title", e.target.value)}
                />
              </div>
              <div>
                <span style={labelStyle}>Message</span>
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
