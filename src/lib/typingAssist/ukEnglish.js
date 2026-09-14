// file location: src/lib/typingAssist/ukEnglish.js
//
// Word data for the typing assistant (src/components/ui/typingAssist/).
// Pure data — no DOM, no dictionary — so the spell engine, the grammar rules
// and the unit tests all read the same lists.
//
//   US_TO_UK            American spellings with their UK form. Flagged even
//                       when the Hunspell dictionary would accept them.
//   COMMON_MISSPELLINGS Frequent typos whose fix is unambiguous. Always the
//                       top suggestion, ahead of the dictionary's own guesses.
//   DOMAIN_WORDS        Dealership / automotive vocabulary the general
//                       dictionary does not know. Always treated as correct.

export const US_TO_UK = {
  color: "colour", colors: "colours", colored: "coloured", coloring: "colouring", colorful: "colourful",
  favor: "favour", favors: "favours", favorite: "favourite", favorites: "favourites", favorable: "favourable",
  honor: "honour", honors: "honours", honored: "honoured", honorable: "honourable",
  labor: "labour", labors: "labours", labored: "laboured",
  neighbor: "neighbour", neighbors: "neighbours", neighborhood: "neighbourhood",
  behavior: "behaviour", behaviors: "behaviours", behavioral: "behavioural",
  humor: "humour", rumor: "rumour", rumors: "rumours", flavor: "flavour", flavors: "flavours",
  harbor: "harbour", vapor: "vapour", endeavor: "endeavour", armor: "armour", parlor: "parlour",
  center: "centre", centers: "centres", centered: "centred", theater: "theatre", theaters: "theatres",
  fiber: "fibre", fibers: "fibres", liter: "litre", liters: "litres", caliber: "calibre", somber: "sombre",
  catalog: "catalogue", catalogs: "catalogues", analog: "analogue",
  defense: "defence", offense: "offence", pretense: "pretence",
  analyze: "analyse", analyzed: "analysed", analyzing: "analysing", paralyze: "paralyse", catalyze: "catalyse",
  organize: "organise", organized: "organised", organizing: "organising", organization: "organisation", organizations: "organisations",
  realize: "realise", realized: "realised", realizing: "realising", recognize: "recognise", recognized: "recognised",
  apologize: "apologise", apologized: "apologised", apologizing: "apologising",
  authorize: "authorise", authorized: "authorised", authorization: "authorisation",
  prioritize: "prioritise", prioritized: "prioritised", optimize: "optimise", optimized: "optimised",
  customize: "customise", customized: "customised", finalize: "finalise", finalized: "finalised",
  minimize: "minimise", maximize: "maximise", summarize: "summarise", summarized: "summarised",
  emphasize: "emphasise", criticize: "criticise", utilize: "utilise", utilized: "utilised",
  traveled: "travelled", traveling: "travelling", traveler: "traveller", travelers: "travellers",
  canceled: "cancelled", canceling: "cancelling", labeled: "labelled", labeling: "labelling",
  modeled: "modelled", modeling: "modelling", fueled: "fuelled", fueling: "fuelling",
  signaled: "signalled", signaling: "signalling", totaled: "totalled", jewelry: "jewellery",
  counselor: "counsellor", enrollment: "enrolment", fulfill: "fulfil", installment: "instalment",
  gray: "grey", grays: "greys", aluminum: "aluminium", mold: "mould", molds: "moulds", moldy: "mouldy",
  plow: "plough", pajamas: "pyjamas", maneuver: "manoeuvre", maneuvers: "manoeuvres",
  mom: "mum", airplane: "aeroplane", windshield: "windscreen", windshields: "windscreens",
  cozy: "cosy", skeptical: "sceptical", mustache: "moustache",
};
// Deliberately NOT listed: words that are also correct UK English in another
// sense — tire/tyre, license/licence, practice/practise, check/cheque,
// program/programme. grammarRules.js corrects those from their context.

export const COMMON_MISSPELLINGS = {
  teh: "the", adn: "and", taht: "that", thier: "their", hte: "the", wiht: "with", whith: "with",
  hwole: "whole", becuase: "because", becasue: "because", beacuse: "because", wich: "which", whcih: "which",
  recieve: "receive", recieved: "received", reciept: "receipt", beleive: "believe", acheive: "achieve",
  seperate: "separate", seperately: "separately", definately: "definitely", definatly: "definitely",
  occured: "occurred", occuring: "occurring", occurence: "occurrence", untill: "until", tommorow: "tomorrow",
  tomorow: "tomorrow", accomodate: "accommodate", adress: "address", apparantly: "apparently",
  arguement: "argument", calender: "calendar", collegue: "colleague", comittee: "committee",
  concious: "conscious", embarass: "embarrass", enviroment: "environment", existance: "existence",
  familar: "familiar", finaly: "finally", foward: "forward", freind: "friend", goverment: "government",
  grammer: "grammar", gaurd: "guard", happend: "happened", harrass: "harass", immediatly: "immediately",
  independant: "independent", knowlege: "knowledge", liason: "liaison", maintainance: "maintenance",
  maintenence: "maintenance", millenium: "millennium", neccessary: "necessary", necesary: "necessary",
  noticable: "noticeable", occassion: "occasion", persue: "pursue", posession: "possession",
  prefered: "preferred", publically: "publicly", reccomend: "recommend", recomend: "recommend",
  refered: "referred", relevent: "relevant", rember: "remember", responsability: "responsibility",
  succesful: "successful", sucessful: "successful", suprise: "surprise", truely: "truly",
  unfortunatly: "unfortunately", wierd: "weird", writting: "writing", thrugh: "through",
  throught: "through", shoud: "should", woud: "would", coud: "could", chagnes: "changes",
  chagne: "change", settign: "setting", settigns: "settings", dont: "don't", doesnt: "doesn't",
  didnt: "didn't", isnt: "isn't", wasnt: "wasn't", arent: "aren't", werent: "weren't",
  couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't", havent: "haven't", hasnt: "hasn't",
  im: "I'm", ive: "I've", thats: "that's", whats: "what's", theres: "there's", youre: "you're",
  vehical: "vehicle", vehicule: "vehicle", vehicel: "vehicle", milage: "mileage", millage: "mileage",
  exaust: "exhaust", exhuast: "exhaust", suspention: "suspension", warrenty: "warranty",
  warrantee: "warranty", garentee: "guarantee", guarentee: "guarantee", catalitic: "catalytic",
  clucth: "clutch", diagnositc: "diagnostic", diagnotic: "diagnostic", invioce: "invoice",
  apointment: "appointment", appointmnet: "appointment", appointement: "appointment",
  cusomter: "customer", custmer: "customer", customre: "customer", costumer: "customer",
  techician: "technician", technican: "technician", sevice: "service", servcie: "service",
  serivce: "service", brakepads: "brake pads", alternater: "alternator", registation: "registration",
  registraion: "registration", estimte: "estimate", quoute: "quote", availible: "available",
  avaliable: "available", aswell: "as well", infact: "in fact", incase: "in case",
};

export const DOMAIN_WORDS = new Set(
  `
  adblue aircon airbag airbags alloy alloys antifreeze bodyshop bodywork bonnet boot caliper calipers
  coilover coilovers coolant crossover dashcam dashcams diag diagnostics driveshaft driveshafts
  ecu ecus egr foglight foglights hatchback headlamp headlamps hubcap hubcaps immobiliser immobilisers
  infotainment intercooler numberplate numberplates odometer powertrain recalibrate recalibrated
  recalibration remap remapped satnav screenwash sidelight sidelights subframe sublet sublets
  tailgate taillight taillights tpms turbocharger underbody upsell upsold valet valeted valeting
  wheelarch wheelarches wishbone wishbones workshop jobcard jobcards webchat hnp hnpsystem humphries
  reg regs vrm vin dpf dsg cvt awd ev evs phev phevs hev mot mots vhc vhcs courtesy goodwill
  audi bmw citroen cupra dacia fiat ford honda hyundai jaguar kia landrover lexus mazda mercedes
  mitsubishi nissan peugeot polestar porsche renault skoda subaru suzuki tesla toyota vauxhall
  volkswagen volvo vw byd mg
  `
    .split(/\s+/)
    .filter(Boolean)
);

// Suffix rules that turn an American form into its British one. Applied only
// when the typed word is NOT in the UK dictionary, and a candidate is kept only
// if the dictionary accepts it — so "doctor" never becomes "doctour".
export const UK_SUFFIX_RULES = [
  [/iz(e|ed|es|er|ers|ing|ation|ations)$/i, "is$1"],
  [/yz(e|ed|es|ing)$/i, "ys$1"],
  [/or(s|ed|ing|ite|ites|able|ful)?$/i, "our$1"],
  [/([bt])er(s)?$/i, "$1re$2"],
  [/og(s)?$/i, "ogue$1"],
  [/ense(s)?$/i, "ence$1"],
  [/([aeiou])l(ed|ing|er|ers)$/i, "$1ll$2"],
];

// "Colour" for "Color", "COLOUR" for "COLOR".
export function matchCase(source, replacement) {
  if (!source || !replacement) return replacement;
  if (source.length > 1 && source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
