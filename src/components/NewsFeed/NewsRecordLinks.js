// file location: src/components/NewsFeed/NewsRecordLinks.js
//
// The row of links from a post to real DMS records — job cards, customers,
// vehicles, appointments, deliveries, VHCs, stock and invoices.
//
// The route is resolved by the shared LINK_TYPES table, so a link on a card,
// in the composer preview and in a search result always goes to the same page.

import React from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { getLinkType, resolveLinkHref } from "@/lib/news/constants";

export default function NewsRecordLinks({ links = [], onRemove = null }) {
  if (!links.length) return null;

  return (
    <div className="app-news-links">
      {links.map((link, index) => {
        const type = getLinkType(link.recordType);
        const href = resolveLinkHref(link);
        const label = link.label || `${type?.label || "Record"} ${link.recordId}`;
        const key = link.id || `${link.recordType}:${link.recordId}:${index}`;

        if (onRemove) {
          // Composer mode: not yet saved, so this is a chip with a remove
          // control rather than a navigation link.
          return (
            <span key={key} className="app-news-link">
              <span aria-hidden="true">{type?.icon || "🔗"}</span>
              {label}
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onRemove(link, index)}
                aria-label={`Remove link to ${label}`}
              >
                ×
              </Button>
            </span>
          );
        }

        if (!href) return null;

        return (
          <Link key={key} className="app-news-link" href={href}>
            <span aria-hidden="true">{type?.icon || "🔗"}</span>
            {label}
          </Link>
        );
      })}
    </div>
  );
}
