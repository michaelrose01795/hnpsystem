// file location: src/components/NewsFeed/NewsAvatar.js
//
// The author / commenter avatar used everywhere in the communication hub.
//
// A photo when the user has one, their monogram on the accent tint when they
// do not — both render at exactly the same size, so a list of people never
// shifts as photos load. Appearance lives entirely in
// src/styles/families/news.css (.app-news-avatar).

import React, { useState } from "react";
import { getInitials } from "@/lib/news/format";

const SIZE_CLASS = {
  sm: "app-news-avatar app-news-avatar--sm",
  md: "app-news-avatar",
  lg: "app-news-avatar app-news-avatar--lg",
};

export default function NewsAvatar({ user, name, size = "md", className = "" }) {
  const [failed, setFailed] = useState(false);

  const displayName = user?.name || name || "System";
  const photoUrl = failed ? null : user?.photoUrl;
  const classes = [SIZE_CLASS[size] || SIZE_CLASS.md, className].filter(Boolean).join(" ");

  return (
    <span className={classes} title={displayName} aria-hidden="true">
      {photoUrl ? (
        <img
          className="app-news-avatar__image"
          src={photoUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        getInitials(displayName)
      )}
    </span>
  );
}

/**
 * A short overlapping row of avatars — "who has read this" at a glance.
 * Shows at most `max` faces and then a "+n" chip.
 */
export function NewsAvatarStack({ users = [], max = 4 }) {
  const shown = users.slice(0, max);
  const remaining = Math.max(users.length - shown.length, 0);

  if (!users.length) return null;

  return (
    <span className="app-news-avatar-stack">
      {shown.map((user) => (
        <NewsAvatar key={user.userId} user={user} size="sm" />
      ))}
      {remaining > 0 && (
        <span className="app-news-avatar app-news-avatar--sm" aria-hidden="true">
          {`+${remaining}`}
        </span>
      )}
      <span className="app-news-sr-only">
        {`${users.length} ${users.length === 1 ? "person" : "people"}`}
      </span>
    </span>
  );
}
