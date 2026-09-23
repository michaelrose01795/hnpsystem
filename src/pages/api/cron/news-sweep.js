// file location: src/pages/api/cron/news-sweep.js
//
//   GET|POST /api/cron/news-sweep?dailySummary=true
//
// The scheduled maintenance pass for the communication hub:
//
//   1. publish every scheduled post whose time has come,
//   2. archive every published post past its expiry date,
//   3. write the automated activity / capacity alerts,
//   4. (when asked) write the automatic daily dealership summary.
//
// Every step is idempotent — automated posts are keyed on a UNIQUE system_key,
// so running this hourly is safe and a replay never duplicates anything.
// Run the daily summary once, at the end of the working day:
//
//   0 * * * *   /api/cron/news-sweep
//   0 18 * * *  /api/cron/news-sweep?dailySummary=true
//
// Guarded by CRON_SECRET, matching the other cron routes in this folder.

import { archiveExpiredPosts, publishDueScheduledPosts } from "@/lib/database/newsFeed/posts";
import { runSystemPostSweep } from "@/lib/database/newsFeed/systemPosts";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: "Invalid cron credentials." });
  }
  if (!secret && process.env.NODE_ENV === "production") {
    return res.status(503).json({ success: false, message: "CRON_SECRET is not configured." });
  }

  const includeDailySummary =
    req.query.dailySummary === "true" || req.body?.dailySummary === true;

  try {
    const [published, archived] = await Promise.all([
      publishDueScheduledPosts(),
      archiveExpiredPosts(),
    ]);

    const systemPosts = await runSystemPostSweep({ includeDailySummary });

    return res.status(200).json({
      success: true,
      data: {
        published: published.map((row) => ({ id: row.id, title: row.title })),
        archived: archived.map((row) => ({ id: row.id, title: row.title })),
        systemPosts,
      },
    });
  } catch (error) {
    console.error("/api/cron/news-sweep error", error);
    return res.status(500).json({ success: false, message: "The news sweep failed." });
  }
}
