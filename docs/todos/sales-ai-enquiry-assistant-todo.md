# Sales AI Enquiry Assistant — Planning / Todo

Status: **Planning only — do not build yet.**
Owner: Sales / DMS team
Created: 2026-05-12

---

## 1. Feature summary

Add an AI-assisted sales enquiry system into the H&P DMS.

A sales user enters call notes or a transcript into the DMS. The system analyses the text, extracts key information (customer details, vehicle interest, budget, urgency), gives an intent score, suggests the next best action, and creates a follow-up task so leads are not forgotten.

In plain terms: sales staff type or paste what the customer said, press a button, and the AI returns a structured summary plus a recommended next step.

---

## 2. MVP scope (first version)

The first version is **manual only**:

- No live phone integration.
- No automatic call recording or transcription.
- A sales user manually types or pastes enquiry notes.
- AI analysis only runs after the user presses an **"Analyse enquiry"** button.
- The AI result is shown for review.
- The user can edit the result before saving.
- Saving creates the enquiry record and an optional follow-up task.

---

## 3. Future scope (later versions)

Possible later additions:

- Uploaded call recordings (audio file upload).
- Automatic call transcription (speech-to-text).
- Phone system integration (VoIP / PBX hooks).
- Automatic enquiry creation from inbound calls.
- Automatic task assignment based on availability or specialism.
- Manager reporting dashboards (conversion, response time, intent mix).
- Missed follow-up alerts and escalation.
- SMS / email follow-up drafting from the AI summary.

---

## 4. Suggested routes (future ideas only — do not create now)

- `/sales/enquiries` — list of enquiries
- `/sales/enquiries/[id]` — single enquiry detail
- `/sales/enquiries/create` — manual entry / analyse screen
- `/api/ai/enquiries/analyse` — backend AI analysis endpoint

> Marked as future ideas only. Not to be scaffolded yet.

---

## 5. Suggested feature folder (future structure only)

- `src/features/ai-enquiries/`

> Future structure only. Do not create the folder yet.

---

## 6. Suggested data fields

Possible fields on an enquiry record:

- customer name
- phone number
- email
- vehicle interested in
- budget
- urgency
- enquiry source (walk-in, phone, web form, referral, etc.)
- transcript or notes (raw input)
- AI summary
- intent level (low / medium / high)
- intent score (0–100)
- suggested next action
- assigned sales user
- follow-up due date
- status (new / in progress / won / lost / closed)
- linked vehicle (stock record id)
- linked customer (customer record id)
- created by
- created at
- updated at

---

## 7. AI output example

Example JSON the analysis endpoint should return:

```json
{
  "intent": "high",
  "intentScore": 92,
  "summary": "Customer is interested in a Suzuki Swift automatic and wants to view it this weekend.",
  "vehicleInterest": "Suzuki Swift Automatic",
  "budget": "£14,000",
  "urgency": "This weekend",
  "nextAction": "Call back today and offer viewing slots.",
  "followUpPriority": "urgent"
}
```

---

## 8. DMS integration ideas

The feature should eventually link into:

- **Sales dashboard** — show open enquiries, hot leads, today's follow-ups.
- **Customer records** — link enquiry to an existing or new customer.
- **Vehicle stock records** — link enquiry to a specific stock vehicle.
- **Reminders / tasks** — auto-create a follow-up task with due date.
- **Messages** — pre-fill SMS / email drafts from the AI summary.
- **Notifications** — alert assigned sales user when a high-intent enquiry is saved.
- **Manager reports** — conversion rates, response times, AI vs human edits.
- **Audit logs** — record original AI output and any edits made before saving.
- **Role-based permissions** — limit access by role (see section 9).

---

## 9. Role access ideas

Roles that should see the feature:

- Admin
- Sales
- Sales Manager
- Manager

Roles that should **not** see this unless explicitly allowed:

- Workshop
- Parts
- Valet
- Technician

Use the existing `hasAnyRole` / role constants in `src/lib/auth/roles.js` when this is built — do not hardcode role strings.

---

## 10. Build order todo list

- [ ] **Stage 1 — Planning and data design**
  Confirm fields, statuses, intent score scale, and DB schema. Decide on Supabase tables (`sales_enquiries`, `sales_enquiry_tasks`).

- [ ] **Stage 2 — Manual enquiry creation**
  Build the manual entry screen (no AI yet). User can save raw notes + customer/vehicle links.

- [ ] **Stage 3 — AI analysis API**
  Add `/api/ai/enquiries/analyse` endpoint. Sends notes to AI model, returns structured JSON.

- [ ] **Stage 4 — Review and save AI results**
  Show AI output in the UI, allow edits, then save final enquiry record.

- [ ] **Stage 5 — Follow-up task creation**
  Auto-create a follow-up task with assigned user and due date based on AI urgency.

- [ ] **Stage 6 — Sales dashboard integration**
  Surface open enquiries, hot leads, and overdue follow-ups on the sales dashboard.

- [ ] **Stage 7 — Manager reporting**
  Reports for conversion, response time, AI accuracy / edit rate, sales user performance.

- [ ] **Stage 8 — Optional: call transcription**
  Allow audio upload and transcribe to text before analysis.

- [ ] **Stage 9 — Optional: phone integration**
  Inbound call hooks to auto-create draft enquiries.

---

## 11. Important notes

- Do **not** replace the existing sales workflow yet — this runs alongside it.
- Keep the first version simple. Manual input, single analyse button, review-before-save.
- AI suggestions **must** be reviewable and editable before they are saved as the official record.
- Do **not** let mock / demo data leak into live data. Keep presentation-mode data isolated using the existing presentation data layer pattern.
- Follow existing H&P DMS theme, layout, role checks, and audit logging patterns when this is built later (see `CLAUDE.md` sections 3, 5, 6, 7).
- All DB access must go through `src/lib/database/` helpers — no direct Supabase calls in pages or components.
- Use `<LayerSurface>` / `<LayerTheme>` for all surfaces. No new borders, no hardcoded colours.

---

# Intelligent Workflow & Analysis System

This section describes a future direction for the H&P DMS in which the app becomes **operationally intelligent** — using built-in analysis systems, workflow automation, summaries, pattern detection, smart suggestions, and generated actions that live inside the existing DMS surfaces.

> Planning only. Do not build any of this yet. No components, routes, DB tables, APIs, hooks, services, or UI.

## Branding & language — do NOT brand features as "AI"

The intelligence layer must feel **native to the H&P DMS**. The UI should not look like an external AI tool bolted on. Staff and managers should experience these features as natural extensions of the dealership workflow.

**Use these names in the UI:**

- Analysis
- Insights
- Summary
- Review
- Suggested Actions
- Follow-Up
- Smart Timeline
- Recommendations

**Do NOT use these names in the UI:**

- AI Analyse
- Ask AI
- AI Assistant
- Chatbot
- Copilot
- "Powered by AI"

The intelligence layer should feel native and not externally branded. It is the **H&P DMS** doing the thinking, not a third-party assistant living inside it.

## Future architecture (high level)

The intelligence system may be built from any combination of:

- **Rule-based logic** — deterministic dealership rules (e.g. "if VHC red and no parts ordered after 2h → flag").
- **Pattern recognition** — recurring faults, repeat visits, recurring damage, demand patterns.
- **Workflow engines** — staged automation reacting to status changes.
- **Internal scoring systems** — intent scores, prep risk scores, delay risk scores.
- **Historical data analysis** — using the dealership's own operational history as the primary signal.
- **Lightweight local models** — small models for classification, summarisation, or extraction.
- **Hybrid systems** — rules + scoring + model output combined.

Design principle: **the intelligence engine must be swappable without changing the UI structure.** A button labelled "Analysis" should keep working whether the underlying engine is a rule, a score, a model, or a hybrid.

## Suggested future internal structure (ideas only)

```
src/core/analysis/         → analysis engines (rules, scoring, summarisation)
src/core/workflow/         → workflow automation and triggers
src/core/recommendations/  → suggested next actions
src/core/summaries/        → generated summaries (job, day, customer, vehicle)
```

> Future structure only. Do not create these folders yet.

---

# Workshop Features

## Smart Job Summary
- **What it does:** Summarises technician notes, VHC results, parts activity, internal messages, and clocking events into a clean, manager-friendly job summary.
- **Why it matters:** Managers currently scroll through tabs and timelines to understand a job's state. A summary collapses that into seconds.
- **Productivity impact:** Saves 2–5 minutes per job check. Across 30+ jobs/day this is hours of management time recovered.
- **Future direction:** Pull structured data from job card, VHC engine, parts requests, messages, and clocking. Combine via rules + summarisation. Surface on the job card header as **"Job Summary"**.
- **Example output:**
  > "VHC complete (2 red, 3 amber). Front pads + discs authorised, parts in stock, technician clocked on for 1h12m. Awaiting customer confirmation on amber items. On track for 16:30 completion."

## Delayed Job Detection
- **What it does:** Flags jobs at risk of missing the promised completion time.
- **Why it matters:** Late jobs cause collection conflicts, valeting delays, and unhappy customers.
- **Productivity impact:** Earlier intervention → fewer angry handovers and reactive phone calls.
- **Future direction:** Score jobs using booked-in time, work content, technician availability, parts status, and current clocking progress. Flag at-risk jobs on the workshop board.
- **Example output:** Job card shows a **"Delay risk: High — parts not yet arrived, 3h work remaining, promised 15:00"** chip.

## Smart Technician Allocation
- **What it does:** Suggests which technician should take a job based on skill set, current workload, historical job-type performance, and qualifications (e.g. EV, ADAS, MOT tester).
- **Why it matters:** Manual allocation depends on the foreman's memory. Suggestions reduce mismatches.
- **Productivity impact:** Fewer reassignments mid-job; better first-time-fix rate.
- **Future direction:** Score each available technician against the job's work content; surface top 3 in the allocation modal.
- **Example workflow:** Foreman opens "Assign technician" → sees ranked list: *Mike (best match — ADAS certified, light load), James (good match), …*

## Auto Internal Messages
- **What it does:** Automatically creates internal messages when workflow events occur (e.g. VHC red item raised → message to service advisor).
- **Why it matters:** Removes the "I forgot to tell you" gap between departments.
- **Productivity impact:** Less verbal chasing across the workshop floor.
- **Future direction:** Workflow engine watches status changes and writes into the existing internal messages system. Staff can edit before sending or accept auto-send for trusted events.

## Smart Parts Requests
- **What it does:** Suggests additional parts likely to be needed based on the technician's findings (e.g. discs flagged → suggest pads + sensors).
- **Why it matters:** Reduces second parts trips and job overruns.
- **Productivity impact:** Fewer parts re-orders; jobs completed in a single pass.
- **Future direction:** Pattern recognition on historical part combinations for similar VHC findings. Surfaced as suggestions on the parts request form.

## Clocking Pattern Analysis
- **What it does:** Detects workshop bottlenecks, idle time, and persistent overruns by technician, bay, or job type.
- **Why it matters:** Reveals hidden inefficiency invisible in day-to-day operation.
- **Productivity impact:** Targeted process fixes; better recovery time.
- **Future direction:** Aggregate clocking data weekly/monthly; show trends in the manager dashboard.

## Repeat Fault Detection
- **What it does:** Detects when a vehicle returns for the same or similar fault, or when a fault pattern is emerging across a model.
- **Why it matters:** Prevents warranty embarrassment and supports manufacturer escalation.
- **Productivity impact:** Faster diagnosis on repeat visits; data-backed warranty claims.
- **Future direction:** Pattern recognition across job history per VIN and per model.
- **Example output:** Banner on job card: *"This vehicle has visited 2x in 90 days for the same braking complaint."*

## Automatic Write-Up Suggestions
- **What it does:** Converts rough technician notes into clean, professional customer-facing wording.
- **Why it matters:** Customer invoices and reports read inconsistently depending on who wrote them.
- **Productivity impact:** Faster invoice prep; better customer perception.
- **Future direction:** Summarisation on technician notes with a "Review and edit" step before saving to the customer-facing write-up.
- **Example:**
  - Raw: *"pads shot, discs lipped, did both sides, bled fluid"*
  - Suggested: *"Replaced front brake pads and discs (both sides). Brake fluid bled and topped up. Brakes tested and operating correctly."*

---

# Service Advisor Features

## Call Follow-Up Tracking
- **What it does:** Detects missed or overdue customer follow-ups (callbacks, quotes awaiting authorisation, amber-item callbacks).
- **Why it matters:** Lost follow-ups directly cost revenue and damage trust.
- **Productivity impact:** Higher conversion on amber/red work; fewer dropped leads.
- **Future direction:** Score outstanding follow-ups by age + value; surface as a "Follow-Up" panel on the advisor dashboard.

## Smart Booking Suggestions
- **What it does:** Suggests ideal booking slots using historical job timing, current workload, technician availability, and parts lead times.
- **Why it matters:** Reduces over-booking and under-booking.
- **Productivity impact:** Smoother workshop loading; fewer rescheduled jobs.
- **Future direction:** Scoring engine over the booking diary; show ranked slots in the booking form.

## Timeline Compression
- **What it does:** Turns long vehicle / customer histories into a short readable timeline.
- **Why it matters:** Advisors need context in seconds when a customer rings.
- **Productivity impact:** Faster, more confident calls.
- **Future direction:** Generate a **Smart Timeline** view that groups and summarises events by theme (servicing, MOT, complaints, sales).

## Suggested Customer Responses
- **What it does:** Drafts replies for the internal messaging / customer messaging system based on the conversation context.
- **Why it matters:** Saves typing; keeps tone consistent.
- **Productivity impact:** Faster message turnaround; staff can edit before sending.
- **Future direction:** Drafts appear in the existing message composer as a **"Suggested reply"** option. Never auto-sent.

---

# Sales Features

## Smart Enquiry Analysis
- **What it does:** Analyses inbound enquiries (notes or transcript) for intent, vehicle interest, budget, urgency, and next action. (See sections 1–11 above — this is the Sales AI Enquiry Assistant.)
- **Why it matters:** Captures structured value from unstructured calls.
- **Productivity impact:** Faster qualification; fewer dropped enquiries.
- **Future direction:** Manual MVP first, automated later. UI label: **"Analyse enquiry"** or **"Insights"** — not "AI Analyse".

## Missed Opportunity Detection
- **What it does:** Flags leads with poor follow-up, missing actions, or stalled stages.
- **Why it matters:** Sales pipelines leak quietly.
- **Productivity impact:** Recovered revenue from re-engaged leads.
- **Future direction:** Score open enquiries by age, last contact, and intent; surface as **"At-Risk Leads"**.

## Auto Sales Notes
- **What it does:** Converts rough sales notes into structured CRM-style summaries.
- **Why it matters:** Improves handover between sales staff and continuity for repeat customers.
- **Productivity impact:** Less admin per enquiry.
- **Future direction:** Summarisation with reviewable draft before save.

## Vehicle Interest Trends
- **What it does:** Tracks enquiry trends, model demand, price-band patterns, and seasonal interest.
- **Why it matters:** Drives buying decisions and stock planning.
- **Productivity impact:** Smarter stock — fewer dead units, more fast movers.
- **Future direction:** Aggregate enquiries + sold + viewed data into a buyer-facing report.

## Trade-In Risk Detection
- **What it does:** Predicts likely prep risks or future reconditioning costs on a trade-in before it's bought.
- **Why it matters:** Avoids loss-making part-exchanges.
- **Productivity impact:** Better appraisal accuracy.
- **Future direction:** Score appraisal data against historical prep cost outcomes for similar vehicles.

---

# Vehicle Buying / Prep / Processing Features

## Prep Delay Predictor
- **What it does:** Predicts which incoming vehicles are unlikely to be retail-ready on time.
- **Why it matters:** Stock arriving late on the forecourt = lost sales.
- **Productivity impact:** Earlier intervention; better forecourt freshness.
- **Future direction:** Score prep jobs against historical lead times by job type and supplier.

## Smart Prep Routing
- **What it does:** Automatically routes vehicles between departments (workshop → SMART repair → paint → valet → photography) in the optimal order.
- **Why it matters:** Manual routing is inconsistent.
- **Productivity impact:** Reduces total prep time per vehicle.
- **Future direction:** Workflow engine reacting to prep checklist completion events.

## Photo Checklist Detection
- **What it does:** Detects missing photography angles, missing video walkaround, or low-quality media before a vehicle goes live.
- **Why it matters:** Listings without complete media convert worse.
- **Productivity impact:** Fewer "go-live" delays.
- **Future direction:** Rule-based checklist + simple image analysis on uploaded media.

## Appraisal Summary Generator
- **What it does:** Creates a structured appraisal summary from the buyer's rough notes and photos.
- **Why it matters:** Consistent appraisals across buyers.
- **Productivity impact:** Faster appraisal write-up.
- **Future direction:** Summarisation with reviewable draft.

---

# Valet Features

## Valet Priority Queue
- **What it does:** Automatically prioritises vehicles for valeting (collection today, photography pending, retail-ready deadline).
- **Why it matters:** Valeters currently rely on shouted priorities.
- **Productivity impact:** Right car ready at the right time.
- **Future direction:** Scoring engine over the valet queue; surface a ranked list.

## Collection Readiness Detection
- **What it does:** Detects missing requirements before handover (MOT, plates, fuel, valet, paperwork, keys, V5).
- **Why it matters:** Prevents embarrassing handovers.
- **Productivity impact:** Fewer last-minute scrambles.
- **Future direction:** Rule-based readiness checklist surfaced on the collection screen.

---

# SMART Repair / Paint Features

## Damage Pattern Logging
- **What it does:** Tracks recurring damage types and trends across stock.
- **Why it matters:** Reveals systemic issues (transport damage, lot damage, supplier defects).
- **Productivity impact:** Targeted process improvements; supplier accountability.
- **Future direction:** Aggregate damage records into a manager report.

## Smart Time Estimates
- **What it does:** Predicts repair completion times using historical SMART/paint data per damage type and size.
- **Why it matters:** Better internal expectations on prep timing.
- **Productivity impact:** Less guesswork; tighter prep schedules.
- **Future direction:** Scoring against historical repair durations.

---

# Management Features

## Department Pressure Heatmap
- **What it does:** Shows operational pressure across all departments at a glance (workshop, parts, sales, valet, prep).
- **Why it matters:** Managers need a single view of where the heat is today.
- **Productivity impact:** Faster reallocation of staff and priorities.
- **Future direction:** Aggregate workload + open jobs + overdue items into a heatmap tile on the manager dashboard.

## Staffing Suggestions
- **What it does:** Detects overloaded or underutilised staff and suggests reassignments.
- **Why it matters:** Even workload = better throughput and morale.
- **Productivity impact:** Better daily team balance.
- **Future direction:** Score per-staff workload vs capacity; surface in the manager dashboard.

## Auto Daily Summary
- **What it does:** Generates a daily operational summary for the dealership each evening (jobs completed, late jobs, sales, enquiries, follow-ups due tomorrow).
- **Why it matters:** Replaces ad-hoc end-of-day chats.
- **Productivity impact:** Managers walk in tomorrow already briefed.
- **Future direction:** Scheduled summary job; delivered into existing notifications/messages.

---

# Global DMS Features

## Universal Analysis Button
- **What it does:** Context-aware **"Analysis"** action available across pages (job card, customer, vehicle, enquiry, day, week).
- **Why it matters:** Consistent entry point regardless of where the user is.
- **Productivity impact:** One predictable action across the whole DMS.
- **Future direction:** Button rendered on relevant pages; behaviour resolved by the current entity type.

## Smart Search
- **What it does:** Natural-language-style search across customers, vehicles, jobs, enquiries, and messages (e.g. "white Swifts under £15k", "open jobs late today").
- **Why it matters:** Faster than navigating filters.
- **Productivity impact:** Significant time saving for power users.
- **Future direction:** Hybrid keyword + structured query parser over indexed dealership data.

## Smart Notifications
- **What it does:** Only notifies relevant staff based on workflow context and role.
- **Why it matters:** Notification fatigue kills attention.
- **Productivity impact:** Fewer ignored alerts → real alerts get acted on.
- **Future direction:** Notification routing rules per event type + role.

## Cross-Department Detection
- **What it does:** Detects workflow conflicts between departments (e.g. valet booked while workshop still has the car; sale due before prep complete).
- **Why it matters:** Cross-department conflicts are the most common cause of customer disappointment.
- **Productivity impact:** Conflicts caught hours earlier.
- **Future direction:** Rule-based cross-checks on key shared resources (vehicle, time, staff).

## Internal Knowledge Memory
- **What it does:** Long-term learning from dealership operational history — what jobs took how long, which faults repeat on which models, which enquiries convert.
- **Why it matters:** The dealership's own history is the most valuable training data it has.
- **Productivity impact:** Compounding accuracy of every other intelligent feature.
- **Future direction:** Structured historical store feeding all scoring and pattern features. Treated as the long-term value asset.

---

# Important Architectural Notes

- **Role-based permissions** — every intelligent feature must respect existing role checks (`src/lib/auth/roles.js`). Workshop, sales, parts, valet, and managers should only see analysis relevant to their role.
- **Scoped visibility** — a technician should not see sales intent scoring; a salesperson should not see clocking analysis. Surface intelligence within the role's normal screens.
- **Always reviewable** — generated suggestions, summaries, and drafted messages must be reviewable and editable by staff before they become the official record or are sent externally.
- **Assist, do not replace** — automation supports staff decisions, it does not make them unilaterally. No auto-sending to customers, no auto-billing, no auto-closing jobs without human confirmation (except clearly safe internal events).
- **Historical data is the long-term value** — the dealership's own operational history is the primary signal. Protect it, structure it, and design the data model so it remains usable as engines change.
- **Native, not chatbot** — intelligence must be integrated into normal workflows (job cards, dashboards, booking screens, message composer). It should not feel like a separate chatbot or external assistant.
- **Reuse existing systems** — wherever possible, intelligent features should reuse the existing H&P DMS:
  - **Messaging system** for suggested replies and auto internal messages
  - **Notifications system** for smart alerts
  - **Audit logs** for every generated suggestion that becomes a saved action
  - **Dashboards** for surfacing insights, heatmaps, and follow-up queues
- **Swappable engines** — the UI labels (Analysis, Insights, Summary, Review, Suggested Actions, Follow-Up, Smart Timeline, Recommendations) must remain stable even as the underlying engine evolves from rules → scoring → models → hybrid.
- **No external AI branding in the UI** — feature names never include "AI", "Assistant", "Copilot", or "Chatbot". The intelligence layer is part of the H&P DMS.

---

# Department Workflow Intelligence Expansion

This section documents additional future operational intelligence ideas across every department of the dealership. These are **planning notes only** — no code, routes, APIs, DB tables, components, hooks, services, or UI to be created.

Frame these features as:

- workflow intelligence
- operational analysis
- smart automation
- intelligent suggestions
- predictive systems
- contextual summaries
- workflow optimisation

Not as "AI tools". Branding rules from the previous section apply: native to the H&P DMS, no externally-branded AI surfaces.

---

## Parts Department Intelligence

### Auto Parts Availability Prediction
- **What it does:** Predicts whether a required part will be available in time for a booked job by combining supplier lead times, current stock, and historical delivery reliability.
- **Why it matters:** Job overruns from late parts are one of the largest sources of workshop delay.
- **Productivity impact:** Earlier visibility lets advisors rebook before the customer arrives instead of after.
- **Future direction:** Scoring engine over parts_inventory + parts_orders history + supplier lead-time data; exposed on the parts request and booking screens.
- **Related departments:** Parts, Workshop, Service Advisor.
- **Example output:** *"Front discs — 92% likely on-site by 11:00 tomorrow (3 of last 4 same-supplier orders met morning slot)."*

### Smart Parts Ordering
- **What it does:** Suggests optimal order quantities and timing based on consumption patterns, seasonality, and current backlog.
- **Why it matters:** Reduces both stock-outs and overstock cash tied up on shelves.
- **Productivity impact:** Less manual stock checking; better working-capital efficiency.
- **Future direction:** Pattern recognition on historical parts movement combined with rule-based reorder thresholds.
- **Related departments:** Parts, Finance.

### Duplicate Parts Request Detection
- **What it does:** Detects when two technicians or advisors request the same part for overlapping jobs or for the same vehicle.
- **Why it matters:** Prevents double-ordering and wasted picking time.
- **Productivity impact:** Fewer returns; less time clarifying who asked first.
- **Future direction:** Rule-based check at the moment a parts request is created; surfaces a "Possible duplicate" warning.
- **Related departments:** Parts, Workshop.

### Fast-Moving Stock Detection
- **What it does:** Highlights parts whose consumption is accelerating relative to the historical baseline.
- **Why it matters:** Lets the parts manager pre-empt stock-outs on items trending up.
- **Productivity impact:** Reduces emergency reorders and same-day collections.
- **Future direction:** Rolling-window consumption analysis with deviation thresholds.
- **Related departments:** Parts, Management.

### Dead Stock Detection
- **What it does:** Flags parts that have not moved within a configurable window (e.g. 12 months).
- **Why it matters:** Frees cash tied up in dormant inventory.
- **Productivity impact:** Targeted clearance, returns to supplier, or write-down planning.
- **Future direction:** Aggregate query on parts_inventory + parts_orders + parts_deliveries; surfaced in a parts manager report.
- **Related departments:** Parts, Finance, Management.

### Parts Delay Impact Detection
- **What it does:** When a parts delivery slips, automatically identifies which jobs and customers are affected and ranks them by promised completion.
- **Why it matters:** Today this is reconstructed manually by phone.
- **Productivity impact:** Minutes to identify impact instead of half an hour; cleaner customer communication.
- **Future direction:** Event-driven analysis triggered on parts_orders status changes; results surfaced as a "Delivery Impact" panel.
- **Related departments:** Parts, Workshop, Service Advisor.
- **Example output:** *"Order #4421 delayed → impacts 3 jobs (Smith 11:00, Patel 13:30, Jones 15:00). Suggested action: contact Smith first."*

### Technician Collection Queue
- **What it does:** Ranks the parts-collection counter queue by job urgency rather than first-come-first-served.
- **Why it matters:** Keeps high-priority workshop work moving.
- **Productivity impact:** Fewer technician idle minutes at the counter.
- **Future direction:** Scoring engine using job promised time + clocking state + work content.
- **Related departments:** Parts, Workshop.

### Suggested Alternative Parts
- **What it does:** When a part is unavailable, suggests valid alternatives (equivalent OEM, aftermarket, superseded part numbers) based on historical fitment.
- **Why it matters:** Avoids stalled jobs while waiting on first-choice stock.
- **Productivity impact:** Faster part substitution decisions.
- **Future direction:** Lookup against historical successful fitments per VIN/model.
- **Related departments:** Parts, Workshop.

---

## MOT Workflow Intelligence

### MOT Failure Trend Tracking
- **What it does:** Tracks the most common MOT failure reasons by model, age band, and mileage.
- **Why it matters:** Drives pre-MOT advisory work and customer-facing upsell.
- **Productivity impact:** Higher first-time-pass rate; more pre-emptive work captured.
- **Future direction:** Aggregate MOT result data; surface trends on the MOT dashboard.
- **Related departments:** MOT, Workshop, Service Advisor.

### MOT Retest Priority Queue
- **What it does:** Ranks vehicles awaiting MOT retest by remaining test certificate window and customer urgency.
- **Why it matters:** Avoids missed retest windows that force a full retest fee.
- **Productivity impact:** Fewer retest fees absorbed; cleaner workshop scheduling.
- **Future direction:** Scoring against MOT expiry date and retest window.
- **Related departments:** MOT, Workshop.

### MOT Bay Utilisation Tracking
- **What it does:** Measures MOT bay throughput, idle gaps, and overruns.
- **Why it matters:** Reveals whether the bay can take more bookings.
- **Productivity impact:** Better booking diary loading without manual study.
- **Future direction:** Clocking + booking data aggregation; surface as a manager report.
- **Related departments:** MOT, Management.

### Common Advisory Detection
- **What it does:** Identifies vehicles that have accumulated repeated advisories and surfaces them for proactive contact.
- **Why it matters:** Converts advisories into authorised work before the next visit.
- **Productivity impact:** Recovered revenue from previously-dropped advisories.
- **Future direction:** Pattern recognition across MOT history per VIN; tie into the **Follow-Up** queue.
- **Related departments:** MOT, Service Advisor.

---

## Reception & Service Desk Intelligence

### Walk-In Pressure Detection
- **What it does:** Detects when reception is under pressure (multiple walk-ins, phones ringing, queue length growing) and signals for support.
- **Why it matters:** Reception overload directly damages customer experience.
- **Productivity impact:** Faster reallocation of floating staff.
- **Future direction:** Event count + timing rules; surfaced via the existing notifications system.
- **Related departments:** Reception, Management.

### Queue Time Monitoring
- **What it does:** Tracks how long customers wait at check-in and collection.
- **Why it matters:** Quantifies a pain point that is usually invisible.
- **Productivity impact:** Targeted process changes informed by real data.
- **Future direction:** Event timestamps captured on check-in / collection actions.
- **Related departments:** Reception, Management.

### Suggested Customer Updates
- **What it does:** Drafts a "your car is on the ramp / awaiting parts / ready" message at appropriate workflow transitions.
- **Why it matters:** Customers consistently rate proactive updates as the biggest experience win.
- **Productivity impact:** Updates that today don't happen, will happen — without extra typing.
- **Future direction:** Workflow engine triggers + summarisation; drafts appear in the message composer for review.
- **Related departments:** Reception, Service Advisor.

### Check-In Summary Generator
- **What it does:** At check-in, generates a one-pane summary of the customer, vehicle, history, prior advisories, and today's booked work.
- **Why it matters:** Eliminates the "let me just look something up" pause.
- **Productivity impact:** Faster, more confident check-ins.
- **Future direction:** Summarisation pulling from customers, vehicles, jobs, MOT, and VHC tables.
- **Related departments:** Reception, Service Advisor.

---

## Customer Experience Intelligence

### Customer Sentiment Detection
- **What it does:** Detects negative sentiment in inbound messages, calls notes, or survey feedback and routes to a manager.
- **Why it matters:** Early intervention saves the relationship.
- **Productivity impact:** Manager attention focused only where needed.
- **Future direction:** Classification on free-text inbound content; flag surfaced as a "Review" item.
- **Related departments:** Reception, Service Advisor, Management.

### Collection Risk Detection
- **What it does:** Predicts likelihood of a problematic collection (unhappy customer, missing items, late job, large bill).
- **Why it matters:** Lets the team prepare and brief the manager before the customer arrives.
- **Productivity impact:** Fewer escalations at the desk.
- **Future direction:** Score combining job state, communication history, bill size, and prior complaints.
- **Related departments:** Service Advisor, Management.

### Loyalty Pattern Tracking
- **What it does:** Identifies high-loyalty customers (frequency, length, multi-vehicle households) and flags them across the DMS.
- **Why it matters:** Ensures top customers are recognised at every touchpoint.
- **Productivity impact:** Consistent VIP-style handling without manual tagging.
- **Future direction:** Rule-based loyalty scoring; surface as a chip on customer profiles.
- **Related departments:** Sales, Service Advisor, Management.

### Silent Customer Detection
- **What it does:** Flags previously-active customers who have not been contacted or visited within a defined window.
- **Why it matters:** Quietly lost customers rarely come back without prompting.
- **Productivity impact:** Targeted re-engagement campaigns.
- **Future direction:** Inactivity threshold rules; tie into marketing/CRM follow-up queue.
- **Related departments:** Sales, Service Advisor, Management.

### Customer Communication Timeline
- **What it does:** Compresses all communications (calls, SMS, email, in-person notes) into a single chronological view per customer.
- **Why it matters:** Today this is scattered across systems and memory.
- **Productivity impact:** Seconds to get full context before a call.
- **Future direction:** Aggregate query + **Smart Timeline** rendering.
- **Related departments:** All customer-facing.

---

## Finance & Accounts Intelligence

### Invoice Risk Detection
- **What it does:** Flags invoices likely to be queried or unpaid based on customer history, bill size, and prior disputes.
- **Why it matters:** Pre-empts revenue leakage.
- **Productivity impact:** Targeted credit-control effort.
- **Future direction:** Score over historical payment data.
- **Related departments:** Finance, Service Advisor.

### Late Payment Detection
- **What it does:** Detects accounts whose payment pattern is slipping (paying later than baseline).
- **Why it matters:** Earlier warning than waiting for the formal aged-debt report.
- **Productivity impact:** Cleaner debtor book.
- **Future direction:** Rolling baseline per account; alerts in finance dashboard.
- **Related departments:** Finance, Management.

### Warranty Claim Summary Generator
- **What it does:** Generates a structured warranty claim summary from the job card, technician notes, parts, and clocking.
- **Why it matters:** Warranty submissions are time-consuming and inconsistent.
- **Productivity impact:** Large time saving per claim; higher acceptance rate.
- **Future direction:** Summarisation over job-card data with a review step before submission.
- **Related departments:** Warranty, Workshop, Finance.

### Finance Application Follow-Up Tracking
- **What it does:** Tracks open finance applications and flags stalled ones requiring sales follow-up.
- **Why it matters:** Stalled applications convert poorly without intervention.
- **Productivity impact:** Higher conversion rate.
- **Future direction:** Scoring on age + last action; tie into the **Follow-Up** queue.
- **Related departments:** Sales, Finance.

---

## Vehicle Sales & Forecourt Intelligence

### Forecourt Age Detection
- **What it does:** Highlights vehicles whose forecourt age is approaching or exceeding the target days-to-sell.
- **Why it matters:** Ageing stock erodes margin.
- **Productivity impact:** Earlier price/promotion decisions.
- **Future direction:** Rule-based age thresholds with model-specific targets.
- **Related departments:** Sales, Management.

### Price Position Monitoring
- **What it does:** Compares current asking price against market position and historical conversion at similar prices.
- **Why it matters:** Data-backed pricing rather than gut feel.
- **Productivity impact:** Faster, more confident repricing decisions.
- **Future direction:** Combine external market data feed with internal conversion history.
- **Related departments:** Sales, Buying, Management.

### Handover Preparation Detection
- **What it does:** Detects missing items before handover (PDI, valet, MOT, plates, V5, finance docs).
- **Why it matters:** Prevents embarrassing last-minute delays at delivery.
- **Productivity impact:** Smooth handovers; less back-office firefighting.
- **Future direction:** Rule-based readiness checklist on the deal record.
- **Related departments:** Sales, Valet, Workshop.

### Test Drive Follow-Up Detection
- **What it does:** Flags test drives without follow-up activity within 24–48 hours.
- **Why it matters:** Follow-up is the single biggest predictor of test-drive conversion.
- **Productivity impact:** Recovered conversions.
- **Future direction:** Score test-drive records by elapsed time + activity; surface in sales dashboard.
- **Related departments:** Sales, Management.

---

## Workshop Control Intelligence

### Ramp Utilisation Mapping
- **What it does:** Visualises ramp occupancy and idle time across the day and week.
- **Why it matters:** Reveals capacity that's hidden in the booking diary.
- **Productivity impact:** Smarter booking decisions; better revenue per ramp.
- **Future direction:** Aggregate clocking + ramp assignment data; surface as a heatmap.
- **Related departments:** Workshop, Management.

### Job Flow Prediction
- **What it does:** Predicts the next workshop bottleneck (ramp, technician skill, parts arrival) based on the live job queue.
- **Why it matters:** Lets the foreman intervene before the queue stalls.
- **Productivity impact:** Smoother throughput.
- **Future direction:** Forward-projection of current job states.
- **Related departments:** Workshop, Parts.

### Waiting Vehicle Detection
- **What it does:** Detects vehicles sitting on-site between workflow stages for too long (e.g. workshop complete but valet not started).
- **Why it matters:** These gaps quietly extend customer wait times.
- **Productivity impact:** Faster end-to-end turnaround.
- **Future direction:** Event-driven dwell-time analysis between status transitions.
- **Related departments:** Workshop, Valet, Prep.

### Efficiency Drift Detection
- **What it does:** Detects gradual drift in workshop efficiency metrics over weeks/months.
- **Why it matters:** Slow drift is invisible day-to-day but compounds.
- **Productivity impact:** Targeted process correction earlier.
- **Future direction:** Trend analysis over clocking + job completion data.
- **Related departments:** Workshop, Management.

---

## Technician Intelligence

### Skill Growth Tracking
- **What it does:** Tracks the variety and complexity of jobs each technician completes over time.
- **Why it matters:** Surfaces development progress that today is invisible.
- **Productivity impact:** Better allocation, succession planning, and review conversations.
- **Future direction:** Aggregate job-type history per technician.
- **Related departments:** Workshop, HR, Management.

### Suggested Training Areas
- **What it does:** Recommends training topics based on jobs the technician is rarely or never assigned, or where overruns are common.
- **Why it matters:** Closes capability gaps proactively.
- **Productivity impact:** Better team-wide flexibility.
- **Future direction:** Gap analysis against job-type distribution.
- **Related departments:** Workshop, HR.

### Toolbox & Equipment Reminders
- **What it does:** Reminds technicians about specialist tools or equipment likely needed for the next job (e.g. ADAS calibration kit).
- **Why it matters:** Avoids mid-job interruptions.
- **Productivity impact:** Fewer setup delays.
- **Future direction:** Rule-based mapping of job type → equipment.
- **Related departments:** Workshop.

### Technician Context Summary
- **What it does:** When a technician opens a job, surfaces a one-pane summary of the vehicle's relevant history and prior advisories.
- **Why it matters:** Speeds diagnosis; reduces missed history.
- **Productivity impact:** Faster first-time fix.
- **Future direction:** Summarisation over vehicle history filtered to relevant systems.
- **Related departments:** Workshop.

---

## VHC Intelligence

### VHC Priority Detection
- **What it does:** Ranks open VHC items by safety, customer value, and conversion likelihood.
- **Why it matters:** Drives advisors to the items most worth pursuing.
- **Productivity impact:** Higher VHC conversion.
- **Future direction:** Scoring over vhc items state engine + historical conversion.
- **Related departments:** Workshop, Service Advisor.

### Approval Probability Scoring
- **What it does:** Predicts the likelihood a customer will approve a given VHC item.
- **Why it matters:** Shapes how the advisor presents the work.
- **Productivity impact:** Better conversion; cleaner customer conversations.
- **Future direction:** Score using item type + customer history + bill size context.
- **Related departments:** Service Advisor, Workshop.

### Customer-Friendly Explanation Generator
- **What it does:** Converts technical VHC findings into customer-friendly explanations with optional photos/video.
- **Why it matters:** Customers approve what they understand.
- **Productivity impact:** Faster, clearer authorisation calls.
- **Future direction:** Summarisation with a review step before sending to the customer.
- **Related departments:** Service Advisor, Workshop.

### Missing Media Detection
- **What it does:** Detects VHC items flagged red/amber that lack supporting photo or video evidence.
- **Why it matters:** Authorisation rate is sharply higher when media is present.
- **Productivity impact:** Higher amber/red conversion.
- **Future direction:** Rule-based check on VHC item records; surfaced before send-to-customer.
- **Related departments:** Workshop, Service Advisor.

---

## Internal Messaging Intelligence

### Suggested Replies
- **What it does:** Drafts replies to internal messages based on the conversation context.
- **Why it matters:** Removes typing friction.
- **Productivity impact:** Faster internal coordination.
- **Future direction:** Drafts appear inline in the existing message composer for review.
- **Related departments:** All.

### Smart Mention Suggestions
- **What it does:** Suggests the most relevant colleagues to @-mention based on the topic.
- **Why it matters:** Right people see it sooner.
- **Productivity impact:** Fewer "who do I tell?" hesitations.
- **Future direction:** Mapping of topic → role → on-shift staff.
- **Related departments:** All.

### Message Importance Detection
- **What it does:** Classifies inbound internal messages by urgency to drive notification priority.
- **Why it matters:** Reduces fatigue from low-value pings.
- **Productivity impact:** Important messages get acted on faster.
- **Future direction:** Classification rules + scoring; tie into Smart Notifications.
- **Related departments:** All.

### Workflow Trigger Messages
- **What it does:** Auto-creates internal messages on key workflow events (VHC red raised, parts arrived, job complete, finance approved).
- **Why it matters:** Replaces verbal hand-offs with traceable messages.
- **Productivity impact:** Less verbal chasing; cleaner audit trail.
- **Future direction:** Workflow engine writes into the existing messages system.
- **Related departments:** All.

---

## Management & Reporting Intelligence

### Operational Bottleneck Detection
- **What it does:** Identifies the current dealership bottleneck (parts, ramps, valet, advisors) in near real-time.
- **Why it matters:** Clear single answer to "where do we need help right now?"
- **Productivity impact:** Faster reallocation of effort.
- **Future direction:** Cross-department scoring; surface on manager dashboard.
- **Related departments:** Management.

### Revenue Opportunity Detection
- **What it does:** Surfaces specific actionable revenue opportunities (overdue follow-ups, ageing quotes, expiring MOTs, stale advisories).
- **Why it matters:** Today these leak silently.
- **Productivity impact:** Direct revenue recovery.
- **Future direction:** Aggregate query across departments tied to monetary value.
- **Related departments:** Management, Sales, Service Advisor.

### Comeback Risk Analysis
- **What it does:** Identifies jobs at elevated risk of becoming a comeback (incomplete fix, missing road test, unusual work pattern).
- **Why it matters:** Comebacks damage reputation and absorb capacity.
- **Productivity impact:** Reduced comeback rate.
- **Future direction:** Pattern recognition on completed-job characteristics vs historical comebacks.
- **Related departments:** Workshop, Management.

### Staff Burnout Indicators
- **What it does:** Detects sustained over-utilisation patterns by individual staff.
- **Why it matters:** Burnout drives errors and attrition.
- **Productivity impact:** Targeted intervention before staff leave or quality drops.
- **Future direction:** Rolling utilisation trend per staff member.
- **Related departments:** HR, Management.

### Forecasted Busy Days
- **What it does:** Predicts upcoming high-pressure days using booking diary, MOT expiries, weather, and seasonal patterns.
- **Why it matters:** Lets the dealership pre-staff and pre-prepare.
- **Productivity impact:** Smoother peak days.
- **Future direction:** Forward projection from existing diary + external signals.
- **Related departments:** Management, Reception.

---

## Vehicle Buying Intelligence

### High-Risk Purchase Detection
- **What it does:** Scores potential purchases against historical loss-making characteristics.
- **Why it matters:** Avoids the same mistake twice.
- **Productivity impact:** Better buying decisions; protected margin.
- **Future direction:** Score appraisal data against historical outcome data.
- **Related departments:** Buying, Management.

### Margin Risk Prediction
- **What it does:** Predicts the likely final margin on a vehicle before purchase by estimating prep cost and forecourt time.
- **Why it matters:** Headline buy price hides true margin risk.
- **Productivity impact:** Smarter bidding decisions.
- **Future direction:** Combine prep-cost prediction + forecourt-age prediction + price-position monitoring.
- **Related departments:** Buying, Sales, Management.

### Fast-Sale Probability
- **What it does:** Predicts how quickly a candidate vehicle is likely to sell once on the forecourt.
- **Why it matters:** Drives buying mix toward fast movers.
- **Productivity impact:** Better stockturn.
- **Future direction:** Score against historical days-to-sell for similar vehicles.
- **Related departments:** Buying, Sales.

### Vehicle Sourcing Suggestions
- **What it does:** Suggests vehicle types to actively source based on current enquiries, demand patterns, and stock gaps.
- **Why it matters:** Aligns buying with proven demand.
- **Productivity impact:** Faster sell-through.
- **Future direction:** Combine enquiry trends + current stock gaps.
- **Related departments:** Buying, Sales.

---

## SMART Repair & Bodyshop Intelligence

### Repair Complexity Detection
- **What it does:** Classifies incoming damage by complexity (SMART vs full bodyshop) and routes accordingly.
- **Why it matters:** Routing errors cost time and material.
- **Productivity impact:** Faster, cleaner routing.
- **Future direction:** Classification from damage photos + appraisal notes.
- **Related departments:** SMART Repair, Bodyshop, Prep.

### Paint Material Usage Tracking
- **What it does:** Tracks paint and consumable usage per job and per technician.
- **Why it matters:** Highlights waste and overuse.
- **Productivity impact:** Lower material cost per job.
- **Future direction:** Aggregate consumables data; surface in management report.
- **Related departments:** Bodyshop, Finance.

### Repeat Damage Location Tracking
- **What it does:** Tracks where damage repeatedly appears on stock vehicles (lot, transport, specific bay).
- **Why it matters:** Points to root causes outside the bodyshop.
- **Productivity impact:** Process or supplier change leading to less damage upstream.
- **Future direction:** Aggregate damage-location data.
- **Related departments:** Bodyshop, Site Operations, Management.

---

## Site & Operations Intelligence

### Key Movement Monitoring
- **What it does:** Tracks key cabinet movements to detect missing or misplaced keys.
- **Why it matters:** Lost keys halt collections and prep.
- **Productivity impact:** Less time hunting for keys.
- **Future direction:** Event log over key cabinet check-in/check-out actions.
- **Related departments:** Reception, Workshop, Sales.

### Parking Pressure Mapping
- **What it does:** Visualises on-site parking pressure across the day.
- **Why it matters:** Reveals when the site is at risk of congestion.
- **Productivity impact:** Better intake planning.
- **Future direction:** Aggregate vehicle on-site events.
- **Related departments:** Site Operations, Reception.

### Vehicle Movement Analysis
- **What it does:** Tracks how often vehicles are moved around the site between stages.
- **Why it matters:** Excessive movement is wasted labour.
- **Productivity impact:** Lower movement labour.
- **Future direction:** Movement event log analysis.
- **Related departments:** Site Operations, Prep, Workshop.

### Site Delay Detection
- **What it does:** Detects vehicles parked in the wrong area for the current workflow stage.
- **Why it matters:** Misplaced vehicles silently delay the next stage.
- **Productivity impact:** Faster stage transitions.
- **Future direction:** Cross-check current parking location against workflow stage.
- **Related departments:** Site Operations, Workshop, Valet.

---

## Mobile Technician Intelligence

### Route Efficiency Suggestions
- **What it does:** Suggests an efficient route through the day's mobile jobs.
- **Why it matters:** Drive time is non-billable.
- **Productivity impact:** More jobs per day per mobile technician.
- **Future direction:** Routing optimisation over the day's job locations.
- **Related departments:** Mobile, Workshop.

### Mobile Stock Suggestions
- **What it does:** Suggests parts and consumables to load in the van based on today's job list.
- **Why it matters:** Avoids return trips to base for missing parts.
- **Productivity impact:** Higher first-visit-fix rate.
- **Future direction:** Rule-based mapping of job types → likely parts.
- **Related departments:** Mobile, Parts.

### Mobile Job Risk Detection
- **What it does:** Flags mobile jobs likely to overrun, require return visits, or need specialist tools.
- **Why it matters:** Lets the dispatcher prepare or reassign.
- **Productivity impact:** Fewer failed visits.
- **Future direction:** Score against historical similar mobile jobs.
- **Related departments:** Mobile, Workshop.

### Return-To-Workshop Detection
- **What it does:** Detects mobile jobs that should not have been mobile and should be brought into the workshop.
- **Why it matters:** Some jobs cost more to complete in the field than to recover.
- **Productivity impact:** Better job triage.
- **Future direction:** Rule-based decision support on mobile booking creation.
- **Related departments:** Mobile, Workshop.

---

## Long-Term Platform Concepts

### Operational Memory Engine
- **What it does:** A long-lived structured record of every operational decision, outcome, and pattern across the dealership.
- **Why it matters:** Becomes the dealership's institutional memory — independent of any one engine or model.
- **Future direction:** Structured event store feeding every other intelligent feature.
- **Related departments:** All.

### Workflow Optimisation Engine
- **What it does:** Centralised engine that continually proposes process improvements based on observed bottlenecks and outcomes.
- **Why it matters:** Compounds the dealership's own learning.
- **Future direction:** Pattern recognition over the operational memory engine.
- **Related departments:** Management, all departments.

### Predictive Customer Behaviour
- **What it does:** Predicts likely customer behaviour (next service, likely upgrade, churn risk) per customer.
- **Why it matters:** Drives proactive contact strategy.
- **Future direction:** Score over customer history; tie into follow-up queues.
- **Related departments:** Sales, Service Advisor, Management.

### Dealer Performance Intelligence
- **What it does:** Whole-dealership performance view tying together throughput, conversion, margin, and satisfaction.
- **Why it matters:** A single coherent operational dashboard for the directors.
- **Future direction:** Aggregate across all departmental scoring systems.
- **Related departments:** Management.

### Adaptive Dashboard System
- **What it does:** Dashboards that adapt their layout and content to the user's role, current shift, and current operational pressure.
- **Why it matters:** Cuts noise; surfaces what matters now.
- **Future direction:** Role-aware + context-aware dashboard composition.
- **Related departments:** All.

### Self-Improving Workflow Suggestions
- **What it does:** Suggestions whose acceptance/rejection rates feed back into their own scoring over time.
- **Why it matters:** The system gets better as the dealership uses it.
- **Future direction:** Feedback loop captured via the audit log; periodic recalibration of scoring weights.
- **Related departments:** All.

---

# Architectural Notes — Department Workflow Intelligence

- **Centralised analysis engine** — all intelligent features should call into a shared analysis layer rather than each feature implementing its own pipeline. This keeps logic consistent and engine swaps cheap.
- **Reusable workflow scoring systems** — intent score, delay risk score, prep risk score, approval probability, comeback risk, margin risk: all share the same scoring primitives (inputs, weights, score, confidence, explanation).
- **Event-driven automation** — automation reacts to workflow events (status changes, parts arrivals, VHC items raised) rather than being triggered manually. The DMS already emits the events; the intelligence layer subscribes.
- **Role-aware summaries** — every summary generator should accept a target role (technician, advisor, sales, manager) and shape output accordingly. The same job has very different summaries for a foreman and a director.
- **Historical trend analysis** — long-running trend analysis is a first-class capability, not a feature-by-feature retrofit. Designed once, reused everywhere.
- **Internal learning systems** — the platform learns from its own dealership data (acceptance/rejection of suggestions, outcomes of scored predictions) rather than relying on external training.
- **Intelligent notification filtering** — every notification routes through a relevance + role + urgency filter before reaching staff, to protect attention.
- **Cross-department workflow monitoring** — a dedicated monitor watches for conflicts and dependencies spanning departments (e.g. sales handover vs prep readiness).
- **Reusable summary generators** — one summarisation primitive used for job summaries, customer timelines, daily summaries, warranty claims, appraisals.
- **Reusable recommendation engines** — one recommendation primitive used for technician allocation, booking slots, alternative parts, training suggestions, sourcing suggestions.

## Integration & governance

- **Native, not separate** — these systems must integrate naturally into the existing DMS surfaces. They should not feel like a separate product or external assistant.
- **Support, do not replace** — intelligence supports staff decisions; it does not make them. No auto-sending to customers, no auto-billing, no auto-closing of jobs without human confirmation.
- **Always reviewable** — every generated action, suggestion, summary, or draft must be reviewable and editable by staff before becoming the official record or being sent externally.
- **Reuse existing platform** — future systems must reuse:
  - **Messaging** for drafts, suggested replies, and workflow trigger messages.
  - **Notifications** for smart alerts and bottleneck warnings.
  - **Dashboards** for surfacing insights, heatmaps, and follow-up queues.
  - **Audit logs** for every generated suggestion that becomes a saved action.
  - **Permissions** (`src/lib/auth/roles.js`) for all role-based visibility.
- **Operational data is the long-term value** — the dealership's accumulated operational history is the platform's enduring asset. Protect the data model, structure events well, and keep history queryable as engines evolve.
- **Engine-agnostic UI** — UI labels (Analysis, Insights, Summary, Review, Suggested Actions, Follow-Up, Smart Timeline, Recommendations) remain stable regardless of the underlying engine. Swapping rule-based logic for a lightweight model, or vice versa, must never require UI rework.

---

# Unified Workflow Automation & Operational Coordination System

This section describes a future dealership-wide **operational coordination layer** designed to remove manual chasing, duplicated communication, missed handovers, forgotten tasks, and disconnected department workflows.

The goal: the dealership should operate as **one connected system** rather than separate departments manually updating each other.

> Planning only. Do not build any of this yet. No routes, APIs, DB tables, components, services, hooks, or UI files.

## Framing — not "AI"

This is not an AI feature set. Describe it consistently as:

- workflow automation
- operational coordination
- intelligent routing
- automated operational flow
- status orchestration
- connected workflow systems
- workflow monitoring
- dealership coordination systems

UI labels should reflect that framing. The underlying engines may be rule-based, scoring-based, model-based, or hybrid — the UI does not advertise the implementation.

## What the coordination layer would monitor

The system continuously observes operational state across the dealership:

- vehicle states (on-site, in workshop, in valet, ready, collected)
- job progress (open, in progress, awaiting parts, awaiting approval, complete)
- parts status (ordered, on order, delivered, picked, fitted, returned)
- approvals (pending, granted, declined, expired)
- messages (inbound, outbound, internal, unanswered)
- bookings (confirmed, in progress, rescheduled, no-show)
- staff allocation (assigned, available, overloaded, off-shift)
- department completion states (workshop done, valet done, QC passed)
- delays (overdue, at-risk, blocked)
- customer communication progress (notified, awaiting reply, follow-up due)

These signals feed every coordination feature below.

---

## Automatic Workflow Routing

Today, vehicles move between departments because a person remembers to push them along. In the future system, a vehicle should advance to the next stage automatically when its current stage's exit conditions are met.

**Pattern:**
- Workshop marks job complete → valet automatically queued.
- Valet marks vehicle complete → collection preparation triggered.
- Collection preparation complete → sales / service advisor notified automatically.

**Worked examples by workflow:**

- **Retail prep:** arrive → appraisal → workshop prep → SMART/paint → valet → photography → go-live. Each stage transitions automatically when its exit checklist is satisfied.
- **Workshop jobs:** check-in → VHC → estimate → customer approval → work → road test → QC → invoice ready → collection.
- **Sales handovers:** deal agreed → prep tasks queued → finance complete → handover readiness checked → collection slot offered.
- **Trade vehicles:** in → minimal prep route → photography → trade listing → dispatch.
- **MOT workflows:** booking → pre-MOT check → MOT → pass/fail → advisory follow-up or retest queue.
- **Mobile technician jobs:** booking → van stock load → route assigned → on-site arrival → completion → follow-up routed back to base.

**Operational benefit:** removes the "did anyone tell valet?" gap entirely.

---

## Operational Dependency Tracking

The DMS should understand the **dependencies** between departmental states and prevent or warn on invalid transitions.

**Examples:**

- A vehicle cannot enter the collection queue until valet is marked complete.
- An invoice cannot finalise until the technician write-up is signed off.
- Handover is blocked if the second key is missing.
- Workshop is blocked when parts are on-order with no ETA.
- A sale cannot complete until PDI and HPI checks are clean.

**Why it matters:** dependency chains turn invisible operational knowledge into enforced workflow. New staff become productive faster, and experienced staff stop having to remember every prerequisite.

**Productivity impact:** large reduction in last-minute scrambles and rework.

---

## Auto Task Generation

The DMS should generate tasks automatically when operational conditions are met, instead of relying on staff to remember.

**Examples:**

- Missed approval window → **callback task** assigned to the service advisor.
- Vehicle returns for repeat fault → **management review task** opened.
- Parts order overdue vs supplier ETA → **parts chase task** assigned to parts.
- Vehicle approaching collection slot → **QC inspection task** queued.
- Customer message unanswered for >X hours → **response task** assigned.

**Operational benefit:** removes the largest source of forgotten actions — things that exist only in someone's head.

**Productivity impact:** reduces admin / coordination overhead substantially per advisor per day.

---

## Workflow Escalation System

Some tasks and workflows are stuck because no one notices. An escalation engine watches for stalled flows and escalates them.

**Examples of triggers:**
- delayed customer approvals
- technician inactivity on an assigned job
- parts not yet booked onto an active job
- jobs exceeding estimated time by a threshold
- customers not contacted within their expected window
- retail prep vehicles approaching forecourt deadline

**Escalation levels:**
1. **L1 — Notify owner:** the assigned staff member receives a soft prompt.
2. **L2 — Notify department:** the team / foreman / lead is informed.
3. **L3 — Notify management:** manager sees it on a dashboard.
4. **L4 — Operational risk flag:** surfaced on the daily summary and shift handover.

**What it provides:**
- Department-level notifications routed through the existing notifications system.
- Manager visibility via the operational health dashboard.
- Workload monitoring (who has too many escalations open).

---

## Smart Operational Timeline

A single unified timeline per vehicle / job / customer combining everything currently scattered across pages:

- workshop actions
- internal messages
- VHC activity
- approvals
- clocking events
- bookings
- parts updates
- customer communication

**Operational benefit:** answers "what's going on with this car?" in seconds, from one screen. Removes the need to open four tabs to reconstruct a story.

**UI label:** **Smart Timeline** — already aligned with the earlier branding rules.

---

## Workflow Health Monitoring

A dealership-wide health monitor that continuously evaluates operational state and surfaces issues automatically.

**Monitored signals:**
- blocked workflows
- inactive vehicles (no events for X hours)
- overloaded departments
- workflow bottlenecks
- delayed handovers
- excessive customer waiting time
- queue pressure (parts counter, advisor desk, valet bay)

**Surface:** a manager dashboard tile combining live indicators, with drill-down into the affected vehicles, jobs, or staff.

**Productivity benefit:** problems become visible before they become customer-facing complaints.

---

## Intelligent Handover Coordination

The system should prepare each department for an upcoming handover automatically, instead of relying on a verbal "the customer is coming in at 4".

**Examples:**

- **Service advisor** receives a **collection readiness summary** for the day's collections.
- **Valet** receives a **priority clean queue** ordered by collection slot.
- **Sales** receives **missing handover item warnings** (V5, second key, plates, finance docs).
- **Customer communication** drafts are pre-prepared (collection time, balance to pay, what's been done) for advisor review.

**Outcome:** handover preparation is shifted from minutes before the customer arrives to hours earlier — calmly and predictably.

---

## Operational Event Engine

A central event-driven system is the foundation for all of the above. Every meaningful operational change emits a typed event that other systems can subscribe to.

**Examples of events:**
- vehicle status changed
- customer approved work
- part arrived
- technician clocked off a job
- booking moved or cancelled
- vehicle entered valet
- QC failed
- invoice completed
- key cabinet movement
- message received from customer

**Why it matters:**
- Automation reacts to real state changes, not periodic polling.
- New features can subscribe to existing events without coupling.
- Audit trail is naturally produced as a side effect.
- The event log becomes the operational memory that powers historical analysis (see prior sections).

---

## Cross-Department Awareness

Departments today rely on calls and walked-over questions to know what other departments are doing. The future system gives each department **read-only operational visibility** into the parts of other departments that affect them.

**Examples:**

- **Parts** can see which jobs are currently waiting on stock and their promised times.
- **Valet** can see estimated workshop completion times for vehicles queueing into the valet bay.
- **Service advisors** can see delay-risk indicators on each of their open jobs.
- **Managers** can see live department bottleneck indicators across the site.

**Outcome:** fewer interruptions; better self-coordination; calmer floor.

---

## Smart Queue Systems

Replace ad-hoc paper / whiteboard queues with **dynamic operational queues** that reorder themselves based on real-time state.

**Examples of queues:**
- valet priority queue
- workshop urgency queue
- approval queue
- parts chase queue
- collection queue
- delayed jobs queue
- retail prep queue

**Queue ordering considers:**
- promised time (the most important customer-facing constraint)
- customer waiting status (waiting on-site vs at home)
- job age (FIFO fairness within a tier)
- department pressure (avoid worsening the bottleneck)
- vehicle priority (VIP, retail-critical, comeback)
- operational risk score (jobs at risk of slipping)

**Outcome:** the right thing is always at the top, without anyone arguing about it.

---

## Workflow Recovery Systems

Operational flows break in small, recurring ways. A recovery system detects these and suggests the correction.

**Examples of broken flows the system should detect:**

- A vehicle that has been on-site with no workflow events for >24h ("forgotten vehicle").
- An active job with no allocated technician.
- A job marked complete with no customer update sent.
- A vehicle marked ready but with no invoice generated.
- Parts arrived but the related job still paused.

**Output:** a "Workflow Recovery" list on the relevant manager / advisor dashboard, with a one-click resolution action where possible.

**Operational benefit:** eliminates the long tail of small operational drops that compound into customer complaints and lost revenue.

---

## Intelligent Internal Messaging Coordination

Internal messaging becomes **workflow-aware** rather than free-form chat.

**Examples:**

- Auto-generated update requests when a downstream department is blocked ("Workshop: any ETA on Smith's job? Valet has them queued at 14:00").
- Automatic department notifications on state changes (parts arrived → message to the relevant technician).
- Suggested recipients based on the topic and current shift roster.
- Workflow-triggered conversations created at the right moment, not after the fact.
- Conversations automatically grouped by vehicle / job / customer instead of by ad-hoc chat thread.

**Outcome:** less Slack-style noise; every message has operational meaning and an audit context.

---

## Long-Term Operational Vision

The end state is a dealership that functions as **one connected operational ecosystem**:

- Workflows automatically coordinate between departments.
- Staff spend less time chasing updates.
- Operational bottlenecks surface automatically.
- Management gains real-time operational visibility.
- Customer communication becomes more proactive.
- Tasks generate automatically from operational events.
- Departments stay aligned without constant manual coordination.

**The long-term value is not "AI features".** The long-term value is:

- reduced friction across departments
- fewer missed actions
- lower admin workload per staff member
- faster vehicle throughput
- improved customer communication
- operational transparency end-to-end
- dealership-wide coordination as a default behaviour
- scalable workflows that hold up as volume grows

This system should integrate naturally into the existing H&P DMS — reusing the existing messaging, notifications, dashboards, audit logs, and role-based permissions — and should always **assist** staff rather than replace their decisions. Every automated action and generated task must remain visible, reviewable, and editable.
