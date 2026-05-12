const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const LOCAL_URL_PATTERN = /https?:\/\/(?:localhost|127\.0\.0\.1|\[?::1\]?)(?::\d+)?(?:\/[^\s]*)?/i;
const PRE_VERCEL_TASKKILL_PID = "25756";

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

function runPreVercelTaskkill() {
  if (process.platform !== "win32") return Promise.resolve();

  console.log(`[vercel:dev] Running taskkill /PID ${PRE_VERCEL_TASKKILL_PID} /F before Vercel dev...`);

  return new Promise((resolve) => {
    const taskkill = spawn("taskkill", ["/PID", PRE_VERCEL_TASKKILL_PID, "/F"], {
      stdio: "inherit",
    });

    taskkill.on("error", (error) => {
      console.warn(`[vercel:dev] Could not run taskkill before Vercel dev: ${error.message}`);
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
