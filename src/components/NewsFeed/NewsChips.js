// file location: src/components/NewsFeed/NewsChips.js
//
// The small metadata labels a post carries: priority, category, department,
// status and source.
//
// Shape is the canonical Badge family (.app-badge plus one semantic tone
// modifier, families/badges.css). The feed used to carry its own
// .app-news-chip pill - pill-end radius, --text-caption type and its own tone
// palette - which made a post's status read differently from the same status
// anywhere else in the app. Nothing news-specific survives except the row that
// lays the badges out (.app-news-badge-row) and the leading glyph.
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
  [PRIORITY_URGENT]: { modifier: "app-badge--danger", glyph: "!" },
  [PRIORITY_IMPORTANT]: { modifier: "app-badge--warning", glyph: "!" },
};

/**
 * tone is a .app-badge tone modifier, defaulted to --neutral rather than left
 * blank: a bare .app-badge carries no fill, so a missing tone would render as
 * loose text instead of a label.
 */
export function NewsChip({ tone = "app-badge--neutral", glyph = "", children, title }) {
  const classes = ["app-badge", tone].filter(Boolean).join(" ");
  return (
    <span className={classes} title={title}>
      {glyph && (
        <span className="app-news-badge__glyph" aria-hidden="true">
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
    <NewsChip tone="app-badge--accent-soft" glyph={definition.icon}>
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
        <NewsChip tone="app-badge--neutral" title={departments.join(", ")}>
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
      <NewsChip tone="app-badge--neutral" glyph="✎">
        Draft
      </NewsChip>
    );
  }
  if (status === STATUS_SCHEDULED) {
    return (
      <NewsChip
        tone="app-badge--warning"
        glyph="⏱"
        title={publishAt ? `Goes live ${new Date(publishAt).toLocaleString("en-GB")}` : undefined}
      >
        Scheduled
      </NewsChip>
    );
  }
  if (status === STATUS_ARCHIVED) {
    return (
      <NewsChip tone="app-badge--neutral" glyph="🗄">
        Archived
      </NewsChip>
    );
  }
  return null;
}

export function SystemChip({ source }) {
  if (source !== "system") return null;
  return (
    <NewsChip tone="app-badge--neutral" glyph="🤖" title="Posted automatically by HNPSystem">
      Automated
    </NewsChip>
  );
}

export function AckChip({ requiresAck, isAcknowledged }) {
  if (!requiresAck) return null;
  return isAcknowledged ? (
    <NewsChip tone="app-badge--success" glyph="✓">
      Acknowledged
    </NewsChip>
  ) : (
    <NewsChip tone="app-badge--danger" glyph="!">
      Needs acknowledgement
    </NewsChip>
  );
}

/** The whole chip row a card shows under its title. */
export default function NewsChipRow({ post, showStatus = true }) {
  if (!post) return null;
  return (
    <div className="app-news-badge-row">
      <PriorityChip priority={post.priority} />
      <AckChip requiresAck={post.requiresAck} isAcknowledged={post.isAcknowledged} />
      <CategoryChip category={post.category} />
      <SystemChip source={post.source} />
      {showStatus && <StatusChip status={post.status} publishAt={post.publishAt} />}
      <DepartmentChips departments={post.departments} />
    </div>
  );
}
