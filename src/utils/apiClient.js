// file location: src/utils/apiClient.js

const normalizeLeadingSlash = (path) => {
  if (!path) {
    return "/";
  }
  return path.startsWith("/") ? path : `/${path}`;
};

const normalizeBasePath = (basePathValue) => {
  if (!basePathValue || basePathValue === "/") {
    return "";
  }
  const trimmed = basePathValue.trim().replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
const externalApiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");

export const buildApiUrl = (pathname) => {
  const normalizedPath = normalizeLeadingSlash(pathname);
  if (externalApiBase) {
    return `${externalApiBase}${normalizedPath}`;
  }
  if (!basePath) {
    return normalizedPath;
  }
  return `${basePath}${normalizedPath}`.replace(/\/{2,}/g, "/");
};
