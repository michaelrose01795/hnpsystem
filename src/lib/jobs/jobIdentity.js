// file location: src/lib/jobs/jobIdentity.js
import { formatJobNumberFromId } from "@/lib/database/jobs";

const DEFAULT_PAD_LENGTH = 5;

const normalizeInput = (value) => String(value ?? "").trim();

const stripLeadingJobHash = (value) => value.replace(/^#/, "");

const isNumericToken = (value) => /^\d+$/.test(value);

const toCanonicalNumericJobNumber = (numericToken) => {
  const parsed = Number.parseInt(numericToken, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return String(parsed).padStart(DEFAULT_PAD_LENGTH, "0");
};

const buildJobNumberCandidates = (input) => {
  const normalized = normalizeInput(input);
  if (!normalized) return [];

  const withoutHash = stripLeadingJobHash(normalized);
  const upper = withoutHash.toUpperCase();

  const candidates = new Set();
  candidates.add(withoutHash);
  candidates.add(upper);

  if (isNumericToken(withoutHash)) {
    const canonical = toCanonicalNumericJobNumber(withoutHash);
    if (canonical) {
      candidates.add(canonical);
      candidates.add(String(Number.parseInt(withoutHash, 10)));
    }
  }

  return Array.from(candidates).filter(Boolean);
};

const fetchByJobId = async ({ client, jobId, select }) => {
  if (!Number.isInteger(jobId) || jobId <= 0) return null;
  const { data, error } = await client.from("jobs").select(select).eq("id", jobId).maybeSingle();
  if (error) {
    throw new Error(`Failed to resolve job by id ${jobId}: ${error.message}`);
  }
  return data || null;
};

const fetchByJobNumberCandidates = async ({ client, candidates, select }) => {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const { data, error } = await client
    .from("jobs")
    .select(select)
    .in("job_number", candidates)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to resolve job by job_number: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0 ? data[0] : null;
};

export const resolveJobIdentity = async ({ client, identifier, select = "id, job_number" }) => {
  const normalized = normalizeInput(identifier);
  if (!normalized) return null;

  // First treat raw numeric values as job ids.
  if (Number.isInteger(identifier) && identifier > 0) {
    const byId = await fetchByJobId({ client, jobId: identifier, select });
    if (byId) return byId;
  }

  const token = stripLeadingJobHash(normalized);
  const parsed = Number.parseInt(token, 10);
  const numericLooksValid = Number.isInteger(parsed) && String(parsed) === token;

  // For numeric tokens from URLs, check id first, then job_number variants.
  if (numericLooksValid) {
    const byId = await fetchByJobId({ client, jobId: parsed, select });
    if (byId) return byId;
  }

  const candidates = buildJobNumberCandidates(token);
  const byNumber = await fetchByJobNumberCandidates({ client, candidates, select });
  if (byNumber) return byNumber;

  // Final fallback for numeric tokens: legacy padded mapping from job id.
  if (numericLooksValid) {
    const fallbackJobNumber = formatJobNumberFromId(parsed);
    if (fallbackJobNumber) {
      const fallback = await fetchByJobNumberCandidates({
        client,
        candidates: [fallbackJobNumber],
        select,
      });
      if (fallback) return fallback;
    }
  }

  return null;
};

export const getCanonicalJobNumber = (value) => {
  const normalized = normalizeInput(value);
  if (!normalized) return "";
  const stripped = stripLeadingJobHash(normalized);
  return stripped.toUpperCase();
};
