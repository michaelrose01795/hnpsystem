// file location: src/lib/api/client.js
import { buildApiUrl } from "@/utils/apiClient";

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => searchParams.append(key, entry));
      return;
    }
    searchParams.append(key, value);
  });
  const stringified = searchParams.toString();
  return stringified ? `?${stringified}` : "";
};

const parseJson = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    return await response.json();
  } catch (error) {
    console.error("⚠️ Failed to parse API response JSON", error);
    return null;
  }
};

export const apiRequest = async (
  path,
  { method = "GET", headers = {}, body, searchParams } = {}
) => {
  if (!path) {
    throw new Error("API path is required");
  }

  const query = searchParams ? buildQueryString(searchParams) : "";
  const url = buildApiUrl(`${path}${query}`);

  const requestInit = {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(url, requestInit);
  const payload = await parseJson(response);

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};
