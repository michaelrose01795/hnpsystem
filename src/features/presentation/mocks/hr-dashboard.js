import HrDashboardUi from "@/components/page-ui/hr/hr-ui";
import { SectionCard } from "@/components/Section";
import { MetricCard, StatusTag } from "@/components/HR/MetricCard";
import StatusMessage from "@/components/ui/StatusMessage";
import { MockPage } from "./_helpers";

const formattedMetrics = [
  { id: "headcount", label: "Headcount", value: "42" },
  { id: "open-leave", label: "Open Leave", value: "3" },
  { id: "training-due", label: "Training Due", value: "5" },
  { id: "vacancies", label: "Vacancies", value: "2" },
];

const trainingRenewals = [
  { id: "tr-1", employee: "Sarah Bennett", course: "MOT Tester Annual", due: "2026-05-12" },
  { id: "tr-2", employee: "James Patel", course: "First Aid", due: "2026-05-30" },
];

const upcomingAbsences = [
  { id: "abs-1", employee: "Demo Tech", reason: "Holiday", start: "2026-05-04", end: "2026-05-08" },
];

const departmentPerformance = [
  { id: "service", department: "Service", utilisation: 0.82 },
  { id: "parts", department: "Parts", utilisation: 0.74 },
];

const activeWarnings = [];

export default function HrDashboardMock() {
  return (
    <MockPage
      Ui={HrDashboardUi}
      overrides={{
        view: "section1",
        SectionCard,
        MetricCard,
        StatusTag,
        StatusMessage,
        formattedMetrics,
        trainingRenewals,
        upcomingAbsences,
        departmentPerformance,
        activeWarnings,
        isLoading: false,
        error: null,
      }}
    />
  );
}
