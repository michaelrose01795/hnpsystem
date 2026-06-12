// file location: src/components/page-ui/job-cards/contact/QuickMessageTemplatesSection.js
// "Quick Message Templates" section of the redesigned Contact tab. Shows tappable
// template tiles that post a customer-friendly message into the in-app thread, plus
// a top-right "Manage Templates" button. Tapping a tile opens a Send/Cancel
// confirmation showing exactly what will be sent.
import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import ManageTemplatesPopup from "./ManageTemplatesPopup";
import { interpolateTemplate } from "./contactConstants";

export default function QuickMessageTemplatesSection({
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
