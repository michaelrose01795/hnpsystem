// file location: src/components/NewsFeed/NewsChips.js
//
// The small metadata chips a post carries: priority, category, department,
// status and source.
//
// Tone is always carried by a background tint PLUS a glyph, never by colour
// alone (CLAUDE.md §3.0a rule 3), so the feed still reads correctly in
// greyscale and for colour-blind staff.

import React from "react";
import {
  PRIORITY_IMPORTANT,
  PRIORITY_URGENT,
  STATUS_ARCHIVED,
  STATUS_DRAFT,
  STATUS_SCHEDULED,
  getCategory,
  getPriority,
} from "@/lib/news/constants";

const PRIORITY_TONE = {
  [PRIORITY_URGENT]: { modifier: "app-news-chip--urgent", glyph: "!" },
  [PRIORITY_IMPORTANT]: { modifier: "app-news-chip--important", glyph: "!" },
};

export function NewsChip({ tone = "", glyph = "", children, title }) {
  const classes = ["app-news-chip", tone].filter(Boolean).join(" ");
  return (
    <span className={classes} title={title}>
      {glyph && (
        <span className="app-news-chip__glyph" aria-hidden="true">
          {glyph}
        </span>
      )}
      {children}
    </span>
  );
}

/** Only rendered above "normal" — a normal post needs no priority label. */
export function PriorityChip({ priority }) {
  const tone = PRIORITY_TONE[priority];
  if (!tone) return null;
  const definition = getPriority(priority);
  return (
    <NewsChip tone={tone.modifier} glyph={tone.glyph} title={definition.description}>
      {definition.label}
    </NewsChip>
  );
}

export function CategoryChip({ category }) {
  const definition = getCategory(category);
  return (
    <NewsChip tone="app-news-chip--muted" glyph={definition.icon}>
      {definition.label}
    </NewsChip>
  );
}

export function DepartmentChips({ departments = [], max = 3 }) {
  if (!departments.length) return null;
  const shown = departments.slice(0, max);
  const remaining = departments.length - shown.length;

  return (
    <>
      {shown.map((department) => (
        <NewsChip key={department}>{department}</NewsChip>
      ))}
      {remaining > 0 && (
        <NewsChip tone="app-news-chip--muted" title={departments.join(", ")}>
          {`+${remaining} more`}
        </NewsChip>
      )}
    </>
  );
}

/** Draft / scheduled / archived. A published post shows nothing. */
export function StatusChip({ status, publishAt }) {
  if (status === STATUS_DRAFT) {
    return (
      <NewsChip tone="app-news-chip--muted" glyph="✎">
        Draft
      </NewsChip>
    );
  }
  if (status === STATUS_SCHEDULED) {
    return (
      <NewsChip
        tone="app-news-chip--important"
        glyph="⏱"
        title={publishAt ? `Goes live ${new Date(publishAt).toLocaleString("en-GB")}` : undefined}
      >
        Scheduled
      </NewsChip>
    );
  }
  if (status === STATUS_ARCHIVED) {
    return (
      <NewsChip tone="app-news-chip--muted" glyph="🗄">
        Archived
      </NewsChip>
    );
  }
  return null;
}

export function PinnedChip({ isPinned }) {
  if (!isPinned) return null;
  return (
    <NewsChip tone="app-news-chip--important" glyph="📌">
      Pinned
    </NewsChip>
  );
}

export function SystemChip({ source }) {
  if (source !== "system") return null;
  return (
    <NewsChip tone="app-news-chip--muted" glyph="🤖" title="Posted automatically by HNPSystem">
      Automated
    </NewsChip>
  );
}

export function AckChip({ requiresAck, isAcknowledged }) {
  if (!requiresAck) return null;
  return isAcknowledged ? (
    <NewsChip tone="app-news-chip--success" glyph="✓">
      Acknowledged
    </NewsChip>
  ) : (
    <NewsChip tone="app-news-chip--urgent" glyph="!">
      Needs acknowledgement
    </NewsChip>
  );
}

/** The whole chip row a card shows under its title. */
export default function NewsChipRow({ post, showStatus = true }) {
  if (!post) return null;
  return (
    <div className="app-news-chip-row">
      <PinnedChip isPinned={post.isPinned} />
      <PriorityChip priority={post.priority} />
      <AckChip requiresAck={post.requiresAck} isAcknowledged={post.isAcknowledged} />
      <CategoryChip category={post.category} />
      <SystemChip source={post.source} />
      {showStatus && <StatusChip status={post.status} publishAt={post.publishAt} />}
      <DepartmentChips departments={post.departments} />
    </div>
  );
}
