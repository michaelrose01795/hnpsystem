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
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";

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
  backgroundColor: "var(--surface)",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "none",
  border: "1px solid var(--surface-light)",
};

const sectionTitleStyle = {
  fontSize: "1.1rem",
  fontWeight: 600,
  color: "var(--primary)",
  marginBottom: "12px",
};

const buttonStyle = {
  backgroundColor: "var(--primary)",
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryButtonStyle = {
  ...buttonStyle,
  backgroundColor: "var(--surface)",
  color: "var(--primary)",
  border: "1px solid var(--primary)",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
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
  cancelled: { background: "rgba(var(--danger-rgb), 0.8)", color: "var(--danger)" },
};

const SOURCE_META = {
  vhc_red: { label: "VHC Red", background: "rgba(var(--danger-rgb), 0.2)", color: "var(--danger)" },
  vhc_amber: { label: "VHC Amber", background: "rgba(var(--warning-rgb), 0.25)", color: "var(--danger-dark)" },
  vhc: { label: "VHC", background: "rgba(var(--danger-rgb), 0.15)", color: "var(--danger)" },
  vhc_auto: { label: "VHC Auto-Order", background: "rgba(var(--danger-rgb), 0.15)", color: "var(--danger)" },
  tech_request: { label: "Tech Request", background: "rgba(var(--info-rgb), 0.18)", color: "var(--accent-purple)" },
  parts_workspace: { label: "Manual", background: "rgba(var(--grey-accent-rgb), 0.3)", color: "var(--info-dark)" },
  manual: { label: "Manual", background: "rgba(var(--grey-accent-rgb), 0.3)", color: "var(--info-dark)" },
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
      <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "var(--info-dark)" }}>
        <div style={{ fontWeight: 600, color: "var(--primary-dark)", marginBottom: "4px" }}>Linked Jobs</div>
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
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--primary-dark)" }}>Delivery plan</p>
                    {jobDeliveryInfo ? (
                      <div style={{ fontWeight: 600 }}>
                        Stop {jobDeliveryInfo.stop_number} ·{" "}
                        {jobDeliveryInfo.delivery?.delivery_date
                          ? new Date(jobDeliveryInfo.delivery.delivery_date).toLocaleDateString()
                          : "Scheduled"}
                      </div>
                    ) : (
                      <div style={{ fontWeight: 600, color: "var(--info)" }}>No upcoming delivery</div>
                    )}
                  </div>
                  {needsDeliveryScheduling(jobData.waitingStatus || jobData.waiting_status) && (
                    <button
                      type="button"
                      onClick={openScheduleModal}
                      style={{
                        ...buttonStyle,
                        border: "1px solid var(--accent-purple)",
                        background: "var(--surface)",
                        color: "var(--accent-purple)",
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
            <div style={{ fontSize: "0.75rem", color: "var(--info)" }}>+{links.length - 3} more jobs…</div>
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
          ...popupOverlayStyles,
          zIndex: 1400,
        }}
      >
        <div
          style={{
            ...popupCardStyles,
            width: "min(520px, 90vw)",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "28px",
          }}
        >
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
                border: "1px solid var(--surface-light)",
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
                background: "var(--surface-light)",
                border: "1px solid var(--surface-light)",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "12px",
                fontSize: "0.9rem",
                color: "var(--danger)",
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
                  border: "1px solid var(--surface-light)",
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
                  border: "1px solid var(--surface-light)",
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
                border: "1px solid var(--surface-light)",
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
                border: "1px solid var(--surface-light)",
                resize: "vertical",
              }}
              placeholder="E.g. requires confirmation or order number"
            />
          </label>

          {partFormError && (
            <div style={{ color: "var(--danger)", marginBottom: "12px", fontWeight: 600 }}>
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
          ...popupOverlayStyles,
          zIndex: 1500,
        }}
      >
        <div
          style={{
            ...popupCardStyles,
            width: "min(520px, 90vw)",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "28px",
          }}
        >
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
                border: "1px solid var(--surface-light)",
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
                border: "1px solid var(--surface-light)",
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
                border: "1px solid var(--surface-light)",
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
                  border: "1px solid var(--surface-light)",
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
                  border: "1px solid var(--surface-light)",
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
                border: "1px solid var(--surface-light)",
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
                border: "1px solid var(--surface-light)",
                resize: "vertical",
              }}
            />
          </label>

          {deliveryFormError && (
            <div style={{ color: "var(--danger)", marginBottom: "12px", fontWeight: 600 }}>
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
                  border: "1px solid var(--surface-light)",
                }}
              />
              <button type="submit" style={buttonStyle} disabled={jobLoading}>
                {jobLoading ? "Searching..." : "Search"}
              </button>
            </form>

            {jobError && (
              <div style={{ color: "var(--danger)", marginBottom: "12px", fontWeight: 600 }}>
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
                      background: "var(--surface-light)",
                      borderRadius: "10px",
                      padding: "14px",
                      border: "1px solid var(--surface-light)",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", color: "var(--danger)" }}>JOB</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--primary)" }}>
                      {jobData.jobNumber}
                    </div>
                    <div>{jobData.description || "No description"}</div>
                  </div>
                  <div
                    style={{
                      background: "var(--surface-light)",
                      borderRadius: "10px",
                      padding: "14px",
                      border: "1px solid var(--surface-light)",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", color: "var(--danger)" }}>VEHICLE</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{jobData.reg}</div>
                    <div>{jobData.makeModel || `${jobData.make} ${jobData.model}`}</div>
                  </div>
                  <div
                    style={{
                      background: "var(--surface-light)",
                      borderRadius: "10px",
                      padding: "14px",
                      border: "1px solid var(--surface-light)",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", color: "var(--danger)" }}>STATUS</div>
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
                        border: "1px solid rgba(var(--primary-rgb),0.4)",
                        backgroundColor:
                          selectedPipelineStage === "all" ? "var(--danger-surface)" : "var(--surface)",
                        padding: "8px 14px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: "2px",
                        cursor: "pointer",
                        fontWeight: 600,
                        color: selectedPipelineStage === "all" ? "var(--primary)" : "var(--primary-dark)",
                      }}
                    >
                      <span>All Parts</span>
                      <small style={{ fontSize: "0.75rem", color: "var(--grey-accent-dark)" }}>
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
                          border: "1px solid rgba(var(--primary-rgb),0.4)",
                          backgroundColor:
                            selectedPipelineStage === stage.id ? "var(--danger-surface)" : "var(--surface)",
                          padding: "8px 14px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: "2px",
                          cursor: "pointer",
                          fontWeight: 600,
                          color:
                            selectedPipelineStage === stage.id ? "var(--primary)" : "var(--primary-dark)",
                        }}
                      >
                        <span>{stage.label}</span>
                        <small style={{ fontSize: "0.75rem", color: "var(--grey-accent-dark)" }}>
                          {stage.count} line{stage.count === 1 ? "" : "s"}
                        </small>
                      </button>
                    ))}
                  </div>
                )}

                {selectedPipelineStage !== "all" && displayedJobParts.length === 0 && (
                  <div
                    style={{
                      background: "var(--warning-surface)",
                      borderRadius: "10px",
                      border: "1px solid var(--surface-light)",
                      padding: "10px 14px",
                      marginBottom: "12px",
                      color: "var(--danger-dark)",
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
                      background: "var(--surface-light)",
                      border: "1px dashed var(--primary-light)",
                      borderRadius: "8px",
                      padding: "16px",
                      color: "var(--danger)",
                      textAlign: "center",
                    }}
                  >
                    No parts linked to this job. Add required parts to get started.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={tableStyle}>
                      <thead>
                        <tr style={{ background: "var(--surface-light)", color: "var(--danger)" }}>
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
                          <tr key={part.id} style={{ borderBottom: "1px solid var(--surface-light)" }}>
                            <td style={{ padding: "10px", verticalAlign: "top" }}>
                              <div style={{ fontWeight: 600 }}>
                                {part.part?.part_number} · {part.part?.name}
                              </div>
                              <div style={{ fontSize: "0.85rem", color: "var(--grey-accent-dark)" }}>
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
                                    background="rgba(var(--danger-rgb), 0.18)"
                                    color="var(--danger)"
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
                                  backgroundColor: "var(--surface-light)",
                                  color: "var(--danger)",
                                  marginBottom: "6px",
                                }}
                              >
                                {stageMeta.label}
                              </span>
                              <div style={{ fontSize: "0.75rem", color: "var(--grey-accent-dark)" }}>
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
                                  border: "1px solid var(--surface-light)",
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
                                  border: "1px solid var(--surface-light)",
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
                          <tr style={{ background: "var(--warning-surface)", color: "var(--danger-dark)" }}>
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
                              <tr key={request.request_id} style={{ borderBottom: "1px solid var(--surface-light)" }}>
                                <td style={{ padding: "10px" }}>
                                  <div style={{ fontWeight: 600 }}>{request.description || "Part request"}</div>
                                  {request.part ? (
                                    <div style={{ fontSize: "0.8rem", color: "var(--info)" }}>
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
                      background: "var(--warning-surface)",
                      border: "1px solid var(--warning)",
                      color: "var(--warning-dark)",
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
                  background: "var(--surface-light)",
                  border: "1px dashed var(--primary-light)",
                  borderRadius: "8px",
                  padding: "16px",
                  color: "var(--danger)",
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
              type="search"
              placeholder="Search part number, description, OEM code"
              value={inventorySearch}
              onChange={(event) => setInventorySearch(event.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid var(--search-surface-muted)",
                marginBottom: "12px",
                outline: "none",
                backgroundColor: "var(--search-surface)",
                color: "var(--search-text)",
              }}
            />

            {inventoryError && (
              <div style={{ color: "var(--danger)", marginBottom: "12px", fontWeight: 600 }}>
                {inventoryError}
              </div>
            )}

            <div style={{ maxHeight: "420px", overflowY: "auto" }}>
              {inventoryLoading ? (
                <div style={{ color: "var(--grey-accent-light)" }}>Loading inventory...</div>
              ) : inventory.length === 0 ? (
                <div style={{ color: "var(--grey-accent-light)" }}>No parts found. Refine your search.</div>
              ) : (
                <table style={{ ...tableStyle, fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-light)", color: "var(--danger)" }}>
                      <th style={{ textAlign: "left", padding: "10px" }}>Part</th>
                      <th style={{ textAlign: "left", padding: "10px" }}>Stock</th>
                      <th style={{ textAlign: "left", padding: "10px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((part) => (
                      <tr key={part.id} style={{ borderBottom: "1px solid var(--surface-light)" }}>
                        <td style={{ padding: "10px", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 600 }}>
                            {part.part_number} · {part.name}
                          </div>
                          <div style={{ color: "var(--grey-accent-dark)" }}>{part.category || "Uncategorised"}</div>
                          <div style={{ fontSize: "0.8rem", color: "var(--grey-accent)" }}>
                            {part.storage_location || "No storage"} · Service default:{" "}
                            {part.service_default_zone || "—"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--grey-accent-dark)" }}>
                            Supplier: {part.supplier || "Unknown"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--grey-accent-dark)" }}>
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
                                    ? "rgba(var(--warning-rgb), 0.2)"
                                    : part.stock_status === "back_order"
                                    ? "rgba(var(--primary-rgb),0.15)"
                                    : "rgba(var(--info-rgb), 0.18)",
                                color:
                                  part.stock_status === "low_stock"
                                    ? "var(--danger-dark)"
                                    : part.stock_status === "back_order"
                                    ? "var(--danger-dark)"
                                    : "var(--info-dark)",
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
                          <div style={{ marginTop: "6px", fontSize: "0.8rem", color: "var(--grey-accent)" }}>
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
            <div style={{ color: "var(--danger)", marginBottom: "12px", fontWeight: 600 }}>
              {deliveriesError}
            </div>
          )}

          {deliveriesLoading ? (
            <div style={{ color: "var(--grey-accent-light)" }}>Loading deliveries...</div>
          ) : deliveries.length === 0 ? (
            <div style={{ color: "var(--grey-accent-light)" }}>
              No deliveries recorded yet. Log incoming stock to keep inventory accurate.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ ...tableStyle, fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ background: "var(--surface-light)", color: "var(--danger)" }}>
                    <th style={{ textAlign: "left", padding: "10px" }}>Delivery</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Items</th>
                    <th style={{ textAlign: "left", padding: "10px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id} style={{ borderBottom: "1px solid var(--surface-light)" }}>
                      <td style={{ padding: "10px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600 }}>
                          {delivery.supplier || "Unknown supplier"}
                        </div>
                        <div style={{ color: "var(--grey-accent)" }}>
                          Ref: {delivery.order_reference || "—"}
                        </div>
                        <div style={{ color: "var(--grey-accent)" }}>
                          Expected: {delivery.expected_date || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "10px", verticalAlign: "top" }}>
                        {(delivery.delivery_items || []).slice(0, 3).map((item) => (
                          <div key={item.id} style={{ marginBottom: "8px" }}>
                            <div style={{ fontWeight: 600 }}>
                              {item.part?.part_number} · {item.part?.name}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "var(--grey-accent)" }}>
                              Ordered {item.quantity_ordered}, received{" "}
                              {item.quantity_received}
                            </div>
                          </div>
                        ))}
                        {(delivery.delivery_items || []).length > 3 && (
                          <div style={{ fontSize: "0.8rem", color: "var(--grey-accent)" }}>
                            +{delivery.delivery_items.length - 3} more items...
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600 }}>{delivery.status}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--grey-accent)" }}>
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
