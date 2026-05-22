# H&P System — Desktop Shell

A thin Electron wrapper around the hosted Next.js DMS. The desktop app loads
the live web application in a chromeless window so users get a "proper app"
experience (taskbar entry, Start-menu shortcut, app icon) without us having
to rebuild the DMS natively.

The Next.js project at the repository root is the source of truth — this
folder is **only** the shell. Nothing under `/desktop` is consumed by the
web app, and nothing in the web app is required to run/build this shell
beyond the public `logo.png` (which is copied into `desktop/assets/`).

---

## File layout

```
desktop/
├── assets/
│   └── logo.png          → App icon / branding (copied from public/logo.png)
├── build/                → electron-builder build resources (icons, license, etc.)
├── src/
│   ├── config.js         → Resolves DMS URL + host allow-list + branding
│   ├── main.js           → Electron main process (windows, security, retry logic)
│   ├── preload.js        → Minimal contextBridge — exposes `window.hnpDesktop`
│   └── splash.html       → Local splash / offline screen
├── .env.example          → Sample env file (copy to .env to override DMS URL)
├── .gitignore
├── package.json          → Scripts + electron-builder config (isolated from root)
└── README.md             → This file
```

---

## Prerequisites

* Node.js 18+ (the same version used by the root project works fine)
* Windows 10/11 for building Windows installers
* No global Electron install needed — everything is local to `desktop/`

> **Note:** all commands below are run from the `desktop/` folder, **not** the repo root.

---

## Install

```bash
cd desktop
npm install
```

This installs `electron`, `electron-builder`, `cross-env`, and `rimraf` into
`desktop/node_modules`. The root Next.js `node_modules` is untouched.

---

## Run in development

By default `npm run dev` points the shell at `http://localhost:3000`, which
matches the root project's `npm run dev`. Open two terminals:

```bash
# Terminal A — root of the repo
npm run dev

# Terminal B — desktop folder
cd desktop
npm run dev
```

The Electron window opens against your local Next.js server. DevTools is
available via `Ctrl+Shift+I` in development builds.

You can override the URL on the fly:

```bash
# Point dev mode at a Vercel preview / staging deployment
cross-env DMS_APP_URL=https://hnpsystem-preview.vercel.app npm run dev
```

---

## Run against production

```bash
cd desktop
npm start
```

This launches the same shell but uses the production DMS URL configured in
`src/config.js` (or `DMS_APP_URL` from your environment / `desktop/.env`).

---

## Build the Windows installer

```bash
cd desktop
npm run build:win
```

Output:

```
desktop/dist/
├── HNPSystem-Setup-<version>.exe   ← the installer to ship
├── win-unpacked/                   ← raw unpacked app (for debugging)
└── …                                ← electron-builder metadata
```

Double-click the installer to install locally and verify before distributing.

A portable (no-installer) build is also available for ad-hoc engineer use:

```bash
npm run build:win:portable
```

---

## Changing the DMS URL

Three options, in order of precedence:

1. **Shell environment** — `DMS_APP_URL=https://… npm start`
2. **`desktop/.env` file** — `cp .env.example .env` and edit the URL
3. **Hard-coded fallback** — edit `DEFAULT_DMS_URL` in
   [`src/config.js`](src/config.js) and commit. The fallback is what the
   installer ships with if no env var is set at runtime.

If your DMS lives on a different host than `hnpsystem.vercel.app`, also add
that host to `ALLOWED_HOSTS` (or to `AUX_ALLOWED_HOSTS`) in `src/config.js`,
otherwise the navigation guard will treat it as external and open it in the
user's browser.

If you use third-party login flows (Google, Microsoft, Supabase, Stripe
checkout, etc.), uncomment the relevant entries in `AUX_ALLOWED_HOSTS` so the
auth callbacks complete inside the desktop window instead of being bounced
out to the browser.

---

## Branding assets

Branding is driven by one square source image:

* `desktop/assets/desktop.png` — square 1024×1024 PNG. Used for the
  application window icon and the splash screen.
* `desktop/build/icon.ico` — multi-resolution Windows icon
  (16/24/32/48/64/128/256 px) generated from `desktop.png`. Used by
  electron-builder for the installer and the `.exe` / taskbar icon.

To replace branding later:

1. Replace `desktop/assets/desktop.png` with a new square PNG
   (1024×1024 recommended; 512×512 minimum).
2. Regenerate `desktop/build/icon.ico` from it. Any PNG→ICO tool works;
   the project was built with a PowerShell + `System.Drawing` script that
   resizes the source to each target size and writes a multi-image ICO.
3. Rebuild: `npm run build:win`.

---

## How it works internally

1. **Single-instance lock** — only one copy of the shell can run at a time.
   Launching a second copy focuses the existing window.
2. **Splash window** opens immediately with the local `splash.html` so the
   user sees branding while the remote DMS is being fetched.
3. **Main window** is created with strict security flags
   (`contextIsolation`, `nodeIntegration: false`, `sandbox: true`,
   `webviewTag: false`) and loads `DMS_APP_URL`.
4. **Navigation guard** — `will-navigate` and `setWindowOpenHandler` check
   every URL against `ALLOWED_HOSTS`. Allowed URLs stay in the window;
   anything else opens in the user's default browser via `shell.openExternal`.
5. **Offline / failure handling** — `did-fail-load` shows the splash with an
   error state. Auto-retry probes the DMS origin with `electron.net` on an
   exponential backoff schedule and reloads the moment it's reachable.
6. **Crash recovery** — `render-process-gone` triggers an automatic reload
   of the main URL so a renderer crash doesn't kill the shell.
7. **Preload bridge** exposes only `window.hnpDesktop = { isDesktopApp,
   appName, shell, version, platform }` to the web app — a tiny read-only
   marker so the Next.js code can branch on the shell if it ever needs to.
   No Node, no `fs`, no IPC channels are exposed.

---

## Updates

This shell does **not** ship an auto-updater. The web app is loaded fresh
on every launch, so any change deployed to Vercel reaches every desktop
user instantly — no installer reissue needed for normal product updates.

Reissue the installer **only** when:

* `src/main.js`, `src/preload.js`, `src/config.js`, or `splash.html` change
* `package.json` dependencies or electron-builder config changes
* Branding assets change
* The `DEFAULT_DMS_URL` fallback needs to change for installs that don't set
  the env var

If you later need true auto-updates (silent download + install on launch),
the recommended path is `electron-updater` pointed at a private update feed
(GitHub Releases, S3, or a custom HTTPS host). It plugs straight into the
existing electron-builder config.

---

## Installer behaviour

The NSIS installer is configured with sensible business-software defaults:

* Per-user install (no admin prompt required by default)
* User can choose the install directory
* Creates desktop **and** Start menu shortcuts
* Runs the app after install finishes
* Preserves user data on uninstall (override with `deleteAppDataOnUninstall`)
* Installer + uninstaller both branded with `logo.png`

App ID: `uk.co.humphriesandparks.hnpsystem` — keep this stable forever, it's
how Windows tracks the install across upgrades.

---

## Future improvements (optional)

* Add `electron-updater` for silent auto-updates from a release feed
* Add a real `.ico` (multi-resolution) at `desktop/build/icon.ico`
* Add a NSIS installer banner / sidebar graphic for a more branded installer UX
* Add an "About H&P System" menu entry that surfaces build/version info
* Add `electron-log` for diagnostic logging at `%APPDATA%/H&P System/logs/`
* Sign the installer with an EV/OV certificate to bypass SmartScreen warnings
* Optional macOS (`.dmg`) and Linux (`AppImage`) targets in `build.mac` / `build.linux`

---

*This shell is intentionally thin. If a problem looks like a DMS problem,
fix it in the Next.js code at the repo root. Only edit `/desktop` for
shell-layer concerns (windowing, security, installer, branding).*
