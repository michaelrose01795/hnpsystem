// file location: src/pages/api/img-proxy.js
//
// Same-origin image proxy. Used by the /website 3D scene because Three.js
// loads textures with crossOrigin="anonymous" and the upstream CDN
// (images.67degreescdn.co.uk) does NOT send Access-Control-Allow-Origin —
// so direct loads taint the WebGL context and fail.
//
// Why this exists instead of `/_next/image`:
//   - Next.js 16 rejects custom `q` and `w` values unless those values are
//     explicitly listed in `images.qualities` / `images.deviceSizes`. The
//     scene needs untransformed pixels, not optimised variants. This proxy
//     is a thin pass-through with no transformation, so it never trips
//     those restrictions.
//   - Sets explicit CORS + cache headers, so any future feature using
//     external images on the public site can rely on it.
//
// To allow another upstream host, add it to ALLOWED_HOSTS below. The
// allowlist is intentional — without it, this endpoint would be an open
// proxy that anyone could abuse.

const ALLOWED_HOSTS = new Set([
  "images.67degreescdn.co.uk",
  "67degreescdn.co.uk",
]);

const ONE_DAY = 60 * 60 * 24;

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing `url` query parameter" });
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid url" });
    return;
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.host)) {
    res.status(400).json({ error: "Host not allowed" });
    return;
  }

  let upstream;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        // Identify ourselves and accept any image content-type the upstream
        // wants to serve.
        "User-Agent": "HNPSystem-Website-Proxy/1.0",
        Accept: "image/*",
      },
    });
  } catch (err) {
    res.status(502).json({ error: "Upstream fetch failed" });
    return;
  }

  if (!upstream.ok) {
    res.status(upstream.status).end();
    return;
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await upstream.arrayBuffer());

  res.setHeader("Content-Type", contentType);
  // 1 day public cache, served same-origin so CORS isn't strictly required,
  // but we set it anyway in case the asset is consumed cross-origin later.
  res.setHeader("Cache-Control", `public, max-age=${ONE_DAY}, s-maxage=${ONE_DAY}, immutable`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.status(200).send(buffer);
}

// Allow up to ~10 MB images (banner files are big). Default for API routes
// is 4 MB which is fine for 1080p JPEGs but we lift the ceiling so future
// hi-res hero images don't 413.
export const config = {
  api: {
    responseLimit: "10mb",
  },
};
