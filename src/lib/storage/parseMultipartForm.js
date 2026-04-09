// file location: src/lib/storage/parseMultipartForm.js
// Shared multipart form parser used by all upload API routes.
// Replaces four near-identical copies across the codebase.

/**
 * Parse a multipart/form-data request into { fields, file }.
 * The file is returned as an in-memory Buffer — no temp file on disk.
 *
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<{ fields: Record<string, string>, file: { fieldName: string, fileName: string, mimetype: string, size: number, buffer: Buffer } | null }>}
 */
export async function parseMultipartForm(req) {
  const contentType = req.headers["content-type"] || "";

  if (!contentType.startsWith("multipart/form-data")) {
    throw new Error("Invalid content type. Expected multipart/form-data");
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBuffer = Buffer.concat(chunks);
  const response = new Response(rawBuffer, {
    headers: { "Content-Type": contentType },
  });

  const formData = await response.formData();
  const fields = {};
  let file = null;

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const arrayBuffer = await value.arrayBuffer();
      file = {
        fieldName: key,
        fileName: value.name,
        mimetype: value.type || "application/octet-stream",
        size: value.size || 0,
        buffer: Buffer.from(arrayBuffer),
      };
    } else {
      fields[key] = value;
    }
  }

  return { fields, file };
}
