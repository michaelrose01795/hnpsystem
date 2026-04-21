// file location: src/lib/ai/questionPrompts.js
// Smart "Question Prompts" engine.
//
// Given a free-text job request (e.g. "charging issue", "brake noise"), this
// module returns a short, ordered list of diagnostic questions a service
// advisor can ask the customer on the phone. The matching is deterministic
// and keyword-driven — no randomness, no network calls — so the UI always
// renders the same questions for the same request text.
//
// How it works (high level):
//   1. Normalise the request text (lowercase, strip punctuation, collapse
//      whitespace) to make keyword detection robust.
//   2. Walk every CATEGORY and score it against the text using its keyword
//      list. A higher score means a stronger match.
//   3. Keep every category that scores above the match threshold, then sort
//      them by (score desc, priority desc) so the most relevant category
//      appears first.
//   4. Build the final question list by concatenating each matched
//      category's questions in order, deduplicating any near-identical
//      phrasing across categories.
//   5. If nothing scores above the threshold, return the GENERAL_FALLBACK
//      question set so the advisor still has something useful to ask.
//
// How to extend later:
//   - Add a new entry to CATEGORIES with { id, label, priority, keywords,
//     questions }. `keywords` accepts strings or RegExp. `priority` breaks
//     ties when two categories have the same match score.
//   - Each category should contribute 4-8 short, phone-friendly questions.
//   - Ready for future AI: generateQuestionsFromRequest can be swapped to
//     call an LLM while keeping the same return shape.

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

// lowercase + punctuation strip + whitespace collapse so keyword matches work
// regardless of how the advisor typed the request.
const normalise = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Test whether a single keyword (string or RegExp) is present in the text.
const matchesKeyword = (normalisedText, keyword) => {
  if (!keyword) return false;
  if (keyword instanceof RegExp) return keyword.test(normalisedText);
  const k = normalise(keyword);
  if (!k) return false;
  // word-boundary-ish: require surrounding space or edge, so "ac" doesn't
  // match "back" or "acceleration".
  const pattern = new RegExp(`(^|\\s)${k.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(\\s|$)`);
  return pattern.test(normalisedText);
};

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------
// Each category is tuned for workshop diagnostics. Keywords are intentionally
// broad (covers both UK/US spellings, common slang). Questions are short,
// natural to ask on a live phone call, and workshop-relevant.
//
// Ordering note: categories with a higher `priority` win ties when the score
// is identical. Use priority to surface the more actionable diagnosis first
// (e.g. "warning lights" is lower priority than a concrete system match).

const CATEGORIES = [
  {
    id: "ev_charging",
    label: "EV / Charging",
    priority: 9,
    keywords: [
      "ev", "electric vehicle", "hybrid charge", "charging", "charge",
      "not charging", "wont charge", "charge port", "charger", "charging cable",
      "ccs", "type 2", "rapid charge", "ac charge", "dc charge", "public charger",
      "home charger", "wallbox", "high voltage", "hv battery", "traction battery",
    ],
    questions: [
      "Is this related to the EV main (high-voltage) battery or the 12V battery?",
      "Does it fail to charge completely, or just charge more slowly than normal?",
      "Is it happening on home charging, public charging, or both?",
      "Any warning messages or lights showing on the dash?",
      "Is the charging cable locking into the port correctly?",
      "Has the vehicle been sat unused for a long period recently?",
      "Do you know the current state of charge shown on the dash?",
    ],
  },
  {
    id: "battery_starting",
    label: "12V Battery / Starting",
    priority: 8,
    keywords: [
      "battery", "12v", "flat battery", "dead battery", "wont start", "won't start",
      "not starting", "no start", "non start", "crank", "cranking", "turning over",
      "jump start", "jumpstart", "boost", "clicks", "clicking", "slow to start",
      "starter", "starter motor",
    ],
    questions: [
      "Does it crank over at all, or is it completely silent when you turn the key?",
      "Is the problem intermittent, or happening every time?",
      "Have you needed a jump start recently? If so, how many times?",
      "How old is the current battery, if known?",
      "Any warning lights on the dash before it failed to start?",
      "Does the vehicle sit unused for long periods?",
      "Any clicking noise when trying to start?",
    ],
  },
  {
    id: "warning_lights",
    label: "Warning Lights / Diagnostics",
    priority: 5,
    keywords: [
      "warning light", "warning lights", "dash light", "dashboard light",
      "engine light", "engine management light", "eml", "check engine",
      "malfunction light", "abs light", "airbag light", "srs", "epc",
      "traction control light", "esp light", "service light",
    ],
    questions: [
      "Which warning light has come on (colour and symbol if possible)?",
      "Is the light on permanently, or does it flash / come and go?",
      "When did it first appear — after fuelling, a service, cold start, etc.?",
      "Any change in how the car drives since the light came on?",
      "Any noises, smells, or smoke alongside the light?",
      "Is it still drivable at the moment?",
    ],
  },
  {
    id: "brakes",
    label: "Brakes",
    priority: 8,
    keywords: [
      "brake", "brakes", "braking", "brake noise", "brake pad", "brake pads",
      "brake disc", "brake discs", "grinding", "squealing", "squeaking",
      "brake judder", "brake shudder", "brake fluid", "abs", "handbrake",
      "parking brake", "caliper", "calliper",
    ],
    questions: [
      "Is the noise or issue from the front or the rear?",
      "Is it a grinding, squealing, knocking, or rubbing sound?",
      "Does it happen only when braking, or all the time?",
      "Any vibration through the pedal or steering wheel when braking?",
      "Has any recent brake work been done on the vehicle?",
      "Does the brake pedal feel soft, hard, or normal?",
      "Any brake warning light on the dash?",
    ],
  },
  {
    id: "clutch_gearbox",
    label: "Clutch / Gearbox / Transmission",
    priority: 8,
    keywords: [
      "clutch", "gearbox", "transmission", "gear change", "gears",
      "slipping", "clutch slipping", "wont go in gear", "stuck in gear",
      "crunching", "grinding gears", "manual", "automatic", "auto box",
      "dsg", "dual clutch", "torque converter", "shift", "shifting",
    ],
    questions: [
      "Is the vehicle manual or automatic?",
      "Does the issue happen in all gears, or only specific ones?",
      "Any unusual noise, vibration, or smell when changing gear?",
      "Does the clutch pedal feel normal, or is it heavy / low / stuck?",
      "Does it slip under acceleration or up a hill?",
      "Is it happening from cold, when warm, or both?",
      "Any warning lights on the dash (gearbox / transmission)?",
    ],
  },
  {
    id: "suspension_steering",
    label: "Suspension / Steering / Knocks",
    priority: 7,
    keywords: [
      "suspension", "steering", "knocking", "knock", "clunk", "clunking",
      "rattle", "rattling", "shock", "shocks", "strut", "spring",
      "drop link", "anti roll bar", "control arm", "wishbone", "bushing",
      "bush", "pulling", "pulls", "wandering", "steering wheel shake",
    ],
    questions: [
      "Is the noise from the front or rear, left or right?",
      "Does it happen over bumps, cornering, or when braking?",
      "Does the steering pull to one side at speed?",
      "Any vibration through the steering wheel or seat?",
      "Is the noise constant, or only in certain conditions (cold, wet)?",
      "Any recent pothole strike or kerbing?",
    ],
  },
  {
    id: "engine_performance",
    label: "Engine Performance",
    priority: 7,
    keywords: [
      "engine", "misfire", "misfiring", "rough idle", "rough running",
      "stalling", "cutting out", "hesitation", "loss of power", "no power",
      "lack of power", "flat spot", "juddering", "kangaroo", "limp mode",
      "limp home", "revving high", "revs up",
    ],
    questions: [
      "Is the problem constant, or only in certain conditions?",
      "Happens from cold, when warm, or both?",
      "Any loss of power or limp mode warning?",
      "Any change in fuel consumption lately?",
      "Any misfire, juddering, or hesitation on acceleration?",
      "Any smoke from the exhaust (white, blue, or black)?",
      "Engine management light on at the same time?",
    ],
  },
  {
    id: "cooling",
    label: "Overheating / Cooling",
    priority: 8,
    keywords: [
      "overheating", "overheat", "hot", "running hot", "coolant", "antifreeze",
      "temperature gauge", "temp gauge", "steam", "steaming", "boiling",
      "water leak", "coolant leak", "radiator", "thermostat", "water pump",
      "heater matrix",
    ],
    questions: [
      "How high is the temperature gauge going — halfway, into the red?",
      "Any coolant loss, leaks, or puddles under the car?",
      "Any steam or smell from under the bonnet?",
      "Does it overheat in traffic, at speed, or both?",
      "When was coolant last topped up, and with what?",
      "Any warning light or message on the dash?",
      "Is the cabin heater still giving hot air?",
    ],
  },
  {
    id: "hvac",
    label: "Air Conditioning / Heating",
    priority: 6,
    keywords: [
      "air con", "aircon", "a/c", "air conditioning", "ac not cold",
      "not blowing cold", "climate control", "heater", "heating",
      "no heat", "cold air", "blower", "fan", "hvac", "demist", "defrost",
    ],
    questions: [
      "Is it the air conditioning, the heating, or both?",
      "Is there any air flow from the vents at all?",
      "Does the fan work on all speed settings?",
      "When was the A/C last re-gassed, if known?",
      "Any unusual smell when the system is on?",
      "Does it work on some vents but not others?",
    ],
  },
  {
    id: "electrical",
    label: "Electrical Faults",
    priority: 6,
    keywords: [
      "electrical", "electric fault", "wiring", "fuse", "blown fuse",
      "lights not working", "headlight", "headlights", "indicator",
      "indicators", "wipers not working", "window not working",
      "central locking", "key fob", "remote not working", "dash flickering",
      "flickering", "screen not working", "infotainment", "radio",
    ],
    questions: [
      "Which electrical item is affected (lights, windows, locking, etc.)?",
      "Is the fault constant or intermittent?",
      "Does it happen only in damp / cold weather?",
      "Any warning lights or messages alongside it?",
      "Have any electrical accessories or aftermarket items been fitted recently?",
      "Has the battery been disconnected or replaced recently?",
    ],
  },
  {
    id: "service",
    label: "Service / Maintenance",
    priority: 5,
    keywords: [
      "service", "servicing", "oil change", "oil service", "annual service",
      "major service", "minor service", "service due", "service reminder",
      "interim service", "full service",
    ],
    questions: [
      "Is there a service reminder or message showing on the dash?",
      "Do you know the current mileage?",
      "When was the last service, and what was done?",
      "Any specific concerns to look at while it's in for service?",
      "Is a service book or digital service record available?",
      "Would you like any extras checked (brakes, tyres, wipers)?",
    ],
  },
  {
    id: "mot",
    label: "MOT",
    priority: 6,
    keywords: [
      "mot", "m.o.t", "mot test", "mot due", "mot expired", "mot failure",
      "advisories", "retest",
    ],
    questions: [
      "When does the current MOT expire?",
      "Is this a first MOT, a retest, or a regular annual test?",
      "Any known advisories or failures to address at the same time?",
      "Any warning lights currently on the dash?",
      "Any concerns with brakes, lights, or tyres you're already aware of?",
      "Would you like any remedial work done on the same visit if it fails?",
    ],
  },
  {
    id: "tyres",
    label: "Tyres / Puncture / Alignment",
    priority: 7,
    keywords: [
      "tyre", "tyres", "tire", "tires", "puncture", "flat tyre", "flat tire",
      "slow puncture", "alignment", "tracking", "wheel alignment",
      "tpms", "pressure", "balance", "wheel balance", "alloy", "alloys",
      "uneven wear",
    ],
    questions: [
      "Which tyre is affected — front or rear, offside or nearside?",
      "Is it a sudden flat, a slow puncture, or uneven wear?",
      "Any visible damage (nail, screw, sidewall cut, kerbing)?",
      "Does the car pull to one side when driving in a straight line?",
      "Any vibration through the steering wheel at speed?",
      "Is a TPMS / tyre pressure warning on the dash?",
      "Do you know the tyre size, or would you like us to check?",
    ],
  },
  {
    id: "dpf_emissions",
    label: "DPF / Emissions / AdBlue",
    priority: 8,
    keywords: [
      "dpf", "particulate filter", "adblue", "ad blue", "emissions",
      "emission", "egr", "regen", "regeneration", "diesel particulate",
      "nox", "scr", "exhaust smell", "blue smoke", "black smoke",
    ],
    questions: [
      "Which warning / message is showing (DPF, AdBlue, emissions)?",
      "Is the car mainly used for short trips, or longer motorway runs?",
      "When was AdBlue last topped up, if applicable?",
      "Any loss of power or limp mode with the warning?",
      "Any unusual exhaust smoke (black, blue, white)?",
      "Has a forced regen been attempted before?",
    ],
  },
  {
    id: "parking_cameras",
    label: "Parking Sensors / Cameras",
    priority: 5,
    keywords: [
      "parking sensor", "parking sensors", "pdc", "reversing camera",
      "reverse camera", "rear camera", "360 camera", "surround camera",
      "park assist", "park distance", "camera not working",
    ],
    questions: [
      "Which sensors or camera are affected — front, rear, or sides?",
      "Is there a constant beep, no beep, or an error message?",
      "Does the camera show a black screen, frozen image, or distorted image?",
      "Any recent bodywork repair or bumper damage?",
      "Does it happen only in rain or cold weather?",
      "Any warning light or message on the dash?",
    ],
  },
  {
    id: "intermittent",
    label: "Intermittent Faults / Noises",
    priority: 4,
    keywords: [
      "intermittent", "sometimes", "now and again", "comes and goes",
      "random", "occasional", "only sometimes", "cant replicate",
      "can't replicate", "unknown noise", "strange noise", "weird noise",
      "funny noise",
    ],
    questions: [
      "How often does it happen — daily, weekly, monthly?",
      "Can the customer reliably replicate it, or is it truly random?",
      "Cold start, warm, or both?",
      "Any specific conditions (wet, cold, bumps, turns, braking)?",
      "Is it a noise, a warning light, a drive feel, or something else?",
      "Any video or sound recording the customer could provide?",
    ],
  },
];

// Generic fallback when nothing matches — still useful so the advisor can
// capture the basics rather than hanging up with no questions.
const GENERAL_FALLBACK = {
  id: "general",
  label: "General",
  questions: [
    "When did the issue first start?",
    "Is it constant or intermittent?",
    "Does it happen only in certain conditions (cold, wet, at speed)?",
    "Any warning lights on the dash?",
    "Any unusual noises, smells, or vibrations?",
    "Has any recent work been done on the vehicle?",
    "Is it currently drivable and safe to use?",
  ],
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

// Score a single category against the normalised request text. We count every
// matching keyword (capped to avoid one very generic category dominating),
// which gives a natural preference to categories whose wording closely
// reflects the request.
const scoreCategory = (normalisedText, category) => {
  if (!normalisedText) return 0;
  let score = 0;
  for (const kw of category.keywords) {
    if (matchesKeyword(normalisedText, kw)) score += 1;
  }
  return score;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate question prompts for a given free-text request.
 *
 * @param {string} requestText  raw request text typed by the advisor
 * @param {object} [options]
 * @param {number} [options.maxCategories=3]  cap on how many categories to show
 * @param {number} [options.maxTotalQuestions=12]  cap on total questions across all groups
 * @returns {{ isFallback: boolean, matchedCategories: Array, groups: Array<{id,label,questions:string[]}> }}
 */
export function generateQuestionsFromRequest(requestText = "", options = {}) {
  const { maxCategories = 3, maxTotalQuestions = 12 } = options;
  const normalisedText = normalise(requestText);

  if (!normalisedText) {
    // Empty request → show fallback so the popup is still useful.
    return {
      isFallback: true,
      matchedCategories: [],
      groups: [
        {
          id: GENERAL_FALLBACK.id,
          label: GENERAL_FALLBACK.label,
          questions: [...GENERAL_FALLBACK.questions],
        },
      ],
    };
  }

  // Score every category, keep only the ones that actually hit.
  const scored = CATEGORIES.map((category) => ({
    category,
    score: scoreCategory(normalisedText, category),
  })).filter((entry) => entry.score > 0);

  if (scored.length === 0) {
    return {
      isFallback: true,
      matchedCategories: [],
      groups: [
        {
          id: GENERAL_FALLBACK.id,
          label: GENERAL_FALLBACK.label,
          questions: [...GENERAL_FALLBACK.questions],
        },
      ],
    };
  }

  // Sort: primary = match score desc, secondary = priority desc so the most
  // diagnostically useful category wins ties.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.category.priority || 0) - (a.category.priority || 0);
  });

  const topCategories = scored.slice(0, maxCategories);

  // Build groups and deduplicate questions (case-insensitive, whitespace
  // normalised) so two overlapping categories don't ask the same thing twice.
  const seen = new Set();
  const groups = [];
  let totalQuestions = 0;

  for (const { category } of topCategories) {
    if (totalQuestions >= maxTotalQuestions) break;
    const unique = [];
    for (const q of category.questions) {
      const key = normalise(q);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(q);
      totalQuestions += 1;
      if (totalQuestions >= maxTotalQuestions) break;
    }
    if (unique.length > 0) {
      groups.push({
        id: category.id,
        label: category.label,
        questions: unique,
      });
    }
  }

  return {
    isFallback: false,
    matchedCategories: topCategories.map(({ category, score }) => ({
      id: category.id,
      label: category.label,
      score,
    })),
    groups,
  };
}

// Exposed for unit tests / debugging.
export const __internals = { CATEGORIES, GENERAL_FALLBACK, normalise, scoreCategory };
