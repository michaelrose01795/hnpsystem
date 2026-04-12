// file location: src/lib/dev-tools/config.js

export const devToolsConfig = {
  enabled: true,
  allowInProduction: true,
  showLogin: true,
  showOverlay: true,
  showSidebarItems: true,
  showPages: true,
};

export function canUseDevToolsInCurrentEnv() {
  return devToolsConfig.enabled && (devToolsConfig.allowInProduction || process.env.NODE_ENV !== "production");
}

export function canShowDevLogin() {
  return devToolsConfig.showLogin;
}

export function canShowDevOverlay(user) {
  return canUseDevToolsInCurrentEnv() && devToolsConfig.showOverlay && Boolean(user);
}

export function canShowDevSidebarItems(user) {
  return canUseDevToolsInCurrentEnv() && devToolsConfig.showSidebarItems && Boolean(user);
}

export function canShowDevPages() {
  return canUseDevToolsInCurrentEnv() && devToolsConfig.showPages;
}
