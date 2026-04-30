const { spawn } = require("child_process");
const path = require("path");

async function main() {
  const ensureLocalNextCache = require("./use-local-next-cache.js");

  if (typeof ensureLocalNextCache === "function") {
    await ensureLocalNextCache();
  }

  const nextBin = path.join(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );
  const port = process.env.PORT || "3000";
  const child = spawn(process.execPath, [nextBin, "dev", "--port", port, "--webpack"], {
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
  console.error("[next-dev] Failed to start Next.js dev server.");
  console.error(error);
  process.exit(1);
});
