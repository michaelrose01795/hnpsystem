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
      body: "Presentation shows how the app replaces scattered WhatsApp threads and shouted workshop instructions with searchable, auditable job-linked messages.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"messages-thread-list\"]",
      position: "right",
      title: "Thread list with context",
      body: "Threads show job numbers, previews and unread state so staff can find the right conversation quickly.",
    },
    {
      kind: "tooltip",
      anchor: "[data-presentation=\"messages-conversation\"]",
      position: "left",
      title: "Conversation stays inside the system",
      body: "Updates, approvals and questions are kept on the business record instead of disappearing into private chat apps.",
    },
    {
      kind: "feature",
      position: "bottom-right",
      title: "Reduced miscommunication",
      body: "Written requests with job numbers remove the 'which car?' ambiguity that causes rework and delays.",
    },
  ],
};
