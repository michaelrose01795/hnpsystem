// file location: src/lib/parts/partTypeImages.js
//
// One generic picture per KIND of part.
//
// parts_catalog holds no imagery, and photographing every part number is not
// realistic — there can be fifty alternators on the shelf. So the picture is
// keyed to the part TYPE, not the part: every alternator, whatever its part
// number, fitment or supplier, shows /images/parts/alternator.svg.
//
// The type is read from the part name (first matching rule wins, so the more
// specific rules sit above the broad ones — "seat belt" before "belt", "oil
// filter" before "oil"). A name no rule recognises falls back to its category,
// and a part with neither falls back to a neutral parts box.
//
//   - add a type     add a rule here and an SVG in public/images/parts/
//   - re-point one   change its `image`; every matching part follows
//
// Pure and dependency-free: used by the public catalogue read layer
// (src/lib/database/partsCatalogPublic.js) and the #shop teaser mock data.

const IMAGE_ROOT = "/images/parts";

// Order matters: first match wins.
export const PART_TYPE_RULES = [
  { type: "seat-belt", match: /seat ?belt/i },
  { type: "airbag", match: /airbag|\bsrs\b/i },
  { type: "sensor", match: /sensor|tpms|pressure monitoring/i },
  { type: "bulb", match: /\bbulb/i },
  { type: "light-unit", match: /head ?(lamp|light)|tail ?(lamp|light)|rear light|light unit|fog ?lamp/i },
  { type: "alternator", match: /alternator/i },
  { type: "starter-motor", match: /starter/i },
  { type: "battery", match: /batter/i },
  { type: "spark-plug", match: /spark ?plug|glow ?plug/i },
  { type: "ignition-coil", match: /ignition coil|coil pack/i },
  { type: "brake-caliper", match: /caliper/i },
  { type: "brake-pads", match: /\bpads?\b|pad set|brake shoe/i },
  { type: "brake-drum", match: /\bdrums?\b/i },
  { type: "brake-disc", match: /\bdiscs?\b/i },
  { type: "oil-filter", match: /oil filter|fuel filter|service kit/i },
  { type: "air-filter", match: /air filter|cabin filter|pollen filter/i },
  { type: "hose", match: /\bhose|\bpipe\b/i },
  { type: "radiator", match: /radiator|inter ?cooler|condenser/i },
  { type: "water-pump", match: /water pump/i },
  { type: "thermostat", match: /thermostat/i },
  { type: "fluid-bottle", match: /fluid|coolant|antifreeze|engine oil|screenwash|adblue|care kit|shampoo/i },
  { type: "clutch-kit", match: /clutch|flywheel/i },
  { type: "gearbox", match: /gearbox|transmission/i },
  { type: "driveshaft", match: /drive ?shaft|cv joint|cv boot/i },
  { type: "belt", match: /\bbelt|timing chain/i },
  { type: "exhaust", match: /exhaust|silencer|back box|catalytic|\bdpf\b/i },
  { type: "shock-absorber", match: /shock|strut|damper/i },
  { type: "coil-spring", match: /spring/i },
  { type: "ball-joint", match: /ball joint|track rod|tie rod/i },
  { type: "control-arm", match: /\barm\b|wishbone|drop link|anti-roll bar link/i },
  { type: "steering-rack", match: /steering rack|\brack\b/i },
  { type: "wheel-bearing", match: /bearing|wheel hub|\bhub\b/i },
  { type: "wiper-blade", match: /wiper/i },
  { type: "mirror", match: /mirror/i },
  { type: "window-regulator", match: /window regulator|regulator/i },
  { type: "door-lock", match: /\block\b|door handle/i },
  { type: "tyre", match: /tyre|yokohama|nexen|bridgestone|pirelli|michelin|continental|goodyear/i },
  { type: "infotainment", match: /speaker|touch ?screen|radio|head unit|display/i },
  { type: "number-plate", match: /number plate/i },
  { type: "roof-bars", match: /roof bar|roof box/i },
  { type: "towbar", match: /tow ?bar|towing/i },
  { type: "trim-clip", match: /\bseal\b|clips?\b|\btrim\b|under ?tray|mud ?flap/i },
];

// Catalogue categories are free text, so the keys are lower-cased.
const CATEGORY_FALLBACK = {
  brakes: "brake-disc",
  suspension: "shock-absorber",
  steering: "steering-rack",
  electrical: "battery",
  cooling: "radiator",
  engine: "belt",
  exhaust: "exhaust",
  transmission: "gearbox",
  body: "mirror",
  window: "window-regulator",
  interior: "seat-belt",
  airbag: "airbag",
  tyre: "tyre",
  tyres: "tyre",
  wiper: "wiper-blade",
  filters: "air-filter",
  servicing: "oil-filter",
  accessories: "roof-bars",
  styling: "trim-clip",
  care: "fluid-bottle",
};

export const GENERIC_PART_TYPE = "part";

/** The part type for a name / category pair, e.g. "alternator". */
export const partTypeFor = (name, category) => {
  const text = String(name || "");
  const rule = PART_TYPE_RULES.find((r) => r.match.test(text));
  if (rule) return rule.type;
  const byCategory = CATEGORY_FALLBACK[String(category || "").trim().toLowerCase()];
  return byCategory || GENERIC_PART_TYPE;
};

export const partTypeImageUrl = (type) => `${IMAGE_ROOT}/${type || GENERIC_PART_TYPE}.svg`;

/** The shared image for a part, from its name and category. */
export const partImageFor = (name, category) => partTypeImageUrl(partTypeFor(name, category));

/** Every image file the registry can point at — the SVG set must cover this. */
export const ALL_PART_TYPES = [
  ...new Set([...PART_TYPE_RULES.map((r) => r.type), ...Object.values(CATEGORY_FALLBACK), GENERIC_PART_TYPE]),
];
