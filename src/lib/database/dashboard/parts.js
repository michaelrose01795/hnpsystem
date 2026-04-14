import dayjs from "dayjs";
import { supabase } from "@/lib/database/supabaseClient";
import { buildSevenDaySeries, runQuery } from "@/lib/database/dashboard/utils";

export const getPartsDashboardData = async () => {
  const weekStart = dayjs().subtract(6, "day").startOf("day").toISOString();

  const [requestsData, jobItemsData, deliveryItems, catalogData, recentRequests, trendRows, jobItemTrendRows] = await Promise.all([
    runQuery(() =>
      supabase
        .from("parts_requests")
        .select("request_id,job_id,part_id,status,pre_pick_location,fulfilled_by,created_at")
        .order("created_at", { ascending: false })
    ),
    runQuery(() => // Active allocations from parts_job_items (primary source of truth).
      supabase
        .from("parts_job_items")
        .select("id,job_id,status,pre_pick_location,source_request_id,created_at")
        .order("created_at", { ascending: false })
    ),
    runQuery(() =>
      supabase
        .from("parts_delivery_items")
        .select("id,delivery_id,status,quantity_ordered,quantity_received")
        .neq("status", "cancelled")
    ),
    runQuery(() =>
      supabase
        .from("parts_catalog")
        .select("id,name,part_number,qty_in_stock,reorder_level,qty_on_order")
        .order("qty_in_stock", { ascending: true })
        .limit(10)
    ),
    runQuery(() =>
      supabase
        .from("parts_requests")
        .select("request_id,job_id,part_id,status,fulfilled_by,created_at")
        .order("created_at", { ascending: false })
        .limit(5)
    ),
    runQuery(() =>
      supabase
        .from("parts_requests")
        .select("created_at")
        .gte("created_at", weekStart)
    ),
    runQuery(() => // Job item trend for merged activity chart.
      supabase
        .from("parts_job_items")
        .select("created_at")
        .gte("created_at", weekStart)
    ),
  ]);

  // Unfulfilled requests: tech requests not yet linked to a parts_job_items allocation.
  const unfulfilledRequests = (requestsData || []).filter((req) => !req.fulfilled_by);

  // Combined status counts from parts_job_items (primary) + unfulfilled requests.
  const jobItemsByStatus = (jobItemsData || []).reduce((acc, item) => {
    const status = (item.status || "pending").trim();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const unfulfilledByStatus = unfulfilledRequests.reduce((acc, request) => {
    const status = (request.status || "pending").trim();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // Merge status counts, preferring job_items as primary.
  const mergedByStatus = { ...jobItemsByStatus };
  Object.entries(unfulfilledByStatus).forEach(([status, count]) => {
    mergedByStatus[status] = (mergedByStatus[status] || 0) + count;
  });

  const delayedOrders = (deliveryItems || []).filter(
    (item) => Number(item.quantity_received || 0) < Number(item.quantity_ordered || 0)
  ).length;

  // Pre-picked count from parts_job_items (the table that actually tracks pre-pick locations).
  const prePicked = (jobItemsData || []).filter((item) => Boolean(item.pre_pick_location)).length;

  const stockAlerts = (catalogData || [])
    .map((part) => ({
      id: part.id,
      label: part.name || part.part_number || "Part",
      inStock: Number(part.qty_in_stock) || 0,
      reorderLevel: Number(part.reorder_level) || 0,
    }))
    .sort((a, b) => a.inStock - b.inStock)
    .slice(0, 5);

  // Merge trend data from both tables for the activity chart.
  const allTrendRows = [...(trendRows || []), ...(jobItemTrendRows || [])];

  return {
    requestSummary: {
      totalRequests: (jobItemsData || []).length + unfulfilledRequests.length, // Total active parts activity.
      totalAllocations: (jobItemsData || []).length, // Actual allocations in parts_job_items.
      unfulfilledRequests: unfulfilledRequests.length, // Tech requests awaiting fulfillment.
      partsOnOrder: (catalogData || []).reduce((total, part) => total + (Number(part.qty_on_order) || 0), 0),
      prePicked,
      delayedOrders,
    },
    stockAlerts,
    requestsByStatus: Object.entries(mergedByStatus).map(([status, count]) => ({ status, count })),
    recentRequests,
    trend: buildSevenDaySeries(allTrendRows, "created_at"),
  };
};
