// file location: src/components/NewsFeed/NewsInsightsPanel.js
//
// The per-post management view: reach and read rate, the acknowledgement
// tracker (who has signed off, who has only read it, who has done neither),
// and the edit history.
//
// Rendered inside the post detail modal, which is a --theme layer, so every
// block here is a --surface one — the ladder alternates as it nests.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import EmptyState from "@/components/ui/EmptyState";
import NewsAvatar from "./NewsAvatar";
import { formatPostDate } from "@/lib/news/format";

const meterTone = (rate) => {
  if (rate >= 70) return "";
  if (rate >= 40) return " app-news-meter__fill--warning";
  return " app-news-meter__fill--danger";
};

export function NewsStat({ value, label }) {
  return (
    <div className="app-news-stat">
      <span className="app-news-stat__value">{value}</span>
      <span className="app-news-stat__label">{label}</span>
    </div>
  );
}

export function ReadRateMeter({ rate, label }) {
  const safeRate = Math.max(0, Math.min(100, Number(rate) || 0));
  return (
    <div>
      <div className="app-news-composer__hint">{`${label} — ${safeRate}%`}</div>
      <div
        className="app-news-meter"
        role="progressbar"
        aria-valuenow={safeRate}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`app-news-meter__fill${meterTone(safeRate)}`}
          style={{ width: `${safeRate}%` }}
        />
      </div>
    </div>
  );
}

const STATE_LABEL = {
  acknowledged: "Acknowledged",
  read: "Read, not acknowledged",
  outstanding: "Not opened",
};

const STATE_TONE = {
  acknowledged: "app-news-chip app-news-chip--success",
  read: "app-news-chip app-news-chip--important",
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}>
      {analytics && (
        <LayerSurface gap="var(--space-3)">
          <strong>Reach</strong>
          <div className="app-news-stat-grid">
            <NewsStat value={analytics.audienceSize} label="In the audience" />
            <NewsStat value={analytics.readCount} label="Have read it" />
            <NewsStat value={analytics.commentCount} label="Comments" />
            <NewsStat value={analytics.reactionCount} label="Reactions" />
          </div>
          <ReadRateMeter rate={analytics.readRate} label="Read rate" />
          {analytics.requiresAck && (
            <ReadRateMeter rate={analytics.acknowledgedRate} label="Acknowledged" />
          )}

          {analytics.byDepartment.length > 0 && (
            <div className="app-news-tracker">
              {analytics.byDepartment.map((row) => (
                <div key={row.department} className="app-news-tracker__row">
                  <span className="app-news-tracker__name">{row.department}</span>
                  <span className="app-news-chip app-news-chip--muted">
                    {`${row.read}/${row.audience} read`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </LayerSurface>
      )}

      {acknowledgements && (
        <LayerSurface gap="var(--space-3)">
          <strong>Acknowledgements</strong>
          <div className="app-news-stat-grid">
            <NewsStat value={acknowledgements.acknowledgedCount} label="Signed off" />
            <NewsStat value={acknowledgements.outstandingCount} label="Outstanding" />
            <NewsStat value={acknowledgements.audienceSize} label="Audience" />
          </div>

          <div className="app-news-tracker">
            {acknowledgements.rows.map((row) => (
              <div key={row.user.userId} className="app-news-tracker__row">
                <NewsAvatar user={row.user} size="sm" />
                <span className="app-news-tracker__name">{row.user.name}</span>
                <span className={STATE_TONE[row.state]}>{STATE_LABEL[row.state]}</span>
              </div>
            ))}
          </div>
        </LayerSurface>
      )}

      <LayerSurface gap="var(--space-3)">
        <strong>Edit history</strong>
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
          <span className="app-news-composer__hint">
            This update has not been edited since it was published.
          </span>
        )}
      </LayerSurface>
    </div>
  );
}
