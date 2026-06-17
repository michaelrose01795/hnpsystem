// ✅ New Parts Tab with Drag & Drop Allocation
// file location: src/components/PartsTab.js
import React, { useState, useCallback, useEffect, useMemo, useRef, forwardRef } from "react";
import { usePolling } from "@/hooks/usePolling";
import CalendarField from "@/components/ui/calendarAPI/CalendarField";
import TimePickerField from "@/components/ui/timePickerAPI/TimePickerField";
import { DropdownField } from "@/components/ui/dropdownAPI";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import ModalPortal from "@/components/popups/ModalPortal";
import { SearchBar } from "@/components/ui/searchBarAPI";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
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

const formatPickedLocationLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return PRE_PICK_OPTIONS.find((option) => option.value === normalized)?.label || normalized;
};

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
  const [savingPrePickPartId, setSavingPrePickPartId] = useState("");
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
  // Redesigned parts table: search + status filter chips drive the single table.
  const [tableSearch, setTableSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all | allocated | on_order | back_order
  // Editable draft for the row-action (3-dot) popup. Holds local edits until saved.
  const [partDraft, setPartDraft] = useState(null);
  const [savingPartDetails, setSavingPartDetails] = useState(false);
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
      quantityRequested: item.quantityRequested ?? item.quantityAllocated ?? 0,
      quantityAllocated: item.quantityAllocated ?? 0,
      unitPrice: item.part?.unit_price ?? item.part?.unitPrice ?? 0,
      unitCost: item.part?.unit_cost ?? item.part?.unitCost ?? 0,
      qtyInStock: item.part?.qty_in_stock ?? item.part?.qtyInStock ?? 0,
      storageLocation: item.storageLocation || item.part?.storage_location || "Not assigned",
      status: item.status || "pending",
      stockStatus: item.stock_status || item.stockStatus || null,
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
          quantityRequested: item.quantity_requested ?? item.quantityRequested ?? 1,
          quantityAllocated: item.quantity_allocated ?? item.quantityAllocated ?? 0,
          unitPrice: item.unit_price ?? partData?.unit_price ?? 0,
          unitCost: item.unit_cost ?? partData?.unit_cost ?? 0,
          qtyInStock: partData?.qty_in_stock ?? 0,
          storageLocation: item.storage_location || item.storageLocation || partData?.storage_location || "Not assigned",
          status: item.status || "pending",
          stockStatus: item.stock_status || item.stockStatus || null,
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
      // Skip VHC-sourced parts — they already render under their VHC request,
      // so backfilling would duplicate the row as a phantom customer request.
      if (part?.vhcItemId) return;
      const key = String(requestId);
      if (customerReqMap.has(key)) return;
      if (vhcReqMap.has(key)) return;
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

  const handlePartPrePickLocationChange = useCallback(
    async (part, location) => {
      if (!part?.id || savingPrePickPartId) return;

      setSavingPrePickPartId(String(part.id));
      try {
        await handleUpdatePrePickLocation(part, location || null);
        setPartPopup((current) => {
          if (!current.open || !current.part || String(current.part.id) !== String(part.id)) {
            return current;
          }
          return {
            ...current,
            part: {
              ...current.part,
              prePickLocation: location || null,
            },
          };
        });
      } finally {
        setSavingPrePickPartId("");
      }
    },
    [handleUpdatePrePickLocation, savingPrePickPartId]
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

  // ── Redesigned single-table model ───────────────────────────────────────────
  // The parts tab now renders one summary + one table driven by jobParts.
  // Status display map for the table "Status" column + popup status dropdown.
  const PART_STATUS_META = useMemo(
    () => ({
      pending: { label: "Pending", badge: "app-badge--neutral" },
      priced: { label: "Priced", badge: "app-badge--neutral" },
      pre_pick: { label: "Pre-Picked", badge: "app-badge--accent-soft" },
      on_order: { label: "On Order", badge: "app-badge--warning" },
      booked: { label: "Booked", badge: "app-badge--accent-soft" },
      stock: { label: "In Stock", badge: "app-badge--success" },
      reserved: { label: "Reserved", badge: "app-badge--accent-soft" },
      removed: { label: "Removed", badge: "app-badge--danger" },
    }),
    []
  );

  // Status options offered in the row-action popup (canonical DB statuses).
  const statusOptions = useMemo(
    () => [
      { value: "pending", label: "Pending" },
      { value: "on_order", label: "On Order" },
      { value: "pre_picked", label: "Pre-Picked" },
      { value: "booked", label: "Booked" },
      { value: "stock", label: "In Stock" },
      { value: "removed", label: "Removed" },
    ],
    []
  );

  // Request lookup so each row can show which request the part is allocated to,
  // and the popup can offer a re-allocation dropdown.
  const requestById = useMemo(() => {
    const map = new Map();
    (allRequests || []).forEach((req) => map.set(String(req.id), req));
    return map;
  }, [allRequests]);

  const requestSelectOptions = useMemo(
    () => [
      { value: "", label: "Unallocated" },
      ...(allRequests || []).map((req) => ({
        value: String(req.id),
        label: `${req.type === "vhc" ? "VHC" : "Customer"} · ${String(req.description || "Request").slice(0, 48)}`,
      })),
    ],
    [allRequests]
  );

  // Derive every display value for a single table row from a jobParts entry.
  const derivePartRow = useCallback(
    (part) => {
      const statusKey = normalizePartStatus(part.status);
      const isRemoved = statusKey === "removed";
      const isOnOrder = statusKey === "on_order";
      const isBackOrder = String(part.stockStatus || "") === "back_order";
      const isAllocated = Boolean(part.allocatedToRequestId || part.vhcItemId);
      const qtyReq = Number(part.quantityRequested ?? part.quantity ?? 0);
      const qtyAlloc = Number(part.quantityAllocated ?? 0);
      // No dedicated "quantity_ordered" column — a part is "ordered" while it sits
      // on order, so the outstanding ordered qty = requested minus already allocated.
      const qtyOrd = isOnOrder ? Math.max(0, qtyReq - qtyAlloc) : 0;
      const unitPrice = Number(part.unitPrice ?? 0);
      const total = unitPrice * qtyReq;
      // Request label: customer requests link via allocatedToRequestId; VHC parts
      // link via vhcItemId (their request row id is "vhc-<id>" in allRequests).
      let requestLabel = "—";
      if (part.allocatedToRequestId && requestById.has(String(part.allocatedToRequestId))) {
        requestLabel = requestById.get(String(part.allocatedToRequestId)).description;
      } else if (part.vhcItemId && requestById.has(`vhc-${part.vhcItemId}`)) {
        requestLabel = requestById.get(`vhc-${part.vhcItemId}`).description;
      } else if (part.vhcItemId) {
        requestLabel = "VHC item";
      } else if (part.allocatedToRequestId) {
        requestLabel = `Request ${part.allocatedToRequestId}`;
      }
      const etaText = part.eta_date
        ? `${part.eta_date}${part.eta_time ? ` ${String(part.eta_time).slice(0, 5)}` : ""}`
        : "—";
      const locationLabel =
        formatPickedLocationLabel(part.prePickLocation) ||
        (part.storageLocation && part.storageLocation !== "Not assigned" ? part.storageLocation : "") ||
        "—";
      return {
        statusKey,
        statusMeta: PART_STATUS_META[statusKey] || { label: statusKey, badge: "app-badge--neutral" },
        isRemoved,
        isOnOrder,
        isBackOrder,
        isAllocated,
        qtyReq,
        qtyAlloc,
        qtyOrd,
        unitPrice,
        total,
        requestLabel,
        etaText,
        locationLabel,
        supplier: part.supplier_reference || "—",
      };
    },
    [PART_STATUS_META, requestById]
  );

  // Top-of-section summary counts.
  const partsSummary = useMemo(() => {
    const summary = { total: 0, allocated: 0, onOrder: 0, backOrder: 0, removed: 0, returned: 0 };
    jobParts.forEach((part) => {
      const statusKey = normalizePartStatus(part.status);
      summary.total += 1;
      if (statusKey === "removed") {
        summary.removed += 1;
        // Best-effort "Return": removed parts that had been ordered/allocated and
        // therefore need returning to the supplier.
        if (part.supplier_reference || Number(part.quantityAllocated ?? 0) > 0) summary.returned += 1;
        return;
      }
      if (part.allocatedToRequestId || part.vhcItemId || Number(part.quantityAllocated ?? 0) > 0) {
        summary.allocated += 1;
      }
      if (statusKey === "on_order") summary.onOrder += 1;
      if (String(part.stockStatus || "") === "back_order") summary.backOrder += 1;
    });
    return summary;
  }, [jobParts]);

  // Filter + search the single table.
  const tableParts = useMemo(() => {
    const term = tableSearch.trim().toLowerCase();
    return jobParts.filter((part) => {
      const statusKey = normalizePartStatus(part.status);
      if (activeFilter === "allocated" && !(part.allocatedToRequestId || part.vhcItemId || Number(part.quantityAllocated ?? 0) > 0)) {
        return false;
      }
      if (activeFilter === "on_order" && statusKey !== "on_order") return false;
      if (activeFilter === "back_order" && String(part.stockStatus || "") !== "back_order") return false;
      if (!term) return true;
      const haystack = [
        part.partNumber,
        part.name,
        part.description,
        part.supplier_reference,
        part.storageLocation,
        formatPickedLocationLabel(part.prePickLocation),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [jobParts, tableSearch, activeFilter]);

  const PARTS_FILTERS = useMemo(
    () => [
      { key: "all", label: "All Parts", count: partsSummary.total },
      { key: "allocated", label: "Allocated", count: partsSummary.allocated },
      { key: "on_order", label: "On Order", count: partsSummary.onOrder },
      { key: "back_order", label: "Back Order", count: partsSummary.backOrder },
    ],
    [partsSummary]
  );
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
    // Seed the editable draft for the row-action popup from the opened part.
    const part = partPopup.part;
    setPartDraft({
      id: part.id,
      status: normalizePartStatus(part.status),
      requestSelection: part.allocatedToRequestId
        ? String(part.allocatedToRequestId)
        : part.vhcItemId
        ? `vhc-${part.vhcItemId}`
        : "",
      prePickLocation: part.prePickLocation || "",
      storageLocation: part.storageLocation && part.storageLocation !== "Not assigned" ? part.storageLocation : "",
      quantityRequested: String(part.quantityRequested ?? part.quantity ?? 0),
      quantityAllocated: String(part.quantityAllocated ?? 0),
      unitPrice: String(part.unitPrice ?? 0),
      supplier_reference: part.supplier_reference || "",
      eta_date: part.eta_date || "",
      eta_time: part.eta_time ? String(part.eta_time).slice(0, 5) : "",
    });
  }, [partPopup]);

  // Save all editable fields from the row-action popup back to the DB, then
  // refresh so the table reflects the changes. Field updates are routed to the
  // endpoint that owns each concern (update-status / job-items / allocate).
  const handleSavePartDetails = useCallback(async () => {
    if (!partDraft?.id || !canEdit || !partPopup.part) return;
    const orig = partPopup.part;
    setSavingPartDetails(true);
    try {
      // 1) Status / pre-pick / ETA / supplier → /api/parts/update-status
      const statusBody = { partItemId: partDraft.id };
      let statusDirty = false;
      if (partDraft.status !== normalizePartStatus(orig.status)) {
        statusBody.status = partDraft.status;
        statusDirty = true;
      }
      if ((partDraft.prePickLocation || "") !== (orig.prePickLocation || "")) {
        statusBody.prePickLocation = partDraft.prePickLocation || null;
        statusDirty = true;
      }
      if ((partDraft.eta_date || "") !== (orig.eta_date || "")) {
        statusBody.etaDate = partDraft.eta_date || null;
        statusDirty = true;
      }
      if ((partDraft.eta_time || "") !== (orig.eta_time ? String(orig.eta_time).slice(0, 5) : "")) {
        statusBody.etaTime = partDraft.eta_time || null;
        statusDirty = true;
      }
      if ((partDraft.supplier_reference || "") !== (orig.supplier_reference || "")) {
        statusBody.supplierReference = partDraft.supplier_reference || null;
        statusDirty = true;
      }
      if (statusDirty) {
        const res = await fetch("/api/parts/update-status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(statusBody),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || data.error || "Failed to update part status");
      }

      // 2) Quantities / price / storage → /api/parts/job-items/{id}
      const itemBody = {};
      if (Number(partDraft.quantityRequested) !== Number(orig.quantityRequested ?? orig.quantity ?? 0)) {
        itemBody.quantityRequested = Number(partDraft.quantityRequested) || 0;
      }
      if (Number(partDraft.quantityAllocated) !== Number(orig.quantityAllocated ?? 0)) {
        itemBody.quantityAllocated = Number(partDraft.quantityAllocated) || 0;
      }
      if (Number(partDraft.unitPrice) !== Number(orig.unitPrice ?? 0)) {
        itemBody.unit_price = Number(partDraft.unitPrice) || 0;
      }
      if ((partDraft.storageLocation || "") !== (orig.storageLocation && orig.storageLocation !== "Not assigned" ? orig.storageLocation : "")) {
        itemBody.storage_location = partDraft.storageLocation || null;
      }
      if (Object.keys(itemBody).length > 0) {
        const res = await fetch(`/api/parts/job-items/${partDraft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemBody),
        });
        const data = await res.json();
        if (!res.ok || data?.ok === false) throw new Error(data?.error || data?.message || "Failed to update part quantities");
      }

      // 3) Request allocation → /api/parts/allocate-to-request (set) or clear via job-items PATCH.
      const origReq = orig.allocatedToRequestId
        ? String(orig.allocatedToRequestId)
        : orig.vhcItemId
        ? `vhc-${orig.vhcItemId}`
        : "";
      if ((partDraft.requestSelection || "") !== origReq) {
        if (partDraft.requestSelection) {
          const res = await fetch("/api/parts/allocate-to-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ partAllocationId: partDraft.id, requestId: partDraft.requestSelection, jobId }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.message || "Failed to allocate part to request");
        } else {
          const res = await fetch(`/api/parts/job-items/${partDraft.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ allocated_to_request_id: null, vhc_item_id: null }),
          });
          const data = await res.json();
          if (!res.ok || data?.ok === false) throw new Error(data?.error || data?.message || "Failed to unallocate part");
        }
      }

      await refreshCatalogStockState();
      if (typeof onRefreshJob === "function") onRefreshJob();
      setPartPopup({ open: false, part: null });
      setPartDraft(null);
    } catch (error) {
      console.error("Failed to save part details:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setSavingPartDetails(false);
    }
  }, [partDraft, partPopup.part, canEdit, jobId, onRefreshJob, refreshCatalogStockState]);

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
          width: 46%;
        }

        .parts-allocate-subtable th:nth-child(2),
        .parts-allocate-subtable td:nth-child(2),
        .parts-allocate-subtable th:nth-child(3),
        .parts-allocate-subtable td:nth-child(3),
        .parts-allocate-subtable th:nth-child(4),
        .parts-allocate-subtable td:nth-child(4) {
          width: 12%;
        }

        .parts-allocate-subtable th:nth-child(5),
        .parts-allocate-subtable td:nth-child(5) {
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
            width: 52%;
          }

          .parts-allocate-subtable th:nth-child(2),
          .parts-allocate-subtable td:nth-child(2),
          .parts-allocate-subtable th:nth-child(3),
          .parts-allocate-subtable td:nth-child(3),
          .parts-allocate-subtable th:nth-child(4),
          .parts-allocate-subtable td:nth-child(4) {
            width: 10%;
          }

          .parts-allocate-subtable th:nth-child(5),
          .parts-allocate-subtable td:nth-child(5) {
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
          color: var(--text-1);
        }
      `}</style>
      {/* ===== Parts Metrics ===== */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "10px",
        }}
      >
        {[
          { label: "Allocated", value: partsSummary.allocated },
          { label: "On Order", value: partsSummary.onOrder },
          { label: "Back Order", value: partsSummary.backOrder },
          { label: "Return", value: partsSummary.returned },
          { label: "Removed", value: partsSummary.removed },
          { label: "Total Parts", value: partsSummary.total },
        ].map((item) => (
          <LayerSurface
            key={item.label}
            as="li"
            sectionKey={`jobcard-parts-metric-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            sectionType="stat-card"
            parentKey="jobcard-tab-parts"
            radius="var(--radius-sm)"
            padding="12px"
            gap="2px"
            style={{ alignItems: "flex-start" }}
          >
            <span style={{ fontSize: "var(--text-h3)", fontWeight: 700, color: "var(--text-1)", lineHeight: 1.1 }}>
              {item.value}
            </span>
            <span
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--text-1)",
                opacity: 0.7,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {item.label}
            </span>
          </LayerSurface>
        ))}
      </ul>

      {/* ===== Parts Table Section ===== */}
      <LayerSurface
        sectionKey="jobcard-parts-table-section"
        sectionType="section-shell"
        parentKey="jobcard-tab-parts"
        shell
        radius="var(--radius-sm)"
        padding="16px"
        gap="14px"
      >
        {/* Controls: status filters + search + Book Part toggle */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {PARTS_FILTERS.map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveFilter(f.key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-pill)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "var(--text-caption)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    background: isActive ? "var(--accent-purple)" : "var(--theme)",
                    color: isActive ? "var(--text-2)" : "var(--text-1)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {f.label} ({f.count})
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flex: "1 1 240px",
              justifyContent: "flex-end",
              minWidth: "200px",
            }}
          >
            <SearchBar
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              onClear={() => setTableSearch("")}
              placeholder="Search parts in table..."
              style={{ flex: "1 1 200px", maxWidth: "320px" }}
            />
            <button
              type="button"
              onClick={toggleBookPartPanel}
              disabled={!canAllocateParts}
              className="app-table-action-btn app-table-action-btn--primary"
              style={{ whiteSpace: "nowrap", opacity: canAllocateParts ? 1 : 0.6 }}
            >
              {showBookPartPanel ? "Hide" : "Book Part"}
            </button>
          </div>
        </div>

        {/* Book Part panel — search stock and add to the job (unchanged behaviour) */}
        {showBookPartPanel && (
          <LayerTheme
            sectionKey="jobcard-parts-stock-search"
            sectionType="content-card"
            parentKey="jobcard-parts-table-section"
            radius="var(--radius-sm)"
            padding="16px"
            gap="12px"
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
                Search Parts Stock
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "var(--text-label)", color: "var(--text-1)", opacity: 0.7 }}>
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
              style={{ width: "100%", opacity: canAllocateParts ? 1 : 0.7 }}
            />
            {catalogLoading && (
              <div>
                <InlineLoading width={120} label="Searching" />
              </div>
            )}
            {!catalogLoading && catalogError && (
              <div style={{ fontSize: "var(--text-caption)", color: "var(--danger)" }}>{catalogError}</div>
            )}
            {canAllocateParts && !catalogLoading && catalogResults.length > 0 && (
              <div style={{ maxHeight: "200px", overflowY: "auto", borderRadius: "var(--radius-sm)" }}>
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
                        borderBottom: "1px solid var(--separating-line)",
                        textAlign: "left",
                        background: isSelected ? "var(--surface)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "var(--accent-purple)", fontSize: "var(--text-body-sm)" }}>
                        {part.name}
                      </div>
                      <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.75 }}>
                        Part #: {part.part_number} · Supplier: {part.supplier || "Unknown"}
                      </div>
                      <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.6 }}>
                        Stock: {part.qty_in_stock ?? 0} · £{Number(part.unit_price || 0).toFixed(2)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {selectedCatalogPart && (
              <LayerSurface radius="var(--radius-sm)" padding="12px" gap="10px">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--accent-purple)", fontSize: "var(--text-body-sm)" }}>
                      {selectedCatalogPart.name}
                    </div>
                    <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.75 }}>
                      Part #: {selectedCatalogPart.part_number} · Location: {selectedCatalogPart.storage_location || "Unassigned"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedCatalogPart}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text-1)",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "var(--text-label)",
                    }}
                  >
                    Clear
                  </button>
                </div>
                {/* auto-fit keeps the three fields in a row on desktop, stacks them on narrow screens (CLAUDE.md §3.6) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.75, display: "block", marginBottom: "4px" }}>
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
                        background: "var(--theme)",
                        color: "var(--text-1)",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.75, marginBottom: "4px" }}>Available</div>
                    <div style={{ fontWeight: 700, fontSize: "var(--text-body)", color: "var(--accent-purple)" }}>
                      {selectedCatalogPart.qty_in_stock ?? 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.75, marginBottom: "4px" }}>Sell Price</div>
                    <div style={{ fontWeight: 700, fontSize: "var(--text-body)", color: "var(--accent-purple)" }}>
                      £{Number(selectedCatalogPart.unit_price || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
                {catalogSubmitError && (
                  <div style={{ padding: "8px", borderRadius: "var(--radius-xs)", background: "var(--warning-surface)", color: "var(--danger)", fontSize: "var(--text-caption)" }}>
                    {catalogSubmitError}
                  </div>
                )}
                {catalogSuccessMessage && (
                  <div style={{ padding: "8px", borderRadius: "var(--radius-xs)", background: "var(--success-surface)", color: "var(--success-dark)", fontSize: "var(--text-caption)" }}>
                    {catalogSuccessMessage}
                  </div>
                )}
                {/* auto-fit keeps the buttons side-by-side on desktop, stacks them on very narrow screens (CLAUDE.md §3.6) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={handleAddPartFromStock}
                    disabled={!canAllocateParts || allocatingPart}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: !canAllocateParts ? "var(--theme)" : "var(--accent-purple)",
                      color: "var(--text-2)",
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
                      border: "none",
                      background: "var(--theme)",
                      color: !canAllocateParts ? "var(--text-1)" : "var(--accent-purple)",
                      fontWeight: 600,
                      cursor: !canAllocateParts ? "not-allowed" : "pointer",
                      fontSize: "var(--text-body-sm)",
                    }}
                  >
                    {allocatingPart ? "Adding..." : "Add to Order"}
                  </button>
                </div>
              </LayerSurface>
            )}
            {catalogSuccessMessage && !selectedCatalogPart && (
              <div style={{ padding: "10px", borderRadius: "var(--radius-xs)", background: "var(--success-surface)", color: "var(--success-dark)", fontSize: "var(--text-label)", textAlign: "center" }}>
                {catalogSuccessMessage}
              </div>
            )}
            {catalogSubmitError && !selectedCatalogPart && (
              <div style={{ padding: "10px", borderRadius: "var(--radius-xs)", background: "var(--warning-surface)", color: "var(--danger)", fontSize: "var(--text-label)", textAlign: "center" }}>
                {catalogSubmitError}
              </div>
            )}
          </LayerTheme>
        )}

        {/* The parts table */}
        <div style={{ overflowX: "auto" }}>
          <table
            className="app-data-table app-data-table--rounded"
            data-dev-section="1"
            data-dev-section-key="jobcard-parts-table"
            data-dev-section-type="data-table"
            data-dev-section-parent="jobcard-parts-table-section"
            data-dev-disable-table-subsections="1"
            style={{ width: "100%", minWidth: "1040px", borderCollapse: "separate", borderSpacing: 0, fontSize: "var(--text-caption)" }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Part Details</th>
                <th style={{ textAlign: "left" }}>Request</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th style={{ textAlign: "left" }}>Location</th>
                <th style={{ textAlign: "right" }}>Qty Req</th>
                <th style={{ textAlign: "right" }}>Qty Alloc</th>
                <th style={{ textAlign: "right" }}>Qty Ord</th>
                <th style={{ textAlign: "left" }}>Supplier</th>
                <th style={{ textAlign: "left" }}>ETA</th>
                <th style={{ textAlign: "right" }}>Unit Price</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tableParts.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center", padding: "24px", color: "var(--text-1)", opacity: 0.7 }}>
                    {jobParts.length === 0
                      ? "No parts added to this job yet. Use Book Part to add one."
                      : "No parts match this filter or search."}
                  </td>
                </tr>
              ) : (
                tableParts.map((part) => {
                  const row = derivePartRow(part);
                  return (
                    <tr
                      key={part.id}
                      style={{
                        opacity: row.isRemoved ? 0.7 : 1,
                        textDecoration: row.isRemoved ? "line-through" : "none",
                      }}
                    >
                      <td style={{ textAlign: "left", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                          <span style={{ fontWeight: 600, color: row.isRemoved ? "var(--text-1)" : "var(--accent-purple)" }}>
                            {part.partNumber}
                          </span>
                          <span style={{ color: "var(--text-1)", opacity: 0.8 }}>{part.description || part.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "left", verticalAlign: "middle", color: "var(--text-1)" }}>
                        {row.requestLabel}
                      </td>
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        <span className={`app-badge ${row.statusMeta.badge}`}>{row.statusMeta.label}</span>
                        {row.isBackOrder && (
                          <span className="app-badge app-badge--danger" style={{ marginLeft: "4px" }}>Back Order</span>
                        )}
                      </td>
                      <td style={{ textAlign: "left", verticalAlign: "middle", color: "var(--text-1)" }}>{row.locationLabel}</td>
                      <td style={{ textAlign: "right", verticalAlign: "middle", fontWeight: 600, color: "var(--text-1)" }}>{row.qtyReq}</td>
                      <td style={{ textAlign: "right", verticalAlign: "middle", color: "var(--text-1)" }}>{row.qtyAlloc}</td>
                      <td style={{ textAlign: "right", verticalAlign: "middle", color: "var(--text-1)" }}>{row.qtyOrd}</td>
                      <td style={{ textAlign: "left", verticalAlign: "middle", color: "var(--text-1)" }}>{row.supplier}</td>
                      <td style={{ textAlign: "left", verticalAlign: "middle", color: "var(--text-1)" }}>{row.etaText}</td>
                      <td style={{ textAlign: "right", verticalAlign: "middle", color: "var(--text-1)" }}>{formatMoney(row.unitPrice)}</td>
                      <td style={{ textAlign: "right", verticalAlign: "middle", fontWeight: 600, color: "var(--text-1)" }}>{formatMoney(row.total)}</td>
                      <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                        <button
                          type="button"
                          aria-label={`Edit part ${part.partNumber}`}
                          title="Edit part details"
                          onClick={() => setPartPopup({ open: true, part })}
                          className="app-table-action-btn app-table-action-btn--ghost"
                          style={{ minWidth: "32px", padding: "0 8px", fontSize: "var(--text-body)", lineHeight: 1, fontWeight: 700 }}
                        >
                          &#8942;
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </LayerSurface>

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
                Set Picked Location
              </div>
              <div style={{ fontSize: "var(--text-label)", color: "var(--text-1)" }}>
                Choose a part already added to this job and assign the location it has been picked to.
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
                    color: "var(--text-1)",
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
                    background: !selectedPrePickPartId || savingPrePick ? "var(--surface)" : "var(--primary)",
                    color: !selectedPrePickPartId || savingPrePick ? "var(--text-1)" : "var(--text-2)",
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
            <LayerSurface
              radius="var(--radius-sm)"
              padding="var(--section-card-padding)"
              gap="var(--layout-card-gap)"
              style={{
                width: "min(92vw, 680px)",
                maxWidth: "680px",
                maxHeight: "calc(100dvh - 48px)",
                overflowY: "auto",
                boxShadow: "var(--shadow-xl)",
                color: "var(--text-1)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "var(--layout-card-gap)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--text-h3)",
                      fontWeight: 700,
                      color: "var(--text-1)",
                    }}
                  >
                    Part Details
                  </div>
                  <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.78 }}>
                    Edit any detail for this job item — changes apply on Save.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setPartPopup({ open: false, part: null })}
                >
                  Close
                </Button>
              </div>

              <LayerTheme radius="var(--radius-xs)" padding="14px" gap="8px">
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "var(--layout-card-gap)",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "var(--text-1)", overflowWrap: "anywhere" }}>
                      {partPopup.part.partNumber}
                    </div>
                    <div style={{ fontSize: "var(--text-label)", color: "var(--text-1)", opacity: 0.78, overflowWrap: "anywhere" }}>
                      {partPopup.part.description || partPopup.part.name}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      minHeight: "32px",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: "var(--text-caption)",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Qty {partPopup.part.quantity}
                  </div>
                </div>
              </LayerTheme>

              {partDraft && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "var(--layout-card-gap)",
                    alignItems: "end",
                  }}
                >
                  <DropdownField
                    label="Status"
                    placeholder="Select status"
                    value={partDraft.status}
                    onChange={(event) => setPartDraft((d) => ({ ...d, status: event.target.value }))}
                    options={statusOptions}
                    disabled={!canEdit}
                  />
                  <DropdownField
                    label="Allocated request"
                    placeholder="Unallocated"
                    value={partDraft.requestSelection}
                    onChange={(event) => setPartDraft((d) => ({ ...d, requestSelection: event.target.value }))}
                    options={requestSelectOptions}
                    disabled={!canEdit}
                  />
                  <DropdownField
                    className="parts-part-details-prepick-dropdown"
                    menuClassName="parts-part-details-prepick-menu"
                    menuStyle={{
                      maxHeight: "136px",
                      overflowY: "auto",
                      overflowX: "hidden",
                      overscrollBehavior: "contain",
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                      WebkitOverflowScrolling: "touch",
                      touchAction: "pan-y",
                    }}
                    label="Pre-pick location"
                    placeholder="Select pre-pick location"
                    value={partDraft.prePickLocation}
                    onChange={(event) => setPartDraft((d) => ({ ...d, prePickLocation: event.target.value }))}
                    options={prePickLocationOptions}
                    disabled={!canEdit || partPopup.part.source === "goods-in"}
                  />
                  <div>
                    <label style={{ fontSize: "var(--control-label-size)", color: "var(--text-1)", fontWeight: "var(--control-label-weight)", display: "block", marginBottom: "6px" }}>
                      Storage location
                    </label>
                    <input
                      type="text"
                      className="app-input"
                      value={partDraft.storageLocation}
                      onChange={(e) => setPartDraft((d) => ({ ...d, storageLocation: e.target.value }))}
                      placeholder="Not assigned"
                      disabled={!canEdit}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "var(--control-label-size)", color: "var(--text-1)", fontWeight: "var(--control-label-weight)", display: "block", marginBottom: "6px" }}>
                      Qty requested
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="app-input"
                      value={partDraft.quantityRequested}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === "" || /^\d+$/.test(next)) setPartDraft((d) => ({ ...d, quantityRequested: next }));
                      }}
                      disabled={!canEdit}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "var(--control-label-size)", color: "var(--text-1)", fontWeight: "var(--control-label-weight)", display: "block", marginBottom: "6px" }}>
                      Qty allocated
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="app-input"
                      value={partDraft.quantityAllocated}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === "" || /^\d+$/.test(next)) setPartDraft((d) => ({ ...d, quantityAllocated: next }));
                      }}
                      disabled={!canEdit}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "var(--control-label-size)", color: "var(--text-1)", fontWeight: "var(--control-label-weight)", display: "block", marginBottom: "6px" }}>
                      Unit price (£)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="app-input"
                      value={partDraft.unitPrice}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === "" || /^\d*\.?\d*$/.test(next)) setPartDraft((d) => ({ ...d, unitPrice: next }));
                      }}
                      disabled={!canEdit}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "var(--control-label-size)", color: "var(--text-1)", fontWeight: "var(--control-label-weight)", display: "block", marginBottom: "6px" }}>
                      Supplier reference
                    </label>
                    <input
                      type="text"
                      className="app-input"
                      value={partDraft.supplier_reference}
                      onChange={(e) => setPartDraft((d) => ({ ...d, supplier_reference: e.target.value }))}
                      placeholder="—"
                      disabled={!canEdit}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "var(--control-label-size)", color: "var(--text-1)", fontWeight: "var(--control-label-weight)", display: "block", marginBottom: "6px" }}>
                      ETA date
                    </label>
                    <input
                      type="date"
                      className="app-input"
                      value={partDraft.eta_date}
                      onChange={(e) => setPartDraft((d) => ({ ...d, eta_date: e.target.value }))}
                      disabled={!canEdit}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "var(--control-label-size)", color: "var(--text-1)", fontWeight: "var(--control-label-weight)", display: "block", marginBottom: "6px" }}>
                      ETA time
                    </label>
                    <input
                      type="time"
                      className="app-input"
                      value={partDraft.eta_time}
                      onChange={(e) => setPartDraft((d) => ({ ...d, eta_time: e.target.value }))}
                      disabled={!canEdit}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "var(--control-label-size)", color: "var(--text-1)", fontWeight: "var(--control-label-weight)", display: "block", marginBottom: "6px" }}>
                      Quantity to remove
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="app-input"
                      value={partRemoveQuantity}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === "" || /^\d+$/.test(next)) setPartRemoveQuantity(next);
                      }}
                      placeholder="1"
                      disabled={!canEdit}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              )}

              <style jsx global>{`
                html.staff-scope .parts-part-details-prepick-menu::-webkit-scrollbar {
                  width: 0;
                  height: 0;
                }
              `}</style>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: "var(--text-caption)", color: "var(--text-1)", opacity: 0.74 }}>
                  {canEdit ? "Changes apply to this job item only." : "Read-only: editing is unavailable."}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemovePartFromPopup("partial")}
                    disabled={!canEdit || savingPartDetails}
                  >
                    Remove
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemovePartFromPopup("all")}
                    disabled={!canEdit || savingPartDetails}
                  >
                    Remove All
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleSavePartDetails}
                    disabled={!canEdit || savingPartDetails}
                  >
                    {savingPartDetails ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </LayerSurface>
          </div>
        </ModalPortal>
      )}
    </>
  );
});

export default PartsTabNew;
