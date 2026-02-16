// file location: src/lib/vhc/slotIdentity.js
const SLOT_CODE_MAP = { // Stable slot/base code map sourced from docs/vhc-area-code-map.md.
  wheels: { // Wheels & Tyres fixed slots.
    nsf: 100,
    osf: 110,
    nsr: 120,
    osr: 130,
    spare: 140,
  },
  brakes: { // Brakes & Hubs fixed slots.
    frontpads: 400,
    rearpads: 410,
    frontdiscs: 420,
    reardiscs: 430,
    reardrums: 440,
  },
  serviceFixed: { // Service Indicator fixed slots.
    servicechoice: 500,
    oilstatus: 510,
  },
  serviceConcerns: { // Service Indicator concern base codes.
    service: 520,
    oil: 530,
    antifreezestrength: 540,
    wateroil: 550,
    fluidleaks: 560,
    alternatorbeltbattery: 570,
    powersteeringfluid: 580,
    fuelsystem: 590,
    cambelt: 600,
    miscellaneous: 610,
    servicereminderoillevel: 620,
  },
  external: { // External category base codes.
    wiperswashershorn: 700,
    frontlights: 710,
    rearlights: 720,
    wheeltrim: 730,
    clutchtransmissionoperations: 740,
    numberplates: 750,
    doors: 760,
    trims: 770,
    miscellaneous: 780,
  },
  internal: { // Internal category base codes.
    interiorlights: 800,
    mediasystems: 810,
    airconheatingventilation: 820,
    warninglamps: 830,
    seatbelt: 840,
    miscellaneous: 850,
  },
  underside: { // Underside category base codes.
    exhaustsystemcatalyst: 900,
    steering: 910,
    frontsuspension: 920,
    rearsuspension: 930,
    driveshaftsoilleaks: 940,
    miscellaneous: 950,
  },
};

const SECTION_ALIASES = { // Section aliases to canonical buckets.
  wheelstyres: "wheels",
  wheelsandtyres: "wheels",
  wheels: "wheels",
  tyres: "wheels",
  brakeshubs: "brakes",
  brakes: "brakes",
  serviceindicatorandunderbonnet: "service",
  serviceindicatorunderbonnet: "service",
  serviceindicator: "service",
  external: "external",
  internal: "internal",
  internalelectrics: "internal",
  underside: "underside",
};

const WHITESPACE_RE = /\s+/g; // Reusable whitespace collapse regex.
const NON_ALNUM_RE = /[^a-z0-9 ]+/g; // Keep only letters/numbers/spaces.

export const normalizeTextForKey = (text) => { // Build deterministic key fragments from free text.
  const raw = String(text || "").toLowerCase().trim();
  if (!raw) return "";
  const cleaned = raw.replace(NON_ALNUM_RE, " ").replace(WHITESPACE_RE, " ").trim();
  return cleaned.slice(0, 120);
};

const normalizeToken = (text) => normalizeTextForKey(text).replace(WHITESPACE_RE, ""); // Tokenized form for map lookups.

const resolveSectionKey = (section) => { // Resolve section labels into one canonical bucket key.
  const token = normalizeToken(section);
  return SECTION_ALIASES[token] || null;
};

const resolveWheelsSlot = ({ subAreaKey, sourceKey, issueTitle, issueDescription }) => { // Resolve wheel slot code by best available signal.
  const joined = [subAreaKey, sourceKey, issueTitle, issueDescription]
    .map((value) => normalizeToken(value))
    .join(" ");
  if (joined.includes("nsf") || joined.includes("nearsidefront") || joined.includes("nearsidefrontwheel")) return SLOT_CODE_MAP.wheels.nsf;
  if (joined.includes("osf") || joined.includes("offsidefront")) return SLOT_CODE_MAP.wheels.osf;
  if (joined.includes("nsr") || joined.includes("nearsiderear")) return SLOT_CODE_MAP.wheels.nsr;
  if (joined.includes("osr") || joined.includes("offsiderear")) return SLOT_CODE_MAP.wheels.osr;
  if (joined.includes("spare") || joined.includes("repairkit") || joined.includes("spacesaver")) return SLOT_CODE_MAP.wheels.spare;
  return null;
};

const resolveBrakesSlot = ({ subAreaKey, sourceKey, issueTitle }) => { // Resolve brakes fixed slot code.
  const key = normalizeToken(subAreaKey || sourceKey || issueTitle);
  if (!key) return null;
  if (key.includes("frontpads")) return SLOT_CODE_MAP.brakes.frontpads;
  if (key.includes("rearpads")) return SLOT_CODE_MAP.brakes.rearpads;
  if (key.includes("frontdiscs")) return SLOT_CODE_MAP.brakes.frontdiscs;
  if (key.includes("reardiscs")) return SLOT_CODE_MAP.brakes.reardiscs;
  if (key.includes("reardrums") || key.includes("reardrum")) return SLOT_CODE_MAP.brakes.reardrums;
  return SLOT_CODE_MAP.brakes[key] ?? null;
};

const resolveServiceSlot = ({ subAreaKey, sourceKey, issueTitle }) => { // Resolve service fixed slot or concern base code.
  const subToken = normalizeToken(subAreaKey || sourceKey || issueTitle);
  if (!subToken) return null;
  if (subToken.includes("servicechoice") || subToken.includes("servicereminder") || subToken === "service") return SLOT_CODE_MAP.serviceFixed.servicechoice;
  if (subToken.includes("oilstatus") || subToken.includes("oillevel") || subToken === "oil") return SLOT_CODE_MAP.serviceFixed.oilstatus;
  return SLOT_CODE_MAP.serviceConcerns[subToken] ?? null;
};

const resolveCategoryBase = (bucket, { subAreaKey, sourceKey, issueTitle }) => { // Resolve category-list base slot code.
  const key = normalizeToken(subAreaKey || sourceKey || issueTitle);
  if (!key) return null;
  return SLOT_CODE_MAP[bucket]?.[key] ?? null;
};

export const getSlotCode = ({ section, subAreaKey, sourceKey, issueTitle, issueDescription } = {}) => { // Return stable slot/base code for one VHC row.
  const sectionKey = resolveSectionKey(section);
  if (!sectionKey) return null;
  if (sectionKey === "wheels") {
    return resolveWheelsSlot({ subAreaKey, sourceKey, issueTitle, issueDescription });
  }
  if (sectionKey === "brakes") {
    return resolveBrakesSlot({ subAreaKey, sourceKey, issueTitle });
  }
  if (sectionKey === "service") {
    return resolveServiceSlot({ subAreaKey, sourceKey, issueTitle });
  }
  return resolveCategoryBase(sectionKey, { subAreaKey, sourceKey, issueTitle });
};

const FIXED_SLOT_CODES = new Set([100, 110, 120, 130, 140, 400, 410, 420, 430, 440, 500, 510]); // Fixed slots use a single line_key.

export const makeLineKey = ({ type, issueText, extra } = {}) => { // Build deterministic line_key by item type.
  const normalizedIssue = normalizeTextForKey(issueText);
  const normalizedSource = normalizeTextForKey(extra?.source || extra?.sourceBucket || "");

  if (type === "fixed-slot") return "__slot__";
  if (type === "service-concern") {
    return `source:${normalizedSource || "unknown"}|issue:${normalizedIssue || "unknown"}`;
  }
  return `issue:${normalizedIssue || "unknown"}`;
};

export const resolveLineType = ({ slotCode, section, sourceBucket } = {}) => { // Resolve line identity mode for one row.
  if (FIXED_SLOT_CODES.has(Number(slotCode))) return "fixed-slot";
  const sectionKey = resolveSectionKey(section);
  if (sectionKey === "service" && normalizeTextForKey(sourceBucket)) return "service-concern";
  return "category-list";
};
