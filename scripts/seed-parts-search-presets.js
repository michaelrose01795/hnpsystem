// file location: scripts/seed-parts-search-presets.js

/* eslint-disable no-console */
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const normalizeText = (value = "") => {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const SYSTEMS = [
  { key: "engine", context: ["eml light", "engine warning", "running issue"], queries: ["engine hose", "engine sensor", "engine gasket"] },
  { key: "boost", context: ["underboost", "boost leak", "split intercooler hose"], queries: ["intercooler hose", "boost hose", "charge pipe", "turbo intercooler hose"] },
  { key: "misfire", context: ["misfire", "rough idle", "hesitation"], queries: ["spark plugs", "ignition coil", "coil pack"] },
  { key: "egr", context: ["egr fault", "egr stuck", "emissions fault"], queries: ["egr valve", "egr cooler", "egr gasket"] },
  { key: "dpf", context: ["dpf blocked", "regen failed", "soot load high"], queries: ["dpf sensor", "dpf pressure sensor", "dpf additive"] },
  { key: "sensors", context: ["sensor fault", "signal implausible", "sensor open circuit"], queries: ["map sensor", "maf sensor", "oxygen sensor", "crank sensor"] },
  { key: "brakes", context: ["brake pads low", "brake judder", "metal to metal"], queries: ["front brake pads", "rear brake pads", "brake discs", "brake pad sensor"] },
  { key: "suspension", context: ["knocking", "top mount noise", "suspension clunk"], queries: ["strut top mount", "drop link", "shock absorber", "coil spring"] },
  { key: "tyres", context: ["tyre worn", "uneven wear", "puncture"], queries: ["front tyre", "rear tyre", "tyre valve", "wheel alignment"] },
  { key: "steering", context: ["steering play", "rack noise", "wandering"], queries: ["track rod end", "steering rack", "inner tie rod", "power steering hose"] },
  { key: "exhaust", context: ["exhaust blow", "rattle", "lambda fault"], queries: ["exhaust clamp", "rear silencer", "lambda sensor", "catalytic converter"] },
  { key: "cooling", context: ["coolant leak", "overheating", "fan inoperative"], queries: ["radiator hose", "water pump", "thermostat", "cooling fan"] },
  { key: "battery", context: ["battery failing test", "low cranking", "won't start"], queries: ["12v battery", "battery clamp", "battery terminal"] },
  { key: "wipers", context: ["wipers smeary", "blade split", "washer not spraying"], queries: ["front wiper blades", "rear wiper blade", "washer pump", "washer jet"] },
];

const VEHICLE_VARIANTS = [
  "",
  "clio mk5 1.3 tce",
  "fiesta mk8 1.0 ecoboost",
  "golf mk7 2.0 tdi",
  "a3 8v 1.5 tfsi",
  "corsa f 1.2",
  "focus mk4 1.5 diesel",
  "qashqai j11 1.5 dci",
  "transit custom 2.0",
  "sprinter 2.1 cdi",
];

const LOCATION_VARIANTS = ["", "front", "rear", "nsf", "osf", "nsr", "osr", "nearside", "offside"];
const ISSUE_MODIFIERS = ["", "replacement required", "urgent", "confirmed leak", "customer reported", "technician confirmed", "intermittent", "after road test"];
const QUERY_MODIFIERS = ["", "oem", "genuine", "aftermarket", "with clips", "upper", "lower"];

const tokenize = (value = "") => {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1);
};

const buildRows = () => {
  const rows = [];
  const dedupe = new Set();

  SYSTEMS.forEach((system) => {
    system.context.forEach((contextItem, contextIndex) => {
      system.queries.forEach((baseQuery, queryIndex) => {
        VEHICLE_VARIANTS.forEach((vehicle, vehicleIndex) => {
          LOCATION_VARIANTS.forEach((location, locationIndex) => {
            ISSUE_MODIFIERS.forEach((modifier, modifierIndex) => {
              QUERY_MODIFIERS.forEach((queryModifier, queryModifierIndex) => {
                const contextText = [system.key, contextItem, location, modifier, vehicle]
                  .filter(Boolean)
                  .join(" ")
                  .trim();
                const suggestedQuery = [queryModifier, location, baseQuery, vehicle]
                  .filter(Boolean)
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim();
                const normalizedContextKey = normalizeText(contextText);
                if (!normalizedContextKey || !suggestedQuery) return;

                const uniqueKey = `${normalizedContextKey}|${suggestedQuery}`;
                if (dedupe.has(uniqueKey)) return;
                dedupe.add(uniqueKey);

                const contextKeywords = Array.from(new Set(tokenize(contextText))).slice(0, 24);
                const tags = Array.from(
                  new Set([
                    system.key,
                    ...tokenize(baseQuery),
                    ...tokenize(location),
                    ...tokenize(queryModifier),
                    ...tokenize(vehicle),
                  ])
                ).slice(0, 24);

                const boost = contextIndex + queryIndex + vehicleIndex + locationIndex + modifierIndex + queryModifierIndex;
                if (boost % 2 === 0 || vehicle || location || queryModifier) {
                  rows.push({
                    normalized_context_key: normalizedContextKey,
                    context_keywords: contextKeywords,
                    suggested_query: suggestedQuery,
                    tags,
                  });
                }
              });
            });
          });
        });
      });
    });
  });

  rows.push({
    normalized_context_key: normalizeText("eml light split intercooler hose replacement is required"),
    context_keywords: ["eml", "split", "intercooler", "hose", "boost", "underboost"],
    suggested_query: "intercooler hose",
    tags: ["boost", "hose", "engine"],
  });

  return rows.slice(0, 5000);
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const run = async () => {
  const rows = buildRows();
  console.log(`Generated ${rows.length} parts search preset rows`);

  if (rows.length < 3000) {
    throw new Error(`Expected at least 3000 rows, got ${rows.length}`);
  }

  const batches = chunk(rows, 500);
  for (let i = 0; i < batches.length; i += 1) {
    const { error } = await supabase
      .from("parts_search_presets")
      .upsert(batches[i], { onConflict: "normalized_context_key,suggested_query", ignoreDuplicates: false });
    if (error) throw error;
    console.log(`Upserted ${i + 1}/${batches.length}`);
  }

  console.log("Parts search presets seed complete");
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
