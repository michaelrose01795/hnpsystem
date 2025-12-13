import { sendThreadMessage } from "@/lib/database/messages";
import { ensureSystemMessagingConfig } from "@/lib/messages/systemConfig";
import { supabaseService } from "@/lib/supabaseClient";

const assertServiceRoleAccess = () => {
  if (!supabaseService) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for system notifications.");
  }
};

export const sendSystemNotification = async ({
  content,
  metadata = null,
  context = "System notifications",
}) => {
  assertServiceRoleAccess();
  const systemConfig = ensureSystemMessagingConfig(context);
  if (!systemConfig) {
    return null;
  }

  return sendThreadMessage({
    threadId: systemConfig.threadId,
    senderId: systemConfig.senderId,
    content,
    metadata,
  });
};
