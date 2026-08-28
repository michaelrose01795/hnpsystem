#!/usr/bin/env node
// file location: tools/scripts/check-colour-system.js
//
// Colour-system guard (2026-08 colour audit).
//
// The staff UI is borderless by design, so the ONLY thing separating a card
// from its page, a control from its card, or a hover from a rest state is the
// colour step between them. That makes those steps load-bearing, and it makes
// them easy to break silently: a plausible-looking alpha tweak can halve a
// step without anyone noticing until a user says "the buttons disappeared".
//
// This script resolves the real token values through the shared derivation in
// src/styles/themeRuntime.js — the same function that paints the app and the
// first paint — composites every translucent layer onto the layer beneath it,
// and asserts two floors:
//
//   SEPARATION  measured in CIE dL* (perceptual lightness), because contrast
//               ratio is the wrong tool for large adjacent fills. A borderless
//               surface step needs dL* >= 6 to read as a distinct plane; a
//               hover step needs >= 3.5 to register as feedback.
//
//   CONTRAST    standard WCAG ratio, 4.5:1, for every text-on-fill pairing the
//               design system actually produces.
//
// Both run for all 9 selectable accents x light and dark. The low-chroma
// accents (Stone, Slate) are the binding constraint in light mode — an alpha
// that looks fine on the red accent can fail on those.
//
// Run: npm run check:colours
const fs = require("fs");
const vm = require("vm");

const src = fs
  .readFileSync("src/styles/themeRuntime.js", "utf8")
  .replace(/export (const|function)/g, "$1");
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(src + "\nthis.o={buildThemeRuntime,ACCENT_PALETTES};", ctx);
const { buildThemeRuntime, ACCENT_PALETTES } = ctx.o;

// theme.css status ramps (not part of the runtime derivation).
const STATUS = {
  light: {
    "success-base": "#15803d", "success-strong": "#14532d", "success-surface": "#dcfce7",
    "warning-base": "#b45309", "warning-strong": "#92400e", "warning-surface": "#fef3c7",
    "danger-base": "#c62b2b", "danger-strong": "#b91c1c", "danger-surface": "#fee2e2",
    "authorised-base": "#047857", "authorised-strong": "#024a37", "authorised-surface": "#d1fae5",
    "complete-base": "#115e59", "complete-strong": "#0c403d", "complete-surface": "#ccfbf1",
  },
  dark: {
    "success-base": "#4ade80", "success-strong": "#22c55e", "success-surface": null,
    "warning-base": "#fbbf24", "warning-strong": "#f59e0b", "warning-surface": null,
    "danger-base": "#f87171", "danger-strong": "#ef4444", "danger-surface": null,
    "authorised-base": "#34d399", "authorised-strong": "#10b981", "authorised-surface": null,
    "complete-base": "#2dd4bf", "complete-strong": "#14b8a6", "complete-surface": null,
  },
};
// Dark soft surfaces are rgba(<status>, .18-.24) over --surface.
const DARK_SOFT_ALPHA = { success: 0.18, warning: 0.24, danger: 0.24, authorised: 0.18, complete: 0.18 };
const DARK_SOFT_TEXT = {
  success: "#bbf7d0", warning: "#ffd08a", danger: "#fecaca",
  authorised: "#a7f3d0", complete: "#99f6e4",
};

// ---- colour maths ---------------------------------------------------------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const Y = (c) => { const s = c.map((v) => lin(v / 255)); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; };
const Lstar = (c) => { const y = Y(c); return y > 0.008856 ? 116 * Math.pow(y, 1 / 3) - 16 : 903.3 * y; };
const CR = (a, b) => { const l1 = Y(a), l2 = Y(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const over = (fg, a, bg) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));

// Resolve a token value ("#rrggbb" or "rgba(r, g, b, a)") composited over `bg`.
function resolve(value, bg) {
  if (!value) return bg;
  const v = String(value).trim();
  if (v.startsWith("#")) return hex(v);
  const m = v.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) throw new Error("cannot resolve " + v);
  const rgb = [+m[1], +m[2], +m[3]];
  const a = m[4] === undefined ? 1 : +m[4];
  return over(rgb, a, bg);
}

const AA = 4.5;
const STEP_MIN = 6.0;   // dL* floor for a borderless surface step to read
const HOVER_MIN = 3.5;  // dL* floor for a hover step to register

const problems = [];
const rows = [];

for (const accent of Object.keys(ACCENT_PALETTES)) {
  for (const mode of ["light", "dark"]) {
    const t = buildThemeRuntime({ resolvedMode: mode, accentName: accent }).legacy;
    const tag = `${accent}/${mode}`;
    const surface = hex(t["--surface"]);
    const shell = hex(t["--page-shell-bg"]);
    const pageCard = surface;                              // --page-card-bg
    const sectionCard = resolve(t["--theme"], pageCard);   // --section-card-bg over the page card
    const ctrlOnCard = resolve(t["--secondary"], pageCard);
    const ctrlOnCardHover = resolve(t["--secondary-hover"], pageCard);
    const ctrlOnCardActive = resolve(t["--secondary-pressed"], pageCard);
    const ctrlOnTheme = hex(t["--control-on-theme-bg"]);
    const ctrlOnThemeHover = hex(t["--control-on-theme-bg-hover"]);
    const ctrlOnThemeActive = hex(t["--control-on-theme-bg-active"]);
    const disabledOnCard = resolve(t["--control-disabled-bg"], pageCard);
    const text1 = hex(t["--text-1"]);
    const text2 = hex(t["--text-2"]);
    const accentHex = hex(t["--accentText"]);
    const primaryButton = hex(t["--primary"]);
    const secondaryButtonOnCard = resolve(t["--secondary"], pageCard);
    const secondaryButtonOnTheme = resolve(t["--secondary"], sectionCard);

    const dL = (a, b) => Math.abs(Lstar(a) - Lstar(b));
    const step = (name, a, b, min) => {
      const d = dL(a, b);
      if (d < min) problems.push(`${tag}  SEPARATION  ${name}: dL* ${d.toFixed(1)} < ${min}`);
      return d;
    };
    const text = (name, fg, bg, min = AA) => {
      const c = CR(fg, bg);
      if (c < min) problems.push(`${tag}  CONTRAST  ${name}: ${c.toFixed(2)}:1 < ${min}`);
      return c;
    };

    // -- surface ladder ----------------------------------------------------
    const s1 = step("page card on shell", pageCard, shell, STEP_MIN);
    const s2 = step("section card on page card", sectionCard, pageCard, STEP_MIN);
    const s3 = step("control on page card", ctrlOnCard, pageCard, STEP_MIN);
    const s4 = step("control on section card", ctrlOnTheme, sectionCard, STEP_MIN);
    step("control hover on card", ctrlOnCardHover, ctrlOnCard, HOVER_MIN);
    step("control active on card", ctrlOnCardActive, ctrlOnCardHover, 2.5);
    step("control hover on theme", ctrlOnThemeHover, ctrlOnTheme, HOVER_MIN);
    step("control active on theme", ctrlOnThemeActive, ctrlOnThemeHover, 2.5);
    step("disabled control on card", disabledOnCard, pageCard, 3.0);

    // -- text on every fill it lands on ------------------------------------
    text("body text on page card", text1, pageCard);
    text("body text on section card", text1, sectionCard);
    text("primary btn label on card", hex(t["--onAccentText"]), primaryButton);
    text("primary btn label on theme", hex(t["--onAccentText"]), primaryButton);
    text("secondary btn label on card", hex(t["--accent-text-on-tint"]), secondaryButtonOnCard);
    text("secondary btn label on theme", hex(t["--accent-text-on-tint"]), secondaryButtonOnTheme);
    text("ghost/theme btn label on theme layer", hex(t["--accent-text-on-tint"]), sectionCard);
    text("is-active btn label on accent", hex(t["--onAccentText"]), accentHex);
    text("tab selected label", hex(t["--onAccentText"]), hex(t["--primary-selected"]));
    text("placeholder on control fill", resolve(t["--input-placeholder"], ctrlOnCard), ctrlOnCard, 4.0);
    text("disabled label", resolve(t["--control-disabled-text"], disabledOnCard), disabledOnCard, 3.5);
    text("accent-strong badge", text2, accentHex);
    text("neutral badge label", text1, resolve(`rgba(${t["--text-1-rgb"]}, 0.18)`, pageCard));

    // -- toggle knob -------------------------------------------------------
    const trackOff = resolve(t["--toggle-track-off"], pageCard);
    const knob = resolve(t["--toggle-knob"], trackOff);
    const knobC = CR(knob, trackOff);
    if (knobC < 1.5) problems.push(`${tag}  CONTRAST  toggle knob (off) : ${knobC.toFixed(2)}:1 < 1.5`);

    // -- status fills ------------------------------------------------------
    for (const fam of ["success", "warning", "danger", "authorised", "complete"]) {
      const base = hex(STATUS[mode][`${fam}-base`]);
      text(`${fam} strong badge`, text2, base);
      const soft = mode === "light"
        ? hex(STATUS[mode][`${fam}-surface`])
        : over(hex(STATUS[mode][`${fam}-base`]), DARK_SOFT_ALPHA[fam], surface);
      const softText = mode === "light" ? hex(STATUS[mode][`${fam}-strong`]) : hex(DARK_SOFT_TEXT[fam]);
      text(`${fam} soft badge`, softText, soft);
      step(`${fam} soft badge on card`, soft, pageCard, 2.0);
    }

    rows.push(
      `${tag.padEnd(15)} shell->card ${s1.toFixed(1).padStart(5)}  card->section ${s2
        .toFixed(1)
        .padStart(5)}  card->control ${s3.toFixed(1).padStart(5)}  section->control ${s4
        .toFixed(1)
        .padStart(5)}`
    );
  }
}

console.log("Surface ladder (perceptual dL* per rung)\n");
for (const r of rows) console.log("  " + r);
console.log("");
if (problems.length) {
  console.log(`${problems.length} PROBLEM(S):\n`);
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
} else {
  console.log("All 9 accents x 2 modes pass every separation and contrast floor.");
}
