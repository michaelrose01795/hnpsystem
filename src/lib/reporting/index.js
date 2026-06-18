// file location: src/lib/reporting/index.js
//
// Public barrel for the reporting engine. The reporting API and any future
// reporting UI import from here. Importing the engine registers the seed KPI
// catalogue as a side-effect (via engine.js → ./kpiDefinitions).

export {
  getKpiValue,
  getKpiValues,
  getTrend,
  getDrilldown,
  getVisibleCatalog,
} from "./engine";

export { withReportingAuth } from "./api";
export { auditReportAccess } from "./audit";
export { resolveScope, SCOPE_LEVELS } from "./permissionScope";
export { normaliseFilter, validateFilter } from "./filters";
export { buildEnvelope, buildErrorEnvelope } from "./envelope";
export { buildCsvExport, toCsv } from "./export";
export { runAggregation } from "./aggregation/runner";
export { getKpi, listKpis, defineKpi, registerKpi } from "./kpiCatalog";
export { getReportingFlag } from "./config/flags";
export { DEPARTMENTS, resolveDepartmentForRole } from "./config/departments";
export { normaliseStatus } from "./config/statusMaps";
export { EVENT_CATALOGUE, validateEvent } from "./config/eventCatalogue";
