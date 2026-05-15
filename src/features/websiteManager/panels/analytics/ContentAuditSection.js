// file location: src/features/websiteManager/panels/analytics/ContentAuditSection.js
// Analytics area 8 — Content audit trail.
//
// The persisted, long-term audit history of website-content changes. There is
// no audit backend, so this section renders an honest "not connected" empty
// state rather than fabricated entries.
//
// NOTE: the Website Manager's live "Activity Log" tab already shows the real
// changes made in the CURRENT session. This section is the historical record
// that a backend audit table would provide across all sessions.
import React from "react";
import Section from "@/components/Section";
import { NotConnectedNotice } from "./analyticsAtoms";

export default function ContentAuditSection() {
  return (
    <Section
      title="Website Content Audit Trail"
      subtitle="The full, persisted history of website-content changes across all staff and sessions."
    >
      {/* TODO: connect /api/website/analytics/audit — derive from a
          website_content_audit table written to by every content mutation
          route. Until then, the live "Activity Log" tab covers the current
          session's changes. */}
      <NotConnectedNotice
        lead="The persisted audit trail will appear here once content changes are written to an audit table. In the meantime, the Activity Log tab records changes made in the current session."
        metrics={[
          "Who changed website content",
          "What page / content item was changed",
          "Before / after state",
          "Publish and unpublish actions",
          "Image uploads and deletions",
          "Date and time of every change",
        ]}
        endpoint="/api/website/analytics/audit"
      />
    </Section>
  );
}
