import JobCardsWaitingNextJobsUi from "@/components/page-ui/job-cards/waiting/job-cards-waiting-nextjobs-ui";
import { demoJobs } from "../demoData/demoJobs";
import { MockPage } from "./_helpers";

// section1=loading, section2=Access Denied, section3=empty, section4=main board.
const demoOutstandingJobs = demoJobs.map((job, index) => ({
  id: job.id,
  jobNumber: job.job_number,
  reg: job.reg,
  customer: job.customer_name,
  make: job.make,
  model: job.model,
  makeModel: `${job.make} ${job.model}`,
  status: index === 0 ? "Checked In" : job.status,
  waitingStatus: index === 1 ? "Waiting" : "Neither",
  checkedInAt: job.booked_in,
  type: "Service",
  requests: [
    { id: `${job.id}-request-1`, text: job.complaint },
    { id: `${job.id}-request-2`, text: index === 2 ? "MOT while on site" : "Customer asked for update before 4pm" },
  ],
  appointment: { scheduledTime: job.booked_in },
}));

const panelJobs = [
  {
    id: "tech-demo-1",
    name: "Demo Tech",
    jobs: demoOutstandingJobs.slice(0, 2),
  },
  {
    id: "tech-demo-2",
    name: "A Patel",
    jobs: demoOutstandingJobs.slice(2),
  },
  {
    id: "tech-demo-3",
    name: "M Evans",
    jobs: [],
  },
];

function getJobRequestItems(job) {
  return (Array.isArray(job?.requests) ? job.requests : []).map((request, index) => ({
    id: request.id || `${job?.jobNumber || "job"}-${index}`,
    text: request.text || request.description || `Request ${index + 1}`,
  }));
}

function renderAssigneePanel(assignee) {
  return (
    <div
      key={assignee.id}
      style={{
        height: "100%",
        minHeight: 0,
        padding: "14px",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <strong style={{ color: "var(--accent-purple)" }}>{assignee.name}</strong>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflow: "hidden" }}>
        {assignee.jobs.length === 0 ? (
          <span style={{ color: "var(--text-1)", fontSize: 13 }}>Available for next job</span>
        ) : (
          assignee.jobs.map((job) => (
            <span key={job.jobNumber} style={{ color: "var(--text-1)", fontSize: 13 }}>
              {job.jobNumber} - {job.reg}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default function JobCardsWaitingNextJobsMock() {
  return (
    <MockPage
      Ui={JobCardsWaitingNextJobsUi}
      overrides={{
        view: "section4",
        hasAccess: true,
        activeDropTarget: null,
        assignedJobs: panelJobs,
        assignedMotJobs: [],
        deriveJobTypeLabel: () => "Service + 2",
        dragState: { clientX: 0, clientY: 0 },
        draggingJob: null,
        dropIndicator: null,
        feedbackMessage: null,
        filteredOutstandingJobs: demoOutstandingJobs,
        formatAppointmentTime: (job) =>
          job?.appointment?.scheduledTime
            ? new Date(job.appointment.scheduledTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
            : "No appointment",
        formatCheckedInTime: (value) =>
          value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Not recorded",
        formatCustomerStatus: (value) => value || "Neither",
        getJobDetailsRequestRows: (job) =>
          getJobRequestItems(job).map((item, index) => ({
            id: item.id,
            label: `Request ${index + 1}`,
            text: item.text,
          })),
        getJobRequestItems,
        getJobRequestsCount: (job) => getJobRequestItems(job).length,
        highlightedSearchJobNumbers: [],
        hoveredRequestJobNumber: null,
        isDragActive: false,
        jobCardRefs: { current: {} },
        matchesDropIndicator: () => false,
        motPanelList: [],
        OUTSTANDING_GRID_MAX_HEIGHT_PX: "210px",
        outstandingJobs: demoOutstandingJobs,
        PANEL_HEIGHT_PX: "492px",
        renderAssigneePanel,
        searchTerm: "",
        selectedJob: null,
      }}
    />
  );
}
