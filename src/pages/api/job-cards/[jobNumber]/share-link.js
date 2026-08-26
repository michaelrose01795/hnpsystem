// file location: src/pages/api/job-cards/[jobNumber]/share-link.js
import { createClient } from "@supabase/supabase-js";
import { resolveJobIdentity } from "@/lib/jobs/jobIdentity";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveSharedVhcReport } from "@/lib/vhc/sharedReport";
import { generateShareCode } from "@/lib/vhc/shareCode";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration");
}

const dbClient = createClient(supabaseUrl, serviceRoleKey);

// Customer-facing share code — see @/lib/vhc/shareCode for the alphabet and why.
function generateLinkCode() {
  return generateShareCode();
}

// Check if a link is expired (24 hours)
function isLinkExpired(createdAt) {
  const expiryMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const created = new Date(createdAt).getTime();
  return Date.now() - created > expiryMs;
}

async function getIdentity(rawJobNumber, res) {
  if (!rawJobNumber) {
    res.status(400).json({ success: false, error: "Job number is required" });
    return null;
  }
  const identity = await resolveJobIdentity({
    client: dbClient,
    identifier: rawJobNumber,
    select: "id, job_number",
  });
  if (!identity?.id) {
    res.status(404).json({ success: false, error: "Job not found" });
    return null;
  }
  return identity;
}

// GET is public: validation is by linkCode (the link itself is the secret),
// so a customer following a share URL on any device — no auth cookies — can
// load their VHC report.
// The public read path lives in @/lib/vhc/sharedReport so getServerSideProps on
// the customer page can run exactly the same resolution without an internal HTTP
// hop. This handler is now just the HTTP translation of it — same statuses, same
// payloads, same viewed_at side effect.
async function publicGetHandler(req, res) {
  const { jobNumber, linkCode } = req.query;
  const { status, body } = await resolveSharedVhcReport({ jobNumber, linkCode });
  return res.status(status).json(body);
}
// POST stays role-guarded: only staff can mint share links.

// POST stays role-guarded: only staff can mint share links.
async function protectedPostHandler(req, res, session) {
  const { jobNumber: rawJobNumber } = req.query;
  const identity = await getIdentity(rawJobNumber, res);
  if (!identity) return;
  const canonicalJobNumber = identity.job_number;

  {
    try {
      // First, check if there's an existing valid (non-expired) link
      const { data: existingLinks, error: fetchError } = await dbClient
        .from("job_share_links")
        .select("*")
        .eq("job_number", canonicalJobNumber)
        .order("created_at", { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error("Error fetching existing links:", fetchError);
        // Continue to create a new link
      }

      // Check if the most recent link is still valid
      if (existingLinks && existingLinks.length > 0) {
        const latestLink = existingLinks[0];
        if (!isLinkExpired(latestLink.created_at)) {
          // Return the existing valid link
          return res.status(200).json({
            success: true,
            linkCode: latestLink.link_code,
            createdAt: latestLink.created_at,
            expiresAt: new Date(new Date(latestLink.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
            isNew: false,
          });
        }
      }

      // Generate a new link code
      const linkCode = generateLinkCode();

      // Get the job ID
      const { data: job, error: jobError } = await dbClient
        .from("jobs")
        .select("id")
        .eq("id", identity.id)
        .maybeSingle();

      if (jobError || !job) {
        return res.status(404).json({ success: false, error: "Job not found" });
      }

      // Insert the new share link
      const { data: newLink, error: insertError } = await dbClient
        .from("job_share_links")
        .insert({
          job_id: job.id,
          job_number: canonicalJobNumber,
          link_code: linkCode,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating share link:", insertError);
        return res.status(500).json({ success: false, error: "Failed to create share link" });
      }

      return res.status(201).json({
        success: true,
        linkCode: newLink.link_code,
        createdAt: newLink.created_at,
        expiresAt: new Date(new Date(newLink.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        isNew: true,
      });
    } catch (error) {
      console.error("Error generating share link:", error);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
}

const guardedPost = withRoleGuard(protectedPostHandler);

export default async function handler(req, res) {
  if (req.method === "GET") return publicGetHandler(req, res);
  if (req.method === "POST") return guardedPost(req, res);
  return res.status(405).json({ success: false, error: "Method not allowed" });
}
