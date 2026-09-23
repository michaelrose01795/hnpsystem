// file location: src/pages/api/website/help-chat/[chatId].js
//
// GET   one chat and everything in it (assistant replies, system notices and,
//       once queued, the conversation with the team from public.messages).
//       The widget polls this while the chat is queued or active.
// POST  { action }
//         "message"  { content, pagePath }  ask the assistant, or message the
//                                           team once the chat is queued/active
//         "queue"    { contactName, contactEmail, pagePath }  wait for a person;
//                                           a signed-in customer's own details
//                                           are used instead of the form
//         "close"    end the chat

import { answerQuestion } from "@/features/website/helpChat/helpEngine";
import { getCustomerById } from "@/lib/database/customers";
import {
  HELP_CHAT_STATUS,
  addHelpChatMessage,
  claimHelpChatForCustomer,
  closeHelpChat,
  getHelpChatForVisitor,
  listHelpChatMessages,
  queueHelpChat,
  renameHelpChatFromQuestion,
  sendCustomerHelpChatMessage,
  touchHelpChat,
} from "@/lib/database/websiteHelpChat";
import {
  EMAIL_RE,
  allowHelpChatRequest,
  buildHelpChatPayload,
  cleanPagePath,
  cleanText,
  getHelpChatContext,
  sendHelpChatError,
} from "@/lib/website/helpChatApi";

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

async function handleMessage(chat, body) {
  const content = String(body?.content || "").trim().slice(0, 1000);
  if (!content) throw badRequest("Type a message first.");
  const pagePath = cleanPagePath(body?.pagePath || chat.page_path);

  if (chat.status === HELP_CHAT_STATUS.CLOSED) {
    throw Object.assign(new Error("This chat has ended. Start a new chat to ask something else."), { status: 409 });
  }

  let next = await renameHelpChatFromQuestion(chat, content);

  if (chat.status === HELP_CHAT_STATUS.BOT) {
    const history = (await listHelpChatMessages(chat.chat_id)).map((m) => ({ author: m.author, content: m.content }));
    await addHelpChatMessage({ chatId: chat.chat_id, author: "customer", content, pagePath });
    const reply = answerQuestion(content, { pagePath, history });
    await addHelpChatMessage({
      chatId: chat.chat_id,
      author: "assistant",
      content: reply.answer,
      links: reply.links,
      suggestions: reply.suggestions,
      offerHandoff: reply.offerHandoff,
      pagePath,
    });
    return touchHelpChat(next.chat_id);
  }

  next = await sendCustomerHelpChatMessage({ chat: next, content });
  return next;
}

async function handleQueue(chat, body, context) {
  const pagePath = cleanPagePath(body?.pagePath || chat.page_path);
  const customer = context.customerId ? await getCustomerById(context.customerId) : null;

  const contactName = customer
    ? cleanText([customer.firstname, customer.lastname].filter(Boolean).join(" ") || customer.name, 80) || "Customer"
    : cleanText(body?.contactName, 80);
  const contactEmail = customer ? cleanText(customer.email, 160) : cleanText(body?.contactEmail, 160).toLowerCase();

  if (!customer) {
    if (contactName.length < 2) throw badRequest("Please tell us your name.");
    if (!EMAIL_RE.test(contactEmail)) throw badRequest("Please enter a valid email address so we can reply if you leave.");
  }

  const wasWaiting = chat.status === HELP_CHAT_STATUS.QUEUED || chat.status === HELP_CHAT_STATUS.ACTIVE;
  const next = await queueHelpChat({ chat, customer, contactName, contactEmail, pagePath });
  if (!wasWaiting) {
    await addHelpChatMessage({
      chatId: chat.chat_id,
      author: "system",
      content:
        "You're in the queue. The next available member of our team will join this chat. You can close this window; your chat is saved in History.",
    });
  }
  return next;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  if (!allowHelpChatRequest(req)) {
    return res.status(429).json({ success: false, message: "Too many requests. Please wait a moment." });
  }

  const context = getHelpChatContext(req, res);

  try {
    let chat = await getHelpChatForVisitor({ chatId: req.query.chatId, ...context });
    chat = await claimHelpChatForCustomer(chat, context.customerId);

    if (req.method === "POST") {
      const action = String(req.body?.action || "");
      if (action === "message") chat = await handleMessage(chat, req.body);
      else if (action === "queue") chat = await handleQueue(chat, req.body, context);
      else if (action === "close") chat = await closeHelpChat({ chat });
      else throw badRequest("Unknown action.");
    }

    return res.status(200).json(await buildHelpChatPayload(chat, context));
  } catch (error) {
    return sendHelpChatError(res, error, "Could not update the chat.");
  }
}
