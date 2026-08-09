import { Router, type IRouter } from "express";
import { db, kycDocumentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { createNotification } from "../lib/createNotification";
import { createAuditLog } from "../lib/createAuditLog";

const router: IRouter = Router();

// ─── User endpoints ───────────────────────────────────────────────────────────

// Upload a KYC document
router.post("/kyc/documents", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { docType, label, dataBase64 } = req.body;

  // The user-facing KYC flow intentionally requires only identity proof and
  // selfie. Keep older address/other records readable for admin history, but
  // do not accept new uploads of those types.
  const validTypes = ["govt_id", "selfie"];
  if (!docType || !validTypes.includes(docType)) {
    res.status(400).json({ error: `docType must be one of: ${validTypes.join(", ")}` });
    return;
  }
  if (!dataBase64 || typeof dataBase64 !== "string" || dataBase64.length < 10) {
    res.status(400).json({ error: "dataBase64 is required" });
    return;
  }

  const [doc] = await db
    .insert(kycDocumentsTable)
    .values({
      userId: user.id as string,
      docType: docType as any,
      label: label ? String(label) : null,
      dataBase64: String(dataBase64),
      status: "pending",
    })
    .returning();

  res.status(201).json(serializeDoc(doc));
});

// List own KYC documents
router.get("/kyc/documents", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const docs = await db
    .select()
    .from(kycDocumentsTable)
    .where(eq(kycDocumentsTable.userId, user.id as string))
    .orderBy(desc(kycDocumentsTable.createdAt));

  res.json({ documents: docs.map((d) => serializeDoc(d, false)) });
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────

// List KYC documents for a user
router.get("/admin/users/:userId/kyc-documents", requireAdmin, async (req, res): Promise<void> => {
  const userId = String(req.params["userId"]);
  const docs = await db
    .select()
    .from(kycDocumentsTable)
    .where(eq(kycDocumentsTable.userId, userId))
    .orderBy(desc(kycDocumentsTable.createdAt));

  res.json({ documents: docs.map((d) => serializeDoc(d)) });
});

// Review a KYC document
router.patch("/admin/kyc-documents/:docId", requireAdmin, async (req, res): Promise<void> => {
  const admin = (req as any).user;
  const docId = String(req.params["docId"]);
  const { status, adminNote } = req.body;

  const validStatuses = ["approved", "rejected", "more_info_requested"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    return;
  }

  const [doc] = await db
    .update(kycDocumentsTable)
    .set({ status: status as any, adminNote: adminNote ? String(adminNote) : null, updatedAt: new Date() })
    .where(eq(kycDocumentsTable.id, docId))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // Send notification to user
  if (status === "approved") {
    await createNotification(doc.userId, "kyc_approved",
      "Document Approved ✓",
      `Your ${formatDocType(doc.docType)} has been approved.`
    ).catch(() => {});
  } else if (status === "rejected") {
    await createNotification(doc.userId, "kyc_rejected",
      "Document Rejected",
      `Your ${formatDocType(doc.docType)} was rejected. ${adminNote ? `Reason: ${adminNote}` : "Please contact support."}`
    ).catch(() => {});
  } else if (status === "more_info_requested") {
    await createNotification(doc.userId, "kyc_documents_required",
      "Additional Information Required",
      adminNote ? String(adminNote) : "Please upload additional documents for verification."
    ).catch(() => {});
  }

  // Audit log
  await createAuditLog({
    adminId: admin.id as string,
    targetUserId: doc.userId,
    action: `kyc_document_${status}`,
    reason: adminNote ? String(adminNote) : undefined,
    metadata: { docId, docType: doc.docType },
  }).catch(() => {});

  res.json(serializeDoc(doc));
});

function formatDocType(type: string): string {
  const map: Record<string, string> = {
    govt_id: "Government ID",
    selfie: "Selfie",
    address_proof: "Address Proof",
    other: "Document",
  };
  return map[type] ?? type;
}

function serializeDoc(d: any, includeData = true) {
  return {
    id: d.id,
    userId: d.userId,
    docType: d.docType,
    label: d.label ?? undefined,
    dataBase64: includeData ? d.dataBase64 : undefined,
    status: d.status,
    adminNote: d.adminNote ?? undefined,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
  };
}

export default router;
