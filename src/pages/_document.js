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
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) return { r: 220, g: 38, b: 38 };
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
    var accentSurface = resolvedMode === "dark" ? "rgba(" + accentRgb + ", 0.22)" : "rgba(" + accentRgb + ", 0.14)";
    var accentSurfaceHover = resolvedMode === "dark" ? "rgba(" + accentRgb + ", 0.3)" : "rgba(" + accentRgb + ", 0.22)";
    var accentSurfaceSubtle = resolvedMode === "dark" ? "rgba(" + accentRgb + ", 0.16)" : "rgba(" + accentRgb + ", 0.08)";
    var accentBorder = resolvedMode === "dark" ? "rgba(" + accentRgb + ", 0.28)" : "rgba(" + accentRgb + ", 0.18)";
    var accentBorderStrong = resolvedMode === "dark" ? "rgba(" + accentRgb + ", 0.42)" : "rgba(" + accentRgb + ", 0.32)";
    var shellBackground = rgbToHex(blend(accentRgbObject, surfaceAnchor, resolvedMode === "dark" ? 0.78 : 0.86));
    var borderTone = rgbToHex(resolvedMode === "dark" ? blend(accentRgbObject, white, 0.45) : blend(accentRgbObject, black, 0.22));
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
        "--accentMain": resolvedAccent,
        "--accentHover": accentHover,
        "--accentPressed": accentPressed,
        "--accentMainRgb": accentRgb,
        "--accentText": resolvedAccent,
        "--onAccentText": onAccentText,
        "--accentSurface": accentSurface,
        "--accentSurfaceHover": accentSurfaceHover,
        "--accentSurfaceSubtle": accentSurfaceSubtle,
        "--accentBorder": accentBorder,
        "--accentBorderStrong": accentBorderStrong,
        "--surfaceMain": surfaceMain,
        "--surfaceHover": surfaceHover,
        "--surfaceMutedToken": surfaceMuted,
        "--surfaceText": surfaceText,
        "--surfaceTextMuted": surfaceTextMuted,
        "--surface": surfaceMain,
        "--surface-rgb": hexToRgbString(surfaceMain),
        "--surface-light": surfaceHover,
        "--surface-muted": surfaceMuted,
        "--text-primary": surfaceText,
        "--text-primary-rgb": hexToRgbString(surfaceText),
        "--text-secondary": surfaceTextMuted,
        "--text-secondary-rgb": hexToRgbString(surfaceTextMuted),
        "--text-inverse": onAccentText,
        "--text-inverse-rgb": hexToRgbString(onAccentText),
        "--border": borderTone,
        "--overlay": overlayBackdrop,
        "--overlay-muted": overlayMuted,
        "--page-shell-bg": shellBackground,
        "--nav-shell-bg": accentSurface,
        "--page-accent-layer": accentSurface,
        "--page-card-bg": surfaceMain,
        "--page-card-bg-alt": accentSurfaceSubtle,
        "--section-card-bg": surfaceMain,
        "--tab-container-bg": accentSurface,
        "--nav-link-bg": accentSurface,
        "--nav-link-bg-hover": accentSurfaceHover,
        "--nav-link-bg-active": resolvedAccent,
        "--nav-link-border": "1px solid " + accentBorder,
        "--nav-link-border-active": "1px solid " + accentBorderStrong,
        "--control-bg": accentSurface,
        "--control-bg-hover": accentSurfaceHover,
        "--control-bg-active": accentSurfaceHover,
        "--control-border-color": accentBorder,
        "--control-border": "1px solid " + accentBorder,
        "--control-border-hover": accentBorderStrong,
        "--control-border-focus": accentBorderStrong,
        "--control-ring": "0 0 0 3px rgba(" + accentRgb + ", " + (resolvedMode === "dark" ? "0.18" : "0.12") + ")",
        "--control-menu-bg": surfaceMain,
        "--control-menu-shadow": "none",
        "--control-muted-text": "rgba(" + hexToRgbString(surfaceTextMuted) + ", " + (resolvedMode === "dark" ? "0.76" : "0.78") + ")",
        "--control-icon": "rgba(" + hexToRgbString(surfaceTextMuted) + ", " + (resolvedMode === "dark" ? "0.84" : "0.82") + ")",
        "--row-background": surfaceMain,
        "--section-gradient-outer": accentSurfaceHover,
        "--section-gradient-inner": accentSurface,
        "--section-gradient-center": surfaceMain,
        "--layer-gradient": accentSurface,
        "--layer-section-level-1": accentSurfaceSubtle,
        "--layer-section-level-2": accentSurface,
        "--layer-section-level-3": accentSurfaceHover,
        "--layer-section-level-4": resolvedAccent,
        "--profile-table-surface": accentSurface,
        "--profile-table-alt-surface": accentSurfaceHover,
        "--search-surface": resolvedMode === "dark" ? "#2a2a32" : surfaceMain,
        "--search-surface-muted": resolvedMode === "dark" ? "#3a3a42" : surfaceHover,
        "--search-text": accentPressed,
        "--scrollbar-thumb": resolvedAccent,
        "--scrollbar-thumb-hover": accentHover,
        "--accent-base": accentSurface,
        "--accent-base-rgb": accentRgb,
        "--accent-surface": accentSurfaceSubtle,
        "--accent-base-hover": accentSurfaceHover,
        "--accent-surface-hover": accentSurface,
        "--accent-strong": resolvedAccent,
        "--primary": resolvedAccent,
        "--primary-light": accentHover,
        "--primary-dark": accentPressed,
        "--primary-rgb": accentRgb,
        "--info": resolvedAccent,
        "--info-dark": accentPressed,
        "--info-surface": accentSurfaceSubtle,
        "--info-rgb": accentRgb,
        "--accent-purple": resolvedAccent,
        "--accent-purple-surface": accentSurfaceSubtle,
        "--accent-purple-rgb": accentRgb,
        "--accent-blue": resolvedAccent,
        "--accent-blue-surface": accentSurfaceSubtle,
        "--accent-blue-rgb": accentRgb,
        "--accent-orange": resolvedAccent,
        "--accent-orange-surface": accentSurfaceSubtle,
        "--accent-orange-rgb": accentRgb
      }
    };
  })()`;
}

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    const cookies = parseCookieHeader(ctx?.req?.headers?.cookie || "");
    return {
      ...initialProps,
      bootTheme: getBootTheme(cookies),
      hasAuthCookie: hasAuthenticatedCookie(cookies),
    };
  }

  render() {
    const bootTheme = this.props.bootTheme || getBootTheme({});

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
