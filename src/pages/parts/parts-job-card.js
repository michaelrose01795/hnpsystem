"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabaseClient } from "@/lib/supabaseClient";

const cardStyle = {
  borderRadius: "20px",
  border: "1px solid var(--surface-light)",
  background: "var(--surface)",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const twoColumnGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const inputStyle = {
  borderRadius: "10px",
  border: "1px solid var(--surface-light)",
  padding: "10px 12px",
  fontSize: "0.95rem",
  fontFamily: "inherit",
};

const blankForm = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  customer_address: "",
  vehicle_reg: "",
  vehicle_make: "",
  vehicle_model: "",
  vehicle_vin: "",
  notes: "",
};

const blankPart = () => ({
  part_number: "",
  part_name: "",
  quantity: 1,
  unit_price: "",
  notes: "",
});

export default function PartsJobCardPage() {
  const { user } = useUser();
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasPartsAccess = roles.includes("parts") || roles.includes("parts manager");

  const [form, setForm] = useState(blankForm);
  const [partLines, setPartLines] = useState([blankPart()]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notification, setNotification] = useState("");

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) || null, [jobs, selectedJobId]);

  useEffect(() => {
    if (!hasPartsAccess) return;
    const loadJobs = async () => {
      setLoadingJobs(true);
      setErrorMessage("");
      try {
        const { data, error } = await supabaseClient
          .from("parts_job_cards")
          .select("*, items:parts_job_items(*)")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setJobs(data || []);
        if (data && data.length > 0) {
          setSelectedJobId((prev) => prev || data[0].id);
        }
      } catch (err) {
        console.error("Failed to load parts job cards:", err);
        setErrorMessage(err.message || "Unable to load parts job cards.");
      } finally {
        setLoadingJobs(false);
      }
    };
    loadJobs();
  }, [hasPartsAccess]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePartChange = (index, field, value) => {
    setPartLines((prev) =>
      prev.map((line, lineIndex) => (lineIndex === index ? { ...line, [field]: value } : line))
    );
  };

  const handleAddPart = () => {
    setPartLines((prev) => [...prev, blankPart()]);
  };

  const handleRemovePart = (index) => {
    setPartLines((prev) => prev.filter((_, lineIndex) => lineIndex !== index));
  };

  const resetForm = () => {
    setForm(blankForm);
    setPartLines([blankPart()]);
    setNotification("Parts job card created.");
    setTimeout(() => setNotification(""), 3500);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.customer_name.trim()) {
      setErrorMessage("Customer name is required.");
      return;
    }
    const validParts = partLines.filter(
      (line) => line.part_name.trim() || line.part_number.trim() || Number(line.quantity) > 0
    );
    if (validParts.length === 0) {
      setErrorMessage("Add at least one part to the job card.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      const payload = {
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        customer_email: form.customer_email.trim() || null,
        customer_address: form.customer_address.trim() || null,
        vehicle_reg: form.vehicle_reg.trim() || null,
        vehicle_make: form.vehicle_make.trim() || null,
        vehicle_model: form.vehicle_model.trim() || null,
        vehicle_vin: form.vehicle_vin.trim() || null,
        notes: form.notes.trim() || null,
        vehicle_details: {
          reg: form.vehicle_reg,
          make: form.vehicle_make,
          model: form.vehicle_model,
          vin: form.vehicle_vin,
        },
      };

      const { data: job, error: insertError } = await supabaseClient
        .from("parts_job_cards")
        .insert([payload])
        .select("*, items:parts_job_items(*)")
        .maybeSingle();
      if (insertError) throw insertError;

      const partPayload = validParts.map((line) => ({
        job_id: job.id,
        part_number: line.part_number.trim() || null,
        part_name: line.part_name.trim() || null,
        quantity: Number(line.quantity) || 1,
        unit_price: line.unit_price === "" ? 0 : Number(line.unit_price),
        notes: line.notes.trim() || null,
      }));

      if (partPayload.length > 0) {
        const { error: itemsError, data: itemsData } = await supabaseClient
          .from("parts_job_items")
          .insert(partPayload)
          .select("*");
        if (itemsError) throw itemsError;
        job.items = itemsData;
      } else {
        job.items = [];
      }

      setJobs((prev) => [job, ...prev]);
      setSelectedJobId(job.id);
      resetForm();
    } catch (submitError) {
      console.error("Failed to create parts job card:", submitError);
      setErrorMessage(submitError.message || "Unable to save parts job card.");
    } finally {
      setSaving(false);
    }
  };

  if (!hasPartsAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          You do not have permission to access parts job cards.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <section style={cardStyle}>
          <div>
            <p
              style={{
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--info-dark)",
                fontSize: "0.8rem",
              }}
            >
              Parts
            </p>
            <h1 style={{ margin: "4px 0 0", color: "var(--primary-dark)" }}>Create parts job card</h1>
            <p style={{ margin: 0, color: "var(--grey-accent-dark)", fontSize: "0.9rem" }}>
              Capture customer details, basic vehicle info, and link the booked parts to quickly track pick-pack tasks.
            </p>
          </div>
          {notification && (
            <div style={{ padding: "10px", borderRadius: "10px", background: "var(--success-surface)", color: "var(--success)" }}>
              {notification}
            </div>
          )}
          {errorMessage && (
            <div style={{ padding: "10px", borderRadius: "10px", background: "var(--danger-surface)", color: "var(--danger)" }}>
              {errorMessage}
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={twoColumnGrid}>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Customer name</span>
                <input
                  type="text"
                  required
                  value={form.customer_name}
                  onChange={(event) => handleFieldChange("customer_name", event.target.value)}
                  style={inputStyle}
                  placeholder="Name"
                />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Customer phone</span>
                <input
                  type="tel"
                  value={form.customer_phone}
                  onChange={(event) => handleFieldChange("customer_phone", event.target.value)}
                  style={inputStyle}
                  placeholder="Phone"
                />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Customer email</span>
                <input
                  type="email"
                  value={form.customer_email}
                  onChange={(event) => handleFieldChange("customer_email", event.target.value)}
                  style={inputStyle}
                  placeholder="Email"
                />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Vehicle registration</span>
                <input
                  type="text"
                  value={form.vehicle_reg}
                  onChange={(event) => handleFieldChange("vehicle_reg", event.target.value.toUpperCase())}
                  style={inputStyle}
                  placeholder="Vehicle reg"
                />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Vehicle make</span>
                <input
                  type="text"
                  value={form.vehicle_make}
                  onChange={(event) => handleFieldChange("vehicle_make", event.target.value)}
                  style={inputStyle}
                  placeholder="Manufacturer"
                />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Vehicle model</span>
                <input
                  type="text"
                  value={form.vehicle_model}
                  onChange={(event) => handleFieldChange("vehicle_model", event.target.value)}
                  style={inputStyle}
                  placeholder="Model"
                />
              </label>
              <label style={fieldStyle}>
                <span style={{ fontWeight: 600 }}>Vehicle VIN</span>
                <input
                  type="text"
                  value={form.vehicle_vin}
                  onChange={(event) => handleFieldChange("vehicle_vin", event.target.value.toUpperCase())}
                  style={inputStyle}
                  placeholder="VIN"
                />
              </label>
            </div>
            <label style={fieldStyle}>
              <span style={{ fontWeight: 600 }}>Customer address</span>
              <textarea
                rows={2}
                value={form.customer_address}
                onChange={(event) => handleFieldChange("customer_address", event.target.value)}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Delivery or billing address"
              />
            </label>
            <label style={fieldStyle}>
              <span style={{ fontWeight: 600 }}>Notes</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => handleFieldChange("notes", event.target.value)}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Special instructions or payment notes"
              />
            </label>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "1.05rem" }}>Booked parts</strong>
                <button
                  type="button"
                  onClick={handleAddPart}
                  style={{
                    borderRadius: "10px",
                    border: "1px solid var(--surface-light)",
                    background: "var(--danger-surface)",
                    padding: "8px 14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Add part
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                {partLines.map((line, index) => (
                  <div
                    key={`part-line-${index}`}
                    style={{
                      border: "1px solid var(--surface-light)",
                      borderRadius: "12px",
                      padding: "12px",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    <label style={fieldStyle}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Part number</span>
                      <input
                        type="text"
                        value={line.part_number}
                        onChange={(event) => handlePartChange(index, "part_number", event.target.value)}
                        style={inputStyle}
                        placeholder="e.g. 5Q0129620D"
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Part name</span>
                      <input
                        type="text"
                        value={line.part_name}
                        onChange={(event) => handlePartChange(index, "part_name", event.target.value)}
                        style={inputStyle}
                        placeholder="Item description"
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Quantity</span>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(event) => handlePartChange(index, "quantity", event.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Unit price (£)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(event) => handlePartChange(index, "unit_price", event.target.value)}
                        style={inputStyle}
                        placeholder="0.00"
                      />
                    </label>
                    <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Line notes</span>
                      <textarea
                        rows={2}
                        value={line.notes}
                        onChange={(event) => handlePartChange(index, "notes", event.target.value)}
                        style={{ ...inputStyle, resize: "vertical" }}
                        placeholder="Collection details or supplier reference"
                      />
                    </label>
                    {partLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePart(index)}
                        style={{
                          gridColumn: "1 / -1",
                          border: "1px solid var(--danger)",
                          borderRadius: "10px",
                          background: "var(--danger-surface)",
                          color: "var(--danger)",
                          padding: "8px 12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Remove part
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                style={{
                  borderRadius: "12px",
                  border: "1px solid var(--surface-light)",
                  background: "var(--surface)",
                  padding: "10px 18px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  borderRadius: "12px",
                  border: "none",
                  background: "var(--primary)",
                  color: "var(--surface)",
                  padding: "10px 18px",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving…" : "Create job card"}
              </button>
            </div>
          </form>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 1fr)", gap: "20px", flexWrap: "wrap" }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, color: "var(--primary-dark)" }}>Recent parts jobs</h2>
                <p style={{ margin: 0, color: "var(--grey-accent-dark)", fontSize: "0.9rem" }}>
                  Generated job numbers start at P00001 and increase automatically.
                </p>
              </div>
              <strong style={{ fontSize: "1.5rem" }}>{jobs.length}</strong>
            </div>
            {loadingJobs ? (
              <p style={{ color: "var(--info)" }}>Loading job cards…</p>
            ) : jobs.length === 0 ? (
              <p style={{ color: "var(--info)" }}>No parts job cards created yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {jobs.map((job) => {
                  const itemCount = Array.isArray(job.items) ? job.items.length : 0;
                  const isSelected = job.id === selectedJobId;
                  return (
                    <div
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedJobId(job.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedJobId(job.id);
                        }
                      }}
                      style={{
                        textAlign: "left",
                        borderRadius: "16px",
                        border: isSelected ? "2px solid var(--primary)" : "1px solid var(--surface-light)",
                        background: "var(--surface)",
                        padding: "14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ color: "var(--primary-dark)" }}>{job.job_number}</strong>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: "var(--danger-surface)",
                            color: "var(--primary-dark)",
                          }}
                        >
                          {itemCount} part{itemCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div style={{ color: "var(--info-dark)", fontSize: "0.9rem" }}>
                        {job.customer_name || "Customer"} · {job.customer_phone || job.customer_email || "Contact not set"}
                      </div>
                      <div style={{ color: "var(--grey-accent-dark)", fontSize: "0.85rem" }}>
                        {job.vehicle_reg || "No reg"} ·{" "}
                        {new Date(job.created_at).toLocaleString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <Link
                        href={`/parts/parts-job-card/${job.job_number}`}
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          alignSelf: "flex-start",
                          marginTop: "8px",
                          padding: "6px 12px",
                          borderRadius: "10px",
                          border: "1px solid var(--primary)",
                          color: "var(--primary)",
                          fontWeight: 600,
                          textDecoration: "none",
                          fontSize: "0.85rem",
                        }}
                      >
                        Open parts card
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={{ margin: 0, color: "var(--primary-dark)" }}>Job details</h2>
            {!selectedJob ? (
              <p style={{ color: "var(--info)" }}>Select a job card to view the part list.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <p style={{ margin: 0, color: "var(--info)", fontSize: "0.85rem" }}>Job number</p>
                  <strong style={{ fontSize: "1.3rem" }}>{selectedJob.job_number}</strong>
                </div>
                <div style={twoColumnGrid}>
                  <InfoBlock label="Customer" value={selectedJob.customer_name || "—"} />
                  <InfoBlock label="Phone" value={selectedJob.customer_phone || "—"} />
                  <InfoBlock label="Email" value={selectedJob.customer_email || "—"} />
                  <InfoBlock label="Vehicle reg" value={selectedJob.vehicle_reg || "—"} />
                  <InfoBlock
                    label="Vehicle"
                    value={
                      selectedJob.vehicle_make || selectedJob.vehicle_model
                        ? `${selectedJob.vehicle_make || ""} ${selectedJob.vehicle_model || ""}`.trim()
                        : "—"
                    }
                  />
                  <InfoBlock label="VIN" value={selectedJob.vehicle_vin || "—"} />
                </div>
                <InfoBlock label="Address" value={selectedJob.customer_address || "—"} />
                <InfoBlock label="Notes" value={selectedJob.notes || "—"} />
                <div>
                  <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Booked parts</p>
                  {(!selectedJob.items || selectedJob.items.length === 0) && (
                    <p style={{ color: "var(--info)" }}>No items recorded.</p>
                  )}
                  {selectedJob.items && selectedJob.items.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {selectedJob.items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            border: "1px solid var(--surface-light)",
                            borderRadius: "10px",
                            padding: "10px",
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                            gap: "10px",
                          }}
                        >
                          <InfoBlock label="Part number" value={item.part_number || "—"} compact />
                          <InfoBlock label="Name" value={item.part_name || "—"} compact />
                          <InfoBlock label="Qty" value={String(item.quantity || 1)} compact />
                          <InfoBlock
                            label="Unit price"
                            value={
                              item.unit_price ? `£${Number(item.unit_price).toFixed(2)}` : "£0.00"
                            }
                            compact
                          />
                          {item.notes && <InfoBlock label="Notes" value={item.notes} compact />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}

function InfoBlock({ label, value, compact = false }) {
  return (
    <div>
      <p style={{ margin: 0, color: "var(--info)", fontSize: compact ? "0.75rem" : "0.8rem" }}>{label}</p>
      <div style={{ fontWeight: 600, fontSize: compact ? "0.9rem" : "1rem" }}>{value || "—"}</div>
    </div>
  );
}
