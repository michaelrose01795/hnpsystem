// file location: src/features/presentation/mockData/website.js
// Presentation-only mock payloads for the customer-facing /website pages.
// The data is derived from the same public website source modules that the
// real /website experience uses, then shaped into the API envelopes expected
// by the page functions during presentation mode.

import { getMockRows } from "./index";
import {
  WEBSITE_PAGES,
  PAGE_CONTENT,
  MEDIA_ASSETS,
  SEO_ENTRIES,
  INITIAL_ACTIVITY,
} from "@/features/websiteManager/websiteData";
import { siteContent } from "@/features/website/data/siteContent";
import { vehicles as websiteVehicles } from "@/features/website/data/vehicles";
import { offers as websiteOffers } from "@/features/website/data/offers";
import { reviews as websiteReviews } from "@/features/website/data/reviews";
import { team as websiteTeam, teamDepartments as websiteTeamDepartments } from "@/features/website/data/team";
import { timeline as websiteTimeline } from "@/features/website/data/timeline";
import { brands as websiteBrands } from "@/features/website/data/brands";
import { blogPosts as websiteBlogPosts } from "@/features/website/data/blogPosts";

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const buildWebsiteProfileResponse = () => {
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

export const buildWebsiteContentResponse = () => ({
  success: true,
  data: {
    siteContent,
    vehicles: websiteVehicles,
    offers: websiteOffers,
    reviews: websiteReviews,
    timeline: websiteTimeline,
    blogPosts: websiteBlogPosts,
    brands: websiteBrands,
    team: websiteTeam,
    teamDepartments: websiteTeamDepartments,
  },
});

export const websitePagesResponse = () => ({
  success: true,
  data: WEBSITE_PAGES.map((page) => ({
    page_key: page.key,
    name: page.name,
    route: page.route,
    status: page.status || "published",
    last_edited_by: page.lastEditedBy || "Presentation",
    last_edited_at: page.lastEditedAt || new Date().toISOString(),
  })),
});

export const websiteSeoResponse = () => ({
  success: true,
  data: Object.entries(SEO_ENTRIES).map(([pageKey, entry]) => ({
    page_key: pageKey,
    meta_title: entry.metaTitle,
    meta_description: entry.metaDescription,
    slug: entry.slug,
    canonical: entry.canonical,
    og_image: entry.ogImage,
    indexed: entry.indexed,
    updated_by: "Presentation",
    updated_at: new Date().toISOString(),
  })),
});

export const websiteMediaResponse = () => ({
  success: true,
  data: MEDIA_ASSETS.map((asset) => ({
    id: asset.id,
    name: asset.name,
    url: asset.url,
    media_type: asset.type || "image",
    size_kb: asset.sizeKb || null,
    used_on: asset.usedOn || "",
    uploaded_by: asset.uploadedBy || "Presentation",
    uploaded_at: asset.uploadedAt || new Date().toISOString(),
  })),
});

export const websiteActivityResponse = () => ({
  success: true,
  data: INITIAL_ACTIVITY.length
    ? INITIAL_ACTIVITY
    : [
        {
          id: 1,
          occurred_at: new Date().toISOString(),
          actor: "Presentation",
          action: "Loaded website manager demo",
          target: "Public website content",
          page_key: "home",
        },
      ],
});

export const websiteSectionResponse = (_rows, _q, parsed) => {
  const parts = parsed?.pathname?.split("/").filter(Boolean) || [];
  const section = parts[parts.indexOf("sections") + 1];
  return { success: true, data: PAGE_CONTENT[section] || [] };
};
