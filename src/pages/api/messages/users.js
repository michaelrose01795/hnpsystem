// file location: src/pages/api/messages/users.js
import { searchDirectoryUsers } from "@/lib/database/messages";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { q = "", limit = 25, exclude = "" } = req.query;
    const parsedLimit = Number(limit) > 0 ? Number(limit) : 25;
    const excludeIds = String(exclude)
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const users = await searchDirectoryUsers(q, parsedLimit);
    const filtered = excludeIds.length
      ? users.filter((user) => !excludeIds.includes(user.id))
      : users;

    return res.status(200).json({ success: true, data: filtered });
  } catch (error) {
    console.error("❌ /api/messages/users error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
