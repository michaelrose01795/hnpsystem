# public/downloads/

This folder serves static download files for the H&P System DMS.

## Windows desktop app installer

A working installer **is currently in place**:

```
public/downloads/H-P-System-Setup.exe    ← 78 MB, version 1.0.0
```

This was produced by running `npm run build:win` inside `/desktop`. The
`DesktopAppCard` in [src/components/profile/DesktopAppCard.js](../../src/components/profile/DesktopAppCard.js)
auto-detects it via a HEAD request and switches the popup from
"Awaiting publish" to "Ready to install".

## Making it live for all users

Locally the Next.js dev server serves this file at:

```
http://localhost:3000/downloads/H-P-System-Setup.exe
```

For **all staff** to be able to download it, the file needs to be
deployed to Vercel. Three options, in order of pragmatism:

### Option A — Commit it directly (simplest, works today)

```bash
git add public/downloads/H-P-System-Setup.exe
git commit -m "Add H&P System v1.0.0 Windows installer"
git push
```

Vercel auto-redeploys and serves the file at
`https://<your-vercel-host>/downloads/H-P-System-Setup.exe`.

> 78 MB is under GitHub's 100 MB per-file hard limit but over the 50 MB
> warning threshold — GitHub will warn but accept the push. Vercel
> happily serves files up to 100 MB from `/public/*`. This is fine for
> a single installer; if you start publishing many versions, switch to
> Option B or C.

### Option B — Git LFS (cleaner for repeated releases)

```bash
git lfs install
echo "public/downloads/*.exe filter=lfs diff=lfs merge=lfs -text" >> .gitattributes
git add .gitattributes public/downloads/H-P-System-Setup.exe
git commit -m "Track installers via LFS"
git push
```

LFS keeps the git history slim; Vercel still serves the file correctly.

### Option C — External hosting (best long-term)

Upload to GitHub Releases, Vercel Blob, S3, or R2, then update
`INSTALLER_URL` at the top of
[src/components/profile/DesktopAppCard.js](../../src/components/profile/DesktopAppCard.js)
to point at the external URL. Don't commit the .exe in that case.

---

## Rebuilding a new version

```bash
cd desktop
npm version 1.0.1          # bump the version
npm run build:win
cp dist/HNPSystem-Setup-1.0.1.exe ../public/downloads/H-P-System-Setup.exe
```

The filename in `public/downloads/` must stay as `H-P-System-Setup.exe`
because that's the path
[DesktopAppCard](../../src/components/profile/DesktopAppCard.js)
probes. Change `INSTALLER_URL` in that file if you want a versioned URL
scheme (e.g. `/downloads/H-P-System-Setup-1.0.1.exe`).

## How the card detects availability

`DesktopAppCard` issues a `HEAD` request against
`/downloads/H-P-System-Setup.exe` when it mounts:

- **200 OK** → button enabled; real `Last-Modified` and `Content-Length`
  from the response are shown as "Last updated" and "File size"
- **404 / network error** → button disabled with a clear notice

So updating the file in place is the only operation needed to release a
new version. No code change required.
