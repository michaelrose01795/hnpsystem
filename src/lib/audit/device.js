const firstMatch = (value, patterns, fallback = null) => {
  for (const [name, pattern] of patterns) {
    const match = String(value || "").match(pattern);
    if (match) return { name, version: match[1] || null };
  }
  return fallback;
};

export function parseUserAgent(userAgent = "", clientHints = {}) {
  const ua = String(userAgent || "");
  const browser = firstMatch(ua, [
    ["Edge", /EdgA?\/([\d.]+)/],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
    ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
  ], { name: "Unknown", version: null });

  const os = firstMatch(ua, [
    ["Windows", /Windows NT ([\d.]+)/],
    ["iOS", /(?:CPU (?:iPhone )?OS|iPhone OS) ([\d_]+)/],
    ["Android", /Android ([\d.]+)/],
    ["macOS", /Mac OS X ([\d_]+)/],
    ["ChromeOS", /CrOS [^ ]+ ([\d.]+)/],
    ["Linux", /Linux(?: ([\d.]+))?/],
  ], { name: "Unknown", version: null });

  const mobile = /Mobi|iPhone|Android.*Mobile/i.test(ua);
  const tablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua);
  const touchPoints = Number(clientHints.maxTouchPoints || 0);
  const compactScreen = Number(clientHints.screenWidth || 0) > 0 &&
    Number(clientHints.screenWidth) <= 1024;

  let deviceCategory = "desktop";
  if (mobile) deviceCategory = "mobile";
  else if (tablet || (touchPoints > 1 && compactScreen)) deviceCategory = "tablet";
  else if (touchPoints > 0 || clientHints.isLaptop === true) deviceCategory = "laptop";

  return {
    deviceCategory,
    operatingSystem: os.version
      ? `${os.name} ${String(os.version).replace(/_/g, ".")}`
      : os.name,
    browserName: browser.name,
    browserVersion: browser.version,
  };
}

export function detectAppMode() {
  if (typeof window === "undefined") return "browser";
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return "pwa";
  if (window.navigator?.standalone === true) return "pwa";
  if (document.referrer?.startsWith("android-app://")) return "installed_app";
  return "browser";
}

export function getClientDeviceHints() {
  if (typeof window === "undefined") return {};
  return {
    maxTouchPoints: navigator.maxTouchPoints || 0,
    screenWidth: window.screen?.width || window.innerWidth || 0,
    screenHeight: window.screen?.height || window.innerHeight || 0,
  };
}
