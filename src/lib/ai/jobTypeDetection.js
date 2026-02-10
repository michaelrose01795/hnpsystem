const normalizeText = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value = "") => {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(" ");
};

const levenshtein = (a = "", b = "") => {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  const matrix = Array.from({ length: aLen + 1 }, () => new Array(bLen + 1).fill(0));
  for (let i = 0; i <= aLen; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= aLen; i += 1) {
    for (let j = 1; j <= bLen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[aLen][bLen];
};

const tokenMatches = (token, tokens) => {
  if (tokens.includes(token)) return true;
  if (token.length < 4) return false;
  return tokens.some((candidate) => candidate.length >= 4 && levenshtein(token, candidate) <= 1);
};

const scorePhrase = (phraseTokens, textTokens) => {
  if (!phraseTokens.length) return 0;
  let matches = 0;
  phraseTokens.forEach((token) => {
    if (tokenMatches(token, textTokens)) matches += 1;
  });
  return matches / phraseTokens.length;
};

const uniq = (items) => Array.from(new Set(items.filter(Boolean)));

const buildPhrases = (parts, issues, prefixes = [""], suffixes = [""]) => {
  const phrases = [];
  prefixes.forEach((prefix) => {
    parts.forEach((part) => {
      issues.forEach((issue) => {
        suffixes.forEach((suffix) => {
          const phrase = `${prefix} ${part} ${issue} ${suffix}`.replace(/\s+/g, " ").trim();
          if (phrase) phrases.push(phrase);
        });
      });
    });
  });
  return phrases;
};

const REQUIRED_RULES = [
  {
    jobType: "EML",
    itemCategory: "ENGINE_EML",
    phrases: [
      "engine management light",
      "engine light",
      "eml light",
      "check engine",
      "malfunction indicator",
      "engine warning",
      "eml"
    ]
  },
  {
    jobType: "SERVICE",
    itemCategory: "SERVICE",
    phrases: [
      "service reminder",
      "service due",
      "service light",
      "service message",
      "service required",
      "service interval",
      "service schedule",
      "service warning"
    ]
  },
  {
    jobType: "TPMS",
    itemCategory: "WHEELS_TYRES",
    phrases: [
      "tpms light",
      "tyre pressure warning",
      "tire pressure warning",
      "tyre pressure light",
      "tyre pressure sensor",
      "tire pressure sensor",
      "low tyre pressure",
      "low tire pressure"
    ]
  },
  {
    jobType: "WIPERS",
    itemCategory: "WIPERS",
    phrases: [
      "wipers smearing",
      "wipers squeaking",
      "wipers not working",
      "wiper squeak",
      "wiper smear",
      "wipers streaking"
    ]
  },
  {
    jobType: "AUDIO",
    itemCategory: "AUDIO",
    phrases: [
      "radio not working",
      "radio dead",
      "audio not working",
      "speakers crackling",
      "speaker crackle",
      "infotainment audio",
      "no sound",
      "bluetooth audio"
    ]
  },
  {
    jobType: "HVAC_VENTS",
    itemCategory: "HVAC_VENTS",
    phrases: [
      "air vents broken",
      "vents stuck",
      "no air direction",
      "air direction not changing",
      "vent control",
      "vents not moving"
    ]
  },
  {
    jobType: "STEERING",
    itemCategory: "STEERING",
    phrases: [
      "steering wheel shaking",
      "steering wheel vibration",
      "steering wheel judder",
      "steering pull",
      "steering loose",
      "steering knocking"
    ]
  },
  {
    jobType: "SUSPENSION",
    itemCategory: "SUSPENSION",
    phrases: [
      "lower arm bush knocking",
      "control arm bush",
      "suspension knocking",
      "suspension clunk",
      "drop link knock",
      "shock absorber",
      "top mount",
      "spring broken"
    ]
  },
  {
    jobType: "NUMBER_PLATE",
    itemCategory: "EXTERIOR",
    phrases: [
      "number plate missing",
      "number plate broken",
      "plate missing",
      "plate broken",
      "number plate loose"
    ]
  },
  {
    jobType: "BODYWORK_REPAIR",
    itemCategory: "BODYWORK",
    phrases: [
      "bodywork repair",
      "bumper cracked",
      "panel damaged",
      "dent repair",
      "paint scratch",
      "trim broken off",
      "missing clips"
    ]
  },
  {
    jobType: "TRIM_INTERIOR",
    itemCategory: "INTERIOR_TRIM",
    phrases: [
      "interior trim",
      "trim rattling",
      "trim broken",
      "trim missing",
      "dashboard trim",
      "door trim"
    ]
  },
  {
    jobType: "TRIM_EXTERIOR",
    itemCategory: "EXTERIOR_TRIM",
    phrases: [
      "exterior trim",
      "trim broken",
      "trim missing",
      "arch trim",
      "side trim"
    ]
  },
  {
    jobType: "WHEELS_TYRES",
    itemCategory: "WHEELS_TYRES",
    phrases: [
      "tyre losing air",
      "tire losing air",
      "puncture",
      "flat tyre",
      "flat tire",
      "wheel vibration",
      "wheel balance",
      "wheel alignment",
      "alloy damaged"
    ]
  },
  {
    jobType: "BRAKES",
    itemCategory: "BRAKES",
    phrases: [
      "brake pads",
      "brake pad",
      "brake discs",
      "brake disc",
      "brake rotors",
      "brake rotor",
      "brakes worn",
      "brakes squealing",
      "brakes grinding",
      "brakes squeaking",
      "brakes binding",
      "brake noise",
      "brake light on",
      "brake warning light",
      "brake warning",
      "brake fluid",
      "brake fluid low",
      "brake fluid leak",
      "brake caliper",
      "brake calliper",
      "caliper sticking",
      "calliper sticking",
      "caliper seized",
      "calliper seized",
      "brake hose",
      "brake line",
      "brake pipe",
      "handbrake",
      "hand brake",
      "parking brake",
      "handbrake not holding",
      "parking brake not holding",
      "hub bearing",
      "wheel bearing",
      "wheel bearing noise",
      "hub assembly",
      "hub noisy",
      "hub rumble",
      "abs light",
      "abs warning",
      "abs sensor",
      "abs fault",
      "brake drum",
      "drum brakes",
      "brake shoes",
      "brake shoe"
    ]
  }
];

const PREFIXES = ["", "front", "rear", "offside", "nearside", "left", "right"];
const ISSUE_WORDS = [
  "noise",
  "noisy",
  "rattle",
  "rattling",
  "squeak",
  "squeaking",
  "clunk",
  "knocking",
  "vibration",
  "shaking",
  "loose",
  "stiff",
  "broken",
  "cracked",
  "missing",
  "damaged",
  "worn",
  "failed",
  "leaking",
  "not working",
  "intermittent",
  "slow",
  "sluggish",
  "warning light",
  "light on",
  "message",
  "alert"
];

const SUSPENSION_PARTS = [
  "suspension",
  "shock",
  "strut",
  "spring",
  "drop link",
  "anti roll bar",
  "control arm",
  "lower arm",
  "bush",
  "top mount",
  "damper",
  "wishbone"
];

const STEERING_PARTS = [
  "steering",
  "steering wheel",
  "rack",
  "track rod",
  "track rod end",
  "column",
  "power steering",
  "steering pump",
  "steering joint"
];

const AUDIO_PARTS = [
  "radio",
  "audio",
  "speaker",
  "speakers",
  "infotainment",
  "bluetooth",
  "carplay",
  "android auto",
  "amplifier"
];

const WIPER_PARTS = [
  "wiper",
  "wipers",
  "washer",
  "washer jet",
  "rear wiper",
  "front wiper"
];

const HVAC_PARTS = [
  "air vent",
  "vents",
  "vent control",
  "air direction",
  "fan",
  "blower",
  "climate",
  "heater",
  "air con",
  "ac"
];

const TRIM_PARTS = [
  "trim",
  "interior trim",
  "exterior trim",
  "dashboard trim",
  "door trim",
  "pillar trim",
  "boot trim",
  "console trim",
  "seat trim"
];

const BODYWORK_PARTS = [
  "bodywork",
  "bumper",
  "panel",
  "wing",
  "door",
  "tailgate",
  "bonnet",
  "boot",
  "paint",
  "scratch",
  "dent"
];

const TYRE_PARTS = [
  "tyre",
  "tire",
  "wheel",
  "alloy",
  "rim",
  "valve",
  "tpms",
  "puncture"
];

const BRAKE_PARTS = [
  "brake",
  "brakes",
  "brake pad",
  "brake pads",
  "brake disc",
  "brake discs",
  "brake rotor",
  "brake rotors",
  "brake caliper",
  "brake calliper",
  "caliper",
  "calliper",
  "brake hose",
  "brake line",
  "brake pipe",
  "brake fluid",
  "brake drum",
  "brake shoe",
  "brake shoes",
  "handbrake",
  "parking brake",
  "hub",
  "hub bearing",
  "wheel bearing",
  "hub assembly",
  "abs",
  "abs sensor"
];

const NUMBER_PLATE_PARTS = ["number plate", "registration plate", "plate"];

const GENERATED_RULES = [
  {
    jobType: "WHEELS_TYRES",
    itemCategory: "WHEELS_TYRES",
    phrases: uniq(buildPhrases(TYRE_PARTS, ISSUE_WORDS, PREFIXES))
  },
  {
    jobType: "SUSPENSION",
    itemCategory: "SUSPENSION",
    phrases: uniq(buildPhrases(SUSPENSION_PARTS, ISSUE_WORDS, PREFIXES))
  },
  {
    jobType: "STEERING",
    itemCategory: "STEERING",
    phrases: uniq(buildPhrases(STEERING_PARTS, ISSUE_WORDS, PREFIXES))
  },
  {
    jobType: "AUDIO",
    itemCategory: "AUDIO",
    phrases: uniq(buildPhrases(AUDIO_PARTS, ISSUE_WORDS, ["", "no", "fault"], [""]))
  },
  {
    jobType: "WIPERS",
    itemCategory: "WIPERS",
    phrases: uniq(buildPhrases(WIPER_PARTS, ISSUE_WORDS, ["", "front", "rear"], [""]))
  },
  {
    jobType: "HVAC_VENTS",
    itemCategory: "HVAC_VENTS",
    phrases: uniq(buildPhrases(HVAC_PARTS, ISSUE_WORDS, ["", "front", "rear"], [""]))
  },
  {
    jobType: "TRIM_INTERIOR",
    itemCategory: "INTERIOR_TRIM",
    phrases: uniq(buildPhrases(TRIM_PARTS, ISSUE_WORDS, ["interior", "cabin", ""], [""]))
  },
  {
    jobType: "TRIM_EXTERIOR",
    itemCategory: "EXTERIOR_TRIM",
    phrases: uniq(buildPhrases(TRIM_PARTS, ISSUE_WORDS, ["exterior", "body", ""], [""]))
  },
  {
    jobType: "BODYWORK_REPAIR",
    itemCategory: "BODYWORK",
    phrases: uniq(buildPhrases(BODYWORK_PARTS, ISSUE_WORDS, PREFIXES, ["repair", "fix"]))
  },
  {
    jobType: "NUMBER_PLATE",
    itemCategory: "EXTERIOR",
    phrases: uniq(buildPhrases(NUMBER_PLATE_PARTS, ISSUE_WORDS, ["", "front", "rear"], [""]))
  },
  {
    jobType: "BRAKES",
    itemCategory: "BRAKES",
    phrases: uniq(buildPhrases(BRAKE_PARTS, ISSUE_WORDS, PREFIXES))
  },
  {
    jobType: "SERVICE",
    itemCategory: "SERVICE",
    phrases: uniq(buildPhrases(["service", "maintenance", "oil"], ["due", "needed", "required", "reminder", "warning"], ["", "annual", "major", "minor"], [""]))
  }
];

const ALL_RULES = [...REQUIRED_RULES, ...GENERATED_RULES].map((rule) => ({
  ...rule,
  phrases: uniq(rule.phrases)
}));

const PHRASE_RULES = ALL_RULES.flatMap((rule) =>
  rule.phrases.map((phrase) => ({
    jobType: rule.jobType,
    itemCategory: rule.itemCategory,
    phrase,
    tokens: tokenize(phrase)
  }))
);

const complaintIndicators = [
  "noise",
  "noisy",
  "rattle",
  "rattling",
  "knock",
  "knocking",
  "clunk",
  "vibration",
  "shaking",
  "issue",
  "problem",
  "fault",
  "warning",
  "not working",
  "sluggish",
  "slow",
  "feels",
  "doesnt",
  "doesn't",
  "wont",
  "won't"
];

export const detectJobTypesForRequests = (requests = []) =>
  requests
    .map((request, index) => {
      const sourceText = typeof request === "string" ? request : request?.text || "";
      const trimmed = sourceText.trim();
      if (!trimmed) return null;

      const normalized = normalizeText(trimmed);
      const textTokens = tokenize(trimmed);

      let best = {
        jobType: "OTHER",
        itemCategory: "OTHER",
        confidence: 0,
        explanation: "No strong match",
        requestIndex: index,
        sourceText: trimmed
      };

      PHRASE_RULES.forEach((rule) => {
        if (!rule.tokens.length) return;
        let score = 0;
        if (normalized.includes(rule.phrase)) {
          score = 0.95;
        } else {
          score = scorePhrase(rule.tokens, textTokens);
        }
        if (score > best.confidence) {
          best = {
            jobType: rule.jobType,
            itemCategory: rule.itemCategory,
            confidence: score,
            explanation: `Matched phrase: ${rule.phrase}`,
            requestIndex: index,
            sourceText: trimmed
          };
        }
      });

      if (best.confidence < 0.45) {
        const hasComplaint = complaintIndicators.some((indicator) => normalized.includes(indicator));
        if (hasComplaint) {
          best = {
            jobType: "DIAGNOSIS",
            itemCategory: "DIAGNOSIS_GENERAL",
            confidence: 0.52,
            explanation: "Generic complaint detected",
            requestIndex: index,
            sourceText: trimmed
          };
        } else {
          best = {
            jobType: "OTHER",
            itemCategory: "OTHER",
            confidence: 0.4,
            explanation: "No strong match",
            requestIndex: index,
            sourceText: trimmed
          };
        }
      }

      return best;
    })
    .filter(Boolean);

export const detectionLibrarySize = PHRASE_RULES.length;
