// file location: src/pages/api/welcome-quote.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import getWelcomeQuote from "@/lib/getWelcomeQuote";
import { getWelcomeQuoteSlotKey } from "@/lib/welcomeQuoteSlot";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const sessionUserId =
      session?.user?.id ||
      session?.user?.sub ||
      session?.user?.user_id ||
      null;
    const fallbackUserId =
      typeof req.query.userId === "string" && req.query.userId.trim()
        ? req.query.userId.trim()
        : null;
    const effectiveUserId = sessionUserId || fallbackUserId;

    if (!effectiveUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const quote = await getWelcomeQuote(String(effectiveUserId));
    return res.status(200).json({
      quote,
      slotKey: getWelcomeQuoteSlotKey(new Date()),
    });
  } catch (error) {
    console.error("welcome-quote api error", error);
    return res.status(500).json({ error: "Failed to resolve welcome quote" });
  }
}

