// file location: desktop/src/preload.js
// Minimal, isolated preload bridge for the H&P System Electron shell.
//
// Design goals:
//  - contextIsolation: true means the renderer cannot reach Node directly.
//  - We expose only a tiny, read-only surface that the DMS may need to know
//    it is running inside the desktop shell (e.g. for "About" or feature flags).
//  - No Node modules, fs, child_process, or shell APIs are forwarded.
//
// If you ever need to add IPC, do it via a narrow contextBridge method here
// and handle it in main.js — never grant the renderer broad ipcRenderer access.

"use strict"; // Enforce strict mode in the preload sandbox

const { contextBridge } = require("electron"); // Safe API for exposing values across the isolated world boundary

// Read-only descriptor of the desktop environment for the renderer.
// Everything below is a primitive — no functions that could be abused
// to escalate privileges or reach Node from inside the web app.
const desktopInfo = Object.freeze({
  isDesktopApp: true,                                  // Marker so the Next.js app can detect the shell
  appName: "H&P System",                               // Public-facing product name
  shell: "electron",                                   // Identifies the wrapper technology
  version: process.env.npm_package_version || "1.0.0", // Best-effort version string
  platform: process.platform,                          // e.g. "win32" — useful for OS-aware UI tweaks
});

// Expose the descriptor under window.hnpDesktop in the renderer.
// We deliberately do NOT expose any Electron, Node, or filesystem APIs here.
try {
  contextBridge.exposeInMainWorld("hnpDesktop", desktopInfo); // Single, immutable property
} catch (err) {
  // contextBridge will throw if contextIsolation is mis-configured —
  // log so the cause is obvious during development.
  // eslint-disable-next-line no-console
  console.error("[H&P Desktop preload] contextBridge failed:", err);
}
