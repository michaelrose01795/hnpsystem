// file location: src/components/NewsFeed/NewsLinkedPosts.js
//
// The reverse of a post's link list: "this record is mentioned in N
// announcements". Drop it onto any DMS record view — a job card, a customer, a
// VHC — and it resolves the announcements that link to that record, honouring
// the same audience rules the feed does.
//
//   <NewsLinkedPosts recordType="job_card" recordId={jobData.job_number} />
//
// Renders nothing at all when there is nothing linked, so it is safe to mount
// unconditionally on a record page.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import LayerSurface from "@/components/ui/LayerSurface";
import { NewsChip, PriorityChip } from "./NewsChips";
import { fetchLinkedPosts } from "@/lib/api/news";
import { formatPostDate } from "@/lib/news/format";
import { logFailure } from "@/lib/utils/logFailure";

export default function NewsLinkedPosts({ recordType, recordId, title = "Mentioned in" }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    if (!recordType || !recordId) {
      setPosts([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchLinkedPosts({ recordType, recordId: String(recordId) });
        if (!cancelled) setPosts(Array.isArray(rows) ? rows : []);
      } catch (error) {
        logFailure("Failed to load linked announcements:", error);
        if (!cancelled) setPosts([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recordId, recordType]);

  if (!posts.length) return null;

  return (
    <LayerSurface gap="var(--space-3)">
      <strong>{`${title} (${posts.length})`}</strong>
      <div className="app-news-tracker">
        {posts.map((post) => (
          <div key={post.id} className="app-news-tracker__row">
            <Link className="app-news-tracker__name" href={`/newsfeed?post=${post.id}`}>
              {post.title}
            </Link>
            <PriorityChip priority={post.priority} />
            {post.requiresAck && <NewsChip tone="app-news-chip--urgent">Needs sign-off</NewsChip>}
            <NewsChip tone="app-news-chip--muted">
              {formatPostDate(post.publishedAt).short}
            </NewsChip>
          </div>
        ))}
      </div>
    </LayerSurface>
  );
}
