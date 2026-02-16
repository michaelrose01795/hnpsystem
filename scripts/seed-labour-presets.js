// file location: scripts/seed-labour-presets.js

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
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const LOCATION_VARIANTS = [
  { token: "", label: "" },
  { token: "NSF", label: "nearside front" },
  { token: "OSF", label: "offside front" },
  { token: "NSR", label: "nearside rear" },
  { token: "OSR", label: "offside rear" },
  { token: "Front", label: "front" },
  { token: "Rear", label: "rear" },
  { token: "Nearside", label: "nearside" },
  { token: "Offside", label: "offside" },
];

const PHRASE_VARIANTS = [
  (label, action) => `${label}, ${action}`,
  (label, action) => `${label} - ${action}`,
  (label, action) => `${action} ${label}`,
];

const CATEGORIES = [
  {
    name: "wipers",
    baseHours: 0.2,
    step: 0.1,
    actions: ["replace", "renew", "inspect and replace"],
    tasks: ["wiper blade split", "wiper arm loose", "washer jet blocked", "rear wiper blade", "front wiper set"],
    tags: ["wipers", "washers", "screenwash"],
  },
  {
    name: "brakes",
    baseHours: 1.0,
    step: 0.2,
    actions: ["replace", "inspect and replace", "service and replace"],
    tasks: ["brake pads and discs", "brake pads", "brake disc", "caliper slide", "brake hose"],
    tags: ["brakes", "pads", "discs"],
  },
  {
    name: "suspension",
    baseHours: 1.2,
    step: 0.2,
    actions: ["replace", "renew", "repair"],
    tasks: ["coil spring snapped", "shock absorber leaking", "top mount worn", "drop link noisy", "wishbone bush split"],
    tags: ["suspension", "spring", "shock"],
  },
  {
    name: "tyres",
    baseHours: 0.4,
    step: 0.1,
    actions: ["replace", "repair", "remove and refit"],
    tasks: ["tyre below legal", "tyre sidewall damage", "tyre puncture", "wheel balance", "valve leaking"],
    tags: ["tyres", "wheels", "balance"],
  },
  {
    name: "lights",
    baseHours: 0.2,
    step: 0.1,
    actions: ["replace", "renew", "repair"],
    tasks: ["headlamp bulb out", "tail lamp not working", "indicator bulb failed", "number plate bulb failed", "fog lamp inoperative"],
    tags: ["lights", "bulbs", "electrics"],
  },
  {
    name: "battery",
    baseHours: 0.5,
    step: 0.1,
    actions: ["replace", "renew", "test and replace"],
    tasks: ["battery failed load test", "battery terminal corroded", "battery clamp loose", "alternator drive belt", "charging fault"],
    tags: ["battery", "charging", "alternator"],
  },
  {
    name: "servicing",
    baseHours: 0.8,
    step: 0.2,
    actions: ["replace", "service", "renew"],
    tasks: ["engine oil and filter", "air filter", "cabin filter", "fuel filter", "spark plugs"],
    tags: ["service", "maintenance", "filters"],
  },
  {
    name: "leaks",
    baseHours: 1.1,
    step: 0.2,
    actions: ["repair", "replace", "inspect and repair"],
    tasks: ["rocker cover gasket leak", "sump gasket leak", "coolant hose leak", "water pump leak", "power steering leak"],
    tags: ["leaks", "gasket", "coolant"],
  },
  {
    name: "steering",
    baseHours: 1.0,
    step: 0.2,
    actions: ["replace", "renew", "repair"],
    tasks: ["track rod end play", "steering rack gaiter split", "steering column knock", "power steering hose leak", "inner tie rod play"],
    tags: ["steering", "rack", "track rod"],
  },
  {
    name: "drivetrain",
    baseHours: 1.3,
    step: 0.3,
    actions: ["replace", "renew", "repair"],
    tasks: ["driveshaft cv boot split", "cv joint noisy", "clutch slave cylinder leak", "gear linkage loose", "engine mount worn"],
    tags: ["drivetrain", "cv", "clutch"],
  },
  {
    name: "exhaust",
    baseHours: 0.9,
    step: 0.2,
    actions: ["replace", "renew", "repair"],
    tasks: ["exhaust clamp corroded", "center section leaking", "rear silencer corroded", "lambda sensor fault", "catalytic converter rattle"],
    tags: ["exhaust", "sensor", "cat"],
  },
  {
    name: "aircon",
    baseHours: 0.6,
    step: 0.2,
    actions: ["replace", "repair", "service"],
    tasks: ["air con condenser leaking", "compressor noisy", "blower motor inoperative", "cabin fan resistor failed", "air con pipe leak"],
    tags: ["aircon", "hvac", "blower"],
  },
  {
    name: "cooling",
    baseHours: 0.9,
    step: 0.2,
    actions: ["replace", "renew", "repair"],
    tasks: ["radiator leak", "cooling fan inoperative", "thermostat stuck", "coolant temperature sensor fault", "expansion tank cracked"],
    tags: ["cooling", "radiator", "fan"],
  },
  {
    name: "electrical",
    baseHours: 0.7,
    step: 0.2,
    actions: ["replace", "repair", "inspect and repair"],
    tasks: ["wiring repair", "earth strap corroded", "fuse box issue", "relay failed", "starter motor intermittent"],
    tags: ["electrical", "wiring", "starter"],
  },
  {
    name: "bodywork",
    baseHours: 0.5,
    step: 0.1,
    actions: ["replace", "repair", "secure"],
    tasks: ["undertray loose", "arch liner damaged", "bumper clip missing", "engine cover missing", "bonnet latch sticking"],
    tags: ["bodywork", "trim", "fixings"],
  },
];

const normalizeText = (value = "") => {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/off side/g, "offside")
    .replace(/near side/g, "nearside")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const buildTags = (taskText = "", locationLabel = "", categoryTags = []) => {
  const tagSet = new Set([...(categoryTags || [])]);
  normalizeText(taskText)
    .split(" ")
    .filter((token) => token.length >= 3)
    .forEach((token) => tagSet.add(token));
  normalizeText(locationLabel)
    .split(" ")
    .filter((token) => token.length >= 3)
    .forEach((token) => tagSet.add(token));
  return Array.from(tagSet).slice(0, 16);
};

const toHours = (value) => {
  const rounded = Math.max(0.1, Math.round(value * 10) / 10);
  return Number(rounded.toFixed(2));
};

const buildPresets = () => {
  const rows = [];
  const seen = new Set();

  for (const category of CATEGORIES) {
    category.tasks.forEach((task, taskIndex) => {
      category.actions.forEach((action, actionIndex) => {
        LOCATION_VARIANTS.forEach((location, locationIndex) => {
          PHRASE_VARIANTS.forEach((formatter, phraseIndex) => {
            const baseLabel = [location.token, task].filter(Boolean).join(" ").trim();
            const displayDescription = formatter(baseLabel, action).trim();
            const normalizedKey = normalizeText(displayDescription);
            const dedupeKey = `${normalizedKey}|${displayDescription}`;
            if (!normalizedKey || seen.has(dedupeKey)) return;
            seen.add(dedupeKey);

            const dynamicHours = toHours(
              category.baseHours +
                category.step * taskIndex +
                0.05 * actionIndex +
                0.03 * locationIndex +
                0.02 * phraseIndex
            );

            rows.push({
              normalized_key: normalizedKey,
              display_description: displayDescription,
              default_time_hours: dynamicHours,
              tags: buildTags(task, location.label, category.tags),
            });
          });
        });
      });
    });
  }

  rows.push({
    normalized_key: normalizeText("Front wipers split, replace"),
    display_description: "Front wipers split, replace",
    default_time_hours: 0.3,
    tags: ["wiper", "front", "replace"],
  });
  rows.push({
    normalized_key: normalizeText("Rear wiper blade, replace"),
    display_description: "Rear wiper blade, replace",
    default_time_hours: 0.2,
    tags: ["wiper", "rear", "replace"],
  });
  rows.push({
    normalized_key: normalizeText("OSF brake pads and discs, replace"),
    display_description: "OSF brake pads and discs, replace",
    default_time_hours: 1.2,
    tags: ["osf", "brake", "pads", "disc"],
  });
  rows.push({
    normalized_key: normalizeText("NSR coil spring snapped, replace"),
    display_description: "NSR coil spring snapped, replace",
    default_time_hours: 1.8,
    tags: ["nsr", "coil", "spring", "replace"],
  });

  return rows;
};

const chunk = (arr, size) => {
  const output = [];
  for (let i = 0; i < arr.length; i += size) {
    output.push(arr.slice(i, i + size));
  }
  return output;
};

const run = async () => {
  const presets = buildPresets();
  console.log(`Generated ${presets.length} preset rows`);

  if (presets.length < 3000) {
    throw new Error(`Expected at least 3000 presets, got ${presets.length}`);
  }

  const batches = chunk(presets, 500);
  for (let i = 0; i < batches.length; i += 1) {
    const rows = batches[i];
    const { error } = await supabase
      .from("labour_time_presets")
      .upsert(rows, { onConflict: "normalized_key,display_description", ignoreDuplicates: false });
    if (error) {
      throw error;
    }
    console.log(`Upserted batch ${i + 1}/${batches.length}`);
  }

  console.log("Labour presets seed complete");
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
