const { spawn } = require("child_process");
const path = require("path");

async function main() {
  const ensureLocalNextCache = require("./use-local-next-cache.js");

  if (typeof ensureLocalNextCache === "function") {
    await ensureLocalNextCache();
  }

  const isWindows = process.platform === "win32";
  const vercelBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    isWindows ? "vercel.cmd" : "vercel"
  );

  const child = spawn(vercelBin, ["dev"], {
    stdio: "inherit",
  });

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
