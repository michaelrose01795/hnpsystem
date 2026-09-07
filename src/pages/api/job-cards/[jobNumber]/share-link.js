import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveSharedVhcReport, getOrCreateCustomerVhcLink } from "@/lib/database/vhcCustomerReport";

const createLink = withRoleGuard(async (req, res) => {
  try {
    const link = await getOrCreateCustomerVhcLink(req.query.jobNumber);
    return res.status(link.isNew ? 201 : 200).json({ success: true,
      linkCode: link.link_code, createdAt: link.created_at, expiresAt: null, isNew: link.isNew });
  } catch {
    return res.status(500).json({ success: false, error: "Could not create customer link" });
  }
});

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "POST") return createLink(req, res);
  if (req.method === "GET") {
    const { status, body } = await resolveSharedVhcReport(req.query);
    return res.status(status).json(body);
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ success: false, error: "Method not allowed" });
}
