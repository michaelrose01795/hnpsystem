// file location: src/components/NewsFeed/NewsInsightsPanel.js
//
// The per-post management view: engagement, acknowledgement tracking and edit
// history. Read/unread state is intentionally absent from the newsfeed UI.
//
// The popup card is the outer neutral surface, so each section uses the
// canonical --theme layer for clear, borderless grouping.

import React from "react";
import LayerTheme from "@/components/ui/LayerTheme";
import EmptyState from "@/components/ui/EmptyState";
import NewsAvatar from "./NewsAvatar";
import { formatPostDate } from "@/lib/news/format";

export function NewsStat({ value, label }) {
  return (
    <div className="app-news-stat">
      <span className="app-news-stat__value">{value}</span>
      <span className="app-news-stat__label">{label}</span>
    </div>
  );
}

const STATE_LABEL = {
  acknowledged: "Acknowledged",
  outstanding: "Outstanding",
};

const STATE_TONE = {
  acknowledged: "app-news-chip app-news-chip--success",
  outstanding: "app-news-chip app-news-chip--urgent",
};

export default function NewsInsightsPanel({ insights }) {
  if (!insights) {
    return (
      <EmptyState
        icon="📊"
        title="No insights available"
        description="Reach figures appear once the update has been published to an audience."
      />
    );
  }

  const { analytics, acknowledgements, revisions } = insights;
  const acknowledgementRows = [...(acknowledgements?.rows || [])].sort((left, right) => {
    if (left.state !== right.state) return left.state === "outstanding" ? -1 : 1;
    return String(left.user?.name || "").localeCompare(String(right.user?.name || ""));
  });

  return (
    <div className="app-news-insights">
      {analytics && (
        <LayerTheme as="section" className="app-news-insights__section" gap="var(--space-md)">
          <header className="app-news-insights__header">
            <h4>Engagement</h4>
            <p>Current activity for this announcement.</p>
          </header>
          <div className="app-news-stat-grid">
            <NewsStat value={analytics.audienceSize} label="In the audience" />
            <NewsStat value={analytics.commentCount} label="Comments" />
            <NewsStat value={analytics.reactionCount} label="Reactions" />
          </div>
        </LayerTheme>
      )}

      {acknowledgements && (
        <LayerTheme as="section" className="app-news-insights__section" gap="var(--space-md)">
          <header className="app-news-insights__header">
            <h4>Acknowledgements</h4>
            <p>Completion across the selected audience.</p>
          </header>
          <div className="app-news-stat-grid">
            <NewsStat value={acknowledgements.acknowledgedCount} label="Signed off" />
            <NewsStat value={acknowledgements.outstandingCount} label="Outstanding" />
            <NewsStat value={acknowledgements.audienceSize} label="Audience" />
          </div>

          <div className="app-news-insights__subhead">
            <strong>Staff status</strong>
            <span>{`${acknowledgementRows.length} ${
              acknowledgementRows.length === 1 ? "person" : "people"
            }`}</span>
          </div>
          <div
            className="app-news-tracker"
            role="list"
            aria-label="Acknowledgement status by staff member"
          >
            {acknowledgementRows.map((row) => (
              <div key={row.user.userId} className="app-news-tracker__row" role="listitem">
                <NewsAvatar user={row.user} size="sm" />
                <span className="app-news-tracker__name">{row.user.name}</span>
                <span
                  className={
                    STATE_TONE[row.state === "acknowledged" ? "acknowledged" : "outstanding"]
                  }
                >
                  {STATE_LABEL[row.state === "acknowledged" ? "acknowledged" : "outstanding"]}
                </span>
              </div>
            ))}
          </div>
        </LayerTheme>
      )}

      <LayerTheme as="section" className="app-news-insights__section" gap="var(--space-md)">
        <header className="app-news-insights__header">
          <h4>Edit history</h4>
          <p>Published changes and their authors.</p>
        </header>
        {revisions?.length ? (
          revisions.map((revision) => (
            <div key={revision.id} className="app-news-revision">
              <span className="app-news-revision__meta">
                {`Version ${revision.revision} · ${revision.editedByName || "Unknown"} · ${
                  formatPostDate(revision.editedAt).short
                }`}
              </span>
              <strong>{revision.title}</strong>
              <p className="app-news-revision__body">{revision.content}</p>
            </div>
          ))
        ) : (
          <p className="app-news-insights__empty">
            This update has not been edited since it was published.
          </p>
        )}
      </LayerTheme>
    </div>
  );
}
