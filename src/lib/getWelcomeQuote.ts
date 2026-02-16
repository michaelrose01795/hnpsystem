// file location: src/lib/getWelcomeQuote.ts
import { createHash } from "crypto";
import { supabase } from "@/lib/supabaseClient";
import { resolveWelcomeQuoteSlot } from "@/lib/welcomeQuoteSlot";

const TOTAL_WELCOME_QUOTES = 936;
const FALLBACK_QUOTE = "Progress grows when clear actions are completed with care.";

const getDeterministicIndex = (userId: string, dateIso: string, slot: string) => {
  const seed = `${userId}:${dateIso}:${slot}`;
  const digest = createHash("sha256").update(seed).digest("hex");
  const first32Bits = parseInt(digest.slice(0, 8), 16);
  return first32Bits % TOTAL_WELCOME_QUOTES;
};

export async function getWelcomeQuote(userId: string): Promise<string> {
  if (!userId || !String(userId).trim()) {
    return FALLBACK_QUOTE;
  }

  const { dateIso, slot } = resolveWelcomeQuoteSlot(new Date());
  const quoteIndex = getDeterministicIndex(String(userId), dateIso, slot);

  const { data, error } = await supabase
    .from("welcome_quotes")
    .select("text")
    .order("id", { ascending: true })
    .range(quoteIndex, quoteIndex)
    .maybeSingle();

  if (error || !data?.text) {
    return FALLBACK_QUOTE;
  }

  return data.text;
}

export default getWelcomeQuote;

