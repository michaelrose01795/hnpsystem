// file location: src/lib/messages/serverActor.js
//
// Who is acting, for the /messages conversation-hub API routes.
//
// The session is the authority. A user id in the request is only accepted when
// the session carries no numeric id (the dev-bypass sessions withRoleGuard
// mints outside production) — the same rule src/lib/news/serverViewer.js
// applies to the news hub.

const toUserId = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

export function resolveActorId(session, req) {
  const sessionUserId = toUserId(session?.user?.id);
  if (sessionUserId) return sessionUserId;
  const allowFallback = Boolean(session?.devBypass) && process.env.NODE_ENV !== "production";
  if (!allowFallback) return null;
  return toUserId(req?.body?.actorId ?? req?.body?.userId ?? req?.query?.userId ?? req?.query?.actorId);
}

export function sendError(res, error, fallback = "Server error") {
  const status = Number(error?.statusCode) || (/not part of|not a participant/i.test(error?.message || "") ? 403 : 500);
  return res.status(status).json({
    success: false,
    code: error?.code || undefined,
    message: error?.message || fallback,
  });
}
