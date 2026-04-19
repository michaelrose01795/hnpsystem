// file location: src/pages/api/dev/showcase-notes.js
// GET  → returns all showcase notes keyed by section_key
// PUT  → upserts a note for a given section_key

import { getDatabaseClient } from "@/lib/database/client";
import { withRoleGuard } from "@/lib/auth/roleGuard";

const supabase = getDatabaseClient();

async function handler(req, res, session) {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("showcase_notes")
      .select("section_key, note_text, updated_at");

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const notes = {};
    for (const row of data || []) {
      notes[row.section_key] = { text: row.note_text, updatedAt: row.updated_at };
    }
    return res.status(200).json({ success: true, data: notes });
  }

  if (req.method === "PUT") {
    const { sectionKey, noteText } = req.body || {};
    if (!sectionKey || typeof sectionKey !== "string") {
      return res.status(400).json({ success: false, message: "sectionKey is required" });
    }

    const userId = session?.dbUserId ?? session?.user?.id ?? null;
    const { error } = await supabase
      .from("showcase_notes")
      .upsert(
        {
          section_key: sectionKey,
          note_text: String(noteText ?? ""),
          updated_by: userId ? Number(userId) : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "section_key" }
      );

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler);
