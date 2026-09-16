// file location: src/pages/api/website/help-chat/index.js
//
// GET   the visitor's saved chats (the widget's History list)
// POST  start a new chat on the page the visitor is viewing; the assistant opens
//       it with the five questions for that page

import { getGreeting } from "@/features/website/helpChat/helpEngine";
import { addHelpChatMessage, createHelpChat, listHelpChatsForVisitor } from "@/lib/database/websiteHelpChat";
import {
  allowHelpChatRequest,
  buildHelpChatPayload,
  cleanPagePath,
  getHelpChatContext,
  sendHelpChatError,
  summariseChat,
} from "@/lib/website/helpChatApi";

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
    if (req.method === "GET") {
      const chats = await listHelpChatsForVisitor(context);
      return res.status(200).json({ success: true, signedIn: Boolean(context.customerId), chats: chats.map(summariseChat) });
    }

    const pagePath = cleanPagePath(req.body?.pagePath);
    const chat = await createHelpChat({ ...context, pagePath });
    const greeting = getGreeting(pagePath);
    await addHelpChatMessage({
      chatId: chat.chat_id,
      author: "assistant",
      content: greeting.answer,
      suggestions: greeting.suggestions,
      pagePath,
    });
    return res.status(201).json(await buildHelpChatPayload(chat, context));
  } catch (error) {
    return sendHelpChatError(res, error, "Could not open the chat.");
  }
}
