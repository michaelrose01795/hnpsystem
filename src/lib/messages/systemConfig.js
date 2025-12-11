const normalizeId = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const warnedContexts = new Set();

export const getSystemMessagingConfig = () => {
  const threadId = normalizeId(process.env.SYSTEM_MESSAGE_THREAD_ID);
  const senderId = normalizeId(process.env.SYSTEM_MESSAGE_SENDER_ID);

  if (!threadId || !senderId) {
    return null;
  }

  return { threadId, senderId };
};

export const warnMissingSystemMessagingConfig = (context = "System messaging") => {
  const key = context.toLowerCase();
  if (warnedContexts.has(key)) {
    return;
  }
  warnedContexts.add(key);
  console.warn(
    `WARN ${context} skipped: configure SYSTEM_MESSAGE_THREAD_ID and SYSTEM_MESSAGE_SENDER_ID to enable system notifications.`
  );
};

export const ensureSystemMessagingConfig = (context) => {
  const config = getSystemMessagingConfig();
  if (!config) {
    warnMissingSystemMessagingConfig(context);
    return null;
  }
  return config;
};
