// file location: src/features/website/profile/ProfileMessages.js
//
// The Messages view — the portal's communications area, with two subsections:
//
//   Messages  | the thread with Humphries & Parks, plus the composer
//   Documents | invoices and inspection media as a single file list
//
// Documents live here and nowhere else, so each piece of information has one
// home. Sending a message is the page's send_message action, unchanged.

import {
  ExpandableList,
  NotAvailableYet,
  PortalCard,
  SubNav,
} from "./ProfilePrimitives";
import { MessageComposer } from "./ProfileForms";
import { formatDate, formatDateTime, invoiceRef } from "./profileUtils";

const SECTIONS = [
  { id: "messages", label: "Messages" },
  { id: "documents", label: "Documents" },
];

export default function ProfileMessages({
  messages,
  invoices,
  vhcMedia,
  section,
  onSectionChange,
  onSend,
  actionFlash,
}) {
  // One list for everything the customer can open: their invoices, then the
  // photos and video from their inspections.
  const documents = [
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.invoice_id}`,
      name: invoiceRef(invoice),
      kind: "Invoice",
      date: invoice.created_at,
      related: invoice.job_number,
      href: invoice.invoice_id ? `/accounts/invoices/${invoice.invoice_id}` : null,
    })),
    ...vhcMedia.map((item) => ({
      id: `media-${item.id}`,
      name: item.context_label || `Inspection ${item.media_type || "photo"}`,
      kind: item.media_type === "video" ? "Inspection video" : "Inspection photo",
      date: item.created_at,
      related: item.job_number,
      href: item.public_url,
    })),
  ];

  return (
    <div className="ws-profile-view" data-presentation="website-profile-messages">
      <SubNav
        label="Message sections"
        items={SECTIONS}
        value={section}
        onChange={onSectionChange}
        idPrefix="ws-profile-messages"
      />

      {section === "messages" ? (
        <PortalCard
          eyebrow="Inbox"
          title="Humphries & Parks"
          count={messages.length}
          presentation="website-profile-message-centre"
          wide
        >
          <div className="ws-portal-thread">
            {messages.length === 0 ? (
              <p className="ws-portal-empty">
                No messages yet — drop us a note below and we&apos;ll come back to you.
              </p>
            ) : (
              messages.map((m) => {
                const isCustomer = m.activity_type === "message_customer";
                const body = m.activity_payload?.body || m.activity_payload?.summary || "(empty)";
                return (
                  <div key={m.event_id} className="ws-portal-bubble" data-author={isCustomer ? "customer" : "staff"}>
                    {body}
                    <span className="ws-portal-bubble__meta">
                      {isCustomer ? "You" : "Humphries & Parks"} · {formatDateTime(m.occurred_at)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <MessageComposer onSend={onSend} flash={actionFlash.msg} />
        </PortalCard>
      ) : null}

      {section === "documents" ? (
        <PortalCard eyebrow="Files" title="Your documents" count={documents.length} wide>
          <ExpandableList
            items={documents}
            initial={6}
            moreLabel="View all documents"
            emptyText="You have no documents yet. Invoices and inspection photos will appear here."
            renderItem={(doc) => (
              <li key={doc.id} className="ws-portal-row">
                <div>
                  <div className="ws-portal-item-title">{doc.name}</div>
                  <div className="ws-portal-item-meta">
                    {[doc.kind, formatDate(doc.date), doc.related].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {doc.href ? (
                  <a className="app-btn" href={doc.href} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                ) : null}
              </li>
            )}
          />
          <NotAvailableYet>
            You can&apos;t upload your own documents here yet — send them to us in a message and we&apos;ll add them to
            your file.
          </NotAvailableYet>
        </PortalCard>
      ) : null}
    </div>
  );
}
