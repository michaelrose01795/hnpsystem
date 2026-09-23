// file location: src/lib/parts/vehicleFitment.js
//
// Which vehicle a part fits, read from the part itself.
//
// public.parts_catalog has no make, model or fitment columns, so compatibility
// cannot be looked up — it is inferred from the words the parts team already
// writes into the name, description and OE reference ("Swift Hybrid Service
// Kit", "Outlander PHEV front pads"). A part that names no model reads as
// "check fitment" rather than being guessed at.
//
// One registry, three consumers, so they cannot disagree:
//   - fitmentFor()            the compatibility line on a product tile
//   - fitmentSearchTerms()    the manufacturer / model filter in Postgres
//                             (src/lib/database/partsCatalogPublic.js)
//   - PARTS_MAKES / modelsForMake() / makeFromDvla()
//                             the "Find parts for my vehicle" picker
//
// The model lists cover what the parts counter still sells parts for, not just
// the current new-car range, so older Grand Vitaras and Colts can be found.
// Pure and dependency-free: safe on the server and in the browser.

export const PARTS_MAKES = [
  {
    make: "Suzuki",
    models: [
      "Across", "Alto", "Baleno", "Celerio", "e-Vitara", "Grand Vitara", "Ignis",
      "Jimny", "Kizashi", "Liana", "S-Cross", "Splash", "Swace", "Swift", "SX4",
      "Vitara", "Wagon R",
    ],
  },
  {
    make: "Mitsubishi",
    models: [
      "ASX", "Colt", "Eclipse Cross", "Grandis", "i-MiEV", "L200", "Lancer",
      "Mirage", "Outlander", "Shogun", "Shogun Sport", "Space Star",
    ],
  },
];

const byMake = new Map(PARTS_MAKES.map((entry) => [entry.make.toLowerCase(), entry]));

/** The registry's own spelling for a make, or null when we do not carry it. */
export const canonicalMake = (value) => byMake.get(String(value || "").trim().toLowerCase())?.make || null;

/** Models for a make, A–Z. Unknown make -> []. */
export const modelsForMake = (make) => byMake.get(String(make || "").trim().toLowerCase())?.models || [];

/** DVLA returns makes shouting ("SUZUKI"); map to the registry spelling. */
export const makeFromDvla = (dvlaMake) => canonicalMake(dvlaMake);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Longest names first, so "Grand Vitara", "e-Vitara" and "Shogun Sport" are
// consumed before "Vitara" and "Shogun" get a chance to match inside them.
const MODEL_MATCHERS = PARTS_MAKES.flatMap(({ make, models }) =>
  models.map((model) => ({
    make,
    model,
    pattern: new RegExp(`(^|[^a-z0-9])${escapeRegExp(model.toLowerCase())}(?=[^a-z0-9]|$)`, "i"),
  })),
).sort((a, b) => b.model.length - a.model.length);

const MAKE_MATCHERS = PARTS_MAKES.map(({ make }) => ({
  make,
  pattern: new RegExp(`(^|[^a-z0-9])${make.toLowerCase()}(?=[^a-z0-9]|$)`, "i"),
}));

/**
 * Fitment for a product, from its own text.
 *
 * @returns {{ make: string|null, models: string[], label: string|null }}
 *   label is the customer-facing line, or null when the part names nothing.
 */
export const fitmentFor = ({ name, description, oem_reference: oem, brand } = {}) => {
  let text = [name, description, oem].filter(Boolean).join(" ").toLowerCase();
  const found = [];
  MODEL_MATCHERS.forEach((matcher) => {
    if (!matcher.pattern.test(text)) return;
    found.push(matcher);
    // Blank every occurrence out so a shorter name cannot match inside one.
    text = text.replace(new RegExp(matcher.pattern.source, "gi"), "$1 ");
  });

  const makes = [...new Set(found.map((f) => f.make))];
  const makeInText = MAKE_MATCHERS.find((m) => m.pattern.test(text))?.make || null;
  const make = makes.length === 1 ? makes[0] : makes.length ? null : makeInText || canonicalMake(brand);
  const models = found.map((f) => f.model).sort((a, b) => a.localeCompare(b));

  let label = null;
  if (models.length && make) label = `Fits ${make} ${models.join(", ")}`;
  else if (models.length) label = `Fits ${models.join(", ")}`;
  else if (make) label = `Fits ${make} models`;

  return { make, models, label };
};

/**
 * Words that identify parts for a vehicle, for an ILIKE filter.
 *   { model }        -> [model]
 *   { make }         -> [make, ...every model of that make]
 * Returns [] when nothing usable was passed (no filter).
 */
export const fitmentSearchTerms = ({ make, model } = {}) => {
  const canonical = canonicalMake(make);
  const models = canonical ? modelsForMake(canonical) : PARTS_MAKES.flatMap((m) => m.models);
  const wantedModel = models.find((m) => m.toLowerCase() === String(model || "").trim().toLowerCase());
  if (wantedModel) return [wantedModel];
  if (canonical) return [canonical, ...modelsForMake(canonical)];
  return [];
};

/** Client-side twin of the Postgres filter, for code-owned product lists. */
export const productFitsVehicle = (product, vehicle = {}) => {
  const terms = fitmentSearchTerms(vehicle);
  if (!terms.length) return true;
  const text = [product?.name, product?.description, product?.oem_reference, product?.brand]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return terms.some((term) => text.includes(term.toLowerCase()));
};
