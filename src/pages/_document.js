import Document, { Html, Head, Main, NextScript } from "next/document";

const ACCENT_PALETTES = {
  red: { light: "#dc2626", dark: "#f87171" },
  beige: { light: "#d2b48c", dark: "#c2a27b" },
  grey: { light: "#6b7280", dark: "#9ca3af" },
  blue: { light: "#2563eb", dark: "#60a5fa" },
  green: { light: "#16a34a", dark: "#4ade80" },
  yellow: { light: "#ca8a04", dark: "#facc15" },
  pink: { light: "#db2777", dark: "#f472b6" },
  orange: { light: "#ea580c", dark: "#fb923c" },
  purple: { light: "#7c3aed", dark: "#a78bfa" },
};

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

const normalizeMode = (value) => {
  if (value === "dark" || value === "system") return value;
  return "light";
};

const normalizeAccent = (value) => {
  const normalized = String(value || "").toLowerCase();
  return ACCENT_PALETTES[normalized] ? normalized : "red";
};

const blendChannel = (from, to, ratio) => Math.round(from + (to - from) * ratio);
const hexToRgbObj = (hex) => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};
const rgbObjToHex = ({ r, g, b }) =>
  "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");

const getBootTheme = (cookies = {}) => {
  const requestedMode = normalizeMode(cookies["hp-dms-theme"] || "system");
  const resolvedMode = requestedMode === "dark" ? "dark" : "light";
  const accentName = normalizeAccent(cookies["hp-dms-accent"]);
  const accentPalette = ACCENT_PALETTES[accentName] || ACCENT_PALETTES.red;
  const primary = resolvedMode === "dark" ? accentPalette.dark : accentPalette.light;
  // Compute accent layer 3 (page shell background) so html/body bg matches
  const accent = hexToRgbObj(primary);
  const target = resolvedMode === "dark" ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  const ratio = resolvedMode === "dark" ? 0.75 : 0.9;
  const background = rgbObjToHex({
    r: blendChannel(accent.r, target.r, ratio),
    g: blendChannel(accent.g, target.g, ratio),
    b: blendChannel(accent.b, target.b, ratio),
  });
  return { requestedMode, resolvedMode, accentName, primary, background };
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

    const accents = {
      red: { light: "#dc2626", dark: "#f87171" },
      beige: { light: "#d2b48c", dark: "#c2a27b" },
      grey: { light: "#6b7280", dark: "#9ca3af" },
      blue: { light: "#2563eb", dark: "#60a5fa" },
      green: { light: "#16a34a", dark: "#4ade80" },
      yellow: { light: "#ca8a04", dark: "#facc15" },
      pink: { light: "#db2777", dark: "#f472b6" },
      orange: { light: "#ea580c", dark: "#fb923c" },
      purple: { light: "#7c3aed", dark: "#a78bfa" },
    };

    const storedAccent = (window.localStorage.getItem("hp-dms-accent") || readCookie("hp-dms-accent") || "red").toLowerCase();
    const palette = accents[storedAccent] || accents.red;
    const resolvedAccent = resolvedMode === "dark" ? palette.dark : palette.light;
    const hex = resolvedAccent.replace("#", "");
    const rgb =
      /^[0-9a-fA-F]{6}$/.test(hex)
        ? [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
          ].join(", ")
        : "220, 38, 38";

    document.documentElement.style.setProperty("--primary", resolvedAccent);
    document.documentElement.style.setProperty("--primary-light", resolvedAccent);
    document.documentElement.style.setProperty("--primary-dark", resolvedAccent);
    document.documentElement.style.setProperty("--primary-rgb", rgb);
    document.documentElement.style.setProperty("--search-text", resolvedAccent);
    document.documentElement.style.setProperty("--accent-blue", resolvedAccent);
    document.documentElement.style.setProperty("--accent-orange", resolvedAccent);
    document.documentElement.style.setProperty("--accent-purple", resolvedAccent);
    document.documentElement.style.setProperty("--accent-purple-rgb", rgb);
    document.documentElement.style.setProperty("--scrollbar-thumb", resolvedAccent);
    // Compute accent layer 3 for html/body background so mobile overscroll areas match
    var blendCh = function(f,t,r){ return Math.round(f+(t-f)*r); };
    var hexToR = function(h){ h=h.replace("#",""); return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}; };
    var toHex2 = function(o){ return "#"+[o.r,o.g,o.b].map(function(c){return c.toString(16).padStart(2,"0");}).join(""); };
    var ac = hexToR(resolvedAccent);
    var tgt = resolvedMode === "dark" ? {r:0,g:0,b:0} : {r:255,g:255,b:255};
    var ratio = resolvedMode === "dark" ? 0.75 : 0.9;
    var shellBg = toHex2({r:blendCh(ac.r,tgt.r,ratio),g:blendCh(ac.g,tgt.g,ratio),b:blendCh(ac.b,tgt.b,ratio)});
    document.documentElement.style.backgroundColor = shellBg;
    document.body.style.backgroundColor = shellBg;
    var tm = document.querySelector('meta[name="theme-color"]');
    if (tm) tm.setAttribute("content", shellBg);

    document.cookie = "hp-dms-theme=" + encodeURIComponent(mode) + "; path=/; max-age=31536000; samesite=lax";
    document.cookie = "hp-dms-accent=" + encodeURIComponent(storedAccent) + "; path=/; max-age=31536000; samesite=lax";

  } catch (_) {
    // Keep app boot resilient: startup script should never block render.
  }
})();
`;

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
