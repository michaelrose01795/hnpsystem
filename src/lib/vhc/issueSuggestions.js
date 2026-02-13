// file location: src/lib/vhc/issueSuggestions.js

const DEFAULT_LIMIT = 12;
const MIN_SUGGESTIONS_PER_SECTION = 1000;
const MAX_CACHE_QUERIES_PER_SECTION = 180;

const COMMON_SYMPTOMS = [
  "split",
  "perished",
  "blocked",
  "leaking",
  "intermittent",
  "noisy",
  "slow",
  "inoperative",
  "sticking",
  "damaged",
  "loose",
  "misaligned",
  "worn",
  "corroded",
  "contaminated",
  "faded",
  "cracked",
  "binding",
  "vibrating",
  "overheating",
  "restricted",
  "unresponsive",
];

const ISSUE_QUALIFIERS = [
  "",
  "slightly",
  "moderately",
  "heavily",
  "severely",
  "intermittently",
  "consistently",
];

const RECOMMENDED_ACTIONS = [
  "requires replacing",
  "requires adjustment",
  "requires cleaning",
  "requires diagnosis",
  "requires repair",
  "requires further testing",
  "requires lubrication",
  "requires securing",
  "requires alignment",
  "requires calibration",
];

const SECTION_SEEDS = {
  external_wipers_washers_horn: {
    aliases: ["Wipers/Washers/Horn", "Horn/Washers/Wipers"],
    components: [
      "Wipers",
      "Wiper blades",
      "Wiper arms",
      "Wiper linkage",
      "Wiper motor",
      "Wiper relay",
      "Wiper spindle",
      "Wiper sweep",
      "Wiper mechanism",
      "Washer jets",
      "Washer nozzles",
      "Washer pump",
      "Washer bottle",
      "Washer fluid line",
      "Washer hose",
      "Washer filter",
      "Horn",
      "Horn switch",
      "Horn relay",
      "Horn wiring",
      "Horn connector",
      "Steering wheel horn contact",
      "Wiper stalk",
      "Windscreen washer system",
      "Rear washer feed",
      "Front washer feed",
      "Washer non-return valve",
      "Wiper blade edge",
      "Wiper park position",
      "Wiper blade rubber",
    ],
    symptoms: [
      "split",
      "smeared",
      "juddering",
      "not clearing",
      "blocked",
      "spraying unevenly",
      "inoperative",
      "intermittent",
      "weak output",
      "no output",
      "noisy",
      "slow",
      "sticking",
      "leaking",
      "loose",
      "misaligned",
      "corroded",
      "cracked",
      "perished",
      "unresponsive",
    ],
  },
  external_front_lights: {
    aliases: ["Front Lights"],
    components: [
      "Front lights",
      "Headlight unit",
      "Dipped beam",
      "Main beam",
      "DRL",
      "Front indicator",
      "Front side light",
      "Front fog light",
      "Headlamp lens",
      "Headlamp housing",
      "Headlamp wiring",
      "Headlamp connector",
      "Headlamp levelling motor",
      "Headlight ballast",
      "Headlight control module",
      "Lamp seal",
      "Lamp bracket",
      "Front lamp loom",
      "Front lamp earth",
      "Front bulb holder",
      "Headlamp aim",
      "Front lamp clips",
      "Front lens cover",
      "Front lighting circuit",
    ],
    symptoms: [
      "inoperative",
      "flickering",
      "dim",
      "misaligned",
      "cracked",
      "condensation present",
      "water ingress",
      "loose",
      "damaged",
      "corroded",
      "intermittent",
      "discoloured",
      "noisy levelling",
      "unresponsive",
      "overheating",
      "restricted output",
    ],
  },
  external_rear_lights: {
    aliases: ["Rear lights"],
    components: [
      "Rear lights",
      "Tail light",
      "Brake light",
      "High level brake light",
      "Rear indicator",
      "Reverse light",
      "Rear fog light",
      "Rear lamp lens",
      "Rear lamp housing",
      "Rear lamp wiring",
      "Rear lamp connector",
      "Rear bulb holder",
      "Rear light seal",
      "Boot light circuit",
      "Tailgate lamp loom",
      "Rear lamp bracket",
      "Rear light earth",
      "Rear light cluster",
      "Number plate lamp circuit",
      "Rear lamp module",
      "Rear lens cover",
      "Rear lighting circuit",
    ],
    symptoms: [
      "inoperative",
      "flickering",
      "dim",
      "misaligned",
      "cracked",
      "condensation present",
      "water ingress",
      "loose",
      "damaged",
      "corroded",
      "intermittent",
      "discoloured",
      "unresponsive",
      "overheating",
      "restricted output",
      "binding",
    ],
  },
  external_wheel_trim: {
    aliases: ["Wheel Trim"],
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
    ],
    symptoms: [
      "loose",
      "missing",
      "cracked",
      "scuffed",
      "scratched",
      "broken",
      "misaligned",
      "corroded",
      "faded",
      "damaged",
      "vibrating",
      "sticking",
      "binding",
      "restricted fit",
      "worn",
      "split",
    ],
  },
  external_clutch_transmission_operations: {
    aliases: ["Clutch/Transmission operations"],
    components: [
      "Clutch pedal",
      "Clutch master cylinder",
      "Clutch slave cylinder",
      "Clutch hydraulics",
      "Clutch operation",
      "Clutch release bearing",
      "Clutch bite point",
      "Gear selection",
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
    ],
    symptoms: [
      "slipping",
      "dragging",
      "noisy",
      "stiff",
      "sticking",
      "inoperative",
      "slow to engage",
      "juddering",
      "vibrating",
      "leaking",
      "intermittent",
      "unresponsive",
      "misaligned",
      "worn",
      "contaminated",
      "overheating",
      "restricted movement",
    ],
  },
  external_number_plates: {
    aliases: ["Number plates"],
    components: [
      "Number plate",
      "Front number plate",
      "Rear number plate",
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
    ],
    symptoms: [
      "loose",
      "cracked",
      "faded",
      "damaged",
      "misaligned",
      "obscured",
      "corroded",
      "insecure",
      "missing fixing",
      "vibrating",
      "restricted visibility",
      "split",
      "sticking",
      "worn",
      "unresponsive light",
    ],
  },
  external_doors: {
    aliases: ["Doors"],
    components: [
      "Front door",
      "Rear door",
      "Door hinges",
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
    ],
    symptoms: [
      "misaligned",
      "not closing",
      "sticking",
      "noisy",
      "loose",
      "damaged",
      "leaking",
      "worn",
      "corroded",
      "inoperative",
      "intermittent",
      "restricted movement",
      "binding",
      "vibrating",
      "cracked",
      "split",
      "unresponsive",
    ],
  },
  external_trims: {
    aliases: ["Trims"],
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
    ],
    symptoms: [
      "loose",
      "missing",
      "cracked",
      "faded",
      "damaged",
      "misaligned",
      "corroded",
      "detaching",
      "scratched",
      "scuffed",
      "vibrating",
      "sticking",
      "split",
      "worn",
      "restricted fit",
      "binding",
    ],
  },
  external_miscellaneous: {
    aliases: ["Miscellaneous"],
    skipGeneration: true,
  },

  internal_interior_lights: {
    aliases: ["Interior Lights"],
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
    ],
    symptoms: [
      "inoperative",
      "dim",
      "flickering",
      "intermittent",
      "sticking",
      "unresponsive",
      "cracked lens",
      "loose",
      "corroded",
      "damaged",
      "overheating",
      "restricted output",
      "slow response",
      "noisy switch",
      "misaligned",
    ],
  },
  internal_media_systems: {
    aliases: ["Media Systems"],
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
    ],
    symptoms: [
      "frozen",
      "unresponsive",
      "slow",
      "intermittent",
      "no audio",
      "distorted audio",
      "crackling",
      "no signal",
      "blank screen",
      "flickering",
      "restarting",
      "inoperative",
      "overheating",
      "corrupted",
      "damaged",
      "loose connection",
      "restricted function",
    ],
  },
  internal_air_con_heating_ventilation: {
    aliases: ["Air Con/Heating/ventilation", "Air Con/Heating/Ventilation"],
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
    ],
    symptoms: [
      "not cooling",
      "not heating",
      "weak airflow",
      "blocked",
      "leaking",
      "noisy",
      "intermittent",
      "slow response",
      "sticking",
      "unresponsive",
      "inoperative",
      "restricted output",
      "contaminated",
      "overheating",
      "misaligned",
      "corroded",
      "vibrating",
    ],
  },
  internal_warning_lamps: {
    aliases: ["Warning Lamps"],
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
    ],
    symptoms: [
      "illuminated",
      "stuck on",
      "flickering",
      "intermittent",
      "false trigger",
      "inoperative",
      "dim",
      "unresponsive",
      "slow response",
      "misreporting",
      "corrupted display",
      "damaged",
      "loose",
      "overheating",
      "restricted visibility",
    ],
  },
  internal_seatbelt: {
    aliases: ["Seatbelt"],
    components: [
      "Seatbelt",
      "Front seatbelt",
      "Rear seatbelt",
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
    ],
    symptoms: [
      "frayed",
      "sticking",
      "not retracting",
      "slow retract",
      "locked",
      "loose",
      "damaged",
      "inoperative",
      "intermittent",
      "noisy",
      "misaligned",
      "corroded",
      "split",
      "restricted movement",
      "unresponsive",
      "worn",
    ],
  },
  internal_miscellaneous: {
    aliases: ["Miscellaneous"],
    skipGeneration: true,
  },

  underside_exhaust_system_catalyst: {
    aliases: ["Exhaust system/catalyst", "Exhaust System/Catalyst"],
    components: [
      "Exhaust system",
      "Exhaust manifold",
      "Catalyst",
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
    ],
    symptoms: [
      "leaking",
      "blowing",
      "noisy",
      "corroded",
      "damaged",
      "loose",
      "cracked",
      "restricted flow",
      "blocked",
      "vibrating",
      "misaligned",
      "overheating",
      "intermittent rattle",
      "binding",
      "sticking",
      "contaminated",
    ],
  },
  underside_steering: {
    aliases: ["Steering"],
    components: [
      "Steering system",
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
    ],
    symptoms: [
      "noisy",
      "stiff",
      "loose",
      "leaking",
      "binding",
      "sticking",
      "misaligned",
      "vibrating",
      "worn",
      "damaged",
      "corroded",
      "intermittent assistance",
      "inoperative",
      "unresponsive",
      "overheating",
      "restricted movement",
    ],
  },
  underside_front_suspension: {
    aliases: ["Front suspension", "Front Suspension"],
    components: [
      "Front suspension",
      "Front shock absorber",
      "Front spring",
      "Front strut",
      "Front top mount",
      "Front lower arm",
      "Front anti-roll bar link",
      "Front anti-roll bar bush",
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
    ],
    symptoms: [
      "noisy",
      "leaking",
      "worn",
      "damaged",
      "loose",
      "misaligned",
      "corroded",
      "binding",
      "sticking",
      "vibrating",
      "cracked",
      "split",
      "restricted travel",
      "intermittent knock",
      "overheating",
      "unresponsive damping",
    ],
  },
  underside_rear_suspension: {
    aliases: ["Rear suspension", "Rear Suspension"],
    components: [
      "Rear suspension",
      "Rear shock absorber",
      "Rear spring",
      "Rear strut",
      "Rear top mount",
      "Rear lower arm",
      "Rear anti-roll bar link",
      "Rear anti-roll bar bush",
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
    ],
    symptoms: [
      "noisy",
      "leaking",
      "worn",
      "damaged",
      "loose",
      "misaligned",
      "corroded",
      "binding",
      "sticking",
      "vibrating",
      "cracked",
      "split",
      "restricted travel",
      "intermittent knock",
      "overheating",
      "unresponsive damping",
    ],
  },
  underside_driveshafts_oil_leaks: {
    aliases: ["Driveshafts/oil leaks", "Driveshafts/Oil Leaks"],
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
    ],
    symptoms: [
      "leaking",
      "seeping",
      "split",
      "perished",
      "damaged",
      "worn",
      "noisy",
      "vibrating",
      "sticking",
      "binding",
      "loose",
      "corroded",
      "misaligned",
      "contaminated",
      "intermittent",
      "restricted movement",
      "overheating",
      "unresponsive",
    ],
  },
  underside_miscellaneous: {
    aliases: ["Miscellaneous"],
    skipGeneration: true,
  },

  brakes_front_pads: {
    aliases: ["Front Pads"],
    components: [
      "Front pads",
      "Front brake pads",
      "Front pad material",
      "Front pad backing plate",
      "Front pad wear sensor",
      "Front pad carrier",
      "Front pad retaining clips",
      "Front pad spring",
      "Front pad shim",
      "Front friction surface",
    ],
    symptoms: ["worn", "binding", "contaminated", "noisy", "cracked", "damaged", "loose", "overheating", "misaligned", "sticking"],
  },
  brakes_rear_pads: {
    aliases: ["Rear Pads"],
    components: [
      "Rear pads",
      "Rear brake pads",
      "Rear pad material",
      "Rear pad backing plate",
      "Rear pad wear sensor",
      "Rear pad carrier",
      "Rear pad retaining clips",
      "Rear pad spring",
      "Rear pad shim",
      "Rear friction surface",
    ],
    symptoms: ["worn", "binding", "contaminated", "noisy", "cracked", "damaged", "loose", "overheating", "misaligned", "sticking"],
  },
  brakes_front_discs: {
    aliases: ["Front Discs"],
    components: [
      "Front discs",
      "Front brake discs",
      "Front rotor face",
      "Front disc hub face",
      "Front disc vent channels",
      "Front disc edge",
      "Front rotor mounting",
      "Front disc friction surface",
      "Front disc cooling vanes",
      "Front disc runout",
    ],
    symptoms: ["lipped", "scored", "corroded", "cracked", "warped", "overheating", "vibrating", "binding", "noisy", "worn"],
  },
  brakes_rear_discs: {
    aliases: ["Rear Discs"],
    components: [
      "Rear discs",
      "Rear brake discs",
      "Rear rotor face",
      "Rear disc hub face",
      "Rear disc vent channels",
      "Rear disc edge",
      "Rear rotor mounting",
      "Rear disc friction surface",
      "Rear disc cooling vanes",
      "Rear disc runout",
    ],
    symptoms: ["lipped", "scored", "corroded", "cracked", "warped", "overheating", "vibrating", "binding", "noisy", "worn"],
  },
  brakes_rear_drum: {
    aliases: ["Rear Drum"],
    components: [
      "Rear drum",
      "Rear brake drum",
      "Rear shoe assembly",
      "Rear wheel cylinder",
      "Rear drum adjuster",
      "Rear drum backing plate",
      "Rear drum springs",
      "Rear handbrake lever",
      "Rear drum friction surface",
      "Rear drum hardware",
    ],
    symptoms: ["worn", "binding", "contaminated", "leaking", "cracked", "damaged", "noisy", "misadjusted", "overheating", "sticking"],
  },

  service_service_reminder: {
    aliases: ["service"],
    components: ["Service reminder", "Service indicator", "Service interval display", "Service reminder circuit", "Service warning message", "Service reminder logic", "Service monitor"],
    symptoms: ["illuminated", "stuck on", "intermittent", "false trigger", "inoperative", "unresponsive", "misreporting", "flickering", "delayed reset", "restricted function"],
  },
  service_oil_level: {
    aliases: ["oil"],
    components: ["Oil level reading", "Oil level sensor", "Oil level monitor", "Oil level display", "Oil condition signal", "Oil quantity status", "Oil service input"],
    symptoms: ["low reading", "incorrect reading", "intermittent", "inoperative", "unresponsive", "contaminated", "delayed update", "stuck value", "false warning", "restricted function"],
  },
  service_under_bonnet_general: {
    aliases: ["Antifreeze Strength", "Water/Oil", "Fluid Leaks", "Alternator Belt/Battery", "Power Steering Fluid", "Fuel System", "Cam Belt", "Service reminder/Oil level"],
    components: ["Under bonnet system", "Engine bay check", "Fluid condition", "Drive belt system", "Battery condition", "Fuel feed line", "Cooling system", "Ancillary drive", "Engine bay wiring", "Engine bay fixings"],
    symptoms: ["leaking", "contaminated", "worn", "damaged", "loose", "misaligned", "corroded", "intermittent", "noisy", "restricted function"],
  },
  service_under_bonnet_miscellaneous: {
    aliases: ["service_miscellaneous"],
    skipGeneration: true,
  },

  wheels_nsf: {
    aliases: ["NSF"],
    components: ["NSF tyre", "NSF tread", "NSF sidewall", "NSF valve", "NSF wheel rim", "NSF bead seat", "NSF tyre shoulder", "NSF wheel balance", "NSF wheel nut seat", "NSF tyre carcass"],
    symptoms: ["worn", "split", "perished", "damaged", "leaking", "slow puncture", "misaligned wear", "noisy", "vibrating", "contaminated"],
  },
  wheels_osf: {
    aliases: ["OSF"],
    components: ["OSF tyre", "OSF tread", "OSF sidewall", "OSF valve", "OSF wheel rim", "OSF bead seat", "OSF tyre shoulder", "OSF wheel balance", "OSF wheel nut seat", "OSF tyre carcass"],
    symptoms: ["worn", "split", "perished", "damaged", "leaking", "slow puncture", "misaligned wear", "noisy", "vibrating", "contaminated"],
  },
  wheels_nsr: {
    aliases: ["NSR"],
    components: ["NSR tyre", "NSR tread", "NSR sidewall", "NSR valve", "NSR wheel rim", "NSR bead seat", "NSR tyre shoulder", "NSR wheel balance", "NSR wheel nut seat", "NSR tyre carcass"],
    symptoms: ["worn", "split", "perished", "damaged", "leaking", "slow puncture", "misaligned wear", "noisy", "vibrating", "contaminated"],
  },
  wheels_osr: {
    aliases: ["OSR"],
    components: ["OSR tyre", "OSR tread", "OSR sidewall", "OSR valve", "OSR wheel rim", "OSR bead seat", "OSR tyre shoulder", "OSR wheel balance", "OSR wheel nut seat", "OSR tyre carcass"],
    symptoms: ["worn", "split", "perished", "damaged", "leaking", "slow puncture", "misaligned wear", "noisy", "vibrating", "contaminated"],
  },
  wheels_spare: {
    aliases: ["Spare"],
    components: ["Spare tyre", "Spare wheel", "Spare tread", "Spare valve", "Spare wheel carrier", "Spare securing bolt", "Spare tyre shoulder", "Spare wheel rim", "Spare tyre sidewall", "Spare wheel fixings"],
    symptoms: ["worn", "perished", "damaged", "leaking", "underinflated", "corroded", "loose", "sticking", "restricted access", "unserviceable"],
  },
};

const cacheBySection = new Map();

const normaliseText = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase();

const capitalize = (value = "") => value.charAt(0).toUpperCase() + value.slice(1);

const combineUnique = (...lists) => {
  const seen = new Set();
  const output = [];
  lists.forEach((list) => {
    (list || []).forEach((item) => {
      const token = item.toString().trim();
      if (!token) return;
      const key = normaliseText(token);
      if (seen.has(key)) return;
      seen.add(key);
      output.push(token);
    });
  });
  return output;
};

const buildSectionSuggestions = (seed = {}) => {
  if (!seed || seed.skipGeneration) return [];

  const components = combineUnique(seed.components || []);
  const symptoms = combineUnique(seed.symptoms || [], COMMON_SYMPTOMS);
  const suggestions = [];
  const seen = new Set();

  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    const component = components[componentIndex];
    for (let symptomIndex = 0; symptomIndex < symptoms.length; symptomIndex += 1) {
      const symptom = symptoms[symptomIndex];
      for (let qualifierIndex = 0; qualifierIndex < ISSUE_QUALIFIERS.length; qualifierIndex += 1) {
        const qualifier = ISSUE_QUALIFIERS[qualifierIndex];
        const symptomPhrase = qualifier ? `${qualifier} ${symptom}` : symptom;
        for (let actionIndex = 0; actionIndex < RECOMMENDED_ACTIONS.length; actionIndex += 1) {
          const action = RECOMMENDED_ACTIONS[actionIndex];
          const sentence = `${component} ${symptomPhrase}, ${action}`;
          const key = normaliseText(sentence);
          if (seen.has(key)) continue;
          seen.add(key);
          suggestions.push(sentence);
          if (suggestions.length >= MIN_SUGGESTIONS_PER_SECTION) {
            return suggestions;
          }
        }
      }
    }
  }

  if (suggestions.length === 0) return suggestions;

  let index = 0;
  while (suggestions.length < MIN_SUGGESTIONS_PER_SECTION) {
    const base = suggestions[index % suggestions.length];
    const variant = `${base.replace(",", " and")}, requires inspection`;
    const key = normaliseText(variant);
    if (!seen.has(key)) {
      seen.add(key);
      suggestions.push(variant);
    }
    index += 1;
  }

  return suggestions;
};

const SECTION_ALIASES = Object.entries(SECTION_SEEDS).reduce((acc, [sectionKey, seed]) => {
  acc[normaliseText(sectionKey)] = sectionKey;
  (seed.aliases || []).forEach((alias) => {
    acc[normaliseText(alias)] = sectionKey;
  });
  return acc;
}, {});

export const resolveIssueSectionKey = (sectionKey = "") => {
  const lookup = normaliseText(sectionKey);
  return SECTION_ALIASES[lookup] || lookup;
};

export const ISSUE_SUGGESTIONS_BY_SECTION = Object.keys(SECTION_SEEDS).reduce((acc, key) => {
  acc[key] = buildSectionSuggestions(SECTION_SEEDS[key]);
  return acc;
}, {});

const fuzzyMatchScore = (candidate = "", query = "") => {
  if (!candidate || !query) return Number.POSITIVE_INFINITY;
  let queryPos = 0;
  let firstMatchIndex = -1;
  let lastMatchIndex = -1;

  for (let i = 0; i < candidate.length && queryPos < query.length; i += 1) {
    if (candidate[i] === query[queryPos]) {
      if (firstMatchIndex === -1) firstMatchIndex = i;
      lastMatchIndex = i;
      queryPos += 1;
    }
  }

  if (queryPos !== query.length) {
    return Number.POSITIVE_INFINITY;
  }

  const spreadPenalty = lastMatchIndex - firstMatchIndex;
  return firstMatchIndex * 2 + spreadPenalty;
};

const getCacheBucket = (sectionKey) => {
  if (!cacheBySection.has(sectionKey)) {
    cacheBySection.set(sectionKey, new Map());
  }
  return cacheBySection.get(sectionKey);
};

const storeCachedResult = (sectionKey, queryKey, result) => {
  const bucket = getCacheBucket(sectionKey);
  bucket.set(queryKey, result);
  if (bucket.size > MAX_CACHE_QUERIES_PER_SECTION) {
    const oldestKey = bucket.keys().next().value;
    if (oldestKey) {
      bucket.delete(oldestKey);
    }
  }
};

export const getIssueSuggestions = (sectionKey = "", query = "", limit = DEFAULT_LIMIT) => {
  const resolvedSectionKey = resolveIssueSectionKey(sectionKey);
  const available = ISSUE_SUGGESTIONS_BY_SECTION[resolvedSectionKey] || [];
  const normalizedQuery = normaliseText(query);
  const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : DEFAULT_LIMIT;

  if (!normalizedQuery || available.length === 0) {
    return [];
  }

  const cacheKey = `${normalizedQuery}|${normalizedLimit}`;
  const bucket = getCacheBucket(resolvedSectionKey);
  const cached = bucket.get(cacheKey);
  if (cached) {
    return cached;
  }

  const ranked = [];

  for (let i = 0; i < available.length; i += 1) {
    const suggestion = available[i];
    const candidate = normaliseText(suggestion);

    if (candidate.startsWith(normalizedQuery)) {
      ranked.push({ suggestion, tier: 0, distance: 0, order: i });
      continue;
    }

    const containsIndex = candidate.indexOf(normalizedQuery);
    if (containsIndex >= 0) {
      ranked.push({ suggestion, tier: 1, distance: containsIndex, order: i });
      continue;
    }

    const fuzzyDistance = fuzzyMatchScore(candidate, normalizedQuery);
    if (Number.isFinite(fuzzyDistance)) {
      ranked.push({ suggestion, tier: 2, distance: fuzzyDistance, order: i });
    }
  }

  ranked.sort((left, right) => {
    if (left.tier !== right.tier) return left.tier - right.tier;
    if (left.distance !== right.distance) return left.distance - right.distance;
    if (left.order !== right.order) return left.order - right.order;
    return left.suggestion.localeCompare(right.suggestion);
  });

  const results = ranked.slice(0, normalizedLimit).map((entry) => entry.suggestion);
  storeCachedResult(resolvedSectionKey, cacheKey, results);
  return results;
};

export const ISSUE_SECTION_LABELS = Object.keys(SECTION_SEEDS).reduce((acc, key) => {
  acc[key] = capitalize(key.replace(/_/g, " "));
  return acc;
}, {});
