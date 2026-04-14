const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

async function pathExists(targetPath) {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function ensureLocalNextCache() {
  const projectRoot = process.cwd();

  // This warning is specific to WSL projects running from mounted Windows drives.
  if (process.platform !== "linux" || !projectRoot.startsWith("/mnt/")) {
    return;
  }

  const cacheRoot =
    process.env.NEXT_LOCAL_CACHE_DIR || path.join("/tmp", "next-local-cache");
  const projectHash = crypto
    .createHash("sha1")
    .update(projectRoot)
    .digest("hex")
    .slice(0, 10);
  const projectName = path.basename(projectRoot).replace(/[^a-zA-Z0-9._-]/g, "-");
  const targetNextDir = path.join(cacheRoot, `${projectName}-${projectHash}`);
  const projectNextDir = path.join(projectRoot, ".next");

  await fs.mkdir(cacheRoot, { recursive: true });
  await fs.mkdir(targetNextDir, { recursive: true });

  const nextDirExists = await pathExists(projectNextDir);

  if (nextDirExists) {
    const nextStats = await fs.lstat(projectNextDir);

    if (nextStats.isSymbolicLink()) {
      const currentTarget = await fs.readlink(projectNextDir);
      const resolvedTarget = path.resolve(projectRoot, currentTarget);

      if (resolvedTarget === targetNextDir) {
        return;
      }

      await fs.rm(projectNextDir, { force: true });
    } else {
      await fs.cp(projectNextDir, targetNextDir, {
        force: true,
        recursive: true,
      });
      await fs.rm(projectNextDir, { force: true, recursive: true });
    }
  }

  await fs.symlink(targetNextDir, projectNextDir, "dir");

  console.log(
    `[next-cache] Using local dev cache at ${targetNextDir} via ${projectNextDir}`
  );
}

module.exports = ensureLocalNextCache;

if (require.main === module) {
  ensureLocalNextCache().catch((error) => {
    console.error("[next-cache] Failed to prepare local Next.js cache.");
    console.error(error);
    process.exitCode = 1;
  });
}
