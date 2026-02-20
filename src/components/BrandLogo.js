import React, { useEffect, useMemo, useState } from "react";
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

const recolorLogo = (img, targetRgb) => {
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
    if (!isAccentPixel(r, g, b)) continue;

    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const shade = 0.45 + luminance * 0.9;
    data[i] = clamp(targetRgb.r * shade);
    data[i + 1] = clamp(targetRgb.g * shade);
    data[i + 2] = clamp(targetRgb.b * shade);
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
  ...rest
}) {
  const { resolvedMode, accent } = useTheme();
  const [src, setSrc] = useState(() => LIGHT_LOGO_SRC);

  const mode = resolvedMode === "dark" ? "dark" : "light";
  const baseSrc = LIGHT_LOGO_SRC;

  const targetRgb = useMemo(() => {
    const paletteMap =
      ACCENT_PALETTES && typeof ACCENT_PALETTES === "object" ? ACCENT_PALETTES : FALLBACK_ACCENT_PALETTES;
    const palette = paletteMap[accent] || paletteMap.red || FALLBACK_ACCENT_PALETTES.red;
    const hex = mode === "dark" ? palette?.dark : palette?.light;
    const safeHex = String(hex || "").replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(safeHex)) return DEFAULT_TARGET_RGB[mode];
    return {
      r: parseInt(safeHex.slice(0, 2), 16),
      g: parseInt(safeHex.slice(2, 4), 16),
      b: parseInt(safeHex.slice(4, 6), 16),
    };
  }, [accent, mode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setSrc(baseSrc);
      return;
    }

    const img = new window.Image();
    img.onload = () => {
      const recolored = recolorLogo(img, targetRgb);
      setSrc(recolored || baseSrc);
    };
    img.onerror = () => {
      setSrc(baseSrc);
    };
    img.src = baseSrc;
  }, [baseSrc, targetRgb]);

  return <img src={src} alt={alt} className={className} style={style} width={width} height={height} {...rest} />;
}
