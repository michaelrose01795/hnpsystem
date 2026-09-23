// file location: src/features/customers/hub/CustomerHeaderCard.js
//
// The top of the customer record: who they are, how to reach them, what state
// their account is in, the figures that matter, and the actions the person
// looking at the record is allowed to take.
//
// Sits directly inside the staff page card (--surface), so it is a LayerTheme;
// everything nested inside it flips back to LayerSurface (CLAUDE.md §3.0).

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import { RecordField, RecordFieldGrid, StatusBadge, LinkButton } from "./RecordPrimitives";
import useCopyToClipboard from "./useCopyToClipboard";
import CustomerEditForm from "./CustomerEditForm";
import CustomerContactPreference from "./CustomerContactPreference";
import {
  buildAddressDisplay,
  buildContactChannels,
  buildMapLink,
  displayCustomerName,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeDay,
} from "@/lib/customers/customerHubModel";

/* A customer has no dedicated reference column. The account number is the real
   dealership reference when one exists; otherwise the first block of the record
   UUID is a stable, quotable short code. */
const customerReference = (customer, summary) =>
  summary?.accountNumbers?.[0] || String(customer?.id || "").split("-")[0]?.toUpperCase() || "—";

/* Trading status: the account's own status wins; otherwise derive it from
   whether there is live or recent work. */
const customerStatus = (summary) => {
  if (summary?.accountStatus) {
    return { label: summary.accountStatus, tone: /active/i.test(summary.accountStatus) ? "success" : "neutral" };
  }
  if (summary?.openJobs > 0) return { label: "Live work", tone: "accent-soft" };
  if (!summary?.totalJobs) return { label: "No history", tone: "neutral" };
  const lastVisit = summary.lastVisit ? new Date(summary.lastVisit) : null;
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  if (lastVisit && lastVisit < twoYearsAgo) return { label: "Dormant", tone: "neutral" };
  return { label: "Active", tone: "success" };
};

const PREFERENCE_LABELS = {
  email: "Email",
  mobile: "Mobile",
  telephone: "Telephone",
  sms: "SMS",
  post: "Post",
};

export default function CustomerHeaderCard({
  customer,
  summary,
  access,
  contactPreference,
  savingPreference,
  onContactPreferenceChange,
  onSaveCustomer,
  customerSlug,
}) {
  const [editing, setEditing] = useState(false);
  const { copy, copied } = useCopyToClipboard();

  const name = displayCustomerName(customer);
  const status = customerStatus(summary);
  const channels = buildContactChannels(customer, contactPreference);
  const homeAddress = buildAddressDisplay(customer?.address, customer?.postcode);
  const workAddress = buildAddressDisplay(customer?.work_address, customer?.work_postcode);
  const mapLink = buildMapLink(homeAddress);
  const preferredLabel = PREFERENCE_LABELS[contactPreference] || "Not set";

  /* The account facts read as one quiet meta line rather than a row of pills;
     only the trading status keeps a badge, because its tone carries meaning. */
  const metaLine = [
    `Ref ${customerReference(customer, summary)}`,
    summary?.accountType || "Retail",
    `Prefers ${preferredLabel}`,
    summary?.customerSince ? `Customer since ${formatDate(summary.customerSince)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const stats = [
    { label: "Vehicles", value: String(summary?.vehicleCount ?? 0) },
    { label: "Total jobs", value: String(summary?.totalJobs ?? 0) },
    { label: "Open jobs", value: String(summary?.openJobs ?? 0) },
  ];
  if (access?.canViewFinancials) {
    stats.push(
      { label: "Lifetime spend", value: formatCurrency(summary?.lifetimeSpend) },
      { label: "Outstanding", value: formatCurrency(summary?.outstandingBalance) }
    );
  }

  return (
    <LayerTheme
      as="section"
      data-presentation="customer-hero"
      sectionKey="customer-profile-summary"
      parentKey="app-layout-page-card"
      sectionType="section-shell"
      backgroundToken="theme"
      style={{ width: "100%", minWidth: 0 }}
    >
      {/* Identity + quick actions */}
      <div className="app-page-header">
        <div
          className="app-page-header__text"
          style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", minWidth: 0 }}>
            <h1 className="app-page-header__title">{name}</h1>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
          <p className="app-record-note">{metaLine}</p>
        </div>

        {/* Pinned to the top of the header so the actions sit on the name row,
            not centred against the name + meta block. */}
        <div className="app-page-header__actions" style={{ alignSelf: "flex-start" }}>
          {access?.canEditCustomer && (
            <Button variant="secondary" size="sm" onClick={() => setEditing((open) => !open)}>
              {editing ? "Close editor" : "Edit customer"}
            </Button>
          )}
          {access?.canCreateJob && (
            <LinkButton
              href={`/new-job?customerId=${encodeURIComponent(customer?.id || "")}`}
              variant="primary"
            >
              Create job
            </LinkButton>
          )}
          {access?.canBookAppointment && (
            <LinkButton href={`/appointments?customerId=${encodeURIComponent(customer?.id || "")}`}>
              Book appointment
            </LinkButton>
          )}
        </div>
      </div>

      {/* Alerts and duplicate records live in their own "Needs attention"
          section below this card — see CustomerAlertsPanel. */}

      {/* Edit form */}
      {editing && access?.canEditCustomer && (
        <CustomerEditForm
          customer={customer}
          onCancel={() => setEditing(false)}
          onSave={async (values) => {
            const ok = await onSaveCustomer?.(values);
            if (ok) setEditing(false);
            return ok;
          }}
        />
      )}

      {/* Contact details */}
      <LayerSurface as="div" sectionKey="customer-profile-contact" parentKey="customer-profile-summary">
        <div className="app-page-header">
          <div className="app-page-header__text">
            <h2 className="app-record-heading">Contact</h2>
          </div>
          {copied && <span className="app-record-note">Copied to clipboard</span>}
        </div>

        <RecordFieldGrid wide>
          {channels.map((channel) => (
            <RecordField
              key={channel.key}
              label={channel.preferred ? `${channel.label} (preferred)` : channel.label}
              value={channel.value}
              href={channel.href}
              copyable
              onCopy={copy}
            />
          ))}
          <RecordField
            label="Address"
            value={homeAddress}
            href={mapLink.href}
            external
            copyable
            onCopy={copy}
          />
          {workAddress && <RecordField label="Work address" value={workAddress} copyable onCopy={copy} />}
        </RecordFieldGrid>

        <CustomerContactPreference
          value={contactPreference}
          saving={savingPreference}
          disabled={!access?.canEditContactPreference}
          onChange={onContactPreferenceChange}
        />
      </LayerSurface>

      {/* Figures */}
      <div className="app-summary-section">
        <div className="app-summary-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="app-summary-item">
              <span className="app-summary-label">{stat.label}</span>
              <span className="app-summary-value">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recency */}
      <LayerSurface as="div" sectionKey="customer-profile-recency" parentKey="customer-profile-summary">
        <RecordFieldGrid
          wide
          keepEmpty
          fields={[
            {
              label: "Last contact",
              value: summary?.lastContact
                ? `${formatDateTime(summary.lastContact)} (${formatRelativeDay(summary.lastContact)})`
                : null,
            },
            {
              label: "Last visit",
              value: summary?.lastVisit
                ? `${formatDate(summary.lastVisit)} (${formatRelativeDay(summary.lastVisit)})`
                : null,
            },
            {
              label: "Next booking",
              value: summary?.nextBooking
                ? `${formatDateTime(summary.nextBooking.scheduledTime)}${
                    summary.nextBooking.vehicle ? ` · ${summary.nextBooking.vehicle}` : ""
                  }`
                : null,
            },
            ...(access?.canViewFinancials
              ? [
                  {
                    label: "Account balance",
                    value: summary?.accountNumbers?.length ? formatCurrency(summary.accountBalance) : null,
                  },
                ]
              : []),
          ]}
        />
        {customerSlug && (
          <p className="app-record-note">{`Record URL: /customers/${customerSlug}`}</p>
        )}
      </LayerSurface>
    </LayerTheme>
  );
}
