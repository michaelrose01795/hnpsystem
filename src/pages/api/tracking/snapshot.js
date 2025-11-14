// file location: src/pages/api/tracking/snapshot.js
import { fetchTrackingSnapshot } from "@/lib/database/tracking"; // import database helper
import { initialTrackingEntries } from "@/lib/tracking/mockEntries";

const respondWithMockData = (res, reason = null) => {
  return res.status(200).json({
    success: true,
    data: initialTrackingEntries,
    meta: {
      mocked: true,
      reason: reason || "Supabase credentials unavailable",
    },
  });
};

const shouldServeMockTrackingData = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return true;
  }

  const placeholders = ["your-project-id", "your-anon-key-here", "your-service-role-key"];
  return [supabaseUrl, anonKey, serviceKey].some((value) =>
    placeholders.some((token) => value.toLowerCase().includes(token))
  );
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  if (shouldServeMockTrackingData()) {
    return respondWithMockData(res);
  }

  try {
    const result = await fetchTrackingSnapshot();
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error?.message || "Failed to load tracking" });
    }

    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error("Tracking snapshot API error", error);
    return res.status(500).json({ success: false, message: error.message || "Unexpected error" });
  }
}
