// file location: src/pages/api/tracking/equipment/documents.js
//
//   POST   /api/tracking/equipment/documents   multipart upload
//            equipmentId (required), docType, title, expiresAt, checkId, faultId,
//            file (required)
//          Photos attached to a check or a fault can be added by anyone who can
//          check equipment; every other document type needs manageDocuments.
//   GET    /api/tracking/equipment/documents?id=…[&download=1]
//          → { url } a five-minute signed URL (the bucket is private)
//   DELETE /api/tracking/equipment/documents?id=…                 (managers)
//          Soft delete: hidden from the record, file and index row kept.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { normalizeRoles } from "@/lib/auth/roles";
import {
  createEquipmentDocument,
  getEquipmentDocument,
  removeEquipmentDocument,
} from "@/lib/database/equipment";
import {
  deleteEquipmentDocumentFile,
  getEquipmentDocumentSignedUrl,
  uploadEquipmentDocument,
} from "@/lib/storage/equipmentDocumentsBucketService";
import { EQUIPMENT_UPLOAD_MAX_BYTES } from "@/config/equipmentTracking";
import {
  authorizeEquipment,
  resolveEquipmentCapabilities,
} from "@/features/tracking/equipment/equipmentPermissions";
import {
  auditEquipment,
  resolveEquipmentActor,
  sendEquipmentError,
} from "@/lib/tracking/equipmentRequest";

export const config = { api: { bodyParser: false } };

// Same streaming multipart reader as /api/parts/delivery-diary/proof — the Web
// FormData parser, so no extra dependency is introduced.
const parseMultipart = async (req) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new Error("Expected a multipart form upload.");
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > EQUIPMENT_UPLOAD_MAX_BYTES + 512 * 1024) throw new Error("That file is too large.");
    chunks.push(chunk);
  }
  const formData = await new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": contentType },
  }).formData();

  const fields = {};
  let file = null;
  for (const [key, value] of formData.entries()) {
    if (key === "file" && value && typeof value === "object" && typeof value.arrayBuffer === "function") {
      file = {
        fileName: value.name || "document",
        mimeType: value.type || "application/octet-stream",
        buffer: Buffer.from(await value.arrayBuffer()),
      };
      continue;
    }
    fields[key] = typeof value === "string" ? value : "";
  }
  return { fields, file };
};

async function handler(req, res, session) {
  const capabilities = resolveEquipmentCapabilities(normalizeRoles(session?.user?.roles ?? []));

  if (req.method === "GET") {
    try {
      const document = await getEquipmentDocument(req.query.id);
      const url = await getEquipmentDocumentSignedUrl(document.storage_path, {
        download: req.query.download === "1" ? document.file_name : undefined,
      });
      return res.status(200).json({ success: true, data: { url } });
    } catch (error) {
      return sendEquipmentError(res, error, "Failed to open the document");
    }
  }

  if (req.method === "DELETE") {
    if (!capabilities.manageDocuments) {
      return res.status(403).json({ success: false, message: "Your role cannot remove documents." });
    }
    try {
      const { actor, auditContext } = await resolveEquipmentActor(req, res, session);
      const document = await getEquipmentDocument(req.query.id);
      await removeEquipmentDocument(document.id, actor);
      await auditEquipment(auditContext, {
        action: "equipment_document_removed",
        entityId: document.equipment_id,
        afterData: { documentId: document.id, docType: document.doc_type },
      });
      return res.status(200).json({ success: true, data: { id: document.id } });
    } catch (error) {
      return sendEquipmentError(res, error, "Failed to remove the document");
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  let parsed;
  try {
    parsed = await parseMultipart(req);
  } catch (error) {
    return res.status(400).json({ success: false, message: error?.message || "Invalid upload" });
  }
  const { fields, file } = parsed;
  if (!file) return res.status(400).json({ success: false, message: "Attach a file." });

  const isEvidencePhoto = fields.docType === "photo" && Boolean(fields.checkId || fields.faultId);
  if (!(isEvidencePhoto ? capabilities.uploadPhotos : capabilities.manageDocuments)) {
    return res.status(403).json({ success: false, message: "Your role cannot add equipment documents." });
  }

  let storagePath = null;
  try {
    const { actor, auditContext } = await resolveEquipmentActor(req, res, session);
    ({ storagePath } = await uploadEquipmentDocument(file, fields.equipmentId, fields.docType));
    const document = await createEquipmentDocument(
      {
        equipmentId: fields.equipmentId,
        checkId: fields.checkId || null,
        faultId: fields.faultId || null,
        docType: fields.docType,
        title: fields.title,
        expiresAt: fields.expiresAt || null,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.buffer.length,
        storagePath,
      },
      actor
    );
    await auditEquipment(auditContext, {
      action: "equipment_document_added",
      entityId: document.equipmentId,
      afterData: { documentId: document.id, docType: document.docType },
    });
    return res.status(201).json({ success: true, data: document });
  } catch (error) {
    // The index row failed after the file landed: do not leave an orphan.
    if (storagePath) await deleteEquipmentDocumentFile(storagePath);
    return sendEquipmentError(res, error, error?.message || "Failed to upload the document");
  }
}

export default withRoleGuard(handler, { authorize: authorizeEquipment("view") });
