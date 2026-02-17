// file location: src/lib/vhc/faultTaxonomy.js

const MIN_COMPONENTS_PER_SECTION = 30;
const MAX_COMPONENTS_PER_SECTION = 120;
const MIN_SUGGESTIONS_PER_SECTION = 1000;

const normaliseText = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase();

const dedupeStrings = (items = []) => {
  const seen = new Set();
  const result = [];
  items.forEach((item) => {
    const value = item.toString().trim();
    if (!value) return;
    const key = normaliseText(value);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });
  return result;
};

export const LOCATION_SETS = {
  NONE: [],
  FRONT_REAR: ["front", "rear"],
  NS_OS: ["near_side", "off_side"],
  NSF_OSF_NSR_OSR: ["nsf", "osf", "nsr", "osr"],
  FRONT_WITH_NS_OS: ["front", "nsf", "osf", "near_side", "off_side"],
  REAR_WITH_NS_OS: ["rear", "nsr", "osr", "near_side", "off_side"],
  FRONT_REAR_WITH_CORNERS: ["front", "rear", "nsf", "osf", "nsr", "osr", "near_side", "off_side"],
};

const LOCATION_DISPLAY = {
  front: ["Front"],
  rear: ["Rear"],
  near_side: ["Near Side"],
  off_side: ["Off Side"],
  nsf: ["N/S/F", "Near Side Front"],
  osf: ["O/S/F", "Off Side Front"],
  nsr: ["N/S/R", "Near Side Rear"],
  osr: ["O/S/R", "Off Side Rear"],
};

const LOCATION_NORMALIZER_MAP = {
  ns: "near side",
  os: "off side",
  "n/s": "near side",
  "o/s": "off side",
  nsf: "near side front",
  osf: "off side front",
  nsr: "near side rear",
  osr: "off side rear",
  "n/s/f": "near side front",
  "o/s/f": "off side front",
  "n/s/r": "near side rear",
  "o/s/r": "off side rear",
};

const TOKEN_PREDICTIONS = {
  wiper: ["front", "rear", "blade", "motor", "jet", "washer"],
  brake: ["pad", "disc", "caliper", "front", "rear"],
  pad: ["front", "rear", "brake", "low"],
  disc: ["front", "rear", "lipped", "scored"],
  bush: ["front", "rear", "d-bush", "drop link"],
  suspension: ["front", "rear", "bush", "drop link", "shock"],
};

const ACTION_PHRASE_VARIANTS = {
  replace: ["requires replacing", "replacement required", "replacement recommended"],
  clean: ["requires cleaning", "cleaning required", "cleaning recommended"],
  adjust: ["requires adjustment", "adjustment required"],
  diagnose: ["requires diagnosis", "diagnosis required", "further diagnosis advised"],
  inspect: ["requires inspection", "inspection advised", "further checks advised"],
  repair: ["requires repair", "repair required", "repair recommended"],
  lubricate: ["requires lubrication", "lubrication required"],
  align: ["requires alignment", "alignment required", "alignment check advised"],
  secure: ["requires securing", "securing required"],
};

const SENTENCE_TEMPLATES = [
  ({ locationPrefix, componentName, symptomPhrase, actionPhrase }) => `${locationPrefix}${componentName} ${symptomPhrase}, ${actionPhrase}`,
  ({ locationPrefix, componentName, symptomPhrase, actionPhrase }) => `${locationPrefix}${componentName} showing ${symptomPhrase}, ${actionPhrase}`,
  ({ locationPrefix, componentName, symptomPhrase, actionPhrase }) => `${symptomPhrase} found on ${locationPrefix}${componentName}, ${actionPhrase}`,
  ({ locationPrefix, componentName, symptomPhrase, actionPhrase }) => `${locationPrefix}${componentName} ${symptomPhrase}, ${actionPhrase}`,
  ({ locationPrefix, componentName, symptomPhrase, actionPhrase }) => `${locationPrefix}${componentName}, ${symptomPhrase}, ${actionPhrase}`,
  ({ locationPrefix, componentName, symptomPhrase, actionPhrase }) => `${locationPrefix}${componentName} noted ${symptomPhrase}, ${actionPhrase}`,
  ({ locationPrefix, componentName, symptomPhrase, actionPhrase }) => `${locationPrefix}${componentName} has ${symptomPhrase}; ${actionPhrase}`,
  ({ locationPrefix, componentName, symptomPhrase, actionPhrase }) => `${locationPrefix}${componentName} ${symptomPhrase} - ${actionPhrase}`,
];

const SYMPTOM_GROUPS = {
  wiperBlade: [
    {
      id: "split_perished",
      phrases: ["split", "torn", "perished"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["replace"],
      actionByPhrase: { split: "replace", torn: "replace", perished: "replace" },
      symptomPriority: 10,
      notesTemplates: ["replacement recommended for safe visibility"],
    },
    {
      id: "smear_streak",
      phrases: ["smeared", "streaking", "smearing"],
      severityAllowed: ["Amber"],
      actionsAllowed: ["replace"],
      actionByPhrase: { smeared: "replace", streaking: "replace", smearing: "replace" },
      symptomPriority: 9,
      notesTemplates: ["wipe quality below standard"],
    },
    {
      id: "noisy_blade",
      phrases: ["noisy operation", "juddering"],
      severityAllowed: ["Green", "Amber"],
      actionsAllowed: ["inspect"],
      actionByPhrase: { "noisy operation": "inspect", juddering: "inspect" },
      symptomPriority: 6,
      notesTemplates: ["check arm pressure and glass condition"],
    },
  ],
  washerJet: [
    {
      id: "blocked",
      phrases: ["blocked", "partially blocked"],
      severityAllowed: ["Amber"],
      actionsAllowed: ["clean"],
      actionByPhrase: { blocked: "clean", "partially blocked": "clean" },
      symptomPriority: 9,
      notesTemplates: ["clear blockage and retest spray pattern"],
    },
    {
      id: "weak_misaligned",
      phrases: ["weak spray", "misaligned spray", "poor spray pattern"],
      severityAllowed: ["Green", "Amber"],
      actionsAllowed: ["clean", "adjust"],
      actionByPhrase: { "weak spray": "clean", "misaligned spray": "adjust", "poor spray pattern": "adjust" },
      symptomPriority: 8,
      notesTemplates: ["adjust nozzle aim after cleaning"],
    },
    {
      id: "inoperative",
      phrases: ["inoperative", "no spray output"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["diagnose", "repair"],
      actionByPhrase: { inoperative: "diagnose", "no spray output": "diagnose" },
      symptomPriority: 8,
      notesTemplates: ["check pump and feed hose"],
    },
  ],
  wiperLinkage: [
    {
      id: "binding_play",
      phrases: ["binding", "excess play", "stiff operation"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["inspect", "repair", "lubricate"],
      actionByPhrase: { binding: "repair", "excess play": "repair", "stiff operation": "lubricate" },
      symptomPriority: 8,
      notesTemplates: ["inspect linkage pivots and joints"],
    },
  ],
  wiperMotor: [
    {
      id: "motor_fault",
      phrases: ["inoperative", "intermittent", "slow operation"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["diagnose", "replace"],
      actionByPhrase: { inoperative: "diagnose", intermittent: "diagnose", "slow operation": "diagnose" },
      symptomPriority: 8,
      notesTemplates: ["confirm supply and earth before replacement"],
    },
  ],
  horn: [
    {
      id: "horn_fault",
      phrases: ["inoperative", "intermittent", "weak tone"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["diagnose", "replace"],
      actionByPhrase: { inoperative: "diagnose", intermittent: "diagnose", "weak tone": "replace" },
      symptomPriority: 7,
      notesTemplates: ["check horn feed and switch circuit"],
    },
  ],
  lightBulb: [
    {
      id: "bulb_failed",
      phrases: ["blown", "failed", "inoperative"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["replace", "diagnose"],
      actionByPhrase: { blown: "replace", failed: "replace", inoperative: "diagnose" },
      symptomPriority: 10,
      notesTemplates: ["replace bulb and confirm operation"],
    },
    {
      id: "flicker_dim",
      phrases: ["flickering", "dim output"],
      severityAllowed: ["Amber"],
      actionsAllowed: ["diagnose", "replace"],
      actionByPhrase: { flickering: "diagnose", "dim output": "replace" },
      symptomPriority: 8,
      notesTemplates: ["check holder contact and supply"],
    },
  ],
  lightAssembly: [
    {
      id: "lens_housing",
      phrases: ["cracked", "water ingress", "condensation present"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["replace", "repair"],
      actionByPhrase: { cracked: "replace", "water ingress": "repair", "condensation present": "repair" },
      symptomPriority: 7,
      notesTemplates: ["reseal or replace assembly"],
    },
    {
      id: "aim_alignment",
      phrases: ["misaligned", "poor beam aim"],
      severityAllowed: ["Green", "Amber"],
      actionsAllowed: ["adjust", "align"],
      actionByPhrase: { misaligned: "adjust", "poor beam aim": "align" },
      symptomPriority: 6,
      notesTemplates: ["set beam alignment to spec"],
    },
  ],
  bush: [
    {
      id: "bush_wear",
      phrases: ["worn", "split", "excess movement", "perished"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["replace"],
      actionByPhrase: { worn: "replace", split: "replace", "excess movement": "replace", perished: "replace" },
      symptomPriority: 10,
      notesTemplates: ["replace bush and retorque suspension bolts"],
    },
  ],
  dropLink: [
    {
      id: "drop_link_play",
      phrases: ["excessive play", "knocking", "clunking"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["replace"],
      actionByPhrase: { "excessive play": "replace", knocking: "replace", clunking: "replace" },
      symptomPriority: 9,
      notesTemplates: ["replace link pair if wear is similar"],
    },
  ],
  ballJoint: [
    {
      id: "ball_joint_play",
      phrases: ["excessive play", "worn", "split boot"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["replace"],
      actionByPhrase: { "excessive play": "replace", worn: "replace", "split boot": "replace" },
      symptomPriority: 9,
      notesTemplates: ["alignment check after replacement"],
    },
  ],
  shockAbsorber: [
    {
      id: "shock_leak",
      phrases: ["leaking", "oil leak", "weak damping"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["replace"],
      actionByPhrase: { leaking: "replace", "oil leak": "replace", "weak damping": "replace" },
      symptomPriority: 9,
      notesTemplates: ["replace in axle pair"],
    },
  ],
  brakePad: [
    {
      id: "pad_low",
      phrases: ["low", "below minimum", "worn low"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["replace"],
      actionByPhrase: { low: "replace", "below minimum": "replace", "worn low": "replace" },
      symptomPriority: 10,
      notesTemplates: ["record pad thickness and replace"],
    },
  ],
  brakeDisc: [
    {
      id: "disc_surface",
      phrases: ["lipped", "scored", "warped"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["replace"],
      actionByPhrase: { lipped: "replace", scored: "replace", warped: "replace" },
      symptomPriority: 9,
      notesTemplates: ["replace discs and check runout"],
    },
  ],
  tyre: [
    {
      id: "tread_low",
      phrases: ["low tread", "below legal tread", "worn"],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["replace"],
      actionByPhrase: { "low tread": "replace", "below legal tread": "replace", worn: "replace" },
      symptomPriority: 10,
      notesTemplates: ["replace tyre and set pressures"],
    },
    {
      id: "tyre_wear_pattern",
      phrases: ["uneven wear", "inner edge wear", "outer edge wear"],
      severityAllowed: ["Amber"],
      actionsAllowed: ["align", "inspect"],
      actionByPhrase: { "uneven wear": "align", "inner edge wear": "align", "outer edge wear": "align" },
      symptomPriority: 8,
      notesTemplates: ["investigate alignment and suspension geometry"],
    },
    {
      id: "tyre_damage",
      phrases: [
        "cut",
        "sidewall damage",
        "puncture",
        "nail in tyre",
        "screw in tyre",
        "foreign object in tyre",
      ],
      severityAllowed: ["Amber", "Red"],
      actionsAllowed: ["replace", "repair"],
      actionByPhrase: {
        cut: "replace",
        "sidewall damage": "replace",
        puncture: "repair",
        "nail in tyre": "repair",
        "screw in tyre": "repair",
        "foreign object in tyre": "repair",
      },
      symptomPriority: 8,
      notesTemplates: ["inspect casing integrity", "remove object and assess repair zone"],
    },
  ],
  defaultMechanical: [
    {
      id: "general_wear",
      phrases: ["worn", "damaged", "loose", "intermittent", "inoperative"],
      severityAllowed: ["Green", "Amber", "Red"],
      actionsAllowed: ["inspect", "repair", "replace", "diagnose", "secure"],
      actionByPhrase: { worn: "inspect", damaged: "repair", loose: "secure", intermittent: "diagnose", inoperative: "diagnose" },
      symptomPriority: 5,
      notesTemplates: ["further workshop checks advised"],
    },
  ],
};

const SECTION_BASE_COMPONENTS = {
  external_wipers_washers_horn: {
    sectionTitle: "Wipers/Washers/Horn",
    locations: LOCATION_SETS.FRONT_REAR_WITH_CORNERS,
    components: [
      "Wiper blade",
      "Wiper blades",
      "Wiper arm",
      "Wiper linkage",
      "Wiper motor",
      "Wiper relay",
      "Wiper spindle",
      "Wiper mechanism",
      "Windscreen washer jet",
      "Washer jets",
      "Washer nozzle",
      "Washer pump",
      "Washer bottle",
      "Washer hose",
      "Washer feed line",
      "Washer non-return valve",
      "Rear washer jet",
      "Rear washer feed",
      "Horn",
      "Horn switch",
      "Horn relay",
      "Horn wiring",
      "Horn connector",
      "Steering wheel horn contact",
      "Wiper stalk",
      "Wiper blade edge",
      "Wiper blade rubber",
      "Wiper park position",
      "Washer filter",
      "Windscreen washer system",
    ],
  },
  external_front_lights: {
    sectionTitle: "Front Lights",
    locations: LOCATION_SETS.FRONT_WITH_NS_OS,
    components: [
      "Headlight bulb",
      "Dipped beam bulb",
      "Main beam bulb",
      "Front indicator bulb",
      "Front side light bulb",
      "Front fog light bulb",
      "H1 bulb",
      "H4 bulb",
      "H7 bulb",
      "H11 bulb",
      "HB3 bulb",
      "HB4 bulb",
      "D1S bulb",
      "D2S bulb",
      "D3S bulb",
      "D4S bulb",
      "W5W bulb",
      "PY21W bulb",
      "P21/5W bulb",
      "LED headlight module",
      "LED DRL module",
      "Headlamp lens",
      "Headlamp housing",
      "Headlamp wiring",
      "Headlamp connector",
      "Headlamp levelling motor",
      "Headlight ballast",
      "Headlight control module",
      "Front bulb holder",
      "Headlamp aim",
      "Front lamp loom",
      "Front lamp earth",
      "Front lighting circuit",
    ],
  },
  external_rear_lights: {
    sectionTitle: "Rear lights",
    locations: LOCATION_SETS.REAR_WITH_NS_OS,
    components: [
      "Tail light bulb",
      "Brake light bulb",
      "High level brake light bulb",
      "Rear indicator bulb",
      "Reverse light bulb",
      "Rear fog light bulb",
      "P21W bulb",
      "P21/5W bulb",
      "PY21W bulb",
      "W5W bulb",
      "R5W bulb",
      "H21W bulb",
      "LED rear light module",
      "LED brake light module",
      "LED rear indicator module",
      "Rear lamp lens",
      "Rear lamp housing",
      "Rear lamp wiring",
      "Rear lamp connector",
      "Rear bulb holder",
      "Rear light seal",
      "Tailgate lamp loom",
      "Rear lamp bracket",
      "Rear light earth",
      "Rear light cluster",
      "Rear lamp module",
      "Rear lens cover",
      "Rear lighting circuit",
      "Number plate lamp circuit",
      "Boot light circuit",
    ],
  },
  external_wheel_trim: {
    sectionTitle: "Wheel Trim",
    locations: LOCATION_SETS.NONE,
    components: [
      "Wheel trim",
      "Wheel cover",
      "Hub cap",
      "Alloy trim ring",
      "Trim retaining clip",
      "Trim locking ring",
      "Trim centre cap",
      "Wheel trim finish",
      "Wheel trim edge",
      "Trim fastener",
      "Wheel trim mount",
      "Trim locating tab",
      "Wheel trim bracket",
      "Decorative wheel trim",
      "Wheel trim coating",
      "Wheel trim paint",
      "Wheel trim insert",
      "Wheel trim retaining lug",
      "Wheel trim tab",
      "Wheel trim fitment",
      "Wheel trim retainer",
      "Wheel trim clip seat",
      "Wheel trim face",
      "Wheel trim ring",
      "Wheel trim lock",
      "Wheel trim tab seat",
      "Wheel trim centre ring",
      "Wheel trim cover edge",
      "Wheel trim support",
      "Wheel trim plate",
    ],
  },
  external_clutch_transmission_operations: {
    sectionTitle: "Clutch/Transmission operations",
    locations: LOCATION_SETS.NONE,
    components: [
      "Clutch pedal",
      "Clutch master cylinder",
      "Clutch slave cylinder",
      "Clutch hydraulics",
      "Clutch release bearing",
      "Clutch bite point",
      "Gear linkage",
      "Gear lever",
      "Transmission operation",
      "Transmission mount",
      "Drive engagement",
      "Synchromesh",
      "Shift cable",
      "Shift mechanism",
      "Gear selector",
      "Clutch switch",
      "Hydraulic clutch line",
      "Transmission casing",
      "Gearbox input",
      "Gearbox output",
      "Shift fork movement",
      "Dual-mass flywheel response",
      "Clutch return spring",
      "Clutch pressure plate",
      "Clutch friction plate",
      "Clutch fork",
      "Selector shaft",
      "Gearbox support",
      "Gear engagement hub",
      "Clutch release arm",
    ],
  },
  external_number_plates: {
    sectionTitle: "Number plates",
    locations: LOCATION_SETS.FRONT_REAR,
    components: [
      "Number plate",
      "Number plate bracket",
      "Number plate fixings",
      "Number plate screws",
      "Number plate adhesive",
      "Number plate surround",
      "Number plate lamp",
      "Number plate lamp lens",
      "Number plate backing",
      "Plate mounting points",
      "Plate trim",
      "Plate holder",
      "Registration plate",
      "Plate retaining clips",
      "Plate fasteners",
      "Plate panel",
      "Plate mounting frame",
      "Plate lamp wiring",
      "Plate lamp connector",
      "Plate lamp seal",
      "Front plate mount",
      "Rear plate mount",
      "Plate support",
      "Plate carrier",
      "Plate lamp housing",
      "Plate lamp holder",
      "Plate holder bracket",
      "Plate holder clips",
      "Plate lamp earth",
      "Plate lamp circuit",
    ],
  },
  external_doors: {
    sectionTitle: "Doors",
    locations: LOCATION_SETS.FRONT_REAR_WITH_CORNERS,
    components: [
      "Door hinge",
      "Door latch",
      "Door lock",
      "Door handle",
      "Door seal",
      "Door check strap",
      "Door striker",
      "Door alignment",
      "Door trim panel",
      "Door weather strip",
      "Door frame",
      "Door glass",
      "Door regulator",
      "Door wiring loom",
      "Door mirror mount",
      "Door card clips",
      "Door aperture seal",
      "Door closing action",
      "Tailgate door",
      "Sliding door mechanism",
      "Door lock barrel",
      "Door release cable",
      "Door lock actuator",
      "Door latch cable",
      "Door inner handle",
      "Door outer handle",
      "Door check arm",
      "Door stopper",
      "Door mount",
      "Door pillar striker",
    ],
  },
  external_trims: {
    sectionTitle: "Trims",
    locations: LOCATION_SETS.FRONT_REAR_WITH_CORNERS,
    components: [
      "Exterior trim",
      "Door trim",
      "Sill trim",
      "Bumper trim",
      "Wheel arch trim",
      "Roof trim",
      "Window trim",
      "Pillar trim",
      "Tailgate trim",
      "Bonnet trim",
      "Trim clips",
      "Trim fasteners",
      "Trim moulding",
      "Chrome trim",
      "Black trim insert",
      "Plastic trim panel",
      "Trim seal",
      "Trim edge",
      "Trim adhesive",
      "Trim bracket",
      "Trim mounting tab",
      "Body side moulding",
      "Front grille trim",
      "Rear diffuser trim",
      "Trim support",
      "Trim carrier",
      "Trim corner section",
      "Trim joint",
      "Trim retaining rail",
      "Trim anchor",
    ],
  },
  external_miscellaneous: {
    sectionTitle: "External Miscellaneous",
    locations: LOCATION_SETS.FRONT_REAR_WITH_CORNERS,
    components: [
      "Door seal",
      "Door weather seal",
      "Door aperture weatherstrip",
      "Door edge seal",
      "Door lower seal",
      "Door upper seal",
      "Door seal retainer",
      "Door seal clip",
      "Front door seal",
      "Rear door seal",
      "Tailgate seal",
      "Tailgate weatherstrip",
      "Tailgate aperture seal",
      "Boot lid seal",
      "Boot opening seal",
      "Bonnet seal",
      "Bonnet weatherstrip",
      "Bonnet edge seal",
      "Scuttle panel",
      "Scuttle trim",
      "Cowl panel",
      "Cowl top grille",
      "Plenum cover",
      "Fuel filler flap",
      "Fuel filler flap hinge",
      "Fuel flap release",
      "Fuel cap tether",
      "Fuel cap seal",
      "Fuel filler neck surround",
      "Tow eye cover",
      "Tow bar cover",
      "Tow socket flap",
      "External antenna base",
      "Aerial mast",
      "Aerial gasket",
      "Rain channel trim",
      "Roof gutter trim",
      "Roof drip rail trim",
      "Body side protector",
      "Mud flap",
      "Stone guard",
      "Splash guard",
      "Outer sill protector",
      "Body edge protector",
      "Paint protection film edge",
      "Door edge protector",
      "Tailgate handle trim",
      "Rear camera bezel",
      "Roof rail end cap",
      "Exterior mounting clip",
      "Front bumper insert",
      "Rear bumper insert",
      "Bumper corner trim",
      "Bumper lower valance",
      "Front grille badge mount",
      "Front grille clip",
      "Grille shutter panel",
      "Number plate plinth",
      "Front spoiler lip",
      "Rear spoiler trim",
      "Roof spoiler seal",
      "Wheel arch lip protector",
      "Wheel arch liner edge",
      "Headlamp washer cap",
      "Headlamp washer jet cover",
      "Wing mirror base trim",
      "Mirror base gasket",
      "Mirror indicator lens",
      "Mirror housing cap",
      "A pillar exterior trim",
      "B pillar exterior trim",
      "C pillar exterior trim",
      "Quarter panel trim",
      "Quarter window surround",
      "Window waist trim",
      "Window rubber channel",
      "Windscreen outer trim",
      "Windscreen scuttle seal",
      "Rear screen outer trim",
      "Rear screen seal",
      "Sunroof perimeter seal",
      "Sunroof drain outlet",
      "Sunroof wind deflector",
      "Convertible roof seal",
      "Door handle surround",
      "Keyless entry sensor pad",
      "Body moulding clip",
      "Side skirt fixing",
      "Side skirt end cap",
      "Running board trim",
      "Step board end trim",
      "Rear diffuser clip",
      "Exhaust finisher surround",
      "Tailpipe trim bezel",
      "Rear parking sensor bezel",
      "Front parking sensor bezel",
      "Front camera cover",
      "Rear camera washer cover",
      "Badge adhesive area",
      "Emblem mounting pin",
      "Panel edge seam sealer",
      "Exterior seam sealer",
      "Door shut panel trim",
      "Door check strap cover",
      "Door latch cover cap",
      "Tailgate strut ball cap",
      "Bonnet stay clip",
      "Bonnet latch cover",
      "Bonnet safety catch cover",
      "Wiper arm nut cap",
      "Wiper arm spindle cap",
      "Screen washer fill cap",
      "External trim screw cover",
      "Under mirror puddle lens",
      "Bumper to wing bracket",
      "Bumper guide rail",
      "Wheel arch extension trim",
      "Skid plate trim",
      "Lower grille finisher",
      "Front valance clip",
      "Rear valance clip",
      "Body plug external",
      "Body aperture grommet external",
      "Drain channel blocker",
      "Exterior accessory mount",
      "Roof bar mounting cover",
      "Roof rail mounting seal",
      "Tailgate threshold trim",
      "Boot threshold protector",
      "Loading sill protector",
      "External protective coating area",
      "Painted trim insert",
      "Unpainted trim insert",
      "Exterior clip retainer",
      "Exterior anti-rattle pad",
      "Exterior panel isolator",
    ],
  },
  internal_interior_lights: {
    sectionTitle: "Interior Lights",
    locations: LOCATION_SETS.NONE,
    components: [
      "Interior lights",
      "Map light",
      "Cabin light",
      "Dome light",
      "Footwell light",
      "Glovebox light",
      "Boot light",
      "Courtesy light",
      "Reading light",
      "Sun visor mirror light",
      "Ambient light strip",
      "Interior light switch",
      "Interior light lens",
      "Interior bulb holder",
      "Interior light module",
      "Interior light wiring",
      "Interior light connector",
      "Door-triggered light circuit",
      "Roof light assembly",
      "Rear cabin lamp",
      "Vanity light circuit",
      "Cargo area light",
      "Interior lamp fuse",
      "Interior lamp relay",
      "Interior lamp harness",
      "Interior lamp mount",
      "Interior lamp housing",
      "Interior lamp contact",
      "Interior lamp connector pin",
      "Interior lamp earth",
    ],
  },
  internal_media_systems: {
    sectionTitle: "Media Systems",
    locations: LOCATION_SETS.NONE,
    components: [
      "Media system",
      "Infotainment unit",
      "Radio",
      "Touchscreen",
      "Navigation system",
      "Bluetooth module",
      "USB port",
      "AUX input",
      "DAB tuner",
      "Amplifier",
      "Speaker",
      "Steering audio controls",
      "Media control panel",
      "Display backlight",
      "Screen digitizer",
      "Audio wiring",
      "Microphone input",
      "CarPlay interface",
      "Android Auto interface",
      "Media software",
      "Media reboot function",
      "Media power supply",
      "Head unit",
      "Rear media controls",
      "Subwoofer",
      "Media CAN line",
      "Media antenna",
      "Media earth point",
      "Media harness",
      "Media connector",
    ],
  },
  internal_air_con_heating_ventilation: {
    sectionTitle: "Air Con/Heating/ventilation",
    locations: LOCATION_SETS.FRONT_REAR,
    components: [
      "Air conditioning system",
      "A/C compressor",
      "A/C condenser",
      "A/C evaporator",
      "A/C lines",
      "Heater matrix",
      "Heater blower",
      "Heater controls",
      "Ventilation fan",
      "Cabin vents",
      "Climate control panel",
      "Blend flap motor",
      "Recirculation flap",
      "Pollen filter",
      "Cabin air filter",
      "A/C pressure sensor",
      "A/C clutch",
      "Heater valve",
      "Demister output",
      "Rear vent output",
      "Temperature sensor",
      "HVAC module",
      "HVAC wiring",
      "Heated screen feed",
      "Air distribution flap",
      "A/C control panel",
      "HVAC actuator",
      "HVAC harness",
      "HVAC connector",
      "HVAC fuse",
    ],
  },
  internal_warning_lamps: {
    sectionTitle: "Warning Lamps",
    locations: LOCATION_SETS.NONE,
    components: [
      "Warning lamps",
      "Engine warning lamp",
      "ABS warning lamp",
      "Airbag warning lamp",
      "Battery warning lamp",
      "Brake warning lamp",
      "Oil pressure warning lamp",
      "Coolant warning lamp",
      "TPMS warning lamp",
      "AdBlue warning lamp",
      "Glow plug lamp",
      "Traction control lamp",
      "Dashboard warning display",
      "Instrument cluster",
      "Cluster backlight",
      "Cluster PCB",
      "Warning lamp circuit",
      "MIL indicator",
      "Service warning lamp",
      "Transmission warning lamp",
      "Power steering warning lamp",
      "Immobiliser lamp",
      "Cluster warning bus",
      "Cluster warning input",
      "Cluster warning output",
      "Cluster warning harness",
      "Cluster warning connector",
      "Cluster warning feed",
      "Cluster warning earth",
      "Cluster warning logic",
    ],
  },
  internal_seatbelt: {
    sectionTitle: "Seatbelt",
    locations: LOCATION_SETS.FRONT_REAR_WITH_CORNERS,
    components: [
      "Seatbelt",
      "Seatbelt buckle",
      "Seatbelt pretensioner",
      "Seatbelt retractor",
      "Seatbelt latch",
      "Seatbelt webbing",
      "Seatbelt anchor",
      "Seatbelt height adjuster",
      "Seatbelt warning switch",
      "Seatbelt guide",
      "Seatbelt tongue",
      "Seatbelt locking mechanism",
      "Seatbelt tensioner wiring",
      "Seatbelt mounting bolt",
      "Seatbelt trim surround",
      "Seatbelt spool",
      "Center seatbelt",
      "Isofix belt anchor",
      "Seatbelt lower anchor",
      "Seatbelt upper anchor",
      "Seatbelt pillar guide",
      "Seatbelt mount plate",
      "Seatbelt buckle switch",
      "Seatbelt harness",
      "Seatbelt connector",
      "Seatbelt clip",
      "Seatbelt retainer",
      "Seatbelt slider",
      "Seatbelt stop",
      "Seatbelt mount",
    ],
  },
  internal_miscellaneous: {
    sectionTitle: "Internal Miscellaneous",
    locations: LOCATION_SETS.FRONT_REAR_WITH_CORNERS,
    components: [
      "Cabin trim panel",
      "Dashboard trim",
      "Center console trim",
      "Glovebox latch",
      "Glovebox hinge",
      "Armrest",
      "Armrest latch",
      "Sun visor",
      "Sun visor clip",
      "Sun visor mirror",
      "Grab handle",
      "Headlining",
      "A pillar trim",
      "B pillar trim",
      "C pillar trim",
      "D pillar trim",
      "Front kick panel trim",
      "Rear kick panel trim",
      "Parcel shelf",
      "Boot floor panel",
      "Load cover",
      "Cup holder",
      "Storage compartment lid",
      "Interior panel clip",
      "Seat adjuster lever",
      "Seat runner trim",
      "Cabin floor trim",
      "Door sill trim interior",
      "Pedal rubber",
      "Footrest trim",
      "Interior garnish",
      "Cabin rattles source",
      "Interior fixing point",
      "Dashboard side panel",
      "Instrument binnacle trim",
      "Steering column shroud",
      "Steering lower shroud",
      "Ignition barrel surround",
      "Push button bezel",
      "Gear selector surround",
      "Gear gaiter trim",
      "Handbrake gaiter trim",
      "Electronic brake switch trim",
      "Center armrest storage tray",
      "Center storage mat",
      "Coin holder insert",
      "Door pocket liner",
      "Door pull handle insert",
      "Inner door handle bezel",
      "Door lock pin surround",
      "Window switch bezel",
      "Mirror switch panel",
      "Speaker grille interior",
      "Tweeter cover",
      "A pillar speaker trim",
      "Seat belt height trim",
      "Isofix cover",
      "Rear seat release handle",
      "Rear seat latch trim",
      "Seat back map pocket",
      "Seat back panel",
      "Seat bolster trim",
      "Seat side shield",
      "Seat height knob",
      "Lumbar adjuster knob",
      "Heated seat switch bezel",
      "Climate vent trim",
      "Air vent adjuster tab",
      "Hazard switch trim",
      "Infotainment bezel",
      "Screen surround trim",
      "HVAC control knob",
      "HVAC button cap",
      "USB port surround",
      "12V socket surround",
      "Wireless charger pad",
      "Wireless charger mat",
      "Rear vent bezel",
      "Rear climate control panel",
      "Interior lamp lens",
      "Map light lens",
      "Vanity mirror cover",
      "Vanity mirror hinge",
      "Glovebox damper arm",
      "Glovebox striker",
      "Glovebox side stop",
      "Boot side trim panel",
      "Boot latch cover interior",
      "Boot lamp cover",
      "Tool tray insert",
      "Spare wheel hold down trim",
      "Load net hook cover",
      "Load hook trim",
      "Rear threshold trim interior",
      "Tailgate inner trim panel",
      "Tailgate grab handle trim",
      "Roof console trim",
      "Sunglasses holder lid",
      "Sunglasses holder latch",
      "Overhead switch panel",
      "Microphone grille interior",
      "Interior camera cover",
      "Rain sensor cover interior",
      "Windscreen top trim interior",
      "Rear view mirror shroud",
      "Mirror stem cover",
      "Headrest guide trim",
      "Child lock trim cap",
      "Rear armrest cup holder",
      "Rear armrest latch",
      "Rear quarter trim pocket",
      "Floor mat clip",
      "Carpet retaining clip",
      "Carpet edge trim",
      "Under seat storage tray",
      "Under seat trim cover",
      "Interior trim anti-rattle tape",
      "Interior foam isolator",
      "Interior harness cover",
      "Interior screw cap",
      "Interior blanking plate",
      "Cabin vent duct trim",
      "Defroster vent trim",
      "Antenna amplifier trim",
      "Door courtesy reflector",
      "Door courtesy lens",
      "Ambient light diffuser",
      "Interior panel fastener",
      "Interior panel bracket",
      "Seat base trim panel",
      "Rear footwell trim",
      "Front footwell trim",
      "Dashboard lower knee trim",
    ],
  },
  underside_exhaust_system_catalyst: {
    sectionTitle: "Exhaust system/catalyst",
    locations: LOCATION_SETS.NONE,
    components: [
      "Exhaust manifold",
      "Catalytic converter",
      "DPF",
      "Exhaust flexi",
      "Front exhaust pipe",
      "Center exhaust section",
      "Rear exhaust section",
      "Silencer",
      "Exhaust hanger",
      "Exhaust clamp",
      "Exhaust heat shield",
      "Exhaust joint",
      "Lambda sensor",
      "Exhaust mount",
      "Back box",
      "Resonator",
      "Exhaust bracket",
      "Exhaust gasket",
      "AdBlue injector line",
      "Exhaust pressure sensor",
      "Exhaust tailpipe",
      "Catalyst shield",
      "Exhaust coupling",
      "Exhaust support",
      "Exhaust sleeve",
      "Exhaust flange",
      "Exhaust bracket bolt",
      "Exhaust support rubber",
      "Exhaust sensor wiring",
      "Exhaust sensor connector",
    ],
  },
  underside_steering: {
    sectionTitle: "Steering",
    locations: LOCATION_SETS.NSF_OSF_NSR_OSR,
    components: [
      "Steering rack",
      "Steering column",
      "Track rod",
      "Track rod end",
      "Inner tie rod",
      "Steering joint",
      "Steering pump",
      "Steering fluid line",
      "Power steering motor",
      "Steering angle sensor",
      "Steering UJ",
      "Steering bush",
      "Steering mount",
      "Steering gaiter",
      "Steering wheel alignment",
      "Rack end",
      "Steering return",
      "EPS module",
      "Steering coupling",
      "Steering knuckle link",
      "Pinion seal",
      "Steering pressure hose",
      "Steering return hose",
      "Steering rack boot",
      "Steering rack bush",
      "Steering shaft bearing",
      "Steering shaft support",
      "Steering rack mount",
      "Steering column bearing",
      "Steering column mount",
    ],
  },
  underside_front_suspension: {
    sectionTitle: "Front suspension",
    locations: LOCATION_SETS.FRONT_WITH_NS_OS,
    components: [
      "Front shock absorber",
      "Front spring",
      "Front strut",
      "Front top mount",
      "Front lower arm",
      "Front anti-roll bar link",
      "Front anti-roll bar bush",
      "Front anti-roll bar D-bush",
      "Front D bush",
      "Front lower arm bush",
      "Front rear arm bush",
      "Front drop link",
      "Front anti-roll bar drop link",
      "Front stabiliser link",
      "Front sway bar link",
      "Front ball joint",
      "Front wishbone",
      "Front suspension bush",
      "Front bump stop",
      "Front damper",
      "Front subframe mount",
      "Front suspension mount",
      "Front control arm",
      "Front knuckle joint",
      "Front ride height sensor",
      "Front strut bearing",
      "Front rebound stop",
      "Front suspension bolt",
      "Front spring seat",
      "Front damper seal",
      "Front suspension link",
      "Front ball joint boot",
      "Front anti-roll bar clamp",
      "Front lower arm rear bush",
      "Front lower arm front bush",
      "Front hub carrier bush",
    ],
  },
  underside_rear_suspension: {
    sectionTitle: "Rear suspension",
    locations: LOCATION_SETS.REAR_WITH_NS_OS,
    components: [
      "Rear shock absorber",
      "Rear spring",
      "Rear strut",
      "Rear top mount",
      "Rear lower arm",
      "Rear anti-roll bar link",
      "Rear anti-roll bar bush",
      "Rear anti-roll bar D-bush",
      "Rear D bush",
      "Rear trailing arm bush",
      "Rear beam bush",
      "Rear drop link",
      "Rear anti-roll bar drop link",
      "Rear stabiliser link",
      "Rear sway bar link",
      "Rear trailing arm",
      "Rear suspension bush",
      "Rear bump stop",
      "Rear damper",
      "Rear subframe mount",
      "Rear control arm",
      "Rear suspension link",
      "Rear knuckle joint",
      "Rear ride height sensor",
      "Rear strut bearing",
      "Rear suspension bolt",
      "Rear spring seat",
      "Rear damper seal",
      "Rear toe arm",
      "Rear camber arm",
      "Rear hub carrier bush",
      "Rear anti-roll bar clamp",
      "Rear lower arm bush",
      "Rear trailing arm front bush",
      "Rear trailing arm rear bush",
      "Rear knuckle bush",
    ],
  },
  underside_driveshafts_oil_leaks: {
    sectionTitle: "Driveshafts/oil leaks",
    locations: LOCATION_SETS.FRONT_REAR,
    components: [
      "Driveshaft",
      "CV joint",
      "CV boot",
      "Driveshaft gaiter",
      "Driveshaft seal",
      "Gearbox output seal",
      "Engine oil leak area",
      "Sump gasket",
      "Rocker cover gasket",
      "Turbo oil feed",
      "Turbo oil return",
      "Differential seal",
      "Transfer case seal",
      "Oil cooler line",
      "Power steering leak point",
      "Transmission oil seal",
      "Driveshaft bearing",
      "Inner CV joint",
      "Outer CV joint",
      "Axle seal",
      "Oil pan",
      "Front crank seal",
      "Rear crank seal",
      "Oil filter housing",
      "Breather line",
      "Gearbox casing seep",
      "Diff casing seep",
      "CV joint boot clip",
      "CV boot clamp",
      "Engine undertray oiling",
    ],
  },
  underside_miscellaneous: {
    sectionTitle: "Underside Miscellaneous",
    locations: LOCATION_SETS.FRONT_REAR_WITH_CORNERS,
    components: [
      "Underbody corrosion",
      "Surface corrosion",
      "Chassis rail corrosion",
      "Sill corrosion underside",
      "Floor pan corrosion",
      "Underbody seam",
      "Underseal coating",
      "Underseal coverage",
      "Underbody protection",
      "Stonechip protection",
      "Subframe corrosion",
      "Subframe mounting point",
      "Crossmember corrosion",
      "Heat shield retaining",
      "Undertray fixing",
      "Undertray panel",
      "Undershield panel",
      "Splash shield underside",
      "Brake pipe retaining clip",
      "Fuel line retaining clip",
      "Underbody bracket",
      "Chassis plug",
      "Drain grommet",
      "Jacking point condition",
      "Sill jacking point",
      "Rear axle bracket",
      "Underfloor panel seam",
      "Corrosion inhibitor coat",
      "Protective wax coat",
      "Underbody cavity seal",
      "Subframe underseal",
      "Crossmember underseal",
      "Floor pan underseal",
      "Wheel well underseal",
      "Underbody wax protection",
      "Underbody anti-corrosion treatment",
      "Rust proofing coverage",
      "Seam sealer underside",
      "Seam split underside",
      "Seam sealer deterioration",
      "Metal flaking corrosion",
      "Scale corrosion underside",
      "Pitting corrosion underside",
      "Perforation corrosion risk",
      "Jacking point deformation",
      "Jacking point rusting",
      "Lift point damage",
      "Sill pinch weld damage",
      "Sill pinch weld corrosion",
      "Rear beam corrosion",
      "Rear beam mount corrosion",
      "Front subframe mount corrosion",
      "Rear subframe mount corrosion",
      "Subframe bush sleeve corrosion",
      "Mounting bolt corrosion",
      "Underside bolt seizure risk",
      "Fastener corrosion underside",
      "Fixing clip corrosion",
      "Brake line guard",
      "Fuel line guard",
      "Brake line shield",
      "Fuel line shield",
      "Harness clip underside",
      "Harness routing underside",
      "Underbody wiring conduit",
      "Wiring sleeve underside",
      "Underbody loom cover",
      "Underbody sensor bracket",
      "Ride height sensor bracket",
      "ABS wire retaining clip",
      "Wheel speed wire clip",
      "Exhaust hanger bracket corrosion",
      "Exhaust shield edge corrosion",
      "Exhaust shield rattle point",
      "Exhaust shield fixing missing",
      "Catalyst shield fixing",
      "DPF shield fixing",
      "Prop shaft guard",
      "Prop shaft tunnel shield",
      "Transmission tunnel shield",
      "Transmission tunnel seam",
      "Tunnel heat barrier",
      "Driveshaft tunnel guard",
      "Brake hose bracket underside",
      "Fuel pipe bracket underside",
      "Underbody reinforcement panel",
      "Underbody reinforcement seam",
      "Cross brace corrosion",
      "Chassis outrigger corrosion",
      "Body mount point corrosion",
      "Body mount bush seat",
      "Rear suspension bracket corrosion",
      "Front suspension bracket corrosion",
      "ARB mounting bracket corrosion",
      "Anti-roll bar clamp corrosion",
      "Tow bar mounting plate corrosion",
      "Tow mounting point underbody",
      "Spare wheel cradle underside",
      "Spare wheel carrier corrosion",
      "Spare wheel winch mount",
      "Spare wheel cable guide",
      "Underfloor storage cradle",
      "Underfloor panel clip",
      "Drain hole blockage underside",
      "Drain channel contamination",
      "Mud accumulation underbody",
      "Debris accumulation underbody",
      "Salt deposit underbody",
      "Oil residue on underbody",
      "Grease contamination underside",
      "AdBlue residue underbody",
      "Road tar contamination underside",
      "Impact mark underbody",
      "Scrape mark underbody",
      "Grounding damage underbody",
      "Dent on floor pan underside",
      "Underside puncture mark",
      "Plastic shield crack underside",
      "Plastic shield missing section",
      "Underbody panel misalignment",
      "Loose undershield fastener",
      "Missing undertray clip",
      "Missing undershield bolt",
      "Corroded undertray mount",
      "Rust bleed from seam",
      "Moisture trap area underside",
      "Cavity plug missing underside",
      "Cavity wax depletion",
      "Underbody inspection hole cover",
      "Service panel underside cover",
      "Chassis label plate underside",
      "Underbody anti-rattle pad",
      "Underside isolator pad",
      "Underbody adhesive patch",
      "Underbody protective film",
      "Underside repair patch",
      "Corrosion repair area underside",
      "Recent underseal application area",
      "Underbody condition monitoring point",
    ],
  },
  brakes_front_pads: {
    sectionTitle: "Front Pads",
    locations: LOCATION_SETS.FRONT_WITH_NS_OS,
    components: [
      "Front brake pads",
      "Front pad material",
      "Front pad backing plate",
      "Front pad wear sensor",
      "Front pad carrier",
      "Front pad retaining clips",
      "Front pad spring",
      "Front pad shim",
      "Front friction surface",
      "Front inner pad",
      "Front outer pad",
      "Front pad anti-rattle clip",
      "Front pad slider",
      "Front pad abutment",
      "Front pad guide",
      "Front caliper pad guide",
      "Front pad bracket",
      "Front pad edge",
      "Front pad chamfer",
      "Front pad slot",
      "Front pad wear edge",
      "Front pad contact face",
      "Front pad carrier clips",
      "Front pad spring clip",
      "Front pad support",
      "Front pad backplate coating",
      "Front pad friction face",
      "Front pad set",
      "Front pad wear tab",
      "Front pad mounting",
    ],
  },
  brakes_rear_pads: {
    sectionTitle: "Rear Pads",
    locations: LOCATION_SETS.REAR_WITH_NS_OS,
    components: [
      "Rear brake pads",
      "Rear pad material",
      "Rear pad backing plate",
      "Rear pad wear sensor",
      "Rear pad carrier",
      "Rear pad retaining clips",
      "Rear pad spring",
      "Rear pad shim",
      "Rear friction surface",
      "Rear inner pad",
      "Rear outer pad",
      "Rear pad anti-rattle clip",
      "Rear pad slider",
      "Rear pad abutment",
      "Rear pad guide",
      "Rear caliper pad guide",
      "Rear pad bracket",
      "Rear pad edge",
      "Rear pad chamfer",
      "Rear pad slot",
      "Rear pad wear edge",
      "Rear pad contact face",
      "Rear pad carrier clips",
      "Rear pad spring clip",
      "Rear pad support",
      "Rear pad backplate coating",
      "Rear pad friction face",
      "Rear pad set",
      "Rear pad wear tab",
      "Rear pad mounting",
    ],
  },
  brakes_front_discs: {
    sectionTitle: "Front Discs",
    locations: LOCATION_SETS.FRONT_WITH_NS_OS,
    components: [
      "Front brake disc",
      "Front rotor face",
      "Front disc hub face",
      "Front disc vent channels",
      "Front disc edge",
      "Front rotor mounting",
      "Front disc friction surface",
      "Front disc cooling vanes",
      "Front disc runout",
      "Front disc bell",
      "Front disc outer edge",
      "Front disc inner edge",
      "Front disc mounting face",
      "Front disc mating face",
      "Front disc chamfer",
      "Front disc wear lip",
      "Front disc friction ring",
      "Front disc heat spots",
      "Front disc contact patch",
      "Front disc balancing mark",
      "Front disc pad track",
      "Front disc vent rib",
      "Front disc vent core",
      "Front disc mount bolt face",
      "Front disc seat",
      "Front disc corrosion edge",
      "Front disc groove area",
      "Front disc swept area",
      "Front disc hub fit",
      "Front disc outer ring",
    ],
  },
  brakes_rear_discs: {
    sectionTitle: "Rear Discs",
    locations: LOCATION_SETS.REAR_WITH_NS_OS,
    components: [
      "Rear brake disc",
      "Rear rotor face",
      "Rear disc hub face",
      "Rear disc vent channels",
      "Rear disc edge",
      "Rear rotor mounting",
      "Rear disc friction surface",
      "Rear disc cooling vanes",
      "Rear disc runout",
      "Rear disc bell",
      "Rear disc outer edge",
      "Rear disc inner edge",
      "Rear disc mounting face",
      "Rear disc mating face",
      "Rear disc chamfer",
      "Rear disc wear lip",
      "Rear disc friction ring",
      "Rear disc heat spots",
      "Rear disc contact patch",
      "Rear disc balancing mark",
      "Rear disc pad track",
      "Rear disc vent rib",
      "Rear disc vent core",
      "Rear disc mount bolt face",
      "Rear disc seat",
      "Rear disc corrosion edge",
      "Rear disc groove area",
      "Rear disc swept area",
      "Rear disc hub fit",
      "Rear disc outer ring",
    ],
  },
  brakes_rear_drum: {
    sectionTitle: "Rear Drum",
    locations: LOCATION_SETS.REAR_WITH_NS_OS,
    components: [
      "Rear brake drum",
      "Rear shoe assembly",
      "Rear wheel cylinder",
      "Rear drum adjuster",
      "Rear drum backing plate",
      "Rear drum springs",
      "Rear handbrake lever",
      "Rear drum friction surface",
      "Rear drum hardware",
      "Rear drum shoe lining",
      "Rear drum shoe pivot",
      "Rear drum shoe pin",
      "Rear drum shoe clip",
      "Rear drum return spring",
      "Rear drum hold down spring",
      "Rear drum wheel cylinder seal",
      "Rear drum wheel cylinder boot",
      "Rear drum anchor pin",
      "Rear drum adjuster wheel",
      "Rear drum adjuster lever",
      "Rear drum shoe guide",
      "Rear drum parking brake lever",
      "Rear drum cable link",
      "Rear drum shoe retainer",
      "Rear drum friction ring",
      "Rear drum wear ridge",
      "Rear drum outer shell",
      "Rear drum inner surface",
      "Rear drum back plate support",
      "Rear drum shoe contact points",
    ],
  },
  service_service_reminder: {
    sectionTitle: "Service Reminder",
    locations: LOCATION_SETS.NONE,
    components: [
      "Service reminder",
      "Service indicator",
      "Service interval display",
      "Service reminder circuit",
      "Service warning message",
      "Service reminder logic",
      "Service monitor",
      "Service reset input",
      "Service reset output",
      "Service counter",
      "Service timer",
      "Service alert channel",
      "Service warning lamp",
      "Service reminder setting",
      "Service reminder controller",
      "Service reminder communication",
      "Service reminder module",
      "Service reminder memory",
      "Service reminder trigger",
      "Service reminder signal",
      "Service reminder feed",
      "Service reminder earth",
      "Service reminder switch",
      "Service reminder relay",
      "Service reminder connector",
      "Service reminder harness",
      "Service reminder bus",
      "Service reminder coding",
      "Service reminder adaptation",
      "Service reminder calibration",
    ],
  },
  service_oil_level: {
    sectionTitle: "Oil Level",
    locations: LOCATION_SETS.NONE,
    components: [
      "Oil level reading",
      "Oil level sensor",
      "Oil level monitor",
      "Oil level display",
      "Oil condition signal",
      "Oil quantity status",
      "Oil service input",
      "Oil level harness",
      "Oil level connector",
      "Oil level control module",
      "Oil level data feed",
      "Oil level adaptation",
      "Oil level warning",
      "Oil level trigger",
      "Oil level switch",
      "Oil level reference",
      "Oil level threshold",
      "Oil level comparator",
      "Oil level correction",
      "Oil level algorithm",
      "Oil level history",
      "Oil level event",
      "Oil level report",
      "Oil level code",
      "Oil level offset",
      "Oil level calibration",
      "Oil level signal wire",
      "Oil level earth",
      "Oil level supply",
      "Oil level validity",
    ],
  },
  service_under_bonnet_general: {
    sectionTitle: "Under Bonnet",
    locations: LOCATION_SETS.NONE,
    components: [
      "Under bonnet system",
      "Engine bay check",
      "Fluid condition",
      "Drive belt system",
      "Battery condition",
      "Fuel feed line",
      "Cooling system",
      "Ancillary drive",
      "Engine bay wiring",
      "Engine bay fixings",
      "Antifreeze strength",
      "Water/oil condition",
      "Fluid leaks area",
      "Alternator belt",
      "Battery terminals",
      "Power steering fluid level",
      "Fuel system line",
      "Cam belt condition",
      "Service reminder input",
      "Oil level indication",
      "Engine bay hose",
      "Engine bay clamp",
      "Engine bay bracket",
      "Engine bay harness",
      "Engine bay connector",
      "Engine bay mount",
      "Engine bay cover",
      "Engine bay shield",
      "Engine bay clip",
      "Engine bay retainer",
    ],
  },
  wheels_nsf: {
    sectionTitle: "NSF Wheel/Tyre",
    locations: LOCATION_SETS.NONE,
    components: [
      "NSF tyre tread",
      "NSF tyre shoulder",
      "NSF tyre sidewall",
      "NSF tyre valve",
      "NSF wheel rim",
      "NSF wheel balance",
      "NSF wheel nut seat",
      "NSF tyre carcass",
      "NSF tyre bead",
      "NSF tyre inner liner",
      "NSF tyre outer shoulder",
      "NSF tyre inner shoulder",
      "NSF tyre contact patch",
      "NSF tyre wear pattern",
      "NSF tyre repair area",
      "NSF rim outer lip",
      "NSF rim inner lip",
      "NSF rim face",
      "NSF rim barrel",
      "NSF rim valve hole",
      "NSF wheel bolt holes",
      "NSF wheel hub face",
      "NSF wheel centre bore",
      "NSF wheel balancing plane",
      "NSF wheel radial runout",
      "NSF wheel lateral runout",
      "NSF tyre inflation state",
      "NSF tyre pressure point",
      "NSF tyre bead seat",
      "NSF wheel finish",
    ],
  },
  wheels_osf: {
    sectionTitle: "OSF Wheel/Tyre",
    locations: LOCATION_SETS.NONE,
    components: [
      "OSF tyre tread",
      "OSF tyre shoulder",
      "OSF tyre sidewall",
      "OSF tyre valve",
      "OSF wheel rim",
      "OSF wheel balance",
      "OSF wheel nut seat",
      "OSF tyre carcass",
      "OSF tyre bead",
      "OSF tyre inner liner",
      "OSF tyre outer shoulder",
      "OSF tyre inner shoulder",
      "OSF tyre contact patch",
      "OSF tyre wear pattern",
      "OSF tyre repair area",
      "OSF rim outer lip",
      "OSF rim inner lip",
      "OSF rim face",
      "OSF rim barrel",
      "OSF rim valve hole",
      "OSF wheel bolt holes",
      "OSF wheel hub face",
      "OSF wheel centre bore",
      "OSF wheel balancing plane",
      "OSF wheel radial runout",
      "OSF wheel lateral runout",
      "OSF tyre inflation state",
      "OSF tyre pressure point",
      "OSF tyre bead seat",
      "OSF wheel finish",
    ],
  },
  wheels_nsr: {
    sectionTitle: "NSR Wheel/Tyre",
    locations: LOCATION_SETS.NONE,
    components: [
      "NSR tyre tread",
      "NSR tyre shoulder",
      "NSR tyre sidewall",
      "NSR tyre valve",
      "NSR wheel rim",
      "NSR wheel balance",
      "NSR wheel nut seat",
      "NSR tyre carcass",
      "NSR tyre bead",
      "NSR tyre inner liner",
      "NSR tyre outer shoulder",
      "NSR tyre inner shoulder",
      "NSR tyre contact patch",
      "NSR tyre wear pattern",
      "NSR tyre repair area",
      "NSR rim outer lip",
      "NSR rim inner lip",
      "NSR rim face",
      "NSR rim barrel",
      "NSR rim valve hole",
      "NSR wheel bolt holes",
      "NSR wheel hub face",
      "NSR wheel centre bore",
      "NSR wheel balancing plane",
      "NSR wheel radial runout",
      "NSR wheel lateral runout",
      "NSR tyre inflation state",
      "NSR tyre pressure point",
      "NSR tyre bead seat",
      "NSR wheel finish",
    ],
  },
  wheels_osr: {
    sectionTitle: "OSR Wheel/Tyre",
    locations: LOCATION_SETS.NONE,
    components: [
      "OSR tyre tread",
      "OSR tyre shoulder",
      "OSR tyre sidewall",
      "OSR tyre valve",
      "OSR wheel rim",
      "OSR wheel balance",
      "OSR wheel nut seat",
      "OSR tyre carcass",
      "OSR tyre bead",
      "OSR tyre inner liner",
      "OSR tyre outer shoulder",
      "OSR tyre inner shoulder",
      "OSR tyre contact patch",
      "OSR tyre wear pattern",
      "OSR tyre repair area",
      "OSR rim outer lip",
      "OSR rim inner lip",
      "OSR rim face",
      "OSR rim barrel",
      "OSR rim valve hole",
      "OSR wheel bolt holes",
      "OSR wheel hub face",
      "OSR wheel centre bore",
      "OSR wheel balancing plane",
      "OSR wheel radial runout",
      "OSR wheel lateral runout",
      "OSR tyre inflation state",
      "OSR tyre pressure point",
      "OSR tyre bead seat",
      "OSR wheel finish",
    ],
  },
  wheels_spare: {
    sectionTitle: "Spare Wheel/Tyre",
    locations: LOCATION_SETS.NONE,
    components: [
      "Spare tyre tread",
      "Spare tyre shoulder",
      "Spare tyre sidewall",
      "Spare tyre valve",
      "Spare wheel rim",
      "Spare wheel carrier",
      "Spare securing bolt",
      "Spare tyre carcass",
      "Spare tyre bead",
      "Spare tyre inner liner",
      "Spare tyre outer shoulder",
      "Spare tyre inner shoulder",
      "Spare tyre contact patch",
      "Spare tyre wear pattern",
      "Spare tyre repair area",
      "Spare rim outer lip",
      "Spare rim inner lip",
      "Spare rim face",
      "Spare rim barrel",
      "Spare rim valve hole",
      "Spare wheel bolt holes",
      "Spare wheel hub face",
      "Spare wheel centre bore",
      "Spare wheel balancing plane",
      "Spare wheel radial runout",
      "Spare wheel lateral runout",
      "Spare tyre inflation state",
      "Spare tyre pressure point",
      "Spare tyre bead seat",
      "Spare wheel finish",
    ],
  },
};

const BASE_PRIORITY_BY_TYPE = {
  wiperBlade: 10,
  washerJet: 9,
  wiperLinkage: 7,
  wiperMotor: 6,
  horn: 6,
  lightBulb: 8,
  lightAssembly: 7,
  bush: 9,
  dropLink: 9,
  ballJoint: 9,
  shockAbsorber: 8,
  brakePad: 10,
  brakeDisc: 9,
  tyre: 10,
  defaultMechanical: 6,
};

const resolveComponentType = (componentName = "", sectionKey = "") => {
  const ref = normaliseText(componentName);
  if (sectionKey === "external_wipers_washers_horn") {
    if (ref.includes("blade")) return "wiperBlade";
    if (ref.includes("jet") || ref.includes("washer") || ref.includes("nozzle")) return "washerJet";
    if (ref.includes("linkage") || ref.includes("spindle") || ref.includes("mechanism")) return "wiperLinkage";
    if (ref.includes("motor") || ref.includes("relay")) return "wiperMotor";
    if (ref.includes("horn")) return "horn";
  }
  if (ref.includes("bulb")) return "lightBulb";
  if (ref.includes("lamp") || ref.includes("light") || ref.includes("headlamp") || ref.includes("headlight")) return "lightAssembly";
  if (ref.includes("d-bush") || ref.includes("d bush") || ref.includes("bush")) return "bush";
  if (ref.includes("drop link") || ref.includes("stabiliser link") || ref.includes("sway bar link")) return "dropLink";
  if (ref.includes("ball joint")) return "ballJoint";
  if (ref.includes("shock") || ref.includes("damper") || ref.includes("strut")) return "shockAbsorber";
  if (ref.includes("pad")) return "brakePad";
  if (ref.includes("disc") || ref.includes("rotor") || ref.includes("drum")) return "brakeDisc";
  if (ref.includes("tyre") || ref.includes("tire") || ref.includes("wheel")) return "tyre";
  return "defaultMechanical";
};

const resolveLocationSetForComponent = (sectionKey = "", componentName = "", sectionLocationSet = LOCATION_SETS.NONE) => {
  const ref = normaliseText(componentName);
  if (sectionKey === "external_wipers_washers_horn") {
    if (ref.includes("horn")) return LOCATION_SETS.NONE;
    if (ref.includes("rear")) return LOCATION_SETS.REAR_WITH_NS_OS;
    if (ref.includes("front") || ref.includes("windscreen")) return LOCATION_SETS.FRONT_WITH_NS_OS;
    return LOCATION_SETS.FRONT_REAR_WITH_CORNERS;
  }
  if (sectionKey.includes("front") && sectionKey.includes("suspension")) return LOCATION_SETS.FRONT_WITH_NS_OS;
  if (sectionKey.includes("rear") && sectionKey.includes("suspension")) return LOCATION_SETS.REAR_WITH_NS_OS;
  if (sectionKey.includes("front") && (sectionKey.includes("pads") || sectionKey.includes("discs"))) return LOCATION_SETS.FRONT_WITH_NS_OS;
  if (sectionKey.includes("rear") && (sectionKey.includes("pads") || sectionKey.includes("discs") || sectionKey.includes("drum"))) return LOCATION_SETS.REAR_WITH_NS_OS;
  return sectionLocationSet;
};

const buildComponentId = (sectionKey = "", componentName = "") =>
  `${sectionKey}_${normaliseText(componentName).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;

const ensureComponentRange = (components = [], sectionKey = "") => {
  const deduped = dedupeStrings(components);
  if (deduped.length >= MIN_COMPONENTS_PER_SECTION) {
    return deduped.slice(0, MAX_COMPONENTS_PER_SECTION);
  }
  const fillers = [
    "Connector",
    "Wiring",
    "Harness",
    "Mount",
    "Bracket",
    "Fixing",
    "Support",
    "Housing",
    "Seal",
    "Retainer",
    "Clip",
    "Sensor",
  ];
  let index = 0;
  while (deduped.length < MIN_COMPONENTS_PER_SECTION) {
    const base = deduped[index % Math.max(1, deduped.length)] || "Component";
    const filler = fillers[index % fillers.length];
    deduped.push(`${base} ${filler}`);
    index += 1;
    if (index > 200) break;
  }
  return dedupeStrings(deduped).slice(0, MAX_COMPONENTS_PER_SECTION);
};

const buildTaxonomyForSection = (sectionKey = "", sectionSeed = {}) => {
  const sectionComponents = ensureComponentRange(sectionSeed.components || [], sectionKey);
  return {
    sectionKey,
    sectionTitle: sectionSeed.sectionTitle || sectionKey,
    components: sectionComponents.map((componentName, index) => {
      const componentType = resolveComponentType(componentName, sectionKey);
      const symptoms = SYMPTOM_GROUPS[componentType] || SYMPTOM_GROUPS.defaultMechanical;
      const basePriority = BASE_PRIORITY_BY_TYPE[componentType] || BASE_PRIORITY_BY_TYPE.defaultMechanical;
      const locations = resolveLocationSetForComponent(sectionKey, componentName, sectionSeed.locations || LOCATION_SETS.NONE);
      return {
        id: buildComponentId(sectionKey, componentName),
        name: componentName,
        locations,
        priority: Math.max(1, Math.min(10, basePriority - (index > 15 ? 1 : 0) - (index > 30 ? 1 : 0))),
        symptoms,
      };
    }),
  };
};

export const SECTION_TAXONOMY = Object.keys(SECTION_BASE_COMPONENTS).reduce((acc, sectionKey) => {
  acc[sectionKey] = buildTaxonomyForSection(sectionKey, SECTION_BASE_COMPONENTS[sectionKey]);
  return acc;
}, {});

const SECTION_ALIASES = {
  "wipers/washers/horn": "external_wipers_washers_horn",
  "horn/washers/wipers": "external_wipers_washers_horn",
  "front lights": "external_front_lights",
  "rear lights": "external_rear_lights",
  "wheel trim": "external_wheel_trim",
  "clutch/transmission operations": "external_clutch_transmission_operations",
  "number plates": "external_number_plates",
  doors: "external_doors",
  trims: "external_trims",
  "external miscellaneous": "external_miscellaneous",
  "interior lights": "internal_interior_lights",
  "media systems": "internal_media_systems",
  "air con/heating/ventilation": "internal_air_con_heating_ventilation",
  "air con/heating/ventilation": "internal_air_con_heating_ventilation",
  "warning lamps": "internal_warning_lamps",
  seatbelt: "internal_seatbelt",
  "internal miscellaneous": "internal_miscellaneous",
  "exhaust system/catalyst": "underside_exhaust_system_catalyst",
  steering: "underside_steering",
  "front suspension": "underside_front_suspension",
  "rear suspension": "underside_rear_suspension",
  "driveshafts/oil leaks": "underside_driveshafts_oil_leaks",
  "underside miscellaneous": "underside_miscellaneous",
  "front pads": "brakes_front_pads",
  "rear pads": "brakes_rear_pads",
  "front discs": "brakes_front_discs",
  "rear discs": "brakes_rear_discs",
  "rear drum": "brakes_rear_drum",
  service: "service_service_reminder",
  oil: "service_oil_level",
  "antifreeze strength": "service_under_bonnet_general",
  "water/oil": "service_under_bonnet_general",
  "fluid leaks": "service_under_bonnet_general",
  "alternator belt/battery": "service_under_bonnet_general",
  "power steering fluid": "service_under_bonnet_general",
  "fuel system": "service_under_bonnet_general",
  "cam belt": "service_under_bonnet_general",
  "service reminder/oil level": "service_under_bonnet_general",
  nsf: "wheels_nsf",
  osf: "wheels_osf",
  nsr: "wheels_nsr",
  osr: "wheels_osr",
  spare: "wheels_spare",
};

export const resolveTaxonomySectionKey = (sectionKey = "") => {
  const normalized = normaliseText(sectionKey);
  if (SECTION_TAXONOMY[normalized]) return normalized;
  return SECTION_ALIASES[normalized] || normalized;
};

const normalizeSuggestionText = (text = "") =>
  text
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/\s+;/g, ";")
    .replace(/\s+-\s+/g, " - ")
    .trim();

const expandLocationTokens = (locationKey = "") => {
  const variants = LOCATION_DISPLAY[locationKey] || [];
  return variants.map((token) => token.trim()).filter(Boolean);
};

const getActionPhrase = (actionId = "", variantIndex = 0) => {
  const options = ACTION_PHRASE_VARIANTS[actionId] || ACTION_PHRASE_VARIANTS.inspect;
  return options[variantIndex % options.length];
};

const removeLocationWords = (componentName = "") =>
  componentName
    .replace(/^(front|rear)\s+/i, "")
    .replace(/^(near side|off side)\s+/i, "")
    .replace(/^(n\/s\/f|o\/s\/f|n\/s\/r|o\/s\/r)\s+/i, "")
    .trim();

const buildLocationVariants = (component = {}, sectionKey = "") => {
  if (!Array.isArray(component.locations) || component.locations.length === 0) {
    return [{ prefix: "", semanticLocation: "none", locationTokens: [] }];
  }
  const baseName = removeLocationWords(component.name);
  const variants = [];
  component.locations.forEach((locationKey) => {
    expandLocationTokens(locationKey).forEach((token) => {
      variants.push({
        prefix: `${token} `,
        semanticLocation: locationKey,
        locationTokens: [normaliseText(token), normaliseText(locationKey)],
        componentName: baseName,
      });
    });
  });
  return variants.length > 0 ? variants : [{ prefix: "", semanticLocation: "none", locationTokens: [] }];
};

const expandedCache = new Map();

export const expandTaxonomyToSuggestions = (sectionKey = "") => {
  const resolvedKey = resolveTaxonomySectionKey(sectionKey);
  if (expandedCache.has(resolvedKey)) {
    return expandedCache.get(resolvedKey);
  }

  const taxonomy = SECTION_TAXONOMY[resolvedKey];
  if (!taxonomy) {
    const empty = [];
    expandedCache.set(resolvedKey, empty);
    return empty;
  }

  const entries = [];
  const semanticDedup = new Set();

  for (let pass = 0; pass < 12; pass += 1) {
    taxonomy.components.forEach((component, componentIndex) => {
      const locationVariants = buildLocationVariants(component, resolvedKey);
      locationVariants.forEach((locationVariant, locationIndex) => {
        component.symptoms.forEach((symptom, symptomIndex) => {
          symptom.phrases.forEach((phrase, phraseIndex) => {
            const actionId = symptom.actionByPhrase[phrase] || symptom.actionsAllowed[0] || "inspect";
            const actionPhrase = getActionPhrase(actionId, pass + componentIndex + locationIndex + phraseIndex);
            const template = SENTENCE_TEMPLATES[(pass + componentIndex + symptomIndex + phraseIndex) % SENTENCE_TEMPLATES.length];
            const componentName = locationVariant.componentName || removeLocationWords(component.name);
            const suggestionText = normalizeSuggestionText(
              template({
                locationPrefix: locationVariant.prefix || "",
                componentName,
                symptomPhrase: phrase,
                actionPhrase,
              }),
            );

            const semanticKey = `${component.id}|${locationVariant.semanticLocation || "none"}|${symptom.id}|${actionId}`;
            const duplicateKey = `${semanticKey}|${normaliseText(suggestionText)}`;
            if (semanticDedup.has(duplicateKey)) return;
            semanticDedup.add(duplicateKey);

            entries.push({
              text: suggestionText,
              indexedText: normaliseText(suggestionText),
              sectionKey: resolvedKey,
              componentId: component.id,
              componentName: component.name,
              componentPriority: component.priority,
              location: locationVariant.semanticLocation || "none",
              locationTokens: locationVariant.locationTokens || [],
              symptomId: symptom.id,
              symptomPhrase: phrase,
              symptomPriority: symptom.symptomPriority,
              actionId,
              severityAllowed: symptom.severityAllowed,
              semanticKey,
            });
          });
        });
      });
    });
    if (entries.length >= MIN_SUGGESTIONS_PER_SECTION) break;
  }

  if (entries.length < MIN_SUGGESTIONS_PER_SECTION && entries.length > 0) {
    const postfixNotes = ["for immediate attention", "during VHC inspection", "during health check", "workshop follow-up advised"];
    let index = 0;
    while (entries.length < MIN_SUGGESTIONS_PER_SECTION) {
      const source = entries[index % entries.length];
      const text = normalizeSuggestionText(`${source.text} ${postfixNotes[index % postfixNotes.length]}`);
      const semanticVariantKey = `${source.semanticKey}|note|${index % postfixNotes.length}`;
      if (!semanticDedup.has(semanticVariantKey)) {
        semanticDedup.add(semanticVariantKey);
        entries.push({
          ...source,
          text,
          indexedText: normaliseText(text),
        });
      }
      index += 1;
      if (index > MIN_SUGGESTIONS_PER_SECTION * 10) break;
    }
  }

  const result = entries.slice(0, MIN_SUGGESTIONS_PER_SECTION);
  expandedCache.set(resolvedKey, result);
  return result;
};

const fuzzyMatchScore = (candidate = "", query = "") => {
  if (!candidate || !query) return Number.POSITIVE_INFINITY;
  let queryIndex = 0;
  let first = -1;
  let last = -1;

  for (let i = 0; i < candidate.length && queryIndex < query.length; i += 1) {
    if (candidate[i] !== query[queryIndex]) continue;
    if (first < 0) first = i;
    last = i;
    queryIndex += 1;
  }

  if (queryIndex !== query.length) return Number.POSITIVE_INFINITY;
  return first * 2 + (last - first);
};

export const normalizeQuery = (query = "") => {
  const raw = normaliseText(query);
  if (!raw) return "";
  return raw
    .split(/\s+/)
    .map((token) => LOCATION_NORMALIZER_MAP[token] || token)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const rankCache = new Map();

const buildRankCacheKey = (sectionKey = "", query = "") => `${sectionKey}::${query}`;

const getQueryBoost = (query = "", entry = {}) => {
  const q = normalizeQuery(query);
  let boost = 0;

  if (q.includes("front") && entry.indexedText.includes("front")) boost += 20;
  if (q.includes("rear") && entry.indexedText.includes("rear")) boost += 20;
  if (q.includes("near side") && (entry.indexedText.includes("near side") || entry.indexedText.includes("n/s"))) boost += 25;
  if (q.includes("off side") && (entry.indexedText.includes("off side") || entry.indexedText.includes("o/s"))) boost += 25;
  if (q.includes("pad") && entry.indexedText.includes("pad")) boost += 18;
  if (q.includes("disc") && entry.indexedText.includes("disc")) boost += 18;
  if (q.includes("leak") && entry.indexedText.includes("leak")) boost += 18;

  const predictionTokens = TOKEN_PREDICTIONS[Object.keys(TOKEN_PREDICTIONS).find((token) => q.includes(token)) || ""] || [];
  predictionTokens.forEach((token) => {
    if (entry.indexedText.includes(token)) boost += 6;
  });

  return boost;
};

export const rankSuggestions = (sectionKey = "", query = "") => {
  const resolvedKey = resolveTaxonomySectionKey(sectionKey);
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return [];

  const cacheKey = buildRankCacheKey(resolvedKey, normalizedQuery);
  if (rankCache.has(cacheKey)) return rankCache.get(cacheKey);

  const entries = expandTaxonomyToSuggestions(resolvedKey);
  const ranked = [];

  entries.forEach((entry, index) => {
    const candidate = entry.indexedText;
    const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);

    const componentPrefix = queryParts.some((part) => normaliseText(entry.componentName).startsWith(part));
    const symptomPrefix = queryParts.some((part) => normaliseText(entry.symptomPhrase).startsWith(part));
    const locationPrefix = entry.locationTokens.some((token) => queryParts.some((part) => token.startsWith(part)));

    let tier = 99;
    let distance = Number.POSITIVE_INFINITY;

    if (componentPrefix || symptomPrefix) {
      tier = 0;
      distance = 0;
    } else if (locationPrefix) {
      tier = 1;
      distance = 0;
    } else {
      const containsIndex = candidate.indexOf(normalizedQuery);
      if (containsIndex >= 0) {
        tier = 2;
        distance = containsIndex;
      } else {
        const fuzzyDistance = fuzzyMatchScore(candidate, normalizedQuery);
        if (Number.isFinite(fuzzyDistance)) {
          tier = 3;
          distance = fuzzyDistance;
        }
      }
    }

    if (tier === 99) return;

    ranked.push({
      ...entry,
      tier,
      distance,
      queryBoost: getQueryBoost(normalizedQuery, entry),
      order: index,
    });
  });

  ranked.sort((left, right) => {
    if (left.tier !== right.tier) return left.tier - right.tier;
    if (left.queryBoost !== right.queryBoost) return right.queryBoost - left.queryBoost;
    if (left.componentPriority !== right.componentPriority) return right.componentPriority - left.componentPriority;
    if (left.symptomPriority !== right.symptomPriority) return right.symptomPriority - left.symptomPriority;
    if (left.distance !== right.distance) return left.distance - right.distance;
    return left.order - right.order;
  });

  rankCache.set(cacheKey, ranked);
  return ranked;
};
