// file location: src/pages/parts/index.js
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import {
  summarizePartsPipeline,
  mapPartStatusToPipelineId,
  getPipelineStageMeta,
} from "@/lib/partsPipeline";
import { supabase } from "@/lib/supabaseClient";
import DeliverySchedulerModal from "@/components/Parts/DeliverySchedulerModal";

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
];

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
  "cancelled",
];

const needsDeliveryScheduling = (status = "") => /collect|delivery/i.test(String(status || ""));

const cardStyle = {
  backgroundColor: "white",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "0 10px 30px rgba(255,64,64,0.1)",
  border: "1px solid #ffe1e1",
};

const sectionTitleStyle = {
  fontSize: "1.1rem",
  fontWeight: 600,
  color: "#ff4040",
  marginBottom: "12px",
};

const buttonStyle = {
  backgroundColor: "#ff4040",
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryButtonStyle = {
  ...buttonStyle,
  backgroundColor: "white",
  color: "#ff4040",
  border: "1px solid #ff4040",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const STATUS_COLOR_MAP = {
  waiting_authorisation: { background: "rgba(251,191,36,0.2)", color: "#92400e" },
  awaiting_stock: { background: "rgba(254,240,138,0.4)", color: "#92400e" },
  on_order: { background: "rgba(191,219,254,0.6)", color: "#1d4ed8" },
  pre_picked: { background: "rgba(221,214,254,0.6)", color: "#6d28d9" },
  stock: { background: "rgba(209,250,229,0.8)", color: "#065f46" },
  pending: { background: "rgba(229,231,235,0.8)", color: "#374151" },
  allocated: { background: "rgba(186,230,253,0.8)", color: "#0369a1" },
  picked: { background: "rgba(199,210,254,0.8)", color: "#3730a3" },
  fitted: { background: "rgba(209,250,229,0.8)", color: "#065f46" },
  cancelled: { background: "rgba(254,202,202,0.8)", color: "#991b1b" },
};

const SOURCE_META = {
  vhc_red: { label: "VHC Red", background: "rgba(248,113,113,0.2)", color: "#991b1b" },
  vhc_amber: { label: "VHC Amber", background: "rgba(251,191,36,0.25)", color: "#92400e" },
  vhc: { label: "VHC", background: "rgba(248,113,113,0.15)", color: "#b91c1c" },
  vhc_auto: { label: "VHC Auto-Order", background: "rgba(190,24,93,0.15)", color: "#9d174d" },
  tech_request: { label: "Tech Request", background: "rgba(59,130,246,0.18)", color: "#1d4ed8" },
  parts_workspace: { label: "Manual", background: "rgba(148,163,184,0.3)", color: "#475569" },
  manual: { label: "Manual", background: "rgba(148,163,184,0.3)", color: "#475569" },
};

const formatStatusLabel = (status) =>
  status ? status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "Unknown";

const resolveStatusStyles = (status) => STATUS_COLOR_MAP[status] || { background: "rgba(229,231,235,0.8)", color: "#374151" };

const resolveSourceMeta = (origin = "") => {
  const normalized = typeof origin === "string" ? origin.toLowerCase() : "";
  if (SOURCE_META[normalized]) return SOURCE_META[normalized];
  if (normalized.includes("vhc")) return SOURCE_META.vhc;
  if (normalized.includes("tech")) return SOURCE_META.tech_request;
  return SOURCE_META.manual;
};

const RequirementBadge = ({ label, background, color }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 10px",
      borderRadius: "999px",
      fontSize: "0.75rem",
      fontWeight: 600,
      background,
      color,
    }}
  >
    {label}
  </span>
);

function PartsPortalPage() {
  const { user, dbUserId } = useUser();
  const actingUserId = dbUserId || user?.id || null;

  const [jobSearch, setJobSearch] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState("");
  const [jobData, setJobData] = useState(null);
  const [jobParts, setJobParts] = useState([]);
  const [jobRequests, setJobRequests] = useState([]);
  const [selectedPipelineStage, setSelectedPipelineStage] = useState("all");

  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventory, setInventory] = useState([]);

  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveriesError, setDeliveriesError] = useState("");
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryRoutesList, setDeliveryRoutesList] = useState([]);
  const [jobDeliveryInfo, setJobDeliveryInfo] = useState(null);
  const [scheduleModalJob, setScheduleModalJob] = useState(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState("");
  const [selectedPart, setSelectedPart] = useState(null);
  const [partQuantity, setPartQuantity] = useState(1);
  const [allocateFromStock, setAllocateFromStock] = useState(true);
  const [prePickSelection, setPrePickSelection] = useState("");
  const [partNotes, setPartNotes] = useState("");
  const [partFormError, setPartFormError] = useState("");

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    supplier: "",
    orderReference: "",
    partId: "",
    quantityOrdered: 1,
    quantityReceived: 1,
    unitCost: "",
    notes: "",
  });
  const [deliveryFormError, setDeliveryFormError] = useState("");

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
    value !== null && value !== undefined
      ? `£${Number(value).toFixed(2)}`
      : "£0.00";

  const formatMargin = (cost, price) => {
    const unitCost = Number(cost || 0);
    const unitPrice = Number(price || 0);
    const diff = unitPrice - unitCost;
    const percent = unitPrice !== 0 ? (diff / unitPrice) * 100 : 0;
    return `${formatCurrency(diff)} (${percent.toFixed(0)}%)`;
  };

  const formatDateTime = (value) =>
    value ? new Date(value).toLocaleString(undefined, { hour12: false }) : "—";

  const renderLinkedJobs = (part) => {
    const links = part.linked_jobs || [];
    if (links.length === 0) return null;
    return (
      <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "#4b5563" }}>
        <div style={{ fontWeight: 600, color: "#a00000", marginBottom: "4px" }}>Linked Jobs</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {links.slice(0, 3).map((link) => {
            const sourceMeta = resolveSourceMeta(link.source);
            const statusMeta = resolveStatusStyles(link.status);
            return (
              <div key={`${link.type}-${link.job_id}-${link.request_id || ""}-${link.status}`}>
                <div>
                  <strong>{link.job_number}</strong> · Qty {link.quantity || 1}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#a00000" }}>Delivery plan</p>
                    {jobDeliveryInfo ? (
                      <div style={{ fontWeight: 600 }}>
                        Stop {jobDeliveryInfo.stop_number} ·{" "}
                        {jobDeliveryInfo.delivery?.delivery_date
                          ? new Date(jobDeliveryInfo.delivery.delivery_date).toLocaleDateString()
                          : "Scheduled"}
                      </div>
                    ) : (
                      <div style={{ fontWeight: 600, color: "#6b7280" }}>No upcoming delivery</div>
                    )}
                  </div>
                  {needsDeliveryScheduling(jobData.waitingStatus || jobData.waiting_status) && (
                    <button
                      type="button"
                      onClick={openScheduleModal}
                      style={{
                        ...buttonStyle,
                        border: "1px solid #2563eb",
                        background: "#fff",
                        color: "#2563eb",
                        fontWeight: 600,
                      }}
                    >
                      Schedule Delivery
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
                  <RequirementBadge label={sourceMeta.label} background={sourceMeta.background} color={sourceMeta.color} />
                  <RequirementBadge label={formatStatusLabel(link.status)} background={statusMeta.background} color={statusMeta.color} />
                </div>
              </div>
            );
          })}
          {links.length > 3 && (
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>+{links.length - 3} more jobs…</div>
          )}
        </div>
      </div>
    );
  };

  const fetchInventory = useCallback(
    async (term = "") => {
      setInventoryLoading(true);
      setInventoryError("");
      try {
        const query = new URLSearchParams({
          search: term,
          includeInactive: "false",
          limit: "100",
        });
        const response = await fetch(`/api/parts/inventory?${query}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load inventory");
        }

        setInventory(data.parts || []);
      } catch (err) {
        setInventoryError(err.message || "Unable to load inventory");
      } finally {
        setInventoryLoading(false);
      }
    },
    []
  );

  const fetchDeliveries = useCallback(async () => {
    setDeliveriesLoading(true);
    setDeliveriesError("");
    try {
      const query = new URLSearchParams({
        status: "all",
        limit: "10",
      });
      const response = await fetch(`/api/parts/deliveries?${query}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load deliveries");
      }

      setDeliveries(data.deliveries || []);
    } catch (err) {
      setDeliveriesError(err.message || "Unable to load deliveries");
    } finally {
      setDeliveriesLoading(false);
    }
  }, []);

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

  const refreshJob = useCallback(() => {
    if (jobData?.jobNumber) {
      searchJob(jobData.jobNumber);
    } else if (jobSearch) {
      searchJob(jobSearch);
    }
  }, [jobData?.jobNumber, jobSearch, searchJob]);

  const loadDeliveryRoutesList = useCallback(async () => {
    try {
      const query = new URLSearchParams({ status: "all", limit: "20" });
      const response = await fetch(`/api/parts/deliveries?${query}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setDeliveryRoutesList(data.deliveries || []);
      }
    } catch (err) {
      console.error("Unable to load deliveries for scheduling", err);
    }
  }, []);

  const loadJobDeliveryInfo = useCallback(async () => {
    if (!jobData?.id) {
      setJobDeliveryInfo(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("delivery_stops")
        .select("stop_number, status, delivery:deliveries(id, delivery_date, vehicle_reg, fuel_type)")
        .eq("job_id", jobData.id)
        .in("status", ["planned", "en_route"])
        .order("stop_number", { ascending: true });
      if (error) {
        throw error;
      }
      setJobDeliveryInfo((data || [])[0] || null);
    } catch (loadErr) {
      console.error("Unable to load job delivery info", loadErr);
      setJobDeliveryInfo(null);
    }
  }, [jobData?.id]);

  const openScheduleModal = () => {
    if (!jobData?.id) return;
    setScheduleModalJob({
      id: jobData.id,
      job_number: jobData.jobNumber || jobData.job_number,
      waiting_status: jobData.waitingStatus || jobData.waiting_status,
    });
    setIsScheduleModalOpen(true);
  };

  const handleDeliveryScheduled = useCallback(() => {
    loadDeliveryRoutesList();
    loadJobDeliveryInfo();
    refreshJob();
  }, [loadDeliveryRoutesList, loadJobDeliveryInfo, refreshJob]);

  useEffect(() => {
    setSelectedPipelineStage("all");
  }, [jobData?.id]);

  useEffect(() => {
    fetchInventory("");
    fetchDeliveries();
  }, [fetchInventory, fetchDeliveries]);

  useEffect(() => {
    loadDeliveryRoutesList();
  }, [loadDeliveryRoutesList]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchInventory(inventorySearch);
    }, 400);
    return () => clearTimeout(handler);
  }, [inventorySearch, fetchInventory]);

  useEffect(() => {
    loadJobDeliveryInfo();
  }, [loadJobDeliveryInfo]);

  const openAddPartModal = (part) => {
    if (part) {
      setSelectedPartId(part.id);
      setSelectedPart(part);
      setAllocateFromStock(part.qty_in_stock > 0);
    }
    setPartQuantity(1);
    setPartNotes("");
    setPrePickSelection("");
    setPartFormError("");
    setShowAddPartModal(true);
  };

  const closeAddPartModal = () => {
    setShowAddPartModal(false);
    setSelectedPartId("");
    setSelectedPart(null);
  };

  const handleSelectPart = async (partId) => {
    setSelectedPartId(partId);
    const part = inventory.find((item) => item.id === partId);
    if (part) {
      setSelectedPart(part);
      setAllocateFromStock(part.qty_in_stock > 0);
    } else if (partId) {
      try {
        const response = await fetch(`/api/parts/inventory/${partId}`);
        const data = await response.json();
        if (response.ok && data.success) {
          setSelectedPart(data.part);
          setInventory((prev) => {
            const exists = prev.find((p) => p.id === data.part.id);
            if (exists) return prev;
            return [data.part, ...prev];
          });
        }
      } catch (err) {
        console.error("Failed to fetch part by ID", err);
      }
    } else {
      setSelectedPart(null);
    }
  };

  const handleAddPartToJob = async () => {
    if (!jobData?.id) {
      setPartFormError("Select a job card before adding parts.");
      return;
    }
    if (!selectedPartId) {
      setPartFormError("Select a part from inventory.");
      return;
    }
    if (partQuantity <= 0) {
      setPartFormError("Quantity must be at least 1.");
      return;
    }

    try {
      const response = await fetch("/api/parts/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: jobData.id,
          partId: selectedPartId,
          quantityRequested: partQuantity,
          allocateFromStock,
          prePickLocation: prePickSelection || null,
          storageLocation:
            selectedPart?.storage_location || selectedPart?.service_default_zone || null,
          requestNotes: partNotes || null,
          userId: actingUserId,
          origin: "parts_workspace",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to add part to job");
      }

      closeAddPartModal();
      await Promise.all([
        refreshJob(),
        fetchInventory(inventorySearch),
      ]);
    } catch (err) {
      setPartFormError(err.message || "Unable to add part to job");
    }
  };

  const handleJobPartUpdate = async (jobPartId, updates) => {
    try {
      const response = await fetch(`/api/parts/jobs/${jobPartId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updates, userId: actingUserId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update job part");
      }

      await Promise.all([
        refreshJob(),
        fetchInventory(inventorySearch),
      ]);
    } catch (err) {
      alert(err.message || "Unable to update job part"); // quick feedback
    }
  };

  const handleDeliverySubmit = async () => {
    if (!deliveryForm.partId) {
      setDeliveryFormError("Select a part to log a delivery.");
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
          items: [
            {
              partId: deliveryForm.partId,
              quantityOrdered: deliveryForm.quantityOrdered,
              quantityReceived: deliveryForm.quantityReceived,
              unitCost: deliveryForm.unitCost || null,
              notes: deliveryForm.notes || null,
            },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to log delivery");
      }

      setShowDeliveryModal(false);
      setDeliveryFormError("");
      setDeliveryForm({
        supplier: "",
        orderReference: "",
        partId: "",
        quantityOrdered: 1,
        quantityReceived: 1,
        unitCost: "",
        notes: "",
      });

      await Promise.all([
        fetchDeliveries(),
        fetchInventory(inventorySearch),
        refreshJob(),
      ]);
    } catch (err) {
      setDeliveryFormError(err.message || "Unable to log delivery");
    }
  };

  const renderAddPartModal = () => {
    if (!showAddPartModal) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div style={{ ...cardStyle, width: "520px", maxHeight: "90vh", overflowY: "auto" }}>
          <h2 style={{ ...sectionTitleStyle, marginBottom: "16px" }}>
            Add Part to Job {jobData?.jobNumber || ""}
          </h2>

          <label style={{ display: "block", marginBottom: "12px" }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Part from Inventory
            </span>
            <select
              value={selectedPartId}
              onChange={(event) => handleSelectPart(event.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ffd1d1",
              }}
            >
              <option value="">Select part...</option>
              {inventory.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.part_number} · {part.name}
                </option>
              ))}
            </select>
          </label>

          {selectedPart && (
            <div
              style={{
                background: "#fff4f4",
                border: "1px solid #ffd1d1",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "12px",
                fontSize: "0.9rem",
                color: "#a41d1d",
              }}
            >
              <div><strong>In Stock:</strong> {selectedPart.qty_in_stock}</div>
              <div><strong>Reserved:</strong> {selectedPart.qty_reserved}</div>
              <div><strong>Location:</strong> {selectedPart.storage_location || "Not set"}</div>
              <div><strong>Service Zone:</strong> {selectedPart.service_default_zone || "—"}</div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
                Quantity
              </span>
              <input
                type="number"
                min="1"
                value={partQuantity}
                onChange={(event) =>
                  setPartQuantity(Math.max(1, Number(event.target.value) || 1))
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #ffd1d1",
                }}
              />
            </label>

            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
                Allocate Stock Now
              </span>
              <select
                value={allocateFromStock ? "yes" : "no"}
                onChange={(event) =>
                  setAllocateFromStock(event.target.value === "yes")
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #ffd1d1",
                }}
              >
                <option value="yes">Yes - reserve from stock</option>
                <option value="no">No - leave awaiting stock</option>
              </select>
            </label>
          </div>

          <label style={{ display: "block", marginBottom: "12px" }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Pre-pick Location
            </span>
            <select
              value={prePickSelection}
              onChange={(event) => setPrePickSelection(event.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ffd1d1",
              }}
            >
              {PRE_PICK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "block", marginBottom: "12px" }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Notes / Special Instructions
            </span>
            <textarea
              value={partNotes}
              onChange={(event) => setPartNotes(event.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ffd1d1",
                resize: "vertical",
              }}
              placeholder="E.g. requires confirmation or order number"
            />
          </label>

          {partFormError && (
            <div style={{ color: "#b80d0d", marginBottom: "12px", fontWeight: 600 }}>
              {partFormError}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button onClick={closeAddPartModal} style={secondaryButtonStyle}>
              Cancel
            </button>
            <button onClick={handleAddPartToJob} style={buttonStyle}>
              Save to Job
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeliveryModal = () => {
    if (!showDeliveryModal) return null;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div style={{ ...cardStyle, width: "520px", maxHeight: "90vh", overflowY: "auto" }}>
          <h2 style={{ ...sectionTitleStyle, marginBottom: "16px" }}>Log Delivery</h2>

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
                borderRadius: "8px",
                border: "1px solid #ffd1d1",
              }}
            />
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
                  orderReference: event.target.value,
                }))
              }
              placeholder="Supplier order number"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ffd1d1",
              }}
            />
          </label>

          <label style={{ display: "block", marginBottom: "12px" }}>
            <span style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Part
            </span>
            <select
              value={deliveryForm.partId}
              onChange={(event) =>
                setDeliveryForm((prev) => ({ ...prev, partId: event.target.value }))
              }
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ffd1d1",
              }}
            >
              <option value="">Select part...</option>
              {inventory.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.part_number} · {part.name}
                </option>
              ))}
            </select>
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
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
                    quantityOrdered: Math.max(0, Number(event.target.value) || 0),
                  }))
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #ffd1d1",
                }}
              />
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
                    quantityReceived: Math.max(0, Number(event.target.value) || 0),
                  }))
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #ffd1d1",
                }}
              />
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
                  unitCost: event.target.value,
                }))
              }
              placeholder="Enter if known for spending tracking"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ffd1d1",
              }}
            />
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
                borderRadius: "8px",
                border: "1px solid #ffd1d1",
                resize: "vertical",
              }}
            />
          </label>

          {deliveryFormError && (
            <div style={{ color: "#b80d0d", marginBottom: "12px", fontWeight: 600 }}>
              {deliveryFormError}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                setShowDeliveryModal(false);
                setDeliveryFormError("");
              }}
              style={secondaryButtonStyle}
            >
              Cancel
            </button>
            <button onClick={handleDeliverySubmit} style={buttonStyle}>
              Save Delivery
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Find Job Card</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                searchJob(jobSearch);
              }}
              style={{ display: "flex", gap: "12px", marginBottom: "16px" }}
            >
              <input
                type="text"
                placeholder="Job number or registration"
                value={jobSearch}
                onChange={(event) => setJobSearch(event.target.value)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #ffd1d1",
                }}
              />
              <button type="submit" style={buttonStyle} disabled={jobLoading}>
                {jobLoading ? "Searching..." : "Search"}
              </button>
            </form>

            {jobError && (
              <div style={{ color: "#b80d0d", marginBottom: "12px", fontWeight: 600 }}>
                {jobError}
              </div>
            )}

            {jobData ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      background: "#fff4f4",
                      borderRadius: "10px",
                      padding: "14px",
                      border: "1px solid #ffd1d1",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", color: "#a41d1d" }}>JOB</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ff4040" }}>
                      {jobData.jobNumber}
                    </div>
                    <div>{jobData.description || "No description"}</div>
                  </div>
                  <div
                    style={{
                      background: "#fff4f4",
                      borderRadius: "10px",
                      padding: "14px",
                      border: "1px solid #ffd1d1",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", color: "#a41d1d" }}>VEHICLE</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{jobData.reg}</div>
                    <div>{jobData.makeModel || `${jobData.make} ${jobData.model}`}</div>
                  </div>
                  <div
                    style={{
                      background: "#fff4f4",
                      borderRadius: "10px",
                      padding: "14px",
                      border: "1px solid #ffd1d1",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", color: "#a41d1d" }}>STATUS</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                      {jobData.status}
                    </div>
                    <div>{jobData.waitingStatus}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                  }}
                >
                  <h3 style={{ ...sectionTitleStyle, marginBottom: 0 }}>
                    Parts on this Job
                  </h3>
                  <button onClick={() => openAddPartModal()} style={buttonStyle}>
                    Add Part to Job
                  </button>
                </div>

                {jobParts.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      marginBottom: "12px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPipelineStage("all")}
                      aria-pressed={selectedPipelineStage === "all"}
                      style={{
                        borderRadius: "14px",
                        border: "1px solid rgba(209,0,0,0.4)",
                        backgroundColor:
                          selectedPipelineStage === "all" ? "#ffeceb" : "#fff",
                        padding: "8px 14px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: "2px",
                        cursor: "pointer",
                        fontWeight: 600,
                        color: selectedPipelineStage === "all" ? "#d10000" : "#a00000",
                      }}
                    >
                      <span>All Parts</span>
                      <small style={{ fontSize: "0.75rem", color: "#555" }}>
                        {jobParts.length} line{jobParts.length === 1 ? "" : "s"} total
                      </small>
                    </button>
                    {partsPipeline.stageSummary.map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => setSelectedPipelineStage(stage.id)}
                        aria-pressed={selectedPipelineStage === stage.id}
                        style={{
                          borderRadius: "14px",
                          border: "1px solid rgba(209,0,0,0.4)",
                          backgroundColor:
                            selectedPipelineStage === stage.id ? "#ffeceb" : "#fff",
                          padding: "8px 14px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: "2px",
                          cursor: "pointer",
                          fontWeight: 600,
                          color:
                            selectedPipelineStage === stage.id ? "#d10000" : "#a00000",
                        }}
                      >
                        <span>{stage.label}</span>
                        <small style={{ fontSize: "0.75rem", color: "#555" }}>
                          {stage.count} line{stage.count === 1 ? "" : "s"}
                        </small>
                      </button>
                    ))}
                  </div>
                )}

                {selectedPipelineStage !== "all" && displayedJobParts.length === 0 && (
                  <div
                    style={{
                      background: "#fffaf0",
                      borderRadius: "10px",
                      border: "1px solid #ffd1d1",
                      padding: "10px 14px",
                      marginBottom: "12px",
                      color: "#92400e",
                      fontSize: "0.9rem",
                    }}
                  >
                    No parts currently staged for{" "}
                    {getPipelineStageMeta(selectedPipelineStage).label}.
                  </div>
                )}

                {jobParts.length === 0 ? (
                  <div
                    style={{
                      background: "#fff4f4",
                      border: "1px dashed #ffb0b0",
                      borderRadius: "8px",
                      padding: "16px",
                      color: "#a41d1d",
                      textAlign: "center",
                    }}
                  >
                    No parts linked to this job. Add required parts to get started.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={tableStyle}>
                      <thead>
                        <tr style={{ background: "#fff4f4", color: "#a41d1d" }}>
                          <th style={{ textAlign: "left", padding: "10px" }}>Part</th>
                          <th style={{ textAlign: "left", padding: "10px" }}>Qty</th>
                          <th style={{ textAlign: "left", padding: "10px" }}>Stage</th>
                          <th style={{ textAlign: "left", padding: "10px" }}>Status</th>
                          <th style={{ textAlign: "left", padding: "10px" }}>Pre-pick</th>
                          <th style={{ textAlign: "left", padding: "10px" }}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedJobParts.map((part) => {
                          const stageId = mapPartStatusToPipelineId(part.status);
                          const stageMeta = getPipelineStageMeta(stageId);
                          return (
                          <tr key={part.id} style={{ borderBottom: "1px solid #ffe1e1" }}>
                            <td style={{ padding: "10px", verticalAlign: "top" }}>
                              <div style={{ fontWeight: 600 }}>
                                {part.part?.part_number} · {part.part?.name}
                              </div>
                              <div style={{ fontSize: "0.85rem", color: "#555" }}>
                                {part.part?.storage_location || "No bin"} · Stock:{" "}
                                {part.part?.qty_in_stock}
                              </div>
                              <div style={{ marginTop: "6px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {(() => {
                                  const meta = resolveSourceMeta(part.origin);
                                  return (
                                    <RequirementBadge
                                      label={meta.label}
                                      background={meta.background}
                                      color={meta.color}
                                    />
                                  );
                                })()}
                                {part.vhc_item_id ? (
                                  <RequirementBadge
                                    label={`VHC #${part.vhc_item_id}`}
                                    background="rgba(248,113,113,0.18)"
                                    color="#991b1b"
                                  />
                                ) : null}
                              </div>
                            </td>
                            <td style={{ padding: "10px", verticalAlign: "top" }}>
                              <div>Requested: {part.quantity_requested}</div>
                              <div>Allocated: {part.quantity_allocated}</div>
                              <div>Fitted: {part.quantity_fitted}</div>
                              <button
                                onClick={() =>
                                  handleJobPartUpdate(part.id, {
                                    quantityFitted: part.quantity_allocated,
                                    status: "fitted",
                                  })
                                }
                                style={{
                                  ...secondaryButtonStyle,
                                  marginTop: "6px",
                                  padding: "6px 10px",
                                  fontSize: "0.8rem",
                                }}
                              >
                                Mark fitted
                              </button>
                            </td>
                            <td style={{ padding: "10px", verticalAlign: "top" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "4px 10px",
                                  borderRadius: "999px",
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                  backgroundColor: "#fff0f0",
                                  color: "#991b1b",
                                  marginBottom: "6px",
                                }}
                              >
                                {stageMeta.label}
                              </span>
                              <div style={{ fontSize: "0.75rem", color: "#555" }}>
                                {stageMeta.description}
                              </div>
                            </td>
                            <td style={{ padding: "10px", verticalAlign: "top" }}>
                              <select
                                value={part.status}
                                onChange={(event) =>
                                  handleJobPartUpdate(part.id, {
                                    status: event.target.value,
                                  })
                                }
                                style={{
                                  width: "170px",
                                  padding: "8px",
                                  borderRadius: "8px",
                                  border: "1px solid #ffd1d1",
                                }}
                              >
                                {JOB_PART_STATUSES.map((statusValue) => (
                                  <option key={statusValue} value={statusValue}>
                                    {statusValue.replace(/_/g, " ")}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: "10px", verticalAlign: "top" }}>
                              <select
                                value={part.pre_pick_location || ""}
                                onChange={(event) =>
                                  handleJobPartUpdate(part.id, {
                                    prePickLocation: event.target.value,
                                  })
                                }
                                style={{
                                  width: "170px",
                                  padding: "8px",
                                  borderRadius: "8px",
                                  border: "1px solid #ffd1d1",
                                }}
                              >
                                {PRE_PICK_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <div style={{ marginTop: "8px" }}>
                                <button
                                  onClick={() =>
                                    handleJobPartUpdate(part.id, { status: "cancelled" })
                                  }
                                  style={{
                                    ...secondaryButtonStyle,
                                    padding: "6px 10px",
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: "10px", verticalAlign: "top", fontSize: "0.9rem" }}>
                              {part.request_notes || "—"}
                            </td>
                          </tr>
                        );
                      })}
                      </tbody>
                    </table>
                  </div>
                )}

                {jobRequests.length > 0 && (
                  <div style={{ marginTop: "20px" }}>
                    <h4 style={{ ...sectionTitleStyle, marginBottom: "8px" }}>Workshop Requests</h4>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ ...tableStyle, fontSize: "0.9rem" }}>
                        <thead>
                          <tr style={{ background: "#fff8f0", color: "#a04100" }}>
                            <th style={{ textAlign: "left", padding: "10px" }}>Request</th>
                            <th style={{ textAlign: "left", padding: "10px" }}>Quantity</th>
                            <th style={{ textAlign: "left", padding: "10px" }}>Source</th>
                            <th style={{ textAlign: "left", padding: "10px" }}>Status</th>
                            <th style={{ textAlign: "left", padding: "10px" }}>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobRequests.map((request) => {
                            const sourceMeta = resolveSourceMeta(request.source);
                            const statusMeta = resolveStatusStyles(request.status);
                            return (
                              <tr key={request.request_id} style={{ borderBottom: "1px solid #ffe1e1" }}>
                                <td style={{ padding: "10px" }}>
                                  <div style={{ fontWeight: 600 }}>{request.description || "Part request"}</div>
                                  {request.part ? (
                                    <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                                      Suggested: {request.part.part_number} · {request.part.name}
                                    </div>
                                  ) : null}
                                </td>
                                <td style={{ padding: "10px" }}>{request.quantity || 1}</td>
                                <td style={{ padding: "10px" }}>
                                  <RequirementBadge
                                    label={sourceMeta.label}
                                    background={sourceMeta.background}
                                    color={sourceMeta.color}
                                  />
                                </td>
                                <td style={{ padding: "10px" }}>
                                  <RequirementBadge
                                    label={formatStatusLabel(request.status)}
                                    background={statusMeta.background}
                                    color={statusMeta.color}
                                  />
                                </td>
                                <td style={{ padding: "10px" }}>{formatDateTime(request.created_at)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {pendingJobParts.length > 0 && (
                  <div
                    style={{
                      marginTop: "20px",
                      padding: "16px",
                      borderRadius: "8px",
                      background: "#fffdf5",
                      border: "1px solid #ffe5b4",
                      color: "#ab6500",
                    }}
                  >
                    <strong>{pendingJobParts.length} part(s)</strong> awaiting stock or action for
                    this VHC. Ensure orders are raised or picked.
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  background: "#fff4f4",
                  border: "1px dashed #ffb0b0",
                  borderRadius: "8px",
                  padding: "16px",
                  color: "#a41d1d",
                  textAlign: "center",
                }}
              >
                Search a job to view current parts requirements.
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Stock Catalogue</h2>
            <input
              type="text"
              placeholder="Search part number, description, OEM code"
              value={inventorySearch}
              onChange={(event) => setInventorySearch(event.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #ffd1d1",
                marginBottom: "12px",
              }}
            />

            {inventoryError && (
              <div style={{ color: "#b80d0d", marginBottom: "12px", fontWeight: 600 }}>
                {inventoryError}
              </div>
            )}

            <div style={{ maxHeight: "420px", overflowY: "auto" }}>
              {inventoryLoading ? (
                <div style={{ color: "#888" }}>Loading inventory...</div>
              ) : inventory.length === 0 ? (
                <div style={{ color: "#888" }}>No parts found. Refine your search.</div>
              ) : (
                <table style={{ ...tableStyle, fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ background: "#fff4f4", color: "#a41d1d" }}>
                      <th style={{ textAlign: "left", padding: "10px" }}>Part</th>
                      <th style={{ textAlign: "left", padding: "10px" }}>Stock</th>
                      <th style={{ textAlign: "left", padding: "10px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((part) => (
                      <tr key={part.id} style={{ borderBottom: "1px solid #ffe1e1" }}>
                        <td style={{ padding: "10px", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 600 }}>
                            {part.part_number} · {part.name}
                          </div>
                          <div style={{ color: "#555" }}>{part.category || "Uncategorised"}</div>
                          <div style={{ fontSize: "0.8rem", color: "#777" }}>
                            {part.storage_location || "No storage"} · Service default:{" "}
                            {part.service_default_zone || "—"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#555" }}>
                            Supplier: {part.supplier || "Unknown"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#555" }}>
                            Cost {formatCurrency(part.unit_cost)} · Sell {formatCurrency(part.unit_price)} · Margin {formatMargin(part.unit_cost, part.unit_price)}
                          </div>
                          <div style={{ marginTop: "4px" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "2px 10px",
                                borderRadius: "999px",
                                background:
                                  part.stock_status === "low_stock"
                                    ? "rgba(245,158,11,0.2)"
                                    : part.stock_status === "back_order"
                                    ? "rgba(209,0,0,0.15)"
                                    : "rgba(16,185,129,0.18)",
                                color:
                                  part.stock_status === "low_stock"
                                    ? "#92400e"
                                    : part.stock_status === "back_order"
                                    ? "#7f1d1d"
                                    : "#065f46",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              {(part.stock_status || "in_stock").replace(/_/g, " ")}
                            </span>
                          </div>
                          {renderLinkedJobs(part)}
                        </td>
                        <td style={{ padding: "10px", verticalAlign: "top" }}>
                          <div>On hand: {part.qty_in_stock}</div>
                          <div>Reserved: {part.qty_reserved}</div>
                          <div>On order: {part.qty_on_order}</div>
                          <div>Min level: {part.reorder_level ?? 0}</div>
                          <div>Linked jobs: {part.open_job_count || 0}</div>
                          <div>Status: {(part.stock_status || "in_stock").replace(/_/g, " ")}</div>
                        </td>
                        <td style={{ padding: "10px", verticalAlign: "top" }}>
                          <button
                            onClick={() => openAddPartModal(part)}
                            style={{
                              ...buttonStyle,
                              padding: "6px 12px",
                              fontSize: "0.85rem",
                            }}
                          >
                            Add to Job
                          </button>
                          <div style={{ marginTop: "6px", fontSize: "0.8rem", color: "#777" }}>
                            Cost: {formatCurrency(part.unit_cost)} · Sell:{" "}
                            {formatCurrency(part.unit_price)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div id="deliveries" style={{ ...cardStyle }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h2 style={sectionTitleStyle}>Deliveries & Ordered Stock</h2>
            <button onClick={() => setShowDeliveryModal(true)} style={buttonStyle}>
              Log Delivery
            </button>
          </div>

          {deliveriesError && (
            <div style={{ color: "#b80d0d", marginBottom: "12px", fontWeight: 600 }}>
              {deliveriesError}
            </div>
          )}

          {deliveriesLoading ? (
            <div style={{ color: "#888" }}>Loading deliveries...</div>
          ) : deliveries.length === 0 ? (
            <div style={{ color: "#888" }}>
              No deliveries recorded yet. Log incoming stock to keep inventory accurate.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ ...tableStyle, fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ background: "#fff4f4", color: "#a41d1d" }}>
                    <th style={{ textAlign: "left", padding: "10px" }}>Delivery</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Items</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id} style={{ borderBottom: "1px solid #ffe1e1" }}>
                      <td style={{ padding: "10px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600 }}>
                          {delivery.supplier || "Unknown supplier"}
                        </div>
                        <div style={{ color: "#777" }}>
                          Ref: {delivery.order_reference || "—"}
                        </div>
                        <div style={{ color: "#777" }}>
                          Expected: {delivery.expected_date || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "10px", verticalAlign: "top" }}>
                        {(delivery.delivery_items || []).slice(0, 3).map((item) => (
                          <div key={item.id} style={{ marginBottom: "8px" }}>
                            <div style={{ fontWeight: 600 }}>
                              {item.part?.part_number} · {item.part?.name}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#777" }}>
                              Ordered {item.quantity_ordered}, received{" "}
                              {item.quantity_received}
                            </div>
                          </div>
                        ))}
                        {(delivery.delivery_items || []).length > 3 && (
                          <div style={{ fontSize: "0.8rem", color: "#777" }}>
                            +{delivery.delivery_items.length - 3} more items...
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600 }}>{delivery.status}</div>
                        <div style={{ fontSize: "0.8rem", color: "#777" }}>
                          Logged {new Date(delivery.created_at).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {renderAddPartModal()}
        {renderDeliveryModal()}
        <DeliverySchedulerModal
          open={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          job={scheduleModalJob}
          deliveries={deliveryRoutesList}
          onScheduled={handleDeliveryScheduled}
        />
      </div>
    </Layout>
  );
}

export default PartsPortalPage;
