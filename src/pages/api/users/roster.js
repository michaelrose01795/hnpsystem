// file location: src/pages/api/users/roster.js
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { isDevAuthAllowed } from "@/lib/auth/devAuth";
import { isPlaywrightCi } from "@/lib/api/ciMocks";
import { buildRosterPayload } from "@/lib/users/rosterPayload";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    return res.status(200).json({
      success: true,
      data: await buildRosterPayload(),
      source: isPlaywrightCi() ? "playwright-ci" : "database",
    });
  } catch (error) {
    console.error("Failed to load /api/users/roster", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load users roster",
      error: error.message,
    });
  }
}

const guardedHandler = withRoleGuard(handler);

export default function rosterApi(req, res) {
  if (isPlaywrightCi() || isDevAuthAllowed()) {
    return handler(req, res);
  }

  return guardedHandler(req, res);
}
