// file location: src/lib/getWelcomeQuote.ts
import { createHash } from "crypto";
import { supabase } from "@/lib/database/supabaseClient";
import { resolveWelcomeQuoteSlot } from "@/lib/welcomeQuoteSlot";

const TOTAL_WELCOME_QUOTES = 936;
const FALLBACK_QUOTE = "Progress grows when clear actions are completed with care.";

type WelcomeQuoteRow = {
  text?: string | null;
};

type WelcomeQuoteQueryBuilder = {
  select: (columns: string) => WelcomeQuoteQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => WelcomeQuoteQueryBuilder;
  range: (from: number, to: number) => WelcomeQuoteQueryBuilder;
  maybeSingle: () => Promise<{ data: WelcomeQuoteRow | null; error: unknown }>;
};

type WelcomeQuoteClient = {
  from: (table: "welcome_quotes") => WelcomeQuoteQueryBuilder;
};

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

  if (!supabase) {
    return FALLBACK_QUOTE;
  }

  const welcomeQuoteClient = supabase as unknown as WelcomeQuoteClient;

  const { data, error } = await welcomeQuoteClient
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

