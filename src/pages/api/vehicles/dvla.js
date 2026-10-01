// Staff registration lookup: the VES response shape remains backward-compatible.
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { lookupDvla } from "@/lib/vehicles/lookup";

export async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (typeof req.body?.registration !== "string") return res.status(400).json({ error: "Enter a registration." });
  try {
    const result = await lookupDvla(req.body.registration);
    return res.status(200).json({ ...result.data, lookupSource: result.source, lookupRetrievedAt: result.retrievedAt });
  } catch (error) {
    return res.status(error.status || 503).json({ error: error.status ? error.message : "DVLA lookup is temporarily unavailable." });
  }
}

export default withRoleGuard(handler);
