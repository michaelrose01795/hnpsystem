// file location: src/components/page-ui/messages/MessageContent.js
//
// Renders a message body (tokens from src/lib/messages/messageTokens.js).
// Plain text only — nothing here can inject markup.
// Three kinds of token become interactive:
//
//   • record references  /job 12345, /12345, /reg AB12 CDE, /part BP1, /appt,
//                        /invoice, /vhc, /cust[Jane] and the legacy quick links
//                        (/parts, /tracking …) — a chip linking to the record;
//   • @mentions          @[Name](u:123) — highlighted, and tinted when it is you;
//   • web addresses      http(s)://… — an ordinary link opening in a new tab.
//
// Job links follow the reader's role, exactly as before the redesign:
// technicians land on /tech/<job>, everyone else on the job card.

import React from "react";
import Link from "next/link";
import { tokenizeMessage } from "@/lib/messages/messageTokens";

export default function MessageContent({ content, roles = [], currentUserId = null }) {
  const tokens = tokenizeMessage(content, roles);
  return (
    <span>
      {tokens.map((token, index) => {
        if (token.type === "text") return <React.Fragment key={index}>{token.value}</React.Fragment>;
        if (token.type === "mention") {
          const isMe = currentUserId != null && String(token.userId) === String(currentUserId);
          return (
            <span key={index} className={`app-msg-mention${isMe ? " app-msg-mention--me" : ""}`}>
              @{token.value}
            </span>
          );
        }
        if (token.type === "url") {
          return (
            <a key={index} className="app-msg-url" href={token.value} target="_blank" rel="noreferrer noopener">
              {token.value}
            </a>
          );
        }
        if (!token.href) {
          return (
            <span key={index} className="app-msg-ref" title={token.label}>
              {token.label}
            </span>
          );
        }
        return (
          <Link
            key={index}
            className="app-msg-ref"
            href={token.href}
            title={`Open ${token.label}`}
            onClick={(event) => event.stopPropagation()}
          >
            {token.label}
          </Link>
        );
      })}
    </span>
  );
}
