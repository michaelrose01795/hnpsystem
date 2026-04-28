// file location: src/pages/parts/delivery-planner.js
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabaseClient } from "@/lib/database/supabaseClient";
import { useTheme } from "@/styles/themeProvider";
import { CalendarField } from "@/components/ui/calendarAPI";
import ModalPortal from "@/components/popups/ModalPortal";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import PartsDeliveryPlannerPageUi from "@/components/page-ui/parts/parts-delivery-planner-ui"; // Extracted presentation layer.

const sectionStyle = {
  gap: "18px"
};

const dayCardStyle = {
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--danger-surface)",
  padding: "var(--section-card-padding)",
  display: "flex",
  flexDirection: "column",
  gap: "12px"
};

const runRowStyle = {
  padding: "12px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--surface)",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(150px, 1fr)",
  gap: "12px",
  alignItems: "flex-start"
};

const queueCardStyle = {
  ...sectionStyle,
  border: "none"
};

const queueDayStyle = {
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--surface)",
  padding: "var(--section-card-padding)",
  display: "flex",
  flexDirection: "column",
  gap: "12px"
};

const jobRowButtonStyle = {
  border: "none",
  borderRadius: "var(--radius-md)",
  background: "var(--danger-surface)",
  padding: "14px",
  width: "100%",
  textAlign: "left",
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  cursor: "pointer"
};

const collectionPlannerGridStyle = {
  ...sectionStyle,
  padding: "18px",
  display: "grid",
  gridTemplateRows: "minmax(110px, 10%) minmax(360px, 50%) minmax(320px, 40%)",
  gap: "16px",
  minHeight: "680px",
  height: "calc(100vh - 220px)"
};

const collectionTableSectionStyle = {
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--surface)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const collectionTableScrollStyle = {
  flex: "1 1 auto",
  overflowY: "auto"
};

const collectionDetailsSectionStyle = {
  borderRadius: "var(--radius-md)",
  border: "none",
  padding: "18px",
  background: "var(--surface)",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  overflow: "hidden"
};

const collectionListScrollStyle = {
  flex: "1 1 auto",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  paddingRight: "4px"
};

const statusChipStyle = (variant = "scheduled") => {
  const variants = {
    scheduled: { background: "rgba(var(--warning-rgb),0.18)", color: "var(--danger-dark)" },
    en_route: { background: "rgba(var(--info-rgb),0.2)", color: "var(--accent-purple)" },
    completed: { background: "rgba(var(--success-rgb, 34,139,34),0.2)", color: "var(--success, #297C3B)" }
  };
  return {
    padding: "4px 12px",
    borderRadius: "var(--radius-pill)",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    ...(variants[variant] || variants.scheduled)
  };
};

const paidPillStyle = (isPaid) => ({
  padding: "4px 10px",
  borderRadius: "var(--radius-pill)",
  fontWeight: 600,
  fontSize: "0.75rem",
  background: isPaid ? "rgba(var(--success-rgb,34,139,34),0.18)" : "rgba(var(--warning-rgb),0.18)",
  color: isPaid ? "var(--success, #297C3B)" : "var(--danger-dark)"
});

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  zIndex: 90
};

const modalContentStyle = {
  background: "var(--surface)",
  borderRadius: "var(--radius-md)",
  padding: "24px",
  width: "min(900px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
  border: "none"
};

const modalFieldColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "16px"
};

const plannerTabButton = (active) => ({
  borderRadius: "var(--radius-pill)",
  border: active ? "1px solid var(--primary)" : "1px solid var(--surface-light)",
  background: active ? "var(--primary)" : "var(--surface)",
  color: active ? "var(--surface)" : "var(--primary-dark)",
  padding: "8px 18px",
  fontWeight: 600,
  cursor: "pointer"
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
    day.getDate() === compare.getDate());

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
    color: "var(--warning-dark)"
  },
  full: {
    label: "At capacity",
    background: "rgba(var(--danger-rgb,220,38,38),0.12)",
    color: "var(--danger, #C62828)"
  }
};

const COLLECTION_SCHEDULE_MONTH_RANGE = 2;

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
  sort_order: 0
});

const normalizeJobRecord = (job = {}) => ({
  ...job,
  delivery_date: job.delivery_date || todayIso(),
  items: Array.isArray(job.items) ? job.items : []
});

export default function PartsDeliveryPlannerPage() {
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
  const [collectionSearchTerm, setCollectionSearchTerm] = useState("");
  const [collectionSearchMessage, setCollectionSearchMessage] = useState("");
  const [collectionSearchSuccess, setCollectionSearchSuccess] = useState(false);
  const [searchHighlightDate, setSearchHighlightDate] = useState("");
  const pricePerLitre = fuelRate?.price_per_litre ?? 1.75;

  useEffect(() => {
    const loadRuns = async () => {
      setLoading(true);
      setError("");
      try {
        const { data, error: fetchError } = await supabaseClient.
        from("parts_delivery_runs").
        select(
          `id, job_id, customer_id, delivery_date, time_leave, time_arrive, mileage, fuel_cost, stops_count, destination_address, status, notes,
             job:jobs(job_number, vehicle_reg), customer:customers(firstname, lastname, name, address, postcode)`
        ).
        order("delivery_date", { ascending: true }).
        order("time_leave", { ascending: true });

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
  }, []);

  const loadCollectionJobs = useCallback(async () => {
    setCollectionLoading(true);
    setCollectionError("");
    try {
      const { data, error: fetchError } = await supabaseClient.
      from("parts_order_cards").
      select(
        `id, order_number, customer_name, invoice_reference, delivery_type, delivery_eta, delivery_window, created_at,
           items:parts_order_card_items(quantity)`
      ).
      eq("delivery_type", "collection").
      order("delivery_eta", { ascending: true }).
      order("created_at", { ascending: true });
      if (fetchError) throw fetchError;
      const normalized = (data || []).map((job) => {
        const items = Array.isArray(job.items) ? job.items : [];
        const quantity = items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
        const orderNumber = (job.order_number || "").trim().toUpperCase();
        return { ...job, quantity, order_number: orderNumber };
      });
      setCollectionJobs(normalized);
    } catch (fetchErr) {
      setCollectionError(fetchErr.message || "Unable to load collection schedule");
      setCollectionJobs([]);
    } finally {
      setCollectionLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollectionJobs();
  }, [loadCollectionJobs]);

  const loadDeliveryJobs = useCallback(async () => {
    setJobsLoading(true);
    setJobsError("");
    try {
      const { data, error: fetchError } = await supabaseClient.
      from("parts_delivery_jobs").
      select(
        `*,
           customer:customers(id, firstname, lastname, name, address, postcode, mobile, telephone, email)`
      ).
      order("delivery_date", { ascending: true }).
      order("sort_order", { ascending: true }).
      order("created_at", { ascending: true });
      if (fetchError) throw fetchError;
      setDeliveryJobs((data || []).map((record) => normalizeJobRecord(record)));
    } catch (fetchErr) {
      setJobsError(fetchErr.message || "Unable to load scheduled deliveries");
      setDeliveryJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeliveryJobs();
  }, [loadDeliveryJobs]);

  useEffect(() => {
    const loadFuelRate = async () => {
      const { data, error: rateError } = await supabaseClient.
      from("parts_delivery_settings").
      select("fuel_type, price_per_litre, last_updated").
      order("last_updated", { ascending: false }).
      limit(1).
      maybeSingle();
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
        const { data, error: searchError } = await supabaseClient.
        from("invoices").
        select(
          `id, job_id, job_number, payment_method, paid, grand_total, total, customer_id,
             customer:customers(id, firstname, lastname, name, address, postcode, mobile, telephone, email),
             items:invoice_items(description, quantity, unit_price, total)`
        ).
        ilike("job_number", wildcard).
        limit(6);
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

  const collectionScheduleDates = useMemo(() => {
    const startIso = todayIso();
    const start = new Date(`${startIso}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + COLLECTION_SCHEDULE_MONTH_RANGE);
    const cursor = new Date(start);
    const dates = [];
    while (cursor <= end) {
      if (cursor.getUTCDay() !== 0) {
        dates.push(cursor.toISOString().slice(0, 10));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }, []);

  const collectionSummaries = useMemo(() => {
    return collectionScheduleDates.map((date) => {
      const jobs = collectionJobsByDate[date] || [];
      const totalQuantity = jobs.reduce((sum, job) => sum + (Number(job.quantity) || 0), 0);
      const earliestWindow = jobs.
      map((job) => job.delivery_window).
      filter(Boolean).
      sort((a, b) => String(a).localeCompare(String(b)))[0];
      const status = getCollectionLoadStatus(jobs.length, totalQuantity);
      return {
        date,
        jobs,
        jobCount: jobs.length,
        totalQuantity,
        earliestWindow,
        status
      };
    });
  }, [collectionScheduleDates, collectionJobsByDate]);
  const todayKey = todayIso();

  useEffect(() => {
    if (collectionScheduleDates.length === 0) return;
    if (!collectionScheduleDates.includes(selectedCollectionDate)) {
      setSelectedCollectionDate(collectionScheduleDates[0]);
    }
  }, [collectionScheduleDates, selectedCollectionDate]);

  const selectedCollectionJobs = collectionJobsByDate[selectedCollectionDate] || [];
  const selectedCollectionQuantity = selectedCollectionJobs.reduce(
    (sum, job) => sum + (Number(job.quantity) || 0),
    0
  );
  const selectedCollectionWindow =
  selectedCollectionJobs.
  map((job) => job.delivery_window).
  filter(Boolean).
  sort((a, b) => String(a).localeCompare(String(b)))[0] || "";
  const unscheduledCollections = collectionJobs.filter((job) => !job.delivery_window).length;

  const jobQueueByDate = useMemo(() => {
    const grouped = {};
    deliveryJobs.forEach((job) => {
      const key = job.delivery_date || "unscheduled";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(job);
    });
    return Object.entries(grouped).
    map(([date, jobs]) => {
      const sortedJobs = [...jobs].sort((a, b) => {
        if (a.status === b.status) {
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }
        if (a.status === "completed") return 1;
        if (b.status === "completed") return -1;
        return 0;
      });
      return [date, sortedJobs];
    }).
    sort((a, b) => {
      const aKey = a[0] === "unscheduled" ? Number.MAX_SAFE_INTEGER : new Date(a[0]).getTime();
      const bKey = b[0] === "unscheduled" ? Number.MAX_SAFE_INTEGER : new Date(b[0]).getTime();
      return aKey - bKey;
    });
  }, [deliveryJobs]);

  const updateJobForm = (field, value) => {
    setJobForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectCollectionDate = useCallback((date) => {
    setSelectedCollectionDate(date);
    setSearchHighlightDate("");
  }, []);

  const handleCollectionSearch = useCallback(
    (event) => {
      event.preventDefault();
      const term = collectionSearchTerm.trim().toLowerCase();
      if (!term) {
        setCollectionSearchMessage("Enter a customer name, order number, or reference to search.");
        setCollectionSearchSuccess(false);
        setSearchHighlightDate("");
        return;
      }
      const match = collectionSummaries.find((summary) =>
      summary.jobs.some((job) => {
        const fields = [
        job.customer_name,
        job.invoice_reference,
        job.job_number,
        job.delivery_address];

        return fields.some((value) => value && String(value).toLowerCase().includes(term));
      })
      );
      if (match) {
        setSelectedCollectionDate(match.date);
        setSearchHighlightDate(match.date);
        setCollectionSearchSuccess(true);
        const label = match.jobCount === 1 ? "booking" : "bookings";
        setCollectionSearchMessage(`Found ${match.jobCount} ${label} on ${formatDate(match.date)}.`);
      } else {
        setCollectionSearchMessage("No bookings match that search.");
        setCollectionSearchSuccess(false);
        setSearchHighlightDate("");
      }
    },
    [collectionSearchTerm, collectionSummaries]
  );

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
      job.customer || (
      job.customer_id ?
      { name: job.customer_name, address: job.address, mobile: job.contact_phone, email: job.contact_email } :
      null);
      setEditingJobId(job.id);
      setJobForm(
        normalizeJobRecord({
          ...createBlankJobForm(),
          ...job,
          customer_name: job.customer_name || customerName(derivedCustomer),
          address: job.address || derivedCustomer?.address || "",
          contact_name: job.contact_name || job.customer_name || customerName(derivedCustomer),
          contact_phone: job.contact_phone || derivedCustomer?.mobile || "",
          contact_email: job.contact_email || derivedCustomer?.email || ""
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
        key: `${invoice.id}-${index}`
      })),
      payment_method: invoice.payment_method || prev.payment_method,
      is_paid: Boolean(invoice.paid),
      address: customer?.address || prev.address,
      contact_name: derivedCustomerName || prev.contact_name,
      contact_phone: customer?.mobile || customer?.telephone || prev.contact_phone,
      contact_email: customer?.email || prev.contact_email
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
      sort_order: jobForm.sort_order ?? deliveryJobs.length
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
        const { error: updateError } = await supabaseClient.
        from("parts_delivery_jobs").
        update({ ...payload, updated_at: new Date().toISOString() }).
        eq("id", editingJobId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabaseClient.
        from("parts_delivery_jobs").
        insert([{ ...payload, sort_order: deliveryJobs.length }]);
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
      const { error: deleteError } = await supabaseClient.
      from("parts_delivery_jobs").
      delete().
      eq("id", editingJobId);
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

  const computeFuelCost = (run) => (Number(run.mileage) || 0) / KM_PER_LITRE * pricePerLitre;
  const priceLabel = fuelRate?.fuel_type ?
  `${fuelRate.fuel_type} @ ${formatCurrency(pricePerLitre)} / L` :
  `Diesel @ ${formatCurrency(pricePerLitre)} / L`;
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
    label: date === "unscheduled" ? "Unscheduled" : formatDate(date)
  }));

  return <PartsDeliveryPlannerPageUi view="section1" closeJobModal={closeJobModal} collectionDetailsSectionStyle={collectionDetailsSectionStyle} collectionError={collectionError} collectionListScrollStyle={collectionListScrollStyle} collectionLoading={collectionLoading} collectionLoadTokens={collectionLoadTokens} collectionPlannerGridStyle={collectionPlannerGridStyle} collectionSearchMessage={collectionSearchMessage} collectionSearchSuccess={collectionSearchSuccess} collectionSearchTerm={collectionSearchTerm} collectionSummaries={collectionSummaries} collectionTableScrollStyle={collectionTableScrollStyle} collectionTableSectionStyle={collectionTableSectionStyle} computeFuelCost={computeFuelCost} customerName={customerName} dateOptions={dateOptions} dayCardStyle={dayCardStyle} DeliveryJobModal={DeliveryJobModal} editingJobId={editingJobId} error={error} filteredRunsByDate={filteredRunsByDate} formatCurrency={formatCurrency} formatDate={formatDate} formatShortDate={formatShortDate} formatTime={formatTime} handleCollectionSearch={handleCollectionSearch} handleDeleteJob={handleDeleteJob} handleInvoiceSelected={handleInvoiceSelected} handleSaveJob={handleSaveJob} handleSelectCollectionDate={handleSelectCollectionDate} invoiceQuery={invoiceQuery} invoiceResults={invoiceResults} invoiceSearchLoading={invoiceSearchLoading} isSameCalendarDay={isSameCalendarDay} jobForm={jobForm} jobModalError={jobModalError} jobModalOpen={jobModalOpen} jobModalSaving={jobModalSaving} jobQueueByDate={jobQueueByDate} jobRowButtonStyle={jobRowButtonStyle} jobsError={jobsError} jobsLoading={jobsLoading} jobStatusLabel={jobStatusLabel} loading={loading} openJobModal={openJobModal} paidPillStyle={paidPillStyle} plannerTab={plannerTab} plannerTabButton={plannerTabButton} priceLabel={priceLabel} queueCardStyle={queueCardStyle} queueDayStyle={queueDayStyle} router={router} runRowStyle={runRowStyle} runs={runs} searchHighlightDate={searchHighlightDate} sectionStyle={sectionStyle} selectedCollectionDate={selectedCollectionDate} selectedCollectionJobs={selectedCollectionJobs} selectedCollectionQuantity={selectedCollectionQuantity} selectedCollectionWindow={selectedCollectionWindow} selectedDate={selectedDate} setCollectionSearchMessage={setCollectionSearchMessage} setCollectionSearchSuccess={setCollectionSearchSuccess} setCollectionSearchTerm={setCollectionSearchTerm} setInvoiceQuery={setInvoiceQuery} setPlannerTab={setPlannerTab} setSearchHighlightDate={setSearchHighlightDate} setSelectedDate={setSelectedDate} statusChipStyle={statusChipStyle} todayKey={todayKey} totalFuel={totalFuel} totalMileage={totalMileage} updateJobForm={updateJobForm} />;

































































































































































































































































































































































































































































































































































































































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
  saving
}) {
  const closeButtonColor = "var(--accent-purple)";
  if (!job) return null;
  const items = Array.isArray(job.items) ? job.items : [];
  const totalQuantity =
  job.quantity ||
  items.reduce((total, item) => total + (Number(item.quantity) || 0), 0) ||
  1;

  return (
    <ModalPortal>
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
                  color: "var(--info-dark)"
                }}>
                
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
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "0.95rem",
                color: closeButtonColor,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}
              aria-label="Close delivery job">
              
            Close
          </button>
        </div>

        <label style={{ display: "block" }}>
          <span style={{ fontWeight: 600, color: "var(--primary-dark)", fontSize: "0.85rem" }}>
            Search invoice number
          </span>
          <input
              type="text"
              value={invoiceQuery}
              placeholder="Enter invoice or order number"
              onChange={(event) => setInvoiceQuery(event.target.value)}
              style={{
                width: "100%",
                marginTop: "6px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                padding: "10px",
                fontSize: "1rem"
              }} />
            
        </label>
        {invoiceSearching && <InlineLoading width={160} label="Searching invoices" />}
        {!invoiceSearching && invoiceResults.length > 0 &&
          <div
            style={{
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              maxHeight: "200px",
              overflowY: "auto"
            }}>
            
            {invoiceResults.map((invoice) =>
            <button
              key={invoice.id}
              type="button"
              style={{
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "8px 10px",
                background: "var(--surface)",
                textAlign: "left",
                cursor: "pointer"
              }}
              onClick={() => onInvoiceSelect(invoice)}>
              
                <strong style={{ display: "block" }}>{invoice.job_number || invoice.id.slice(0, 8)}</strong>
                <span style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                  {customerName(invoice.customer)} ·{" "}
                  {invoice.customer?.address || "Address pending"}
                </span>
              </button>
            )}
          </div>
          }

        <div style={modalFieldColumnStyle}>
          <CalendarField
              label="Delivery date"
              value={job.delivery_date || ""}
              onChange={(value) => onFieldChange("delivery_date", value)}
              name="delivery_date" />
            
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Payment method</span>
            <input
                type="text"
                value={job.payment_method || ""}
                onChange={(event) => onFieldChange("payment_method", event.target.value)}
                placeholder="Card / Cash / Account"
                style={{
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  padding: "10px"
                }} />
              
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontWeight: 600 }}>Payment status</span>
            <button
                type="button"
                onClick={() => onFieldChange("is_paid", !job.is_paid)}
                style={{
                  borderRadius: "var(--radius-pill)",
                  border: "none",
                  padding: "8px 14px",
                  cursor: "pointer",
                  background: job.is_paid ? "rgba(var(--success-rgb,34,139,34),0.12)" : "var(--danger-surface)",
                  color: job.is_paid ? "var(--success, #297C3B)" : "var(--primary-dark)",
                  fontWeight: 600
                }}>
                
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
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  padding: "10px"
                }} />
              
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Part / order name</span>
            <input
                type="text"
                value={job.part_name || ""}
                onChange={(event) => onFieldChange("part_name", event.target.value)}
                placeholder="Part description"
                style={{
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  padding: "10px"
                }} />
              
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Quantity</span>
            <input
                type="number"
                min="1"
                value={job.quantity || totalQuantity}
                onChange={(event) => onFieldChange("quantity", Number(event.target.value))}
                style={{
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  padding: "10px"
                }} />
              
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
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  padding: "10px"
                }} />
              
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Contact number</span>
            <input
                type="tel"
                value={job.contact_phone || ""}
                onChange={(event) => onFieldChange("contact_phone", event.target.value)}
                style={{
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  padding: "10px"
                }} />
              
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontWeight: 600 }}>Contact email</span>
            <input
                type="email"
                value={job.contact_email || ""}
                onChange={(event) => onFieldChange("contact_email", event.target.value)}
                style={{
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  padding: "10px"
                }} />
              
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontWeight: 600 }}>Delivery address</span>
          <textarea
              value={job.address || ""}
              onChange={(event) => onFieldChange("address", event.target.value)}
              rows={3}
              style={{
                borderRadius: "var(--radius-sm)",
                border: "none",
                padding: "10px",
                resize: "vertical"
              }} />
            
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontWeight: 600 }}>Notes</span>
          <textarea
              value={job.notes || ""}
              onChange={(event) => onFieldChange("notes", event.target.value)}
              rows={3}
              style={{
                borderRadius: "var(--radius-sm)",
                border: "none",
                padding: "10px",
                resize: "vertical"
              }} />
            
        </label>

        <div>
          <p style={{ fontWeight: 600, marginBottom: "6px" }}>Invoice items</p>
          {items.length === 0 ?
            <p style={{ color: "var(--info)", margin: 0 }}>No items loaded for this invoice.</p> :

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {items.map((item) =>
              <div
                key={item.key || `${item.description}-${item.quantity}`}
                style={{
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px"
                }}>
                
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.description}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
                      Qty {item.quantity || 1}
                    </div>
                  </div>
                  <strong>{formatCurrency(item.total || 0)}</strong>
                </div>
              )}
            </div>
            }
        </div>

        {error && <div style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</div>}

        <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "8px",
              flexWrap: "wrap"
            }}>
            
          <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--surface)",
                padding: "10px 18px",
                fontWeight: 600,
                cursor: "pointer"
              }}>
              
            Close
          </button>
          {editing &&
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              style={{
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--danger-surface)",
                color: "var(--danger)",
                padding: "10px 18px",
                fontWeight: 600,
                cursor: "pointer",
                opacity: saving ? 0.7 : 1
              }}>
              
              Delete
            </button>
            }
          <button
              type="button"
              onClick={onSave}
              disabled={saving}
              style={{
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--primary)",
                color: "var(--surface)",
                padding: "10px 18px",
                fontWeight: 600,
                cursor: "pointer",
                opacity: saving ? 0.7 : 1
              }}>
              
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        </div>
      </div>
    </ModalPortal>);

}
