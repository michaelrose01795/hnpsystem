// file location: src/features/customers/hub/CustomerAlertsPanel.js
//
// "Needs attention" — everything about this customer that someone should do
// something about, in one place.
//
// These used to be full-width banners stacked inside the header card, which
// pushed the contact details and the figures off the screen and gave a £186
// balance the same visual weight as a page-level error. Here they are compact
// cards in a responsive grid, ordered danger → warning → info, each carrying
// the one action that resolves it.

import React, { useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import Button from "@/components/ui/Button";
import { RecordHeading, StatusBadge, LinkButton } from "./RecordPrimitives";
import { displayCustomerName } from "@/lib/customers/customerHubModel";

const TONE_LABEL = { danger: "Action", warning: "Check", info: "For info" };

// Collapse once the list gets long enough to push the tabs down the page.
const COLLAPSE_ABOVE = 4;

function AlertCard({ alert, onOpenTab }) {
  return (
    <LayerSurface
      as="article"
      sectionKey={`customer-profile-alert-${alert.id}`}
      parentKey="customer-profile-alerts"
      gap="var(--space-sm)"
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", minWidth: 0 }}>
        <StatusBadge tone={alert.tone} uppercase>
          {TONE_LABEL[alert.tone] || alert.tone}
        </StatusBadge>
        {alert.category && <StatusBadge tone="neutral">{alert.category}</StatusBadge>}
      </div>

      <p className="app-record-note app-record-note--strong">{alert.title}</p>
      {alert.detail && <p className="app-record-note">{alert.detail}</p>}

      {alert.action && (
        <div className="app-record-actions">
          {alert.action.href ? (
            <LinkButton href={alert.action.href} variant="ghost">
              {alert.action.label}
            </LinkButton>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenTab?.(alert.action.tab, alert.action.search)}
            >
              {alert.action.label}
            </Button>
          )}
        </div>
      )}
    </LayerSurface>
  );
}

export default function CustomerAlertsPanel({ alerts = [], duplicates = [], onOpenTab }) {
  const [expanded, setExpanded] = useState(false);

  if (!alerts.length) return null;

  const collapsible = alerts.length > COLLAPSE_ABOVE;
  const visible = collapsible && !expanded ? alerts.slice(0, COLLAPSE_ABOVE) : alerts;
  const counts = alerts.reduce((tally, alert) => {
    tally[alert.tone] = (tally[alert.tone] || 0) + 1;
    return tally;
  }, {});

  return (
    <LayerTheme
      as="section"
      sectionKey="customer-profile-alerts"
      parentKey="app-layout-page-card"
      sectionType="section-shell"
      style={{ width: "100%", minWidth: 0 }}
    >
      <RecordHeading
        actions={
          collapsible ? (
            <Button variant="ghost" size="sm" onClick={() => setExpanded((open) => !open)}>
              {expanded ? "Show fewer" : `Show all ${alerts.length}`}
            </Button>
          ) : null
        }
      >
        <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          {`Needs attention (${alerts.length})`}
          {counts.danger > 0 && <StatusBadge tone="danger">{`${counts.danger} urgent`}</StatusBadge>}
        </span>
      </RecordHeading>

      <div className="app-card-grid" style={{ "--app-card-grid-min": "260px" }}>
        {visible.map((alert) => (
          <AlertCard key={alert.id} alert={alert} onOpenTab={onOpenTab} />
        ))}
      </div>

      {/* The duplicate warning is only useful next to the records it matched. */}
      {duplicates.length > 0 && (
        <LayerSurface
          as="div"
          sectionKey="customer-profile-duplicates"
          parentKey="customer-profile-alerts"
          gap="var(--space-sm)"
        >
          <p className="app-record-note app-record-note--strong">
            Possible duplicate records — check before creating new work.
          </p>
          <div className="app-record-actions">
            {duplicates.map((duplicate) => (
              <LinkButton
                key={duplicate.id}
                href={`/customers/${encodeURIComponent(duplicate.slug_key || duplicate.id)}`}
                variant="ghost"
              >
                {`${displayCustomerName(duplicate)} · ${
                  duplicate.email || duplicate.mobile || duplicate.postcode || "no contact"
                }`}
              </LinkButton>
            ))}
          </div>
        </LayerSurface>
      )}
    </LayerTheme>
  );
}
