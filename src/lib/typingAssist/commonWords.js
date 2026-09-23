// file location: src/lib/typingAssist/commonWords.js
//
// Seed data for the word predictor and for ranking spelling suggestions.
//
// COMMON_WORDS is ordered most-frequent first (general written English, then
// the dealership vocabulary staff type every day). The predictor learns from
// what each person actually types and quickly outranks this seed; the seed
// only decides what is offered before it has learned anything.

const GENERAL = `
the of and to a in is it you that he was for on are with as his they be at one have this from or had by
not word but what some we can out other were all there when up use your how said an each she which do their
time if will way about many then them write would like so these her long make thing see him two has look
more day could go come did number sound no most people my over know water than call first who may down side
been now find any new work part take get place made live where after back little only round man year came
show every good me give our under name very through just form sentence great think say help low line differ
turn cause much mean before move right boy old too same tell does set three want air well also play small end
put home read hand port large spell add even land here must big high such follow act why ask men change went
light kind off need house picture try us again animal point mother world near build self earth father head
stand own page should country found answer school grow study still learn plant cover food sun four between
state keep eye never last let thought city tree cross farm hard start might story saw far sea draw left late
run don't while press close night real life few north open seem together next white children begin got walk
example ease paper group always music those both mark often letter until mile river car feet care second book
carry took science eat room friend began idea fish mountain stop once base hear horse cut sure watch face wood
main enough plain girl usual young ready above ever red list though feel talk bird soon body dog family direct
pose leave song measure door product black short numeral class wind question happen complete ship area half
rock order fire south problem piece told knew pass since top whole king space heard best hour better true
during hundred five remember step early hold west ground interest reach fast verb sing listen six table
travel less morning ten simple several vowel toward war lay against pattern slow centre love person money
serve appear road map rain rule govern pull cold notice voice unit power town fine certain fly fall lead cry
dark machine note wait plan figure star box noun field rest correct able pound done beauty drive stood
contain front teach week final gave green oh quick develop ocean warm free minute strong special mind behind
clear tail produce fact street inch multiply nothing course stay wheel full force blue object decide surface
deep moon island foot system busy test record boat common gold possible plane stead dry wonder laugh thousand
ago ran check game shape equate hot miss brought heat snow tyre bring yes distant fill east paint language
among please thank thanks regards kind kindly sincerely hello hi dear morning afternoon evening sorry
apologies unfortunately however therefore also although because customer customers vehicle vehicles
service services servicing booking bookings booked appointment appointments available availability today
tomorrow yesterday monday tuesday wednesday thursday friday saturday sunday january february march april
june july august september october november december advise advised advice recommend recommended repair
repairs repaired replace replaced replacement required require requires estimate quote quoted invoice
invoices payment paid collect collection collected delivery delivered deliver order ordered parts part
stock supplier warranty inspection inspected check checked checks report reported issue issues fault
faults noise noises leak leaking worn wear damage damaged brake brakes pads discs front rear nearside
offside tyres wheel wheels alignment tracking battery engine oil filter filters coolant clutch gearbox
exhaust suspension steering light lights bulb bulbs wiper wipers windscreen bonnet boot door doors mirror
seat seats key keys fob mileage registration technician technicians workshop advisor manager team staff
job jobs card cards approved approval authorised declined pending complete completed progress started
waiting contacted contact call called phone email emailed message messages spoke discussed confirmed
confirm arrange arranged update updated information details detail please let know soon possible asap
urgent concern concerns noted note notes follow further additional previous previously currently
recently next following attached photo photos video videos vhc mot due expired expires valet cleaned
courtesy loan returned return
`;

export const COMMON_WORDS = Object.freeze(
  [...new Set(GENERAL.split(/\s+/).filter((w) => /^[a-z']{1,}$/.test(w)))]
);

// Word -> rank (0 = most common). Shared with the spell engine's ranking.
export const COMMON_RANK = new Map(COMMON_WORDS.map((word, index) => [word, index]));

// Phrases staff and customers type constantly. Each adjacent pair becomes a
// seeded next-word prediction: after "kind" the predictor offers "regards".
export const SEED_PHRASES = Object.freeze([
  "kind regards",
  "best regards",
  "many thanks",
  "thank you for your time",
  "thank you for your patience",
  "thank you for letting us know",
  "please let me know",
  "please let us know",
  "please find attached",
  "as soon as possible",
  "look forward to hearing from you",
  "if you have any questions",
  "do not hesitate to contact us",
  "sorry for the inconvenience",
  "at your earliest convenience",
  "customer advised",
  "customer contacted",
  "customer declined",
  "customer approved the work",
  "awaiting customer approval",
  "awaiting parts",
  "parts on order",
  "parts ordered",
  "vehicle ready for collection",
  "vehicle booked in",
  "booked in for a service",
  "front brake pads",
  "rear brake pads",
  "front brake discs",
  "rear brake discs",
  "brake fluid",
  "tyre pressures",
  "tread depth",
  "wheel alignment",
  "engine management light",
  "warning light",
  "oil and filter",
  "air filter",
  "pollen filter",
  "fuel filter",
  "wiper blades",
  "number plate",
  "service history",
  "road test",
  "no fault found",
  "further investigation required",
  "recommend replacing",
  "requires replacement",
  "within the next",
  "health check",
  "courtesy car",
  "key fob",
]);
