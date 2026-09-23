// file location: src/pages/_document.js
// Custom Next.js document that boots the shared semantic theme tokens before React hydrates.

import Document, { Html, Head, Main, NextScript } from "next/document";
import ROUTE_SCOPED_CSS from "@/config/routeScopedCss.generated.json";
import {
  ACCENT_PALETTES,
  DEFAULT_ACCENT,
  buildThemeRuntime,
  buildThemeTokens,
  normalizeAccent,
  normalizeMode,
} from "@/styles/themeRuntime";

const parseCookieHeader = (cookieHeader = "") =>
  String(cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = part.slice(0, separatorIndex).trim();
      const rawValue = part.slice(separatorIndex + 1).trim();
      try {
        acc[key] = decodeURIComponent(rawValue);
      } catch {
        acc[key] = rawValue;
      }
      return acc;
    }, {});

const getBootTheme = (cookies = {}, pathname = "") => {
  // Resolve the requested theme mode from cookies first.
  const requestedMode = normalizeMode(cookies["hp-dms-theme"] || "system");

  // Resolve the server-side boot mode conservatively so initial HTML remains deterministic.
  const resolvedMode = requestedMode === "dark" ? "dark" : "light";

  // /login always boots the brand-red login theme so a hard navigation onto it
  // (e.g. logout) never flashes the previous user's accent. The stored accent
  // is left untouched — only what is painted changes.
  const accentName =
    pathname === "/login"
      ? DEFAULT_ACCENT
      : normalizeAccent(cookies["hp-dms-accent"] || DEFAULT_ACCENT);

  // Build the same semantic runtime values that the client provider will later reuse.
  const runtime = buildThemeRuntime({ resolvedMode, accentName });

  // Return the values needed by the document and boot script.
  return {
    requestedMode,
    resolvedMode,
    accentName,
    primary: runtime.accentMain,
    background: runtime.shellBackground,
    tokens: runtime.legacy,
  };
};

const hasAuthenticatedCookie = (cookies = {}) =>
  Object.keys(cookies).some(
    (key) =>
      key === "hnp-dev-roles" ||
      key === "next-auth.session-token" ||
      key === "__Secure-next-auth.session-token" ||
      key.startsWith("next-auth.session-token.") ||
      key.startsWith("__Secure-next-auth.session-token.")
  );

const structuredClonePolyfill = `
(() => {
  try {
    if (typeof globalThis === "undefined" || typeof globalThis.structuredClone === "function") {
      return;
    }
  } catch (err) {
    return;
  }

  const clone = (value, seen = new WeakMap()) => {
    if (value === null || typeof value !== "object") {
      return value;
    }
    if (value instanceof Date) {
      return new Date(value.getTime());
    }
    if (value instanceof RegExp) {
      return new RegExp(value.source, value.flags);
    }
    if (value instanceof Map) {
      const next = new Map();
      value.forEach((v, k) => {
        next.set(clone(k, seen), clone(v, seen));
      });
      return next;
    }
    if (value instanceof Set) {
      const next = new Set();
      value.forEach((v) => next.add(clone(v, seen)));
      return next;
    }
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
      return value.slice(0);
    }
    if (seen.has(value)) {
      return seen.get(value);
    }
    const next = Array.isArray(value) ? [] : {};
    seen.set(value, next);
    Object.keys(value).forEach((key) => {
      next[key] = clone(value[key], seen);
    });
    return next;
  };

  globalThis.structuredClone = function structuredClonePolyfill(value) {
    return clone(value);
  };
})();
`;

const themeBootScript = `
(() => {
  try {
    const allCookies = document.cookie || "";
    const hasAuthCookie = /(?:^|;\\s*)(?:__Secure-next-auth\\.session-token(?:\\.\\d+)?|next-auth\\.session-token(?:\\.\\d+)?|hnp-dev-roles)=/.test(allCookies);
    document.documentElement.setAttribute("data-authenticated", hasAuthCookie ? "true" : "false");

    const readCookie = (name) => {
      const escapedName = name.replace(/[.*+?^$()|[\\]\\\\]/g, "\\\\$&");
      const match = document.cookie.match(new RegExp("(?:^|;\\\\s*)" + escapedName + "=([^;]+)"));
      return match ? decodeURIComponent(match[1]) : null;
    };

    const storedMode = window.localStorage.getItem("hp-dms-theme") || readCookie("hp-dms-theme");
    const mode =
      storedMode === "dark" || storedMode === "light" || storedMode === "system"
        ? storedMode
        : "system";
    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedMode = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
    document.documentElement.setAttribute("data-theme", resolvedMode);
    document.documentElement.style.colorScheme = resolvedMode;

    const accents = ${JSON.stringify(ACCENT_PALETTES)};

    const storedAccent = (window.localStorage.getItem("hp-dms-accent") || readCookie("hp-dms-accent") || "${DEFAULT_ACCENT}").toLowerCase();
    // /login always paints brand red regardless of the stored accent, so a hard
    // navigation onto it never flashes the previous user's colour. The stored
    // value itself is preserved (the cookie write below still uses storedAccent).
    const isLoginRoute = window.location.pathname === "/login";
    const paintAccent = isLoginRoute ? "${DEFAULT_ACCENT}" : storedAccent;
    const palette = accents[paintAccent] || accents["${DEFAULT_ACCENT}"];
    const resolvedAccent = resolvedMode === "dark" ? palette.dark : palette.light;
    const runtime = ${buildClientRuntimeExpression()};

    Object.entries(runtime.legacy).forEach(([token, value]) => {
      document.documentElement.style.setProperty(token, value);
    });

    document.documentElement.style.backgroundColor = runtime.shellBackground;
    if (document.body) document.body.style.backgroundColor = runtime.shellBackground;
    var tm = document.querySelector('meta[name="theme-color"]');
    if (tm) tm.setAttribute("content", runtime.shellBackground);

    const isWebsiteRoute = window.location.pathname === "/website" || window.location.pathname.startsWith("/website/");
    document.documentElement.classList.toggle("website-scope", isWebsiteRoute);
    document.documentElement.classList.toggle("staff-scope", !isWebsiteRoute);
    if (document.body) {
      document.body.classList.toggle("website-scope", isWebsiteRoute);
      document.body.classList.toggle("staff-scope", !isWebsiteRoute);
    }

    document.cookie = "hp-dms-theme=" + encodeURIComponent(mode) + "; path=/; max-age=31536000; samesite=lax";
    document.cookie = "hp-dms-accent=" + encodeURIComponent(storedAccent) + "; path=/; max-age=31536000; samesite=lax";

  } catch (_) {
    // Keep app boot resilient: startup script should never block render.
  }
})();
`;

function buildClientRuntimeExpression() {
  // Serialise THE shared derivation (src/styles/themeRuntime.js) straight into
  // the boot script, so the pre-hydration paint and the post-hydration paint
  // run byte-identical code. This used to be a hand-transcribed second copy,
  // and it had drifted: it painted --primary-border as a visible accent colour
  // (every legacy consumer flashed an accent hairline that vanished on
  // hydration), reverted the softened --ghostbutton-ring to full strength, and
  // dropped --control-menu-shadow entirely.
  //
  // buildThemeTokens is self-contained by contract - it closes over nothing -
  // which is what makes .toString() safe here. See the RULES block on the
  // function itself before editing it.
  return `(${buildThemeTokens.toString()})(resolvedMode, resolvedAccent)`;
}

// Route-scoped stylesheets for a first paint on this path.
//
// These two used to be imported by _app, which meant all 162 routes downloaded
// them. They are emitted as static assets instead and linked only here (initial
// HTML) and from _app's scope effect (client-side navigation). Keep the two
// predicates in step with isWebsitePath / isTrackingPath in _app.js.
const routeScopedCssFor = (pathname = "") => {
  const keys = [];
  if (pathname === "/website" || pathname.startsWith("/website/")) keys.push("website");
  if (pathname === "/tracking" || pathname.startsWith("/tracking/")) keys.push("trackingMap");
  return keys
    .map((key) => ({ key, href: ROUTE_SCOPED_CSS[key] }))
    .filter((entry) => Boolean(entry.href));
};

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    const cookies = parseCookieHeader(ctx?.req?.headers?.cookie || "");
    return {
      ...initialProps,
      bootTheme: getBootTheme(cookies, ctx?.pathname || ""),
      hasAuthCookie: hasAuthenticatedCookie(cookies),
      // Which route-scoped stylesheets this document needs (see
      // tools/scripts/emit-route-scoped-css.js). Resolved here rather than in
      // _app so the <link> is in the initial HTML and the route paints styled.
      routeCss: routeScopedCssFor(ctx?.pathname || ""),
    };
  }

  render() {
    const bootTheme = this.props.bootTheme || getBootTheme({});
    const routeCss = Array.isArray(this.props.routeCss) ? this.props.routeCss : [];

    return (
      <Html
        data-theme={bootTheme.resolvedMode}
        data-theme-requested={bootTheme.requestedMode}
        data-authenticated={this.props.hasAuthCookie ? "true" : "false"}
        style={{ backgroundColor: bootTheme.background, colorScheme: bootTheme.resolvedMode }}
      >
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <meta name="theme-color" content={bootTheme.background} />
          {/* Tab and home-screen icons, generated from the canonical
              /images/logo/desktop.png so they stay visually in sync with the
              desktop app icon and the sidebar rail.

              These used to point straight at desktop.png — a 1254x1254 PNG that
              is 806 KB over the wire, requested by every browser on every page
              just to draw a 16px tab icon. Serving each size at its own size
              takes that to ~2 KB for the tab and ~15 KB for the home-screen
              icon. Regenerate with sharp from desktop.png if the logo changes. */}
          <link rel="icon" type="image/png" sizes="32x32" href="/images/logo/icon-32.png" />
          <link rel="icon" type="image/png" sizes="192x192" href="/images/logo/icon-192.png" />
          <link rel="shortcut icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" sizes="180x180" href="/images/logo/icon-180.png" />
          {/* Route-scoped global CSS — see routeScopedCssFor above. */}
          {routeCss.map(({ key, href }) => (
            <link key={key} rel="stylesheet" href={href} data-route-css={key} />
          ))}
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          {/* Ensure iPad/Safari gets structuredClone before Next.js router boots */}
          <script dangerouslySetInnerHTML={{ __html: structuredClonePolyfill }} />
          <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
          <style>{`
            html, body {
              min-height: 100%;
              min-height: 100dvh;
              width: 100%;
              max-width: 100vw;
              margin: 0;
              background: ${bootTheme.background};
              overflow-x: clip;
              overscroll-behavior-y: none;
            }
            html[data-theme-requested="system"], html[data-theme-requested="system"] body {
              color-scheme: light dark;
            }
          `}</style>
        </Head>
        <body style={{ backgroundColor: bootTheme.background }}>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
