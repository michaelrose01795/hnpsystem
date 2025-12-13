// file location: src/lib/consumables.js
// Central Supabase helpers for consumable stock-check workflows
import { supabase } from "@/lib/supabaseClient";

const formatConsumable = (row) => ({
  id: row.id,
  name: row.name,
  locationId: row.location_id,
  locationName: row.location,
  temporary: row.temporary ?? false,
  createdAt: row.created_at,
});

const formatStockCheckRow = (row) => ({
  id: row.id,
  consumableId: row.consumable_id,
  technicianId: row.technician_id,
  status: row.status,
  createdAt: row.created_at,
  consumableName: row.consumables?.name || row.consumable_name || null,
  consumableLocation: row.consumables?.location || null,
  technicianName: row.technician?.name || row.technician_name || null,
});

const mapStockCheckStatusToRequest = (status) => {
  if (status === "approved") {
    return "ordered";
  }
  if (status === "rejected") {
    return "rejected";
  }
  return "pending";
};

async function logTechnicianRequestsFromStockChecks(rows = []) {
  if (!Array.isArray(rows) || !rows.length) {
    return;
  }

  const payload = rows
    .map((row) => {
      if (!row?.id) {
        return null;
      }
      const itemName = (row.consumableName || "").trim();
      if (!itemName) {
        return null;
      }
      return {
        id: row.id,
        item_name: itemName,
        quantity: 1,
        requested_by: row.technicianId || null,
        requested_by_name: row.technicianName || null,
        requested_at: row.createdAt || new Date().toISOString(),
        updated_at: row.createdAt || new Date().toISOString(),
        status: mapStockCheckStatusToRequest(row.status),
      };
    })
    .filter(Boolean);

  if (!payload.length) {
    return;
  }

  const { error } = await supabase
    .from("workshop_consumable_requests")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    throw error;
  }
}

export async function getConsumablesGroupedByLocation() {
  const { data: locations, error: locationError } = await supabase
    .from("consumable_locations")
    .select("id, name, order_index, created_at")
    .order("order_index", { ascending: true })
    .order("name", { ascending: true });

  if (locationError) {
    throw locationError;
  }

  const { data: consumables, error: consumableError } = await supabase
    .from("consumables")
    .select("id, name, location, location_id, temporary, created_at")
    .order("temporary", { ascending: true })
    .order("name", { ascending: true });

  if (consumableError) {
    throw consumableError;
  }

  const locationMap = new Map();
  (locations || []).forEach((location) => {
    locationMap.set(location.id, {
      id: location.id,
      name: location.name,
      orderIndex: location.order_index ?? 0,
      createdAt: location.created_at,
      consumables: [],
    });
  });

  const unassigned = [];
  (consumables || []).forEach((row) => {
    const formatted = formatConsumable(row);
    if (formatted.locationId && locationMap.has(formatted.locationId)) {
      locationMap.get(formatted.locationId).consumables.push(formatted);
    } else {
      unassigned.push(formatted);
    }
  });

  return {
    locations: Array.from(locationMap.values()),
    unassigned,
  };
}

export async function addTemporaryConsumables(names = []) {
  const normalized = Array.from(
    new Set(
      (names || [])
        .map((name) => (name || "").trim())
        .filter(Boolean)
    )
  );

  if (!normalized.length) {
    return [];
  }

  const payload = normalized.map((name) => ({
    name,
    temporary: true,
    location: null,
    location_id: null,
  }));

  const { data, error } = await supabase
    .from("consumables")
    .insert(payload)
    .select("id, name, location, location_id, temporary, created_at");

  if (error) {
    throw error;
  }

  return (data || []).map(formatConsumable);
}

export async function submitStockCheckRequest({ consumableIds = [], technicianId = null }) {
  if (!Array.isArray(consumableIds) || consumableIds.length === 0) {
    throw new Error("No consumables selected.");
  }

  const rows = consumableIds.map((consumableId) => ({
    consumable_id: consumableId,
    technician_id: technicianId,
    status: "pending",
  }));

  const { data, error } = await supabase
    .from("consumable_stock_checks")
    .insert(rows)
    .select(
      `
      id,
      consumable_id,
      technician_id,
      status,
      created_at,
      consumables ( id, name, location ),
      technician:users!consumable_stock_checks_technician_id_fkey ( user_id, name )
    `
    );

  if (error) {
    throw error;
  }

  const formattedRows = (data || []).map(formatStockCheckRow);
  await logTechnicianRequestsFromStockChecks(formattedRows);
  return formattedRows;
}

export async function listConsumableStockChecks() {
  const { data, error } = await supabase
    .from("consumable_stock_checks")
    .select(
      `
      id,
      consumable_id,
      technician_id,
      status,
      created_at,
      consumables ( id, name, location ),
      technician:users!consumable_stock_checks_technician_id_fkey ( user_id, name )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data || []).map(formatStockCheckRow);
  await logTechnicianRequestsFromStockChecks(rows);
  return rows;
}

export async function updateStockCheckStatus(id, status) {
  if (!id || !status) {
    throw new Error("id and status are required.");
  }

  const { error } = await supabase
    .from("consumable_stock_checks")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function renameConsumable(id, name) {
  if (!id || !name) {
    throw new Error("id and name are required.");
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Consumable name cannot be empty.");
  }

  const { data, error } = await supabase
    .from("consumables")
    .update({ name: trimmed })
    .eq("id", id)
    .select("id, name, location, location_id, temporary, created_at")
    .single();

  if (error) {
    throw error;
  }

  return formatConsumable(data);
}

export async function deleteConsumable(id) {
  if (!id) {
    throw new Error("id is required.");
  }

  const { error } = await supabase.from("consumables").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

async function resolveLocationName(locationId) {
  if (!locationId) {
    return { id: null, name: null };
  }

  const { data, error } = await supabase
    .from("consumable_locations")
    .select("id, name")
    .eq("id", locationId)
    .single();

  if (error) {
    throw error;
  }

  return { id: data.id, name: data.name };
}

export async function moveConsumable({ id, locationId }) {
  if (!id) {
    throw new Error("Consumable id is required.");
  }

  const nextLocation = await resolveLocationName(locationId);

  const { data, error } = await supabase
    .from("consumables")
    .update({
      location_id: nextLocation.id,
      location: nextLocation.name,
    })
    .eq("id", id)
    .select("id, name, location, location_id, temporary, created_at")
    .single();

  if (error) {
    throw error;
  }

  return formatConsumable(data);
}

async function getNextLocationOrderIndex() {
  const { data, error } = await supabase
    .from("consumable_locations")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  if (!data || !data.length) {
    return 1;
  }

  const current = data[0]?.order_index ?? 0;
  return current + 1;
}

export async function createConsumableLocation(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    throw new Error("Location name is required.");
  }

  const orderIndex = await getNextLocationOrderIndex();

  const { data, error } = await supabase
    .from("consumable_locations")
    .insert({ name: trimmed, order_index: orderIndex })
    .select("id, name, order_index, created_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    orderIndex: data.order_index,
    createdAt: data.created_at,
    consumables: [],
  };
}

export async function renameConsumableLocation(id, name) {
  if (!id || !name) {
    throw new Error("id and name are required.");
  }
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Location name cannot be empty.");
  }

  const { data, error } = await supabase
    .from("consumable_locations")
    .update({ name: trimmed })
    .eq("id", id)
    .select("id, name, order_index, created_at")
    .single();

  if (error) {
    throw error;
  }

  const { error: syncError } = await supabase
    .from("consumables")
    .update({ location: trimmed })
    .eq("location_id", id);

  if (syncError) {
    throw syncError;
  }

  return {
    id: data.id,
    name: data.name,
    orderIndex: data.order_index,
    createdAt: data.created_at,
  };
}
