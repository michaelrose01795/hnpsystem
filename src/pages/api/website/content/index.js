// file location: src/pages/api/website/content/index.js
//
// PUBLIC endpoint. One round-trip bundle containing every published slice of
// /website content. Consumed by src/singlescroll/WebsitePage.js (and any future
// SSR/ISR caller). Returns the same tree shape the old static modules under
// src/singlescroll/data/* exported, so call sites barely change.
//
// No auth — published content is public. Writes go through
// /api/website/sections/[section] which is role-guarded.

import { getWebsiteContent } from "@/lib/database/website";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const content = await getWebsiteContent();
    // 60-second edge cache, 5-minute stale-while-revalidate. Marketing content
    // does not need to be instant — and the staff manager calls a revalidate
    // endpoint when it mutates (added in Phase 1.6).
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    return res.status(200).json({ success: true, data: content });
  } catch (err) {
    console.error("[api/website/content] error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load website content" });
  }
}
