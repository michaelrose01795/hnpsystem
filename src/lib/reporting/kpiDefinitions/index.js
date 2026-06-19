// file location: src/lib/reporting/kpiDefinitions/index.js
//
// Registers the seed KPI catalogue into the in-memory registry. Importing this
// module (side-effecting) populates the catalogue; the engine imports it once.
//
// This is the SEED set — a representative slice of the R1 (buildable-now) metrics
// from the Phase-3 catalogue, across Workshop / VHC / Parts / Accounts. It exists
// to prove the plug-in contract end-to-end (catalogue → resolver → engine → API).
// The full ~110-KPI catalogue is added here the same way, in the Phase-3 §16
// priority order, as the event/history spine (R2) and missing entities (R3) land.
// NO department report pages or dashboards are built — only the metric definitions.

import { registerKpis, catalogSize } from "../kpiCatalog";
import { workshopKpis } from "./workshop";
import { vhcKpis } from "./vhc";
import { partsKpis } from "./parts";
import { accountsKpis } from "./accounts";
import { serviceKpis } from "./service";
import { motKpis } from "./mot";

let registered = false;

// Idempotent registration — safe to call from multiple entry points.
export function registerSeedKpis() {
  if (registered) return catalogSize();
  registerKpis([...workshopKpis, ...vhcKpis, ...partsKpis, ...accountsKpis, ...serviceKpis, ...motKpis]);
  registered = true;
  return catalogSize();
}

// Side-effect on import so `import "@/lib/reporting/kpiDefinitions"` is enough.
registerSeedKpis();

export default registerSeedKpis;
