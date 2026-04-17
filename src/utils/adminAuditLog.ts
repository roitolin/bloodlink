import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

type AdminAuditAction =
  | "donor_approved"
  | "donor_rejected"
  | "donor_data_deleted"
  | "user_disabled"
  | "user_enabled"
  | "user_deleted"
  | "request_deleted"
  | "request_escalated"
  | "broadcast_created"
  | "broadcast_resolved"
  | "report_status_updated"
  | "block_deactivated";

type AdminAuditLogPayload = {
  adminId?: string | null;
  action: AdminAuditAction | string;
  targetType: "user" | "request" | "broadcast" | "report" | "block" | "system" | string;
  targetId?: string | null;
  summary: string;
  metadata?: Record<string, any>;
};

export const logAdminAction = async (payload: AdminAuditLogPayload) => {
  if (!payload.adminId) return;

  try {
    await addDoc(collection(db, "admin_audit_logs"), {
      adminId: payload.adminId,
      action: payload.action,
      targetType: payload.targetType,
      targetId: payload.targetId || null,
      summary: payload.summary,
      metadata: payload.metadata || {},
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to write admin audit log:", error);
  }
};

