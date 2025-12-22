// file location: src/hooks/api/usePartsApi.js
import { useMemo } from "react";
import {
  allocatePartToRequest,
  createInventoryPart,
  createPartsDelivery,
  fetchDeliveryJobs,
  fetchJobParts,
  fetchPartsOrders,
  fetchPartsDeliveries,
  fetchPartsInventory,
  getJobPart,
  searchPartsCatalog,
  updateDeliveryJob,
  updateJobPart,
  updatePartsDelivery,
} from "@/lib/api/parts";

export const usePartsApi = () =>
  useMemo(
    () => ({
      searchCatalog: searchPartsCatalog,
      listInventory: fetchPartsInventory,
      createInventoryPart,
      listDeliveries: fetchPartsDeliveries,
      createDelivery: createPartsDelivery,
      updateDelivery: updatePartsDelivery,
      listJobParts: fetchJobParts,
      getJobPart,
      updateJobPart,
      allocatePartToRequest,
      listOrders: fetchPartsOrders,
      listDeliveryJobs: fetchDeliveryJobs,
      updateDeliveryJob,
    }),
    []
  );

export default usePartsApi;
