// file location: src/components/NewsFeed/NewsRecordLinks.js
//
// The row of links from a post to real DMS records — job cards, customers,
// vehicles, appointments, deliveries, VHCs, stock and invoices.
//
// The route is resolved by the shared LINK_TYPES table, so a link on a card,
// in the composer preview and in a search result always goes to the same page.
//
// Each link reads as two parts: the record type in a muted uppercase tag, then
// the record itself. No emoji glyph — the type is spelled out, which stays
// readable at caption size and lines the links up with the attachment rows.

import React from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { getLinkType, resolveLinkHref } from "@/lib/news/constants";

// Stored labels usually already start with the type ("VHC 1254 — Checked and
// OK"), so lift that prefix into the tag rather than printing it twice.
const splitLabel = (label, typeLabel) => {
  if (!typeLabel) return { tag: "Record", detail: label };

  const normalised = label.trim();
  if (normalised.toLowerCase().startsWith(typeLabel.toLowerCase())) {
    const detail = normalised.slice(typeLabel.length).trim();
    if (detail) return { tag: normalised.slice(0, typeLabel.length), detail };
  }

  return { tag: typeLabel, detail: normalised };
};

export default function NewsRecordLinks({ links = [], onRemove = null }) {
  if (!links.length) return null;

  return (
    <ul className="app-news-links">
      {links.map((link, index) => {
        const type = getLinkType(link.recordType);
        const href = resolveLinkHref(link);
        const label = link.label || `${type?.label || "Record"} ${link.recordId}`;
        const key = link.id || `${link.recordType}:${link.recordId}:${index}`;
        const { tag, detail } = splitLabel(label, type?.label);

        const body = (
          <>
            <span className="app-news-link__type">{tag}</span>
            <span className="app-news-link__label">{detail}</span>
          </>
        );

        if (onRemove) {
          // Composer mode: not yet saved, so this is a chip with a remove
          // control rather than a navigation link.
          return (
            <li key={key} className="app-news-link-row">
              <span className="app-news-link">
                {body}
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="app-news-link__remove"
                  onClick={() => onRemove(link, index)}
                  aria-label={`Remove link to ${label}`}
                >
                  ×
                </Button>
              </span>
            </li>
          );
        }

        if (!href) return null;

        return (
          <li key={key} className="app-news-link-row">
            <Link className="app-news-link" href={href} title={label}>
              {body}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
