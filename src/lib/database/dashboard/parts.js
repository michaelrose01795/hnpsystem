import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";
import { buildSevenDaySeries, runQuery } from "@/lib/database/dashboard/utils";

export const getPartsDashboardData = async () => {
  const weekStart = dayjs().subtract(6, "day").startOf("day").toISOString();

  const [requestsData, deliveryItems, catalogData, recentRequests, trendRows] = await Promise.all([
    runQuery(() =>
      supabase
        .from("parts_requests")
        .select("request_id,job_id,part_id,status,pre_pick_location,created_at")
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
        .select("request_id,job_id,part_id,status,created_at")
        .order("created_at", { ascending: false })
        .limit(5)
    ),
    runQuery(() =>
      supabase
        .from("parts_requests")
        .select("created_at")
        .gte("created_at", weekStart)
    ),
  ]);

  const requestsByStatus = (requestsData || []).reduce((acc, request) => {
    const status = (request.status || "pending").trim();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const delayedOrders = (deliveryItems || []).filter(
    (item) => Number(item.quantity_received || 0) < Number(item.quantity_ordered || 0)
  ).length;

  const prePicked = (requestsData || []).filter((request) => Boolean(request.pre_pick_location)).length;

  const stockAlerts = (catalogData || [])
    .map((part) => ({
      id: part.id,
      label: part.name || part.part_number || "Part",
      inStock: Number(part.qty_in_stock) || 0,
      reorderLevel: Number(part.reorder_level) || 0,
    }))
    .sort((a, b) => a.inStock - b.inStock)
    .slice(0, 5);

  return {
    requestSummary: {
      totalRequests: requestsData.length,
      partsOnOrder: (catalogData || []).reduce((total, part) => total + (Number(part.qty_on_order) || 0), 0),
      prePicked,
      delayedOrders,
    },
    stockAlerts,
    requestsByStatus: Object.entries(requestsByStatus).map(([status, count]) => ({ status, count })),
    recentRequests,
    trend: buildSevenDaySeries(trendRows, "created_at"),
  };
};
