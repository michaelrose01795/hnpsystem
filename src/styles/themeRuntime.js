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

// Build the full semantic and legacy token set from the current accent and colour mode.
export const buildThemeRuntime = ({ resolvedMode = "light", accentName = DEFAULT_ACCENT } = {}) => {
  // Resolve the concrete accent colour first so every derived value uses the same base.
  const accentMain = getResolvedAccent(accentName, resolvedMode);

  // Convert the accent to RGB for all alpha-based surfaces and rings.
  const accentRgbObject = hexToRgbObject(accentMain);

  // Store the accent in CSS rgba() string form too.
  const accentRgb = hexToRgbString(accentMain);

  // Reuse white and black anchors for consistent light/dark derivation.
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  // Use the real surface colour as the neutral background we blend back towards.
  const surfaceAnchor = resolvedMode === "dark" ? { r: 22, g: 22, b: 26 } : white;

  // Derive the solid accent hover state from the same behaviour the sidebar/topbar already uses today.
  const accentHover = rgbToHex(
    resolvedMode === "dark" ? blend(accentRgbObject, white, 0.18) : blend(accentRgbObject, black, 0.18)
  );

  // Derive a stronger pressed shade for places that still need a darker accent variant.
  const accentPressed = rgbToHex(
    resolvedMode === "dark" ? blend(accentRgbObject, white, 0.34) : blend(accentRgbObject, black, 0.32)
  );

  // Keep accent surfaces subtle because they are used for rows, cards, panels, and controls.
  const accentSurface = resolvedMode === "dark" ? `rgba(${accentRgb}, 0.16)` : `rgba(${accentRgb}, 0.08)`;

  // Use a clearer hover/selected wash without turning large surfaces into solid colour blocks.
  const accentSurfaceHover = resolvedMode === "dark" ? `rgba(${accentRgb}, 0.24)` : `rgba(${accentRgb}, 0.14)`;

  // Keep a lighter accent wash for cards, highlights, and subtle accents.
  const accentSurfaceSubtle = resolvedMode === "dark" ? `rgba(${accentRgb}, 0.1)` : `rgba(${accentRgb}, 0.05)`;

  // Define the reusable theme colour separately from pressed controls; it is the app-wide accent background.
  const themeColour = resolvedMode === "dark" ? `rgba(${accentRgb}, 0.18)` : `rgba(${accentRgb}, 0.1)`;

  // Define the app-wide hover colour for subtle themed surfaces.
  const themeColourHover = resolvedMode === "dark" ? `rgba(${accentRgb}, 0.26)` : `rgba(${accentRgb}, 0.16)`;

  // Build a stronger accent border for selected and focused states.
  const accentBorderStrong = resolvedMode === "dark" ? `rgba(${accentRgb}, 0.42)` : `rgba(${accentRgb}, 0.32)`;

  // Derive the app shell colour from the accent, matching the sidebar-led shell treatment.
  const shellBackground = rgbToHex(blend(accentRgbObject, surfaceAnchor, resolvedMode === "dark" ? 0.78 : 0.86));

  // Define the neutral surface colours used for cards, panels, and inputs.
  const surfaceMain = resolvedMode === "dark" ? "#16161a" : "#ffffff";

  // Define the hover/raised neutral surface used for interactive neutral elements.
  const surfaceHover = resolvedMode === "dark" ? "#23232b" : "#f7f7f7";

  // Define the muted neutral surface used by sub-panels and inactive backgrounds.
  const surfaceMuted = resolvedMode === "dark" ? "#1d1d24" : "#f3f3f3";

  // Define the main readable text colour for normal surfaces.
  const surfaceText = resolvedMode === "dark" ? "#f8f7ff" : "#0f0f0f";

  // Define the secondary readable text colour for supporting copy.
  const surfaceTextMuted = resolvedMode === "dark" ? "#f2f2ff" : "#1f1f1f";

  // Use accent-coloured text/icons on accent-wash surfaces and controls.
  const accentText = accentMain;

  // Define the contrast text for solid accent fills.
  const onAccentText = resolvedMode === "dark" ? "#0a0a0c" : "#ffffff";

  // Centralise the backdrop colour for overlays and modal scrims.
  const overlayBackdrop = resolvedMode === "dark" ? "rgba(2, 6, 23, 0.72)" : "rgba(15, 23, 42, 0.4)";

  // Provide a softer overlay for inline modal locks and localised dimming.
  const overlayMuted = resolvedMode === "dark" ? "rgba(2, 6, 23, 0.5)" : "rgba(15, 23, 42, 0.24)";

  // Return the entire semantic token set plus compatibility aliases.
  return {
    // Core semantic accent tokens.
    accentMain,
    accentHover,
    accentPressed,
    accentRgb,
    accentText,
    onAccentText,
    accentSurface,
    accentSurfaceHover,
    accentSurfaceSubtle,
    accentBorderStrong,

    // Core semantic neutral surface tokens.
    surfaceMain,
    surfaceHover,
    surfaceMuted,
    surfaceText,
    surfaceTextMuted,
    shellBackground,
    overlayBackdrop,
    overlayMuted,

    // Compatibility aliases that keep older code following the same semantic system.
    legacy: {
      "--primary": accentMain,
      "--primary-hover": accentHover,
      "--primary-pressed": accentPressed,
      "--primary-selected": accentPressed,
      "--accentMainRgb": accentRgb,
      "--accentText": accentText,
      "--text-accent": accentText,
      "--onAccentText": onAccentText,
      "--secondary": accentSurface,
      "--secondary-hover": accentSurfaceHover,
      "--secondary-pressed": resolvedMode === "dark" ? `rgba(${accentRgb}, 0.32)` : `rgba(${accentRgb}, 0.2)`,
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
      "--nav-link-border-active": `1px solid ${accentHover}`,
      "--secondary-border": accentSurfaceHover,
      "--control-border": `1px solid ${accentSurfaceHover}`,
      "--control-border-hover": accentSurfaceHover,
      "--control-border-focus": accentSurfaceHover,
      "--control-ring": `0 0 0 3px rgba(${accentRgb}, ${resolvedMode === "dark" ? "0.18" : "0.12"})`,
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
      "--nav-link-border": `1px solid ${accentHover}`,
      "--search-text": accentPressed,
      "--scrollbar-thumb": accentMain,
      "--scrollbar-thumb-hover": accentHover,
      "--accent-base": accentSurface,
      "--accent-base-rgb": accentRgb,
      "--accent-base-hover": accentSurfaceHover,
      "--theme-hover": themeColourHover,
      "--accent-strong": accentMain,
      "--primary-rgb": accentRgb,
      "--info": resolvedMode === "dark" ? "#f2a3a3" : "#d96f6f",
      "--info-dark": resolvedMode === "dark" ? "#f7bcbc" : "#bf5656",
      "--info-rgb": resolvedMode === "dark" ? "242, 163, 163" : "217, 111, 111",
      "--theme-status": resolvedMode === "dark" ? "rgba(242, 163, 163, 0.26)" : "rgba(217, 111, 111, 0.18)",
      "--accent-purple": accentMain,
      "--accent-purple-rgb": accentRgb,
      "--accent-blue": accentMain,
      "--accent-blue-rgb": accentRgb,
      "--accent-orange": accentMain,
      "--accent-orange-rgb": accentRgb,
    },
  };
};
