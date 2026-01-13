// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/api/search/global.js
import { supabase } from "@/lib/supabaseClient";
import { createCustomerDisplaySlug, normalizeCustomerSlug } from "@/lib/customers/slug";

import { resolveMainStatusId } from "@/lib/status/statusFlow";

const INACTIVE_STATUS_IDS = new Set(["complete", "invoiced"]);

const toTitleCase = (value) => {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const { q } = req.query;
  const term = (q || "").trim();

  if (term.length < 2) {
    return res.status(200).json({ success: true, results: [] });
  }

  try {
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
        .or(
          `job_number.ilike.%${term}%,vehicle_reg.ilike.%${term}%,vehicle_make_model.ilike.%${term}%,description.ilike.%${term}%`
        )
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("customers")
        .select(`
          id,
          firstname,
          lastname,
          email,
          mobile,
          telephone
        `)
        .or(
          `firstname.ilike.%${term}%,lastname.ilike.%${term}%,email.ilike.%${term}%,mobile.ilike.%${term}%,telephone.ilike.%${term}%`
        )
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("parts_job_cards")
        .select(`
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
        `)
        .or(
          `order_number.ilike.%${term}%,customer_name.ilike.%${term}%,vehicle_reg.ilike.%${term}%,vehicle_make.ilike.%${term}%,vehicle_model.ilike.%${term}%`
        )
        .order("created_at", { ascending: false })
        .limit(15),
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
        .or(
          `part_number.ilike.%${term}%,name.ilike.%${term}%,supplier.ilike.%${term}%,category.ilike.%${term}%,description.ilike.%${term}%`
        )
        .order("part_number", { ascending: true })
        .limit(15),
      supabase
        .from("parts_goods_in")
        .select(`
          id,
          goods_in_number,
          supplier_name,
          invoice_number,
          status,
          created_at
        `)
        .or(
          `goods_in_number.ilike.%${term}%,invoice_number.ilike.%${term}%,supplier_name.ilike.%${term}%`
        )
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    if (jobResponse.error) {
      console.error("Global search jobs error:", jobResponse.error);
      return res.status(500).json({
        success: false,
        message: "Failed to run job search",
      });
    }

    if (customerResponse.error) {
      console.error("Global search customer error:", customerResponse.error);
      return res.status(500).json({
        success: false,
        message: "Failed to run customer search",
      });
    }

    if (orderResponse.error) {
      console.error("Global search order error:", orderResponse.error);
      return res.status(500).json({
        success: false,
        message: "Failed to run parts order search",
      });
    }

    if (partResponse.error) {
      console.error("Global search part catalogue error:", partResponse.error);
      return res.status(500).json({
        success: false,
        message: "Failed to run part search",
      });
    }

    if (goodsInResponse.error) {
      console.error("Global search goods-in error:", goodsInResponse.error);
      return res.status(500).json({
        success: false,
        message: "Failed to run goods-in search",
      });
    }

    const results = [];

    (jobResponse.data || []).forEach((job) => {
      const customerName = [
        job.customer?.firstname,
        job.customer?.lastname,
      ]
        .filter(Boolean)
        .join(" ");

      results.push({
        type: "job",
        id: job.id,
        jobNumber: job.job_number,
        status: job.status,
        title: `Job #${job.job_number}`,
        subtitle: [customerName || "No customer", job.vehicle_reg || ""]
          .filter(Boolean)
          .join(" • "),
        customerId: job.customer_id,
        customerName,
        vehicleReg: job.vehicle_reg,
        vehicleMakeModel: job.vehicle_make_model,
        description: job.description,
      });
    });

    const customerIds = (customerResponse.data || []).map((customer) => customer.id);
    let jobsByCustomer = [];

    if (customerIds.length > 0) {
      const { data: customerJobsData, error: customerJobsError } = await supabase
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

      if (customerJobsError) {
        console.error("Global search customer job lookup error:", customerJobsError);
      } else {
        jobsByCustomer = customerJobsData || [];
      }
    }

    const customerJobIndex = jobsByCustomer.reduce((acc, job) => {
      const existing = acc[job.customer_id] || { latest: null, active: null };
      const jobStatusId = resolveMainStatusId(job.status);

      if (
        jobStatusId &&
        !INACTIVE_STATUS_IDS.has(jobStatusId) &&
        (!existing.active ||
          new Date(job.created_at || 0) >
            new Date(existing.active.created_at || 0))
      ) {
        existing.active = job;
      }

      if (!existing.latest) {
        existing.latest = job;
      } else {
        const existingDate = new Date(existing.latest.created_at || 0);
        const jobDate = new Date(job.created_at || 0);
        if (jobDate > existingDate) {
          existing.latest = job;
        }
      }

      acc[job.customer_id] = existing;
      return acc;
    }, {});

    (customerResponse.data || []).forEach((customer) => {
      const jobRecord = customerJobIndex[customer.id] || {};
      const preferredJob = jobRecord.active || jobRecord.latest || null;

      const fullName = [customer.firstname, customer.lastname]
        .filter(Boolean)
        .map((part) => toTitleCase(part))
        .join(" ")
        .trim();

      const contactChannel = customer.mobile || customer.telephone || "";
      const subtitleParts = [
        contactChannel,
        customer.email || "",
      ].filter(Boolean);

      const displaySlug = createCustomerDisplaySlug(
        customer.firstname || "",
        customer.lastname || ""
      );

      const result = {
        type: "customer",
        id: customer.id,
        customerId: customer.id,
        firstName: customer.firstname || "",
        lastName: customer.lastname || "",
        slug: displaySlug || null,
        slugKey: displaySlug ? normalizeCustomerSlug(displaySlug) : null,
        title: fullName || customer.email || "Unknown customer",
        subtitle: subtitleParts.join(" • "),
        contact: contactChannel || customer.email || "",
        href: displaySlug ? `/customers/${displaySlug}` : `/customers/${customer.id}`,
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
          .join(" • "),
        deliveryStatus: order.delivery_status,
        deliveryEta: order.delivery_eta,
      });
    });

    (goodsInResponse.data || []).forEach((record) => {
      const goodsInNumber = record.goods_in_number || "";
      const subtitleParts = [
        record.supplier_name || "",
        record.invoice_number ? `Invoice ${record.invoice_number}` : "",
        record.status ? toTitleCase(record.status) : "",
      ].filter(Boolean);
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
        subtitle: subtitleParts.join(" • "),
        href: `/parts/goods-in/${encodeURIComponent(goodsInQuery)}`,
      });
    });

    (partResponse.data || []).forEach((part) => {
      const partNumber = part.part_number || "";
      const baseTitle = partNumber ? `Part ${partNumber}` : part.name || "Part";
      const subtitleParts = [
        part.name && part.name !== partNumber ? part.name : "",
        part.supplier || "",
        part.category || "",
        part.storage_location ? `Bin ${part.storage_location}` : "",
      ].filter(Boolean);
      const destinationQuery = partNumber || part.name || term;

      results.push({
        type: "part",
        id: part.id,
        partNumber,
        name: part.name,
        supplier: part.supplier,
        category: part.category,
        storageLocation: part.storage_location,
        title: baseTitle,
        subtitle: subtitleParts.join(" • "),
        href: `/parts?inventorySearch=${encodeURIComponent(destinationQuery)}`,
      });
    });

    res.status(200).json({
      success: true,
      results: results.slice(0, 25),
    });
  } catch (error) {
    console.error("Global search handler error:", error);
    res.status(500).json({
      success: false,
      message: "Unexpected error performing search",
    });
  }
}
