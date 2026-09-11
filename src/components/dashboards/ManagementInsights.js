import React, { useMemo, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Button, ContentWidth, LayerSurface, LayerTheme, PageShell } from "@/components/ui";
import { TabGroup } from "@/components/ui/tabAPI/TabGroup";
import { InlineLoading } from "@/components/ui/LoadingSkeleton";
import KpiTrendChart from "@/components/reporting/KpiTrendChart";

const number = (value) => new Intl.NumberFormat("en-GB").format(Number(value) || 0);
const money = (value) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(value) || 0);
const hours = (value) => value == null ? "Not measured" : `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)}h`;
const percent = (value) => value == null ? "Not measured" : `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)}%`;
const date = (value, format = "D MMM, HH:mm") => value && dayjs(value).isValid() ? dayjs(value).format(format) : "Not recorded";
const jobLink = (job) => job?.job_number
  ? <Link className="management-job-link" href={`/job-cards/${encodeURIComponent(job.job_number)}`}>{job.job_number}</Link>
  : "No linked job";

function Section({ title, subtitle, children }) {
  return <LayerTheme as="section">
    <header className="management-row">
      <div><h2>{title}</h2>{subtitle && <p className="management-muted">{subtitle}</p>}</div>
    </header>
    {children}
  </LayerTheme>;
}

// A headline figure. `delta` is the period-on-period movement from the data
// layer; `better` says which direction is good, so a falling turnaround time
// reads as an improvement rather than as a drop.
function Metric({ label, value, helper, delta, better = "up" }) {
  const change = delta?.change ?? 0;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const tone = direction === "flat" ? "flat" : direction === better ? "good" : "bad";
  return <LayerTheme className="management-metric" gap="4px">
    <span className="management-muted">{label}</span>
    <strong className="management-value">{value}</strong>
    {delta && direction !== "flat" && (
      <span className={`management-delta management-delta--${tone}`}>
        {direction === "up" ? "▲" : "▼"} {delta.percent == null ? "New" : `${Math.abs(delta.percent)}%`}
        <span className="management-muted"> vs previous period</span>
      </span>
    )}
    {helper && <span className="management-muted">{helper}</span>}
  </LayerTheme>;
}

function Metrics({ items }) {
  return <div className="management-metrics">
    {items.filter(Boolean).map((item) => <Metric key={item.label} {...item} />)}
  </div>;
}

function Chart({ title, subtitle, series, unit = "count", formatValue = number }) {
  return <Section title={title} subtitle={subtitle}>
    <KpiTrendChart series={series} unit={unit} height={180} />
    <details><summary>View daily figures</summary>
      <div className="management-scroll" tabIndex={0} role="region" aria-label={`${title} daily figures`}>
        <table className="app-data-table"><caption>{title}</caption><thead><tr><th scope="col">Date</th><th scope="col">Value</th></tr></thead>
          <tbody>{series.map((point) => <tr key={point.key}><td>{date(point.key, "D MMM YYYY")}</td><td>{formatValue(point.value)}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </Section>;
}

// Horizontal ranked bars. The accent is the only hue in the system, so weight
// carries the ranking: the leading bar is solid and the tail fades back.
function Bars({ title, subtitle, items, formatValue = number, empty = "No records to display." }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return <Section title={title} subtitle={subtitle}>
    {items.length ? <ul className="management-bars">{items.map((item, index) => <li key={item.label}>
      <div className="management-row">
        <span>{item.label}</span>
        <strong>{formatValue(item.value)}{total > 0 && <span className="management-muted"> · {Math.round((item.value / total) * 100)}%</span>}</strong>
      </div>
      <svg width="100%" height="10" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="10" fill="var(--surface)" rx="2" />
        <rect width={item.value / max * 100} height="10" fill="var(--accentText)" opacity={Math.max(0.35, 1 - index * 0.12)} rx="2" />
      </svg>
    </li>)}</ul> : <p className="management-muted">{empty}</p>}
  </Section>;
}

// Vertical columns for a fixed, ordered scale (hour of day, day of week) where
// the sequence matters more than the ranking.
function Columns({ title, subtitle, items, empty = "No records to display." }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return <Section title={title} subtitle={subtitle}>
    {items.length ? <>
      <ul className="management-columns" role="img" aria-label={`${title}: ${items.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
        {items.map((item) => <li key={item.label}>
          <span className="management-column-value">{item.value || ""}</span>
          <span className="management-column-bar" style={{ height: `${Math.max(2, (item.value / max) * 100)}%` }} />
          <span className="management-column-label">{item.label}</span>
        </li>)}
      </ul>
    </> : <p className="management-muted">{empty}</p>}
  </Section>;
}

// Proportional ring for a small mix (five or six slices at most). Slices are
// separated by opacity rather than hue, matching the single-accent palette.
function Donut({ title, subtitle, items, formatValue = number, empty = "No records to display." }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const slices = items.map((item, index) => {
    const fraction = total > 0 ? item.value / total : 0;
    const slice = { ...item, fraction, dash: fraction * circumference, offset, opacity: Math.max(0.3, 1 - index * 0.16) };
    offset += slice.dash;
    return slice;
  });
  return <Section title={title} subtitle={subtitle}>
    {total > 0 ? <div className="management-donut">
      <svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label={`${title}: ${items.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--surface)" strokeWidth="20" />
        {slices.map((slice) => <circle key={slice.label} cx="80" cy="80" r={radius} fill="none"
          stroke="var(--accentText)" strokeOpacity={slice.opacity} strokeWidth="20"
          strokeDasharray={`${slice.dash} ${circumference - slice.dash}`}
          strokeDashoffset={-slice.offset} transform="rotate(-90 80 80)" />)}
        <text x="80" y="76" className="management-donut-total" textAnchor="middle">{formatValue(total)}</text>
        <text x="80" y="94" className="management-donut-caption" textAnchor="middle">Total</text>
      </svg>
      <ul className="management-legend">
        {slices.map((slice) => <li key={slice.label}>
          <span className="management-swatch" style={{ opacity: slice.opacity }} aria-hidden="true" />
          <span>{slice.label}</span>
          <strong>{formatValue(slice.value)}<span className="management-muted"> · {Math.round(slice.fraction * 100)}%</span></strong>
        </li>)}
      </ul>
    </div> : <p className="management-muted">{empty}</p>}
  </Section>;
}

// A single ratio expressed as a filled track, for conversion and settlement
// rates where the remainder is as meaningful as the value itself.
function Ratio({ label, value, caption, leftLabel, rightLabel }) {
  return <div className="management-ratio">
    <div className="management-row"><span>{label}</span><strong>{percent(value)}</strong></div>
    <div className="management-ratio-track"><span className="management-ratio-fill" style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }} /></div>
    <div className="management-row management-muted"><span>{leftLabel}</span><span>{rightLabel}</span></div>
    {caption && <p className="management-muted">{caption}</p>}
  </div>;
}

function Table({ title, subtitle, columns, rows, empty, pageSize = 10 }) {
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return <Section title={title} subtitle={subtitle}>
    {rows.length ? <>
      <div className="management-scroll" tabIndex={0} role="region" aria-label={title}>
        <table className="app-data-table"><caption>{title}</caption><thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{visible.map((row) => <tr key={row.key}>{row.cells.map((cell, index) => <td key={columns[index]}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="management-row"><span className="management-muted">Showing {currentPage * pageSize + 1}–{Math.min(rows.length, (currentPage + 1) * pageSize)} of {rows.length}</span>
        {lastPage > 0 && <div className="management-actions">
          <Button variant="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button>
          <Button variant="secondary" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next</Button>
        </div>}
      </div>
    </> : <p className="management-muted">{empty}</p>}
  </Section>;
}

function Notices({ items }) {
  return <Section title="Latest notices" subtitle="Latest five notifications">
    {items == null ? <p>Notices are unavailable.</p> : items.length ? <ul className="management-notices">
      {items.map((item) => <li key={item.notification_id}><p>{String(item.message || "").replace(/^\s*(?:ℹ️?|ⓘ)\s*/, "")}</p>
        <small className="management-muted">{item.target_role || "General"} · {date(item.created_at)}</small></li>)}
    </ul> : <p className="management-muted">No notices at the moment.</p>}
  </Section>;
}

// ---------------------------------------------------------------------------
// Manager view
// ---------------------------------------------------------------------------

function managerTabs(data) {
  const period = `Last ${data.days} days, including today`;
  const technicianRows = data.technicians.map((tech) => ({
    key: tech.userId,
    cells: [tech.name, tech.role, number(tech.openJobs), tech.overdueJobs ? number(tech.overdueJobs) : "—",
      number(tech.completedJobs), hours(tech.hours), tech.hoursPerJob == null ? "—" : hours(tech.hoursPerJob),
      tech.avgTurnaroundHours == null ? "—" : hours(tech.avgTurnaroundHours)],
  }));

  return [
    {
      value: "overview",
      label: "Overview",
      render: () => <>
        <Metrics items={[
          { label: "Open jobs", value: number(data.openCount), helper: `${number(data.onSiteCount)} on site now` },
          { label: "Completed", value: number(data.completedCount), helper: period, delta: data.completedDelta, better: "up" },
          { label: "Vehicles in", value: number(data.checkedInCount), helper: period, delta: data.checkedInDelta, better: "up" },
          { label: "Average turnaround", value: hours(data.avgTurnaroundHours), helper: `Median ${hours(data.medianTurnaroundHours)} · arrival to completion`, delta: data.turnaroundDelta, better: "down" },
          { label: "Customer updates overdue", value: number(data.overdueCount), helper: "Open jobs past their next update time" },
          { label: "Awaiting assignment", value: number(data.unassignedCount), helper: "Checked in, no technician assigned" },
        ]} />
        <Section title="Today at a glance" subtitle="Live counts for the current day only">
          <div className="management-inline-stats">
            <div><span className="management-muted">Arrived today</span><strong>{number(data.checkedInToday)}</strong></div>
            <div><span className="management-muted">Completed today</span><strong>{number(data.completedToday)}</strong></div>
            <div><span className="management-muted">Updates due today</span><strong>{number(data.dueOutToday)}</strong></div>
            <div><span className="management-muted">Waiting customers</span><strong>{number(data.waitingCount)}</strong></div>
            <div><span className="management-muted">VHCs incomplete</span><strong>{number(data.pendingVhcCount)}</strong></div>
            <div><span className="management-muted">Parts requests pending</span><strong>{number(data.pendingParts)}</strong></div>
          </div>
        </Section>
        <div className="management-grid">
          <Chart title="Jobs completed" subtitle={`${number(data.completedCount)} completed · ${period}`} series={data.completionSeries} />
          <Chart title="Vehicle arrivals" subtitle={`${number(data.checkedInCount)} checked in · ${period}`} series={data.arrivalSeries} />
        </div>
        <Bars title="Where open work is held up" subtitle="Every open job placed at the furthest stage it has reached" items={data.stageMix} />
        <Table title="Work requiring attention" subtitle={`Up to 15 open jobs: overdue updates first, then longest on site. ${number(data.openCount)} open in total.`}
          columns={["Job", "Registration", "Stage", "Technician", "Days on site", "Follow-up"]}
          rows={data.attention.map((job) => ({ key: job.id, cells: [jobLink(job), job.vehicle_reg || "Not recorded", job.stage, job.technician, job.ageDays ?? "Not checked in", job.reason] }))}
          empty="No open jobs require attention." pageSize={15} />
        <Notices items={data.escalations} />
      </>,
    },
    {
      value: "workload",
      label: "Workload",
      render: () => <>
        <Metrics items={[
          { label: "Open jobs", value: number(data.openCount), helper: "Excludes completed and cancelled work" },
          { label: "On site", value: number(data.onSiteCount), helper: "Checked in and not yet completed" },
          { label: "Aged 4+ days", value: number(data.agedCount), helper: "Elapsed days since check-in" },
          { label: "Awaiting allocation", value: number(data.unassignedCount), helper: "Checked in, no technician assigned" },
        ]} />
        <div className="management-grid">
          <Bars title="Open workload by status" subtitle="Current snapshot, across all job dates" items={data.statusMix} />
          <Bars title="Time since check-in" subtitle="Elapsed days; booked jobs shown separately" items={data.ageing} />
          <Donut title="Work type mix" subtitle="Open jobs by job type" items={data.typeMix} />
          <Donut title="Division mix" subtitle="Open jobs by division" items={data.divisionMix} />
        </div>
        <Bars title="Where the work comes from" subtitle="Open jobs by booking source" items={data.sourceMix} />
        <Table title="Longest on site" subtitle="The ten open jobs that have been here the longest"
          columns={["Job", "Registration", "Vehicle", "Stage", "Technician", "Days on site"]}
          rows={data.longestOpen.map((job) => ({ key: job.id, cells: [jobLink(job), job.vehicle_reg || "Not recorded", job.vehicle_make_model || "Not recorded", job.stage, job.technician, job.ageDays] }))}
          empty="No vehicles are currently on site." />
      </>,
    },
    {
      value: "team",
      label: "Team",
      render: () => <>
        <Metrics items={[
          { label: "Hours clocked", value: hours(data.clockedHours), helper: `Job clocking · ${period}` },
          { label: "Technicians carrying work", value: number(data.technicians.filter((tech) => tech.openJobs > 0).length), helper: `${number(data.technicians.length)} in the workload list` },
          { label: "Average turnaround", value: hours(data.avgTurnaroundHours), helper: "Arrival to completion", delta: data.turnaroundDelta, better: "down" },
          { label: "Unassigned work", value: number(data.unassignedCount), helper: "Checked in, no technician assigned" },
        ]} />
        {!data.hasClockingData && <Section title="Clocked hours" subtitle="Unavailable"><p className="management-muted">Clocking data could not be loaded, so hours are shown as zero.</p></Section>}
        <Chart title="Hours clocked to jobs" subtitle={`${hours(data.clockedHours)} across the period`} series={data.clockedHoursSeries} unit="hours" formatValue={hours} />
        <Table title="Technician workload" subtitle="Open jobs are current; completions, hours and turnaround cover the selected period"
          columns={["Technician", "Role", "Open", "Overdue", "Completed", "Hours", "Hours / job", "Avg turnaround"]}
          rows={technicianRows} empty="No technician workload to display." pageSize={12} />
        <Chart title="Average turnaround by completion day" subtitle="Hours from arrival to completion, averaged over the jobs completed that day" series={data.turnaroundSeries} unit="hours" formatValue={hours} />
        <Bars title="Turnaround spread" subtitle={`How long the ${number(data.completedCount)} completed jobs took, arrival to completion`} items={data.turnaroundBuckets} />
      </>,
    },
    {
      value: "vhc",
      label: "VHC & parts",
      render: () => <>
        <Metrics items={[
          { label: "VHCs completed", value: number(data.vhcCompletedCount), helper: period },
          { label: "VHCs sent to customers", value: number(data.vhcSentCount), helper: period },
          { label: "Work authorised", value: money(data.vhcAuthorisedTotal), helper: "Value approved from VHCs sent in the period" },
          { label: "Work declined", value: money(data.vhcDeclinedTotal), helper: "Value declined from the same VHCs" },
        ]} />
        <Section title="VHC authorisation rate" subtitle="Share of the value offered to customers that came back authorised">
          <Ratio label="Authorised share of offered work" value={data.vhcConversionRate}
            leftLabel={`Authorised ${money(data.vhcAuthorisedTotal)}`} rightLabel={`Declined ${money(data.vhcDeclinedTotal)}`}
            caption={`${number(data.pendingVhcCount)} checked-in jobs still have a VHC outstanding. This measures money, not the number of checks.`} />
        </Section>
        <Chart title="VHCs completed" subtitle={period} series={data.vhcSeries} />
        <div className="management-grid">
          <Bars title="Parts requests by age" subtitle={`${number(data.pendingParts)} pending requests, by how long they have waited`} items={data.partsAgeing} />
          <Table title="Oldest pending parts requests" subtitle="Jobs held up waiting for parts, oldest first"
            columns={["Waiting", "Job", "Description", "Qty"]}
            rows={data.partsQueue.map((request) => ({ key: request.request_id, cells: [hours(request.ageHours), jobLink(request.job), request.description || "No description recorded", request.quantity ?? "—"] }))}
            empty="No parts requests are pending." />
        </div>
      </>,
    },
    {
      value: "revenue",
      label: "Revenue",
      render: () => data.hasRevenueData === false
        ? <Section title="Invoiced value" subtitle="Unavailable"><p className="management-muted">Invoicing data could not be loaded. Try refreshing the dashboard.</p></Section>
        : <>
          <Metrics items={[
            { label: "Invoiced", value: money(data.invoicedTotal), helper: `${number(data.invoicedCount)} invoices · ${period}`, delta: data.invoicedDelta, better: "up" },
            { label: "Average invoice", value: money(data.averageInvoice), helper: "Invoiced value divided by invoice count" },
            { label: "Labour", value: money(data.labourTotal), helper: "Labour lines across the period" },
            { label: "Parts", value: money(data.partsTotal), helper: "Parts lines across the period" },
          ]} />
          <Chart title="Invoiced value" subtitle={`${money(data.invoicedTotal)} raised · ${period}`} series={data.invoicedSeries} unit="currency" formatValue={money} />
          <Donut title="Labour and parts split" subtitle="Invoiced value by line type, across the period"
            items={[{ label: "Labour", value: Math.round(data.labourTotal) }, { label: "Parts", value: Math.round(data.partsTotal) }]}
            formatValue={money} />
          <Bars title="Work authorised through VHC" subtitle="Authorised and declined value from VHCs sent in the period"
            items={[{ label: "Authorised", value: Math.round(data.vhcAuthorisedTotal) }, { label: "Declined", value: Math.round(data.vhcDeclinedTotal) }]}
            formatValue={money} empty="No VHCs were sent in this period." />
        </>,
    },
  ];
}

// ---------------------------------------------------------------------------
// Admin view
// ---------------------------------------------------------------------------

function adminTabs(data) {
  const period = `Last ${data.days} days, including today`;

  return [
    {
      value: "overview",
      label: "Overview",
      render: () => <>
        <Metrics items={[
          { label: "Appointments today", value: number(data.appointmentsToday), helper: "All booking statuses" },
          { label: "Appointments ahead", value: number(data.appointmentsUpcoming), helper: "Today and the next six days" },
          { label: "Booked this period", value: number(data.appointmentsPeriod), helper: period, delta: data.appointmentsDelta, better: "up" },
          { label: "Cancellation rate", value: percent(data.cancellationRate), helper: `${number(data.cancelledCount)} cancelled in the period` },
          { label: "Pending parts requests", value: number(data.partsRequests), helper: "Requests with pending status" },
          { label: "New accounts", value: number(data.newUsers), helper: `Created in the last ${data.days} days` },
        ]} />
        <div className="management-grid">
          <Chart title="Daily appointment volume" subtitle={`${period} · all statuses`} series={data.appointmentSeries} />
          <Chart title="Upcoming booking demand" subtitle="Today and the next six days · all statuses, not a capacity forecast" series={data.bookingForecast} />
        </div>
        <Table title="Today's appointment diary" subtitle="Ordered by scheduled time; includes cancelled bookings so status changes remain visible"
          columns={["Time", "Job", "Registration", "Booking status"]}
          rows={data.appointments.map((item) => ({ key: item.appointment_id, cells: [date(item.scheduled_time, "HH:mm"), jobLink(item.job), item.job?.vehicle_reg || "Not recorded", item.status || "Unknown"] }))}
          empty="No appointments scheduled for today." />
        <Notices items={data.notices} />
      </>,
    },
    {
      value: "bookings",
      label: "Bookings",
      render: () => <>
        <Metrics items={[
          { label: "Booked this period", value: number(data.appointmentsPeriod), helper: period, delta: data.appointmentsDelta, better: "up" },
          { label: "Cancelled", value: number(data.cancelledCount), helper: percent(data.cancellationRate) + " of bookings in the period" },
          { label: "Jobs created", value: number(data.jobIntakeCount), helper: `New job records · ${period}` },
          { label: "Total job records", value: number(data.totalJobs), helper: "All-time, including closed jobs" },
        ]} />
        <Columns title="Demand by time of day" subtitle="Appointments today and over the next six days, by scheduled hour" items={data.bookingHours} />
        <div className="management-grid">
          <Columns title="Demand by day of week" subtitle={`Appointments scheduled in the period · ${period}`} items={data.bookingWeekdays} />
          <Donut title="Today's booking status" subtitle="Status of today's scheduled appointment records" items={data.appointmentStatuses} />
        </div>
        <Table title="Upcoming appointments" subtitle="The next bookings after today, ordered by scheduled time"
          columns={["When", "Job", "Registration", "Booking status"]}
          rows={data.upcomingAppointments.map((item) => ({ key: item.appointment_id, cells: [date(item.scheduled_time, "ddd D MMM, HH:mm"), jobLink(item.job), item.job?.vehicle_reg || "Not recorded", item.status || "Unknown"] }))}
          empty="No appointments are scheduled beyond today." />
        <div className="management-grid">
          <Chart title="Job records created" subtitle={`${number(data.jobIntakeCount)} created · ${period}`} series={data.jobIntakeSeries} />
          <Bars title="Where jobs come from" subtitle={`Job records created in the period, by source`} items={data.jobSourceMix} />
        </div>
      </>,
    },
    {
      value: "revenue",
      label: "Invoicing",
      render: () => data.hasRevenueData === false
        ? <Section title="Invoicing" subtitle="Unavailable"><p className="management-muted">Invoicing data could not be loaded. Try refreshing the dashboard.</p></Section>
        : <>
          <Metrics items={[
            { label: "Invoiced", value: money(data.invoicedTotal), helper: `${number(data.invoicedCount)} invoices · ${period}`, delta: data.invoicedDelta, better: "up" },
            { label: "Average invoice", value: money(data.averageInvoice), helper: "Invoiced value divided by invoice count" },
            { label: "Outstanding", value: money(data.outstandingTotal), helper: `${number(data.outstandingCount)} issued and unpaid · last ${data.ledgerDays} days` },
            { label: "Draft invoices", value: money(data.draftTotal), helper: `${number(data.draftCount)} not yet issued` },
          ]} />
          <Chart title="Invoiced value" subtitle={`${money(data.invoicedTotal)} raised · ${period}`} series={data.invoicedSeries} unit="currency" formatValue={money} />
          <Bars title="Outstanding debt by age" subtitle={`Unpaid issued invoices from the last ${data.ledgerDays} days, aged against their due date`}
            items={data.debtAgeing} formatValue={number} empty="Nothing is outstanding." />
          <Table title="Oldest outstanding invoices" subtitle="Issued, unpaid and furthest past their due date"
            columns={["Invoice", "Job", "Account", "Due", "Days overdue", "Value"]}
            rows={data.oldestOutstanding.map((invoice) => ({ key: invoice.invoice_id, cells: [invoice.invoice_number || "Not numbered", invoice.job_number || "No linked job", invoice.account_number || "Retail", date(invoice.due_date || invoice.invoice_date, "D MMM YYYY"), invoice.daysOverdue > 0 ? number(invoice.daysOverdue) : "Not yet due", money(invoice.value)] }))}
            empty="No invoices are outstanding." />
          <Bars title="How settled invoices were paid" subtitle={`Payment method on settled invoices from the last ${data.ledgerDays} days`} items={data.paymentMix} />
        </>,
    },
    {
      value: "people",
      label: "People",
      render: () => <>
        <Metrics items={[
          { label: "On site now", value: number(data.onSiteCount), helper: `${number(data.onBreakCount)} on a break` },
          { label: "Away today", value: number(data.absentTodayCount), helper: "Approved absence covering today" },
          { label: "Active accounts", value: number(data.activeStaffCount), helper: `${number(data.inactiveStaffCount)} deactivated` },
          { label: "New accounts", value: number(data.newUsers), helper: `Created in the last ${data.days} days` },
        ]} />
        <Table title="Attendance today" subtitle={data.hasAttendanceData === false ? "Attendance could not be loaded." : "Clocking records for today, by colleague"}
          columns={["Colleague", "Role", "State", "Clocked in", "Clocked out", "Hours"]}
          rows={data.attendance.map((row) => ({ key: row.id, cells: [row.name, row.role, row.state, date(row.clock_in, "HH:mm"), date(row.clock_out, "HH:mm"), row.total_hours == null ? "—" : hours(row.total_hours)] }))}
          empty="No clocking records for today." pageSize={12} />
        <div className="management-grid">
          <Bars title="Active accounts by role" subtitle="Everyone with an active account" items={data.roleMix} />
          <Bars title="Active accounts by department" subtitle="Everyone with an active account" items={data.departmentMix} />
        </div>
        <Table title="Upcoming holiday cover" subtitle="Approved holidays overlapping today and the next six days"
          columns={["Colleague", "From", "To"]}
          rows={(data.holidays || []).map((item) => ({ key: item.absence_id, cells: [item.userName || "Unknown user", date(item.start_date, "D MMM"), date(item.end_date, "D MMM")] }))}
          empty={data.holidays == null ? "Holiday cover is unavailable." : "No approved holidays in this period."} />
        <Table title="Recently created accounts" subtitle={`Latest 10 of ${number(data.newUsers)} accounts created in the last ${data.days} days; review roles and activation`}
          columns={["Name", "Role", "Account status", "Created"]}
          rows={data.recentUsers.map((item) => ({ key: item.user_id, cells: [[item.first_name, item.last_name].filter(Boolean).join(" ") || "Unknown user", item.role || "Not recorded", item.is_active === true ? "Active" : item.is_active === false ? "Inactive" : "Unknown", date(item.created_at)] }))}
          empty="No accounts created in this period." />
      </>,
    },
    {
      value: "queue",
      label: "Admin queue",
      render: () => <>
        <Metrics items={[
          { label: "Pending parts requests", value: number(data.partsRequests), helper: "Requests with pending status" },
          { label: "Draft invoices", value: number(data.draftCount), helper: `${money(data.draftTotal)} not yet issued` },
          { label: "Cancelled bookings", value: number(data.cancelledCount), helper: `${period} · review before rebooking` },
        ]} />
        <Table title="Oldest pending parts requests" subtitle={`Showing the oldest 10 of ${number(data.partsRequests)} pending requests`}
          columns={["Requested", "Job", "Description", "Quantity"]}
          rows={data.pendingParts.map((item) => ({ key: item.request_id, cells: [date(item.created_at), jobLink(item.job), item.description || "No description recorded", item.quantity ?? "Not recorded"] }))}
          empty="No parts requests are pending." />
        <Notices items={data.notices} />
      </>,
    },
  ];
}

export default function ManagementInsights({ mode, data, error, loading, refreshing, days, onDaysChange, onRefresh }) {
  const admin = mode === "admin";
  const [tab, setTab] = useState("overview");
  const tabs = useMemo(() => (data ? (admin ? adminTabs(data) : managerTabs(data)) : []), [admin, data]);
  const active = tabs.find((item) => item.value === tab) || tabs[0];

  return <PageShell sectionKey={`${mode}-dashboard-shell`}>
    <ContentWidth sectionKey={`${mode}-dashboard-content`} widthMode="content">
      <LayerSurface className="management-dashboard">
        <header className="management-row">
          <div><h1>{admin ? "Admin overview" : "Manager overview"}</h1>
            <p className="management-muted">{admin ? "Bookings, invoicing, administration and team cover." : "Workload, delivery, team and the next actions for your department."}</p></div>
          <Button variant="primary" busy={refreshing} onClick={onRefresh}>Refresh dashboard</Button>
        </header>
        <div className="management-row">
          <div className="management-actions" role="group" aria-label="Reporting period">
            {[7, 30].map((value) => <Button key={value} variant="secondary" aria-pressed={days === value} onClick={() => onDaysChange(value)}>Last {value} days</Button>)}
          </div>
          <p className="management-muted">Charts and period figures follow this selection; workload is current. Dates use your local time.</p>
        </div>
        {error && <p role="alert">Unable to refresh this dashboard. Please try again.{data ? " The figures below are from the last successful refresh." : ""}</p>}
        {loading || (!data && !error) ? <InlineLoading label="Loading dashboard data" /> : data ? <>
          <p className="management-muted" role="status">Last updated {date(data.updatedAt)}{refreshing ? " · Refreshing…" : ""}</p>
          {data.warnings?.map((warning) => <p key={warning} role="status">{warning}</p>)}
          <TabGroup items={tabs.map(({ value, label }) => ({ value, label }))} value={active?.value} onChange={setTab}
            ariaLabel={admin ? "Admin dashboard sections" : "Manager dashboard sections"} />
          {active?.render()}
        </> : null}
      </LayerSurface>
      {/* Scoped to these two dashboards: responsive analytical grids, ranked
          bars, donuts and readable tables have no equivalent in the base layout
          classes. Colour comes from tokens only — the single accent is
          separated by weight, not by hue. */}
      <style jsx global>{`
        .management-dashboard { min-width: 0; gap: var(--page-stack-gap); font-variant-numeric: tabular-nums; }
        .management-dashboard h1 { margin: 0; font-size: clamp(1.5rem, 3vw, 2rem); }
        .management-dashboard h2 { margin: 0; font-size: 1.1rem; }
        .management-dashboard p { margin: 0; line-height: 1.6; }
        .management-dashboard .management-muted { color: var(--text-1); opacity: 0.72; font-size: var(--text-body-sm); }
        .management-dashboard .management-value { font-size: 2rem; line-height: 1.15; }
        .management-dashboard .management-row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--layout-card-gap); }
        .management-dashboard .management-actions { display: flex; flex-wrap: wrap; gap: var(--layout-card-gap); }
        .management-dashboard .management-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: var(--layout-card-gap); }
        .management-dashboard .management-delta { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-body-sm); }
        .management-dashboard .management-delta--good { color: var(--success-base); }
        .management-dashboard .management-delta--bad { color: var(--danger-base); }
        .management-dashboard .management-delta--flat { color: var(--text-1); }
        .management-dashboard .management-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: var(--page-stack-gap); }
        .management-dashboard section { min-width: 0; }
        .management-dashboard .management-scroll { overflow-x: auto; max-width: 100%; }
        .management-dashboard table { width: 100%; border-collapse: collapse; text-align: left; font-size: var(--text-body-sm); }
        .management-dashboard caption { text-align: left; color: var(--text-1); opacity: 0.72; }
        .management-dashboard th, .management-dashboard td { padding: var(--layout-card-gap); vertical-align: top; overflow-wrap: anywhere; }
        .management-dashboard tbody tr:not(:last-child) { border-bottom: var(--separating-line); }
        .management-dashboard th { font-weight: 600; white-space: nowrap; }
        .management-dashboard .management-bars, .management-dashboard .management-notices, .management-dashboard .management-legend { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--layout-card-gap); }
        .management-dashboard .management-inline-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: var(--layout-card-gap); }
        .management-dashboard .management-inline-stats > div { display: flex; flex-direction: column; gap: 2px; }
        .management-dashboard .management-inline-stats strong { font-size: var(--text-h3); }
        .management-dashboard .management-donut { display: flex; flex-wrap: wrap; align-items: center; gap: var(--page-stack-gap); }
        .management-dashboard .management-donut svg { flex: 0 0 auto; }
        .management-dashboard .management-donut-total { fill: var(--text-1); font-size: 1.25rem; font-weight: 600; }
        .management-dashboard .management-donut-caption { fill: var(--text-1); opacity: 0.72; font-size: 0.7rem; }
        .management-dashboard .management-legend { flex: 1 1 200px; min-width: 0; }
        .management-dashboard .management-legend li { display: flex; align-items: center; gap: var(--layout-card-gap); justify-content: space-between; }
        .management-dashboard .management-swatch { flex: 0 0 auto; width: 12px; height: 12px; border-radius: var(--radius-xs); background: var(--accentText); }
        .management-dashboard .management-legend li > span:nth-child(2) { flex: 1 1 auto; min-width: 0; }
        .management-dashboard .management-columns { list-style: none; margin: 0; padding: 0; display: flex; align-items: flex-end; gap: 4px; min-height: 180px; }
        .management-dashboard .management-columns li { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; height: 180px; }
        .management-dashboard .management-column-bar { display: block; width: 100%; border-radius: var(--radius-xs) var(--radius-xs) 0 0; background: var(--accentText); opacity: 0.85; }
        .management-dashboard .management-column-value, .management-dashboard .management-column-label { font-size: var(--text-caption); color: var(--text-1); opacity: 0.72; white-space: nowrap; }
        .management-dashboard .management-ratio { display: grid; gap: 6px; }
        .management-dashboard .management-ratio-track { height: 12px; border-radius: var(--radius-pill); background: var(--surface); overflow: hidden; }
        .management-dashboard .management-ratio-fill { display: block; height: 100%; background: var(--accentText); }
        .management-dashboard .management-job-link { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; color: var(--accentText); text-decoration: underline; }
        .management-dashboard .app-btn, .management-dashboard summary { min-height: 44px; }
        .management-dashboard summary { display: flex; align-items: center; cursor: pointer; text-decoration: underline; }
        .management-dashboard [aria-pressed="true"] { box-shadow: inset 0 -3px var(--accentText); }
        .management-dashboard :focus-visible { outline: none; box-shadow: var(--focus-ring); }
        @media (max-width: 767px) {
          .management-dashboard th, .management-dashboard td { min-width: 6rem; }
          .management-dashboard .management-columns, .management-dashboard .management-columns li { min-height: 140px; height: 140px; }
          .management-dashboard .management-column-label { font-size: 0.65rem; }
        }
      `}</style>
    </ContentWidth>
  </PageShell>;
}
