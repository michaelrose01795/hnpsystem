"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { supabaseClient } from "@/lib/supabaseClient";

const sectionStyle = {
  background: "var(--surface)",
  borderRadius: "18px",
  border: "1px solid var(--surface-light)",
  padding: "24px",
  boxShadow: "none",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const dayCardStyle = {
  borderRadius: "14px",
  border: "1px solid var(--surface-light)",
  background: "var(--danger-surface)",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const runRowStyle = {
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid rgba(var(--primary-rgb),0.12)",
  background: "var(--surface)",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(150px, 1fr)",
  gap: "12px",
  alignItems: "flex-start",
};

const queueCardStyle = {
  ...sectionStyle,
  border: "1px solid rgba(var(--primary-rgb),0.12)",
};

const queueDayStyle = {
  borderRadius: "14px",
  border: "1px solid var(--surface-light)",
  background: "var(--surface)",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const jobRowButtonStyle = {
  border: "1px solid rgba(var(--primary-rgb),0.15)",
  borderRadius: "14px",
  background: "var(--danger-surface)",
  padding: "14px",
  width: "100%",
  textAlign: "left",
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  cursor: "pointer",
};

const statusChipStyle = (variant = "scheduled") => {
  const variants = {
    scheduled: { background: "rgba(var(--warning-rgb),0.18)", color: "var(--danger-dark)" },
    en_route: { background: "rgba(var(--info-rgb),0.2)", color: "var(--accent-purple)" },
    completed: { background: "rgba(var(--success-rgb, 34,139,34),0.2)", color: "var(--success, #297C3B)" },
  };
  return {
    padding: "4px 12px",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    ...(variants[variant] || variants.scheduled),
  };
};

const paidPillStyle = (isPaid) => ({
  padding: "4px 10px",
  borderRadius: "999px",
  fontWeight: 600,
  fontSize: "0.75rem",
  background: isPaid ? "rgba(var(--success-rgb,34,139,34),0.18)" : "rgba(var(--warning-rgb),0.18)",
  color: isPaid ? "var(--success, #297C3B)" : "var(--danger-dark)",
});

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
  borderRadius: "18px",
  padding: "24px",
  width: "min(900px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
  border: "1px solid var(--surface-light)",
};

const modalFieldColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "16px",
};

const plannerTabButton = (active) => ({
  borderRadius: "999px",
  border: active ? "1px solid var(--primary)" : "1px solid var(--surface-light)",
  background: active ? "var(--primary)" : "var(--surface)",
  color: active ? "var(--surface)" : "var(--primary-dark)",
  padding: "8px 18px",
  fontWeight: 600,
  cursor: "pointer",
});

const formatTime = (value) => {
  if (!value) return "TBC";
  const candidate = new Date(`1970-01-01T${value}`);
  if (Number.isNaN(candidate.getTime())) {
    return value;
  }
  return candidate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
};

const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return "£0";
  return `£${numeric.toFixed(2)}`;
};

const formatDate = (value) => {
  if (!value) return "TBC";
  if (String(value).toLowerCase() === "unscheduled") return "Unscheduled";
  const day = new Date(value);
  if (Number.isNaN(day.getTime())) return value;
  return day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

const formatShortDate = (value) => {
  if (!value) return "Date pending";
  const day = new Date(value);
  if (Number.isNaN(day.getTime())) return value;
  return day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

const isSameCalendarDay = (value, comparison) => {
  if (!value || !comparison) return false;
  const day = new Date(value);
  const compare = comparison instanceof Date ? comparison : new Date(comparison);
  if (Number.isNaN(day.getTime()) || Number.isNaN(compare.getTime())) return false;
  return (
    day.getFullYear() === compare.getFullYear() &&
    day.getMonth() === compare.getMonth() &&
    day.getDate() === compare.getDate()
  );
};

const getCollectionLoadStatus = (jobCount, totalQuantity) => {
  if (jobCount >= 12 || totalQuantity >= 40) return "full";
  if (jobCount >= 6 || totalQuantity >= 16) return "busy";
  return "light";
};

const collectionLoadTokens = {
  light: { label: "Comfortable", background: "var(--surface)", color: "var(--info-dark)" },
  busy: {
    label: "Busy",
    background: "rgba(var(--warning-rgb,255,193,7),0.1)",
    color: "var(--warning-dark)",
  },
  full: {
    label: "At capacity",
    background: "rgba(var(--danger-rgb,220,38,38),0.12)",
    color: "var(--danger, #C62828)",
  },
};

const KM_PER_LITRE = 8;

const customerName = (customer) => {
  if (!customer) return "Customer";
  if (customer.name) return customer.name;
  return [customer.firstname, customer.lastname].filter(Boolean).join(" ") || "Customer";
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const createBlankJobForm = () => ({
  invoice_id: "",
  invoice_number: "",
  job_id: null,
  customer_id: null,
  customer_name: "",
  part_name: "",
  part_number: "",
  quantity: 1,
  unit_price: 0,
  total_price: 0,
  items: [],
  payment_method: "",
  is_paid: false,
  delivery_date: todayIso(),
  address: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  notes: "",
  status: "scheduled",
  sort_order: 0,
});

const normalizeJobRecord = (job = {}) => ({
  ...job,
  delivery_date: job.delivery_date || todayIso(),
  items: Array.isArray(job.items) ? job.items : [],
});

export default function PartsDeliveryPlannerPage() {
  const { user } = useUser();
  const roles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasPartsAccess = roles.includes("parts") || roles.includes("parts manager");
  const router = useRouter();

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fuelRate, setFuelRate] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [deliveryJobs, setDeliveryJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [jobForm, setJobForm] = useState(() => createBlankJobForm());
  const [editingJobId, setEditingJobId] = useState(null);
  const [jobModalError, setJobModalError] = useState("");
  const [jobModalSaving, setJobModalSaving] = useState(false);
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [invoiceSearchLoading, setInvoiceSearchLoading] = useState(false);
  const [plannerTab, setPlannerTab] = useState("delivery");
  const [collectionJobs, setCollectionJobs] = useState([]);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionError, setCollectionError] = useState("");
  const [selectedCollectionDate, setSelectedCollectionDate] = useState(todayIso());
  const pricePerLitre = fuelRate?.price_per_litre ?? 1.75;

  useEffect(() => {
    if (!hasPartsAccess) return;
    const loadRuns = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: fetchError } = await supabaseClient
          .from("parts_delivery_runs")
          .select(
            `id, job_id, customer_id, delivery_date, time_leave, time_arrive, mileage, fuel_cost, stops_count, destination_address, status, notes,
             job:jobs(job_number, vehicle_reg), customer:customers(firstname, lastname, name, address, postcode)`
          )
          .order("delivery_date", { ascending: true })
          .order("time_leave", { ascending: true });

        if (fetchError) throw fetchError;
        setRuns(data || []);
      } catch (fetchErr) {
        setError(fetchErr.message || "Unable to load delivery runs");
        setRuns([]);
      } finally {
        setLoading(false);
      }
    };

    loadRuns();
  }, [hasPartsAccess]);

  const loadCollectionJobs = useCallback(async () => {
    if (!hasPartsAccess) return;
    setCollectionLoading(true);
    setCollectionError("");
    try {
      const { data, error: fetchError } = await supabaseClient
        .from("parts_job_cards")
        .select(
          `id, job_number, customer_name, invoice_reference, delivery_type, delivery_eta, delivery_window, created_at,
           items:parts_job_card_items(quantity)`
        )
        .eq("delivery_type", "collection")
        .order("delivery_eta", { ascending: true })
        .order("created_at", { ascending: true });
      if (fetchError) throw fetchError;
      const normalized = (data || []).map((job) => {
        const items = Array.isArray(job.items) ? job.items : [];
        const quantity = items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
        return { ...job, quantity };
      });
      setCollectionJobs(normalized);
    } catch (fetchErr) {
      setCollectionError(fetchErr.message || "Unable to load collection schedule");
      setCollectionJobs([]);
    } finally {
      setCollectionLoading(false);
    }
  }, [hasPartsAccess]);

  useEffect(() => {
    loadCollectionJobs();
  }, [loadCollectionJobs]);

  const loadDeliveryJobs = useCallback(async () => {
    if (!hasPartsAccess) return;
    setJobsLoading(true);
    setJobsError("");
    try {
      const { data, error: fetchError } = await supabaseClient
        .from("parts_delivery_jobs")
        .select(
          `*,
           customer:customers(id, firstname, lastname, name, address, postcode, mobile, telephone, email)`
        )
        .order("delivery_date", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (fetchError) throw fetchError;
      setDeliveryJobs((data || []).map((record) => normalizeJobRecord(record)));
    } catch (fetchErr) {
      setJobsError(fetchErr.message || "Unable to load scheduled deliveries");
      setDeliveryJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [hasPartsAccess]);

  useEffect(() => {
    loadDeliveryJobs();
  }, [loadDeliveryJobs]);

  useEffect(() => {
    const loadFuelRate = async () => {
      const { data, error: rateError } = await supabaseClient
        .from("parts_delivery_settings")
        .select("fuel_type, price_per_litre, last_updated")
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!rateError && data) {
        setFuelRate(data);
      }
    };
    loadFuelRate();
  }, []);

  useEffect(() => {
    if (!jobModalOpen) {
      setInvoiceResults([]);
      setInvoiceSearchLoading(false);
      return;
    }
    const term = invoiceQuery.trim();
    if (term.length < 2) {
      setInvoiceResults([]);
      setInvoiceSearchLoading(false);
      return;
    }
    let cancelled = false;
    setInvoiceSearchLoading(true);
    const searchInvoices = async () => {
      try {
        const wildcard = `%${term}%`;
        const { data, error: searchError } = await supabaseClient
          .from("invoices")
          .select(
            `id, job_id, job_number, payment_method, paid, grand_total, total, customer_id,
             customer:customers(id, firstname, lastname, name, address, postcode, mobile, telephone, email),
             items:invoice_items(description, quantity, unit_price, total)`
          )
          .ilike("job_number", wildcard)
          .limit(6);
        if (searchError) throw searchError;
        if (!cancelled) {
          setInvoiceResults(data || []);
        }
      } catch (searchErr) {
        console.error("Invoice search failed:", searchErr);
        if (!cancelled) {
          setInvoiceResults([]);
        }
      } finally {
        if (!cancelled) {
          setInvoiceSearchLoading(false);
        }
      }
    };
    searchInvoices();
    return () => {
      cancelled = true;
    };
  }, [invoiceQuery, jobModalOpen]);

  const runsByDate = useMemo(() => {
    const map = {};
    runs.forEach((run) => {
      const key = run.delivery_date || "unscheduled";
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(run);
    });
    return Object.entries(map).sort((a, b) => {
      const aKey = a[0] === "unscheduled" ? Number.MAX_SAFE_INTEGER : new Date(a[0]).getTime();
      const bKey = b[0] === "unscheduled" ? Number.MAX_SAFE_INTEGER : new Date(b[0]).getTime();
      return aKey - bKey;
    });
  }, [runs]);

  const collectionDateKey = (job) =>
    job.delivery_eta || (job.created_at ? job.created_at.slice(0, 10) : todayIso());

  const collectionDates = useMemo(() => {
    const today = todayIso();
    const set = new Set([today]);
    collectionJobs.forEach((job) => {
      const key = collectionDateKey(job);
      set.add(key);
    });
    const list = Array.from(set);
    return list.sort((a, b) => {
      if (a === today) return -1;
      if (b === today) return 1;
      return new Date(a) - new Date(b);
    });
  }, [collectionJobs]);

  const collectionJobsByDate = useMemo(() => {
    const map = {};
    collectionJobs.forEach((job) => {
      const key = collectionDateKey(job);
      if (!map[key]) map[key] = [];
      map[key].push(job);
    });
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const timeA = a.delivery_window || "";
        const timeB = b.delivery_window || "";
        return timeA.localeCompare(timeB);
      });
    });
    return map;
  }, [collectionJobs]);

  useEffect(() => {
    if (collectionDates.length === 0) return;
    if (!collectionDates.includes(selectedCollectionDate)) {
      setSelectedCollectionDate(collectionDates[0]);
    }
  }, [collectionDates, selectedCollectionDate]);

  const collectionSummaries = useMemo(() => {
    return collectionDates.map((date) => {
      const jobs = collectionJobsByDate[date] || [];
      const totalQuantity = jobs.reduce((sum, job) => sum + (Number(job.quantity) || 0), 0);
      const earliestWindow = jobs
        .map((job) => job.delivery_window)
        .filter(Boolean)
        .sort((a, b) => String(a).localeCompare(String(b)))[0];
      const status = getCollectionLoadStatus(jobs.length, totalQuantity);
      return {
        date,
        jobs,
        jobCount: jobs.length,
        totalQuantity,
        earliestWindow,
        status,
      };
    });
  }, [collectionDates, collectionJobsByDate]);

  const selectedCollectionJobs = collectionJobsByDate[selectedCollectionDate] || [];
  const selectedCollectionQuantity = selectedCollectionJobs.reduce(
    (sum, job) => sum + (Number(job.quantity) || 0),
    0
  );
  const selectedCollectionWindow =
    selectedCollectionJobs
      .map((job) => job.delivery_window)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)))[0] || "";
  const todaysCollections = collectionJobsByDate[todayIso()] || [];
  const todaysCollectionQuantity = todaysCollections.reduce(
    (sum, job) => sum + (Number(job.quantity) || 0),
    0
  );
  const unscheduledCollections = collectionJobs.filter((job) => !job.delivery_window).length;

  const jobQueueByDate = useMemo(() => {
    const grouped = {};
    deliveryJobs.forEach((job) => {
      const key = job.delivery_date || "unscheduled";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(job);
    });
    return Object.entries(grouped)
      .map(([date, jobs]) => {
        const sortedJobs = [...jobs].sort((a, b) => {
          if (a.status === b.status) {
            return (a.sort_order ?? 0) - (b.sort_order ?? 0);
          }
          if (a.status === "completed") return 1;
          if (b.status === "completed") return -1;
          return 0;
        });
        return [date, sortedJobs];
      })
      .sort((a, b) => {
        const aKey = a[0] === "unscheduled" ? Number.MAX_SAFE_INTEGER : new Date(a[0]).getTime();
        const bKey = b[0] === "unscheduled" ? Number.MAX_SAFE_INTEGER : new Date(b[0]).getTime();
        return aKey - bKey;
      });
  }, [deliveryJobs]);

  const updateJobForm = (field, value) => {
    setJobForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const closeJobModal = () => {
    setJobModalOpen(false);
    setJobModalError("");
    setInvoiceResults([]);
    setInvoiceQuery("");
    setEditingJobId(null);
    setJobForm(createBlankJobForm());
  };

  const openJobModal = (job = null) => {
    if (job) {
      const derivedCustomer =
        job.customer ||
        (job.customer_id
          ? { name: job.customer_name, address: job.address, mobile: job.contact_phone, email: job.contact_email }
          : null);
      setEditingJobId(job.id);
      setJobForm(
        normalizeJobRecord({
          ...createBlankJobForm(),
          ...job,
          customer_name: job.customer_name || customerName(derivedCustomer),
          address: job.address || derivedCustomer?.address || "",
          contact_name: job.contact_name || job.customer_name || customerName(derivedCustomer),
          contact_phone: job.contact_phone || derivedCustomer?.mobile || "",
          contact_email: job.contact_email || derivedCustomer?.email || "",
        })
      );
      setInvoiceQuery(job.invoice_number || "");
    } else {
      setEditingJobId(null);
      setJobForm(createBlankJobForm());
      setInvoiceQuery("");
    }
    setJobModalError("");
    setJobModalOpen(true);
  };

  const handleInvoiceSelected = (invoice) => {
    if (!invoice) return;
    const invoiceItems = Array.isArray(invoice.items) ? invoice.items : [];
    const firstItem = invoiceItems[0] || {};
    const totalQuantity = invoiceItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const customer = invoice.customer;
    const derivedCustomerName = customerName(customer);
    setJobForm((prev) => ({
      ...prev,
      invoice_id: invoice.id,
      invoice_number: invoice.job_number || prev.invoice_number,
      job_id: invoice.job_id || prev.job_id,
      customer_id: (customer?.id || invoice.customer_id) ?? prev.customer_id,
      customer_name: derivedCustomerName || prev.customer_name,
      part_name: firstItem.description || prev.part_name,
      part_number: invoice.job_number || prev.part_number,
      quantity: totalQuantity || prev.quantity,
      unit_price: firstItem.unit_price ?? prev.unit_price,
      total_price: Number(invoice.grand_total || invoice.total || prev.total_price || 0),
      items: invoiceItems.map((item, index) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        key: `${invoice.id}-${index}`,
      })),
      payment_method: invoice.payment_method || prev.payment_method,
      is_paid: Boolean(invoice.paid),
      address: customer?.address || prev.address,
      contact_name: derivedCustomerName || prev.contact_name,
      contact_phone: customer?.mobile || customer?.telephone || prev.contact_phone,
      contact_email: customer?.email || prev.contact_email,
    }));
    setInvoiceQuery(invoice.job_number || "");
    setInvoiceResults([]);
  };

  const buildJobPayload = () => {
    const payload = {
      invoice_id: jobForm.invoice_id || null,
      invoice_number: jobForm.invoice_number || null,
      job_id: jobForm.job_id || null,
      customer_id: jobForm.customer_id || null,
      customer_name: jobForm.customer_name || "",
      part_name: jobForm.part_name || "",
      part_number: jobForm.part_number || "",
      quantity: Number(jobForm.quantity) || 0,
      unit_price: Number(jobForm.unit_price) || 0,
      total_price: Number(jobForm.total_price) || 0,
      items: Array.isArray(jobForm.items) ? jobForm.items : [],
      payment_method: jobForm.payment_method || "",
      is_paid: Boolean(jobForm.is_paid),
      delivery_date: jobForm.delivery_date || todayIso(),
      address: jobForm.address || "",
      contact_name: jobForm.contact_name || "",
      contact_phone: jobForm.contact_phone || "",
      contact_email: jobForm.contact_email || "",
      notes: jobForm.notes || "",
      status: jobForm.status || "scheduled",
      sort_order: jobForm.sort_order ?? deliveryJobs.length,
    };
    return payload;
  };

  const handleSaveJob = async () => {
    if (!jobForm.invoice_id && !jobForm.invoice_number) {
      setJobModalError("Select an invoice before saving this delivery.");
      return;
    }
    if (!jobForm.delivery_date) {
      setJobModalError("Delivery date is required.");
      return;
    }
    setJobModalSaving(true);
    try {
      const payload = buildJobPayload();
      if (editingJobId) {
        const { error: updateError } = await supabaseClient
          .from("parts_delivery_jobs")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingJobId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabaseClient
          .from("parts_delivery_jobs")
          .insert([{ ...payload, sort_order: deliveryJobs.length }]);
        if (insertError) throw insertError;
      }
      await loadDeliveryJobs();
      closeJobModal();
    } catch (saveErr) {
      console.error("Failed to save delivery job:", saveErr);
      setJobModalError(saveErr.message || "Unable to save delivery job");
    } finally {
      setJobModalSaving(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!editingJobId) {
      closeJobModal();
      return;
    }
    setJobModalSaving(true);
    try {
      const { error: deleteError } = await supabaseClient
        .from("parts_delivery_jobs")
        .delete()
        .eq("id", editingJobId);
      if (deleteError) throw deleteError;
      await loadDeliveryJobs();
      closeJobModal();
    } catch (deleteErr) {
      console.error("Failed to delete delivery job:", deleteErr);
      setJobModalError(deleteErr.message || "Unable to delete delivery job");
    } finally {
      setJobModalSaving(false);
    }
  };

  const jobStatusLabel = (status) => {
    if (status === "completed") return "Completed";
    if (status === "en_route") return "En Route";
    return "Scheduled";
  };

  const computeFuelCost = (run) => ((Number(run.mileage) || 0) / KM_PER_LITRE) * pricePerLitre;
  const priceLabel = fuelRate?.fuel_type
    ? `${fuelRate.fuel_type} @ ${formatCurrency(pricePerLitre)} / L`
    : `Diesel @ ${formatCurrency(pricePerLitre)} / L`;
  const totalMileage = runs.reduce((total, run) => total + (Number(run.mileage) || 0), 0);
  const totalFuel = runs.reduce(
    (total, run) => total + (Number(run.fuel_cost) || computeFuelCost(run)),
    0
  );

  const filteredRunsByDate = useMemo(() => {
    if (!selectedDate) return runsByDate;
    return runsByDate.filter(([date]) => date === selectedDate);
  }, [runsByDate, selectedDate]);

  const dateOptions = runsByDate.map(([date]) => ({
    value: date,
    label: date === "unscheduled" ? "Unscheduled" : formatDate(date),
  }));

  if (!hasPartsAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          You do not have access to the delivery planner.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "22px" }}>
        <header style={{ ...sectionStyle, boxShadow: "none" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setPlannerTab("delivery")}
                style={plannerTabButton(plannerTab === "delivery")}
              >
                Delivery planner
              </button>
              <button
                type="button"
                onClick={() => setPlannerTab("collection")}
                style={plannerTabButton(plannerTab === "collection")}
              >
                Collection planner
              </button>
            </div>
            <button
              type="button"
              onClick={() => openJobModal()}
              style={{
                borderRadius: "12px",
                padding: "10px 18px",
                border: "1px solid var(--surface-light)",
                background: "var(--primary)",
                color: "var(--surface)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Create parts job
            </button>
          </div>
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--primary-dark)" }}>Upcoming runs</div>
              <strong style={{ fontSize: "1.6rem" }}>{runs.length}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--primary-dark)" }}>Total mileage</div>
              <strong style={{ fontSize: "1.6rem" }}>{totalMileage} km</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--primary-dark)" }}>Fuel estimate</div>
              <strong style={{ fontSize: "1.6rem" }}>{formatCurrency(totalFuel)}</strong>
            </div>
          </div>
          <div
            style={{
              color: "var(--info-dark)",
              fontSize: "0.85rem",
              marginTop: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <span>Fuel rate: {priceLabel}</span>
          </div>
        </header>

        {plannerTab === "delivery" ? (
          <>
            <section style={queueCardStyle}>
              <div>
                <p
                  style={{
                    margin: 0,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--info-dark)",
                    fontSize: "0.8rem",
                  }}
                >
                  Invoice deliveries
                </p>
                <h2 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>Scheduled drop offs</h2>
                <p style={{ margin: "4px 0 0", color: "var(--grey-accent-dark)" }}>
                  Click a job to review invoice details, payment status, and confirm the delivery date.
                </p>
              </div>
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {jobsLoading ? (
                  <p style={{ color: "var(--info)", margin: 0 }}>Loading scheduled deliveries…</p>
                ) : jobsError ? (
                  <p style={{ color: "var(--danger)", margin: 0 }}>{jobsError}</p>
                ) : jobQueueByDate.length === 0 ? (
                  <p style={{ color: "var(--info)", margin: 0 }}>
                    No invoice deliveries scheduled yet. Add a job to get started.
                  </p>
                ) : (
                  jobQueueByDate.map(([date, jobs]) => (
                    <div key={date} style={queueDayStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ color: "var(--primary-dark)" }}>
                          {date === "unscheduled" ? "Date not set" : formatDate(date)}
                        </strong>
                        <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>
                          {jobs.length} job{jobs.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {jobs.map((job) => {
                          const jobItems = Array.isArray(job.items) ? job.items : [];
                          const qty =
                            job.quantity ||
                            jobItems.reduce((total, item) => total + (Number(item.quantity) || 0), 0) ||
                            1;
                          const paidLabel = job.is_paid ? "Paid" : "Awaiting payment";
                          return (
                            <button
                              key={job.id}
                              type="button"
                              style={{
                                ...jobRowButtonStyle,
                                borderColor:
                                  job.status === "completed" ? "rgba(var(--success-rgb,34,139,34),0.5)" : jobRowButtonStyle.border,
                                background:
                                  job.status === "completed" ? "rgba(var(--success-rgb,34,139,34),0.08)" : jobRowButtonStyle.background,
                              }}
                              onClick={() => openJobModal(job)}
                            >
                              <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 600, color: "var(--primary-dark)" }}>
                                    {job.invoice_number || job.job_id || "Invoice"}
                                  </span>
                                  <span style={paidPillStyle(job.is_paid)}>{paidLabel}</span>
                                </div>
                                <div style={{ fontSize: "0.9rem", color: "var(--info-dark)" }}>
                                  {job.customer_name || customerName(job.customer)} ·{" "}
                                  {job.address || job.customer?.address || "Address pending"}
                                </div>
                                <div style={{ fontWeight: 600, color: "var(--primary-dark)" }}>
                                  {job.part_name || "Parts order"} · Qty {qty}
                                </div>
                                <div style={{ fontSize: "0.85rem", color: "var(--grey-accent-dark)" }}>
                                  {jobItems.length > 0
                                    ? jobItems
                                        .slice(0, 2)
                                        .map((item) => `${item.description} x${item.quantity || 1}`)
                                        .join(" · ")
                                    : job.notes || "Items from invoice"}
                                </div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                                <span style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                                  {formatCurrency(job.total_price)}
                                </span>
                                <span style={statusChipStyle(job.status)}>{jobStatusLabel(job.status)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section style={sectionStyle}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <label style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                  <span style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>Filter by day</span>
                  <select
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--surface-light)",
                      fontSize: "0.9rem",
                      color: "var(--primary-dark)",
                    }}
                  >
                    <option value="">All days</option>
                    {dateOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate("")}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "999px",
                      border: "1px solid var(--surface-light)",
                      background: "var(--danger-surface)",
                      color: "var(--primary-dark)",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Clear day filter
                  </button>
                )}
              </div>
              {loading ? (
                <p style={{ color: "var(--info)", margin: 0 }}>Loading delivery runs…</p>
              ) : error ? (
                <p style={{ color: "var(--primary)", margin: 0 }}>{error}</p>
              ) : filteredRunsByDate.length === 0 ? (
                <p style={{ margin: 0, color: "var(--info)" }}>
                  {selectedDate
                    ? `No delivery runs scheduled for ${formatDate(selectedDate)}.`
                    : "No delivery runs scheduled yet."}
                </p>
              ) : (
                filteredRunsByDate.map(([date, items]) => {
                  const dayMileage = items.reduce((total, item) => total + (Number(item.mileage) || 0), 0);
                  const dayFuel = items.reduce(
                    (total, item) => total + (Number(item.fuel_cost) || computeFuelCost(item)),
                    0
                  );
                  const dayDrops = items.reduce((total, item) => total + (item.stops_count || 1), 0);
                  const status = items[0]?.status?.replace(/_/g, " ") || "Planned";
                  const cardLabel = date === "unscheduled" ? "Unscheduled" : formatDate(date);
                  return (
                    <div key={`${date}-${status}`} style={dayCardStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h3 style={{ margin: 0, color: "var(--primary-dark)" }}>{cardLabel}</h3>
                          <p style={{ margin: "4px 0 0", color: "var(--grey-accent-dark)" }}>
                            {items.length} run{items.length === 1 ? "" : "s"} · {dayMileage} km ·{" "}
                            {formatCurrency(dayFuel)} · {dayDrops} drop{dayDrops === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            color: "var(--primary-dark)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {status}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {items.map((run) => {
                          const customer = run.customer;
                          const jobNumber = run.job?.job_number || `#${run.job_id}`;
                          const address =
                            run.destination_address || customer?.address || run.customer?.name || "Address TBC";
                          const fuelExpense = Number(run.fuel_cost) || computeFuelCost(run);
                          return (
                            <article key={run.id} style={runRowStyle}>
                              <div>
                                <div style={{ fontWeight: 600, color: "var(--primary-dark)" }}>{jobNumber}</div>
                                <div style={{ fontSize: "0.9rem", color: "var(--info-dark)" }}>
                                  {customerName(customer)} · {address}
                                </div>
                                {run.notes ? (
                                  <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "var(--info)" }}>
                                    {run.notes}
                                  </p>
                                ) : null}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem" }}>
                                <div>
                                  <strong>Departure:</strong> {formatTime(run.time_leave)}
                                </div>
                                <div>
                                  <strong>Arrival:</strong> {formatTime(run.time_arrive)}
                                </div>
                                <div>
                                  <strong>Stops:</strong> {run.stops_count || 1}
                                </div>
                                <div>
                                  <strong>Mileage:</strong> {run.mileage ?? 0} km
                                </div>
                                <div>
                                  <strong>Fuel:</strong> {formatCurrency(fuelExpense)}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </>
        ) : (
          <section style={{ ...sectionStyle, gap: "18px" }}>
            <div>
              <p
                style={{
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--info-dark)",
                  fontSize: "0.8rem",
                }}
              >
                Collection schedule
              </p>
              <h2 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>Collection planner</h2>
              <p style={{ margin: "4px 0 0", color: "var(--grey-accent-dark)" }}>
                Mirror the appointments flow: scroll the day list, pick a date, then review all collections booked for
                that day with a single tap into the originating parts card.
              </p>
            </div>
            {collectionError && <p style={{ color: "var(--danger)" }}>{collectionError}</p>}
            {collectionLoading ? (
              <p style={{ color: "var(--info)" }}>Loading collection schedule…</p>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      flex: "1 1 240px",
                      border: "1px solid var(--surface-light)",
                      borderRadius: "16px",
                      padding: "14px",
                      background: "var(--surface)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--info-dark)", textTransform: "uppercase" }}>
                      Today
                    </p>
                    <strong style={{ fontSize: "1.4rem", color: "var(--primary-dark)" }}>
                      {todaysCollections.length} booking{todaysCollections.length === 1 ? "" : "s"}
                    </strong>
                    <p style={{ margin: "4px 0 0", color: "var(--grey-accent-dark)" }}>
                      {todaysCollectionQuantity} part{todaysCollectionQuantity === 1 ? "" : "s"} ready to collect
                    </p>
                  </div>
                  <div
                    style={{
                      flex: "1 1 240px",
                      border: "1px solid var(--surface-light)",
                      borderRadius: "16px",
                      padding: "14px",
                      background: "var(--surface)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--info-dark)", textTransform: "uppercase" }}>
                      All scheduled
                    </p>
                    <strong style={{ fontSize: "1.4rem", color: "var(--primary-dark)" }}>
                      {collectionJobs.length} order{collectionJobs.length === 1 ? "" : "s"}
                    </strong>
                    <p style={{ margin: "4px 0 0", color: "var(--grey-accent-dark)" }}>
                      {unscheduledCollections} awaiting time confirmation
                    </p>
                  </div>
                </div>
                <div
                  style={{
                    borderRadius: "18px",
                    border: "1px solid var(--surface-light)",
                    overflow: "hidden",
                    background: "var(--surface)",
                  }}
                >
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "640px" }}>
                      <thead>
                        <tr style={{ background: "var(--surface)", borderBottom: "2px solid var(--surface-light)" }}>
                          {["Day / Date", "Collections", "Total parts", "Earliest slot", "Load"].map((heading) => (
                            <th
                              key={heading}
                              style={{
                                textAlign: "left",
                                padding: "12px 14px",
                                fontSize: "0.8rem",
                                letterSpacing: "0.05em",
                                color: "var(--info-dark)",
                                textTransform: "uppercase",
                              }}
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {collectionSummaries.map((summary) => {
                          const tone = collectionLoadTokens[summary.status] || collectionLoadTokens.light;
                          const isSelected = summary.date === selectedCollectionDate;
                          const isToday = isSameCalendarDay(summary.date, todayIso());
                          const background = isSelected
                            ? "rgba(var(--primary-rgb),0.12)"
                            : isToday
                            ? "rgba(var(--primary-rgb),0.05)"
                            : tone.background;
                          const outline = isSelected ? "0 0 0 2px rgba(var(--primary-rgb),0.4) inset" : "none";
                          return (
                            <tr
                              key={summary.date}
                              onClick={() => setSelectedCollectionDate(summary.date)}
                              style={{
                                cursor: "pointer",
                                background,
                                transition: "background 0.2s",
                                boxShadow: outline,
                              }}
                            >
                              <td style={{ padding: "12px 14px", borderTop: "1px solid var(--surface-light)" }}>
                                <div style={{ fontWeight: 600, color: "var(--primary-dark)" }}>
                                  {summary.date === todayIso() ? "Today" : formatShortDate(summary.date)}
                                </div>
                                <div style={{ fontSize: "0.8rem", color: "var(--grey-accent-dark)" }}>
                                  {summary.jobCount} booking{summary.jobCount === 1 ? "" : "s"}
                                </div>
                              </td>
                              <td style={{ padding: "12px 14px", borderTop: "1px solid var(--surface-light)" }}>
                                {summary.jobCount}
                              </td>
                              <td style={{ padding: "12px 14px", borderTop: "1px solid var(--surface-light)" }}>
                                {summary.totalQuantity}
                              </td>
                              <td style={{ padding: "12px 14px", borderTop: "1px solid var(--surface-light)" }}>
                                {summary.earliestWindow ? formatTime(summary.earliestWindow) : "TBC"}
                              </td>
                              <td style={{ padding: "12px 14px", borderTop: "1px solid var(--surface-light)" }}>
                                <span
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "999px",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    background: isSelected ? "var(--primary)" : tone.background,
                                    color: isSelected ? "var(--surface)" : tone.color,
                                    border: isSelected ? "1px solid var(--primary)" : "1px solid transparent",
                                  }}
                                >
                                  {tone.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div
                  style={{
                    borderRadius: "18px",
                    border: "1px solid var(--surface-light)",
                    padding: "18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={{ flex: "1 1 200px" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.75rem",
                          letterSpacing: "0.08em",
                          color: "var(--info-dark)",
                          textTransform: "uppercase",
                        }}
                      >
                        Selected day
                      </p>
                      <strong style={{ fontSize: "1.2rem", color: "var(--primary-dark)" }}>
                        {formatDate(selectedCollectionDate)}
                      </strong>
                    </div>
                    <div style={{ flex: "1 1 160px" }}>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--info-dark)", textTransform: "uppercase" }}>
                        Bookings
                      </p>
                      <strong style={{ fontSize: "1.2rem", color: "var(--primary-dark)" }}>
                        {selectedCollectionJobs.length}
                      </strong>
                    </div>
                    <div style={{ flex: "1 1 160px" }}>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--info-dark)", textTransform: "uppercase" }}>
                        Total parts
                      </p>
                      <strong style={{ fontSize: "1.2rem", color: "var(--primary-dark)" }}>
                        {selectedCollectionQuantity}
                      </strong>
                    </div>
                    <div style={{ flex: "1 1 160px" }}>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--info-dark)", textTransform: "uppercase" }}>
                        First slot
                      </p>
                      <strong style={{ fontSize: "1.2rem", color: "var(--primary-dark)" }}>
                        {selectedCollectionWindow ? formatTime(selectedCollectionWindow) : "TBC"}
                      </strong>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {selectedCollectionJobs.length === 0 ? (
                      <p style={{ margin: 0, color: "var(--info-dark)" }}>
                        No collections scheduled for {formatDate(selectedCollectionDate)}.
                      </p>
                    ) : (
                      selectedCollectionJobs.map((job) => (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => router.push(`/parts/parts-job-card/${job.job_number}`)}
                          style={{
                            border: "1px solid rgba(var(--primary-rgb),0.15)",
                            borderRadius: "16px",
                            padding: "14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            textAlign: "left",
                            background: "var(--surface)",
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "12px",
                              flexWrap: "wrap",
                            }}
                          >
                            <strong style={{ color: "var(--primary-dark)" }}>
                              {job.customer_name || "Customer"}
                            </strong>
                            <span style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                              {job.invoice_reference || job.job_number}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "var(--grey-accent-dark)" }}>
                            {job.quantity} part{job.quantity === 1 ? "" : "s"} ·{" "}
                            {job.delivery_window ? formatTime(job.delivery_window) : "Time TBC"}
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                            {job.delivery_address || job.customer_address || "Collection address recorded on parts card"}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--grey-accent-dark)" }}>
                            Parts card #{job.job_number} · tap to open
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>
      {jobModalOpen && (
        <DeliveryJobModal
          job={jobForm}
          editing={Boolean(editingJobId)}
          onClose={closeJobModal}
          onSave={handleSaveJob}
          onDelete={handleDeleteJob}
          onFieldChange={updateJobForm}
          invoiceQuery={invoiceQuery}
          setInvoiceQuery={setInvoiceQuery}
          invoiceResults={invoiceResults}
          onInvoiceSelect={handleInvoiceSelected}
          invoiceSearching={invoiceSearchLoading}
          error={jobModalError}
          saving={jobModalSaving}
        />
      )}
    </Layout>
  );
}

function DeliveryJobModal({
  job,
  editing,
  onClose,
  onSave,
  onDelete,
  onFieldChange,
  invoiceQuery,
  setInvoiceQuery,
  invoiceResults,
  onInvoiceSelect,
  invoiceSearching,
  error,
  saving,
}) {
  if (!job) return null;
  const items = Array.isArray(job.items) ? job.items : [];
  const totalQuantity =
    job.quantity ||
    items.reduce((total, item) => total + (Number(item.quantity) || 0), 0) ||
    1;

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
              Delivery job
            </p>
            <h3 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>
              {job.invoice_number || "Select invoice"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid var(--surface-light)",
              borderRadius: "50%",
              width: "38px",
              height: "38px",
              background: "var(--surface)",
              cursor: "pointer",
              fontSize: "1.2rem",
            }}
            aria-label="Close delivery job"
          >
            ×
          </button>
        </div>

        <label style={{ display: "block" }}>
          <span style={{ fontWeight: 600, color: "var(--primary-dark)", fontSize: "0.85rem" }}>
            Search invoice number
          </span>
          <input
            type="text"
            value={invoiceQuery}
            placeholder="Enter invoice or job number"
            onChange={(event) => setInvoiceQuery(event.target.value)}
            style={{
              width: "100%",
              marginTop: "6px",
              borderRadius: "10px",
              border: "1px solid var(--surface-light)",
              padding: "10px",
              fontSize: "1rem",
            }}
          />
        </label>
        {invoiceSearching && <div style={{ color: "var(--info)", fontSize: "0.85rem" }}>Searching invoices…</div>}
        {!invoiceSearching && invoiceResults.length > 0 && (
          <div
            style={{
              border: "1px solid var(--surface-light)",
              borderRadius: "12px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            {invoiceResults.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                style={{
                  border: "1px solid rgba(var(--primary-rgb),0.15)",
                  borderRadius: "10px",
                  padding: "8px 10px",
                  background: "var(--surface)",
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onClick={() => onInvoiceSelect(invoice)}
              >
                <strong style={{ display: "block" }}>{invoice.job_number || invoice.id.slice(0, 8)}</strong>
                <span style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                  {customerName(invoice.customer)} ·{" "}
                  {invoice.customer?.address || "Address pending"}
                </span>
              </button>
            ))}
          </div>
        )}

        <div style={modalFieldColumnStyle}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Delivery date</span>
            <input
              type="date"
              value={job.delivery_date || ""}
              onChange={(event) => onFieldChange("delivery_date", event.target.value)}
              style={{
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                padding: "10px",
                fontWeight: 600,
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Payment method</span>
            <input
              type="text"
              value={job.payment_method || ""}
              onChange={(event) => onFieldChange("payment_method", event.target.value)}
              placeholder="Card / Cash / Account"
              style={{
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                padding: "10px",
              }}
            />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontWeight: 600 }}>Payment status</span>
            <button
              type="button"
              onClick={() => onFieldChange("is_paid", !job.is_paid)}
              style={{
                borderRadius: "999px",
                border: "1px solid var(--surface-light)",
                padding: "8px 14px",
                cursor: "pointer",
                background: job.is_paid ? "rgba(var(--success-rgb,34,139,34),0.12)" : "var(--danger-surface)",
                color: job.is_paid ? "var(--success, #297C3B)" : "var(--primary-dark)",
                fontWeight: 600,
              }}
            >
              {job.is_paid ? "Marked as paid" : "Mark as paid"}
            </button>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Part number</span>
            <input
              type="text"
              value={job.part_number || ""}
              onChange={(event) => onFieldChange("part_number", event.target.value)}
              placeholder="Part reference"
              style={{
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                padding: "10px",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Part / order name</span>
            <input
              type="text"
              value={job.part_name || ""}
              onChange={(event) => onFieldChange("part_name", event.target.value)}
              placeholder="Part description"
              style={{
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                padding: "10px",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Quantity</span>
            <input
              type="number"
              min="1"
              value={job.quantity || totalQuantity}
              onChange={(event) => onFieldChange("quantity", Number(event.target.value))}
              style={{
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                padding: "10px",
              }}
            />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Total value</span>
            <strong style={{ fontSize: "1.2rem" }}>{formatCurrency(job.total_price || 0)}</strong>
          </div>
        </div>

        <div style={modalFieldColumnStyle}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Customer name</span>
            <input
              type="text"
              value={job.customer_name || ""}
              onChange={(event) => onFieldChange("customer_name", event.target.value)}
              style={{
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                padding: "10px",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Contact number</span>
            <input
              type="tel"
              value={job.contact_phone || ""}
              onChange={(event) => onFieldChange("contact_phone", event.target.value)}
              style={{
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                padding: "10px",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Contact email</span>
            <input
              type="email"
              value={job.contact_email || ""}
              onChange={(event) => onFieldChange("contact_email", event.target.value)}
              style={{
                borderRadius: "10px",
                border: "1px solid var(--surface-light)",
                padding: "10px",
              }}
            />
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontWeight: 600 }}>Delivery address</span>
          <textarea
            value={job.address || ""}
            onChange={(event) => onFieldChange("address", event.target.value)}
            rows={3}
            style={{
              borderRadius: "12px",
              border: "1px solid var(--surface-light)",
              padding: "10px",
              resize: "vertical",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontWeight: 600 }}>Notes</span>
          <textarea
            value={job.notes || ""}
            onChange={(event) => onFieldChange("notes", event.target.value)}
            rows={3}
            style={{
              borderRadius: "12px",
              border: "1px solid var(--surface-light)",
              padding: "10px",
              resize: "vertical",
            }}
          />
        </label>

        <div>
          <p style={{ fontWeight: 600, marginBottom: "6px" }}>Invoice items</p>
          {items.length === 0 ? (
            <p style={{ color: "var(--info)", margin: 0 }}>No items loaded for this invoice.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {items.map((item) => (
                <div
                  key={item.key || `${item.description}-${item.quantity}`}
                  style={{
                    border: "1px solid var(--surface-light)",
                    borderRadius: "10px",
                    padding: "8px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.description}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                      Qty {item.quantity || 1}
                    </div>
                  </div>
                  <strong>{formatCurrency(item.total || 0)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</div>}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "8px",
            flexWrap: "wrap",
          }}
        >
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
          {editing && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              style={{
                borderRadius: "12px",
                border: "1px solid var(--danger)",
                background: "var(--danger-surface)",
                color: "var(--danger)",
                padding: "10px 18px",
                fontWeight: 600,
                cursor: "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
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
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
