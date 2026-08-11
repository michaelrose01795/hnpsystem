// file location: src/lib/dev-tools/config.js

export const devToolsConfig = {
  enabled: true,
  allowInProduction: true,
  showLogin: true,
  showOverlay: true,
  showSidebarItems: true,
  showPages: true,
};

export const DEVELOPMENT_BRANCH = "development";
export const PRODUCTION_BRANCH = "main";

// Next.js replaces direct NEXT_PUBLIC_* property reads in the browser bundle.
// Keeping the default environment explicit avoids relying on the dynamic
// `process.env` object, which is not populated client-side.
const RUNTIME_DEV_TOOL_ENV = Object.freeze({
  NEXT_PUBLIC_COMMIT_REF: process.env.NEXT_PUBLIC_COMMIT_REF,
  VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
  NEXT_PUBLIC_DEPLOY_ENV: process.env.NEXT_PUBLIC_DEPLOY_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  NODE_ENV: process.env.NODE_ENV,
});

export function isDevelopmentBranch(env = RUNTIME_DEV_TOOL_ENV) {
  return getBranch(env) === DEVELOPMENT_BRANCH;
}

function getBranch(env) {
  return String(
    env?.NEXT_PUBLIC_COMMIT_REF || env?.VERCEL_GIT_COMMIT_REF || ""
  )
    .trim()
    .replace(/^refs\/heads\//, "");
}

export function isDeveloperOnlyEnvironment(env = RUNTIME_DEV_TOOL_ENV) {
  const deployEnvironment = String(
    env?.NEXT_PUBLIC_DEPLOY_ENV || env?.VERCEL_ENV || ""
  )
    .trim()
    .toLowerCase();

  // Vercel Preview builds use NODE_ENV=production, so NODE_ENV alone cannot
  // distinguish Preview from the live Production deployment. Deployment type
  // is authoritative when available, with local dev and branch metadata as
  // safe fallbacks outside Vercel.
  if (deployEnvironment === "production") return false;
  if (getBranch(env) === PRODUCTION_BRANCH) return false;
  if (deployEnvironment === "preview" || deployEnvironment === "development") {
    return true;
  }
  if (String(env?.NODE_ENV || "").trim().toLowerCase() === "development") {
    return true;
  }

  return isDevelopmentBranch(env);
}

export function canShowDeveloperOnlyControls(env = RUNTIME_DEV_TOOL_ENV) {
  return devToolsConfig.enabled && isDeveloperOnlyEnvironment(env);
}

export function canUseDevToolsInCurrentEnv() {
  return devToolsConfig.enabled && (devToolsConfig.allowInProduction || process.env.NODE_ENV !== "production");
}

export function canShowDevLogin() {
  return devToolsConfig.showLogin;
}

export function canShowDevOverlay(user, env = RUNTIME_DEV_TOOL_ENV) {
  return canShowDeveloperOnlyControls(env) && devToolsConfig.showOverlay && Boolean(user);
}

export function canShowDevSidebarItems(user) {
  return canUseDevToolsInCurrentEnv() && devToolsConfig.showSidebarItems && Boolean(user);
}

export function canShowDevPages(env = RUNTIME_DEV_TOOL_ENV) {
  return canShowDeveloperOnlyControls(env) && devToolsConfig.showPages;
}
