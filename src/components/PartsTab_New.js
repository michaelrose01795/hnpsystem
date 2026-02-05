// ✅ New Parts Tab with Drag & Drop Allocation
// file location: src/components/PartsTab_New.js
import React, { useState, useCallback, useEffect, useMemo, forwardRef } from "react";
import CalendarField from "@/components/calendarAPI/CalendarField";
import TimePickerField from "@/components/timePickerAPI/TimePickerField";
import { DropdownField } from "@/components/dropdownAPI";
import ModalPortal from "@/components/popups/ModalPortal";

// Helper functions (keep existing)
const normalizePartStatus = (status = "") => {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  if (["pending"].includes(normalized)) return "pending";
  if (["priced"].includes(normalized)) return "priced";
  if (["pre_pick", "pre-pick", "picked"].includes(normalized)) return "pre_pick";
  if (["on_order", "on-order", "awaiting_stock", "order", "ordered"].includes(normalized)) return "on_order";
  if (["booked"].includes(normalized)) return "booked";
  if (["removed"].includes(normalized)) return "removed";
  if (["reserved"].includes(normalized)) return "reserved";
  if (["stock", "allocated", "fitted", "reserved"].includes(normalized)) return "stock";
  return "pending";
};

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "—";
  return moneyFormatter.format(amount);
};

const PRE_PICK_OPTIONS = [
  { value: "", label: "Not assigned" },
  { value: "service_rack_1", label: "Service Rack 1" },
  { value: "service_rack_2", label: "Service Rack 2" },
  { value: "service_rack_3", label: "Service Rack 3" },
  { value: "service_rack_4", label: "Service Rack 4" },
  { value: "sales_rack_1", label: "Sales Rack 1" },
  { value: "sales_rack_2", label: "Sales Rack 2" },
  { value: "sales_rack_3", label: "Sales Rack 3" },
  { value: "sales_rack_4", label: "Sales Rack 4" },
  { value: "stairs_pre_pick", label: "Stairs Pre-Pick" },
  { value: "no_pick", label: "No Pick" },
  { value: "on_order", label: "On Order" },
];

const PartsTabNew = forwardRef(function PartsTabNew(
  { jobData, canEdit, onRefreshJob, actingUserId, actingUserNumericId, invoiceReady },
  _ref
) {
  const jobId = jobData?.id;
  const jobNumber = jobData?.jobNumber;

  // State for part search
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [selectedCatalogPart, setSelectedCatalogPart] = useState(null);
  const [catalogQuantity, setCatalogQuantity] = useState(1);
  const [catalogSubmitError, setCatalogSubmitError] = useState("");
  const [catalogSuccessMessage, setCatalogSuccessMessage] = useState("");
  const [allocatingPart, setAllocatingPart] = useState(false);
  const [addJobDiagnostics, setAddJobDiagnostics] = useState(null);
  const [showBookPartPanel, setShowBookPartPanel] = useState(false);
  const [showAllocatePanel, setShowAllocatePanel] = useState(false);
  const [assignMode, setAssignMode] = useState(false);
  const [assignTargetRequestId, setAssignTargetRequestId] = useState(null);

  const [partAllocations, setPartAllocations] = useState({});
  const [selectedPartIds, setSelectedPartIds] = useState([]);
  const [allocatingSelection, setAllocatingSelection] = useState(false);

  // State for parts on order - initialized from jobData, refreshed in background
  const [partsOnOrderFromDB, setPartsOnOrderFromDB] = useState([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);


  // State for removed parts (shown with strikethrough)
  const [removedPartIds, setRemovedPartIds] = useState([]);
  // State for part removal popup
  const [partPopup, setPartPopup] = useState({ open: false, part: null });
  // State for tracking parts marked as arrived (before API call completes)
  const [arrivedPartIds, setArrivedPartIds] = useState([]);
  const [removingPart, setRemovingPart] = useState(false);
  const canAllocateParts = Boolean(canEdit && jobId);
  const allocationDisabledReason = !canEdit
    ? "You don't have permission to add parts."
    : !jobId
    ? "Job must be loaded before allocating parts."
    : "";

  // Debug: Log parts data received from server
  useEffect(() => {
    if (jobId) {
      console.log("[PartsTab] Data received:", {
        jobId,
        partsAllocations: jobData?.partsAllocations?.length || 0,
        parts_job_items: jobData?.parts_job_items?.length || 0,
        removedParts: (jobData?.parts_job_items || []).filter((item) =>
          String(item?.status || "").toLowerCase() === "removed"
        ).length,
      });
    }
  }, [jobId, jobData?.partsAllocations, jobData?.parts_job_items]);

  // Get all parts added to the job (from allocations, parts_job_items, and locally added)
  const jobParts = useMemo(() => {
    // Start with partsAllocations
    const allocations = (Array.isArray(jobData.partsAllocations) ? jobData.partsAllocations : []).map((item) => ({
      id: item.id,
      partId: item.part?.id || item.partId,
      partNumber: item.part?.partNumber || item.part?.part_number || "N/A",
      name: item.part?.name || "Part",
      description: item.part?.description || "",
      quantity: item.quantityRequested ?? item.quantityAllocated ?? 0,
      unitPrice: item.part?.unit_price ?? item.part?.unitPrice ?? 0,
      unitCost: item.part?.unit_cost ?? item.part?.unitCost ?? 0,
      qtyInStock: item.part?.qty_in_stock ?? item.part?.qtyInStock ?? 0,
      storageLocation: item.storageLocation || item.part?.storage_location || "Not assigned",
      status: item.status || "pending",
      allocatedToRequestId: item.allocatedToRequestId || null,
      vhcItemId: item.vhc_item_id || item.vhcItemId || null,
      createdAt: item.createdAt,
      source: "allocation",
      origin: item.origin || "",
      eta_date: item.eta_date || item.etaDate || null,
      eta_time: item.eta_time || item.etaTime || null,
      supplier_reference: item.supplier_reference || item.supplierReference || null,
      prePickLocation: item.pre_pick_location || item.prePickLocation || null,
      part: item.part,
    }));

    // Also include parts_job_items (which includes VHC parts with origin field)
    const jobItems = (Array.isArray(jobData.parts_job_items) ? jobData.parts_job_items : [])
      .filter(Boolean)
      .map((item) => {
        // Handle both 'part' and 'parts_catalog' field names (API uses parts_catalog)
        const partData = item.part || item.parts_catalog;
        return {
          id: item.id,
          partId: partData?.id || item.part_id,
          partNumber: partData?.part_number || partData?.partNumber || "N/A",
          name: partData?.name || "Part",
          description: partData?.description || "",
          quantity: item.quantity_requested ?? item.quantityRequested ?? 1,
          unitPrice: item.unit_price ?? partData?.unit_price ?? 0,
          unitCost: item.unit_cost ?? partData?.unit_cost ?? 0,
          qtyInStock: partData?.qty_in_stock ?? 0,
          storageLocation: item.storage_location || item.storageLocation || partData?.storage_location || "Not assigned",
          status: item.status || "pending",
          allocatedToRequestId: item.allocated_to_request_id || item.allocatedToRequestId || null,
          vhcItemId: item.vhc_item_id || item.vhcItemId || null,
          createdAt: item.created_at || item.createdAt,
          source: "job_item",
          origin: item.origin || "",
          eta_date: item.eta_date || null,
          eta_time: item.eta_time || null,
          supplier_reference: item.supplier_reference || null,
          prePickLocation: item.pre_pick_location || item.prePickLocation || null,
          part: partData,
        };
      });

    // Merge allocations and job items
    const allParts = [...allocations, ...jobItems];

    // Deduplicate by id - prefer server data over local
    const uniqueParts = allParts.reduce((acc, part) => {
      if (!acc.some(p => p.id === part.id)) {
        acc.push(part);
      }
      return acc;
    }, []);

    return uniqueParts;
  }, [jobData.partsAllocations, jobData.parts_job_items]);

  const goodsInParts = useMemo(() => {
    const existingGoodsInPartIds = new Set(
      (Array.isArray(jobData.parts_job_items) ? jobData.parts_job_items : [])
        .filter((item) => item?.origin === "goods-in")
        .map((item) => String(item.part_id))
        .filter(Boolean)
    );

    return (Array.isArray(jobData.goodsInParts) ? jobData.goodsInParts : [])
      .filter((item) => item.addedToJob !== false)
      .filter((item) => {
        const partKey = item.partCatalogId || item.part_catalog_id || null;
        if (!partKey) return true;
        return !existingGoodsInPartIds.has(String(partKey));
      })
      .map((item) => ({
        id: `goods-in-${item.id}`,
        goodsInItemId: item.id,
        partCatalogId: item.partCatalogId || item.part_catalog_id || null,
        partId: item.partCatalogId || item.part_catalog_id || null,
        partNumber: item.partNumber || item.part_number || "N/A",
        name: item.partNumber || item.description || "Part",
        description: item.description || "",
        quantity: item.quantity ?? 0,
        unitPrice: item.retailPrice ?? item.retail_price ?? 0,
        unitCost: item.costPrice ?? item.cost_price ?? 0,
        qtyInStock: null,
        storageLocation: item.binLocation || item.bin_location || "Not assigned",
        status: "stock",
        allocatedToRequestId: null,
        createdAt: item.createdAt,
        source: "goods-in",
      }));
  }, [jobData.goodsInParts, jobData.parts_job_items]);

  // Get customer requests and authorized work
  const allRequests = useMemo(() => {
    // Prefer jobRequests/job_requests from the database (has proper request_id)
    const requestsSource = Array.isArray(jobData.jobRequests)
      ? jobData.jobRequests
      : Array.isArray(jobData.job_requests)
      ? jobData.job_requests
      : Array.isArray(jobData.requests)
      ? jobData.requests
      : [];

    const customerReqs = requestsSource
      .filter((req) => {
        // Only include customer requests that have a valid database ID
        const id = req.request_id || req.requestId;
        const source = req.request_source || req.requestSource || "customer_request";
        return id != null && source === "customer_request";
      })
      .map((req) => ({
        id: req.request_id || req.requestId,
        type: "customer",
        description: typeof req === "string" ? req : req.text || req.description || "",
        jobType: req.job_type || req.jobType || "Customer",
        hours: req.hours || null,
      }));

    // VHC authorized work - use canonical pre-joined data from server
    const vhcReqs = (Array.isArray(jobData.authorizedVhcItems) ? jobData.authorizedVhcItems : [])
      .map((item) => ({
        id: `vhc-${item.vhcItemId}`,
        type: "vhc",
        description: item.description || "VHC Item",
        section: item.section || "",
        severity: "authorized",
        vhcItemId: item.vhcItemId,
      }));

    const allReqs = [...customerReqs, ...vhcReqs];
    console.log("[PartsTab] All requests:", allReqs);
    console.log("[PartsTab] VHC requests:", vhcReqs);
    return allReqs;
  }, [jobData.jobRequests, jobData.job_requests, jobData.requests, jobData.authorizedVhcItems]);

  // Group parts by allocated request (including VHC items)
  useEffect(() => {
    const allocations = {};
    jobParts.forEach((part) => {
      // Check for regular job request allocation
      if (part.allocatedToRequestId) {
        if (!allocations[part.allocatedToRequestId]) {
          allocations[part.allocatedToRequestId] = [];
        }
        allocations[part.allocatedToRequestId].push(part);
      }
      // Check for VHC item allocation (use "vhc-{id}" format to match request.id)
      if (part.vhcItemId) {
        const vhcKey = `vhc-${part.vhcItemId}`;
        if (!allocations[vhcKey]) {
          allocations[vhcKey] = [];
        }
        allocations[vhcKey].push(part);
      }
    });
    console.log("[PartsTab] Part allocations grouped:", allocations);
    console.log("[PartsTab] Sample parts with vhcItemId:", jobParts.filter(p => p.vhcItemId).slice(0, 3));
    setPartAllocations(allocations);
  }, [jobParts]);

  const vhcPartsByItemId = useMemo(() => {
    const map = new Map();
    jobParts.forEach((part) => {
      if (!part.vhcItemId) return;
      const key = String(part.vhcItemId);
      const existing = map.get(key) || [];
      existing.push(part);
      map.set(key, existing);
    });
    return map;
  }, [jobParts]);

  // Set of part numbers that exist in PARTS ADDED TO JOB (non-on_order status)
  // Used to auto-detect "arrived" parts in the ON ORDER section
  const arrivedPartNumbers = useMemo(() => {
    const partNumbers = new Set();
    jobParts.forEach((part) => {
      const status = normalizePartStatus(part.status);
      // If part is NOT on_order, it's considered "arrived" (booked, stock, allocated, etc.)
      if (status !== "on_order" && part.partNumber && part.partNumber !== "N/A") {
        partNumbers.add(part.partNumber.toLowerCase().trim());
      }
    });
    return partNumbers;
  }, [jobParts]);

  // Parts on order - derived from jobData (loads immediately with job card)
  const partsOnOrderFromJobData = useMemo(
    () => {
      const filtered = jobParts.filter((part) => {
        const partStatus = normalizePartStatus(part.status);
        return partStatus === "on_order" || partStatus === "booked";
      });

      // Transform to match the API response format
      return filtered.map((part) => ({
        id: part.id,
        partId: part.partId,
        partNumber: part.partNumber,
        partName: part.name || part.description,
        quantity: part.quantity,
        unitPrice: part.unitPrice,
        unitCost: part.unitCost,
        etaDate: part.eta_date || null,
        etaTime: part.eta_time || null,
        supplierReference: part.supplier_reference || null,
        status: part.status,
      }));
    },
    [jobParts]
  );

  // Initialize partsOnOrderFromDB with jobData on first load
  useEffect(() => {
    if (!initialLoadComplete && partsOnOrderFromJobData.length > 0) {
      setPartsOnOrderFromDB(partsOnOrderFromJobData);
    }
  }, [partsOnOrderFromJobData, initialLoadComplete]);

  // Background fetch - no loading indicator shown
  const fetchPartsOnOrderBackground = useCallback(async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`/api/parts/on-order?jobId=${jobId}`);
      const data = await response.json();

      if (response.ok && data.parts) {
        setPartsOnOrderFromDB(data.parts);
        setInitialLoadComplete(true);
      }
    } catch (error) {
      // Silent fail for background refresh - keep existing data
      console.error("Background refresh failed:", error);
    }
  }, [jobId]);

  // Initial fetch and periodic background refresh
  useEffect(() => {
    if (!jobId) return;

    // Initial background fetch
    fetchPartsOnOrderBackground();

    // Set up background polling every 30 seconds
    const intervalId = setInterval(() => {
      fetchPartsOnOrderBackground();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [jobId, fetchPartsOnOrderBackground]);

  // Legacy alias for compatibility with existing handlers
  const fetchPartsOnOrder = fetchPartsOnOrderBackground;


  // Handler for updating ETA date/time
  const handleUpdateETA = useCallback(async (partId, field, value) => {
    if (!partId || !jobId) return;

    try {
      const payload = { partItemId: partId };
      if (field === "etaDate") {
        payload.etaDate = value;
      } else if (field === "etaTime") {
        payload.etaTime = value;
      }

      const response = await fetch("/api/parts/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update ETA");
      }

      // Refresh parts on order list
      await fetchPartsOnOrder();
    } catch (error) {
      console.error("Failed to update ETA:", error);
      alert(`Error: ${error.message}`);
    }
  }, [jobId, fetchPartsOnOrder]);

  // Handler for marking part as arrived (from "on order" to "stock")
  const handlePartArrived = useCallback(async (partAllocationId) => {
    if (!partAllocationId || !jobId) return;

    try {
      const response = await fetch("/api/parts/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partItemId: partAllocationId,
          status: "stock",
          stockStatus: "in_stock",
          etaDate: null,
          etaTime: null,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update part status");
      }

      // Refresh parts on order list
      await fetchPartsOnOrder();

      if (typeof onRefreshJob === "function") {
        onRefreshJob();
      }
    } catch (error) {
      console.error("Failed to mark part as arrived:", error);
      alert(`Error: ${error.message}`);
    }
  }, [jobId, onRefreshJob, fetchPartsOnOrder]);

  const togglePartSelection = useCallback((partId) => {
    setSelectedPartIds((prev) => {
      if (prev.includes(partId)) {
        return prev.filter((entry) => entry !== partId);
      }
      return [...prev, partId];
    });
  }, []);

  // Search stock catalog
  const searchStockCatalog = useCallback(async (term) => {
    const rawTerm = (term || "").trim();
    if (!rawTerm) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }

    setCatalogLoading(true);
    try {
      const params = new URLSearchParams({
        search: rawTerm,
        limit: "25",
      });
      const response = await fetch(`/api/parts/catalog?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Unable to search stock catalogue");
      }

      const results = Array.isArray(payload.parts) ? payload.parts : [];
      setCatalogResults(results);
      setCatalogError(results.length === 0 ? "No parts found in stock catalogue." : "");
    } catch (error) {
      console.error("Stock search failed", error);
      setCatalogResults([]);
      setCatalogError(error.message || "Unable to search stock catalogue");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canAllocateParts) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }
    const trimmed = (catalogSearch || "").trim();
    if (!trimmed) {
      setCatalogResults([]);
      setCatalogError("");
      return;
    }
    if (trimmed.length < 2) {
      setCatalogResults([]);
      setCatalogError("Enter at least 2 characters to search stock.");
      return;
    }
    const timer = setTimeout(() => searchStockCatalog(trimmed), 300);
    return () => clearTimeout(timer);
  }, [catalogSearch, canAllocateParts, searchStockCatalog]);

  const handleCatalogSelect = useCallback((part) => {
    if (!part) return;
    setSelectedCatalogPart(part);
    setCatalogQuantity(1);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
  }, []);

  const clearSelectedCatalogPart = useCallback(() => {
    setSelectedCatalogPart(null);
    setCatalogQuantity(1);
    setCatalogSubmitError("");
    // Note: Don't clear success message here - it's cleared when selecting a new part
  }, []);

  const toggleBookPartPanel = useCallback(() => {
    setShowBookPartPanel((prev) => !prev);
  }, []);

  const toggleAllocatePanel = useCallback(() => {
    setShowAllocatePanel((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!canAllocateParts) {
      setCatalogSearch("");
      clearSelectedCatalogPart();
      setCatalogSuccessMessage("");
      setCatalogSubmitError("");
    }
  }, [canAllocateParts, clearSelectedCatalogPart]);

  const handleAddPartFromStock = useCallback(async () => {
    if (!canAllocateParts || !selectedCatalogPart || !jobId) {
      setCatalogSubmitError("Select a part to allocate from stock.");
      setAddJobDiagnostics({
        startedAt: new Date().toISOString(),
        stage: "validation",
        reason: !canAllocateParts
          ? "No permission"
          : !jobId
          ? "Missing job"
          : "No part selected",
      });
      console.warn("[PartsTab] Add to job blocked:", {
        canAllocateParts,
        jobId,
        selectedCatalogPart,
      });
      return;
    }
    if (catalogQuantity <= 0) {
      setCatalogSubmitError("Quantity must be at least 1.");
      setAddJobDiagnostics({
        startedAt: new Date().toISOString(),
        stage: "validation",
        reason: "Quantity must be at least 1",
        jobId,
        jobNumber,
        partId: selectedCatalogPart.id,
        partNumber: selectedCatalogPart.part_number,
        quantity: catalogQuantity,
      });
      console.warn("[PartsTab] Add to job blocked: invalid quantity", {
        jobId,
        partId: selectedCatalogPart.id,
        quantity: catalogQuantity,
      });
      return;
    }
    const availableStock = Number(selectedCatalogPart.qty_in_stock || 0);
    if (catalogQuantity > availableStock) {
      setCatalogSubmitError(`Only ${availableStock} in stock for this part.`);
      setAddJobDiagnostics({
        startedAt: new Date().toISOString(),
        stage: "validation",
        reason: "Insufficient stock",
        jobId,
        jobNumber,
        partId: selectedCatalogPart.id,
        partNumber: selectedCatalogPart.part_number,
        quantity: catalogQuantity,
        availableStock,
      });
      console.warn("[PartsTab] Add to job blocked: insufficient stock", {
        jobId,
        partId: selectedCatalogPart.id,
        quantity: catalogQuantity,
        availableStock,
      });
      return;
    }

    setAllocatingPart(true);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
    try {
      setAddJobDiagnostics({
        startedAt: new Date().toISOString(),
        jobId,
        jobNumber,
        partId: selectedCatalogPart.id,
        partNumber: selectedCatalogPart.part_number,
        quantity: catalogQuantity,
        stage: "request",
      });

      const response = await fetch("/api/parts/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          partId: selectedCatalogPart.id,
          quantityRequested: catalogQuantity,
          allocateFromStock: true,
          storageLocation: selectedCatalogPart.storage_location || null,
          requestNotes: jobNumber ? `Added via job card ${jobNumber}` : "Added via job card",
          origin: "job_card",
          userId: actingUserId,
          userNumericId: actingUserNumericId,
        }),
      });

      const data = await response.json();
      console.info("[PartsTab] Add to job response", {
        ok: response.ok,
        status: response.status,
        body: data,
      });
      if (!response.ok || !data.success) {
        setAddJobDiagnostics((prev) => ({
          ...prev,
          stage: "error",
          responseStatus: response.status,
          responseBody: data,
        }));
        throw new Error(data.message || `Failed to allocate part from stock (HTTP ${response.status})`);
      }

      setAddJobDiagnostics((prev) => ({
        ...prev,
        stage: "success",
        responseStatus: response.status,
        responseBody: data,
        jobPartId: data?.jobPart?.id || null,
      }));

      const partName = selectedCatalogPart.part_number || selectedCatalogPart.name;
      clearSelectedCatalogPart();
      setCatalogSuccessMessage(`${partName} added to job.`);

      // Refresh job data in background to sync with database
      if (typeof onRefreshJob === "function") {
        onRefreshJob(); // Don't await - let it refresh in background
      }
      if ((catalogSearch || "").trim().length >= 2) {
        searchStockCatalog(catalogSearch.trim());
      }
    } catch (error) {
      console.error("Unable to add part from stock", error);
      setCatalogSubmitError(error.message || "Unable to add part to job");
      setAddJobDiagnostics((prev) => ({
        ...prev,
        stage: prev?.stage === "error" ? "error" : "exception",
        error: error?.message || String(error),
      }));
    } finally {
      setAllocatingPart(false);
    }
  }, [
    actingUserId,
    actingUserNumericId,
    canAllocateParts,
    catalogQuantity,
    catalogSearch,
    clearSelectedCatalogPart,
    jobId,
    jobNumber,
    onRefreshJob,
    searchStockCatalog,
    selectedCatalogPart,
  ]);

  const handleUpdatePrePickLocation = useCallback(
    async (part, location) => {
      if (!canEdit || !part?.id || part.source === "goods-in") return;

      try {
        const response = await fetch("/api/parts/update-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partItemId: part.id,
            prePickLocation: location || null,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to update pre-pick location");
        }

        if (typeof onRefreshJob === "function") {
          onRefreshJob();
        }
      } catch (error) {
        console.error("Failed to update pre-pick location:", error);
        alert(`Error: ${error.message}`);
      }
    },
    [canEdit, onRefreshJob]
  );

  const openStockCatalogue = useCallback((partNumber) => {
    if (!partNumber || partNumber === "N/A") return;
    if (typeof window === "undefined") return;
    const encoded = encodeURIComponent(partNumber);
    window.open(`/stock-catalogue?partNumber=${encoded}`, "_blank", "noopener");
  }, []);

  // Get unallocated booked parts only
  const bookedParts = jobParts.filter(
    (part) => normalizePartStatus(part.status) === "booked"
  );
  const removedParts = jobParts.filter(
    (part) => normalizePartStatus(part.status) === "removed"
  );
  const unallocatedParts = bookedParts.filter((part) => !part.allocatedToRequestId);
  const leftPanelParts = [...bookedParts, ...removedParts];

  useEffect(() => {
    if (!jobId) return;
    const removedFromDb = (jobData?.parts_job_items || []).filter(
      (item) => String(item?.status || "").toLowerCase() === "removed"
    );
    console.info("[PartsTab] Parts Added filter snapshot", {
      jobId,
      totalPartsJobItems: (jobData?.parts_job_items || []).length,
      removedFromDb: removedFromDb.map((item) => ({ id: item.id, status: item.status })),
      bookedCount: bookedParts.length,
      leftPanelCount: leftPanelParts.length,
    });
  }, [jobId, jobData?.parts_job_items, bookedParts.length, leftPanelParts.length]);

  const createJobItemFromGoodsIn = useCallback(
    async (part) => {
      if (!jobId) {
        throw new Error("Job must be loaded before allocating parts.");
      }

      let resolvedPartId = part?.partId;

      if (!resolvedPartId && part?.partNumber && part.partNumber !== "N/A") {
        const params = new URLSearchParams({ partNumber: part.partNumber });
        const lookupResponse = await fetch(`/api/parts/catalog?${params.toString()}`);
        const lookupPayload = await lookupResponse.json();
        if (lookupResponse.ok && lookupPayload?.success && lookupPayload?.part?.id) {
          resolvedPartId = lookupPayload.part.id;
        }
      }

      if (!resolvedPartId) {
        throw new Error("Goods-in part is missing a catalog link.");
      }

      const response = await fetch("/api/parts/job-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          partId: resolvedPartId,
          status: "booked",
          quantityRequested: part.quantity ?? 0,
          quantityAllocated: part.quantity ?? 0,
          unitCost: part.unitCost ?? 0,
          unitPrice: part.unitPrice ?? 0,
          storageLocation: part.storageLocation || null,
          origin: "goods-in",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || "Failed to create job item");
      }

      return data?.data?.id || null;
    },
    [jobId]
  );

  const handleAssignSelectedToRequest = useCallback(
    async (requestId) => {
      if (!canEdit || !requestId) return;

      if (!assignMode || assignTargetRequestId !== requestId) {
        setAssignMode(true);
        setAssignTargetRequestId(requestId);
        return;
      }

      if (selectedPartIds.length === 0) {
        alert("Select at least one part to assign.");
        return;
      }

      const selectedParts = leftPanelParts.filter((part) => selectedPartIds.includes(part.id));

      setAllocatingSelection(true);
      try {
        await Promise.all(
          selectedParts.map(async (part) => {
            let partAllocationId = part.id;

            if (part.source === "goods-in") {
              const existing = jobParts.find(
                (jobPart) =>
                  jobPart.origin === "goods-in" &&
                  jobPart.partId &&
                  part.partId &&
                  String(jobPart.partId) === String(part.partId) &&
                  !jobPart.allocatedToRequestId
              );

              partAllocationId = existing?.id || (await createJobItemFromGoodsIn(part));
            }

            if (!partAllocationId) {
              throw new Error("Unable to allocate selected part.");
            }

            const requestPayload = {
              partAllocationId,
              requestId,
              jobId,
            };
            console.log("[PartsTab] Allocating part:", requestPayload);

            const response = await fetch("/api/parts/allocate-to-request", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestPayload),
            });

            const data = await response.json();
            console.log("[PartsTab] Allocation response:", data);
            if (!response.ok || !data.success) {
              throw new Error(data.message || "Failed to allocate part to request");
            }
          })
        );

        setSelectedPartIds([]);
        setAssignMode(false);
        setAssignTargetRequestId(null);
        if (typeof onRefreshJob === "function") {
          onRefreshJob();
        }
      } catch (error) {
        console.error("Failed to allocate parts to request:", error);
        alert(`Error: ${error.message}`);
      } finally {
        setAllocatingSelection(false);
      }
    },
    [
      assignMode,
      assignTargetRequestId,
      canEdit,
      createJobItemFromGoodsIn,
      jobParts,
      jobId,
      leftPanelParts,
      onRefreshJob,
      selectedPartIds,
    ]
  );

  const handleUnassignPart = useCallback(
    async (partId) => {
      if (!canEdit || !partId) return;
      try {
        const response = await fetch(`/api/parts/job-items/${partId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          // Clear both allocated_to_request_id and vhc_item_id to handle both customer and VHC allocations
          body: JSON.stringify({ allocated_to_request_id: null, vhc_item_id: null }),
        });
        const data = await response.json();
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || data?.message || "Failed to unassign part");
        }
        if (typeof onRefreshJob === "function") {
          onRefreshJob();
        }
      } catch (error) {
        console.error("Failed to unassign part:", error);
        alert(`Error: ${error.message}`);
      }
    },
    [canEdit, onRefreshJob]
  );

  useEffect(() => {
    setSelectedPartIds((prev) => {
      const next = prev.filter((id) => leftPanelParts.some((part) => part.id === id));
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [leftPanelParts]);

  useEffect(() => {
    if (!showAllocatePanel) {
      setAssignMode(false);
      setAssignTargetRequestId(null);
      setSelectedPartIds([]);
    }
  }, [showAllocatePanel]);


  return (
    <>
      <style>{`
        /* Make compact calendar and time picker controls smaller */
        .compact-input .calendar-api__control,
        .compact-input .timepicker-api__control,
        .compact-input .dropdown-api__control {
          padding: 2px 6px !important;
          font-size: 10px !important;
          min-height: auto !important;
          border-radius: 6px !important;
          gap: 4px !important;
        }

        .compact-input .calendar-api__icon,
        .compact-input .timepicker-api__icon,
        .compact-input .dropdown-api__chevron {
          width: 12px !important;
          height: 12px !important;
        }

        .compact-input .calendar-api__value,
        .compact-input .timepicker-api__value,
        .compact-input .dropdown-api__value {
          font-size: 10px !important;
        }

        /* ========================================
           On-Order Section Picker Centering
           ========================================
           The calendar/time picker menus need to be centered
           within the on-order section and appear above all content.

           Strategy:
           1. Make .on-order-section the ONLY positioning context
           2. Force all intermediate elements to position: static
           3. Use position: fixed on menus with calculated centering
        ======================================== */

        /* The on-order section is the positioning reference */
        .on-order-section {
          position: relative !important;
          z-index: 1;
        }

        /* Force ALL intermediate elements to static positioning
           so they don't create new positioning contexts */
        .on-order-section > div,
        .on-order-section table,
        .on-order-section thead,
        .on-order-section tbody,
        .on-order-section tr,
        .on-order-section th,
        .on-order-section td,
        .on-order-section .calendar-api,
        .on-order-section .timepicker-api,
        .on-order-section .compact-input,
        .on-order-section .compact-input > * {
          position: static !important;
        }

        /* When picker is open, create an overlay to capture the section bounds */
        .on-order-section .calendar-api.is-open,
        .on-order-section .timepicker-api.is-open {
          position: static !important;
        }

        /* The dropdown menu - positioned fixed in center of viewport
           but constrained visually to appear within the section */
        .on-order-section .calendar-api__menu,
        .on-order-section .timepicker-api__menu {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          z-index: 999999 !important;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.3) !important;
          max-height: 400px !important;
          background: var(--surface) !important;
          border-radius: 12px !important;
          border: 2px solid var(--primary) !important;
        }

        /* Calendar specific sizing */
        .on-order-section .calendar-api__menu {
          width: auto !important;
          min-width: 300px !important;
          padding: 16px !important;
        }

        /* Time picker specific sizing */
        .on-order-section .timepicker-api__menu {
          width: auto !important;
          min-width: 240px !important;
          padding: 16px !important;
        }

        /* Ensure menu content is scrollable if needed */
        .on-order-section .calendar-api__menu,
        .on-order-section .timepicker-api__menu {
          overflow: auto !important;
        }

        /* Time picker options scrolling */
        .on-order-section .timepicker-api__options {
          max-height: 200px !important;
          overflow-y: auto !important;
        }

        /* Optimize the on-order table to use maximum space */
        .on-order-table {
          font-size: 11px !important;
          table-layout: auto !important;
        }

        .on-order-table th {
          padding: 6px 8px !important;
          font-size: 10px !important;
          white-space: nowrap !important;
          font-weight: 700 !important;
        }

        .on-order-table td {
          padding: 6px 8px !important;
          font-size: 11px !important;
          vertical-align: middle !important;
        }

        .on-order-table button {
          padding: 4px 8px !important;
          font-size: 10px !important;
          white-space: nowrap !important;
        }

        /* Part Name column - max width with horizontal scroll */
        .on-order-table th:nth-child(1),
        .on-order-table td:nth-child(1) {
          max-width: 120px;
          width: 120px;
        }

        .on-order-table td:nth-child(1) .part-name-cell {
          max-width: 120px;
          overflow-x: auto;
          overflow-y: hidden;
          white-space: nowrap;
          display: block;
        }

        /* Part Number column */
        .on-order-table td:nth-child(2) {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Keep qty and price columns compact */
        .on-order-table th:nth-child(3),
        .on-order-table th:nth-child(4),
        .on-order-table td:nth-child(3),
        .on-order-table td:nth-child(4) {
          width: 60px;
        }

        /* ETA date and time columns */
        .on-order-table th:nth-child(5),
        .on-order-table th:nth-child(6),
        .on-order-table td:nth-child(5),
        .on-order-table td:nth-child(6) {
          width: 110px;
        }

        /* Action column */
        .on-order-table th:nth-child(7),
        .on-order-table td:nth-child(7) {
          width: 130px;
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div
          style={{
            borderRadius: "999px",
            border: "1px solid var(--surface-light)",
            background: "var(--layer-section-level-1)",
            padding: "6px",
            display: "flex",
            gap: "6px",
            width: "fit-content",
            maxWidth: "100%",
            overflowX: "auto",
            marginBottom: "14px",
          }}
        >
          <button
            type="button"
            onClick={toggleBookPartPanel}
            style={{
              padding: "10px 20px",
              borderRadius: "999px",
              border: "1px solid transparent",
              background: showBookPartPanel ? "var(--danger)" : "var(--danger-surface)",
              color: showBookPartPanel ? "var(--text-inverse)" : "var(--danger)",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
            }}
          >
            {showBookPartPanel ? "Hide Book Part" : "Book Part"}
          </button>
          <button
            type="button"
            onClick={toggleAllocatePanel}
            title="Show allocate-to-request panel"
            style={{
              padding: "10px 20px",
              borderRadius: "999px",
              border: "1px solid transparent",
              background: showAllocatePanel ? "var(--accent-purple)" : "var(--accent-purple-surface)",
              color: showAllocatePanel ? "var(--text-inverse)" : "var(--accent-purple)",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
            }}
          >
            {showAllocatePanel ? "Hide Allocate" : "Allocate To Request"}
          </button>
        </div>
        {/* Search Section */}
        {showBookPartPanel && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-light)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
        <div style={{ marginBottom: "12px" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Search Parts Stock
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--info-dark)" }}>
            Search and add parts to this job
          </p>
        </div>
        <input
          type="search"
          value={catalogSearch}
          disabled={!canAllocateParts}
          onChange={(e) => {
            setCatalogSearch(e.target.value);
            setCatalogSuccessMessage("");
            setCatalogSubmitError("");
          }}
          placeholder={canAllocateParts ? "Search by part number, name, supplier..." : "Search disabled"}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid var(--surface-light)",
            fontSize: "14px",
            backgroundColor: canAllocateParts ? "var(--surface)" : "var(--info-surface)",
            color: "var(--info-dark)",
          }}
        />
        {catalogLoading && <div style={{ fontSize: "13px", color: "var(--info)", marginTop: "8px" }}>Searching...</div>}
        {!catalogLoading && catalogError && (
          <div style={{ fontSize: "12px", color: "var(--danger)", marginTop: "8px" }}>{catalogError}</div>
        )}
        {canAllocateParts && !catalogLoading && catalogResults.length > 0 && (
          <div
            style={{
              maxHeight: "200px",
              overflowY: "auto",
              border: "1px solid var(--surface-light)",
              borderRadius: "10px",
              marginTop: "12px",
            }}
          >
            {catalogResults.map((part) => {
              const isSelected = selectedCatalogPart?.id === part.id;
              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => handleCatalogSelect(part)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "none",
                    borderBottom: "1px solid var(--surface-light)",
                    textAlign: "left",
                    background: isSelected ? "var(--accent-purple-surface)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--accent-purple)", fontSize: "14px" }}>{part.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--info-dark)" }}>
                    Part #: {part.part_number} · Supplier: {part.supplier || "Unknown"}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--info)" }}>
                    Stock: {part.qty_in_stock ?? 0} · £{Number(part.unit_price || 0).toFixed(2)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {selectedCatalogPart && (
          <div
            style={{
              border: "1px solid var(--accent-purple)",
              borderRadius: "10px",
              padding: "12px",
              background: "var(--accent-purple-surface)",
              marginTop: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--accent-purple)", fontSize: "14px" }}>{selectedCatalogPart.name}</div>
                <div style={{ fontSize: "12px", color: "var(--info-dark)" }}>
                  Part #: {selectedCatalogPart.part_number} · Location: {selectedCatalogPart.storage_location || "Unassigned"}
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelectedCatalogPart}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--info)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "var(--info-dark)", display: "block", marginBottom: "4px" }}>
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedCatalogPart.qty_in_stock || undefined}
                  value={catalogQuantity}
                  onChange={(e) => setCatalogQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: "6px",
                    border: "1px solid var(--surface-light)",
                    fontSize: "13px",
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--info-dark)", marginBottom: "4px" }}>Available</div>
                <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--accent-purple)" }}>
                  {selectedCatalogPart.qty_in_stock ?? 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--info-dark)", marginBottom: "4px" }}>Sell Price</div>
                <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--accent-purple)" }}>
                  £{Number(selectedCatalogPart.unit_price || 0).toFixed(2)}
                </div>
              </div>
            </div>
            {catalogSubmitError && (
              <div style={{ padding: "8px", borderRadius: "6px", background: "var(--warning-surface)", color: "var(--danger)", fontSize: "12px", marginBottom: "8px" }}>
                {catalogSubmitError}
              </div>
            )}
            {catalogSuccessMessage && (
              <div style={{ padding: "8px", borderRadius: "6px", background: "var(--success-surface)", color: "var(--success-dark)", fontSize: "12px", marginBottom: "8px" }}>
                {catalogSuccessMessage}
              </div>
            )}
            <button
              type="button"
              onClick={handleAddPartFromStock}
              disabled={!canAllocateParts || allocatingPart}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                background: !canAllocateParts ? "var(--surface-light)" : "var(--accent-purple)",
                color: "white",
                fontWeight: 600,
                cursor: !canAllocateParts ? "not-allowed" : "pointer",
                fontSize: "14px",
              }}
            >
              {allocatingPart ? "Adding..." : "Add to Job"}
            </button>
          </div>
        )}
        {/* Success/Error messages - shown outside selectedCatalogPart block so they remain visible */}
        {catalogSuccessMessage && !selectedCatalogPart && (
          <div style={{ padding: "10px", borderRadius: "8px", background: "var(--success-surface)", color: "var(--success-dark)", fontSize: "13px", marginTop: "12px", textAlign: "center" }}>
            {catalogSuccessMessage}
          </div>
        )}
        {catalogSubmitError && !selectedCatalogPart && (
          <div style={{ padding: "10px", borderRadius: "8px", background: "var(--warning-surface)", color: "var(--danger)", fontSize: "13px", marginTop: "12px", textAlign: "center" }}>
            {catalogSubmitError}
          </div>
        )}
        {addJobDiagnostics && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px dashed var(--surface-light)",
              background: "var(--surface)",
              fontSize: "12px",
              color: "var(--text-secondary)",
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--primary)", marginBottom: "6px" }}>
              Add to Job Diagnostics
            </div>
            <div>Stage: {addJobDiagnostics.stage || "unknown"}</div>
            <div>Job: {addJobDiagnostics.jobNumber || addJobDiagnostics.jobId || "—"}</div>
            <div>Part: {addJobDiagnostics.partNumber || addJobDiagnostics.partId || "—"}</div>
            <div>Qty: {addJobDiagnostics.quantity ?? "—"}</div>
            {addJobDiagnostics.responseStatus && (
              <div>HTTP: {addJobDiagnostics.responseStatus}</div>
            )}
            {addJobDiagnostics.jobPartId && (
              <div>Job Part ID: {addJobDiagnostics.jobPartId}</div>
            )}
            {addJobDiagnostics.error && (
              <div style={{ color: "var(--danger)" }}>Error: {addJobDiagnostics.error}</div>
            )}
            {addJobDiagnostics.responseBody?.message && (
              <div style={{ color: "var(--danger)" }}>
                Server: {addJobDiagnostics.responseBody.message}
              </div>
            )}
          </div>
        )}
          </div>
        )}
      </div>

      {/* 50/50 Layout: Parts List (Left) and Requests (Right) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
        }}
      >
        {/* Left Side - Parts Added to Job */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--surface-light)",
            borderRadius: "12px",
            padding: "16px",
            minHeight: "400px",
          }}
        >
          <div
            style={{
              marginBottom: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--primary)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Parts Added to Job
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--info)" }}>
                {unallocatedParts.length} unallocated · {bookedParts.length} total
              </p>
            </div>
            {/* Allocate toggle lives in the top toolbar */}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {leftPanelParts.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--info)",
                  fontSize: "13px",
                  border: "1px dashed var(--surface-light)",
                  borderRadius: "8px",
                }}
              >
                No unallocated parts. Add parts using the search above.
              </div>
            ) : (
              <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "300px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ textTransform: "uppercase", color: "var(--info)" }}>
                      {assignMode && (
                        <th style={{ textAlign: "center", padding: "8px", width: "40px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Select</th>
                      )}
                      <th style={{ textAlign: "left", padding: "8px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Part</th>
                      <th style={{ textAlign: "right", padding: "8px", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leftPanelParts.map((part) => {
                      const isSelected = selectedPartIds.includes(part.id);
                      const isRemoved =
                        removedPartIds.includes(part.id) ||
                        normalizePartStatus(part.status) === "removed";

                      const isAllocated = Boolean(part.allocatedToRequestId);

                      return (
                        <tr
                          key={part.id}
                          onClick={() => {
                            // Open popup for this part
                            setPartPopup({ open: true, part });
                          }}
                          style={{
                            background: isRemoved
                              ? "var(--danger-surface)"
                              : isSelected
                              ? "var(--info-surface)"
                              : "transparent",
                            cursor: "pointer",
                            borderTop: "1px solid var(--surface-light)",
                            opacity: isRemoved ? 0.7 : 1,
                          }}
                          title={
                            part.source === "goods-in"
                              ? "Goods-in parts will be added as job items when assigned."
                              : "Click to view options"
                          }
                        >
                      {assignMode && (
                        <td style={{ padding: "8px", textAlign: "center", verticalAlign: "top" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isRemoved}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => {
                              if (!assignMode) {
                                setAssignMode(true);
                                setAssignTargetRequestId(null);
                              }
                              if (!isRemoved) {
                                togglePartSelection(part.id);
                              }
                            }}
                          />
                        </td>
                      )}
                          {/* Part Column */}
                          <td style={{ padding: "8px", verticalAlign: "top" }}>
                            <div style={{
                              fontWeight: 600,
                              color: "var(--accent-purple)",
                              textDecoration: isRemoved ? "line-through" : "none",
                            }}>
                              {part.partNumber}
                            </div>
                            <div style={{
                              fontSize: "0.85rem",
                              color: "var(--info-dark)",
                              textDecoration: isRemoved ? "line-through" : "none",
                            }}>
                              {part.description || part.name}
                            </div>
                            {isAllocated && (
                              <div style={{ marginTop: "6px" }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "2px 8px",
                                    borderRadius: "999px",
                                    background: "var(--success-surface)",
                                    color: "var(--success)",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                  }}
                                >
                                  Allocated
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Qty Column */}
                          <td style={{
                            padding: "8px",
                            textAlign: "right",
                            verticalAlign: "top",
                            textDecoration: isRemoved ? "line-through" : "none",
                          }}>
                            {part.quantity}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - On Order (VHC) / Allocate Parts */}
        {showAllocatePanel ? (
          <div
            className="on-order-section"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-light)",
              borderRadius: "12px",
              padding: "16px",
              minHeight: "400px",
            }}
          >
          <div style={{ marginBottom: "12px" }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--primary)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Allocate parts
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--info)" }}>
              Select parts on the left, then choose a request to allocate them.
            </p>
          </div>
          {allRequests.length === 0 ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "var(--info)",
                fontSize: "13px",
                border: "1px dashed var(--surface-light)",
                borderRadius: "8px",
              }}
            >
              No customer requests or authorised work found for this job.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "300px", overflowY: "auto" }}>
                {allRequests.map((request) => {
                  const baseAllocated = partAllocations[request.id] || [];
                  const vhcAllocated =
                    request.type === "vhc" && request.vhcItemId
                      ? vhcPartsByItemId.get(String(request.vhcItemId)) || []
                      : [];
                  const allocatedParts = [...baseAllocated, ...vhcAllocated].filter(
                    (part, index, arr) => arr.findIndex((entry) => entry.id === part.id) === index
                  );

                  if (request.type === "vhc") {
                    console.log(`[PartsTab] VHC Request ${request.id}:`, {
                      request,
                      baseAllocated,
                      vhcAllocated,
                      allocatedParts,
                      vhcItemIdUsed: String(request.vhcItemId),
                    });
                  }
                return (
                  <div
                    key={request.id}
                    style={{
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid var(--surface-light)",
                      background: "var(--surface)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-purple)" }}>
                          {request.type === "customer" ? "Customer Request" : "VHC Authorised"}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--info-dark)", marginTop: "2px" }}>
                          {request.description}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleAssignSelectedToRequest(request.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--accent-purple)",
                          background: !canEdit ? "var(--surface-light)" : "var(--accent-purple)",
                          color: !canEdit ? "var(--text-secondary)" : "white",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: !canEdit ? "not-allowed" : "pointer",
                        }}
                      >
                        {assignMode && assignTargetRequestId === request.id
                          ? selectedPartIds.length > 0
                            ? "Assign"
                            : "Select parts"
                          : "Assign selected"}
                      </button>
                    </div>
                    {allocatedParts.length > 0 && (
                      <div
                        style={{
                          marginTop: "10px",
                          marginLeft: "14px",
                          paddingLeft: "12px",
                          borderLeft: "2px solid var(--surface-light)",
                        }}
                      >
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead>
                              <tr style={{ textTransform: "uppercase", color: "var(--info)" }}>
                                <th style={{ textAlign: "left", padding: "6px" }}>Part number</th>
                                <th style={{ textAlign: "left", padding: "6px" }}>Description</th>
                                <th style={{ textAlign: "right", padding: "6px" }}>Qty</th>
                                <th style={{ textAlign: "right", padding: "6px" }}>Retail</th>
                                <th style={{ textAlign: "right", padding: "6px" }}>Cost</th>
                                <th style={{ textAlign: "center", padding: "6px" }}>Unassign</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allocatedParts.map((part) => (
                                <tr key={part.id} style={{ borderTop: "1px solid var(--surface-light)" }}>
                                  <td style={{ padding: "6px", fontWeight: 600, color: "var(--accent-purple)" }}>
                                    {part.partNumber}
                                  </td>
                                  <td style={{ padding: "6px", color: "var(--info-dark)" }}>{part.description || part.name}</td>
                                  <td style={{ padding: "6px", textAlign: "right" }}>{part.quantity}</td>
                                  <td style={{ padding: "6px", textAlign: "right" }}>{formatMoney(part.unitPrice)}</td>
                                  <td style={{ padding: "6px", textAlign: "right" }}>{formatMoney(part.unitCost)}</td>
                                  <td style={{ padding: "6px", textAlign: "center" }}>
                                    <button
                                      type="button"
                                      onClick={() => handleUnassignPart(part.id)}
                                      disabled={!canEdit}
                                      style={{
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        border: "1px solid var(--danger)",
                                        background: !canEdit ? "var(--surface-light)" : "var(--danger-surface)",
                                        color: !canEdit ? "var(--text-secondary)" : "var(--danger)",
                                        fontSize: "10px",
                                        fontWeight: 600,
                                        cursor: !canEdit ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      Unassign
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        ) : (
          <div
            className="on-order-section"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--surface-light)",
              borderRadius: "12px",
              padding: "16px",
              minHeight: "400px",
            }}
          >
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--primary)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                On Order
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--info)" }}>
                {partsOnOrderFromDB.length > 0
                  ? `${partsOnOrderFromDB.length} part${partsOnOrderFromDB.length !== 1 ? "s" : ""} on order`
                  : "No parts currently on order"}
              </p>
            </div>
            {/* Fixed-size table container */}
            <div style={{ minHeight: "200px", display: "flex", flexDirection: "column" }}>
              <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "320px", flex: 1 }}>
                <table className="on-order-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textTransform: "uppercase", color: "var(--info)" }}>
                      <th style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Part Name</th>
                      <th style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Part Number</th>
                      <th style={{ textAlign: "right", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Qty</th>
                      <th style={{ textAlign: "right", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Price</th>
                      <th style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>ETA Date</th>
                      <th style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>ETA Time</th>
                      <th style={{ textAlign: "center", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partsOnOrderFromDB.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--info)" }}>
                          No parts currently on order for this job.
                        </td>
                      </tr>
                    ) : (
                      partsOnOrderFromDB.map((part) => {
                        // Check if manually marked as arrived OR auto-detected via part number match
                        const isManuallyArrived = arrivedPartIds.includes(part.id);
                        const isAutoArrived = part.partNumber && arrivedPartNumbers.has(part.partNumber.toLowerCase().trim());
                        const isArrived = isManuallyArrived || isAutoArrived;
                        return (
                          <tr
                            key={part.id}
                            style={{
                              borderTop: "1px solid var(--surface-light)",
                            }}
                          >
                            <td style={{ color: "var(--info-dark)" }}>
                              <span className="part-name-cell">{part.partName}</span>
                            </td>
                            <td style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{part.partNumber}</td>
                            <td style={{ textAlign: "right" }}>{part.quantity}</td>
                            <td style={{ textAlign: "right" }}>{formatMoney(part.unitPrice)}</td>
                            <td>
                              <CalendarField
                                value={part.etaDate || ""}
                                onChange={(e) => handleUpdateETA(part.id, "etaDate", e.target.value)}
                                disabled={!canEdit || isArrived}
                                placeholder="Date"
                                size="sm"
                                className="compact-input"
                              />
                            </td>
                            <td>
                              <TimePickerField
                                value={part.etaTime || ""}
                                onChange={(e) => handleUpdateETA(part.id, "etaTime", e.target.value)}
                                disabled={!canEdit || isArrived}
                                placeholder="Time"
                                size="sm"
                                format="24"
                                minuteStep={15}
                                className="compact-input"
                              />
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isArrived) {
                                    setArrivedPartIds((prev) => [...prev, part.id]);
                                    handlePartArrived(part.id);
                                  }
                                }}
                                disabled={!canEdit || isArrived}
                                style={{
                                  borderRadius: "6px",
                                  border: "none",
                                  background: !canEdit
                                    ? "var(--surface-light)"
                                    : isArrived
                                    ? "var(--success)"
                                    : "var(--warning)",
                                  color: !canEdit ? "var(--info)" : "white",
                                  fontWeight: 600,
                                  cursor: !canEdit || isArrived ? "not-allowed" : "pointer",
                                  whiteSpace: "nowrap",
                                  padding: "6px 12px",
                                }}
                              >
                                {isArrived ? "Arrived" : "Arrived?"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Part Removal Popup Modal */}
      {partPopup.open && partPopup.part && (
        <ModalPortal>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
            }}
            onClick={() => setPartPopup({ open: false, part: null })}
          >
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "12px",
                padding: "20px",
                minWidth: "300px",
                maxWidth: "400px",
                boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "var(--primary)",
                  marginBottom: "8px",
                }}
              >
                Part Details
              </div>
              <div
                style={{
                  padding: "12px",
                  background: "var(--info-surface)",
                  borderRadius: "8px",
                }}
              >
                <div style={{ fontWeight: 600, color: "var(--accent-purple)", marginBottom: "4px" }}>
                  {partPopup.part.partNumber}
                </div>
                <div style={{ fontSize: "13px", color: "var(--info-dark)", marginBottom: "4px" }}>
                  {partPopup.part.description || partPopup.part.name}
                </div>
                <div style={{ fontSize: "12px", color: "var(--info)" }}>
                  Quantity: {partPopup.part.quantity}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setPartPopup({ open: false, part: null })}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--surface-light)",
                  background: "var(--surface)",
                  color: "var(--info-dark)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const partId = partPopup.part.id;
                  const removeFromJob = async () => {
                    setRemovedPartIds((prev) =>
                      prev.includes(partId) ? prev : [...prev, partId]
                    );
                    try {
                      const response = await fetch(`/api/parts/job-items/${partId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "removed" }),
                      });
                      const data = await response.json();
                      console.info("[PartsTab] Remove response", {
                        partId,
                        ok: response.ok,
                        status: response.status,
                        body: data,
                      });
                      if (!response.ok || !data?.ok) {
                        throw new Error(data?.error || data?.message || "Failed to remove part");
                      }
                      if (typeof onRefreshJob === "function") {
                        onRefreshJob();
                      }
                    } catch (error) {
                      console.error("Failed to remove part:", error);
                      alert(`Error: ${error.message}`);
                      setRemovedPartIds((prev) => prev.filter((id) => id !== partId));
                    } finally {
                      setPartPopup({ open: false, part: null });
                    }
                  };

                  removeFromJob();
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--danger)",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
});

export default PartsTabNew;
