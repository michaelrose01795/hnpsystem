import { hasAnyRole, normalizeRoles } from "@/lib/auth/roles";
import { validateSlide } from "./schema";

import { dashboardSlide } from "./definitions/dashboard";
import { jobCardsListSlide } from "./definitions/jobCardsList";
import { jobCreateSlide } from "./definitions/jobCreate";
import { appointmentsSlide } from "./definitions/appointments";
import { myJobsSlide } from "./definitions/myJobs";
import { jobDetailSlide } from "./definitions/jobDetail";
import { vhcSlide } from "./definitions/vhc";
import { partsCreateSlide } from "./definitions/partsCreate";
import { partsGoodsInSlide } from "./definitions/partsGoodsIn";
import { partsDeliveriesSlide } from "./definitions/partsDeliveries";
import { valetSlide } from "./definitions/valet";
import { messagesSlide } from "./definitions/messages";
import { accountsInvoicesSlide } from "./definitions/accountsInvoices";
import { hrDashboardSlide } from "./definitions/hrDashboard";
import { customerPortalSlide } from "./definitions/customerPortal";
import { archiveSlide } from "./definitions/archive";

export const ALL_SLIDES = [
  dashboardSlide,
  jobCardsListSlide,
  jobCreateSlide,
  appointmentsSlide,
  myJobsSlide,
  jobDetailSlide,
  vhcSlide,
  partsCreateSlide,
  partsGoodsInSlide,
  partsDeliveriesSlide,
  valetSlide,
  messagesSlide,
  accountsInvoicesSlide,
  hrDashboardSlide,
  customerPortalSlide,
  archiveSlide,
];

if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
  for (const s of ALL_SLIDES) {
    const err = validateSlide(s);
    if (err) console.warn(`[slideshow] invalid slide ${s?.id}: ${err}`);
  }
}

export function buildSlidesForRole(userRoles) {
  const normalized = normalizeRoles(Array.isArray(userRoles) ? userRoles : []);
  return ALL_SLIDES
    .filter((slide) => {
      if (!slide.roles || slide.roles.length === 0) return true;
      return hasAnyRole(normalized, slide.roles);
    })
    .slice()
    .sort((a, b) => a.workflowIndex - b.workflowIndex);
}
