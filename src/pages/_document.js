// file location: src/pages/_document.js
// Custom Next.js document that boots the shared semantic theme tokens before React hydrates.

import Document, { Html, Head, Main, NextScript } from "next/document";
import { ACCENT_PALETTES, DEFAULT_ACCENT, buildThemeRuntime, normalizeAccent, normalizeMode } from "@/styles/themeRuntime";

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

const getBootTheme = (cookies = {}) => {
  // Resolve the requested theme mode from cookies first.
  const requestedMode = normalizeMode(cookies["hp-dms-theme"] || "system");

  // Resolve the server-side boot mode conservatively so initial HTML remains deterministic.
  const resolvedMode = requestedMode === "dark" ? "dark" : "light";

  // Resolve the stored accent with the shared runtime validator.
  const accentName = normalizeAccent(cookies["hp-dms-accent"] || DEFAULT_ACCENT);

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

// Detect phone-class user agents so we can emit a fit-to-width viewport that loads zoomed out.
const isPhoneUserAgent = (userAgent = "") => /Android.+Mobile|iPhone|iPod|Mobile.+Firefox|BlackBerry|IEMobile|Opera Mini/i.test(String(userAgent));

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
    const palette = accents[storedAccent] || accents["${DEFAULT_ACCENT}"];
    const resolvedAccent = resolvedMode === "dark" ? palette.dark : palette.light;
    const runtime = ${buildClientRuntimeExpression()};

    Object.entries(runtime.legacy).forEach(([token, value]) => {
      document.documentElement.style.setProperty(token, value);
    });

    document.documentElement.style.backgroundColor = runtime.shellBackground;
    if (document.body) document.body.style.backgroundColor = runtime.shellBackground;
    var tm = document.querySelector('meta[name="theme-color"]');
    if (tm) tm.setAttribute("content", runtime.shellBackground);

    document.cookie = "hp-dms-theme=" + encodeURIComponent(mode) + "; path=/; max-age=31536000; samesite=lax";
    document.cookie = "hp-dms-accent=" + encodeURIComponent(storedAccent) + "; path=/; max-age=31536000; samesite=lax";

  } catch (_) {
    // Keep app boot resilient: startup script should never block render.
  }
})();
`;

function buildClientRuntimeExpression() {
  // Return a small self-contained expression that reproduces the shared runtime helper in the boot script.
  return `(function() {
    var hexToRgbObject = function(hexColor) {
      var hex = String(hexColor || "").replace("#", "");
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) return { r: 185, g: 28, b: 28 };
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    };
    var hexToRgbString = function(hexColor) {
      var rgb = hexToRgbObject(hexColor);
      return rgb.r + ", " + rgb.g + ", " + rgb.b;
    };
    var clampChannel = function(value) {
      return Math.max(0, Math.min(255, Math.round(value)));
    };
    var rgbToHex = function(rgb) {
      return "#" + [rgb.r, rgb.g, rgb.b].map(function(value) {
        return clampChannel(value).toString(16).padStart(2, "0");
      }).join("");
    };
    var blend = function(from, to, ratio) {
      var safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
      return {
        r: from.r * (1 - safeRatio) + to.r * safeRatio,
        g: from.g * (1 - safeRatio) + to.g * safeRatio,
        b: from.b * (1 - safeRatio) + to.b * safeRatio,
      };
    };
    var accentRgbObject = hexToRgbObject(resolvedAccent);
    var accentRgb = hexToRgbString(resolvedAccent);
    var white = { r: 255, g: 255, b: 255 };
    var black = { r: 0, g: 0, b: 0 };
    var surfaceAnchor = resolvedMode === "dark" ? { r: 22, g: 22, b: 26 } : white;
    var accentHover = rgbToHex(resolvedMode === "dark" ? blend(accentRgbObject, white, 0.18) : blend(accentRgbObject, black, 0.18));
    var accentPressed = rgbToHex(resolvedMode === "dark" ? blend(accentRgbObject, white, 0.34) : blend(accentRgbObject, black, 0.32));
    var accentSurface = resolvedMode === "dark" ? "rgba(" + accentRgb + ", 0.16)" : "rgba(" + accentRgb + ", 0.08)";
    var accentSurfaceHover = resolvedMode === "dark" ? "rgba(" + accentRgb + ", 0.24)" : "rgba(" + accentRgb + ", 0.14)";
    var themeColour = resolvedMode === "dark" ? "rgba(" + accentRgb + ", 0.18)" : "rgba(" + accentRgb + ", 0.1)";
    var themeColourHover = resolvedMode === "dark" ? "rgba(" + accentRgb + ", 0.26)" : "rgba(" + accentRgb + ", 0.16)";
    var shellBackground = rgbToHex(blend(accentRgbObject, surfaceAnchor, resolvedMode === "dark" ? 0.78 : 0.86));
    var surfaceMain = resolvedMode === "dark" ? "#16161a" : "#ffffff";
    var surfaceHover = resolvedMode === "dark" ? "#23232b" : "#f7f7f7";
    var surfaceMuted = resolvedMode === "dark" ? "#1d1d24" : "#f3f3f3";
    var surfaceText = resolvedMode === "dark" ? "#f8f7ff" : "#0f0f0f";
    var surfaceTextMuted = resolvedMode === "dark" ? "#f2f2ff" : "#1f1f1f";
    var onAccentText = resolvedMode === "dark" ? "#0a0a0c" : "#ffffff";
    var overlayBackdrop = resolvedMode === "dark" ? "rgba(2, 6, 23, 0.72)" : "rgba(15, 23, 42, 0.4)";
    var overlayMuted = resolvedMode === "dark" ? "rgba(2, 6, 23, 0.5)" : "rgba(15, 23, 42, 0.24)";
    return {
      shellBackground: shellBackground,
      legacy: {
        "--primary": resolvedAccent,
        "--primary-hover": accentHover,
        "--primary-pressed": accentPressed,
        "--primary-selected": accentPressed,
        "--accentMainRgb": accentRgb,
        "--accentText": resolvedAccent,
        "--text-accent": resolvedAccent,
        "--onAccentText": onAccentText,
        "--secondary": accentSurface,
        "--secondary-hover": accentSurfaceHover,
        "--secondary-pressed": resolvedMode === "dark" ? "rgba(" + accentRgb + ", 0.32)" : "rgba(" + accentRgb + ", 0.2)",
        "--theme": themeColour,
        "--primary-border": accentHover,
        "--surfaceHover": surfaceHover,
        "--surfaceMutedToken": surfaceMuted,
        "--surfaceText": surfaceText,
        "--surfaceTextMuted": surfaceTextMuted,
        "--surface": surfaceMain,
        "--surface-rgb": hexToRgbString(surfaceMain),
        "--text-1": surfaceText,
        "--text-1-rgb": hexToRgbString(surfaceText),
        "--text-2": onAccentText,
        "--text-2-rgb": hexToRgbString(onAccentText),
        "--overlay": overlayBackdrop,
        "--overlay-muted": overlayMuted,
        "--page-shell-bg": shellBackground,
        "--nav-shell-bg": accentSurface,
        "--page-card-bg": surfaceMain,
        "--section-card-bg": surfaceMain,
        "--nav-link-border-active": "1px solid " + accentHover,
        "--secondary-border": accentSurfaceHover,
        "--control-border": "1px solid " + accentSurfaceHover,
        "--control-border-hover": accentSurfaceHover,
        "--control-border-focus": accentSurfaceHover,
        "--control-ring": "0 0 0 3px rgba(" + accentRgb + ", " + (resolvedMode === "dark" ? "0.18" : "0.12") + ")",
        "--control-menu-shadow": "none",
        "--row-background": surfaceMain,
        "--section-gradient-outer": accentSurfaceHover,
        "--section-gradient-inner": accentSurface,
        "--section-gradient-center": surfaceMain,
        "--layer-gradient": accentSurface,
        "--profile-table-surface": accentSurface,
        "--profile-table-alt-surface": accentSurfaceHover,
        "--search-surface": resolvedMode === "dark" ? "#2a2a32" : surfaceMain,
        "--search-surface-muted": surfaceMain,
        "--nav-link-border": "1px solid " + accentHover,
        "--search-text": accentPressed,
        "--scrollbar-thumb": resolvedAccent,
        "--scrollbar-thumb-hover": accentHover,
        "--accent-base": accentSurface,
        "--accent-base-rgb": accentRgb,
        "--accent-base-hover": accentSurfaceHover,
        "--theme-hover": themeColourHover,
        "--accent-strong": resolvedAccent,
        "--primary-rgb": accentRgb,
        "--info": resolvedMode === "dark" ? "#f2a3a3" : "#d96f6f",
        "--info-dark": resolvedMode === "dark" ? "#f7bcbc" : "#bf5656",
        "--info-rgb": resolvedMode === "dark" ? "242, 163, 163" : "217, 111, 111",
        "--theme-status": resolvedMode === "dark" ? "rgba(242, 163, 163, 0.26)" : "rgba(217, 111, 111, 0.18)",
        "--accent-purple": resolvedAccent,
        "--accent-purple-rgb": accentRgb,
        "--accent-blue": resolvedAccent,
        "--accent-blue-rgb": accentRgb,
        "--accent-orange": resolvedAccent,
        "--accent-orange-rgb": accentRgb
      }
    };
  })()`;
}

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    const cookies = parseCookieHeader(ctx?.req?.headers?.cookie || "");
    // Sniff the UA so phone clients get a zoomed-out viewport from the first paint.
    const userAgent = ctx?.req?.headers?.["user-agent"] || "";
    return {
      ...initialProps,
      bootTheme: getBootTheme(cookies),
      hasAuthCookie: hasAuthenticatedCookie(cookies),
      isPhone: isPhoneUserAgent(userAgent),
    };
  }

  render() {
    const bootTheme = this.props.bootTheme || getBootTheme({});
    // Phones render the desktop layout scaled to fit; other devices keep the standard viewport.
    const viewportContent = this.props.isPhone
      ? "width=1280, initial-scale=1, viewport-fit=cover"
      : "width=device-width, initial-scale=1, viewport-fit=cover";

    return (
      <Html
        data-theme={bootTheme.resolvedMode}
        data-theme-requested={bootTheme.requestedMode}
        data-authenticated={this.props.hasAuthCookie ? "true" : "false"}
        style={{ backgroundColor: bootTheme.background, colorScheme: bootTheme.resolvedMode }}
      >
        <Head>
          <meta name="viewport" content={viewportContent} />
          <meta name="theme-color" content={bootTheme.background} />
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
              margin: 0;
              background: ${bootTheme.background};
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
