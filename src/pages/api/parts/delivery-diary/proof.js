// file location: src/pages/api/parts/delivery-diary/proof.js
//
// Attaches proof of delivery — a drop photo and/or a signature — to a delivery.
//
// Accepts a multipart form so a phone camera capture uploads directly:
//   deliveryJobId  (required)
//   photo          file field, optional
//   signature      data-URL text field (canvas export), optional
//
// The upload goes through the same ensure-bucket/upload service shape as VHC
// media. If the service-role key is absent the route reports that cleanly and
// the page degrades to recipient-name-only proof rather than failing the
// delivery.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { hasAllAccessRole, normalizeRoles } from "@/lib/auth/roles";
import { getAuditContext } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";
import {
  DELIVERY_DIARY_ROLES,
  resolveDeliveryCapabilities,
} from "@/features/deliveries/deliveryStatus";
import {
  getDeliveryJob,
  listDeliveryEvents,
  recordDeliveryEvent,
  updateDeliveryJob,
} from "@/lib/database/deliveries";
import {
  deleteDeliveryPodFile,
  uploadDeliveryPodFile,
} from "@/lib/storage/deliveryPodBucketService";

export const config = { api: { bodyParser: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const SIGNATURE_DATA_URL_RE = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

// Same streaming multipart reader used by /api/vhc/customer-video-upload — the
// Web FormData parser, so no extra dependency is introduced.
const parseMultipart = async (req) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new Error("Expected a multipart form upload.");
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_UPLOAD_BYTES + 512 * 1024) {
      throw new Error("Proof of delivery is too large.");
    }
    chunks.push(chunk);
  }

  const response = new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": contentType },
  });
  const formData = await response.formData();

  const fields = {};
  let photo = null;
  for (const [key, value] of formData.entries()) {
    if (key === "photo" && value && typeof value === "object" && typeof value.arrayBuffer === "function") {
      const arrayBuffer = await value.arrayBuffer();
      photo = {
        fileName: value.name || "delivery-proof.jpg",
        mimeType: value.type || "image/jpeg",
        buffer: Buffer.from(arrayBuffer),
      };
      continue;
    }
    fields[key] = typeof value === "string" ? value : "";
  }
  return { fields, photo };
};

async function handler(req, res, session) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  const roles = normalizeRoles(session?.user?.roles ?? []);
  const capabilities = resolveDeliveryCapabilities(roles, hasAllAccessRole(roles));
  if (!capabilities.drive) {
    res.status(403).json({ success: false, message: "Your role cannot record proof of delivery." });
    return;
  }

  let parsed;
  try {
    parsed = await parseMultipart(req);
  } catch (error) {
    res.status(400).json({ success: false, message: error?.message || "Invalid upload" });
    return;
  }

  const { fields, photo } = parsed;
  const deliveryJobId = String(fields.deliveryJobId || "");
  if (!UUID_RE.test(deliveryJobId)) {
    res.status(400).json({ success: false, message: "Invalid delivery id" });
    return;
  }

  const signatureMatch = SIGNATURE_DATA_URL_RE.exec(String(fields.signature || ""));
  if (!photo && !signatureMatch) {
    res.status(400).json({ success: false, message: "Attach a photo or a signature." });
    return;
  }

  try {
    const before = await getDeliveryJob(deliveryJobId);
    if (!before) {
      res.status(404).json({ success: false, message: "Delivery not found" });
      return;
    }

    const patch = {};
    const captured = [];

    if (photo) {
      const uploaded = await uploadDeliveryPodFile(photo, deliveryJobId, "photo");
      patch.pod_photo_url = uploaded.publicUrl;
      patch.pod_photo_path = uploaded.storagePath;
      captured.push("photo");
      // Replacing an earlier photo: drop the superseded object so the bucket
      // does not accumulate unreferenced files.
      if (before.pod_photo_path) await deleteDeliveryPodFile(before.pod_photo_path);
    }

    if (signatureMatch) {
      const uploaded = await uploadDeliveryPodFile(
        {
          fileName: "signature.png",
          mimeType: "image/png",
          buffer: Buffer.from(signatureMatch[1], "base64"),
        },
        deliveryJobId,
        "signature"
      );
      patch.pod_signature_url = uploaded.publicUrl;
      patch.pod_signature_path = uploaded.storagePath;
      captured.push("signature");
      if (before.pod_signature_path) await deleteDeliveryPodFile(before.pod_signature_path);
    }

    const recipientName = String(fields.recipientName || "").trim().slice(0, 120);
    if (recipientName) patch.pod_recipient_name = recipientName;
    patch.pod_captured_at = new Date().toISOString();

    const auditContext = await getAuditContext(req, res);
    if (auditContext.actorUserId) patch.pod_captured_by = auditContext.actorUserId;

    const after = await updateDeliveryJob(deliveryJobId, patch);

    await recordDeliveryEvent({
      deliveryJobId,
      eventType: "delivery.proof_captured",
      actorUserId: auditContext.actorUserId,
      actorName: session?.user?.name || session?.user?.email || null,
      summary: `Proof of delivery captured (${captured.join(" + ")})`,
      detail: { captured, recipient: after?.pod_recipient_name || null },
    });

    await writeAuditLog({
      ...auditContext,
      action: "delivery_proof_captured",
      entityType: "parts_delivery_job",
      entityId: deliveryJobId,
      reason: captured.join(" + "),
    });

    const events = await listDeliveryEvents(deliveryJobId);
    res.status(200).json({ success: true, data: { delivery: after, events } });
  } catch (error) {
    console.error("Proof-of-delivery upload failed:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Unable to store proof of delivery",
    });
  }
}

export default withRoleGuard(handler, { allow: DELIVERY_DIARY_ROLES });
