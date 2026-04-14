// ✅ New Parts Tab with Drag & Drop Allocation
// file location: src/components/PartsTab.js
import React, { useState, useCallback, useEffect, useMemo, useRef, forwardRef } from "react";
import { usePolling } from "@/hooks/usePolling";
import CalendarField from "@/components/ui/calendarAPI/CalendarField";
import TimePickerField from "@/components/ui/timePickerAPI/TimePickerField";
import { DropdownField } from "@/components/ui/dropdownAPI";
import ModalPortal from "@/components/popups/ModalPortal";
import { SearchBar } from "@/components/ui/searchBarAPI";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import {
  buildVhcRequestLinkRows,
} from "@/lib/vhc/requestRowLinking";
import { getJobRequests } from "@/lib/canonical/fields";
import { NORMALIZE_ITEM as normalizePartStatus } from "@/lib/status/catalog/parts"; // Centralized parts item normalizer.

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

const normalizePartNumberKey = (value = "") =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const formatExpectedPartNumberDisplay = (value = "") => {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";

  // Convert verbose tyre-style strings into a compact display:
  // "Bridgestone | Size: 255/45R20 | Load 105 • Speed W |"
  // -> "Bridgestone | Size: 255/45R20 105 W"
  const pipeTyreMatch = raw.match(
    /^([^|]+?)\s*\|\s*size:\s*([^|]+?)\s*\|\s*load\s*([0-9]{2,3})\s*[•|]?\s*speed\s*([A-Z])\s*\|?$/i
  );
  if (pipeTyreMatch) {
    const brand = pipeTyreMatch[1].trim();
    const size = pipeTyreMatch[2].replace(/\s+/g, "").toUpperCase();
    const load = pipeTyreMatch[3];
    const speed = pipeTyreMatch[4].toUpperCase();
    return `${brand} | Size: ${size} ${load} ${speed}`;
  }

  return raw.replace(/\s*\|\s*$/, "");
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
  { value: "tyre_shed", label: "Tyre Shed" },
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
  const [catalogQuantity, setCatalogQuantity] = useState("1");
  const [catalogSubmitError, setCatalogSubmitError] = useState("");
  const [catalogSuccessMessage, setCatalogSuccessMessage] = useState("");
  const [allocatingPart, setAllocatingPart] = useState(false);
  const [addJobDiagnostics, setAddJobDiagnostics] = useState(null);
  const [showBookPartPanel, setShowBookPartPanel] = useState(false);
  const [showAllocatePanel, setShowAllocatePanel] = useState(false);
  const [showPrePickPopup, setShowPrePickPopup] = useState(false);
  const [selectedPrePickPartId, setSelectedPrePickPartId] = useState("");
  const [selectedPrePickLocation, setSelectedPrePickLocation] = useState("");
  const [savingPrePick, setSavingPrePick] = useState(false);
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
  const [partRemoveQuantity, setPartRemoveQuantity] = useState("1");
  // State for tracking parts marked as arrived (before API call completes)
  const [arrivedPartIds, setArrivedPartIds] = useState([]);
  const [removingPart, setRemovingPart] = useState(false);
  const partNameDragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  useBodyModalLock(showPrePickPopup);
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
      authorised: item.authorised === true,
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
          authorised: item.authorised === true,
          createdAt: item.created_at || item.createdAt,
          source: "job_item",
          origin: item.origin || "",
          eta_date: item.eta_date || null,
          eta_time: item.eta_time || null,
          supplier_reference: item.supplier_reference || null,
          prePickLocation: item.pre_pick_location || item.prePickLocation || null,
          requestNotes: item.request_notes || item.requestNotes || "",
          part: partData,
        };
      });

    // Merge allocations and job items - put jobItems FIRST to prefer fresh server data
    const allParts = [...jobItems, ...allocations];

    // Deduplicate by id - keep first occurrence (which is now from jobItems = fresh server data)
    const uniqueParts = allParts.reduce((acc, part) => {
      if (!acc.some(p => p.id === part.id)) {
        acc.push(part);
      }
      return acc;
    }, []);

    // Debug VHC parts
    const vhcParts = uniqueParts.filter(p => p.vhcItemId);
    if (vhcParts.length > 0) {
      console.log("[PartsTab jobParts] Parts with vhcItemId:", vhcParts.map(p => ({
        id: p.id,
        vhcItemId: p.vhcItemId,
        partNumber: p.partNumber,
        source: p.source,
      })));
    }

    return uniqueParts;
  }, [jobData.partsAllocations, jobData.parts_job_items]);

  const prePickableParts = useMemo(
    () =>
      (Array.isArray(jobParts) ? jobParts : [])
        .filter((part) => part && part.id)
        .filter((part) => part.source !== "goods-in")
        .filter((part) => normalizePartStatus(part.status) !== "removed"),
    [jobParts]
  );

  const prePickPartOptions = useMemo(() => {
    return prePickableParts.map((part) => ({
      value: String(part.id),
      label: `${part.partNumber || "N/A"} · ${part.name || "Part"}`,
      description: `Qty ${part.quantity ?? 0}`,
    }));
  }, [prePickableParts]);

  const prePickLocationOptions = useMemo(
    () => PRE_PICK_OPTIONS.filter((option) => option.value !== "on_order"),
    []
  );

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
    const toText = (value) => (value === null || value === undefined ? "" : String(value).trim());
    const firstText = (...values) => {
      for (const value of values) {
        const text = toText(value);
        if (text) return text;
      }
      return "";
    };

    // Prefer jobRequests/job_requests from the database (has proper request_id)
    const requestsSource = getJobRequests(jobData);

    const vhcChecksSource = Array.isArray(jobData.vhcChecks)
      ? jobData.vhcChecks
      : Array.isArray(jobData.vhc_checks)
      ? jobData.vhc_checks
      : [];

    const customerReqs = requestsSource
      .filter((req) => {
        if (!req) return false;
        if (typeof req === "string") return req.trim().length > 0;
        const source = String(req.request_source || req.requestSource || "customer_request")
          .toLowerCase()
          .trim();
        const hasVhcItemId =
          req.vhc_item_id !== null &&
          req.vhc_item_id !== undefined &&
          String(req.vhc_item_id).trim() !== "";
        const hasVhcItemIdCamel =
          req.vhcItemId !== null &&
          req.vhcItemId !== undefined &&
          String(req.vhcItemId).trim() !== "";
        const isVhcSource = source.startsWith("vhc");
        return !isVhcSource && !hasVhcItemId && !hasVhcItemIdCamel;
      })
      .map((req, index) => {
        const persistedId =
          typeof req === "object" && req
            ? req.request_id ?? req.requestId ?? null
            : null;
        const linkedPartText =
          persistedId !== null && persistedId !== undefined
            ? jobParts
                .filter((part) => String(part?.allocatedToRequestId || "") === String(persistedId))
                .map((part) => firstText(part?.requestNotes, part?.description, part?.name))
                .find(Boolean)
            : "";
        const description =
          typeof req === "string"
            ? firstText(req)
            : firstText(req.text, req.description, req.note_text, req.noteText, linkedPartText) ||
              `Reported request ${index + 1}`;
        return {
          id: persistedId ?? `customer-local-${index}-${String(description).slice(0, 24)}`,
          type: "customer",
          description,
          jobType:
            typeof req === "string" ? "Customer" : req.job_type || req.jobType || "Customer",
          hours: typeof req === "string" ? null : req.hours || null,
          canAllocate: persistedId !== null && persistedId !== undefined,
        };
      });

    const vhcReqMap = new Map();
    buildVhcRequestLinkRows({
      jobRequests: requestsSource,
      vhcChecks: vhcChecksSource,
      authorizedVhcItems: Array.isArray(jobData?.authorizedVhcItems)
        ? jobData.authorizedVhcItems
        : [],
      partsJobItems: jobParts,
    }).forEach((row) => {
      if (!row?.id) return;
      vhcReqMap.set(String(row.id), row);
    });

    const customerReqMap = new Map(
      customerReqs.map((row) => [String(row.id), row])
    );

    // Backfill customer requests from allocated parts so reported requests
    // remain visible even when request rows are temporarily missing.
    jobParts.forEach((part) => {
      const requestId = part?.allocatedToRequestId;
      if (requestId === null || requestId === undefined || requestId === "") return;
      const key = String(requestId);
      if (customerReqMap.has(key)) return;
      const description =
        firstText(part?.requestNotes, part?.description, part?.name) ||
        `Reported request ${key}`;
      customerReqMap.set(key, {
        id: requestId,
        type: "customer",
        description,
        jobType: "Customer",
        hours: null,
        canAllocate: true,
      });
    });

    const allReqs = [...Array.from(customerReqMap.values()), ...Array.from(vhcReqMap.values())];
    console.log("[PartsTab] All requests:", allReqs);
    console.log("[PartsTab] VHC requests:", Array.from(vhcReqMap.values()));
    return allReqs;
  }, [
    jobData.jobRequests,
    jobData.job_requests,
    jobData.requests,
    jobData.vhcChecks,
    jobData.vhc_checks,
    jobData.authorizedVhcItems,
    jobParts,
  ]);

  // Group parts by allocated request (including VHC items)
  useEffect(() => {
    const allocations = {};
    const vhcPartsFound = [];

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
        vhcPartsFound.push({ id: part.id, vhcItemId: part.vhcItemId, vhcKey, partNumber: part.partNumber });
      }
    });

    console.log("[PartsTab] Part allocations grouped:", allocations);
    console.log("[PartsTab] VHC parts found and grouped:", vhcPartsFound);
    console.log("[PartsTab] VHC allocation keys:", Object.keys(allocations).filter(k => k.startsWith('vhc-')));
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

  // Set of part numbers that exist in PARTS ADDED TO JOB and should count as "arrived"
  // Used to auto-detect "arrived" parts in the ON ORDER section
  const arrivedPartNumbers = useMemo(() => {
    const partNumbers = new Set();
    jobParts.forEach((part) => {
      const status = normalizePartStatus(part.status);
      // Removed parts should not keep the matching On Order row in an "Arrived" state.
      if (status !== "on_order" && status !== "removed" && part.partNumber && part.partNumber !== "N/A") {
        partNumbers.add(part.partNumber.toLowerCase().trim());
      }
    });
    return partNumbers;
  }, [jobParts]);

  // Check if all on-order parts have arrived
  const allPartsArrived = useMemo(() => {
    if (partsOnOrderFromDB.length === 0) return false;
    return partsOnOrderFromDB.every((part) => {
      const isManuallyArrived = arrivedPartIds.includes(part.id);
      const isAutoArrived = part.partNumber && arrivedPartNumbers.has(part.partNumber.toLowerCase().trim());
      return isManuallyArrived || isAutoArrived;
    });
  }, [partsOnOrderFromDB, arrivedPartIds, arrivedPartNumbers]);

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

  // Initial fetch
  useEffect(() => {
    if (!jobId) return;
    fetchPartsOnOrderBackground();
  }, [jobId, fetchPartsOnOrderBackground]);

  // Periodic background refresh (visibility-gated)
  usePolling(fetchPartsOnOrderBackground, 30000, !!jobId);

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
        return [];
      }
      return [partId];
    });
  }, []);

  const handlePartNameDragStart = useCallback((event) => {
    const target = event.currentTarget;
    partNameDragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: target.scrollLeft,
    };
    target.style.cursor = "grabbing";
  }, []);

  const handlePartNameDragMove = useCallback((event) => {
    const drag = partNameDragRef.current;
    if (!drag.active) return;
    const target = event.currentTarget;
    const delta = event.clientX - drag.startX;
    target.scrollLeft = drag.startScrollLeft - delta;
  }, []);

  const handlePartNameDragEnd = useCallback((event) => {
    partNameDragRef.current.active = false;
    if (event?.currentTarget) {
      event.currentTarget.style.cursor = "grab";
    }
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

  const refreshCatalogStockState = useCallback(async () => {
    const trimmedSearch = String(catalogSearch || "").trim();
    const selectedPartId = selectedCatalogPart?.id || null;

    if (trimmedSearch.length >= 2) {
      await searchStockCatalog(trimmedSearch);
    }

    if (!selectedPartId) return;

    try {
      const response = await fetch(`/api/parts/catalog/${selectedPartId}`);
      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.part) {
        throw new Error(payload?.message || "Unable to refresh selected part stock");
      }
      setSelectedCatalogPart(payload.part);
    } catch (error) {
      console.warn("[PartsTab] Failed to refresh selected part stock", {
        partId: selectedPartId,
        error,
      });
    }
  }, [catalogSearch, searchStockCatalog, selectedCatalogPart]);

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
    setCatalogQuantity("1");
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");
  }, []);

  const clearSelectedCatalogPart = useCallback(() => {
    setSelectedCatalogPart(null);
    setCatalogQuantity("1");
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
    const trimmedQuantity = String(catalogQuantity ?? "").trim();
    const parsedQuantity = Number.parseInt(trimmedQuantity, 10);
    const resolvedCatalogQuantity =
      trimmedQuantity === ""
        ? 1
        : Number.isFinite(parsedQuantity)
        ? parsedQuantity
        : 0;

    if (resolvedCatalogQuantity <= 0) {
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
    if (resolvedCatalogQuantity > availableStock) {
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
        quantity: resolvedCatalogQuantity,
        stage: "request",
      });

      const response = await fetch("/api/parts/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          partId: selectedCatalogPart.id,
          quantityRequested: resolvedCatalogQuantity,
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
      const autoAllocationMessage = data?.autoAllocation?.matched
        ? ` Auto-allocated to ${data.autoAllocation.label || `VHC row ${data.autoAllocation.vhcItemId}`}.`
        : data?.autoAllocation?.attempted
        ? " Added to job but no unique VHC row match was found."
        : "";

      clearSelectedCatalogPart();
      setCatalogSuccessMessage(`${partName} added to job.${autoAllocationMessage}`);

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

  const handleAddPartToOrderFromStock = useCallback(async () => {
    if (!canAllocateParts || !selectedCatalogPart || !jobId) {
      setCatalogSubmitError("Select a part to add to order.");
      return;
    }

    const trimmedQuantity = String(catalogQuantity ?? "").trim();
    const parsedQuantity = Number.parseInt(trimmedQuantity, 10);
    const resolvedCatalogQuantity =
      trimmedQuantity === ""
        ? 1
        : Number.isFinite(parsedQuantity)
        ? parsedQuantity
        : 0;

    if (resolvedCatalogQuantity <= 0) {
      setCatalogSubmitError("Quantity must be at least 1.");
      return;
    }

    setAllocatingPart(true);
    setCatalogSubmitError("");
    setCatalogSuccessMessage("");

    try {
      const response = await fetch("/api/parts/job-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          partId: selectedCatalogPart.id,
          status: "on_order",
          quantityRequested: resolvedCatalogQuantity,
          quantityAllocated: 0,
          unitCost: selectedCatalogPart.unit_cost ?? null,
          unitPrice: selectedCatalogPart.unit_price ?? 0,
          storageLocation: selectedCatalogPart.storage_location || null,
          requestNotes: jobNumber ? `Added to order via job card ${jobNumber}` : "Added to order via job card",
          origin: "job_card",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || `Failed to add part to order (HTTP ${response.status})`);
      }

      const partName = selectedCatalogPart.part_number || selectedCatalogPart.name;
      clearSelectedCatalogPart();
      setCatalogSuccessMessage(`${partName} added to on order.`);

      if (typeof onRefreshJob === "function") {
        onRefreshJob();
      }
      await fetchPartsOnOrder();
      if ((catalogSearch || "").trim().length >= 2) {
        searchStockCatalog(catalogSearch.trim());
      }
    } catch (error) {
      console.error("Unable to add part to order", error);
      setCatalogSubmitError(error.message || "Unable to add part to order");
    } finally {
      setAllocatingPart(false);
    }
  }, [
    canAllocateParts,
    selectedCatalogPart,
    jobId,
    catalogQuantity,
    jobNumber,
    clearSelectedCatalogPart,
    onRefreshJob,
    fetchPartsOnOrder,
    catalogSearch,
    searchStockCatalog,
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

  useEffect(() => {
    if (!selectedPrePickPartId) {
      setSelectedPrePickLocation("");
      return;
    }
    const selectedPart = prePickableParts.find(
      (part) => String(part.id) === String(selectedPrePickPartId)
    );
    const existingLocation = selectedPart?.prePickLocation || "";
    setSelectedPrePickLocation(existingLocation);
  }, [selectedPrePickPartId, prePickableParts]);

  const handleSubmitPrePickPopup = useCallback(async () => {
    if (!selectedPrePickPartId || savingPrePick) return;
    const selectedPart = prePickableParts.find(
      (part) => String(part.id) === String(selectedPrePickPartId)
    );
    if (!selectedPart) return;

    setSavingPrePick(true);
    try {
      await handleUpdatePrePickLocation(selectedPart, selectedPrePickLocation || null);
      setShowPrePickPopup(false);
      setSelectedPrePickPartId("");
      setSelectedPrePickLocation("");
    } finally {
      setSavingPrePick(false);
    }
  }, [
    selectedPrePickPartId,
    selectedPrePickLocation,
    savingPrePick,
    prePickableParts,
    handleUpdatePrePickLocation,
  ]);

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
  const unallocatedParts = bookedParts.filter((part) => !part.allocatedToRequestId && !part.vhcItemId);
  const leftPanelParts = [...bookedParts, ...removedParts];
  const assignableParts = useMemo(
    () =>
      leftPanelParts.filter((part) => {
        const isRemoved =
          removedPartIds.includes(part.id) || normalizePartStatus(part.status) === "removed";
        const isAllocated = Boolean(part.allocatedToRequestId || part.vhcItemId);
        return !isRemoved && !isAllocated;
      }),
    [leftPanelParts, removedPartIds]
  );
  const hasAssignableParts = assignableParts.length > 0;
  const selectedAssignablePart = useMemo(() => {
    if (selectedPartIds.length === 0) return null;
    return assignableParts.find((part) => String(part.id) === String(selectedPartIds[0])) || null;
  }, [assignableParts, selectedPartIds]);
  const partsAddedToJobIdSet = useMemo(
    () => new Set(leftPanelParts.map((part) => String(part.id))),
    [leftPanelParts]
  );

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
      if (selectedPartIds.length === 0) {
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
      canEdit,
      createJobItemFromGoodsIn,
      jobParts,
      jobId,
      leftPanelParts,
      onRefreshJob,
      selectedPartIds,
    ]
  );

  const beginAssignSelection = useCallback(() => {
    if (!canEdit) return;
    if (!hasAssignableParts) {
      return;
    }
    setSelectedPartIds([]);
    setAssignMode(true);
    setAssignTargetRequestId(null);
  }, [canEdit, hasAssignableParts]);

  const handleAssignButtonClick = useCallback(() => {
    if (!canEdit || allocatingSelection || !hasAssignableParts) {
      return;
    }
    if (!assignMode) {
      beginAssignSelection();
      return;
    }
    if (!assignTargetRequestId) {
      alert("Select a row in 'Allocate Parts' first.");
      return;
    }
    if (!selectedAssignablePart) {
      alert("Select a row in 'Parts Added to Job' that is not already allocated or removed.");
      return;
    }
    handleAssignSelectedToRequest(assignTargetRequestId);
  }, [
    allocatingSelection,
    assignMode,
    assignTargetRequestId,
    beginAssignSelection,
    canEdit,
    handleAssignSelectedToRequest,
    hasAssignableParts,
    selectedAssignablePart,
  ]);

  const cancelAssignSelection = useCallback(() => {
    setAssignMode(false);
    setAssignTargetRequestId(null);
    setSelectedPartIds([]);
  }, []);

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

  const handleRemovePartFromPopup = useCallback(
    async (mode = "all") => {
      const part = partPopup?.part;
      if (!canEdit || !part?.id) return;

      const partId = part.id;
      const currentQty = Math.max(1, Number(part.quantity || 1));
      const requestedRemoveQtyRaw = String(partRemoveQuantity ?? "").trim();
      const requestedRemoveQty =
        requestedRemoveQtyRaw === ""
          ? 1
          : Math.max(1, Number.parseInt(requestedRemoveQtyRaw, 10) || 1);

      const removeQty = mode === "all" ? currentQty : Math.min(currentQty, requestedRemoveQty);
      const nextQty = Math.max(0, currentQty - removeQty);

      setRemovedPartIds((prev) =>
        mode === "all" || nextQty <= 0
          ? (prev.includes(partId) ? prev : [...prev, partId])
          : prev
      );

      try {
        const body =
          mode === "all" || nextQty <= 0
            ? { status: "removed" }
            : {
                quantityRequested: nextQty,
                quantityAllocated: nextQty,
              };

        const response = await fetch(`/api/parts/job-items/${partId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        console.info("[PartsTab] Remove response", {
          partId,
          mode,
          removeQty,
          nextQty,
          ok: response.ok,
          status: response.status,
          body: data,
        });
        if (!response.ok || !(data?.ok || data?.success)) {
          throw new Error(data?.error || data?.message || "Failed to remove part");
        }
        if (typeof onRefreshJob === "function") {
          onRefreshJob();
        }
        await refreshCatalogStockState();
      } catch (error) {
        console.error("Failed to remove part:", error);
        alert(`Error: ${error.message}`);
        setRemovedPartIds((prev) => prev.filter((id) => id !== partId));
      } finally {
        setPartPopup({ open: false, part: null });
      }
    },
    [canEdit, onRefreshJob, partPopup, partRemoveQuantity, refreshCatalogStockState]
  );

  useEffect(() => {
    setSelectedPartIds((prev) => {
      const next = prev.filter((id) =>
        assignableParts.some((part) => String(part.id) === String(id))
      );
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [assignableParts]);

  useEffect(() => {
    if (!partPopup.open || !partPopup.part) {
      setPartRemoveQuantity("1");
      return;
    }
    const qty = Number(partPopup.part.quantity);
    if (Number.isFinite(qty) && qty > 0) {
      setPartRemoveQuantity("1");
    } else {
      setPartRemoveQuantity("1");
    }
  }, [partPopup]);

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
          table-layout: fixed !important;
          width: 100% !important;
          max-width: 100% !important;
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
          width: 18%;
          max-width: none;
        }

        .on-order-table td:nth-child(1) .part-name-cell {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          white-space: nowrap;
          display: block;
          scrollbar-width: none;
          -ms-overflow-style: none;
          cursor: grab;
          user-select: none;
        }

        .on-order-table td:nth-child(1) .part-name-cell::-webkit-scrollbar {
          display: none;
        }

        /* Part Number column */
        .on-order-table th:nth-child(2),
        .on-order-table td:nth-child(2) {
          width: 20%;
          max-width: none;
        }

        .on-order-cell-scroll {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          white-space: nowrap;
          display: block;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .on-order-cell-scroll::-webkit-scrollbar {
          display: none;
        }

        .parts-allocate-subtable {
          width: 100%;
          max-width: 100%;
          table-layout: fixed;
        }

        .parts-allocate-subtable th:nth-child(1),
        .parts-allocate-subtable td:nth-child(1) {
          width: 22%;
        }

        .parts-allocate-subtable th:nth-child(2),
        .parts-allocate-subtable td:nth-child(2) {
          width: 24%;
        }

        .parts-allocate-subtable th:nth-child(3),
        .parts-allocate-subtable td:nth-child(3),
        .parts-allocate-subtable th:nth-child(4),
        .parts-allocate-subtable td:nth-child(4),
        .parts-allocate-subtable th:nth-child(5),
        .parts-allocate-subtable td:nth-child(5) {
          width: 12%;
        }

        .parts-allocate-subtable th:nth-child(6),
        .parts-allocate-subtable td:nth-child(6) {
          width: 18%;
        }

        .parts-allocate-cell-scroll {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          white-space: nowrap;
          display: block;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .parts-allocate-description-cell {
          width: 100%;
          max-width: 100%;
        }

        .parts-allocate-cell-scroll::-webkit-scrollbar {
          display: none;
        }

        @media (min-width: 1100px) {
          .parts-allocate-subtable th:nth-child(1),
          .parts-allocate-subtable td:nth-child(1) {
            width: 24%;
          }

          .parts-allocate-subtable th:nth-child(2),
          .parts-allocate-subtable td:nth-child(2) {
            width: 28%;
          }

          .parts-allocate-subtable th:nth-child(3),
          .parts-allocate-subtable td:nth-child(3),
          .parts-allocate-subtable th:nth-child(4),
          .parts-allocate-subtable td:nth-child(4),
          .parts-allocate-subtable th:nth-child(5),
          .parts-allocate-subtable td:nth-child(5) {
            width: 10%;
          }

          .parts-allocate-subtable th:nth-child(6),
          .parts-allocate-subtable td:nth-child(6) {
            width: 18%;
          }
        }

        /* Keep qty and price columns compact */
        .on-order-table th:nth-child(3),
        .on-order-table th:nth-child(4),
        .on-order-table td:nth-child(3),
        .on-order-table td:nth-child(4) {
          width: 10%;
        }

        /* ETA date and time columns */
        .on-order-table th:nth-child(5),
        .on-order-table th:nth-child(6),
        .on-order-table td:nth-child(5),
        .on-order-table td:nth-child(6) {
          width: 16%;
        }

        /* Action column */
        .on-order-table th:nth-child(7),
        .on-order-table td:nth-child(7) {
          width: 10%;
        }

        @media (min-width: 1100px) {
          .on-order-table th:nth-child(1),
          .on-order-table td:nth-child(1) {
            width: 22%;
          }

          .on-order-table th:nth-child(2),
          .on-order-table td:nth-child(2) {
            width: 22%;
          }

          .on-order-table th:nth-child(3),
          .on-order-table th:nth-child(4),
          .on-order-table td:nth-child(3),
          .on-order-table td:nth-child(4) {
            width: 8%;
          }

          .on-order-table th:nth-child(5),
          .on-order-table th:nth-child(6),
          .on-order-table td:nth-child(5),
          .on-order-table td:nth-child(6) {
            width: 14%;
          }

          .on-order-table th:nth-child(7),
          .on-order-table td:nth-child(7) {
            width: 12%;
          }
        }
        .catalog-qty-input::placeholder {
          color: var(--grey-accent);
          opacity: 0.75;
        }
        .catalog-qty-input {
          color: var(--text-primary);
        }
      `}</style>
      <DevLayoutSection
        sectionKey="jobcard-parts-tab-root"
        sectionType="section-shell"
        parentKey="jobcard-tab-parts"
        backgroundToken="surface"
        shell
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        {/* Search Section */}
        {showBookPartPanel && (
          <DevLayoutSection
            sectionKey="jobcard-parts-stock-search"
            sectionType="content-card"
            parentKey="jobcard-parts-tab-root"
            style={{
              background: "var(--surface)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "16px",
            }}
          >
        <div style={{ marginBottom: "12px" }}>
          <div
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: 600,
              color: "var(--primary)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Search Parts Stock
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "var(--text-label)", color: "var(--info-dark)" }}>
            Search and add parts to this job
          </p>
        </div>
        <SearchBar
          value={catalogSearch}
          disabled={!canAllocateParts}
          onChange={(e) => {
            setCatalogSearch(e.target.value);
            setCatalogSuccessMessage("");
            setCatalogSubmitError("");
          }}
          onClear={() => {
            setCatalogSearch("");
            setCatalogSuccessMessage("");
            setCatalogSubmitError("");
          }}
          placeholder={canAllocateParts ? "Search by part number or description..." : "Search disabled"}
          style={{
            width: "100%",
            opacity: canAllocateParts ? 1 : 0.7,
          }}
        />
        {catalogLoading && <div style={{ fontSize: "var(--text-label)", color: "var(--info)", marginTop: "8px" }}>Searching...</div>}
        {!catalogLoading && catalogError && (
          <div style={{ fontSize: "var(--text-caption)", color: "var(--danger)", marginTop: "8px" }}>{catalogError}</div>
        )}
        {canAllocateParts && !catalogLoading && catalogResults.length > 0 && (
          <div
            style={{
              maxHeight: "200px",
              overflowY: "auto",
              border: "none",
              borderRadius: "var(--radius-sm)",
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
                  <div style={{ fontWeight: 600, color: "var(--accent-purple)", fontSize: "var(--text-body-sm)" }}>{part.name}</div>
                  <div style={{ fontSize: "var(--text-caption)", color: "var(--info-dark)" }}>
                    Part #: {part.part_number} · Supplier: {part.supplier || "Unknown"}
                  </div>
                  <div style={{ fontSize: "var(--text-caption)", color: "var(--info)" }}>
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
              borderRadius: "var(--radius-sm)",
              padding: "12px",
              background: "var(--accent-purple-surface)",
              marginTop: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <div style={{ fontWeight: 700, color: "var(--accent-purple)", fontSize: "var(--text-body-sm)" }}>{selectedCatalogPart.name}</div>
                <div style={{ fontSize: "var(--text-caption)", color: "var(--info-dark)" }}>
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
                  fontSize: "var(--text-label)",
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={{ fontSize: "var(--text-caption)", color: "var(--info-dark)", display: "block", marginBottom: "4px" }}>
                  Quantity
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="catalog-qty-input"
                  value={catalogQuantity}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "" || /^\d+$/.test(next)) {
                      setCatalogQuantity(next);
                    }
                  }}
                  placeholder="1"
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: "var(--radius-xs)",
                    border: "none",
                    fontSize: "var(--text-label)",
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: "var(--text-caption)", color: "var(--info-dark)", marginBottom: "4px" }}>Available</div>
                <div style={{ fontWeight: 700, fontSize: "var(--text-body)", color: "var(--accent-purple)" }}>
                  {selectedCatalogPart.qty_in_stock ?? 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--text-caption)", color: "var(--info-dark)", marginBottom: "4px" }}>Sell Price</div>
                <div style={{ fontWeight: 700, fontSize: "var(--text-body)", color: "var(--accent-purple)" }}>
                  £{Number(selectedCatalogPart.unit_price || 0).toFixed(2)}
                </div>
              </div>
            </div>
            {catalogSubmitError && (
              <div style={{ padding: "8px", borderRadius: "var(--radius-xs)", background: "var(--warning-surface)", color: "var(--danger)", fontSize: "var(--text-caption)", marginBottom: "8px" }}>
                {catalogSubmitError}
              </div>
            )}
            {catalogSuccessMessage && (
              <div style={{ padding: "8px", borderRadius: "var(--radius-xs)", background: "var(--success-surface)", color: "var(--success-dark)", fontSize: "var(--text-caption)", marginBottom: "8px" }}>
                {catalogSuccessMessage}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button
                type="button"
                onClick={handleAddPartFromStock}
                disabled={!canAllocateParts || allocatingPart}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "var(--radius-xs)",
                  border: "none",
                  background: !canAllocateParts ? "var(--surface-light)" : "var(--accent-purple)",
                  color: "white",
                  fontWeight: 600,
                  cursor: !canAllocateParts ? "not-allowed" : "pointer",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                {allocatingPart ? "Adding..." : "Add to Job"}
              </button>
              <button
                type="button"
                onClick={handleAddPartToOrderFromStock}
                disabled={!canAllocateParts || allocatingPart}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid var(--accent-purple)",
                  background: !canAllocateParts ? "var(--surface-light)" : "var(--surface)",
                  color: !canAllocateParts ? "var(--text-secondary)" : "var(--accent-purple)",
                  fontWeight: 600,
                  cursor: !canAllocateParts ? "not-allowed" : "pointer",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                {allocatingPart ? "Adding..." : "Add to Order"}
              </button>
            </div>
          </div>
        )}
        {/* Success/Error messages - shown outside selectedCatalogPart block so they remain visible */}
        {catalogSuccessMessage && !selectedCatalogPart && (
          <div style={{ padding: "10px", borderRadius: "var(--radius-xs)", background: "var(--success-surface)", color: "var(--success-dark)", fontSize: "var(--text-label)", marginTop: "12px", textAlign: "center" }}>
            {catalogSuccessMessage}
          </div>
        )}
        {catalogSubmitError && !selectedCatalogPart && (
          <div style={{ padding: "10px", borderRadius: "var(--radius-xs)", background: "var(--warning-surface)", color: "var(--danger)", fontSize: "var(--text-label)", marginTop: "12px", textAlign: "center" }}>
            {catalogSubmitError}
          </div>
        )}
          </DevLayoutSection>
        )}
      </DevLayoutSection>

      {/* Layout: Parts List (Left) and Requests (Right) - Right side wider for better content fit */}
      <DevLayoutSection
        sectionKey="jobcard-parts-workspace"
        sectionType="section-shell"
        parentKey="jobcard-tab-parts"
        backgroundToken="surface"
        shell
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 3fr",
          gap: "16px",
          marginTop: showBookPartPanel ? "16px" : "0",
        }}
      >
        {/* Left Side - Parts Added to Job */}
        <DevLayoutSection
          sectionKey="jobcard-parts-added-panel"
          sectionType="content-card"
          parentKey="jobcard-parts-workspace"
          style={{
            background: "var(--surface)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "16px",
            minHeight: "400px",
            overflow: "hidden",
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
                  fontSize: "var(--text-body-sm)",
                  fontWeight: 600,
                  color: "var(--primary)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Parts Added to Job
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "var(--text-caption)", color: "var(--info)" }}>
                {unallocatedParts.length} unallocated · {bookedParts.length} total
              </p>
            </div>
            {/* Tabs on same row */}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                type="button"
                onClick={toggleBookPartPanel}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid transparent",
                  background: showBookPartPanel ? "var(--danger)" : "var(--danger-surface)",
                  color: showBookPartPanel ? "var(--text-inverse)" : "var(--danger)",
                  fontSize: "var(--text-caption)",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {showBookPartPanel ? "Hide" : "Book Part"}
              </button>
              <button
                type="button"
                onClick={toggleAllocatePanel}
                title="Show allocate-to-request panel"
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid transparent",
                  background: showAllocatePanel ? "var(--accent-purple)" : "var(--accent-purple-surface)",
                  color: showAllocatePanel ? "var(--text-inverse)" : "var(--accent-purple)",
                  fontSize: "var(--text-caption)",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {showAllocatePanel ? "Hide" : (allPartsArrived ? "On Order" : "Allocate")}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {leftPanelParts.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--info)",
                  fontSize: "var(--text-label)",
                  border: "1px dashed var(--surface-light)",
                  borderRadius: "var(--radius-xs)",
                }}
              >
                No unallocated parts. Add parts using the search above.
              </div>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  overflowY: "auto",
                  maxHeight: "600px",
                  background: "var(--accent-purple-surface)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0 6px 6px",
                }}
              >
                <table
                  data-dev-section="1"
                  data-dev-section-key="jobcard-parts-added-table"
                  data-dev-section-type="data-table"
                  data-dev-section-parent="jobcard-parts-added-panel"
                  data-dev-disable-table-subsections="1"
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    fontSize: "var(--text-caption)",
                  }}
                >
                  <thead style={{ background: "transparent" }}>
                    <tr style={{ textTransform: "uppercase", color: "var(--info)" }}>
                      {assignMode && (
                        <th
                          style={{
                            textAlign: "center",
                            padding: "10px 8px",
                            width: "40px",
                            position: "sticky",
                            top: 0,
                            background: "transparent",
                            zIndex: 1,
                            border: "none",
                            borderBottom: "1px solid transparent",
                          }}
                        >
                          Select
                        </th>
                      )}
                      <th
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          position: "sticky",
                          top: 0,
                          background: "transparent",
                          zIndex: 1,
                          border: "none",
                          borderBottom: "1px solid transparent",
                        }}
                      >
                        Part
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "10px 12px",
                          position: "sticky",
                          top: 0,
                          background: "transparent",
                          zIndex: 1,
                          border: "none",
                          borderBottom: "1px solid transparent",
                        }}
                      >
                        Qty
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leftPanelParts.map((part) => {
                      const isSelected = selectedPartIds.includes(part.id);
                      const isRemoved =
                        removedPartIds.includes(part.id) ||
                        normalizePartStatus(part.status) === "removed";

                      const isAllocated = Boolean(part.allocatedToRequestId || part.vhcItemId);
                      const isAssignable = !isRemoved && !isAllocated;

                      return (
                        <tr
                          key={part.id}
                          onClick={() => {
                            if (assignMode) {
                              if (isAssignable) {
                                togglePartSelection(part.id);
                              }
                              return;
                            }
                            setPartPopup({ open: true, part });
                          }}
                          style={{
                            background: isRemoved
                              ? "var(--danger)"
                              : assignMode && isSelected
                              ? "var(--accent-purple-surface)"
                              : "var(--surface)",
                            cursor: assignMode ? (isAssignable ? "pointer" : "not-allowed") : "pointer",
                            opacity: isRemoved ? 0.8 : 1,
                            boxShadow: isRemoved
                              ? "none"
                              : isSelected
                              ? "0 0 0 1px var(--accent-purple)"
                              : "0 0 0 1px rgba(var(--shadow-rgb), 0.03)",
                          }}
                          title={
                            assignMode
                              ? isRemoved
                                ? "Removed rows cannot be assigned."
                                : isAllocated
                                ? "Already allocated rows cannot be assigned."
                                : "Click to select this part for allocation."
                              : part.source === "goods-in"
                              ? "Goods-in parts will be added as job items when assigned."
                              : "Click to view options"
                          }
                        >
                      {assignMode && (
                        <td style={{
                          padding: "9px 8px",
                          textAlign: "center",
                          verticalAlign: "middle",
                          border: "none",
                          borderRight: "none",
                          borderTopLeftRadius: "8px",
                          borderBottomLeftRadius: "8px",
                          borderBottom: "6px solid var(--accent-purple-surface)",
                        }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!isAssignable}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => {
                              if (isAssignable) {
                                togglePartSelection(part.id);
                              }
                            }}
                          />
                        </td>
                      )}
                          {/* Part Column */}
                          <td style={{
                            padding: "9px 12px",
                            verticalAlign: "middle",
                            border: "none",
                            borderRight: assignMode ? "none" : "none",
                            borderLeft: "none",
                            borderTopLeftRadius: assignMode ? "0" : "10px",
                            borderBottomLeftRadius: assignMode ? "0" : "10px",
                            borderBottom: "6px solid var(--accent-purple-surface)",
                          }}>
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flexWrap: "wrap",
                            }}>
                              <span style={{
                                fontWeight: 600,
                                color: isRemoved ? "var(--text-inverse)" : "var(--accent-purple)",
                                textDecoration: isRemoved ? "line-through" : "none",
                              }}>
                                {part.partNumber}
                              </span>
                              {isAllocated && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "2px 8px",
                                    borderRadius: "var(--radius-pill)",
                                    background: "var(--success-surface)",
                                    color: "var(--success)",
                                    fontSize: "var(--text-caption)",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                  }}
                                >
                                  Allocated
                                </span>
                              )}
                              {assignMode && isSelected && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "2px 8px",
                                    borderRadius: "var(--radius-pill)",
                                    background: "var(--accent-purple)",
                                    color: "var(--text-inverse)",
                                    fontSize: "var(--text-caption)",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                  }}
                                >
                                  Selected
                                </span>
                              )}
                              {part.authorised && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    padding: "2px 8px",
                                    borderRadius: "var(--radius-pill)",
                                    background: "var(--info-surface)",
                                    color: "var(--info-dark)",
                                    fontSize: "var(--text-caption)",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                  }}
                                >
                                  Authorised
                                </span>
                              )}
                            </div>
                            <div style={{
                              fontSize: "var(--text-body-sm)",
                              color: isRemoved ? "var(--text-inverse)" : "var(--info-dark)",
                              textDecoration: isRemoved ? "line-through" : "none",
                            }}>
                              {part.description || part.name}
                            </div>
                          </td>

                          {/* Qty Column */}
                          <td style={{
                            padding: "9px 12px",
                            textAlign: "right",
                            verticalAlign: "middle",
                            color: isRemoved ? "var(--text-inverse)" : "var(--text-primary)",
                            textDecoration: isRemoved ? "line-through" : "none",
                            border: "none",
                            borderLeft: "none",
                            borderTopRightRadius: "8px",
                            borderBottomRightRadius: "8px",
                            borderBottom: "6px solid var(--accent-purple-surface)",
                            fontWeight: 600,
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
        </DevLayoutSection>

        {/* Right Side - On Order (VHC) / Allocate Parts */}
        {/* Swap sections when all parts arrived: show Allocate by default, On Order on click */}
        {(showAllocatePanel && !allPartsArrived) || (!showAllocatePanel && allPartsArrived) ? (
          <DevLayoutSection
            className="on-order-section"
            sectionKey="jobcard-parts-allocate-panel"
            sectionType="content-card"
            parentKey="jobcard-parts-workspace"
            style={{
              background: "var(--surface)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "16px",
              minHeight: "400px",
              overflow: "hidden",
            }}
          >
          <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "var(--text-body-sm)",
                  fontWeight: 600,
                  color: "var(--primary)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Allocate Parts
              </div>
              {assignMode ? (
                <div style={{ marginTop: "4px", fontSize: "var(--text-caption)", color: "var(--info)" }}>
                  {!assignTargetRequestId
                    ? "Select a row in 'Allocate Parts' first."
                    : !selectedAssignablePart
                    ? "Now select a row in 'Parts Added to Job' that is not allocated or removed."
                    : `Press 'Assign selected' again to assign ${selectedAssignablePart.partNumber || "the selected part"}.`}
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {assignMode && (
                <button
                  type="button"
                  onClick={cancelAssignSelection}
                  disabled={allocatingSelection}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-xs)",
                    border: "1px solid var(--surface-light)",
                    background: "var(--surface)",
                    color: "var(--text-secondary)",
                    fontSize: "var(--text-caption)",
                    fontWeight: 600,
                    cursor: allocatingSelection ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleAssignButtonClick}
                disabled={
                  !canEdit ||
                  allocatingSelection ||
                  !hasAssignableParts
                }
                style={{
                  padding: "6px 10px",
                  borderRadius: "var(--radius-xs)",
                  border: "1px solid transparent",
                  background:
                    !canEdit || !hasAssignableParts || allocatingSelection
                      ? "var(--surface-light)"
                      : assignMode
                      ? "var(--success)"
                      : "var(--accent-purple)",
                  color:
                    !canEdit || !hasAssignableParts || allocatingSelection
                      ? "var(--text-secondary)"
                      : "var(--text-inverse)",
                  fontSize: "var(--text-caption)",
                  fontWeight: 600,
                  cursor:
                    !canEdit || !hasAssignableParts || allocatingSelection
                      ? "not-allowed"
                      : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {allocatingSelection
                  ? "Assigning..."
                  : !hasAssignableParts
                  ? "All parts allocated"
                  : !assignMode
                  ? "Assign selected"
                  : !assignTargetRequestId
                  ? "Select request below"
                  : !selectedAssignablePart
                  ? "Select part row"
                  : "Assign selected"}
              </button>
            </div>
          </div>
          {/* Fixed-size content container to match ON ORDER section */}
          <div style={{ minHeight: "200px", display: "flex", flexDirection: "column" }}>
            {allRequests.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--info)",
                  fontSize: "var(--text-label)",
                  border: "1px dashed var(--surface-light)",
                  borderRadius: "var(--radius-xs)",
                }}
              >
                No customer requests or authorised work found for this job.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "600px", overflowY: "auto", flex: 1 }}>
                {/* Customer Requests - always shown at the top */}
                {(() => {
                  const customerRequests = allRequests.filter((r) => r.type === "customer");
                  return (
                    <DevLayoutSection
                      sectionKey="jobcard-parts-allocate-customer-requests"
                      sectionType="list"
                      parentKey="jobcard-parts-allocate-panel"
                      style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                    >
                      <div style={{ fontSize: "var(--text-caption)", fontWeight: 700, color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Customer Requests
                      </div>
                      {customerRequests.length === 0 ? (
                        <div style={{ padding: "10px", fontSize: "var(--text-caption)", color: "var(--info)", border: "1px dashed var(--surface-light)", borderRadius: "var(--radius-xs)", textAlign: "center" }}>
                          No customer requests reported.
                        </div>
                      ) : (
                        customerRequests.map((request) => {
                          const baseAllocated = partAllocations[request.id] || [];
                          const allocatedParts = [...baseAllocated]
                            .filter((part, index, arr) => arr.findIndex((entry) => entry.id === part.id) === index)
                            .filter((part) => partsAddedToJobIdSet.has(String(part.id)));
                          return (
                            <DevLayoutSection
                              key={request.id}
                              sectionKey={`jobcard-parts-customer-request-${request.id}`}
                              sectionType="content-card"
                              parentKey="jobcard-parts-allocate-customer-requests"
                              onClick={() => {
                                if (assignMode && request.canAllocate) {
                                  setAssignTargetRequestId(request.id);
                                }
                              }}
                              style={{
                                padding: "12px",
                                borderRadius: "var(--radius-sm)",
                                border:
                                  assignMode && String(assignTargetRequestId) === String(request.id)
                                    ? "1px solid var(--accent-purple)"
                                    : "1px solid transparent",
                                background: "var(--surface-muted)",
                                cursor: assignMode && request.canAllocate ? "pointer" : "default",
                                boxShadow:
                                  assignMode && String(assignTargetRequestId) === String(request.id)
                                    ? "0 0 0 2px rgba(var(--primary-rgb), 0.08)"
                                    : "none",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                                <div>
                                  <div style={{ fontSize: "var(--text-label)", color: "var(--info-dark)" }}>
                                  {request.description}
                                  </div>
                                  {assignMode && String(assignTargetRequestId) === String(request.id) && (
                                    <div style={{ marginTop: "4px", fontSize: "var(--text-caption)", color: "var(--accent-purple)", fontWeight: 600 }}>
                                      Selected allocation row
                                    </div>
                                  )}
                                </div>
                                {assignMode ? (
                                  <span
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: "var(--radius-xs)",
                                      background:
                                        String(assignTargetRequestId) === String(request.id)
                                          ? "var(--accent-purple-surface)"
                                          : "var(--surface-light)",
                                      color:
                                        String(assignTargetRequestId) === String(request.id)
                                          ? "var(--accent-purple)"
                                          : "var(--text-secondary)",
                                      fontSize: "var(--text-caption)",
                                      fontWeight: 600,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {String(assignTargetRequestId) === String(request.id) ? "Selected" : "Click to select"}
                                  </span>
                                ) : null}
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
                                  <table
                                    data-dev-section="1"
                                    data-dev-section-key={`jobcard-parts-allocate-customer-table-${request.id}`}
                                    data-dev-section-type="data-table"
                                    data-dev-section-parent={`jobcard-parts-customer-request-${request.id}`}
                                    className="parts-allocate-subtable"
                                    style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-caption)", tableLayout: "fixed" }}
                                  >
                                    <thead data-dev-section="1" data-dev-section-key={`jobcard-parts-allocate-customer-table-${request.id}-headings`} data-dev-section-type="table-headings" data-dev-section-parent={`jobcard-parts-allocate-customer-table-${request.id}`}>
                                      <tr style={{ textTransform: "uppercase", color: "var(--info)" }}>
                                        <th style={{ textAlign: "left", padding: "6px" }}>Part number</th>
                                        <th style={{ textAlign: "left", padding: "6px" }}>Description</th>
                                        <th style={{ textAlign: "right", padding: "6px" }}>Qty</th>
                                        <th style={{ textAlign: "right", padding: "6px" }}>Retail</th>
                                        <th style={{ textAlign: "right", padding: "6px" }}>Cost</th>
                                        <th style={{ textAlign: "center", padding: "6px" }}>Unassign</th>
                                      </tr>
                                    </thead>
                                    <tbody data-dev-section="1" data-dev-section-key={`jobcard-parts-allocate-customer-table-${request.id}-rows`} data-dev-section-type="table-rows" data-dev-section-parent={`jobcard-parts-allocate-customer-table-${request.id}`}>
                                      {allocatedParts.map((part) => (
                                        <tr key={part.id} style={{ background: "var(--accent-purple-surface)", borderTop: "1px solid var(--surface-light)" }}>
                                          <td style={{ padding: "6px", fontWeight: 600, color: "var(--accent-purple)" }}>
                                            <span className="parts-allocate-cell-scroll">
                                              {part.partNumber}
                                            </span>
                                          </td>
                                          <td style={{ padding: "6px", color: "var(--info-dark)" }}>
                                            <span className="parts-allocate-cell-scroll parts-allocate-description-cell">
                                              {part.description || part.name}
                                            </span>
                                          </td>
                                          <td style={{ padding: "6px", textAlign: "right" }}>
                                            <span className="parts-allocate-cell-scroll">{part.quantity}</span>
                                          </td>
                                          <td style={{ padding: "6px", textAlign: "right" }}>
                                            <span className="parts-allocate-cell-scroll">{formatMoney(part.unitPrice)}</span>
                                          </td>
                                          <td style={{ padding: "6px", textAlign: "right" }}>
                                            <span className="parts-allocate-cell-scroll">{formatMoney(part.unitCost)}</span>
                                          </td>
                                          <td style={{ padding: "6px", textAlign: "center" }}>
                                            <button
                                              type="button"
                                              onClick={() => handleUnassignPart(part.id)}
                                              disabled={!canEdit}
                                              style={{
                                                padding: "4px 8px",
                                                borderRadius: "var(--radius-xs)",
                                                border: "1px solid var(--danger)",
                                                background: !canEdit ? "var(--surface-light)" : "var(--danger-surface)",
                                                color: !canEdit ? "var(--text-secondary)" : "var(--danger)",
                                                fontSize: "var(--text-caption)",
                                                fontWeight: 600,
                                                cursor: !canEdit ? "not-allowed" : "pointer",
                                              }}
                                            >
                                              <span className="parts-allocate-cell-scroll">Unassign</span>
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </DevLayoutSection>
                          );
                        })
                      )}
                    </DevLayoutSection>
                  );
                })()}

                {/* VHC Requests - always shown below customer requests */}
                {(() => {
                  const vhcRequests = allRequests.filter((r) => r.type === "vhc");
                  const groupedVhcRequests = [];
                  const groupedVhcRequestMap = new Map();

                  vhcRequests.forEach((request) => {
                    const sectionLabel = String(request.section || "Other VHC Items").trim() || "Other VHC Items";
                    if (!groupedVhcRequestMap.has(sectionLabel)) {
                      const bucket = { section: sectionLabel, rows: [] };
                      groupedVhcRequestMap.set(sectionLabel, bucket);
                      groupedVhcRequests.push(bucket);
                    }
                    groupedVhcRequestMap.get(sectionLabel).rows.push(request);
                  });

                  return (
                    <DevLayoutSection
                      sectionKey="jobcard-parts-allocate-vhc-requests"
                      sectionType="list"
                      parentKey="jobcard-parts-allocate-panel"
                      style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                    >
                      <div style={{ fontSize: "var(--text-caption)", fontWeight: 700, color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        VHC Requests
                      </div>
                      {vhcRequests.length === 0 ? (
                        <div style={{ padding: "10px", fontSize: "var(--text-caption)", color: "var(--info)", border: "1px dashed var(--surface-light)", borderRadius: "var(--radius-xs)", textAlign: "center" }}>
                          No VHC requests reported.
                        </div>
                      ) : (
                        groupedVhcRequests.map((group) => (
                          <DevLayoutSection
                            key={`vhc-group-${group.section}`}
                            sectionKey={`jobcard-parts-vhc-group-${String(group.section || "other").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other"}`}
                            sectionType="content-card"
                            parentKey="jobcard-parts-allocate-vhc-requests"
                            style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                          >
                            {group.rows.map((request) => {
                              const baseAllocated = partAllocations[request.id] || [];
                              const vhcAllocated =
                                request.vhcItemId
                                  ? vhcPartsByItemId.get(String(request.vhcItemId)) || []
                                  : [];
                              const allocatedParts = [...baseAllocated, ...vhcAllocated]
                                .filter((part, index, arr) => arr.findIndex((entry) => entry.id === part.id) === index)
                                .filter((part) => partsAddedToJobIdSet.has(String(part.id)));
                              return (
                                <DevLayoutSection
                                  key={request.id}
                                  sectionKey={`jobcard-parts-vhc-request-${request.id}`}
                                  sectionType="content-card"
                                  parentKey={`jobcard-parts-vhc-group-${String(group.section || "other").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other"}`}
                                  onClick={() => {
                                    if (assignMode && request.canAllocate) {
                                      setAssignTargetRequestId(request.id);
                                    }
                                  }}
                                  style={{
                                    padding: "12px",
                                    borderRadius: "var(--radius-sm)",
                                    border:
                                      assignMode && String(assignTargetRequestId) === String(request.id)
                                        ? "1px solid var(--accent-purple)"
                                        : "1px solid transparent",
                                    background: "var(--surface-muted)",
                                    cursor: assignMode && request.canAllocate ? "pointer" : "default",
                                    boxShadow:
                                      assignMode && String(assignTargetRequestId) === String(request.id)
                                        ? "0 0 0 2px rgba(var(--primary-rgb), 0.08)"
                                        : "none",
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                                      <div style={{ fontSize: "var(--text-label)", color: "var(--info-dark)" }}>
                                        {request.displayText || request.description}
                                      </div>
                                    {assignMode && String(assignTargetRequestId) === String(request.id) && (
                                      <div style={{ fontSize: "var(--text-caption)", color: "var(--accent-purple)", fontWeight: 600 }}>
                                          Selected allocation row
                                      </div>
                                    )}
                                      {request.detailText && (
                                        <div style={{ fontSize: "var(--text-caption)", color: "var(--info)" }}>
                                          {request.detailText}
                                        </div>
                                      )}
                                    </div>
                                    {assignMode ? (
                                      <span
                                        style={{
                                          padding: "6px 10px",
                                          borderRadius: "var(--radius-xs)",
                                          background:
                                            String(assignTargetRequestId) === String(request.id)
                                              ? "var(--accent-purple-surface)"
                                              : "var(--surface-light)",
                                          color:
                                            String(assignTargetRequestId) === String(request.id)
                                              ? "var(--accent-purple)"
                                              : "var(--text-secondary)",
                                          fontSize: "var(--text-caption)",
                                          fontWeight: 600,
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {String(assignTargetRequestId) === String(request.id) ? "Selected" : "Click to select"}
                                      </span>
                                    ) : null}
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
                                      <table
                                        data-dev-section="1"
                                        data-dev-section-key={`jobcard-parts-allocate-vhc-table-${request.id}`}
                                        data-dev-section-type="data-table"
                                        data-dev-section-parent={`jobcard-parts-vhc-request-${request.id}`}
                                        className="parts-allocate-subtable"
                                        style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-caption)", tableLayout: "fixed" }}
                                      >
                                        <thead data-dev-section="1" data-dev-section-key={`jobcard-parts-allocate-vhc-table-${request.id}-headings`} data-dev-section-type="table-headings" data-dev-section-parent={`jobcard-parts-allocate-vhc-table-${request.id}`}>
                                          <tr style={{ textTransform: "uppercase", color: "var(--info)" }}>
                                            <th style={{ textAlign: "left", padding: "6px" }}>Part number</th>
                                            <th style={{ textAlign: "left", padding: "6px" }}>Description</th>
                                            <th style={{ textAlign: "right", padding: "6px" }}>Qty</th>
                                            <th style={{ textAlign: "right", padding: "6px" }}>Retail</th>
                                            <th style={{ textAlign: "right", padding: "6px" }}>Cost</th>
                                            <th style={{ textAlign: "center", padding: "6px" }}>Unassign</th>
                                          </tr>
                                        </thead>
                                        <tbody data-dev-section="1" data-dev-section-key={`jobcard-parts-allocate-vhc-table-${request.id}-rows`} data-dev-section-type="table-rows" data-dev-section-parent={`jobcard-parts-allocate-vhc-table-${request.id}`}>
                                          {allocatedParts.map((part) => (
                                            <tr key={part.id} style={{ background: "var(--accent-purple-surface)", borderTop: "1px solid var(--surface-light)" }}>
                                              <td style={{ padding: "6px", fontWeight: 600, color: "var(--accent-purple)" }}>
                                                <span className="parts-allocate-cell-scroll">
                                                  {part.partNumber}
                                                </span>
                                              </td>
                                              <td style={{ padding: "6px", color: "var(--info-dark)" }}>
                                                <span className="parts-allocate-cell-scroll parts-allocate-description-cell">
                                                  {part.description || part.name}
                                                </span>
                                              </td>
                                              <td style={{ padding: "6px", textAlign: "right" }}>
                                                <span className="parts-allocate-cell-scroll">{part.quantity}</span>
                                              </td>
                                              <td style={{ padding: "6px", textAlign: "right" }}>
                                                <span className="parts-allocate-cell-scroll">{formatMoney(part.unitPrice)}</span>
                                              </td>
                                              <td style={{ padding: "6px", textAlign: "right" }}>
                                                <span className="parts-allocate-cell-scroll">{formatMoney(part.unitCost)}</span>
                                              </td>
                                              <td style={{ padding: "6px", textAlign: "center" }}>
                                                <button
                                                  type="button"
                                                  onClick={() => handleUnassignPart(part.id)}
                                                  disabled={!canEdit}
                                                  style={{
                                                    padding: "4px 8px",
                                                    borderRadius: "var(--radius-xs)",
                                                    border: "1px solid var(--danger)",
                                                    background: !canEdit ? "var(--surface-light)" : "var(--danger-surface)",
                                                    color: !canEdit ? "var(--text-secondary)" : "var(--danger)",
                                                    fontSize: "var(--text-caption)",
                                                    fontWeight: 600,
                                                    cursor: !canEdit ? "not-allowed" : "pointer",
                                                  }}
                                                >
                                                  <span className="parts-allocate-cell-scroll">Unassign</span>
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </DevLayoutSection>
                              );
                            })}
                          </DevLayoutSection>
                        ))
                      )}
                    </DevLayoutSection>
                  );
                })()}
            </div>
            )}
          </div>
          </DevLayoutSection>
        ) : (
          <DevLayoutSection
            className="on-order-section"
            sectionKey="jobcard-parts-on-order-panel"
            sectionType="content-card"
            parentKey="jobcard-parts-workspace"
            style={{
              background: "var(--surface)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "16px",
              minHeight: "400px",
              overflow: "hidden",
            }}
          >
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  fontSize: "var(--text-body-sm)",
                  fontWeight: 600,
                  color: "var(--primary)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                On Order
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "var(--text-caption)", color: "var(--info)" }}>
                {partsOnOrderFromDB.length > 0
                  ? `${partsOnOrderFromDB.length} part${partsOnOrderFromDB.length !== 1 ? "s" : ""} on order`
                  : "No parts currently on order"}
              </p>
            </div>
            {/* Fixed-size table container */}
            <div style={{ minHeight: "200px", display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  overflowX: "auto",
                  overflowY: "auto",
                  maxHeight: "600px",
                  flex: 1,
                  background: "var(--accent-purple-surface)",
                  borderRadius: "var(--radius-xs)",
                  padding: "8px",
                }}
              >
                <table
                  className="on-order-table"
                  data-dev-section="1"
                  data-dev-section-key="jobcard-parts-on-order-table"
                  data-dev-section-type="data-table"
                  data-dev-section-parent="jobcard-parts-on-order-panel"
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: "0 8px",
                    background: "var(--accent-purple-surface)",
                  }}
                >
                  <thead data-dev-section="1" data-dev-section-key="jobcard-parts-on-order-table-headings" data-dev-section-type="table-headings" data-dev-section-parent="jobcard-parts-on-order-table">
                    <tr style={{ textTransform: "uppercase", color: "var(--info)" }}>
                      <th style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--accent-purple-surface)", zIndex: 1 }}>Part Name</th>
                      <th style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--accent-purple-surface)", zIndex: 1 }}>Part Number</th>
                      <th style={{ textAlign: "right", position: "sticky", top: 0, background: "var(--accent-purple-surface)", zIndex: 1 }}>Qty</th>
                      <th style={{ textAlign: "right", position: "sticky", top: 0, background: "var(--accent-purple-surface)", zIndex: 1 }}>Price</th>
                      <th style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--accent-purple-surface)", zIndex: 1 }}>ETA Date</th>
                      <th style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--accent-purple-surface)", zIndex: 1 }}>ETA Time</th>
                      <th style={{ textAlign: "center", position: "sticky", top: 0, background: "var(--accent-purple-surface)", zIndex: 1 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody data-dev-section="1" data-dev-section-key="jobcard-parts-on-order-table-rows" data-dev-section-type="table-rows" data-dev-section-parent="jobcard-parts-on-order-table">
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
                        const isRemoved = normalizePartStatus(part.status) === "removed";
                        return (
                          <tr
                            key={part.id}
                            style={{
                              background: isRemoved ? "var(--danger)" : "var(--surface)",
                              opacity: isRemoved ? 0.8 : 1,
                            }}
                          >
                            <td style={{ color: "var(--info-dark)", borderTopLeftRadius: "8px", borderBottomLeftRadius: "8px" }}>
                              <span
                                className="part-name-cell on-order-cell-scroll"
                                onMouseDown={handlePartNameDragStart}
                                onMouseMove={handlePartNameDragMove}
                                onMouseUp={handlePartNameDragEnd}
                                onMouseLeave={handlePartNameDragEnd}
                              >
                                {part.partName}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, color: "var(--accent-purple)" }}>
                              <span className="on-order-cell-scroll">{part.partNumber}</span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <span className="on-order-cell-scroll">{part.quantity}</span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <span className="on-order-cell-scroll">{formatMoney(part.unitPrice)}</span>
                            </td>
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
                            <td style={{ textAlign: "center", borderTopRightRadius: "8px", borderBottomRightRadius: "8px" }}>
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
                                  borderRadius: "var(--radius-xs)",
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
                                <span className="on-order-cell-scroll">{isArrived ? "Arrived" : "Arrived?"}</span>
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
          </DevLayoutSection>
        )}
      </DevLayoutSection>

      {/* Part Removal Popup Modal */}
      {showPrePickPopup && (
        <ModalPortal>
          <div
            className="popup-backdrop"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowPrePickPopup(false);
              }
            }}
            style={{ zIndex: 10000 }}
          >
            <div
              className="popup-card"
              style={{
                borderRadius: "var(--radius-xl)",
                width: "100%",
                maxWidth: "560px",
                border: "none",
                background: "var(--surface)",
                padding: "var(--page-card-padding)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: "var(--text-body)", fontWeight: 700, color: "var(--primary)" }}>
                Set Pre-Picked Location
              </div>
              <div style={{ fontSize: "var(--text-label)", color: "var(--text-secondary)" }}>
                Choose a part already added to this job and assign its pre-pick location.
              </div>

              <DropdownField
                label="Part"
                placeholder="Select part"
                value={selectedPrePickPartId}
                onChange={(event) => setSelectedPrePickPartId(event.target.value)}
                options={prePickPartOptions}
                className="prepick-popup-dropdown"
              />

              <DropdownField
                label="Location"
                placeholder="Select location"
                value={selectedPrePickLocation}
                onChange={(event) => setSelectedPrePickLocation(event.target.value)}
                options={prePickLocationOptions}
                className="prepick-popup-dropdown"
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrePickPopup(false);
                    setSelectedPrePickPartId("");
                    setSelectedPrePickLocation("");
                  }}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "var(--radius-xs)",
                    border: "none",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-label)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitPrePickPopup}
                  disabled={!selectedPrePickPartId || savingPrePick}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "var(--radius-xs)",
                    border: "none",
                    background: !selectedPrePickPartId || savingPrePick ? "var(--surface-light)" : "var(--primary)",
                    color: !selectedPrePickPartId || savingPrePick ? "var(--text-secondary)" : "var(--text-inverse)",
                    fontSize: "var(--text-label)",
                    fontWeight: 600,
                    cursor: !selectedPrePickPartId || savingPrePick ? "not-allowed" : "pointer",
                  }}
                >
                  {savingPrePick ? "Saving..." : "Save Location"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

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
                borderRadius: "var(--radius-sm)",
                padding: "20px",
                minWidth: "300px",
                maxWidth: "400px",
                boxShadow: "var(--shadow-xl)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  fontSize: "var(--text-body)",
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
                  borderRadius: "var(--radius-xs)",
                }}
              >
                <div style={{ fontWeight: 600, color: "var(--accent-purple)", marginBottom: "4px" }}>
                  {partPopup.part.partNumber}
                </div>
                <div style={{ fontSize: "var(--text-label)", color: "var(--info-dark)", marginBottom: "4px" }}>
                  {partPopup.part.description || partPopup.part.name}
                </div>
                <div style={{ fontSize: "var(--text-caption)", color: "var(--info)" }}>
                  Quantity: {partPopup.part.quantity}
                </div>
              </div>
            </div>
            {Number(partPopup.part.quantity || 0) > 1 && (
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "var(--text-caption)",
                    color: "var(--info-dark)",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Quantity to remove
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={partRemoveQuantity}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "" || /^\d+$/.test(next)) {
                      setPartRemoveQuantity(next);
                    }
                  }}
                  placeholder="1"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "var(--radius-xs)",
                    border: "none",
                    fontSize: "var(--text-label)",
                    background: "var(--surface)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setPartPopup({ open: false, part: null })}
                style={{
                  padding: "10px 16px",
                  borderRadius: "var(--radius-xs)",
                  border: "none",
                  background: "var(--surface)",
                  color: "var(--info-dark)",
                  fontSize: "var(--text-label)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => handleRemovePartFromPopup("partial")}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "var(--radius-xs)",
                    border: "1px solid var(--danger)",
                    background: "var(--danger-surface)",
                    color: "var(--danger)",
                    fontSize: "var(--text-label)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => handleRemovePartFromPopup("all")}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "var(--radius-xs)",
                    border: "none",
                    background: "var(--danger)",
                    color: "white",
                    fontSize: "var(--text-label)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Remove All
                </button>
              </div>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
});

export default PartsTabNew;
