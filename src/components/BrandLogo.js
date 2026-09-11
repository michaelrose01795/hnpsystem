import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ACCENT_PALETTES, useTheme } from "@/styles/themeProvider";

const LIGHT_LOGO_SRC = "/images/logo/Logo.png";
const FALLBACK_ACCENT_PALETTES = {
  red: { light: "#dc2626", dark: "#f87171" },
};

const DEFAULT_TARGET_RGB = {
  light: { r: 220, g: 38, b: 38 },
  dark: { r: 248, g: 113, b: 113 },
};

const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));

// Recolouring is expensive: it decodes the source PNG, walks every pixel and
// re-encodes the result with toDataURL — tens of milliseconds of blocking main
// thread work. The sidebar swaps between the wordmark and the square rail icon
// on every collapse/expand, so without a cache that cost was paid again on each
// toggle, landing exactly on the first frames of the collapse animation. The
// result only depends on (source, mode, target colour), so cache it per tab.
const recolorCache = new Map();
const recolorCacheKey = (baseSrc, mode, targetRgb) =>
  `${baseSrc}|${mode}|${targetRgb.r},${targetRgb.g},${targetRgb.b}`;

const rgbToHsv = (r, g, b) => {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === nr) h = ((ng - nb) / delta) % 6;
    else if (max === ng) h = (nb - nr) / delta + 2;
    else h = (nr - ng) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
};

const isAccentPixel = (r, g, b) => {
  const { h, s, v } = rgbToHsv(r, g, b);
  if (s < 0.2 || v < 0.12) return false;
  const inRedRange = h >= 345 || h <= 22;
  const inPurpleRange = h >= 250 && h <= 330;
  return inRedRange || inPurpleRange;
};

const isDarkNeutralPixel = (r, g, b) => {
  const { s, v } = rgbToHsv(r, g, b);
  return s < 0.18 && v <= 0.55;
};

const recolorLogo = (img, targetRgb, mode) => {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isAccentPixel(r, g, b)) {
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const shade = 0.45 + luminance * 0.9;
      data[i] = clamp(targetRgb.r * shade);
      data[i + 1] = clamp(targetRgb.g * shade);
      data[i + 2] = clamp(targetRgb.b * shade);
      continue;
    }

    // In dark mode, shift dark neutral logo text to white for contrast.
    if (mode === "dark" && isDarkNeutralPixel(r, g, b)) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
};

export default function BrandLogo({
  alt = "H&P logo",
  className = "",
  style,
  width,
  height,
  priority = false,
  sizes,
  quality,
  recolor = true,
  // Base image to recolour. Defaults to the wide wordmark, but callers (e.g. the
  // collapsed sidebar rail) can pass the square desktop icon so it recolours to
  // the active theme accent the same way the wordmark does.
  src: srcProp = LIGHT_LOGO_SRC,
  ...rest
}) {
  // `effectiveAccent` follows any active theme override (e.g. the red /login
  // theme) so the logo recolours to match what is actually on screen — not the
  // user's stored accent preference.
  const { resolvedMode, effectiveAccent } = useTheme();

  const mode = resolvedMode === "dark" ? "dark" : "light";
  const baseSrc = srcProp;

  const targetRgb = useMemo(() => {
    const paletteMap =
      ACCENT_PALETTES && typeof ACCENT_PALETTES === "object" ? ACCENT_PALETTES : FALLBACK_ACCENT_PALETTES;
    const palette = paletteMap[effectiveAccent] || paletteMap.red || FALLBACK_ACCENT_PALETTES.red;
    const hex = mode === "dark" ? palette?.dark : palette?.light;
    const safeHex = String(hex || "").replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(safeHex)) return DEFAULT_TARGET_RGB[mode];
    return {
      r: parseInt(safeHex.slice(0, 2), 16),
      g: parseInt(safeHex.slice(2, 4), 16),
      b: parseInt(safeHex.slice(4, 6), 16),
    };
  }, [effectiveAccent, mode]);

  // Seed from the cache so a remount (e.g. the sidebar swapping the wordmark for
  // the rail icon) paints the already-recoloured image on the FIRST render —
  // no pixel walk, no flash of the un-recoloured source.
  const cacheKey = recolor ? recolorCacheKey(baseSrc, mode, targetRgb) : "";
  const [src, setSrc] = useState(() => (cacheKey && recolorCache.get(cacheKey)) || srcProp);

  useEffect(() => {
    if (!recolor) {
      setSrc(baseSrc);
      return;
    }

    if (typeof window === "undefined") {
      setSrc(baseSrc);
      return;
    }

    const cached = recolorCache.get(cacheKey);
    if (cached) {
      setSrc(cached);
      return;
    }

    const img = new window.Image();
    img.onload = () => {
      const recolored = recolorLogo(img, targetRgb, mode);
      if (recolored) recolorCache.set(cacheKey, recolored);
      setSrc(recolored || baseSrc);
    };
    img.onerror = () => {
      setSrc(baseSrc);
    };
    img.src = baseSrc;
  }, [baseSrc, targetRgb, mode, recolor, cacheKey]);

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      style={style}
      width={width || 881}
      height={height || 270}
      priority={priority}
      sizes={sizes}
      quality={quality}
      {...rest}
    />
  );
}
