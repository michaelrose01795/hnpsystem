// file location: src/features/vhcAssistant/buildVhcAssistantMessages.js

import { ASSISTANT_STAGES } from "./vhcAssistantRules";

const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

export const buildVhcAssistantMessages = (state = {}) => {
  const counters = state?.counters || {};
  const urgent = (counters.red || 0) + (counters.amber || 0);

  const summary = [];
  if (!state?.hasChecks) {
    summary.push("No VHC findings have been captured yet.");
  } else {
    if (urgent > 0) summary.push(`${pluralize(urgent, "urgent item")} currently tracked.`);
    if ((counters.awaitingCustomerDecision || 0) > 0) {
      summary.push(`${pluralize(counters.awaitingCustomerDecision, "item")} waiting for customer decision.`);
    }
    if ((counters.authorized || 0) > 0) {
      summary.push(`${pluralize(counters.authorized, "item")} authorised.`);
    }
    if ((counters.declined || 0) > 0) {
      summary.push(`${pluralize(counters.declined, "item")} declined.`);
    }
    if ((counters.green || 0) > 0) {
      summary.push(`${pluralize(counters.green, "green check")} marked okay.`);
    }
  }

  const nextActions = [];
  if (state?.blockedByReadOnly) {
    nextActions.push("This tab is read-only. Review status and proceed in the next editable stage.");
  } else if (state?.sectionCompletion?.incompleteKeys?.length > 0) {
    nextActions.push(`Finish ${pluralize(state.sectionCompletion.incompleteKeys.length, "mandatory section")} first.`);
  } else if ((counters.missingLabour || 0) > 0) {
    nextActions.push(`Add labour time to ${pluralize(counters.missingLabour, "urgent item")} before send.`);
  } else if ((counters.missingParts || 0) > 0) {
    nextActions.push(`Add parts or mark not required for ${pluralize(counters.missingParts, "urgent item")}.`);
  } else if ((counters.awaitingCustomerDecision || 0) > 0 && !state?.sentToCustomer) {
    nextActions.push("Open preview, then send the VHC to the customer.");
  } else if ((counters.authorisedNotComplete || 0) > 0) {
    nextActions.push(`Progress ${pluralize(counters.authorisedNotComplete, "authorised item")} to completion.`);
  } else {
    nextActions.push("No critical blockers found. Continue with final checks and handover flow.");
  }

  if ((counters.authorisedWithoutLinkedParts || 0) > 0) {
    nextActions.push(`Link parts rows for ${pluralize(counters.authorisedWithoutLinkedParts, "authorised item")} to keep parts/invoice flow aligned.`);
  }

  const stageExplainers = {
    [ASSISTANT_STAGES.NOT_STARTED]: "Start by capturing the mandatory VHC sections and any red/amber findings.",
    [ASSISTANT_STAGES.DATA_CAPTURE_IN_PROGRESS]: "Capture remaining section data so the VHC can be reviewed end-to-end.",
    [ASSISTANT_STAGES.REVIEW_REQUIRED]: "VHC has findings, but key pricing/parts details are still missing.",
    [ASSISTANT_STAGES.READY_TO_SEND]: "All core checks look prepared and the VHC can be sent for customer decisions.",
    [ASSISTANT_STAGES.SENT_WAITING_RESPONSE]: "VHC has been sent; watch for incoming customer authorise/decline decisions.",
    [ASSISTANT_STAGES.DECISIONS_RECEIVED]: "Customer decisions are in; progress authorised work and close the loop.",
    [ASSISTANT_STAGES.AUTHORISED_WORK_IN_PROGRESS]: "Authorised work exists and still needs workshop completion updates.",
    [ASSISTANT_STAGES.COMPLETED]: "All required VHC activity is complete for this job.",
  };

  return {
    summary,
    nextActions,
    stageExplainer: stageExplainers[state?.stage] || "VHC state is being assessed from current checks.",
  };
};

export default buildVhcAssistantMessages;
