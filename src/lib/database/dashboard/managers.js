import { supabase } from "@/lib/supabaseClient";
import { runQuery } from "@/lib/database/dashboard/utils";
import { getAfterSalesDashboardData } from "@/lib/database/dashboard/after-sales";

export const getManagersDashboardData = async () => {
  const base = await getAfterSalesDashboardData();
  const escalations = await runQuery(() =>
    supabase
      .from("notifications")
      .select("notification_id,message,target_role,created_at")
      .order("created_at", { ascending: false })
      .limit(4)
  );

  return {
    ...base,
    escalations,
  };
};
