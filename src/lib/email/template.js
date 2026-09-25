import fs from "fs";
import path from "path";

const LOGO_PATH = path.join(process.cwd(), "public", "images", "logo", "Logo.png");
const LOGO_CID = "hnp-logo@mailer";
const DEFAULT_PUBLIC_APP_URL = "https://hnpsystem.vercel.app";

function normalizeAbsoluteUrl(value, fallback = DEFAULT_PUBLIC_APP_URL) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Hosts that only resolve on the machine / network that generated the link.
// A link to one of these in an email is dead for everyone else.
export function isLocalOrPrivateHost(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h === "0.0.0.0" || h.startsWith("127.")) return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^(fc|fd)[0-9a-f]{2}:/.test(h) || h.startsWith("fe80:")) return true;
  return false;
}

const hostOf = (origin) => {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
};

/**
 * The origin that links in an outgoing email must point at.
 *
 *   1. The configured public site URL — NEXT_PUBLIC_APP_URL, then
 *      NEXT_PUBLIC_SITE_URL (either may omit the scheme). In development this
 *      still wins, so a developer can point links at a tunnel on purpose.
 *   2. Production: NEXTAUTH_URL, Vercel's stable production domain, then the
 *      default public app URL. A localhost / private-network value is SKIPPED
 *      in production (a dev value copied into prod env must never reach a
 *      recipient), and the request Host header is never trusted there (it is
 *      client-controlled).
 *   3. Development: the host the request actually came in on (so a link in a
 *      local test email opens the local app), then NEXTAUTH_URL, then
 *      http://localhost:3000.
 *
 * @param {object} [req]  incoming request (dev only — used for the Host header)
 * @param {Record<string,string|undefined>} [env]  defaults to process.env
 * @returns {string} origin without a trailing slash
 */
export function resolvePublicAppUrl(req, env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  // First usable configured value, skipping local/private hosts in production.
  const firstConfigured = (values) => {
    for (const value of values) {
      if (!value || !String(value).trim()) continue;
      const origin = normalizeAbsoluteUrl(value, "");
      if (!origin) continue;
      if (isProduction && isLocalOrPrivateHost(hostOf(origin))) continue;
      return origin;
    }
    return "";
  };

  const publicSite = firstConfigured([env.NEXT_PUBLIC_APP_URL, env.NEXT_PUBLIC_SITE_URL]);
  if (publicSite) return publicSite;

  if (isProduction) {
    return firstConfigured([env.NEXTAUTH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) || DEFAULT_PUBLIC_APP_URL;
  }

  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host;
  if (host) {
    const firstHost = String(host).split(",")[0].trim();
    const local = isLocalOrPrivateHost(firstHost.replace(/:\d+$/, ""));
    const proto = String(req?.headers?.["x-forwarded-proto"] || (local ? "http" : "https")).split(",")[0].trim();
    try {
      return new URL(`${proto}://${firstHost}`).origin;
    } catch {
      // fall through
    }
  }
  return firstConfigured([env.NEXTAUTH_URL]) || "http://localhost:3000";
}

export function resolveEmailBaseUrl(req) {
  // A localhost / private address copied into production env must never reach
  // an email recipient — skip it and fall through to the public defaults.
  const prodSafe = (value) =>
    value &&
    !(process.env.NODE_ENV === "production" && isLocalOrPrivateHost(hostOf(normalizeAbsoluteUrl(value, ""))));
  if (prodSafe(process.env.NEXT_PUBLIC_APP_URL)) return normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (prodSafe(process.env.NEXT_PUBLIC_SITE_URL)) return normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.VERCEL_URL) return normalizeAbsoluteUrl(`https://${process.env.VERCEL_URL}`);
  if (process.env.NODE_ENV === "production") return DEFAULT_PUBLIC_APP_URL;
  const proto = req?.headers?.["x-forwarded-proto"] || "http";
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host;
  if (host && !String(host).includes("localhost")) return normalizeAbsoluteUrl(`${proto}://${host}`);
  if (process.env.NEXTAUTH_URL) return normalizeAbsoluteUrl(process.env.NEXTAUTH_URL);
  return DEFAULT_PUBLIC_APP_URL;
}

export function getEmailBranding(req, companyNameOverride) {
  const companyName = companyNameOverride || process.env.SMTP_COMPANY_NAME || "HP Automotive";
  const logoUrl = `${resolveEmailBaseUrl(req)}/images/logo/Logo.png`;
  const hasLocalLogo = fs.existsSync(LOGO_PATH);
  const logoSrc = hasLocalLogo ? `cid:${LOGO_CID}` : logoUrl;
  const attachments = hasLocalLogo
    ? [
        {
          filename: "logo.png",
          path: LOGO_PATH,
          cid: LOGO_CID,
        },
      ]
    : [];
  return { companyName, logoSrc, attachments, logoUrl };
}

export function renderEmailShell({
  title,
  previewText = "",
  companyName = "HP Automotive",
  logoSrc = "",
  eyebrow = "",
  headline = "",
  intro = "",
  bodyHtml = "",
  ctaLabel = "",
  ctaUrl = "",
  footerText = "",
}) {
  const safeTitle = escapeHtml(title || companyName);
  const safePreviewText = escapeHtml(previewText);
  const safeCompanyName = escapeHtml(companyName);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeHeadline = escapeHtml(headline);
  const safeIntro = escapeHtml(intro);
  const safeFooterText = escapeHtml(footerText || `Sent by ${companyName}`);

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
      <div style="text-align:center;padding:8px 0 24px 0;">
          <a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer" class="btn">${escapeHtml(ctaLabel)}</a>
      </div>
    `
      : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <style>
      :root {
        color-scheme: light dark;
        supported-color-schemes: light dark;
      }
      body.email-body {
        margin: 0;
        padding: 0;
        background: #f3f4f6;
        font-family: Arial, Helvetica, sans-serif;
        color: #111827;
      }
      .preheader {
        display: none !important;
        visibility: hidden;
        opacity: 0;
        color: transparent;
        height: 0;
        width: 0;
        overflow: hidden;
        mso-hide: all;
      }
      .shell {
        max-width: 720px;
        margin: 24px auto;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        overflow: hidden;
      }
      .header {
        background: #ffffff;
        color: #111827;
        border-top: 4px solid #b91c1c;
        padding: 20px 28px;
      }
      .brand-row {
        display: table;
        width: 100%;
      }
      .brand-cell {
        display: block;
        vertical-align: middle;
        text-align: center;
      }
      .logo {
        display: inline-block;
        height: 44px;
        width: auto;
      }
      .eyebrow {
        margin: 10px 0 0 0;
        color: #991b1b;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-align: center;
      }
      .headline {
        margin: 6px 0 0 0;
        font-size: 24px;
        line-height: 1.3;
        color: #111827;
        text-align: center;
      }
      .content {
        padding: 28px;
      }
      .content-inner {
        max-width: 620px;
        margin: 0 auto;
      }
      .intro {
        margin: 0 0 18px 0;
        font-size: 14px;
        line-height: 1.6;
        color: #374151;
        text-align: center;
      }
      .card {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: #ffffff;
        padding: 16px;
      }
      .btn {
        display: inline-block;
        background: #b91c1c;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 8px;
        padding: 11px 16px;
        font-size: 14px;
        font-weight: 700;
      }
      a {
        color: #b91c1c;
      }
      .footer {
        border-top: 1px solid #e5e7eb;
        padding: 16px 28px 22px 28px;
        font-size: 12px;
        color: #6b7280;
        text-align: center;
      }
      @media (prefers-color-scheme: dark) {
        body.email-body {
          background: #0e0e11 !important;
          color: #f2f2f2 !important;
        }
        .shell {
          background: #16161a !important;
          border-color: #2c2c33 !important;
        }
        .header {
          background: #16161a !important;
          color: #f8f8f8 !important;
          border-top-color: #f87171 !important;
        }
        .content {
          background: #16161a !important;
        }
        .intro {
          color: #d6d6d8 !important;
        }
        .eyebrow {
          color: #f87171 !important;
        }
        .headline {
          color: #f8f8f8 !important;
        }
        .card {
          background: #1d1d24 !important;
          border-color: #2c2c33 !important;
          color: #e6e6e8 !important;
        }
        .btn {
          background: #dc2626 !important;
          color: #ffffff !important;
        }
        a {
          color: #f87171 !important;
        }
        .footer {
          border-top-color: #2c2c33 !important;
          color: #a8a8ad !important;
          background: #16161a !important;
        }
      }
      @media only screen and (max-width: 640px) {
        .shell {
          margin: 10px;
        }
        .header {
          padding: 18px 16px;
        }
        .content {
          padding: 18px 16px;
        }
        .footer {
          padding: 14px 16px 18px 16px;
        }
        .headline {
          font-size: 20px;
        }
        .logo {
          height: 36px;
        }
      }
    </style>
  </head>
  <body class="email-body">
    <span class="preheader">${safePreviewText}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center">
          <div class="shell">
            <div class="header">
              <div class="brand-row">
                <div class="brand-cell">
                  ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="${safeCompanyName}" class="logo" />` : ""}
                </div>
              </div>
              ${safeEyebrow ? `<p class="eyebrow">${safeEyebrow}</p>` : ""}
              ${safeHeadline ? `<h1 class="headline">${safeHeadline}</h1>` : ""}
            </div>
            <div class="content">
              <div class="content-inner">
                ${safeIntro ? `<p class="intro">${safeIntro}</p>` : ""}
                ${bodyHtml}
                ${ctaBlock}
              </div>
            </div>
            <div class="footer">${safeFooterText}</div>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
