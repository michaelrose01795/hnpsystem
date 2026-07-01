// file location: src/pages/api/support/notifications/stream.js
//
// Phase 10 — LIVE notification stream (Server-Sent Events). Dev-gated
// (DEV_PLATFORM_ROLES). This is the "streaming instead of polling where
// supported" upgrade: the client opens one EventSource and receives an `unread`
// event whenever its unread count changes, instead of each tab polling.
//
// It is deliberately content-free (it sends the unread COUNT only, never the
// notification bodies — the client fetches those from the list route), so the
// stream adds no new privacy surface. The connection is self-limiting: it runs a
// bounded server-side poll loop (~4 min) then ends, and the browser's EventSource
// auto-reconnects — which keeps a single serverless invocation short-lived.
//
// Falls back cleanly: if SSE is unavailable in the deployment, the client hook
// (useNotifications) simply keeps polling the list route.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { DEV_PLATFORM_ROLES } from "@/lib/auth/roles";
import { countUnread } from "@/lib/database/supportNotifications";
import { devOwnerKey } from "@/lib/database/supportSavedViews";

const POLL_MS = 4000;
const MAX_TICKS = 60; // ~4 minutes, then the client reconnects

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: ${POLL_MS}\n\n`);
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const owner = devOwnerKey(session);
  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  let last = -1;
  for (let tick = 0; tick < MAX_TICKS && !closed; tick++) {
    let count = last < 0 ? 0 : last;
    try {
      const result = await countUnread(owner);
      if (result.ok) count = result.count;
    } catch {
      /* transient DB blip — keep the stream alive, report the last known count */
    }
    if (count !== last) {
      res.write(`event: unread\ndata: ${JSON.stringify({ unread: count })}\n\n`);
      last = count;
    } else {
      res.write(`: keep-alive\n\n`); // comment frame keeps proxies from closing the pipe
    }
    if (closed) break;
    await sleep(POLL_MS);
  }
  res.end();
}

export default withRoleGuard(handler, { allow: DEV_PLATFORM_ROLES });
