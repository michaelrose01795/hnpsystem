import MessagesPageUi from "@/components/page-ui/messages/messages-ui";
import { MockPage, DEMO_USER } from "./_helpers";

const demoThreads = [
  {
    id: "thread-1",
    title: "Service Team",
    last_message: "Job 1042 ready for collection.",
    last_message_at: "2026-04-23T10:14:00.000Z",
    unread_count: 0,
  },
  {
    id: "thread-2",
    title: "Parts Office",
    last_message: "Brake pads back-ordered until Friday.",
    last_message_at: "2026-04-23T08:42:00.000Z",
    unread_count: 2,
  },
  {
    id: "thread-3",
    title: "Reception",
    last_message: "Customer Reynolds rescheduled to 09:30.",
    last_message_at: "2026-04-22T16:05:00.000Z",
    unread_count: 0,
  },
];

const demoMessages = [
  { id: "m-1", author: "Service Team", body: "Job 1042 ready for collection.", created_at: "2026-04-23T10:14:00.000Z" },
  { id: "m-2", author: "Demo User", body: "Thanks — calling the customer now.", created_at: "2026-04-23T10:18:00.000Z" },
];

export default function MessagesMock() {
  return (
    <MockPage
      Ui={MessagesPageUi}
      overrides={{
        view: "section2",
        user: DEMO_USER,
        filteredThreads: demoThreads,
        visibleThreads: demoThreads,
        messages: demoMessages,
        activeThread: demoThreads[0],
        activeThreadId: demoThreads[0].id,
        directory: [],
        threadSearchTerm: "",
        messageDraft: "",
        composeMode: "reply",
      }}
    />
  );
}
