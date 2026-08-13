// file location: src/lib/database/partsGoodsIn.js
import { supabase } from "@/lib/database/supabaseClient";

export async function updatePartsGoodsInDraft(goodsInId, updates, selectColumns) {
  const { data, error } = await supabase
    .from("parts_goods_in")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", goodsInId)
    .eq("status", "draft")
    .select(selectColumns)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}
