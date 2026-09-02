// file location: src/components/NewsFeed/NewsAnalyticsModal.js
//
// Hub-wide analytics: how much is being posted, by whom, to which departments,
// how much of it is actually being read, and which announcements are being
// missed. Management / HR core / audit admins only — the API enforces that.

import React, { useCallback, useEffect, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import EmptyState from "@/components/ui/EmptyState";
import { DropdownField } from "@/components/ui/dropdownAPI";
import { SkeletonBlock } from "@/components/ui/LoadingSkeleton";
import { NewsStat, ReadRateMeter } from "./NewsInsightsPanel";
import { fetchHubAnalytics } from "@/lib/api/news";
import { logFailure } from "@/lib/utils/logFailure";

const WINDOW_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

export default function NewsAnalyticsModal({ isOpen, onClose }) {
  const [days, setDays] = useState("30");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchHubAnalytics({ days: Number(days) }));
    } catch (loadError) {
      logFailure("Failed to load hub analytics:", loadError);
      setError(loadError.message || "We could not load the analytics.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="News feed analytics"
      cardStyle={{
        width: "min(100%, 900px)",
        maxHeight: "88vh",
        overflowY: "auto",
        padding: "var(--page-card-padding)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--layout-card-gap)" }}>
        <header className="app-popup-compact-header">
          <h3>Feed analytics</h3>
          <div className="app-popup-compact-header__actions">
            <div style={{ minWidth: 180 }}>
              <DropdownField
                id="news-analytics-window"
                options={WINDOW_OPTIONS}
                value={days}
                onValueChange={setDays}
              />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        {error && (
          <div className="app-status-message app-status-message--danger" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SkeletonBlock width="100%" height="60px" />
            <SkeletonBlock width="90%" height="14px" />
            <SkeletonBlock width="80%" height="14px" />
          </div>
        ) : !data || data.totalPosts === 0 ? (
          <EmptyState
            icon="📊"
            title="Nothing published in this window"
            description="Choose a longer period, or publish an announcement to start collecting reach data."
          />
        ) : (
          <>
            <div className="app-news-stat-grid">
              <NewsStat value={data.totalPosts} label="Announcements" />
              <NewsStat value={data.totalReads} label="Total reads" />
              <NewsStat value={data.totalComments} label="Comments" />
              <NewsStat value={data.totalReactions} label="Reactions" />
            </div>

            <ReadRateMeter rate={data.averageReadRate} label="Average read rate" />

            <LayerTheme gap="var(--space-3)">
              <strong>Acknowledgements</strong>
              <div className="app-news-stat-grid">
                <NewsStat value={data.acknowledgementSummary.required} label="Posts requiring one" />
                <NewsStat value={data.acknowledgementSummary.complete} label="Fully signed off" />
                <NewsStat
                  value={data.acknowledgementSummary.outstanding}
                  label="Outstanding sign-offs"
                />
              </div>
            </LayerTheme>

            <LayerTheme gap="var(--space-3)">
              <strong>By category</strong>
              <div className="app-news-tracker">
                {data.byCategory.map((row) => (
                  <div key={row.value} className="app-news-tracker__row">
                    <span className="app-news-tracker__name">{row.label}</span>
                    <span className="app-news-chip app-news-chip--muted">
                      {`${row.posts} posts · ${row.reads} reads`}
                    </span>
                  </div>
                ))}
              </div>
            </LayerTheme>

            <LayerTheme gap="var(--space-3)">
              <strong>By department</strong>
              <div className="app-news-tracker">
                {data.byDepartment.map((row) => (
                  <div key={row.department} className="app-news-tracker__row">
                    <span className="app-news-tracker__name">{row.department}</span>
                    <span className="app-news-chip app-news-chip--muted">
                      {`${row.posts} posts · ${row.reads} reads`}
                    </span>
                  </div>
                ))}
              </div>
            </LayerTheme>

            <LayerTheme gap="var(--space-3)">
              <strong>Being missed</strong>
              <span className="app-news-composer__hint">
                Published to an audience, but read by fewer than half of them.
              </span>
              {data.unreadPosts.length === 0 ? (
                <span className="app-news-composer__hint">
                  Nothing is being missed in this window.
                </span>
              ) : (
                <div className="app-news-tracker">
                  {data.unreadPosts.map((row) => (
                    <div key={row.postId} className="app-news-tracker__row">
                      <span className="app-news-tracker__name">{row.title}</span>
                      <span className="app-news-chip app-news-chip--urgent">
                        {`${row.readRate}% read`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </LayerTheme>

            <LayerTheme gap="var(--space-3)">
              <strong>Most read</strong>
              <div className="app-news-tracker">
                {data.topPosts.map((row) => (
                  <div key={row.postId} className="app-news-tracker__row">
                    <span className="app-news-tracker__name">{row.title}</span>
                    <span className="app-news-chip app-news-chip--success">
                      {`${row.readRate}% read`}
                    </span>
                  </div>
                ))}
              </div>
            </LayerTheme>

            <LayerTheme gap="var(--space-3)">
              <strong>Who is posting</strong>
              <div className="app-news-tracker">
                {data.topAuthors.map((row) => (
                  <div key={row.author} className="app-news-tracker__row">
                    <span className="app-news-tracker__name">{row.author}</span>
                    <span className="app-news-chip app-news-chip--muted">
                      {`${row.posts} posts`}
                    </span>
                  </div>
                ))}
              </div>
            </LayerTheme>
          </>
        )}
      </div>
    </PopupModal>
  );
}
