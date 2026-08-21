const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const LOCAL_URL_PATTERN = /https?:\/\/(?:localhost|127\.0\.0\.1|\[?::1\]?)(?::\d+)?(?:\/[^\s]*)?/i;

function isWsl() {
  if (process.platform !== "linux") return false;
  try {
    return fs.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

function openExternalBrowser(url) {
  const opener =
    process.platform === "win32"
      ? { command: "cmd.exe", args: ["/c", "start", "", url] }
      : process.platform === "darwin"
        ? { command: "open", args: [url] }
        : isWsl()
          ? { command: "cmd.exe", args: ["/c", "start", "", url] }
          : { command: "xdg-open", args: [url] };

  const openProcess = spawn(opener.command, opener.args, {
    detached: true,
    stdio: "ignore",
  });
  openProcess.unref();
}

// Stop a *previous dev server for this project* before starting Vercel dev.
//
// This used to run `taskkill /PID 25756 /F` against a PID hard-coded at the time
// someone hit the problem. PIDs are recycled, so on any later boot that number
// belongs to an unrelated process — the script would force-kill whatever
// happened to hold it. Next.js writes the live dev server's PID to
// `.next/dev/lock`, so read the actual owner instead, verify it is still running
// and is a node process, and only then stop it.
function readDevServerLock() {
  try {
    const lockPath = path.join(process.cwd(), ".next", "dev", "lock");
    if (!fs.existsSync(lockPath)) return null;
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    const pid = Number(lock?.pid);
    if (!Number.isInteger(pid) || pid <= 0) return null;
    return { pid, port: lock?.port ?? null };
  } catch {
    return null;
  }
}

function isRunningNodeProcess(pid) {
  if (process.platform !== "win32") return false;
  try {
    const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH", "/FO", "CSV"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return /^"node\.exe"/i.test(out.trim());
  } catch {
    return false;
  }
}

function runPreVercelTaskkill() {
  if (process.platform !== "win32") return Promise.resolve();

  const lock = readDevServerLock();
  if (!lock) {
    console.log("[vercel:dev] No .next/dev/lock — nothing to stop.");
    return Promise.resolve();
  }
  if (lock.pid === process.pid) return Promise.resolve();
  if (!isRunningNodeProcess(lock.pid)) {
    console.log(`[vercel:dev] Stale lock (PID ${lock.pid} is not a running node process) — skipping.`);
    return Promise.resolve();
  }

  console.log(
    `[vercel:dev] Stopping the existing dev server for this project (PID ${lock.pid}${lock.port ? `, port ${lock.port}` : ""})...`
  );

  return new Promise((resolve) => {
    const taskkill = spawn("taskkill", ["/PID", String(lock.pid), "/F"], {
      stdio: "inherit",
    });

    taskkill.on("error", (error) => {
      console.warn(`[vercel:dev] Could not stop the existing dev server: ${error.message}`);
      resolve();
    });

    taskkill.on("exit", (code) => {
      if (code && code !== 0) {
        console.warn(`[vercel:dev] taskkill exited with code ${code}; continuing to Vercel dev.`);
      }

      resolve();
    });
  });
}

async function main() {
  const ensureLocalNextCache = require("./use-local-next-cache.js");

  if (typeof ensureLocalNextCache === "function") {
    await ensureLocalNextCache();
  }

  await runPreVercelTaskkill();

  const isWindows = process.platform === "win32";
  const localVercelBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    isWindows ? "vercel.cmd" : "vercel"
  );
  const hasLocalVercelBin = fs.existsSync(localVercelBin);
  const vercelCommand = hasLocalVercelBin ? localVercelBin : "npx";
  const vercelArgs = hasLocalVercelBin ? ["dev"] : ["--yes", "vercel", "dev"];

  let openedBrowser = false;
  const extraArgs = process.argv.slice(2);
  const child = spawn(vercelCommand, [...vercelArgs, "--non-interactive", ...extraArgs], {
    env: { ...process.env, HNP_SKIP_NEXT_DEV_OPEN: "1" },
    stdio: ["inherit", "pipe", "pipe"],
    shell: isWindows,
  });

  const forwardOutput = (stream, writer) => {
    stream.on("data", (chunk) => {
      const text = chunk.toString();
      writer.write(chunk);

      if (openedBrowser) return;
      const match = text.match(LOCAL_URL_PATTERN);
      if (!match?.[0]) return;

      openedBrowser = true;
      openExternalBrowser(match[0]);
    });
  };

  forwardOutput(child.stdout, process.stdout);
  forwardOutput(child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[vercel:dev] Failed to start Vercel dev.");
  console.error(error);
  process.exit(1);
});
