// file location: src/pages/parts/index.js
import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";

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
  "awaiting_stock",
  "allocated",
  "picked",
  "fitted",
  "cancelled",
];

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

function PartsPortalPage() {
  const { user, dbUserId } = useUser();
  const actingUserId = dbUserId || user?.id || null;

  const [jobSearch, setJobSearch] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState("");
  const [jobData, setJobData] = useState(null);
  const [jobParts, setJobParts] = useState([]);

  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventory, setInventory] = useState([]);

  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveriesError, setDeliveriesError] = useState("");
  const [deliveries, setDeliveries] = useState([]);

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

  const formatCurrency = (value) =>
    value !== null && value !== undefined
      ? `£${Number(value).toFixed(2)}`
      : "£0.00";

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
      } catch (err) {
        setJobError(err.message || "Unable to load job card");
        setJobData(null);
        setJobParts([]);
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

  useEffect(() => {
    fetchInventory("");
    fetchDeliveries();
  }, [fetchInventory, fetchDeliveries]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchInventory(inventorySearch);
    }, 400);
    return () => clearTimeout(handler);
  }, [inventorySearch, fetchInventory]);

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
                          <th style={{ textAlign: "left", padding: "10px" }}>Status</th>
                          <th style={{ textAlign: "left", padding: "10px" }}>Pre-pick</th>
                          <th style={{ textAlign: "left", padding: "10px" }}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobParts.map((part) => (
                          <tr key={part.id} style={{ borderBottom: "1px solid #ffe1e1" }}>
                            <td style={{ padding: "10px", verticalAlign: "top" }}>
                              <div style={{ fontWeight: 600 }}>
                                {part.part?.part_number} · {part.part?.name}
                              </div>
                              <div style={{ fontSize: "0.85rem", color: "#555" }}>
                                {part.part?.storage_location || "No bin"} · Stock:{" "}
                                {part.part?.qty_in_stock}
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
                        ))}
                      </tbody>
                    </table>
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
                        </td>
                        <td style={{ padding: "10px", verticalAlign: "top" }}>
                          <div>On hand: {part.qty_in_stock}</div>
                          <div>Reserved: {part.qty_reserved}</div>
                          <div>On order: {part.qty_on_order}</div>
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
      </div>
    </Layout>
  );
}

export default PartsPortalPage;
