// file location: src/lib/stock/stockNumber.js
// Stock-number issuing for vehicle sales stock (DMS side).
//
// WHY THIS IS NOT DERIVED FROM THE REGISTRATION
// ---------------------------------------------
// A registration is not a stable key for a stock record. The same plate can
// come back through the forecourt years later (a part-exchange returning, a
// customer car bought back, a trade purchase of a car we previously sold), and
// it can even change condition class between visits — sold new in 2023,
// re-taken as used in 2026. If the stock number were a function of the reg,
// the second listing would inherit the first one's number and, with it, all of
// its history: old photos, the old price, the old advert's enquiries.
//
// So a stock number is issued from a monotonic sequence that is seeded from
// EVERY number ever issued — live stock and retired stock alike — and is never
// reused. A reg re-entering stock therefore always gets a brand-new number,
// and the retired record keeps its own. Lookups by reg (see vehicleStock.js)
// resolve to the CURRENT listing only; retired records are addressed by their
// stock number and never surface on the customer site.
//
// Format: <C>-<YY>-<NNNN>   e.g. N-26-0142, U-26-0143
//   C   N = new, U = used   (the "new / used" marker the stock number carries)
//   YY  two-digit year the vehicle was taken into stock
//   NNNN zero-padded sequence, unique for the life of the dealership

export const STOCK_CONDITIONS = ["new", "used"];

const CONDITION_PREFIX = { new: "N", used: "U" };

// N-26-0142 -> { prefix: "N", year: "26", sequence: 142 }
const STOCK_NUMBER_RE = /^([NU])-(\d{2})-(\d{4,})$/;

export const isStockNumber = (value) => STOCK_NUMBER_RE.test(String(value || "").toUpperCase());

export const parseStockNumber = (value) => {
  const match = STOCK_NUMBER_RE.exec(String(value || "").toUpperCase());
  if (!match) return null;
  return {
    prefix: match[1],
    condition: match[1] === "N" ? "new" : "used",
    year: match[2],
    sequence: Number(match[3]),
  };
};

const sequenceOf = (value) => parseStockNumber(value)?.sequence ?? 0;

const twoDigitYear = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  return String(year % 100).padStart(2, "0");
};

export const formatStockNumber = ({ condition, stockedAt, sequence }) => {
  const prefix = CONDITION_PREFIX[condition] || CONDITION_PREFIX.used;
  return `${prefix}-${twoDigitYear(stockedAt)}-${String(sequence).padStart(4, "0")}`;
};

/**
 * Create an issuer seeded with every stock number already spent.
 *
 * @param {string[]} issued - live AND retired stock numbers. Passing only the
 *   live ones is the bug this whole module exists to prevent: the sequence
 *   would restart over numbers that retired records still hold.
 */
export function createStockNumberIssuer(issued = []) {
  const spent = new Set();
  let highest = 0;

  const remember = (stockNumber) => {
    const normalised = String(stockNumber || "").toUpperCase();
    if (!isStockNumber(normalised)) return;
    spent.add(normalised);
    highest = Math.max(highest, sequenceOf(normalised));
  };

  issued.forEach(remember);

  return {
    /** Has this exact number ever been handed out? */
    hasIssued: (stockNumber) => spent.has(String(stockNumber || "").toUpperCase()),

    /** Every number spent so far, for persisting the issuer's state. */
    issued: () => Array.from(spent),

    /**
     * Issue the next free stock number. Walks past any number already spent,
     * so a manually-entered number can never be handed out a second time.
     */
    issue({ condition = "used", stockedAt = new Date() } = {}) {
      let next;
      do {
        highest += 1;
        next = formatStockNumber({ condition, stockedAt, sequence: highest });
      } while (spent.has(next));
      spent.add(next);
      return next;
    },
  };
}

export default createStockNumberIssuer;
