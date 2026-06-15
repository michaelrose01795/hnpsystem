// file location: src/lib/database/globalSearch.js
import { supabase } from "@/lib/database/supabaseClient";
import { createCustomerDisplaySlug, normalizeCustomerSlug } from "@/lib/customers/slug";
import { resolveMainStatusId } from "@/lib/status/statusFlow";
import { INACTIVE_JOB_IDS } from "@/lib/status/statusHelpers";

const SEARCH_LIMIT_PER_TYPE = 15;
const RESULT_LIMIT = 25;

const SEARCH_FIELDS = {
  jobs: ["job_number", "vehicle_reg", "vehicle_make_model", "description"],
  customers: ["firstname", "lastname", "email", "mobile", "telephone"],
  orders: ["order_number", "customer_name", "vehicle_reg", "vehicle_make", "vehicle_model"],
  parts: ["part_number", "name", "supplier", "category", "description"],
  goodsIn: ["goods_in_number", "invoice_number", "supplier_name"],
};

const toTitleCase = (value) => {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const cleanForPostgrestFilter = (value) =>
  String(value || "")
    .replace(/[%,()*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normaliseText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@.+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compactText = (value) => normaliseText(value).replace(/[^a-z0-9]+/g, "");

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

const getSearchTokens = (term) =>
  normaliseText(term)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

const buildOrFilter = (fields, term) => {
  const cleanTerm = cleanForPostgrestFilter(term);
  const tokens = getSearchTokens(cleanTerm);
  const filterValues = [cleanTerm, ...tokens].filter(Boolean);
  const uniqueFilters = new Set();

  filterValues.forEach((value) => {
    fields.forEach((field) => {
      uniqueFilters.add(`${field}.ilike.%${value}%`);
    });
  });

  return Array.from(uniqueFilters).join(",");
};

const allTokensStartWords = (value, tokens) => {
  const words = normaliseText(value).split(" ").filter(Boolean);
  if (!tokens.length || !words.length) return false;
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
};

const allTokensContained = (value, tokens) => {
  const normalised = normaliseText(value);
  if (!tokens.length || !normalised) return false;
  return tokens.every((token) => normalised.includes(token));
};

const scoreName = (name, query, tokens) => {
  const normalisedName = normaliseText(name);
  const normalisedQuery = normaliseText(query);
  const compactName = compactText(name);
  const compactQuery = compactText(query);

  if (!compactName || !compactQuery) return 0;
  if (compactName === compactQuery) return 140;
  if (normalisedName.startsWith(normalisedQuery)) return 130;
  if (allTokensStartWords(name, tokens)) return 115;
  if (allTokensContained(name, tokens)) return 70;
  return 0;
};

const scoreIdentifier = (value, query, exactScore, prefixScore, containsScore) => {
  const compactValue = compactText(value);
  const compactQuery = compactText(query);

  if (!compactValue || !compactQuery) return 0;
  if (compactValue === compactQuery) return exactScore;
  if (compactValue.startsWith(compactQuery)) return prefixScore;
  if (compactValue.includes(compactQuery)) return containsScore;
  return 0;
};

export const getGlobalSearchMatchScore = (result, term) => {
  const tokens = getSearchTokens(term);
  const compactQuery = compactText(term);
  const digitQuery = digitsOnly(term);

  if (!compactQuery) return 0;

  if (result.type === "customer") {
    const nameScore = scoreName(
      [result.firstName, result.lastName].filter(Boolean).join(" ") || result.title,
      term,
      tokens
    );
    const emailScore = scoreIdentifier(result.email, term, 80, 72, 42);
    const phoneScore =
      digitQuery.length >= 3 &&
      [result.mobile, result.telephone, result.contact].some((value) =>
        digitsOnly(value).includes(digitQuery)
      )
        ? 68
        : 0;

    return Math.max(nameScore, emailScore, phoneScore);
  }

  if (result.type === "job") {
    const jobNumberScore = scoreIdentifier(result.jobNumber, term, 135, 125, 92);
    const vehicleRegScore = scoreIdentifier(result.vehicleReg, term, 130, 118, 88);
    const customerScore = scoreName(result.customerName, term, tokens);
    const vehicleScore = allTokensStartWords(result.vehicleMakeModel, tokens) ? 58 : 0;
    const descriptionScore =
      compactQuery.length >= 4 && allTokensStartWords(result.description, tokens) ? 34 : 0;

    return Math.max(
      jobNumberScore,
      vehicleRegScore,
      customerScore,
      vehicleScore,
      descriptionScore
    );
  }

  if (result.type === "parts_order") {
    return Math.max(
      scoreIdentifier(result.orderNumber, term, 125, 115, 82),
      scoreName(result.customerName, term, tokens),
      scoreIdentifier(result.vehicleReg, term, 115, 104, 76)
    );
  }

  if (result.type === "part") {
    return Math.max(
      scoreIdentifier(result.partNumber, term, 125, 115, 82),
      scoreName(result.name, term, tokens),
      allTokensStartWords(result.description, tokens) ? 48 : 0,
      allTokensStartWords(result.supplier, tokens) ? 44 : 0,
      allTokensStartWords(result.category, tokens) ? 40 : 0
    );
  }

  if (result.type === "goods_in") {
    return Math.max(
      scoreIdentifier(result.goodsInNumber, term, 125, 115, 82),
      scoreIdentifier(result.invoiceNumber, term, 108, 98, 72),
      scoreName(result.supplierName, term, tokens)
    );
  }

  return allTokensContained([result.title, result.subtitle].filter(Boolean).join(" "), tokens)
    ? 35
    : 0;
};

const stripSearchOnlyFields = (result) => {
  const cleaned = { ...result };
  ["searchTerm", "searchScore", "createdAt", "email", "mobile", "telephone", "customerName"].forEach(
    (field) => {
      delete cleaned[field];
    }
  );
  return cleaned;
};

const sortBySearchScore = (results) =>
  results
    .map((result) => ({
      ...result,
      searchScore: getGlobalSearchMatchScore(result, result.searchTerm),
    }))
    .filter((result) => result.searchScore > 0)
    .sort((left, right) => {
      if (right.searchScore !== left.searchScore) return right.searchScore - left.searchScore;
      return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
    })
    .map(stripSearchOnlyFields);

const getPreferredJobsByCustomer = async (customerIds) => {
  if (!customerIds.length) return {};

  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
        id,
        job_number,
        status,
        customer_id,
        vehicle_reg,
        vehicle_make_model,
        created_at
      `
    )
    .in("customer_id", customerIds);

  if (error) {
    console.error("Global search customer job lookup error:", error);
    return {};
  }

  return (data || []).reduce((acc, job) => {
    const existing = acc[job.customer_id] || { latest: null, active: null };
    const jobStatusId = resolveMainStatusId(job.status);

    if (
      jobStatusId &&
      !INACTIVE_JOB_IDS.has(jobStatusId) &&
      (!existing.active || new Date(job.created_at || 0) > new Date(existing.active.created_at || 0))
    ) {
      existing.active = job;
    }

    if (!existing.latest || new Date(job.created_at || 0) > new Date(existing.latest.created_at || 0)) {
      existing.latest = job;
    }

    acc[job.customer_id] = existing;
    return acc;
  }, {});
};

export const searchGlobalRecords = async (term) => {
  const cleanTerm = cleanForPostgrestFilter(term);

  if (cleanTerm.length < 2) return [];

  const [jobResponse, customerResponse, orderResponse, partResponse, goodsInResponse] =
    await Promise.all([
      supabase
        .from("jobs")
        .select(
          `
            id,
            job_number,
            status,
            description,
            customer_id,
            vehicle_reg,
            vehicle_make_model,
            created_at,
            customer:customer_id(
              firstname,
              lastname,
              mobile,
              telephone,
              email
            )
          `
        )
        .or(buildOrFilter(SEARCH_FIELDS.jobs, cleanTerm))
        .order("created_at", { ascending: false })
        .limit(SEARCH_LIMIT_PER_TYPE),
      supabase
        .from("customers")
        .select(
          `
          id,
          firstname,
          lastname,
          email,
          mobile,
          telephone,
          created_at
        `
        )
        .or(buildOrFilter(SEARCH_FIELDS.customers, cleanTerm))
        .order("created_at", { ascending: false })
        .limit(SEARCH_LIMIT_PER_TYPE),
      supabase
        .from("parts_order_cards")
        .select(
          `
          id,
          order_number,
          status,
          customer_name,
          customer_phone,
          customer_email,
          vehicle_reg,
          vehicle_make,
          vehicle_model,
          delivery_type,
          delivery_status,
          delivery_eta,
          delivery_window,
          created_at
        `
        )
        .or(buildOrFilter(SEARCH_FIELDS.orders, cleanTerm))
        .order("created_at", { ascending: false })
        .limit(SEARCH_LIMIT_PER_TYPE),
      supabase
        .from("parts_catalog")
        .select(
          `
          id,
          part_number,
          name,
          description,
          supplier,
          category,
          storage_location,
          unit_price,
          unit_cost
        `
        )
        .or(buildOrFilter(SEARCH_FIELDS.parts, cleanTerm))
        .order("part_number", { ascending: true })
        .limit(SEARCH_LIMIT_PER_TYPE),
      supabase
        .from("parts_goods_in")
        .select(
          `
          id,
          goods_in_number,
          supplier_name,
          invoice_number,
          status,
          created_at
        `
        )
        .or(buildOrFilter(SEARCH_FIELDS.goodsIn, cleanTerm))
        .order("created_at", { ascending: false })
        .limit(SEARCH_LIMIT_PER_TYPE),
    ]);

  const responses = [
    ["job", jobResponse],
    ["customer", customerResponse],
    ["parts order", orderResponse],
    ["part catalogue", partResponse],
    ["goods-in", goodsInResponse],
  ];

  const failed = responses.find(([, response]) => response.error);
  if (failed) {
    const [label, response] = failed;
    console.error(`Global search ${label} error:`, response.error);
    throw new Error(`Failed to run ${label} search`);
  }

  const results = [];

  (jobResponse.data || []).forEach((job) => {
    const customerName = [job.customer?.firstname, job.customer?.lastname].filter(Boolean).join(" ");

    results.push({
      type: "job",
      id: job.id,
      jobNumber: job.job_number,
      status: job.status,
      title: `Job #${job.job_number}`,
      subtitle: [customerName || "No customer", job.vehicle_reg || ""].filter(Boolean).join(" - "),
      customerId: job.customer_id,
      customerName,
      vehicleReg: job.vehicle_reg,
      vehicleMakeModel: job.vehicle_make_model,
      description: job.description,
      createdAt: job.created_at,
      searchTerm: term,
    });
  });

  const customerIds = (customerResponse.data || []).map((customer) => customer.id);
  const customerJobIndex = await getPreferredJobsByCustomer(customerIds);

  (customerResponse.data || []).forEach((customer) => {
    const jobRecord = customerJobIndex[customer.id] || {};
    const preferredJob = jobRecord.active || jobRecord.latest || null;
    const fullName = [customer.firstname, customer.lastname]
      .filter(Boolean)
      .map((part) => toTitleCase(part))
      .join(" ")
      .trim();
    const contactChannel = customer.mobile || customer.telephone || "";
    const displaySlug = createCustomerDisplaySlug(customer.firstname || "", customer.lastname || "");

    const result = {
      type: "customer",
      id: customer.id,
      customerId: customer.id,
      firstName: customer.firstname || "",
      lastName: customer.lastname || "",
      slug: displaySlug || null,
      slugKey: displaySlug ? normalizeCustomerSlug(displaySlug) : null,
      title: fullName || customer.email || "Unknown customer",
      subtitle: [contactChannel, customer.email || ""].filter(Boolean).join(" - "),
      contact: contactChannel || customer.email || "",
      href: displaySlug ? `/customers/${displaySlug}` : `/customers/${customer.id}`,
      email: customer.email || "",
      mobile: customer.mobile || "",
      telephone: customer.telephone || "",
      createdAt: customer.created_at,
      searchTerm: term,
    };

    if (preferredJob) {
      result.jobNumber = preferredJob.job_number || null;
      result.jobStatus = preferredJob.status || null;
      result.vehicleReg = preferredJob.vehicle_reg || "";
      result.vehicleMakeModel = preferredJob.vehicle_make_model || "";
    }

    results.push(result);
  });

  (orderResponse.data || []).forEach((order) => {
    const orderNumber = (order.order_number || "").toUpperCase();

    results.push({
      type: "parts_order",
      id: order.id,
      orderNumber,
      status: order.status,
      title: `Order ${orderNumber}`,
      subtitle: [
        order.customer_name || order.customer_email || "Parts order",
        order.vehicle_reg || "",
        order.delivery_type ? order.delivery_type.toUpperCase() : "",
      ]
        .filter(Boolean)
        .join(" - "),
      deliveryStatus: order.delivery_status,
      deliveryEta: order.delivery_eta,
      customerName: order.customer_name || "",
      vehicleReg: order.vehicle_reg || "",
      createdAt: order.created_at,
      searchTerm: term,
    });
  });

  (goodsInResponse.data || []).forEach((record) => {
    const goodsInNumber = record.goods_in_number || "";
    const goodsInQuery = goodsInNumber || record.id;

    results.push({
      type: "goods_in",
      id: record.id,
      goodsInId: record.id,
      goodsInNumber,
      status: record.status,
      supplierName: record.supplier_name || "",
      invoiceNumber: record.invoice_number || "",
      title: goodsInNumber ? `Goods In ${goodsInNumber}` : "Goods In Receipt",
      subtitle: [
        record.supplier_name || "",
        record.invoice_number ? `Invoice ${record.invoice_number}` : "",
        record.status ? toTitleCase(record.status) : "",
      ]
        .filter(Boolean)
        .join(" - "),
      href: `/goods-in/${encodeURIComponent(goodsInQuery)}`,
      createdAt: record.created_at,
      searchTerm: term,
    });
  });

  (partResponse.data || []).forEach((part) => {
    const partNumber = part.part_number || "";
    const destinationQuery = partNumber || part.name || term;

    results.push({
      type: "part",
      id: part.id,
      partNumber,
      name: part.name,
      supplier: part.supplier,
      category: part.category,
      storageLocation: part.storage_location,
      title: partNumber ? `Part ${partNumber}` : part.name || "Part",
      subtitle: [
        part.name && part.name !== partNumber ? part.name : "",
        part.supplier || "",
        part.category || "",
        part.storage_location ? `Bin ${part.storage_location}` : "",
      ]
        .filter(Boolean)
        .join(" - "),
      href: `/parts?inventorySearch=${encodeURIComponent(destinationQuery)}`,
      description: part.description,
      searchTerm: term,
    });
  });

  return sortBySearchScore(results).slice(0, RESULT_LIMIT);
};
