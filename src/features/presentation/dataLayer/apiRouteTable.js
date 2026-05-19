// Maps internal /api/* URLs to the mock table they should pull from when in
// presentation mode. Entries are evaluated top-to-bottom; first match wins.
// `transform` (optional) shapes rows into the response envelope a real API
// route returns; the default envelope is `{ success: true, data: rows }`.
//
// Add new entries here as presentation pages report empty data or warnings.
// Unmatched /api requests fall through to a permissive default (empty list)
// with a console.warn so gaps surface during demo walkthroughs.

import { getMockRows } from "../mockData";
import { buildPresentationPersonalState } from "../mockData/personal";
import {
  threads as messageThreads,
  threadMessages as messageThreadMessages,
  directory as messageDirectory,
  customerRequests as messageCustomerRequests,
} from "../mockData/messages";

// In-memory lock status for the demo /profile → Personal tab. The presenter
// enters the (pre-filled) passcode to flip this to unlocked; it survives the
// dashboard hook's focus/visibility re-fetches within a single demo session.
let presentationPersonalUnlocked = false;

// Transform for /api/personal/security. GET reports the current lock status;
// POST branches on the payload `action` (unlock / setup / lock / reset).
function personalSecurityResponse(_rows, _query, _parsed, ctx = {}) {
  const action = ctx.body?.action || null;
  if (action === "lock") {
    presentationPersonalUnlocked = false;
    return { success: true, data: { isSetup: true, isUnlocked: false } };
  }
  if (action === "reset") {
    presentationPersonalUnlocked = false;
    return { success: true, data: { isSetup: false, isUnlocked: false } };
  }
  if (action === "unlock" || action === "setup") {
    presentationPersonalUnlocked = true;
    return {
      success: true,
      data: { isSetup: true, isUnlocked: true, personalState: buildPresentationPersonalState() },
    };
  }
  // GET — report the current status, including the state blob once unlocked.
  return {
    success: true,
    data: {
      isSetup: true,
      isUnlocked: presentationPersonalUnlocked,
      ...(presentationPersonalUnlocked
        ? { personalState: buildPresentationPersonalState() }
        : {}),
    },
  };
}

function paginate(rows, query) {
  const page = Math.max(1, Number(query.get("page") || 1));
  const pageSize = Math.max(1, Number(query.get("pageSize") || query.get("limit") || rows.length || 20));
  const start = (page - 1) * pageSize;
  const data = rows.slice(start, start + pageSize);
  return { data, pagination: { page, pageSize, total: rows.length } };
}

const passthroughList = () => (rows, q) => ({ success: true, ...paginate(rows, q) });
const passthroughSingle = () => (rows) => ({ success: true, data: rows[0] || null });

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatPartRows = (rows = []) =>
  rows.map((row) => {
    const qtyInStock = toNumber(row.qty_in_stock ?? row.on_hand);
    const reorderLevel = toNumber(row.reorder_level);
    const qtyOnOrder = toNumber(row.qty_on_order);
    return {
      ...row,
      name: row.name || row.description || row.part_number || "Demo part",
      storage_location: row.storage_location || row.location || null,
      unit_cost: toNumber(row.unit_cost ?? row.cost),
      unit_price: toNumber(row.unit_price ?? row.price ?? row.cost),
      qty_in_stock: qtyInStock,
      qty_reserved: toNumber(row.qty_reserved),
      qty_on_order: qtyOnOrder,
      reorder_level: reorderLevel,
      is_active: row.is_active !== false,
      stock_status: row.is_active === false ? "inactive" : qtyInStock <= reorderLevel ? "low_stock" : "in_stock",
      open_job_count: row.open_job_count || 0,
      linked_jobs: row.linked_jobs || [],
    };
  });

const partsList = () => (rows, q) => {
  const page = paginate(formatPartRows(rows), q);
  return { success: true, parts: page.data, data: page.data, pagination: page.pagination, count: rows.length };
};

const partSingle = () => (rows) => {
  const part = formatPartRows(rows)[0] || null;
  return { success: true, part, parts: part ? [part] : [], data: part };
};

const formatGoodsInRows = (rows = []) =>
  rows.map((row) => ({
    supplier_name: row.supplier_name || row.supplier || "Demo Supplier",
    status: row.status || "draft",
    items: row.items || [],
    created_at: row.created_at || row.received_at || new Date().toISOString(),
    updated_at: row.updated_at || row.received_at || new Date().toISOString(),
    ...row,
  }));

const goodsInList = () => (rows, q) => {
  const page = paginate(formatGoodsInRows(rows), q);
  const lookup = q.get("goodsInNumber") || q.get("goodsInId");
  if (lookup) {
    const formattedRows = formatGoodsInRows(rows);
    const goodsIn =
      formattedRows.find((row) => row.goods_in_number === lookup || row.id === lookup) ||
      formattedRows[0] ||
      null;
    return { success: true, goodsIn, data: goodsIn };
  }
  return { success: true, goodsIn: page.data, data: page.data, count: rows.length, pagination: page.pagination };
};

const goodsInSingle = () => (rows) => {
  const goodsIn = formatGoodsInRows(rows)[0] || null;
  return { success: true, goodsIn, data: goodsIn };
};

const supplierList = () => (rows, q) => {
  const page = paginate(rows, q);
  const suppliers = page.data.map((row) => ({
    ...row,
    account_number: row.account_number || row.id,
    company_name: row.company_name || row.trading_name || row.name || "Demo Supplier",
    trading_name: row.trading_name || row.name || null,
    contact_email: row.contact_email || row.email || null,
    contact_phone: row.contact_phone || row.phone || null,
  }));
  return { success: true, suppliers, data: suppliers };
};

const jobSearchList = () => (rows, q) => {
  const page = paginate(rows, q);
  const jobs = page.data.map((row) => ({
    ...row,
    vehicle_reg: row.vehicle_reg || row.reg,
    vehicle_make_model: row.vehicle_make_model || [row.make, row.model].filter(Boolean).join(" "),
    customer: row.customer || row.customer_name,
  }));
  return { success: true, jobs, data: jobs, pagination: page.pagination };
};

const partsJobDetails = () => (rows) => {
  const job = rows[0] || null;
  return {
    success: true,
    job: job
      ? {
          id: job.id,
          jobNumber: job.job_number,
          reg: job.vehicle_reg || job.reg,
          makeModel: job.vehicle_make_model || [job.make, job.model].filter(Boolean).join(" "),
          description: job.description || job.complaint || job.job_description_snapshot || "",
          status: job.status,
          waitingStatus: job.waiting_status || null,
          customer: job.customer || job.customer_name || null,
        }
      : null,
    parts: getMockRows("parts"),
    requests: getMockRows("parts_requests"),
  };
};

const formatJobCard = (row) => {
  if (!row) return null;
  const firstAppointment = Array.isArray(row.appointments) ? row.appointments[0] : null;
  const customer = row.vehicle?.customer || {};
  return {
    ...row,
    jobNumber: row.job_number,
    rawStatus: row.status,
    completionStatus: row.completion_status || null,
    techCompletionStatus: row.tech_completion_status || null,
    assignedTo: row.assigned_to,
    assignedTech: row.technician
      ? {
          id: row.technician.user_id || null,
          name: [row.technician.first_name, row.technician.last_name].filter(Boolean).join(" ").trim() || row.technician.email || "",
          fullName: [row.technician.first_name, row.technician.last_name].filter(Boolean).join(" ").trim() || row.technician.email || "",
          email: row.technician.email || "",
          role: row.technician.role || "",
        }
      : null,
    reg: row.vehicle_reg || row.reg || row.vehicle?.registration || row.vehicle?.reg_number || "",
    make: row.vehicle?.make || row.make || "",
    model: row.vehicle?.model || row.model || "",
    makeModel: row.vehicle_make_model || row.vehicle?.make_model || [row.make, row.model].filter(Boolean).join(" "),
    mileage: row.milage ?? row.mileage ?? row.vehicle?.mileage ?? "",
    customer: [customer.firstname, customer.lastname].filter(Boolean).join(" ").trim() || row.customer_name || "",
    customerId: row.customer_id || customer.id || null,
    customerPhone: customer.mobile || customer.telephone || "",
    customerEmail: customer.email || "",
    customerAddress: customer.address || "",
    customerPostcode: customer.postcode || "",
    appointment: firstAppointment
      ? {
          appointmentId: firstAppointment.appointment_id,
          date: firstAppointment.scheduled_time?.slice(0, 10) || "",
          time: firstAppointment.scheduled_time?.slice(11, 16) || "",
          status: firstAppointment.status || "booked",
          notes: firstAppointment.notes || "",
          createdAt: firstAppointment.created_at || null,
          updatedAt: firstAppointment.updated_at || null,
        }
      : null,
    jobRequests: (row.job_requests || []).map((request) => ({
      requestId: request.request_id,
      jobId: request.job_id,
      description: request.description || request.text || "",
      hours: request.hours ?? null,
      jobType: request.job_type || "Customer",
      sortOrder: request.sort_order ?? null,
      status: request.status || "pending",
      requestSource: request.request_source || "customer_request",
      prePickLocation: request.pre_pick_location || null,
      noteText: request.note_text || "",
      createdAt: request.created_at || null,
      updatedAt: request.updated_at || null,
    })),
    vhcChecks: row.vhc_checks || [],
    partsRequests: row.parts_requests || [],
    partsAllocations: row.parts_job_items || [],
    parts_job_items: row.parts_job_items || [],
    goodsInParts: row.goods_in_items || [],
  };
};

const jobCardSingle = () => (rows) => {
  const job = formatJobCard(rows[0]);
  return {
    success: true,
    job,
    customer: job
      ? {
          customerId: job.customerId,
          firstName: job.vehicle?.customer?.firstname || "",
          lastName: job.vehicle?.customer?.lastname || "",
          email: job.customerEmail,
          mobile: job.customerPhone,
          telephone: job.customerPhone,
          address: job.customerAddress,
          postcode: job.customerPostcode,
        }
      : null,
    vehicle: job
      ? {
          vehicleId: job.vehicleId || job.vehicle_id || job.vehicle?.vehicle_id || null,
          reg: job.reg,
          make: job.make,
          model: job.model,
          makeModel: job.makeModel,
          mileage: job.mileage,
          motDue: job.vehicle?.mot_due || "",
        }
      : null,
  };
};

const accountTransactionsList = () => (rows, q) => {
  const transactions = rows.map((row) => ({
    transaction_id: `TX-${row.invoice_number || row.id}`,
    transaction_date: row.issued_at || row.invoice_date || row.created_at,
    type: row.status === "Paid" ? "Credit" : "Debit",
    amount: toNumber(row.total ?? row.grand_total ?? row.invoice_total),
    payment_method: row.status === "Paid" ? "Card" : "Account",
    job_number: row.job_number || null,
    created_by: "Demo Accounts",
    description: row.invoice_number || row.id,
  }));
  const page = paginate(transactions, q);
  return { success: true, data: page.data, pagination: page.pagination };
};

const accountSingle = () => (rows) => ({
  success: true,
  data: rows[0] || null,
  transactions: accountTransactionsList()(getMockRows("invoices"), new URLSearchParams()).data,
  invoices: getMockRows("invoices"),
});

const accountInvoiceList = () => (rows, q) => {
  const page = paginate(rows, q);
  return { success: true, invoices: page.data, data: page.data, pagination: page.pagination };
};

const formatCompanyAccountRows = (rows = []) =>
  rows.map((row, index) => {
    const companyName = row.company_name || row.name || row.trading_name || `Demo Company ${index + 1}`;
    const accountNumber = row.account_number || row.id || `CO-${String(2000 + index + 1).padStart(4, "0")}`;
    const linkedAccountId = row.linked_account_id || `ACC-${String(2000 + index + 1).padStart(4, "0")}`;
    return {
      archived: false,
      is_active: row.is_active !== false,
      company_name: companyName,
      trading_name: row.trading_name || companyName,
      contact_name: row.contact_name || row.contact || "Demo Accounts Contact",
      contact_email: row.contact_email || row.email || `accounts-${index + 1}@demo-company.invalid`,
      contact_phone: row.contact_phone || row.phone || "01392 555 000",
      billing_address_line1: row.billing_address_line1 || `${index + 1} Demo Trading Estate`,
      billing_address_line2: row.billing_address_line2 || "Marsh Barton",
      billing_city: row.billing_city || row.city || "Exeter",
      billing_postcode: row.billing_postcode || row.postcode || `EX${index + 1} 1AA`,
      billing_country: row.billing_country || "United Kingdom",
      linked_account_id: linkedAccountId,
      linked_account_label: row.linked_account_label || `${linkedAccountId} - ${companyName}`,
      notes: row.notes || "Presentation demo company account with linked ledger activity.",
      status: row.status || "Active",
      balance: toNumber(row.balance),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || row.created_at || new Date().toISOString(),
      ...row,
      account_number: accountNumber,
    };
  });

const companyAccountsList = () => (rows, q) => {
  const search = String(q.get("search") || "").trim().toLowerCase();
  const formattedRows = formatCompanyAccountRows(rows);
  const filteredRows = search
    ? formattedRows.filter((row) =>
        [
          row.account_number,
          row.company_name,
          row.trading_name,
          row.contact_name,
          row.contact_email,
          row.contact_phone,
          row.billing_city,
          row.linked_account_label,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      )
    : formattedRows;
  const page = paginate(filteredRows, q);
  return { success: true, data: page.data, pagination: page.pagination };
};

const buildCompanyAccountHistory = (account) => {
  if (!account) return { jobs: [], invoices: [] };
  const jobs = (getMockRows("jobs") || []).slice(0, 4).map((job) => ({
    id: job.id || job.job_number,
    job_number: job.job_number,
    job_source: job.job_source || "Service booking",
    status: job.status || "Booked",
    customer: job.customer || job.customer_name || account.company_name,
    vehicle_reg: job.vehicle_reg || job.reg || "DE24 XYZ",
    vehicle_make_model: job.vehicle_make_model || [job.make, job.model].filter(Boolean).join(" ") || "Demo fleet vehicle",
    created_at: job.created_at || job.updated_at || new Date().toISOString(),
    completed_at: job.completed_at || null,
    account_number: account.account_number,
  }));
  const invoices = (getMockRows("invoices") || []).slice(0, 5).map((invoice) => ({
    id: invoice.id || invoice.invoice_id || invoice.invoice_number,
    invoice_number: invoice.invoice_number || invoice.invoice_id,
    job_number: invoice.job_number || invoice.order_number || null,
    order_number: invoice.order_number || invoice.job_number || null,
    payment_status: invoice.payment_status || invoice.status || "Open",
    invoice_total: toNumber(invoice.invoice_total ?? invoice.grand_total ?? invoice.total),
    invoice_date: invoice.invoice_date || invoice.issued_at || invoice.created_at || new Date().toISOString(),
    due_date: invoice.due_date || invoice.due_at || invoice.created_at || new Date().toISOString(),
    created_at: invoice.created_at || invoice.invoice_date || invoice.issued_at || new Date().toISOString(),
    invoice_to: account.company_name,
    account_number: account.account_number,
  }));
  return { jobs, invoices };
};

const companyAccountSingle = () => (rows, _q, parsed) => {
  const requestedAccountNumber = decodeURIComponent(parsed?.pathname?.split("/").filter(Boolean).pop() || "");
  const formattedRows = formatCompanyAccountRows(rows);
  const account =
    formattedRows.find((row) => row.account_number === requestedAccountNumber || row.id === requestedAccountNumber) ||
    formattedRows[0] ||
    null;
  return { success: true, data: account, history: buildCompanyAccountHistory(account) };
};

const buildAccountsReportMetrics = (accounts = [], invoices = [], days = 30) => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const inRange = (value) => {
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed >= start;
  };
  const accountRows = accounts.filter((account) => inRange(account.created_at));
  const invoiceRows = invoices.filter((invoice) =>
    inRange(invoice.created_at || invoice.invoice_date || invoice.issued_at)
  );
  const totalInvoiced = invoiceRows.reduce(
    (sum, invoice) => sum + toNumber(invoice.grand_total ?? invoice.invoice_total ?? invoice.total),
    0
  );
  const overdueInvoices = invoiceRows.filter((invoice) => {
    const due = invoice.due_date || invoice.due_at;
    if (!due) return false;
    if (String(invoice.payment_status || invoice.status || "").toLowerCase() === "paid") return false;
    return new Date(due).getTime() < now.getTime();
  }).length;
  const balanceRows = accountRows.length > 0 ? accountRows : accounts;
  const averageBalance =
    balanceRows.length === 0
      ? 0
      : balanceRows.reduce((sum, account) => sum + toNumber(account.balance), 0) / balanceRows.length;

  return {
    newAccounts: accountRows.length || Math.min(accounts.length, Math.max(2, Math.round(accounts.length / (days >= 365 ? 1 : days >= 90 ? 2 : 4)))),
    totalInvoiced,
    overdueInvoices,
    averageBalance,
  };
};

const accountsReportResponse = (accounts = []) => {
  const invoices = getMockRows("invoices") || [];
  return {
    monthly: buildAccountsReportMetrics(accounts, invoices, 30),
    quarterly: buildAccountsReportMetrics(accounts, invoices, 90),
    yearly: buildAccountsReportMetrics(accounts, invoices, 365),
  };
};

const buildInvoiceDetailPayload = (invoice = {}, parsed = null) => {
  const pathParts = parsed?.pathname?.split("/").filter(Boolean) || [];
  const requestedId = decodeURIComponent(pathParts[pathParts.length - 1] || "");
  const jobNumber = invoice.job_number || (parsed?.pathname?.includes("/by-job/") ? requestedId : "");
  const orderNumber = invoice.order_number || (parsed?.pathname?.includes("/by-order/") ? requestedId : "");
  const job = (getMockRows("jobs") || []).find((row) => row.job_number === jobNumber) || (getMockRows("jobs") || [])[0] || {};
  const customer = job.vehicle?.customer || {};
  const customerName =
    invoice.customer_name ||
    [customer.firstname, customer.lastname].filter(Boolean).join(" ").trim() ||
    "Demo Customer";
  const total = toNumber(invoice.invoice_total ?? invoice.grand_total ?? invoice.total) || 240;
  const vat = toNumber(invoice.vat) || Number((total / 6).toFixed(2));
  const net = Number((total - vat).toFixed(2));
  const paymentStatus = invoice.payment_status || invoice.status || "Open";
  const paymentStatusKey = String(paymentStatus).toLowerCase();
  const paidAmount =
    paymentStatusKey === "paid"
      ? total
      : paymentStatusKey === "open"
        ? Number((total * 0.35).toFixed(2))
        : 0;
  const payments =
    paidAmount > 0
      ? [
          {
            payment_id: `PAY-${invoice.invoice_number || invoice.invoice_id || "DEMO"}-1`,
            invoice_id: invoice.invoice_id || invoice.invoice_number || "demo-invoice",
            invoice_number: invoice.invoice_number || invoice.invoice_id || "demo-invoice",
            amount: paidAmount,
            method: paymentStatusKey === "paid" ? "Card" : "Deposit",
            payment_method: paymentStatusKey === "paid" ? "Card" : "Deposit",
            payment_date: invoice.paid_at || invoice.updated_at || invoice.invoice_date || invoice.issued_at || new Date().toISOString(),
            reference: paymentStatusKey === "paid" ? "Stripe demo" : "Customer deposit",
            created_at: invoice.updated_at || invoice.invoice_date || invoice.issued_at || new Date().toISOString(),
          },
        ]
      : [
          {
            payment_id: `PAY-${invoice.invoice_number || invoice.invoice_id || "DEMO"}-deposit`,
            invoice_id: invoice.invoice_id || invoice.invoice_number || "demo-invoice",
            invoice_number: invoice.invoice_number || invoice.invoice_id || "demo-invoice",
            amount: Number(Math.min(125, total * 0.2).toFixed(2)),
            method: "Bank transfer",
            payment_method: "Bank transfer",
            payment_date: invoice.updated_at || invoice.invoice_date || invoice.issued_at || new Date().toISOString(),
            reference: "Demo allocation",
            created_at: invoice.updated_at || invoice.invoice_date || invoice.issued_at || new Date().toISOString(),
          },
        ];
  const invoiceBlock = {
    id: invoice.id || invoice.invoice_id || "demo-invoice",
    invoice_number: invoice.invoice_number || `PROFORMA-${jobNumber || orderNumber || "DEMO"}`,
    invoice_date: invoice.invoice_date || invoice.issued_at || new Date().toISOString(),
    account_number: invoice.account_number || invoice.account_id || "DEMO-ACC",
    job_number: jobNumber,
    order_number: orderNumber,
    page_count: 1,
    payment_status: paymentStatus,
    paid: paymentStatusKey === "paid",
    invoice_to: {
      name: customerName,
      lines: [customer.address || "Humphries & Parks demo customer"],
      postcode: customer.postcode || "EX1 1AA",
    },
    deliver_to: {
      name: customerName,
      lines: [customer.address || "Humphries & Parks demo customer"],
      postcode: customer.postcode || "EX1 1AA",
    },
    vehicle_details: {
      reg: job.vehicle_reg || job.reg || "DE24 XYZ",
      vehicle: job.vehicle_make_model || [job.make, job.model].filter(Boolean).join(" ") || "Demo vehicle",
      chassis: job.vehicle?.vin || "",
      engine: job.vehicle?.engine || "",
      reg_date: "",
      mileage: job.milage || job.mileage || "",
      delivery_date: job.completed_at || job.updated_at || new Date().toISOString(),
    },
    totals: {
      service_total: net,
      vat_total: vat,
      invoice_total: total,
    },
  };
  return {
    company: {
      name: "Humphries & Parks",
      address: ["Presentation Demo", "Exeter"],
      phone: "01392 555 000",
      email: "demo@hnp.example",
      vat_number: "GB000000000",
    },
    invoice: invoiceBlock,
    requests: [
      {
        request_number: 1,
        request_id: job.job_requests?.[0]?.request_id || `${job.id || "demo"}-request`,
        request_kind: "request",
        title: job.description || job.complaint || "Presentation workshop labour",
        summary: job.description || job.complaint || "Presentation workshop labour",
        labour: { hours: 1.5, rate: 85, net: 127.5, vat: 25.5 },
        parts: [
          {
            part_number: "HNP-BPAD-01",
            description: "Front brake pad set",
            qty: 1,
            price: 54.2,
            retail: 54.2,
            vat: 10.84,
            rate: 20,
          },
        ],
        totals: {
          request_total_net: net,
          request_total_vat: vat,
          request_total_gross: total,
        },
      },
    ],
    payment: {
      bank_name: "Demo Bank",
      account_name: "Humphries & Parks Demo",
      sort_code: "00-00-00",
      account_number: "00000000",
    },
    payments,
    meta: {
      isProforma: false,
      source: "invoice",
      notice: "",
      paymentStatus: invoiceBlock.payment_status,
      paymentCaptured: invoiceBlock.paid,
    },
  };
};

const invoiceDetailByPath = () => (rows, _q, parsed) => {
  const requestedId = decodeURIComponent(parsed?.pathname?.split("/").filter(Boolean).pop() || "");
  const field = parsed?.pathname?.includes("/by-order/") ? "order_number" : "job_number";
  const invoice =
    rows.find((row) => row.invoice_number === requestedId || row.invoice_id === requestedId || row.id === requestedId) ||
    rows.find((row) => row[field] === requestedId) ||
    rows[0] ||
    {};
  return { success: true, data: buildInvoiceDetailPayload(invoice, parsed) };
};

const buildHrOperationsResponse = () => {
  const today = new Date().toISOString().slice(0, 10);
  const employees = getMockRows("hr_employees").map((employee, index) => ({
    ...employee,
    userId: index + 1,
    name: employee.full_name,
    emergencyContact: "Demo Contact, 07700 800099, Family",
    hourlyRate: 18.5,
    overtimeRate: 27.75,
  }));
  return {
    success: true,
    data: {
      hrDashboardMetrics: { headcount: employees.length, active: employees.length, leaveToday: 1, trainingDue: 2 },
      upcomingAbsences: getMockRows("hr_leave"),
      activeWarnings: [],
      departmentPerformance: [],
      trainingRenewals: getMockRows("hr_training"),
      employeeDirectory: employees,
      attendanceLogs: employees.flatMap((employee) => [
        { id: `${employee.id}-att-1`, employeeId: employee.id, userId: employee.userId, date: today, clockIn: `${today}T08:00:00.000Z`, clockOut: `${today}T16:30:00.000Z`, totalHours: 8, status: "On Time", type: "Weekday" },
        { id: `${employee.id}-att-2`, employeeId: employee.id, userId: employee.userId, date: today, clockIn: `${today}T17:00:00.000Z`, clockOut: `${today}T19:00:00.000Z`, totalHours: 2, status: "Overtime", type: "Overtime" },
      ]),
      absenceRecords: getMockRows("hr_leave"),
      overtimeSummaries: employees.map((employee) => ({ id: employee.userId, userId: employee.userId, overtimeRate: 27.75, bonus: 0, status: "In Progress" })),
      payRateHistory: [],
      leaveRequests: getMockRows("hr_leave"),
      leaveBalances: employees.map((employee) => ({ employeeId: employee.id, remaining: 18, used: 7, taken: 7, entitlement: 25 })),
      performanceReviews: [],
      staffVehicles: getMockRows("staff_vehicles"),
    },
  };
};

const partsOrdersList = () => (rows, q) => {
  const page = paginate(rows, q);
  return { success: true, orders: page.data, data: page.data, pagination: page.pagination, count: rows.length };
};

const partsOrderSingle = () => (rows) => ({ success: true, order: rows[0] || null, data: rows[0] || null });

const partsDeliveriesList = () => (rows, q) => {
  const page = paginate(rows, q);
  return { success: true, deliveries: page.data, data: page.data, pagination: page.pagination, count: rows.length };
};

// Date helpers for building demo profile data relative to the live demo date,
// so attendance always lands inside the current 26th-to-25th pay period and
// every work-tab card has fresh content regardless of when the deck is shown.
const pad2 = (value) => String(value).padStart(2, "0");
const isoDate = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const shiftDate = (baseDate, days) => {
  const next = new Date(baseDate);
  next.setDate(baseDate.getDate() + days);
  return isoDate(next);
};

const buildProfileResponse = () => {
  const user = (getMockRows("users") || [])[0] || {};
  const employee = (getMockRows("hr_employees") || [])[0] || {};
  const profile = {
    id: employee.id || "demo-emp-001",
    userId: user.user_id || 1,
    employeeNumber: employee.employee_number || "EMP-1042",
    name: employee.full_name || user.display_name || "Demo Manager",
    email: employee.email || user.email || "demo.manager@hnp.example",
    phone: employee.phone || "07700 800142",
    jobTitle: employee.job_title || "Service Manager",
    department: employee.department || user.department || "Service",
    status: employee.status || "Active",
    startDate: employee.start_date || "2021-09-06",
    address: "14 Brookfield Road, Exeter, EX4 6QP",
    hourlyRate: 22.5,
    overtimeRate: 27.75,
    contractedWeeklyHours: 40,
    emergencyContact: "Janet Maddox, 07700 900611, Spouse",
  };

  const at = (dateStr, time) => `${dateStr}T${time}:00.000Z`;
  const now = new Date();

  // Generate ~4 weeks of attendance: a weekday shift each working day, the
  // odd Saturday shift, and a logged/auto overtime block every third weekday.
  const attendanceLogs = [];
  let overtimeCounter = 0;
  for (let offset = 27; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - offset);
    const dateStr = isoDate(day);
    const dow = day.getDay(); // 0 Sun … 6 Sat
    const isToday = offset === 0;
    const base = {
      employeeId: profile.userId,
      userId: profile.userId,
      date: dateStr,
    };

    if (dow === 0 || dow === 6) {
      if (dow === 6 && offset % 2 === 0) {
        attendanceLogs.push({
          ...base,
          id: `demo-att-${dateStr}-wknd`,
          clockIn: at(dateStr, "08:30"),
          clockOut: at(dateStr, "13:00"),
          totalHours: 4.5,
          status: "Weekend",
          type: "Weekend",
          origin: "manual",
        });
      }
      continue;
    }

    if (isToday) {
      // Today is still clocked in — renders the "Active" badge.
      attendanceLogs.push({
        ...base,
        id: `demo-att-${dateStr}-day`,
        clockIn: at(dateStr, "08:00"),
        clockOut: null,
        totalHours: 0,
        status: "Active",
        type: "Weekday",
        origin: "manual",
      });
      continue;
    }

    attendanceLogs.push({
      ...base,
      id: `demo-att-${dateStr}-day`,
      clockIn: at(dateStr, "08:00"),
      clockOut: at(dateStr, "16:30"),
      totalHours: 8,
      status: "On Time",
      type: "Weekday",
      origin: "manual",
    });
    if (overtimeCounter % 3 === 1) {
      const autoLogged = overtimeCounter % 2 === 0;
      attendanceLogs.push({
        ...base,
        id: `demo-att-${dateStr}-ot`,
        clockIn: at(dateStr, "16:45"),
        clockOut: at(dateStr, "19:15"),
        totalHours: 2.5,
        status: "Overtime",
        type: "Overtime",
        origin: autoLogged ? "auto" : "manual",
      });
    }
    overtimeCounter += 1;
  }
  // Newest first so the history tables read most-recent-down.
  attendanceLogs.reverse();

  return {
    success: true,
    data: {
      profile,
      attendanceLogs,
      overtimeSummary: {
        id: profile.userId,
        userId: profile.userId,
        overtimeRate: 27.75,
        bonus: 145,
        status: "In Progress",
      },
      leaveBalance: {
        employeeId: profile.id,
        entitlement: 25,
        used: 11,
        taken: 11,
        remaining: 14,
      },
      leaveRequests: [
        {
          id: "demo-leave-001",
          status: "Approved",
          type: "Holiday",
          startDate: shiftDate(now, -24),
          endDate: shiftDate(now, -22),
          totalDays: 3,
          requestNotes: "Family trip away — cover arranged with the workshop team.",
        },
        {
          id: "demo-leave-002",
          status: "Pending",
          type: "Holiday",
          startDate: shiftDate(now, 21),
          endDate: shiftDate(now, 25),
          totalDays: 5,
          requestNotes: "Summer holiday — awaiting manager sign-off.",
        },
        {
          id: "demo-leave-003",
          status: "Declined",
          type: "Unpaid",
          startDate: shiftDate(now, -12),
          endDate: shiftDate(now, -11),
          totalDays: 2,
          requestNotes: "Personal appointment.",
          declineReason:
            "Clashes with the MOT bay being short-staffed that week — please rebook.",
        },
        {
          id: "demo-leave-004",
          status: "Approved",
          type: "Sick",
          startDate: shiftDate(now, -6),
          endDate: shiftDate(now, -6),
          totalDays: 1,
          requestNotes: "Off with a 24-hour bug — GP note on file.",
        },
        {
          id: "demo-leave-005",
          status: "Approved",
          type: "Holiday",
          startDate: shiftDate(now, -48),
          endDate: shiftDate(now, -46),
          totalDays: 3,
          requestNotes: "Long weekend — booked well in advance.",
        },
        {
          id: "demo-leave-006",
          status: "Pending",
          type: "Compassionate",
          startDate: shiftDate(now, 9),
          endDate: shiftDate(now, 9),
          totalDays: 1,
          requestNotes: "Family commitment — flexible on the exact day if needed.",
        },
      ],
      staffVehicles: [
        {
          id: "demo-staff-veh-001",
          userId: profile.userId,
          make: "Ford",
          model: "Focus ST",
          registration: "EX21 HNP",
          vin: "WF0AXXGCBAAA12345",
          colour: "Magnetic Grey",
          payrollDeductionEnabled: true,
          payrollDeductionReference: "STAFF-CAR-014",
          history: [
            {
              id: "demo-veh-hist-001",
              description: "Full service + MOT",
              recordedAt: shiftDate(now, -40),
              deductFromPayroll: true,
              cost: 245.0,
            },
            {
              id: "demo-veh-hist-002",
              description: "Front brake pads & discs replaced",
              recordedAt: shiftDate(now, -110),
              deductFromPayroll: true,
              cost: 312.5,
            },
          ],
        },
        {
          id: "demo-staff-veh-002",
          userId: profile.userId,
          make: "Volkswagen",
          model: "Golf Match",
          registration: "WK19 PRK",
          vin: "WVWZZZ1KZAW000111",
          colour: "Pure White",
          payrollDeductionEnabled: false,
          payrollDeductionReference: "",
          history: [
            {
              id: "demo-veh-hist-003",
              description: "Air-conditioning re-gas",
              recordedAt: shiftDate(now, -70),
              deductFromPayroll: false,
              cost: 89.99,
            },
          ],
        },
        {
          id: "demo-staff-veh-003",
          userId: profile.userId,
          make: "Toyota",
          model: "Yaris Hybrid",
          registration: "EX70 HNP",
          vin: "JTDKB20U093000222",
          colour: "Tokyo Red",
          payrollDeductionEnabled: true,
          payrollDeductionReference: "STAFF-CAR-031",
          history: [
            {
              id: "demo-veh-hist-004",
              description: "Hybrid battery health check",
              recordedAt: shiftDate(now, -20),
              deductFromPayroll: true,
              cost: 60.0,
            },
            {
              id: "demo-veh-hist-005",
              description: "Four-wheel alignment",
              recordedAt: shiftDate(now, -130),
              deductFromPayroll: true,
              cost: 75.0,
            },
          ],
        },
      ],
      staffVehiclePayrollDeductions: [
        {
          id: "demo-veh-deduction-001",
          vehicleId: "demo-staff-veh-001",
          userId: profile.userId,
          label: "Staff car scheme — Focus ST",
          amount: 145.0,
          frequency: "monthly",
          reference: "STAFF-CAR-014",
        },
        {
          id: "demo-veh-deduction-002",
          vehicleId: "demo-staff-veh-003",
          userId: profile.userId,
          label: "Staff car scheme — Yaris Hybrid",
          amount: 110.0,
          frequency: "monthly",
          reference: "STAFF-CAR-031",
        },
      ],
    },
  };
};

const formatConsumableRequestRows = (rows = []) =>
  rows.map((row) => ({
    id: row.id,
    itemName: row.itemName || row.item_name || row.name || "Consumable",
    quantity: toNumber(row.quantity ?? row.estimated_quantity ?? row.on_hand),
    requestedById: row.requestedById ?? row.requested_by ?? null,
    requestedByName: row.requestedByName || row.requested_by_name || "Demo Workshop",
    status: row.status || "pending",
    requestedAt: row.requestedAt || row.requested_at || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || null,
  }));

const buildConsumableFinancialSummary = () => {
  const orders = getMockRows("workshop_consumable_orders") || [];
  const consumables = getMockRows("workshop_consumables") || [];
  const budget = (getMockRows("workshop_consumable_budgets") || [])[0] || {};
  const monthSpend = orders.reduce(
    (sum, order) => sum + (toNumber(order.total_value) || toNumber(order.quantity) * toNumber(order.unit_cost)),
    0
  );
  const projectedSpend = consumables.reduce(
    (sum, row) => sum + toNumber(row.estimated_quantity) * toNumber(row.unit_cost),
    0
  );
  return {
    monthSpend,
    projectedSpend,
    monthlyBudget: toNumber(budget.monthly_budget) || 1200,
    budgetUpdatedAt: budget.updated_at || null,
  };
};

const formatConsumableOrderRows = (rows = []) =>
  rows.map((row) => ({
    id: row.order_id || row.id,
    date: row.order_date || row.date || row.created_at,
    quantity: toNumber(row.quantity),
    unitCost: toNumber(row.unit_cost ?? row.unitCost),
    totalValue: toNumber(row.total_value ?? row.totalValue) || toNumber(row.quantity) * toNumber(row.unit_cost ?? row.unitCost),
    supplier: row.supplier || null,
    itemName: row.consumable?.item_name || row.itemName || row.item_name || null,
  }));

const buildConsumableLogsResponse = (rows = []) => {
  const orders = formatConsumableOrderRows(rows);
  const summary = orders.reduce(
    (acc, row) => {
      acc.spend += toNumber(row.totalValue);
      acc.quantity += toNumber(row.quantity);
      acc.orders += 1;
      if (row.supplier) acc.suppliers.add(row.supplier);
      return acc;
    },
    { spend: 0, quantity: 0, orders: 0, suppliers: new Set() }
  );
  return {
    success: true,
    data: {
      orders,
      summary: {
        spend: summary.spend,
        quantity: summary.quantity,
        orders: summary.orders,
        suppliers: summary.suppliers.size,
      },
    },
  };
};

// /api/job-cards/<jobNumber>/share-link — GET returns the customer VHC bundle
// the public share / customer pages render; non-GET returns a fresh share URL.
const shareLinkResponse = (rows, _q, _parsed, ctx = {}) => {
  if (ctx.method && ctx.method !== "GET") {
    return { success: true, data: { url: "https://demo.invalid/share/ABCD" } };
  }
  const job = rows[0] || {};
  const customer = job.vehicle?.customer || {};
  return {
    success: true,
    jobData: {
      ...job,
      customer: {
        firstname: customer.firstname || "Demo",
        lastname: customer.lastname || "Customer",
        email: customer.email || "customer@demo.invalid",
        mobile: customer.mobile || "07700 900000",
      },
      job_files: [],
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
};

// /api/privacy/me — profile + consent + data-rights summary for /profile/privacy.
const buildWebsiteProfileResponse = () => {
  const customers = getMockRows("customers") || [];
  const customerRow = customers[0] || {};
  const customerId = customerRow.id || "demo-cust-001";
  const vehicles = (getMockRows("vehicles") || [])
    .filter((row) => row.customer_id === customerId)
    .map((row) => ({
      ...row,
      vehicle_id: row.vehicle_id || row.id,
      reg_number: row.reg_number || row.registration || row.reg,
      registration: row.registration || row.reg_number || row.reg,
      make_model: row.make_model || [row.make, row.model].filter(Boolean).join(" "),
      mileage: row.mileage || 41280,
    }));
  const vehicleIds = new Set(vehicles.map((row) => row.vehicle_id || row.id));
  const jobs = (getMockRows("jobs") || [])
    .filter((row) => row.customer_id === customerId || vehicleIds.has(row.vehicle_id))
    .map((row) => ({
      ...row,
      vehicle: vehicles.find((vehicle) => vehicle.vehicle_id === row.vehicle_id) || vehicles[0] || null,
      vhc_required: row.vhc_required ?? true,
      vhc_completed_at: row.vhc_completed_at || row.completed_at || row.updated_at,
      vhc_sent_at: row.vhc_sent_at || row.updated_at,
      vehicle_reg: row.vehicle_reg || row.reg,
      vehicle_make_model: row.vehicle_make_model || [row.make, row.model].filter(Boolean).join(" "),
    }));
  const invoices = (getMockRows("invoices") || [])
    .filter((row) => row.customer_id === customerId)
    .map((row) => ({
      ...row,
      paid: String(row.payment_status || row.status || "").toLowerCase() === "paid",
      invoice_total: toNumber(row.invoice_total ?? row.grand_total ?? row.total),
    }));
  const appointments = (getMockRows("appointments") || []).filter((row) => row.customer_id === customerId);
  const activity = [
    {
      event_id: "demo-activity-service",
      activity_type: "service_update",
      activity_source: "presentation",
      activity_payload: { summary: "Service booking updated by the workshop team." },
      occurred_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      event_id: "demo-activity-vhc",
      activity_type: "vhc_sent",
      activity_source: "presentation",
      activity_payload: { summary: "Vehicle health check sent for review." },
      occurred_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
  ];
  const vhcReports = getMockRows("vhc_reports") || [];
  const vhcByJob = Object.fromEntries(
    jobs.flatMap((job) => {
      const summary = {
        red: 1,
        amber: 3,
        green: 12,
        status: "Awaiting approval",
        updated_at: job.vhc_sent_at || job.updated_at,
      };
      return [
        [job.id, summary],
        [job.job_number, summary],
      ].filter(([key]) => key != null);
    })
  );
  const vhcShareLinks = jobs.map((job, index) => {
    const report = vhcReports.find((row) => row.job_number === job.job_number) || vhcReports[index] || {};
    return {
      id: `demo-share-${job.id || job.job_number || index}`,
      job_id: job.id,
      job_number: job.job_number,
      link_code: report.link_code || "DEMO-LINK",
      created_at: job.vhc_sent_at || job.updated_at || new Date().toISOString(),
      viewed_at: null,
    };
  });

  return {
    success: true,
    customer: {
      id: customerId,
      firstname: customerRow.firstname || customerRow.first_name || "Alex",
      lastname: customerRow.lastname || customerRow.last_name || "Morgan",
      email: customerRow.email || "alex.morgan@demo.invalid",
      mobile: customerRow.mobile || customerRow.phone || "07700 900001",
      telephone: customerRow.telephone || customerRow.phone || "",
      address: customerRow.address || "12 High Street, Exeter",
      postcode: customerRow.postcode || "EX1 1AA",
      contact_preference: customerRow.contact_preference || "email",
    },
    vehicles,
    jobs,
    invoices,
    appointments,
    accounts: getMockRows("accounts") || [],
    paymentMethods: [{ id: "pm-demo-001", brand: "Visa", last4: "4242", expiry: "12/29" }],
    bookingRequests: appointments,
    jobHistory: jobs,
    vhcByJob,
    vhcDeclinations: [],
    vhcMedia: [],
    vhcShareLinks,
    transactions: invoices.map((invoice) => ({
      id: `txn-${invoice.invoice_number}`,
      invoice_number: invoice.invoice_number,
      amount: invoice.invoice_total,
      transaction_type: invoice.paid ? "payment" : "invoice",
      created_at: invoice.invoice_date || invoice.created_at,
    })),
    jobStatusHistory: activity,
    invoicePayments: [],
    vhcSendHistory: vhcReports.map((row) => ({
      ...row,
      sent_at: row.completed_at || new Date().toISOString(),
    })),
    activity,
    messages: getMockRows("messages") || [],
  };
};

const buildPrivacyMeResponse = () => {
  const user = (getMockRows("users") || [])[0] || {};
  const employee = (getMockRows("hr_employees") || [])[0] || {};
  return {
    success: true,
    profile: {
      first_name: user.first_name || "Demo",
      last_name: user.last_name || "User",
      email: user.email || "demo.user@hnp.example",
      phone: employee.phone || "07700 800001",
      role: user.role || "Demo Role",
      job_title: employee.job_title || "Demo Role",
      department: user.department || employee.department || "Demo",
      employment_type: "Full time",
      start_date: employee.start_date || "2022-04-04",
      home_address: "1 Demo Street, Exeter, EX1 1AA",
      created_at: user.created_at || "2024-01-15T09:00:00.000Z",
      password_updated_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    },
    consents: { purposes: {}, effective: {} },
    requests: getMockRows("subject_requests"),
  };
};

// Pull the thread id out of /api/messages/threads/<id>/(messages|members).
const threadIdFromPath = (parsed) => {
  const parts = parsed?.pathname?.split("/").filter(Boolean) || [];
  const threadsIndex = parts.indexOf("threads");
  return threadsIndex >= 0 ? parts[threadsIndex + 1] || null : null;
};

// GET /api/messages/threads/<id>/messages — the conversation transcript.
const threadMessagesResponse = () => (_rows, _q, parsed) => {
  const threadId = threadIdFromPath(parsed);
  return { success: true, data: messageThreadMessages[String(threadId)] || [] };
};

// GET /api/messages/threads/<id>/members — participants of a single thread.
const threadMembersResponse = () => (_rows, _q, parsed) => {
  const threadId = Number(threadIdFromPath(parsed));
  const thread = messageThreads.find((row) => row.id === threadId) || null;
  return { success: true, data: thread?.members || [] };
};

export const API_ROUTE_TABLE = [
  // Accounts / invoices / company-accounts
  { pattern: /^\/api\/accounts\/?$/, table: "accounts", transform: (rows, q) => (
    q.get("view") === "reports"
      ? accountsReportResponse(rows)
      : { success: true, ...paginate(rows, q), summary: { openCount: rows.length, frozenCount: 0, totalBalance: 0, creditExposure: 0, overdueInvoices: 0 } }
  ) },
  {
    pattern: /^\/api\/accounts\/settings\/?$/,
    table: "accounts",
    transform: () => ({
      success: true,
      data: {
        requireManagerApproval: true,
        allowManagersToFreeze: true,
        showSalesAccountsInInvoices: true,
        enableOverdueNotifications: true,
        defaultInvoiceExportFormat: "xlsx",
        defaultPageSize: 25,
      },
    }),
  },
  { pattern: /^\/api\/accounts\/[^/]+\/transactions\/?$/, table: "invoices", transform: accountTransactionsList() },
  { pattern: /^\/api\/accounts\/[^/]+\/?$/, table: "accounts", transform: accountSingle() },
  {
    pattern: /^\/api\/account\/recent-activity\/?$/,
    table: "activity_logs",
    transform: (rows) => ({
      success: true,
      events: rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurred_at,
        action: row.details || row.action,
        ip: "192.0.2.10",
        userAgent: "Chrome on Windows",
      })),
    }),
  },
  { pattern: /^\/api\/invoices\/by-job\//, table: "invoices", transform: invoiceDetailByPath() },
  { pattern: /^\/api\/invoices\/by-order\//, table: "invoices", transform: invoiceDetailByPath() },
  { pattern: /^\/api\/invoices\/create\/?$/, table: "invoices", transform: passthroughSingle() },
  { pattern: /^\/api\/invoices\/email\/?/, table: "invoices", transform: () => ({ success: true }) },
  { pattern: /^\/api\/invoices\/payments\//, table: "invoices", transform: () => ({ success: true }) },
  { pattern: /^\/api\/invoices\/proforma-overrides\/?/, table: "invoices", transform: passthroughList() },
  { pattern: /^\/api\/invoices\/share\/?/, table: "invoices", transform: passthroughSingle() },
  { pattern: /^\/api\/invoices\/?$/, table: "invoices", transform: accountInvoiceList() },
  { pattern: /^\/api\/invoices\/[^/]+\/?$/, table: "invoices", transform: passthroughSingle() },
  { pattern: /^\/api\/company-accounts\/next-number\/?$/, table: "company_accounts", transform: () => ({ success: true, data: { next: "CO-2099" } }) },
  { pattern: /^\/api\/company-accounts\/?$/, table: "company_accounts", transform: companyAccountsList() },
  { pattern: /^\/api\/company-accounts\/[^/]+\/?$/, table: "company_accounts", transform: companyAccountSingle() },

  // Payslips
  { pattern: /^\/api\/payslips\/?/, table: "payslips", transform: passthroughList() },

  // HR
  { pattern: /^\/api\/hr\/dashboard\/?$/, table: "hr_employees", transform: (rows) => ({ success: true, data: { employees: rows, attendance: getMockRows("hr_attendance"), leave: getMockRows("hr_leave"), training: getMockRows("hr_training") } }) },
  { pattern: /^\/api\/hr\/operations\/?$/, table: "hr_employees", transform: buildHrOperationsResponse },
  { pattern: /^\/api\/hr\/employees\/?$/, table: "hr_employees", transform: passthroughList() },
  { pattern: /^\/api\/hr\/employees\/[^/]+\/?$/, table: "hr_employees", transform: passthroughSingle() },
  { pattern: /^\/api\/hr\/attendance\/?/, table: "hr_attendance", transform: passthroughList() },
  { pattern: /^\/api\/hr\/leave-requests\/[^/]+\/decision\/?$/, table: "hr_leave", transform: () => ({ success: true }) },
  { pattern: /^\/api\/hr\/leave\/?/, table: "hr_leave", transform: passthroughList() },
  { pattern: /^\/api\/hr\/training-courses\/?$/, table: "hr_training", transform: passthroughList() },
  { pattern: /^\/api\/hr\/training-courses\/[^/]+\/?$/, table: "hr_training", transform: passthroughSingle() },
  { pattern: /^\/api\/hr\/training\/?/, table: "hr_training", transform: passthroughList() },

  // Parts
  { pattern: /^\/api\/parts\/allocate-to-request\/?$/, table: "parts", transform: () => ({ success: true }) },
  { pattern: /^\/api\/parts\/catalog\/?$/, table: "parts_inventory", transform: partsList() },
  { pattern: /^\/api\/parts\/catalog\/[^/]+\/?$/, table: "parts_inventory", transform: partSingle() },
  { pattern: /^\/api\/parts\/orders\/?$/, table: "parts_orders", transform: partsOrdersList() },
  { pattern: /^\/api\/parts\/orders\/[^/]+\/?$/, table: "parts_orders", transform: partsOrderSingle() },
  { pattern: /^\/api\/parts\/jobs\/search\/?$/, table: "jobs", transform: jobSearchList() },
  { pattern: /^\/api\/parts\/jobs\/?$/, table: "jobs", transform: partsJobDetails() },
  { pattern: /^\/api\/parts\/suppliers\/search\/?$/, table: "company_accounts", transform: supplierList() },
  { pattern: /^\/api\/parts\/deliveries\/add-stop\/?$/, table: "parts_deliveries", transform: () => ({ success: true }) },
  { pattern: /^\/api\/parts\/deliveries\/confirm-job\/?$/, table: "parts_deliveries", transform: () => ({ success: true }) },
  { pattern: /^\/api\/parts\/deliveries\/items\/[^/]+\/?$/, table: "parts_deliveries", transform: passthroughSingle() },
  { pattern: /^\/api\/parts\/deliveries\/[^/]+\/items\/?/, table: "parts_deliveries", transform: partsDeliveriesList() },
  { pattern: /^\/api\/parts\/deliveries\/[^/]+\/?$/, table: "parts_deliveries", transform: passthroughSingle() },
  { pattern: /^\/api\/parts\/deliveries\/?$/, table: "parts_deliveries", transform: partsDeliveriesList() },
  { pattern: /^\/api\/parts\/delivery-logs\/[^/]+\/?$/, table: "parts_deliveries", transform: passthroughSingle() },
  { pattern: /^\/api\/parts\/delivery-logs\/?$/, table: "parts_deliveries", transform: passthroughList() },
  { pattern: /^\/api\/parts\/goods-in\/items\/[^/]+\/?$/, table: "parts_goods_in", transform: goodsInSingle() },
  { pattern: /^\/api\/parts\/goods-in\/[^/]+\/(items|complete)\/?$/, table: "parts_goods_in", transform: goodsInSingle() },
  { pattern: /^\/api\/parts\/goods-in\/[^/]+\/?$/, table: "parts_goods_in", transform: goodsInSingle() },
  { pattern: /^\/api\/parts\/goods-in\/?/, table: "parts_goods_in", transform: goodsInList() },
  { pattern: /^\/api\/parts\/inventory\/[^/]+\/?$/, table: "parts_inventory", transform: partSingle() },
  { pattern: /^\/api\/parts\/inventory\/?/, table: "parts_inventory", transform: partsList() },

  // Jobs / job-cards / job-requests
  { pattern: /^\/api\/jobs\/log-activity\/?$/, table: "activity_logs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/jobs\/[^/]+\/timeline\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/jobs\/[^/]+\/?$/, table: "jobs", transform: passthroughSingle() },
  { pattern: /^\/api\/jobs\/?$/, table: "jobs", transform: passthroughList() },
  { pattern: /^\/api\/jobcards\/archive\/search\/?$/, table: "jobs", transform: passthroughList() },
  { pattern: /^\/api\/jobcards\/archive\/create\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/jobcards\/create(-vhc-item)?\/?$/, table: "jobs", transform: () => ({ success: true, data: getMockRows("jobs")[0] || null }) },
  { pattern: /^\/api\/jobcards\/link-uploaded-files\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/jobcards\/upload-document\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/jobcards\/[^/]+\/files\/?$/, table: "jobs", transform: () => ({ success: true, data: [] }) },
  { pattern: /^\/api\/jobcards\/[^/]+\/parse-checksheet\/?$/, table: "jobs", transform: () => ({ success: true, data: [] }) },
  { pattern: /^\/api\/jobcards\/[^/]+\/upload-dealer-file\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/jobcards\/[^/]+\/?$/, table: "jobs", transform: jobCardSingle() },
  { pattern: /^\/api\/job-cards\/[^/]+\/booking-request\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/job-cards\/[^/]+\/send-vhc\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/job-cards\/[^/]+\/share-link\/?$/, table: "jobs", transform: shareLinkResponse },
  { pattern: /^\/api\/job-requests\/presets\//, table: "jobs", transform: () => ({ success: true, data: [] }) },

  // Customers / vehicles / bookings
  { pattern: /^\/api\/customers\/bookings\/calendar\/?$/, table: "appointments", transform: passthroughList() },
  { pattern: /^\/api\/customers\/deliveries\/?$/, table: "parts_deliveries", transform: passthroughList() },
  { pattern: /^\/api\/customers\/?$/, table: "customers", transform: passthroughList() },
  { pattern: /^\/api\/customers\/[^/]+\/?$/, table: "customers", transform: passthroughSingle() },
  { pattern: /^\/api\/vehicles\/dvla\/?/, table: "vehicles", transform: () => ({ success: true, data: getMockRows("vehicles")[0] || null }) },
  { pattern: /^\/api\/vehicles\/?$/, table: "vehicles", transform: passthroughList() },

  // Customer portal
  { pattern: /^\/api\/customer\/payment-methods\/?$/, table: "accounts", transform: () => ({ success: true, data: [{ id: "pm-demo-001", brand: "Visa", last4: "4242", expiry: "12/29" }] }) },
  { pattern: /^\/api\/customer\/profile\/?$/, table: "customers", transform: passthroughSingle() },
  { pattern: /^\/api\/customer\/widgets\/?$/, table: "customers", transform: () => ({ success: true, data: { upcoming: getMockRows("appointments"), invoices: getMockRows("invoices") } }) },
  { pattern: /^\/api\/website\/profile\/?$/, table: "customers", transform: buildWebsiteProfileResponse },
  { pattern: /^\/api\/website\/auth\/me\/?$/, table: "customers", transform: () => ({ authenticated: false, customer: null }) },
  { pattern: /^\/api\/website\/auth\/dev-list\/?$/, table: "customers", transform: (rows) => ({ success: true, customers: rows }) },
  { pattern: /^\/api\/website\/auth\/(email-check|login|signup|set-password|update-profile|change-password|change-email|notification-prefs|logout|dev-login)\/?$/, table: "customers", transform: () => ({ success: true }) },
  { pattern: /^\/api\/website\/actions(\/.*)?\/?$/, table: "customer_activity_events", transform: () => ({ success: true }) },

  // Messages / notifications
  { pattern: /^\/api\/messages\/unread-count\/?$/, table: "messages", transform: () => ({ success: true, count: messageThreads.filter((thread) => thread.hasUnread).length }) },
  { pattern: /^\/api\/messages\/connect-customer\/?$/, table: "messages", transform: () => ({ success: true }) },
  { pattern: /^\/api\/messages\/customer-requests\/process\/?$/, table: "messages", transform: () => ({ success: true }) },
  { pattern: /^\/api\/messages\/customer-requests\/[^/]+\/?$/, table: "messages", transform: () => ({ success: true }) },
  { pattern: /^\/api\/messages\/customer-requests\/?$/, table: "messages", transform: () => ({ success: true, items: messageCustomerRequests }) },
  { pattern: /^\/api\/messages\/system-notifications\/send\/?$/, table: "messages", transform: () => ({ success: true }) },
  { pattern: /^\/api\/messages\/system-notifications\/?$/, table: "messages", transform: passthroughList() },
  { pattern: /^\/api\/messages\/threads\/[^/]+\/members\/?$/, table: "messages", transform: threadMembersResponse() },
  { pattern: /^\/api\/messages\/threads\/[^/]+\/messages\/?$/, table: "messages", transform: threadMessagesResponse() },
  { pattern: /^\/api\/messages\/threads\/?$/, table: "messages", transform: () => ({ success: true, data: messageThreads }) },
  { pattern: /^\/api\/messages\/messages\/[^/]+\/save\/?$/, table: "messages", transform: () => ({ success: true }) },
  { pattern: /^\/api\/messages\/users\/?$/, table: "messages", transform: () => ({ success: true, data: messageDirectory }) },
  { pattern: /^\/api\/messages\/?$/, table: "messages", transform: passthroughList() },

  // Mobile
  { pattern: /^\/api\/mobile\/jobs\/[^/]+\/redirect-to-workshop\/?$/, table: "jobs", transform: () => ({ success: true }) },
  { pattern: /^\/api\/mobile\/jobs\/[^/]+\/?$/, table: "jobs", transform: passthroughSingle() },
  { pattern: /^\/api\/mobile\/jobs\/?$/, table: "jobs", transform: passthroughList() },
  { pattern: /^\/api\/mobile\/parts-request\/?$/, table: "parts", transform: () => ({ success: true }) },

  // Staff / status / users / roster
  { pattern: /^\/api\/staff\/job-summary\/?$/, table: "jobs", transform: () => ({ success: true, data: { open: getMockRows("jobs").length, completed: 0 } }) },
  { pattern: /^\/api\/staff\/vehicle-history(\/sync)?\/?$/, table: "vehicles", transform: passthroughList() },
  { pattern: /^\/api\/staff\/vehicles\/?$/, table: "vehicles", transform: passthroughList() },
  { pattern: /^\/api\/status\/snapshot\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/status\/getCurrentStatus\/?$/, table: "tracking_events", transform: passthroughSingle() },
  { pattern: /^\/api\/status\/getHistory\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/status\/search\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/status\/update\/?$/, table: "tracking_events", transform: () => ({ success: true }) },
  { pattern: /^\/api\/users\/roster\/?$/, table: "users", transform: passthroughList() },

  // Tracking / clocking / appointments / activity
  { pattern: /^\/api\/tracking\/equipment\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/tracking\/next-action\/?$/, table: "tracking_events", transform: passthroughSingle() },
  { pattern: /^\/api\/tracking\/oil-stock\/?$/, table: "consumables", transform: passthroughList() },
  { pattern: /^\/api\/tracking\/snapshot\/?$/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/tracking\/?/, table: "tracking_events", transform: passthroughList() },
  { pattern: /^\/api\/clocking\/?/, table: "clocking", transform: passthroughList() },
  { pattern: /^\/api\/appointments\/?$/, table: "appointments", transform: passthroughList() },
  { pattern: /^\/api\/activity-logs\/?$/, table: "activity_logs", transform: passthroughList() },

  // VHC
  { pattern: /^\/api\/vhc\/customer-video-upload\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/vhc\/declinations\/?$/, table: "vhc_reports", transform: passthroughList() },
  { pattern: /^\/api\/vhc\/item-aliases\/?$/, table: "vhc_reports", transform: passthroughList() },
  { pattern: /^\/api\/vhc\/labour-time-overrides\/?$/, table: "vhc_reports", transform: passthroughList() },
  { pattern: /^\/api\/vhc\/labour-time-suggestions\/?$/, table: "vhc_reports", transform: passthroughList() },
  { pattern: /^\/api\/vhc\/parts-search(-learning|-suggestions)?\/?$/, table: "parts_inventory", transform: partsList() },
  { pattern: /^\/api\/vhc\/pre-pick-location\/?$/, table: "parts_inventory", transform: passthroughSingle() },
  { pattern: /^\/api\/vhc\/share-update-item-status\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/vhc\/update-customer-description\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/vhc\/update-item-status\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/vhc\/upload-media\/?$/, table: "vhc_reports", transform: () => ({ success: true }) },
  { pattern: /^\/api\/vhc\//, table: "vhc_reports", transform: passthroughList() },

  // Workshop / consumables
  { pattern: /^\/api\/workshop\/consumables\/financials\/?$/, table: "workshop_consumables", transform: () => ({ success: true, data: buildConsumableFinancialSummary() }) },
  { pattern: /^\/api\/workshop\/consumables\/items\/?$/, table: "workshop_consumables", transform: passthroughList() },
  { pattern: /^\/api\/workshop\/consumables\/logs\/?$/, table: "workshop_consumable_orders", transform: buildConsumableLogsResponse },
  { pattern: /^\/api\/workshop\/consumables\/requests\/?$/, table: "workshop_consumable_requests", transform: (rows) => ({ success: true, data: formatConsumableRequestRows(rows) }) },
  { pattern: /^\/api\/workshop\/consumables\/stock-check\/?$/, table: "workshop_consumables", transform: passthroughList() },

  // Admin / compliance / settings / welcome-quote / dev-showcase
  { pattern: /^\/api\/admin\/users\/?$/, table: "users", transform: passthroughList() },
  { pattern: /^\/api\/admin\/compliance\/breaches\/?$/, table: "breach_records", transform: (rows) => ({ success: true, breaches: rows }) },
  { pattern: /^\/api\/admin\/compliance\/dpias\/?$/, table: "dpia_records", transform: (rows) => ({ success: true, dpias: rows }) },
  { pattern: /^\/api\/admin\/compliance\/retention\/?$/, table: "retention_policies", transform: (rows) => ({ success: true, policies: rows, recentRuns: getMockRows("retention_runs") }) },
  { pattern: /^\/api\/admin\/compliance\/ropa\/?$/, table: "processing_activities", transform: (rows) => ({ success: true, activities: rows }) },
  { pattern: /^\/api\/admin\/compliance\/sars\/?$/, table: "subject_requests", transform: (rows) => ({ success: true, requests: rows }) },
  { pattern: /^\/api\/admin\/compliance\//, table: "activity_logs", transform: passthroughList() },
  {
    pattern: /^\/api\/settings\/company-profile\/?$/,
    table: "users",
    transform: () => ({
      success: true,
      data: {
        company_name: "Humphries & Parks (Demo)",
        address_line1: "Matford Park Road",
        address_line2: "Marsh Barton",
        city: "Exeter",
        postcode: "EX2 8FD",
        phone_service: "01392 555 010",
        phone_parts: "01392 555 020",
        website: "https://demo.humphriesandparks.example",
        bank_name: "Demo Bank",
        sort_code: "20-00-00",
        account_number: "12345678",
        account_name: "Humphries & Parks Demo Ltd",
        payment_reference_hint: "Use invoice number or account number as the payment reference.",
      },
    }),
  },
  { pattern: /^\/api\/welcome-quote\/?$/, table: "users", transform: () => ({ success: true, data: { quote: "Welcome to the demo. Every figure shown here is mock data." } }) },
  { pattern: /^\/api\/dev\/showcase-notes\/?$/, table: "notes", transform: passthroughList() },

  // AI helpers — no-op success so UI doesn't error
  { pattern: /^\/api\/ai\//, table: "notes", transform: () => ({ success: true, data: { text: "" } }) },

  // Notes / consent / cookies / email
  { pattern: /^\/api\/notes\/?/, table: "notes", transform: passthroughList() },
  { pattern: /^\/api\/(consent|cookies\/consent)\/?$/, table: "users", transform: () => ({ success: true }) },
  { pattern: /^\/api\/email-api\/?/, table: "users", transform: () => ({ success: true }) },
  { pattern: /^\/api\/location\//, table: "users", transform: () => ({ success: true, data: { minutes: 12 } }) },
  { pattern: /^\/api\/profile\/me\/?$/, table: "users", transform: buildProfileResponse },
  { pattern: /^\/api\/privacy\/me\/?$/, table: "users", transform: buildPrivacyMeResponse },
  // Personal dashboard (passcode-locked /profile tab).
  { pattern: /^\/api\/personal\/security\/?$/, table: "users", transform: personalSecurityResponse },
  { pattern: /^\/api\/personal\/state\/?$/, table: "users", transform: () => ({ success: true, data: buildPresentationPersonalState() }) },
];

export function resolveApiRoute(pathname) {
  for (const entry of API_ROUTE_TABLE) {
    if (entry.pattern.test(pathname)) return entry;
  }
  return null;
}

export function buildMockApiResponse(url, method = "GET", requestBody = null) {
  let parsed;
  try {
    parsed = new URL(url, "http://localhost");
  } catch {
    return { status: 200, body: { success: true, data: [] } };
  }
  const entry = resolveApiRoute(parsed.pathname);
  // 4th transform arg carries request context for routes that branch on the
  // HTTP method or a JSON payload (e.g. /api/personal/security).
  const ctx = { body: requestBody, method };

  if (method !== "GET") {
    if (!entry) {
      if (typeof console !== "undefined") {
        console.warn(`[presentation] non-GET ${method} ${parsed.pathname} — returning success no-op`);
      }
      return { status: 200, body: { success: true, data: null } };
    }
    const rows = getMockRows(entry.table) || [];
    const body = entry.transform ? entry.transform(rows, parsed.searchParams, parsed, ctx) : { success: true, data: null };
    return { status: 200, body };
  }

  if (!entry) {
    if (typeof console !== "undefined") {
      console.warn(`[presentation] no mock for ${parsed.pathname}; returning empty list`);
    }
    return { status: 200, body: { success: true, data: [], pagination: { page: 1, pageSize: 0, total: 0 } } };
  }

  const rows = getMockRows(entry.table) || [];
  const body = entry.transform ? entry.transform(rows, parsed.searchParams, parsed, ctx) : { success: true, data: rows };
  return { status: 200, body };
}
