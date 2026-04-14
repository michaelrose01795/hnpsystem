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

const normalizeText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const uniqueNormalizedList = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )
  );

const PRESETS = [
  { label: "MOT", category: "mot", hours: 0.01, aliases: ["mot test", "m.o.t", "ministry test", "mot booking"] },
  { label: "1st Service", category: "service", hours: 1.0, aliases: ["first service", "service 1", "1st"] },
  { label: "2nd Service", category: "service", hours: 1.5, aliases: ["second service", "service 2", "2nd"] },
  { label: "3rd Service", category: "service", hours: 2.0, aliases: ["third service", "service 3", "3rd"] },
  { label: "Major Service", category: "service", hours: 2.5, aliases: ["major", "big service", "full major service"] },
  { label: "Interim Service", category: "service", hours: 1.0, aliases: ["interim", "minor service"] },
  { label: "Full Service", category: "service", hours: 2.0, aliases: ["full annual service", "annual service"] },
  { label: "Service and MOT", category: "service", hours: 1.5, aliases: ["mot and service", "service + mot"] },

  { label: "Diagnostic", category: "diagnostic", hours: 1.0, aliases: ["diag", "diagnostic", "diagnostics", "fault find", "fault finding", "diagnose", "diagnosis"] },
  { label: "Diagnostics", category: "diagnostic", hours: 1.0, aliases: ["diagnostics", "diag check"] },
  { label: "Diagnosis", category: "diagnostic", hours: 1.0, aliases: ["diagnosis", "vehicle diagnosis"] },
  { label: "Diagnose Fault", category: "diagnostic", hours: 1.0, aliases: ["diagnose", "check fault", "fault diagnose"] },
  { label: "Fault Finding", category: "diagnostic", hours: 1.0, aliases: ["find fault", "fault diagnosis", "fault check"] },
  { label: "Investigation", category: "diagnostic", hours: 1.0, aliases: ["investigate fault", "investigate issue"] },
  { label: "Investigate Noise", category: "diagnostic", hours: 1.0, aliases: ["noise investigate", "noise diagnostic", "rattle diagnosis"] },
  { label: "Engine Management Light Check", category: "diagnostic", hours: 1.0, aliases: ["eml", "engine light", "warning light", "check engine", "engine light check"] },
  { label: "Noise Diagnosis", category: "diagnostic", hours: 1.0, aliases: ["noise investigate", "noise diagnostic", "rattle diagnosis"] },
  { label: "Warning Light Check", category: "diagnostic", hours: 1.0, aliases: ["warning light", "dash light check"] },

  { label: "Air Con Service", category: "aircon", hours: 1.0, aliases: ["air conditioning service", "ac service", "air con regas"] },
  { label: "Brake Inspection", category: "brakes", hours: 0.5, aliases: ["brake check", "check brakes"] },
  { label: "Front Brake Pads", category: "brakes", hours: 1.0, aliases: ["front pads", "replace front brake pads"] },
  { label: "Rear Brake Pads", category: "brakes", hours: 1.0, aliases: ["rear pads", "replace rear brake pads"] },
  { label: "Front Discs and Pads", category: "brakes", hours: 1.5, aliases: ["front discs pads", "front brakes discs and pads"] },
  { label: "Rear Discs and Pads", category: "brakes", hours: 1.5, aliases: ["rear discs pads", "rear brakes discs and pads"] },
  { label: "Clutch Replacement", category: "drivetrain", hours: 5.0, aliases: ["replace clutch", "new clutch"] },
  { label: "Cambelt Replacement", category: "engine", hours: 4.5, aliases: ["timing belt", "cam belt", "replace cambelt"] },
  { label: "Battery Check", category: "battery", hours: 0.25, aliases: ["battery test", "battery health check"] },
  { label: "Battery Replacement", category: "battery", hours: 0.5, aliases: ["replace battery", "new battery"] },
  { label: "Wheel Alignment", category: "tyres", hours: 1.0, aliases: ["tracking", "4 wheel alignment", "align wheels"] },
  { label: "Tyre Replace Front", category: "tyres", hours: 0.5, aliases: ["front tyres", "replace front tyre"] },
  { label: "Tyre Replace Rear", category: "tyres", hours: 0.5, aliases: ["rear tyres", "replace rear tyre"] },
  { label: "Puncture Repair", category: "tyres", hours: 0.5, aliases: ["tyre puncture", "repair puncture"] },
  { label: "Suspension Check", category: "suspension", hours: 0.5, aliases: ["check suspension", "suspension inspect"] },
  { label: "Vehicle Health Check", category: "inspection", hours: 0.25, aliases: ["vhc", "vehicle check", "health check"] },
  { label: "Pre Delivery Inspection", category: "inspection", hours: 1.0, aliases: ["pdi", "pre delivery", "delivery inspection"] },
  { label: "Hybrid Health Check", category: "inspection", hours: 0.75, aliases: ["hybrid check", "hybrid battery check"] },
  { label: "EV Health Check", category: "inspection", hours: 0.75, aliases: ["ev check", "electric vehicle health check"] },
  { label: "Air Filter Replace", category: "service", hours: 0.25, aliases: ["air filter", "replace air filter"] },
  { label: "Pollen Filter Replace", category: "service", hours: 0.25, aliases: ["cabin filter", "replace pollen filter"] },
  { label: "Spark Plugs Replace", category: "service", hours: 1.0, aliases: ["spark plugs", "replace spark plugs"] },
  { label: "Gearbox Oil Change", category: "service", hours: 1.0, aliases: ["gearbox oil", "transmission oil change"] },
  { label: "Brake Fluid Change", category: "service", hours: 0.75, aliases: ["brake fluid", "fluid change brake"] },
  { label: "Coolant Change", category: "service", hours: 1.0, aliases: ["coolant flush", "replace coolant"] },
  { label: "ADAS Calibration", category: "adas", hours: 1.5, aliases: ["adas", "adas calibrate", "camera calibration"] },

  { label: "DPF Regeneration", category: "engine", hours: 1.0, aliases: ["dpf regen", "forced regen"] },
  { label: "EGR Valve Replace", category: "engine", hours: 2.0, aliases: ["egr replacement", "replace egr"] },
  { label: "Turbo Inspection", category: "engine", hours: 1.0, aliases: ["turbo check", "inspect turbo"] },
  { label: "Injector Test", category: "engine", hours: 1.0, aliases: ["injector diagnostic", "injector check"] },
  { label: "Alternator Replacement", category: "electrical", hours: 1.5, aliases: ["replace alternator", "alternator"] },
  { label: "Starter Motor Replacement", category: "electrical", hours: 1.5, aliases: ["starter replacement", "replace starter motor"] },
  { label: "Drive Belt Replacement", category: "engine", hours: 1.0, aliases: ["aux belt", "serpentine belt"] },
  { label: "Water Pump Replacement", category: "engine", hours: 2.0, aliases: ["replace water pump", "water pump"] },
  { label: "Thermostat Replacement", category: "engine", hours: 1.0, aliases: ["replace thermostat", "thermostat"] },
  { label: "Radiator Replacement", category: "engine", hours: 2.0, aliases: ["replace radiator", "radiator"] },
  { label: "Exhaust Repair", category: "exhaust", hours: 1.0, aliases: ["exhaust fix", "exhaust work"] },
  { label: "Wiper Blade Replacement", category: "service", hours: 0.2, aliases: ["wiper replace", "replace wipers"] },
  { label: "Bulb Replacement", category: "electrical", hours: 0.2, aliases: ["replace bulb", "light bulb replacement"] },
  { label: "Airbag Warning Light Check", category: "diagnostic", hours: 1.0, aliases: ["airbag light", "srs light check"] },
  { label: "ABS Warning Light Check", category: "diagnostic", hours: 1.0, aliases: ["abs light", "abs diagnosis"] },
  { label: "Parking Sensor Diagnosis", category: "diagnostic", hours: 1.0, aliases: ["parking sensor check", "pdc diagnosis"] },
  { label: "Steering Geometry Check", category: "steering", hours: 0.75, aliases: ["geometry", "steering alignment check"] },
  { label: "Clutch Fluid Bleed", category: "service", hours: 0.75, aliases: ["bleed clutch", "clutch bleed"] },
  { label: "Brake Caliper Replacement", category: "brakes", hours: 1.5, aliases: ["replace caliper", "brake caliper"] },
  { label: "Fuel Filter Replace", category: "service", hours: 0.5, aliases: ["fuel filter", "replace fuel filter"] },
  { label: "Oil and Filter Change", category: "service", hours: 0.75, aliases: ["oil service", "oil and filter"] },
  { label: "Service Reset", category: "service", hours: 0.1, aliases: ["service light reset", "reset service indicator"] },
  { label: "Wheel Bearing Replacement", category: "suspension", hours: 2.0, aliases: ["wheel bearing", "replace bearing"] },
  { label: "CV Boot Replacement", category: "drivetrain", hours: 1.5, aliases: ["cv boot", "driveshaft boot"] },
  { label: "MOT Retest", category: "mot", hours: 0.25, aliases: ["mot re test", "retest mot"] },
  { label: "Road Test", category: "inspection", hours: 0.5, aliases: ["test drive", "road test and inspect"] },
];

const buildRows = () =>
  PRESETS.map((preset) => {
    const normalizedLabel = normalizeText(preset.label);
    return {
      label: preset.label,
      normalized_label: normalizedLabel,
      aliases: uniqueNormalizedList(preset.aliases),
      normalized_aliases: uniqueNormalizedList([...(preset.aliases || []), preset.label]),
      category: preset.category || "general",
      default_hours: Number(preset.hours),
      is_active: true,
    };
  });

async function main() {
  const rows = buildRows();
  console.log(`Seeding ${rows.length} job request presets...`);

  const { error } = await supabase
    .from("job_request_presets")
    .upsert(rows, {
      onConflict: "normalized_label",
      ignoreDuplicates: false,
    });

  if (error) {
    throw error;
  }

  console.log("Job request presets seed complete.");
}

main().catch((error) => {
  console.error("Failed to seed job request presets", error);
  process.exit(1);
});
