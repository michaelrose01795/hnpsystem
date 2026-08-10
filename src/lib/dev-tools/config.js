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

// Next.js replaces direct NEXT_PUBLIC_* property reads in the browser bundle.
// Keeping the default environment explicit avoids relying on the dynamic
// `process.env` object, which is not populated client-side.
const RUNTIME_DEV_TOOL_ENV = Object.freeze({
  NEXT_PUBLIC_COMMIT_REF: process.env.NEXT_PUBLIC_COMMIT_REF,
  VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
});

export function isDevelopmentBranch(env = RUNTIME_DEV_TOOL_ENV) {
  const branch = String(
    env?.NEXT_PUBLIC_COMMIT_REF || env?.VERCEL_GIT_COMMIT_REF || ""
  )
    .trim()
    .replace(/^refs\/heads\//, "");

  return branch === DEVELOPMENT_BRANCH;
}

export function canShowDeveloperOnlyControls(env = RUNTIME_DEV_TOOL_ENV) {
  return devToolsConfig.enabled && isDevelopmentBranch(env);
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
