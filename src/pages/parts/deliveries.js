import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/styles/themeProvider";

const pageStyles = {
  container: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  headerCard: {
    background: "var(--surface)",
    border: "1px solid var(--surface-light)",
    borderRadius: "20px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  listCard: {
    background: "var(--surface)",
    border: "1px solid var(--surface-light)",
    borderRadius: "20px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateControls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
  },
  jobRow: (isCompleted) => ({
    border: "1px solid rgba(var(--primary-rgb),0.15)",
    borderRadius: "18px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: isCompleted ? "rgba(var(--success-rgb,34,139,34),0.08)" : "var(--surface)",
    width: "100%",
  }),
  jobInfoButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    cursor: "pointer",
  },
  jobActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "stretch",
    justifyContent: "space-between",
  },
  reorderGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: "160px",
  },
};

const statusChipStyle = (status) => {
  const variants = {
    scheduled: { background: "rgba(var(--warning-rgb),0.15)", color: "var(--danger-dark)" },
    en_route: { background: "rgba(var(--info-rgb),0.2)", color: "var(--accent-purple)" },
    completed: { background: "rgba(var(--success-rgb,34,139,34),0.25)", color: "var(--success, #297C3B)" },
  };
  return {
    padding: "4px 12px",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    ...(variants[status] || variants.scheduled),
  };
};

const markButtonStyle = (isCompleted) => ({
  borderRadius: "12px",
  border: "none",
  padding: "10px 16px",
  fontWeight: 600,
  cursor: isCompleted ? "default" : "pointer",
  background: isCompleted ? "rgba(var(--success-rgb,34,139,34),0.2)" : "var(--primary)",
  color: isCompleted ? "var(--success, #297C3B)" : "var(--surface)",
  flex: "1 1 180px",
  textAlign: "center",
});

const arrowButtonStyle = {
  borderRadius: "10px",
  border: "1px solid var(--surface-light)",
  background: "var(--danger-surface)",
  padding: "6px 10px",
  fontWeight: 700,
  cursor: "pointer",
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  zIndex: 90,
};

const modalContentStyle = {
  background: "var(--surface)",
  borderRadius: "20px",
  padding: "24px",
  width: "min(780px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  border: "1px solid var(--surface-light)",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const statusWeight = {
  scheduled: 0,
  en_route: 1,
  completed: 2,
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "£0.00";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

const formatIsoDate = (value) => {
  try {
    const date = value ? new Date(value) : new Date();
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const adjustIsoDate = (isoDate, delta) => {
  const base = isoDate ? new Date(isoDate) : new Date();
  base.setDate(base.getDate() + delta);
  return base.toISOString().slice(0, 10);
};

const normalizeJobRecord = (job = {}) => ({
  ...job,
  delivery_date: job.delivery_date || todayIso(),
  items: Array.isArray(job.items) ? job.items : [],
  status: job.status || "scheduled",
});

export default function PartsDeliveriesPage() {
  const { user } = useUser();
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = roles.includes("parts") || roles.includes("parts manager");

  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewJob, setViewJob] = useState(null);
  const [rowActionId, setRowActionId] = useState("");

  const fetchJobs = useCallback(async () => {
    if (!hasAccess) return;
    setLoading(true);
    setError("");
    try {
      let query = supabase
        .from("parts_delivery_jobs")
        .select("*")
        .order("status", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (selectedDate) {
        query = query.eq("delivery_date", selectedDate);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setJobs((data || []).map((record) => normalizeJobRecord(record)));
    } catch (fetchErr) {
      console.error("Failed to load deliveries:", fetchErr);
      setError(fetchErr?.message || "Unable to load delivery list");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, hasAccess]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const statusDiff = (statusWeight[a.status] ?? 0) - (statusWeight[b.status] ?? 0);
      if (statusDiff !== 0) return statusDiff;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [jobs]);

  const pendingCount = sortedJobs.filter((job) => job.status !== "completed").length;
  const completedCount = sortedJobs.length - pendingCount;

  const handleMarkDelivered = async (job) => {
    if (!job || job.status === "completed") return;
    setRowActionId(job.id);
    setError("");
    try {
      const completedSort = (sortedJobs.length + 1) * 100 + (job.sort_order ?? 0);
      const { error: updateError } = await supabase
        .from("parts_delivery_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          sort_order: completedSort,
        })
        .eq("id", job.id);
      if (updateError) throw updateError;
      setJobs((prev) =>
        prev.map((item) =>
          item.id === job.id
            ? { ...item, status: "completed", completed_at: new Date().toISOString(), sort_order: completedSort }
            : item
        )
      );
    } catch (actionError) {
      console.error("Failed to mark delivered:", actionError);
      setError(actionError?.message || "Unable to update job status");
    } finally {
      setRowActionId("");
    }
  };

  const handleMoveJob = async (jobId, direction) => {
    const currentIndex = sortedJobs.findIndex((job) => job.id === jobId);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedJobs.length) return;
    const currentJob = sortedJobs[currentIndex];
    const targetJob = sortedJobs[targetIndex];
    setRowActionId(jobId);
    setError("");
    try {
      const [firstResult, secondResult] = await Promise.all([
        supabase
          .from("parts_delivery_jobs")
          .update({ sort_order: targetJob.sort_order ?? targetIndex })
          .eq("id", currentJob.id),
        supabase
          .from("parts_delivery_jobs")
          .update({ sort_order: currentJob.sort_order ?? currentIndex })
          .eq("id", targetJob.id),
      ]);
      if (firstResult.error) throw firstResult.error;
      if (secondResult.error) throw secondResult.error;
      setJobs((prev) =>
        prev.map((job) => {
          if (job.id === currentJob.id) {
            return { ...job, sort_order: targetJob.sort_order ?? targetIndex };
          }
          if (job.id === targetJob.id) {
            return { ...job, sort_order: currentJob.sort_order ?? currentIndex };
          }
          return job;
        })
      );
    } catch (moveError) {
      console.error("Failed to reorder deliveries:", moveError);
      setError(moveError?.message || "Unable to reorder deliveries");
    } finally {
      setRowActionId("");
    }
  };

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          You do not have access to delivery planning.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={pageStyles.container}>
        <section style={pageStyles.headerCard}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <p
              style={{
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--primary-dark)",
                fontSize: "0.85rem",
              }}
            >
              Driver view
            </p>
            <h1 style={{ margin: 0, color: "var(--primary)" }}>Parts deliveries</h1>
            <p style={{ margin: 0, color: "var(--info)" }}>
              Quickly review today&rsquo;s drop offs, mark jobs as delivered, and reorder the list for the van.
            </p>
          </div>

          <div style={pageStyles.controls}>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--primary-dark)" }}>Selected day</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{formatIsoDate(selectedDate)}</div>
            </div>
            <div style={pageStyles.dateControls}>
              <button
                type="button"
                onClick={() => setSelectedDate((prev) => adjustIsoDate(prev, -1))}
                style={{
                  borderRadius: "10px",
                  border: "1px solid var(--surface-light)",
                  background: "var(--surface)",
                  color: "var(--primary-dark)",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Previous day
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                style={{
                  borderRadius: "10px",
                  border: "1px solid var(--surface-light)",
                  padding: "10px 12px",
                  fontWeight: 600,
                  color: "var(--primary-dark)",
                }}
              />
              <button
                type="button"
                onClick={() => setSelectedDate((prev) => adjustIsoDate(prev, 1))}
                style={{
                  borderRadius: "10px",
                  border: "1px solid var(--surface-light)",
                  background: "var(--primary-dark)",
                  color: "var(--surface)",
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Next day
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--info)" }}>Queued jobs</div>
              <strong style={{ fontSize: "1.6rem" }}>{pendingCount}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--info)" }}>Completed</div>
              <strong style={{ fontSize: "1.6rem" }}>{completedCount}</strong>
            </div>
          </div>
        </section>

        <section style={pageStyles.listCard}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2 style={{ margin: 0, color: "var(--primary-dark)" }}>Delivery list</h2>
            <p style={{ margin: 0, color: "var(--grey-accent-dark)" }}>
              Tap a job to view invoice details. Use the arrows to change the drive order.
            </p>
          </div>
          {error && <div style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</div>}
          {loading && <div style={{ color: "var(--info)" }}>Loading deliveries…</div>}
          {!loading && sortedJobs.length === 0 && (
            <div style={{ color: "var(--info)" }}>No deliveries queued for this day.</div>
          )}
          {!loading &&
            sortedJobs.map((job, index) => (
              <DeliveryJobRow
                key={job.id}
                job={job}
                index={index}
                total={sortedJobs.length}
                onView={setViewJob}
                onMove={handleMoveJob}
                onMarkDelivered={handleMarkDelivered}
                actionDisabled={rowActionId === job.id}
              />
            ))}
        </section>
      </div>
      {viewJob && <DeliveryJobViewModal job={viewJob} onClose={() => setViewJob(null)} />}
    </Layout>
  );
}

function DeliveryJobRow({ job, index, total, onView, onMove, onMarkDelivered, actionDisabled }) {
  const isCompleted = job.status === "completed";
  const qty =
    job.quantity ||
    (Array.isArray(job.items)
      ? job.items.reduce((totalQty, item) => totalQty + (Number(item.quantity) || 0), 0)
      : 0) ||
    1;
  const paidLabel = job.is_paid ? "Paid" : "Awaiting payment";

  return (
    <article style={pageStyles.jobRow(isCompleted)}>
      <button type="button" style={pageStyles.jobInfoButton} onClick={() => onView(job)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <div style={{ fontWeight: 700, color: "var(--primary-dark)" }}>{job.invoice_number || "Invoice"}</div>
          <span style={statusChipStyle(job.status)}>
            {job.status === "completed" ? "Completed" : job.status === "en_route" ? "En Route" : "Scheduled"}
          </span>
        </div>
        <div style={{ color: "var(--info-dark)", fontSize: "0.9rem" }}>
          Deliver on {formatIsoDate(job.delivery_date)} · Qty {qty} · {formatCurrency(job.total_price)}
        </div>
        <div style={{ fontWeight: 600 }}>{job.part_name || "Parts order"}</div>
        <div style={{ color: "var(--grey-accent-dark)", fontSize: "0.85rem" }}>
          {job.customer_name || "Customer"} · {job.contact_phone || job.contact_email || "No contact"}
        </div>
        <div style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
          {job.address || "Address not provided"}
        </div>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "999px",
            fontSize: "0.75rem",
            fontWeight: 600,
            alignSelf: "flex-start",
            background: job.is_paid ? "rgba(var(--success-rgb,34,139,34),0.15)" : "rgba(var(--warning-rgb),0.2)",
            color: job.is_paid ? "var(--success, #297C3B)" : "var(--danger-dark)",
          }}
        >
          {paidLabel}
        </span>
      </button>
      <div style={pageStyles.jobActions}>
        <div style={pageStyles.reorderGroup}>
          <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Reorder</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => onMove(job.id, "up")}
              disabled={index === 0 || actionDisabled}
              style={{
                ...arrowButtonStyle,
                opacity: index === 0 || actionDisabled ? 0.5 : 1,
                cursor: index === 0 || actionDisabled ? "not-allowed" : "pointer",
              }}
              aria-label="Move job up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onMove(job.id, "down")}
              disabled={index === total - 1 || actionDisabled}
              style={{
                ...arrowButtonStyle,
                opacity: index === total - 1 || actionDisabled ? 0.5 : 1,
                cursor: index === total - 1 || actionDisabled ? "not-allowed" : "pointer",
              }}
              aria-label="Move job down"
            >
              ↓
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onMarkDelivered(job)}
          disabled={isCompleted || actionDisabled}
          style={{
            ...markButtonStyle(isCompleted),
            opacity: isCompleted || actionDisabled ? 0.7 : 1,
          }}
        >
          {isCompleted ? "Delivered" : "Mark as delivered"}
        </button>
      </div>
    </article>
  );
}

function DeliveryJobViewModal({ job, onClose }) {
  const items = Array.isArray(job.items) ? job.items : [];
  const { resolvedMode } = useTheme();
  const closeButtonColor = resolvedMode === "dark" ? "var(--accent-purple)" : "var(--danger)";

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div>
            <p
              style={{
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontSize: "0.8rem",
                color: "var(--info-dark)",
              }}
            >
              Delivery details
            </p>
            <h3 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>{job.invoice_number || "Invoice"}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "0.95rem",
              color: closeButtonColor,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
            aria-label="Close delivery details"
          >
            Close
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Part number</span>
            <div style={{ fontWeight: 600 }}>{job.part_number || "—"}</div>
          </div>
          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Part name</span>
            <div style={{ fontWeight: 600 }}>{job.part_name || "Parts order"}</div>
          </div>
          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Price</span>
            <div style={{ fontWeight: 600 }}>{formatCurrency(job.total_price)}</div>
          </div>
          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Delivery date</span>
            <div style={{ fontWeight: 600 }}>{formatIsoDate(job.delivery_date)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Customer</span>
            <div style={{ fontWeight: 600 }}>{job.customer_name || "Customer"}</div>
          </div>
          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Contact details</span>
            <div style={{ fontWeight: 600 }}>
              {job.contact_phone || "No phone"}
              <br />
              {job.contact_email || ""}
            </div>
          </div>
          <div>
            <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Payment</span>
            <div style={{ fontWeight: 600, display: "flex", gap: "8px", alignItems: "center" }}>
              {job.payment_method || "Not set"}
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "0.7rem",
                  background: job.is_paid ? "rgba(var(--success-rgb,34,139,34),0.18)" : "rgba(var(--warning-rgb),0.2)",
                  color: job.is_paid ? "var(--success, #297C3B)" : "var(--danger-dark)",
                }}
              >
                {job.is_paid ? "Paid" : "Unpaid"}
              </span>
            </div>
          </div>
        </div>

        <div>
          <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Address</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-line" }}>{job.address || "No address provided"}</p>
        </div>

        <div>
          <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Items</span>
          {items.length === 0 ? (
            <p style={{ color: "var(--info)", margin: 0 }}>Invoice items not available.</p>
          ) : (
            <ul style={{ margin: "6px 0 0", paddingLeft: "18px", color: "var(--primary-dark)" }}>
              {items.map((item) => (
                <li key={item.key || `${item.description}-${item.quantity || 1}`}>
                  {item.description} · Qty {item.quantity || 1} · {formatCurrency(item.total || 0)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: "12px",
              border: "1px solid var(--surface-light)",
              background: "var(--surface)",
              padding: "10px 18px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
