// file location: src/lib/api/parts.js
import { apiRequest } from "@/lib/api/client";

const withSearchParams = (params = {}) => ({ searchParams: params });

export const searchPartsCatalog = (params = {}) =>
  apiRequest("/api/parts/catalog", withSearchParams(params));

export const fetchPartsInventory = (params = {}) =>
  apiRequest("/api/parts/inventory", withSearchParams(params));

export const createInventoryPart = (payload) =>
  apiRequest("/api/parts/inventory", {
    method: "POST",
    body: payload,
  });

export const fetchPartsDeliveries = (params = {}) =>
  apiRequest("/api/parts/deliveries", withSearchParams(params));

export const createPartsDelivery = (payload) =>
  apiRequest("/api/parts/deliveries", {
    method: "POST",
    body: payload,
  });

export const updatePartsDelivery = (deliveryId, payload) =>
  apiRequest(`/api/parts/deliveries/${encodeURIComponent(deliveryId)}`, {
    method: "PUT",
    body: payload,
  });

export const fetchJobParts = (params = {}) =>
  apiRequest("/api/parts/jobs", withSearchParams(params));

export const getJobPart = (jobPartId) =>
  apiRequest(`/api/parts/jobs/${encodeURIComponent(jobPartId)}`);

export const updateJobPart = (jobPartId, payload) =>
  apiRequest(`/api/parts/jobs/${encodeURIComponent(jobPartId)}`, {
    method: "PUT",
    body: payload,
  });

export const allocatePartToRequest = (payload) =>
  apiRequest("/api/parts/allocate-to-request", {
    method: "POST",
    body: payload,
  });

export const fetchPartsOrders = (params = {}) =>
  apiRequest("/api/parts/orders", withSearchParams(params));

export const fetchDeliveryJobs = (params = {}) =>
  apiRequest("/api/parts/delivery-jobs", withSearchParams(params));

export const updateDeliveryJob = (jobId, payload) =>
  apiRequest(`/api/parts/delivery-jobs/${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    body: payload,
  });
