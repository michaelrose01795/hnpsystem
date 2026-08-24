// file location: src/styles/themeRuntime.js
// Shared runtime helpers for deriving the app's semantic colour tokens from the selected mode and accent.

// Persisted accent choices that users can select from the profile theme controls.
export const ACCENT_PALETTES = {
  red: { label: "Red", light: "#b91c1c", dark: "#f87171" },
  beige: { label: "Stone", light: "#78716c", dark: "#a8a29e" },
  grey: { label: "Slate", light: "#475569", dark: "#94a3b8" },
  blue: { label: "Blue", light: "#2563eb", dark: "#60a5fa" },
  green: { label: "Green", light: "#15803d", dark: "#4ade80" },
  yellow: { label: "Amber", light: "#b45309", dark: "#fbbf24" },
  pink: { label: "Pink", light: "#be185d", dark: "#f472b6" },
  orange: { label: "Orange", light: "#c2410c", dark: "#fb923c" },
  purple: { label: "Purple", light: "#6d28d9", dark: "#a78bfa" },
};

// The default accent used when nothing valid has been stored yet.
export const DEFAULT_ACCENT = "red";

// The default theme mode used during initial boot.
export const DEFAULT_MODE = "system";

// Convert a hex colour into a numeric RGB object so we can blend and derive related tones.
export const hexToRgbObject = (hexColor) => {
  // Remove the hash so the parser can work with the raw six-character hex value.
  const hex = String(hexColor || "").replace("#", "");

  // Fall back to the app's default accent red when the input is malformed.
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return { r: 185, g: 28, b: 28 };
  }

  // Return the parsed red, green, and blue channels.
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
};

// Convert a hex colour into the comma-separated RGB string format used by CSS rgba() variables.
export const hexToRgbString = (hexColor) => {
  // Parse the colour into channels first.
  const rgb = hexToRgbObject(hexColor);

  // Return the CSS-ready RGB string.
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
};

// Keep channel values within the legal 0-255 range before serialising them back to hex.
export const clampChannel = (value) => Math.max(0, Math.min(255, Math.round(value)));

// Convert an RGB object back into a hex colour string.
export const rgbToHex = (rgb) =>
  `#${[rgb.r, rgb.g, rgb.b]
    .map((value) => clampChannel(value).toString(16).padStart(2, "0"))
    .join("")}`;

// Blend two RGB colours together by the supplied ratio.
export const blend = (from, to, ratio = 0.5) => {
  // Clamp the ratio so callers cannot accidentally overshoot either colour.
  const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));

  // Return the blended colour channels.
  return {
    r: from.r * (1 - safeRatio) + to.r * safeRatio,
    g: from.g * (1 - safeRatio) + to.g * safeRatio,
    b: from.b * (1 - safeRatio) + to.b * safeRatio,
  };
};

// Only allow the three supported theme modes.
export const normalizeMode = (value) => {
  // Preserve system and dark explicitly.
  if (value === "system" || value === "dark") return value;

  // Treat everything else as light to keep behaviour predictable.
  return "light";
};

// Accept historic boolean DB values and convert them into the new string-based theme modes.
export const normalizeDbMode = (value) => {
  // Empty values mean "follow system".
  if (value === null || typeof value === "undefined" || value === "") {
    return DEFAULT_MODE;
  }

  // Older rows may still be stored as booleans.
  if (typeof value === "boolean") {
    return value ? "dark" : "light";
  }

  // Normalise string values through the same mode validator.
  return normalizeMode(value);
};

// Only allow stored accents that are present in the supported palette list.
export const normalizeAccent = (value) => {
  // Default immediately when the input is missing.
  if (!value || typeof value !== "string") return DEFAULT_ACCENT;

  // Compare the lower-cased accent name against the supported palette map.
  const normalized = value.toLowerCase();

  // Return the requested accent when it exists, otherwise use red.
  return ACCENT_PALETTES[normalized] ? normalized : DEFAULT_ACCENT;
};

// Resolve the concrete accent hex colour for the requested accent and current colour mode.
export const getResolvedAccent = (accentName, resolvedMode) => {
  // Load the selected palette or safely fall back to red.
  const palette = ACCENT_PALETTES[normalizeAccent(accentName)] || ACCENT_PALETTES[DEFAULT_ACCENT];

  // Use the dark swatch in dark mode and the light swatch otherwise.
  return resolvedMode === "dark" ? palette.dark : palette.light;
};


// ---------------------------------------------------------------------------
// buildThemeTokens - THE single derivation of every accent/surface token.
// ---------------------------------------------------------------------------
// This function is deliberately SELF-CONTAINED: every helper it needs is
// declared inside its own body and it closes over nothing. That is what lets
// src/pages/_document.js serialise it with `.toString()` and run the exact same
// code in the pre-hydration boot script.
//
// Before this existed there were three hand-maintained copies of the
// derivation (here, _document.js, and the static blocks in theme.css) and they
// had already drifted apart: the boot script painted a visible
// --primary-border, undid the softened --ghostbutton-ring and dropped
// --control-menu-shadow, so the first paint showed accent hairlines that
// vanished again on hydration.
//
// RULES FOR EDITING:
//   - Do not reference anything outside this function. One external reference
//     silently breaks the first paint.
//   - Keep the values in step with the static :root and
//     :root[data-theme="dark"] blocks in src/styles/theme.css, which are the
//     no-JS fallback.
export function buildThemeTokens(resolvedMode, accentMain) {
  const isDark = resolvedMode === "dark";

  // -- colour helpers (inlined on purpose; see RULES above) -----------------
  const toRgb = (hexColor) => {
    const hex = String(hexColor || "").replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return { r: 185, g: 28, b: 28 };
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  };
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
  const toHex = (rgb) =>
    "#" + [rgb.r, rgb.g, rgb.b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
  const mix = (from, to, ratio) => {
    const r = Math.max(0, Math.min(1, Number(ratio) || 0));
    return {
      r: from.r * (1 - r) + to.r * r,
      g: from.g * (1 - r) + to.g * r,
      b: from.b * (1 - r) + to.b * r,
    };
  };

  const accent = toRgb(accentMain);
  const accentRgb = accent.r + ", " + accent.g + ", " + accent.b;
  const alpha = (a) => "rgba(" + accentRgb + ", " + a + ")";

  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  // -- neutral surfaces ----------------------------------------------------
  const surfaceMain = isDark ? "#16161a" : "#ffffff";
  const surfaceObject = toRgb(surfaceMain);
  const surfaceRgb = surfaceObject.r + ", " + surfaceObject.g + ", " + surfaceObject.b;
  const surfaceHover = isDark ? "#23232b" : "#f7f7f7";
  const surfaceMuted = isDark ? "#1d1d24" : "#f3f3f3";
  const surfaceText = isDark ? "#f8f7ff" : "#0f0f0f";
  const surfaceTextMuted = isDark ? "#f2f2ff" : "#1f1f1f";
  const textObject = toRgb(surfaceText);
  const surfaceTextRgb = textObject.r + ", " + textObject.g + ", " + textObject.b;
  const textAlpha = (a) => "rgba(" + surfaceTextRgb + ", " + a + ")";

  const accentHover = toHex(isDark ? mix(accent, white, 0.18) : mix(accent, black, 0.18));
  const accentPressed = toHex(isDark ? mix(accent, white, 0.34) : mix(accent, black, 0.32));

  // The accent as a LABEL on an accent-tinted fill (Secondary / Ghost / Theme
  // buttons, chips on a theme layer). The plain accent clears 4.5:1 on a plain
  // card, but the tint under it eats 0.3-0.6 of that, which dropped the
  // low-chroma accents (Stone, Blue, Green, Amber, Orange) to 3.9-4.4:1. This
  // pushes the label away from the ground it sits on - darker in light mode,
  // lighter in dark - so every accent clears 4.5:1 on the tint too.
  const accentOnTint = toHex(isDark ? mix(accent, white, 0.22) : mix(accent, black, 0.22));

  // -- the surface ladder --------------------------------------------------
  // The same alpha over white gives roughly HALF the perceptual (CIE dL*) step
  // it gives over near-black, so light mode cannot reuse dark's alphas. These
  // pairs are tuned so both themes land on the same dL* per rung:
  //   theme layer on a card   light .16 -> 10.6   dark .18 -> 11.0
  //   control fill on a card  light .14 ->  9.2   dark .16 ->  9.9
  //   hover step from rest    light .22 ->  5.0   dark .24 ->  4.8
  //   pressed step from rest  light .30 ->  9.0   dark .32 ->  9.6
  // The two columns are SUPPOSED to differ. Matching the numbers un-matches
  // the look, which is how light mode ended up flat in the first place. The
  // figures are for the red accent; the low-chroma accents (Stone, Slate)
  // produce the smallest steps and are what these alphas are sized for.
  const accentSurface = isDark ? alpha(0.16) : alpha(0.14);
  const accentSurfaceHover = isDark ? alpha(0.24) : alpha(0.22);
  const accentSurfacePressed = isDark ? alpha(0.32) : alpha(0.3);
  const themeColour = isDark ? alpha(0.18) : alpha(0.16);
  const themeColourHover = isDark ? alpha(0.26) : alpha(0.24);

  // App background behind the page card. An opaque blend rather than an alpha
  // wash, so it stays a fixed plane regardless of what sits behind the root.
  const shellBackground = toHex(mix(accent, surfaceObject, isDark ? 0.78 : 0.74));

  // Controls sitting ON a theme layer take the surface fill and step back
  // towards the accent on hover/active. No single accent-alpha fill can
  // separate from both a --surface card and a --theme layer: at .12 on a .16
  // tint the step is only dL* 2.7.
  const controlOnThemeHover = toHex(mix(surfaceObject, accent, 0.12));
  const controlOnThemeActive = toHex(mix(surfaceObject, accent, 0.2));

  const onAccentText = isDark ? "#0a0a0c" : "#ffffff";
  const onAccentObject = toRgb(onAccentText);
  const overlayBackdrop = isDark ? "rgba(2, 6, 23, 0.72)" : "rgba(15, 23, 42, 0.4)";
  const overlayMuted = isDark ? "rgba(2, 6, 23, 0.5)" : "rgba(15, 23, 42, 0.24)";

  // Ring tokens come in pairs: a bare COLOUR and a full border SHORTHAND.
  // Writing "1px solid var(--input-ring-color)" expands to "1px solid 1px solid ..."
  // which is invalid CSS and drops the ring entirely - use the -color token
  // when you are writing your own width and style.
  // (Kept free of backticks: this whole function is serialised into the
  // first-paint boot script in src/pages/_document.js.)
  const inputRingColor = accentSurfaceHover;
  const checkboxRingColor = accentMain;
  const ghostRingColor = isDark ? alpha(0.45) : alpha(0.35);
  const separatingLineColor = isDark ? alpha(0.2) : alpha(0.14);
  const focusRing = "0 0 0 3px " + alpha(isDark ? 0.18 : 0.12);
  const controlMenuShadow =
    "0 0 0 1px " + alpha(0.18) + ", 0 0 32px " + alpha(0.22) + ", 0 0 12px rgba(0, 0, 0, 0.1)";

  return {
    accentMain: accentMain,
    accentRgb: accentRgb,
    shellBackground: shellBackground,
    legacy: {
      "--primary": accentMain,
      "--primary-hover": accentHover,
      "--primary-pressed": accentPressed,
      "--primary-selected": accentPressed,
      "--accentMainRgb": accentRgb,
      "--accentText": accentMain,
      "--text-accent": accentMain,
      "--onAccentText": onAccentText,
      "--secondary": accentSurface,
      "--secondary-hover": accentSurfaceHover,
      "--secondary-pressed": accentSurfacePressed,
      "--theme": themeColour,
      "--theme-hover": themeColourHover,
      "--primary-border": "transparent",
      "--surfaceHover": surfaceHover,
      "--surfaceMutedToken": surfaceMuted,
      "--surfaceText": surfaceText,
      "--surfaceTextMuted": surfaceTextMuted,
      "--surface": surfaceMain,
      "--surface-rgb": surfaceRgb,
      "--text-1": surfaceText,
      "--text-1-rgb": surfaceTextRgb,
      "--text-2": onAccentText,
      "--text-2-rgb": onAccentObject.r + ", " + onAccentObject.g + ", " + onAccentObject.b,
      "--overlay": overlayBackdrop,
      "--overlay-muted": overlayMuted,
      "--page-shell-bg": shellBackground,
      "--nav-shell-bg": accentSurface,
      "--page-card-bg": surfaceMain,
      // Second rung of the ladder - alternates away from the page card above.
      "--section-card-bg": themeColour,
      "--nav-link-border": "none",
      "--nav-link-border-active": "none",
      "--secondary-border": "transparent",
      "--control-border": "none",
      "--input-ring-color": inputRingColor,
      "--input-ring": "1px solid " + inputRingColor,
      "--input-border": "1px solid " + inputRingColor,
      "--checkbox-ring-color": checkboxRingColor,
      "--checkbox-ring": "2px solid " + checkboxRingColor,
      "--ghostbutton-ring-color": ghostRingColor,
      "--ghostbutton-ring": "1px solid " + ghostRingColor,
      "--separating-line-color": separatingLineColor,
      "--separating-line": "1px solid " + separatingLineColor,
      "--table-border": "1px solid " + separatingLineColor,
      "--focus-ring": focusRing,
      "--control-ring": focusRing,
      "--control-border-hover": accentSurfaceHover,
      "--control-border-focus": accentSurfaceHover,
      "--control-on-theme-bg": surfaceMain,
      "--control-on-theme-bg-hover": controlOnThemeHover,
      "--control-on-theme-bg-active": controlOnThemeActive,
      "--accent-text-on-tint": accentOnTint,
      "--control-disabled-bg": textAlpha(0.07),
      "--control-disabled-text": textAlpha(0.55),
      "--toggle-track-off": textAlpha(0.25),
      "--input-placeholder": textAlpha(0.6),
      "--textfieldbackground": textAlpha(0.6),
      "--toggle-knob": isDark ? textAlpha(0.88) : "#ffffff",
      "--control-menu-shadow": controlMenuShadow,
      "--tab-container-bg": accentSurface,
      "--tab-item-bg": accentSurface,
      "--tab-item-bg-hover": accentSurfaceHover,
      "--tab-item-text": surfaceText,
      "--row-background": surfaceMain,
      "--section-gradient-outer": accentSurfaceHover,
      "--section-gradient-inner": accentSurface,
      "--section-gradient-center": surfaceMain,
      "--layer-gradient": accentSurface,
      "--profile-table-surface": accentSurface,
      "--profile-table-alt-surface": accentSurfaceHover,
      "--search-surface": isDark ? "#2a2a32" : surfaceMain,
      "--search-surface-muted": surfaceMain,
      "--search-text": accentPressed,
      "--scrollbar-thumb": accentMain,
      "--scrollbar-thumb-hover": accentHover,
      "--accent-base": accentSurface,
      "--accent-base-rgb": accentRgb,
      "--accent-base-hover": accentSurfaceHover,
      "--accent-strong": accentMain,
      "--primary-rgb": accentRgb,
      "--info": isDark ? "#f2a3a3" : "#d96f6f",
      "--info-dark": isDark ? "#f7bcbc" : "#bf5656",
      "--info-rgb": isDark ? "242, 163, 163" : "217, 111, 111",
      "--theme-status": isDark ? "rgba(242, 163, 163, 0.26)" : "rgba(217, 111, 111, 0.18)",
      "--accent-purple": accentMain,
      "--accent-purple-rgb": accentRgb,
      "--accent-orange": accentMain,
      "--accent-orange-rgb": accentRgb,
    },
  };
}

// Build the full semantic and legacy token set from the current accent and colour mode.
export const buildThemeRuntime = ({ resolvedMode = "light", accentName = DEFAULT_ACCENT } = {}) =>
  buildThemeTokens(resolvedMode, getResolvedAccent(accentName, resolvedMode));
