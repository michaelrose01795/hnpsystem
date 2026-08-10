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

export function isDevelopmentBranch(env = process.env) {
  const branch = String(
    env?.NEXT_PUBLIC_COMMIT_REF || env?.VERCEL_GIT_COMMIT_REF || ""
  )
    .trim()
    .replace(/^refs\/heads\//, "");

  return branch === DEVELOPMENT_BRANCH;
}

export function canShowDeveloperOnlyControls(env = process.env) {
  return devToolsConfig.enabled && isDevelopmentBranch(env);
}

export function canUseDevToolsInCurrentEnv() {
  return devToolsConfig.enabled && (devToolsConfig.allowInProduction || process.env.NODE_ENV !== "production");
}

export function canShowDevLogin() {
  return devToolsConfig.showLogin;
}

export function canShowDevOverlay(user) {
  return canShowDeveloperOnlyControls() && devToolsConfig.showOverlay && Boolean(user);
}

export function canShowDevSidebarItems(user) {
  return canUseDevToolsInCurrentEnv() && devToolsConfig.showSidebarItems && Boolean(user);
}

export function canShowDevPages() {
  return canUseDevToolsInCurrentEnv() && devToolsConfig.showPages;
}
