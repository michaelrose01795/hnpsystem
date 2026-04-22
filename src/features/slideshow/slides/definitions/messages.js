import { WORKFLOW } from "../workflow";

export const messagesSlide = {
  id: "messages",
  route: "/messages",
  title: "Internal Messages",
  roles: null,
  workflowIndex: WORKFLOW.MESSAGES,
  steps: [
    {
      kind: "main",
      position: "center",
      title: "One inbox, one paper trail",
      body: "Replaces WhatsApp group threads and shouted instructions across the workshop. Every message is tied to a job, role, or user — searchable, auditable, never lost.",
    },
    {
      kind: "feature",
      position: "top-right",
      title: "Reduced miscommunication",
      body: "Written requests with job numbers eliminate the 'which car?' ambiguity that causes rework.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Out of WhatsApp",
      body: "Business communication stays on business systems. Staff leaving doesn't mean history leaves with them.",
    },
  ],
};
