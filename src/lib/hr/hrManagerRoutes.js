// Canonical HR Manager route helpers. Standalone HR pages redirect here while
// their implementation components continue to render inside the manager tabs.

export const HR_MANAGER_PATH = "/hr/manager";

export const HR_MANAGER_TAB_IDS = Object.freeze([
  "dashboard",
  "employees",
  "attendance",
  "payroll",
  "leave",
  "performance",
  "training",
  "disciplinary",
  "recruitment",
  "reports",
  "settings",
]);

export function normalizeHrManagerTab(tab) {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return HR_MANAGER_TAB_IDS.includes(value) ? value : "dashboard";
}

export function buildHrManagerTabHref(tab = "dashboard") {
  const normalizedTab = normalizeHrManagerTab(tab);
  return normalizedTab === "dashboard"
    ? HR_MANAGER_PATH
    : `${HR_MANAGER_PATH}?tab=${encodeURIComponent(normalizedTab)}`;
}

export function redirectToHrManagerTab(tab = "dashboard") {
  return {
    redirect: {
      destination: buildHrManagerTabHref(tab),
      permanent: false,
    },
  };
}
