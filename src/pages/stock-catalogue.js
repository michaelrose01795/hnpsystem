// file location: src/pages/stock-catalogue.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import {
  summarizePartsPipeline,
  mapPartStatusToPipelineId,
  getPipelineStageMeta } from
"@/lib/parts/pipeline";
import { supabase } from "@/lib/database/supabaseClient";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";
import { isValidUuid, sanitizeNumericId } from "@/lib/utils/ids";
import useBodyModalLock from "@/hooks/useBodyModalLock";
import ConfirmationDialog from "@/components/popups/ConfirmationDialog";
import { SearchBar } from "@/components/ui/searchBarAPI";
import StockCataloguePageUi from "@/components/page-ui/stock-catalogue-ui"; // Extracted presentation layer.

const PRE_PICK_OPTIONS = [
{ value: "", label: "Not assigned" },
{ value: "service_rack_1", label: "Service Rack 1" },
{ value: "service_rack_2", label: "Service Rack 2" },
{ value: "service_rack_3", label: "Service Rack 3" },
{ value: "service_rack_4", label: "Service Rack 4" },
{ value: "sales_rack_1", label: "Sales Rack 1 (TODO)" },
{ value: "sales_rack_2", label: "Sales Rack 2 (TODO)" },
{ value: "sales_rack_3", label: "Sales Rack 3 (TODO)" },
{ value: "sales_rack_4", label: "Sales Rack 4 (TODO)" },
{ value: "stairs_pre_pick", label: "Stairs (Sales Pre-pick)" },
{ value: "no_pick", label: "No Pick" },
{ value: "on_order", label: "On Order" }];


const DEFAULT_DELIVERY_FORM = {
  supplier: "",
  orderReference: "",
  partId: "",
  quantityOrdered: 1,
  quantityReceived: 1,
  unitCost: "",
  notes: ""
};

const DEFAULT_NEW_PART_FORM = {
  partNumber: "",
  name: "",
  supplier: "",
  category: "",
  storageLocation: "",
  unitCost: "",
  unitPrice: "",
  notes: ""
};

const STORAGE_LOCATION_CODES = Array.from({ length: 26 }).
map((_, letterIndex) => {
  const letter = String.fromCharCode(65 + letterIndex);
  return Array.from({ length: 10 }).map((__, numberIndex) => `${letter}${numberIndex + 1}`);
}).
flat();

const normaliseLocationInput = (value = "") =>
String(value || "").
toUpperCase().
replace(/[^A-Z0-9]/g, "");

const isValidLocationCode = (value = "") =>
STORAGE_LOCATION_CODES.includes(normaliseLocationInput(value || ""));

const filterStorageLocations = (search = "") => {
  const term = normaliseLocationInput(search || "");
  if (!term) {
    return STORAGE_LOCATION_CODES;
  }
  return STORAGE_LOCATION_CODES.filter((code) => code.includes(term));
};

const JOB_PART_STATUSES = [
"pending",
"waiting_authorisation",
"awaiting_stock",
"on_order",
"pre_picked",
"stock",
"allocated",
"picked",
"fitted",
"cancelled"];


const cardStyle = {
  backgroundColor: "var(--section-card-bg)",
  borderRadius: "var(--section-card-radius)",
  padding: "var(--section-card-padding)",
  border: "var(--section-card-border)"
};

const sectionTitleStyle = {
  fontSize: "var(--text-h3)",
  fontWeight: 600,
  color: "var(--primary)",
  marginBottom: "12px"
};

const buttonStyle = {
  backgroundColor: "var(--primary)",
  color: "white",
  border: "none",
  padding: "var(--control-padding)",
  borderRadius: "var(--radius-xs)",
  cursor: "pointer",
  fontWeight: 600
};

const secondaryButtonStyle = {
  ...buttonStyle,
  backgroundColor: "var(--surface)",
  color: "var(--primary)",
  border: "1px solid var(--primary)"
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse"
};

const STATUS_COLOR_MAP = {
  waiting_authorisation: { background: "rgba(var(--warning-rgb), 0.2)", color: "var(--danger-dark)" },
  awaiting_stock: { background: "rgba(var(--warning-rgb), 0.4)", color: "var(--danger-dark)" },
  on_order: { background: "rgba(var(--info-rgb), 0.6)", color: "var(--accent-purple)" },
  pre_picked: { background: "rgba(var(--accent-purple-rgb), 0.6)", color: "var(--accent-purple)" },
  stock: { background: "rgba(var(--success-rgb), 0.8)", color: "var(--info-dark)" },
  pending: { background: "rgba(var(--grey-accent-rgb), 0.8)", color: "var(--info-dark)" },
  allocated: { background: "rgba(var(--info-rgb), 0.8)", color: "var(--info-dark)" },
  picked: { background: "rgba(var(--accent-purple-rgb), 0.8)", color: "var(--accent-purple)" },
  fitted: { background: "rgba(var(--success-rgb), 0.8)", color: "var(--info-dark)" },
  cancelled: { background: "rgba(var(--danger-rgb), 0.8)", color: "var(--danger)" }
};

const SOURCE_META = {
  vhc_red: { label: "VHC Red", background: "rgba(var(--danger-rgb), 0.2)", color: "var(--danger)" },
  vhc_amber: { label: "VHC Amber", background: "rgba(var(--warning-rgb), 0.25)", color: "var(--danger-dark)" },
  vhc: { label: "VHC", background: "rgba(var(--danger-rgb), 0.15)", color: "var(--danger)" },
  vhc_auto: { label: "VHC Auto-Order", background: "rgba(var(--danger-rgb), 0.15)", color: "var(--danger)" },
  tech_request: { label: "Tech Request", background: "rgba(var(--info-rgb), 0.18)", color: "var(--accent-purple)" },
  parts_workspace: { label: "Manual", background: "rgba(var(--grey-accent-rgb), 0.3)", color: "var(--info-dark)" },
  manual: { label: "Manual", background: "rgba(var(--grey-accent-rgb), 0.3)", color: "var(--info-dark)" }
};

const formatStatusLabel = (status) =>
status ? status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "Unknown";

const resolveStatusStyles = (status) => STATUS_COLOR_MAP[status] || { background: "rgba(var(--grey-accent-rgb), 0.8)", color: "var(--info-dark)" };

const resolveSourceMeta = (origin = "") => {
  const normalized = typeof origin === "string" ? origin.toLowerCase() : "";
  if (SOURCE_META[normalized]) return SOURCE_META[normalized];
  if (normalized.includes("vhc")) return SOURCE_META.vhc;
  if (normalized.includes("tech")) return SOURCE_META.tech_request;
  return SOURCE_META.manual;
};

const LINKED_JOB_DISPLAY_STATUSES = new Set(["booked", "allocated"]);
const matchesLinkedJobStatus = (status) => {
  const normalized = String(status || "").toLowerCase();
  return LINKED_JOB_DISPLAY_STATUSES.has(normalized);
};

const RequirementBadge = ({ label, background, color }) =>
<span
  style={{
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: "var(--radius-pill)",
    fontSize: "var(--text-caption)",
    fontWeight: 600,
    background,
    color
  }}>
  
    {label}
  </span>;


function StockCataloguePage() {
  const router = useRouter();
  const { user, dbUserId, authUserId } = useUser();
  const actingUserId = useMemo(() => {
    if (typeof authUserId === "string" && isValidUuid(authUserId)) return authUserId;
    if (typeof user?.authUuid === "string" && isValidUuid(user.authUuid)) return user.authUuid;
    if (typeof user?.id === "string" && isValidUuid(user.id)) return user.id;
    return null;
  }, [authUserId, user?.authUuid, user?.id]);
  const actingUserNumericId = useMemo(
    () => sanitizeNumericId(dbUserId),
    [dbUserId]
  );

  const [jobCardSectionExpanded, setJobCardSectionExpanded] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState("");
  const [jobData, setJobData] = useState(null);
  const [jobParts, setJobParts] = useState([]);
  const [jobRequests, setJobRequests] = useState([]);
  const [selectedPipelineStage, setSelectedPipelineStage] = useState("all");

  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedPart, setSelectedPart] = useState(null);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  useBodyModalLock(isPartModalOpen);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedPart, setEditedPart] = useState(null);
  const [isSavingPart, setIsSavingPart] = useState(false);
  const [showAddToJobModal, setShowAddToJobModal] = useState(false);
  const [addToJobSearch, setAddToJobSearch] = useState("");
  const [addToJobQuantity, setAddToJobQuantity] = useState(1);
  const [addToJobSearching, setAddToJobSearching] = useState(false);
  const [addToJobSubmitting, setAddToJobSubmitting] = useState(false);
  const [addToJobError, setAddToJobError] = useState("");
  const [addToJobResult, setAddToJobResult] = useState(null);
  const [filterType, setFilterType] = useState("status");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [displayLimit, setDisplayLimit] = useState(20);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventory, setInventory] = useState([]);

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState(DEFAULT_DELIVERY_FORM);
  const [deliveryFormError, setDeliveryFormError] = useState("");
  const [deliveryPartSearch, setDeliveryPartSearch] = useState("");
  const [deliveryStorageLocation, setDeliveryStorageLocation] = useState("");
  const [showNewPartForm, setShowNewPartForm] = useState(false);
  const [newPartForm, setNewPartForm] = useState(DEFAULT_NEW_PART_FORM);
  const [newPartLocationSearch, setNewPartLocationSearch] = useState("");
  const [newPartFormError, setNewPartFormError] = useState("");
  const [newPartSaving, setNewPartSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [detectedCategory, setDetectedCategory] = useState("");

  const {
    inventorySearch: queryInventorySearch,
    partNumber: queryPartNumber,
    part: queryPart,
    search: querySearch,
    newPart: queryNewPart,
    partName: queryNewPartName
  } = router.query || {};

  const inventorySearchQueryParam = useMemo(
    () => (queryInventorySearch || queryPartNumber || queryPart || querySearch || "").toString(),
    [queryInventorySearch, queryPartNumber, queryPart, querySearch]
  );
  const lastInventoryQueryApplied = useRef("");

  useEffect(() => {
    if (!router.isReady) return;
    if (String(queryNewPart) !== "1") return;
    setShowNewPartForm(true);
    setNewPartForm((prev) => ({
      ...prev,
      partNumber: queryPartNumber ? String(queryPartNumber) : prev.partNumber,
      name: queryNewPartName ? String(queryNewPartName) : prev.name
    }));
  }, [router.isReady, queryNewPart, queryPartNumber, queryNewPartName]);

  const selectedDeliveryPart = useMemo(
    () => inventory.find((part) => part.id === deliveryForm.partId),
    [inventory, deliveryForm.partId]
  );

  const filteredDeliveryParts = useMemo(() => {
    const term = deliveryPartSearch.trim().toLowerCase();
    const source = inventory || [];
    if (!term) {
      return [];
    }
    return source.
    filter((part) => {
      const number = (part.part_number || "").toLowerCase();
      return number.includes(term);
    }).
    slice(0, 3);
  }, [deliveryPartSearch, inventory]);

  const filteredNewPartLocations = useMemo(() => {
    if (!newPartLocationSearch.trim()) return [];
    return filterStorageLocations(newPartLocationSearch).slice(0, 3);
  }, [newPartLocationSearch]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return [];
    const term = categorySearch.trim().toLowerCase();
    return categories.
    filter((cat) => cat.name.toLowerCase().includes(term)).
    slice(0, 3);
  }, [categorySearch, categories]);


  const pendingJobParts = useMemo(
    () =>
    jobParts.filter(
      (part) =>
      part.status === "pending" || part.status === "awaiting_stock"
    ),
    [jobParts]
  );

  const partsPipeline = useMemo(
    () => summarizePartsPipeline(jobParts, { quantityField: "quantity_requested" }),
    [jobParts]
  );

  const displayedJobParts = useMemo(() => {
    if (selectedPipelineStage === "all") return jobParts;
    const stageMap = partsPipeline.stageMap || {};
    return stageMap[selectedPipelineStage]?.parts || [];
  }, [jobParts, partsPipeline.stageMap, selectedPipelineStage]);

  const formatCurrency = (value) =>
  value !== null && value !== undefined ?
  `£${Number(value).toFixed(2)}` :
  "£0.00";

  const formatMargin = (cost, price) => {
    const unitCost = Number(cost || 0);
    const unitPrice = Number(price || 0);
    const diff = unitPrice - unitCost;
    const percent = unitPrice !== 0 ? diff / unitPrice * 100 : 0;
    return `${formatCurrency(diff)} (${percent.toFixed(0)}%)`;
  };

  const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString(undefined, { hour12: false }) : "—";

  const fetchInventory = useCallback(async (term = "") => {
    setInventoryLoading(true);
    setInventoryError("");
    try {
      const trimmed = (term || "").trim();
      if (trimmed.length >= 2) {
        const searchParams = new URLSearchParams({
          search: trimmed,
          limit: "100"
        });
        const response = await fetch(`/api/parts/catalog?${searchParams.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || "Failed to load inventory");
        }
        setInventory(payload.parts || []);
        return payload.parts || [];
      } else {
        const query = new URLSearchParams({
          search: trimmed,
          includeInactive: "false",
          limit: "100"
        });
        const response = await fetch(`/api/parts/inventory?${query}`);
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Failed to load inventory");
        }
        setInventory(data.parts || []);
        return data.parts || [];
      }
    } catch (err) {
      setInventoryError(err.message || "Unable to load inventory");
      return [];
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase.
      from("part_categories").
      select("id, name, keywords").
      order("name", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  }, []);

  const detectCategory = useCallback((partName = "", partDescription = "") => {
    const searchText = `${partName} ${partDescription}`.toLowerCase();

    for (const category of categories) {
      const keywords = category.keywords || [];
      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          return category.name;
        }
      }
    }
    return "";
  }, [categories]);

  const searchJob = useCallback(
    async (term) => {
      if (!term) return;

      setJobLoading(true);
      setJobError("");
      try {
        const query = new URLSearchParams({ search: term });
        const response = await fetch(`/api/parts/jobs?${query}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Job card not found or inaccessible"
          );
        }

        setJobData(data.job || null);
        setJobParts(data.parts || []);
        setJobRequests(data.requests || []);
      } catch (err) {
        setJobError(err.message || "Unable to load job card");
        setJobData(null);
        setJobParts([]);
        setJobRequests([]);
      } finally {
        setJobLoading(false);
      }
    },
    []
  );

  const resetAddToJobModal = useCallback(() => {
    setAddToJobSearch("");
    setAddToJobQuantity(1);
    setAddToJobSearching(false);
    setAddToJobSubmitting(false);
    setAddToJobError("");
    setAddToJobResult(null);
  }, []);

  const refreshSelectedPartFromDb = useCallback(async () => {
    if (!selectedPart?.part_number) return;
    const controller = new AbortController();
    try {
      const query = new URLSearchParams({
        search: String(selectedPart.part_number),
        includeInactive: "true",
        limit: "25"
      });
      const response = await fetch(`/api/parts/inventory?${query.toString()}`, {
        signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok || !data?.success || !Array.isArray(data.parts)) return;

      const updated = data.parts.find((part) => part.id === selectedPart.id) ||
      data.parts.find((part) => part.part_number === selectedPart.part_number);
      if (updated) {
        setSelectedPart((prev) => prev?.id === updated.id ? { ...prev, ...updated } : updated);
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Failed to refresh part links:", error);
      }
    }
    return () => controller.abort();
  }, [selectedPart?.id, selectedPart?.part_number]);

  const handleAddToJobSearch = useCallback(async () => {
    const term = (addToJobSearch || "").trim();
    if (!term) {
      setAddToJobError("Enter a job number or registration to search.");
      return;
    }

    setAddToJobSearching(true);
    setAddToJobError("");
    setAddToJobResult(null);
    try {
      const query = new URLSearchParams({ search: term });
      const response = await fetch(`/api/parts/jobs?${query}`);
      const data = await response.json();

      if (!response.ok || !data.success || !data.job) {
        throw new Error(data.message || "Job card not found");
      }

      setAddToJobResult(data.job);
    } catch (err) {
      setAddToJobError(err.message || "Unable to find job");
    } finally {
      setAddToJobSearching(false);
    }
  }, [addToJobSearch]);

  const handleAddPartToJob = useCallback(async () => {
    const partId = selectedPart?.id;
    const jobId = addToJobResult?.id;
    const quantity = Math.max(1, Number.parseInt(addToJobQuantity, 10) || 1);

    if (!partId) {
      setAddToJobError("Select a part before adding to a job.");
      return;
    }

    if (!jobId) {
      setAddToJobError("Search and select a job first.");
      return;
    }

    setAddToJobSubmitting(true);
    setAddToJobError("");
    try {
      const response = await fetch("/api/parts/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          partId,
          quantityRequested: quantity,
          allocateFromStock: false,
          status: "booked",
          origin: "parts_workspace",
          userId: actingUserId,
          userNumericId: actingUserNumericId
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to add part to job");
      }

      await refreshSelectedPartFromDb();

      setShowAddToJobModal(false);
      resetAddToJobModal();
    } catch (err) {
      setAddToJobError(err.message || "Unable to add part to job");
    } finally {
      setAddToJobSubmitting(false);
    }
  }, [
  addToJobQuantity,
  addToJobResult?.id,
  actingUserId,
  actingUserNumericId,
  refreshSelectedPartFromDb,
  resetAddToJobModal,
  selectedPart?.id]
  );

  const refreshJob = useCallback(() => {
    if (jobData?.jobNumber) {
      searchJob(jobData.jobNumber);
    } else if (jobSearch) {
      searchJob(jobSearch);
    }
  }, [jobData?.jobNumber, jobSearch, searchJob]);

  useEffect(() => {
    setSelectedPipelineStage("all");
  }, [jobData?.id]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!inventorySearchQueryParam) {
      lastInventoryQueryApplied.current = "";
      return;
    }
    if (lastInventoryQueryApplied.current === inventorySearchQueryParam) {
      return;
    }
    lastInventoryQueryApplied.current = inventorySearchQueryParam;
    setInventorySearch(inventorySearchQueryParam);
  }, [router.isReady, inventorySearchQueryParam]);

  useEffect(() => {
    if (!isPartModalOpen || !selectedPart?.part_number || isEditMode) return;
    refreshSelectedPartFromDb();
  }, [isEditMode, isPartModalOpen, refreshSelectedPartFromDb, selectedPart?.part_number]);

  useEffect(() => {
    fetchInventory("");
    fetchCategories();
  }, [fetchInventory, fetchCategories]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchInventory(inventorySearch);
    }, 400);
    return () => clearTimeout(handler);
  }, [inventorySearch, fetchInventory]);

  // Close location dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdown = document.getElementById('location-dropdown');
      if (dropdown && dropdown.style.display === 'block') {
        const target = event.target;
        if (!target.closest('#location-dropdown') && !target.closest('input[placeholder="Search location..."]')) {
          dropdown.style.display = 'none';
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showDeliveryModal) return;
    const handler = setTimeout(() => {
      fetchInventory(deliveryPartSearch.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [deliveryPartSearch, fetchInventory, showDeliveryModal]);

  useEffect(() => {
    if (!showNewPartForm) return;
    const detected = detectCategory(newPartForm.name, newPartForm.notes);
    setDetectedCategory(detected);
    if (detected && !newPartForm.category) {
      setNewPartForm((prev) => ({ ...prev, category: detected }));
    }
  }, [newPartForm.name, newPartForm.notes, detectCategory, showNewPartForm, newPartForm.category]);

  useEffect(() => {
    if (showNewPartForm) {
      setNewPartLocationSearch(newPartForm.storageLocation || "");
    }
  }, [showNewPartForm, newPartForm.storageLocation]);

  const resetDeliveryModal = useCallback(() => {
    setDeliveryForm(DEFAULT_DELIVERY_FORM);
    setDeliveryFormError("");
    setDeliveryPartSearch("");
    setDeliveryStorageLocation("");
    setShowNewPartForm(false);
    setNewPartForm(DEFAULT_NEW_PART_FORM);
    setNewPartLocationSearch("");
    setNewPartFormError("");
    setNewPartSaving(false);
    setCategorySearch("");
    setDetectedCategory("");
  }, []);

  const handleDeliveryPartSelection = useCallback((part) => {
    if (!part) {
      setDeliveryForm((prev) => ({ ...prev, partId: "" }));
      setDeliveryPartSearch("");
      setDeliveryStorageLocation("");
      return;
    }
    setDeliveryForm((prev) => ({
      ...prev,
      partId: part.id || "",
      supplier: part.supplier || "",
      unitCost: part.unit_cost || "",
      quantityOrdered: prev.quantityReceived || 1
    }));
    // Show only part number in search field
    setDeliveryPartSearch(part.part_number || "");
    const normalisedLocation = normaliseLocationInput(part.storage_location || "");
    if (normalisedLocation) {
      setDeliveryStorageLocation(normalisedLocation);
    } else {
      setDeliveryStorageLocation("");
    }
    setDeliveryFormError("");
  }, []);

  const handleNewPartLocationSelect = useCallback((location) => {
    const normalised = normaliseLocationInput(location || "");
    setNewPartForm((prev) => ({ ...prev, storageLocation: normalised }));
    setNewPartLocationSearch(normalised);
  }, []);

  const handleCategorySelect = useCallback((categoryName) => {
    setNewPartForm((prev) => ({ ...prev, category: categoryName }));
    setCategorySearch("");
  }, []);

  const handleCreateCategory = useCallback(async (categoryName) => {
    const trimmed = categoryName.trim();
    if (!trimmed) return;

    try {
      const { data, error } = await supabase.
      from("part_categories").
      insert([{ name: trimmed, keywords: [] }]).
      select().
      single();

      if (error) throw error;

      setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewPartForm((prev) => ({ ...prev, category: data.name }));
      setCategorySearch("");
    } catch (err) {
      console.error("Error creating category:", err);
      alert("Failed to create category: " + err.message);
    }
  }, []);

  const handleCreateNewPart = useCallback(async () => {
    if (!newPartForm.partNumber.trim()) {
      setNewPartFormError("Part number is required.");
      return;
    }

    const desiredLocation = normaliseLocationInput(
      newPartForm.storageLocation || newPartLocationSearch
    );
    const resolvedLocation = isValidLocationCode(desiredLocation) ? desiredLocation : null;
    const trimmedNumber = newPartForm.partNumber.trim();
    const trimmedName = (newPartForm.name || trimmedNumber).trim();

    setNewPartSaving(true);
    setNewPartFormError("");
    try {
      const response = await fetch("/api/parts/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: actingUserId,
          userNumericId: actingUserNumericId,
          partNumber: trimmedNumber,
          partName: trimmedName,
          supplier: newPartForm.supplier || null,
          category: newPartForm.category || null,
          storageLocation: resolvedLocation,
          unitCost: newPartForm.unitCost ? Number(newPartForm.unitCost) : null,
          unitPrice: newPartForm.unitPrice ? Number(newPartForm.unitPrice) : null
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create part");
      }

      const createdPart = data.part;
      setInventory((prev) => {
        const others = prev.filter((item) => item.id !== createdPart.id);
        return [createdPart, ...others];
      });
      const trimmedSupplier = (newPartForm.supplier || "").trim();
      setDeliveryForm((prev) => {
        const updatedDeliveryForm = { ...prev, partId: createdPart.id };
        if (trimmedSupplier) {
          updatedDeliveryForm.supplier = trimmedSupplier;
        }
        if (newPartForm.unitCost) {
          updatedDeliveryForm.unitCost = newPartForm.unitCost;
        }
        if (newPartForm.unitPrice) {
          updatedDeliveryForm.unitPrice = newPartForm.unitPrice;
        }
        return updatedDeliveryForm;
      });
      handleDeliveryPartSelection(createdPart);
      if (resolvedLocation || createdPart.storage_location) {
        const locationToUse = createdPart.storage_location || resolvedLocation || "";
        setDeliveryStorageLocation(locationToUse);
      }
      setShowNewPartForm(false);
      setNewPartForm(DEFAULT_NEW_PART_FORM);
      setNewPartLocationSearch("");
      setCategorySearch("");
      setDetectedCategory("");
      await fetchInventory(inventorySearch);
    } catch (err) {
      setNewPartFormError(err.message || "Unable to create part");
    } finally {
      setNewPartSaving(false);
    }
  }, [
  actingUserId,
  actingUserNumericId,
  fetchInventory,
  handleDeliveryPartSelection,
  inventorySearch,
  newPartForm,
  newPartLocationSearch]
  );

  const handleJobPartUpdate = async (jobPartId, updates) => {
    try {
      const response = await fetch(`/api/parts/jobs/${jobPartId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updates,
          userId: actingUserId,
          userNumericId: actingUserNumericId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update job part");
      }

      await Promise.all([
      refreshJob(),
      fetchInventory(inventorySearch)]
      );
    } catch (err) {
      alert(err.message || "Unable to update job part"); // quick feedback
    }
  };

  const handleEditPart = () => {
    setEditedPart({ ...selectedPart });
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditedPart(null);
    setIsEditMode(false);
  };

  const handleSavePart = async () => {
    if (!editedPart || !editedPart.id) return;

    setIsSavingPart(true);
    try {
      const response = await fetch(`/api/parts/catalog/${editedPart.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedPart.name,
          description: editedPart.description,
          category: editedPart.category,
          supplier: editedPart.supplier,
          unit_cost: parseFloat(editedPart.unit_cost) || 0,
          unit_price: parseFloat(editedPart.unit_price) || 0,
          qty_in_stock: parseInt(editedPart.qty_in_stock) || 0,
          qty_reserved: parseInt(editedPart.qty_reserved) || 0,
          qty_on_order: parseInt(editedPart.qty_on_order) || 0,
          reorder_level: parseInt(editedPart.reorder_level) || 0,
          storage_location: editedPart.storage_location,
          service_default_zone: editedPart.service_default_zone,
          notes: editedPart.notes
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update part");
      }

      // Update local state
      setSelectedPart(data.part);
      setInventory((prev) =>
      prev.map((part) => part.id === data.part.id ? data.part : part)
      );
      setIsEditMode(false);
      setEditedPart(null);
    } catch (error) {
      console.error("Failed to save part:", error);
      alert("Failed to save changes: " + error.message);
    } finally {
      setIsSavingPart(false);
    }
  };

  const handleDeliverySubmit = async () => {
    if (!deliveryForm.partId) {
      setDeliveryFormError("Select a part to log a delivery.");
      return;
    }
    if (!deliveryStorageLocation) {
      setDeliveryFormError("Select a storage location for this delivery.");
      return;
    }

    try {
      const response = await fetch("/api/parts/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier: deliveryForm.supplier || null,
          orderReference: deliveryForm.orderReference || null,
          notes: deliveryForm.notes || null,
          status: deliveryForm.quantityReceived > 0 ? "received" : "ordering",
          userId: actingUserId,
          userNumericId: actingUserNumericId,
          items: [
          {
            partId: deliveryForm.partId,
            quantityOrdered: deliveryForm.quantityOrdered,
            quantityReceived: deliveryForm.quantityReceived,
            unitCost: deliveryForm.unitCost || null,
            storageLocation: deliveryStorageLocation,
            notes: deliveryForm.notes || null
          }]

        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to log delivery");
      }

      setShowDeliveryModal(false);
      resetDeliveryModal();

      await Promise.all([
      fetchInventory(inventorySearch),
      refreshJob()]
      );
    } catch (err) {
      setDeliveryFormError(err.message || "Unable to log delivery");
    }
  };

  const renderAddToJobModal = () => {
    if (!showAddToJobModal || !selectedPart) return null;

    return (
      <div
        style={{
          ...popupOverlayStyles,
          zIndex: 1500
        }}
        onClick={() => {
          setShowAddToJobModal(false);
          resetAddToJobModal();
        }}>
        
        <div
          style={{
            ...popupCardStyles,
            width: "min(540px, 92vw)",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "24px"
          }}
          onClick={(event) => event.stopPropagation()}>
          
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Add part to job</h2>
            <button
              type="button"
              onClick={() => {
                setShowAddToJobModal(false);
                resetAddToJobModal();
              }}
              style={{
                background: "var(--surface-light)",
                border: "none",
                borderRadius: "var(--radius-xs)",
                fontSize: "var(--text-h3)",
                cursor: "pointer",
                color: "var(--text-secondary)",
                padding: "6px 10px"
              }}>
              
              ×
            </button>
          </div>

          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--surface)"
            }}>
            
            <div style={{ fontWeight: 600, color: "var(--primary)" }}>{selectedPart.part_number}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-body)" }}>
              {selectedPart.name || "Unnamed part"}
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", marginBottom: "10px" }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Search job number</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={addToJobSearch}
                  onChange={(event) => setAddToJobSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddToJobSearch();
                    }
                  }}
                  placeholder="Enter job number or reg"
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "var(--radius-xs)",
                    border: "none"
                  }} />
                
                <button
                  type="button"
                  onClick={handleAddToJobSearch}
                  disabled={addToJobSearching}
                  style={{
                    ...buttonStyle,
                    padding: "10px 16px",
                    background: addToJobSearching ? "var(--surface-light)" : "var(--primary)",
                    cursor: addToJobSearching ? "not-allowed" : "pointer"
                  }}>
                  
                  {addToJobSearching ? "Searching..." : "Search"}
                </button>
              </div>
            </label>

            {addToJobError &&
            <div style={{ color: "var(--danger)", fontSize: "var(--text-body)", marginBottom: "10px" }}>
                {addToJobError}
              </div>
            }

            {addToJobResult &&
            <div
              style={{
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "12px",
                marginBottom: "12px",
                background: "var(--surface)"
              }}>
              
                <div style={{ fontWeight: 700, color: "var(--primary)" }}>
                  Job #{addToJobResult.jobNumber}
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-body)", marginTop: "4px" }}>
                  {[addToJobResult.reg, addToJobResult.makeModel].filter(Boolean).join(" • ")}
                </div>
                {addToJobResult.description &&
              <div style={{ color: "var(--info)", fontSize: "var(--text-body-sm)", marginTop: "4px" }}>
                    {addToJobResult.description}
                  </div>
              }
              </div>
            }

            <label style={{ display: "block", marginBottom: "12px" }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Quantity</span>
              <input
                type="number"
                min={1}
                value={addToJobQuantity}
                onChange={(event) =>
                setAddToJobQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))
                }
                style={{
                  width: "120px",
                  padding: "8px",
                  borderRadius: "var(--radius-xs)",
                  border: "none"
                }} />
              
            </label>

            <button
              type="button"
              onClick={handleAddPartToJob}
              disabled={!addToJobResult || addToJobSearching || addToJobSubmitting}
              style={{
                ...buttonStyle,
                width: "100%",
                background: !addToJobResult || addToJobSearching || addToJobSubmitting ? "var(--surface-light)" : "var(--primary)",
                cursor: !addToJobResult || addToJobSearching || addToJobSubmitting ? "not-allowed" : "pointer"
              }}>
              
              {addToJobSubmitting ? "Adding..." : "Add part to job"}
            </button>
          </div>
        </div>
      </div>);

  };

  const renderDeliveryModal = () => {
    if (!showDeliveryModal) return null;

    return (
      <div
        style={{
          ...popupOverlayStyles,
          zIndex: 1500
        }}>
        
        <div
          style={{
            ...popupCardStyles,
            width: "min(520px, 90vw)",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "28px"
          }}>
          
          <h2 style={{ ...sectionTitleStyle, marginBottom: "16px" }}>Goods In</h2>

          <label style={{ display: "block", marginBottom: "12px" }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Supplier
            </span>
            <input
              type="text"
              value={deliveryForm.supplier}
              onChange={(event) =>
              setDeliveryForm((prev) => ({ ...prev, supplier: event.target.value }))
              }
              placeholder="E.g. TPS, Euro Car Parts"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "var(--radius-xs)",
                border: "none"
              }} />
            
          </label>

          <label style={{ display: "block", marginBottom: "12px" }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Order Reference
            </span>
            <input
              type="text"
              value={deliveryForm.orderReference}
              onChange={(event) =>
              setDeliveryForm((prev) => ({
                ...prev,
                orderReference: event.target.value
              }))
              }
              placeholder="Supplier order number"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "var(--radius-xs)",
                border: "none"
              }} />
            
          </label>

          <div style={{ marginBottom: "12px" }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Part
            </span>
            <input
              type="text"
              value={deliveryPartSearch}
              onChange={(event) => setDeliveryPartSearch(event.target.value)}
              placeholder="Search by part number"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "var(--radius-xs)",
                border: "none"
              }} />
            
            {deliveryPartSearch.trim() &&
            <div
              style={{
                border: "none",
                borderRadius: "var(--radius-sm)",
                marginTop: "8px",
                maxHeight: "180px",
                overflowY: "auto"
              }}>
              
                {filteredDeliveryParts.length === 0 ?
              <div style={{ padding: "12px", color: "var(--info)" }}>
                    {inventoryLoading ? "Loading inventory…" : "No matching parts"}
                  </div> :

              filteredDeliveryParts.map((part) => {
                const isSelected = part.id === deliveryForm.partId;
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => handleDeliveryPartSelection(part)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      borderBottom: "1px solid var(--surface-light)",
                      background: isSelected ? "var(--surface-light)" : "transparent",
                      cursor: "pointer"
                    }}>
                    
                        <div style={{ fontWeight: 600, color: "var(--primary-dark)" }}>
                          {part.part_number || "—"}
                        </div>
                        <div style={{ fontSize: "var(--text-body-sm)", color: "var(--info-dark)" }}>
                          {part.name || "Unnamed part"}
                        </div>
                      </button>);

              })
              }
              </div>
            }
            {deliveryForm.partId && selectedDeliveryPart &&
            <div style={{ marginTop: "8px", fontSize: "var(--text-body-sm)", color: "var(--accent-purple)" }}>
                Selected: {selectedDeliveryPart.part_number} · {selectedDeliveryPart.name}{" "}
                <button
                type="button"
                onClick={() => handleDeliveryPartSelection(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--danger)",
                  cursor: "pointer",
                  fontWeight: 600
                }}>
                
                  Clear
                </button>
              </div>
            }
          </div>

          <button
            type="button"
            onClick={() => {
              setShowNewPartForm((prev) => !prev);
              setNewPartFormError("");
            }}
            style={{
              ...secondaryButtonStyle,
              width: "100%",
              marginBottom: "12px"
            }}>
            
            {showNewPartForm ? "Close" : "Add New Part"}
          </button>

          {showNewPartForm &&
          <div
            style={{
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "16px",
              marginBottom: "12px",
              background: "var(--surface)"
            }}>
            
              <label style={{ display: "block", marginBottom: "10px" }}>
                <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                  Paste Bulk Data
                </span>
                <p style={{ fontSize: "var(--text-body-sm)", color: "var(--info-dark)", marginBottom: "8px", margin: "4px 0 8px 0" }}>
                  Paste one part per line with 8 fields: Order Ref, Part Number, Name, Supplier, Location, Cost Price, Sell Price, Quantity
                </p>
                <textarea
                value={newPartForm.notes}
                onChange={(event) => {
                  const text = event.target.value;
                  setNewPartForm((prev) => ({ ...prev, notes: text }));

                  // Auto-parse and fill fields from pasted data
                  const lines = text.trim().split("\n").filter((l) => l.trim());
                  if (lines.length >= 8) {
                    setNewPartForm((prev) => ({
                      ...prev,
                      partNumber: lines[1]?.trim() || prev.partNumber,
                      name: lines[2]?.trim() || prev.name,
                      supplier: lines[3]?.trim() || prev.supplier,
                      storageLocation: lines[4]?.trim() || prev.storageLocation,
                      unitCost: lines[5]?.replace(/[£$]/g, "").trim() || prev.unitCost,
                      unitPrice: lines[6]?.replace(/[£$]/g, "").trim() || prev.unitPrice
                    }));
                    setNewPartLocationSearch(lines[4]?.trim() || "");
                  }
                }}
                placeholder={`Example:\nORD001\nOILF1\nOil Filter\nEuro Car Parts\nA1\n£4.00\n£9.99\n10`}
                rows={8}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "var(--radius-xs)",
                  border: "none",
                  resize: "vertical",
                  fontFamily: "var(--font-family-mono)",
                  fontSize: "var(--text-caption)"
                }} />
              
              </label>

              <label style={{ display: "block", marginBottom: "10px" }}>
                <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                  Part Number
                </span>
                <input
                type="text"
                value={newPartForm.partNumber}
                onChange={(event) =>
                setNewPartForm((prev) => ({ ...prev, partNumber: event.target.value }))
                }
                placeholder="e.g. 03C109244"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "var(--radius-xs)",
                  border: "none"
                }} />
              
              </label>

              <label style={{ display: "block", marginBottom: "10px" }}>
                <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                  Part Name
                </span>
                <input
                type="text"
                value={newPartForm.name}
                onChange={(event) =>
                setNewPartForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. Timing belt kit"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "var(--radius-xs)",
                  border: "none"
                }} />
              
              </label>

              <div style={{ marginBottom: "10px" }}>
                <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                  Category {detectedCategory && <span style={{ color: "var(--accent-purple)", fontWeight: 500, fontSize: "var(--text-body-sm)" }}>(Auto-detected: {detectedCategory})</span>}
                </span>
                <input
                type="text"
                value={categorySearch || newPartForm.category}
                onChange={(e) => {
                  const value = e.target.value;
                  setCategorySearch(value);
                  if (!value.trim()) {
                    setNewPartForm((prev) => ({ ...prev, category: "" }));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && categorySearch.trim()) {
                    e.preventDefault();
                    const exactMatch = categories.find(
                      (cat) => cat.name.toLowerCase() === categorySearch.trim().toLowerCase()
                    );
                    if (exactMatch) {
                      handleCategorySelect(exactMatch.name);
                    } else {
                      const trimmedCat = categorySearch.trim();
                      setConfirmDialog({
                        message: `Category "${trimmedCat}" doesn't exist. Create it?`,
                        onConfirm: () => {
                          setConfirmDialog(null);
                          handleCreateCategory(trimmedCat);
                        }
                      });
                    }
                  }
                }}
                placeholder="Type to search or create new category"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "var(--radius-xs)",
                  border: "none"
                }} />
              
                {categorySearch.trim() &&
              <div
                style={{
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  marginTop: "6px",
                  maxHeight: "120px",
                  overflowY: "auto"
                }}>
                
                    {filteredCategories.length === 0 ?
                <button
                  type="button"
                  onClick={() => handleCreateCategory(categorySearch.trim())}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    border: "none",
                    background: "var(--accent-purple)",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 600
                  }}>
                  
                        + Create "{categorySearch.trim()}"
                      </button> :

                filteredCategories.map((cat) =>
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.name)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    border: "none",
                    borderBottom: "1px solid var(--surface-light)",
                    background: cat.name === newPartForm.category ? "var(--surface-light)" : "transparent",
                    cursor: "pointer",
                    fontWeight: cat.name === newPartForm.category ? 700 : 500
                  }}>
                  
                          {cat.name}
                        </button>
                )
                }
                  </div>
              }
                {newPartForm.category &&
              <p style={{ marginTop: "4px", fontSize: "var(--text-body-sm)", color: "var(--accent-purple)" }}>
                    Selected: {newPartForm.category}{" "}
                    <button
                  type="button"
                  onClick={() => {
                    setNewPartForm((prev) => ({ ...prev, category: "" }));
                    setCategorySearch("");
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--danger)",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "var(--text-body-sm)"
                  }}>
                  
                      Clear
                    </button>
                  </p>
              }
              </div>

              <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "10px",
                marginBottom: "10px"
              }}>
              
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                    Supplier
                  </span>
                  <input
                  type="text"
                  value={newPartForm.supplier}
                  onChange={(event) =>
                  setNewPartForm((prev) => ({ ...prev, supplier: event.target.value }))
                  }
                  placeholder="Optional"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "var(--radius-xs)",
                    border: "none"
                  }} />
                
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                    Storage Location
                  </span>
                  <input
                  type="text"
                  value={newPartLocationSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setNewPartLocationSearch(value);
                    const normalised = normaliseLocationInput(value);
                    if (isValidLocationCode(normalised)) {
                      setNewPartForm((prev) => ({
                        ...prev,
                        storageLocation: normalised
                      }));
                    } else if (!value.trim()) {
                      setNewPartForm((prev) => ({ ...prev, storageLocation: "" }));
                    }
                  }}
                  placeholder="Search (e.g. B2)"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "var(--radius-xs)",
                    border: "none"
                  }} />
                
                  {newPartLocationSearch.trim() &&
                <div
                  style={{
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    marginTop: "6px",
                    maxHeight: "120px",
                    overflowY: "auto"
                  }}>
                  
                      {filteredNewPartLocations.length === 0 ?
                  <div style={{ padding: "8px", color: "var(--info)" }}>No matches</div> :

                  filteredNewPartLocations.map((code) =>
                  <button
                    type="button"
                    key={code}
                    onClick={() => handleNewPartLocationSelect(code)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 10px",
                      border: "none",
                      borderBottom: "1px solid var(--surface-light)",
                      background:
                      code === newPartForm.storageLocation ?
                      "var(--surface-light)" :
                      "transparent",
                      cursor: "pointer",
                      fontWeight: code === newPartForm.storageLocation ? 700 : 500
                    }}>
                    
                            {code}
                          </button>
                  )
                  }
                    </div>
                }
                  {newPartForm.storageLocation &&
                <p style={{ marginTop: "4px", fontSize: "var(--text-body-sm)", color: "var(--accent-purple)" }}>
                      Selected: {newPartForm.storageLocation}
                    </p>
                }
                </label>
              </div>

              <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "10px"
              }}>
              
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                    Unit Cost
                  </span>
                  <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPartForm.unitCost}
                  onChange={(event) =>
                  setNewPartForm((prev) => ({ ...prev, unitCost: event.target.value }))
                  }
                  placeholder="Optional"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "var(--radius-xs)",
                    border: "none"
                  }} />
                
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                    Unit Price
                  </span>
                  <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPartForm.unitPrice}
                  onChange={(event) =>
                  setNewPartForm((prev) => ({ ...prev, unitPrice: event.target.value }))
                  }
                  placeholder="Optional"
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "var(--radius-xs)",
                    border: "none"
                  }} />
                
                </label>
              </div>

              {newPartFormError &&
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "rgba(var(--danger-rgb), 0.08)",
                color: "var(--danger)",
                fontWeight: 600
              }}>
              
                  {newPartFormError}
                </div>
            }

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                type="button"
                onClick={() => {
                  setShowNewPartForm(false);
                  setNewPartForm(DEFAULT_NEW_PART_FORM);
                  setNewPartLocationSearch("");
                  setNewPartFormError("");
                }}
                style={secondaryButtonStyle}>
                
                  Close
                </button>
                <button
                type="button"
                onClick={handleCreateNewPart}
                style={buttonStyle}
                disabled={newPartSaving}>
                
                  {newPartSaving ? "Saving…" : "Save Part"}
                </button>
              </div>
            </div>
          }

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "12px"
            }}>
            
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
                Qty Ordered
              </span>
              <input
                type="number"
                min="0"
                value={deliveryForm.quantityOrdered}
                onChange={(event) =>
                setDeliveryForm((prev) => ({
                  ...prev,
                  quantityOrdered: Math.max(0, Number(event.target.value) || 0)
                }))
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "var(--radius-xs)",
                  border: "none"
                }} />
              
            </label>

            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
                Qty Received
              </span>
              <input
                type="number"
                min="0"
                value={deliveryForm.quantityReceived}
                onChange={(event) =>
                setDeliveryForm((prev) => ({
                  ...prev,
                  quantityReceived: Math.max(0, Number(event.target.value) || 0)
                }))
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "var(--radius-xs)",
                  border: "none"
                }} />
              
            </label>
          </div>

          <label style={{ display: "block", marginBottom: "12px" }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Unit Cost (optional)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={deliveryForm.unitCost}
              onChange={(event) =>
              setDeliveryForm((prev) => ({
                ...prev,
                unitCost: event.target.value
              }))
              }
              placeholder="Enter if known for spending tracking"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "var(--radius-xs)",
                border: "none"
              }} />
            
          </label>

          <label style={{ display: "block", marginBottom: "12px" }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Notes
            </span>
            <textarea
              value={deliveryForm.notes}
              onChange={(event) =>
              setDeliveryForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              rows={3}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "var(--radius-xs)",
                border: "none",
                resize: "vertical"
              }} />
            
          </label>

          {deliveryFormError &&
          <div style={{ color: "var(--danger)", marginBottom: "12px", fontWeight: 600 }}>
              {deliveryFormError}
            </div>
          }

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                setShowDeliveryModal(false);
                resetDeliveryModal();
              }}
              style={secondaryButtonStyle}>
              
              Cancel
            </button>
            <button onClick={handleDeliverySubmit} style={buttonStyle}>
              Save Delivery
            </button>
          </div>
        </div>
      </div>);

  };

  return <StockCataloguePageUi view="section1" buttonStyle={buttonStyle} cardStyle={cardStyle} ConfirmationDialog={ConfirmationDialog} confirmDialog={confirmDialog} displayedJobParts={displayedJobParts} displayLimit={displayLimit} editedPart={editedPart} filterType={filterType} formatCurrency={formatCurrency} formatDateTime={formatDateTime} formatMargin={formatMargin} formatStatusLabel={formatStatusLabel} getPipelineStageMeta={getPipelineStageMeta} handleCancelEdit={handleCancelEdit} handleEditPart={handleEditPart} handleJobPartUpdate={handleJobPartUpdate} handleSavePart={handleSavePart} inventory={inventory} inventoryError={inventoryError} inventoryLoading={inventoryLoading} inventorySearch={inventorySearch} isEditMode={isEditMode} isPartModalOpen={isPartModalOpen} isSavingPart={isSavingPart} JOB_PART_STATUSES={JOB_PART_STATUSES} jobCardSectionExpanded={jobCardSectionExpanded} jobData={jobData} jobError={jobError} jobLoading={jobLoading} jobParts={jobParts} jobRequests={jobRequests} jobSearch={jobSearch} locationFilter={locationFilter} locationSearchTerm={locationSearchTerm} mapPartStatusToPipelineId={mapPartStatusToPipelineId} matchesLinkedJobStatus={matchesLinkedJobStatus} partsPipeline={partsPipeline} pendingJobParts={pendingJobParts} popupCardStyles={popupCardStyles} popupOverlayStyles={popupOverlayStyles} PRE_PICK_OPTIONS={PRE_PICK_OPTIONS} renderAddToJobModal={renderAddToJobModal} renderDeliveryModal={renderDeliveryModal} RequirementBadge={RequirementBadge} resetAddToJobModal={resetAddToJobModal} resolveSourceMeta={resolveSourceMeta} resolveStatusStyles={resolveStatusStyles} SearchBar={SearchBar} searchJob={searchJob} secondaryButtonStyle={secondaryButtonStyle} sectionTitleStyle={sectionTitleStyle} selectedPart={selectedPart} selectedPipelineStage={selectedPipelineStage} setConfirmDialog={setConfirmDialog} setDisplayLimit={setDisplayLimit} setEditedPart={setEditedPart} setFilterType={setFilterType} setInventorySearch={setInventorySearch} setIsEditMode={setIsEditMode} setIsPartModalOpen={setIsPartModalOpen} setJobCardSectionExpanded={setJobCardSectionExpanded} setJobSearch={setJobSearch} setLocationFilter={setLocationFilter} setLocationSearchTerm={setLocationSearchTerm} setSelectedPart={setSelectedPart} setSelectedPipelineStage={setSelectedPipelineStage} setShowAddToJobModal={setShowAddToJobModal} setStatusFilter={setStatusFilter} statusFilter={statusFilter} STORAGE_LOCATION_CODES={STORAGE_LOCATION_CODES} tableStyle={tableStyle} />;















































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































}

export default StockCataloguePage;
