import { sendThreadMessage } from "@/lib/database/messages";
import { supabaseService } from "@/lib/supabaseClient";

const SYSTEM_THREAD_ID = Number(process.env.SYSTEM_MESSAGE_THREAD_ID);
const SYSTEM_SENDER_ID = Number(process.env.SYSTEM_MESSAGE_SENDER_ID);

const assertConfig = () => {
  if (!SYSTEM_THREAD_ID || !SYSTEM_SENDER_ID) {
    throw new Error("System notification thread or sender is not configured.");
  }
  if (!supabaseService) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for system notifications.");
  }
};

export const sendSystemNotification = async ({ content, metadata = null }) => {
  assertConfig();
  return sendThreadMessage({
    threadId: SYSTEM_THREAD_ID,
    senderId: SYSTEM_SENDER_ID,
    content,
    metadata,
  });
};
