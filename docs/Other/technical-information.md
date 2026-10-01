# Job card technical information

The job-card URL is unchanged: `/job-cards/[jobNumber]`. The information symbol
beside Settings opens vehicle-wide information. The selected customer/authorised
workshop request has its own information symbol in the shared Customer Requests
tab, including the technician route. Both use the same popup.

## Behaviour

- The server loads the vehicle and saved requests from the job number. Clients
  cannot select another vehicle by supplying a VIN or registration in the body.
- Selecting a request suggests technical areas and example questions. These are
  deterministic search suggestions, not generated technical answers.
- Search and browsing retain the job vehicle. A saved request ID must belong to
  that job. Legacy/unsaved request text is only a classification/search hint.
- All 16 technical categories are available, including servicing, fluids,
  torques, diagnostics, repair times and bulletins.
- Identification facts are separate from workshop results. Every fact/result
  names its source; external facts/results include retrieval time. DMS facts are
  explicitly staff-recorded and are not workshop specifications.
- No workshop provider is connected by default. Questions such as “sump plug
  torque” show a missing-approved-source state, never a guessed number.
- A mismatched linked vehicle registration or DVLA/DMS make conflict blocks
  workshop matching. Partial VIN enrichment is never used to choose a variant.

## Vehicle sources and caching

`DVLA_API_KEY` remains server-only. The existing staff DVLA endpoint, public
valuation endpoint and technical-information service share the lookup helper.
The public endpoint retains its rate limit and restricted response fields.

All currently documented VES fields are retained and displayed: registration,
make, manufacture year, colour, fuel, engine capacity, CO₂, tax status/due date,
MOT status/expiry, export marker, wheel plan, type approval, revenue weight, Euro
status, RDE, first registration/DVLA registration, V5C issue date, additional tax
end date and automated-vehicle marker. Missing, false and zero are distinguished.
VES does not supply VIN, model, engine serial number, oil capacities or torques.
Engine capacity is no longer placed in the form's Engine Number field. The job
creation service persists available VES fields only to existing schema columns.
The remaining fields are retrieved through the lookup cache; no migration is required.

Optional VIN enrichment is disabled by default. Set `VPIC_ENABLED=true` on the
server to enable NHTSA vPIC, and restart/redeploy. Only a recorded, valid
17-character VIN triggers a call. Partial/no-data/failed UK decoding leaves DVLA
and DMS data intact. No VIN is invented from a registration.

Cache: at most 500 entries per warm server instance, six hours for VES and thirty
days for VIN decoding, with in-flight request sharing and thirty-second error
backoff. Restarts clear it; separate serverless instances may still make duplicate
calls. A distributed cache can replace `createLookupCache` without changing the
API/UI. No global deduplication or durable lookup history is claimed. HTTP responses
containing job context are private/no-store. SWR coalesces identical UI requests.
Licensed workshop data is not cached by default: an adapter must implement only
the storage/TTL behaviour its licence permits.

## Adding an approved workshop/manufacturer adapter

Implement a server-only module and register it in `workshopProviders` in
`src/lib/technicalInfo/service.js` after checking the licence, applicability and
source data. Never register an arbitrary user-entered URL or a browser scraper.

An adapter has `id`, `label`, `approved: true`, and two asynchronous methods:

1. `resolveVehicle({ vehicle, signal })` returns `{ status, vehicleKey,
   registration, vin }`. Only `status: "exact"` proceeds. Registration must match
   the job and any valid recorded VIN must match. The adapter must use its own
   provider-specific vehicle/engine/variant identifiers and return a non-exact
   status for ambiguous applicability. Registration alone is not evidence of an
   exact variant. Enrichment from vPIC is deliberately not passed as matching evidence.
2. `search({ vehicle, match, query, category, categories, request, signal })`
   returns records with `{ id, title, content, category, vehicleKey, source }`.
   `source` requires `documentId` and a valid `retrievedAt` timestamp; `url` is
   optional and must use HTTPS. Content must be verbatim provider information or
   faithful formatting of its structured fields, never inferred specifications.
   Each record's vehicleKey must equal the resolved match. Categories use the
   IDs in `catalogue.js`. The UI renders plain text, not provider HTML.

Adapters must honour abort signals. The service applies a ten-second provider
deadline and isolates errors. Unapproved adapters, ambiguous matches, mismatched
vehicle keys and records without provenance are discarded. Relevant categories
sort first; explicit category/query filters constrain results. Provider-specific
units, conditions and applicability must stay in the content and source reference.

Autodata login access is not an API licence. No Autodata login, scraping or
credentials were added. A licensed integration can use this same contract later.

## Access and validation

The new POST endpoint uses the existing NextAuth `withRoleGuard` and the same
manifest-derived job-detail page access. `getUserFromRequest` was inspected but
not used: it is currently a placeholder that returns Admin without authentication.
No auth helper, global styling, navigation or context provider was changed.

Focused tests cover request classification, job-bound request validation,
identity mismatches, provider provenance/matching, provider failure isolation,
empty data, cache coalescing/expiry/error backoff, VIN gating and DVLA mapping.
Run `npx vitest run src/lib/technicalInfo` plus the border/layer/dropdown checks.

## Files and review

New modules are separate because provider orchestration, server DB reads, the API,
request hook and the substantial popup have different responsibilities. Existing
job and shared request files contain only the opening controls.

Reviewed: AGENTS.md; Pages Router API documentation; job detail page/presentation;
CustomerRequestsTab; JobSettingsPopup; PopupModal/ModalPortal; LayerTheme;
SymbolButton/Button; DropdownField; vehicleFormState; new-job/new-order lookup
flows; createJobService; database vehicles/jobs/jobSettings; schemaReference.sql;
roleGuard/getUserFromRequest/pageAccess/roles; public valuation lookup; existing
modal and staff CSS. Schema checks covered jobs.vehicle_id/job_number/requests,
vehicles identity/VES columns, and job_requests.job_id/request_id/description.

Section notes updated: header technical-information popup, selected request
details and request technical-information popup. Added notes for the new popup's
vehicle/request, suggestions, workshop results and identification facts sections.

Official references:
- https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/v1.2.0-vehicle-enquiry-service.html
- https://vpic.nhtsa.dot.gov/api/

## Full source files

Each link opens the complete updated file (not a patch).

| File | Responsibility |
| --- | --- |
| [Job card UI](../../src/components/page-ui/job-cards/job-cards-job-number-ui.js) | Header popup entry point |
| [CustomerRequestsTab](../../src/components/JobCards/CustomerRequestsTab.js) | Selected customer/workshop request entry point |
| [TechnicalInfoPopup](../../src/components/page-ui/job-cards/TechnicalInfoPopup.js) | Shared vehicle/request search and browsing UI |
| [useTechnicalInfo](../../src/hooks/useTechnicalInfo.js) | Request loading, deduplication and retry |
| [catalogue](../../src/lib/technicalInfo/catalogue.js) | Categories, question suggestions and VES field labels |
| [service](../../src/lib/technicalInfo/service.js) | Vehicle context, approved provider contract and provenance enforcement |
| [technicalInfo DB helper](../../src/lib/database/technicalInfo.js) | Job-bound vehicle and request reads |
| [technical-info API](../../src/pages/api/job-cards/[jobNumber]/technical-info.js) | Access checks and validated read endpoint |
| [lookup](../../src/lib/vehicles/lookup.js) | DVLA/vPIC calls and bounded reusable cache |
| [DVLA API](../../src/pages/api/vehicles/dvla.js) | Existing staff lookup contract |
| [Public valuation lookup](../../src/pages/api/website/valuation/lookup.js) | Shared lookup behind the existing public allowlist/limit |
| [vehicleFormState](../../src/lib/vehicles/vehicleFormState.js) | Correct identity and DVLA field mapping |
| [createJobService](../../src/lib/services/createJobService.js) | Save supported VES fields with the vehicle |
| [New job page](../../src/pages/new-job/index.js) | Use shared form mapping |
| [New order page](../../src/pages/new-order/index.js) | Preserve confirmed vehicle identity on lookup |
| [Technical information tests](../../src/lib/technicalInfo/technicalInfo.test.js) | Classification, providers, vehicle mapping and caching |
| [API tests](../../src/lib/technicalInfo/api.test.js) | Job scoping and request validation |

Validation: focused tests, ESLint (new modules clean; existing file warnings),
border/layer/dropdown/symbol checks and whitespace checks. The staff-controls
check is blocked by an unrelated stale migration baseline in
`job-cards-myjobs-job-number-ui.js` (6 recorded, 5 found); that file was not changed
by this task. The running API rejected an unauthenticated request with 401.
No browser connection was available for desktop/tablet/mobile visual checks.
No live DVLA/vPIC or licensed-provider integration call was used as a test.
