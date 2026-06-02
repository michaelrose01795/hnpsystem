// file location: desktop/src/main.js
// Electron main process for the H&P System desktop shell.
//
// Responsibilities:
//   - Create the main BrowserWindow that loads the hosted Next.js DMS.
//   - Show a local splash window while the remote app is being fetched.
//   - Restrict in-window navigation to the configured DMS host.
//   - Route external links to the user's default browser.
//   - Detect offline / load failures and offer auto-retry.
//   - Keep the renderer fully sandboxed: contextIsolation on, nodeIntegration off.

"use strict"; // Enforce strict mode in the main process

const path = require("node:path"); // Node path utilities for resolving local files
const {
  app,
  BrowserWindow,
  shell,
  Menu,
  dialog,
  nativeImage,
  net,
} = require("electron"); // Electron primitives used below

const {
  DMS_URL,
  DMS_ORIGIN,
  ALLOWED_HOSTS,
  APP_META,
  WINDOW_DEFAULTS,
} = require("./config"); // Centralised configuration / allow-list

// ---------------------------------------------------------------------------
// Single-instance lock — ensures only one copy of the desktop app runs.
// If a second launch is attempted (e.g. user double-clicks the shortcut twice)
// we focus the existing window instead of opening a new one.
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock(); // Acquire the OS-level lock
if (!gotLock) {
  app.quit(); // Bail out of this duplicate process immediately
}

// References we keep alive for the lifetime of the app
let mainWindow = null;   // Main DMS BrowserWindow
let splashWindow = null; // Splash BrowserWindow shown during loading
let isRetrying = false;  // Guards against overlapping retry attempts

// ---------------------------------------------------------------------------
// Resolve the application icon. We use the square 1024×1024 PNG from
// /desktop/assets/desktop.png for the runtime window/taskbar icon (Electron
// rasterises it as needed). The installer / .exe icon is built separately by
// electron-builder from the multi-resolution desktop/build/icon.ico, which is
// generated from the same desktop.png source.
//
// TODO(codesign): no Windows code-signing certificate is configured.
//   Without one, end users see a SmartScreen "Windows protected your PC"
//   warning on first install. To enable signing:
//     1. Buy an EV or OV code-signing certificate from a CA (DigiCert,
//        Sectigo, SSL.com, etc.).
//     2. In desktop/package.json under "build.win", add:
//          "certificateFile": "path/to/cert.pfx",
//          "certificatePassword": "${env.WIN_CSC_PASSWORD}",
//        and pass WIN_CSC_PASSWORD via the build environment.
//     3. Re-run `npm run build:win` — electron-builder signs automatically.
//   Cannot be done from inside this repo — requires purchased credentials.
// ---------------------------------------------------------------------------
const iconPath = path.join(__dirname, "..", "assets", "desktop.png"); // Resolve absolute icon path
const appIcon = nativeImage.createFromPath(iconPath);              // Build the nativeImage once

// Override the productName so dialogs and the About panel use it consistently
app.setName(APP_META.productName);

// ---------------------------------------------------------------------------
// Splash window: a tiny, frameless window that shows our logo while the
// remote DMS is being fetched. It also acts as the visible UI for offline /
// failure states until the main window successfully loads.
// ---------------------------------------------------------------------------
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,           // Borderless splash — feels like a launch screen
    resizable: false,
    movable: false,
    alwaysOnTop: true,      // Keep on top during cold boot
    transparent: false,
    skipTaskbar: true,      // Don't litter the taskbar with the splash
    icon: appIcon,
    show: false,            // Wait until ready-to-show to avoid white flash
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,        // Splash needs zero privileges
    },
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html")); // Local file — no network needed

  splashWindow.once("ready-to-show", () => {
    splashWindow.show(); // Reveal once fully rendered
  });

  // Retry handler: the splash sets window.location.hash = "retry-..." on click
  splashWindow.webContents.on("did-navigate-in-page", (_event, url) => {
    if (url.includes("#retry")) {
      retryLoadMainWindow(); // Re-attempt the main window load
    }
  });

  splashWindow.on("closed", () => {
    splashWindow = null; // Allow GC and prevent stale references
  });
}

// ---------------------------------------------------------------------------
// Application menu: kept auto-hidden (see autoHideMenuBar) so the shell still
// feels like proper desktop software, but its accelerators give the DMS the
// same keyboard shortcuts the browser provides during `vercel dev`:
//   - Ctrl/Cmd+R           → reload the current screen
//   - Ctrl/Cmd+Shift+R / F5 → hard reload (ignore cache)
//   - Ctrl/Cmd+Shift+I / F12 → toggle DevTools
//   - Ctrl/Cmd +/-/0        → zoom in / out / reset
//   - Ctrl/Cmd C/V/X/A      → copy / paste / cut / select-all in text fields
// Without a menu, Electron strips these accelerators entirely (the old
// `setApplicationMenu(null)` is exactly why Ctrl+R did nothing in the build).
// ---------------------------------------------------------------------------
function buildAppMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    // macOS expects an app menu first; harmless to include only there.
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },         // Ctrl/Cmd+R
        { role: "forceReload" },    // Ctrl/Cmd+Shift+R (also F5)
        { role: "toggleDevTools" }, // Ctrl/Cmd+Shift+I (also F12)
        { type: "separator" },
        { role: "resetZoom" },      // Ctrl/Cmd+0
        { role: "zoomIn" },         // Ctrl/Cmd++
        { role: "zoomOut" },        // Ctrl/Cmd+-
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

// ---------------------------------------------------------------------------
// Main window: loads the hosted Next.js DMS in a clean, browser-chromeless
// app window. All security flags are explicit so a future refactor can't
// silently widen the privilege surface.
// ---------------------------------------------------------------------------
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_DEFAULTS.width,
    height: WINDOW_DEFAULTS.height,
    minWidth: WINDOW_DEFAULTS.minWidth,
    minHeight: WINDOW_DEFAULTS.minHeight,
    title: APP_META.productName, // Window/taskbar title — no browser chrome
    icon: appIcon,
    show: false,                  // Stay hidden until first paint to avoid flicker
    backgroundColor: "#111418",   // Matches the splash background for a smooth handoff
    autoHideMenuBar: true,        // Hide the default menu (Alt still reveals it)
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Minimal preload bridge
      contextIsolation: true,                       // Renderer cannot reach Node
      nodeIntegration: false,                       // No `require`/`process` in renderer
      sandbox: true,                                // Renderer runs in OS sandbox
      webviewTag: false,                            // Disallow nested <webview> tags
      spellcheck: true,                             // Useful for note/text fields in the DMS
      // DevTools enabled in dev and the build so F12 / inspect works like the
      // browser does during `vercel dev` (the dev overlay lives in the app).
      devTools: true,
    },
  });

  // Apply our custom menu (auto-hidden via autoHideMenuBar) in every build so
  // the keyboard accelerators — Ctrl+R reload, copy/paste, zoom, DevTools —
  // work exactly as they do in the browser. The bar stays hidden until Alt.
  Menu.setApplicationMenu(buildAppMenu());

  // Lock the title so navigations inside the DMS can't override the app branding.
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault(); // Keep "H&P System" no matter what the page sets
  });

  // ---- Navigation guards ------------------------------------------------
  // 1) Block in-window navigation to any host not on the allow-list.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isUrlAllowed(url)) {
      event.preventDefault();      // Stop the in-window navigation
      void shell.openExternal(url); // Open in the user's default browser instead
    }
  });

  // 2) Block popups / target=_blank from creating in-app windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isUrlAllowed(url)) {
      // Allow the navigation in the existing window to keep the single-window UX
      void mainWindow.loadURL(url);
    } else {
      void shell.openExternal(url); // External link — open in the user's normal browser
    }
    return { action: "deny" }; // Never create a second Electron window automatically
  });

  // 3) Catch failed loads (no internet, DNS issue, server down).
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) {
      return; // Sub-frame failures don't warrant the offline UI
    }
    // Ignore the benign "aborted" code that occurs on programmatic reloads
    if (errorCode === -3) {
      return;
    }
    // eslint-disable-next-line no-console
    console.warn("[H&P Desktop] Load failed:", errorCode, errorDescription, validatedURL);
    showOfflineSplash(errorDescription);
    scheduleAutoRetry(); // Try again automatically after a short backoff
  });

  // 4) Surface renderer crashes so we can self-heal by reloading.
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    // eslint-disable-next-line no-console
    console.warn("[H&P Desktop] Renderer gone:", details.reason);
    if (details.reason !== "clean-exit") {
      // Reload the main URL to recover from a crash without restarting the app
      void mainWindow.loadURL(DMS_URL);
    }
  });

  // 5) Wait for the first successful paint, then swap splash → main window.
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.show();        // Reveal the main window
    if (splashWindow) {
      splashWindow.destroy(); // Tear down the splash now that the DMS is visible
      splashWindow = null;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null; // Drop reference so GC can clean up
  });

  // Kick off the load. Errors are handled by did-fail-load above.
  void mainWindow.loadURL(DMS_URL);
}

// ---------------------------------------------------------------------------
// Helper: decide whether a URL is permitted inside the BrowserWindow.
// Anything not matching the allow-list is opened in the user's browser.
// ---------------------------------------------------------------------------
function isUrlAllowed(rawUrl) {
  try {
    const u = new URL(rawUrl);
    // Allow http/https only — block weird schemes (file://, javascript:, etc.)
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return false;
    }
    return ALLOWED_HOSTS.has(u.host); // Strict host match
  } catch {
    return false; // Malformed URL → never allow in-window
  }
}

// ---------------------------------------------------------------------------
// Offline / failure handling
// ---------------------------------------------------------------------------
function showOfflineSplash(errorDescription) {
  // If the splash was already torn down (we'd reached the main window once
  // and then lost connection), re-create it so the user has UI to look at.
  if (!splashWindow) {
    createSplashWindow();
  }
  if (mainWindow) {
    mainWindow.hide(); // Hide the broken main window to avoid confusing white-screen
  }
  // Push the error state into the splash once it's ready.
  const pushError = () => {
    if (!splashWindow) return;
    splashWindow.webContents
      .executeJavaScript(
        `document.body.classList.add('is-error');
         const s = document.getElementById('subtitle');
         if (s) s.textContent = 'Connection problem';
         const e = document.getElementById('errorPanel');
         if (e) { e.firstChild && (e.firstChild.textContent = ${JSON.stringify(
           "Couldn't reach the H&P System server: " + (errorDescription || "unknown error") + ". "
         )}); }`
      )
      .catch(() => { /* swallow — splash may have closed mid-update */ });
  };
  if (splashWindow.webContents.isLoading()) {
    splashWindow.webContents.once("did-finish-load", pushError);
  } else {
    pushError();
  }
}

// ---------------------------------------------------------------------------
// Auto-retry: ping the DMS origin a few times with exponential backoff and
// reload the main window the moment it's reachable. Prevents the user having
// to click "Retry" if the outage was a brief blip.
// ---------------------------------------------------------------------------
function scheduleAutoRetry(attempt = 1) {
  if (isRetrying) return; // Don't stack overlapping retry timers
  isRetrying = true;
  const delays = [3000, 5000, 10000, 20000, 30000]; // ms — capped backoff schedule
  const delay = delays[Math.min(attempt - 1, delays.length - 1)];
  setTimeout(async () => {
    isRetrying = false;
    const reachable = await pingDmsOrigin();
    if (reachable) {
      retryLoadMainWindow();
    } else if (attempt < 20) { // Give up gracefully after ~10 minutes
      scheduleAutoRetry(attempt + 1);
    }
  }, delay);
}

// Probe the DMS origin with a tiny HEAD request. Uses Electron's `net` module
// so we go through Chromium's networking stack (handles proxies/system DNS).
function pingDmsOrigin() {
  return new Promise((resolve) => {
    try {
      const req = net.request({ method: "HEAD", url: DMS_ORIGIN });
      req.on("response", () => resolve(true));    // Any response counts as "online"
      req.on("error", () => resolve(false));       // Network/DNS failure
      req.setHeader("User-Agent", "HNP-Desktop-Probe/1.0");
      req.end();
    } catch {
      resolve(false);
    }
  });
}

// Triggered by manual retry (splash button) or auto-retry timer
function retryLoadMainWindow() {
  if (!mainWindow) {
    createMainWindow(); // Was destroyed somehow — make a fresh one
    return;
  }
  // Reset the offline state on the splash if it's still visible
  if (splashWindow) {
    splashWindow.webContents
      .executeJavaScript(
        `document.body.classList.remove('is-error');
         const s = document.getElementById('subtitle');
         if (s) s.textContent = 'Reconnecting…';`
      )
      .catch(() => { /* splash may be gone */ });
  }
  void mainWindow.loadURL(DMS_URL);
}

// ---------------------------------------------------------------------------
// App lifecycle wiring
// ---------------------------------------------------------------------------

// Refuse in-app permission requests by default — the DMS shouldn't need
// camera/mic/geolocation/etc. inside the desktop shell — but explicitly ALLOW
// clipboard access. The dev overlay (and any "copy" button in the DMS) uses the
// async Clipboard API (`navigator.clipboard.writeText`), which Electron gates
// behind the `clipboard-sanitized-write` permission. Without this allow-list a
// deny-all handler silently rejects every copy, so it works in the browser
// (Vercel) but not inside the packaged shell. Override others case-by-case here.
const ALLOWED_PERMISSIONS = new Set([
  "clipboard-read",            // navigator.clipboard.readText
  "clipboard-write",           // legacy/alias write permission
  "clipboard-sanitized-write", // navigator.clipboard.writeText (the copy path)
]);

function isPermissionOriginAllowed(webContents, requestingOrigin) {
  if (requestingOrigin) {
    return isUrlAllowed(requestingOrigin);
  }

  const currentUrl = webContents && !webContents.isDestroyed() ? webContents.getURL() : "";
  if (!currentUrl) {
    return false;
  }

  try {
    return isUrlAllowed(new URL(currentUrl).origin);
  } catch {
    return false;
  }
}

function lockDownPermissions() {
  const { session } = require("electron"); // Lazy require — session is only ready after `ready`
  // Async permission prompts (e.g. first clipboard write in a session).
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details = {}) => {
    const allowed = ALLOWED_PERMISSIONS.has(permission) && isPermissionOriginAllowed(webContents, details.requestingOrigin);
    callback(allowed); // Allow app-origin clipboard access, deny the rest
  });
  // Synchronous permission checks (the Clipboard API consults this too).
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return ALLOWED_PERMISSIONS.has(permission) && isPermissionOriginAllowed(webContents, requestingOrigin); // Same allow-list, sync variant
  });
}

// If a second instance is launched, focus the first window instead of opening
// a duplicate. This is wired up via the single-instance lock acquired above.
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  lockDownPermissions(); // Tighten session permissions before any window opens
  createSplashWindow();  // Show local splash immediately for a fast perceived launch
  createMainWindow();    // Begin loading the hosted DMS in the background
});

app.on("window-all-closed", () => {
  // Standard cross-platform behaviour:
  //  - Quit on Windows/Linux when the last window closes
  //  - Stay alive on macOS until the user explicitly quits (dock convention)
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // macOS dock-click: re-open a window if none exist.
  if (BrowserWindow.getAllWindows().length === 0) {
    createSplashWindow();
    createMainWindow();
  }
});

// ---------------------------------------------------------------------------
// Hard security backstops applied to every BrowserWindow created.
// ---------------------------------------------------------------------------
app.on("web-contents-created", (_event, contents) => {
  // Belt-and-braces: even if a future change forgets to attach a guard to a
  // new window, these app-wide handlers still enforce the rules.
  contents.on("will-navigate", (event, url) => {
    if (!isUrlAllowed(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isUrlAllowed(url)) {
      return { action: "allow" };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });
  // Block any attempt to attach a <webview> at runtime
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

// ---------------------------------------------------------------------------
// Catch unhandled errors so the app doesn't die silently in production.
// ---------------------------------------------------------------------------
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[H&P Desktop] uncaughtException:", err);
  if (app.isReady()) {
    dialog.showErrorBox("H&P System — unexpected error", String(err && err.stack ? err.stack : err));
  }
});
