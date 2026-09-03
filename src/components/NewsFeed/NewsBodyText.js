// file location: src/components/NewsFeed/NewsBodyText.js
//
// Renders a post or comment body, turning the stored @[Name](u:123) mention
// tokens into highlighted spans. A mention of the reader themselves is tinted
// differently so "this is about me" is visible while scanning the feed.
//
// Deliberately NOT a rich-text/HTML renderer: the body is plain text, so there
// is nothing here that can inject markup.

import React from "react";
import { parseMentionBody } from "@/lib/news/format";

export default function NewsBodyText({
  body,
  currentUserId = null,
  className = "",
  clamped = false,
  bracketedMentions = false,
}) {
  const tokens = parseMentionBody(body);
  const classes = [
    "app-news-card__body",
    clamped ? "app-news-card__body--clamped" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <p className={classes}>
      {tokens.map((token, index) => {
        if (token.type === "text") {
          return <React.Fragment key={index}>{token.value}</React.Fragment>;
        }
        const isMe =
          currentUserId != null && String(token.userId) === String(currentUserId);
        return (
          <span
            key={index}
            className={`app-news-mention${
              bracketedMentions ? " app-news-mention--comment" : ""
            }${isMe ? " app-news-mention--me" : ""}`}
          >
            {bracketedMentions ? `@[${token.value}]` : `@${token.value}`}
          </span>
        );
      })}
    </p>
  );
}
